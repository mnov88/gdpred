# GDPRed Site Features

## Global (every page)

- Left sidebar: site title, full-text search, dark/light mode toggle, file explorer (collapsible folder tree of all content)
- Breadcrumbs at the top (Home > Case law > C-492/23)
- Link hover previews (Wikipedia-style popovers)
- SPA navigation (no full page reloads)
- Footer with author credit, LinkedIn, email, privacy policy

## Article pages

- Title and subtitle (e.g. "Article 17 — Right to erasure")
- Full regulatory text of the GDPR article
- "Cases referencing this article" — collapsible list of all cases that interpret this article, each showing case number, date, and parties
- Backlinks — other pages that link to this article
- Interactive graph showing this article's connections to cases and other articles
- Table of contents (right sidebar, desktop only)

No prev/next article navigation.

## Case pages

- Case number as title (e.g. "C-492/23")
- Parties line (e.g. "Digi Kft. v Nemzeti Adatvédelmi Hatóság")
- Date and reading time
- Article chips — clickable badges for each GDPR article the case interprets, linking to the article page
- Full ruling text (judgment header, procedural history, legal analysis, ruling)
- Backlinks — other pages linking to this case
- Interactive graph showing connections
- Table of contents

## Homepage

- Welcome text and site description
- Expandable FAQ (5 items)
- Case law timeline — all cases grouped by month, most recent first

## Browse pages

- **Browse by topic** — 14 curated categories (e.g. "Data subject rights", "Remedies, liability, compensation"), each with subtopics linking to relevant cases
- **Case grid** — card layout of all cases showing case number, date, parties, topics
- **Topic explorer** — collapsible hierarchy (partial: 3 categories with ~25 cases mapped)

## Search

- Full-text search across all page titles, body text, and tags
- Live results with preview snippets
- Client-side (FlexSearch over a prebuilt JSON index)

## Graph

- Local graph: current page + immediate connections
- Global graph toggle: entire site as a network
- Interactive: drag, pan, zoom
- Nodes = pages, edges = links between pages

## File explorer

- Hierarchical folder tree in left sidebar
- Case law folder sorted newest-first by date
- Folders expand/collapse, state remembered per session

## Auto-generated outputs

- RSS feed
- Sitemap
- Alias redirects (alternative URLs for joined cases)
