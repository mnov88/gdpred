#!/usr/bin/env node
/**
 * One command to take a judgment all the way into the site.
 *
 *   node scripts/clean/ingest.js judgment.txt
 *   node scripts/clean/ingest.js 62021CJ0205
 *   node scripts/clean/ingest.js C-205/21 C-492/23
 *   node scripts/clean/ingest.js --discover --limit 5
 *   node scripts/clean/ingest.js --discover --dry-run
 *
 * Inputs may be mixed freely:
 *   a file path      .txt (plain text) or .html (converted first)
 *   a CELEX id       62021CJ0205        downloaded from CELLAR/EUR-Lex
 *   a case number    C-205/21           mapped to CELEX, then downloaded
 *   --discover       ask SPARQL which GDPR judgments are missing locally
 *
 * Stages, in order. Each reports, and a failure stops that case only:
 *   1 discover   SPARQL, skipping cases already in content/Case law
 *   2 fetch      CELLAR first, EUR-Lex fallback, anti-bot detection
 *   3 clean      -> content/Case law/<case>.md
 *   4 validate   the new files must pass validate-cases.js
 *   5 index      re-run the cross-reference and timeline generators
 *
 * Options
 *   --discover            discover missing cases via SPARQL
 *   --limit N             cap how many cases are processed
 *   --out-dir <dir>       where case files go (default: content/Case law)
 *   --cache-dir <dir>     keep downloaded HTML here (default: a temp dir)
 *   --dry-run             do everything except write case files and indexes
 *   --force               overwrite existing case files
 *   --articles <gdpr|all> ruling-articles scope (default: all)
 *   --date-format <date|iso>
 *   --no-index            skip stage 5
 *   --no-validate         skip stage 4 (not recommended)
 *   --json                machine-readable report
 *   --quiet               errors only
 *
 * Exit codes: 0 everything ingested and valid, 1 at least one case failed,
 * 2 bad usage.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'
import { execFileSync } from 'child_process'

import { convertJudgment } from './clean-judgment.js'
import { validateCaseFile } from './validate-cases.js'
import { discoverCases, downloadJudgment, htmlToText, celexToCaseNumber } from './lib/fetch.js'
import { toCanonical, toFilename, parseCaseNumber } from './lib/caseref.js'
import { CASE_DIR, ARTICLE_DIR } from './lib/constants.js'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

/** `C-205/21` -> `62021CJ0205`. Inverse of celexToCaseNumber. */
export function caseNumberToCelex(caseNumber) {
  const parts = parseCaseNumber(caseNumber)
  if (!parts || parts.prefix !== 'C') return null
  const year = Number(parts.year) > 50 ? `19${parts.year}` : `20${parts.year}`
  return `6${year}CJ${String(parts.number).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    inputs: [],
    discover: false,
    limit: 0,
    outDir: path.join(REPO_ROOT, CASE_DIR),
    cacheDir: null,
    dryRun: false,
    force: false,
    articles: 'all',
    dateFormat: 'date',
    index: true,
    validate: true,
    json: false,
    quiet: false,
  }
  const takesValue = new Set(['--limit', '--out-dir', '--cache-dir', '--articles', '--date-format'])

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
      if (value === undefined) die(`${flag} needs a value`)
    }

    switch (flag) {
      case '--discover': opts.discover = true; break
      case '--limit': opts.limit = Number(value) || 0; break
      case '--out-dir': opts.outDir = path.resolve(value); break
      case '--cache-dir': opts.cacheDir = path.resolve(value); break
      case '--dry-run': opts.dryRun = true; break
      case '--force': opts.force = true; break
      case '--articles': opts.articles = value; break
      case '--date-format': opts.dateFormat = value; break
      case '--no-index': opts.index = false; break
      case '--no-validate': opts.validate = false; break
      case '--json': opts.json = true; break
      case '--quiet': opts.quiet = true; break
      case '--help': case '-h': usage(); process.exit(0); break
      default: die(`unknown option ${flag}`)
    }
  }

  if (!opts.inputs.length && !opts.discover) die('give a file, a CELEX id, a case number, or --discover')
  return opts
}

function die(message) {
  process.stderr.write(`ingest: ${message}\n\n`)
  usage(process.stderr)
  process.exit(2)
}

function usage(stream = process.stdout) {
  stream.write(
    'Usage: node scripts/clean/ingest.js [<file|CELEX|case-number>...] [--discover] [options]\n' +
      '  --limit N   --out-dir <dir>  --cache-dir <dir>  --dry-run  --force\n' +
      '  --articles <gdpr|all>        --date-format <date|iso>\n' +
      '  --no-index  --no-validate    --json   --quiet   --help\n'
  )
}

// ---------------------------------------------------------------------------
// Stage 1-2: resolve inputs to judgment text
// ---------------------------------------------------------------------------

/** Case stems already in the output directory. */
function existingStems(dir) {
  const stems = new Set()
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue
      const stem = toFilename(f.slice(0, -3))
      if (stem) stems.add(stem)
    }
  } catch {
    /* directory does not exist yet */
  }
  return stems
}

/** Classify one input token. */
function classifyInput(token) {
  if (/^\d{5}[A-Z]{2}\d{4}$/i.test(token)) return { kind: 'celex', celex: token.toUpperCase() }
  if (toCanonical(token)) {
    const celex = caseNumberToCelex(token)
    return celex
      ? { kind: 'case-number', celex, caseNumber: toCanonical(token) }
      : { kind: 'error', detail: `cannot map ${token} to a CELEX id` }
  }
  if (fs.existsSync(token)) return { kind: 'file', file: token }
  return { kind: 'error', detail: `not a file, CELEX id or case number: ${token}` }
}

/** Get judgment text for one job, downloading if needed. */
async function resolveText(job, opts, log) {
  if (job.kind === 'file') {
    const raw = fs.readFileSync(job.file, 'utf8')
    const isHtml = /\.x?html?$/i.test(job.file) || /^\s*<(?:!doctype|html)\b/i.test(raw.slice(0, 200))
    return { text: isHtml ? htmlToText(raw) : raw, origin: job.file }
  }

  const cacheFile = opts.cacheDir ? path.join(opts.cacheDir, `${job.celex}.html`) : null
  if (cacheFile && fs.existsSync(cacheFile)) {
    log(`  cached  ${job.celex}`)
    return { text: htmlToText(fs.readFileSync(cacheFile, 'utf8')), origin: cacheFile }
  }

  const { html, source } = await downloadJudgment(job.celex)
  log(`  fetched ${job.celex} from ${source} (${Math.round(html.length / 1024)} KiB)`)
  if (cacheFile) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, html, 'utf8')
  }
  return { text: htmlToText(html), origin: `${source}:${job.celex}` }
}

// ---------------------------------------------------------------------------
// Stage 5: index generators
// ---------------------------------------------------------------------------

/**
 * The generator scripts, in dependency order.
 *
 * Four of them resolve `path.join(__dirname, 'content', ...)` and so look for
 * `scripts/content/Case law`, which does not exist — commit ee8aee0 moved them
 * into `scripts/` without updating the paths. They are listed here with that
 * noted, so a failure is reported as the known bug it is rather than as a
 * mysterious warning. `claude/debug-pipeline-docs-NyquN` carries the fix.
 */
const GENERATORS = [
  { script: 'scripts/process_article_refs.cjs', pathBug: true, note: 'strips [[Article N]] for N > 99' },
  { script: 'scripts/extract_case_articles.cjs', pathBug: true, note: 'cases_by_article.md, articles_by_case.md' },
  { script: 'extract_key_articles.cjs', pathBug: false, note: 'cases-by-key-articles.md, key-articles-by-case.md' },
  { script: 'scripts/generate-timeline.js', pathBug: false, note: 'timeline into content/index.md' },
  { script: 'scripts/generate-case-grid.js', pathBug: true, note: 'content/case-law-grid.md' },
  { script: 'scripts/extract_article_rulings.js', pathBug: true, note: 'content/article-rulings.md' },
]

function runGenerators(opts, log) {
  const results = []
  for (const gen of GENERATORS) {
    const abs = path.join(REPO_ROOT, gen.script)
    if (!fs.existsSync(abs)) {
      results.push({ ...gen, status: 'missing' })
      continue
    }
    if (opts.dryRun) {
      results.push({ ...gen, status: 'skipped-dry-run' })
      continue
    }
    try {
      execFileSync(process.execPath, [abs], { cwd: REPO_ROOT, stdio: 'pipe', timeout: 120000 })
      results.push({ ...gen, status: 'ok' })
      log(`  ok      ${gen.script}`)
    } catch (err) {
      const detail = String(err.stderr || err.message).split('\n')[0].slice(0, 160)
      const status = gen.pathBug ? 'failed-known-path-bug' : 'failed'
      results.push({ ...gen, status, detail })
      log(`  FAILED  ${gen.script}${gen.pathBug ? '  (known __dirname path bug)' : ''}`)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const lines = []
  const log = msg => {
    lines.push(msg)
    if (!opts.json && !opts.quiet) process.stdout.write(msg + '\n')
  }

  if (!opts.cacheDir) {
    opts.cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdpred-ingest-'))
  }

  const present = existingStems(opts.outDir)
  const jobs = []

  // ---- stage 1: inputs and discovery --------------------------------------
  for (const token of opts.inputs) {
    const job = classifyInput(token)
    if (job.kind === 'error') {
      log(`SKIP  ${job.detail}`)
      continue
    }
    jobs.push(job)
  }

  if (opts.discover) {
    log('discovering GDPR judgments via SPARQL ...')
    const found = await discoverCases()
    const missing = found.filter(c => {
      const stem = toFilename(c.caseNumber) || toFilename(celexToCaseNumber(c.celex) || '')
      return stem && !present.has(stem)
    })
    log(`  ${found.length} judgments interpret the GDPR; ${missing.length} not in ${CASE_DIR}`)
    for (const c of missing) {
      jobs.push({ kind: 'celex', celex: c.celex, caseNumber: c.caseNumber, sparqlArticles: c.articles })
    }
  }

  const selected = opts.limit ? jobs.slice(0, opts.limit) : jobs
  if (opts.limit && jobs.length > selected.length) {
    log(`  --limit ${opts.limit}: processing ${selected.length} of ${jobs.length}`)
  }
  if (!selected.length) {
    log('nothing to do')
    if (opts.json) process.stdout.write(JSON.stringify({ ok: true, cases: [], generators: [] }, null, 2) + '\n')
    process.exit(0)
  }

  // ---- stages 2-4: fetch, clean, validate ---------------------------------
  const report = []
  let failures = 0
  let written = 0

  for (const job of selected) {
    const label = job.caseNumber || job.celex || job.file
    log(`\n${label}`)
    const entry = { input: label, ok: false, errors: [], warnings: [], output: null }

    let text
    try {
      const resolved = await resolveText(job, opts, log)
      text = resolved.text
      entry.origin = resolved.origin
    } catch (err) {
      entry.errors.push(err.message)
      log(`  ERROR   ${err.message}`)
      report.push(entry)
      failures++
      continue
    }

    const result = convertJudgment(text, {
      articles: opts.articles,
      dateFormat: opts.dateFormat,
      existingStems: present,
      // SPARQL names the provisions the case actually modifies; merging them in
      // catches articles the operative part phrases in a way the regex misses.
      extraArticles: job.sparqlArticles || [],
    })

    entry.warnings = result.warnings
    entry.errors.push(...result.errors)
    entry.caseNumber = result.caseNumber

    for (const w of result.warnings) log(`  warn    ${w}`)
    if (!result.ok) {
      for (const e of result.errors) log(`  ERROR   ${e}`)
      report.push(entry)
      failures++
      continue
    }

    const outPath = path.join(opts.outDir, `${result.stem}.md`)
    entry.output = path.relative(REPO_ROOT, outPath)

    if (fs.existsSync(outPath) && !opts.force) {
      entry.errors.push(`${entry.output} exists (use --force)`)
      log(`  ERROR   ${entry.output} exists (use --force)`)
      report.push(entry)
      failures++
      continue
    }

    // Validate before writing, so a bad file never lands.
    if (opts.validate) {
      const v = validateCaseFile(outPath, result.markdown, {
        articleStems: new Set(
          fs.existsSync(path.join(REPO_ROOT, ARTICLE_DIR))
            ? fs.readdirSync(path.join(REPO_ROOT, ARTICLE_DIR)).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
            : []
        ),
      })
      entry.validation = { errors: v.errors, warnings: v.warnings }
      for (const e of v.errors) log(`  INVALID ${e}`)
      for (const w of v.warnings) log(`  warn    ${w}`)
      if (v.errors.length) {
        entry.errors.push(...v.errors)
        report.push(entry)
        failures++
        continue
      }
    }

    if (opts.dryRun) {
      log(`  would write ${entry.output}`)
      entry.action = 'would-write'
    } else {
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, result.markdown, 'utf8')
      present.add(result.stem)
      written++
      log(`  wrote   ${entry.output}`)
      entry.action = 'wrote'
    }

    entry.ok = true
    report.push(entry)
  }

  // ---- stage 5: indexes ---------------------------------------------------
  let generators = []
  if (opts.index && (written > 0 || opts.dryRun)) {
    log('\nregenerating indexes ...')
    generators = runGenerators(opts, log)
  } else if (opts.index) {
    log('\nno new case files, skipping index regeneration')
  }

  // ---- summary ------------------------------------------------------------
  const ok = report.filter(r => r.ok).length
  if (opts.json) {
    process.stdout.write(
      JSON.stringify({ ok: failures === 0, written, cases: report, generators }, null, 2) + '\n'
    )
  } else {
    process.stdout.write(`\n${ok}/${report.length} ingested, ${written} written\n`)
    const broken = generators.filter(g => g.status.startsWith('failed'))
    if (broken.length) {
      process.stdout.write(
        `\n${broken.length} index generator(s) failed. ` +
          'Those marked "known path bug" resolve scripts/content/Case law, which does not exist;\n' +
          'the fix is path.join(__dirname, "..", "content", ...) — see INPUT-FORMAT.md section 6.\n'
      )
    }
  }

  process.exit(failures > 0 ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(err => {
    process.stderr.write(`ingest: ${err.stack || err.message}\n`)
    process.exit(1)
  })
}
