/**
 * Whitespace and Unicode normalisation for raw judgment text.
 *
 * CJEU plain text arrives full of invisible characters that silently break
 * every downstream regex. Measured across the existing corpus:
 *
 *   U+00A0 NO-BREAK SPACE        2,917 occurrences in 47 files
 *   U+2011 NON-BREAKING HYPHEN     321 occurrences in 41 files
 *
 * Both render identically to a normal space / hyphen, so a pattern like
 * /^(\d{1,2}) ([A-Z][a-z]+) (\d{4})/ fails on `12<NBSP>January<NBSP>2023`
 * with no visible cause. Normalising them up front is the single highest-value
 * cleanup step.
 *
 * What we deliberately do NOT touch: curly quotes, en/em dashes, and the
 * guillemets used in quoted national legislation. Those carry meaning in a
 * legal text, and the corpus is already inconsistent about dashes (790 ` -- `,
 * 221 en dash, 29 em dash), so there is no convention to normalise toward.
 * `foldDashes` is available for callers that want it, off by default.
 */

/** Characters that are invisible or indistinguishable and must go. */
const INVISIBLE = {
  '\u00a0': ' ', // NO-BREAK SPACE
  '\u202f': ' ', // NARROW NO-BREAK SPACE
  '\u2007': ' ', // FIGURE SPACE
  '\u2009': ' ', // THIN SPACE
  '\u200a': ' ', // HAIR SPACE
  '\u2002': ' ', // EN SPACE
  '\u2003': ' ', // EM SPACE
  '\u3000': ' ', // IDEOGRAPHIC SPACE
  '\u2011': '-', // NON-BREAKING HYPHEN -> ASCII hyphen
  '\u2212': '-', // MINUS SIGN -> ASCII hyphen
  '\u00ad': '', // SOFT HYPHEN -> delete
  '\u200b': '', // ZERO WIDTH SPACE -> delete
  '\u200c': '', // ZERO WIDTH NON-JOINER -> delete
  '\u200d': '', // ZERO WIDTH JOINER -> delete
  '\ufeff': '', // ZERO WIDTH NO-BREAK SPACE / BOM -> delete
}

const INVISIBLE_RE = new RegExp(`[${Object.keys(INVISIBLE).join('')}]`, 'g')

/**
 * Replace invisible/ambiguous characters and normalise line endings.
 * Safe to run on any text; does not alter visible punctuation.
 */
export function normaliseInvisibles(text) {
  return String(text)
    .replace(/^\ufeff/, '')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_RE, ch => INVISIBLE[ch])
}

/**
 * Optional: fold en/em dashes used as segment separators to the corpus's
 * ` -- ` convention. Only touches dashes surrounded by whitespace, so
 * hyphenated words and number ranges are left alone.
 */
export function foldDashes(text) {
  return String(text).replace(/\s+[–—]\s+/g, ' -- ')
}

/**
 * Strip trailing whitespace, collapse runs of blank lines to at most one,
 * and guarantee exactly one trailing newline.
 */
export function tidyWhitespace(text) {
  return String(text)
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '') + '\n'
}

/**
 * Reflow a plain-text judgment into markdown paragraphs.
 *
 * EUR-Lex plain text hard-wraps prose at ~80 columns, so a single sentence
 * spans several lines. Joining every non-blank run into one paragraph is the
 * right default, but a few line kinds must stay on their own line:
 * headings, the operative part's numbered points, list bullets, and the
 * signature/footnote trailers.
 *
 * `isStructural` lets the caller extend the set of lines that must not be
 * merged into the preceding paragraph.
 */
export function reflowParagraphs(text, { isStructural = () => false } = {}) {
  const lines = String(text).split('\n')
  const out = []
  let buffer = []

  const flush = () => {
    if (buffer.length) {
      out.push(buffer.join(' ').replace(/\s{2,}/g, ' ').trim())
      buffer = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line === '') {
      flush()
      continue
    }

    // A standalone line is its own block and absorbs nothing.
    if (standaloneLine(line) || isStructural(line)) {
      flush()
      out.push(line)
      continue
    }

    // A paragraph-start line ends the previous block and BEGINS a new one, so
    // the hard-wrapped continuation lines that follow join it rather than
    // becoming a separate paragraph.
    if (paragraphStartLine(line)) {
      flush()
      buffer.push(line)
      continue
    }

    buffer.push(line)
  }

  flush()
  return out.filter(Boolean).join('\n\n')
}

/** Lines that stand alone and must never be glued to a neighbour. */
function standaloneLine(line) {
  return (
    /^#{1,6}\s/.test(line) || // markdown heading
    /^\(\*?\d*\)\s*Language of the case/i.test(line) || // footnote trailer
    /^\\?\[Signatures?\\?\]$/i.test(line) || // signature block
    /^\*\s*\*\s*\*$/.test(line) || // separator
    /^In (?:Joined )?Cases?\s/i.test(line) ||
    /^(?:JUDGMENT|ORDER|OPINION)\s+OF\s+THE\s/i.test(line) ||
    /^THE\s+(?:COURT|GENERAL\s+COURT)\b/.test(line) ||
    // The judgment date line, e.g. `26 January 2023 ( *1 )`. Without this it
    // merges into the keyword block that follows it.
    /^\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/.test(
      line
    ) ||
    // The parenthesised keyword block: its own paragraph in every corpus body.
    (line.startsWith('(') && line.length > 60 && /\s(?:--+|[–—])\s/.test(line))
  )
}

/** Lines that begin a paragraph and continue onto the following lines. */
function paragraphStartLine(line) {
  return (
    /^\*\*\d+\.?\*\*/.test(line) || // marked judgment paragraph / ruling point
    /^\d+\.\s/.test(line) || // numbered operative point
    /^[-–—*•]\s/.test(line) // bullet
  )
}

/**
 * Full normalisation for a raw plain-text judgment, in the order that matters:
 * invisibles first (so later regexes can rely on ASCII space/hyphen), then
 * whitespace tidying.
 */
export function normaliseRawText(text, { dashes = false } = {}) {
  let out = normaliseInvisibles(text)
  if (dashes) out = foldDashes(out)
  return tidyWhitespace(out)
}
