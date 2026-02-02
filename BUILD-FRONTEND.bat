@echo off
echo ========================================
echo BUILDING FRONTEND FOR PRODUCTION
echo ========================================
echo.

echo Step 1: Navigate to frontend directory...
cd frontend

echo Step 2: Install dependencies...
echo Running: npm install
npm install

echo.
echo Step 3: Build frontend for production...
echo Running: npm run build
npm run build

echo.
echo Step 4: Check if build was successful...
if exist "dist" (
    echo ✅ Frontend build successful!
    echo 📁 Build files created in: frontend\dist
    dir dist
) else (
    echo ❌ Frontend build failed!
    echo Please check the error messages above.
)

echo.
echo Step 5: Return to root directory...
cd ..

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.

echo Now restart your Docker containers:
echo docker-compose down
echo docker-compose up --build
echo.

echo Or restart the backend server:
echo npm restart
echo.

pause
