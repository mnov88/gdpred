const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { promisify } = require('util');
const parseXmlString = promisify(xml2js.parseString);
const { spawn } = require('child_process');
const TurndownService = require('turndown');

/**
 * EUR-Lex Case Reference Scraper
 * 
 * This script takes a CELEX number as input, constructs URLs to access EUR-Lex,
 * fetches metadata and content, and creates organized markdown files.
 * It also downloads the full text of the law, splits it into articles, and converts them to markdown.
 */

// Parse command line arguments
const args = process.argv.slice(2);
const celexNumber = args[0];
const skipDownload = args.includes('--skip-download') || args.includes('-s');

if (!celexNumber) {
    console.error('Please provide a CELEX number as an argument.');
    console.error('Example: node eurlex-scraper.js 32016R0679');
    console.error('Options:');
    console.error('  --skip-download, -s  Skip downloading HTML files');
    process.exit(1);
}

// Construct the URL
const url = `https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:${celexNumber}`;

// Create directory for output
const outputDir = path.join(process.cwd(), celexNumber);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Create directory for markdown files
const mdDir = path.join(process.cwd(), `${celexNumber}_MD`);
if (!fs.existsSync(mdDir)) {
    fs.mkdirSync(mdDir);
}

// Sanitize text for use in filenames
function sanitizeForFilename(text) {
    return text
        .replace(/[\/\\?%*:|"<>]/g, '-') // Replace invalid filename chars with dash
        .replace(/\s+/g, ' ')            // Replace multiple spaces with single space
        .trim();
}

// Fetch and parse case metadata from Publications Office API
async function fetchCaseMetadata(celexNumber) {
    try {
        const response = await axios.get(
            `https://publications.europa.eu/resource/celex/${celexNumber}`,
            {
                headers: {
                    'Accept': 'application/xml;notice=branch',
                    'Accept-Language': 'eng'
                }
            }
        );

        console.log('Raw XML response:', response.data);
        const result = await parseXmlString(response.data);
        console.log('Parsed XML structure:', JSON.stringify(result, null, 2));

        // Extract case number and parties using the correct XML path
        const expression = result.NOTICE?.WORK?.[0]?.['WORK_HAS_EXPRESSION']?.[0]?.['EMBEDDED_NOTICE']?.[0]?.EXPRESSION?.[0];

        if (!expression) {
            console.error('XML structure debug:');
            console.error('NOTICE exists:', !!result.NOTICE);
            console.error('WORK exists:', !!result.NOTICE?.WORK);
            console.error('WORK_HAS_EXPRESSION exists:', !!result.NOTICE?.WORK?.[0]?.['WORK_HAS_EXPRESSION']);
            console.error('EMBEDDED_NOTICE exists:', !!result.NOTICE?.WORK?.[0]?.['WORK_HAS_EXPRESSION']?.[0]?.['EMBEDDED_NOTICE']);
            console.error('EXPRESSION exists:', !!result.NOTICE?.WORK?.[0]?.['WORK_HAS_EXPRESSION']?.[0]?.['EMBEDDED_NOTICE']?.[0]?.EXPRESSION);
            throw new Error('Invalid XML structure: missing EXPRESSION node or incorrect path');
        }

        // Use exact XML node names and add debug logging
        const caseIdNode = expression['EXPRESSION_CASE-LAW_IDENTIFIER_CASE']?.[0];
        if (!caseIdNode) {
            console.error('Missing case identifier node in expression');
        }

        const partiesNode = expression['EXPRESSION_CASE-LAW_PARTIES']?.[0] ||
            expression.PARTIES?.[0];
        if (!partiesNode) {
            console.error('Missing parties node in expression');
        }

        const caseNumber = caseIdNode?.VALUE?.[0]?.replace('Case ', '').replace('/', '-');
        const parties = partiesNode?.VALUE?.[0];

        if (!caseNumber || !parties) {
            console.error('Debug values:');
            console.error('Raw case ID node:', JSON.stringify(caseIdNode, null, 2));
            console.error('Raw parties node:', JSON.stringify(partiesNode, null, 2));
            throw new Error('Could not extract case number or parties from metadata');
        }

        // Get AG opinion from the embedded notice structure
        const agOpinion = result.NOTICE?.WORK?.[0]?.['WORK_HAS_EXPRESSION']?.[0]?.['EMBEDDED_NOTICE']?.[0]?.['CASE-LAW_DELIVERED_BY_ADVOCATE-GENERAL']?.[0];
        const agName = agOpinion?.SAMEAS?.[0]?.URI?.[0]?.IDENTIFIER?.[0];

        if (agOpinion && !agName) {
            console.error('AG opinion node found but could not extract name:', JSON.stringify(agOpinion, null, 2));
        }

        return {
            caseNumber,
            parties,
            agName
        };
    } catch (error) {
        console.error(`Error fetching metadata for ${celexNumber}:`, error.message);
        return null;
    }
}

// Generate filename from case metadata
function generateFilename(caseNumber, parties) {
    const sanitizedParties = sanitizeForFilename(parties);
    return `${caseNumber} ${sanitizedParties}.md`;
}

/**
 * Run a command as a child process and return its output
 * @param {string} command - The command to run
 * @param {Array<string>} args - The arguments to pass to the command
 * @returns {Promise<string>} - The output of the command
 */
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
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
 * Download and split articles using split-articles.js
 * @param {string} celexNumber - The CELEX number to process
 * @returns {Promise<Array<string>>} - Array of saved file paths
 */
async function downloadAndSplitArticles(celexNumber) {
    console.log(`Downloading and splitting articles for CELEX: ${celexNumber}`);
    try {
        // Run the split-articles.js script
        await runCommand('node', [path.join(__dirname, 'split-articles.js'), celexNumber]);

        // Check if the articles directory was created
        const articlesDir = path.join(process.cwd(), `${celexNumber}_articles`);
        if (!fs.existsSync(articlesDir)) {
            console.error(`Articles directory not created: ${articlesDir}`);
            return [];
        }

        // Get all HTML files in the articles directory
        const files = fs.readdirSync(articlesDir)
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(articlesDir, file));

        console.log(`Found ${files.length} article files`);
        return files;
    } catch (error) {
        console.error(`Error downloading and splitting articles: ${error.message}`);
        return [];
    }
}

/**
 * Convert HTML files to Markdown using html-to-md.js
 * @param {Array<string>} htmlFiles - Array of HTML file paths
 * @param {string} outputDir - Directory to save markdown files to
 * @returns {Promise<Array<string>>} - Array of saved markdown file paths
 */
async function convertHtmlToMarkdown(htmlFiles, outputDir) {
    console.log(`Converting ${htmlFiles.length} HTML files to Markdown using html-to-md.js`);

    // Group files by directory to minimize the number of script calls
    const filesByDir = {};
    htmlFiles.forEach(file => {
        const dir = path.dirname(file);
        if (!filesByDir[dir]) {
            filesByDir[dir] = [];
        }
        filesByDir[dir].push(file);
    });

    const mdFiles = [];

    // Process each directory
    for (const [dir, files] of Object.entries(filesByDir)) {
        try {
            // Call html-to-md.js with the directory
            console.log(`Converting files in ${dir} to Markdown...`);
            await runCommand('node', [path.join(__dirname, 'html-to-md.js'), dir, outputDir]);

            // Add expected output files to the result
            files.forEach(file => {
                const baseName = path.basename(file, '.html');
                const mdFile = path.join(outputDir, `${baseName}.md`);
                mdFiles.push(mdFile);
            });
        } catch (error) {
            console.error(`Error converting files in ${dir} to Markdown: ${error.message}`);
        }
    }

    console.log(`Converted HTML files to Markdown in ${outputDir}`);
    return mdFiles;
}

// Main function to scrape and process data
async function scrapeEurLex() {
    console.log(`Scraping EUR-Lex for CELEX: ${celexNumber}`);
    console.log(`URL: ${url}`);
    if (skipDownload) {
        console.log('HTML download is disabled. Only metadata will be collected.');
    }

    try {
        // First fetch metadata to get accurate case number and parties
        const metadata = await fetchCaseMetadata(celexNumber);

        if (!metadata) {
            console.error('Failed to fetch case metadata. Falling back to HTML scraping...');
            // ... existing HTML scraping code ...
        } else {
            const { caseNumber, parties, agName } = metadata;
            const filename = generateFilename(caseNumber, parties);

            console.log(`Processing case ${caseNumber}`);
            console.log(`Parties: ${parties}`);
            if (agName) console.log(`AG Opinion by: ${agName}`);
        }

        // Download and split articles
        console.log('Downloading and splitting articles...');
        const articleFiles = await downloadAndSplitArticles(celexNumber);

        if (articleFiles.length > 0) {
            // Convert HTML files to Markdown
            console.log('Converting HTML files to Markdown...');
            await convertHtmlToMarkdown(articleFiles, mdDir);

            // Also convert the full HTML file if it exists
            const fullHtmlPath = path.join(process.cwd(), `${celexNumber}_articles`, `${celexNumber}_full_html.html`);
            if (fs.existsSync(fullHtmlPath)) {
                await runCommand('node', [path.join(__dirname, 'html-to-md.js'), fullHtmlPath, mdDir]);
            }
        }

        // Fetch the webpage for case references
        const response = await axios.get(url);
        const html = response.data;

        // Parse HTML with Cheerio
        const $ = cheerio.load(html);

        // Find the "Affected by case" section - try different possible selectors
        let affectedByCase = $('dt:contains("Affected by case:")').next('dd');

        // If not found, try alternative selectors
        if (!affectedByCase.length) {
            affectedByCase = $('dt:contains("Affected by case")').next('dd');
        }

        if (!affectedByCase.length) {
            // Try to find it by looking for the text in any element
            const dtElement = $('*:contains("Affected by case:")').filter(function () {
                return $(this).text().trim() === 'Affected by case:';
            });
            if (dtElement.length) {
                affectedByCase = dtElement.next('dd');
            }
        }

        if (!affectedByCase.length) {
            console.log('No "Affected by case" section found. The document might not have any case references or the structure is different.');
            console.log('Processing complete!');
            return;
        }

        // Extract all list items
        const listItems = affectedByCase.find('li');
        console.log(`Found ${listItems.length} case references.`);

        if (listItems.length === 0) {
            console.log('No case references found in the "Affected by case" section.');
            console.log('Processing complete!');
            return;
        }

        // Initialize categories
        const categories = {
            'Preliminary question': [],
            'Interpreted': [],
            'Other': []
        };

        // Initialize article references
        const articleReferences = {};

        // Process each list item
        listItems.each((i, element) => {
            const text = $(element).text().trim();

            // Try to get CELEX from data-celex attribute first
            let celexRef = $(element).find('a').attr('data-celex');

            // If not found, try to extract from href
            if (!celexRef) {
                const href = $(element).find('a').attr('href');
                if (href) {
                    const celexMatch = href.match(/CELEX:([^&"]+)/i);
                    if (celexMatch && celexMatch[1]) {
                        celexRef = celexMatch[1];
                    }
                }
            }

            // If still not found, try to extract from text
            if (!celexRef) {
                const celexMatch = text.match(/\b([0-9]{5}[A-Z]{2}[0-9]{4})\b/);
                if (celexMatch && celexMatch[1]) {
                    celexRef = celexMatch[1];
                }
            }

            if (!celexRef) {
                console.log(`Could not extract CELEX reference from: ${text}`);
                return;
            }

            const linkUrl = `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${celexRef}`;

            // Categorize the reference
            let category = 'Other';

            // Check for "Preliminary question" pattern
            if (text.toLowerCase().includes('preliminary question')) {
                category = 'Preliminary question';
            }
            // Check for "Interpreted by" pattern - be more flexible with the matching
            else if (
                text.toLowerCase().includes('interpreted by') ||
                text.toLowerCase().includes('interpretation by') ||
                (text.match(/^A\d+/) && text.toLowerCase().includes('by'))
            ) {
                category = 'Interpreted';
            }

            // Create a reference item with celexRef and linkUrl
            const referenceItem = {
                celexRef,
                text,
                linkUrl
            };

            // Add to appropriate category
            categories[category].push(referenceItem);

            // Extract all possible article references from the text
            const articleRefs = extractAllArticleReferences(text);

            // Add all extracted article references
            if (articleRefs.length > 0) {
                articleRefs.forEach(ref => {
                    if (!articleReferences[ref]) {
                        articleReferences[ref] = [];
                    }

                    // Check for duplicates before adding
                    const isDuplicate = articleReferences[ref].some(
                        item => item.celexRef === celexRef
                    );

                    if (!isDuplicate) {
                        // Add the same reference item to article references
                        articleReferences[ref].push(referenceItem);
                    }
                });
            }
        });

        // Extract case numbers without downloading full HTML if download is skipped
        if (skipDownload) {
            await extractCaseNumbersWithoutDownload(categories);
        } else {
            // Download HTML files and extract case numbers
            await downloadHtmlFiles(categories);
        }

        // Update article references with case numbers from categories
        updateArticleReferencesWithCaseNumbers(articleReferences, categories);

        // Create markdown files
        await createCategoryMarkdown(categories);
        await createArticleMarkdown(articleReferences, categories);

        console.log('Processing complete!');

    } catch (error) {
        console.error('Error scraping EUR-Lex:', error.message);
        if (error.response) {
            console.error(`Status code: ${error.response.status}`);
        }
    }
}

/**
 * Extract all possible article references from text
 * This function looks for article references anywhere in the text
 */
function extractAllArticleReferences(text) {
    const references = [];

    // Look for "article X" pattern anywhere in the text
    const articleMatches = text.matchAll(/article\s+(\d+)(?:\s+paragraph\s+\d+)?(?:\s+point\s+\([a-z]\))?(?:\s+sentence\s+\d+)?/gi);
    for (const match of articleMatches) {
        references.push(`Article ${match[1]}`);
    }

    // Look for "recital X" pattern anywhere in the text
    const recitalMatches = text.matchAll(/recital\s+(\d+)/gi);
    for (const match of recitalMatches) {
        references.push(`Recital ${match[1]}`);
    }

    // Look for "AXX" pattern at the beginning of the text or after spaces
    const axxMatches = text.matchAll(/(?:^|\s)A(\d+)(?:P[A-Z]?\d*)?(?:L[A-Z]?\d*)?/g);
    for (const match of axxMatches) {
        references.push(`Article ${parseInt(match[1], 10)}`);
    }

    return references;
}

/**
 * Create markdown files for each category
 */
async function createCategoryMarkdown(categories) {
    for (const [category, items] of Object.entries(categories)) {
        if (items.length === 0) continue;

        const fileName = `${category.replace(/\s+/g, '-').toLowerCase()}.md`;
        const filePath = path.join(outputDir, fileName);

        let content = `# ${category} Cases\n\n`;
        content += `Total: ${items.length}\n\n`;

        items.forEach(item => {
            // Include case number if available
            if (item.caseNumber) {
                content += `- [${item.celexRef}](${item.linkUrl}) (${item.caseNumber}) - ${item.text}\n`;
            } else {
                content += `- [${item.celexRef}](${item.linkUrl}) - ${item.text}\n`;
            }
        });

        fs.writeFileSync(filePath, content);
        console.log(`Created ${fileName}`);
    }
}

/**
 * Create markdown file for article references
 * Groups by normalized article reference and removes duplicates
 */
async function createArticleMarkdown(articleReferences, categories) {
    // Create separate references for interpreted and preliminary questions
    const interpretedReferences = {};
    const preliminaryReferences = {};

    // Get all items from each category
    const interpretedItems = categories['Interpreted'];
    const preliminaryItems = categories['Preliminary question'];

    // Process each article reference
    for (const [article, items] of Object.entries(articleReferences)) {
        // Extract the article number for normalization
        let normalizedArticle = article;

        // If it's already in the normalized format, use it directly
        if (article.match(/^Article \d+$/i) || article.match(/^Recital \d+$/i)) {
            normalizedArticle = article.charAt(0).toUpperCase() + article.slice(1);
        }
        // Otherwise, try to extract and normalize
        else {
            // Try to extract article number from various formats
            const articleMatch = article.match(/^A(\d+)/i) || article.match(/article\s+(\d+)/i);
            if (articleMatch) {
                normalizedArticle = `Article ${parseInt(articleMatch[1], 10)}`;
            }

            // Try to extract recital number
            const recitalMatch = article.match(/recital\s+(\d+)/i);
            if (recitalMatch) {
                normalizedArticle = `Recital ${recitalMatch[1]}`;
            }
        }

        // Process items for interpreted references
        if (!interpretedReferences[normalizedArticle]) {
            interpretedReferences[normalizedArticle] = [];
        }

        // Process items for preliminary references
        if (!preliminaryReferences[normalizedArticle]) {
            preliminaryReferences[normalizedArticle] = [];
        }

        // Add items to the appropriate category, avoiding duplicates
        items.forEach(item => {
            // Check if this item is in the interpreted category
            const isInterpreted = interpretedItems.some(
                interpretedItem => interpretedItem.celexRef === item.celexRef
            );

            // Check if this item is in the preliminary category
            const isPreliminary = preliminaryItems.some(
                preliminaryItem => preliminaryItem.celexRef === item.celexRef
            );

            if (isInterpreted) {
                const isDuplicate = interpretedReferences[normalizedArticle].some(
                    existingItem => existingItem.celexRef === item.celexRef
                );
                if (!isDuplicate) {
                    interpretedReferences[normalizedArticle].push(item);
                }
            }

            if (isPreliminary) {
                const isDuplicate = preliminaryReferences[normalizedArticle].some(
                    existingItem => existingItem.celexRef === item.celexRef
                );
                if (!isDuplicate) {
                    preliminaryReferences[normalizedArticle].push(item);
                }
            }
        });
    }

    // Create articles-interpreted.md
    const interpretedPath = path.join(outputDir, 'articles-interpreted.md');
    let interpretedContent = '# Interpreted Article References\n\n';

    // Count total unique interpreted articles
    const uniqueInterpretedArticles = Object.keys(interpretedReferences).filter(
        article => interpretedReferences[article].length > 0
    ).length;

    interpretedContent += `Total unique articles referenced: ${uniqueInterpretedArticles}\n\n`;

    // Sort articles numerically
    const sortedInterpretedArticles = Object.keys(interpretedReferences)
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
            const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
            return numA - numB;
        });

    for (const article of sortedInterpretedArticles) {
        const items = interpretedReferences[article];
        if (items.length === 0) continue;

        interpretedContent += `## ${article}\n\n`;
        interpretedContent += `Total references: ${items.length}\n\n`;

        items.forEach(item => {
            if (item.caseNumber) {
                interpretedContent += `- [${item.celexRef}](${item.linkUrl}) (${item.caseNumber})\n`;
            } else {
                interpretedContent += `- [${item.celexRef}](${item.linkUrl})\n`;
            }
        });
        interpretedContent += '\n';
    }

    fs.writeFileSync(interpretedPath, interpretedContent);
    console.log('Created articles-interpreted.md');

    // Create articles-preliminary.md
    const preliminaryPath = path.join(outputDir, 'articles-preliminary.md');
    let preliminaryContent = '# Preliminary Question Article References\n\n';

    // Count total unique preliminary articles
    const uniquePreliminaryArticles = Object.keys(preliminaryReferences).filter(
        article => preliminaryReferences[article].length > 0
    ).length;

    preliminaryContent += `Total unique articles referenced: ${uniquePreliminaryArticles}\n\n`;

    // Sort articles numerically
    const sortedPreliminaryArticles = Object.keys(preliminaryReferences)
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
            const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
            return numA - numB;
        });

    for (const article of sortedPreliminaryArticles) {
        const items = preliminaryReferences[article];
        if (items.length === 0) continue;

        preliminaryContent += `## ${article}\n\n`;
        preliminaryContent += `Total references: ${items.length}\n\n`;

        items.forEach(item => {
            if (item.caseNumber) {
                preliminaryContent += `- [${item.celexRef}](${item.linkUrl}) (${item.caseNumber})\n`;
            } else {
                preliminaryContent += `- [${item.celexRef}](${item.linkUrl})\n`;
            }
        });
        preliminaryContent += '\n';
    }

    fs.writeFileSync(preliminaryPath, preliminaryContent);
    console.log('Created articles-preliminary.md');
}

