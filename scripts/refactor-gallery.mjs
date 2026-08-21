/**
 * Refactor all pages to use ImageGalleryModal instead of window.open gallery.
 * 
 * This script reads each page file, applies the three changes:
 * 1. Add import for ImageGalleryModal + useImageGallery
 * 2. Replace the openAttachmentsGallery function body
 * 3. Add <ImageGalleryModal> to the return JSX
 *
 * Run: node scripts/refactor-gallery.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, '..', 'frontend', 'pages');

// Config for each page: file, gallery title, api base path
const pages = [
  { file: 'VulnerableUsers.jsx',       title: 'Vulnerable Users Documents',    api: '/api/vulnerable-users/attachments' },
  { file: 'VCSOrganisations.jsx',      title: 'VCS Documents',                 api: '/api/vcs-organisations/attachments' },
  { file: 'SafeguardingReferrals.jsx',  title: 'Safeguarding Documents',        api: '/api/safeguarding/attachments' },
  { file: 'RiskAssessments.jsx',        title: 'Risk Assessment Documents',     api: '/api/risk-assessments/attachments' },
  { file: 'MultiAgency.jsx',           title: 'Multi-Agency Documents',        api: '/api/multi-agency/attachments' },
  { file: 'MaintenancePage.jsx',       title: 'Maintenance Documents',         api: '/api/maintenance/attachments' },
  { file: 'Litigation.jsx',            title: 'Litigation Documents',          api: '/api/litigation/attachments' },
  { file: 'HSETraining.jsx',           title: 'HSE Training Documents',        api: '/api/hse/training/attachments' },
  { file: 'HSERiskManagement.jsx',     title: 'HSE Risk Documents',            api: '/api/hse/risk-management/attachments' },
  { file: 'HSEIncidents.jsx',          title: 'HSE Incident Documents',        api: '/api/hse/incidents/attachments' },
  { file: 'HSEAudits.jsx',             title: 'HSE Audit Documents',           api: '/api/hse/audits/attachments' },
  { file: 'Incidents.jsx',             title: 'Incident Photos',               api: '/api/incidents/attachments' },
  { file: 'Inspections.jsx',           title: 'Inspection Documents',          api: '/api/inspections/attachments' },
  { file: 'EmergencyProtocols.jsx',    title: 'Emergency Protocol Documents',  api: '/api/emergency-protocols/attachments' },
  { file: 'CaseManagement.jsx',        title: 'Case Management Documents',     api: '/api/case-management/attachments' },
  { file: 'Complaints.jsx',            title: 'Complaint Documents',           api: '/api/complaints/attachments' },
  { file: 'AIRETasks.jsx',             title: 'AIRE Task Documents',           api: '/api/aire-tasks/attachments' },
];

let modified = 0;
let errors = [];

for (const pg of pages) {
  const filePath = path.join(pagesDir, pg.file);
  if (!fs.existsSync(filePath)) {
    errors.push(`SKIP: ${pg.file} not found`);
    continue;
  }

  let src = fs.readFileSync(filePath, 'utf-8');
  const original = src;

  // ---- Step 1: Add import ----
  if (!src.includes('ImageGalleryModal')) {
    // Find the last import line
    const importRegex = /^import .+$/gm;
    let lastImportMatch;
    let m;
    while ((m = importRegex.exec(src)) !== null) {
      lastImportMatch = m;
    }
    if (lastImportMatch) {
      const insertPos = lastImportMatch.index + lastImportMatch[0].length;
      const importLine = `\nimport ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';`;
      src = src.slice(0, insertPos) + importLine + src.slice(insertPos);
    }
  }

  // ---- Step 2: Replace openAttachmentsGallery function body ----
  // Find the function — could be `const openAttachmentsGallery = (items = []) => {` or `function openAttachmentsGallery(attachments) {`
  // We need to find the function start and its matching closing brace, then replace the body

  // Pattern 1: const openAttachmentsGallery = ... => { ... };
  // Pattern 2: function openAttachmentsGallery(...) { ... }
  // Both contain window.open(blobUrl inside

  const funcStartRegex = /((?:const\s+)?openAttachmentsGallery\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{|function\s+openAttachmentsGallery\s*\([^)]*\)\s*\{)/;
  const funcMatch = funcStartRegex.exec(src);

  if (funcMatch && src.includes('window.open(blobUrl')) {
    const startIdx = funcMatch.index;
    // Find the matching closing brace
    let braceCount = 0;
    let endIdx = startIdx;
    let foundStart = false;
    for (let i = startIdx; i < src.length; i++) {
      if (src[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (src[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }

    // Check if followed by a semicolon
    let afterEnd = endIdx + 1;
    if (src[afterEnd] === ';') afterEnd++;

    // Determine the indentation
    const lineStart = src.lastIndexOf('\n', startIdx) + 1;
    const indent = src.slice(lineStart, startIdx).match(/^\s*/)?.[0] || '    ';

    // Build replacement — keep the same function signature but replace the body
    const isAsync = funcMatch[0].includes('async');
    const isArrow = funcMatch[0].includes('=>');

    let replacement;
    if (isArrow) {
      replacement = `${indent}const openAttachmentsGallery = (items = []) => {\n${indent}    if (!items.length) return;\n${indent}    _openGallery(items, "${pg.title}", "${pg.api}");\n${indent}};`;
    } else {
      replacement = `${indent}function openAttachmentsGallery(attachments) {\n${indent}    let atts = attachments || [];\n${indent}    try { if (typeof atts === 'string' && atts) atts = JSON.parse(atts); } catch { atts = []; }\n${indent}    const list = Array.isArray(atts) ? atts.filter(Boolean) : [];\n${indent}    if (!list.length) return;\n${indent}    _openGallery(list, "${pg.title}", "${pg.api}");\n${indent}}`;
    }

    src = src.slice(0, startIdx) + replacement + src.slice(afterEnd);
  }

  // ---- Step 3: Add hook call inside the component function ----
  // Find the first useState call (which is always inside the component) and add the hook before it
  if (!src.includes('useImageGallery()')) {
    const useStateIdx = src.indexOf('useState(');
    if (useStateIdx > -1) {
      // Find the start of the line containing this useState
      const lineStart = src.lastIndexOf('\n', useStateIdx) + 1;
      const indent = src.slice(lineStart, useStateIdx).match(/^\s*/)?.[0] || '    ';
      const hookCode = `${indent}// Image gallery hook — opens in-page modal instead of new tab\n${indent}const { galleryOpen: _galleryOpen, galleryItems: _galleryItems, galleryTitle: _galleryTitle, galleryApi: _galleryApi, openGallery: _openGallery, closeGallery: _closeGallery } = useImageGallery();\n\n`;
      src = src.slice(0, lineStart) + hookCode + src.slice(lineStart);
    }
  }

  // ---- Step 4: Add <ImageGalleryModal> to JSX ----
  // Find the last </div> before the closing ); of the return statement
  if (!src.includes('<ImageGalleryModal')) {
    // Strategy: find the last `);` preceded by some closing JSX
    // A safer approach: find the last occurrence of `</div>` followed by whitespace and `);`
    const closingPattern = /(<\/div\s*>)\s*\n(\s*\)\s*;?\s*\n\s*\})/;
    const closingMatch = src.match(closingPattern);
    if (closingMatch) {
      const insertBefore = src.lastIndexOf(closingMatch[0]);
      const indent = '            ';
      const galleryTag = `\n${indent}<ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />\n`;
      src = src.slice(0, insertBefore) + closingMatch[1] + galleryTag + closingMatch[2] + src.slice(insertBefore + closingMatch[0].length);
    } else {
      // Fallback: insert before the very last `);` in the file
      const lastReturn = src.lastIndexOf(');');
      if (lastReturn > -1) {
        const indent = '            ';
        const galleryTag = `\n${indent}<ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />`;
        src = src.slice(0, lastReturn) + galleryTag + '\n        ' + src.slice(lastReturn);
      }
    }
  }

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf-8');
    modified++;
    console.log(`✅ ${pg.file} — refactored`);
  } else {
    console.log(`⏭️  ${pg.file} — no changes needed`);
  }
}

console.log(`\nDone: ${modified} files modified, ${errors.length} errors`);
errors.forEach(e => console.log(`  ⚠️  ${e}`));
