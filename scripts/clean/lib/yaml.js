/**
 * Minimal, zero-dependency YAML support scoped to GDPRed case frontmatter.
 *
 * Why not js-yaml? It is a declared dependency, but node_modules is gitignored
 * and installing it pulls the whole ~600-package Quartz tree. These scripts are
 * meant to run on a fresh clone with nothing installed. The frontmatter schema
 * is small and fully known, so a scoped emitter/parser is sufficient.
 *
 * KNOWN AND DELIBERATE DIVERGENCE FROM js-yaml: this parser does not implement
 * flow sequences, so `title: [[C-203-22|C-203⧸22]]` comes back as the plain
 * string `"[[C-203-22|C-203⧸22]]"` where js-yaml (and therefore Quartz) yields
 * the nested array `[["C-203-22|C-203⧸22"]]`. That construct is always a bug —
 * a wikilink written into an unquoted YAML scalar — so `validate-cases.js`
 * rejects it explicitly rather than silently reproducing Quartz's reading.
 *
 * The parser handles exactly the subset that appears in content/Case law:
 *   key: plain scalar
 *   key: 'single quoted'  |  key: "double quoted"
 *   key: |-   /  key: |  /  key: >-  (block scalars)
 *   key:
 *     - sequence item (plain or quoted)
 *   key: []   (flow empty sequence)
 *
 * `parity-check.js` verifies this parser against js-yaml over every real case
 * file, so the subset claim is tested rather than assumed.
 */

// ---------------------------------------------------------------------------
// Emitting
// ---------------------------------------------------------------------------

/**
 * Characters/patterns that force a plain scalar to be quoted.
 * Deliberately conservative: when in doubt, quote.
 */
function needsQuoting(value, { isKeyless = false } = {}) {
  if (value === '') return true
  // Leading/trailing whitespace is not preserved by plain scalars.
  if (value !== value.trim()) return true
  // Indicator characters at the start of a plain scalar.
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) return true
  // ": " and " #" terminate a plain scalar mid-string.
  if (value.includes(': ') || value.endsWith(':')) return true
  if (value.includes(' #')) return true
  // Values YAML would coerce to a non-string type.
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value)) return true
  // Date-shaped strings become Date objects when unquoted. We *want* the
  // canonical `date:` field unquoted (see dumpFrontmatter), so this only
  // applies to other fields.
  if (isKeyless && /^\d{4}-\d{2}-\d{2}/.test(value)) return true
  return false
}

function quote(value) {
  // Prefer single quotes (matches the repo's existing js-yaml settings).
  if (!value.includes("'")) return `'${value}'`
  if (!value.includes('"') && !/[\\\n\t]/.test(value)) return `"${value}"`
  return `'${value.replace(/'/g, "''")}'`
}

function emitScalar(value, opts) {
  const str = String(value)
  return needsQuoting(str, opts) ? quote(str) : str
}

/**
 * Emit a literal block scalar (`|-`). Used for multi-paragraph text such as
 * `final-ruling`, where line structure is meaningful.
 *
 * We always emit `|-` (literal, strip-chomped), never `>-` (folded). Folding
 * re-flows long lines, and that is exactly what splits wikilinks across a line
 * break in the existing corpus — `[[Article\n  82]](2\)` in C-200-23.md and two
 * others. `|-` is also what the authoring docs and the golden reference file
 * (C-205-21.md) prescribe.
 *
 * Consequence: a value that originally used `|` or `>` (clip) loses its
 * trailing newline on re-emit. That is deliberate normalisation, so a
 * byte-for-byte round-trip of those four corpus files is not expected.
 */
function emitBlockScalar(value, indent) {
  const pad = ' '.repeat(indent)
  const lines = String(value).replace(/\s+$/, '').split('\n')
  const body = lines.map(line => (line.trim() === '' ? '' : pad + line)).join('\n')
  return `|-\n${body}`
}

/**
 * A block scalar whose first content line starts with a space needs an
 * explicit indentation indicator, or YAML silently absorbs that space into the
 * block's indentation and the value changes. C-132-21.md's `final-ruling` is
 * exactly such a value. Rather than emit an indicator, we detect the case and
 * fall back to a quoted scalar, which has no such ambiguity.
 */
