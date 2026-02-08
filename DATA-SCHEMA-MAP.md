# GDPRed Data Schema Map

> Domain-focused mapping of every entity, field, relationship, and query in GDPRed.
> Written for someone designing a database backend to replace the flat-file Quartz system.

---

## Table of Contents

1. [Domain Overview](#1-domain-overview)
2. [Entity: Cases](#2-entity-cases)
3. [Entity: GDPR Articles](#3-entity-gdpr-articles)
4. [Entity: Topics](#4-entity-topics)
5. [Entity: Topic Taxonomy](#5-entity-topic-taxonomy)
6. [Entity: Operative Parts (structured rulings)](#6-entity-operative-parts)
7. [Entity: Per-Article Interpretations](#7-entity-per-article-interpretations)
8. [Entity: Pages (general content)](#8-entity-pages)
9. [Relationship Map](#9-relationship-map)
10. [All Queries the UI Actually Runs](#10-all-queries-the-ui-actually-runs)
11. [Data Ingestion Pipeline](#11-data-ingestion-pipeline)
12. [Full-Text Search and Graph Data](#12-full-text-search-and-graph-data)
13. [Suggested Database Schema](#13-suggested-database-schema)
14. [Appendix: Quartz Build-Time Computed Fields](#appendix-quartz-build-time-computed-fields)
15. [Appendix: Data Flow Diagram](#appendix-data-flow-diagram)

---

## 1. Domain Overview

GDPRed is a legal research tool for EU GDPR case law. It has three core domain entities and several junction/child entities:

| Entity | What it is | Count | Example |
|--------|-----------|-------|---------|
| **Case** | A CJEU court judgment interpreting the GDPR | ~99 | C-492/23 |
| **GDPR Article** | One of the 99 articles of Regulation 2016/679 | 99 | Article 17 (Right to erasure) |
| **Topic** | A legal concept/subject that a case addresses | ~200 unique | "Purpose limitation", "Door-to-door preaching" |
| **Topic Category** | A curated grouping of topics for browsing | 14 | "Data subject rights" |
| **Operative Part** | A numbered paragraph of the court's ruling | 1-5 per case | "**1.** Article 17 must be interpreted..." |
| **Per-Article Interpretation** | What a case says about a specific article | 1-10 per case | "Article 5 \| Storage limitation requires..." |
| **Page** | Non-case/non-article content (index, browse pages) | ~10 | Welcome page, Browse by topic |
| **Link** | A directional reference between any two pages | ~500+ | Case C-60/22 links to Article 17 |

The central relationship is **Cases interpret Articles**. Everything else serves navigation and discovery around that core.

---

## 2. Entity: Cases

**Current storage:** `content/Case law/*.md` (one file per case, YAML frontmatter + markdown body)

### Fields

| Field | Type | Nullable | Example Value | Origin | What it represents |
|-------|------|----------|---------------|--------|--------------------|
| `case-number` | string | No | `C-492/23` | SPARQL `caseNumber` field | Official ECJEU case reference number. Format: `C-{number}/{year}` |
| `title` | string | No | `C-492/23` | Defaults to `case-number` | Display title, usually identical to case-number |
| `date` | date | No | `2023-06-15` | SPARQL `caseDate` | Date of the court's judgment (not filing date) |
| `parties` | string | No | `Digi Távközlési és Szolgáltató Kft. v Nemzeti Adatvédelmi és Információszabadság Hatóság` | SPARQL `caseParties` | Plaintiff v Defendant, often with long institutional names |
| `topics` | string[] | No | `["Purpose limitation", "Storage limitation", "Data breach", "Database management"]` | EUR-Lex HTML `C71Indicateur` element | 3-9 legal concepts the case addresses. Highly variable specificity (see below) |
| `final-ruling` | text | Yes | `**1.** Article 3(2) of Directive 95/46/EC... must be interpreted as meaning that...` `**2.** Article 2(c)...` | EUR-Lex HTML between classes `C41DispositifIntroduction` and `C77Signatures` | The court's actual judgment, numbered paragraphs with bold numbering |
| `ruling-articles` | string[] | No | `["Article 2", "Article 4", "Article 5", "Article 12", "Article 17"]` | Merged: SPARQL `modifiedLocations` + regex `Article (\d+)` on ruling text | GDPR articles this case interprets. This is **the primary cross-reference** |
| `per-article` | string[] | Yes | `["Article 5 \| Interpretation from final ruling related to Article 5", "Article 6 \| Interpretation from..."]` | `generate-frontmatter.js` maps ruling paragraphs to articles | Pipe-delimited pairs: `Article N \| ruling excerpt`. See entity 7 |
| `aliases` | string[] | Yes | `["C-17/22"]` | Manual entry for joined/related cases | Alternative case numbers that should redirect to this page |
| `celex-id` | string | Yes | `62023CJ0492` | `apply_json_frontmatter.js` from JSON | EUR-Lex CELEX identifier for linking back to source |
| `gdpr-summary` | string | Yes | (prose summary) | `apply_json_frontmatter.js` from JSON | Human-readable summary of GDPR implications |
| `operative_parts_structured` | object[] | Yes | (see entity 6) | `apply_json_frontmatter.js` from JSON | Structured breakdown of ruling paragraphs |
| `body` | text (markdown) | No | Full court judgment (~300 lines, starting with `JUDGMENT OF THE COURT...`) | EUR-Lex HTML converted via Turndown | Complete ruling text: header, procedural history, legal analysis, ruling |

### About the `topics` field — real examples showing variability

```yaml
# Case C-25/17 — 8 topics, mix of broad and narrow:
topics:
  - Protection of personal data
  - Processing of personal data
  - Religious community activities
  - Door-to-door preaching
  - Filing system
  - Data controller responsibilities
  - Scope of data protection directive
  - Joint controllership

# Case C-77/21 — 4 topics, more focused:
topics:
  - Purpose limitation
  - Storage limitation
  - Data breach
  - Database management

# Case C-422/24 — 6 topics, one very long:
topics:
  - Protection of personal data
  - Regulation (EU) 2016/679
  - "Articles 13 and 14"
  - Scope
  - Personal data collected by means of body cameras worn by ticket inspectors on public transport
  - Legal basis for the obligation on the data controller to provide information to the data subject
```

Topics are free-text with no controlled vocabulary. The same concept appears differently across cases (e.g. "Protection of personal data" vs "Protection of natural persons with regard to the processing of personal data"). Range: 3-9 per case.

### About the `date` field — format inconsistency

The date field has three formats in existing data:
- `2018-07-10` (plain date)
- `2022-10-20T00:00:00.000Z` (ISO with time)
- `'2025-12-18'` (quoted string)

All represent the judgment date. A database should normalize to a DATE column.

---

## 3. Entity: GDPR Articles

**Current storage:** `content/Articles/Article N.md` (one file per article)

### Fields

| Field | Type | Nullable | Example Value | What it represents |
|-------|------|----------|---------------|--------------------|
| `article_number` | integer | No | `17` | The article number (1-99) of Regulation (EU) 2016/679 |
| `title` | string | No | `Article 17` | Display title |
| `subtitle` | string | No | `Right to erasure ('right to be forgotten')` | Human-readable name of the article's subject |
| `body` | text (markdown) | No | `## Right to erasure...\n\n1. The data subject shall have the right...` | The full regulatory text with numbered paragraphs and lettered sub-items |

### Example body content (Article 5)

```markdown
## Principles relating to processing of personal data

1. Personal data shall be:

(a) processed lawfully, fairly and in a transparent manner...
    ('lawfulness, fairness and transparency');

(b) collected for specified, explicit and legitimate purposes...
    ('purpose limitation');

(c) adequate, relevant and limited to what is necessary...
    ('data minimisation');

2. The controller shall be responsible for, and be able to demonstrate
   compliance with, paragraph 1 ('accountability').
```

Article pages are **reference documents** — their content is static regulatory text. The dynamic part is the reverse-lookup: "which cases interpret this article?"

---

## 4. Entity: Topics

Topics are free-text labels attached to cases. They are **not** the same as the curated topic taxonomy (section 5).

**Current storage:** YAML array in each case's frontmatter (`topics:`)

### Fields

| Field | Type | Nullable | Example Value |
|-------|------|----------|---------------|
| `topic_text` | string | No | `Purpose limitation` |

There are roughly **200 unique topic strings** across all cases. Many are near-duplicates. They come directly from the court's own tagging (the `C71Indicateur` HTML element).

In a database, these would be a separate table with a many-to-many junction to cases:

```
cases ←→ case_topics ←→ topics
```

---

## 5. Entity: Topic Taxonomy

The "Browse by topic" page contains a **manually curated** 14-category taxonomy mapping topics to cases. This is separate from the `topics` frontmatter array.

**Current storage:** Two places:
1. `content/Browse by topic.md` — markdown with wikilinks (the authoritative source)
2. `quartz/components/pages/TopicExplorer.tsx` — hardcoded subset (3 categories, 11 subtopics, 25 cases)

### The 14 categories (from Browse by topic.md)

| # | Category | Example subtopics | Cases referenced |
|---|----------|--------------------|-----------------|
| 1 | Definitions and scope | Definition of 'personal data', Concept of 'controller' | C-579-21, C-487-21, C-231-22, C-272-19, C-807-21, C-461-22, C-60-22, C-659-22 |
| 2 | Principles of processing | General principles, Purpose limitation, Data minimisation, Storage limitation | C-340-21, C-60-22, C-205-21, C-394-23, C-446-21, C-77-21 |
| 3 | Lawfulness of processing | Conditions, Consent, Legitimate interests | C-175-20, C-205-21, C-306-21, C-34-21, C-394-23, C-60-22, C-621-22, C-180-21, C-667-21, C-673-17, C-61-19, C-129-21, C-604-22 |
| 4 | Controllers, joint controllers, processors | Controllership, Joint control, Subsequent processing | C-60-22, C-461-22, C-604-22, C-683-21, C-231-22, C-180-21 |
| 5 | Data subject rights | Access, Erasure, Object, Restriction | C-272-19, C-307-22, C-487-21, C-757-22, C-169-23, C-579-21, C-461-22, C-245-20, C-394-23, C-60-22, C-129-21, C-200-23, C-231-22 |
| 6 | Controller obligations | Transparency, Records, Security, DPO, Liability | C-757-22, C-60-22, C-340-21, C-687-21, C-453-21, C-741-21 |
| 7 | Data breaches | Breach management, Security measures | C-77-21, C-340-21, C-687-21 |
| 8 | Special categories of data | Biometric, Health, Criminal | C-205-21, C-21-23, C-667-21, C-446-21, C-439-19, C-394-23 |
| 9 | Specific processing contexts | Employment, Medical, Credit agencies, Online | C-65-23, C-34-21, C-667-21, C-307-22, C-61-19, C-496-17, C-634-21, C-659-22, C-579-21, C-60-22, C-394-23, C-456-22, C-740-22, C-817-19, C-446-21, C-621-22, C-306-21 |
| 10 | Cross-border data transfers | Third countries, Standard clauses, One-stop shop | C-311-18, C-645-19 |
| 11 | Supervisory authorities | Competence, Discretion, Fines, Complaints | C-33-22, C-169-23, C-245-20, C-807-21, C-768-21, C-416-23, C-683-21, C-590-22 |
| 12 | Remedies, liability, compensation | Right to compensation, Damage concept, Non-material damage | C-300-21, C-340-21, C-456-22, C-507-23, C-667-21, C-687-21, C-741-21, C-590-22, C-200-23, C-132-21, C-21-23, C-757-22 |
| 13 | Procedural and jurisdictional | TFEU, Primacy of EU law, Proportionality | C-439-19, C-272-19, C-579-21, C-132-21, C-507-23, C-300-21, C-687-21, C-645-19, C-175-20, C-461-22, C-205-21, C-180-21 |
| 14 | Interaction with other frameworks | Consumer protection, Competition, COVID, National security | C-21-23, C-319-20, C-757-22, C-252-21, C-129-21, C-169-23, C-659-22, C-184-20, C-33-22, C-817-19 |

### Structure

This is a three-level hierarchy:
```
Topic Category (14)
  └── Topic Subtopic (~60 distinct subtopics)
        └── Case references (many-to-many)
```

The TopicExplorer component has a **hardcoded subset** of only 3 categories with 25 cases mapped by slug:

```typescript
// From TopicExplorer.tsx — entirely hardcoded, not driven by data
"Data processing principles": {
    "Lawfulness of processing": caseFiles.filter(f =>
        f.slug?.includes("C-175-20") || f.slug?.includes("C-205-21") || ...
    ),
    "Data minimization": caseFiles.filter(f => ...),
    ...
},
"Controllers and processors": { ... },
"Data subject rights": { ... }
```

In a database, this mapping should be a proper data structure, not hardcoded.

---

## 6. Entity: Operative Parts

Optional structured breakdown of the ruling's numbered paragraphs, enriched from external JSON.

**Current storage:** YAML object array in case frontmatter (`operative_parts_structured:`)
**Origin:** `apply_json_frontmatter.js` reads from `case-metadata.json`

### Fields

| Field | Type | Nullable | Example |
|-------|------|----------|---------|
| `case_number` | string (FK) | No | `C-492/23` |
| `number` | integer | No | `1` |
| `verbatim` | text | No | The exact text from the court ruling |
| `simplified` | text | Yes | A simplified/summarized version |
| `interprets_articles` | integer[] | Yes | `[4, 5, 12]` — which GDPR article numbers this part interprets |
| `mentions_regulations` | string[] | Yes | `["Regulation (EU) 2016/679", "Directive 95/46/EC"]` |

**Not currently consumed by any UI component** — this is stored metadata for potential future use.

---

## 7. Entity: Per-Article Interpretations

What a specific case says about a specific article, extracted from the ruling text.

**Current storage:** YAML string array in case frontmatter (`per-article:`)

### Raw format

```yaml
per-article:
  - "Article 2(c) | Article 2(c) of Directive 95/46 must be interpreted as meaning that
     the concept of a 'filing system'... covers a set of personal data collected in the
     course of door-to-door preaching..."
  - "Article 2(d) | Article 2(d) of Directive 95/46, read in the light of Article 10(1)
     of the Charter... must be interpreted as meaning that..."
```

### Normalized fields

| Field | Type | Example |
|-------|------|---------|
| `case_number` | string (FK) | `C-25/17` |
| `article_reference` | string | `Article 2(c)` — note: includes sub-paragraph |
| `interpretation_text` | text | `Article 2(c) of Directive 95/46 must be interpreted as meaning that the concept of a 'filing system'...` |

This is a **junction entity** between Cases and Articles, carrying the interpretation as payload. Note that `article_reference` can include sub-paragraphs (`Article 2(c)`) not just article numbers.

---

## 8. Entity: Pages (general content)

Non-case, non-article pages for navigation and presentation.

**Current storage:** `content/*.md` and `content/` subdirectory index files

### Fields

| Field | Type | Nullable | Example |
|-------|------|----------|---------|
| `slug` | string | No | `index`, `Browse-by-topic`, `case-law-grid` |
| `title` | string | No | `Welcome!`, `Browse by topic`, `Case Law Overview` |
| `subtitle` | string | Yes | Descriptive subtitle |
| `tags` | string[] | Yes | `["hidden"]` — used to exclude from listings |
| `cssclasses` | string[] | Yes | `["no-date", "no-title"]` — presentation hints |
| `body` | text (markdown/HTML) | No | Page content, may include embedded HTML (timeline, grid) |

### Known pages and their purpose

| Page | Purpose | Data it embeds |
|------|---------|---------------|
| `index.md` | Homepage with FAQ, timeline visualization | Timeline HTML generated from all cases |
| `Browse by topic.md` | The 14-category topic taxonomy | Wikilinks to cases organized by topic |
| `case-law-grid.md` | Card grid of all cases | Generated HTML cards with case-number, parties, date, topics |
| `Case law by CJEU-topics.md` | Raw court topics listing | Reference for the court's own tagging |
| `cases_by_article.md` | Cross-reference: per case, its articles | Generated by `extract_case_articles.cjs` |
| `articles_by_case.md` | Cross-reference: per article, its cases | Generated by `extract_case_articles.cjs` |

---

## 9. Relationship Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DOMAIN RELATIONSHIPS                          │
│                                                                        │
│  ┌──────────┐                                       ┌──────────────┐  │
│  │  Cases    │──────── ruling_articles (M:N) ───────│ GDPR Articles│  │
│  │          │         (the core relationship)       │              │  │
│  │ C-492/23 │                                       │ Article 17   │  │
│  │ C-77/21  │──┐                                    │ Article 5    │  │
│  │ C-25/17  │  │                                    │ ...          │  │
│  └─────┬────┘  │                                    └──────────────┘  │
│        │       │                                                      │
│        │       │  per_article_interpretations (1:N from case)         │
│        │       └──── "Article 5 | Storage limitation requires..."     │
│        │             "Article 6 | Interpretation from ruling..."      │
│        │                                                              │
│        │       ┌──────────────────┐                                   │
│        ├───────│  Topics (M:N)    │  Free-text, from court tagging    │
│        │       │ "Purpose limit." │                                   │
│        │       │ "Data breach"    │                                   │
│        │       └──────────────────┘                                   │
│        │                                                              │
│        │       ┌──────────────────────────────┐                       │
│        ├───────│  Operative Parts (1:N)       │  Structured ruling    │
│        │       │ { number: 1, verbatim: "..." │  paragraphs           │
│        │       │   simplified: "...",         │  (from JSON enrichment│
│        │       │   interprets_articles: [4,5] │   optional)           │
│        │       │ }                            │                       │
│        │       └──────────────────────────────┘                       │
│        │                                                              │
│        │       ┌──────────────────────────────┐                       │
│        └───────│  Links (directed, M:N)       │  Wikilinks in body    │
│                │ C-60/22 → Article 17         │  text. Used for       │
│                │ C-60/22 → C-231/22           │  backlinks + graph    │
│                │ Article 17 → C-129/21        │                       │
│                └──────────────────────────────┘                       │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Topic Taxonomy (curated, separate from topics)                  │ │
│  │                                                                  │ │
│  │  Category ──────────── Subtopic ──────────── Cases               │ │
│  │  "Data subject rights"  "Right to erasure"   C-129-21, C-200-23 │ │
│  │  "Data subject rights"  "Right of access"    C-307-22, C-487-21 │ │
│  │  "Remedies, liability"  "Compensation"       C-300-21, C-507-23 │ │
│  │  (14 categories)        (~60 subtopics)      (~80 case refs)    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Summary of relationships

| Relationship | Type | From | To | Payload | How it's stored now |
|-------------|------|------|----|---------|---------------------|
| Case interprets Article | Many-to-many | Case | Article | -- | `ruling-articles` array in case frontmatter |
| Case has Topic | Many-to-many | Case | Topic | -- | `topics` array in case frontmatter |
| Case has Operative Part | One-to-many | Case | Operative Part | number, verbatim, simplified, interprets_articles, mentions_regulations | `operative_parts_structured` in frontmatter |
| Case has Per-Article Interpretation | One-to-many | Case | Interpretation | article_ref, text | `per-article` array (pipe-delimited strings) |
| Case aliases Case | One-to-many | Case | Alias slug | -- | `aliases` array in frontmatter |
| Page links to Page | Many-to-many (directed) | Any page | Any page | -- | `[[wikilinks]]` in body text, extracted to `links[]` at build time |
| Taxonomy Category has Subtopic | One-to-many | Category | Subtopic | -- | Markdown headings and bullet points in `Browse by topic.md` |
| Taxonomy Subtopic references Case | Many-to-many | Subtopic | Case | -- | Wikilinks in `Browse by topic.md` + hardcoded slugs in `TopicExplorer.tsx` |

---

## 10. All Queries the UI Actually Runs

These are the data lookups the components perform. In a database system, each becomes a SQL query or API endpoint.

### Query 1: "Which cases cite this article?" (ArticleCases.tsx)

**Triggered on:** Every Article page (e.g. `/Articles/Article-17`)

```
Current implementation:
  1. Extract article number from current page slug via regex /article[- ](\d+)/i
  2. Filter ALL case files where ruling-articles[] contains "Article {N}"
  3. Sort by date descending
  4. Return: title, date, parties for each match

SQL equivalent:
  SELECT c.case_number, c.title, c.date, c.parties
  FROM cases c
  JOIN case_ruling_articles cra ON c.id = cra.case_id
  JOIN articles a ON a.id = cra.article_id
  WHERE a.article_number = ?
  ORDER BY c.date DESC
```

### Query 2: "What articles does this case interpret?" (NowReading.tsx)

**Triggered on:** Every Case page

```
Current implementation:
  1. Read ruling-articles[] from current page's frontmatter
  2. Parse each entry with regex /Article\s+(\d+)/
  3. Generate link to /Articles/Article-{N}

SQL equivalent:
  SELECT a.article_number, a.title, a.subtitle
  FROM articles a
  JOIN case_ruling_articles cra ON a.id = cra.article_id
  WHERE cra.case_id = ?
  ORDER BY a.article_number
```

### Query 3: "Who are the parties in this case?" (Parties.tsx)

**Triggered on:** Every Case page

```
Current implementation:
  Read frontmatter.parties from current page

SQL equivalent:
  SELECT parties FROM cases WHERE id = ?
```

### Query 4: "What pages link to this page?" (Backlinks.tsx)

**Triggered on:** Every page

```
Current implementation:
  Filter ALL files where their links[] array includes current page's slug
  Return: title, parties (if case), subtitle (if article)

SQL equivalent:
  SELECT p.slug, p.title, c.parties, a.subtitle
  FROM page_links pl
  JOIN pages p ON p.id = pl.source_page_id
  LEFT JOIN cases c ON c.page_id = p.id
  LEFT JOIN articles a ON a.page_id = p.id
  WHERE pl.target_page_id = ?
```

### Query 5: "List all cases in a topic category" (TopicExplorer.tsx)

**Triggered on:** Topic explorer page

```
Current implementation:
  HARDCODED slug matches per topic per category (25 cases across 11 subtopics)

SQL equivalent:
  SELECT tc.category_name, ts.subtopic_name, c.case_number, c.title
  FROM taxonomy_case_refs tcr
  JOIN taxonomy_subtopics ts ON ts.id = tcr.subtopic_id
  JOIN taxonomy_categories tc ON tc.id = ts.category_id
  JOIN cases c ON c.case_number = tcr.case_number
  ORDER BY tc.sort_order, ts.sort_order, c.case_number
```

### Query 6: "List recent pages sorted by date" (RecentNotes.tsx, PageList.tsx)

**Triggered on:** Homepage and folder pages

```
Current implementation:
  Sort allFiles by date desc, then alphabetically
  Apply optional tag filter, slice to limit (default 3)

SQL equivalent:
  SELECT title, date, slug FROM pages
  WHERE tags NOT LIKE '%hidden%'  -- optional filter
  ORDER BY date DESC NULLS LAST, title ASC
  LIMIT ?
```

### Query 7: "Get the file tree" (Explorer.tsx)

**Triggered on:** Every page (sidebar)

```
Current implementation:
  Build tree from all file slugs (split on /)
  Each node: title from frontmatter, parties as subtitle

SQL equivalent:
  SELECT slug, title,
    CASE WHEN page_type = 'case' THEN parties ELSE subtitle END as subtitle
  FROM pages
  ORDER BY slug
```

### Query 8: "Full-text search" (Search.tsx, client-side)

**Triggered on:** User search input

```
Current implementation:
  FlexSearch over contentIndex.json
  Indexes: title, content (plain text), tags
  Returns: slug + title for top 8 matches

SQL equivalent:
  SELECT slug, title,
    ts_rank(search_vector, plainto_tsquery(?)) as rank
  FROM pages
  WHERE search_vector @@ plainto_tsquery(?)
  ORDER BY rank DESC
  LIMIT 8
```

### Query 9: "Build the link graph" (Graph.tsx, client-side)

**Triggered on:** Every page (graph panel)

```
Current implementation:
  All nodes from contentIndex.json
  Edges from ContentDetails.links[]
  BFS from current page to depth N

SQL equivalent:
  -- Nodes:
  SELECT slug, title FROM pages

  -- Edges:
  SELECT source_slug, target_slug FROM page_links

  -- Neighborhood (recursive CTE):
  WITH RECURSIVE neighborhood AS (
    SELECT target_slug, 1 as depth FROM page_links WHERE source_slug = ?
    UNION
    SELECT pl.target_slug, n.depth + 1
    FROM page_links pl JOIN neighborhood n ON pl.source_slug = n.target_slug
    WHERE n.depth < ?
  )
  SELECT DISTINCT * FROM neighborhood
```

### Query 10: "Get pages by tag" (TagContent.tsx)

```
Current implementation:
  Filter allFiles where frontmatter.tags includes requested tag
  Only ~5 pages actually use tags (index pages with tag "hidden")

SQL equivalent:
  SELECT p.slug, p.title, p.date
  FROM pages p
  JOIN page_tags pt ON p.id = pt.page_id
  JOIN tags t ON t.id = pt.tag_id
  WHERE t.slug = ?
```

### Query 11: "Timeline data" (generated into index.md)

```
Current implementation:
  generate-timeline.js reads all case .md files
  Groups by month+year, sorts desc

SQL equivalent:
  SELECT case_number, date, parties, topics,
    TO_CHAR(date, 'Month') as month, EXTRACT(YEAR FROM date) as year
  FROM cases
  WHERE date IS NOT NULL AND parties IS NOT NULL
  ORDER BY date DESC
```

### Query 12: "Case grid data" (generated into case-law-grid.md)

```
Current implementation:
  generate-case-grid.js reads all case .md files

SQL equivalent:
  SELECT case_number, date, parties,
    array_agg(t.topic_text) as topics
  FROM cases c
  LEFT JOIN case_topics ct ON c.id = ct.case_id
  LEFT JOIN topics t ON t.id = ct.topic_id
  WHERE c.date IS NOT NULL AND c.parties IS NOT NULL
  GROUP BY c.id
  ORDER BY c.date DESC
```

---

## 11. Data Ingestion Pipeline

How data enters the system, step by step.

### Step 1: Discover new cases

| Property | Value |
|----------|-------|
| **Script** | `scripts/pipeline/sparql-discover.js` |
| **Source** | `https://publications.europa.eu/webapi/rdf/sparql` |
| **Query target** | CELEX `32016R0679` (GDPR) cases from Court of Justice |

**SPARQL fields returned:**

| Field | Type | Example | Maps to |
|-------|------|---------|---------|
| `caseCelex` | string | `62023CJ0492` | `celex-id` (via JSON enrichment) |
| `caseNumber` | string | `Case C-492/23` | `case-number` (stripped of "Case "), `title` |
| `caseDate` | string | `2023-06-15` | `date` |
| `caseParties` | string | `Company v Authority` | `parties` |
| `modifiedLocations` | string | `A04P4, A05P2, A24` | `ruling-articles` (parsed: `A04` → `Article 4`) |
| `caseTitle` | string | Full title | Pipeline logs only |
| `caseShortTitle` | string | Short title | Pipeline logs only |

**Filtering:**
- Skips pending cases (CELEX containing `CN` instead of `CJ`)
- Skips joined cases (caseNumber containing `and` or multiple comma-separated C-numbers)
- Skips cases already present as files in `content/Case law/`
- Deduplicates by CELEX ID

**Output:** `scripts/pipeline/new-cases.json`

### Step 2: Download HTML

| Property | Value |
|----------|-------|
| **Script** | `scripts/pipeline/fetch-html.js` |
| **URL pattern** | `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:{caseCelex}` |
| **Rate limit** | 2s between requests |
| **Output** | `scripts/pipeline/downloaded/{caseCelex}.html` |

### Step 3: Extract frontmatter from HTML

| Property | Value |
|----------|-------|
| **Script** | `scripts/pipeline/generate-frontmatter.js` |
| **Input** | Case data object + raw HTML |

**Extraction logic by field:**

| Field | HTML selector / pattern | Transformation |
|-------|------------------------|----------------|
| `final-ruling` | Text between `C41DispositifIntroduction` and `C77Signatures` class elements | Paragraphs joined with `\n\n`, numbered points prefixed with `**N.**` |
| `topics` | `C71Indicateur` class paragraphs | Split on ` -- ` or ` – `, filter out "Reference for a preliminary ruling", trim |
| `ruling-articles` (from HTML) | Regex `\bArticle\s+(\d+)` on final-ruling text | Filter to 1-99, format as `Article N` |
| `ruling-articles` (from SPARQL) | `modifiedLocations` string `A04P4, A05P2` | Regex `A(\d+)` → `Article N` |
| `ruling-articles` (merged) | Union of HTML + SPARQL sources | Sort numerically, deduplicate |
| `per-article` | Match ruling paragraphs to article numbers | Format as `Article N \| ruling text` |

### Step 4: Convert HTML body to Markdown

| Property | Value |
|----------|-------|
| **Script** | `scripts/html-to-md.cjs` |
| **Library** | Turndown (ATX headings, fenced code blocks) |

**Post-processing:**
- Merges orphaned numbering lines (`1.` on its own line → joined with next line)
- Merges orphaned bullets (`*`, `•`, `–`, `—` alone on a line)
- Normalizes paragraph spacing to exactly `\n\n`

### Step 5: Assemble case file

| Property | Value |
|----------|-------|
| **Script** | `scripts/pipeline/assemble-case.js` |
| **Output** | `content/Case law/{case-number-with-dashes}.md` |

Combines: `---\n{YAML frontmatter}\n---\n\n{markdown body}`

### Step 6 (optional): Enrich from JSON

| Property | Value |
|----------|-------|
| **Script** | `scripts/apply_json_frontmatter.js` |
| **Input** | `case-metadata.json` |

**JSON → Frontmatter mapping:**

| JSON field | Frontmatter field | Transform |
|-----------|-------------------|-----------|
| `caseId` | `case-number` | Keep as-is (format: `Case C-1/17`) |
| `caseId` | `title` | Strip `Case ` prefix |
| `parties` | `parties` | Direct |
| `date` | `date` | Direct |
| `celexId` | `celex-id` | Direct |
| `summary` | `gdpr-summary` | Direct |
| `interpretedArticleNumbers` | `ruling-articles` | Map each number N → `Article N` |
| `operativePartsCombined` | `final-ruling` | Direct |
| `operativeParts[]` | `operative_parts_structured[]` | Map to `{number, verbatim, simplified, interprets_articles, mentions_regulations}` |

### Post-processing scripts

| Script | Purpose | I/O |
|--------|---------|-----|
| `extract_case_articles.cjs` | Build cross-reference indexes | Reads all case `.md` → writes `cases_by_article.md` + `articles_by_case.md` |
| `extract_article_rulings.js` | Index ruling text by article | Reads case `.md` → writes `article-rulings.md` |
| `process_article_refs.cjs` | Fix invalid article refs | Finds `[[Article N]]` where N>99, replaces with plain text |
| `generate-timeline.js` | Build timeline visualization | Reads case `.md` → injects HTML into `index.md` |
| `generate-case-grid.js` | Build case card grid | Reads case `.md` → writes `case-law-grid.md` |
| `check_frontmatter.js` | Validate frontmatter syntax | Reads all `.md`, reports errors, no file changes |

---

## 12. Full-Text Search and Graph Data

### Content Index (contentIndex.json)

At build time, Quartz emits a JSON file consumed by client-side search and graph.

| Field | Type | Source | Used for |
|-------|------|--------|----------|
| key (slug) | string | file path → slug | Page identity, graph node ID |
| `title` | string | `frontmatter.title` | Search index, graph node label |
| `links` | string[] | Wikilinks extracted from body | Graph edges, backlink resolution |
| `tags` | string[] | `frontmatter.tags` | Search tag filter, graph tag nodes |
| `content` | string | Full page text (HTML stripped) | Full-text search |

**Note:** `date` and `description` are computed during build but deliberately excluded from the JSON to reduce file size. They are only used for sitemap.xml and RSS feed generation.

### Search configuration

- Engine: FlexSearch (client-side)
- Tokenization: "forward" (prefix matching)
- Indexed fields: `title`, `content`, `tags`
- Max results: 8

### Graph configuration

- Rendering: D3.js force simulation
- Nodes: Every page in contentIndex
- Edges: Directed links from `links[]` array
- Neighborhood: BFS from current page, configurable depth
- Optional tag nodes: Creates synthetic `#tag` nodes

---

## 13. Suggested Database Schema

Based on the above analysis, here is a normalized relational schema capturing all GDPRed data:

```sql
-- Core entities
CREATE TABLE cases (
    id              SERIAL PRIMARY KEY,
    case_number     VARCHAR(20) NOT NULL UNIQUE,  -- "C-492/23"
    title           VARCHAR(100) NOT NULL,         -- Usually same as case_number
    date            DATE,                          -- Judgment date
    parties         TEXT,                          -- "Plaintiff v Defendant"
    final_ruling    TEXT,                          -- Numbered ruling paragraphs
    body_markdown   TEXT NOT NULL,                 -- Full ruling text
    body_plain_text TEXT,                          -- Stripped text for search
    celex_id        VARCHAR(20),                   -- "62023CJ0492"
    gdpr_summary    TEXT,                          -- Optional enrichment
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE articles (
    id              SERIAL PRIMARY KEY,
    article_number  INTEGER NOT NULL UNIQUE CHECK (article_number BETWEEN 1 AND 99),
    title           VARCHAR(50) NOT NULL,          -- "Article 17"
    subtitle        VARCHAR(200),                  -- "Right to erasure"
    body_markdown   TEXT NOT NULL,                 -- Regulatory text
    body_plain_text TEXT                           -- Stripped text for search
);

-- Many-to-many: Cases <-> Articles (the core relationship)
CREATE TABLE case_ruling_articles (
    case_id     INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    article_id  INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    PRIMARY KEY (case_id, article_id)
);

-- Free-text topics from court tagging
CREATE TABLE topics (
    id          SERIAL PRIMARY KEY,
    topic_text  VARCHAR(500) NOT NULL UNIQUE
);

CREATE TABLE case_topics (
    case_id     INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    topic_id    INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    sort_order  INTEGER,
    PRIMARY KEY (case_id, topic_id)
);

-- Per-article interpretations (what case X says about article Y)
CREATE TABLE per_article_interpretations (
    id                  SERIAL PRIMARY KEY,
    case_id             INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    article_reference   VARCHAR(50) NOT NULL,  -- "Article 2(c)" — may include sub-paragraph
    interpretation_text TEXT NOT NULL,
    sort_order          INTEGER
);

-- Structured operative parts (from JSON enrichment)
CREATE TABLE operative_parts (
    id                  SERIAL PRIMARY KEY,
    case_id             INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    part_number         INTEGER NOT NULL,
    verbatim_text       TEXT NOT NULL,
    simplified_text     TEXT,
    interprets_articles INTEGER[],     -- Article numbers
    mentions_regulations TEXT[]        -- Regulation names
);

-- Curated topic taxonomy (the 14-category browsing structure)
CREATE TABLE taxonomy_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    sort_order  INTEGER NOT NULL
);

CREATE TABLE taxonomy_subtopics (
    id          SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES taxonomy_categories(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    sort_order  INTEGER NOT NULL
);

CREATE TABLE taxonomy_case_refs (
    subtopic_id INTEGER REFERENCES taxonomy_subtopics(id) ON DELETE CASCADE,
    case_id     INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    PRIMARY KEY (subtopic_id, case_id)
);

-- General pages (non-case, non-article content)
CREATE TABLE pages (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(200) NOT NULL UNIQUE,
    title           VARCHAR(200) NOT NULL,
    subtitle        VARCHAR(200),
    body_markdown   TEXT,
    body_plain_text TEXT,
    page_type       VARCHAR(20) NOT NULL CHECK (page_type IN ('case', 'article', 'page')),
    -- FK to specific type (nullable)
    case_id         INTEGER REFERENCES cases(id),
    article_id      INTEGER REFERENCES articles(id),
    -- Presentation
    css_classes     TEXT[],
    is_draft        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP,
    modified_at     TIMESTAMP
);

-- Tags (very lightly used: only ~5 pages have tags)
CREATE TABLE tags (
    id      SERIAL PRIMARY KEY,
    slug    VARCHAR(100) NOT NULL UNIQUE,
    name    VARCHAR(100) NOT NULL
);

CREATE TABLE page_tags (
    page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    tag_id  INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (page_id, tag_id)
);

-- Directed links between pages (for backlinks + graph)
CREATE TABLE page_links (
    source_page_id  INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id  INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    PRIMARY KEY (source_page_id, target_page_id)
);

-- Aliases/redirects
CREATE TABLE case_aliases (
    id          SERIAL PRIMARY KEY,
    case_id     INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    alias_slug  VARCHAR(200) NOT NULL UNIQUE
);

-- Full-text search (PostgreSQL-specific)
ALTER TABLE pages ADD COLUMN search_vector tsvector;
CREATE INDEX pages_search_idx ON pages USING gin(search_vector);

-- Update search vector trigger
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        coalesce(NEW.title, '') || ' ' ||
        coalesce(NEW.body_plain_text, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Key design decisions

1. **`pages` as a unified table** with `page_type` discriminator — allows link graph to work uniformly across all content types while `case_id`/`article_id` FKs provide type-specific access.

2. **Topics vs. Taxonomy** are deliberately separate — `topics` is the raw court tagging (messy, uncontrolled), `taxonomy_*` is the curated browse structure (14 categories, ~60 subtopics).

3. **`per_article_interpretations`** uses `article_reference` as a string (not FK) because it includes sub-paragraphs like `Article 2(c)` that don't map 1:1 to the `articles` table.

4. **`page_links`** replaces the wikilink/backlink system — at ingest time, parse `[[wikilinks]]` from body text and insert directional edges.

---

## Appendix: Quartz Build-Time Computed Fields

These fields don't exist in the source data but are computed during the Quartz build. A database backend would compute them differently.

| Field | Currently computed by | What to do instead |
|-------|----------------------|--------------------|
| `slug` | File path → slug conversion | Use `pages.slug` column |
| `links[]` | OFM + CrawlLinks transformers parse wikilinks from body | Parse at ingest time, store in `page_links` table |
| `description` | First N chars of plain text | Compute at ingest or use `LEFT(body_plain_text, 200)` |
| `text` (plain) | HTML stripping of rendered content | Strip markdown at ingest, store as `body_plain_text` |
| `toc` | Heading extraction from AST | Parse headings from markdown at render time or ingest |
| `dates.created/modified` | Git history, filesystem, frontmatter | Store as columns, update via triggers |
| `reading_time` | Word count of `text` field | `length(body_plain_text) / 5 / 200` (words/wpm) |

---

## Appendix: Data Flow Diagram

```
    EXTERNAL SOURCES                    DATABASE
    ================                    ========

    SPARQL ──────────┐
    (discover cases) │
                     ├──► Ingest ──► cases table
    EUR-Lex HTML ────┤    Script      case_ruling_articles
    (ruling text)    │                case_topics
                     │                per_article_interpretations
    JSON metadata ───┘                operative_parts
    (enrichment)                      page_links (parsed from body)
                                      pages (unified, type='case')

    Manual content ──────► Import ──► articles table
    (Article .md files)    Script     pages (type='article')

    Browse by topic.md ──► Parse ───► taxonomy_categories
    (curated taxonomy)     Script     taxonomy_subtopics
                                      taxonomy_case_refs

                                         │
                                         ▼
                                    ┌─────────┐
                                    │   API    │
                                    │  Layer   │
                                    └────┬────┘
                                         │
                     ┌───────────────────┼──────────────────────┐
                     │                   │                      │
                     ▼                   ▼                      ▼
              Case pages          Article pages          Browse/Search
              - parties           - subtitle             - taxonomy tree
              - ruling chips      - case list            - full-text search
              - topics            - backlinks            - link graph
              - body                                     - timeline
              - backlinks                                - case grid
```
