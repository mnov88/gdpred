#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const TurndownService = require('turndown');

// Initialize turndown
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

// Get command line arguments
const args = process.argv.slice(2);

// Function to convert HTML to Markdown
function convertHTMLToMarkdown(htmlContent) {
    return turndownService.turndown(htmlContent);
}

// Function to post-process markdown content
function postProcessMarkdown(markdownContent) {
    // Define the regex patterns to match
    const patterns = [
        /^\d+\.$/,                  // 1. 2. 3.
        /^\d+$/,                    // 1 2 3
        /^\(\d+\)$/,                // (1) (2) (3)
        /^\([a-zA-Z]\)$/,           // (a) (b) (c)
        /^[ivxIVX]+\.$/,            // i. ii. iii.
        /^\([ivxIVX]+\)$/,          // (i) (ii) (iii)
        /^[a-zA-Z]\.$/,             // a. b. c.
        /^\([a-zA-Z]{1,2}\)$/,      // (a) (b) (aa)
        /^\*$/,                     // *
        /^•$/,                      // •
        /^–$/,                      // –
        /^—$/,                      // —
        /^[:;.,!?"'()]+$/,          // Lines with only punctuation
        /^[:;.,!?"'()\d]+$/,        // Punctuation and numbers
        /^\d+-[a-zA-Z]$/,           // 1-a, 2-b
        /^\d+[a-zA-Z]+$/,           // 1a, 2b
        /^\d+\)$/,                  // 1), 2)
        /^[a-zA-Z]\)$/,             // a), b)
        /^\d+-\d+$/,                // 1-1, 2-3
        /^\d+-[a-zA-Z]+$/,          // 1-ab, 2-cd
        /^[a-zA-Z]+-\d+$/,          // ab-1, cd-2
        /^[a-zA-Z]+\d+$/,           // ab1, cd2
        /^[a-zA-Z]{1,2}\d+\)$/,     // a1), ab2)
        /^\d+[a-zA-Z]{1,2}\)$/,     // 1a), 2ab)
        /^[a-zA-Z]{1,2}\d+$/,       // ab12, cd34
        /^[a-zA-Z]\d+-[a-zA-Z]\d+$/ // a1-b2, c3-d4
    ];

    // Split the content into lines
    let lines = markdownContent.split('\n');
    let processedLines = [];
    let i = 0;

    while (i < lines.length) {
        const currentLine = lines[i].trim();

        // Check if the current line matches any of the patterns
        const isMatch = patterns.some(pattern => pattern.test(currentLine));

        if (isMatch) {
            // Find the next non-empty line
            let nextNonEmptyIndex = i + 1;
            while (nextNonEmptyIndex < lines.length && lines[nextNonEmptyIndex].trim() === '') {
                nextNonEmptyIndex++;
            }

            if (nextNonEmptyIndex < lines.length) {
                // Merge the current line with the next non-empty line
                const mergedLine = currentLine + ' ' + lines[nextNonEmptyIndex].trim();
                processedLines.push(mergedLine);

                // Skip the next line since we've merged it
                i = nextNonEmptyIndex + 1;
            } else {
                // No next line to merge with, keep the current line as is
                processedLines.push(currentLine);
                i++;
            }
        } else {
            // Keep non-matching lines as they are
            processedLines.push(currentLine);
            i++;
        }
    }

    // Standardize to have exactly two newlines between paragraphs
    // First, join all lines and split by one or more newlines
    const paragraphs = processedLines.join('\n').split(/\n+/).filter(p => p.trim() !== '');

    // Then join with double newlines
    return paragraphs.join('\n\n');
}

// Function to convert a single file
function convertFile(inputPath, outputPath) {
    try {
        // If outputPath is not provided, generate it based on inputPath
        if (!outputPath) {
            const inputExt = path.extname(inputPath);
            outputPath = inputPath.replace(inputExt, '.md');
        }

        // Read HTML content
        const htmlContent = fs.readFileSync(inputPath, 'utf8');

        // Convert HTML to Markdown
        const markdownContent = convertHTMLToMarkdown(htmlContent);

        // Post-process the markdown content
        const processedContent = postProcessMarkdown(markdownContent);

        // Write processed Markdown content to output file
        fs.writeFileSync(outputPath, processedContent, 'utf8');

        console.log(`Converted ${inputPath} to ${outputPath}`);
    } catch (error) {
        console.error(`Error converting ${inputPath}: ${error.message}`);
    }
}

// Function to convert all HTML files in a directory
function convertDirectory(inputDir, outputDir) {
    try {
        // If outputDir is not provided, generate it based on inputDir
        if (!outputDir) {
            outputDir = `${inputDir}-md`;
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get all files in input directory
        const files = fs.readdirSync(inputDir);

        // Filter HTML files and convert them
        let convertedCount = 0;
        const htmlFiles = files.filter(file => {
            const stat = fs.statSync(path.join(inputDir, file));
            return stat.isFile() && path.extname(file).toLowerCase() === '.html';
        });

        console.log(`Found ${htmlFiles.length} HTML files in ${inputDir} to convert`);

        // Store original file count for verification
        const originalHtmlCount = htmlFiles.length;

        htmlFiles.forEach(file => {
            const inputPath = path.join(inputDir, file);

            // Generate output path
            const outputFileName = file.replace(/\.html$/i, '.md');
            const outputPath = path.join(outputDir, outputFileName);

            // Convert file - this only reads from input and writes to output
            // It does NOT modify or delete the original HTML file
            convertFile(inputPath, outputPath);
            convertedCount++;
        });

        // Verify that HTML files still exist in the input directory
        const remainingHtmlFiles = fs.readdirSync(inputDir).filter(file =>
            path.extname(file).toLowerCase() === '.html'
        );

        if (remainingHtmlFiles.length !== originalHtmlCount) {
            console.error(`WARNING: Some HTML files may be missing from ${inputDir}!`);
            console.error(`Expected: ${originalHtmlCount}, Found: ${remainingHtmlFiles.length}`);
        }

        if (convertedCount > 0) {
            console.log(`Converted ${convertedCount} HTML files from ${inputDir} to ${outputDir}`);
            console.log(`Original HTML files remain in ${inputDir}`);
        } else {
            console.log(`No HTML files found in ${inputDir}`);
        }
    } catch (error) {
        console.error(`Error converting directory ${inputDir}: ${error.message}`);
    }
}

// Main function
function main() {
    // Check if arguments are provided
    if (args.length === 0) {
        console.log('Usage:');
        console.log('  node html-to-md.js file.html                  # Converts file.html to file.md in same directory');
        console.log('  node html-to-md.js file.html output.md        # Converts file.html to output.md');
        console.log('  node html-to-md.js input-dir                  # Converts all HTML files in input-dir to markdown in input-dir-md');
        console.log('  node html-to-md.js input-dir output-dir       # Converts all HTML files in input-dir to markdown in output-dir');
        return;
    }

    const inputPath = args[0];
    const outputPath = args[1]; // Can be undefined

    // Check if input path exists
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: ${inputPath} does not exist`);
        return;
    }

    // Check if input path is a file or directory
    const stat = fs.statSync(inputPath);

    if (stat.isFile()) {
        // Case 1 and 2: Convert a single file
        convertFile(inputPath, outputPath);
    } else if (stat.isDirectory()) {
        // Case 3 and 4: Convert all HTML files in a directory
        convertDirectory(inputPath, outputPath);
    } else {
        console.error(`Error: ${inputPath} is neither a file nor a directory`);
    }
}

// Run the main function
main();