function blockScalarIsSafe(value) {
  const firstContentLine = String(value).split('\n').find(l => l.trim() !== '')
  return firstContentLine === undefined || !/^\s/.test(firstContentLine)
}

/** Quote a value that contains newlines, using double quotes with escapes. */
function quoteMultiline(value) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

/**
 * A string is emitted as a block scalar when it spans multiple lines.
 * Single-line strings — however long — stay as plain/quoted scalars, which is
 * what the existing case files do for `per-article` entries.
 */
function isMultiline(value) {
  return typeof value === 'string' && value.includes('\n')
}

/**
 * Serialize a frontmatter object to YAML.
 *
 * Key order is preserved from the object, so callers control field ordering.
 * `dateFields` names keys that should stay unquoted even though they look like
 * dates — matching the dominant hand-authored convention (`date: 2023-01-26`).
 */
function dumpFrontmatter(obj, { dateFields = ['date'] } = {}) {
  const out = []

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      if (value.length === 0) continue
      out.push(`${key}:`)
      for (const item of value) {
        if (isMultiline(item)) {
          // Block scalars inside a sequence: "- |-" then indented body.
          out.push(
            blockScalarIsSafe(item)
              ? `  - ${emitBlockScalar(item, 6)}`
              : `  - ${quoteMultiline(item)}`
          )
        } else {
          out.push(`  - ${emitScalar(item, { isKeyless: true })}`)
        }
      }
      continue
    }

    if (isMultiline(value)) {
      out.push(
        blockScalarIsSafe(value)
          ? `${key}: ${emitBlockScalar(value, 2)}`
          : `${key}: ${quoteMultiline(value)}`
      )
      continue
    }

    const isDate = dateFields.includes(key)
    out.push(`${key}: ${emitScalar(value, { isKeyless: !isDate })}`)
  }

  return out.join('\n') + '\n'
}

/** Wrap frontmatter + body into a complete markdown file. */
function buildMarkdown(frontmatter, body, opts) {
  const yaml = dumpFrontmatter(frontmatter, opts)
  const trimmedBody = String(body || '').replace(/^\n+/, '').replace(/\s+$/, '')
  return `---\n${yaml}---\n\n${trimmedBody}\n`
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function unquote(raw) {
  const value = raw.trim()
  if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  return value
}

/** Strip a trailing ` # comment` from a plain scalar. */
function stripComment(value) {
  const idx = value.search(/\s+#/)
  return idx === -1 ? value : value.slice(0, idx)
}

function parseScalar(raw) {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '~' || trimmed.toLowerCase() === 'null') return null
  if (trimmed[0] === "'" || trimmed[0] === '"') return unquote(trimmed)
  const value = stripComment(trimmed).trim()
  if (/^(true|yes)$/i.test(value)) return true
  if (/^(false|no)$/i.test(value)) return false
  if (/^[+-]?\d+$/.test(value)) return Number(value)
  if (/^[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(value)) return Number(value)
  return value
}

/**
 * Collect the body of a block scalar starting at `start`.
 * Returns { text, next } where `next` is the first unconsumed line index.
 */
function readBlockScalar(lines, start, header) {
  const chomp = header.includes('-') ? 'strip' : header.includes('+') ? 'keep' : 'clip'
  const folded = header.startsWith('>')

  // Indentation is set by the first non-empty line.
  let indent = null
  const collected = []
  let i = start

  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      collected.push('')
      continue
    }
    const lineIndent = line.length - line.trimStart().length
    if (indent === null) {
      indent = lineIndent
    } else if (lineIndent < indent) {
      break
    }
    collected.push(line.slice(indent))
  }

  // Drop trailing blank lines produced by lookahead.
  while (collected.length && collected[collected.length - 1] === '') collected.pop()

  let text
  if (folded) {
    // Fold single newlines into spaces; blank lines become real newlines.
    text = collected
      .reduce((acc, line) => {
        if (line === '') return acc + '\n'
        return acc && !acc.endsWith('\n') ? acc + ' ' + line : acc + line
      }, '')
      .trim()
  } else {
    text = collected.join('\n')
  }

  if (chomp === 'clip') text += '\n'
  return { text, next: i }
}

