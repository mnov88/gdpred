import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CASE_LAW_DIR = path.join(__dirname, 'content/Case law');
const KEY_ARTICLES_FILE = path.join(__dirname, 'content/key-articles-by-case.md');
const OUTPUT_FILE = path.join(__dirname, 'content/article-rulings.md');

// Debug flag
const DEBUG = true;

// Helper function to log debug messages
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`);
        if (data) {
            console.log(data);
        }
    }
}

// Helper function to extract article numbers from text
function extractArticleNumbers(text) {
    if (!text) return [];

    const articleRegex = /\[\[Article\s+(\d+(?:\s*and\s*\d+)?)\]\](?:\((\d+)(?:\\)?(?:\)|\|))?/g;
    const plainArticleRegex = /Article\s+(\d+)(?:\(|\s+of)/g;
    const articles = new Set();
    let match;

    // Extract bracketed articles
    while ((match = articleRegex.exec(text)) !== null) {
        const articleNum = match[1].trim();
        if (articleNum.includes('and')) {
            // Handle cases like "Article 6 and 7"
            const nums = articleNum.split(/\s*and\s*/);
            nums.forEach(num => articles.add(num.trim()));
        } else {
            articles.add(articleNum);
        }
    }

    // Also extract plain article references
    while ((match = plainArticleRegex.exec(text)) !== null) {
        articles.add(match[1].trim());
    }

    return Array.from(articles).sort((a, b) => Number(a) - Number(b));
}

// Function to extract paragraph numbers (rules) that mention a specific article
function extractRulesForArticle(rulingText, articleNumber) {
    if (!rulingText) {
        debugLog(`No ruling text provided for article ${articleNumber}`);
        return [];
    }

    // Handle numbered points in the ruling
    // Split by number + dot + space pattern (1. , 2. , etc.)
    const points = rulingText.split(/\s*\d+\.\s+/).filter(p => p.trim());
    debugLog(`Found ${points.length} points in ruling`);

    // Find points that mention the specific article
    const relevantPoints = points.filter(point => {
        // Match various ways an article might be referenced
        const regexPatterns = [
            // Exact article number in brackets
            new RegExp(`\\[\\[Article\\s+${articleNumber}\\]\\]`, 'i'),
            // Article X of Regulation
            new RegExp(`Article\\s+${articleNumber}\\s+of`, 'i'),
            // Article X(Y) - with subsection
            new RegExp(`Article\\s+${articleNumber}\\(`, 'i'),
            // Just Article X, followed by comma, period or other punctuation
            new RegExp(`Article\\s+${articleNumber}[.,;:]`, 'i'),
            // Plain Article X anywhere in the text
            new RegExp(`Article\\s+${articleNumber}\\b`, 'i')
        ];

        // Check if any pattern matches
        return regexPatterns.some(regex => regex.test(point));
    });

    debugLog(`Found ${relevantPoints.length} points relevant to Article ${articleNumber}`);

    if (relevantPoints.length === 0 && points.length > 0) {
        // If no specific points found, check if the whole ruling mentions the article
        const fullRulingRegex = new RegExp(`Article\\s+${articleNumber}(\\s+|\\(|\\[)`, 'i');
        if (fullRulingRegex.test(rulingText)) {
            debugLog(`Article ${articleNumber} mentioned in full ruling but not in specific points`);
            // Return the first paragraph as a fallback
            return [points[0]];
        }
    }

    return relevantPoints;
}

// Function to get the first 100 characters of a string for debugging
function getPreview(text) {
    if (!text) return 'Empty text';
    const preview = text.substring(0, 100).replace(/\n/g, ' ');
    return preview + (text.length > 100 ? '...' : '');
}

// Function to process all case files and extract rulings by article
async function extractArticleRulings() {
    try {
        debugLog('Starting extraction process');

        // Get existing key-articles-by-case.md content
        debugLog(`Reading from ${KEY_ARTICLES_FILE}`);
        if (!fs.existsSync(KEY_ARTICLES_FILE)) {
            console.error(`Error: ${KEY_ARTICLES_FILE} not found`);
            return;
        }

        const keyArticlesContent = fs.readFileSync(KEY_ARTICLES_FILE, 'utf8');
        debugLog(`Key articles file length: ${keyArticlesContent.length} characters`);

        // Create a map of article number -> cases
        const articleCasesMap = new Map();

        // Extract article sections using regex to find "#### [[Article X]]" headers
        const articleHeaderRegex = /#### \[\[Article (\d+)\]\]\n\n([\s\S]*?)(?=\n---\n|$)/g;
        let match;

        while ((match = articleHeaderRegex.exec(keyArticlesContent)) !== null) {
            const articleNumber = match[1];
            const sectionContent = match[2];

            debugLog(`Found section for Article ${articleNumber}`);

            // Extract case references from the section using regex
            const caseRegex = /\[\[(.*?)\|(.*?)\]\]/g;
            const cases = [];
            let caseMatch;

            while ((caseMatch = caseRegex.exec(sectionContent)) !== null) {
                cases.push({
                    fileName: caseMatch[1],
                    displayName: caseMatch[2]
                });
            }

            articleCasesMap.set(articleNumber, cases);
            debugLog(`Article ${articleNumber}: Found ${cases.length} cases`);
        }

        debugLog(`Mapped ${articleCasesMap.size} articles to their cases`);

        // Process each case file to extract rulings
        const caseRulingsMap = new Map();

        debugLog(`Reading case files from ${CASE_LAW_DIR}`);
        if (!fs.existsSync(CASE_LAW_DIR)) {
            console.error(`Error: ${CASE_LAW_DIR} not found`);
            return;
        }

        const files = fs.readdirSync(CASE_LAW_DIR)
            .filter(file => file.endsWith('.md') && !file.includes('.backup'));

        debugLog(`Found ${files.length} case files to process`);

        let caseFilesWithRulings = 0;
        for (const file of files) {
            const filePath = path.join(CASE_LAW_DIR, file);
            debugLog(`Processing ${file}`);

            const content = fs.readFileSync(filePath, 'utf8');

            // Extract frontmatter
            let data;
            try {
                data = matter(content).data;
            } catch (error) {
                console.error(`Error parsing YAML in ${file}:`, error);
                continue;
            }

            // Check if the file has a final-ruling field
            if (data['final-ruling']) {
                caseFilesWithRulings++;
                const caseNumber = data['case-number'];
                const fileName = file.replace('.md', '');
                const rulingText = data['final-ruling'];

                debugLog(`Found ruling in ${file}: ${getPreview(rulingText)}`);

                // Extract article numbers from the ruling
                const articleNumbers = extractArticleNumbers(rulingText);
                debugLog(`Articles mentioned in ruling: ${articleNumbers.join(', ')}`);

                // Also check ruling-articles if available
                if (data['ruling-articles'] && Array.isArray(data['ruling-articles'])) {
                    debugLog(`Ruling-articles field found: ${data['ruling-articles'].join(', ')}`);
                    data['ruling-articles'].forEach(article => {
                        const articleMatch = article.match(/Article\s+(\d+)/i);
                        if (articleMatch) {
                            const num = articleMatch[1];
                            if (!articleNumbers.includes(num)) {
                                articleNumbers.push(num);
                                debugLog(`Added article ${num} from ruling-articles field`);
                            }
                        }
                    });
                }

                // Store case information
                caseRulingsMap.set(fileName, {
                    caseNumber,
                    rulingText,
                    articleNumbers,
                    parties: data.parties || ''
                });
            } else {
                debugLog(`No final-ruling field found in ${file}`);
            }
        }

        debugLog(`Found ${caseFilesWithRulings} case files with rulings out of ${files.length} total files`);
        debugLog(`Mapped ${caseRulingsMap.size} cases to their rulings`);

        // Generate the output file
        let outputContent = '# Article Rulings\n\n';
        outputContent += 'This document contains rulings organized by GDPR article, showing how each article has been interpreted by the Court of Justice of the European Union.\n\n';

        // Sort article numbers numerically
        const sortedArticleNumbers = Array.from(articleCasesMap.keys()).sort((a, b) => Number(a) - Number(b));
        debugLog(`Generating output for ${sortedArticleNumbers.length} articles`);

        let articlesWithRulings = 0;
        for (const articleNumber of sortedArticleNumbers) {
            const cases = articleCasesMap.get(articleNumber);

            outputContent += `## [[Article ${articleNumber}]]\n\n`;

            let hasRulingsForArticle = false;
            for (const caseInfo of cases) {
                const fileName = caseInfo.fileName;
                const displayName = caseInfo.displayName;

                const caseRuling = caseRulingsMap.get(fileName);
                if (caseRuling) {
                    // Get rules relevant to this article
                    const relevantRules = extractRulesForArticle(caseRuling.rulingText, articleNumber);

                    if (relevantRules.length > 0) {
                        hasRulingsForArticle = true;
                        outputContent += `### ${displayName}\n\n`;

                        relevantRules.forEach((rule, index) => {
                            // Add a number to each rule for clarity (matching the original ruling format)
                            outputContent += `${index + 1}. ${rule.trim()}\n\n`;
                        });
                    } else {
                        debugLog(`No relevant rules found for Article ${articleNumber} in case ${fileName}`);
                    }
                } else {
                    debugLog(`No ruling found for case ${fileName}`);
                }
            }

            if (hasRulingsForArticle) {
                articlesWithRulings++;
            }

            outputContent += '---\n\n';
        }

        debugLog(`Generated content for ${articlesWithRulings} articles with rulings`);

        // Write to output file
        fs.writeFileSync(OUTPUT_FILE, outputContent);
        console.log(`Article rulings extracted and saved to ${OUTPUT_FILE}`);
        console.log(`Found rulings for ${articlesWithRulings} articles from ${caseFilesWithRulings} case files`);

    } catch (error) {
        console.error('Error extracting article rulings:', error);
    }
}

// Run the main function
extractArticleRulings().catch(err => {
    console.error('Error processing files:', err);
}); 