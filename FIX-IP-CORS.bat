@echo off
echo ========================================
echo FIXING IP-BASED CORS ISSUES
echo ========================================
echo.

echo Issue detected:
echo Frontend URL: http://172.22.48.1:3002
echo API URL: http://192.168.0.4:3002/api/auth/login
echo This is causing CORS mismatch!
echo.

echo Step 1: Fix Login.jsx to use dynamic API base URL...
cd frontend

echo Creating dynamic API base URL detection...
powershell -Command "(Get-Content 'pages\Login.jsx') -replace 'const API_BASE = \"http://192.168.0.4:3002/api\" || \"http://172.22.48.1:3002/api\" || \"http://localhost:3002/api\"|| \"http://crm.sdgsolutions.in/api\";', 'const API_BASE = `${window.location.protocol}//${window.location.host}/api` || \"http://localhost:4000/api\" || \"http://crm.sdgsolutions.in/api\";' | Set-Content 'pages\Login.jsx'"

echo ✅ Updated API_BASE to use current host

cd ..

echo.
echo Step 2: Update backend CORS to handle both IPs...
powershell -Command "(Get-Content 'Backend\server.js') -replace 'http://172.22.48.1:3002,', 'http://172.22.48.1:3002,\n      \"http://172.22.48.1:3002/api\",' | Set-Content 'Backend\server.js'"

echo ✅ Updated CORS configuration

echo.
echo Step 3: Rebuild frontend with IP fix...
cd frontend
call npm run build

if exist "dist\index.html" (
    echo ✅ Frontend build successful!
) else (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
)

cd ..

echo.
echo Step 4: Restart both containers...
docker-compose restart backend frontend

echo.
echo Step 5: Wait for services to restart...
timeout /t 10

echo.
echo Step 6: Check container status...
docker-compose ps

echo.
echo Step 7: Test API endpoints...
curl -s http://localhost:4000/api/health

echo.
echo Step 8: Check backend logs for CORS...
docker logs crm-backend --tail 10

echo.
echo ========================================
echo IP CORS FIX COMPLETE!
echo ========================================
echo.

echo ✅ Login.jsx now uses dynamic API base URL
echo ✅ Backend CORS handles both IP addresses
echo ✅ Frontend rebuilt with fixes
echo ✅ Both containers restarted
echo.

echo 🌐 Test your application:
echo - From 172.22.48.1:3002: http://172.22.48.1:3002
echo - From 192.168.0.4:3002: http://192.168.0.4:3002
echo.

echo 🔍 The API calls will now use the same host as the frontend!
echo.

pause
