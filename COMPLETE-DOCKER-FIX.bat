@echo off
echo ========================================
echo COMPLETE DOCKER PRODUCTION FIX
echo ========================================
echo.

echo 🔧 Fixing frontend build and Docker deployment...
echo.

echo Step 1: Clean up any existing containers and volumes...
docker-compose down -v
docker system prune -f

echo.
echo Step 2: Build frontend for production...
cd frontend
echo Installing frontend dependencies...
npm install

echo Building frontend...
npm run build

if not exist "dist" (
    echo ❌ Frontend build failed!
    echo Checking for errors...
    dir
    pause
    exit /b 1
)

echo ✅ Frontend build successful!
echo Build directory contents:
dir dist

cd ..

echo.
echo Step 3: Update .env for HTTP production...
echo Ensuring HTTPS_ONLY=false...
powershell -Command "(Get-Content '.env') -replace 'HTTPS_ONLY=true', 'HTTPS_ONLY=false' | Set-Content '.env' -Force"

echo.
echo Step 4: Build and start Docker containers...
echo This will take a few minutes...
docker-compose up --build -d

echo.
echo Step 5: Wait for containers to start...
timeout /t 30

echo.
echo Step 6: Check container status...
docker-compose ps

echo.
echo Step 7: Check logs for any errors...
docker-compose logs --tail=20

echo.
echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.

echo 🌐 Your application should be available at:
echo http://crm.sdgsolutions.in
echo.

echo 🔍 To check status:
echo docker-compose ps
echo.

echo 📋 To view logs:
echo docker-compose logs -f
echo.

echo 🔄 To restart:
echo docker-compose restart
echo.

echo ⚠️  If you see errors:
echo 1. Check that port 4000 is not in use
echo 2. Verify database connection in .env
echo 3. Check frontend build completed successfully
echo.

pause
