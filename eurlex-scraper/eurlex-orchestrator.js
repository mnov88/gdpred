#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { promisify } = require('util');

// Import the refactored combined-scraper.js
const { scrapeEurLex } = require('./combined-scraper');

/**
 * EUR-Lex Orchestrator
 * 
 * This script serves as a high-level orchestrator for the EUR-Lex scraping process.
 * It coordinates the execution of the various components (combined-scraper, split-articles, html-to-md)
 * and provides additional functionality like batch processing and error recovery.
 */

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Define available commands
const COMMANDS = {
    SCRAPE: 'scrape',
    BATCH: 'batch',
    ARTICLES_ONLY: 'articles-only',
    CONVERT: 'convert',
    HELP: 'help'
};

/**
 * Create the directory structure for a CELEX document
 * @param {string} celexNumber - The CELEX number
 * @returns {Object} - Object containing all directory paths
 */
function createDirectoryStructure(celexNumber) {
    console.log(`Creating directory structure for CELEX: ${celexNumber}`);

    // Create base output directory
    const outputDir = path.join(path.dirname(__filename), celexNumber);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Create articles directory with html and md subfolders
    const articlesDir = path.join(outputDir, 'articles');
    const articlesHtmlDir = path.join(articlesDir, 'html');
    const articlesMdDir = path.join(articlesDir, 'md');

    if (!fs.existsSync(articlesDir)) {
        fs.mkdirSync(articlesDir);
        fs.mkdirSync(articlesHtmlDir);
        fs.mkdirSync(articlesMdDir);
    }

    // Create case-law directory with category subfolders
    const caseLawDir = path.join(outputDir, 'case-law');
    if (!fs.existsSync(caseLawDir)) {
        fs.mkdirSync(caseLawDir);
    }

    // Create category subfolders with html and md subfolders
    const categories = ['interpreted', 'preliminary', 'other'];
    const categoryDirs = {};

    categories.forEach(category => {
        const categoryDir = path.join(caseLawDir, category);
        const htmlDir = path.join(categoryDir, 'html');
        const mdDir = path.join(categoryDir, 'md');

        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir);
            fs.mkdirSync(htmlDir);
            fs.mkdirSync(mdDir);
        }

        categoryDirs[category] = {
            root: categoryDir,
            html: htmlDir,
            md: mdDir
        };
    });

    // Return all directory paths
    return {
        outputDir,
        articlesDir,
        articlesHtmlDir,
        articlesMdDir,
        caseLawDir,
        categoryDirs
    };
}

/**
 * Run a command as a child process and return its output
 * @param {string} command - The command to run
 * @param {Array<string>} args - The arguments to pass to the command
 * @returns {Promise<string>} - The output of the command
 */
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command} ${args.join(' ')}`);

        const child = spawn(command, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log(data.toString());
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error(data.toString());
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });
    });
}

/**
 * Scrape a single CELEX document
 * @param {string} celexNumber - The CELEX number to scrape
 * @param {boolean} skipDownload - Whether to skip downloading HTML files
 * @returns {Promise<void>}
 */
async function scrapeCelex(celexNumber, skipDownload = false) {
    console.log(`Orchestrating scraping for CELEX: ${celexNumber}`);

    try {
        // Create directory structure first
        const dirs = createDirectoryStructure(celexNumber);

        // Call the scrapeEurLex function directly instead of running as a child process
        await scrapeEurLex(celexNumber, skipDownload, dirs);

        console.log(`Successfully completed scraping for CELEX: ${celexNumber}`);
    } catch (error) {
        console.error(`Error scraping CELEX ${celexNumber}:`, error.message);
        throw error;
    }
}

/**
 * Extract articles only from a CELEX document
 * @param {string} celexNumber - The CELEX number to extract articles from
 * @param {string} outputDir - The output directory
 * @returns {Promise<Array<string>>} - Array of saved file paths
 */
async function extractArticlesOnly(celexNumber, outputDir) {
    console.log(`Extracting articles for CELEX: ${celexNumber}`);

    try {
        // Create HTML and MD subdirectories
        const htmlDir = path.join(outputDir, 'html');
        const mdDir = path.join(outputDir, 'md');

        // Ensure directories exist
        [outputDir, htmlDir, mdDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Run split-articles.js to extract HTML articles
        await runCommand('node', [
            path.join(__dirname, 'split-articles.js'),
            celexNumber,
            htmlDir
        ]);

        // Get all HTML files
        const files = fs.readdirSync(htmlDir)
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(htmlDir, file));

        // Also convert to markdown
        if (files.length > 0) {
            console.log(`Converting ${files.length} HTML files to Markdown...`);
            await runCommand('node', [
                path.join(__dirname, 'html-to-md.js'),
                htmlDir,
                mdDir
            ]);

            // Verify HTML files still exist after conversion
            const htmlFilesAfter = fs.readdirSync(htmlDir)
                .filter(file => file.endsWith('.html'));

            console.log(`After conversion: ${htmlFilesAfter.length} HTML files remain in ${htmlDir}`);
            if (htmlFilesAfter.length !== files.length) {
                console.error("Warning: Some HTML files may have been lost during conversion!");
            }
        }

        console.log(`Successfully extracted ${files.length} articles for CELEX: ${celexNumber}`);
        console.log(`HTML files are in: ${htmlDir}`);
        console.log(`Markdown files are in: ${mdDir}`);
        return files;
    } catch (error) {
        console.error(`Error extracting articles for CELEX ${celexNumber}:`, error.message);
        throw error;
    }
}

/**
 * Convert HTML files to Markdown
 * @param {string} inputPath - The input file or directory
 * @param {string} outputPath - The output file or directory
 * @returns {Promise<void>}
 */
async function convertHtmlToMarkdown(inputPath, outputPath) {
    console.log(`Converting HTML to Markdown: ${inputPath} -> ${outputPath}`);

    try {
        // Run html-to-md.js
        await runCommand('node', [
            path.join(__dirname, 'html-to-md.js'),
            inputPath,
            outputPath
        ]);

        console.log(`Successfully converted HTML to Markdown`);
    } catch (error) {
        console.error(`Error converting HTML to Markdown:`, error.message);
        throw error;
    }
}

/**
 * Process a batch of CELEX numbers from a file
 * @param {string} batchFile - Path to a file containing CELEX numbers (one per line)
 * @param {boolean} skipDownload - Whether to skip downloading HTML files
 * @returns {Promise<void>}
 */
async function processBatch(batchFile, skipDownload = false) {
    console.log(`Processing batch from file: ${batchFile}`);

    try {
        // Read the batch file
        const content = fs.readFileSync(batchFile, 'utf-8');
        const celexNumbers = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        console.log(`Found ${celexNumbers.length} CELEX numbers to process`);

        // Create a results log file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(path.dirname(__filename), `batch-results-${timestamp}.md`);

        let logContent = `# EUR-Lex Batch Processing Results\n\n`;
        logContent += `Batch file: ${batchFile}\n`;
        logContent += `Started: ${new Date().toISOString()}\n`;
        logContent += `Skip download: ${skipDownload}\n\n`;
        logContent += `| CELEX | Status | Error |\n`;
        logContent += `|-------|--------|-------|\n`;

        // Process each CELEX number
        for (const [index, celexNumber] of celexNumbers.entries()) {
            console.log(`Processing ${index + 1}/${celexNumbers.length}: ${celexNumber}`);

            try {
                await scrapeCelex(celexNumber, skipDownload);
                logContent += `| ${celexNumber} | ✅ Success | - |\n`;
            } catch (error) {
                logContent += `| ${celexNumber} | ❌ Failed | ${error.message} |\n`;
            }

            // Update the log file after each CELEX
            fs.writeFileSync(logFile, logContent);
        }

        // Add completion timestamp
        logContent += `\nCompleted: ${new Date().toISOString()}\n`;
        fs.writeFileSync(logFile, logContent);

        console.log(`Batch processing complete. Results saved to: ${logFile}`);
    } catch (error) {
        console.error(`Error processing batch:`, error.message);
        throw error;
    }
}