/**
 * Parse the YAML subset used by GDPRed frontmatter into a plain object.
 * Unsupported constructs are reported via `onWarn` rather than thrown, so a
 * validator can surface them instead of crashing.
 */
function parseFrontmatter(yamlText, onWarn = () => {}) {
  const lines = String(yamlText).replace(/\r\n?/g, '\n').split('\n')
  const result = {}
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '' || /^\s*#/.test(line)) {
      i++
      continue
    }

    const keyMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*:(.*)$/)
    if (!keyMatch) {
      onWarn(`line ${i + 1}: not a recognised key/value pair: ${JSON.stringify(line)}`)
      i++
      continue
    }

    const key = keyMatch[1]
    const rest = keyMatch[2]
    const restTrimmed = rest.trim()

    // Block scalar
    const blockMatch = restTrimmed.match(/^([|>][+-]?)\s*$/)
    if (blockMatch) {
      const { text, next } = readBlockScalar(lines, i + 1, blockMatch[1])
      result[key] = text
      i = next
      continue
    }

    // Inline value
    if (restTrimmed !== '') {
      if (restTrimmed === '[]') result[key] = []
      else if (restTrimmed === '{}') result[key] = {}
      else result[key] = parseScalar(restTrimmed)
      i++
      continue
    }

    // Nested block: either a sequence or an unsupported mapping.
    const items = []
    let j = i + 1
    let sawSequence = false

    while (j < lines.length) {
      const next = lines[j]
      if (next.trim() === '') {
        j++
        continue
      }
      const nextIndent = next.length - next.trimStart().length
      if (nextIndent === 0) break

      const seqMatch = next.match(/^\s*-\s?(.*)$/)
      if (!seqMatch) {
        onWarn(`line ${j + 1}: nested mappings are not supported by this parser`)
        j++
        continue
      }

      sawSequence = true
      const itemRest = seqMatch[1]
      const itemBlock = itemRest.trim().match(/^([|>][+-]?)\s*$/)
      if (itemBlock) {
        const { text, next: after } = readBlockScalar(lines, j + 1, itemBlock[1])
        items.push(text)
        j = after
        continue
      }

      // A sequence item may continue onto following, more-indented lines.
      const itemIndent = next.indexOf('-')
      let value = itemRest
      let k = j + 1
      while (k < lines.length) {
        const cont = lines[k]
        if (cont.trim() === '') break
        const contIndent = cont.length - cont.trimStart().length
        if (contIndent <= itemIndent) break
        if (/^\s*-\s/.test(cont) && contIndent === itemIndent) break
        value += ' ' + cont.trim()
        k++
      }
      items.push(parseScalar(value))
      j = k
    }

    result[key] = sawSequence ? items : null
    i = j
  }

  return result
}

/**
 * Split a markdown file into { frontmatter, body, raw }.
 * Returns frontmatter === null when the file has no `---` block.
 */
function splitMarkdown(content, onWarn) {
  const text = String(content).replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (!text.startsWith('---\n')) {
    return { frontmatter: null, body: text, rawFrontmatter: null }
  }

  // The closing fence is a line that is exactly "---". Matching the prefix
  // "\n---" instead (as extract_case_articles.cjs and three sibling scripts
  // do) truncates on any value containing "---", which is why C-673-17.md's
  // `parties: ... Verbraucherverbände --- Verbraucherzentrale ...` silently
  // drops that case from the generated indexes.
  const closing = /\n---[ \t]*(?:\n|$)/.exec(text)
  if (!closing) {
    return { frontmatter: null, body: text, rawFrontmatter: null }
  }

  const rawFrontmatter = text.slice(4, closing.index + 1)
  const body = text.slice(closing.index + closing[0].length).replace(/^\n+/, '')
  return {
    frontmatter: parseFrontmatter(rawFrontmatter, onWarn),
    body,
    rawFrontmatter,
  }
}

export {
  dumpFrontmatter,
  buildMarkdown,
  parseFrontmatter,
  splitMarkdown,
  // exported for tests
  needsQuoting,
  emitScalar,
}
