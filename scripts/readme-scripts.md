# Project Scripts

This document provides an overview of the scripts located in the `scripts` directory, detailing their purpose and functionality.

## `check_frontmatter.js`

-   **Purpose**: Validates the YAML frontmatter of all markdown files located within the `content` directory.
-   **Functionality**:
    -   Recursively scans the `content` directory for `.md` files.
    -   For each file, it checks if YAML frontmatter is present and if it's valid.
    -   Logs errors to the console if frontmatter is missing or contains syntax errors, indicating the problematic file and the nature of the error.
-   **Input Example** (`content/example.md`):
    ```markdown
    ---
    title: Test
    date: 2023-01-01
    invalid_yaml: : this is broken
    ---
    File content.
    ```
-   **Output Example** (Console):
    ```
    ❌ Invalid frontmatter in: content/example.md
       Error: YAMLException: unexpected character ":" at line 4, column 19:
         invalid_yaml: : this is broken
                       ^
    ...
    ✅ Frontmatter check complete!
    ```

## `convert-article-refs.js`

-   **Purpose**: Converts plain text references to GDPR articles into Obsidian-style wiki links within a specified file.
-   **Functionality**:
    -   This is a command-line interface (CLI) script.
    -   Takes a file path as an argument.
    -   Reads the specified file and searches for patterns like "Article X" or "Article X(Y)".
    -   Replaces these found patterns with `[[Article X]]` or `[[Article X]](Y)` respectively.
    -   Overwrites the original file with the modified content.
-   **Input Example** (CLI: `node convert-article-refs.js content/sample.md`):
  `content/sample.md` before:
    ```markdown
    This refers to Article 5 and Article 6(1)(a).
    ```
-   **Output Example**:
  `content/sample.md` after:
    ```markdown
    This refers to [[Article 5]] and [[Article 6]](1)(a).
    ```
-   Console:
    ```
    Successfully converted article references in content/sample.md
    ```

## `extract_article_rulings.js`

-   **Purpose**: To generate a markdown document (`content/article-rulings.md`) that organizes excerpts of case law rulings by the specific GDPR articles they interpret.
-   **Functionality**:
    -   Reads an input file, `content/key-articles-by-case.md`, which maps GDPR articles to lists of relevant case law files.
    -   Iterates through case law files found in `content/Case law`.
    -   For each case associated with a particular article (from the input map), it extracts the `final-ruling` text from the case file's frontmatter.
    -   It then identifies and extracts specific paragraphs or points within this `final-ruling` text that explicitly mention the article in question.
    -   Compiles these extracted ruling excerpts, organizing them under headings for each GDPR article.
-   **Input Example**:
  `content/key-articles-by-case.md`:
    ```markdown
    #### [[Article 6]]
    - [[C-100-20|C-100∕20 (Test Parties)]]
    ```
  `content/Case law/C-100-20.md` (frontmatter):
    ```yaml
    case-number: C-100/20
    parties: Test Parties
    final-ruling: |
      1. First point.
      2. Concerning Article 6, the interpretation is foo.
      3. Third point.
    ```
-   **Output Example** (`content/article-rulings.md`):
    ```markdown
    # Article Rulings
    ...
    ## [[Article 6]]
    **C-100∕20 (Test Parties)** - [[C-100-20]]
    > 2. Concerning Article 6, the interpretation is foo.
    ---
    ```

## `extract_case_articles.cjs`

-   **Purpose**: To generate comprehensive cross-reference markdown files linking case law documents to all GDPR articles mentioned within them, and vice-versa.
-   **Functionality**:
    -   Scans all markdown files in the `content/Case law` directory.
    -   For each file, it extracts *all* references to GDPR articles (e.g., `[[Article X]]`, `Article X(Y)`) found anywhere in the entire file content (including frontmatter).
    -   It builds two mappings: one from cases to the articles they mention, and another from articles to the cases that mention them.
-   **Input Example** (`content/Case law/C-101-21.md`):
    ```markdown
    ---
    case-number: C-101/21
    parties: "Org A vs Org B"
    ruling-articles: # This field is also checked by the script
      - Article 5
    ---
    This document mentions [[Article 7]] and Article 8(1).
    ```
