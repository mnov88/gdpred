# `scripts/clean` — plain-text judgment cleaning

Turn a plain-text CJEU judgment into a GDPRed case file, and check that the
files already in `content/Case law` still conform.

The contract these scripts implement is written down in
`GDPRed documentation/INPUT-FORMAT.md`.

## Why these exist alongside `scripts/pipeline`

The pipeline on the `claude/map-quartz-data-schema-4EAFt` branch fetches
EUR-Lex **HTML** and extracts fields by CSS class
(`C41DispositifIntroduction`, `C71Indicateur`, `C77Signatures`). That works
until EUR-Lex serves a different markup family, at which point it emits a case
file with no topics, no ruling and no articles — silently, with a zero exit
code. Three of the six case files it committed are like that.

These scripts key on **textual** landmarks instead, so they work on any plain
text: a DOCX text layer, a `pdftotext` dump, a copy-paste from curia.europa.eu.
When a landmark is missing they say so rather than emitting an empty field.

## Borrowed logic

Two pieces come from `mnov88/eulaw-local-mcp` (`src/lib/`), whose parsers are
calibrated over a much larger corpus than this one and carry vitest coverage:

- **The appeal-form operative marker.** Appeal judgments put the verb inside
  the numbered items, so the marker line is a bare `hereby:`. That server's
  `OPERATIVE_MARKER` anchors it to "on those grounds", because a line-final
  `hereby:` also occurs inside a quoted referred question. Calibrated over 631
  documents; it changes the match in exactly six of them.
- **Page-shell detection** (`parse-validate.ts`). EUR-Lex portal chrome saved
  instead of the judgment is detected by its "Switch to mobile" footer and an
  implausible link-to-word ratio, and rejected with a message that says what to
  save instead.

The sibling repo `mnov88/eu-law-mcp` (the Next.js app) has an older copy of the
same parsers with no unit tests; prefer the MCP server's versions.

## Requirements

Node 20+. **No npm install.** Nothing here imports a package — `lib/yaml.js` is
a scoped YAML emitter/parser rather than a dependency on `js-yaml`, so the
scripts run on a fresh clone. `test.js` uses `js-yaml` for a parity check if it
happens to be installed, and skips that group if not.

## Usage

### One command, end to end

`ingest.js` is the entry point. It resolves inputs, downloads what it must,
cleans, validates, and regenerates the indexes.

```bash
# a local file (plain text or HTML)
node scripts/clean/ingest.js judgment.txt

# by CELEX id, or by case number
node scripts/clean/ingest.js 62021CJ0205
node scripts/clean/ingest.js C-205/21 C-492/23

# ask SPARQL which GDPR judgments are missing locally, then take the first 5
node scripts/clean/ingest.js --discover --limit 5

# see what would happen, touch nothing
node scripts/clean/ingest.js --discover --dry-run
```

Stages, each reported, a failure stopping only that case:

| | Stage | What it does |
|---|---|---|
| 1 | discover | SPARQL against CELEX 32016R0679, skipping cases already present |
| 2 | fetch | CELLAR first, EUR-Lex fallback, anti-bot detection, optional cache |
| 3 | clean | `clean-judgment.js` |
| 4 | validate | `validate-cases.js` — **before** writing, so a bad file never lands |
| 5 | index | the cross-reference and timeline generators, in dependency order |

Useful flags: `--limit N`, `--cache-dir <dir>` (keeps downloaded HTML so re-runs
are offline), `--force`, `--no-index`, `--no-validate`, `--json`, `--quiet`,
plus `--articles` and `--date-format` passed through to the cleaner.

Stage 5 reports honestly: four of the six generators resolve
`scripts/content/Case law`, which does not exist, so they fail. `ingest.js`
labels those `known __dirname path bug` rather than burying them in a warning
the way `run-pipeline.js` does.

### Convert a judgment

```bash
# one file, written to content/Case law/<case>.md
node scripts/clean/clean-judgment.js judgment.txt

# preview without writing
node scripts/clean/clean-judgment.js judgment.txt --stdout
node scripts/clean/clean-judgment.js judgment.txt --dry-run

# a batch
node scripts/clean/clean-judgment.js incoming/*.txt

# override anything the parser could not work out
node scripts/clean/clean-judgment.js judgment.txt \
  --parties "A Ltd v B Authority" --topics "Right of access;Data minimisation"
```

Options:

| Flag | Meaning |
|---|---|
| `--out-dir <dir>` | Output directory (default `content/Case law`) |
| `--out <file>` | Explicit output path (single input only) |
| `--stdout` | Print the file instead of writing it |
| `--dry-run` | Report what would happen, write nothing |
| `--force` | Overwrite an existing case file |
| `--case-number`, `--date`, `--parties`, `--topics` | Override a detected field |
| `--articles gdpr\|all` | `ruling-articles` scope (default `all`, matching the corpus) |
| `--date-format date\|iso` | `2023-01-26` (default) or `2023-01-26T00:00:00.000Z` |
| `--frontmatter-links` | wikilink article refs inside `final-ruling` (off; lowers parity) |
| `--no-link-cases` | Do not wikilink citations to other cases |
| `--json` | Machine-readable report |
| `--quiet` | Errors only |

Exit codes: `0` all inputs converted, `1` at least one failed, `2` bad usage.
A file that converts **with warnings still exits 0** — read the report, or run
the validator as a hard gate.

### Validate the corpus

