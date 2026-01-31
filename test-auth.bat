@echo off
echo ========================================
echo TESTING AUTHENTICATION FIX
echo ========================================
echo.

echo Step 1: Check server health...
curl -s http://localhost:4000/api/health

echo.
echo Step 2: Check authentication configuration...
curl -s http://localhost:4000/api/auth-health

echo.
echo Step 3: Test login endpoint...
curl -s -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@sdcrm.com\",\"password\":\"admin123\"}"

echo.
echo Step 4: Test protected endpoint (should work after login)...
curl -s http://localhost:4000/api/auth/me

echo.
echo ========================================
echo If you see 200 OK responses, authentication is working!
echo ========================================
echo.
echo If you see errors:
echo 1. Make sure your .env file has JWT_SECRET set
echo 2. Restart your backend server
echo 3. Check server logs for warnings
echo.
pause