/**
 * Download HTML files for each case reference with rate limiting
 * Also extracts case numbers from HTML titles
 */
async function downloadHtmlFiles(categories) {
    const allItems = [
        ...categories['Preliminary question'],
        ...categories['Interpreted'],
        ...categories['Other']
    ];

    console.log(`Downloading ${allItems.length} HTML files...`);

    const htmlDir = path.join(outputDir, 'html');
    if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir);
    }

    // Create a summary file to track download status and case numbers
    const summaryPath = path.join(outputDir, 'download-summary.md');
    let summaryContent = `# Download Summary\n\n`;
    summaryContent += `Total files to download: ${allItems.length}\n\n`;
    summaryContent += `| CELEX | Case Number | Status | Error |\n`;
    summaryContent += `|-------|------------|--------|-------|\n`;

    // Create a case number mapping file
    const caseNumberPath = path.join(outputDir, 'case-numbers.md');
    let caseNumberContent = `# Case Number Mapping\n\n`;
    caseNumberContent += `| CELEX | Case Number | Link |\n`;
    caseNumberContent += `|-------|------------|------|\n`;

    // Function to delay execution (for rate limiting)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Download with rate limiting
    let successCount = 0;
    let failureCount = 0;
    let caseNumberCount = 0;

    for (const [index, item] of allItems.entries()) {
        try {
            // Add a delay every few requests to avoid rate limiting
            if (index > 0 && index % 5 === 0) {
                console.log(`Pausing for 2 seconds to avoid rate limiting (${index}/${allItems.length})...`);
                await delay(2000);
            }

            console.log(`Downloading ${item.celexRef}.html (${index + 1}/${allItems.length})...`);
            const response = await axios.get(item.linkUrl, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            // Extract case number from HTML content
            const html = response.data;
            const $ = cheerio.load(html);

            // Check both title and page content
            const titleText = $('#title').text() || $('title').text();
            const pageText = $('body').text();

            // Look for case number pattern with various formats
            // Examples: "Case C-417/15", "C-417/15", "Case C 417/15", "Case C 417-15", "In Case C‑417/15"
            const caseNumberMatch =
                pageText.match(/In\s+Case\s+([C][-‑]\s*\d+[\/-]\d+)/i) ||
                pageText.match(/In\s+Case\s+([C]\s+\d+[\/-]\d+)/i) ||
                titleText.match(/Case\s+([C][-‑]\s*\d+[\/-]\d+)/i) ||
                titleText.match(/([C][-‑]\s*\d+[\/-]\d+)/i) ||
                titleText.match(/Case\s+([C]\s+\d+[\/-]\d+)/i) ||
                titleText.match(/([C]\s+\d+[\/-]\d+)/i);

            let caseNumber = null;
            let filename = item.celexRef;

            if (caseNumberMatch && caseNumberMatch[1]) {
                // Clean up the case number format
                caseNumber = caseNumberMatch[1].trim()
                    .replace(/\s+/g, '-') // Replace spaces with hyphens
                    .replace(/\//, '-')   // Replace / with -
                    .replace(/‑/, '-');   // Replace unicode hyphen with standard hyphen

                // Ensure consistent format (C-123-45)
                if (!caseNumber.startsWith('C-')) {
                    caseNumber = `C-${caseNumber.substring(1)}`;
                }

                // Use the case number as filename (already formatted with - instead of /)
                filename = caseNumber;
                caseNumberCount++;

                // Add to case number mapping
                caseNumberContent += `| ${item.celexRef} | ${caseNumber} | [Link](${item.linkUrl}) |\n`;

                // Add case number to the item for future reference
                item.caseNumber = caseNumber;
            }

            // Save HTML file
            const htmlPath = path.join(htmlDir, `${filename}.html`);
            fs.writeFileSync(htmlPath, response.data);

            summaryContent += `| ${item.celexRef} | ${caseNumber || 'N/A'} | ✅ Success | - |\n`;
            successCount++;
        } catch (error) {
            console.error(`Error downloading ${item.celexRef}: ${error.message}`);

            let errorMessage = error.message;
            if (error.response) {
                errorMessage = `Status ${error.response.status}: ${error.message}`;
            }

            summaryContent += `| ${item.celexRef} | N/A | ❌ Failed | ${errorMessage} |\n`;
            failureCount++;
        }
    }

    // Update summary with final counts
    summaryContent = summaryContent.replace(
        `Total files to download: ${allItems.length}`,
        `Total files to download: ${allItems.length}\nSuccessful downloads: ${successCount}\nFailed downloads: ${failureCount}\nCase numbers found: ${caseNumberCount}`
    );

    // Save summary file
    fs.writeFileSync(summaryPath, summaryContent);
    console.log(`Download summary saved to ${summaryPath}`);

    // Add a note about sampling
    if (allItems.length > caseNumberCount) {
        caseNumberContent = `# Case Number Mapping\n\n` +
            `**Note:** This is a sample of ${caseNumberCount} out of ${allItems.length} references. ` +
            `Run without --skip-download to get all case numbers.\n\n` +
            caseNumberContent.split('\n').slice(2).join('\n');
    }

    // Save case number mapping file
    fs.writeFileSync(caseNumberPath, caseNumberContent);
    console.log(`Case number mapping saved to ${caseNumberPath} (${caseNumberCount} case numbers found)`);

    console.log(`Downloads complete: ${successCount} successful, ${failureCount} failed, ${caseNumberCount} case numbers found`);
}

/**
 * Extract case number from a URL by making a request and parsing the HTML
 * This function can be used to get case numbers without downloading the full HTML
 */
async function extractCaseNumber(celexRef, linkUrl) {
    try {
        const response = await axios.get(linkUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // First check the title
        const titleText = $('#title').text() || $('title').text();

        // Then check the page content for "In Case C-XXX/XX" pattern
        const pageText = $('body').text();

        // Look for case number pattern with various formats
        // Examples: "Case C-417/15", "C-417/15", "Case C 417/15", "Case C 417-15", "In Case C‑417/15"
        const caseNumberMatch =
            pageText.match(/In\s+Case\s+([C][-‑]\s*\d+[\/-]\d+)/i) ||
            pageText.match(/In\s+Case\s+([C]\s+\d+[\/-]\d+)/i) ||
            pageText.match(/Case\s+([C][-‑]\s*\d+[\/-]\d+)/i) ||
            pageText.match(/([C][-‑]\s*\d+[\/-]\d+)/i) ||
            pageText.match(/Case\s+([C]\s+\d+[\/-]\d+)/i) ||
            pageText.match(/([C]\s+\d+[\/-]\d+)/i);

        if (caseNumberMatch && caseNumberMatch[1]) {
            // Clean up the case number format
            let caseNumber = caseNumberMatch[1].trim()
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/\//, '-')   // Replace / with -
                .replace(/‑/, '-');   // Replace unicode hyphen with standard hyphen

            // Ensure consistent format (C-123-45)
            if (!caseNumber.startsWith('C-')) {
                caseNumber = `C-${caseNumber.substring(1)}`;
            }

            return {
                celexRef,
                caseNumber
            };
        }

        return {
            celexRef,
            caseNumber: null
        };
    } catch (error) {
        console.error(`Error extracting case number for ${celexRef}: ${error.message}`);
        return {
            celexRef,
            caseNumber: null
        };
    }
}

/**
 * Extract case numbers without downloading the full HTML
 * This is used when --skip-download option is specified
 */
async function extractCaseNumbersWithoutDownload(categories) {
    const allItems = [
        ...categories['Preliminary question'],
        ...categories['Interpreted'],
        ...categories['Other']
    ];

    console.log(`Extracting case numbers for ${allItems.length} references (without downloading HTML)...`);

    // Create a case number mapping file
    const caseNumberPath = path.join(outputDir, 'case-numbers.md');
    let caseNumberContent = `# Case Number Mapping\n\n`;
    caseNumberContent += `| CELEX | Case Number | Link |\n`;
    caseNumberContent += `|-------|------------|------|\n`;

    // Function to delay execution (for rate limiting)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Sample a subset of items to extract case numbers (to avoid too many requests)
    // We'll take the first 50 items or 10% of the total, whichever is smaller
    const sampleSize = Math.min(50, Math.ceil(allItems.length * 0.1));
    const sampledItems = allItems.slice(0, sampleSize);

    console.log(`Sampling ${sampleSize} references to extract case numbers...`);

    let caseNumberCount = 0;

    for (const [index, item] of sampledItems.entries()) {
        try {
            // Add a delay every few requests to avoid rate limiting
            if (index > 0 && index % 5 === 0) {
                console.log(`Pausing for 2 seconds to avoid rate limiting (${index}/${sampleSize})...`);
                await delay(2000);
            }

            console.log(`Extracting case number for ${item.celexRef} (${index + 1}/${sampleSize})...`);
            const caseNumber = await extractCaseNumber(item.celexRef, item.linkUrl);

            if (caseNumber.caseNumber) {
                caseNumberCount++;
                caseNumberContent += `| ${item.celexRef} | ${caseNumber.caseNumber} | [Link](${item.linkUrl}) |\n`;

                // Add case number to the item for future reference
                item.caseNumber = caseNumber.caseNumber;
            } else {
                caseNumberContent += `| ${item.celexRef} | N/A | [Link](${item.linkUrl}) |\n`;
            }
        } catch (error) {
            console.error(`Error extracting case number for ${item.celexRef}: ${error.message}`);
            caseNumberContent += `| ${item.celexRef} | Error | [Link](${item.linkUrl}) |\n`;
        }
    }

    // Add a note about sampling
    if (allItems.length > sampleSize) {
        caseNumberContent = `# Case Number Mapping\n\n` +
            `**Note:** This is a sample of ${sampleSize} out of ${allItems.length} references. ` +
            `Run without --skip-download to get all case numbers.\n\n` +
            caseNumberContent.split('\n').slice(2).join('\n');
    }

    // Save case number mapping file
    fs.writeFileSync(caseNumberPath, caseNumberContent);
    console.log(`Case number mapping saved to ${caseNumberPath} (${caseNumberCount} case numbers found)`);
}

/**
 * Update article references with case numbers from categories
 */
function updateArticleReferencesWithCaseNumbers(articleReferences, categories) {
    // Collect all items with case numbers
    const allItems = [
        ...categories['Preliminary question'],
        ...categories['Interpreted'],
        ...categories['Other']
    ];

    // Create a map of celexRef to caseNumber
    const celexToCaseNumber = {};
    allItems.forEach(item => {
        if (item.caseNumber) {
            celexToCaseNumber[item.celexRef] = item.caseNumber;
        }
    });

    // Update article references with case numbers
    for (const articleRef in articleReferences) {
        articleReferences[articleRef].forEach(item => {
            if (celexToCaseNumber[item.celexRef]) {
                item.caseNumber = celexToCaseNumber[item.celexRef];
            }
        });
    }

    console.log(`Updated article references with case numbers`);
}

// Start the scraping process
scrapeEurLex();