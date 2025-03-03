# Progress Log - Content Formatting Changes

## Case Law Link Display
1. Initially tried HTML encoding (`&#47;`) for forward slashes in case law numbers
2. Experimented with angle brackets to escape forward slashes
3. Finally settled on using mathematical slash (⧸) character as the cleanest solution
4. Created regex pattern to replace forward slashes in case law numbers after pipe character:
   ```
   Search: (\|[^|\]]*?C-\d+)/(\d+)
   Replace: $1⧸$2
   ```
   This transforms `[[C-184-20|C-184/20]]` to `[[C-184-20|C-184⧸20]]`

## Article Reference Formatting
1. Added escape character after numbers in article references
2. Created regex pattern to add backslash after parenthetical numbers following wikilinks:
   ```
   Search: (\[\[[^\]]+\]\])\((\d+)\)
   Replace: $1($2\)
   ```
   This transforms `[[Article 88]](1)` to `[[Article 88]](1\)`

## Question Heading Formatting
1. Created regex pattern to add ### to question headings that don't already have heading markers:
   ```
   Search: ^(?!#)(?:(?:The\s+(?:(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:\s+and\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth))?)\s+questions?)|(?:Questions?\s+\d+(?:\s+(?:to|and)\s+\d+)?))$
   Replace: ### $0
   ```
   This transforms:
   - "The first question" → "### The first question"
   - "The first and second questions" → "### The first and second questions"
   - "Question 1" → "### Question 1"
   - "Questions 1 and 2" → "### Questions 1 and 2"
   - "Questions 3 to 5" → "### Questions 3 to 5"

## File Structure
- Maintained `/Case-law/` prefix for case law files
- Preserved original case number format in file paths (e.g., `C-184-20.md`)
- Display text shows formatted version with mathematical slash (e.g., `C-184⧸20`)

## Cleanup Required
Since we've manually transformed the content:
1. Remove the custom case-law transformer (`quartz/plugins/transformers/case-law.ts`) as it's no longer needed
2. Remove the transformer from the Quartz configuration file
3. The content now handles formatting directly in markdown, making the transformer unnecessary

## Next Steps
- [x] Apply case law number formatting across all existing files
- [x] Apply article reference escaping across all existing files
- [ ] Remove unnecessary transformer code
- [ ] Document these formatting standards for future content creation
- [ ] Consider creating templates or snippets for common formats