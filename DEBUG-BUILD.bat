@echo off
echo ========================================
echo DEBUGGING FRONTEND BUILD ISSUE
echo ========================================
echo.

echo Step 1: Check current directory...
echo Current directory: %CD%
echo.

echo Step 2: Check if frontend folder exists...
if exist "frontend" (
    echo ✅ Frontend folder found
    cd frontend
    echo Changed to: %CD%
) else (
    echo ❌ Frontend folder not found!
    echo Creating frontend folder...
    mkdir frontend
    echo Please ensure your frontend code is in the frontend folder
    pause
    exit /b 1
)

echo.
echo Step 3: Check if package.json exists...
if exist "package.json" (
    echo ✅ package.json found
) else (
    echo ❌ package.json not found!
    echo Please ensure you're in the correct frontend directory
    echo Current directory contents:
    dir
    pause
    exit /b 1
)

echo.
echo Step 4: Check Node.js version...
node --version
npm --version

echo.
echo Step 5: Check if node_modules exists...
if exist "node_modules" (
    echo ✅ node_modules found
) else (
    echo ❌ node_modules not found
    echo Installing dependencies...
    call npm install
)

echo.
echo Step 6: Check Vite configuration...
if exist "vite.config.js" (
    echo ✅ vite.config.js found
) else (
    echo ❌ vite.config.js not found!
    echo Creating basic vite.config.js...
    echo import { defineConfig } from 'vite' > vite.config.js
    echo import react from '@vitejs/plugin-react' >> vite.config.js
    echo. >> vite.config.js
    echo export default defineConfig({ >> vite.config.js
    echo   plugins: [react()], >> vite.config.js
    echo   build: { >> vite.config.js
    echo     outDir: 'dist' >> vite.config.js
    echo   } >> vite.config.js
    echo }) >> vite.config.js
)

echo.
echo Step 7: Attempt build with verbose output...
echo Running: npm run build
call npm run build

echo.
echo Step 8: Check if dist was created...
if exist "dist" (
    echo ✅ dist folder created!
    echo Contents:
    dir dist
) else (
    echo ❌ dist folder still not created!
    echo.
    echo Checking for any build output files...
    dir *.html
    dir *.js
    dir *.css
    echo.
    echo Trying alternative build command...
    call npx vite build
)

echo.
echo Step 9: Final check...
if exist "dist\index.html" (
    echo ✅ SUCCESS! Frontend build completed
) else (
    echo ❌ Build still failed
    echo.
    echo Please check:
    echo 1. Node.js version (should be 16+)
    echo 2. All dependencies installed
    echo 3. No syntax errors in code
    echo 4. Sufficient disk space
)

cd ..
pause
