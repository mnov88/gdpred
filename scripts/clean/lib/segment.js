/**
 * Structural segmentation of a plain-text CJEU judgment.
 *
 * Everything here keys on TEXTUAL landmarks, never on HTML classes. The
 * existing pipeline keys on EUR-Lex classes (`C41DispositifIntroduction`,
 * `C71Indicateur`, `C77Signatures`), which is why it produced three case files
 * with no topics and no ruling at all when EUR-Lex served a different markup
 * family — silently, with no warning. Text landmarks degrade more honestly:
 * when one is missing we say so.
 *
 * Layout of a judgment, in order:
 *
 *   Provisional text                        (optional)
 *   JUDGMENT OF THE COURT (Fifth Chamber)   <- docType + chamber
 *   26 January 2023 (*1)                    <- date line
 *   (Reference for a preliminary ruling -- Protection of ... -- ...)   <- keywords -> topics
 *   In Case C-205/21,                       <- case number
 *   REQUEST for a preliminary ruling under Article 267 TFEU from ...
 *   ... in the proceedings
 *   V.S.
 *   v
 *   Ministerstvo na vatreshnite raboti,     <- parties
 *   THE COURT (Fifth Chamber),
 *   composed of ... / Advocate General: ... / Registrar: ...
 *   gives the following
 *   Judgment
 *   1  This request for a preliminary ruling concerns ...   <- numbered paragraphs
 *   ...
 *   On those grounds, the Court (Fifth Chamber) hereby rules:   <- operative part
 *   1.  Article 10(a) ...
 *   [Signatures]
 *   (*1) Language of the case: Bulgarian.
 */

import { normaliseInvisibles } from './normalise.js'

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

/** Document kind. Anything that is not a JUDGMENT/ORDER is not a case file. */
export const DOC_TYPE_RE =
  /^\s*(JUDGMENT|ORDER|OPINION|VIEW)\s+OF\s+(?:THE\s+)?(COURT(?:\s+OF\s+JUSTICE)?|GENERAL\s+COURT|CIVIL\s+SERVICE\s+TRIBUNAL|ADVOCATE\s+GENERAL)\b([^\n]*)/im

/** `26 January 2023 (*1)` — the judgment date, immediately after the header. */
export const DATE_LINE_RE =
  /^\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/im

/** `In Case C-205/21,` / `In Joined Cases C-511/18, C-512/18 and C-520/18,` */
export const IN_CASE_RE = /^\s*In\s+(Joined\s+)?Cases?\s+([^\n]*?),?\s*$/im

/**
 * The operative part. `hereby rules` is the common form; orders use `hereby
 * orders`, and some judgments use `declares`. Matched case-insensitively and
 * allowed to wrap, because the chamber name often pushes it onto two lines.
 */
export const OPERATIVE_RE =
  /^\s*On\s+those\s+grounds,?\s*the\s+(?:Court|General\s+Court)[\s\S]{0,120}?hereby\s+(rules|orders|declares)\s*:?\s*$/im

/**
 * Appeal-form judgments put the verb inside the numbered items, so the marker
 * line is a bare `hereby:`. Anchored to "on those grounds" on purpose: a
 * line-final `hereby:` also occurs inside a quoted referred question, and an
 * unanchored match would take that instead.
 *
 * Taken from the eulaw-local-mcp server's OPERATIVE_MARKER, which was
 * calibrated over 631 stored judgments; the anchored form changes the match in
 * exactly six appeal-form judgments and nowhere else. None of the 62 judgments
 * in content/Downloads uses it, but appeals will arrive eventually.
 */
export const OPERATIVE_APPEAL_RE = /^\s*on\s+those\s+grounds\b.*\bhereby\s*:?\s*$/im

/** Fallback when "On those grounds" is absent but the verb is present. */
export const OPERATIVE_FALLBACK_RE =
  /^\s*the\s+(?:Court|General\s+Court)[^\n]{0,120}?hereby\s+(rules|orders|declares)\s*:?\s*$/im

/** End of the operative part. */
export const SIGNATURES_RE = /^\s*\\?\[\s*Signatures?\s*\\?\]\s*$/im
export const LANGUAGE_OF_CASE_RE =
  /^\s*\(?\\?\*?\d*\)?\s*Language\s+of\s+the\s+case\s*:/im

