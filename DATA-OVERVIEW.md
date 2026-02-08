# GDPRed Data Overview

## What the site is

A knowledge base of CJEU court judgments that interpret the GDPR. ~99 cases, 99 GDPR articles, and a handful of navigation pages.

---

## The data

### GDPR Articles

There are 99 articles (Article 1 through Article 99), one file each. Each has:

- **title** — `Article 17`
- **subtitle** — `Right to erasure ('right to be forgotten')`
- **body** — the full regulatory text from Regulation (EU) 2016/679

Articles are static reference content. They don't change. The interesting thing about an article page is the reverse lookup: which cases interpret it? That's computed from the cases' `ruling-articles` field (see below).

### Cases

Each case is a CJEU judgment. ~99 cases currently. Each has:

- **case-number** — `C-492/23` (the official court reference)
- **title** — usually identical to case-number
- **date** — judgment date (e.g. `2023-06-15`)
- **parties** — `Digi Távközlési és Szolgáltató Kft. v Nemzeti Adatvédelmi és Információszabadság Hatóság`
- **ruling-articles** — which GDPR articles this case interprets: `["Article 5", "Article 17", "Article 24"]`. This is the core cross-reference in the system.
- **topics** — free-text labels from the court's own tagging, 3–9 per case: `["Purpose limitation", "Storage limitation", "Data breach"]`. No controlled vocabulary — same concept appears worded differently across cases.
- **final-ruling** — the court's actual judgment, numbered paragraphs: `**1.** Article 17 must be interpreted as meaning that...`
- **per-article** — pipe-delimited pairs linking a specific article to what the case says about it: `Article 5 | Storage limitation requires...`. Can include sub-paragraphs like `Article 2(c)`.
- **body** — full ruling text (~300 lines), converted from EUR-Lex HTML to markdown. Contains the procedural history, legal analysis, and ruling.
- **aliases** — alternative case numbers for joined/related cases (rare): `["C-17/22"]`

Optional enrichment fields (from a separate JSON import, not all cases have these):
- **celex-id** — EUR-Lex identifier: `62023CJ0492`
- **gdpr-summary** — prose summary of GDPR implications
- **operative-parts-structured** — the ruling's numbered paragraphs broken into: verbatim text, simplified text, which articles each part interprets, which regulations it mentions

Cases link to articles and to other cases via `[[wikilinks]]` in their body text. These links power backlinks and the graph visualization.

### Topic taxonomy

Separate from the `topics` field on cases. This is a manually curated three-level browsing structure maintained in a markdown page ("Browse by topic"):

- 14 categories (e.g. "Data subject rights", "Remedies, liability, compensation")
- ~60 subtopics under them (e.g. "Right to erasure", "Right of access")
- Each subtopic maps to specific cases via wikilinks

A partial version (3 categories, 11 subtopics) is also hardcoded in the TopicExplorer component with explicit case slugs.

### Navigation pages

A handful of index/browse pages:
- Homepage — FAQ + a timeline visualization (generated HTML from all cases grouped by month)
- Case grid — card layout of all cases (generated HTML)
- Browse by topic — the taxonomy above
- Cross-reference indexes — "cases by article" and "articles by case" (generated markdown)

These pages use `tags: ["hidden"]` to exclude themselves from listings.

---

## Where the data comes from

**SPARQL endpoint** (EU Publications Office) — discovers new cases. Provides: case number, date, parties, and article references (in a coded format like `A04P4` → Article 4).

**EUR-Lex HTML** — the full ruling text. Downloaded per case. From the HTML we extract:
- The ruling text → converted to markdown body
- The final-ruling section → from specific CSS-classed elements
- Topics → from the `C71Indicateur` element, split on dashes
- Ruling-articles → regex `Article N` on the ruling text, merged with SPARQL data
- Per-article interpretations → ruling paragraphs matched to article numbers

**JSON metadata** (optional) — an external file with enriched data: CELEX IDs, summaries, structured operative parts. Applied as a post-processing step.

**Manual content** — the 99 article pages, the topic taxonomy, and navigation pages are authored by hand.

---

## How data is used on the site

| What a user sees | Data involved |
|-----------------|---------------|
| Case page header | case-number, parties, date |
| "Articles referenced" chips on a case page | ruling-articles → links to article pages |
| "Cases referencing this article" on an article page | reverse lookup of ruling-articles across all cases |
| Backlinks section | wikilinks in body text (cases link to articles, cases link to cases) |
| Graph visualization | all pages as nodes, wikilinks as directed edges |
| Full-text search | title + plain-text body + tags, client-side |
| Timeline on homepage | date, case-number, parties, topics for all cases |
| Case grid | date, case-number, parties, topics for all cases |
| Topic explorer | hardcoded mapping of categories → subtopics → cases |
| Browse by topic | curated markdown with wikilinks to cases |
| Sidebar file tree | all page slugs + titles |
| Reading time | word count of body text |
