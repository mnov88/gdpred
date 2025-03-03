const fs = require('fs');
const path = require('path');

// Helper to extract JSON and YAML using both fenced code blocks and fallback splitting.
function extractJSONAndYAML(responseContent) {
  let yamlContent = null;
  let jsonContent = null;
  
  // First, try to use fenced code blocks.
  const yamlMatch = responseContent.match(/```yaml\s*\r?\n([\s\S]*?)\r?\n```/);
  const jsonMatch = responseContent.match(/```json\s*\r?\n([\s\S]*?)\r?\n```/);
  
  if (yamlMatch && jsonMatch) {
    yamlContent = yamlMatch[1];
    jsonContent = jsonMatch[1];
    return { yamlContent, jsonContent };
  }
  
  // Fallback: split on a line that contains only equals signs.
  const parts = responseContent.split(/\n=+\n/);
  if (parts.length < 2) {
    console.log('Fallback split did not find the expected separator line.');
    return { yamlContent, jsonContent };
  }
  
  // Extract JSON from the first part.
  const jsonSection = parts[0];
  const startIdx = jsonSection.indexOf('[');
  const endIdx = jsonSection.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonContent = jsonSection.substring(startIdx, endIdx + 1).trim();
  } else {
    console.log('Could not locate JSON array boundaries in the fallback section.');
  }
  
  // Extract YAML from the second part.
  let yamlSection = parts[1].trim();
  // If the YAML section starts with '---', remove the first and last lines.
  if (yamlSection.startsWith('---')) {
    const lines = yamlSection.split(/\r?\n/);
    if (lines[0].trim() === '---') lines.shift();
    if (lines[lines.length - 1].trim() === '---') lines.pop();
    yamlContent = lines.join('\n').trim();
  } else {
    console.log('Fallback YAML section does not start with ---');
  }
  
  return { yamlContent, jsonContent };
}

function processFiles(directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath);
    const responseFiles = files.filter(file => file.endsWith('_response.md'));
    
    for (const responseFile of responseFiles) {
      const originalFileName = responseFile.replace('_response.md', '.md');
      const responseFilePath = path.join(directoryPath, responseFile);
      const originalFilePath = path.join(directoryPath, originalFileName);
      
      if (!fs.existsSync(originalFilePath)) {
        console.log(`Original file ${originalFileName} not found. Skipping.`);
        continue;
      }
      
      console.log(`Processing ${originalFileName} using ${responseFile}...`);
      
      // Create a backup of the original file.
      const backupFilePath = `${originalFilePath}.backup`;
      fs.copyFileSync(originalFilePath, backupFilePath);
      console.log(`Backup created at ${backupFilePath}`);
      
      // Read the response file content.
      const responseContent = fs.readFileSync(responseFilePath, 'utf8');
      const { yamlContent, jsonContent } = extractJSONAndYAML(responseContent);
      
      if (!yamlContent || !jsonContent) {
        console.log(`Failed to extract YAML or JSON content from ${responseFile}.`);
        continue;
      }
      
      let sentencePairs;
      try {
        sentencePairs = JSON.parse(jsonContent);
      } catch (error) {
        console.log(`Error parsing JSON from ${responseFile}: ${error.message}`);
        continue;
      }
      
      // Format title from the original filename (replacing second dash with a slash).
      const baseName = originalFileName.replace('.md', '');
      const title = formatTitleFromFilename(baseName);
      const fullYamlContent = `title: ${title}\n${yamlContent}`;
      
      // Read and prepare the original file content.
      let originalContent = fs.readFileSync(originalFilePath, 'utf8');
      originalContent = removeExistingFrontmatter(originalContent);
      
      // Replace sentences according to the provided pairs.
      for (const pair of sentencePairs) {
        const originalSentence = pair.sentence_original;
        const fixedSentence = pair.sentence_fixed;
        const escapedOriginal = originalSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedOriginal, 'g');
        originalContent = originalContent.replace(regex, fixedSentence);
      }
      
      // Prepend the YAML frontmatter.
      const finalContent = `---\n${fullYamlContent}\n---\n\n${originalContent}`;
      fs.writeFileSync(originalFilePath, finalContent);
      
      console.log(`Successfully processed ${originalFileName}`);
    }
    
    console.log('All files processed successfully!');
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  }
}

// Replace the second dash in the filename with a slash to form the title.
function formatTitleFromFilename(filename) {
  const firstDashPos = filename.indexOf('-');
  if (firstDashPos === -1) return filename;
  const secondDashPos = filename.indexOf('-', firstDashPos + 1);
  if (secondDashPos === -1) return filename;
  return filename.substring(0, secondDashPos) + '/' + filename.substring(secondDashPos + 1);
}

// Remove any existing YAML frontmatter from the content.
function removeExistingFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\s*/, '');
}

// Use the provided directory or default to the current directory.
const directoryPath = process.argv[2] || '.';
processFiles(directoryPath);