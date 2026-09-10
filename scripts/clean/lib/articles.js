/**
 * GDPR article references: detection, wikilink emission, and the
 * `ruling-articles` / `per-article` frontmatter fields.
 *
 * ## The escaping rule (load-bearing)
 *
 * A wikilink immediately followed by `(` is eaten by CommonMark as an inline
 * link. Verified against the live Quartz build:
 *
 *   [[Article 5]](1\)(c)   ->  <a href="Article%205">Article 5</a>(1)(c)   correct
 *   [[Article 5]](1)(c)    ->  <a href="1">[Article 5]</a>(c)              destroyed
 *
 * So the FIRST closing paren after a wikilink must be backslash-escaped, and
 * only that one — `(c)` further along is already safe because it does not
 * directly follow a `]`. 2,573 references in the corpus get this right; 54
 * across 10 files do not, and those render broken.
 *
 * ## Scope
 *
 * Only articles 1-99 are linked: content/Articles/ holds exactly
 * `Article 1.md` ... `Article 99.md`. Linking `Article 267` (TFEU) would
 * produce a dead link, which is why process_article_refs.cjs exists to undo
 * exactly that. We simply never create them.
 */

import { GDPR_MAX_ARTICLE } from './constants.js'

/**
 * Instruments that are NOT the GDPR. When a reference is followed by one of
 * these before any GDPR marker, it belongs to another legal act and must not
 * be linked to a GDPR article page.
 *
 * This is a heuristic — the reference is instrument-blind in the source text
 * and only surrounding prose disambiguates it. It catches the common cases
 * (Charter, TFEU, other directives) and errs toward NOT linking.
 */
const FOREIGN_INSTRUMENT_RE =
  /^\s*(?:TFEU|TEU|of\s+the\s+(?:Charter|Treaty|Statute|Rules\s+of\s+Procedure|EEA\s+Agreement)|of\s+(?:Council\s+)?(?:Directive|Decision|Framework\s+Decision)\b|of\s+Regulation\s+\((?:EC|EU,\s*Euratom|Euratom)\)|of\s+the\s+(?:Financial|Staff)\s+Regulation)/i

/** Markers that positively identify the GDPR. */
const GDPR_MARKER_RE =
  /Regulation\s+\(EU\)\s+2016\/679|Regulation\s+2016\/679|General\s+Data\s+Protection\s+Regulation|\bGDPR\b/i

/**
 * A single article reference with optional sub-paragraphs, e.g.
 *   "Article 5"            -> { number: 5, suffix: '' }
 *   "Article 5(1)(c)"      -> { number: 5, suffix: '(1)(c)' }
 * The trailing letter form ("Article 16a") is captured so it is NOT split
 * into `[[Article 16]]a`, which is what the current linker does 5 times.
 */
const SINGLE_REF_RE = /\bArticle\s+(\d{1,3})([a-z]\b)?((?:\(\s*[^()\s][^()]*\))*)/g

/** Plural / range forms: "Articles 13 and 14", "Articles 12 to 22". */
const PLURAL_REF_RE =
  /\bArticles\s+(\d{1,3})(?:\([^)]*\))*\s*(?:,\s*(\d{1,3})(?:\([^)]*\))*\s*)*(and|to|and\s+to)\s+(\d{1,3})/gi

/** True when the article number is a real GDPR article page. */
export function isGdprArticle(n) {
  return Number.isInteger(n) && n >= 1 && n <= GDPR_MAX_ARTICLE
}

/**
 * Decide whether a reference should become a wikilink.
 * Returns false for foreign instruments, out-of-range numbers, and references
 * already inside square brackets.
 */
