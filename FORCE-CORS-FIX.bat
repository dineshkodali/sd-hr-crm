@echo off
echo ========================================
echo FORCING CORS UPDATE
echo ========================================
echo.

echo Step 1: Force update environment variable...
echo Stopping backend completely...
docker-compose stop backend

echo.
echo Step 2: Remove backend container to force recreation...
docker-compose rm -f backend

echo.
echo Step 3: Start backend with new environment...
docker-compose up -d backend

echo.
echo Step 4: Wait for backend to fully start...
timeout /t 15

echo.
echo Step 5: Check if CORS is now allowing all origins...
echo Testing auth endpoint...
curl -s http://localhost:4000/api/auth-health

echo.
echo Step 6: Check backend logs for CORS messages...
docker logs crm-backend --tail 10

echo.
echo ========================================
echo CORS UPDATE COMPLETE!
echo ========================================
echo.

echo Now test your application:
echo 1. Clear browser cache (Ctrl+Shift+Delete)
echo 2. Go to: http://crm.sdgsolutions.in
echo 3. Try login: admin@sdcrm.com / admin123
echo.

echo If you see "CORS: Allowing all origins" in logs above, CORS is fixed!
echo.

pause
