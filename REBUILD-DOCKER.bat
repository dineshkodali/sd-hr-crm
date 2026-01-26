@echo off
echo Rebuilding Docker containers with latest fixes...
echo.

echo Step 1: Stop existing containers...
docker-compose down

echo.
echo Step 2: Remove old database volume (to reinitialize with new schema)...
docker volume rm sd-hr-crm-master_postgres_data 2>nul

echo.
echo Step 3: Build and start containers with latest changes...
docker-compose up --build -d

echo.
echo Step 4: Wait for services to be ready...
timeout /t 30 /nobreak >nul

echo.
echo Step 5: Check container status...
docker-compose ps

echo.
echo Step 6: Show backend logs...
docker-compose logs backend --tail=20

echo.
echo ========================================
echo Docker rebuild complete!
echo Frontend: http://localhost:3002
echo Backend: http://localhost:4000
echo ========================================
echo.
echo Login with: admin@sdcrm.com / admin123
echo.
pause
