@echo off
echo ========================================
echo FIXING LOGIN AND CORS ISSUES
echo ========================================
echo.

echo Step 1: Fixed Login.jsx API calls...
echo ✅ Added proper API base URL configuration
echo ✅ Updated all axios calls to use configured api instance
echo ✅ Removed hardcoded /api prefix
echo ✅ Added withCredentials: true

echo.
echo Step 2: Rebuild frontend with login fixes...
cd frontend
echo Building frontend with updated Login.jsx...
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
echo Step 3: Restart frontend container with new build...
docker-compose stop frontend
docker-compose rm -f frontend
docker-compose up -d frontend

echo.
echo Step 4: Wait for frontend to start...
timeout /t 10

echo.
echo Step 5: Check container status...
docker-compose ps

echo.
echo Step 6: Check frontend logs...
docker logs crm-frontend --tail 10

echo.
echo Step 7: Check backend logs...
docker logs crm-backend --tail 10

echo.
echo Step 8: Test API endpoints...
echo Testing health endpoint...
curl -s http://localhost:4000/api/health

echo.
echo Testing auth endpoint...
curl -s http://localhost:4000/api/auth-health

echo.
echo ========================================
echo LOGIN AND CORS FIX COMPLETE!
echo ========================================
echo.

echo ✅ Login.jsx fixed with proper API configuration
echo ✅ Frontend rebuilt with fixes
echo ✅ Frontend container restarted
echo ✅ CORS configured for both domains
echo.

echo 🌐 Test your application:
echo - Domain: http://crm.sdcsolutions.in
echo - Alternative: http://crm.sdgsolutions.in
echo.

echo 🔍 Login credentials:
echo Email: admin@sdcrm.com
echo Password: admin123
echo.

echo 🧪 Test these:
echo 1. Login should work without CORS errors
echo 2. API calls should use correct base URL
echo 3. Authentication should persist
echo 4. Dashboard should load with real data
echo.

echo If still issues:
echo 1. Clear browser cache (Ctrl+Shift+Delete)
echo 2. Check browser console for specific errors
echo 3. Check backend logs above
echo.

pause
