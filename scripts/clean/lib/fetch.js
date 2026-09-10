/**
 * Discovering and downloading CJEU judgments.
 *
 * Two sources, both public and unauthenticated:
 *
 *   SPARQL   https://publications.europa.eu/webapi/rdf/sparql
 *            asks which cases interpret the GDPR (CELEX 32016R0679)
 *   CELLAR   https://publications.europa.eu/resource/celex/{CELEX}
 *            serves the document itself; EUR-Lex is the fallback
 *
 * The CELLAR-first order is taken from the eulaw-local-mcp server's
 * `judgment-downloader.ts`. It matters: EUR-Lex fronts its HTML endpoint with
 * a WAF that answers a missing or rate-limited CELEX with an HTTP 200
 * "verify you are not a robot" page, so a naive fetch stores the challenge as
 * if it were the judgment.
 *
 * Zero dependencies — Node 20's global fetch and a small HTML-to-text pass.
 */

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'
const CELLAR_URL = celex => `https://publications.europa.eu/resource/celex/${celex}`
const EURLEX_URL = celex =>
  `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${celex}`

const USER_AGENT = 'GDPRed-clean/1.0 (+https://gdpred.milos.no)'

/** GDPR. Change this to point the pipeline at another instrument. */
export const GDPR_CELEX = '32016R0679'

/**
 * Cases interpreting a given act. Mirrors the query the GDPRed pipeline branch
 * uses, trimmed to the fields this tool needs.
 */
function discoveryQuery(actCelex) {
  return `
define sql:signal-void-variables 0
PREFIX cdm:   <http://publications.europa.eu/ontology/cdm#>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX annot: <http://publications.europa.eu/ontology/annotation#>

SELECT
  ?caseCelex
  (SAMPLE(?caseNumber0) AS ?caseNumber)
  (MAX(?caseDate0)      AS ?caseDate)
  (SAMPLE(?caseParties0) AS ?caseParties)
  (GROUP_CONCAT(DISTINCT STR(?loc0); SEPARATOR=", ") AS ?modifiedLocations)
WHERE {
  BIND(<http://publications.europa.eu/resource/celex/${actCelex}> AS ?actCelexURI)
  BIND(<http://publications.europa.eu/resource/authority/language/ENG> AS ?lang)

  ?actWork owl:sameAs ?actCelexURI .
  ?caseWork cdm:case-law_interpretes_resource_legal ?actWork .

  OPTIONAL { ?caseWork cdm:resource_legal_id_celex ?caseCelex0 . }
  OPTIONAL { ?caseWork owl:sameAs ?caseCelexURI . }
  BIND(COALESCE(?caseCelex0, REPLACE(STR(?caseCelexURI), "^.*/", "")) AS ?caseCelex)

  OPTIONAL { ?caseWork cdm:work_date_document ?d1 . }
  OPTIONAL { ?caseWork cdm:date_creation_legacy ?d2 . }
  BIND(COALESCE(?d1, ?d2) AS ?caseDate0)

  OPTIONAL {
    ?caseExpr cdm:expression_belongs_to_work ?caseWork ;
              cdm:expression_uses_language ?lang .
    OPTIONAL { ?caseExpr cdm:expression_case-law_parties ?caseParties0 . }
    OPTIONAL { ?caseExpr cdm:expression_case-law_identifier_case ?caseNumber0 . }
  }

  OPTIONAL {
    ?ax owl:annotatedSource   ?caseWork ;
        owl:annotatedProperty cdm:case-law_interpretes_resource_legal ;
        owl:annotatedTarget   ?actWork ;
        annot:reference_to_modified_location ?loc0 .
  }
}
GROUP BY ?caseCelex
`
}

/** POST the query and return the parsed bindings. */
export async function runSparql(query, { timeoutMs = 60000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ query }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`SPARQL HTTP ${response.status}`)
    const json = await response.json()
    return json.results?.bindings ?? []
  } finally {
    clearTimeout(timer)
  }
}

/** `A04P4, A05P2, A24` -> [4, 5, 24]. */
export function parseModifiedLocations(text) {
  if (!text) return []
  const out = new Set()
  for (const token of String(text).split(/,\s*/)) {
    const m = token.trim().match(/^A(\d+)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 99) out.add(n)
    }
  }
  return [...out].sort((a, b) => a - b)
}

/** `62023CJ0492` -> `C-492/23`. */
export function celexToCaseNumber(celex) {
  const m = String(celex).match(/^6(\d{4})CJ(\d+)$/i)
  if (!m) return null
  return `C-${parseInt(m[2], 10)}/${m[1].slice(2)}`
}

/**
 * Discover cases interpreting an act.
 * Judgments only: a CELEX with `CN` rather than `CJ` is an OJ notice of a
 * pending case, not a decision.
 */
