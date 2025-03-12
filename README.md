# GDPRed

This repository contains the source code for GDPRed, a platform for organizing and accessing GDPR case law from the Court of Justice of the European Union (CJEU). See it in action [here](https://gdpred.milos.no). Feel free to clone the repo or propose edits! :)

## What is GDPRed?

GDPRed is built on [Quartz](https://quartz.jzhao.xyz/), which uses Markdown files with YAML frontmatter to create a connected knowledge base. In other words: download CJEU judgements, clean the HTML, add frontmatter, run scripts.

## Technical Foundation

### Main Framework

- **Markdown-based content**: All case law is stored as Markdown files
- **YAML frontmatter**: Structured metadata for each case
- **Bidirectional linking**: Automatic connections between related cases
- **Full-text search**: Find relevant cases quickly
- **Responsive design**: Works on desktop and mobile devices

### Directory Structure

```
quartz/
├── content/                  # All content lives here
│   ├── Case law/             # Individual case law files
│   │   ├── C-123-45.md       # Case files named by case number
│   │   └── ...
│   ├── Articles/             # GDPR articles and their interpretations
│   │   ├── Article-4.md
│   │   └── ...
│   ├── cases_by_article.md   # Auto-generated index of cases by article
│   ├── articles_by_case.md   # Auto-generated index of articles by case
│   └── case-law-timeline.md  # Auto-generated timeline visualization
├── docs/                     # Documentation
└── scripts/                  # Utility scripts
    ├── extract_case_articles.cjs    # Generates article mappings
    ├── process_article_refs.cjs     # Processes article references
    ├── generate-timeline.js         # Creates the timeline visualization
    └── generate-case-grid.js        # Creates case grid views
```

## Content Structure

### Case Law Files

Each case is stored as a Markdown file with structured YAML frontmatter:

```markdown
---
title: C-205/21
date: 2023-01-26
case-number: C-205/21
parties: Plaintiff v Defendant
topics:
  - Topic 1
  - Topic 2
final-ruling: |-
  Text of the ruling
ruling-articles:
  - Article X
  - Article Y
per-article:
  - Article X | Text related to Article X
  - Article Y | Text related to Article Y
---

Body text of the case...
```

The frontmatter follows a specific format:
- `title`: Case identifier (format: "C-XXX/YY")
- `date`: Judgment date (YYYY-MM-DD)
- `case-number`: Same as title
- `parties`: Parties involved in the case
- `topics`: Key legal topics covered
- `final-ruling`: The complete text of the Court's ruling
- `ruling-articles`: GDPR articles referenced in the ruling
- `per-article`: Mapping of articles to relevant ruling text

### Utility Scripts

GDPRed includes several Node.js scripts that process the case law files:

1. **extract_case_articles.cjs**: Scans all case files and generates:
   - `cases_by_article.md`: Lists cases grouped by articles they reference
   - `articles_by_case.md`: Lists articles grouped by cases that reference them

2. **generate-timeline.js**: Creates a visual timeline of all cases, grouped by month and year

3. **process_article_refs.cjs**: Processes article references to ensure consistency

4. **generate-case-grid.js**: Creates grid views of cases for easier browsing

## Setting Up Your Own Instance

To create your own instance of GDPRed:

1. **Clone Quartz**: Follow the [Quartz setup instructions](https://quartz.jzhao.xyz/notes/setup/)

2. **Content Structure**: Create the following directories:
   ```
   content/
   ├── Case law/
   └── Articles/
   ```

3. **Add Case Files**: Create Markdown files for each case in `content/Case law/` following the frontmatter format above

4. **Run Utility Scripts**: Execute the scripts to generate the mappings and visualizations:
   ```bash
   node scripts/extract_case_articles.cjs
   node scripts/generate-timeline.js
   ```

5. **Start Quartz**: Run the Quartz development server:
   ```bash
   npx quartz build --serve
   ```

## Content Requirements

For GDPRed to work properly, your content should follow these conventions:

1. **Case File Naming**: Use the format `C-XXX-YY.md` (with hyphens, not slashes)
2. **Consistent Frontmatter**: Follow the frontmatter structure exactly
3. **Article References**: Use consistent article naming (e.g., "Article 4")
4. **Date Format**: Use ISO format (YYYY-MM-DD) for all dates

## Contact

For questions or contributions:
- Website: [milos.no](https://milos.no/#contact)
- LinkedIn: [Miloš Novović](https://www.linkedin.com/in/milosnovovic)

## Disclaimer

GDPRed is for informational purposes only. While every effort has been made to ensure accuracy, this is not a source of legal advice. Always consult official sources and qualified legal professionals for legal matters.