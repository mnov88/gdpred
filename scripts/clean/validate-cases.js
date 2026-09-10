#!/usr/bin/env node
/**
 * Validate GDPRed case files against the contract in
 * `GDPRed documentation/INPUT-FORMAT.md`.
 *
 *   node scripts/clean/validate-cases.js                    # whole corpus
 *   node scripts/clean/validate-cases.js "content/Case law/C-205-21.md"
 *   node scripts/clean/validate-cases.js --strict            # warnings fail too
 *   node scripts/clean/validate-cases.js --json
 *
 * Unlike scripts/check_frontmatter.js — which only checks that the YAML
 * parses, and therefore passes every file in the corpus including the two
 * corrupted ones — this checks the things that actually break the site and the
 * index generators.
 *
 * Exit codes: 0 clean, 1 errors (or warnings under --strict), 2 bad usage.
 */

import fs from 'fs'
import path from 'path'
import process from 'process'

import { splitMarkdown } from './lib/yaml.js'
import { filenameMatches, toCanonical, toFilename } from './lib/caseref.js'
import { isGdprArticle } from './lib/articles.js'
import {
  CASE_DIR,
  ARTICLE_DIR,
  REQUIRED_FIELDS,
  TIMELINE_REQUIRED_FIELDS,
  FIELD_ORDER,
  GDPR_MAX_ARTICLE,
} from './lib/constants.js'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

const KNOWN_FIELDS = new Set([...FIELD_ORDER, 'tags', 'cssclasses', 'draft', 'subtitle'])

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Validate one case file.
 * Returns { file, errors: [], warnings: [], infos: [] }.
 */
