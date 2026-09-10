# GDPRed input format — complete specification

What a case file must look like for the Quartz site and every generator script
to work. Written from an audit of all 67 case files on `main`, the Quartz
build, the eight scripts in `scripts/`, and the ingestion pipeline that lives
on the `claude/map-quartz-data-schema-4EAFt` branch.

Companion documents:

- `frontmatter-readme.md` — the original authoring guide (still accurate; this
  document supersedes it where they disagree, and says where).
- `functions-readme.md` — what each generator script does.
- `DATA-SCHEMA-MAP.md` (on `claude/map-quartz-data-schema-4EAFt`) — the same
  domain modelled for a database backend.

Enforcement: `node scripts/clean/validate-cases.js` checks everything marked
**MUST** below. Generation: `node scripts/clean/clean-judgment.js` produces
conformant files from plain text. See `scripts/clean/README.md`.

---

## 1. Quick reference

```markdown
---
title: C-205/21
date: 2023-01-26
case-number: C-205/21
parties: V.S. v Ministerstvo na vatreshnite raboti
topics:
  - Purpose limitation
  - Data minimisation
final-ruling: |-
  **1.** Article 17 of Regulation (EU) 2016/679 must be interpreted as ...

  **2.** Article 5(1)(c) of that regulation ...
ruling-articles:
  - Article 5
  - Article 17
per-article:
  - Article 5 | **2.** Article 5(1)(c) of that regulation ...
  - Article 17 | **1.** Article 17 of Regulation (EU) 2016/679 ...
---

JUDGMENT OF THE COURT (Fifth Chamber)

26 January 2023 (*1)

(Reference for a preliminary ruling – Purpose limitation – Data minimisation)

In Case C-205/21,

...

**1** This request for a preliminary ruling concerns [[Article 4]](1\)(a) ...

### Legal context

...
```

Saved as `content/Case law/C-205-21.md`.

---

## 2. What actually reads what

A field reaches readers by one of **two** routes, and it is easy to
under-estimate the second:

1. **Directly** — a Quartz component reads the frontmatter at build time.
2. **Indirectly** — a script in `scripts/` reads the frontmatter and bakes the
   value into the HTML of a generated page (`content/index.md`,
   `content/Case law by date.md`, `content/case-law-grid.md`), which Quartz
   then builds like any other content.

"No Quartz component reads it" therefore does **not** mean "invisible".

| Field | Read directly by a component | Read by a generator script | Visible to readers today |
|---|---|---|---|
| `title` | page `<h1>`, `<title>`, Explorer, search index | timeline, grid | yes |
| `date` | `created`/`published`, Explorer sort, RSS, sitemap | timeline, grid | yes |
| `parties` | `Parties.tsx`, `Backlinks.tsx`, `ExplorerNode.tsx` | timeline, grid, both cross-reference indexes | yes |
| `ruling-articles` | `NowReading.tsx` article chips | `extract_key_articles.cjs`, `extract_article_rulings.js` | yes |
| `case-number` | `TopicExplorer.tsx` only | `extract_case_articles.cjs` | yes |
| `aliases` | redirect pages | — | yes (as redirects) |
| `topics` | none | `generate-timeline.js:187`, `generate-case-grid.js:145-148` | **yes — via the timeline** |
| `final-ruling` | none | `extract_article_rulings.js:188-192`, `extract_gdpr_articles.js:110-125` | not currently |
| `per-article` | none | written by `extract_gdpr_articles.js:132`, read by nothing | no |

### `topics` is user-facing — and only the first three

`generate-timeline.js:187` renders `caseItem.topics.slice(0, 3).join(' • ')`.
Those three strings appear in italics under every entry on
**content/Case law by date.md** (the "Browse by timeline" page) and in
`content/index.md`. Verified: that file contains
`Principles relating to processing of personal data • Purpose limitation •
Data minimisation` for C-205/21.

