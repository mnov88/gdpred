# GDPRed Data Schema Map

> Complete mapping of every data field, its origin, processing, and usage.
> Use this as the definitive reference for recreating the GDPRed pipeline without Quartz.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [External Data Sources](#2-external-data-sources)
3. [Content Entities](#3-content-entities)
4. [Table A: Case Law Frontmatter Fields](#table-a-case-law-frontmatter-fields)
5. [Table B: Article Frontmatter Fields](#table-b-article-frontmatter-fields)
6. [Table C: General/Index Page Frontmatter Fields](#table-c-generalindex-page-frontmatter-fields)
7. [Table D: Quartz-Internal VFile Data (QuartzPluginData)](#table-d-quartz-internal-vfile-data-quartzplugindata)
8. [Table E: Global Configuration Fields](#table-e-global-configuration-fields)
9. [Table F: Content Index (Search/Graph Payload)](#table-f-content-index-searchgraph-payload)
10. [Table G: Pipeline Script I/O](#table-g-pipeline-script-io)
11. [Table H: Component Data Consumption](#table-h-component-data-consumption)
12. [Table I: Frontmatter Alias Resolution](#table-i-frontmatter-alias-resolution)
13. [Table J: Output Artifacts](#table-j-output-artifacts)
14. [Data Flow Diagram](#data-flow-diagram)
15. [Cross-Reference Systems](#cross-reference-systems)

---

## 1. Architecture Overview

GDPRed is a GDPR case-law knowledge base. Data flows through four phases:

```
Phase 1: DISCOVERY     SPARQL endpoint -> new-cases.json
Phase 2: DOWNLOAD      EUR-Lex HTML -> downloaded/*.html
Phase 3: ASSEMBLY      HTML -> Markdown + YAML frontmatter -> content/Case law/*.md
Phase 4: BUILD         Quartz pipeline: Parse -> Transform -> Filter -> Emit -> Static site
```

### Key Source Files

| Concern | File(s) |
|---------|---------|
| Pipeline orchestrator | `scripts/pipeline/run-pipeline.js` |
| Case discovery | `scripts/pipeline/sparql-discover.js` |
| HTML download | `scripts/pipeline/fetch-html.js` |
| Case assembly | `scripts/pipeline/assemble-case.js` |
| Frontmatter generation | `scripts/pipeline/generate-frontmatter.js` |
| HTML-to-Markdown | `scripts/html-to-md.cjs` |
| VFile data types | `quartz/plugins/vfile.ts` |
| Frontmatter parser | `quartz/plugins/transformers/frontmatter.ts` |
| Link processing | `quartz/plugins/transformers/links.ts` |
| Date processing | `quartz/plugins/transformers/lastmod.ts` |
| TOC generation | `quartz/plugins/transformers/toc.ts` |
| OFM (wikilinks) | `quartz/plugins/transformers/ofm.ts` |
| Description extraction | `quartz/plugins/transformers/description.ts` |
| Content index emitter | `quartz/plugins/emitters/contentIndex.ts` |
| Global config types | `quartz/cfg.ts` |
| Plugin types | `quartz/plugins/types.ts` |
| Component types | `quartz/components/types.ts` |
| Build orchestration | `quartz/build.ts` |

---

## 2. External Data Sources

### 2a. SPARQL Publications Office

| Property | Value |
|----------|-------|
| **Endpoint** | `https://publications.europa.eu/webapi/rdf/sparql` |
| **Target regulation** | Regulation (EU) 2016/679 (GDPR) |
| **Script** | `scripts/pipeline/sparql-discover.js` |

**Fields returned per case:**

| SPARQL Field | Type | Description | Maps to Frontmatter |
|-------------|------|-------------|---------------------|
| `caseCelex` | string | CELEX identifier (e.g. `62023CJ0492`) | `celex-id` (via JSON apply) |
| `caseNumber` | string | Court case number (e.g. `Case C-492/23`) | `case-number`, `title` |
| `caseDate` | string | Judgment date (ISO) | `date` |
| `caseParties` | string | Parties involved | `parties` |
| `caseShortTitle` | string | Short case title | _(used in pipeline logs)_ |
| `caseTitle` | string | Full case title | _(used in pipeline logs)_ |
| `modifiedLocations` | string | Article references (e.g. `A04P4, A05P2`) | `ruling-articles` (parsed) |

**Filtering logic:**
- Excludes non-CJ cases (pending cases marked "CN")
- Excludes joined cases (flagged for manual review)
- Deduplicates by CELEX ID
- Only returns cases not already in `content/Case law/`

### 2b. EUR-Lex HTML Documents

| Property | Value |
|----------|-------|
| **URL pattern** | `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:{caseCelex}` |
| **Script** | `scripts/pipeline/fetch-html.js` |
| **Rate limit** | 2 seconds between requests |
| **Retry** | 3 attempts, exponential backoff (2s -> 4s -> 8s) |
| **User-Agent** | `GDPRed-Pipeline/1.0` |
| **Output** | `scripts/pipeline/downloaded/{caseCelex}.html` |

**Data extracted from HTML** (by `generate-frontmatter.js`):

| HTML Structure | CSS Class / Pattern | Extracted As |
|---------------|-------------------|-------------|
| Final ruling text | Between `C41DispositifIntroduction` and `C77Signatures` | `final-ruling` |
| Topic indicators | `C71Indicateur` paragraph, split on `--` / `--` | `topics` array |
| Article references | `Article N` patterns (N = 1-99) in ruling text | `ruling-articles` array |
| Per-article rulings | Ruling paragraphs matched to article numbers | `per-article` array |
| Full document body | Entire HTML content | Markdown body (via Turndown) |

### 2c. External JSON Metadata (optional enrichment)

| Property | Value |
|----------|-------|
| **File** | `case-metadata.json` (local) |
| **Script** | `scripts/apply_json_frontmatter.js` |

**JSON fields per case:**

| JSON Field | Type | Maps to Frontmatter |
|-----------|------|---------------------|
| `caseId` | string | `case-number` |
| `celexId` | string | `celex-id` |
| `date` | string | `date` |
| `parties` | string | `parties` |
| `summary` | string | `gdpr-summary` |
| `interpretedArticleNumbers` | number[] | `ruling-articles` (formatted as `Article N`) |
| `operativePartsCombined` | string | `final-ruling` |
| `operativeParts` | object[] | `operative_parts_structured` |
| `operativeParts[].number` | number | `operative_parts_structured[].number` |
| `operativeParts[].verbatimText` | string | `operative_parts_structured[].verbatim` |
| `operativeParts[].simplifiedText` | string | `operative_parts_structured[].simplified` |
| `operativeParts[].interpretedArticles` | number[] | `operative_parts_structured[].interprets_articles` |
| `operativeParts[].regulations` | string[] | `operative_parts_structured[].mentions_regulations` |

---

## 3. Content Entities

The system has three distinct content entity types:

| Entity | Location | Count | Description |
|--------|----------|-------|-------------|
| **Case Law** | `content/Case law/*.md` | ~99 | Individual CJEU case judgments |
| **Articles** | `content/Articles/Article N.md` | 99 | GDPR articles (1-99) |
| **Index/Browse Pages** | `content/*.md` | ~10 | Navigation, timelines, grids |

---

## Table A: Case Law Frontmatter Fields

Each row is a field found in `content/Case law/*.md` files.

| Field | Type | Required | Origin | Processing | Used By |
|-------|------|----------|--------|-----------|---------|
| `title` | string | Yes | SPARQL `caseNumber` stripped to short form (e.g. `C-492/23`) | If absent, defaults to filename stem. `generate-frontmatter.js` formats from SPARQL data. | `ArticleTitle.tsx`, `Breadcrumbs.tsx`, `PageList.tsx`, `RecentNotes.tsx`, `Backlinks.tsx`, search index, graph nodes, RSS feed |
| `date` | string (ISO 8601) | Yes | SPARQL `caseDate` | Stored as ISO string. Quartz `lastmod.ts` coalesces `created`/`date` aliases into `dates.created`, `dates.published`. | `ContentMeta.tsx` (display), `ArticleCases.tsx` (sorting), `PageList.tsx`, `RecentNotes.tsx`, sitemap `<lastmod>`, RSS `<pubDate>` |
| `case-number` | string | Yes | SPARQL `caseNumber`, formatted as `C-XXX/YY` | `generate-frontmatter.js` normalizes from SPARQL. `apply_json_frontmatter.js` can override from JSON. | `TopicExplorer.tsx` (categorization), case grid generation, timeline generation |
| `parties` | string | Yes | SPARQL `caseParties` or HTML extraction | Stored as `Plaintiff v Defendant` format. | `Parties.tsx` (renders as styled h2), `Backlinks.tsx` (subtitle), `ArticleCases.tsx` (list item), timeline, case grid |
| `topics` | string[] | Yes | EUR-Lex HTML `C71Indicateur` paragraph | `generate-frontmatter.js` splits on `--`/`--`, filters generic phrases, trims whitespace. | `TopicExplorer.tsx` (hierarchical categorization), timeline (display), case grid (display) |
| `final-ruling` | string (multiline) | Yes | EUR-Lex HTML between `C41DispositifIntroduction` and `C77Signatures` | `generate-frontmatter.js` extracts and formats numbered points as `**1.**` prefix. YAML block scalar (`\|` or `\|-`). | Rendered in case page body. Used by `extract_article_rulings.js` to build per-article ruling index. |
| `ruling-articles` | string[] | Yes | EUR-Lex HTML + SPARQL `modifiedLocations` | `generate-frontmatter.js` finds `Article N` patterns (1-99) in ruling text, merges with SPARQL article refs, deduplicates. Format: `Article N` with `[[` wikilink brackets. | `NowReading.tsx` (article chip links), `ArticleCases.tsx` (cross-reference filter), `extract_case_articles.cjs` (index generation) |
| `per-article` | string[] | No | EUR-Lex HTML ruling text | `generate-frontmatter.js` maps ruling paragraphs to specific articles. Format: `Article N \| ruling text...` | Rendered in case page body for per-article breakdown |
| `aliases` | string[] | No | Manual or auto-generated | Quartz `frontmatter.ts` coalesces `aliases`/`alias`, converts to `FullSlug[]`, pushes to `allSlugs`. | `aliases.ts` emitter creates HTML redirect pages, `allSlugs` for link resolution |
| `celex-id` | string | No | `apply_json_frontmatter.js` from JSON `celexId` | Direct mapping from external JSON metadata. | Not consumed by any component (reference only) |
| `gdpr-summary` | string | No | `apply_json_frontmatter.js` from JSON `summary` | Direct mapping from external JSON metadata. | Not consumed by any component (reference only) |
| `operative_parts_structured` | object[] | No | `apply_json_frontmatter.js` from JSON `operativeParts` | Structured array with `number`, `verbatim`, `simplified`, `interprets_articles`, `mentions_regulations`. | Not consumed by any component (reference only) |

---

## Table B: Article Frontmatter Fields

Each row is a field found in `content/Articles/Article N.md` files.

| Field | Type | Required | Origin | Processing | Used By |
|-------|------|----------|--------|-----------|---------|
| `title` | string | Yes | Manual authoring | Format: `Article N` (e.g. `Article 17`). | `ArticleTitle.tsx`, breadcrumbs, search index, graph nodes |
| `subtitle` | string | Yes | Manual authoring | Human-readable article name (e.g. `Right to erasure ('right to be forgotten')`). | `Backlinks.tsx` (shown as subtitle under backlink) |

**Note:** Article pages have minimal frontmatter. Their body content contains the GDPR article text. Cross-references to cases are computed dynamically by `ArticleCases.tsx` which filters `allFiles` by `ruling-articles` matching the article number.

---

## Table C: General/Index Page Frontmatter Fields

Fields found on `content/index.md`, browse pages, and generated index files.

| Field | Type | Required | Origin | Processing | Used By |
|-------|------|----------|--------|-----------|---------|
| `title` | string | Yes | Manual | E.g. `Welcome!`, `Browse by topic` | All title-consuming components |
| `subtitle` | string | No | Manual | Descriptive subtitle | Display only |
| `tags` | string[] | No | Manual | E.g. `["hidden"]` to exclude from listings | `TagList.tsx`, `TagContent.tsx`, `RecentNotes.tsx` (filter), search index |
| `cssclasses` | string[] | No | Manual | E.g. `["no-date", "no-title"]` | `Content.tsx` (applied as CSS classes on `<article>`) |

---

## Table D: Quartz-Internal VFile Data (QuartzPluginData)

These fields are attached to `vfile.data` during the Quartz transform pipeline. They do not exist in markdown files; they are computed at build time.

**Source:** `quartz/plugins/vfile.ts` + module augmentations in each transformer.

| Field | Type | Set By | Source File | Description | Consumed By |
|-------|------|--------|-------------|-------------|-------------|
| `slug` | `FullSlug` | Core VFile setup | `quartz/build.ts` | Canonical page slug (e.g. `Case-law/C-492-23`) | All components via `fileData.slug`, link resolution, graph, search |
| `filePath` | `FilePath` | Core VFile setup | `quartz/build.ts` | Disk path (e.g. `content/Case law/C-492-23.md`) | `Head.tsx`, `Content.tsx`, dep graph |
| `relativePath` | `FilePath` | Core VFile setup | `quartz/build.ts` | Path relative to content dir | Internal path utilities |
| `frontmatter` | object | `FrontMatter` transformer | `quartz/plugins/transformers/frontmatter.ts` | Parsed YAML/TOML frontmatter (see Tables A-C). Always has `title: string`. | Nearly all components |
| `aliases` | `FullSlug[]` | `FrontMatter` transformer | `quartz/plugins/transformers/frontmatter.ts` | Resolved alias slugs from `frontmatter.aliases`. Pushed into `allSlugs`. | `aliases.ts` emitter (redirect pages) |
| `dates` | `{ created: Date, modified: Date, published: Date }` | `CreatedModifiedDate` transformer | `quartz/plugins/transformers/lastmod.ts` | Resolved dates from frontmatter, git history, or filesystem. Priority order configurable. | `ContentMeta.tsx`, `PageList.tsx`, `RecentNotes.tsx`, `FolderContent.tsx`, sitemap, RSS |
| `links` | `SimpleSlug[]` | `CrawlLinks` transformer | `quartz/plugins/transformers/links.ts` | All outgoing internal links from this page. | `Backlinks.tsx` (reverse lookup), graph edges, `ContentIndex` (`links` field) |
| `description` | string | `Description` transformer | `quartz/plugins/transformers/description.ts` | Auto-generated meta description (first N chars of content). | `Head.tsx` (OG meta), RSS feed description |
| `text` | string | `Description` transformer | `quartz/plugins/transformers/description.ts` | Plain-text extraction of full page content (HTML stripped). | `ContentMeta.tsx` (reading time calc), `ContentIndex` (`content` field for search) |
| `toc` | `TocEntry[]` | `TableOfContents` transformer | `quartz/plugins/transformers/toc.ts` | Array of `{ depth: number, text: string, slug: string }` heading entries. | `TableOfContents.tsx` (renders TOC sidebar) |
| `collapseToc` | boolean | `TableOfContents` transformer | `quartz/plugins/transformers/toc.ts` | Whether TOC starts collapsed. | `TableOfContents.tsx` (initial collapse state) |
| `htmlAst` | `HtmlRoot` | `ObsidianFlavoredMarkdown` transformer | `quartz/plugins/transformers/ofm.ts` | Full HTML AST clone for transclusion support. | `renderPage.tsx` (resolves `![[embed]]` transclusions) |
| `blocks` | `Record<string, Element>` | `ObsidianFlavoredMarkdown` transformer | `quartz/plugins/transformers/ofm.ts` | Map of block IDs to HTML elements (for `^blockref` transclusions). | `renderPage.tsx` (block-level transclusions) |
| `hasMermaidDiagram` | boolean | `ObsidianFlavoredMarkdown` transformer | `quartz/plugins/transformers/ofm.ts` | Whether page contains mermaid diagrams. | `renderPage.tsx` (conditionally loads mermaid.js) |

### TocEntry Structure

```
{
  depth: number    // Heading level (1-6)
  text: string     // Heading text content
  slug: string     // Anchor slug for linking (e.g. "introduction")
}
```

---

## Table E: Global Configuration Fields

**Source:** `quartz/cfg.ts` -> `GlobalConfiguration` interface. Set in `quartz.config.ts`.

| Field | Type | Default (GDPRed) | Description | Used By |
|-------|------|-------------------|-------------|---------|
| `pageTitle` | string | `"GDPRed"` | Site title displayed in header | `PageTitle.tsx`, RSS feed `<title>`, OG meta |
| `pageTitleSuffix` | string? | _(none)_ | Appended to page titles in `<title>` tag | `Head.tsx` |
| `enableSPA` | boolean | `true` | Single-page-app navigation (prevents full reloads) | Client-side router (`spa.inline.ts`) |
| `enablePopovers` | boolean | `true` | Wikipedia-style link previews on hover | `popover.inline.ts` |
| `analytics` | Analytics | _(null or configured)_ | Analytics provider config | `Head.tsx` (injects tracking script) |
| `ignorePatterns` | string[] | `["private", ...]` | Glob patterns for files to exclude from build | `quartz/build.ts` (file discovery) |
| `defaultDateType` | `"created" \| "modified" \| "published"` | `"created"` | Which date to display by default | `getDate()` utility, `ContentMeta.tsx` |
| `baseUrl` | string? | `"gdpred.milos.no"` | Base URL for sitemap, RSS, CNAME | Sitemap URLs, RSS links, OG meta URLs, CNAME file |
| `generateSocialImages` | boolean \| SocialImageOptions | _(configured)_ | Auto-generate OG images | `Head.tsx` (Satori-based image generation) |
| `theme` | Theme | _(see below)_ | Typography, colors, font config | `Head.tsx` (font loading), all CSS variables |
| `locale` | ValidLocale | `"en-US"` | BCP 47 locale for dates and UI strings | All components using `i18n()`, date formatting |

### Theme Sub-Structure

| Field | Type | Description |
|-------|------|-------------|
| `theme.typography.header` | string | Header font family (e.g. `IBM Plex Sans`) |
| `theme.typography.body` | string | Body font family |
| `theme.typography.code` | string | Code font family |
| `theme.cdnCaching` | boolean | Whether to use CDN for fonts |
| `theme.fontOrigin` | `"googleFonts" \| "local"` | Font loading source |
| `theme.colors.lightMode` | ColorScheme | 9 color tokens for light theme |
| `theme.colors.darkMode` | ColorScheme | 9 color tokens for dark theme |

### ColorScheme Tokens

Each mode (light/dark) defines: `light`, `lightgray`, `gray`, `darkgray`, `dark`, `secondary`, `tertiary`, `highlight`, `textHighlight`.

---

## Table F: Content Index (Search/Graph Payload)

**Source:** `quartz/plugins/emitters/contentIndex.ts`
**Output:** `static/contentIndex.json`

This is the JSON blob loaded client-side for search and graph visualization.

| Field | Type | Source | Used By Search | Used By Graph | In JSON |
|-------|------|--------|---------------|---------------|---------|
| _key_ (slug) | `FullSlug` | `vfile.data.slug` | Result linking | Node ID | Yes |
| `title` | string | `frontmatter.title` | Indexed (tokenize: forward) | Node label | Yes |
| `links` | `SimpleSlug[]` | `vfile.data.links` | Not indexed | Edge targets | Yes |
| `tags` | string[] | `frontmatter.tags` | Indexed + tag filter | Tag nodes (if enabled) | Yes |
| `content` | string | `vfile.data.text` | Indexed (tokenize: forward) | Not used | Yes |
| `richContent` | string? | HAST-to-HTML of full page | Not used | Not used | Only if `rssFullHtml` |
| `date` | Date? | `getDate()` from dates | Not used | Not used | **No** (stripped) |
| `description` | string? | `vfile.data.description` | Not used | Not used | **No** (stripped) |

**Note:** `date` and `description` are stripped from `contentIndex.json` to reduce file size. They are only used for sitemap.xml and RSS (index.xml).

### FlexSearch Index Configuration (client-side)

```
Document index fields:
  - title     (tokenize: "forward")
  - content   (tokenize: "forward")
  - tags      (tokenize: "forward")
Tag field: "tags" (used for #tag filtering)
Max results: 8 (basic search), 5 (tag search)
```

### Graph Data Usage (client-side)

```
Nodes: Each slug in contentIndex -> node
  - Label: ContentDetails.title
  - Color: secondary (current), tertiary (visited), gray (unvisited)
Edges: ContentDetails.links -> directed edges to other nodes
Tag nodes (optional): ContentDetails.tags -> synthetic nodes prefixed with #
Neighborhood: BFS from current page to configurable depth
Rendering: D3.js force simulation + Pixi.js GPU rendering
```

---

## Table G: Pipeline Script I/O

Complete input/output mapping for every processing script.

| Script | Input | Processing | Output |
|--------|-------|-----------|--------|
| `sparql-discover.js` | SPARQL endpoint + existing `content/Case law/` filenames | Queries Publications Office, filters/deduplicates, compares against existing | `scripts/pipeline/new-cases.json` |
| `fetch-html.js` | `new-cases.json` (caseCelex IDs) | HTTP GET from EUR-Lex with rate limiting | `scripts/pipeline/downloaded/{celex}.html` |
| `generate-frontmatter.js` | Case data object + raw HTML | Cheerio parsing of ruling, topics, articles; merge SPARQL + HTML data | YAML frontmatter object (returned to caller) |
| `html-to-md.cjs` | Raw EUR-Lex HTML | Turndown HTML-to-Markdown, paragraph consolidation, numbering cleanup | Markdown body string (returned to caller) |
| `assemble-case.js` | Case data + HTML file path | Calls generate-frontmatter + html-to-md, combines | `content/Case law/{case-number}.md` |
| `run-pipeline.js` | CLI args (`--dry-run`, `--force-celex`, `--limit`) | Orchestrates discover -> download -> assemble -> post-process | All outputs above + console summary |
| `extract_case_articles.cjs` | All `content/Case law/*.md` | Parses frontmatter, extracts `[[Article N]]` refs, builds cross-ref maps | `cases_by_article.md`, `articles_by_case.md` (root) |
| `extract_article_rulings.js` | `key-articles-by-case.md` + case law files | Extracts ruling paragraphs per article per case | `content/article-rulings.md` |
| `process_article_refs.cjs` | All `content/**/*.md` | Finds `[[Article N]]` where N>99 (invalid), replaces with plain text | Modified .md files + `article_modifications.md` log + `backup_content/` |
| `apply_json_frontmatter.js` | `case-metadata.json` + case law .md files | Maps JSON metadata to YAML, replaces frontmatter | Modified .md files (with `.bak_json_apply` backups) |
| `check_frontmatter.js` | All `content/**/*.md` | Validates YAML syntax, checks for missing frontmatter | Console report (no file changes) |
| `generate-timeline.js` | All `content/Case law/*.md` | Extracts date/title/parties/topics, groups by month, generates HTML | Inserts timeline HTML into `content/index.md` |
| `generate-case-grid.js` | All `content/Case law/*.md` | Extracts date/title/parties/topics, generates card grid HTML | `content/case-law-grid.md` |

---

## Table H: Component Data Consumption

What data each UI component reads and how it uses it.

| Component | fileData Fields | allFiles Fields | cfg Fields | Renders |
|-----------|----------------|-----------------|-----------|---------|
| `ArticleTitle.tsx` | `frontmatter.title` | -- | -- | `<h1>` with page title |
| `Parties.tsx` | `frontmatter.parties` | -- | -- | Styled `<h2>` with italic parties text |
| `NowReading.tsx` | `frontmatter["ruling-articles"]`, `slug` | -- | -- | Article chips with links to `/Articles/Article-N` |
| `ArticleCases.tsx` | `slug` (extracts article number) | `frontmatter["ruling-articles"]`, `slug`, `frontmatter.title`, `frontmatter.date`, `frontmatter.parties` | `locale` | Collapsible list of cases referencing this article |
| `ContentMeta.tsx` | `text`, `dates`, `slug` | -- | `locale` | Date display + reading time (e.g. "5 min read") |
| `TagList.tsx` | `frontmatter.tags`, `slug` | -- | -- | Tag links to `/tags/{slug}` |
| `Head.tsx` | `filePath`, `frontmatter.title`, `description`, `frontmatter.socialImage`, `slug` | -- | `generateSocialImages`, `locale`, `pageTitleSuffix`, `baseUrl`, `theme`, `pageTitle` | `<head>` with meta tags, OG/Twitter cards, fonts, CSS/JS |
| `PageTitle.tsx` | `slug` | -- | `pageTitle`, `locale` | Site title link to homepage |
| `Backlinks.tsx` | `slug` | `links` (reverse lookup), `slug`, `frontmatter.title`, `frontmatter.parties`, `frontmatter.subtitle` | `locale` | List of pages linking to current page |
| `TableOfContents.tsx` | `toc`, `collapseToc` | -- | `locale` | Collapsible TOC with depth-based indentation |
| `Breadcrumbs.tsx` | `slug`, `frontmatter.title` | `slug`, `frontmatter.title` (index files) | -- | Navigation breadcrumb trail |
| `Explorer.tsx` | _(nested)_ | `slug` (builds file tree) | `locale` | Sidebar file explorer navigation |
| `Graph.tsx` | -- | -- | `locale` | D3/Pixi graph (data loaded client-side from contentIndex.json) |
| `Search.tsx` | -- | -- | `locale` | Search UI (data loaded client-side from contentIndex.json) |
| `Content.tsx` | `filePath`, `frontmatter.cssclasses` | -- | -- | `<article>` with rendered markdown content |
| `FolderContent.tsx` | `slug`, `frontmatter.cssclasses`, `description` | `slug`, `dates`, `frontmatter.title`, `frontmatter.tags` | `locale` | Folder page with child page listings |
| `TagContent.tsx` | `slug`, `frontmatter.cssclasses`, `description` | `frontmatter.tags` (filter) | `locale` | Tag index or single-tag page with page listings |
| `TopicExplorer.tsx` | `slug` | `slug`, `frontmatter["case-number"]`, `frontmatter.title` | -- | Hierarchical GDPR topic browser with case links |
| `renderPage.tsx` | `frontmatter.lang`, `slug`, `hasMermaidDiagram` | `slug`, `frontmatter.title`, `htmlAst`, `blocks` | `locale` | Full HTML page assembly with transclusion resolution |
| `RecentNotes.tsx` | `slug` | `frontmatter.title`, `frontmatter.tags`, `dates` | `locale` | Recent pages list sorted by date |
| `PageList.tsx` | `slug` | `frontmatter.title`, `frontmatter.tags`, `dates` | `locale` | Generic sorted/limited page listing |
| `Body.tsx` | -- | -- | -- | Wrapper `<div id="quartz-body">` |

---

## Table I: Frontmatter Alias Resolution

The `FrontMatter` transformer coalesces multiple possible field names into canonical fields.

**Source:** `quartz/plugins/transformers/frontmatter.ts:84-110`

| Canonical Field | Accepted Aliases (checked in order) | Coercion |
|----------------|-------------------------------------|----------|
| `tags` | `tags`, `tag` | Coerced to string[], split on `,` if string, deduplicated via `slugTag()` |
| `aliases` | `aliases`, `alias` | Coerced to string[], resolved to `FullSlug[]` relative to file directory |
| `cssclasses` | `cssclasses`, `cssclass` | Coerced to string[] |
| `socialImage` | `socialImage`, `image`, `cover` | Kept as string |
| `created` | `created`, `date` | Kept as string (later parsed to Date by `lastmod.ts`) |
| `modified` | `modified`, `lastmod`, `updated`, `last-modified` | Kept as string (later parsed to Date by `lastmod.ts`) |
| `published` | `published`, `publishDate`, `date` | Kept as string (later parsed to Date by `lastmod.ts`) |

---

## Table J: Output Artifacts

All files generated by the Quartz build.

| Artifact | Generator | Format | Contains |
|----------|-----------|--------|----------|
| `public/{slug}/index.html` | Page emitters (`ContentPage`, `FolderPage`, `TagPage`) | HTML | Full rendered page with all component output |
| `public/static/contentIndex.json` | `ContentIndex` emitter | JSON | `Map<slug, {title, links, tags, content}>` |
| `public/sitemap.xml` | `ContentIndex` emitter | XML | All slugs with `<lastmod>` dates |
| `public/index.xml` | `ContentIndex` emitter | XML (RSS) | Recent pages with title, link, description, pubDate |
| `public/{alias}/index.html` | `Aliases` emitter | HTML | Meta-refresh redirect + canonical link |
| `public/static/*` | `Assets` emitter | Various | Static files (CSS, JS, fonts, images) |
| `public/CNAME` | `CNAME` emitter | Text | `gdpred.milos.no` |
| Tag index pages | `TagPage` emitter | HTML | Tag listing or per-tag page list |
| Folder index pages | `FolderPage` emitter | HTML | Folder contents with child page listings |

---

## Data Flow Diagram

```
                    EXTERNAL SOURCES
                    ================
    ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
    │ SPARQL Endpoint   │     │  EUR-Lex HTML     │     │ case-metadata│
    │ (Publications     │     │  (Court rulings)  │     │ .json        │
    │  Office EU)       │     │                   │     │ (optional)   │
    └────────┬─────────┘     └────────┬──────────┘     └──────┬───────┘
             │                        │                        │
    ┌────────▼─────────┐     ┌────────▼──────────┐    ┌───────▼────────┐
    │sparql-discover.js│     │  fetch-html.js     │    │apply_json_     │
    │  Discovers new   │     │  Downloads HTML    │    │frontmatter.js  │
    │  cases           │     │  from EUR-Lex      │    │  Enriches FM   │
    └────────┬─────────┘     └────────┬──────────┘    └───────┬────────┘
             │                        │                        │
             └──────────┬─────────────┘                        │
                        │                                      │
               ┌────────▼──────────┐                           │
               │  assemble-case.js │                           │
               │  ┌──────────────┐ │                           │
               │  │generate-     │ │                           │
               │  │frontmatter.js│ │                           │
               │  └──────────────┘ │                           │
               │  ┌──────────────┐ │                           │
               │  │html-to-md.cjs│ │                           │
               │  └──────────────┘ │                           │
               └────────┬──────────┘                           │
                        │                                      │
                        ▼                                      ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                  content/Case law/*.md                           │
    │  ┌─────────────────────────────────────────────────────────┐    │
    │  │ YAML Frontmatter:                                       │    │
    │  │   title, date, case-number, parties, topics,            │    │
    │  │   final-ruling, ruling-articles, per-article,           │    │
    │  │   [celex-id, gdpr-summary, operative_parts_structured]  │    │
    │  ├─────────────────────────────────────────────────────────┤    │
    │  │ Markdown Body:                                          │    │
    │  │   Full court ruling text converted from HTML            │    │
    │  └─────────────────────────────────────────────────────────┘    │
    └────────────────────────────┬─────────────────────────────────────┘
                                 │
          POST-PROCESSING        │
          ===============        │
    ┌────────────────────────────┼────────────────────────────────┐
    │                            ▼                                │
    │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────┐  │
    │  │extract_case_     │  │extract_article_  │  │process_  │  │
    │  │articles.cjs      │  │rulings.js        │  │article_  │  │
    │  │→cases_by_article │  │→article-rulings  │  │refs.cjs  │  │
    │  │→articles_by_case │  │  .md             │  │→fix >99  │  │
    │  └──────────────────┘  └──────────────────┘  └──────────┘  │
    │                                                             │
    │  ┌──────────────────┐  ┌──────────────────┐                │
    │  │generate-         │  │generate-case-    │                │
    │  │timeline.js       │  │grid.js           │                │
    │  │→index.md timeline│  │→case-law-grid.md │                │
    │  └──────────────────┘  └──────────────────┘                │
    └─────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                    QUARTZ BUILD PIPELINE                     │
    │                                                              │
    │  PARSE ──► TRANSFORM ──► FILTER ──► EMIT                    │
    │                                                              │
    │  Parse:                                                      │
    │    Markdown → AST (mdast) + VFile                            │
    │                                                              │
    │  Transform (Markdown stage):                                 │
    │    FrontMatter    → vfile.data.frontmatter, .aliases         │
    │    GFM            → Tables, strikethrough, autolinks         │
    │    OFM            → Wikilinks, embeds, tags, .blocks,        │
    │                     .htmlAst, .hasMermaidDiagram              │
    │    Citations      → Bibliography references                  │
    │    Linebreaks     → Hard line breaks                         │
    │                                                              │
    │  [Markdown AST → HTML AST conversion]                        │
    │                                                              │
    │  Transform (HTML stage):                                     │
    │    CrawlLinks     → vfile.data.links (SimpleSlug[])          │
    │    Description    → vfile.data.description, .text            │
    │    TableOfContents→ vfile.data.toc, .collapseToc             │
    │    CreatedModified→ vfile.data.dates                         │
    │    SyntaxHighlight→ Code block theming                       │
    │    Latex          → Math rendering                           │
    │                                                              │
    │  Filter:                                                     │
    │    RemoveDrafts   → Excludes draft:true / publish:false      │
    │                                                              │
    │  Emit:                                                       │
    │    ContentPage    → public/{slug}/index.html                 │
    │    FolderPage     → public/{folder}/index.html               │
    │    TagPage        → public/tags/{tag}/index.html             │
    │    ContentIndex   → static/contentIndex.json + sitemap + RSS │
    │    Aliases        → public/{alias}/index.html (redirects)    │
    │    Assets         → public/static/* (CSS, JS, fonts)         │
    │    CNAME          → public/CNAME                             │
    └──────────────────────────────────────────────────────────────┘
```

---

## Cross-Reference Systems

### 1. Case → Article Links

**Direction:** Case law pages reference GDPR articles.

| Layer | Mechanism | Data Field |
|-------|-----------|-----------|
| Frontmatter | `ruling-articles: ["Article 17", "Article 21"]` | Explicit list |
| Body text | `[[Article 17]]` wikilinks | Parsed by OFM transformer into `links` |
| Component | `NowReading.tsx` reads `ruling-articles`, generates chip links | Direct frontmatter read |

### 2. Article → Case Links (reverse)

**Direction:** Article pages show which cases reference them.

| Layer | Mechanism | Data Field |
|-------|-----------|-----------|
| Component | `ArticleCases.tsx` extracts article number from slug, filters `allFiles` where `ruling-articles` includes this article | Computed at render time from `allFiles` |
| Backlinks | `Backlinks.tsx` finds all files whose `links` array contains current article's slug | Computed from `vfile.data.links` |

### 3. Inter-Case Links

**Direction:** Cases may link to other cases via wikilinks in body text.

| Layer | Mechanism | Data Field |
|-------|-----------|-----------|
| Body text | `[[C-492-23]]` wikilinks | Parsed into `links` by OFM + CrawlLinks |
| Graph | Edges drawn from `ContentDetails.links` in contentIndex.json | Client-side D3 rendering |
| Backlinks | Reverse lookup of `links` array | `Backlinks.tsx` |

### 4. Generated Cross-Reference Indexes

| File | Generator | Structure |
|------|-----------|-----------|
| `cases_by_article.md` | `extract_case_articles.cjs` | Per case: list of referenced articles |
| `articles_by_case.md` | `extract_case_articles.cjs` | Per article: list of referencing cases |
| `article-rulings.md` | `extract_article_rulings.js` | Per article: relevant ruling text from each case |
| `key-articles-by-case.md` | _(manual/generated)_ | Key articles grouped by case |

### 5. Search System

| Indexed Field | Source | Search Type |
|--------------|--------|-------------|
| `title` | `frontmatter.title` | Forward tokenization, prefix matching |
| `content` | `vfile.data.text` (plain text) | Forward tokenization, prefix matching |
| `tags` | `frontmatter.tags` | Tag filtering with `#` prefix, forward tokenization |

### 6. Graph Visualization

| Node Type | Source | Visual |
|-----------|--------|--------|
| Page node | Each slug in contentIndex | Circle, color varies by state |
| Tag node (optional) | `ContentDetails.tags` | Circle with border, "light" color |
| Edge (link) | `ContentDetails.links[i]` → target slug | Directed line |
| Edge (tag) | Page slug → `tags/{tagname}` | Directed line |

---

## Appendix: Complete Transformer Pipeline Order

As configured in `quartz.config.ts`:

```
1. FrontMatter        → Parse YAML, resolve aliases, coerce types
2. CreatedModifiedDate → Resolve dates from frontmatter/git/filesystem
3. Latex               → Render math expressions
4. SyntaxHighlighting  → Highlight code blocks
5. ObsidianFlavoredMarkdown → Wikilinks, embeds, tags, callouts, blocks
6. GitHubFlavoredMarkdown   → Tables, strikethrough, autolinks
7. CrawlLinks         → Resolve links, classify internal/external, populate links[]
8. Description         → Extract plain text and meta description
9. TableOfContents     → Generate heading tree
```

Each transformer can operate at three stages:
- `textTransform`: Raw text manipulation before parsing
- `markdownPlugins`: Remark plugins operating on mdast
- `htmlPlugins`: Rehype plugins operating on hast

---

## Appendix: Slug Type System

Quartz uses branded string types for type safety:

| Type | Pattern | Example | Usage |
|------|---------|---------|-------|
| `FilePath` | Absolute, with extension | `content/Case law/C-492-23.md` | Disk I/O, dep graph |
| `FullSlug` | No leading/trailing slash, may have `index` | `Case-law/C-492-23` | Canonical page identity |
| `SimpleSlug` | No `/index`, no extension | `Case-law/C-492-23` | Links, graph edges, backlinks |
| `RelativeURL` | Can be relative | `../Articles/Article-17` | href attributes in HTML |
