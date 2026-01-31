# Production Authentication Fix

## Problem Analysis:
All API endpoints returning 401 Unauthorized after domain deployment. This is caused by:

1. **CORS Configuration** - Cookie settings not working with domain deployment
2. **JWT Secret Missing** - Environment variables not properly configured
3. **Cookie Security** - Production cookie settings blocking authentication
4. **Domain Mismatch** - Frontend and backend on different domains/subdomains

## Root Causes:

### 1. CORS Cookie Issues
Current CORS config allows any origin but cookie settings are too restrictive:
```javascript
// Current problematic config
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // true in production
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};
```

### 2. Environment Variables Missing
- `JWT_SECRET` not set in production
- `NODE_ENV` not properly configured
- `CORS_ORIGINS` not set for specific domain

### 3. Domain/HTTPS Issues
- Cookies with `secure: true` require HTTPS
- `sameSite: 'None'` requires `secure: true`
- Cross-domain cookie handling

## Solutions:

### Option 1: Fix Environment Variables (Recommended)

Create/update `.env` file in production:
```env
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-here-change-this
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Option 2: Update CORS Configuration

Update `Backend/server.js`:
```javascript
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3002'];
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
```

### Option 3: Fix Cookie Settings

Update `Backend/routes/auth.js`:
```javascript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || undefined, // Add domain for cross-subdomain
};
```

### Option 4: Fallback to Authorization Header

If cookies continue to fail, use Authorization headers:
```javascript
// Frontend axios setup
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

## Quick Fix Steps:

### Step 1: Set Environment Variables
```bash
# In production server
export NODE_ENV=production
export JWT_SECRET="your-secure-random-secret-key-here"
export CORS_ORIGINS="https://yourdomain.com"
```

### Step 2: Update CORS Configuration
Replace CORS middleware in `server.js` with production-ready version.

### Step 3: Restart Backend Server
```bash
npm restart
# or
pm2 restart app
```

### Step 4: Test Authentication
1. Clear browser cookies for the domain
2. Try logging in again
3. Check browser network tab for cookie headers

## Alternative: Token in Response Body

If cookies continue to fail, modify auth to return token in response:
```javascript
// In login route
res.json({
  success: true,
  token,
  user: { id, name, email, role }
});
```

And update frontend to store token in localStorage and send in Authorization header.

## Debugging Steps:

1. **Check Environment Variables**:
   ```javascript
   console.log('JWT_SECRET:', process.env.JWT_SECRET);
   console.log('NODE_ENV:', process.env.NODE_ENV);
   ```

2. **Check CORS Headers**:
   ```javascript
   console.log('Origin:', req.headers.origin);
   console.log('Credentials:', req.headers.credentials);
   ```

3. **Check Cookies**:
   ```javascript
   console.log('Cookies:', req.cookies);
   ```

4. **Browser Network Tab**:
   - Check if cookies are being sent in requests
   - Check CORS headers in responses
   - Look for CORS errors in console

## Most Likely Fix:
The issue is probably missing `JWT_SECRET` environment variable in production. Set this first and restart the server.
