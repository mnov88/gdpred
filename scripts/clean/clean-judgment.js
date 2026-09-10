#!/usr/bin/env node
/**
 * Turn a plain-text CJEU judgment into a GDPRed case file.
 *
 *   node scripts/clean/clean-judgment.js judgment.txt
 *   node scripts/clean/clean-judgment.js incoming/*.txt --out-dir "content/Case law"
 *   node scripts/clean/clean-judgment.js judgment.txt --stdout
 *
 * Options
 *   --out-dir <dir>        where to write (default: content/Case law)
 *   --out <file>           explicit output path (single input only)
 *   --stdout               write to stdout instead of a file
 *   --dry-run              report what would happen, write nothing
 *   --force                overwrite an existing case file
 *   --case-number <n>      override the detected case number
 *   --date <YYYY-MM-DD>    override the detected date
 *   --parties <text>       override the detected parties
 *   --topics <a;b;c>       override the detected topics
 *   --articles <gdpr|all>  ruling-articles scope (default: all, matching the corpus)
 *   --date-format <date|iso>  `2023-01-26` (default) or `2023-01-26T00:00:00.000Z`
 *   --no-link-cases        do not wikilink citations to other cases
 *   --json                 machine-readable report on stdout
 *   --quiet                errors only
 *
 * Exit codes: 0 all inputs converted, 1 at least one input failed,
 * 2 bad usage. A file that converts with warnings still exits 0 — check the
 * report, or run validate-cases.js afterwards for a hard gate.
 */

import fs from 'fs'
import path from 'path'
import process from 'process'

import { normaliseRawText, reflowParagraphs } from './lib/normalise.js'
import { segmentJudgment, parseTopics, looksLikePageShell } from './lib/segment.js'
import {
  buildRulingArticles,
  buildPerArticle,
  splitOperativePoints,
  unlinkArticleRefs,
  linkArticleRefs,
} from './lib/articles.js'
import { buildBody } from './lib/body.js'
import { toCanonical, toFilename, parseCaseNumber, isJoinedCase, findCaseRefs } from './lib/caseref.js'
import { buildMarkdown } from './lib/yaml.js'
import { CASE_DIR, RULING_MARKER } from './lib/constants.js'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    inputs: [],
    outDir: path.join(REPO_ROOT, CASE_DIR),
    out: null,
    stdout: false,
    dryRun: false,
    force: false,
    caseNumber: null,
    date: null,
    parties: null,
    topics: null,
    articles: 'all',
    dateFormat: 'date',
    frontmatterLinks: false,
    linkCases: true,
    json: false,
    quiet: false,
  }

  const takesValue = new Set([
    '--out-dir', '--out', '--case-number', '--date', '--parties', '--topics', '--articles',
    '--date-format',
  ])

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      opts.inputs.push(arg)
      continue
    }

    let flag = arg
    let value = null
    const eq = arg.indexOf('=')
    if (eq !== -1) {
      flag = arg.slice(0, eq)
      value = arg.slice(eq + 1)
    } else if (takesValue.has(flag)) {
      value = argv[++i]
      if (value === undefined) fail(`${flag} needs a value`)
    }

    switch (flag) {
      case '--out-dir': opts.outDir = path.resolve(value); break
      case '--out': opts.out = path.resolve(value); break
      case '--stdout': opts.stdout = true; break
      case '--dry-run': opts.dryRun = true; break
      case '--force': opts.force = true; break
      case '--case-number': opts.caseNumber = value; break
      case '--date': opts.date = value; break
      case '--parties': opts.parties = value; break
      case '--topics': opts.topics = value.split(';').map(s => s.trim()).filter(Boolean); break
      case '--articles':
        if (!['gdpr', 'all'].includes(value)) fail('--articles must be "gdpr" or "all"')
        opts.articles = value
        break
      case '--date-format':
        if (!['date', 'iso'].includes(value)) fail('--date-format must be "date" or "iso"')
        opts.dateFormat = value
        break
      case '--frontmatter-links': opts.frontmatterLinks = true; break
      case '--no-link-cases': opts.linkCases = false; break
      case '--json': opts.json = true; break
      case '--quiet': opts.quiet = true; break
      case '--help': case '-h': usage(); process.exit(0); break
      default: fail(`unknown option ${flag}`)
    }
  }

  if (!opts.inputs.length) fail('no input files given')
  if (opts.out && opts.inputs.length > 1) fail('--out takes a single input; use --out-dir for several')
  return opts
}

