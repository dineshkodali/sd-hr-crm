import fs from 'fs';
const code = fs.readFileSync('pages/Litigation.jsx', 'utf8');

const lines = code.split('\n');

let jsxBraces = 0;
for (let i = 931; i < 1373; i++) {
    const line = lines[i];
    // Basic brace counting isn't enough inside JSX strings/comments, but let's try
    jsxBraces += (line.match(/\{/g) || []).length;
    jsxBraces -= (line.match(/\}/g) || []).length;
}

console.log(`Braces between 932 and 1373: ${jsxBraces}`);
