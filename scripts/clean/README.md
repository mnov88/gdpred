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

## Requirements

Node 20+. **No npm install.** Nothing here imports a package — `lib/yaml.js` is
a scoped YAML emitter/parser rather than a dependency on `js-yaml`, so the
scripts run on a fresh clone. `test.js` uses `js-yaml` for a parity check if it
happens to be installed, and skips that group if not.

## Usage

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
| `--articles gdpr\|all` | `ruling-articles` scope (default `gdpr`) |
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

70 assertions: unit tests for every helper, a parse→emit→parse round-trip over
all real case files, and a parity check against `js-yaml` when available.

## Layout

```
scripts/clean/
├── clean-judgment.js     plain text  ->  case .md
├── validate-cases.js     conformance checker
├── test.js               test suite (zero deps)
└── lib/
    ├── constants.js      the contract in one place
    ├── caseref.js        the four spellings of a case number
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
| Rejected | 1 — a EUR-Lex portal page with no judgment in it, correctly refused |
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
- **Topics** come out more granular than the hand-curated ones: 20 for
  `C-205/21` where the committed file has 7. They are the court's own keywords,
  unfiltered. Trim them, or pass `--topics`.
- Instrument attribution for an article reference is a **heuristic**. The
  source text is genuinely ambiguous — only surrounding prose says whether
  "Article 5" is GDPR or another regulation — so the script errs toward not
  linking.

## Adding a case, end to end

```bash
node scripts/clean/clean-judgment.js judgment.txt --dry-run   # inspect first
node scripts/clean/clean-judgment.js judgment.txt
node scripts/clean/validate-cases.js "content/Case law/C-205-21.md"
# then the index generators — see INPUT-FORMAT.md §6, and mind the path bugs
```