export async function discoverCases({ actCelex = GDPR_CELEX, timeoutMs } = {}) {
  const bindings = await runSparql(discoveryQuery(actCelex), { timeoutMs })
  const byCelex = new Map()

  for (const row of bindings) {
    const celex = row.caseCelex?.value
    if (!celex || !/^\d{5}CJ\d{4}$/i.test(celex)) continue
    if (byCelex.has(celex)) continue
    byCelex.set(celex, {
      celex,
      caseNumber: (row.caseNumber?.value || celexToCaseNumber(celex) || '').replace(/^Case\s+/i, ''),
      date: (row.caseDate?.value || '').slice(0, 10) || null,
      parties: row.caseParties?.value || null,
      articles: parseModifiedLocations(row.modifiedLocations?.value),
    })
  }

  return [...byCelex.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

/**
 * EUR-Lex answers a blocked or missing request with an HTTP 200 challenge
 * page. Storing that as the judgment is the failure mode this guards.
 */
export function looksLikeAntiBotChallenge(html) {
  const head = String(html).slice(0, 4000)
  return (
    /awswaf|challenge-container|Verify you are human|not a robot/i.test(head) ||
    /<title>\s*(?:Just a moment|Attention Required)/i.test(head)
  )
}

/** Download a judgment, CELLAR first. Throws with both statuses on failure. */
export async function downloadJudgment(celex, { timeoutMs = 60000 } = {}) {
  const get = async (url, accept) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: controller.signal,
      })
      return { status: response.status, body: response.ok ? await response.text() : '' }
    } finally {
      clearTimeout(timer)
    }
  }

  let cellarStatus = 0
  for (const mime of ['application/xhtml+xml', 'text/html']) {
    const { status, body } = await get(CELLAR_URL(celex), mime)
    cellarStatus = status
    if (body && !looksLikeAntiBotChallenge(body)) return { html: body, source: 'cellar' }
  }

  const { status, body } = await get(EURLEX_URL(celex), 'text/html')
  if (!body) {
    throw new Error(
      `cannot fetch ${celex}: CELLAR HTTP ${cellarStatus}, EUR-Lex HTTP ${status}`
    )
  }
  if (looksLikeAntiBotChallenge(body)) {
    throw new Error(
      `cannot fetch ${celex}: CELLAR HTTP ${cellarStatus}; EUR-Lex returned an anti-bot ` +
        'challenge instead of the document (it may not exist, or you are being rate-limited)'
    )
  }
  return { html: body, source: 'eur-lex' }
}

// ---------------------------------------------------------------------------
// HTML -> plain text
// ---------------------------------------------------------------------------

const BLOCK_TAGS =
  /<\/?(?:p|div|br|tr|li|h[1-6]|table|thead|tbody|section|article|blockquote|dd|dt)\b[^>]*>/gi

const ENTITIES = {
  // U+00A0, not a plain space: the paragraph-number gap depends on it
  // surviving the whitespace collapse below.
  '&nbsp;': '\u00a0', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&apos;': "'", '&#39;': "'", '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
  '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
}

/**
 * Reduce judgment HTML to the plain text the cleaner expects.
 *
 * Deliberately not a Markdown conversion. `clean-judgment.js` reads textual
 * landmarks, so all it needs is the words with block boundaries preserved as
 * newlines — which also keeps this dependency-free where a Turndown pipeline
 * would not be.
 */
export function htmlToText(html) {
  // Block boundaries become a sentinel first, so that whitespace inside a
  // block — including the source newlines EUR-Lex puts inside inline spans —
  // can be collapsed without splitting a line that belongs together.
  //
  // This matters: the date line is served as
  //   <p>26 January 2023 (<span class="coj-note">\n  <a>*1</a>\n</span>)</p>
  // and treating those newlines as real would break `26 January 2023 (*1)`
  // across four lines, defeating the date and keyword-block landmarks.
  const BLOCK = '\u0000'

  let text = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(BLOCK_TAGS, BLOCK)
    .replace(/<[^>]+>/g, '')

  text = text.replace(/&[a-zA-Z#0-9]+;/g, m => {
    if (ENTITIES[m]) return ENTITIES[m]
    const num = m.match(/^&#(\d+);$/)
    if (num) return String.fromCodePoint(Number(num[1]))
    const hex = m.match(/^&#x([0-9a-f]+);$/i)
    if (hex) return String.fromCodePoint(parseInt(hex[1], 16))
    return m
  })

  // Collapse real whitespace but PRESERVE U+00A0. In CELLAR markup the
  // paragraph number is separated from its prose by eight `&nbsp;`:
  //   <P class="C01PointnumeroteAltN"><A NAME="point1">1</A>&nbsp;x8 This request...
  // JavaScript's `\s` matches U+00A0, so a naive collapse turns that into
  // `1 This request…` — a single space, indistinguishable from prose, and the
  // paragraph numbering is lost. Keeping the run intact lets normaliseRawText
  // map each NBSP to a space, leaving the wide gap that markParagraphNumbers
  // keys on.
  return text
    .split(BLOCK)
    .map(block => block.replace(/[^\S\u00a0]+/g, ' ').trim())
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
