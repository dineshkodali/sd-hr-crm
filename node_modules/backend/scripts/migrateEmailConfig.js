// Backend/scripts/migrateEmailConfig.js
// This script migrates email configuration from .env to encrypted config file

import dotenv from 'dotenv';
import { getEmailConfig } from '../config/emailConfig.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('\n' + '='.repeat(60));
console.log('📧 EMAIL CONFIGURATION MIGRATION');
console.log('='.repeat(60));

console.log('\n1️⃣  Loading current email configuration from .env...');

const envHasEmailConfig = !!(
  process.env.EMAIL_USER || 
  process.env.EMAIL_PASS || 
  process.env.EMAIL_PASSWORD ||
  process.env.EMAIL_HOST ||
  process.env.EMAIL_FROM
);

if (!envHasEmailConfig) {
  console.log('❌ No email configuration found in .env file');
  console.log('   Nothing to migrate.');
  process.exit(0);
}

console.log('✅ Found email configuration in .env');

console.log('\n2️⃣  Creating encrypted configuration file...');

try {
  // This will automatically create the encrypted config from environment variables
  const config = getEmailConfig();
  
  console.log('\n✅ Configuration migrated successfully!');
  console.log('\n📋 Migrated Configuration (masked):');
  console.log('   OTP Email:');
  console.log('   - Service:', config.otp.service);
  console.log('   - User:', maskEmail(config.otp.user));
  console.log('   - Configured:', !!(config.otp.user && config.otp.pass));
  console.log('\n   Notification Email:');
  console.log('   - Host:', config.notifications.host);
  console.log('   - Port:', config.notifications.port);
  console.log('   - User:', maskEmail(config.notifications.user));
  console.log('   - From Name:', config.notifications.fromName);
  console.log('   - Configured:', !!(config.notifications.user && config.notifications.password));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETE');
  console.log('='.repeat(60));
  
  console.log('\n⚠️  IMPORTANT: You can now safely remove these lines from your .env file:');
  console.log('   - EMAIL_SERVICE');
  console.log('   - EMAIL_USER');
  console.log('   - EMAIL_PASS');
  console.log('   - EMAIL_FROM');
  console.log('   - EMAIL_HOST');
  console.log('   - EMAIL_PORT');
  console.log('   - EMAIL_PASSWORD');
  console.log('   - EMAIL_FROM_NAME');
  
  console.log('\n📁 Configuration is now stored in:');
  console.log('   Backend/config/.email.config.encrypted (hidden file)');
  
  console.log('\n🔒 The configuration is encrypted using your JWT_SECRET');
  console.log('   Make sure to keep JWT_SECRET secure in your .env file');
  
  console.log('\n💡 To manage email configuration, use the admin API:');
  console.log('   GET  /api/email-config/status');
  console.log('   PUT  /api/email-config/update');
  console.log('   POST /api/email-config/test');
  
  console.log('\n' + '='.repeat(60) + '\n');
  
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const maskedLocal = local.substring(0, 2) + '***' + local.substring(local.length - 1);
  return maskedLocal + '@' + domain;
}
