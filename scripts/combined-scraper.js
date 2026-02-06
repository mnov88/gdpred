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
 * It first attempts to use the Publications Office API for metadata,
 * falling back to HTML parsing when needed.
 * It also downloads the full text of the law, splits it into articles, and converts them to markdown.
 */

// Parse command line arguments
const args = process.argv.slice(2);
let celexNumber, skipDownload, url, outputDir, articlesDir, articlesHtmlDir, articlesMdDir, caseLawDir, categoryDirs;

// Only execute this code if the script is run directly
if (require.main === module) {
    celexNumber = args[0];
    skipDownload = args.includes('--skip-download') || args.includes('-s');

    if (!celexNumber) {
        console.error('Please provide a CELEX number as an argument.');
        console.error('Example: node combined-scraper.js 32016R0679');
        console.error('Options:');
        console.error('  --skip-download, -s  Skip downloading HTML files');
        process.exit(1);
    }

    // Construct the URL
    url = `https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:${celexNumber}`;

    // Update the output directory setup
    outputDir = path.join(path.dirname(__filename), celexNumber);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // 2. Create articles directory with html and md subfolders
    articlesDir = path.join(outputDir, 'articles');
    articlesHtmlDir = path.join(articlesDir, 'html');
    articlesMdDir = path.join(articlesDir, 'md');
    if (!fs.existsSync(articlesDir)) {
        fs.mkdirSync(articlesDir);
        fs.mkdirSync(articlesHtmlDir);
        fs.mkdirSync(articlesMdDir);
    }

    // 3. Create case-law directory with category subfolders
    caseLawDir = path.join(outputDir, 'case-law');
    if (!fs.existsSync(caseLawDir)) {
        fs.mkdirSync(caseLawDir);
    }

    // 4. Create category subfolders with html and md subfolders
    const categories = ['interpreted', 'preliminary', 'other'];
    categoryDirs = {};
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
}

// Utility function to delay execution (for rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
 * @param {string} customHtmlDir - Custom HTML directory to use (optional)
 * @returns {Promise<Array<string>>} - Array of saved file paths
 */
async function downloadAndSplitArticles(celexNumber, customHtmlDir = null) {
    console.log(`Downloading and splitting articles for CELEX: ${celexNumber}`);
    try {
        // Use custom HTML directory if provided, otherwise use the global one
        const targetHtmlDir = customHtmlDir || articlesHtmlDir;
        console.log(`Target HTML directory: ${targetHtmlDir}`);

        // Run split-articles.js to extract articles
        await runCommand('node', [
            path.join(__dirname, 'split-articles.js'),
            celexNumber,
            targetHtmlDir // Pass the target HTML directory
        ]);

        // Check if articles were created
        if (!fs.existsSync(targetHtmlDir)) {
            console.error(`Articles directory not created: ${targetHtmlDir}`);
            return [];
        }

        // Get all HTML files
        const files = fs.readdirSync(targetHtmlDir)
            .filter(file => file.endsWith('.html') && !file.includes('_full_html'))
            .map(file => path.join(targetHtmlDir, file));

        // Also copy the full HTML to the base dir
        const fullHtmlSrc = path.join(targetHtmlDir, `${celexNumber}_full_html.html`);
        const fullHtmlDest = path.join(outputDir, `${celexNumber}_full_html.html`);
        if (fs.existsSync(fullHtmlSrc)) {
            fs.copyFileSync(fullHtmlSrc, fullHtmlDest);
        }

        console.log(`Found ${files.length} article files in ${targetHtmlDir}`);

        // Log the list of files for debugging
        if (files.length > 0) {
            console.log("Article HTML files:");
            files.forEach(file => console.log(`  - ${file}`));
        } else {
            console.log("Warning: No article HTML files found. They may not have been properly extracted.");
        }

        return files;
    } catch (error) {
        console.error(`Error downloading and splitting articles: ${error.message}`);
        return [];
    }
}

/**
 * Convert HTML files to Markdown using html-to-md.js
 * @param {Array<string>} htmlFiles - Array of HTML file paths
 * @param {string} outputDir - Output directory for markdown files
 * @returns {Promise<Array<string>>} - Array of saved markdown file paths
 */
async function convertHtmlToMarkdown(htmlFiles, outputDir) {
    console.log(`Converting ${htmlFiles.length} HTML files to Markdown using html-to-md.js`);
    console.log(`Output directory for markdown files: ${outputDir}`);

    // Store original HTML file count and paths for verification
    const originalHtmlFiles = [...htmlFiles];

    // Make sure the output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const mdFiles = [];

    // Process each file individually to avoid path issues with spaces
    for (const htmlFile of htmlFiles) {
        try {
            // Verify HTML file exists before conversion
            if (!fs.existsSync(htmlFile)) {
                console.error(`WARNING: HTML file does not exist before conversion: ${htmlFile}`);
                continue;
            }

            // Generate the output markdown file path
            const baseName = path.basename(htmlFile, '.html');
            const mdFile = path.join(outputDir, `${baseName}.md`);

            console.log(`Converting: ${htmlFile} → ${mdFile}`);

            // Convert individual file directly - this avoids path issues with spaces
            await runCommand('node', [
                path.join(__dirname, 'html-to-md.js'),
                htmlFile,
                mdFile
            ]);

            mdFiles.push(mdFile);

            // Verify HTML file still exists after conversion
            if (fs.existsSync(htmlFile)) {
                console.log(`  ✓ Original HTML file preserved: ${htmlFile}`);
            } else {
                console.error(`  ✗ ERROR: Original HTML file missing after conversion: ${htmlFile}`);
            }
        } catch (error) {
            console.error(`Error converting file ${htmlFile} to Markdown: ${error.message}`);
        }
    }

    // Final verification of all original HTML files
    const missingFiles = originalHtmlFiles.filter(file => !fs.existsSync(file));
    if (missingFiles.length > 0) {
        console.error(`ERROR: ${missingFiles.length} HTML files are missing after conversion!`);
        missingFiles.forEach(file => console.error(`  Missing: ${file}`));
    } else {
        console.log(`✓ All ${originalHtmlFiles.length} original HTML files successfully preserved.`);
    }

    console.log(`Converted HTML files to Markdown in ${outputDir}`);
    console.log(`Original HTML files remain in their original locations`);
    return mdFiles;
}

/**
 * Try to get case metadata from Publications Office API XML
 */
