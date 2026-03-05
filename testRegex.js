const fs = require('fs');
const content = fs.readFileSync('frontend/pages/RiskAssessments.jsx', 'utf8');

const regex1 = /(<DownloadDropdown[\s\S]*?\/>)\s*(<button[\s\S]*?<\/button>|<Link[\s\S]*?<\/Link>)/g;
const regex2 = /(<DownloadDropdown[\s\S]*?\/>)\s*\{[\s\S]*?&&\s*(?:\(\s*)?(<button[\s\S]*?<\/button>|<Link[\s\S]*?<\/Link>)\s*(?:\)\s*)?\}/g;

console.log("Regex 1 matches:", (content.match(regex1) || []).length);
console.log("Regex 2 matches:", (content.match(regex2) || []).length);

const fullRegex = /(<DownloadDropdown[\s\S]*?\/>)\s*(?:\{[^{}]*&&\s*(?:\(\s*)?)?(?:<button[\s\S]*?<\/button>|<Link[\s\S]*?<\/Link>)(?:\s*\)\s*\})?/g;
console.log("Full Regex matches:", (content.match(fullRegex) || []).length);

if ((content.match(fullRegex) || []).length > 0) {
    const replaced = content.replace(fullRegex, '$1');
    fs.writeFileSync('frontend/pages/RiskAssessments_test.jsx', replaced, 'utf8');
}
