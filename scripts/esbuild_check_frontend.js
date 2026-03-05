const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node esbuild_check_frontend.js <file>'); process.exit(2); }
let esbuild;
try {
  esbuild = require('c:/PostgreAuth/frontend/node_modules/esbuild');
} catch (e) {
  console.error('Could not load frontend esbuild:', e.message);
  process.exit(2);
}
const src = fs.readFileSync(path,'utf8');
try {
  esbuild.transformSync(src, { loader: 'jsx' });
  console.log('esbuild parsed file OK');
} catch (err) {
  console.error('esbuild error:');
  console.error(err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(3);
}
