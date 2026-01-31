#!/bin/bash
# Quick deployment script for the 401 authentication fix

set -e

echo "=========================================="
echo "401 Authentication Fix - Deployment Script"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo ""
echo "Step 1: Building frontend..."
cd frontend
npm install
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Error: Frontend build failed"
    exit 1
fi

echo "✅ Frontend built successfully"
echo "   Build output: frontend/dist/"

echo ""
echo "Step 2: Backend Configuration Check"
cd ..

# Check if .env exists in Backend
if [ ! -f "Backend/.env" ]; then
    echo "⚠️  Warning: Backend/.env not found"
    echo "   Please copy production-env-template.env to Backend/.env"
    echo "   and update the values for your production environment"
else
    echo "✅ Backend/.env found"
fi

echo ""
echo "=========================================="
echo "✅ Fix Implementation Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Deploy frontend/dist to your web server:"
echo "   - Upload to your hosting provider (Vercel, Netlify, etc.)"
echo "   - Or copy to your NGINX/Apache public folder"
echo ""
echo "2. Ensure Backend Environment Variables are set:"
echo "   - NODE_ENV=production"
echo "   - JWT_SECRET=your-secret-key"
echo "   - CORS_ORIGINS=https://yourdomain.com"
echo ""
echo "3. Restart the backend server"
echo ""
echo "4. Clear browser cache/cookies and test:"
echo "   - Open DevTools (F12)"
echo "   - Login with credentials"
echo "   - Check localStorage for 'authToken'"
echo "   - Verify Network tab shows 'Authorization: Bearer ...' header"
echo ""
echo "5. Verify API responses:"
echo "   - /api/auth/me should return 200 (not 401)"
echo "   - /api/branches should return 200"
echo "   - /api/hotels should return 200"
echo ""
echo "See AUTHENTICATION-401-FIX.md for detailed troubleshooting"
