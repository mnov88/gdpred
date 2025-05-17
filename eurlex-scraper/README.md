# EUR-Lex Scraper System

A comprehensive Node.js-based solution for extracting, processing, and organizing legal documents from the EUR-Lex database.

## System Overview

The EUR-Lex Scraper System consists of three main scripts that work together:

1. **combined-scraper.js**: The main orchestration script that coordinates the entire scraping process
2. **split-articles.js**: Extracts individual articles from legal documents
3. **html-to-md.js**: Converts HTML content to Markdown format

Additionally, a new orchestrator has been added:

4. **eurlex-orchestrator.js**: High-level orchestrator that provides a unified command-line interface

## Data Flow

```
[eurlex-orchestrator.js]
       │
       ▼
[combined-scraper.js] ────┐
       │                  │
       ▼                  ▼
[split-articles.js]    [EUR-Lex API/Website]
       │                  │
       ▼                  ▼
   [HTML files]      [Case references]
       │                  │
       ▼                  ▼
[html-to-md.js]    [Case metadata/categorization]
       │                  │
       ▼                  ▼
 [Markdown files] [Summary markdown files]
       │                  │
       └──────────┬───────┘
                 ▼
        [Organized directory structure]
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install axios cheerio turndown xml2js
   ```

## Usage

### Using the Orchestrator (Recommended)

The orchestrator provides a unified command-line interface for all operations:

```bash
# Scrape a single CELEX document
node eurlex-orchestrator.js scrape 32016R0679

# Skip downloading HTML files (metadata only)
node eurlex-orchestrator.js scrape 32016R0679 --skip-download

# Process a batch of CELEX numbers from a file
node eurlex-orchestrator.js batch celex-list.txt

# Extract articles only from a CELEX document
node eurlex-orchestrator.js articles-only 32016R0679 ./output-dir

# Convert HTML files to Markdown
node eurlex-orchestrator.js convert ./html-dir ./md-dir

# Show help information
node eurlex-orchestrator.js help
```

### Using Individual Scripts

You can also use the individual scripts directly:

```bash
# Extract articles and case law from GDPR regulation
node combined-scraper.js 32016R0679

# Extract only metadata without downloading case HTML
node combined-scraper.js 32016R0679 --skip-download

# Use split-articles.js directly to extract articles
node split-articles.js 32016R0679 ./output-dir

# Convert a single HTML file to Markdown
node html-to-md.js Article_1.html

# Convert all HTML files in a directory to Markdown
node html-to-md.js ./html-dir ./md-dir
```

## Output Structure

The scraper creates a directory structure for each CELEX number:

```
/<CELEX_NUMBER>/
  ├── articles/
  │   ├── html/          # HTML files for each article
  │   └── md/            # Markdown files for each article
  ├── case-law/
  │   ├── interpreted/
  │   │   ├── html/      # HTML files for case interpretations
  │   │   └── md/        # Markdown files for case interpretations
  │   ├── preliminary/
  │   │   ├── html/      # HTML files for preliminary references
  │   │   └── md/        # Markdown files for preliminary references
  │   └── other/
  │       ├── html/      # HTML files for other case references
  │       └── md/        # Markdown files for other case references
  ├── <CELEX_NUMBER>_full_html.html  # Full HTML of the document
  ├── articles-interpreted.md        # Article-specific interpretations
  ├── articles-preliminary.md        # Article-specific preliminary references
  ├── case-metadata.md               # Metadata for all case references
  ├── download-summary.md            # Summary of download results
  └── initial-references.md          # Raw initial references from main page
```

## Features

- **Article Extraction**: Extracts individual articles from legal documents
- **Case Reference Collection**: Fetches and categorizes case references
- **Metadata Enrichment**: Retrieves metadata from Publications Office API
- **Content Download**: Downloads case HTML files
- **HTML to Markdown Conversion**: Converts all HTML files to Markdown
- **Summary Generation**: Creates category-specific and article-specific summaries
- **Batch Processing**: Process multiple CELEX numbers in one go
- **Error Handling**: Includes retry mechanisms for network requests

## Technical Requirements

- Node.js v12.0.0 or higher
- NPM packages: axios, cheerio, fs, path, xml2js, turndown
- Internet connection to access EUR-Lex and Publications Office API

## Error Handling

The system includes robust error handling:
- HTTP requests use timeout settings and retries with exponential backoff
- Network errors, parsing errors, and API failures are logged
- Processing continues even if individual items fail
- Summary files include error information

## License

This project is open source and available under the MIT License. 