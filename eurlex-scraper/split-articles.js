#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * EUR-Lex Article Extractor (Enhanced Debug Version)
 * 
 * This script takes a CELEX number as input, downloads the HTML content,
 * creates a folder named "<CELEX>_articles", saves the raw HTML as "<CELEX>_full_html.html",
 * and then splits the HTML into separate article files.
 */

// Parse command line arguments
const args = process.argv.slice(2);
const celexNumber = args[0];
const outputDir = args[1] || path.join(process.cwd(), `${celexNumber}_articles`);

if (!celexNumber) {
    console.error('Please provide a CELEX number as an argument.');
    console.error('Example: node article-extractor.js 32016R0679');
    process.exit(1);
}

/**
 * Parse a string to an integer strictly, mimicking Python's int() behavior
 * @param {string} str - The string to parse
 * @returns {number} - The parsed integer
 * @throws {Error} - If the string is not a valid integer
 */
function parseStrictInteger(str) {
    // Only allow purely numeric strings, optionally with a leading minus sign
    if (!/^-?\d+$/.test(str)) {
        throw new Error(`ValueError: '${str}' is not a valid integer`);
    }
    return parseInt(str, 10);
}

/**
 * Extract articles from HTML content
 * @param {string} htmlContent - The HTML content to extract articles from
 * @returns {Array} - Array of article objects with number, title, and html_content
 */
function extractArticles(htmlContent) {
    if (!htmlContent) {
        console.error("extractArticles() received empty htmlContent.");
        return [];
    }

    console.log("Loading HTML into Cheerio...");
    const $ = cheerio.load(htmlContent);

    console.log("Selecting elements with div[id^='art_']...");
    const articleElements = $('div[id^=art_]');
    console.log("Found", articleElements.length, "elements matching div[id^=art_].");

    // For debugging: log each found element's ID
    articleElements.each((i, el) => {
        console.log(`  [${i}] Element ID:`, $(el).attr('id'));
    });

    const articles = [];
    articleElements.each((index, element) => {
        const idString = $(element).attr('id') || '';
        if (!idString.startsWith('art_')) {
            console.log(`Skipping element ID='${idString}' because it doesn't start with 'art_'.`);
            return;
        }

        try {
            // Extract the numeric part after 'art_'
            const numericString = idString.replace('art_', '');

            // Use strict integer parsing to mimic Python's behavior
            try {
                const number = parseStrictInteger(numericString);

                // Get title
                const titleElement = $(element).find('p.oj-sti-art').first();
                const title = titleElement.length
                    ? titleElement.text().trim()
                    : `Article ${number}`;

                // Clone the element to avoid modifying the original
                const clonedElement = $(element).clone();

                // Extract the complete HTML for this article
                const html_content = $.html(clonedElement);

                articles.push({
                    number,
                    title,
                    html_content
                });
            } catch (parseError) {
                console.log(`Skipping ${idString} because it's not a pure integer: ${parseError.message}`);
                return;
            }
        } catch (error) {
            console.error(`Error processing article element (ID='${idString}'):`, error.message);
        }
    });

    // Sort articles by number
    articles.sort((a, b) => a.number - b.number);
    console.log(`extractArticles() returning ${articles.length} parsed articles.\n`);
    return articles;
}

/**
 * Save articles as HTML files
 * @param {Array} articles - Array of article objects
 * @param {string} outputDir - Directory to save articles to
 * @returns {Array} - Array of saved file paths
 */
function saveArticles(articles, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const savedFiles = [];
    for (const article of articles) {
        const number = article.number;
        const title = article.title;

        // Post-process the HTML to remove eli-title and oj-ti-art elements
        const $ = cheerio.load(article.html_content);

        // Remove the article number element
        $('p.oj-ti-art').remove();

        // Remove the article title element (eli-title)
        $('div.eli-title').remove();

        // Get the cleaned HTML
        const cleanedHtml = $.html();

        // Construct file path
        const htmlFilename = path.join(outputDir, `Article ${number}.html`);

        // Write the article's HTML, preceded by an <h2> title
        fs.writeFileSync(
            htmlFilename,
            `<h2>${title}</h2>\n${cleanedHtml}`,
            'utf-8'
        );
        savedFiles.push(htmlFilename);
    }

    return savedFiles;
}

/**
 * Main function to extract articles from a CELEX document
 * @param {string} celexNumber - The CELEX number to extract articles from
 * @param {string} outputDir - The output directory to save articles to
 * @returns {Promise<Array>} - Array of saved file paths
 */
async function extractArticlesFromCelex(celexNumber, outputDir) {
    // Use the provided output directory
    console.log(`Output directory will be: ${outputDir}`);

    // Construct the URL
    const url = `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${celexNumber}`;
    console.log(`Fetching content from ${url}...`);

    try {
        // Download HTML content
        const response = await axios.get(url, {
            // You can uncomment the line below if you suspect user-agent gating:
            // headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const htmlContent = response.data;
        console.log("HTTP request succeeded.");
        console.log("Full HTML length:", htmlContent.length);

        // Quick preview of the first 500 chars (for debug)
        console.log("HTML preview:\n", htmlContent.slice(0, 500), "\n... [truncated] ...\n");

        // Make sure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the full HTML for debugging
        const fullHtmlPath = path.join(outputDir, `${celexNumber}_full_html.html`);
        fs.writeFileSync(fullHtmlPath, htmlContent, 'utf-8');
        console.log(`Saved full downloaded HTML to ${fullHtmlPath}\n`);

        // Extract and save articles
        const articles = extractArticles(htmlContent);

        if (articles.length === 0) {
            console.error(
                'No articles found. Either the HTML structure is different than expected or no "div[id^=art_]" elements were matched.'
            );
            return [];
        }

        console.log(`Found ${articles.length} articles. Saving each as a separate HTML file...`);
        const savedFiles = saveArticles(articles, outputDir);

        console.log(`Successfully extracted ${articles.length} articles and saved them to ${outputDir}`);
        return savedFiles;
    } catch (error) {
        console.error(`Error extracting articles: ${error.message}`);
        return [];
    }
}

// If this script is run directly (not imported as a module)
if (require.main === module) {
    // If no output directory is specified, use the CELEX directory in the current script's directory
    const defaultOutputDir = path.join(path.dirname(__filename), celexNumber, 'articles', 'html');
    const finalOutputDir = args[1] || defaultOutputDir;

    extractArticlesFromCelex(celexNumber, finalOutputDir)
        .then(savedFiles => {
            if (savedFiles.length > 0) {
                console.log(`Saved ${savedFiles.length} article files:`);
                savedFiles.forEach(file => console.log('  -', file));
            }
        })
        .catch(error => {
            console.error(`Script error: ${error.message}`);
            process.exit(1);
        });
}

// Export the function for use in other scripts
module.exports = {
    extractArticlesFromCelex
};