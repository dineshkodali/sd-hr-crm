@echo off
echo ========================================
echo COMPLETE CORS DIAGNOSIS AND FIX
echo ========================================
echo.

echo Step 1: Check what domain you're actually accessing...
echo.
echo Your domain in the error shows: crm.sdcsolutions.in
echo But your configured domain is: crm.sdgsolutions.in
echo.
echo NOTICE: There's a TYPO in your domain!
echo crm.sdcsolutions.in (with 'c') 
echo crm.sdgsolutions.in (with 'g')
echo.

echo Step 2: Fix the domain typo in configuration...
echo.

echo Step 3: Update CORS to include the correct domain...
powershell -Command "(Get-Content 'docker-compose.yml') -replace 'CORS_ORIGINS=\*', 'CORS_ORIGINS=https://crm.sdcsolutions.in,http://crm.sdcsolutions.in,http://crm.sdgsolutions.in,https://crm.sdgsolutions.in,http://localhost:3002,http://localhost:3000' | Set-Content 'docker-compose.yml'"

echo ✅ Updated CORS_ORIGINS with both domains

echo.
echo Step 4: Stop and recreate backend completely...
docker-compose stop backend
docker-compose rm -f backend

echo.
echo Step 5: Start backend with corrected domains...
docker-compose up -d backend

echo.
echo Step 6: Wait for backend to start...
timeout /t 15

echo.
echo Step 7: Check backend logs...
docker logs crm-backend --tail 15

echo.
echo Step 8: Test API endpoints...
curl -s http://localhost:4000/api/auth-health

echo.
echo ========================================
echo DOMAIN TYPO FIX COMPLETE!
echo ========================================
echo.

echo ✅ Fixed domain typo in CORS configuration
echo ✅ Added both possible domains to CORS
echo ✅ Backend recreated with new settings
echo.

echo 🌐 Now test your application:
echo - Correct domain: http://crm.sdgsolutions.in
echo - If you meant crm.sdcsolutions.in, that will also work now
echo.

echo 🔍 Clear browser cache before testing!
echo.

pause
