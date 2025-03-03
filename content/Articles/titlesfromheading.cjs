const fs = require('fs');
const path = require('path');

// Get all markdown files in current directory
const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.md'));

// Process each file
files.forEach(file => {
    const filePath = path.join(__dirname, file);

    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Extract the filename without extension to use as title
    const fileTitle = path.basename(file, '.md');

    // Check if the file already has YAML frontmatter
    if (content.startsWith('---')) {
        console.log(`${file} already has frontmatter, skipping`);
        return;
    }

    // Extract the first h2 heading
    const headingMatch = content.match(/^## (.+?)$/m);

    if (headingMatch) {
        const subtitle = headingMatch[1].trim();

        // Create YAML frontmatter
        const yamlFrontmatter = `---
title: "${fileTitle}"
subtitle: "${subtitle}"
---
`;

        // Add frontmatter to content
        const newContent = yamlFrontmatter + content;

        // Write the modified content back to the file
        fs.writeFileSync(filePath, newContent);

        console.log(`Added frontmatter to ${file}`);
    } else {
        console.log(`No h2 heading found in ${file}, skipping`);
    }
});

console.log("Process completed. YAML frontmatter added to files.");