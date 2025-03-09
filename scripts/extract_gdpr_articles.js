import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract GDPR articles from text
function extractGdprArticles(text) {
    if (!text) return [];

    // Look for Regulation 2016/679, GDPR, General Data Protection Regulation
    const isGdprRelated = text.includes('Regulation (EU) 2016/679') ||
        text.includes('General Data Protection Regulation') ||
        text.includes('GDPR');

    if (!isGdprRelated) return [];

    // Extract all article references (both [[Article X]](Y) format and direct Article X references)
    const articleRegex = /\[\[Article\s+(\d+)\]\](?:\(\d+\))?|\bArticle\s+(\d+)(?:\(\d+\))?/g;
    const matches = [];
    let match;

    while ((match = articleRegex.exec(text)) !== null) {
        // Get the article number (either from group 1 or group 2)
        const articleNum = match[1] || match[2];
        if (articleNum) {
            matches.push(`Article ${articleNum}`);
        }
    }

    // Remove duplicates and sort numerically
    return [...new Set(matches)].sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
    });
}

// Function to extract article interpretations for a specific article
function extractArticleInterpretation(finalRuling, article) {
    if (!finalRuling) return `Referenced in the case regarding GDPR ${article}.`;

    const articleNum = article.match(/\d+/)[0];
    const regex = new RegExp(`\\*\\*(\\d+)\\.*\\*\\*\\s+(?:.*?\\b${articleNum}\\b.*?\\n\\n)([\\s\\S]*?)(?=\\*\\*\\d+\\.*\\*\\*|$)`, 'g');

    let interpretations = [];
    let match;

    // Look for numbered paragraphs that mention this article
    while ((match = regex.exec(finalRuling)) !== null) {
        const paragraphNum = match[1];
        let text = match[2].trim();
        interpretations.push(`**${paragraphNum}.** ${text}`);
    }

    // If no specific paragraphs found, check for direct mentions
    if (interpretations.length === 0) {
        const mentionRegex = new RegExp(`\\b${articleNum}\\b[^.]*\\.`, 'g');
        while ((match = mentionRegex.exec(finalRuling)) !== null) {
            interpretations.push(match[0]);
        }
    }

    // If still no interpretations found, return a generic message
    if (interpretations.length === 0) {
        return `Referenced in the GDPR context but specific interpretation not found.`;
    }

    return interpretations.join(' ');
}

// Function to process a file
function processFile(filePath) {
    try {
        // Read the file content (entire file to get correct interpretations)
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        // Check if it has YAML frontmatter
        if (!content.startsWith('---')) {
            console.log(`Skipping ${filePath} - no YAML frontmatter`);
            return;
        }

        // Extract the YAML frontmatter
        let yamlEndIndex = content.indexOf('---', 3);
        if (yamlEndIndex === -1) {
            console.log(`Skipping ${filePath} - invalid YAML frontmatter`);
            return;
        }

        const yamlContent = content.substring(4, yamlEndIndex).trim();
        let frontmatter;
        try {
            frontmatter = yaml.load(yamlContent);
        } catch (e) {
            console.log(`Skipping ${filePath} - error parsing YAML: ${e.message}`);
            return;
        }

        // Check if it has "NO RULING FOUND" param
        if (frontmatter.hasOwnProperty('NO RULING FOUND')) {
            console.log(`Skipping ${filePath} - NO RULING FOUND`);
            return;
        }

        // Check if final-ruling exists
        if (!frontmatter['final-ruling']) {
            console.log(`Skipping ${filePath} - no final-ruling found`);
            return;
        }

        // Extract GDPR articles from final-ruling
        const gdprArticles = extractGdprArticles(frontmatter['final-ruling']);
        if (gdprArticles.length === 0) {
            console.log(`Skipping ${filePath} - no GDPR articles found`);
            return;
        }

        // Create per-article section with interpretations
        const perArticle = [];
        for (const article of gdprArticles) {
            const interpretation = extractArticleInterpretation(frontmatter['final-ruling'], article);
            perArticle.push(`${article} | ${interpretation}`);
        }

        // Update the frontmatter
        const updatedFrontmatter = { ...frontmatter };
        updatedFrontmatter['ruling-articles'] = gdprArticles;
        updatedFrontmatter['per-article'] = perArticle;

        // Create the updated file content
        const updatedYamlContent = yaml.dump(updatedFrontmatter, { lineWidth: -1 });
        const updatedContent = `---\n${updatedYamlContent}---\n${content.substring(yamlEndIndex + 3)}`;

        // Create a backup
        fs.writeFileSync(`${filePath}.bak_auto`, content);

        // Write the updated file
        fs.writeFileSync(filePath, updatedContent);

        console.log(`Processed ${filePath} - found ${gdprArticles.length} GDPR articles`);
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// Main function
function main() {
    const caseLawDir = path.resolve(path.join(process.cwd(), 'content', 'Case law'));

    // Specific files to process that should have GDPR content
    const specificFiles = [
        'C-129-21.md',
        'C-180-21.md',
        'C-252-21.md'
    ];

    console.log(`Processing ${specificFiles.length} specific files`);

    for (const filename of specificFiles) {
        const filePath = path.join(caseLawDir, filename);
        if (fs.existsSync(filePath)) {
            processFile(filePath);
        } else {
            console.log(`File not found: ${filePath}`);
        }
    }
}

main(); 