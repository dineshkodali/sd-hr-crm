@echo off
echo ========================================
echo QUICK PRODUCTION AUTHENTICATION FIX
echo ========================================
echo.

echo Step 1: Creating .env file with production settings...
echo.

(
echo # Production Environment Variables
echo NODE_ENV=production
echo.
echo # JWT Configuration - CRITICAL!
echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
echo.
echo # CORS Configuration - Add your domain^(s^)
echo CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
echo.
echo # Frontend URL
echo FRONTEND_URL=https://yourdomain.com
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

echo ✅ .env file created successfully!
echo.

echo Step 2: IMPORTANT - Update these values in .env:
echo.
echo 1. JWT_SECRET - Change to a secure random string ^(min 32 characters^)
echo 2. CORS_ORIGINS - Replace "yourdomain.com" with your actual domain
echo 3. DATABASE_URL - Update with your actual database credentials
echo.
echo Step 3: Restart your backend server after updating .env
echo.

echo ========================================
echo NEXT STEPS:
echo ========================================
echo.
echo 1. Edit .env file and update the values above
echo 2. Restart your backend server
echo 3. Clear browser cookies for your domain
echo 4. Test login functionality
echo.
echo Common issues and fixes:
echo - If still getting 401 errors: Check JWT_SECRET is set
echo - If CORS errors: Update CORS_ORIGINS with correct domain
echo - If cookie issues: Ensure HTTPS is enabled in production
echo.
pause
