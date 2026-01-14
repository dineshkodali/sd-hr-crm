const fs = require('fs');
const path = process.argv[2];
const lineNo = parseInt(process.argv[3],10)||1;
const s = fs.readFileSync(path,'utf8');
const lines = s.split(/\r?\n/);
const line = lines[lineNo-1] || '';
console.log('LINE', lineNo, ':', line);
let out='';
for (let i=0;i<line.length;i++){ out += i+':'+line.charCodeAt(i)+'('+line[i]+') '; }
console.log(out);
