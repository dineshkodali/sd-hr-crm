import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, '..', 'frontend', 'pages');

const files = [
  'VulnerableUsers.jsx', 'VCSOrganisations.jsx', 'SafeguardingReferrals.jsx', 'RiskAssessments.jsx', 
  'MultiAgency.jsx', 'MaintenancePage.jsx', 'Litigation.jsx', 'HSETraining.jsx', 'HSERiskManagement.jsx', 
  'HSEIncidents.jsx', 'HSEAudits.jsx', 'Incidents.jsx', 'Inspections.jsx', 'EmergencyProtocols.jsx', 
  'CaseManagement.jsx', 'Complaints.jsx', 'AIRETasks.jsx'
];

let fixed = 0;

files.forEach(f => {
  const filePath = path.join(pagesDir, f);
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;

  // 1. Remove incorrectly placed gallery tag
  src = src.replace(/\s*<ImageGalleryModal open=\{_galleryOpen\} onClose=\{_closeGallery\} items=\{_galleryItems\} title=\{_galleryTitle\} apiBase=\{_galleryApi\} \/>\n?/g, '\n');

  // 2. Insert at the correct place (just before the final return's closing tag)
  const endRegex = /(\n\s*)(<\/[^>]*>)\s*\)\s*;\s*(\}\s*;?\s*(export default [A-Za-z0-9_]+;\s*)?)$/;
  const match = src.match(endRegex);

  if (match) {
    const indent = match[1]; // Get indentation of the closing tag
    // Create new gallery tag with same indent, then the closing tag and the rest of the file
    const galleryTag = `${indent}    <ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />`;
    src = src.replace(endRegex, `${galleryTag}${match[0]}`);
  } else {
    console.log(`⚠️ ${f} could not find correct insertion point`);
  }

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8');
    fixed++;
    console.log(`✅ ${f} fixed`);
  }
});

console.log(`\nFixed ${fixed} files.`);
