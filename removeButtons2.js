const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/pages');

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') && !fullPath.includes('DownloadDropdown.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            // We only care if the file has DownloadDropdown
            if (!content.includes('<DownloadDropdown')) return;

            // Pattern 1: {condition && ( <button ...> </button> )}
            let pattern1 = /\{[a-zA-Z0-9_$.]+(?:\s*[=!]==?\s*['"][^'"]*['"])?\s*&&\s*(?:\(\s*)?(<button[\s\S]*?<\/button>|<Link[\s\S]*?<\/Link>)(?:\s*\)\s*)?\}/g;

            // Pattern 2: standalone <button> or <Link> that is immediately after DownloadDropdown
            // Since we can't easily do lookbehind in JS for variable length, we'll split by DownloadDropdown
            // But wait, the button might be BEFORE DownloadDropdown in some cases? No, usually after.

            const chunks = content.split(/(<DownloadDropdown[\s\S]*?\/>)/);
            if (chunks.length > 2) {
                for (let i = 2; i < chunks.length; i += 2) {
                    // chunks[i] is the code immediately AFTER a DownloadDropdown
                    // First try to match Pattern 1 (conditional wrapper)
                    let matchedWrapper = false;
                    chunks[i] = chunks[i].replace(/^\s*\{[a-zA-Z0-9_$.]+(?:\s*[=!]==?\s*['"][^'"]*['"])?\s*&&\s*(?:\(\s*)?(<button[\s\S]*?<\/button>|<Link[^>]*>[\s\S]*?<\/Link>)(?:\s*\)\s*)?\}/, (match) => {
                        matchedWrapper = true;
                        console.log(`Removed CONDITIONAL button from ${path.basename(fullPath)}`);
                        return '';
                    });

                    // If not wrapped conditionally, try Pattern 2 (raw button)
                    if (!matchedWrapper) {
                        chunks[i] = chunks[i].replace(/^\s*(<button[\s\S]*?<\/button>|<Link[^>]*>[\s\S]*?<\/Link>)/, (match) => {
                            console.log(`Removed RAW button from ${path.basename(fullPath)}`);
                            return '';
                        });
                    }
                }

                const newContent = chunks.join('');
                if (newContent !== content) {
                    fs.writeFileSync(fullPath, newContent, 'utf8');
                }
            }
        }
    });
}

processDirectory(directoryPath);