```bash
node scripts/clean/validate-cases.js                     # everything
node scripts/clean/validate-cases.js "content/Case law/C-205-21.md"
node scripts/clean/validate-cases.js --quiet             # hide info-level notes
node scripts/clean/validate-cases.js --strict            # warnings fail too
node scripts/clean/validate-cases.js --json
```

Three severities:

- **ERROR** — breaks the site or a generator. Exits non-zero.
- **WARN** — degrades something (a case dropped from the timeline, a
  placeholder value). Exits non-zero only under `--strict`.
- **info** — worth knowing, harmless.

On the corpus as it stands this reports 26 errors across 17 files. They are
catalogued in `INPUT-FORMAT.md` §8; the validator is not wrong, the data is.

Note this replaces `scripts/check_frontmatter.js`, which only checks that the
YAML parses and therefore passes every file including the two corrupted ones.

### Run the tests

```bash
node scripts/clean/test.js
```

94 assertions: unit tests for every helper, a parse→emit→parse round-trip over
all real case files, and a parity check against `js-yaml` when available (that
last group self-skips when js-yaml is absent, leaving 93).

## Layout

```
scripts/clean/
├── ingest.js             THE ENTRY POINT: discover -> fetch -> clean -> validate -> index
├── clean-judgment.js     plain text  ->  case .md
├── validate-cases.js     conformance checker
├── parity-report.js      dev tool: how closely output matches the committed files
├── test.js               test suite (zero deps)
└── lib/
    ├── constants.js      the contract in one place
    ├── caseref.js        the four spellings of a case number
    ├── fetch.js          SPARQL discovery, CELLAR/EUR-Lex download, HTML -> text
    ├── normalise.js      invisible characters, whitespace, reflow
    ├── segment.js        textual landmarks -> judgment sections
    ├── articles.js       article refs, wikilink escaping, ruling-articles
    ├── body.js           paragraph numbers, headings, link emission
    └── yaml.js           scoped YAML emitter + parser
```

## What it gets right, and what it does not

Measured against the 62 real judgments in `content/Downloads/DOCX files.zip`,
converted to plain text:

| | Result |
|---|---|
| Converted | 61 / 62 |
| Rejected | 1 — a EUR-Lex portal page with no judgment in it, refused by name |
| `date` matching the committed file | 61 / 61 |
| `parties` matching the committed file | 50 / 60 (83%) |

The 10 `parties` differences are: editorial trims a human made (dropping
`, formerly Facebook Ireland Ltd`), one case where the human picked one of two
interveners, and two where the **committed file is wrong** and the script is
right (`VQ v LandHessen` is missing a space; `SS'' SIA` is a YAML artefact).

Known limits, by design:

- **Joined cases** produce one file for the first case number and a warning.
  Add the others under `aliases` by hand.
- **`ruling-articles` scope** defaults to GDPR articles only, so a judgment
  about Directive 2016/680 yields an empty list and a warning. That keeps the
  `NowReading` chips pointing at pages that exist. Pass `--articles all` to
  reproduce the corpus's looser behaviour (`C-205-21` lists Directive and
  Charter articles today).
- **Topics** come out more granular than the hand-curated ones: 17 for
  `C-205/21` where the committed file has 7. They are the court's own keywords
  minus the generic lead-ins. Only the first three are user-visible (the
  timeline renders `topics.slice(0, 3)`), and for `C-205/21` those three now
  match the committed file exactly. Trim the tail, or pass `--topics`.
- Instrument attribution for an article reference is a **heuristic**. The
  source text is genuinely ambiguous — only surrounding prose says whether
  "Article 5" is GDPR or another regulation — so the script errs toward not
  linking.

## Parity with the committed files

`parity-report.js` diffs generated output against `content/Case law` field by
field. Current state over the 61 comparable judgments:

| field | parity | why not 100% |
|---|---|---|
| `title`, `date`, `case-number` | 100% | — |
| `parties` | 85% | editorial trims; 2 cases where the committed file is wrong |
| `ruling-articles` | 72% | the corpus list is curated; ours is derived |
| `aliases` | 60% | derivable for joined cases only |
| `final-ruling` | 30% | 22 files wikilink it, we keep frontmatter plain |
| `per-article` | 0% | by choice — see below |
| `topics` | 2% | the corpus topics are hand-picked, ours are the court's |

Two of those are deliberate:

- **`per-article`** scores 0% because 129 of the corpus's 194 entries are the
  placeholder `Article N | Interpretation from final ruling related to
  Article N`, stored double-encoded so the value itself begins `  - `. We emit
  one entry per `ruling-articles` entry with the real operative text where a
  point matches, and the placeholder wording — correctly encoded — where none
  does.
- **`final-ruling`** stays plain text. Emitting wikilinks was measured: parity
  *falls* from 30% to 3%, because our escaping convention differs from the
  older `convert-article-refs.js` output. Plain text also removes the whole
  class of bug that corrupted C-203-22 and C-628-23.

`date` is scored as equal across both spellings, because they were tested and
are interchangeable: `2023-01-26` and `2023-01-26T00:00:00.000Z` both reach
Quartz as strings, both satisfy the Explorer's sort guard, and both yield the
same day from `new Date()`. `--date-format iso` emits the second.

## Adding a case, end to end

```bash
node scripts/clean/ingest.js C-205/21 --dry-run   # inspect first
node scripts/clean/ingest.js C-205/21
```

Or, without the network:

```bash
node scripts/clean/clean-judgment.js judgment.txt --dry-run
node scripts/clean/clean-judgment.js judgment.txt
node scripts/clean/validate-cases.js "content/Case law/C-205-21.md"
```
