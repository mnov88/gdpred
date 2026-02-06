import fs from 'fs';
import * as cheerio from 'cheerio';
import yaml from 'js-yaml';
import { parseModifiedLocations } from './sparql-discover.js';

/**
 * Extract the final ruling text from EUR-Lex HTML.
 * Looks for content between C41DispositifIntroduction and C77Signatures.
 */
function extractFinalRuling($) {
  const rulingParts = [];
  let inRuling = false;

  $('p, P').each((_, el) => {
    const className = $(el).attr('class') || '';

    if (className.includes('C41DispositifIntroduction')) {
      inRuling = true;
      return; // skip the intro line itself
    }

    if (className.includes('C77Signatures')) {
      inRuling = false;
      return;
    }

    if (!inRuling) return;

    let text = $(el).text().trim();
    if (!text) return;

    if (className.includes('C08Dispositif')) {
      // Numbered ruling point: "1.      Article 6(1)..."
      const numMatch = text.match(/^(\d+)\.\s+(.*)/s);
      if (numMatch) {
        text = `**${numMatch[1]}.** ${numMatch[2].trim()}`;
      }
    } else if (className.includes('C34Dispositifmarge1avectiretlong') ||
               className.includes('C36Dispositifmarge2avectiretlong')) {
      // Dash sub-items in ruling
      text = text.replace(/^[–—-]\s*/, '– ');
    }
    // C32Dispositifmarge1 is continuation text, kept as-is

    rulingParts.push(text);
  });

  return rulingParts.join('\n\n');
}

/**
 * Extract topics from the C71Indicateur paragraph.
 * Splits on " -- " or " – " delimiters, filters out pure article refs.
 */
function extractTopics($) {
  let topicText = '';

  $('p, P').each((_, el) => {
    const className = $(el).attr('class') || '';
    if (className.includes('C71Indicateur')) {
      topicText = $(el).text().trim();
      return false; // break
    }
  });

  if (!topicText) return [];

  // Remove outer parentheses
  topicText = topicText.replace(/^\(\s*/, '').replace(/\s*\)$/, '');

  // Split on common delimiters
  const parts = topicText.split(/\s+(?:--|–|—)\s+/);

  return parts
    .map(p => p.trim())
    .filter(p => {
      if (!p) return false;
      // Filter out "Reference for a preliminary ruling" (generic)
      if (/^Reference for a preliminary ruling$/i.test(p)) return false;
      // Filter out pure article references like "Article 5(1)(c)"
      if (/^Article\s+\d+(\(\d+\))*(\([a-z]\))*$/i.test(p)) return false;
      return true;
    });
}

/**
 * Extract GDPR article references from the final ruling text.
 * Returns deduplicated, sorted array of "Article N" strings.
 */
function extractRulingArticles(rulingText) {
  if (!rulingText) return [];

  const isGdprRelated = rulingText.includes('Regulation (EU) 2016/679') ||
    rulingText.includes('Regulation 2016/679') ||
    rulingText.includes('General Data Protection Regulation') ||
    rulingText.includes('GDPR');

  if (!isGdprRelated) return [];

  const articleRegex = /\bArticle\s+(\d+)/gi;
  const articles = new Set();
  let match;

  while ((match = articleRegex.exec(rulingText)) !== null) {
    const num = parseInt(match[1], 10);
    // Only GDPR articles (1-99)
    if (num >= 1 && num <= 99) {
      articles.add(`Article ${num}`);
    }
  }

  return [...articles].sort((a, b) => {
    return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
  });
}

/**
 * Extract per-article ruling interpretations.
 * For each article, find the ruling paragraph(s) that mention it.
 */
function extractPerArticle(rulingText, articles) {
  if (!rulingText || !articles.length) return [];

  const result = [];

  for (const article of articles) {
    const articleNum = article.match(/\d+/)[0];

    // Find numbered paragraphs mentioning this article
    const paragraphs = rulingText.split(/(?=\*\*\d+\.\*\*)/);
    const relevant = [];

    for (const para of paragraphs) {
      const numMatch = para.match(/^\*\*(\d+)\.\*\*/);
      if (!numMatch) continue;

      // Check if this paragraph mentions the article number
      const articlePattern = new RegExp(`\\bArticle\\s+${articleNum}\\b`, 'i');
      if (articlePattern.test(para)) {
        relevant.push(para.trim());
      }
    }

    if (relevant.length > 0) {
      result.push(`${article} | ${relevant.join(' ')}`);
    } else {
      result.push(`${article} | Interpretation from final ruling related to ${article}`);
    }
  }

  return result;
}

/**
 * Generate complete frontmatter for a case.
 * @param {Object} caseData - Case data from SPARQL (caseNumber, caseDate, caseParties, modifiedLocations, etc.)
 * @param {string} htmlContent - Raw HTML from EUR-Lex
 * @returns {Object} Frontmatter object ready for YAML serialization
 */
export function generateFrontmatter(caseData, htmlContent) {
  const $ = cheerio.load(htmlContent);

  // Extract final ruling from HTML
  const finalRuling = extractFinalRuling($);

  // Extract topics from HTML
  const topics = extractTopics($);

  // Get ruling articles from both sources
  const rulingArticlesFromText = extractRulingArticles(finalRuling);
  const rulingArticlesFromSparql = parseModifiedLocations(caseData.modifiedLocations);

  // Union and deduplicate
  const allArticles = [...new Set([...rulingArticlesFromText, ...rulingArticlesFromSparql])];
  const rulingArticles = allArticles.sort((a, b) => {
    return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
  });

  // Extract per-article interpretations
  const perArticle = extractPerArticle(finalRuling, rulingArticles);

  // Build frontmatter object
  const frontmatter = {
    title: caseData.caseNumber,
    date: caseData.caseDate || null,
    'case-number': caseData.caseNumber,
    parties: caseData.caseParties || '',
  };

  if (topics.length > 0) {
    frontmatter.topics = topics;
  }

  if (finalRuling) {
    frontmatter['final-ruling'] = finalRuling;
  }

  if (rulingArticles.length > 0) {
    frontmatter['ruling-articles'] = rulingArticles;
  }

  if (perArticle.length > 0) {
    frontmatter['per-article'] = perArticle;
  }

  return frontmatter;
}

/**
 * Serialize frontmatter to YAML string.
 */
export function frontmatterToYaml(frontmatter) {
  return yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: "'",
    forceQuotes: false,
    noRefs: true,
  });
}
