const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/pages');
let logOutput = "";

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            // Regex explanation:
            // 1. (<DownloadDropdown[\s\S]*?\/>) -> matches DownloadDropdown component
            // 2. \s* -> optional whitespace
            // 3. (?:\{[a-zA-Z0-9_$]+(?:\s*===.*?)?\s*&&\s*(?:\(\s*)?)? -> optionally matches `{ hasCreate && (` or `{role === 'Admin' && (`
            // 4. (<button[\s\S]*?<\/button>|<Link[\s\S]*?<\/Link>) -> matches the button or link
            // 5. (?:\s*\)\s*\})? -> optionally matches ` )}`
            const regex = /(<DownloadDropdown[\s\S]*?\/>)\s*(?:\{[a-zA-Z0-9_$]+(?:\s*(?:===|!==).*?)?\s*&&\s*(?:\(\s*)?)?(<button[\s\S]*?<\/button>|<Link[\s\S]*?<\/Link>)(?:\s*\)\s*\})?/g;

            let match;
            let replacedCount = 0;
            // We use replace with a replacer function to log the exact matched string
            const newContent = content.replace(regex, (match, p1, p2) => {
                logOutput += `\n=== REPLACING IN ${path.basename(fullPath)} ===\n`;
                logOutput += `MATCHED:\n${match}\n`;
                logOutput += `--- REPLACING WITH ---\n${p1}\n`;
                replacedCount++;
                return p1; // Only keep the DownloadDropdown
            });

            if (replacedCount > 0) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                logOutput += `\nSUCCESSFULLY UPDATED ${path.basename(fullPath)}\n`;
            } else if (content.includes('DownloadDropdown')) {
                logOutput += `NO MATCH for ${path.basename(fullPath)} (has DownloadDropdown)\n`;
                const fallbackMatch = content.match(/.{0,50}<DownloadDropdown.{0,300}/s);
                if (fallbackMatch) {
                    logOutput += `Snippet: ${fallbackMatch[0]}\n-----\n`;
                }
            }
        }
    });
}

processDirectory(directoryPath);
fs.writeFileSync('node_debug_log.txt', logOutput, 'utf8');
