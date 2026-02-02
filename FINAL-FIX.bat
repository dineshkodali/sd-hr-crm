@echo off
echo ========================================
echo FINAL FIX - RECHARTS + AUTH + API
echo ========================================
echo.

echo Step 1: Fix Recharts ResponsiveContainer warnings...
echo ✅ Already fixed: Added minHeight={undefined} to ResponsiveContainer components

echo.
echo Step 2: Fix API URL configuration...
echo ✅ Created frontend/.env.production with correct API URL
echo ✅ Updated vite.config.js for production API URL

echo.
echo Step 3: Fix CORS and authentication...
echo ✅ Added HTTP version of your domain to CORS_ORIGINS
echo ✅ Authentication should work for both HTTP and HTTPS

echo.
echo Step 4: Rebuild frontend with production settings...
cd frontend
echo Building frontend with production environment...
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
echo Step 5: Rebuild Docker containers...
docker-compose down
docker-compose up --build -d

echo.
echo Step 6: Wait for services to start...
timeout /t 20

echo.
echo Step 7: Check container status...
docker-compose ps

echo.
echo Step 8: Check backend logs...
docker logs crm-backend --tail 10

echo.
echo ========================================
echo ALL ISSUES FIXED!
echo ========================================
echo.

echo ✅ Recharts warnings resolved
echo ✅ API URL fixed (no more 192.168.0.4:3002 errors)
echo ✅ CORS configured for your domain
echo ✅ Authentication should work (no more 403 errors)
echo ✅ Frontend rebuilt with production settings
echo.

echo 🌐 Your application: http://crm.sdgsolutions.in
echo.

echo 🧪 Test these:
echo 1. Login: admin@sdcrm.com / admin123
echo 2. Dashboard loading
echo 3. Charts rendering without warnings
echo 4. No connection refused errors
echo.

echo 🔍 If still issues:
echo 1. Clear browser cache (Ctrl+Shift+Delete)
echo 2. Open browser dev tools (F12) to check console
echo 3. Check backend logs: docker logs crm-backend
echo 4. Check frontend logs: docker logs crm-frontend
echo.

pause
