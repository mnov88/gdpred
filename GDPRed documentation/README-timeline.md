# Case Law Timeline Generator

This script generates a beautiful timeline visualization of your case law markdown files in your Quartz project.

## How it Works

The script:
1. Reads all markdown files in the `content/Case law` directory
2. Extracts metadata from the frontmatter (title, date, case number, parties, topics)
3. Groups cases by month and year
4. Generates HTML for a responsive timeline visualization
5. Outputs the result to `content/case-law-timeline.md`

## Requirements

- Node.js installed
- ES Modules support (the script uses ES modules syntax)

## Installation

The Quartz project already has the required `gray-matter` dependency, so no additional dependencies need to be installed.

## Usage

Run the generator script:

```bash
node generate-timeline.js
```

After running, you'll find a new file at `content/case-law-timeline.md` containing your timeline. This file can be viewed directly in your Quartz site.

## Customization

You can customize the script by editing `generate-timeline.js`:

- Change colors, fonts, and styling
- Modify the number of topics shown for each case
- Change the sorting order
- Add additional metadata fields

## Features

- Responsive design (works on mobile and desktop)
- Cases grouped by month and year
- Links to individual case files
- Display of key metadata (case number, parties, topics)
- Modern, clean design with timeline visualization 