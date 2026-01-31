@echo off
echo ========================================
echo URGENT: 401 AUTHENTICATION FIX
echo ========================================
echo.

echo Step 1: Create .env file with production settings...
echo.

(
echo # Production Environment Variables
echo NODE_ENV=production
echo.
echo # JWT Configuration - CRITICAL!
echo JWT_SECRET=super-secure-jwt-secret-key-for-production-32-chars-minimum
echo.
echo # CORS Configuration - Replace with your actual domain
echo CORS_ORIGINS=https://yourdomain.com
echo.
echo # Database Configuration
echo DATABASE_URL=postgresql://username:password@localhost:5432/hr_crm
echo.
echo # Security
echo BCRYPT_ROUNDS=12
echo SESSION_SECRET=another-secret-key-for-sessions
echo.
echo # Logging
echo ACTIVITY_LOGS_ENABLED=true
) > .env

echo ✅ .env file created!
echo.

echo Step 2: IMPORTANT - Update these values in .env:
echo.
echo 1. JWT_SECRET - Change to a secure random string ^(min 32 characters^)
echo 2. CORS_ORIGINS - Replace "https://yourdomain.com" with your actual domain
echo 3. DATABASE_URL - Update with your database credentials
echo.

echo Step 3: Most Common Fix - Set JWT_SECRET
echo.
echo The #1 cause of 401 errors is missing JWT_SECRET
echo Run this command to set it:
echo.
echo set JWT_SECRET=your-secure-random-32-character-string-here
echo.

echo Step 4: Restart your backend server:
echo.
echo - If using npm: npm restart
echo - If using PM2: pm2 restart app
echo - If using systemd: systemctl restart your-app
echo.

echo Step 5: Clear browser cookies and test:
echo.
echo 1. Open browser
echo 2. Press Ctrl+Shift+Delete
echo 3. Clear cookies for your domain
echo 4. Refresh page with Ctrl+F5
echo 5. Try logging in again
echo.

echo ========================================
echo MOST LIKELY FIX:
echo ========================================
echo.
echo 1. Set JWT_SECRET environment variable
echo 2. Restart backend server  
echo 3. Clear browser cookies
echo 4. Test login again
echo.
echo If still not working, check backend logs for:
echo - "JWT_SECRET is not set"
echo - "CORS blocked origin"
echo - "Auth: no token found"
echo.
pause