/** `THE COURT (Fifth Chamber),` — ends the parties block. */
export const THE_COURT_RE = /^\s*THE\s+(?:COURT|GENERAL\s+COURT)\b[^\n]*$/im

/** Where the recitals begin: the line `Judgment` after `gives the following`. */
export const JUDGMENT_START_RE = /^\s*(?:gives\s+the\s+following\s*\n+)?\s*(Judgment|Order)\s*$/im

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

/**
 * Split a normalised judgment into its parts.
 * Every field is nullable; `warnings` explains anything that could not be
 * located, so callers can decide whether to fail or continue.
 */
export function segmentJudgment(rawText) {
  const text = normaliseInvisibles(rawText)
  const warnings = []

  const docTypeMatch = DOC_TYPE_RE.exec(text)
  const docType = docTypeMatch ? docTypeMatch[1].toUpperCase() : null
  const court = docTypeMatch ? docTypeMatch[2].toUpperCase() : null
  const chamber = docTypeMatch ? extractChamber(docTypeMatch[3] || '') : null
  if (!docTypeMatch) warnings.push('no "JUDGMENT/ORDER OF THE COURT" header found')

  const headerEnd = docTypeMatch ? docTypeMatch.index + docTypeMatch[0].length : 0

  // The date line is the first date AFTER the header, not anywhere in the text.
  const afterHeader = text.slice(headerEnd)
  const dateMatch = DATE_LINE_RE.exec(afterHeader)
  const date = dateMatch
    ? toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3])
    : null
  if (!dateMatch) warnings.push('no judgment date line found after the header')

  const keywordBlock = extractKeywordBlock(
    afterHeader.slice(dateMatch ? dateMatch.index + dateMatch[0].length : 0)
  )
  if (!keywordBlock) warnings.push('no parenthesised keyword block found')

  const inCaseMatch = IN_CASE_RE.exec(text)
  const caseLine = inCaseMatch ? inCaseMatch[0].trim() : null
  const joined = Boolean(inCaseMatch && inCaseMatch[1])
  if (!inCaseMatch) warnings.push('no "In Case C-.../.." line found')

  const operative = extractOperativePart(text)
  if (!operative.text) warnings.push('no operative part ("hereby rules:") found')

  const parties = extractParties(text)
  if (!parties) warnings.push('could not identify the parties')

  return {
    docType,
    court,
    chamber,
    date,
    dateRaw: dateMatch ? dateMatch[0].trim() : null,
    keywordBlock,
    caseLine,
    joined,
    parties,
    operative: operative.text,
    operativeVerb: operative.verb,
    bodyStart: headerEnd,
    warnings,
  }
}

/** `(Fifth Chamber)` -> `Fifth Chamber`. */
function extractChamber(tail) {
  const m = tail.match(/\(([^)]*Chamber[^)]*)\)/i) || tail.match(/\(([^)]+)\)/)
  return m ? m[1].trim() : null
}

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
}

/** `26`, `January`, `2023` -> `2023-01-26`. */
export function toIsoDate(day, monthName, year) {
  const month = MONTHS[String(monthName).toLowerCase()]
  if (!month) return null
  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

/**
 * The keyword ("indicateur") block: a parenthesised run of ` -- `-separated
 * legal concepts that follows the date line. It can span many lines, so we
 * balance parentheses rather than matching to the first `)`.
 */
/** A keyword block is long, starts with `(`, and uses dash separators. */
function looksLikeKeywords(line) {
  return line.startsWith('(') && line.length > 60 && /\s(?:--+|[–—])\s/.test(line)
}

export function extractKeywordBlock(text) {
  // Line-based rather than paren-balanced. Balanced scanning fails on the
  // court's own typos: C-667/21's keyword line has six `(` and five `)`, so a
  // depth counter never returns to zero and the whole block is lost.
  //
  // It also has to skip the footnote marker on the date line —
  // `26 January 2023 ( *1 )` — which is itself a parenthesised group.
  const lines = text.split('\n')
  const limit = Math.min(lines.length, 12)

  for (let i = 0; i < limit; i++) {
    const line = lines[i].trim()
    if (!looksLikeKeywords(line)) continue

    // The block may wrap onto following lines; accumulate until the parens
    // balance or the next structural line begins.
    let block = line
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
      const balanced = count(block, '(') <= count(block, ')')
      if (balanced) break
      const next = lines[j].trim()
      if (!next || /^In\s+(?:Joined\s+)?Cases?\s/i.test(next)) break
      block += ' ' + next
    }

    // Strip the wrapping parentheses, tolerating a missing closer.
    return block.replace(/^\(\s*/, '').replace(/\s*\)$/, '').trim() || null
  }

  return null
}

