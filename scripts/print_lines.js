const fs = require('fs');
const path = process.argv[2];
const start = parseInt(process.argv[3] || '1', 10);
const end = parseInt(process.argv[4] || '9999', 10);
if (!path) { console.error('Usage: node print_lines.js <file> [start] [end]'); process.exit(2); }
const src = fs.readFileSync(path, 'utf8').split('\n');
for (let i = start-1; i < Math.min(end, src.length); i++) {
  const ln = (i+1).toString().padStart(4,' ');
  console.log(ln + ' | ' + src[i]);
}
