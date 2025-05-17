#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple function to extract YAML front matter from markdown content
function extractFrontMatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match || !match[1]) return null;

    const yamlStr = match[1];
    const frontMatter = {};

    // Extract topics specifically
    const topicsMatch = yamlStr.match(/topics:\s*\n((?:\s*-\s*.*\n)*)/);
    if (topicsMatch && topicsMatch[1]) {
        const topicsLines = topicsMatch[1].split('\n').filter(line => line.trim());
        frontMatter.topics = topicsLines.map(line => {
            // Extract the actual topic text (removing the dash and whitespace)
            const topicMatch = line.match(/\s*-\s*"?(.*?)"?\s*$/);
            return topicMatch ? topicMatch[1].trim() : '';
        }).filter(topic => topic);
    }

    return frontMatter;
}

// Get all MD files in the current directory
function getMdFiles() {
    const files = fs.readdirSync('.');
    return files.filter(file => path.extname(file).toLowerCase() === '.md');
}

// Main function
function main() {
    const mdFiles = getMdFiles();
    console.log(`Found ${mdFiles.length} markdown files`);

    // Data structures to hold our results
    const fileTopics = {}; // For the first output file (topics by file)
    const topicFiles = {}; // For the second output file (files by topic)

    // Process each file
    mdFiles.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const frontMatter = extractFrontMatter(content);

            if (frontMatter && frontMatter.topics && frontMatter.topics.length > 0) {
                // Extract filename without extension
                const fileNameNoExt = path.basename(file, '.md');

                // Store for the first output (file -> topics)
                fileTopics[fileNameNoExt] = frontMatter.topics;

                // Store for the second output (topic -> files)
                frontMatter.topics.forEach(topic => {
                    if (!topicFiles[topic]) {
                        topicFiles[topic] = [];
                    }
                    if (!topicFiles[topic].includes(fileNameNoExt)) {
                        topicFiles[topic].push(fileNameNoExt);
                    }
                });
            } else {
                console.warn(`No topics found in ${file} or invalid format`);
            }
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    });

    // Generate the first output file (topics by file)
    let fileTopicsOutput = '';
    Object.keys(fileTopics).sort().forEach(file => {
        fileTopicsOutput += `- [[${file}]]\ntopics:\n`;
        fileTopics[file].sort().forEach(topic => {
            fileTopicsOutput += `- ${topic}\n`;
        });
        fileTopicsOutput += '\n';
    });

    // Generate the second output file (files by topic)
    let topicFilesOutput = '';
    Object.keys(topicFiles).sort().forEach(topic => {
        topicFilesOutput += `${topic}:\n`;
        topicFiles[topic].sort().forEach(file => {
            topicFilesOutput += `[[${file}]]\n`;
        });
        topicFilesOutput += '\n';
    });

    // Write the output files
    fs.writeFileSync('topics-by-file.md', fileTopicsOutput);
    fs.writeFileSync('files-by-topic.md', topicFilesOutput);

    console.log('Generated files:');
    console.log('- topics-by-file.md');
    console.log('- files-by-topic.md');
}

// Run the script
main();