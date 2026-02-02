@echo off
echo ========================================
echo BUILDING FRONTEND FOR WINDOWS
echo ========================================
echo.

echo Step 1: Navigate to frontend directory...
cd frontend

echo Step 2: Install dependencies...
echo Running: npm install
call npm install

echo.
echo Step 3: Build frontend for production...
echo Running: npm run build
call npm run build

echo.
echo Step 4: Check if build was successful...
if exist "dist" (
    echo ✅ Frontend build successful!
    echo 📁 Build files created in: frontend\dist
    echo.
    echo Build directory contents:
    dir dist
    echo.
    echo Checking for index.html...
    if exist "dist\index.html" (
        echo ✅ index.html found - Build complete!
    ) else (
        echo ❌ index.html not found
    )
) else (
    echo ❌ Frontend build failed!
    echo Please check the error messages above.
    echo.
    echo Common issues:
    echo - Missing dependencies
    echo - Node.js version compatibility
    echo - Disk space
)

echo.
echo Step 5: Return to root directory...
cd ..

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.

echo Next steps:
echo 1. Run: COMPLETE-DOCKER-FIX.bat
echo 2. Or restart Docker: docker-compose up --build
echo.

pause
