const fs = require('fs');
const esbuild = require('esbuild');
const path = process.argv[2];
if (!path) { console.error('Usage: node esbuild_check.js <file>'); process.exit(2); }
const src = fs.readFileSync(path,'utf8');
try {
  esbuild.transformSync(src, { loader: 'jsx', sourcemap: false });
  console.log('esbuild parsed file OK');
} catch (err) {
  console.error('esbuild error:');
  console.error(err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(3);
}
