const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage'); process.exit(2); }
const s = fs.readFileSync(path,'utf8');
let state = null; // 'single','double','backtick','linecomment','blockcomment'
for (let i=0;i<s.length;i++){
  const ch = s[i];
  const prev = s[i-1];
  const next = s[i+1];
  if(state==='linecomment'){
    if(ch==='\n') state=null;
    continue;
  }
  if(state==='blockcomment'){
    if(prev==='*' && ch==='/') state=null;
    continue;
  }
  if(state==='single'){
    if(ch==="'" && prev!=='\\') state=null;
    continue;
  }
  if(state==='double'){
    if(ch==='"' && prev!=='\\') state=null;
    continue;
  }
  if(state==='backtick'){
    if(ch==='`' && prev!=='\\') state=null;
    continue;
  }
  // not in any
  if(ch==='/' && next==='/' ){ state='linecomment'; i++; continue; }
  if(ch==='/' && next==='*' ){ state='blockcomment'; i++; continue; }
  if(ch==="'") { state='single'; continue; }
  if(ch==='