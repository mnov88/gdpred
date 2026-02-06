import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateFrontmatter, frontmatterToYaml } from './generate-frontmatter.js';
import { caseNumberToFilename } from './sparql-discover.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CASE_LAW_DIR = path.join(ROOT, 'content', 'Case law');
const HTML_TO_MD = path.join(ROOT, 'scripts', 'html-to-md.cjs');
const CONVERT_ARTICLE_REFS = path.join(ROOT, 'scripts', 'convert-article-refs.js');

/**
 * Convert HTML to markdown body using html-to-md.js.
 * @param {string} htmlPath - Path to HTML file
 * @returns {string} Markdown body text
 */
function convertHtmlToMarkdown(htmlPath) {
  const tmpMd = htmlPath.replace('.html', '.tmp.md');
  try {
    execSync(`node "${HTML_TO_MD}" "${htmlPath}" "${tmpMd}"`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
    const body = fs.readFileSync(tmpMd, 'utf8');
    fs.unlinkSync(tmpMd);
    return body;
  } catch (err) {
    console.error(`[Assemble] html-to-md.js failed: ${err.message}`);
    // Fallback: return raw text stripped of tags
    const html = fs.readFileSync(htmlPath, 'utf8');
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Assemble a complete case file: frontmatter + markdown body.
 * @param {Object} caseData - Case data from SPARQL
 * @param {string} htmlPath - Path to downloaded HTML file
 * @returns {string} Path to the created .md file
 */
export function assembleCase(caseData, htmlPath) {
  const filename = caseNumberToFilename(caseData.caseNumber);
  const outputPath = path.join(CASE_LAW_DIR, `${filename}.md`);

  console.log(`[Assemble] Building ${filename}.md ...`);

  // Read HTML for frontmatter generation
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Generate frontmatter from SPARQL data + HTML parsing
  const frontmatter = generateFrontmatter(caseData, htmlContent);
  const yamlStr = frontmatterToYaml(frontmatter);

  // Convert HTML to markdown body
  const markdownBody = convertHtmlToMarkdown(htmlPath);

  // Assemble the file
  const content = `---\n${yamlStr}---\n\n${markdownBody}\n`;
  fs.writeFileSync(outputPath, content, 'utf8');

  // Run convert-article-refs.js on the new file
  try {
    execSync(`node "${CONVERT_ARTICLE_REFS}" "${outputPath}"`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
    console.log(`[Assemble] Converted article refs in ${filename}.md`);
  } catch (err) {
    console.warn(`[Assemble] convert-article-refs.js warning: ${err.message}`);
  }

  console.log(`[Assemble] Created ${outputPath}`);
  return outputPath;
}
