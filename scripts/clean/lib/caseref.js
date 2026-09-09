/**
 * Case-number representations used across GDPRed.
 *
 * The same case appears in four different spellings, and mixing them up is the
 * single most common source of broken links in this repo:
 *
 *   canonical   C-205/21    U+002F SOLIDUS         -> `case-number` / `title` frontmatter
 *   filename    C-205-21    U+002D HYPHEN-MINUS    -> content/Case law/C-205-21.md, and the slug
 *   display     C-205⧸21    U+29F8 BIG SOLIDUS     -> link text (a real "/" would split the slug)
 *   legacy      C-205∕21    U+2215 DIVISION SLASH  -> older pages only; normalise to U+29F8
 *
 * Observed counts across content/ at the time of writing: 1829 hyphen, 1051
 * U+29F8, 184 U+2215, 179 ASCII slash. The U+2215 spelling is a historical
 * inconsistency — `toDisplay` always emits U+29F8, and `normalise` folds all
 * four forms back to canonical.
 */

/** U+29F8 BIG SOLIDUS — the display separator. */
export const DISPLAY_SLASH = '⧸'
/** U+2215 DIVISION SLASH — legacy display separator, still present in older pages. */
export const LEGACY_DISPLAY_SLASH = '∕'

/**
 * Raw CJEU text uses U+2011 NON-BREAKING HYPHEN after the case-type letter
 * (`C‑205/21`), which is visually identical to `-` but a different codepoint.
 * Both separator positions must accept it, or every reference in an
 * unnormalised judgment is missed.
 */
const NB_HYPHEN = '\u2011'
const PREFIX_SEPARATORS = `\\-${NB_HYPHEN}`
const SEPARATORS = `/\\-${NB_HYPHEN}${DISPLAY_SLASH}${LEGACY_DISPLAY_SLASH}`

/**
 * Matches a case reference in any of the spellings above.
 * Case prefixes seen in CJEU material: C- (Court of Justice), T- (General
 * Court), F- (Civil Service Tribunal). Joined cases add " and C-594/12".
 */
export const CASE_REF_RE = new RegExp(
  `\\b([CTF])[${PREFIX_SEPARATORS}](\\d{1,4})[${SEPARATORS}](\\d{2})\\b`,
  'g'
)

/**
 * Parse any spelling into its parts, or null if the input is not a case ref.
 * Tolerates a leading "Case ", "Joined Cases ", surrounding wikilink brackets,
 * and quoting — all of which appear in real frontmatter.
 */
export function parseCaseNumber(input) {
  if (input === null || input === undefined) return null
  let text = String(input).trim()

  // Strip wikilink wrapper: [[C-203-22|C-203⧸22]] -> C-203-22
  const wiki = text.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/)
  if (wiki) text = wiki[1].trim()

  // Strip quotes and a "Case"/"Joined Cases" prefix.
  text = text.replace(/^['"]|['"]$/g, '').trim()
  text = text.replace(/^(?:Joined\s+)?Cases?\s+/i, '').trim()

  const m = text.match(
    new RegExp(`^([CTF])[${PREFIX_SEPARATORS}](\\d{1,4})[${SEPARATORS}](\\d{2})$`)
  )
  if (!m) return null
  return { prefix: m[1], number: m[2], year: m[3] }
}

/** `C-205/21` — the canonical `case-number` / `title` value. */
export function toCanonical(input) {
  const p = parseCaseNumber(input)
  return p ? `${p.prefix}-${p.number}/${p.year}` : null
}

/** `C-205-21` — the filename stem and the Quartz slug. */
export function toFilename(input) {
  const p = parseCaseNumber(input)
  return p ? `${p.prefix}-${p.number}-${p.year}` : null
}

/** `C-205⧸21` — link display text (U+29F8, never a real slash). */
export function toDisplay(input) {
  const p = parseCaseNumber(input)
  return p ? `${p.prefix}-${p.number}${DISPLAY_SLASH}${p.year}` : null
}

/**
 * `[[C-205-21|C-205⧸21]]` — the wikilink form used in generated index pages.
 * Optionally append the parties, which is what extract_case_articles.cjs does.
 */
export function toWikilink(input, parties) {
  const file = toFilename(input)
  if (!file) return null
  const label = parties ? `${toDisplay(input)} (${parties})` : toDisplay(input)
  return `[[${file}|${label}]]`
}

/**
 * True when a filename stem and a `case-number` value denote the same case.
 * Used by the validator to catch files like C-628-23.md whose frontmatter
 * claims C-638/23.
 */
export function filenameMatches(filenameStem, caseNumber) {
  const a = toFilename(filenameStem)
  const b = toFilename(caseNumber)
  return a !== null && a === b
}

/**
 * Detect whether a string names a joined case (e.g. "C-593/12 and C-594/12"
 * or "C-511/18, C-512/18 and C-520/18"). The pipeline skips these because a
 * single file cannot carry two case numbers; they need manual handling with
 * the `aliases` frontmatter field.
 */
export function isJoinedCase(input) {
  if (!input) return false
  // Count DISTINCT cases: `[[C-203-22|C-203⧸22]]` spells one case twice.
  return findCaseRefs(input).length > 1
}

/** Every distinct case reference found in a block of text, canonicalised. */
export function findCaseRefs(text) {
  const out = new Set()
  const re = new RegExp(CASE_REF_RE.source, 'g')
  let m
  while ((m = re.exec(String(text))) !== null) {
    out.add(`${m[1]}-${m[2]}/${m[3]}`)
  }
  return [...out]
}
