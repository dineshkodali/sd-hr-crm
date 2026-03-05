const fs = require('fs');

const testCases = [
    `
{hasCreate && (
    <div className="flex items-center gap-3">
        <DownloadDropdown onDownloadPDF={() => {}} onDownloadCSV={() => {}} />
        <button className="...">New Record</button>
    </div>
)}
`,
    `
<DownloadDropdown onDownloadAction={() => {}} />
{canCreate && (
    <button>New Record</button>
)}
`,
    `
<DownloadDropdown onDownloadAction={() => {}} />
{canCreate && <button>New Record</button>}
`,
    `
<DownloadDropdown onDownloadAction={() => {}} />
<Link href="/create"><button>New Record</button></Link>
`
];

const fullRegex = /(<DownloadDropdown[\s\S]*?\/>)\s*(?:\{(?:[^{}<>]+?|.*?)\s*&&\s*(?:\(\s*)?)?(?:(?:<button[\s\S]*?<\/button>|<Link[^>]*>[\s\S]*?<\/Link>))(?:\s*\)\s*\})?(?:\s*\})?/g;

testCases.forEach((tc, i) => {
    console.log(`\n--- Test Case ${i + 1} ---`);
    console.log("Original:\n", tc);
    const result = tc.replace(fullRegex, '$1');
    console.log("Replaced:\n", result);
});
