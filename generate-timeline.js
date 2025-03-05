import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CASE_LAW_DIR = path.join(__dirname, 'content/Case law');
const OUTPUT_FILE = path.join(__dirname, 'content/case-law-timeline.md');

// Function to extract frontmatter from markdown files
async function extractCaseData() {
    try {
        // Get all .md files from the case law directory (excluding backup files)
        const files = fs.readdirSync(CASE_LAW_DIR)
            .filter(file => file.endsWith('.md') && !file.includes('.backup') && !file.includes('topics-by-file') && !file.includes('files-by-topic'));

        const caseData = [];

        // Process each file
        for (const file of files) {
            const filePath = path.join(CASE_LAW_DIR, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Extract frontmatter
            const { data } = matter(fileContent);

            // Only include files with proper metadata
            if (data.title && data.date && data.parties) {
                caseData.push({
                    title: data.title,
                    date: new Date(data.date), // Convert string date to Date object
                    caseNumber: data['case-number'] || data.title, // Fallback to title if case-number not available
                    parties: data.parties,
                    topics: data.topics || [],
                    fileName: file.replace('.md', '') // Store filename without extension for links
                });
            }
        }

        // Sort by date (newest first)
        return caseData.sort((a, b) => b.date - a.date);
    } catch (error) {
        console.error('Error extracting case data:', error);
        return [];
    }
}

// Group cases by month and year
function groupCasesByMonth(caseData) {
    const grouped = {};

    caseData.forEach(caseItem => {
        const date = caseItem.date;
        const monthYear = `${date.toLocaleString('en-US', { month: 'long' })}-${date.getFullYear()}`;

        if (!grouped[monthYear]) {
            grouped[monthYear] = {
                month: date.toLocaleString('en-US', { month: 'long' }),
                year: date.getFullYear(),
                cases: []
            };
        }

        grouped[monthYear].cases.push({
            ...caseItem,
            formattedDate: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        });
    });

    // Convert to array and sort by date
    return Object.values(grouped).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return new Date(b.month + ' 1, ' + b.year) - new Date(a.month + ' 1, ' + a.year);
    });
}

// Generate HTML for the timeline
function generateTimelineHTML(groupedCases) {
    let html = `---
title: "Case Law Timeline"
---
<div class="timeline-container" style="
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 100%;
  margin: 2rem 0;
  position: relative;">
  <div class="timeline-header" style="
    text-align: center;
    margin-bottom: 3rem;
    position: relative;
  ">
    <h2 style="
      font-size: 1.8rem;
      font-weight: 600;
      color: #284b63;
      margin-bottom: 0.5rem;
    ">Case Law Timeline</h2>
    <div style="
      height: 4px;
      width: 70px;
      background-color: #284b63;
      margin: 0 auto;
    "></div>
  </div>
  <div class="timeline-groups" style="
    position: relative;
  ">
    <div class="timeline-line" style="
      position: absolute;
      left: 120px;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: #e5e5e5;
      z-index: 0;
    "></div>`;

    // Generate HTML for each month group
    groupedCases.forEach(group => {
        html += `
    <div class="timeline-group" style="
      margin-bottom: 2.5rem;
      position: relative;
    ">
      <div class="timeline-month" style="
        position: absolute;
        left: 0;
        top: 0;
        width: 100px;
        text-align: right;
        padding-right: 20px;
      ">
        <h3 style="
          font-size: 1.1rem;
          font-weight: 600;
          color: #284b63;
          margin: 0;
        ">${group.month}</h3>
        <div style="
          font-size: 0.9rem;
          color: #4e4e4e;
          margin-top: 0.1rem;
        ">${group.year}</div>
      </div>
      <div class="timeline-items" style="
        margin-left: 140px;
      ">`;

        // Generate HTML for each case in the group
        group.cases.forEach(caseItem => {
            html += `
        <div class="timeline-item" style="
          background-color: #fff;
          border-radius: 8px;
          padding: 1.25rem;
          margin-bottom: 1rem;
          box-shadow: 0 2px 5px rgba(0,0,0,0.08);
          border-left: 4px solid #284b63;
          position: relative;
        ">
          <!-- Dot on timeline -->
          <div class="timeline-dot" style="
            position: absolute;
            left: -33px;
            top: 24px;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: #284b63;
            border: 3px solid #fff;
            box-shadow: 0 0 0 1px #e5e5e5;
            z-index: 1;
          "></div>
          <div class="case-number" style="
            font-size: 1rem;
            font-weight: 600;
            color: #284b63;
            margin-bottom: 0.2rem;
          "><a href="Case%20law/${caseItem.fileName}" style="text-decoration: none; color: inherit;">${caseItem.caseNumber}</a></div>
          <div class="case-title" style="
            font-size: 1.15rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #2b2b2b;
          ">${caseItem.parties}</div>
          <div class="case-parties" style="
            font-size: 0.9rem;
            color: #4e4e4e;
            font-style: italic;
          ">${caseItem.topics.slice(0, 3).join(' • ')}</div>
          <div class="case-date" style="
            margin-top: 0.8rem;
            font-size: 0.85rem;
            color: #646464;
          ">${caseItem.formattedDate}</div>
        </div>`;
        });

        html += `
      </div>
    </div>`;
    });

    html += `
  </div>
  <div class="timeline-footer" style="
    margin-top: 2rem;
    text-align: center;
    font-size: 0.85rem;
    color: #646464;
    font-style: italic;
  ">
    Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </div>
</div>
<style>
@media screen and (max-width: 768px) {
  .timeline-line {
    left: 20px !important;
  }
  .timeline-month {
    position: relative !important;
    text-align: left !important;
    padding-left: 40px !important;
    margin-bottom: 1rem !important;
    width: auto !important;
  }
  .timeline-items {
    margin-left: 40px !important;
  }
  .timeline-dot {
    left: -33px !important;
  }
}
</style>`;

    return html;
}

// Main function to run the script
async function generateTimeline() {
    try {
        console.log('Extracting case data...');
        const caseData = await extractCaseData();

        console.log(`Found ${caseData.length} case files with valid metadata`);

        console.log('Grouping cases by month...');
        const groupedCases = groupCasesByMonth(caseData);

        console.log('Generating timeline HTML...');
        const timelineHTML = generateTimelineHTML(groupedCases);

        console.log('Writing output to file...');
        fs.writeFileSync(OUTPUT_FILE, timelineHTML);

        console.log('Timeline successfully generated!');
        console.log(`Output file: ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('Error generating timeline:', error);
    }
}

// Run the script
generateTimeline(); 