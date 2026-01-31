// Ensure Authentication Environment Variables
// Run this script to verify and set required environment variables

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Checking Authentication Environment Configuration...\n');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('Creating .env file with default values...\n');
  
  const defaultEnv = `# Production Environment Variables
NODE_ENV=production

# JWT Configuration - CRITICAL for authentication
JWT_SECRET=super-secure-jwt-secret-key-for-production-32-chars-minimum
JWT_SECRET_KEY=super-secure-jwt-secret-key-for-production-32-chars-minimum

# CORS Configuration - Replace with your actual domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hr_crm
`;
  
  fs.writeFileSync(envPath, defaultEnv);
  console.log('✅ .env file created with default values');
} else {
  console.log('✅ .env file found');
}

// Read and check environment variables
require('dotenv').config();

const requiredVars = [
  'NODE_ENV',
  'JWT_SECRET',
  'CORS_ORIGINS'
];

const warnings = [];

requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    warnings.push(`❌ ${varName} is not set`);
  } else {
    if (varName === 'JWT_SECRET' && process.env[varName].length < 32) {
      warnings.push(`⚠️  ${varName} should be at least 32 characters for security`);
    } else {
      console.log(`✅ ${varName} is set`);
    }
  }
});

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach(warning => console.log(warning));
  console.log('\n📝 Please update your .env file to fix these issues');
} else {
  console.log('\n✅ All required environment variables are properly configured');
}

console.log('\n🚀 Starting server with authentication configuration...\n');

// Export for use in server.js
export default {
  checkAuthEnv: () => {
    return warnings.length === 0;
  },
  getAuthConfig: () => ({
    jwtSecret: process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "default-jwt-secret-for-production-change-this-in-env-32-chars-minimum",
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3002'],
    nodeEnv: process.env.NODE_ENV || 'development'
  })
};
