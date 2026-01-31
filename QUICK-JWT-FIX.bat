@echo off
echo ========================================
echo QUICK JWT SECRET FIX
echo ========================================
echo.

echo Setting JWT_SECRET environment variable...
set JWT_SECRET=super-secure-jwt-secret-key-for-production-32-chars-minimum

echo JWT_SECRET set to: %JWT_SECRET%
echo.

echo Now restart your backend server:
echo.
echo Option 1: npm restart
echo Option 2: pm2 restart app  
echo Option 3: systemctl restart your-app
echo.

echo After restarting, clear browser cookies and test login.
echo.
pause
