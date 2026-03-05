import fs from 'fs';
const file = fs.readFileSync('pages/Litigation.jsx', 'utf8');

let b = 0, p = 0;
const lines = file.split('\n');
for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    b += (l.match(/\{/g) || []).length;
    b -= (l.match(/\}/g) || []).length;
    if (i === 1373 || i === 1374 || i === 1375) {
        console.log(`Line ${i + 1}: braces=${b}`);
    }
}
