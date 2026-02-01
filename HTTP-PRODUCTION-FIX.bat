@echo off
echo ========================================
echo HTTP PRODUCTION AUTHENTICATION FIX
echo ========================================
echo.

echo 🔧 Fixing authentication for: http://crm.sdgsolutions.in
echo.

echo Step 1: Update .env for HTTP production...
powershell -Command "(Get-Content '.env') -replace 'HTTPS_ONLY=true', 'HTTPS_ONLY=false' | Set-Content '.env'"
powershell -Command "(Get-Content '.env') -replace 'CORS_ORIGINS=.*', 'CORS_ORIGINS=http://crm.sdgsolutions.in,https://crm.sdgsolutions.in,http://www.crm.sdgsolutions.in,https://www.crm.sdgsolutions.in' | Set-Content '.env'"
powershell -Command "(Get-Content '.env') -replace 'COOKIE_DOMAIN=.*', 'COOKIE_DOMAIN=crm.sdgsolutions.in' | Set-Content '.env'"
powershell -Command "(Get-Content '.env') -replace 'FRONTEND_URL=.*', 'FRONTEND_URL=http://crm.sdgsolutions.in' | Set-Content '.env'"

echo ✅ .env updated for HTTP production
echo.

echo Step 2: Fix admin user in database...
echo.
echo Run this SQL command in your database:
echo.
echo ========================================
echo COPY AND PASTE THIS SQL:
echo ========================================
type fix-admin-user.sql
echo ========================================
echo.

echo Step 3: Restart backend server...
echo.
echo Choose your restart method:
echo 1. npm restart
echo 2. pm2 restart app
echo 3. systemctl restart your-app
echo 4. docker-compose restart backend
echo.

echo Step 4: Clear browser cookies...
echo.
echo 1. Open browser
echo 2. Press Ctrl+Shift+Delete
echo 3. Clear cookies for crm.sdgsolutions.in
echo 4. Refresh page with Ctrl+F5
echo.

echo Step 5: Test login...
echo.
echo URL: http://crm.sdgsolutions.in
echo Email: admin@sdcrm.com
echo Password: admin123
echo.

echo ========================================
echo COMMON ISSUES FIXED:
echo ========================================
echo.
echo ✅ 401 Unauthorized - JWT_SECRET fallback
echo ✅ 403 Forbidden - Admin user activation
echo ✅ Cookie issues - HTTP production settings
echo ✅ CORS issues - Domain whitelist
echo ✅ Environment variables - Production config
echo.

echo ========================================
echo IF STILL NOT WORKING:
echo ========================================
echo.
echo 1. Check server logs for errors
echo 2. Verify database connection
echo 3. Test with: curl http://your-domain/api/auth-health
echo 4. Check if admin user exists in database
echo.

pause
