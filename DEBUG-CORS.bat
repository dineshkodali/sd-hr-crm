@echo off
echo ========================================
echo DEBUGGING CORS ISSUES
echo ========================================
echo.

echo Step 1: Check current CORS configuration in docker-compose.yml...
echo.
echo Current CORS_ORIGINS setting:
powershell -Command "Select-String -Path 'docker-compose.yml' -Pattern 'CORS_ORIGINS'"

echo.
echo Step 2: Check backend CORS configuration in server.js...
echo.
echo Looking for CORS configuration...
powershell -Command "Select-String -Path 'Backend\server.js' -Pattern 'cors|CORS' -A 5 -B 2"

echo.
echo Step 3: Test what domain is being sent...
echo.
echo Testing your domain access...
curl -I http://crm.sdgsolutions.in

echo.
echo Testing localhost access...
curl -I http://localhost:3002

echo.
echo Step 4: Check backend logs for CORS errors...
docker logs crm-backend --tail 20

echo.
echo Step 5: Test API endpoints directly...
echo Testing health endpoint...
curl -s http://localhost:4000/api/health

echo.
echo Testing auth health endpoint...
curl -s http://localhost:4000/api/auth-health

echo.
echo ========================================
echo CORS FIX SOLUTIONS
echo ========================================
echo.

echo Issue: CORS origins not matching exactly
echo.
echo Solution 1: Update docker-compose.yml to allow all origins temporarily
echo.
echo Solution 2: Fix exact domain matching
echo.
echo Solution 3: Check if domain has www prefix or different port
echo.

echo Current domain you're accessing: crm.sdgsolutions.in
echo Make sure this matches exactly in CORS_ORIGINS
echo.

pause
