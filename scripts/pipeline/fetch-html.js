import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_DIR = path.join(__dirname, 'downloaded');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch HTML from EUR-Lex with retry and exponential backoff.
 */
async function fetchWithRetry(url, maxRetries = 3) {
  let lastError;
  let retryDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GDPRed-Pipeline/1.0 (https://gdpred.milos.no)',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      lastError = err;
      console.warn(`  Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await delay(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 16000);
      }
    }
  }
  throw lastError;
}

/**
 * Download HTML files for a list of new cases.
 * @param {Array} cases - Array of case objects with caseCelex field
 * @returns {Object} Map of caseCelex -> local file path
 */
export async function downloadHtml(cases) {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  const results = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < cases.length; i++) {
    const caseData = cases[i];
    const filePath = path.join(DOWNLOAD_DIR, `${caseData.caseCelex}.html`);

    // Skip if already downloaded
    if (fs.existsSync(filePath)) {
      console.log(`[Download] ${caseData.caseNumber}: already exists, skipping.`);
      results[caseData.caseCelex] = filePath;
      skipped++;
      continue;
    }

    const url = `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${caseData.caseCelex}`;
    console.log(`[Download] ${caseData.caseNumber} (${i + 1}/${cases.length}): ${url}`);

    try {
      const html = await fetchWithRetry(url);
      fs.writeFileSync(filePath, html, 'utf8');
      results[caseData.caseCelex] = filePath;
      downloaded++;
    } catch (err) {
      console.error(`[Download] FAILED ${caseData.caseNumber}: ${err.message}`);
      failed++;
    }

    // Rate limit: 2-second delay between requests
    if (i < cases.length - 1) {
      await delay(2000);
    }
  }

  console.log(`[Download] Done: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`);
  return results;
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputFile = path.join(__dirname, 'new-cases.json');
  if (!fs.existsSync(inputFile)) {
    console.error('[Download] No new-cases.json found. Run sparql-discover.js first.');
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  downloadHtml(cases)
    .then(results => {
      console.log(`[Download] ${Object.keys(results).length} files ready.`);
    })
    .catch(err => {
      console.error('[Download] Error:', err.message);
      process.exit(1);
    });
}