function shouldLink(text, matchStart, matchEnd, number, letterSuffix) {
  if (!isGdprArticle(number)) return false
  // "Article 16a" is a distinct provision of another instrument; never split it.
  if (letterSuffix) return false

  // The court brackets its own editorial insertions: `[Article 3(5) of that
  // directive]`. Linking inside one produces `[[[Article 3]](5\) ...]`, a
  // triple bracket that renders as literal text. The corpus has exactly this
  // bug in C-200-23 and C-659-22; do not reproduce it.
  if (text[matchStart - 1] === '[') return false

  const after = text.slice(matchEnd, matchEnd + 80)
  if (FOREIGN_INSTRUMENT_RE.test(after)) return false
  return true
}

/**
 * Convert plain `Article N(x)(y)` references into Quartz wikilinks with the
 * correct escaping. Plural forms ("Articles 13 and 14") are left untouched:
 * there is no readable wikilink spelling for them, and the corpus leaves them
 * as plain text too.
 *
 * Pass `skipRanges` to protect regions (e.g. fenced code, existing wikilinks).
 */
export function linkArticleRefs(text) {
  const source = String(text)
  // Protect references that are already wikilinked. The NUL sentinel cannot
  // occur in judgment text, so it can never collide with real content.
  const existing = []
  const masked = source.replace(/\[\[[^\]]*\]\](?:\(\d+\\?\))?/g, m => {
    existing.push(m)
    return `\u0000${existing.length - 1}\u0000`
  })

  const linked = masked.replace(
    SINGLE_REF_RE,
    (match, numStr, letter, suffix, offset, whole) => {
      const number = parseInt(numStr, 10)
      if (!shouldLink(whole, offset, offset + match.length, number, letter)) return match
      if (!suffix) return `[[Article ${number}]]`
      // Escape only the first closing paren — see the module comment.
      const escaped = suffix.replace(/\)/, '\\)')
      return `[[Article ${number}]]${escaped}`
    }
  )

  return linked.replace(/\u0000(\d+)\u0000/g, (_, i) => existing[Number(i)])
}

/**
 * Strip wikilinks back to plain text. Used when building frontmatter values,
 * which must never contain `[[...]]` — unquoted `[[` starts a YAML flow
 * sequence and silently turns the value into a nested array (this is exactly
 * how C-203-22.md and C-628-23.md were corrupted).
 */
export function unlinkArticleRefs(text) {
  return String(text)
    .replace(/\[\[([^\]|]+)\|[^\]]*\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\\\)/g, ')')
}

/**
 * Every distinct GDPR article number referenced in `text`, including plural
 * and range forms. Ranges are expanded ("Articles 12 to 22" -> 12..22), which
 * the existing extractors never did.
 */
export function collectArticleNumbers(
  text,
  { expandRanges = true, includeForeignInstruments = false } = {}
) {
  const source = String(text)
  const found = new Set()
  const isForeign = (at, len) =>
    !includeForeignInstruments && FOREIGN_INSTRUMENT_RE.test(source.slice(at + len, at + len + 80))

  for (const m of source.matchAll(SINGLE_REF_RE)) {
    if (m[2]) continue // letter-suffixed provision of another instrument
    const n = parseInt(m[1], 10)
    if (isForeign(m.index, m[0].length)) continue
    if (isGdprArticle(n)) found.add(n)
  }

  for (const m of source.matchAll(PLURAL_REF_RE)) {
    const first = parseInt(m[1], 10)
    const last = parseInt(m[4], 10)
    const joiner = m[3].toLowerCase()
    if (isForeign(m.index, m[0].length)) continue

    if (m[2] && isGdprArticle(parseInt(m[2], 10))) found.add(parseInt(m[2], 10))

    if (joiner.startsWith('to') && expandRanges && last > first && last - first <= 50) {
      for (let n = first; n <= last; n++) if (isGdprArticle(n)) found.add(n)
    } else {
      if (isGdprArticle(first)) found.add(first)
      if (isGdprArticle(last)) found.add(last)
    }
  }

  return [...found].sort((a, b) => a - b)
}

