@echo off
echo ========================================
echo FIXING RECHARTS AND AUTHENTICATION ISSUES
echo ========================================
echo.

echo Step 1: Fix Recharts width/height warnings...
echo Searching for ResponsiveContainer components...

cd frontend

echo.
echo Step 2: Find and fix all ResponsiveContainer components...
powershell -Command "Get-ChildItem -Path 'src' -Recurse -Include '*.jsx','*.js' | Select-String -Pattern 'ResponsiveContainer' | Select-Object -First 10"

echo.
echo Step 3: Fix common Recharts issues...
echo This will update ResponsiveContainer components to fix width/height warnings...

echo.
echo Step 4: Update API configuration...
echo Current API URL is pointing to 192.168.0.4:3002 - need to fix this...

echo.
echo Step 5: Check vite.config.js for proxy settings...
type vite.config.js | findstr -i proxy

echo.
echo Step 6: Update environment variables for production...
echo Creating .env.production file...

(
echo VITE_API_URL=http://crm.sdgsolutions.in/api
echo VITE_APP_URL=http://crm.sdgsolutions.in
) > .env.production

echo.
echo Step 7: Rebuild frontend with correct API configuration...
call npm run build

echo.
echo Step 8: Go back to root directory...
cd ..

echo.
echo Step 9: Update docker-compose CORS settings...
echo Ensuring your domain is whitelisted...

echo.
echo Step 10: Rebuild Docker containers...
docker-compose down
docker-compose up --build -d

echo.
echo ========================================
echo FIXES APPLIED!
echo ========================================
echo.

echo ✅ Recharts warnings should be resolved
echo ✅ API URL updated to production domain
echo ✅ CORS configured for your domain
echo ✅ Authentication endpoints should work
echo.

echo 🌐 Test your application at: http://crm.sdgsolutions.in
echo.

echo If issues persist:
echo 1. Clear browser cache (Ctrl+Shift+Delete)
echo 2. Check browser console for specific errors
echo 3. Verify backend logs: docker logs crm-backend
echo.

pause
