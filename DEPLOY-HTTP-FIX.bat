@echo off
echo ========================================
echo HTTP PRODUCTION DEPLOYMENT FIX
echo ========================================
echo.

echo ✅ Configuring for HTTP domain: http://crm.sdgsolutions.in
echo.

echo Step 1: Creating production .env file for HTTP...
(
echo # Production Environment Variables
echo NODE_ENV=production
echo.
echo # HTTP/HTTPS Configuration - Set to true only if using HTTPS
echo HTTPS_ONLY=false
echo.
echo # JWT Configuration - CRITICAL for authentication
echo JWT_SECRET=super-secure-jwt-secret-key-for-production-32-chars-minimum
echo JWT_SECRET_KEY=super-secure-jwt-secret-key-for-production-32-chars-minimum
echo.
echo # CORS Configuration - Updated for your HTTP domain
echo CORS_ORIGINS=http://crm.sdgsolutions.in,https://crm.sdgsolutions.in,http://www.crm.sdgsolutions.in,https://www.crm.sdgsolutions.in
echo.
echo # Frontend URL
echo FRONTEND_URL=http://crm.sdgsolutions.in
echo.
echo # Cookie Domain (for HTTP production)
echo COOKIE_DOMAIN=crm.sdgsolutions.in
echo.
echo # Database Configuration - UPDATE THESE VALUES
echo DATABASE_URL=postgresql://username:password@localhost:5432/hr_crm
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=hr_crm
echo DB_USER=your_db_user
echo DB_PASSWORD=your_db_password
echo.
echo # Security
echo BCRYPT_ROUNDS=12
echo SESSION_SECRET=another-secret-key-for-sessions
echo.
echo # Application Configuration
echo APP_NAME=SD HR CRM
echo APP_URL=http://crm.sdgsolutions.in
) > .env

echo ✅ .env file created for HTTP production!
echo.

echo Step 2: Key changes made:
echo.
echo ✅ HTTPS_ONLY=false (allows HTTP cookies)
echo ✅ CORS_ORIGINS includes your HTTP domain
echo ✅ Cookie settings configured for HTTP
echo ✅ JWT_SECRET set for authentication
echo.

echo Step 3: IMPORTANT - Update database credentials:
echo.
echo Edit .env file and update:
echo - DATABASE_URL
echo - DB_USER  
echo - DB_PASSWORD
echo.

echo Step 4: Deploy and restart backend:
echo.
echo 1. Copy files to your server
echo 2. Run: npm install
echo 3. Run: npm restart
echo 4. Clear browser cookies
echo 5. Test login at: http://crm.sdgsolutions.in
echo.

echo ========================================
echo HTTP PRODUCTION FIX COMPLETE!
echo ========================================
echo.
echo Your authentication should now work on HTTP domain!
echo.
pause
