import fs from 'fs';
const code = fs.readFileSync('pages/Litigation.jsx', 'utf8');

const lines = code.split('\n');

let jsxParens = 0;
for (let i = 931; i < 1373; i++) {
    const line = lines[i];
    jsxParens += (line.match(/\(/g) || []).length;
    jsxParens -= (line.match(/\)/g) || []).length;
    if (jsxParens < 0) {
        console.log(`Parens go negative at line ${i + 1}: ${line.trim()}`);
    }
}
