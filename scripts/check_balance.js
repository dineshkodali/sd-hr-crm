const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node check_balance.js <file>'); process.exit(2); }
const src = fs.readFileSync(path, 'utf8');
const pairs = { '{': '}', '(': ')', '[': ']' };
const opens = Object.keys(pairs);
const closes = Object.values(pairs);
let stack = [];
for (let i = 0; i < src.length; i++) {
  const ch = src[i];
  if (opens.includes(ch)) stack.push({ch, i});
  else if (closes.includes(ch)) {
    const last = stack.pop();
    if (!last) { console.error('Unmatched closing', ch, 'at', i); process.exit(3); }
    if (pairs[last.ch] !== ch) { console.error('Mismatched', last.ch, 'at', last.i, 'closed by', ch, 'at', i); process.exit(4); }
  }
}
if (stack.length) { const last = stack.pop(); console.error('Unclosed', last.ch, 'opened at', last.i); process.exit(5); }
console.log('All brackets/paren balanced');
