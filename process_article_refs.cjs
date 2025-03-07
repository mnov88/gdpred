const fs = require('fs');
const path = require('path');

// Directory containing content
const contentDir = path.join(__dirname, 'content');
const backupDir = path.join(__dirname, 'backup_content');

// Create backup directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Function to get context around a match (roughly 20 words)
function getContext(text, matchIndex, matchLength) {
    // Approximate 100 characters before and after the match
    const contextStart = Math.max(0, matchIndex - 100);
    const contextEnd = Math.min(text.length, matchIndex + matchLength + 100);

    let context = text.substring(contextStart, contextEnd);

    // Trim to complete words
    if (contextStart > 0) {
        const firstSpaceIndex = context.indexOf(' ');
        if (firstSpaceIndex !== -1) {
            context = context.substring(firstSpaceIndex + 1);
        }
    }

    if (contextEnd < text.length) {
        const lastSpaceIndex = context.lastIndexOf(' ');
        if (lastSpaceIndex !== -1) {
            context = context.substring(0, lastSpaceIndex);
        }
    }

    return `...${context}...`;
}

// Function to process a file
function processFile(filePath, relativePath, logEntries) {
    // Skip non-markdown files
    if (!filePath.endsWith('.md')) return false;

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Regex to find [[Article ###]] where ### > 99
    const regex = /\[\[Article\s+(\d+)\]\]/g;
    let match;
    let modified = false;
    let modifiedContent = content;

    // Check for matches
    while ((match = regex.exec(content)) !== null) {
        const articleNumber = parseInt(match[1], 10);

        // Only process if article number > 99
        if (articleNumber > 99) {
            modified = true;

            // Get context around the match
            const context = getContext(content, match.index, match[0].length);

            // Add to log entries
            logEntries.push({
                file: relativePath,
                articleNumber,
                context
            });

            // Replace [[Article ###]] with Article ###
            modifiedContent = modifiedContent.replace(
                match[0],
                `Article ${match[1]}`
            );
        }
    }

    if (modified) {
        // Create backup path - maintain relative directory structure
        const relativeDir = path.dirname(relativePath);
        const backupPath = path.join(backupDir, relativeDir);

        // Create backup directory if it doesn't exist
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        // Write backup file
        const backupFilePath = path.join(backupDir, relativePath);
        fs.writeFileSync(backupFilePath, content);

        // Write modified content
        fs.writeFileSync(filePath, modifiedContent);

        return true;
    }

    return false;
}

// Function to recursively process directory
function processDirectory(dirPath, basePath, logEntries) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let modifiedFiles = 0;

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
            // Skip .git and node_modules
            if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.obsidian') {
                continue;
            }

            // Process subdirectory
            modifiedFiles += processDirectory(fullPath, basePath, logEntries);
        } else {
            // Process file
            if (processFile(fullPath, relativePath, logEntries)) {
                modifiedFiles++;
            }
        }
    }

    return modifiedFiles;
}

// Main function
async function main() {
    const logEntries = [];

    console.log('Starting to process files...');

    // Process all files in content directory
    const modifiedFiles = processDirectory(contentDir, contentDir, logEntries);

    // Generate log file
    let logContent = `# Article Reference Modifications Log\n\n`;
    logContent += `*${logEntries.length} references to articles with numbers > 99 were modified across ${modifiedFiles} files.*\n\n`;

    // Group log entries by file
    const fileGroups = {};
    for (const entry of logEntries) {
        if (!fileGroups[entry.file]) {
            fileGroups[entry.file] = [];
        }
        fileGroups[entry.file].push(entry);
    }

    // Generate log content for each file
    for (const [file, entries] of Object.entries(fileGroups)) {
        logContent += `## ${file}\n\n`;

        for (const entry of entries) {
            logContent += `- **Article ${entry.articleNumber}**: ${entry.context}\n\n`;
        }
    }

    // Write log file
    fs.writeFileSync('article_modifications.md', logContent);

    console.log(`Processing complete!`);
    console.log(`- Modified ${modifiedFiles} files`);
    console.log(`- Found ${logEntries.length} references to articles with numbers > 99`);
    console.log(`- Log file written to article_modifications.md`);
}

// Run the main function
main().catch(err => {
    console.error('Error processing files:', err);
}); 