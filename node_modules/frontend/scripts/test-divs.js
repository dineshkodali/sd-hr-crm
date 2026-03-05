import fs from 'fs';

const code = fs.readFileSync('pages/Litigation.jsx', 'utf8');

let openDivs = 0;
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Basic counting for divs, ignoring self-closing
    const openMatches = (line.match(/<div/g) || []).length;
    const closeMatches = (line.match(/<\/div/g) || []).length;

    openDivs += openMatches;
    openDivs -= closeMatches;

    if (openDivs < 0) {
        console.log(`Balance goes negative at line ${i + 1}: divs=${openDivs}`);
    }
}

console.log(`Final balance: divs=${openDivs}`);
