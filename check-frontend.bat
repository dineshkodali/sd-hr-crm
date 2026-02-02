@echo off
echo ========================================
echo CHECKING FRONTEND BUILD
echo ========================================
echo.

echo Checking if frontend/dist exists...
if exist "frontend\dist" (
    echo ✅ Frontend build directory found!
    echo.
    echo Contents of frontend\dist:
    dir frontend\dist
    echo.
    echo Checking if index.html exists...
    if exist "frontend\dist\index.html" (
        echo ✅ index.html found - Frontend build is complete!
    ) else (
        echo ❌ index.html not found - Build may be incomplete
    )
) else (
    echo ❌ Frontend build directory not found!
    echo.
    echo You need to build the frontend first:
    echo.
    echo Step 1: cd frontend
    echo Step 2: npm install
    echo Step 3: npm run build
    echo.
    echo Or run: BUILD-FRONTEND.bat
)

echo.
pause
