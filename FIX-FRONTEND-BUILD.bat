@echo off
echo ========================================
echo FIXING FRONTEND BUILD ISSUE
echo ========================================
echo.

echo Issue: Backend shows "Frontend build not found at /frontend/dist"
echo But domain is working, meaning Nginx is serving old frontend files
echo.

echo Step 1: Check current frontend build status...
if exist "frontend\dist\index.html" (
    echo ✅ Frontend dist folder exists
    echo Size of dist folder:
    dir "frontend\dist" | find "bytes"
) else (
    echo ❌ Frontend dist folder missing
    echo Need to rebuild frontend
)

echo.
echo Step 2: Force rebuild frontend with latest changes...
cd frontend
echo Cleaning previous build...
if exist "dist" rmdir /s /q "dist"

echo Building frontend with latest Login.jsx fixes...
call npm run build

if exist "dist\index.html" (
    echo ✅ Frontend build successful!
    echo Build files created:
    dir "dist\*.*" /b
) else (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
)

cd ..

echo.
echo Step 3: Restart frontend container to pick up new build...
docker-compose stop frontend
docker-compose rm -f frontend
docker-compose up -d frontend

echo.
echo Step 4: Wait for frontend to start...
timeout /t 15

echo.
echo Step 5: Check container status...
docker-compose ps

echo.
echo Step 6: Check if backend now sees the frontend build...
echo Checking backend logs...
docker logs crm-backend --tail 5

echo.
echo Step 7: Test the application...
echo Testing health endpoint...
curl -s http://crm.sdgsolutions.in/api/health

echo.
echo ========================================
echo FRONTEND BUILD FIX COMPLETE!
echo ========================================
echo.

echo ✅ Frontend rebuilt with latest fixes
echo ✅ Frontend container restarted
echo ✅ Should now serve latest version
echo.

echo 🌐 Test your application:
echo URL: http://crm.sdgsolutions.in
echo.

echo 🔍 What should happen now:
echo 1. Backend should NOT show "Frontend build not found" warning
echo 2. Latest Login.jsx with dynamic API_BASE should be served
echo 3. No CORS errors when accessing from domain
echo 4. All features should work properly
echo.

echo 📋 If still issues:
echo 1. Clear browser cache (Ctrl+Shift+Delete)
echo 2. Check browser console for specific errors
echo 3. Verify Nginx is proxying to Docker container
echo.

pause
