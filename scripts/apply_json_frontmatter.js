#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const CASE_METADATA_FILE = path.join(ROOT_DIR, 'case-metadata.json');
const CASE_LAW_DIR = path.join(ROOT_DIR, 'content', 'Case law');

function normalizeCaseIdForMatching(jsonCaseId) {
    if (!jsonCaseId || !jsonCaseId.startsWith('Case ')) {
        return null;
    }
    return jsonCaseId.substring(5)
        .replace(/\//g, '-')      // Replace / with -
        .replace(/[\u2011\u2013\u2014]/g, '-'); // Replace common Unicode hyphens (U+2011, U+2013, U+2014) with standard hyphen
}

function extractCaseIdFromFilename(filename) {
    // Regex to capture C-ddd-dd or C-ddd-ddd etc., allowing various hyphens
    // It matches C, then a hyphen type, digits, a hyphen type, digits at the start.
    const match = filename.match(/^C[-\u2011\u2013\u2014]\d+[-\u2011\u2013\u2014]\d+/);
    if (match && match[0]) {
        // Normalize hyphens in the extracted ID to standard hyphen
        return match[0].replace(/[\u2011\u2013\u2014]/g, '-');
    }
    return null;
}

async function processCases() {
    console.log('Starting frontmatter generation process...');

    // 1. Read case-metadata.json
    let allCaseData;
    try {
        if (!fs.existsSync(CASE_METADATA_FILE)) {
            console.error(`Error: ${CASE_METADATA_FILE} not found.`);
            return;
        }
        const jsonData = fs.readFileSync(CASE_METADATA_FILE, 'utf8');
        allCaseData = JSON.parse(jsonData);
        if (!Array.isArray(allCaseData)) {
            console.error(`Error: ${CASE_METADATA_FILE} should contain a JSON array.`);
            return;
        }
        console.log(`Successfully read ${allCaseData.length} case entries from ${CASE_METADATA_FILE}`);
    } catch (error) {
        console.error(`Error reading or parsing ${CASE_METADATA_FILE}:`, error);
        return;
    }

    // 2. List Markdown files and build a filename map
    const mdFileMap = new Map();
    try {
        const files = fs.readdirSync(CASE_LAW_DIR);
        files.forEach(file => {
            if (file.endsWith('.md')) {
                const coreId = extractCaseIdFromFilename(file);
                if (coreId) {
                    mdFileMap.set(coreId, file);
                } else {
                    // Don't warn for every non-matching file like index or topic files
                    if (file.toLowerCase().startsWith('c-')) {
                        console.warn(`Could not extract core ID from potential case filename: ${file}`);
                    }
                }
            }
        });
        console.log(`Found ${mdFileMap.size} unique case IDs mapped to markdown files in ${CASE_LAW_DIR}`);
    } catch (error) {
        console.error(`Error reading case law directory ${CASE_LAW_DIR}:`, error);
        return;
    }

    let filesProcessed = 0;
    let filesBackedUp = 0;
    let noMatchingFile = 0;

    // 3. Process each JSON case object
    for (const caseJson of allCaseData) {
        if (!caseJson || !caseJson.caseId) {
            console.warn('Skipping JSON entry with missing caseId:', caseJson);
            continue;
        }

        const normalizedJsonId = normalizeCaseIdForMatching(caseJson.caseId);
        if (!normalizedJsonId) {
            console.warn(`Could not normalize caseId: ${caseJson.caseId}. Skipping.`);
            continue;
        }

        const targetMdFilename = mdFileMap.get(normalizedJsonId);

        if (targetMdFilename) {
            const fullMdFilePath = path.join(CASE_LAW_DIR, targetMdFilename);
            try {
                // Construct YAML frontmatter
                const frontmatter = {};
                frontmatter['case-number'] = caseJson.caseId; // Store original "Case C-1/17" format

                if (caseJson.caseId) {
                    frontmatter.title = caseJson.caseId.replace(/^Case\s+/, '').replace(/[.\s]+$/, '');
                } else {
                    // Fallback, though caseJson.caseId should exist based on earlier checks
                    frontmatter.title = `Case ${normalizedJsonId}`;
                }

                if (caseJson.parties) {
                    frontmatter.parties = caseJson.parties;
                }

                frontmatter.date = caseJson.date;
                frontmatter['celex-id'] = caseJson.celexId;
                if (caseJson.summary && caseJson.summary.trim() !== '') { // Only add if summary exists and is not empty
                    frontmatter['gdpr-summary'] = caseJson.summary;
                }

                if (Array.isArray(caseJson.interpretedArticleNumbers) && caseJson.interpretedArticleNumbers.length > 0) {
                    frontmatter['ruling-articles'] = caseJson.interpretedArticleNumbers.map(num => `Article ${num}`);
                } else {
                    frontmatter['ruling-articles'] = []; // Ensure the field exists even if empty
                }

                if (caseJson.operativePartsCombined) {
                    frontmatter['final-ruling'] = caseJson.operativePartsCombined;
                }

                if (Array.isArray(caseJson.operativeParts) && caseJson.operativeParts.length > 0) {
                    frontmatter.operative_parts_structured = caseJson.operativeParts.map(part => {
                        const structuredPart = {
                            number: part.number,
                            verbatim: part.verbatimText,
                            simplified: part.simplifiedText,
                        };
                        if (Array.isArray(part.interpretedArticles) && part.interpretedArticles.length > 0) {
                            structuredPart.interprets_articles = part.interpretedArticles.map(num => `Article ${num}`);
                        }
                        if (Array.isArray(part.regulations) && part.regulations.length > 0) {
                            structuredPart.mentions_regulations = part.regulations;
                        }
                        return structuredPart;
                    });
                }

                const yamlFrontmatter = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true });

                // Read target markdown file
                let fileContent = fs.readFileSync(fullMdFilePath, 'utf8');

                // Create backup
                const backupFilePath = `${fullMdFilePath}.bak_json_apply`;
                fs.writeFileSync(backupFilePath, fileContent); // Backup original content
                filesBackedUp++;

                // Remove existing frontmatter (if any)
                // This regex handles cases where there might be no content after frontmatter
                fileContent = fileContent.replace(/^---[\\r\\n]+([\\s\\S]*?)[\\r\\n]+---[\\r\\n]*/, '');

                // Prepend new frontmatter
                // Ensure a single blank line after the '---' and before the main content
                const newContent = `---\n${yamlFrontmatter}---\n\n${fileContent.trimStart()}`.trim() + '\n';

                fs.writeFileSync(fullMdFilePath, newContent, 'utf8');
                console.log(`Successfully updated frontmatter for: ${targetMdFilename}`);
                filesProcessed++;

            } catch (error) {
                console.error(`Error processing file ${targetMdFilename} for case ${caseJson.caseId}:`, error);
            }
        } else {
            console.warn(`No matching MD file found for JSON caseId: ${caseJson.caseId} (normalized: ${normalizedJsonId})`);
            noMatchingFile++;
        }
    }

    console.log(`\n--- Process Summary ---`);
    console.log(`Total JSON entries: ${allCaseData.length}`);
    console.log(`Markdown files successfully processed: ${filesProcessed}`);
    console.log(`Markdown files backed up: ${filesBackedUp}`);
    console.log(`JSON entries with no matching MD file: ${noMatchingFile}`);
    console.log('Frontmatter generation complete! ✅');
}

processCases().catch(err => {
    console.error('Unhandled error in processCases:', err);
}); 