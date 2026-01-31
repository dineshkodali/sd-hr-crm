// Production Authentication Fix Script
// Run this to update your backend for production deployment

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Applying Production Authentication Fixes...\n');

// 1. Update CORS configuration in server.js
const serverJsPath = path.join(__dirname, 'Backend', 'server.js');
try {
  let serverContent = fs.readFileSync(serverJsPath, 'utf8');
  
  // Find and replace CORS configuration
  const oldCorsConfig = `app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin for dynamic host support
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));`;

  const newCorsConfig = `app.use(cors({
  origin: (origin, callback) => {
    // Allow specific origins in production, localhost in development
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3002',
      'http://localhost:3000',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3000'
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));`;

  if (serverContent.includes(oldCorsConfig)) {
    serverContent = serverContent.replace(oldCorsConfig, newCorsConfig);
    fs.writeFileSync(serverJsPath, serverContent);
    console.log('✅ Updated CORS configuration in server.js');
  } else {
    console.log('⚠️  CORS configuration not found or already updated');
  }
} catch (error) {
  console.error('❌ Failed to update server.js:', error.message);
}

// 2. Update cookie configuration in auth.js
const authJsPath = path.join(__dirname, 'Backend', 'routes', 'auth.js');
try {
  let authContent = fs.readFileSync(authJsPath, 'utf8');
  
  const oldCookieConfig = `const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // only true in production (https)
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Lax in dev
  path: "/", // ensure cookie is sent to all routes on the domain
  maxAge: 30 * 24 * 60 * 60 * 1000,
};`;

  const newCookieConfig = `const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // only true in production (https)
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Lax in dev
  path: "/", // ensure cookie is sent to all routes on the domain
  maxAge: 30 * 24 * 60 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || (process.env.NODE_ENV === "production" ? undefined : undefined),
};`;

  if (authContent.includes(oldCookieConfig)) {
    authContent = authContent.replace(oldCookieConfig, newCookieConfig);
    fs.writeFileSync(authJsPath, authContent);
    console.log('✅ Updated cookie configuration in auth.js');
  } else {
    console.log('⚠️  Cookie configuration not found or already updated');
  }
} catch (error) {
  console.error('❌ Failed to update auth.js:', error.message);
}

// 3. Create production environment file
const envPath = path.join(__dirname, '.env');
const envTemplate = `# Production Environment Variables
NODE_ENV=production

# JWT Configuration - CRITICAL!
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters

# CORS Configuration - Add your domain(s)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Cookie Domain (optional, for cross-subdomain)
# COOKIE_DOMAIN=.yourdomain.com

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hr_crm

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=another-secret-key-for-sessions

# Logging
ACTIVITY_LOGS_ENABLED=true
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env file with production template');
} else {
  console.log('ℹ️  .env file already exists - please update it manually');
}

// 4. Create startup check script
const checkScript = `#!/bin/bash
echo "🔍 Checking Production Configuration..."
echo

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy production-env-template.env to .env and update the values"
    exit 1
fi

# Check critical environment variables
source .env

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET not set in .env"
    exit 1
fi

if [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production-minimum-32-characters" ]; then
    echo "❌ Please change the default JWT_SECRET in .env"
    exit 1
fi

if [ -z "$CORS_ORIGINS" ]; then
    echo "❌ CORS_ORIGINS not set in .env"
    exit 1
fi

echo "✅ Environment variables look good"
echo "🚀 Starting server..."
npm start
`;

const checkScriptPath = path.join(__dirname, 'check-production-config.sh');
fs.writeFileSync(checkScriptPath, checkScript);
console.log('✅ Created production configuration check script');

console.log('\n🎉 Production authentication fixes applied!');
console.log('\n📋 Next Steps:');
console.log('1. Update .env file with your actual domain and JWT secret');
console.log('2. Set JWT_SECRET to a secure random string (min 32 characters)');
console.log('3. Update CORS_ORIGINS with your actual domain(s)');
console.log('4. Restart your backend server');
console.log('5. Test authentication');
console.log('\n🔐 Security Reminder:');
console.log('- Never commit .env file to version control');
console.log('- Use a strong, random JWT_SECRET');
console.log('- Ensure HTTPS is enabled in production');
console.log('- Update CORS_ORIGINS to only allow your domains');