-   **Output Example**:
  `cases_by_article.md` (in root):
    ```markdown
    #### C-101/21 (Org A vs Org B)
    - [[Article 5]]
    - [[Article 7]]
    - [[Article 8]]
    ---
    ```
  `articles_by_case.md` (in root):
    ```markdown
    #### [[Article 5]]
    - [[C-101-21|C-101∕21 (Org A vs Org B)]]
    ---
    (Similar entries for Article 7 and 8)
    ```

## `extract_gdpr_articles.js`

-   **Purpose**: To enrich specific case law files by extracting GDPR article references from their `final-ruling` frontmatter and attempting to find corresponding textual interpretations within the ruling.
-   **Functionality**:
    -   Processes a predefined list of specific case law files (e.g., `C-129-21.md`, `C-180-21.md`) located in `content/Case law`.
    -   For each specified file:
        -   Parses the YAML frontmatter and checks if the `final-ruling` field mentions GDPR.
        -   If GDPR-related, it extracts all unique GDPR article numbers (e.g., "Article 5", "Article 6") from the `final-ruling` text.
        -   For each extracted article, it attempts to find relevant interpretative text (e.g., numbered paragraphs discussing that article) within the `final-ruling`.
        -   Creates a backup of the original file (`.bak_auto`).
        -   Updates the original file's frontmatter by adding/updating two fields:
            -   `ruling-articles`: An array of the unique GDPR article numbers found.
            -   `per-article`: An array of strings, each formatted as "Article X | Extracted interpretation text...".
-   **Input Example** (`content/Case law/C-129-21.md` - one of the hardcoded targets):
    ```yaml
    # Frontmatter before
    case-number: C-129/21
    final-ruling: |
      Regulation (EU) 2016/679 is relevant.
      Point 1 discusses Article 5. Point 2 is about Article 6(a).
    ---
    ```
-   **Output Example** (`content/Case law/C-129-21.md` - frontmatter after, `.bak_auto` also created):
    ```yaml
    # Frontmatter after
    case-number: C-129/21
    final-ruling: |
      Regulation (EU) 2016/679 is relevant.
      Point 1 discusses Article 5. Point 2 is about Article 6(a).
    ruling-articles:
      - Article 5
      - Article 6
    per-article:
      - "Article 5 | Point 1 discusses Article 5." # Simplified example of interpretation extraction
      - "Article 6 | Point 2 is about Article 6(a)."
    ---
    ```

## `extract_key_articles.cjs`

-   **Purpose**: To generate cross-reference markdown files based on "key" GDPR articles explicitly listed in the frontmatter of case law documents.
-   **Functionality**:
    -   Scans all markdown files in the `content/Case law` directory.
    -   For each file, it specifically looks for and extracts article references from the `ruling-articles` array in its YAML frontmatter. These are considered the "key" articles for that case.
    -   It then builds two mappings based on these key articles.
-   **Input Example** (`content/Case law/C-102-22.md` frontmatter):
    ```yaml
    case-number: C-102/22
    parties: "X vs Y"
    ruling-articles:
      - Article 25
      - Article 32
    ```
-   **Output Example**:
  `cases-by-key-articles.md` (in root):
    ```markdown
    #### C-102/22 (X vs Y)
    - [[Article 25]]
    - [[Article 32]]
    ---
    ```
  `key-articles-by-case.md` (in root):
    ```markdown
    #### [[Article 25]]
    - [[C-102-22|C-102∕22 (X vs Y)]]
    ---
    #### [[Article 32]]
    - [[C-102-22|C-102∕22 (X vs Y)]]
    ---
    ```

## `generate-case-grid.js`

-   **Purpose**: Creates a styled HTML overview page listing all case law documents.
-   **Functionality**:
    -   Reads all markdown files from the `content/Case law` directory.
    -   Extracts metadata from each file's frontmatter, including `title`, `date`, `parties`, `case-number`, and `topics`.
    -   Sorts the cases by date (newest first).
    -   Generates an HTML structure where each case is an item displaying its details and linking to the respective case file.
    -   Includes CSS for styling the grid.
