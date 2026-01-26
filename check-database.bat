@echo off
echo Checking database data...
echo.

echo Step 1: Check if containers are running...
docker-compose ps

echo.
echo Step 2: Check database tables...
docker exec crm-db psql -U postgres -d hr_crm -c "\dt"

echo.
echo Step 3: Check users table...
docker exec crm-db psql -U postgres -d hr_crm -c "SELECT COUNT(*) as user_count FROM users;"

echo.
echo Step 4: Check hotels table...
docker exec crm-db psql -U postgres -d hr_crm -c "SELECT COUNT(*) as hotel_count FROM hotels;"

echo.
echo Step 5: Check rooms table...
docker exec crm-db psql -U postgres -d hr_crm -c "SELECT COUNT(*) as room_count FROM rooms;"

echo.
echo Step 6: Check branches table...
docker exec crm-db psql -U postgres -d hr_crm -c "SELECT COUNT(*) as branch_count FROM branches;"

echo.
echo Step 7: Show sample data...
docker exec crm-db psql -U postgres -d hr_crm -c "SELECT id, name, email, role FROM users LIMIT 3;"

echo.
echo ========================================
echo Database check complete!
echo ========================================
echo.
pause
