const TurndownService = require('turndown');
const { htmlToText } = require('html-to-text');
const fs = require('fs');
const path = require('path');

/**
 * Converts HTML case law documents to clean Markdown format
 * Handles directory structure and preserves content while simplifying complex tables
 */

class CaseMarkdownConverter {
    constructor(options = {}) {
        // Track word counts for reporting
        this.conversionStats = {
            total: { html: 0, markdown: 0 },
            files: []
        };

        this.htmlToTextOptions = {
            wordwrap: false,
            preserveNewlines: false,
            selectors: [
                { selector: 'table', format: 'dataTable' },
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' }
            ],
            tables: true,
            baseElements: {
                selectors: ['body'],
                orderBy: 'occurrence'
            }
        };

        // Maximum recursion depth for nested tables
        this.maxTableDepth = 5;

        // Similarity threshold for deduplication (0-1)
        this.similarityThreshold = 0.9;

        // Map different class conventions to common formats
        this.formatMap = {
            // Common legal document classes
            'coj-bold': '**',
            'coj-italic': '_',
            'coj-underline': '__',
            'coj-heading': '## ',
            'coj-title': '# ',
            'coj-subtitle': '## ',
            'coj-count': '**',  // Numbered points
            'coj-normal': '',   // Regular text

            // Alternative class naming conventions
            'C19Centre': '## ',  // Center-aligned titles
            'C01PointnumeroteAltN': '- ', // Numbered points
            'C01Normal': '',     // Regular text
            'C01Gras': '**',     // Bold text
            'C01Italique': '_',  // Italic text
            'C01Souligne': '__'  // Underlined text
        };

        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            emDelimiter: '_',
            strongDelimiter: '**',
            linkStyle: 'inlined',
            // Preserve line breaks but allow natural text wrapping
            blankReplacement: (content, node) => {
                return node.isBlock ? '\n\n' : '';
            }
        });

        // Configure custom rules
        this.setupCustomRules();
    }

    // Helper function to sanitize filenames
    sanitizeFilename(filename) {
        return filename
            .replace(/[\/\\?%*:|"<>]/g, '-') // Replace illegal chars
            .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Remove control chars
            .replace(/[.,;!@#$^&()=+\[\]{}]/g, '-') // Replace punctuation
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/-+/g, '-') // Avoid multiple consecutive dashes
            .trim();
    }

    // Helper function to count words in text
    countWords(text, isHtml = false) {
        if (!isHtml) {
            return text.trim().split(/\s+/).filter(word => word.length > 0).length;
        }

        // For HTML, use html-to-text to extract content
        const plainText = htmlToText(text, this.htmlToTextOptions);
        return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    setupCustomRules() {
        // Remove unnecessary elements
        this.turndownService.remove(['img', 'script', 'style', 'meta']);

        // Simplify tables while preserving content
        this.turndownService.addRule('simplifiedTable', {
            filter: 'table',
            replacement: (content, node) => {
                // Use our recursive table processing function
                const processedContent = this.processTableRecursively(node);

                // Add double newlines before and after the processed content
                return processedContent ? '\n\n' + processedContent + '\n\n' : '';
            }
        });

        // Add special formatting based on class names
        this.turndownService.addRule('specialFormatting', {
            filter: ['p', 'span', 'div'],
            replacement: (content, node) => {
                if (!content.trim()) return '';

                const className = node.getAttribute('class');
                if (className && this.formatMap[className]) {
                    const format = this.formatMap[className];

                    // Apply appropriate formatting based on the class
                    if (format === '# ' || format === '## ' || format === '### ') {
                        // Heading - add newlines before and after
                        return `\n\n${format}${content}\n\n`;
                    } else if (format === '- ' || format === '* ') {
                        // List item - add newline before
                        return `\n${format}${content}`;
                    } else if (format === '**' || format === '_' || format === '__') {
                        // Inline formatting - wrap content
                        return `${format}${content}${format}`;
                    } else {
                        // Default formatting
                        return content;
                    }
                }

                // For paragraphs, ensure proper spacing
                if (node.tagName === 'P') {
                    return `\n\n${content}\n\n`;
                }

                return content;
            }
        });

        // Helper method to extract text content from an element
        this.extractTextContent = (element, excludeNodes = []) => {
            // Ensure excludeNodes is always an array
            const nodesToExclude = Array.isArray(excludeNodes) ? excludeNodes : [];

            // Get text content from this element, excluding specified nodes
            const textNodes = [];
            const walk = node => {
                // Skip if this node is in the exclude list
                if (nodesToExclude.includes(node)) {
                    return;
                }

                if (node.nodeType === 3) { // Text node
                    textNodes.push(node.nodeValue);
                } else if (node.nodeType === 1) { // Element node
                    // Skip if any ancestor is in the exclude list
                    for (const excludeNode of nodesToExclude) {
                        if (excludeNode.contains(node)) {
                            return;
                        }
                    }

                    // Process all child nodes
                    Array.from(node.childNodes).forEach(walk);
                }
            };
            walk(element);

            // Clean and return content
            return textNodes.join(' ').trim().replace(/\s+/g, ' ');
        };

        // Better handling of legal references
        this.turndownService.addRule('legalRefs', {
            filter: ['span', 'a'],
            replacement: (content, node) => {
                // Preserve CELEX numbers and case references
                if (content.match(/^[0-9]{5}[A-Z]{2}[0-9]{4}$/)) {
                    return `\`${content}\``;
                }
                // Preserve case numbers (e.g., C-123/45)
                if (content.match(/^C-\d+\/\d+$/)) {
                    return `\`${content}\``;
                }
                return content;
            }
        });

        // Preserve paragraph structure
        this.turndownService.addRule('paragraphs', {
            filter: 'p',
            replacement: (content, node) => {
                return '\n\n' + content + '\n\n';
            }
        });
    }

    cleanupMarkdown(markdown) {
        return markdown
            // Remove excessive blank lines
            .replace(/\n{3,}/g, '\n\n')
            // Clean up table separators
            .replace(/\|\s+\|/g, '|')
            // Ensure consistent heading spacing
            .replace(/\n(#{1,6})\s*([^\n]+)/g, '\n\n$1 $2\n')
            // Remove any remaining HTML comments
            .replace(/<!--[\s\S]*?-->/g, '')
            // Clean up any remaining HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
    }

    generateReport() {
        let report = '# HTML to Markdown Conversion Report\n\n';
        report += `Total files processed: ${this.conversionStats.files.length}\n`;
        report += `Total HTML words: ${this.conversionStats.total.html}\n`;
        report += `Total Markdown words: ${this.conversionStats.total.markdown}\n`;
        report += `Word retention rate: ${((this.conversionStats.total.markdown / this.conversionStats.total.html) * 100).toFixed(2)}%\n\n`;

        report += '## File Details\n\n';
        report += 'File | HTML Words | Markdown Words | Retention Rate\n';
        report += '---|---|---|---\n';

        this.conversionStats.files.forEach(file => {
            const retention = ((file.markdownWords / file.htmlWords) * 100).toFixed(2);
            report += `${file.name} | ${file.htmlWords} | ${file.markdownWords} | ${retention}%\n`;
        });

        return report;
    }

    async convertDirectory(inputDir, outputDir) {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Process all HTML files in the directory and its subdirectories
        const processDirectory = (dir) => {
            const items = fs.readdirSync(dir);

            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // Create corresponding output directory
                    const relativePath = path.relative(inputDir, fullPath);
                    const newOutputDir = path.join(outputDir, relativePath);
                    if (!fs.existsSync(newOutputDir)) {
                        fs.mkdirSync(newOutputDir, { recursive: true });
                    }
                    // Process subdirectory
                    processDirectory(fullPath);
                } else if (item.endsWith('.html')) {
                    // Convert HTML file to Markdown
                    const relativePath = path.relative(inputDir, fullPath);

                    // Sanitize the filename part while preserving the directory structure
                    const relativeDir = path.dirname(relativePath);
                    const filename = path.basename(relativePath, '.html');
                    const sanitizedFilename = this.sanitizeFilename(filename);

                    const outputPath = path.join(
                        outputDir,
                        relativeDir,
                        `${sanitizedFilename}.md`
                    );

                    try {
                        const html = fs.readFileSync(fullPath, 'utf8');

                        // Detect document format before processing
                        const documentFormat = this.detectDocumentFormat(html);
                        console.log(`Detected format for ${relativePath}: ${documentFormat}`);

                        const htmlWordCount = this.countWords(html, true);  // Pass true for HTML content

                        // Apply format-specific preprocessing if needed
                        const preprocessedHtml = this.preprocessHtml(html, documentFormat);

                        let markdown = this.turndownService.turndown(preprocessedHtml);
                        markdown = this.cleanupMarkdown(markdown, documentFormat);
                        const markdownWordCount = this.countWords(markdown);

                        // Update statistics
                        this.conversionStats.total.html += htmlWordCount;
                        this.conversionStats.total.markdown += markdownWordCount;
                        this.conversionStats.files.push({
                            name: relativePath,
                            htmlWords: htmlWordCount,
                            markdownWords: markdownWordCount,
                            format: documentFormat
                        });

                        fs.writeFileSync(outputPath, markdown);
                        console.log(`Converted ${relativePath} to Markdown (HTML: ${htmlWordCount} words, MD: ${markdownWordCount} words)`);
                    } catch (error) {
                        console.error(`Error converting ${relativePath}:`, error.message);
                    }
                }
            });
        };

        processDirectory(inputDir);

        // Generate and save report
        const report = this.generateReport();
        fs.writeFileSync(path.join(outputDir, 'conversion-report.md'), report);
        console.log('\nConversion report generated at:', path.join(outputDir, 'conversion-report.md'));
    }

    /**
     * Calculate similarity between two strings (0-1)
     * Uses Levenshtein distance normalized by the longer string length
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score (0-1)
     */
    calculateStringSimilarity(str1, str2) {
        // If either string is empty, return 0
        if (!str1.length || !str2.length) return 0;

        // If strings are identical, return 1
        if (str1 === str2) return 1;

        // Calculate Levenshtein distance
        const len1 = str1.length;
        const len2 = str2.length;

        // Create distance matrix
        const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

        // Initialize first row and column
        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;

        // Fill the matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        // Calculate similarity as 1 - normalized distance
        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);
        return 1 - (distance / maxLen);
    }

    /**
     * Recursively process table content with awareness of nesting depth
     * @param {HTMLElement} tableNode - The table DOM node
     * @param {number} depth - Current nesting depth
     * @returns {string} Processed markdown content
     */
    processTableRecursively(tableNode, depth = 0) {
        // Safety check for maximum recursion depth
        if (depth > this.maxTableDepth) {
            return this.extractTextContent(tableNode);
        }

        // Detect table type
        const isLayoutTable = tableNode.rows.length > 0 &&
            tableNode.rows[0].cells.length === 2 &&
            (tableNode.getAttribute('class') === 'coj-indent' ||
                tableNode.getAttribute('class') === 'coj-table-layout');

        // Indent based on depth
        const indent = '  '.repeat(depth);

        if (isLayoutTable) {
            // Process as a layout table with hierarchical structure
            const rows = Array.from(tableNode.rows).map(row => {
                if (row.cells.length < 2) return '';

                // Get label (usually numbers, references, etc.)
                const label = this.extractTextContent(row.cells[0]).trim();

                // Process content cell, handling any nested tables recursively
                let content = '';
                const contentCell = row.cells[1];

                // Check for nested tables in the content cell
                const nestedTables = contentCell.querySelectorAll('table');
                if (nestedTables.length > 0) {
                    // Extract text before the first nested table
                    let currentNode = contentCell.firstChild;
                    let textBeforeTable = '';

                    while (currentNode && currentNode !== nestedTables[0]) {
                        if (currentNode.nodeType === 3) { // Text node
                            textBeforeTable += currentNode.nodeValue + ' ';
                        } else if (currentNode.nodeType === 1 && currentNode.tagName !== 'TABLE') {
                            textBeforeTable += this.extractTextContent(currentNode) + ' ';
                        }
                        currentNode = currentNode.nextSibling;
                    }

                    // Combine text with recursively processed nested tables
                    content = textBeforeTable.trim() + '\n\n';
                    Array.from(nestedTables).forEach(nestedTable => {
                        content += this.processTableRecursively(nestedTable, depth + 1) + '\n\n';
                    });
                } else {
                    // No nested tables, just extract the content
                    content = this.extractTextContent(contentCell);
                }

                // Format with label and indentation
                return indent + (label ? `**${label}** ${content}` : content);
            }).filter(row => row.trim());

            // Deduplicate similar rows using similarity function
            const deduplicatedRows = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // Check if this row is similar to any of the previous 3 rows
                const isDuplicate = deduplicatedRows.slice(-3).some(prevRow =>
                    this.calculateStringSimilarity(prevRow, row) > this.similarityThreshold);
                if (!isDuplicate) {
                    deduplicatedRows.push(row);
                }
            }

            return deduplicatedRows.join('\n\n');
        } else {
            // Process as a data table with proper indentation
            const rows = Array.from(tableNode.rows).map(row => {
                const cells = Array.from(row.cells).map(cell => {
                    // Check for nested tables in this cell
                    const nestedTables = cell.querySelectorAll('table');
                    if (nestedTables.length > 0) {
                        // Process nested tables recursively
                        let cellContent = this.extractTextContent(cell, nestedTables);
                        Array.from(nestedTables).forEach(nestedTable => {
                            cellContent += '\n' + this.processTableRecursively(nestedTable, depth + 1);
                        });
                        return cellContent.trim();
                    } else {
                        return this.extractTextContent(cell);
                    }
                });

                // Join cells with proper separator and indentation
                return indent + cells.filter(cell => cell.length > 0).join('     ');
            }).filter(row => row.trim());

            // Deduplicate similar rows using similarity function
            const deduplicatedRows = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // Check if this row is similar to any of the previous 3 rows
                const isDuplicate = deduplicatedRows.slice(-3).some(prevRow =>
                    this.calculateStringSimilarity(prevRow, row) > this.similarityThreshold);
                if (!isDuplicate) {
                    deduplicatedRows.push(row);
                }
            }

            return deduplicatedRows.join('\n\n');
        }
    }

    /**
     * Detect the document format based on HTML structure
     * @param {string} html - HTML content
     * @returns {string} Document format ('table-based', 'class-based', or 'unknown')
     */
    detectDocumentFormat(html) {
        // Create a simple DOM parser for detection
        const tableCount = (html.match(/<table/g) || []).length;
        const classBasedParagraphCount = (html.match(/<p class="C\d+/g) || []).length;
        const cojClassCount = (html.match(/class="coj-/g) || []).length;

        if (cojClassCount > 10) {
            return 'coj-format';
        } else if (classBasedParagraphCount > 10) {
            return 'class-based';
        } else if (tableCount > 10) {
            return 'table-based';
        } else {
            return 'unknown';
        }
    }

    /**
     * Preprocess HTML based on detected format
     * @param {string} html - Original HTML content
     * @param {string} format - Detected document format
     * @returns {string} Preprocessed HTML
     */
    preprocessHtml(html, format) {
        if (format === 'table-based') {
            // For table-based layouts, ensure tables are properly structured
            return html
                // Fix common table issues
                .replace(/<table([^>]*)>\s*<tbody>/g, '<table$1>')
                .replace(/<\/tbody>\s*<\/table>/g, '</table>')
                // Remove empty tables
                .replace(/<table[^>]*>\s*<\/table>/g, '');
        } else if (format === 'class-based') {
            // For class-based layouts, ensure proper nesting
            return html
                // Ensure paragraphs have proper spacing
                .replace(/<p class="([^"]+)">/g, '\n<p class="$1">')
                // Fix common class-based issues
                .replace(/<span class="([^"]+)">([^<]+)<\/span>/g, (match, className, content) => {
                    // Apply special formatting based on class
                    if (this.formatMap[className]) {
                        const format = this.formatMap[className];
                        if (format === '**' || format === '_' || format === '__') {
                            return `<span class="${className}">${format}${content}${format}</span>`;
                        }
                    }
                    return match;
                });
        } else if (format === 'coj-format') {
            // For COJ format, ensure proper structure
            return html
                // Ensure proper spacing for COJ elements
                .replace(/<p class="coj-([^"]+)">/g, '\n<p class="coj-$1">');
        }

        return html;
    }

    /**
     * Enhanced cleanup for markdown based on document format
     * @param {string} markdown - Raw markdown content
     * @param {string} format - Document format
     * @returns {string} Cleaned markdown
     */
    cleanupMarkdown(markdown, format = 'unknown') {
        // Apply common cleanup
        let cleaned = markdown
            // Remove excessive blank lines
            .replace(/\n{3,}/g, '\n\n')
            // Clean up table separators
            .replace(/\|\s+\|/g, '|')
            // Ensure consistent heading spacing
            .replace(/\n(#{1,6})\s*([^\n]+)/g, '\n\n$1 $2\n')
            // Remove any remaining HTML comments
            .replace(/<!--[\s\S]*?-->/g, '')
            // Clean up any remaining HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();

        // Format-specific cleanup
        if (format === 'table-based') {
            cleaned = cleaned
                // Fix table-based specific issues
                .replace(/\*\*\s*(\d+)\s*\*\*\s*\*\*\s*(\d+)\s*\*\*/g, '**$1.$2**') // Fix numbered points
                .replace(/\n\n\s*\*\*\s*([A-Z])\s*\*\*/g, '\n\n**$1.**'); // Fix lettered points
        } else if (format === 'class-based' || format === 'coj-format') {
            cleaned = cleaned
                // Fix class-based specific issues
                .replace(/\n\n\s*-\s+(\d+)\s*\./g, '\n\n**$1.**') // Fix numbered lists
                .replace(/\*\*\s*([^*]+?)\s*\*\*\s*:/g, '**$1:**'); // Fix labeled points
        }

        return cleaned;
    }

    generateReport() {
        let report = '# HTML to Markdown Conversion Report\n\n';
        report += `Total files processed: ${this.conversionStats.files.length}\n`;
        report += `Total HTML words: ${this.conversionStats.total.html}\n`;
        report += `Total Markdown words: ${this.conversionStats.total.markdown}\n`;
        report += `Word retention rate: ${((this.conversionStats.total.markdown / this.conversionStats.total.html) * 100).toFixed(2)}%\n\n`;

        // Count files by format
        const formatCounts = {};
        this.conversionStats.files.forEach(file => {
            formatCounts[file.format] = (formatCounts[file.format] || 0) + 1;
        });

        report += '## Document Formats\n\n';
        Object.entries(formatCounts).forEach(([format, count]) => {
            report += `- ${format}: ${count} files\n`;
        });
        report += '\n';

        report += '## File Details\n\n';
        report += 'File | Format | HTML Words | Markdown Words | Retention Rate\n';
        report += '---|---|---|---|---\n';

        this.conversionStats.files.forEach(file => {
            const retention = ((file.markdownWords / file.htmlWords) * 100).toFixed(2);
            report += `${file.name} | ${file.format} | ${file.htmlWords} | ${file.markdownWords} | ${retention}%\n`;
        });

        return report;
    }
}

// Export the converter class
module.exports = CaseMarkdownConverter;

// Example usage when run directly
if (require.main === module) {
    const converter = new CaseMarkdownConverter();
    const inputDir = process.argv[2] || './html';
    const outputDir = process.argv[3] || './markdown';

    converter.convertDirectory(inputDir, outputDir)
        .then(() => console.log('Conversion complete!'))
        .catch(error => console.error('Conversion failed:', error));
} 