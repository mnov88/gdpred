/**
 * Test script for the EUR-Lex Case Reference Scraper
 * 
 * This script runs the scraper with a test CELEX number and verifies that
 * the output files are created correctly.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test CELEX number
const testCelex = '32016R0679'; // GDPR

// Run the scraper with the test CELEX number and skip downloading HTML files
console.log('Running the scraper with test CELEX number:', testCelex);
try {
    execSync(`node eurlex-scraper.js ${testCelex} --skip-download`, { stdio: 'inherit' });
} catch (error) {
    console.error('Error running the scraper:', error.message);
    process.exit(1);
}

// Verify that the output directory exists
const outputDir = path.join(process.cwd(), testCelex);
if (!fs.existsSync(outputDir)) {
    console.error('Output directory was not created:', outputDir);
    process.exit(1);
}

// Verify that the markdown files were created
const expectedFiles = [
    'preliminary-question.md',
    'interpreted.md',
    'other.md',
    'articles.md'
];

let allFilesExist = true;
for (const file of expectedFiles) {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) {
        console.error(`Expected file was not created: ${file}`);
        allFilesExist = false;
    } else {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent.length === 0) {
            console.error(`File exists but is empty: ${file}`);
            allFilesExist = false;
        } else {
            console.log(`File exists and has content: ${file}`);
        }
    }
}

if (allFilesExist) {
    console.log('All expected files were created successfully!');
    console.log('Test passed!');
} else {
    console.error('Some expected files were not created or are empty.');
    console.error('Test failed!');
    process.exit(1);
} 