async function tryGetCaseMetadataFromXml(celexRef) {
    try {
        const response = await makeRequestWithRetry(
            `https://publications.europa.eu/resource/celex/${celexRef}`,
            {
                headers: {
                    'Accept': 'application/xml;notice=branch',
                    'Accept-Language': 'eng'
                },
                timeout: 30000  // Increased to 30 seconds
            }
        );

        const result = await parseXmlString(response.data);
        const xmlString = response.data;

        console.log('\nProcessing XML for', celexRef);

        // Initialize metadata variables
        let caseNumber = null;
        let caseNumberSource = null;
        let parties = null;
        let partiesSource = null;
        let agOpinionUrl = null;
        let title = null;
        let titleLanguage = null;

        // Extract case number using the correct XPath
        console.log('\nTrying case number path:');
        const caseIdentifier = result?.NOTICE?.EXPRESSION?.[0]?.['EXPRESSION_CASE-LAW_IDENTIFIER_CASE']?.[0]?.VALUE?.[0];
        if (caseIdentifier) {
            caseNumber = caseIdentifier;
            caseNumberSource = 'XML_CASE_LAW_IDENTIFIER';
            console.log('Found case number from XML path:', caseNumber);
        }

        // If no case number found in XML, try regex
        if (!caseNumber) {
            console.log('\nTrying regex for case number:');
            const caseMatch = xmlString.match(/<VALUE>Case\s+([C]-\d+\/\d+)<\/VALUE>/i) ||
                xmlString.match(/Case\s+([C]-\d+\/\d+)/i);
            if (caseMatch) {
                caseNumber = caseMatch[1];
                caseNumberSource = 'XML_REGEX';
                console.log('Found case number from regex:', caseNumber);
            }
        }

        // Extract parties using the correct XPath
        console.log('\nTrying parties paths:');
        const expressionParties = result?.NOTICE?.EXPRESSION?.[0]?.['EXPRESSION_CASE-LAW_PARTIES']?.[0]?.VALUE?.[0];
        const simpleParties = result?.NOTICE?.EXPRESSION?.[0]?.['PARTIES']?.[0]?.VALUE?.[0];

        if (expressionParties) {
            parties = expressionParties.trim()
                .replace(/\s+/g, ' ')
                .replace(/[""]/g, '"')
                .replace(/['']/g, "'");
            partiesSource = 'XML_EXPRESSION_PARTIES';
            console.log('Found parties from EXPRESSION_CASE-LAW_PARTIES:', parties);
        } else if (simpleParties) {
            parties = simpleParties.trim()
                .replace(/\s+/g, ' ')
                .replace(/[""]/g, '"')
                .replace(/['']/g, "'");
            partiesSource = 'XML_PARTIES';
            console.log('Found parties from PARTIES:', parties);
        }

        // Extract AG opinion URL using the correct XPath
        console.log('\nTrying AG opinion URL path:');
        const agOpinionIdentifier = result?.NOTICE?.WORK?.[0]?.['CASE-LAW_DELIVERED_BY_ADVOCATE-GENERAL']?.[0]?.SAMEAS?.[0]?.URI?.[0]?.IDENTIFIER?.[0];
        if (agOpinionIdentifier) {
            agOpinionUrl = agOpinionIdentifier;
            console.log('Found AG opinion URL:', agOpinionUrl);
        }

        const metadata = {
            caseNumber,
            parties,
            agOpinionUrl,
            title,
            titleLanguage,
            _debug: {
                caseNumberSource,
                partiesSource
            }
        };

        // Log successful extraction with source paths
        console.log('\nFinal metadata:', metadata);

        return metadata;

    } catch (error) {
        console.error(`XML metadata fetch failed for ${celexRef}:`, error.message);
        if (error.response?.status) {
            console.error(`Status code: ${error.response.status}`);
        }
        if (error.response?.data) {
            console.error('Error response data:', error.response.data);
        }
        return null;
    }
}

/**
 * Extract case number and metadata using both XML and HTML methods
 */
