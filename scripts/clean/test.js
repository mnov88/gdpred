#!/usr/bin/env node
/**
 * Tests for the cleaning scripts. Zero dependencies — run with:
 *
 *   node scripts/clean/test.js
 *
 * Three groups:
 *   1. unit tests for the pure helpers
 *   2. a round-trip test over every real case file (parse -> emit -> parse
 *      must be semantically stable)
 *   3. a parity test against js-yaml, skipped automatically when js-yaml is
 *      not installed. This is what backs up lib/yaml.js's claim that its
 *      parser covers the subset the corpus actually uses.
 *
 * Exit code 0 if everything passes, 1 otherwise.
 */

import fs from 'fs'
import path from 'path'
import process from 'process'

import { parseFrontmatter, splitMarkdown, dumpFrontmatter, buildMarkdown } from './lib/yaml.js'
import { toCanonical, toFilename, toDisplay, isJoinedCase, findCaseRefs } from './lib/caseref.js'
import {
  linkArticleRefs,
  unlinkArticleRefs,
  collectArticleNumbers,
  buildRulingArticles,
  buildPerArticle,
  splitOperativePoints,
} from './lib/articles.js'
import { markParagraphNumbers, promoteHeadings, linkCaseRefs, stripDocumentId } from './lib/body.js'
import { normaliseInvisibles, reflowParagraphs } from './lib/normalise.js'
import { parseTopics, extractKeywordBlock, extractParties, toIsoDate } from './lib/segment.js'
import { CASE_DIR } from './lib/constants.js'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

