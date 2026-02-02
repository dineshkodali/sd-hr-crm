@echo off
echo ========================================
echo REBUILDING DOCKER WITH DATABASE
echo ========================================
echo.

echo Step 1: Stop all containers...
docker-compose down

echo.
echo Step 2: Remove old volumes (optional - will delete data)...
echo Press Y to delete data, N to keep existing data:
choice /c YN /n /m "Delete existing database data? (Y/N): "
if errorlevel 2 goto keep_data
if errorlevel 1 goto delete_data

:delete_data
echo Removing old database volume...
docker volume rm sd-hr-crm-master_postgres_data
goto rebuild

:keep_data
echo Keeping existing database data...

:rebuild
echo.
echo Step 3: Rebuild and start all containers with database...
docker-compose up --build -d

echo.
echo Step 4: Wait for database to initialize...
echo This may take 1-2 minutes...
timeout /t 30

echo.
echo Step 5: Check container status...
docker-compose ps

echo.
echo Step 6: Check database logs...
docker logs crm-db --tail 10

echo.
echo Step 7: Check backend logs...
docker logs crm-backend --tail 10

echo.
echo Step 8: Initialize database with schema...
echo The database will be created automatically with basic tables.
echo For full schema, run: docker exec crm-db psql -U postgres -d hr_crm -f /docker-entrypoint-initdb.d/init.sql

echo.
echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.

echo 🌐 Your application should be available at:
echo http://crm.sdgsolutions.in
echo.

echo 🗄️  Database connection:
echo Host: localhost:5432
echo Database: hr_crm
echo User: postgres
echo Password: password
echo.

echo 📋 To check status:
echo docker-compose ps
echo.

echo 📋 To view logs:
echo docker-compose logs -f
echo.

echo 📋 To access database directly:
echo docker exec -it crm-db psql -U postgres -d hr_crm
echo.

pause
