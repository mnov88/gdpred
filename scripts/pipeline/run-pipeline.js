#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { discoverNewCases } from './sparql-discover.js';
import { downloadHtml } from './fetch-html.js';
import { assembleCase } from './assemble-case.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// Parse CLI flags
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  forceCelex: args.find(a => a.startsWith('--force-celex='))?.split('=')[1],
  skipPostProcessing: args.includes('--skip-post-processing'),
  limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10),
};

/**
 * Run a post-processing script, logging output.
 */
function runScript(command, label) {
  console.log(`  [Post] Running: ${label}`);
  try {
    execSync(command, { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error(`  [Post] Warning: ${label} failed: ${err.message}`);
  }
}

async function runPipeline() {
  console.log('=== GDPRed Pipeline ===');
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log('');

  // Step 1: Discover new cases
  console.log('[Step 1/4] Discovering new cases via SPARQL...');
  let newCases;
  try {
    newCases = await discoverNewCases();
  } catch (err) {
    console.error(`[Step 1/4] SPARQL query failed: ${err.message}`);
    console.error('Pipeline aborted.');
    process.exit(2);
  }

  if (options.forceCelex) {
    newCases = newCases.filter(c => c.caseCelex === options.forceCelex);
    if (newCases.length === 0) {
      console.log(`[Step 1/4] Force-celex ${options.forceCelex} not found in new cases.`);
      process.exit(1);
    }
  }

  if (options.limit > 0) {
    newCases = newCases.slice(0, options.limit);
    console.log(`[Step 1/4] Limited to ${options.limit} case(s).`);
  }

  if (newCases.length === 0) {
    console.log('[Step 1/4] No new cases found. Pipeline complete.');
    process.exit(0);
  }

  console.log(`[Step 1/4] Found ${newCases.length} new case(s):`);
  for (const c of newCases) {
    console.log(`  - ${c.caseNumber} (${c.caseCelex}) ${c.caseDate || 'no date'}`);
  }
  console.log('');

  if (options.dryRun) {
    console.log('[Dry run] Stopping before download/write. No files modified.');
    process.exit(0);
  }

  // Step 2: Download HTML
  console.log('[Step 2/4] Fetching HTML from EUR-Lex...');
  const htmlFiles = await downloadHtml(newCases);
  console.log('');

  // Step 3: Convert, generate frontmatter, assemble case files
  console.log('[Step 3/4] Converting HTML to markdown and generating frontmatter...');
  const newFilePaths = [];

  for (const caseData of newCases) {
    const htmlPath = htmlFiles[caseData.caseCelex];
    if (!htmlPath) {
      console.warn(`  Skipping ${caseData.caseNumber}: HTML download failed`);
      continue;
    }

    try {
      const filePath = assembleCase(caseData, htmlPath);
      newFilePaths.push(filePath);
    } catch (err) {
      console.error(`  Error assembling ${caseData.caseNumber}: ${err.message}`);
    }
  }
  console.log('');

  // Step 4: Post-processing
  if (!options.skipPostProcessing && newFilePaths.length > 0) {
    console.log('[Step 4/4] Running post-processing scripts...');

    runScript('node scripts/process_article_refs.cjs', 'process_article_refs.cjs');
    runScript('node scripts/extract_case_articles.cjs', 'extract_case_articles.cjs');

    // extract_key_articles.cjs lives at repo root
    if (fs.existsSync(path.join(ROOT, 'extract_key_articles.cjs'))) {
      runScript('node extract_key_articles.cjs', 'extract_key_articles.cjs');
    }

    // sorttopics.cjs (from brussels) — needs cwd set to content/Case law/
    if (fs.existsSync(path.join(ROOT, 'scripts', 'sorttopics.cjs'))) {
      const sortCwd = path.join(ROOT, 'content', 'Case law');
      console.log(`  [Post] Running: sorttopics.cjs (cwd: ${sortCwd})`);
      try {
        execSync(`node ${path.join(ROOT, 'scripts', 'sorttopics.cjs')}`, { cwd: sortCwd, stdio: 'inherit' });
      } catch (err) {
        console.error(`  [Post] Warning: sorttopics.cjs failed: ${err.message}`);
      }
    }

    runScript('node scripts/generate-timeline.js', 'generate-timeline.js');
    runScript('node scripts/generate-case-grid.js', 'generate-case-grid.js');
    runScript('node scripts/extract_article_rulings.js', 'extract_article_rulings.js');
    runScript('node scripts/check_frontmatter.js', 'check_frontmatter.js');

    console.log('');
  }

  // Summary
  console.log('=== Pipeline Complete ===');
  console.log(`New cases added: ${newFilePaths.length}`);
  for (const fp of newFilePaths) {
    console.log(`  - ${path.basename(fp)}`);
  }
  if (newFilePaths.length > 0) {
    console.log('');
    console.log('Auto-generated topics may need manual review.');
    console.log('Run "npx quartz build --serve" to verify locally.');
  }
}

runPipeline().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
