#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the command line arguments
const args = process.argv.slice(2);

// Check if a file path is provided as an argument
if (args.length < 1) {
    console.error('Usage: node convert-article-refs.js <file-path>');
    process.exit(1);
}

const filePath = args[0];

// Read the file content
try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regular expression to match article references
    // This regex matches "Article X" or "Article X(Y)" patterns
    const articleRegex = /\b(Article\s+\d+)(\([^)]+\))?/g;

    // Replace article references with Obsidian links
    content = content.replace(articleRegex, (match, articleRef, parenthetical) => {
        if (parenthetical) {
            // Extract the content inside the parentheses (without the parentheses themselves)
            const innerContent = parenthetical.substring(1, parenthetical.length - 1);

            // Escape any nested parentheses in the inner content
            const escapedInnerContent = innerContent.replace(/\(/g, '\\(').replace(/\)/g, '\\)');

            // Return the properly formatted link with unescaped outer parentheses
            return `[[${articleRef}]](${escapedInnerContent})`;
        } else {
            return `[[${articleRef}]]`;
        }
    });

    // Write the modified content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully converted article references in ${filePath}`);
} catch (error) {
    console.error(`Error processing file: ${error.message}`);
    process.exit(1);
} 