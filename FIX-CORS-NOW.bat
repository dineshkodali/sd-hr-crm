@echo off
echo ========================================
echo FIXING CORS ISSUES NOW
echo ========================================
echo.

echo Step 1: Updated CORS configuration...
echo ✅ Set CORS_ORIGINS=* in docker-compose.yml
echo ✅ Updated server.js to handle wildcard CORS

echo.
echo Step 2: Restart backend with new CORS settings...
docker-compose restart backend

echo.
echo Step 3: Wait for backend to restart...
timeout /t 10

echo.
echo Step 4: Check backend logs for CORS messages...
docker logs crm-backend --tail 15

echo.
echo Step 5: Test API endpoints...
echo Testing health endpoint...
curl -s http://localhost:4000/api/health

echo.
echo Testing auth endpoint...
curl -s http://localhost:4000/api/auth-health

echo.
echo Step 6: Check container status...
docker-compose ps

echo.
echo ========================================
echo CORS FIX APPLIED!
echo ========================================
echo.

echo ✅ CORS now allows all origins temporarily
echo ✅ Backend restarted with new settings
echo ✅ Should work on both localhost and crm.sdgsolutions.in
echo.

echo 🌐 Test your application:
echo - Localhost: http://localhost:3002
echo - Domain: http://crm.sdgsolutions.in
echo.

echo 🔍 If still CORS errors:
echo 1. Check browser console for exact error
echo 2. Check backend logs above for blocked origins
echo 3. Clear browser cache (Ctrl+Shift+Delete)
echo.

echo ⚠️  SECURITY NOTE:
echo CORS_ORIGINS=* allows all origins.
echo For production, set specific domains:
echo CORS_ORIGINS=https://crm.sdgsolutions.in,http://crm.sdgsolutions.in
echo.

pause
