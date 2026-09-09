/**
 * Shared constants describing GDPRed's content contract.
 * Changing anything here changes what the cleaner emits and what the
 * validator accepts, so keep the two in step.
 */

/** Regulation (EU) 2016/679 has 99 articles; content/Articles/ has one note each. */
export const GDPR_MAX_ARTICLE = 99

/** Where cleaned case files belong, relative to the repo root. */
export const CASE_DIR = 'content/Case law'

/** Where the GDPR article notes live. `NowReading` hard-codes this path. */
export const ARTICLE_DIR = 'content/Articles'

/**
 * Frontmatter key order. 60 of 67 existing case files already use exactly
 * this order; emitting it consistently keeps diffs readable.
 */
export const FIELD_ORDER = [
  'title',
  'date',
  'case-number',
  'parties',
  'topics',
  'final-ruling',
  'ruling-articles',
  'per-article',
  'aliases',
]

/**
 * Fields the site actually reads at build time.
 *   title           quartz/plugins/transformers/frontmatter.ts (page title, .toString())
 *   date            frontmatter.ts -> created/published; Explorer sort in quartz.layout.ts
 *   parties         quartz/components/Parties.tsx, Backlinks.tsx, ExplorerNode.tsx
 *   ruling-articles quartz/components/NowReading.tsx (the article chip row)
 *   aliases         frontmatter.ts -> redirect pages
 *
 * `topics`, `final-ruling` and `per-article` are read by NO Quartz component.
 * They feed only the standalone index generators in scripts/.
 */
export const SITE_READ_FIELDS = ['title', 'date', 'parties', 'ruling-articles', 'aliases']

/** Fields required for a case file to be usable by every downstream script. */
export const REQUIRED_FIELDS = ['title', 'date', 'case-number', 'parties', 'ruling-articles']

/**
 * generate-timeline.js:32 and generate-case-grid.js:32 both gate on
 * `title && date && parties`. A case missing any of the three is silently
 * dropped from the timeline and the grid — this is why C-184-20 is invisible.
 */
export const TIMELINE_REQUIRED_FIELDS = ['title', 'date', 'parties']

/** Body paragraph markers are bold WITHOUT a trailing dot: `**12** Text`. */
export const PARAGRAPH_MARKER = n => `**${n}**`

/** Operative-part points are bold WITH a trailing dot: `**1.** Text`. */
export const RULING_MARKER = n => `**${n}.**`