function fail(message) {
  process.stderr.write(`clean-judgment: ${message}\n\n`)
  usage(process.stderr)
  process.exit(2)
}

function usage(stream = process.stdout) {
  stream.write(
    'Usage: node scripts/clean/clean-judgment.js <judgment.txt...> [options]\n' +
      '  --out-dir <dir>   --out <file>   --stdout   --dry-run   --force\n' +
      '  --case-number <n> --date <d>     --parties <p>  --topics "a;b;c"\n' +
      '  --articles <gdpr|all>            --date-format <date|iso>\n' +
      '  --no-link-cases\n' +
      '  --json            --quiet        --help\n'
  )
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/** Case stems already present, so citations only link where a note exists. */
function readExistingStems(caseDir) {
  const stems = new Set()
  let entries = []
  try {
    entries = fs.readdirSync(caseDir)
  } catch {
    return stems
  }
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const stem = toFilename(entry.slice(0, -3))
    if (stem) stems.add(stem)
  }
  return stems
}

/**
 * Format the operative part for the `final-ruling` field.
 *
 * Numbered points become `**N.** text` separated by a blank line, matching the
 * authoring docs and the golden reference file C-205-21.md. A single
 * unnumbered operative paragraph — which is the majority shape — is emitted
 * as-is with no number, because inventing `**1.**` would misrepresent it.
 */
function formatFinalRuling(operativeText, { wikilinks = false } = {}) {
  const points = splitOperativePoints(operativeText)
  if (!points.length) return null

  // 24 committed files carry wikilinks inside `final-ruling`; 42 do not. The
  // links are inert here (nothing renders this field) and a wikilink in an
  // unquoted YAML scalar is how C-203-22 and C-628-23 were corrupted, so plain
  // text is the default. `--frontmatter-links` opts into the other convention.
  const render = t => (wikilinks ? linkArticleRefs(collapse(t)) : unlinkArticleRefs(collapse(t)))

  const wasNumbered = /^\s*(?:\*\*)?\d+\.(?:\*\*)?\s/.test(operativeText.trim())
  if (!wasNumbered) return render(operativeText) || null

  return points.map(p => `${RULING_MARKER(p.number)} ${render(p.text)}`).join('\n\n')
}

/**
 * Spell the date.
 *
 * Tested against every consumer: `2023-01-26`, `'2023-01-26'` and
 * `2023-01-26T00:00:00.000Z` all reach Quartz as a string (JSON_SCHEMA),
 * all satisfy the Explorer's `typeof date === 'string'` sort guard, and all
 * produce the same day from `new Date()`. The choice is cosmetic, so the
 * default is the documented bare form; `--date-format iso` reproduces the
 * js-yaml round-trip artefact that 46 committed files carry.
 */
function formatDate(date, format) {
  const day = String(date).slice(0, 10)
  return format === 'iso' ? `${day}T00:00:00.000Z` : day
}

