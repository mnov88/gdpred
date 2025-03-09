const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Directory containing case law files
const caseDir = path.join(__dirname, 'content', 'Case law');

// Function to convert case number to filename format (replacing / with -)
function caseNumberToFilename(caseNumber) {
    return caseNumber.replace('/', '-');
}

// Function to convert case number to display format (replacing / with ⧸)
function caseNumberToDisplay(caseNumber) {
    return caseNumber.replace('/', '⧸');
}

// Function to extract article references from YAML frontmatter only
function extractKeyArticleRefs(metadata) {
    // Set to store unique article numbers
    const articleSet = new Set();

    // Check if the ruling-articles field exists in the metadata
    if (metadata && metadata['ruling-articles']) {
        const rulingArticles = metadata['ruling-articles'];

        // The ruling-articles field is expected to be an array in the YAML
        if (Array.isArray(rulingArticles)) {
            rulingArticles.forEach(article => {
                // Extract just the article number if it's in the format "Article X"
                const match = article.match(/Article\s+(\d+)/);
                if (match) {
                    articleSet.add(match[1]);
                } else {
                    // If it's just the number or some other format, add it as is
                    articleSet.add(article);
                }
            });
        }
    }

    return Array.from(articleSet).sort((a, b) => Number(a) - Number(b));
}

// Main processing function
async function processFiles() {
    // Create storage for our data
    const caseArticleMap = new Map(); // case number -> articles array
    const casesInfo = new Map(); // case number -> case info object
    const articleCasesMap = new Map(); // article number -> array of case numbers

    // Get all MD files
    const files = fs.readdirSync(caseDir)
        .filter(file => file.endsWith('.md') && !file.endsWith('.backup') && !file.includes('.DS_Store'));

    console.log(`Processing ${files.length} case law files...`);

    // Process each file
    for (const file of files) {
        const filePath = path.join(caseDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if the file has frontmatter
        if (!content.startsWith('---')) continue;

        // Extract frontmatter
        const frontMatterEnd = content.indexOf('---', 3);
        if (frontMatterEnd === -1) continue;

        const frontMatter = content.substring(3, frontMatterEnd).trim();
        let metadata;

        try {
            metadata = yaml.load(frontMatter);
        } catch (err) {
            console.error(`Error parsing YAML in ${file}:`, err);
            continue;
        }

        if (!metadata['case-number']) continue;

        // Extract case number and normalize format
        const caseNumber = metadata['case-number'];

        // Extract parties
        let parties = metadata.parties || '';
        // Remove quotes if present
        parties = parties.replace(/^"(.*)"$/, '$1');

        // Store case info
        casesInfo.set(caseNumber, {
            caseNumber,
            parties
        });

        // Extract article references from YAML frontmatter only
        const articles = extractKeyArticleRefs(metadata);

        if (articles.length > 0) {
            caseArticleMap.set(caseNumber, articles);

            // Also build the reverse mapping (article -> cases)
            articles.forEach(article => {
                if (!articleCasesMap.has(article)) {
                    articleCasesMap.set(article, []);
                }
                articleCasesMap.get(article).push(caseNumber);
            });
        }
    }

    // Generate the first MD file (cases and their key articles)
    let casesOutput = '';

    // Sort cases by case number
    const sortedCases = Array.from(casesInfo.keys()).sort();

    for (const caseNumber of sortedCases) {
        const caseInfo = casesInfo.get(caseNumber);
        const articles = caseArticleMap.get(caseNumber) || [];

        if (articles.length === 0) continue;

        casesOutput += `#### ${caseNumber} (${caseInfo.parties || ''})\n\n`;

        // Add articles list with double brackets
        articles.forEach(article => {
            casesOutput += `- [[Article ${article}]]\n`;
        });

        casesOutput += '\n---\n\n';
    }

    // Generate the second MD file (key articles and cases that reference them)
    let articlesOutput = '';

    // Sort articles by number
    const sortedArticles = Array.from(articleCasesMap.keys()).sort((a, b) => Number(a) - Number(b));

    for (const article of sortedArticles) {
        const cases = articleCasesMap.get(article);

        // Always use brackets for article headings
        articlesOutput += `#### [[Article ${article}]]\n\n`;

        // Add cases list with only wiki links
        cases.forEach(caseNumber => {
            const caseInfo = casesInfo.get(caseNumber);
            const filename = caseNumberToFilename(caseNumber);
            const displayText = `${caseNumberToDisplay(caseNumber)} (${caseInfo.parties || ''})`;

            articlesOutput += `- [[${filename}|${displayText}]]\n\n`;
        });

        articlesOutput += '---\n\n';
    }

    // Write output files with new names
    fs.writeFileSync('cases-by-key-articles.md', casesOutput);
    fs.writeFileSync('key-articles-by-case.md', articlesOutput);

    console.log('Regeneration complete!');
    console.log(`Found ${sortedCases.length} cases with key article references`);
    console.log(`Found ${sortedArticles.length} unique key articles`);
}

// Run the main function
processFiles().catch(err => {
    console.error('Error processing files:', err);
}); 