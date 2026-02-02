@echo off
echo ========================================
echo TESTING REMOTE DATABASE CONNECTION
echo ========================================
echo.

echo Database Configuration:
echo Host: 18.130.77.174
echo Port: 5432
echo Database: new_CRM
echo User: sdcommercial
echo.

echo Step 1: Test connection with psql if available...
where psql >nul 2>&1
if %errorlevel% == 0 (
    echo Testing with psql...
    psql "postgresql://sdcommercial:sdcommercial@18.130.77.174:5432/new_CRM" -c "SELECT version();"
    if %errorlevel% == 0 (
        echo ✅ Database connection successful!
    ) else (
        echo ❌ Database connection failed!
    )
) else (
    echo psql not found, will test through Docker backend...
)

echo.
echo Step 2: Rebuild backend with remote database...
docker-compose down
docker-compose up --build -d

echo.
echo Step 3: Wait for backend to start...
timeout /t 15

echo.
echo Step 4: Check backend logs for database connection...
docker logs crm-backend --tail 20

echo.
echo Step 5: Test backend health...
curl -s http://localhost:4000/api/health

echo.
echo Step 6: Test database through backend API...
curl -s http://localhost:4000/api/auth-health

echo.
echo ========================================
echo TROUBLESHOOTING
echo ========================================
echo.
echo If database connection fails:
echo 1. Check if remote database server is accessible
echo 2. Verify credentials (sdcommercial/sdcommercial)
echo 3. Check if database 'new_CRM' exists
echo 4. Check firewall rules on 18.130.77.174
echo 5. Verify PostgreSQL accepts remote connections
echo.

echo To manually test database connection:
echo docker exec -it crm-backend bash
echo Then: psql "postgresql://sdcommercial:sdcommercial@18.130.77.174:5432/new_CRM"
echo.

pause