-   **Input Example** (`content/Case law/C-103-23.md` frontmatter):
    ```yaml
    title: "The Big Case"
    date: 2023-03-10
    case-number: C-103/23
    parties: "Alpha Inc. vs Beta LLC"
    topics:
      - Right to Erasure
      - Data Portability
    ```
-   **Output Example** (`content/case-law-grid.md` excerpt):
    ```html
    ---
    title: "Case Law Overview"
    ---
    <style>...</style>
    <div class="case-container">
      ...
      <div class="case-item">
        <a href="Case%20law/C-103-23" class="case-link">
          <div class="case-header">
            <span class="case-number">C-103∕23</span>
            <span class="case-title">Alpha Inc. vs Beta LLC</span>
            <span class="case-date">March 10, 2023</span>
          </div>
          <div class="case-topics">Right to Erasure • Data Portability</div>
        </a>
      </div>
      ...
    </div>
    ```

## `generate-timeline.js`

-   **Purpose**: Generates an HTML timeline of case law and injects it into the main index page.
-   **Functionality**:
    -   Extracts metadata (title, date, case number, parties, topics) from markdown files in `content/Case law`.
    -   Sorts cases by date.
    -   Groups cases by month and year.
    -   Generates an HTML representation of a timeline, with each case as an entry.
    -   Reads `content/index.md`, finds specific placeholder comments, and injects the generated HTML timeline between them.
-   **Input Example**:
  `content/Case law/C-103-23.md` (frontmatter similar to `generate-case-grid.js` example)
  `content/index.md` before:
    ```markdown
    Welcome to the site.
    <!-- TIMELINE_START -->
    <!-- TIMELINE_END -->
    More info here.
    ```
-   **Output Example** (`content/index.md` after, excerpt of injected HTML):
    ```markdown
    Welcome to the site.
    <!-- TIMELINE_START -->
    <div class="timeline-container">
      ...
      <div class="timeline-item" style="...">
        <a href="Case%20law/C-103-23" style="...">C-103∕23</a>
        <div class="case-title" style="..."><a href="Case%20law/C-103-23" style="...">Alpha Inc. vs Beta LLC</a></div>
        ...
      </div>
      ...
    </div>
    <!-- TIMELINE_END -->
    More info here.
    ```

## `process-md-files.js`

-   **Purpose**: Updates markdown files based on content and frontmatter provided in corresponding `_response.md` files.
-   **Functionality**:
    -   Operates on a specified directory (or the current directory by default).
    -   Looks for `*_response.md` files. For each, it expects a corresponding original file (e.g., `my-doc_response.md` implies `my-doc.md`).
    -   If the original file exists:
        -   Creates a backup of the original (e.g., `my-doc.md.backup`).
        -   Reads the `_response.md` file, which should contain:
            -   A YAML block for frontmatter.
            -   A JSON block with an array of `{"sentence_original": "...", "sentence_fixed": "..."}` pairs.
        -   Removes existing frontmatter from the original file.
        -   Performs find-and-replace operations on the original file's content based on the JSON sentence pairs.
        -   Constructs new frontmatter using the YAML from `_response.md`, adding a `title` derived from the original filename (e.g., "C-123-45" becomes "C-123/45").
        -   Overwrites the original file with the new frontmatter and modified content.
-   **Input Example**:
  `my-doc.md` before:
    ```markdown
    ---
    old-title: An old title
    ---
    This is sentence one. This is sentence two.
    ```
  `my-doc_response.md`:
    ```markdown
    ```yaml
    # This is YAML frontmatter to apply
    new_field: Some Value
    tags: [updated, reviewed]
    ```
    ===
    ```json
    [
      {"sentence_original": "This is sentence one.", "sentence_fixed": "This is the updated first sentence."}
    ]
    ```
    ```
