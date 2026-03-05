#!/usr/bin/env node

/**
 * Script to automatically apply CRUD logging to route files
 * Usage: node Backend/scripts/applyCrudLogging.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route configurations - map route file to resource name and table name
const routeConfigs = {
  'moveouts.js': { resource: 'move_outs', table: 'move_outs' },
  'vulnerable-users.js': { resource: 'vulnerable_users', table: 'vulnerable_users' },
  'vcs-organisations.js': { resource: 'vcs_organisations', table: 'vcs_organisations' },
  'rooms.js': { resource: 'rooms', table: 'rooms' },
  'safeguarding.js': { resource: 'safeguarding_referrals', table: 'safeguarding_referrals' },
  'risk-assessments.js': { resource: 'risk_assessments', table: 'risk_assessments' },
  'performance-management.js': { resource: 'performance_management', table: 'performance_management' },
  'payroll.js': { resource: 'payroll', table: 'payroll' },
  'multi-agency.js': { resource: 'multi_agency', table: 'multi_agency' },
  'moveins.js': { resource: 'move_ins', table: 'move_ins' },
  'meals.js': { resource: 'meals', table: 'meals' },
  'maintenance.js': { resource: 'maintenance', table: 'maintenance' },
  'litigation.js': { resource: 'litigation', table: 'litigation' }
};

const routesDir = path.join(__dirname, '..', 'routes');

function updateRouteFile(filename, config) {
  const filePath = path.join(routesDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filename}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already has enhanced logging
  if (content.includes('applyCrudLogging') || content.includes('activityMiddleware')) {
    console.log(`⚠️  ${filename} already has enhanced logging`);
    return false;
  }

  // Add import statement
  const importRegex = /import\s+.*from\s+["']\.\.\/middleware\/auth\.js["'];?/;
  const importMatch = content.match(importRegex);
  
  if (importMatch) {
    const newImport = `${importMatch[0]}\nimport { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging`;
    content = content.replace(importMatch[0], newImport);
  } else {
    // Add import after other imports
    const lastImportRegex = /import\s+.*from\s+["'][^"']*["'];?\s*\n/g;
    let lastImportMatch;
    let match;
    while ((match = lastImportRegex.exec(content)) !== null) {
      lastImportMatch = match;
    }
    
    if (lastImportMatch) {
      const insertIndex = lastImportMatch.index + lastImportMatch[0].length;
      content = content.slice(0, insertIndex) + 
                `import { applyCrudLogging } from "../middleware/activityMiddleware.js"; // Enhanced logging\n` +
                content.slice(insertIndex);
    }
  }

  // Add applyCrudLogging after router creation
  const routerRegex = /const\s+router\s+=\s+express\.Router\(\);?\s*\n/;
  const routerMatch = content.match(routerRegex);
  
  if (routerMatch) {
    const loggingCode = `\n// Apply CRUD logging to all operations\napplyCrudLogging(router, '${config.resource}', '${config.table}');\n`;
    content = content.replace(routerMatch[0], routerMatch[0] + loggingCode);
  }

  // Write the updated content
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ${filename} with enhanced logging`);
  return true;
}

function main() {
  console.log('🚀 Applying CRUD logging to route files...\n');
  
  let updatedCount = 0;
  let totalCount = 0;

  for (const [filename, config] of Object.entries(routeConfigs)) {
    totalCount++;
    if (updateRouteFile(filename, config)) {
      updatedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total files: ${totalCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${totalCount - updatedCount}`);
  
  if (updatedCount > 0) {
    console.log(`\n✨ Enhanced logging has been applied to ${updatedCount} route files!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review the updated files to ensure they look correct`);
    console.log(`   2. Test the routes to verify logging is working`);
    console.log(`   3. Check the Activity Logs page to see comparison tables`);
    console.log(`   4. Restart your server to apply the changes`);
  } else {
    console.log(`\n🎉 All route files already have enhanced logging or were skipped!`);
  }
}

// Run the script
main();