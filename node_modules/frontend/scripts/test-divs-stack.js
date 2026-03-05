import fs from 'fs';

const code = fs.readFileSync('pages/Litigation.jsx', 'utf8');
const lines = code.split('\n');

const stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let match;
    const openRegex = /<div\b[^>]*>/g;
    while ((match = openRegex.exec(line)) !== null) {
        if (!match[0].endsWith('/>')) {
            stack.push(i + 1);
        }
    }

    const closeRegex = /<\/div>/g;
    while ((match = closeRegex.exec(line)) !== null) {
        stack.pop();
    }
}

console.log("Unclosed divs opened at lines:", stack);
