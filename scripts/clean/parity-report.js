#!/usr/bin/env node
/**
 * Measure how closely `clean-judgment.js` reproduces the committed case files.
 *
 *   node scripts/clean/parity-report.js <generated-dir>
 *   node scripts/clean/parity-report.js <generated-dir> --field topics --show 5
 *   node scripts/clean/parity-report.js <generated-dir> --json
 *
 * For every generated file that has a counterpart in `content/Case law`, each
 * frontmatter field is compared three ways:
 *
 *   exact      byte-identical value
 *   normalised equal after folding curly quotes, dash variants and whitespace
 *   differs    genuinely different content
 *
 * This is the metric the parity work is driven by. It is a development tool,
 * not part of the ingest pipeline.
 */

import fs from 'fs'
import path from 'path'
import process from 'process'

import { splitMarkdown } from './lib/yaml.js'
import { CASE_DIR, FIELD_ORDER } from './lib/constants.js'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

/** Fold the differences that are typographic rather than substantive. */
function normalise(value) {
  if (Array.isArray(value)) return value.map(normalise)
  if (value === null || value === undefined) return value
  return String(value)
    // `2023-01-26` and `2023-01-26T00:00:00.000Z` are interchangeable: both
    // reach Quartz as a string and both yield the same day from new Date().
    .replace(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/, '$1')
    // 129 corpus `per-article` entries are double-encoded so the value itself
    // begins with "  - ". We deliberately do not reproduce that (it is a
    // serialization fault), so fold it rather than counting it as a difference.
    .replace(/^\s*-\s+/, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/---/g, '-')
    .replace(/--/g, '-')
    .replace(/[–—‑]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function classify(mine, theirs) {
  if (mine === undefined && theirs === undefined) return 'absent-both'
  if (mine === undefined) return 'missing-in-mine'
  if (theirs === undefined) return 'extra-in-mine'
  const a = JSON.stringify(mine)
  const b = JSON.stringify(theirs)
  if (a === b) return 'exact'
  if (JSON.stringify(normalise(mine)) === JSON.stringify(normalise(theirs))) return 'normalised'
  return 'differs'
}

function readFrontmatter(file) {
  if (!fs.existsSync(file)) return null
  const { frontmatter } = splitMarkdown(fs.readFileSync(file, 'utf8'), () => {})
  return frontmatter
}

function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const showIdx = argv.indexOf('--show')
  const show = showIdx !== -1 ? Number(argv[showIdx + 1]) || 5 : 0
  const fieldIdx = argv.indexOf('--field')
  const onlyField = fieldIdx !== -1 ? argv[fieldIdx + 1] : null
  const dir = argv.find(a => !a.startsWith('--') && a !== String(show) && a !== onlyField)

  if (!dir) {
    process.stderr.write('usage: node scripts/clean/parity-report.js <generated-dir> [--field F] [--show N] [--json]\n')
    process.exit(2)
  }

  const generated = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()

  const fields = onlyField ? [onlyField] : FIELD_ORDER
  const tally = {}
  for (const f of fields) tally[f] = { exact: 0, normalised: 0, differs: 0, 'missing-in-mine': 0, 'extra-in-mine': 0, 'absent-both': 0 }
  const examples = []
  let compared = 0

  for (const name of generated) {
    const mine = readFrontmatter(path.join(dir, name))
    const theirs = readFrontmatter(path.join(REPO_ROOT, CASE_DIR, name))
    if (!mine || !theirs) continue
    compared++

    for (const field of fields) {
      const verdict = classify(mine[field], theirs[field])
      tally[field][verdict]++
      if (verdict === 'differs' || verdict === 'missing-in-mine' || verdict === 'extra-in-mine') {
        examples.push({ file: name, field, verdict, mine: mine[field], theirs: theirs[field] })
      }
    }
  }

  if (asJson) {
    process.stdout.write(JSON.stringify({ compared, tally, examples }, null, 2) + '\n')
    process.exit(0)
  }

  process.stdout.write(`Compared ${compared} generated files against ${CASE_DIR}\n\n`)
  const pad = (s, n) => String(s).padEnd(n)
  process.stdout.write(
    `${pad('field', 18)}${pad('exact', 7)}${pad('norm', 6)}${pad('differ', 8)}${pad('missing', 9)}${pad('extra', 7)}parity\n`
  )
  process.stdout.write('-'.repeat(64) + '\n')

  let totalAgree = 0
  let totalCompared = 0
  for (const field of fields) {
    const t = tally[field]
    const present = t.exact + t.normalised + t.differs + t['missing-in-mine'] + t['extra-in-mine']
    if (present === 0) continue
    const agree = t.exact + t.normalised
    totalAgree += agree
    totalCompared += present
    const pct = present ? Math.round((100 * agree) / present) : 100
    process.stdout.write(
      `${pad(field, 18)}${pad(t.exact, 7)}${pad(t.normalised, 6)}${pad(t.differs, 8)}` +
        `${pad(t['missing-in-mine'], 9)}${pad(t['extra-in-mine'], 7)}${pct}%\n`
    )
  }
  process.stdout.write('-'.repeat(64) + '\n')
  process.stdout.write(
    `overall parity: ${totalAgree}/${totalCompared} field comparisons agree ` +
      `(${Math.round((100 * totalAgree) / Math.max(totalCompared, 1))}%)\n`
  )

  if (show) {
    process.stdout.write(`\nFirst ${show} divergences${onlyField ? ` in \`${onlyField}\`` : ''}:\n`)
    for (const e of examples.slice(0, show)) {
      const fmt = v => {
        const s = Array.isArray(v) ? JSON.stringify(v) : String(v ?? '(absent)')
        return s.length > 220 ? s.slice(0, 220) + '…' : s
      }
      process.stdout.write(`\n  ${e.file}  \`${e.field}\`  [${e.verdict}]\n`)
      process.stdout.write(`    repo: ${fmt(e.theirs)}\n`)
      process.stdout.write(`    mine: ${fmt(e.mine)}\n`)
    }
  }
}

main()
