#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all .md files in the current directory
const directory = __dirname;
const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.md') && !file.includes('.backup') && file !== 'frontmatter.md');

let outputContent = '';

// Process each file
files.forEach(filename => {
    try {
        const filePath = path.join(directory, filename);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract frontmatter (content between the first two '---' markers)
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

        if (match && match[1]) {
            const frontmatter = match[1];

            // Add to output with the requested format
            outputContent += `${filename}\n\n---\n${frontmatter}\n---\n\n`;
        }
    } catch (error) {
        console.error(`Error processing ${filename}:`, error);
    }
});

// Write the combined frontmatter to a new file
const outputPath = path.join(directory, 'frontmatter.md');
fs.writeFileSync(outputPath, outputContent);

console.log(`Frontmatter extracted from ${files.length} files and combined into frontmatter.md`); 