-   **Output Example**:
  `my-doc.md` after (assuming filename `my-doc.md` and `formatTitleFromFilename` logic):
    ```markdown
    ---
    title: my/doc # Title derived from filename
    new_field: Some Value
    tags: [updated, reviewed]
    ---
    This is the updated first sentence. This is sentence two.
    ```
  `my-doc.md.backup` created with original content.

## `process_article_refs.cjs`

-   **Purpose**: To find specific Obsidian-style article links (for articles with numbers > 99) in markdown files, convert them to plain text, and log the changes.
-   **Functionality**:
    -   Recursively scans all markdown files within the `content` directory (excluding `.git`, `node_modules`, `.obsidian`).
    -   Searches for links formatted as `[[Article ###]]` where `###` is a number greater than 99.
    -   When a match is found:
        -   A backup of the original file is created in the `backup_content` directory, preserving the relative path.
        -   The link (e.g., `[[Article 101]]`) is replaced with plain text (e.g., `Article 101`) in the original file.
        -   The change (file path, article number, and surrounding context) is recorded.
-   **Input Example** (`content/folder/note.md`):
    ```markdown
    Reference to [[Article 150]] and [[Article 20]].
    ```
-   **Output Example**:
  `content/folder/note.md` after:
    ```markdown
    Reference to Article 150 and [[Article 20]].
    ```
  `backup_content/folder/note.md` (contains original content).
  `article_modifications.md` (in root, excerpt):
    ```markdown
    ## content/folder/note.md
    - **Article 150**: ...Reference to [[Article 150]] and...
    ```

## `sorttopics.cjs`

-   **Purpose**: To generate cross-reference markdown files based on `topics` listed in the frontmatter of markdown files in the current directory.
-   **Functionality**:
    -   Meant to be run from a directory containing markdown files (e.g., `content/Case law`).
    -   Reads all `.md` files in its current working directory.
    -   For each file, it extracts the `topics` array from its YAML frontmatter.
    -   Generates two new markdown files in the same directory, with alphabetically sorted lists:
        -   `topics-by-file.md`: Lists each file (as `[[filename]]`) and its associated topics.
        -   `files-by-topic.md`: Lists each unique topic and the files (as `[[filename]]`) tagged with it.
-   **Input Example** (assuming script run in `content/Case law/`):
  `content/Case law/caseA.md` frontmatter:
    ```yaml
    topics:
      - Topic X
      - Topic Y
    ```
  `content/Case law/caseB.md` frontmatter:
    ```yaml
    topics:
      - Topic Y
      - Topic Z
    ```
-   **Output Example**:
  `content/Case law/topics-by-file.md`:
    ```markdown
    - [[caseA]]
    topics:
    - Topic X
    - Topic Y

    - [[caseB]]
    topics:
    - Topic Y
    - Topic Z
    ```
  `content/Case law/files-by-topic.md`:
    ```markdown
    Topic X:
    [[caseA]]

    Topic Y:
    [[caseA]]
    [[caseB]]

    Topic Z:
    [[caseB]]
    ```

## `titlesfromheading.cjs`

-   **Purpose**: A utility to automatically add basic YAML frontmatter (`title` and `subtitle`) to markdown files in its own directory that currently lack any frontmatter.
-   **Functionality**:
    -   Processes all `.md` files located in the same directory as the script.
    -   For each file:
        -   Checks if it already starts with `---` (indicating existing frontmatter). If yes, skips it.
        -   If no frontmatter, it looks for the first H2 heading (e.g., `## My Heading`).
        -   If an H2 heading is found, it creates frontmatter:
            -   `title` is set to the filename (without the `.md` extension).
            -   `subtitle` is set to the text of the H2 heading.
        -   Prepends this new frontmatter to the file and overwrites it.
-   **Input Example** (`myscriptdir/sample-note.md`, assuming script is in `myscriptdir/`):
    ```markdown
    ## This is My Note's Subtitle
    Some interesting content.
    ```
    (No frontmatter at the start of the file)
-   **Output Example** (`myscriptdir/sample-note.md` after):
    ```markdown
    ---
    title: "sample-note"
    subtitle: "This is My Note's Subtitle"
    ---
    ## This is My Note's Subtitle
    Some interesting content.
    ```
 