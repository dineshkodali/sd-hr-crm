const fs = require('fs');
const path = process.argv[2];
const char = process.argv[3] || '`';
const src = fs.readFileSync(path,'utf8');
let count = 0;
for (let i=0;i<src.length;i++) if (src[i]===char) count++;
console.log(char + ' count = ' + count);
