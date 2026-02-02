@echo off
echo ========================================
echo TESTING DOMAIN: crm.sdgsolutions.in
echo ========================================
echo.

echo Step 1: Check if domain is accessible...
echo Testing domain connectivity...
ping -n 1 crm.sdgsolutions.in

echo.
echo Step 2: Check HTTP response...
curl -I http://crm.sdgsolutions.in

echo.
echo Step 3: Check current CORS configuration...
echo Current CORS_ORIGINS in docker-compose.yml:
powershell -Command "Select-String -Path 'docker-compose.yml' -Pattern 'CORS_ORIGINS'"

echo.
echo Step 4: Check backend auth-health endpoint...
curl -s http://crm.sdgsolutions.in/api/auth-health

echo.
echo ========================================
echo DOMAIN TESTING INSTRUCTIONS
echo ========================================
echo.

echo 🌐 To test on crm.sdgsolutions.in:
echo.
echo 1. Open browser and go to: http://crm.sdgsolutions.in
echo.
echo 2. Login with:
echo    Email: admin@sdcrm.com
echo    Password: admin123
echo.
echo 3. Check browser console (F12) for:
echo    ✅ No CORS errors
echo    ✅ API calls to http://crm.sdgsolutions.in/api/*
echo    ✅ Successful login response
echo.
echo 4. After login, verify:
echo    ✅ Dashboard loads with real data
echo    ✅ Charts render without warnings
echo    ✅ All features work properly
echo.

echo 🔍 If you see CORS errors:
echo The domain might not be properly configured in CORS.
echo Let me check and fix this if needed.
echo.

pause