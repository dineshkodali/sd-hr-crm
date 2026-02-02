@echo off
echo ========================================
echo DOCKER PRODUCTION FIX
echo ========================================
echo.

echo Step 1: Stop all containers...
docker-compose down

echo.
echo Step 2: Build frontend first...
cd frontend
echo Building frontend...
npm install
npm run build
cd ..

echo.
echo Step 3: Rebuild and start all containers...
echo This will rebuild with the latest frontend...
docker-compose up --build

echo.
echo ========================================
echo DOCKER FIX COMPLETE!
echo ========================================
echo.

echo Your application should now be available at:
echo http://crm.sdgsolutions.in
echo.

echo To check logs:
echo docker-compose logs -f
echo.

pause
