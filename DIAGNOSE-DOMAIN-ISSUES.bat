@echo off
echo ========================================
echo DIAGNOSING DOMAIN ISSUES
echo ========================================
echo.

echo Step 1: Check domain connectivity...
echo Testing if crm.sdgsolutions.in is reachable...
ping -n 2 crm.sdgsolutions.in

echo.
echo Step 2: Check HTTP response from domain...
curl -I -L http://crm.sdgsolutions.in 2>nul || echo ❌ Domain not accessible via HTTP

echo.
echo Step 3: Check if port 3002 is accessible...
curl -I -L http://crm.sdgsolutions.in:3002 2>nul || echo ❌ Port 3002 not accessible

echo.
echo Step 4: Check current Docker container status...
docker-compose ps

echo.
echo Step 5: Check backend logs for any errors...
docker logs crm-backend --tail 10

echo.
echo Step 6: Check frontend logs for any errors...
docker logs crm-frontend --tail 10

echo.
echo Step 7: Test API endpoints directly...
echo Testing health endpoint...
curl -s http://localhost:4000/api/health || echo ❌ Backend not accessible locally

echo.
echo Testing auth-health endpoint...
curl -s http://localhost:4000/api/auth-health || echo ❌ Auth endpoint not accessible locally

echo.
echo ========================================
echo COMMON ISSUES AND FIXES
echo ========================================
echo.

echo 📋 If you're seeing these errors:
echo.
echo ❌ "Site can't be reached" or "DNS_PROBE_FINISHED_NXDOMAIN":
echo    → Domain not pointing to your server
echo    → Fix: Update DNS A record to point to your server IP
echo.
echo ❌ "Connection refused" or "Connection timed out":
echo    → Port 80/3002 blocked by firewall
echo    → Fix: Open port 80 and 3002 in firewall
echo.
echo ❌ "404 Not Found":
echo    → Nginx/Apache not configured to proxy to Docker
echo    → Fix: Configure web server to proxy to localhost:3002
echo.
echo ❌ "CORS errors":
echo    → Domain not in CORS configuration
echo    → Fix: Ensure crm.sdgsolutions.in is in CORS_ORIGINS
echo.
echo ========================================
echo QUICK FIXES TO TRY
echo ========================================
echo.

echo 🔧 Fix 1: Ensure domain is in CORS (already configured)
echo    ✅ crm.sdgsolutions.in is in docker-compose.yml CORS_ORIGINS
echo.
echo 🔧 Fix 2: Restart containers to ensure latest config
docker-compose restart backend frontend

echo.
echo 🔧 Fix 3: Check if domain points to correct IP
echo    Run: nslookup crm.sdgsolutions.in
echo    Should point to your server's public IP
echo.

echo 🔧 Fix 4: If using reverse proxy (Nginx/Apache)
echo    Ensure it proxies requests to localhost:3002
echo    Example Nginx config:
echo    server {
echo        listen 80;
echo        server_name crm.sdgsolutions.in;
echo        location / {
echo            proxy_pass http://localhost:3002;
echo            proxy_set_header Host $host;
echo            proxy_set_header X-Real-IP $remote_addr;
echo        }
echo    }
echo.

echo 🔧 Fix 5: If accessing directly via port
echo    Try: http://YOUR_SERVER_IP:3002
echo    Replace YOUR_SERVER_IP with your actual server IP
echo.

echo.
echo 📝 Please share:
echo 1. What error you see in browser
echo 2. What URL you're trying to access
echo 3. What the above diagnostic tests show
echo.

pause