function count(text, ch) {
  let n = 0
  for (const c of text) if (c === ch) n++
  return n
}

/**
 * Everything from the operative marker to the signatures / language footnote.
 * Falls back to a looser marker, then gives up rather than guessing.
 */
export function extractOperativePart(text) {
  let match = OPERATIVE_RE.exec(text)
  if (!match) match = OPERATIVE_APPEAL_RE.exec(text)
  if (!match) match = OPERATIVE_FALLBACK_RE.exec(text)
  if (!match) return { text: null, verb: null }

  const start = match.index + match[0].length
  const rest = text.slice(start)

  // `^---$` comes from the MCP server's END_MARKERS_FULL. The language-of-case
  // trailer is ours: that parser lacks it, so `(*1) Language of the case: …`
  // gets swallowed into its last holding.
  const enders = [SIGNATURES_RE, LANGUAGE_OF_CASE_RE, /^\s*\*\s*\*\s*\*\s*$/m, /^---$/m]
  let end = rest.length
  for (const re of enders) {
    const m = re.exec(rest)
    if (m && m.index < end) end = m.index
  }

  return { text: rest.slice(0, end).trim() || null, verb: match[1] ? match[1].toLowerCase() : 'rules' }
}

/**
 * EUR-Lex navigation chrome captured instead of a document.
 *
 * Two signals, both from the MCP server's parse-validate.ts: the portal's
 * "Switch to mobile" footer, and an implausible link-to-word ratio. The ratio
 * only fires on markdown converted from HTML — plain text has no links — but
 * it is free to keep for callers that pass such input.
 */
export function looksLikePageShell(text) {
  const content = String(text)
  if (/switch to mobile/i.test(content)) return true
  const links = (content.match(/\]\([^)]*\)/g) || []).length
  if (links < 20) return false
  const words = content.split(/\s+/).filter(Boolean).length
  return links / Math.max(words, 1) > 0.08
}

/**
 * Parties, as `Applicant v Respondent`.
 *
 * Plain text gives them as a small block between the request paragraph and
 * `THE COURT (...)`, with the parties on their own lines around a lone `v`:
 *
 *     ... in the proceedings
 *     V.S.
 *     v
 *     Ministerstvo na vatreshnite raboti,
 *     THE COURT (Fifth Chamber),
 *
 * Criminal proceedings use `in the criminal proceedings against X` with no
 * `v` at all, which we handle separately.
 */
/**
 * Labels the court uses to introduce the other side when there is no `v`,
 * which is how criminal references and some appeals are laid out:
 *
 *     in the criminal proceedings against
 *     V.S.,
 *     interested party:
 *     Ministerstvo na vatreshnite raboti, ...
 *
 * The published `parties` value for that case joins the two with ` v `.
 */
const OTHER_PARTY_LABEL_RE =
  /^(?:interested|intervening|other|opposing)?\s*(?:part(?:y|ies)|intervener[s]?|defendant|respondent|applicant)(?:\s+to\s+the\s+proceedings)?(?:\s+being)?\s*:\s*$/i

/**
 * The phrase that ends the procedural preamble and introduces the parties.
 * Several spellings occur: `in the proceedings`, `in the proceedings brought
 * by`, `in the criminal proceedings against`, `in proceedings between`.
 */
const PARTIES_ANCHOR_RE =
  /in\s+(?:the\s+)?(?:criminal\s+)?proceedings\s*(against|brought\s+by|between)?\s*(?=\n|$)/i

/** Lines that are procedural furniture, never a party name. */
function isFurniture(line) {
  return (
    /^(?:composed of|Advocate General|Registrar|having regard|after (?:considering|hearing)|gives the following|REQUEST|APPLICATION|APPEAL)\b/i.test(
      line
    ) ||
    /^(?:Judgment|Order)$/i.test(line) ||
    line.length > 300
  )
}

