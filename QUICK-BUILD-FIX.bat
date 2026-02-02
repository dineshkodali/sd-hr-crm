@echo off
echo ========================================
echo QUICK FRONTEND BUILD FIX
echo ========================================
echo.

echo Current directory: %CD%
echo.

echo Step 1: Go to frontend folder...
cd frontend
echo Now in: %CD%
echo.

echo Step 2: Check if we're in the right place...
if exist "package.json" (
    echo ✅ package.json found - We're in the right place!
) else (
    echo ❌ package.json not found - Wrong directory!
    echo Going back to check...
    cd ..
    dir
    pause
    exit /b 1
)

echo.
echo Step 3: Install dependencies...
call npm install

echo.
echo Step 4: Build the frontend...
call npm run build

echo.
echo Step 5: Check results...
if exist "dist" (
    echo ✅ SUCCESS! dist folder created!
    echo.
    echo Contents:
    dir dist
    echo.
    if exist "dist\index.html" (
        echo ✅ index.html found - Build complete!
    ) else (
        echo ❌ index.html not found
    )
) else (
    echo ❌ dist folder not created
    echo.
    echo Trying direct vite build...
    call npx vite build
)

echo.
echo Step 6: Go back to root...
cd ..

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
pause
