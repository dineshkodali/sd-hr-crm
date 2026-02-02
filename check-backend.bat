@echo off
echo ========================================
echo CHECKING BACKEND AND DATABASE STATUS
echo ========================================
echo.

echo Step 1: Check Docker containers...
docker ps --filter "name=crm"

echo.
echo Step 2: Check backend container specifically...
docker inspect crm-backend --format "Status: {{.State.Status}}"

echo.
echo Step 3: Check backend logs (last 20 lines)...
docker logs --tail 20 crm-backend

echo.
echo Step 4: Test backend health endpoint...
curl -s http://localhost:4000/api/health || echo Backend not responding

echo.
echo Step 5: Test authentication health...
curl -s http://localhost:4000/api/auth-health || echo Auth endpoint not responding

echo.
echo Step 6: Check if backend is accessible from browser...
echo Try opening: http://localhost:4000/api/health
echo.

echo ========================================
echo DATABASE CONFIGURATION CHECK
echo ========================================
echo.

echo Checking Backend/.env file...
if exist "Backend\.env" (
    echo ✅ Backend/.env found
    echo Database configuration:
    type Backend\.env | findstr DATABASE_URL
    type Backend\.env | findstr DB_
) else (
    echo ❌ Backend/.env not found
    echo Checking main .env file...
    if exist ".env" (
        echo ✅ Main .env found
        type .env | findstr DATABASE_URL
        type .env | findstr DB_
    ) else (
        echo ❌ No .env files found
    )
)

echo.
echo ========================================
echo TROUBLESHOOTING
echo ========================================
echo.
echo If backend is not responding:
echo 1. Check database connection in .env
echo 2. Verify remote database is accessible
echo 3. Check if backend has all dependencies
echo 4. Restart containers: docker-compose restart
echo.

pause