export function extractParties(text) {
  const courtMatch = THE_COURT_RE.exec(text)
  const upper = courtMatch ? text.slice(0, courtMatch.index) : text

  const anchor = PARTIES_ANCHOR_RE.exec(upper)
  const block = anchor ? upper.slice(anchor.index + anchor[0].length) : upper

  const lines = block
    .split('\n')
    .map(l => l.trim().replace(/^\*+|\*+$/g, '').trim())
    .filter(Boolean)
    .filter(l => !isFurniture(l))

  /**
   * Tidy one party name.
   *
   * In joined cases the source tags each party with the case it belongs to —
   * `UF (C-26/22)`, `AB (C-64/22)` — and the corpus strips those tags
   * (`UF, AB v Land Hessen`).
   */
  const clean = s =>
    s
      .replace(/\s*\(\s*[CTF][-‑]\d{1,4}[/‑⧸∕-]\d{2}\s*\)\s*/g, ' ')
      .replace(/[,;]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

  /**
   * Multiple parties on one side are joined with commas. That is the corpus
   * convention throughout — `X, Z`, `VX, AT`, `AT, BT`,
   * `Facebook Ireland Ltd, Maximillian Schrems` — with `TU and RE` the single
   * exception, so commas are the right default.
   */
  const joinAll = arr => clean(arr.map(clean).filter(Boolean).join(', '))

  const labelIndex = lines.findIndex(l => OTHER_PARTY_LABEL_RE.test(l))

  // Standard civil layout: a lone `v` between the two sides.
  //
  // When a `v` is present, anything from the first label line onward is an
  // additional intervener and is DROPPED — that is the corpus convention,
  // consistently: C-311/18, C-132/21, C-268/21 and C-487/21 all name only the
  // parties either side of the `v` and omit the labelled interveners.
  const vIndex = lines.findIndex(l => /^v\.?$/i.test(l))
  if (vIndex > 0 && vIndex < lines.length - 1) {
    const rightEnd = labelIndex > vIndex ? labelIndex : lines.length
    const left = joinAll(lines.slice(0, vIndex))
    const right = joinAll(lines.slice(vIndex + 1, rightEnd))
    if (left && right) return `${left} v ${right}`
  }

  // Labelled layout with no `v`: the label introduces the respondent, so it
  // becomes the right-hand side (C-205/21, C-439/19, C-579/21).
  if (labelIndex > 0 && labelIndex < lines.length - 1) {
    const left = joinAll(lines.slice(0, labelIndex))
    const right = joinAll(lines.slice(labelIndex + 1).filter(l => !OTHER_PARTY_LABEL_RE.test(l)))
    if (left && right) return `${left} v ${right}`
  }

  // Single-party reference: one or two named lines and no opponent at all
  // (e.g. C-740/22 `Endemol Shine Finland Oy`).
  const named = lines.filter(l => !OTHER_PARTY_LABEL_RE.test(l))
  if (named.length && named.length <= 2) {
    const single = joinAll(named)
    if (single) return single
  }

  // Fall back to an inline "X v Y" on one line.
  const inline = upper.match(/^\s*(.{2,120}?)\s+v\s+(.{2,160}?),?\s*$/im)
  if (inline) return `${clean(inline[1])} v ${clean(inline[2])}`

  return null
}

/**
 * Topics from the keyword block: split on the ` -- ` / en-dash / em-dash
 * separators the court uses, then drop the segments that are not topics.
 */
export function parseTopics(keywordBlock) {
  if (!keywordBlock) return []

  return keywordBlock
    .replace(/\s*\n\s*/g, ' ')
    .split(/\s+(?:--+|[–—])\s+/)
    .map(s => s.trim().replace(/^[('"]+|[)'"]+$/g, '').trim())
    .filter(segment => {
      if (segment.length < 3) return false
      // The court prefixes almost every reference with this; it is not a topic.
      if (/^Reference\s+for\s+a\s+preliminary\s+ruling$/i.test(segment)) return false
      if (/^Request\s+for\s+a\s+preliminary\s+ruling$/i.test(segment)) return false
      // Bare provision references are navigation, not subject matter.
      if (/^Articles?\s+[\d\s,()a-z]+(?:and\s+\d+)?$/i.test(segment)) return false
      if (/^(?:Regulation|Directive|Decision)\s*\(?(?:EU|EC)?\)?\s*(?:No\s*)?[\d/]+$/i.test(segment)) {
        return false
      }
      if (/^Recitals?\s+[\d\s,and]+$/i.test(segment)) return false
      return true
    })
    .map(s => s.replace(/[.;,]+$/, '').trim())
    .filter(Boolean)
}