/**
 * Display help information
 */
function showHelp() {
    console.log(`
EUR-Lex Orchestrator - Coordinate the EUR-Lex scraping process

Usage:
  node eurlex-orchestrator.js <command> [options]

Commands:
  scrape <CELEX> [--skip-download]    Scrape a single CELEX document
  batch <FILE> [--skip-download]      Process a batch of CELEX numbers from a file
  articles-only <CELEX> [OUTPUT_DIR]  Extract articles only from a CELEX document
  convert <INPUT> [OUTPUT]            Convert HTML files to Markdown
  help                                Show this help information

Examples:
  node eurlex-orchestrator.js scrape 32016R0679
  node eurlex-orchestrator.js scrape 32016R0679 --skip-download
  node eurlex-orchestrator.js batch celex-list.txt
  node eurlex-orchestrator.js articles-only 32016R0679 ./output-dir
  node eurlex-orchestrator.js convert ./html-dir ./md-dir
  `);
}

/**
 * Main function to handle command line arguments and execute the appropriate command
 */
async function main() {
    try {
        if (args.length === 0 || args[0] === COMMANDS.HELP) {
            showHelp();
            return;
        }

        switch (command) {
            case COMMANDS.SCRAPE: {
                const celexNumber = args[1];
                const skipDownload = args.includes('--skip-download');

                if (!celexNumber) {
                    console.error('Please provide a CELEX number');
                    showHelp();
                    process.exit(1);
                }

                await scrapeCelex(celexNumber, skipDownload);
                break;
            }

            case COMMANDS.BATCH: {
                const batchFile = args[1];
                const skipDownload = args.includes('--skip-download');

                if (!batchFile) {
                    console.error('Please provide a batch file');
                    showHelp();
                    process.exit(1);
                }

                await processBatch(batchFile, skipDownload);
                break;
            }

            case COMMANDS.ARTICLES_ONLY: {
                const celexNumber = args[1];
                const outputDir = args[2] || path.join(path.dirname(__filename), `${celexNumber}_articles`);

                if (!celexNumber) {
                    console.error('Please provide a CELEX number');
                    showHelp();
                    process.exit(1);
                }

                await extractArticlesOnly(celexNumber, outputDir);
                break;
            }

            case COMMANDS.CONVERT: {
                const inputPath = args[1];
                const outputPath = args[2];

                if (!inputPath) {
                    console.error('Please provide an input path');
                    showHelp();
                    process.exit(1);
                }

                await convertHtmlToMarkdown(inputPath, outputPath);
                break;
            }

            default:
                console.error(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the main function
main(); 