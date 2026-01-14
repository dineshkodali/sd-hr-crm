const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage'); process.exit(2); }
const s = fs.readFileSync(path,'utf8');
let sq=0,dq=0,bq=0;
for (let i=0;i<s.length;i++){
  const ch = s[i];
  const prev = s[i-1];
  if (ch==="'" && prev !== '\\') sq++;
  if (ch==='"' && prev !== '\\') dq++;
  if (ch==='`' && prev !== '\\') bq++;
}
console.log("single:",sq,"double:",dq,"backtick:",bq);
