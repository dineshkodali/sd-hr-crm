@echo off
echo ========================================
echo SIMPLE FRONTEND BUILD TEST
echo ========================================
echo.

echo Checking Node.js and npm...
node --version
npm --version

echo.
echo Navigating to frontend folder...
cd frontend

echo.
echo Current directory: %CD%
echo.

echo Checking package.json...
if exist "package.json" (
    echo ✅ package.json found
    type package.json | findstr "build"
) else (
    echo ❌ package.json not found!
    echo Current folder contents:
    dir
    pause
    exit /b 1
)

echo.
echo Installing dependencies (this may take a few minutes)...
call npm install --verbose

echo.
echo Checking if vite is installed...
call npx vite --version

echo.
echo Attempting build...
call npx vite build --mode production

echo.
echo Checking results...
if exist "dist" (
    echo ✅ SUCCESS! dist folder created
    echo.
    echo Contents of dist folder:
    dir dist
    echo.
    echo Checking for index.html...
    if exist "dist\index.html" (
        echo ✅ index.html found!
        echo Build successful!
    ) else (
        echo ❌ index.html not found in dist
    )
) else (
    echo ❌ dist folder not created
    echo.
    echo Let's check what files exist...
    dir
    echo.
    echo Trying alternative approach...
    call npm run build
)

echo.
echo Returning to root directory...
cd ..

pause