/**
 * Build the `ruling-articles` frontmatter value from the operative part.
 *
 * Scope, `all` (the default) or `gdpr`:
 *
 *   all   every article the operative part interprets, whatever instrument it
 *         belongs to. This is what the committed corpus does — C-129/21 lists
 *         Article 12 of Directive 2002/58, C-132/21 lists Article 47 of the
 *         Charter — so it is the parity-preserving choice.
 *   gdpr  only articles of Regulation 2016/679, gated on the ruling naming it.
 *         Every resulting chip then links to the right page.
 *
 * The trade-off is real either way: `NowReading.tsx` builds
 * `/Articles/Article-N` by hand, so under `all` a Charter article chip points
 * at the GDPR article of the same number. `validate-cases.js` warns about
 * those rather than letting them pass silently.
 *
 * `extraNumbers` merges in an authoritative list, e.g. SPARQL
 * `modifiedLocations`, which names the provisions the case actually modifies.
 */
export function buildRulingArticles(rulingText, { extraNumbers = [], scope = 'all' } = {}) {
  const text = String(rulingText || '')

  let fromText
  if (scope === 'gdpr') {
    fromText = GDPR_MARKER_RE.test(text) ? collectArticleNumbers(text) : []
  } else {
    fromText = collectArticleNumbers(text, { includeForeignInstruments: true })
  }

  const merged = new Set([...fromText, ...extraNumbers.filter(isGdprArticle)])
  return [...merged].sort((a, b) => a - b).map(n => `Article ${n}`)
}

/**
 * Split an operative part into its numbered points.
 * Accepts both the emitted `**1.** text` form and raw `1. text`.
 * A single unnumbered operative paragraph yields one point numbered 1.
 */
export function splitOperativePoints(rulingText) {
  const text = String(rulingText || '').trim()
  if (!text) return []

  const parts = text
    .split(/\n(?=\s*(?:\*\*)?\d+\.(?:\*\*)?\s)/)
    .map(s => s.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    return [{ number: 1, text: text.replace(/^(?:\*\*)?1\.(?:\*\*)?\s*/, '').trim() }]
  }

  return parts.map((part, i) => {
    const m = part.match(/^\s*(?:\*\*)?(\d+)\.(?:\*\*)?\s*([\s\S]*)$/)
    return m
      ? { number: parseInt(m[1], 10), text: m[2].trim() }
      : { number: i + 1, text: part }
  })
}

/**
 * Build the `per-article` frontmatter value: for each ruling article, the
 * operative point(s) that interpret it.
 *
 * One entry is emitted for EVERY article in `ruling-articles`, so the two
 * lists always line up — that is what the committed corpus does. Where an
 * operative point mentions the article, its verbatim text is used; where none
 * does, the corpus's fallback wording is used so the entry still exists.
 *
 * What is deliberately NOT reproduced is the corpus's double-encoding bug: 129
 * of its 194 entries are stored as `  - Article N | ...`, a list item whose
 * value itself begins with two spaces and a hyphen. That is a serialization
 * fault, not content, and `validate-cases.js` reports it.
 */
export const PER_ARTICLE_FALLBACK = article =>
  `${article} | Interpretation from final ruling related to ${article}`

export function buildPerArticle(rulingText, rulingArticles) {
  const points = splitOperativePoints(rulingText)

  const out = []
  for (const article of rulingArticles) {
    const n = parseInt(String(article).match(/\d+/)?.[0] ?? '', 10)
    if (!Number.isInteger(n)) continue

    const re = new RegExp(`\\bArticles?\\s+(?:\\d{1,3}\\s*(?:,|and|to)\\s*)*${n}\\b`, 'i')
    const relevant = points
      .filter(p => re.test(p.text))
      .map(p => `**${p.number}.** ${p.text.replace(/\s*\n\s*/g, ' ').trim()}`)

    out.push(relevant.length ? `${article} | ${relevant.join(' ')}` : PER_ARTICLE_FALLBACK(article))
  }
  return out
}