async function extractCaseMetadata(celexRef, linkUrl) {
    // First try XML metadata
    const xmlMetadata = await tryGetCaseMetadataFromXml(celexRef);
    if (xmlMetadata?.caseNumber) {
        return {
            celexRef,
            caseNumber: xmlMetadata.caseNumber,
            parties: xmlMetadata.parties,
            agName: null,
            source: 'xml'
        };
    }

    // Fallback to HTML parsing
    try {
        const response = await makeRequestWithRetry(linkUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const titleText = $('#title').text() || $('title').text();
        const pageText = $('body').text();

        const caseNumberMatch =
            pageText.match(/In\s+Case\s+([C][-‑]\s*\d+[\/-]\d+)/i) ||
            pageText.match(/In\s+Case\s+([C]\s+\d+[\/-]\d+)/i) ||
            titleText.match(/Case\s+([C][-‑]\s*\d+[\/-]\d+)/i) ||
            titleText.match(/([C][-‑]\s*\d+[\/-]\d+)/i) ||
            titleText.match(/Case\s+([C]\s+\d+[\/-]\d+)/i) ||
            titleText.match(/([C]\s+\d+[\/-]\d+)/i);

        if (caseNumberMatch && caseNumberMatch[1]) {
            let caseNumber = caseNumberMatch[1].trim()
                .replace(/\s+/g, '-')
                .replace(/\//, '-')
                .replace(/‑/, '-');

            if (!caseNumber.startsWith('C-')) {
                caseNumber = `C-${caseNumber.substring(1)}`;
            }

            return {
                celexRef,
                caseNumber,
                parties: null,
                agName: null,
                source: 'html'
            };
        }

        return {
            celexRef,
            caseNumber: null,
            parties: null,
            agName: null,
            source: null
        };
    } catch (error) {
        console.error(`Error extracting case number for ${celexRef}: ${error.message}`);
        return {
            celexRef,
            caseNumber: null,
            parties: null,
            agName: null,
            source: null
        };
    }
}

/**
 * Generate a filename from case metadata
 */
function generateFilename(caseNumber, parties = null) {
    // Sanitize case number by replacing / with -
    const sanitizedCaseNumber = caseNumber.replace(/\//g, '-');

    if (parties) {
        // Sanitize parties text:
        // 1. Replace illegal characters with -
        // 2. Trim spaces
        // 3. Limit length to avoid too long filenames
        // 4. Handle additional problematic characters
        const sanitizedParties = parties
            .replace(/[\/\\?%*:|"<>]/g, '-') // Replace illegal chars
            .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Remove control chars
            .replace(/[.,;!@#$^&()=+\[\]{}]/g, '-') // Replace punctuation
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/-+/g, '-') // Avoid multiple consecutive dashes
            .trim()
            .substring(0, 100); // Limit to 100 chars for parties name

        return `${sanitizedCaseNumber} ${sanitizedParties}.html`;
    }
    return `${sanitizedCaseNumber}.html`;
}

/**
 * Extract all possible article references from text
 */
/**
 * Extracts all article, chapter, and recital references from text,
 * normalizing them to a standard format.
 * 
 * @param {string} text - The input text to search for references
 * @return {string[]} - Array of normalized references sorted by type and number
 */
function extractAllArticleReferences(text) {
    const references = new Set();

    // 1. Structured references with nested elements
    const structuredMatches = text.matchAll(
        /article\s+(\d{1,3})\s*(?:paragraph\s+(\d+)(?:\s+unnumbered\s+paragraph\s+(\d+))?)?(?:\s+point\s+\(([a-z])\))?(?:\s+sentence\s+(\d+))?/gi
    );

    // 2. A-format references in all variations
    const aFormatMatches = text.matchAll(
        /\b[aA]0*(\d{1,3})(?:[pP](?:\d+|[tT]\d+))?(?:[lL][A-Za-z](?:\d+)?)?(?:[aA]\d+)?/g
    );

    // 3. Simple article references
    const articleMatches = text.matchAll(/\barticle\s+(\d{1,3})/gi);

    // 4. Art. format references
    const artMatches = text.matchAll(/\bart\.?\s+(\d{1,3})/gi);

    // 5. Chapter references (both Roman and Arabic numerals)
    const chapterMatches = text.matchAll(/\bchapter\s+([ivxlcdmIVXLCDM0-9]+)/gi);

    // 6. Recital references
    const recitalMatches = text.matchAll(/\brecital\s+(\d{1,3})/gi);

    // 7. Point references (context-aware)
    const pointMatches = text.matchAll(/\bpoint\s+(\d+|\([a-z]\))/gi);

    // Process all matches
    for (const match of structuredMatches) {
        references.add(`Article ${parseInt(match[1], 10)}`);
    }

    for (const match of aFormatMatches) {
        references.add(`Article ${parseInt(match[1], 10)}`);
    }

    for (const match of articleMatches) {
        references.add(`Article ${parseInt(match[1], 10)}`);
    }

    for (const match of artMatches) {
        references.add(`Article ${parseInt(match[1], 10)}`);
    }

    for (const match of chapterMatches) {
        // Preserve original capitalization for Roman numerals
        references.add(`Chapter ${match[1].toUpperCase()}`);
    }

    for (const match of recitalMatches) {
        references.add(`Recital ${parseInt(match[1], 10)}`);
    }

    // Context-aware point reference handling
    for (const match of pointMatches) {
        // Look for nearest preceding article reference
        const contextBefore = text.slice(0, match.index);
        const articleMatch = contextBefore.match(/article\s+(\d{1,3})/i);
        if (articleMatch) {
            references.add(`Article ${parseInt(articleMatch[1], 10)}`);
        }
    }

    // Sort references by type and number
    return Array.from(references).sort((a, b) => {
        // First sort by reference type
        const typeA = a.split(' ')[0];
        const typeB = b.split(' ')[0];
        if (typeA !== typeB) {
            // Custom ordering: Articles first, then Chapters, then Recitals
            const typeOrder = { 'Article': 1, 'Chapter': 2, 'Recital': 3 };
            return typeOrder[typeA] - typeOrder[typeB];
        }

        // Then sort by number (handling both numeric and Roman numerals)
        const valueA = a.split(' ')[1];
        const valueB = b.split(' ')[1];
        const numA = parseInt(valueA, 10);
        const numB = parseInt(valueB, 10);

        // If both are numeric, compare as numbers
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }

        // Otherwise do string comparison (handles Roman numerals)
        return valueA.localeCompare(valueB);
    });
}

/**
 * Determine the category of a case reference based on CELEX number and text
 * @param {string} celexRef - The CELEX reference number
 * @param {string} text - The descriptive text
 * @returns {string} - The category ('Preliminary question', 'Interpreted', or 'Other')
 */
function determineCategory(celexRef, text) {
    console.log(`\nClassifying ${celexRef}:`);
    console.log(`Text: ${text}`);

    // First try text-based pattern matching
    const textLower = text.toLowerCase();

    // Clear preliminary reference indicators
    if (textLower.includes('preliminary ruling') ||
        textLower.includes('preliminary reference') ||
        textLower.includes('preliminary question') ||
        textLower.includes('request for a preliminary ruling')) {
        console.log('✓ Classified as Preliminary question based on text pattern');
        console.log('  Matched patterns:', [
            textLower.includes('preliminary ruling') ? 'preliminary ruling' : null,
            textLower.includes('preliminary reference') ? 'preliminary reference' : null,
            textLower.includes('preliminary question') ? 'preliminary question' : null,
            textLower.includes('request for a preliminary ruling') ? 'request for a preliminary ruling' : null
        ].filter(Boolean).join(', '));
        return 'Preliminary question';
    }

    // Clear interpretation indicators
    if (textLower.includes('interpreted by') ||
        textLower.includes('interpretation of article') ||
        textLower.includes('interpretation of the') ||
        (textLower.includes('interpret') && textLower.includes('article'))) {
        console.log('✓ Classified as Interpreted based on text pattern');
        console.log('  Matched patterns:', [
            textLower.includes('interpreted by') ? 'interpreted by' : null,
            textLower.includes('interpretation of article') ? 'interpretation of article' : null,
            textLower.includes('interpretation of the') ? 'interpretation of the' : null,
            (textLower.includes('interpret') && textLower.includes('article')) ? 'interpret + article' : null
        ].filter(Boolean).join(', '));
        return 'Interpreted';
    }

    // If text analysis is inconclusive, use CELEX number structure
    // Format: 6YYYYT[J|N]XXXX where:
    // - 6: Case law
    // - YYYY: Year
    // - T: Type (C for Court of Justice)
    // - J: Judgment (CJ = interpretation)
    // - N: Notice (CN = preliminary reference)
    // - XXXX: Number
    const celexMatch = celexRef.match(/^6(\d{4})C([JN])(\d{4})$/);
    if (celexMatch) {
        const [_, year, typeCode, number] = celexMatch;
        console.log(`  CELEX breakdown: Year=${year}, Type=${typeCode}, Number=${number}`);

        // CJ documents are interpretations
        if (typeCode === 'J') {
            console.log('✓ Classified as Interpreted based on CJ document type');
            return 'Interpreted';
        }
        // CN documents are preliminary references
        if (typeCode === 'N') {
            console.log('✓ Classified as Preliminary question based on CN document type');
            return 'Preliminary question';
        }
    } else {
        console.log('! CELEX number does not match expected pattern');
        console.log('  Expected format: 6YYYYC[J|N]XXXX');
        console.log('  Actual format:  ' + celexRef);
    }

    console.log('! No clear classification found, defaulting to Other');
    return 'Other';
}

/**
 * Main function to scrape and process data
 * @param {string} celexNumberParam - The CELEX number to process
 * @param {boolean} skipDownloadParam - Whether to skip downloading HTML files
 * @param {Object} dirsParam - Directory structure object
 * @returns {Promise<void>}
 */
async function scrapeEurLex(celexNumberParam, skipDownloadParam, dirsParam) {
    // Use parameters if provided, otherwise use global variables
    const celexToUse = celexNumberParam || celexNumber;
    const skipDownloadToUse = skipDownloadParam !== undefined ? skipDownloadParam : skipDownload;

    // Local variables for directories
    let localOutputDir = outputDir;
    let localArticlesDir = articlesDir;
    let localArticlesHtmlDir = articlesHtmlDir;
    let localArticlesMdDir = articlesMdDir;
    let localCaseLawDir = caseLawDir;
    let localCategoryDirs = categoryDirs;

    // If directories are provided, update the local variables
    if (dirsParam) {
        localOutputDir = dirsParam.outputDir;
        localArticlesDir = dirsParam.articlesDir;
        localArticlesHtmlDir = dirsParam.articlesHtmlDir;
        localArticlesMdDir = dirsParam.articlesMdDir;
        localCaseLawDir = dirsParam.caseLawDir;
        localCategoryDirs = dirsParam.categoryDirs;
    }

    // Create missing directories if necessary
    [localArticlesDir, localArticlesHtmlDir, localArticlesMdDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.log(`Creating directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    const urlToUse = `https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:${celexToUse}`;

    console.log(`Scraping EUR-Lex for CELEX: ${celexToUse}`);
    console.log(`URL: ${urlToUse}`);
    console.log(`Articles HTML directory: ${localArticlesHtmlDir}`);
    console.log(`Articles MD directory: ${localArticlesMdDir}`);

    if (skipDownloadToUse) {
        console.log('HTML download is disabled. Only metadata will be collected.');
    }

    try {
        // Download and split articles
        console.log('Downloading and splitting articles...');
        const articleFiles = await downloadAndSplitArticles(celexToUse, localArticlesHtmlDir);

        if (articleFiles.length > 0) {
            // Convert article HTML files to Markdown
            console.log('Converting article HTML files to Markdown...');
            await convertHtmlToMarkdown(articleFiles, localArticlesMdDir);

            // Also convert the full HTML file
            const fullHtmlPath = path.join(localOutputDir, `${celexToUse}_full_html.html`);
            if (fs.existsSync(fullHtmlPath)) {
                // Create a specific output path for the full HTML markdown file
                const fullMdPath = path.join(localOutputDir, `${celexToUse}_full_html.md`);
                await runCommand('node', [path.join(__dirname, 'html-to-md.js'), fullHtmlPath, fullMdPath]);
            }
        }

        // Fetch the webpage
        const response = await makeRequestWithRetry(urlToUse);
        const html = response.data;
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

            // Determine category
            const category = determineCategory(celexRef, text);

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

        // Step 1: Create initial markdown files based on main page scraping
        await createInitialMarkdownFiles(categories, localOutputDir);

        // Step 2: Try to get metadata for all references
        const metadataResults = await fetchMetadataForAllReferences(categories, localOutputDir);

        // Step 3: Process case references based on download option
        if (!skipDownloadToUse) {
            // Download HTML files - use a modified approach that uses local directory variables
            console.log('Downloading case HTML files...');
            await downloadMissingFiles(categories, metadataResults, localCategoryDirs, localOutputDir, localCaseLawDir);
        } else {
            await processCaseReferencesWithoutDownload(categories, localOutputDir);
        }

        // Step 4: Update both categories and article references with metadata
        for (const [category, items] of Object.entries(categories)) {
            items.forEach(item => {
                const metadata = metadataResults.get(item.celexRef);
                if (metadata) {
                    Object.assign(item, metadata);
                }
            });
        }

        // Step 5: Update article references with full metadata
        updateArticleReferencesWithMetadata(articleReferences, categories, metadataResults);

        // Step 6: Create final markdown files
        if (Object.keys(categories).length > 0) {
            await createCategoryMarkdown(categories, localCaseLawDir);
        }
        if (Object.keys(articleReferences).length > 0) {
            await createArticleMarkdown(articleReferences, categories, localCaseLawDir);
        }

        // Convert case-law HTML files to markdown
        console.log('Converting case-law HTML files to markdown...');

        // Create a mapping from category names to keys
        const categoryMapping = {
            'Interpreted': 'interpreted',
            'Preliminary question': 'preliminary',
            'Other': 'other'
        };

        for (const [category, categoryKey] of Object.entries(categoryMapping)) {
            const htmlDir = path.join(localCaseLawDir, categoryKey, 'html');
            const mdDir = path.join(localCaseLawDir, categoryKey, 'md');

            // Check if HTML directory exists and has files
            if (fs.existsSync(htmlDir)) {
                const htmlFiles = fs.readdirSync(htmlDir)
                    .filter(file => file.endsWith('.html'))
                    .map(file => path.join(htmlDir, file));

                if (htmlFiles.length > 0) {
                    console.log(`Converting ${htmlFiles.length} HTML files for category ${category}...`);
                    await convertHtmlToMarkdown(htmlFiles, mdDir);
                } else {
                    console.log(`No HTML files found in ${htmlDir}`);
                }
            } else {
                console.log(`HTML directory does not exist: ${htmlDir}`);
            }
        }

        console.log('Processing complete!');

    } catch (error) {
        console.error('Error scraping EUR-Lex:', error.message);
        if (error.response) {
            console.error(`Status code: ${error.response.status}`);
        }
        throw error;
    }
}

/**
 * Process case references with full HTML download
 */
async function processCaseReferencesWithDownload(categories) {
    const allItems = [
        ...categories['Preliminary question'],
        ...categories['Interpreted'],
        ...categories['Other']
    ];

    console.log(`Processing ${allItems.length} case references with HTML download...`);

    const htmlDir = path.join(outputDir, 'html');
    if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir);
    }

    // Create summary files
    const summaryPath = path.join(outputDir, 'download-summary.md');
    let summaryContent = `# Download Summary\n\n`;
    summaryContent += `Total files to process: ${allItems.length}\n\n`;
    summaryContent += `| CELEX | Case Number | Source | Status | Error |\n`;
    summaryContent += `|-------|-------------|--------|--------|-------|\n`;

    const metadataPath = path.join(outputDir, 'case-metadata.md');
    let metadataContent = `# Case Metadata\n\n`;
    metadataContent += `| CELEX | Case Number | Parties | AG Opinion | Source | Link |\n`;
    metadataContent += `|-------|-------------|---------|------------|--------|------|\n`;

    let successCount = 0;
    let failureCount = 0;
    let metadataCount = 0;

    for (const [index, item] of allItems.entries()) {
        try {
            // Rate limiting
            if (index > 0 && index % 5 === 0) {
                console.log(`Pausing for 2 seconds to avoid rate limiting (${index}/${allItems.length})...`);
                await delay(2000);
            }

            console.log(`Processing ${item.celexRef} (${index + 1}/${allItems.length})...`);

            // Try to get metadata and case number
            const metadata = await extractCaseMetadata(item.celexRef, item.linkUrl);

            let filename = item.celexRef; // default
            if (metadata.caseNumber) {
                filename = generateFilename(metadata.caseNumber, metadata.parties);
                item.caseNumber = metadata.caseNumber;
                metadataCount++;

                metadataContent += `| ${item.celexRef} | ${metadata.caseNumber} | ${metadata.parties || 'N/A'} | ${metadata.agName || 'N/A'} | ${metadata.source} | [Link](${item.linkUrl}) |\n`;
            }

            // Download and save HTML
            const response = await axios.get(item.linkUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const htmlPath = path.join(htmlDir, filename);
            fs.writeFileSync(htmlPath, response.data);

            summaryContent += `| ${item.celexRef} | ${metadata.caseNumber || 'N/A'} | ${metadata.source || 'N/A'} | ✅ Success | - |\n`;
            successCount++;
        } catch (error) {
            console.error(`Error processing ${item.celexRef}: ${error.message}`);

            let errorMessage = error.message;
            if (error.response) {
                errorMessage = `Status ${error.response.status}: ${error.message}`;
            }

            summaryContent += `| ${item.celexRef} | N/A | N/A | ❌ Failed | ${errorMessage} |\n`;
            failureCount++;
        }
    }

    // Update summary with final counts
    summaryContent = summaryContent.replace(
        `Total files to process: ${allItems.length}`,
        `Total files to process: ${allItems.length}\nSuccessful downloads: ${successCount}\nFailed downloads: ${failureCount}\nMetadata extracted: ${metadataCount}`
    );

    // Save summary files
    fs.writeFileSync(summaryPath, summaryContent);
    fs.writeFileSync(metadataPath, metadataContent);

    console.log(`Processing complete: ${successCount} successful, ${failureCount} failed, ${metadataCount} metadata extracted`);
}

/**
 * Process case references without downloading HTML
 */
async function processCaseReferencesWithoutDownload(categories, outputDir) {
    const allItems = [
        ...categories['Preliminary question'],
        ...categories['Interpreted'],
        ...categories['Other']
    ];

    console.log(`Processing ${allItems.length} case references without HTML download...`);

    // Create metadata file
    const metadataPath = path.join(outputDir, 'case-metadata.md');
    let metadataContent = `# Case Metadata\n\n`;
    metadataContent += `| CELEX | Case Number | Parties | AG Opinion | Source | Link |\n`;
    metadataContent += `|-------|-------------|---------|------------|--------|------|\n`;

    // Deduplicate items by CELEX reference
    const uniqueCelexMap = new Map();
    allItems.forEach(item => {
        // If this CELEX hasn't been seen yet, or we're replacing with an item from a more important category
        const existingItem = uniqueCelexMap.get(item.celexRef);
        const categoryPriority = { 'Interpreted': 0, 'Preliminary question': 1, 'Other': 2 };

        if (!existingItem || categoryPriority[item.category] < categoryPriority[existingItem.category]) {
            uniqueCelexMap.set(item.celexRef, item);
        }
    });

    // Convert back to array with only unique CELEX references
    const uniqueItems = Array.from(uniqueCelexMap.values());

    console.log(`Found ${allItems.length} total references, reduced to ${uniqueItems.length} unique CELEX numbers after deduplication.`);

    // Sample a subset of items to process (to avoid too many requests)
    const sampleSize = Math.min(50, Math.ceil(uniqueItems.length * 0.1));
    const sampledItems = uniqueItems.slice(0, sampleSize);

    console.log(`Sampling ${sampleSize} unique references to extract metadata...`);

    let metadataCount = 0;

    for (const [index, item] of sampledItems.entries()) {
        try {
            // Rate limiting
            if (index > 0 && index % 5 === 0) {
                console.log(`Pausing for 2 seconds to avoid rate limiting (${index}/${sampleSize})...`);
                await delay(2000);
            }

            console.log(`Processing ${item.celexRef} (${index + 1}/${sampleSize})...`);
            const metadata = await extractCaseMetadata(item.celexRef, item.linkUrl);

            if (metadata.caseNumber) {
                metadataCount++;
                item.caseNumber = metadata.caseNumber;
                metadataContent += `| ${item.celexRef} | ${metadata.caseNumber} | ${metadata.parties || 'N/A'} | ${metadata.agName || 'N/A'} | ${metadata.source} | [Link](${item.linkUrl}) |\n`;
            } else {
                metadataContent += `| ${item.celexRef} | N/A | N/A | N/A | N/A | [Link](${item.linkUrl}) |\n`;
            }
        } catch (error) {
            console.error(`Error processing ${item.celexRef}: ${error.message}`);
            metadataContent += `| ${item.celexRef} | Error | Error | Error | Error | [Link](${item.linkUrl}) |\n`;
        }
    }

    // Add a note about sampling
    if (uniqueItems.length > sampleSize) {
        metadataContent = `# Case Metadata\n\n` +
            `**Note:** This is a sample of ${sampleSize} out of ${uniqueItems.length} unique references ` +
            `(from a total of ${allItems.length} references with duplicates). ` +
            `Run without --skip-download to process all references.\n\n` +
            metadataContent.split('\n').slice(2).join('\n');
    }

    // Save metadata file
    fs.writeFileSync(metadataPath, metadataContent);
    console.log(`Metadata extraction complete: ${metadataCount} metadata entries found`);
}

/**
 * Update article references with full metadata from case metadata results
 */
function updateArticleReferencesWithMetadata(articleReferences, categories, metadataResults) {
    // Create a map of celexRef to full metadata
    const celexToMetadata = new Map();
    metadataResults.forEach((metadata, celexRef) => {
        celexToMetadata.set(celexRef, metadata);
    });

    // Also collect metadata from categories for backup
    const allItems = [
        ...categories['Preliminary question'],
        ...categories['Interpreted'],
        ...categories['Other']
    ];

    allItems.forEach(item => {
        if (item.caseNumber && !celexToMetadata.has(item.celexRef)) {
            celexToMetadata.set(item.celexRef, {
                caseNumber: item.caseNumber,
                parties: item.parties,
                agName: item.agName
            });
        }
    });

    // Update article references with full metadata
    for (const articleRef in articleReferences) {
        articleReferences[articleRef].forEach(item => {
            const metadata = celexToMetadata.get(item.celexRef);
            if (metadata) {
                Object.assign(item, metadata);
            }
        });
    }

    console.log(`Updated article references with metadata from ${celexToMetadata.size} cases`);
}

/**
 * Create markdown files for each category
 */
async function createCategoryMarkdown(categories, outputDir) {
    for (const [category, items] of Object.entries(categories)) {
        if (items.length === 0) continue;

        const fileName = `${category.replace(/\s+/g, '-').toLowerCase()}.md`;
        const filePath = path.join(outputDir, fileName);

        let content = `# ${category} Cases\n\n`;
        content += `Total: ${items.length}\n\n`;
        content += `| Case Number | Parties | CELEX | Link |\n`;
        content += `|------------|---------|-------|------|\n`;

        items.forEach(item => {
            const parties = item.parties || 'N/A';
            const caseNumber = item.caseNumber || 'N/A';
            content += `| ${caseNumber} | ${parties} | ${item.celexRef} | [Link](${item.linkUrl}) |\n`;
        });

        fs.writeFileSync(filePath, content);
        console.log(`Created ${fileName}`);
    }
}

/**
 * Create article markdown file for article-specific references
 */
async function createArticleMarkdown(articleReferences, categories, outputDir) {
    // Create separate references for interpreted and preliminary questions
    const interpretedReferences = {};
    const preliminaryReferences = {};

    // Track cases that have been referenced under specific articles
    const casesWithArticles = new Set();

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
            if (articleMatch && parseInt(articleMatch[1], 10) > 0) {
                normalizedArticle = `Article ${parseInt(articleMatch[1], 10)}`;
            } else {
                // If we can't extract a valid article number > 0, skip this entry
                console.log(`Skipping invalid article reference: ${article}`);
                continue;
            }

            // Try to extract recital number
            const recitalMatch = article.match(/recital\s+(\d+)/i);
            if (recitalMatch && parseInt(recitalMatch[1], 10) > 0) {
                normalizedArticle = `Recital ${parseInt(recitalMatch[1], 10)}`;
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
            // Track cases that have specific article references
            casesWithArticles.add(item.celexRef);

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

    // Helper function to extract number from article/recital reference
    const extractNumber = (ref) => {
        const match = ref.match(/\d+/);
        return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
    };

    // Helper function to sort articles and recitals
    const sortReferences = (refs) => {
        return Object.keys(refs).sort((a, b) => {
            // First sort by type (Articles before Recitals)
            const aIsArticle = a.toLowerCase().startsWith('article');
            const bIsArticle = b.toLowerCase().startsWith('article');
            if (aIsArticle !== bIsArticle) {
                return aIsArticle ? -1 : 1;
            }
            // Then sort by number
            return extractNumber(a) - extractNumber(b);
        });
    };

    // Create articles-interpreted.md
    const interpretedPath = path.join(outputDir, 'articles-interpreted.md');
    let interpretedContent = '# Interpreted Article References\n\n';

    // Count total unique interpreted articles
    const uniqueInterpretedArticles = Object.keys(interpretedReferences).filter(
        article => interpretedReferences[article].length > 0
    ).length;

    interpretedContent += `Total unique articles referenced: ${uniqueInterpretedArticles}\n\n`;

    // Sort articles and recitals
    const sortedInterpretedArticles = sortReferences(interpretedReferences);

    for (const article of sortedInterpretedArticles) {
        const items = interpretedReferences[article];
        if (items.length === 0) continue;

        interpretedContent += `## ${article}\n\n`;
        interpretedContent += `Total references: ${items.length}\n\n`;
        interpretedContent += `| Case Number | Parties | CELEX | Link |\n`;
        interpretedContent += `|------------|---------|-------|------|\n`;

        items.forEach(item => {
            const caseNumber = item.caseNumber || 'N/A';
            const parties = item.parties || 'N/A';
            interpretedContent += `| ${caseNumber} | ${parties} | ${item.celexRef} | [Link](${item.linkUrl}) |\n`;
        });
        interpretedContent += '\n';
    }

    // Add general interpretations section
    const generalInterpretations = interpretedItems.filter(item => !casesWithArticles.has(item.celexRef));
    if (generalInterpretations.length > 0) {
        interpretedContent += `## General Interpretations\n\n`;
        interpretedContent += `Cases that interpret the regulation generally, without reference to specific articles.\n\n`;
        interpretedContent += `Total references: ${generalInterpretations.length}\n\n`;
        interpretedContent += `| Case Number | Parties | CELEX | Link |\n`;
        interpretedContent += `|------------|---------|-------|------|\n`;

        generalInterpretations.forEach(item => {
            const caseNumber = item.caseNumber || 'N/A';
            const parties = item.parties || 'N/A';
            interpretedContent += `| ${caseNumber} | ${parties} | ${item.celexRef} | [Link](${item.linkUrl}) |\n`;
        });
        interpretedContent += '\n';
    }

    fs.writeFileSync(interpretedPath, interpretedContent);
    console.log('Created articles-interpreted.md');

    // Create articles-preliminary.md with similar format
    const preliminaryPath = path.join(outputDir, 'articles-preliminary.md');
    let preliminaryContent = '# Preliminary Question Article References\n\n';

    const uniquePreliminaryArticles = Object.keys(preliminaryReferences).filter(
        article => preliminaryReferences[article].length > 0
    ).length;

    preliminaryContent += `Total unique articles referenced: ${uniquePreliminaryArticles}\n\n`;

    // Sort articles and recitals
    const sortedPreliminaryArticles = sortReferences(preliminaryReferences);

    for (const article of sortedPreliminaryArticles) {
        const items = preliminaryReferences[article];
        if (items.length === 0) continue;

        preliminaryContent += `## ${article}\n\n`;
        preliminaryContent += `Total references: ${items.length}\n\n`;
        preliminaryContent += `| Case Number | Parties | CELEX | Link |\n`;
        preliminaryContent += `|------------|---------|-------|------|\n`;

        items.forEach(item => {
            const caseNumber = item.caseNumber || 'N/A';
            const parties = item.parties || 'N/A';
            preliminaryContent += `| ${caseNumber} | ${parties} | ${item.celexRef} | [Link](${item.linkUrl}) |\n`;
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
    console.log("Preparing to download case HTML files...");

    // First, create initial markdown files based on main page scraping
    await createInitialMarkdownFiles(categories, outputDir);

    // Then try to get metadata for all references
    const metadataResults = await fetchMetadataForAllReferences(categories, outputDir);

    // Map category names to their directory paths within case-law
    const categoryMapping = {
        'Interpreted': 'interpreted',
        'Preliminary question': 'preliminary',
        'Other': 'other'
    };

    // Create a mapping for category directories
    const mappedCategoryDirs = {};

    // For each category, ensure the HTML directory exists
    for (const [category, dirKey] of Object.entries(categoryMapping)) {
        const htmlDir = path.join(caseLawDir, dirKey, 'html');
        mappedCategoryDirs[dirKey] = htmlDir;

        // Ensure directory exists
        if (!fs.existsSync(htmlDir)) {
            fs.mkdirSync(htmlDir, { recursive: true });
            console.log(`Created directory: ${htmlDir}`);
        }
    }

    // Download HTML files where needed
    await downloadMissingFiles(categories, metadataResults, mappedCategoryDirs, outputDir, caseLawDir);
}

/**
 * Download HTML files for references where metadata failed
 */
async function downloadMissingFiles(categories, metadataResults, categoryDirs, outputDir, caseLawDir) {
    const downloadSummaryPath = path.join(outputDir, 'download-summary.md');
    let summaryContent = '# Download Summary\n\n';
    let downloadCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Track which CELEX numbers have already been downloaded
    const downloadedCelex = new Set();

    // Create a mapping from category names to keys
    const categoryMapping = {
        'Interpreted': 'interpreted',
        'Preliminary question': 'preliminary',
        'Other': 'other'
    };

    for (const [category, items] of Object.entries(categories)) {
        // Map the category to the correct key
        const categoryKey = categoryMapping[category];

        if (!categoryKey) {
            console.error(`No mapping found for category: ${category}`);
            continue;
        }

        // Use the case-law category structure for HTML files
        const targetDir = path.join(caseLawDir, categoryKey, 'html');

        if (!fs.existsSync(targetDir)) {
            console.log(`Creating directory: ${targetDir}`);
            fs.mkdirSync(targetDir, { recursive: true });
        }

        summaryContent += `## ${category}\n\n`;

        for (const item of items) {
            try {
                console.log(`\nProcessing ${item.celexRef}...`);

                // Skip if this CELEX has already been downloaded
                if (downloadedCelex.has(item.celexRef)) {
                    console.log(`CELEX ${item.celexRef} already downloaded, skipping...`);
                    skipCount++;
                    summaryContent += `- ⏩ ${item.celexRef}: Skipped (already downloaded)\n`;
                    continue;
                }

                // Get metadata if available
                const metadata = metadataResults.get(item.celexRef);
                let filename;
                let filePath;

                // Construct the HTML download URL
                const downloadUrl = `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${item.celexRef}`;
                console.log(`Downloading from: ${downloadUrl}`);

                // Download the HTML content
                const response = await makeRequestWithRetry(downloadUrl, {
                    timeout: 30000, // 30 second timeout
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                // If we have metadata, use it for the filename
                if (metadata?.caseNumber) {
                    filename = generateFilename(metadata.caseNumber, metadata.parties);
                    filePath = path.join(targetDir, filename);
                    console.log(`Using metadata: ${filename}`);
                } else {
                    // Try to extract case number from HTML if no metadata
                    const $ = cheerio.load(response.data);
                    const titleText = $('#title').text() || $('title').text();
                    const caseMatch = titleText.match(/Case\s+([C][-‑]\s*\d+[\/-]\d+)/i);

                    if (caseMatch) {
                        const caseNumber = caseMatch[1].trim().replace(/\s+/g, '');
                        filename = generateFilename(caseNumber);
                        console.log(`Extracted case number: ${caseNumber}`);
                    } else {
                        filename = `${item.celexRef}.html`;
                        console.log(`Using CELEX as filename: ${filename}`);
                    }
                    filePath = path.join(targetDir, filename);
                }

                // Ensure we have content before trying to save
                if (response.data) {
                    try {
                        fs.writeFileSync(filePath, response.data);
                        console.log(`Saved HTML to: ${filePath}`);
                        downloadCount++;
                        summaryContent += `- ✅ ${item.celexRef}: Downloaded as ${filename}\n`;

                        // Mark this CELEX as downloaded
                        downloadedCelex.add(item.celexRef);
                    } catch (writeError) {
                        console.error(`Error writing file ${filePath}:`, writeError.message);
                        errorCount++;
                        summaryContent += `- ❌ ${item.celexRef}: Failed to write file - ${writeError.message}\n`;
                    }
                } else {
                    console.error(`No content received for ${item.celexRef}`);
                    errorCount++;
                    summaryContent += `- ❌ ${item.celexRef}: No content received\n`;
                }

                // Add delay for rate limiting
                console.log('Waiting 2 seconds before next request...');
                await delay(2000);

            } catch (error) {
                errorCount++;
                const errorMessage = error.response?.status ?
                    `HTTP ${error.response.status}: ${error.message}` :
                    error.message;

                console.error(`Error processing ${item.celexRef}:`, errorMessage);
                summaryContent += `- ❌ ${item.celexRef}: Failed - ${errorMessage}\n`;
            }
        }
        summaryContent += '\n';
    }

    // Add summary statistics
    summaryContent = `# Download Summary\n\nTotal files processed: ${downloadCount + skipCount + errorCount}\n` +
        `- Downloaded: ${downloadCount}\n` +
        `- Skipped: ${skipCount}\n` +
        `- Errors: ${errorCount}\n\n` +
        summaryContent;

    fs.writeFileSync(downloadSummaryPath, summaryContent);
    console.log(`\nDownload complete: ${downloadCount} downloaded, ${skipCount} skipped, ${errorCount} errors`);
}

/**
 * Make an HTTP request with retry mechanism
 * @param {string} url - The URL to request
 * @param {Object} options - Axios request options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 2000)
 * @returns {Promise<Object>} - Axios response
 */
async function makeRequestWithRetry(url, options = {}, maxRetries = 3, retryDelay = 2000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Request attempt ${attempt}/${maxRetries} for ${url}`);
            const response = await axios(url, options);
            return response;
        } catch (error) {
            lastError = error;

            // Log the error
            console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (error.response) {
                console.error(`Status code: ${error.response.status}`);
            }

            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
                console.error(`All ${maxRetries} attempts failed for ${url}`);
                throw error;
            }

            // Wait before the next retry
            console.log(`Waiting ${retryDelay}ms before retry...`);
            await delay(retryDelay);

            // Increase delay for next attempt (exponential backoff)
            retryDelay = Math.min(retryDelay * 1.5, 10000);
        }
    }

    // This should never be reached, but just in case
    throw lastError;
}

/**
 * Create initial markdown files based on main page scraping
 */
async function createInitialMarkdownFiles(categories, outputDir) {
    const initialPath = path.join(outputDir, 'initial-references.md');
    let content = '# Initial References from Main Page\n\n';

    for (const [category, items] of Object.entries(categories)) {
        content += `## ${category}\n\n`;
        content += `Total: ${items.length}\n\n`;

        items.forEach(item => {
            content += `- [${item.celexRef}](${item.linkUrl}) - ${item.text}\n`;
        });
        content += '\n';
    }

    fs.writeFileSync(initialPath, content);
    console.log('Created initial-references.md');
}

/**
 * Fetch metadata for all references using the Publications Office API
 */
async function fetchMetadataForAllReferences(categories, outputDir) {
    const metadataResults = new Map();
    const metadataPath = path.join(outputDir, 'case-metadata.md');
    let content = '# Case Metadata\n\n';
    content += `| CELEX | Case Number | Parties | AG Opinion | Source | Status | Link |\n`;
    content += `|-------|-------------|---------|------------|--------|--------|------|\n`;

    // Collect all items that need metadata
    const allItems = [];
    for (const [category, items] of Object.entries(categories)) {
        allItems.push(...items.map(item => ({ ...item, category })));
    }

    // Deduplicate items by CELEX reference
    const uniqueCelexMap = new Map();
    allItems.forEach(item => {
        // If this CELEX hasn't been seen yet, or we're replacing with an item from a more important category
        const existingItem = uniqueCelexMap.get(item.celexRef);
        const categoryPriority = { 'Interpreted': 0, 'Preliminary question': 1, 'Other': 2 };

        if (!existingItem || categoryPriority[item.category] < categoryPriority[existingItem.category]) {
            uniqueCelexMap.set(item.celexRef, item);
        }
    });

    // Convert back to array with only unique CELEX references
    const uniqueItems = Array.from(uniqueCelexMap.values());

    console.log(`Found ${allItems.length} total references, reduced to ${uniqueItems.length} unique CELEX numbers after deduplication.`);

    // Process in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < uniqueItems.length; i += batchSize) {
        batches.push(uniqueItems.slice(i, i + batchSize));
    }

    console.log(`Processing ${uniqueItems.length} unique references in ${batches.length} batches...`);

    // Process each batch concurrently
    for (const [batchIndex, batch] of batches.entries()) {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);

        // Process items in the batch concurrently
        const batchResults = await Promise.all(
            batch.map(async (item) => {
                try {
                    console.log(`Fetching metadata for ${item.celexRef} (${item.category})...`);
                    const metadata = await tryGetCaseMetadataFromXml(item.celexRef);

                    if (metadata) {
                        // Store metadata in the map
                        metadataResults.set(item.celexRef, {
                            caseNumber: metadata.caseNumber,
                            parties: metadata.parties,
                            agName: metadata.agName,
                            title: metadata.title,
                            category: item.category
                        });

                        // Update the item with metadata
                        Object.assign(item, metadata);

                        content += `| ${item.celexRef} | ${metadata.caseNumber || 'N/A'} | ${metadata.parties || 'N/A'} | ${metadata.agName || 'N/A'} | ${metadata._debug?.caseNumberSource || 'N/A'} | ✅ Success | [Link](${item.linkUrl}) |\n`;
                        return { success: true, item, metadata };
                    } else {
                        content += `| ${item.celexRef} | N/A | N/A | N/A | N/A | ❌ Failed | [Link](${item.linkUrl}) |\n`;
                        return { success: false, item, error: 'No metadata found' };
                    }
                } catch (error) {
                    console.error(`Error fetching metadata for ${item.celexRef}:`, error.message);
                    content += `| ${item.celexRef} | N/A | N/A | N/A | N/A | ❌ Error | [Link](${item.linkUrl}) |\n`;
                    return { success: false, item, error: error.message };
                }
            })
        );

        // Log batch results
        const successCount = batchResults.filter(r => r.success).length;
        console.log(`Batch ${batchIndex + 1} complete: ${successCount}/${batch.length} successful`);

        // Add a delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
            console.log('Waiting 2 seconds before next batch...');
            await delay(2000);
        }
    }

    fs.writeFileSync(metadataPath, content);
    console.log('Created case-metadata.md');
    return metadataResults;
}

// Main function to handle the scraping process
async function main() {
    try {
        if (!celexNumber) {
            console.error('Please provide a CELEX number as an argument');
            process.exit(1);
        }

        console.log(`Starting scraping for CELEX number: ${celexNumber}`);
        console.log(`Skip download mode: ${skipDownload}`);
        console.log(`Output directory: ${outputDir}`);

        // Initialize categories before calling downloadHtmlFiles
        const categories = {
            'Preliminary question': [],
            'Interpreted': [],
            'Other': []
        };

        // Fetch the webpage to get case references
        const url = `https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:${celexNumber}`;
        const response = await makeRequestWithRetry(url);
        const html = response.data;
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

        if (affectedByCase.length) {
            // Extract all list items
            const listItems = affectedByCase.find('li');
            console.log(`Found ${listItems.length} case references.`);

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

                // Determine category
                const category = determineCategory(celexRef, text);

                // Create a reference item with celexRef and linkUrl
                const referenceItem = {
                    celexRef,
                    text,
                    linkUrl
                };

                // Add to appropriate category
                categories[category].push(referenceItem);
            });
        } else {
            console.log('No "Affected by case" section found. The document might not have any case references or the structure is different.');
        }

        await downloadHtmlFiles(categories);

        // Call scrapeEurLex with the correct parameters
        await scrapeEurLex(celexNumber, skipDownload, {
            outputDir,
            articlesDir,
            articlesHtmlDir,
            articlesMdDir,
            caseLawDir,
            categoryDirs,
            htmlBaseDir: path.join(outputDir, 'html')
        });

        console.log('Scraping completed successfully');
    } catch (error) {
        console.error('Error during processing:', error);
        process.exit(1);
    }
}

// Run the main function if this script is executed directly
if (require.main === module) {
    main();
}

// Export the scrapeEurLex function for use in the orchestrator
module.exports = {
    scrapeEurLex
};