/** Join hard-wrapped lines inside one logical paragraph. */
function collapse(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map(block => block.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Convert one plain-text judgment.
 * Returns { ok, caseNumber, stem, markdown, warnings, errors, fields }.
 */
export function convertJudgment(rawText, opts = {}) {
  const warnings = []
  const errors = []

  const normalised = normaliseRawText(rawText)

  // Reject EUR-Lex portal chrome up front, with a reason. Without this the
  // failure surfaces as eight unrelated "landmark not found" warnings, which
  // reads like a parser bug rather than the wrong input.
  if (looksLikePageShell(normalised)) {
    return {
      ok: false,
      caseNumber: null,
      stem: null,
      markdown: null,
      warnings: [],
      errors: [
        'this is a EUR-Lex portal page, not a judgment — save the document itself ' +
          '(the "Text" tab, or the DOCX/PDF export), not the surrounding page',
      ],
      fields: {},
    }
  }

  const seg = segmentJudgment(normalised)
  warnings.push(...seg.warnings)

  if (seg.docType && !['JUDGMENT', 'ORDER'].includes(seg.docType)) {
    errors.push(
      `document is an ${seg.docType}, not a judgment or order — GDPRed case files are judgments`
    )
  }

  // ---- identity -----------------------------------------------------------
  const caseFromLine = seg.caseLine ? seg.caseLine.replace(/^\s*In\s+(?:Joined\s+)?Cases?\s+/i, '') : null
  const caseNumber =
    toCanonical(opts.caseNumber) ||
    toCanonical(caseFromLine) ||
    (caseFromLine ? toCanonical(findCaseRefs(caseFromLine)[0]) : null)

  if (!caseNumber) {
    errors.push('could not determine the case number (pass --case-number to set it)')
  }

  // Joined cases: one file, the remaining case numbers recorded as aliases.
  // That is what the corpus does (C-17-22 aliases C-18/22, and so on).
  let aliases = []
  if (seg.joined || (caseFromLine && isJoinedCase(caseFromLine))) {
    const refs = findCaseRefs(caseFromLine || '')
    aliases = refs.filter(r => r !== caseNumber)
    warnings.push(
      `joined cases detected (${refs.join(', ')}) — one file cannot carry several case numbers. ` +
        `Written as ${caseNumber || refs[0]}, with ${aliases.join(', ') || 'nothing'} under \`aliases\`.`
    )
  }

  const stem = caseNumber ? toFilename(caseNumber) : null

  // ---- dates and parties --------------------------------------------------
  const date = opts.date || seg.date
  if (!date) errors.push('could not determine the judgment date (pass --date)')
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`date "${date}" is not YYYY-MM-DD`)

  const parties = opts.parties || seg.parties
  if (!parties) {
    warnings.push(
      'parties not found — the case will be dropped from the timeline and the grid, ' +
        'which both require title+date+parties (pass --parties)'
    )
  }

  // ---- topics -------------------------------------------------------------
  const topics = opts.topics && opts.topics.length ? opts.topics : parseTopics(seg.keywordBlock)
  if (!topics.length) warnings.push('no topics extracted from the keyword block')

  // ---- operative part -----------------------------------------------------
  const finalRuling = seg.operative
    ? formatFinalRuling(seg.operative, { wikilinks: opts.frontmatterLinks === true })
    : null
  if (!finalRuling) warnings.push('final-ruling is empty — the operative part could not be read')

  const rulingArticles = buildRulingArticles(seg.operative || '', {
    scope: opts.articles || 'all',
    // SPARQL's `modifiedLocations` names the provisions the EU's own metadata
    // records this case as interpreting. Merging them in catches articles the
    // operative part phrases in a way the regex does not reach.
    extraNumbers: opts.extraArticles || [],
  })
  if (!rulingArticles.length) {
    warnings.push(
      'ruling-articles is empty — the operative part names no article in range 1-99' +
        (opts.articles === 'gdpr' ? ', or the ruling never names Regulation 2016/679' : '')
    )
  }

  const perArticle = buildPerArticle(seg.operative || '', rulingArticles)

  // ---- body ---------------------------------------------------------------
  // buildBody marks paragraph numbers first, then reflows via this callback.
  const body = buildBody(normalised, {
    existingStems: opts.existingStems || new Set(),
    selfStem: stem,
    linkCases: opts.linkCases !== false,
    reflow: text => reflowParagraphs(text),
  })

  if (body.paragraphsMarked === 0) {
    warnings.push(
      'no judgment paragraph numbers were recognised — the body will have no **N** markers'
    )
  }

  // ---- assemble -----------------------------------------------------------
  const frontmatter = {}
  if (caseNumber) {
    frontmatter.title = caseNumber
    frontmatter.date = date ? formatDate(date, opts.dateFormat) : undefined
    frontmatter['case-number'] = caseNumber
  }
  if (parties) frontmatter.parties = parties
  if (topics.length) frontmatter.topics = topics
  if (finalRuling) frontmatter['final-ruling'] = finalRuling
  if (rulingArticles.length) frontmatter['ruling-articles'] = rulingArticles
  if (perArticle.length) frontmatter['per-article'] = perArticle
  if (aliases.length) frontmatter.aliases = aliases

  const markdown = errors.length ? null : buildMarkdown(frontmatter, body.text)

  return {
    ok: errors.length === 0,
    caseNumber,
    stem,
    markdown,
    warnings,
    errors,
    fields: {
      title: frontmatter.title,
      date: frontmatter.date,
      parties: frontmatter.parties,
      topics: topics.length,
      rulingArticles,
      perArticle: perArticle.length,
      paragraphsMarked: body.paragraphsMarked,
      docType: seg.docType,
      chamber: seg.chamber,
    },
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const existingStems = readExistingStems(opts.outDir)
  const report = []
  let failures = 0

  for (const input of opts.inputs) {
    let rawText
    try {
      rawText = fs.readFileSync(input, 'utf8')
    } catch (err) {
      report.push({ input, ok: false, errors: [`cannot read: ${err.message}`], warnings: [] })
      failures++
      continue
    }

    const result = convertJudgment(rawText, { ...opts, existingStems })
    const entry = {
      input,
      ok: result.ok,
      caseNumber: result.caseNumber,
      errors: result.errors,
      warnings: result.warnings,
      fields: result.fields,
      output: null,
      action: 'none',
    }

    if (!result.ok) {
      failures++
      report.push(entry)
      continue
    }

    if (opts.stdout) {
      process.stdout.write(result.markdown)
      entry.action = 'stdout'
      report.push(entry)
      continue
    }

    const outPath = opts.out || path.join(opts.outDir, `${result.stem}.md`)
    entry.output = path.relative(REPO_ROOT, outPath)

    const exists = fs.existsSync(outPath)
    if (exists && !opts.force) {
      entry.ok = false
      entry.errors.push(`${entry.output} already exists (pass --force to overwrite)`)
      failures++
      report.push(entry)
      continue
    }

    if (opts.dryRun) {
      entry.action = exists ? 'would-overwrite' : 'would-create'
    } else {
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, result.markdown, 'utf8')
      entry.action = exists ? 'overwrote' : 'created'
      existingStems.add(result.stem)
    }
    report.push(entry)
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify({ failures, results: report }, null, 2) + '\n')
  } else if (!opts.stdout) {
    printReport(report, opts)
  }

  process.exit(failures > 0 ? 1 : 0)
}

function printReport(report, opts) {
  for (const entry of report) {
    if (entry.ok) {
      if (opts.quiet) continue
      const f = entry.fields || {}
      process.stdout.write(
        `OK   ${entry.caseNumber}  ${entry.action}${entry.output ? ' ' + entry.output : ''}\n` +
          `     date=${f.date ?? '-'} topics=${f.topics ?? 0} ` +
          `ruling-articles=${(f.rulingArticles || []).length} per-article=${f.perArticle ?? 0} ` +
          `paragraphs=${f.paragraphsMarked ?? 0}\n`
      )
    } else {
      process.stdout.write(`FAIL ${entry.input}\n`)
      for (const e of entry.errors) process.stdout.write(`     error: ${e}\n`)
    }
    for (const w of entry.warnings) process.stdout.write(`     warn:  ${w}\n`)
  }

  const ok = report.filter(r => r.ok).length
  process.stdout.write(`\n${ok}/${report.length} converted\n`)
}

// Only run the CLI when executed directly, so the module can be imported.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main()
}
