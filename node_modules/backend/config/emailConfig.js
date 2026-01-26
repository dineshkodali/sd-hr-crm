// Backend/config/emailConfig.js
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Encryption key derived from JWT_SECRET (already in .env and needed for auth)
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET || 'default-key')
  .digest();

const IV_LENGTH = 16;

// Path to encrypted config file (hidden in config directory)
const CONFIG_FILE_PATH = path.join(__dirname, '.email.config.encrypted');

/**
 * Encrypt text
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt text
 */
function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Save encrypted email configuration
 */
function saveEmailConfig(config) {
  const configJson = JSON.stringify(config, null, 2);
  const encrypted = encrypt(configJson);
  fs.writeFileSync(CONFIG_FILE_PATH, encrypted, 'utf8');
  // Make file hidden on Windows
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync(`attrib +h "${CONFIG_FILE_PATH}"`, { stdio: 'ignore' });
    } catch (err) {
      // Ignore errors, file is still created
    }
  }
}

/**
 * Load encrypted email configuration
 */
function loadEmailConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return null;
    }
    const encrypted = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error loading email config:', error.message);
    return null;
  }
}

/**
 * Initialize email config from environment variables (one-time migration)
 */
function initializeFromEnv() {
  const config = {
    otp: {
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
      from: process.env.EMAIL_FROM || ''
    },
    notifications: {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || '',
      fromName: process.env.EMAIL_FROM_NAME || 'SD CRM Notifications'
    }
  };

  saveEmailConfig(config);
  console.log('✅ Email configuration encrypted and saved successfully');
  console.log('⚠️  You can now remove EMAIL_* variables from .env file (except EMAIL_SERVICE if needed)');
  
  return config;
}

/**
 * Get email configuration (from encrypted file or env fallback)
 */
export function getEmailConfig() {
  let config = loadEmailConfig();
  
  // If no encrypted config exists, create one from environment variables
  if (!config) {
    // Check if we have email config in environment
    if (process.env.EMAIL_USER || process.env.EMAIL_PASS) {
      config = initializeFromEnv();
    } else {
      // Return empty config
      config = {
        otp: { service: 'gmail', user: '', pass: '', from: '' },
        notifications: { host: 'smtp.gmail.com', port: 587, user: '', password: '', fromName: 'SD CRM' }
      };
    }
  }
  
  return config;
}

/**
 * Update email configuration
 */
export function updateEmailConfig(newConfig) {
  const currentConfig = loadEmailConfig() || {
    otp: {},
    notifications: {}
  };
  
  const updatedConfig = {
    otp: { ...currentConfig.otp, ...newConfig.otp },
    notifications: { ...currentConfig.notifications, ...newConfig.notifications }
  };
  
  saveEmailConfig(updatedConfig);
  return updatedConfig;
}

/**
 * Check if email is configured
 */
export function isEmailConfigured() {
  const config = getEmailConfig();
  return !!(config.otp.user && config.otp.pass);
}

export default {
  getEmailConfig,
  updateEmailConfig,
  isEmailConfigured
};
