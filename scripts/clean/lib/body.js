/**
 * Convert a plain-text judgment body into GDPRed's markdown conventions.
 *
 * Three transformations, in this order:
 *   1. paragraph numbers  ->  `**12** Text`   (bold, NO trailing dot)
 *   2. known section names ->  `### Legal context`
 *   3. `Article 5(1)(c)`   ->  `[[Article 5]](1\)(c)`
 *      `C-205/21`          ->  `[[C-205-21|C-205⧸21]]`  (only if the note exists)
 *
 * Note the two different numbering conventions in the corpus, which are easy
 * to confuse: judgment paragraphs are `**12**` (no dot), operative-part points
 * are `**1.**` (with dot). 57 of 67 files follow the first; the frontmatter
 * `final-ruling` follows the second.
 */

import { linkArticleRefs } from './articles.js'
import { toDisplay, toFilename, CASE_REF_RE } from './caseref.js'
import { PARAGRAPH_MARKER } from './constants.js'

/**
 * Section names the court uses, promoted to `###`.
 *
 * `###` (not `##`) matches the corpus: 343 headings across 60 files, of which
 * `### The dispute in the main proceedings and the questions referred for a
 * preliminary ruling` appears 47 times. TableOfContents is configured with
 * maxDepth 3, so `###` is the deepest level that still shows up in the TOC.
 */
const SECTION_HEADINGS = [
  'Legal context',
  'European Union law',
  'EU law',
  'International law',
  'National law',
  'Bulgarian law',
  'The dispute in the main proceedings and the questions referred for a preliminary ruling',
  'The dispute in the main proceedings and the question referred for a preliminary ruling',
  'The disputes in the main proceedings and the questions referred for a preliminary ruling',
  'The main proceedings and the questions referred for a preliminary ruling',
  'Procedure before the Court',
  'Admissibility of the request for a preliminary ruling',
  'Consideration of the questions referred',
  'Consideration of the question referred',
  'The first question',
  'The second question',
  'The third question',
  'The fourth question',
  'The fifth question',
  'The sixth question',
  'The seventh question',
  'The first and second questions',
  'The second and third questions',
  'Costs',
]

const SECTION_SET = new Set(SECTION_HEADINGS.map(h => h.toLowerCase()))

/** `The first question` etc., generated rather than enumerated exhaustively. */
const QUESTION_HEADING_RE =
  /^(?:The\s+)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:\s+(?:and|to)\s+(?:second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth))?\s+(?:questions?|parts?|pleas?)(?:\s+referred)?$/i

/**
 * Promote a bare section-title line to `### Title`.
 * Lines that are already headings are left alone.
 */
export function promoteHeadings(text) {
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed || /^#{1,6}\s/.test(trimmed)) return line
      // Strip bold wrappers the source sometimes applies to headings.
      const bare = trimmed.replace(/^\*\*(.*)\*\*$/, '$1').replace(/^\*(.*)\*$/, '$1').trim()
      if (!bare || bare.length > 120) return line
      if (SECTION_SET.has(bare.toLowerCase()) || QUESTION_HEADING_RE.test(bare)) {
        return `### ${bare}`
      }
      return line
    })
    .join('\n')
}

/**
 * Mark judgment paragraph numbers as `**N**`.
 *
 * Two plain-text families exist and both are handled:
 *   inline   `1      This request for a preliminary ruling concerns ...`
 *   split    `1` on its own line, prose on the next
 *
 * Numbers are only accepted in strict ascending sequence starting at 1. That
 * matters: judgments quote national legislation that is itself numbered
 * `1.`, `2.`, and a permissive regex marks those as judgment paragraphs. The
 * sequence check makes false positives essentially impossible.
 */
export function markParagraphNumbers(text) {
  const lines = text.split('\n')
  const out = []
  let expected = 1
  let converted = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Inline: "12   Text..."
    const inline = trimmed.match(/^(\d{1,3})\s{2,}(\S[\s\S]*)$/)
    if (inline && Number(inline[1]) === expected) {
      out.push(`${PARAGRAPH_MARKER(expected)} ${inline[2].trim()}`)
      expected++
      converted++
      continue
    }

    // Split: "12" alone, prose on a following non-empty line.
    if (/^\d{1,3}$/.test(trimmed) && Number(trimmed) === expected) {
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      if (j < lines.length) {
        out.push(`${PARAGRAPH_MARKER(expected)} ${lines[j].trim()}`)
        expected++
        converted++
        i = j
        continue
      }
    }

    out.push(line)
  }

  return { text: out.join('\n'), converted, lastNumber: expected - 1 }
}

/**
 * Drop a leading bare CELEX identifier.
 *
 * Text exported from the EUR-Lex DOCX starts with the document id on its own
 * line (`62021CJ0205`). No corpus body carries it — they start with
 * `Provisional text` or `JUDGMENT OF THE COURT` — so it is export noise.
 */
export function stripDocumentId(text) {
  return String(text).replace(/^\s*\d{5}[A-Z]{2}\d{4}\s*\n+/, '')
}

/**
 * Link case citations to their notes, but only when the note actually exists.
 *
 * The corpus links every cited case, which leaves 144 distinct dangling
 * targets (`[[C-511-18]]` alone appears in 9 files). Gating on existence keeps
 * the graph useful and stops the broken-link count from growing.
 */
export function linkCaseRefs(text, existingStems) {
  if (!existingStems || existingStems.size === 0) return text

  // Do not touch text already inside a wikilink. The sentinel is NUL, which
  // cannot occur in judgment text. A space-delimited index would be ambiguous
  // with ordinary numbers in prose ("see paragraph 3 and 4").
  const existing = []
  const masked = text.replace(/\[\[[^\]]*\]\]/g, m => {
    existing.push(m)
    return `\u0000${existing.length - 1}\u0000`
  })

  const re = new RegExp(CASE_REF_RE.source, 'g')
  const linked = masked.replace(re, match => {
    const stem = toFilename(match)
    if (!stem || !existingStems.has(stem)) return match
    return `[[${stem}|${toDisplay(match)}]]`
  })

  return linked.replace(/\u0000(\d+)\u0000/g, (_, i) => existing[Number(i)])
}

/**
 * Full body conversion.
 *
 * `selfStem` is the file's own case stem — a judgment refers to itself in the
 * `In Case C-205/21` line, and self-links are noise.
 */
export function buildBody(
  rawBody,
  { existingStems = new Set(), selfStem = null, linkCases = true, reflow = null } = {}
) {
  // Order matters, twice over:
  //   - paragraph numbers must be marked while the source still has its
  //     original line structure (reflowing first glues a lone `1` onto the
  //     previous line and every marker is lost);
  //   - headings must be promoted before reflow too, or `Legal context`,
  //     `European Union law` and `The GDPR` merge into one prose paragraph and
  //     no longer match any known section name.
  const numbered = markParagraphNumbers(stripDocumentId(rawBody))
  let text = promoteHeadings(numbered.text)
  text = reflow ? reflow(text) : text
  text = linkArticleRefs(text)

  if (linkCases) {
    const stems = new Set(existingStems)
    if (selfStem) stems.delete(selfStem)
    text = linkCaseRefs(text, stems)
  }

  return {
    text: text.replace(/\s+$/, ''),
    paragraphsMarked: numbered.converted,
    lastParagraph: numbered.lastNumber,
  }
}
