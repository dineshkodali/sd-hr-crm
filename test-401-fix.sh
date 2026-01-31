#!/bin/bash
# Test script to verify 401 authentication fix

echo "=========================================="
echo "401 Authentication Fix - Test Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the backend URL (default to localhost)
BACKEND_URL="${1:-http://localhost:4003}"

echo "Testing against: $BACKEND_URL"
echo ""

# Test 1: Check if backend is running
echo "Test 1: Checking if backend is accessible..."
if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" | grep -q "200"; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    echo "   Make sure backend is running at $BACKEND_URL"
    exit 1
fi

echo ""

# Test 2: Check auth configuration
echo "Test 2: Checking authentication configuration..."
AUTH_CONFIG=$(curl -s "$BACKEND_URL/api/auth-health" 2>/dev/null)

if echo "$AUTH_CONFIG" | grep -q "jwtSecret"; then
    JWT_SET=$(echo "$AUTH_CONFIG" | grep -o '"jwtSecret":true\|"jwtSecret":false' | grep -o 'true\|false')
    if [ "$JWT_SET" = "true" ]; then
        echo -e "${GREEN}✅ JWT_SECRET is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  JWT_SECRET may not be set${NC}"
    fi
    
    CORS=$(echo "$AUTH_CONFIG" | grep -o '"corsOrigins":\[[^]]*\]' || echo "")
    if [ -z "$CORS" ]; then
        echo -e "${YELLOW}⚠️  No CORS_ORIGINS configured (may cause cross-domain issues)${NC}"
    else
        echo -e "${GREEN}✅ CORS_ORIGINS configured${NC}"
    fi
else
    echo -e "${RED}❌ Could not check auth config${NC}"
fi

echo ""

# Test 3: Attempt login (use demo credentials)
echo "Test 3: Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }' 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Login response includes token${NC}"
    
    # Extract token
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        TOKEN_SHORT="${TOKEN:0:20}..."
        echo "   Token: $TOKEN_SHORT"
    fi
else
    echo -e "${RED}❌ Login failed or token not returned${NC}"
    echo "   Response: $LOGIN_RESPONSE"
fi

echo ""

# Test 4: Test protected endpoint without token
echo "Test 4: Testing protected endpoint without token (should return 401)..."
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/auth/me" 2>/dev/null)
if [ "$UNAUTH_STATUS" = "401" ]; then
    echo -e "${GREEN}✅ Correctly rejected request without token (401)${NC}"
else
    echo -e "${RED}❌ Unexpected response code: $UNAUTH_STATUS${NC}"
fi

echo ""

# Test 5: Test protected endpoint with token (if we got one)
if [ -n "$TOKEN" ]; then
    echo "Test 5: Testing protected endpoint with token (should return 200)..."
    AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "$BACKEND_URL/api/auth/me" 2>/dev/null)
    
    if [ "$AUTH_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Token authentication successful (200)${NC}"
        
        # Get the response to verify user data
        USER_DATA=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/auth/me" 2>/dev/null)
        echo "   User data: $USER_DATA"
    else
        echo -e "${RED}❌ Token authentication failed (HTTP $AUTH_STATUS)${NC}"
        echo "   This suggests JWT_SECRET mismatch between login and auth middleware"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping token test (no token from login)${NC}"
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "If all tests passed:"
echo "  ✅ Backend is correctly configured"
echo "  ✅ JWT tokens are being generated"
echo "  ✅ Token verification is working"
echo ""
echo "Frontend changes needed:"
echo "  ✅ Token should be stored in localStorage as 'authToken'"
echo "  ✅ Authorization header should be sent: 'Authorization: Bearer <token>'"
echo "  ✅ Clear browser cache and localStorage after deploying frontend changes"
echo ""
echo "See AUTHENTICATION-401-FIX.md for more details"
