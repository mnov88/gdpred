# Quartz Utility Functions Documentation

This document provides an overview of the utility scripts used in the Quartz project for generating and processing content related to case law and articles.

## Table of Contents

1. [extract_case_articles.cjs](#extract_case_articlescjs)
2. [process_article_refs.cjs](#process_article_refscjs)
3. [generate-timeline.js](#generate-timelinejs)
4. [generate-case-grid.js](#generate-case-gridjs)
5. [extract_article_rulings.js](#extract_article_rulingsjs)
6. [convert-article-refs.js](#convert-article-refsjs)

---

## extract_case_articles.cjs

This script processes case law files to extract article references and generate two mapping files: cases by article and articles by case.

### Functions

#### `processFiles()`

**Description:** Main function that processes all case law files and generates the mapping files.

**Input:** None (reads files from `content/Case law` directory)

**Output:** 
- `cases_by_article.md`: Lists cases grouped by articles they reference
- `articles_by_case.md`: Lists articles grouped by cases that reference them

**Example Usage:**
```javascript
// Run the script from the command line
node extract_case_articles.cjs
```

#### `caseNumberToFilename(caseNumber)`

**Description:** Converts case numbers to filename format (replacing / with -).

**Input:** String representing a case number (e.g., "2021/123")

**Output:** String with slashes replaced by hyphens (e.g., "2021-123")

**Example:**
```javascript
const filename = caseNumberToFilename("2021/123"); // Returns "2021-123"
```

#### `caseNumberToDisplay(caseNumber)`

**Description:** Converts case numbers to display format (replacing / with ⧸).

**Input:** String representing a case number (e.g., "2021/123")

**Output:** String with slashes replaced by special slash character (e.g., "2021⧸123")

**Example:**
```javascript
const displayFormat = caseNumberToDisplay("2021/123"); // Returns "2021⧸123"
```

#### `extractArticleRefs(text)`

**Description:** Extracts article references from text content.

**Input:** String containing markdown content with article references

**Output:** Array of article numbers (as strings) sorted numerically

**Example:**
```javascript
const content = "This case refers to [[Article 5]] and [[Article 10]].";
const articles = extractArticleRefs(content); // Returns ["5", "10"]
```

---

## process_article_refs.cjs

This script processes markdown files to modify article references (changing bracketed references to plain text for articles with numbers > 99) and creates a log of these modifications.

### Functions

#### `main()`

**Description:** Main function that processes all markdown files and generates a log.

**Input:** None (reads files from `content` directory)

**Output:** 
- Modifies files in place (with backups created)
- Creates `article_modifications.md` with details of all changes

**Example Usage:**
```javascript
// Run the script from the command line
node process_article_refs.cjs
```

#### `getContext(text, matchIndex, matchLength)`

**Description:** Gets context around a matched text (roughly 100 characters before and after).

**Input:**
- `text`: String containing the full text content
- `matchIndex`: Integer position of the match in the text
- `matchLength`: Integer length of the matched text

**Output:** String with context around the match (truncated to complete words)

**Example:**
```javascript
const text = "This is a long text that mentions [[Article 123]] somewhere in the middle.";
const matchIndex = text.indexOf("[[Article 123]]");
const matchLength = "[[Article 123]]".length;
const context = getContext(text, matchIndex, matchLength);
// Returns "...a long text that mentions [[Article 123]] somewhere in the..."
```

#### `processFile(filePath, relativePath, logEntries)`

**Description:** Processes a single file to modify article references and record changes.

**Input:**
- `filePath`: String absolute path to the file
- `relativePath`: String relative path of the file
- `logEntries`: Array to collect log entries

**Output:**
- Boolean indicating whether the file was modified
- Side effect: modifies file and adds entries to logEntries array

**Example:**
```javascript
const logEntries = [];
const wasModified = processFile('/path/to/file.md', 'content/file.md', logEntries);
```

#### `processDirectory(dirPath, basePath, logEntries)`

**Description:** Recursively processes all files in a directory.

**Input:**
- `dirPath`: String path to the directory to process
- `basePath`: String base path for calculating relative paths
- `logEntries`: Array to collect log entries

**Output:** Integer count of modified files

**Example:**
```javascript
const logEntries = [];
const modifiedCount = processDirectory('/path/to/content', '/path/to/content', logEntries);
// Returns number of files modified
```

---

## generate-timeline.js

This script generates an HTML timeline of case law and embeds it into the index.md file.

### Functions

#### `generateTimeline()`

**Description:** Main function that extracts case data, generates the timeline HTML, and updates the index.md file.

**Input:** None (reads files from `content/Case law` directory)

**Output:** Updates `content/index.md` with a timeline HTML section

**Example Usage:**
```javascript
// Run the script from the command line
node generate-timeline.js
```

#### `extractCaseData()`

**Description:** Extracts frontmatter from markdown files in the case law directory.

**Input:** None (reads files from `content/Case law` directory)

**Output:** Array of case objects with metadata, sorted by date (newest first)

**Example Output:**
```javascript
[
  {
    title: "Case Title",
    date: Date object,
    caseNumber: "2023/456",
    caseNumberDisplay: "2023∕456",
    parties: "Party A v Party B",
    topics: ["Topic1", "Topic2"],
    fileName: "2023-456"
  },
  // More cases...
]
```

#### `groupCasesByMonth(caseData)`

**Description:** Groups cases by month and year.

**Input:** Array of case objects from `extractCaseData()`

**Output:** Array of month groups, each containing an array of cases, sorted by date

**Example Output:**
```javascript
[
  {
    month: "December",
    year: 2023,
    cases: [
      {
        // Case data
        formattedDate: "December 15, 2023"
      },
      // More cases from December 2023
    ]
  },
  // More month groups...
]
```

#### `generateTimelineHTML(groupedCases)`

**Description:** Generates HTML for the timeline based on grouped case data.

**Input:** Array of month groups from `groupCasesByMonth()`

**Output:** String containing HTML for the timeline, including styling

**Example Output:**
```html
<div class="timeline-container" style="...">
  <!-- Timeline contents -->
</div>
```

---

## generate-case-grid.js

This script generates an HTML grid view of case law files and saves it to a markdown file.

### Functions

#### `generateCaseGrid()`

**Description:** Main function that extracts case data and generates the case grid HTML.

**Input:** None (reads files from `content/Case law` directory)

**Output:** Creates `content/case-law-grid.md` with an HTML grid view of cases

**Example Usage:**
```javascript
// Run the script from the command line
node generate-case-grid.js
```

#### `extractCaseData()`

**Description:** Extracts frontmatter from markdown files in the case law directory.

**Input:** None (reads files from `content/Case law` directory)

**Output:** Array of case objects with metadata, sorted by date (newest first)

**Example Output:**
```javascript
[
  {
    title: "Case Title",
    date: Date object,
    caseNumber: "2023/456",
    caseNumberDisplay: "2023∕456",
    parties: "Party A v Party B",
    topics: ["Topic1", "Topic2"],
    fileName: "2023-456"
  },
  // More cases...
]
```

#### `formatDate(date)`

**Description:** Formats a Date object to a readable string.

**Input:** JavaScript Date object

**Output:** String formatted date (e.g., "January 12, 2023")

**Example:**
```javascript
const date = new Date("2023-01-12");
const formatted = formatDate(date); // Returns "January 12, 2023"
```

#### `generateGridHTML(caseData)`

**Description:** Generates HTML for the case grid based on case data.

**Input:** Array of case objects from `extractCaseData()`

**Output:** String containing HTML for the case grid, including styling

**Example Output:**
```html
---
title: "Case Law Overview"
---
<style>
  <!-- Styling for case grid -->
</style>
<div class="case-container">
  <!-- Cases listed in grid format -->
</div>
```

---

## extract_article_rulings.js

This script extracts article-specific rulings from case law files and generates a document with rulings organized by GDPR article.

### Functions

#### `extractArticleRulings()`

**Description:** Main function that processes case law files and the key-articles-by-case.md file to generate an organized document of rulings by article.

**Input:** None (reads files from `content/Case law` and `content/key-articles-by-case.md`)

**Output:** Creates `content/article-rulings.md` with rulings organized by article

**Example Usage:**
```javascript
// Run the script from the command line
node extract_article_rulings.js
```

#### `extractArticleNumbers(text)`

**Description:** Extracts article numbers from text content.

**Input:** String containing markdown content with article references

**Output:** Array of article numbers (as strings) sorted numerically

**Example:**
```javascript
const content = "This case refers to [[Article 5]] and [[Article 10]].";
const articles = extractArticleNumbers(content); // Returns ["5", "10"]
```

#### `extractRulesForArticle(rulingText, articleNumber)`

**Description:** Extracts sections of a ruling text that pertain to a specific article.

**Input:**
- `rulingText`: String containing the complete ruling text
- `articleNumber`: String representing the article number to find rules for

**Output:** Array of strings with the relevant paragraphs from the ruling

**Example:**
```javascript
const ruling = "1. Article 6 of Regulation 2016/679 must be interpreted as... 2. Article 9 of Regulation 2016/679 must be interpreted as...";
const rules = extractRulesForArticle(ruling, "6"); // Returns ["Article 6 of Regulation 2016/679 must be interpreted as..."]
```

### Output Format

The generated `article-rulings.md` file has the following structure:

```markdown
# Article Rulings

This document contains rulings organized by GDPR article, showing how each article has been interpreted by the Court of Justice of the European Union.

## [[Article 5]]

### C-123/45 (Party A v Party B)

Article 5 of Regulation 2016/679 must be interpreted as meaning that...

---

## [[Article 6]]

### C-234/56 (Party C v Party D)

Article 6(1) of Regulation 2016/679 must be interpreted as meaning that...

---
```

---

## convert-article-refs.js

This script converts plain text article references in markdown files to Obsidian-compatible wiki links with proper escaping of parenthetical content.

### Functions

#### `Main Function`

**Description:** Processes a markdown file to convert article references to Obsidian wiki links.

**Input:** 
- File path to a markdown document containing article references

**Output:** 
- Modifies the file in place, converting article references to Obsidian wiki links

**Example Usage:**
```javascript
// Run the script from the command line
node convert-article-refs.js content/Case\ law/C-247-23.md
```

### Conversion Examples

#### Basic Article References

**Input:**
```markdown
This case refers to Article 5 and Article 10.
```

**Output:**
```markdown
This case refers to [[Article 5]] and [[Article 10]].
```

#### Article References with Parenthetical Content

**Input:**
```markdown
Article 5(1)(d) establishes the principle of accuracy.
```

**Output:**
```markdown
[[Article 5]](1\)(d) establishes the principle of accuracy.
```

### Implementation Details

The script uses a regular expression to identify article references in the following formats:
- Simple references: `Article X` (where X is a number)
- References with parenthetical content: `Article X(Y)` (where Y can contain any characters except closing parentheses)

For references with parenthetical content, the script:
1. Extracts the article number
2. Creates an Obsidian wiki link for the article: `[[Article X]]`
3. Escapes any nested parentheses in the parenthetical content
4. Adds the parenthetical content after the wiki link: `[[Article X]](Y\)`

This ensures that the links work properly in Obsidian while maintaining the original meaning and structure of the references.

---

## Additional Information

These scripts are used to generate and maintain reference files and visual elements for the Quartz project. They should be run whenever:

1. New case law files are added
2. Article references are updated
3. The timeline display needs refreshing

To run any script:

```bash
# For CommonJS scripts
node extract_case_articles.cjs
node process_article_refs.cjs

# For ES modules
node generate-timeline.js
node generate-case-grid.js
node extract_article_rulings.js
``` 