So topic **order matters**. Put the distinguishing concepts first; the court's
keyword block opens with a generic subject-matter statement
("Protection of natural persons with regard to the processing of personal
data") that is true of every case in the corpus and wastes one of the three
visible slots. `clean-judgment.js` drops those.

### `final-ruling` is consumed, but its page has never been generated

`extract_article_rulings.js` reads it to build `content/article-rulings.md`,
and `extract_gdpr_articles.js` reads it to derive `ruling-articles`. Neither
output exists in the repo: the first has a broken `__dirname` path (§6) and has
never run successfully, and the second is hard-coded to three case files. The
field is therefore *intended* to be user-facing and currently is not.

### Two things that really are dead

- `ArticleCases.tsx` ("Cases Referencing This Article") is **dead code** —
  exported from `quartz/components/index.ts` but wired into no layout and no
  emitter. `ruling-articles` drives only the `NowReading` chip row.
- `per-article` is written by `extract_gdpr_articles.js` and read by no
  component and no script. 129 of its 194 entries in the corpus are the literal
  placeholder `Article N | Interpretation from final ruling related to
  Article N`.

---

## 3. File identity

### 3.1 Filename

**MUST** be `content/Case law/<case-number with "/" replaced by "-">.md`.

`C-205/21` → `content/Case law/C-205-21.md` → slug `Case-law/C-205-21`.

Slugs come only from the filename (`quartz/util/path.ts`): whitespace becomes
`-`, `&` becomes `-and-`, `%` becomes `-percent`, `?` and `#` are deleted.
Case, parentheses, commas and U+29F8 are preserved.

**MUST** match `case-number`. One file violates this today: `C-628-23.md`
declares `case-number: C-638/23`, so its two inbound wikilinks resolve to
nothing.

### 3.2 The four spellings of a case number

The same case appears four ways, and mixing them up is the most common source
of broken links here.

| Form | Character | Where it belongs | Count in `content/` |
|---|---|---|---|
| `C-205/21` | U+002F SOLIDUS | `title`, `case-number` | 179 |
| `C-205-21` | U+002D HYPHEN-MINUS | filenames, slugs, wikilink targets | 1829 |
| `C-205⧸21` | U+29F8 BIG SOLIDUS | wikilink display text | 1051 |
| `C-205∕21` | U+2215 DIVISION SLASH | legacy only — do not emit | 184 |

A real `/` in link text would split the slug, which is why U+29F8 exists. The
U+2215 spelling is a historical inconsistency: `generate-case-grid.js:37` and
`generate-timeline.js:37` both emit U+2215 while every content file uses
U+29F8, so string comparisons between the two silently fail.

Raw CJEU text additionally uses **U+2011 NON-BREAKING HYPHEN** after the case
letter (`C‑205/21`). It is visually identical to `-`. Normalise it before
matching anything.

Canonical link form: `[[C-205-21|C-205⧸21]]`.

---

## 4. Frontmatter

Delimited by `---` on line 1 and a line that is exactly `---`. LF endings, no
BOM.

Field order **SHOULD** be: `title`, `date`, `case-number`, `parties`,
`topics`, `final-ruling`, `ruling-articles`, `per-article`, `aliases`
(60 of 67 files already use exactly this order).

### `title` — required

The case number in canonical form. **MUST** be a plain string.

Quartz calls `data.title.toString()`. If the value starts with `[[`, YAML reads
it as a *flow sequence*, not a wikilink: `title: [[C-203-22|C-203⧸22]]` parses
to the nested array `[["C-203-22|C-203⧸22"]]` and renders as the literal text
`C-203-22|C-203⧸22` in the browser tab. Two files do this today.

> **Never put a wikilink in a frontmatter scalar.** This is the single most
> damaging formatting mistake in the repo, and `convert-article-refs.js`
> causes it because it rewrites the whole file including the YAML.

### `date` — required

`YYYY-MM-DD`, unquoted.

Quartz parses frontmatter with `yaml.JSON_SCHEMA`
(`quartz/plugins/transformers/frontmatter.ts:72`), so the value stays a
**string** — which `quartz.layout.ts:59` relies on (`typeof aDate === 'string'`)
for the Case-law Explorer sort. The standalone `.cjs` helpers use js-yaml's
DEFAULT schema instead and receive a `Date`. Both work; the string form is
canonical.

In the wild: 46 files use `2022-10-27T00:00:00.000Z` (a js-yaml round-trip
artefact), 20 use bare `YYYY-MM-DD`, 1 is quoted. All parse. Emit the bare
form.

An unparseable date does not fail the build — `lastmod.ts:15-27` silently
substitutes the build time and logs a warning, so the page just shows "today".

### `case-number` — required

Identical to `title`. Same plain-string rule.

### `parties` — required in practice

`Applicant v Respondent`, a plain string.

`Parties.tsx` requires `typeof parties === 'string'` or renders nothing.
`generate-timeline.js:32` and `generate-case-grid.js:32` both gate on
`title && date && parties`, so a case without it is **silently dropped from
the timeline and the grid**. `C-184-20` is missing today for exactly this
reason.

Conventions from the corpus:

- Separator is always ` v ` (no full stop).
- Several parties on one side are joined with `, ` (`X, Z v Autoriteit`).
- Labelled interveners (`interested party:`, `other party:`) are **dropped**
  when a `v` is present, and become the right-hand side when there is no `v`.
- Joined-case tags on party names (`UF (C-26/22)`) are stripped.

**MUST NOT** contain ` --- `. `C-673-17`'s parties value does, and four index
generators locate the closing fence with `indexOf('---', 3)`, so they truncate
the frontmatter there and drop the case entirely. Use an em dash.

### `topics` — optional

A YAML sequence of free-text legal concepts, from the court's own parenthesised
keyword block.

387 items across the corpus, 298 distinct, 1–14 per file. No controlled
vocabulary. Read by the timeline and grid for display only.

**MUST** be a sequence of strings. `C-460-20` gets this wrong: its `topics` is
one `|` block scalar containing six `- ` lines, so it parses as a single
251-character string.

### `final-ruling` — optional

The operative part, as a `|-` literal block scalar.

**SHOULD** use `|-`, not `>-`. Folded scalars re-flow long lines, which is what
splits wikilinks across a line break in `C-200-23` (`[[Article\n  82]](2\)`),
`C-394-23` and `C-460-20`. The authoring docs and the golden reference file
`C-205-21.md` both use `|-`; the 43 files using `>-` were machine-generated.

Numbered points are `**N.** text` (bold, **with** a dot), separated by a blank
line. A judgment whose operative part is a single unnumbered paragraph — the
majority shape — carries that paragraph with no number.

**MUST NOT** contain wikilinks (see `title`). Keep frontmatter plain text.

### `ruling-articles` — required

A YAML sequence of `Article N` strings, ascending.

This is the field that drives the article chips. `NowReading.tsx:6` requires an
array (a scalar renders nothing), then matches each item with
`/(?:\[\[)?Article\s+(\d+)(?:\]\])?/i` and builds
`<root>/Articles/Article-<n>` by hand.

That link is built by string concatenation and never passes through
`CrawlLinks`, so it gets no broken-link detection: **an article number outside
1–99 produces a 404 with no warning.** `C-252-21` lists `Article 102` today.

Scope: articles of Regulation (EU) 2016/679 only. The corpus is inconsistent
here — `C-205-21` lists Directive 2016/680 and Charter articles, and
`C-25-17` has entries like `Article 10(1) of the Charter`, which silently links
to GDPR Article 10. `clean-judgment.js` defaults to GDPR-only; pass
`--articles all` for the legacy behaviour.

**MUST** be plain strings. `- [[Article 15]]` parses as a nested array and
breaks `extract_key_articles.cjs`, `extract_article_rulings.js` and
`generate-case-grid.js` — one bad file loses the *entire* generated output,
because all four scripts write only after the full run.

### `per-article` — optional

A YAML sequence of `Article N | <verbatim ruling text>` strings.

Read by nothing. If you emit it, emit real text: do not write the
`Interpretation from final ruling related to Article N` placeholder, and do not
double-encode the item so its value starts with `  - `.

### `aliases` — optional

Alternative case numbers that should redirect here, used for joined cases.

Caveat: `getAliasSlugs` does not slugify the directory segment, so alias
`C-18/22` on `content/Case law/C-17-22.md` emits a redirect at
`Case law/C-18/22.html` (literal space, `/` as a path separator) and
`[[C-18-22]]` still does not resolve to it. Prefer the hyphen form.

---

## 5. Body

### 5.1 Structure

Starts immediately after the closing `---` and a blank line. Order:

```
JUDGMENT OF THE COURT (Fifth Chamber)
26 January 2023 (*1)
(keyword block)
In Case C-205/21,
REQUEST for a preliminary ruling under Article 267 TFEU from ...
THE COURT (Fifth Chamber),
composed of ... / Advocate General: ... / Registrar: ...
**1** This request for a preliminary ruling concerns ...
### Legal context
...
### Costs
### On those grounds, the Court (Fifth Chamber) hereby rules:
[Signatures]
(*1) Language of the case: Bulgarian.
```

### 5.2 Paragraph numbering

Judgment paragraphs are `**12** Text` — bold, **no** trailing dot, one space.
57 of 67 files use this (4,524 markers). Operative-part points use
`**1.** Text` — bold **with** a dot. Do not confuse the two.

Numbering ascends from 1. `C-200-23` violates this (it runs 1..16, restarts at
1, then jumps to 17).

### 5.3 Headings

`###` (ATX, level 3). `TableOfContents` is configured with `maxDepth: 3`, so
level 3 is the deepest that still appears in the TOC.

Most common: `### The dispute in the main proceedings and the questions
referred for a preliminary ruling` (47), `### Consideration of the questions
referred` (41), `### The first question` (32), `### Legal context`, `### Costs`.

### 5.4 Article references — the escaping rule

This is load-bearing and easy to get wrong.

```
[[Article 5]](1\)(c)     ->  <a href="Article%205">Article 5</a>(1)(c)      correct
[[Article 5]](1)(c)      ->  <a href="1">[Article 5]</a>(c)                 destroyed
```

A wikilink immediately followed by `(` is consumed by CommonMark as an inline
link. **The first closing paren after a wikilink MUST be backslash-escaped**,
and only that one — a later `(c)` is already safe because it does not directly
follow a `]`.

Corpus: 2,573 correct, 54 broken across 10 files, 1,444 bare `[[Article N]]`.

Further rules:

- Only articles **1–99** may be wikilinked. `content/Articles/` holds exactly
  `Article 1.md` … `Article 99.md`. `process_article_refs.cjs` exists to undo
  links to higher numbers; better not to create them.
- Do not link references belonging to another instrument (`Article 267 TFEU`,
  `Article 47 of the Charter`, `Article 10 of Directive 2016/680`).
- Do not split a letter-suffixed provision: `Article 16a` must not become
  `[[Article 16]]a` (the corpus does this 5 times).
- Plural forms (`Articles 13 and 14`) are left as plain text — there is no
  readable wikilink spelling for them.
- `[[Article 17(1)]]` does **not** work: `sluggify` preserves parentheses, so
  the target `Article-17(1)` matches no file.
- Link resolution is **case-sensitive**: `[[article 5]]` resolves to nothing.

### 5.5 Case citations

`[[C-205-21|C-205⧸21]]`. Emit these only when
`content/Case law/C-205-21.md` exists — 144 distinct targets in the corpus
point at cases that were never imported, and every one renders as a dead link.

### 5.6 Characters

- LF only, no BOM, one trailing newline.
- Avoid U+00A0 (2,917 in the corpus) and U+2011 (321). Both are invisible and
  break date and case-number regexes.
- `parseArrows` is enabled: a literal `->`, `-->`, `=>`, `<-`, `<=` in text is
  converted to an arrow entity. `--` alone is safe.
- A `#` followed by word characters is parsed as a tag and injected into
  `frontmatter.tags`. Pure-numeric `#123` is filtered; `#Ref` would create a
  phantom tag.

---

## 5a. Parity decisions

Where the corpus is internally inconsistent, `clean-judgment.js` picks one
spelling. These were measured, not guessed — `scripts/clean/parity-report.js`
diffs generated output against the committed files field by field.

| Aspect | Choice | Why |
|---|---|---|
| `date` | bare `YYYY-MM-DD` | Tested: bare, quoted and ISO-instant are interchangeable. All three reach Quartz as strings, satisfy the Explorer's `typeof === 'string'` sort guard, and give the same day from `new Date()`. `--date-format iso` emits the other. |
| `ruling-articles` | all instruments | Matches the corpus, which lists Article 12 of Directive 2002/58 (C-129/21) and Article 47 of the Charter (C-132/21). `--articles gdpr` restricts to Regulation 2016/679 so every chip links to a real page. |
| `per-article` | one entry per ruling-article | Real operative text where a point matches, the corpus's fallback wording where none does — but never the `  - ` double-encoded form. |
| `final-ruling` | plain text, `\|-` | Measured: emitting wikilinks drops parity from 30% to 3%, because our escaping differs from the older `convert-article-refs.js` output. Plain text also removes the corruption class that hit C-203-22 and C-628-23. |
| `topics` | court keywords, generic lead-ins dropped | Only the first three are rendered, so a phrase true of every case wastes a visible slot. |
| `aliases` | joined cases only | The other case numbers of a joined reference; nothing else is derivable from one judgment. |

### A separate, pre-existing bug

`generate-timeline.js:71` and `generate-case-grid.js:55` call
`toLocaleDateString` without `timeZone: 'UTC'`. Since every `date` value is
midnight UTC, **every case renders one day early for any reader west of
Greenwich** — C-205/21 shows as "January 25, 2023" in Los Angeles. This affects
the whole corpus regardless of date spelling. The fix is to pass
`{ timeZone: 'UTC' }` in both places.

---

## 6. Post-processing order

After adding a case file, run, in this order:

```bash
node scripts/clean/validate-cases.js "content/Case law/C-205-21.md"   # gate first
node scripts/process_article_refs.cjs        # strip [[Article N]] for N > 99
node scripts/extract_case_articles.cjs       # cases_by_article.md, articles_by_case.md
node extract_key_articles.cjs                # cases-by-key-articles.md, key-articles-by-case.md
node scripts/generate-timeline.js            # rewrites content/index.md
node scripts/generate-case-grid.js           # content/case-law-grid.md
node scripts/extract_article_rulings.js      # content/article-rulings.md
```

**Known breakage in that pipeline** (state of `main`; the
`claude/debug-pipeline-docs-NyquN` branch fixes the path bugs):

- `extract_article_rulings.js`, `extract_case_articles.cjs`,
  `generate-case-grid.js` and `process_article_refs.cjs` all resolve
  `path.join(__dirname, 'content', ...)` → `scripts/content/Case law`, which
  does not exist. Commit `ee8aee0` moved them into `scripts/` without updating
  the paths. Only `generate-timeline.js` is correct.
- Outputs are written to `process.cwd()`, not `content/`, and must be moved by
  hand. `content/key-articles-by-case.md` additionally carries frontmatter no
  generator emits.
- `generate-case-grid.js` currently produces nothing: its `try/catch` wraps the
  whole loop, so one bad file yields `[]` and it refuses to write.
- `generate-timeline.js` rewrites everything between `## Case law timeline` and
  the next heading in `content/index.md` — hand-written content after the
  timeline is destroyed. It also writes only `content/index.md`, while the
  published timeline page is `content/Case law by date.md`.
- `check_frontmatter.js` validates YAML syntax only. It passes every file in
  the corpus, including the two corrupted ones. Use
  `scripts/clean/validate-cases.js` instead.
- Nothing runs in CI: `.github/workflows/ci.yaml` is gated on
  `github.repository == 'jackyzha0/quartz'`.

---

## 7. Plain-text landmarks

For tooling that parses a judgment from plain text rather than EUR-Lex HTML.
All of these are textual and survive any export path; the HTML-class approach
used by `scripts/pipeline/generate-frontmatter.js` (`C41DispositifIntroduction`,
`C71Indicateur`, `C77Signatures`) silently produced three empty case files when
EUR-Lex served a different markup family.

| Element | Landmark |
|---|---|
| Document type | `JUDGMENT OF THE COURT (…)`, `ORDER OF THE COURT`, `OPINION OF ADVOCATE GENERAL` |
| Judgment date | first `D Month YYYY` line after the header |
| Topics | the parenthesised keyword block after the date, split on ` – ` |
| Case number | `In Case C‑205/21,` / `In Joined Cases …` |
| Parties | between `in the proceedings` / `in the criminal proceedings against` / `in the proceedings brought by` and `THE COURT (…)`, around a lone `v` or an `interested party:` label |
| Recitals start | `gives the following` then `Judgment` |
| Operative part | `On those grounds, the Court (…) hereby rules:` (also `orders`, `declares`) |
| Operative end | `[Signatures]`, `(*1) Language of the case:`, or `* * *` |

Two things that will bite:

- The keyword block is **not reliably paren-balanced** — `C-667/21` has six
  `(` and five `)`. Match it line-wise, not with a depth counter.
- The date line carries its own parenthesised footnote marker
  (`26 January 2023 ( *1 )`), which must be skipped before looking for the
  keyword block.

Paragraph numbering appears in two families: the number inline followed by a
whitespace run (`1      This request …`), or the number alone on its own line
with the prose following. Accept both, and only accept numbers in strict
ascending sequence from 1 — judgments quote national legislation that is itself
numbered `1.`, `2.`, and a permissive regex marks those as judgment paragraphs.

---

## 8. Known defects in the current corpus

Measured over the 67 case files on `main`. `validate-cases.js` reports all of
these: **26 errors across 17 files**.

| Defect | Files | Effect |
|---|---|---|
| Unescaped `[[Article N]](1)` | 10 files, 54 refs | Link destroyed by CommonMark |
| Wikilink in a frontmatter scalar | `C-203-22`, `C-628-23` | `title`/`case-number`/`ruling-articles` parse as nested arrays; breaks 4 generators |
| Filename ≠ `case-number` | `C-628-23` (says `C-638/23`) | Inbound wikilinks resolve to nothing |
| Missing `parties` | `C-184-20` | Dropped from timeline and grid |
| `Article 102` in `ruling-articles` | `C-252-21` | Chip links to a nonexistent page |
| `topics` as one block scalar | `C-460-20` | Parses as a single 251-char string |
| ` --- ` inside `parties` | `C-673-17` | Frontmatter truncated by 4 generators; case missing from indexes |
| `per-article` placeholder | 47 files, 129 items | Noise, read by nothing |
| Malformed wikilinks | `C-60-22`, `C-306-21`, `C-383-23`, `C-659-22` | `[[Article26]]`, `[[X||Y]]`, `[[[…`, `[[Articles 25]]` |
| Body missing entirely | `C-817-19` | Frontmatter only |
| Dangling case links | 144 distinct targets | Dead links; cited precedents never imported |

Two apparent differences are the *corpus* being wrong: `C-272-19`'s parties
read `VQ v LandHessen` (missing space) and `C-175-20`'s read `SS'' SIA`
(a YAML quote-doubling artefact).