let passed = 0
const failures = []

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}\n    expected: ${e}\n    actual:   ${a}`)
}

function ok(name, condition, detail = '') {
  if (condition) passed++
  else failures.push(`${name}${detail ? '\n    ' + detail : ''}`)
}

// ---------------------------------------------------------------------------
// 1. Unit tests
// ---------------------------------------------------------------------------

// -- case references --------------------------------------------------------
check('caseref: canonical from ASCII slash', toCanonical('C-205/21'), 'C-205/21')
check('caseref: canonical from filename form', toCanonical('C-205-21'), 'C-205/21')
check('caseref: canonical from display slash', toCanonical('C-205⧸21'), 'C-205/21')
check('caseref: canonical from legacy slash', toCanonical('C-205∕21'), 'C-205/21')
check('caseref: canonical from non-breaking hyphen', toCanonical('C‑205/21'), 'C-205/21')
check('caseref: strips "Case " prefix', toCanonical('Case C-1/17'), 'C-1/17')
check('caseref: unwraps a wikilink', toCanonical('[[C-203-22|C-203⧸22]]'), 'C-203/22')
check('caseref: rejects non-references', toCanonical('not a case'), null)
check('caseref: filename form', toFilename('C-205/21'), 'C-205-21')
check('caseref: display form', toDisplay('C-205/21'), 'C-205⧸21')
check('caseref: joined case detected', isJoinedCase('C-511/18, C-512/18 and C-520/18'), true)
check('caseref: wikilink is not a joined case', isJoinedCase('[[C-203-22|C-203⧸22]]'), false)
check(
  'caseref: findCaseRefs across spellings',
  findCaseRefs('see C‑511/18 and C-512/18 plus C-520⧸18'),
  ['C-511/18', 'C-512/18', 'C-520/18']
)

// -- article links ----------------------------------------------------------
check('articles: bare reference', linkArticleRefs('Article 5 applies'), '[[Article 5]] applies')
check(
  'articles: escapes only the first closing paren',
  linkArticleRefs('Article 5(1)(c) applies'),
  '[[Article 5]](1\\)(c) applies'
)
check(
  'articles: single sub-paragraph',
  linkArticleRefs('under Article 82(1).'),
  'under [[Article 82]](1\\).'
)
check(
  'articles: leaves TFEU references alone',
  linkArticleRefs('under Article 267 TFEU from'),
  'under Article 267 TFEU from'
)
check(
  'articles: leaves Charter references alone',
  linkArticleRefs('Article 47 of the Charter'),
  'Article 47 of the Charter'
)
check(
  'articles: leaves other directives alone',
  linkArticleRefs('Article 10 of Directive 2016/680'),
  'Article 10 of Directive 2016/680'
)
check(
  'articles: does not split a letter-suffixed provision',
  linkArticleRefs('Article 16a of that law'),
  'Article 16a of that law'
)
check(
  'articles: leaves an existing wikilink untouched',
  linkArticleRefs('[[Article 5]](1\\)(c) and Article 6'),
  '[[Article 5]](1\\)(c) and [[Article 6]]'
)
check(
  'articles: plural form is left as plain text',
  linkArticleRefs('Articles 13 and 14 require'),
  'Articles 13 and 14 require'
)
check('articles: unlink round-trip', unlinkArticleRefs('[[Article 5]](1\\)(c)'), 'Article 5(1)(c)')
check(
  'articles: unlink an aliased case link',
  unlinkArticleRefs('[[C-205-21|C-205⧸21]]'),
  'C-205-21'
)

// -- article number collection ---------------------------------------------
check('articles: collect singles', collectArticleNumbers('Article 5 and Article 17'), [5, 17])
check('articles: collect plural "and"', collectArticleNumbers('Articles 13 and 14'), [13, 14])
check(
  'articles: expand a range',
  collectArticleNumbers('Articles 12 to 15'),
  [12, 13, 14, 15]
)
check('articles: ignore out-of-range', collectArticleNumbers('Article 267 and Article 5'), [5])

check(
  'articles: ruling-articles requires a GDPR marker',
  buildRulingArticles('Article 10 of Directive 2016/680 must be interpreted'),
  []
)
check(
  'articles: ruling-articles with a GDPR marker',
  buildRulingArticles('Article 17 of Regulation (EU) 2016/679 must be interpreted'),
  ['Article 17']
)
check(
  'articles: ruling-articles merges an authoritative list',
  buildRulingArticles('Article 17 of Regulation (EU) 2016/679', { extraNumbers: [5, 17] }),
  ['Article 5', 'Article 17']
)

// -- operative part ---------------------------------------------------------
const RULING = '1.      Article 17 of the GDPR must be read thus.\n2.      Article 5 also applies.'
check('articles: split numbered points', splitOperativePoints(RULING).map(p => p.number), [1, 2])
check(
  'articles: a single unnumbered point',
  splitOperativePoints('Article 17 must be read thus.').map(p => p.number),
  [1]
)
check(
  'articles: per-article maps points to articles',
  buildPerArticle(RULING, ['Article 5', 'Article 17']),
  [
    'Article 5 | **2.** Article 5 also applies.',
    'Article 17 | **1.** Article 17 of the GDPR must be read thus.',
  ]
)
check(
  'articles: per-article omits articles with no matching point',
  buildPerArticle(RULING, ['Article 99']),
  []
)

// -- body -------------------------------------------------------------------
check(
  'body: inline paragraph numbering',
  markParagraphNumbers('1      First.\n2      Second.').text,
  '**1** First.\n**2** Second.'
)
check(
  'body: split paragraph numbering',
  markParagraphNumbers('1\nFirst.\n2\nSecond.').text,
  '**1** First.\n**2** Second.'
)
check(
  'body: quoted legislation numbering is not mistaken for paragraphs',
  markParagraphNumbers('1      First.\nThe law says:\n1. not a paragraph\n2      Second.').text,
  '**1** First.\nThe law says:\n1. not a paragraph\n**2** Second.'
)
check('body: promotes known headings', promoteHeadings('Legal context'), '### Legal context')
check('body: promotes bold headings', promoteHeadings('**Costs**'), '### Costs')
check('body: leaves prose alone', promoteHeadings('This is a sentence.'), 'This is a sentence.')
check(
  'body: links only cases that exist',
  linkCaseRefs('C-1/20 and C-999/99', new Set(['C-1-20'])),
  '[[C-1-20|C-1⧸20]] and C-999/99'
)
check(
  'body: bare numbers survive case linking',
  linkCaseRefs('[[A]] [[B]] [[C]] [[D]] paragraph 3 and 4, C-1/20', new Set(['C-1-20'])),
  '[[A]] [[B]] [[C]] [[D]] paragraph 3 and 4, [[C-1-20|C-1⧸20]]'
)
check('body: strips a leading CELEX id', stripDocumentId('62021CJ0205\nJUDGMENT'), 'JUDGMENT')

// -- normalisation ----------------------------------------------------------
check(
  'normalise: NBSP becomes a space',
  normaliseInvisibles('12 January 2023'),
  '12 January 2023'
)
check(
  'normalise: non-breaking hyphen becomes ASCII',
  normaliseInvisibles('C‑205/21'),
  'C-205/21'
)
check('normalise: soft hyphen is deleted', normaliseInvisibles('co­operate'), 'cooperate')
check(
  'normalise: reflow joins wrapped prose',
  reflowParagraphs('This is a long\nsentence split over\nlines.'),
  'This is a long sentence split over lines.'
)
check(
  'normalise: reflow keeps a heading standalone',
  reflowParagraphs('### Costs\nThe costs are.'),
  '### Costs\n\nThe costs are.'
)
check(
  'normalise: a marked paragraph absorbs its continuation lines',
  reflowParagraphs('**1** First part\ncontinues here.\n\n**2** Second.'),
  '**1** First part continues here.\n\n**2** Second.'
)

// -- segmentation -----------------------------------------------------------
check('segment: ISO date', toIsoDate('26', 'January', '2023'), '2023-01-26')
check('segment: ISO date pads the day', toIsoDate('6', 'March', '2024'), '2024-03-06')
check(
  'segment: keyword block skips the footnote marker',
  extractKeywordBlock(' ( *1 )\n(Reference for a preliminary ruling – Protection of data – Purpose limitation)'),
  'Reference for a preliminary ruling – Protection of data – Purpose limitation'
)
ok(
  'segment: keyword block tolerates unbalanced parens',
  extractKeywordBlock(
    '(Reference for a preliminary ruling – Protection of data (EU – Purpose limitation'
  ) !== null,
  'the court sometimes leaves a paren unclosed (C-667/21)'
)
check(
  'segment: topics drop the boilerplate lead',
  parseTopics('Reference for a preliminary ruling – Purpose limitation – Article 5(1)(c) – Data minimisation'),
  ['Purpose limitation', 'Data minimisation']
)
check(
  'segment: parties from a lone v',
  extractParties('in the proceedings\nA Ltd\nv\nB Authority,\nTHE COURT (Fifth Chamber),'),
  'A Ltd v B Authority'
)
check(
  'segment: parties from a label, no v',
  extractParties(
    'in the criminal proceedings against\nV.S.,\ninterested party:\nMinistry X,\nTHE COURT (Fifth Chamber),'
  ),
  'V.S. v Ministry X'
)
check(
  'segment: labelled interveners are dropped when a v is present',
  extractParties(
    'in the proceedings\nA Ltd\nv\nB Authority,\nintervening parties:\nC Corp,\nTHE COURT (First Chamber),'
  ),
  'A Ltd v B Authority'
)
check(
  'segment: joined-case tags are stripped from party names',
  extractParties(
    'in the proceedings\nUF (C-26/22)\nAB (C-64/22)\nv\nLand Hessen,\nTHE COURT (First Chamber),'
  ),
  'UF, AB v Land Hessen'
)
check(
  'segment: single-party reference',
  extractParties('in the proceedings\nEndemol Shine Finland Oy\nTHE COURT (Sixth Chamber),'),
  'Endemol Shine Finland Oy'
)

// -- YAML -------------------------------------------------------------------
check(
  'yaml: emits an unquoted date',
  dumpFrontmatter({ date: '2023-01-26' }),
  'date: 2023-01-26\n'
)
check(
  'yaml: quotes a value containing ": "',
  dumpFrontmatter({ parties: 'A: B v C' }),
  "parties: 'A: B v C'\n"
)
check(
  'yaml: emits a block scalar for multi-line text',
  dumpFrontmatter({ 'final-ruling': 'One.\n\nTwo.' }),
  'final-ruling: |-\n  One.\n\n  Two.\n'
)
check(
  'yaml: quotes rather than block-scalars a leading-space value',
  dumpFrontmatter({ 'final-ruling': ' One.\nTwo.' }),
  'final-ruling: " One.\\nTwo."\n'
)
check(
  'yaml: sequences use two-space "- " items',
  dumpFrontmatter({ topics: ['A', 'B'] }),
  'topics:\n  - A\n  - B\n'
)
check(
  'yaml: closing fence must be a full line',
  splitMarkdown('---\nparties: A --- B\n---\nbody\n').frontmatter,
  { parties: 'A --- B' }
)
check(
  'yaml: parses a block scalar',
  parseFrontmatter('final-ruling: |-\n  One.\n\n  Two.\n'),
  { 'final-ruling': 'One.\n\nTwo.' }
)
check(
  'yaml: buildMarkdown template',
  buildMarkdown({ title: 'C-1/20' }, 'Body text.'),
  '---\ntitle: C-1/20\n---\n\nBody text.\n'
)

// ---------------------------------------------------------------------------
// 2. Round-trip over the real corpus
// ---------------------------------------------------------------------------

const caseDir = path.join(REPO_ROOT, CASE_DIR)
let corpusFiles = []
try {
  corpusFiles = fs
    .readdirSync(caseDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(caseDir, f))
} catch {
  /* no corpus available */
}

if (!corpusFiles.length) {
  process.stdout.write(`skip: no case files under ${CASE_DIR}\n`)
} else {
  const unstable = []
  for (const file of corpusFiles) {
    const content = fs.readFileSync(file, 'utf8')
    const first = splitMarkdown(content, () => {})
    if (!first.frontmatter) continue
    const reEmitted = dumpFrontmatter(first.frontmatter)
    const second = parseFrontmatter(reEmitted, () => {})

    // Compare after trimming trailing whitespace: emitting always uses `|-`
    // (strip), so a value that arrived via `|` or `>` loses its trailing
    // newline. That is deliberate normalisation, documented in lib/yaml.js.
    const norm = v =>
      JSON.parse(
        JSON.stringify(v, (_k, val) => (typeof val === 'string' ? val.replace(/\s+$/, '') : val))
      )
    if (JSON.stringify(norm(first.frontmatter)) !== JSON.stringify(norm(second))) {
      unstable.push(path.basename(file))
    }
  }
  ok(
    `yaml: parse -> emit -> parse is stable over all ${corpusFiles.length} case files`,
    unstable.length === 0,
    unstable.length ? `unstable: ${unstable.join(', ')}` : ''
  )
}

// ---------------------------------------------------------------------------
// 3. Parity against js-yaml (skipped when it is not installed)
// ---------------------------------------------------------------------------

let jsyaml = null
try {
  jsyaml = (await import('js-yaml')).default
} catch {
  /* not installed — this group is optional by design */
}

if (!jsyaml) {
  process.stdout.write('skip: js-yaml not installed, parity group not run\n')
} else if (corpusFiles.length) {
  const diverging = []
  for (const file of corpusFiles) {
    const content = fs.readFileSync(file, 'utf8')
    const mine = splitMarkdown(content, () => {})
    if (!mine.frontmatter) continue

    let reference
    try {
      reference = jsyaml.load(mine.rawFrontmatter, { schema: jsyaml.JSON_SCHEMA })
    } catch {
      // js-yaml rejecting the file is itself a finding, but not a parity bug.
      continue
    }

    const norm = v => {
      const walk = x => {
        if (Array.isArray(x)) return x.map(walk)
        if (x && typeof x === 'object') {
          const o = {}
          for (const k of Object.keys(x)) o[k] = walk(x[k])
          return o
        }
        return typeof x === 'string' ? x.replace(/\s+$/, '') : x
      }
      return walk(v)
    }

    if (JSON.stringify(norm(reference)) !== JSON.stringify(norm(mine.frontmatter))) {
      // The one documented divergence: a wikilink in an unquoted scalar is a
      // YAML flow sequence to js-yaml and a plain string to us. Those files
      // are corrupt and validate-cases.js reports them as errors.
      const hasFlowSeq = /^[a-z-]+:\s*\[\[/m.test(mine.rawFrontmatter)
      if (!hasFlowSeq) diverging.push(path.basename(file))
    }
  }
  ok(
    `yaml: parser agrees with js-yaml on all ${corpusFiles.length} case files ` +
      '(excluding files with wikilinks in unquoted scalars)',
    diverging.length === 0,
    diverging.length ? `diverging: ${diverging.join(', ')}` : ''
  )
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length) {
  process.stdout.write(`\n${failures.length} FAILED:\n`)
  for (const f of failures) process.stdout.write(`  - ${f}\n`)
}
process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`)
process.exit(failures.length ? 1 : 0)
