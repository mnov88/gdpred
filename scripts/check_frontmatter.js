import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function checkFrontmatter(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/^---\n([\s\S]*?)\n---/);

        if (!matches) {
            console.log(`⚠️  No frontmatter found in: ${filePath}`);
            return;
        }

        const frontmatter = matches[1];
        try {
            yaml.load(frontmatter);
        } catch (e) {
            console.log(`❌ Invalid frontmatter in: ${filePath}`);
            console.log(`   Error: ${e.message}`);
            if (e.mark && e.mark.snippet) {
                console.log(`   Near:\n${e.mark.snippet}`);
            }
        }
    } catch (error) {
        console.log(`❌ Error reading file: ${filePath}`);
        console.log(`   ${error.message}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (path.extname(file) === '.md') {
            checkFrontmatter(filePath);
        }
    });
}

console.log('🔍 Checking frontmatter in all markdown files...\n');
walkDir('content');
console.log('\n✅ Frontmatter check complete!'); 