export function validateCaseFile(filePath, content, context = {}) {
  const errors = []
  const warnings = []
  const infos = []
  const stem = path.basename(filePath).replace(/\.md$/, '')

  const err = m => errors.push(m)
  const warn = m => warnings.push(m)
  const info = m => infos.push(m)

  // ---- file-level bytes ---------------------------------------------------
  if (content.startsWith('﻿')) err('file starts with a UTF-8 BOM')
  if (/\r/.test(content)) err('file contains CR — line endings must be LF only')
  if (!content.endsWith('\n')) warn('file does not end with a newline')
  if (/[ \t]+$/m.test(content)) info('file has trailing whitespace on some lines')
  if (/\t/.test(content)) warn('file contains a TAB character')

  // ---- frontmatter block --------------------------------------------------
  const parseWarnings = []
  const { frontmatter, body, rawFrontmatter } = splitMarkdown(content, m => parseWarnings.push(m))

  if (!frontmatter) {
    err('no YAML frontmatter block (must open with "---" on line 1 and close with a "---" line)')
    return { file: filePath, errors, warnings, infos }
  }
  for (const w of parseWarnings) warn(`frontmatter: ${w}`)

  // A "---" line inside a value truncates the frontmatter for
  // extract_case_articles.cjs and three sibling scripts, which look for the
  // closing fence with indexOf('---', 3). This is why C-673-17 vanishes from
  // the generated indexes.
  if (/(^|\n)---/.test(rawFrontmatter)) {
    err(
      'a frontmatter value contains a line starting with "---"; four index generators ' +
        'truncate the frontmatter there and silently drop this case'
    )
  }
  if (/\s---\s/.test(rawFrontmatter)) {
    warn(
      'a frontmatter value contains " --- "; scripts that locate the closing fence with ' +
        'indexOf("---") mis-parse this file (use an em dash instead)'
    )
  }

  // ---- required fields ----------------------------------------------------
  for (const field of REQUIRED_FIELDS) {
    if (frontmatter[field] === undefined || frontmatter[field] === null) {
      err(`missing required field \`${field}\``)
    }
  }

  const missingForTimeline = TIMELINE_REQUIRED_FIELDS.filter(f => !frontmatter[f])
  if (missingForTimeline.length) {
    warn(
      `missing ${missingForTimeline.map(f => `\`${f}\``).join(', ')} — generate-timeline.js and ` +
        'generate-case-grid.js both require title+date+parties and will silently omit this case'
    )
  }

  for (const key of Object.keys(frontmatter)) {
    if (!KNOWN_FIELDS.has(key)) info(`unrecognised frontmatter key \`${key}\``)
  }

  // ---- wikilinks in frontmatter ------------------------------------------
  // `title: [[C-203-22|C-203⧸22]]` is valid YAML but parses as a nested flow
  // sequence, so the page title renders as the literal `C-203-22|C-203⧸22`
  // and every consumer that calls .match()/.replace() on it throws.
  for (const [key, value] of Object.entries(frontmatter)) {
    const scalars = Array.isArray(value) ? value : [value]
    for (const item of scalars) {
      if (typeof item !== 'string') continue
      if (key === 'final-ruling' || key === 'per-article') continue
      if (/^\s*\[\[/.test(item)) {
        err(
          `\`${key}\` starts with "[[" — YAML reads that as a flow sequence, not a wikilink. ` +
            'Frontmatter values must be plain text.'
        )
      }
    }
  }
  if (typeof frontmatter.title !== 'string' && frontmatter.title !== undefined) {
    err('`title` is not a plain string (a wikilink in frontmatter makes it a nested array)')
  }

  // ---- identity -----------------------------------------------------------
  const caseNumber = frontmatter['case-number']
  if (typeof caseNumber === 'string') {
    if (!toCanonical(caseNumber)) {
      err(`\`case-number\` "${caseNumber}" is not a recognisable case reference`)
    } else if (!/^[CTF]-\d{1,4}\/\d{2}$/.test(caseNumber)) {
      warn(
        `\`case-number\` should use an ASCII slash, e.g. "${toCanonical(caseNumber)}" ` +
          `(found "${caseNumber}")`
      )
    }
    if (!filenameMatches(stem, caseNumber)) {
      err(
        `filename "${stem}.md" does not match \`case-number\` "${caseNumber}" — ` +
          `the file should be "${toFilename(caseNumber)}.md"`
      )
    }
  }

  if (
    typeof frontmatter.title === 'string' &&
    typeof caseNumber === 'string' &&
    frontmatter.title !== caseNumber
  ) {
    warn(`\`title\` ("${frontmatter.title}") differs from \`case-number\` ("${caseNumber}")`)
  }

  // ---- date ---------------------------------------------------------------
  const date = frontmatter.date
  if (date !== undefined && date !== null) {
    const text = String(date)
    if (!/^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(text)) {
      err(`\`date\` "${text}" is not YYYY-MM-DD (an ISO instant suffix is tolerated)`)
    } else if (text.length > 10) {
      info(`\`date\` carries a time component ("${text}"); YYYY-MM-DD is the documented form`)
    }
    if (Number.isNaN(Date.parse(text.slice(0, 10)))) err(`\`date\` "${text}" is not a real date`)
  }

  // ---- topics -------------------------------------------------------------
  const topics = frontmatter.topics
  if (topics !== undefined) {
    if (!Array.isArray(topics)) {
      err('`topics` must be a YAML sequence, not a scalar')
    } else {
      if (topics.length === 1 && typeof topics[0] === 'string' && /\n\s*-\s/.test(topics[0])) {
        err(
          '`topics` is a single block scalar containing "- " lines — it parses as one long ' +
            'string, not a list of topics'
        )
      }
      for (const t of topics) {
        if (typeof t !== 'string') err('`topics` contains a non-string item')
        else if (/^\s*-\s/.test(t)) err(`\`topics\` item is double-encoded: ${JSON.stringify(t)}`)
      }
    }
  }

  // ---- ruling-articles ----------------------------------------------------
  const rulingArticles = frontmatter['ruling-articles']
  const articleNumbers = []
  if (rulingArticles !== undefined) {
    if (!Array.isArray(rulingArticles)) {
      err('`ruling-articles` must be a YAML sequence — NowReading.tsx renders nothing otherwise')
    } else {
      for (const item of rulingArticles) {
        if (typeof item !== 'string') {
          err(
            `\`ruling-articles\` contains a non-string item (${JSON.stringify(item)}) — ` +
              'usually a wikilink that YAML parsed as a nested array'
          )
          continue
        }
        const m = item.match(/^Article\s+(\d{1,3})\b/)
        if (!m) {
          warn(
            `\`ruling-articles\` item "${item}" is not of the form "Article N"; ` +
              'NowReading.tsx will render it as an unlinked chip'
          )
          continue
        }
        const n = Number(m[1])
        articleNumbers.push(n)
        if (!isGdprArticle(n)) {
          err(
            `\`ruling-articles\` names Article ${n}, outside GDPR's 1-${GDPR_MAX_ARTICLE}; ` +
              'the chip links to a page that does not exist'
          )
        } else if (context.articleStems && !context.articleStems.has(`Article ${n}`)) {
          warn(`\`ruling-articles\` names Article ${n} but ${ARTICLE_DIR}/Article ${n}.md is missing`)
        }
        if (item !== `Article ${n}`) {
          info(
            `\`ruling-articles\` item "${item}" carries a sub-paragraph or instrument; ` +
              `NowReading.tsx links it to GDPR Article ${n} regardless`
          )
        }
      }
    }
  }

  // ---- per-article --------------------------------------------------------
  const perArticle = frontmatter['per-article']
  if (perArticle !== undefined) {
    if (!Array.isArray(perArticle)) {
      err('`per-article` must be a YAML sequence')
    } else {
      for (const item of perArticle) {
        if (typeof item !== 'string') {
          err(`\`per-article\` contains a non-string item (${JSON.stringify(item)})`)
          continue
        }
        // Downgraded to a warning: `per-article` is read by no Quartz
        // component and no script, so a malformed item is data debt rather
        // than site breakage.
        if (/^\s*-\s/.test(item)) {
          warn(`\`per-article\` item is double-encoded: ${JSON.stringify(item.slice(0, 60))}...`)
          continue
        }
        // The documented fallback when no operative point mentions the
        // article. Informational, not a defect: `per-article` deliberately
        // carries one entry per `ruling-articles` entry.
        if (/\|\s*Interpretation from final ruling related to/.test(item)) {
          info(`\`per-article\` has no matching operative point for ${item.split(' | ')[0]}`)
          continue
        }
        if (!item.includes(' | ')) {
          warn(`\`per-article\` item has no " | " separator: ${JSON.stringify(item.slice(0, 60))}...`)
          continue
        }
        const article = item.split(' | ')[0].trim()
        const n = Number(article.match(/\d{1,3}/)?.[0])
        if (Number.isInteger(n) && articleNumbers.length && !articleNumbers.includes(n)) {
          info(`\`per-article\` mentions Article ${n}, which is not in \`ruling-articles\``)
        }
      }
    }
  }

  // ---- aliases ------------------------------------------------------------
  if (frontmatter.aliases !== undefined) {
    if (!Array.isArray(frontmatter.aliases)) {
      err('`aliases` must be a YAML sequence')
    } else {
      for (const alias of frontmatter.aliases) {
        if (typeof alias !== 'string') { err('`aliases` contains a non-string item'); continue }
        if (alias.includes('/')) {
          warn(
            `alias "${alias}" contains "/", which Quartz treats as a path separator — ` +
              `the redirect lands at "${CASE_DIR}/${alias}.html" and [[${toFilename(alias) ?? alias}]] ` +
              'still will not resolve'
          )
        }
        if (toCanonical(alias) === toCanonical(caseNumber)) {
          info(`alias "${alias}" is the file's own case number`)
        }
      }
    }
  }

  // ---- body ---------------------------------------------------------------
  if (!body.trim()) {
    warn('file has no body — only frontmatter')
  } else {
    checkBody(body, { err, warn, info })
  }

  return { file: filePath, errors, warnings, infos }
}

/** Body-level checks: link escaping, paragraph numbering, dead article links. */
function checkBody(body, { err, warn, info }) {
  // The load-bearing escape. It guards the CLOSING paren: `[[Article 5]](1\)`
  // is correct, `[[Article 5]](1)` is parsed by CommonMark as an inline link
  // and the wikilink is destroyed. So the broken form is a `(...)` group whose
  // closing paren has no backslash before it.
  const unescaped = body.match(/\[\[Article\s+\d+\]\]\([^)\\]*\)/g)
  if (unescaped) {
    err(
      `${unescaped.length} article reference(s) use the unescaped form "[[Article N]](1)"; ` +
        'the closing paren must be escaped as "[[Article N]](1\\)" or CommonMark eats the link ' +
        `(first: ${JSON.stringify(unescaped[0])})`
    )
  }

  // Wikilinks to article pages that do not exist.
  for (const m of body.matchAll(/\[\[Article\s+(\d{1,4})(?:\|[^\]]*)?\]\]/g)) {
    const n = Number(m[1])
    if (!isGdprArticle(n)) {
      err(
        `body links [[Article ${n}]], outside GDPR's 1-${GDPR_MAX_ARTICLE} — ` +
          'process_article_refs.cjs exists to strip these'
      )
    }
  }

  // Malformed wikilinks seen in the corpus.
  if (/\[\[\[/.test(body)) err('body contains a triple-bracket wikilink "[[["')
  if (/\[\[[^\]]*\|\|/.test(body)) err('body contains a double-pipe wikilink "[[X||Y]]"')
  if (/\[\[Article\d/.test(body)) err('body contains "[[ArticleN]]" with no space after "Article"')
  if (/\[\[Articles\s/.test(body)) err('body contains a plural "[[Articles N]]" link, which resolves to nothing')

  // A wikilink split across a line break slugifies to a broken target.
  if (/\[\[[^\]]*\n/.test(body)) {
    err('a wikilink spans a line break; the target slugifies with "---" in it and resolves to nothing')
  }

  // Paragraph numbering.
  const markers = [...body.matchAll(/^\*\*(\d{1,3})\*\*\s/gm)].map(m => Number(m[1]))
  if (!markers.length) {
    info('body has no `**N**` paragraph markers')
  } else {
    let monotonic = true
    for (let i = 1; i < markers.length; i++) if (markers[i] <= markers[i - 1]) monotonic = false
    if (!monotonic) warn(`\`**N**\` paragraph numbering is not strictly ascending (${markers.length} markers)`)
    if (markers[0] !== 1) warn(`\`**N**\` paragraph numbering starts at ${markers[0]}, not 1`)
  }

  // Invisible characters that break every regex downstream.
  const nbsp = (body.match(/ /g) || []).length
  if (nbsp) info(`body contains ${nbsp} non-breaking space(s) (U+00A0)`)
  const nbHyphen = (body.match(/‑/g) || []).length
  if (nbHyphen) info(`body contains ${nbHyphen} non-breaking hyphen(s) (U+2011), indistinguishable from "-"`)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function collectTargets(args) {
  if (args.length) return args.map(a => path.resolve(a))
  const dir = path.join(REPO_ROOT, CASE_DIR)
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => path.join(dir, f))
}

function readArticleStems() {
  const stems = new Set()
  try {
    for (const f of fs.readdirSync(path.join(REPO_ROOT, ARTICLE_DIR))) {
      if (f.endsWith('.md')) stems.add(f.slice(0, -3))
    }
  } catch {
    /* no Articles directory — the article-existence check is skipped */
  }
  return stems
}

function main() {
  const argv = process.argv.slice(2)
  const strict = argv.includes('--strict')
  const asJson = argv.includes('--json')
  const quiet = argv.includes('--quiet')
  const files = collectTargets(argv.filter(a => !a.startsWith('--')))

  if (!files.length) {
    process.stderr.write('validate-cases: no files to check\n')
    process.exit(2)
  }

  const context = { articleStems: readArticleStems() }
  const results = []

  for (const file of files) {
    let content
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch (e) {
      results.push({ file, errors: [`cannot read: ${e.message}`], warnings: [], infos: [] })
      continue
    }
    results.push(validateCaseFile(file, content, context))
  }

  const totals = results.reduce(
    (acc, r) => ({
      errors: acc.errors + r.errors.length,
      warnings: acc.warnings + r.warnings.length,
      infos: acc.infos + r.infos.length,
      badFiles: acc.badFiles + (r.errors.length ? 1 : 0),
    }),
    { errors: 0, warnings: 0, infos: 0, badFiles: 0 }
  )

  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        { totals, results: results.map(r => ({ ...r, file: path.relative(REPO_ROOT, r.file) })) },
        null,
        2
      ) + '\n'
    )
  } else {
    for (const r of results) {
      if (!r.errors.length && !r.warnings.length && (quiet || !r.infos.length)) continue
      const rel = path.relative(REPO_ROOT, r.file)
      process.stdout.write(`\n${rel}\n`)
      for (const m of r.errors) process.stdout.write(`  ERROR  ${m}\n`)
      for (const m of r.warnings) process.stdout.write(`  WARN   ${m}\n`)
      if (!quiet) for (const m of r.infos) process.stdout.write(`  info   ${m}\n`)
    }
    process.stdout.write(
      `\n${files.length} file(s): ${totals.errors} error(s) in ${totals.badFiles} file(s), ` +
        `${totals.warnings} warning(s), ${totals.infos} info(s)\n`
    )
  }

  const failed = totals.errors > 0 || (strict && totals.warnings > 0)
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main()
}
