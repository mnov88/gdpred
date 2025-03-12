import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CASE_LAW_DIR = path.join(__dirname, 'content/Case law');
const OUTPUT_FILE = path.join(__dirname, 'content/case-law-grid.md');

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
                    caseNumberDisplay: (data['case-number'] || data.title).replace(/\//g, '∕'), // Replace slash with mathematical slash for display
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

// Format date to display format (e.g., "January 12, 2023")
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Generate HTML for the case grid
function generateGridHTML(caseData) {
    let html = `---
title: "Case Law Overview"
---

<style>
  .case-container {
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    max-width: 100%;
    margin: 2rem 0;
  }
  
  .case-item {
    background-color: #ffffff;
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
    box-shadow: rgba(0, 0, 0, 0.05) 0px 1px 3px, rgba(0, 0, 0, 0.05) 0px 10px 15px -5px;
    border: 1px solid rgba(230, 230, 230, 0.7);
    transition: box-shadow 0.2s ease;
  }
  
  .case-item:hover {
    box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
  }
  
  .case-link {
    display: block;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
  }
  
  .case-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .case-number {
    font-size: 0.9rem;
    font-weight: 500;
    color: #284b63;
    background-color: rgba(40, 75, 99, 0.05);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin-right: 0.8rem;
  }
  
  .case-title {
    font-size: 1rem;
    font-weight: 600;
    color: #2b2b2b;
    flex: 1;
  }
  
  .case-date {
    font-size: 0.8rem;
    color: #646464;
    margin-left: auto;
  }
  
  .case-topics {
    font-size: 0.8rem;
    color: #565656;
    font-style: italic;
    font-weight: normal;
  }
</style>

<div class="case-container">
  <h2 style="font-size: 1.8rem; font-weight: 700; color: #333; margin-bottom: 1.5rem;">Case Law Overview</h2>
`;

    // Generate HTML for each case
    caseData.forEach(caseItem => {
        const linkHref = `Case%20law/${encodeURIComponent(caseItem.fileName)}`;
        const dateStr = formatDate(caseItem.date);

        // Format topics as a string
        let topicsDisplay = '';
        if (Array.isArray(caseItem.topics) && caseItem.topics.length > 0) {
            topicsDisplay = caseItem.topics.join(' • ');
        } else if (typeof caseItem.topics === 'string') {
            topicsDisplay = caseItem.topics;
        }

        html += `  <div class="case-item">
    <a href="${linkHref}" class="case-link">
      <div class="case-header">
        <span class="case-number">${caseItem.caseNumberDisplay}</span>
        <span class="case-title">${caseItem.parties}</span>
        <span class="case-date">${dateStr}</span>
      </div>
      <div class="case-topics">${topicsDisplay}</div>
    </a>
  </div>
`;
    });

    html += `</div>`;

    return html;
}

// Main function to generate the case grid
async function generateCaseGrid() {
    try {
        // Extract case data
        const caseData = await extractCaseData();

        if (caseData.length === 0) {
            console.error('No case data found or extracted. Check your case files and their frontmatter.');
            return;
        }

        // Generate grid HTML
        const gridHTML = generateGridHTML(caseData);

        // Write to output file
        fs.writeFileSync(OUTPUT_FILE, gridHTML);
        console.log(`Successfully generated case grid at ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('Error generating case grid:', error);
    }
}

// Run the script
generateCaseGrid(); 