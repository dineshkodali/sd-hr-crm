# 401 Unauthorized Fix - Complete Solution

## Problem Summary
All API requests to the deployed domain are returning **401 Unauthorized**, but the same requests work fine on localhost. This indicates an **authentication token transmission issue** between frontend and backend.

## Root Cause Analysis

The backend correctly issues a JWT token in the login response and sets it in a cookie. However:

1. **Frontend was not storing the token** from the response body
2. **Frontend was not sending the token** in the Authorization header for subsequent requests
3. Even though `withCredentials: true` was set, cookies may not be working reliably across domains in production

## Solution Implemented

### Part 1: Frontend - Token Storage & Authorization Header (CRITICAL)

Created `/frontend/src/utils/axiosConfig.js` with:
- Request interceptor: Automatically adds `Authorization: Bearer <token>` header
- Response interceptor: Captures token from login response and stores it
- 401 error handling: Clears token and redirects to login on auth failure

### Part 2: Frontend - Login Token Storage

Updated `/frontend/pages/Login.jsx` to:
- Store the token from login response in localStorage as `authToken`
- Set the token in axios default headers immediately after login

### Part 3: Backend - Ensure Token Acceptance

The backend already supports multiple token sources:
- Cookie: `req.cookies.token`
- Authorization header: `Bearer <token>`
- Query parameter: `?token=...`
- Request body: `{token: "..."}`

## Implementation Steps

### Step 1: Deploy Frontend Changes
```bash
cd frontend
npm run build
# Deploy the dist folder to your production domain
```

### Step 2: Verify Environment Variables on Backend
```bash
# SSH into your production server
export NODE_ENV=production
export JWT_SECRET="your-long-random-secret-here"
export CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

### Step 3: Test the Fix

1. **Clear all browser data** (cookies, localStorage, etc.)
2. **Open DevTools** (F12) → Network tab
3. **Login with credentials**
4. **Check the response**: You should see a `token` field
5. **Verify localStorage**: Should have `authToken` stored
6. **Check subsequent requests**: Should have `Authorization: Bearer <token>` header
7. **Verify API calls**: Should now return 200 instead of 401

### Step 4: Monitor Logs

Check backend logs for:
```
Auth: token found (source=header) preview=eyJ...
Auth: token payload (decoded): { id: ..., exp: ..., iat: ... }
```

## How It Works Now

```
User Login
    ↓
Backend returns: { user: {...}, token: "eyJ..." }
    ↓
Frontend stores token in localStorage as "authToken"
    ↓
Frontend axios interceptor adds to every request:
    Authorization: Bearer eyJ...
    ↓
Backend auth middleware extracts token from header
    ↓
Backend verifies JWT signature
    ↓
Request succeeds with 200 OK
```

## Key Files Modified

1. **Created**: `frontend/src/utils/axiosConfig.js`
2. **Updated**: `frontend/src/main.jsx` (imports axiosConfig)
3. **Updated**: `frontend/pages/Login.jsx` (stores token from response)

## Testing Checklist

- [ ] Clear browser cookies and localStorage
- [ ] Login successfully
- [ ] Verify `localStorage.authToken` exists
- [ ] Check Network tab shows `Authorization: Bearer ...` header
- [ ] Verify `/api/auth/me` returns 200 (not 401)
- [ ] Verify `/api/branches`, `/api/hotels`, etc. return 200
- [ ] Verify dashboard loads without errors
- [ ] Test logout and verify token is cleared
- [ ] Test 2FA if enabled
- [ ] Test on different browsers/devices

## Troubleshooting

### Still getting 401?

1. **Check browser console** for errors
2. **Verify JWT_SECRET** matches between frontend encoding and backend verification
3. **Inspect token** in localStorage
4. **Check Authorization header** in Network tab
5. **Verify CORS_ORIGINS** includes your domain

### Token not being stored?

1. Ensure login response includes `token` field
2. Check browser localStorage is enabled
3. Verify no errors in Login.jsx console

### 403 Forbidden instead of 401?

This means authentication succeeded but user lacks permissions. Check user role/permissions.

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set strong `JWT_SECRET` (32+ characters, random)
- [ ] Set `CORS_ORIGINS` to your domain(s)
- [ ] Enable HTTPS (required for production cookies)
- [ ] Set `secure: true` in cookie options
- [ ] Set `sameSite: 'None'` for cross-domain cookies
- [ ] Restart backend after env changes
- [ ] Clear frontend cache/CDN after deploying

## Security Notes

- **Never expose JWT_SECRET** in source code or frontend
- **Always use HTTPS** in production
- **Use strong JWT_SECRET**: `openssl rand -base64 32`
- **Set appropriate token expiry**: Currently 30 days (consider reducing)
- **Enable token refresh** for long sessions
- **Monitor failed login attempts** for security

## Performance Optimization

The axios interceptor is lightweight and adds minimal overhead:
- Token extraction: O(1) lookup in localStorage
- Header addition: Single header assignment
- Response checking: Simple data access

## Reverting if Needed

If you need to revert to cookie-only authentication:
1. Keep the Authorization header (dual support)
2. Verify `withCredentials: true` is set globally
3. Ensure cookie domain configuration matches

Both methods can coexist without conflict.

## Next Steps

1. Deploy these changes to production
2. Monitor error logs for any issues
3. Test from multiple locations/devices
4. Consider implementing token refresh for better UX
5. Add rate limiting on login endpoint
6. Implement session tracking

## Support

If issues persist:
1. Check server logs: `pm2 logs` or `docker logs`
2. Verify environment variables: `printenv | grep JWT`
3. Test token generation: `GET /api/auth/debug-token`
4. Check CORS configuration: `GET /api/auth-health`
