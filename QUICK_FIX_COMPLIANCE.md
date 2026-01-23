# Quick Fix for Compliance Page Issue

## Problem
The Compliance page shows "No certificates found matching your criteria" because the database is not running.

## Immediate Solutions

### Option 1: Quick SQLite Setup (Fastest)

1. **Install SQLite dependency**:
   ```bash
   cd Backend
   npm install sqlite3 sqlite
   ```

2. **Create SQLite database with sample data**:
   ```bash
   node scripts/createSQLiteDB.js
   ```

3. **Update database configuration** (create `Backend/.env`):
   ```
   DATABASE_URL=sqlite:./database.sqlite
   DB_TYPE=sqlite
   ```

4. **Restart the backend server**

### Option 2: Start PostgreSQL with Docker

If you have Docker installed:
```bash
docker compose up -d db
```

Then run:
```bash
cd Backend
node scripts/addSampleCertificates.js
```

### Option 3: Manual Database Check

1. **Check if backend is running**:
   - Open: http://localhost:4000/api/health
   - Should return: `{"ok":true,"ts":...}`

2. **Check compliance API directly**:
   - Open: http://localhost:4000/api/compliance/stats/summary
   - Should return certificate stats

3. **Check browser console**:
   - Open Compliance page
   - Press F12 → Console tab
   - Look for error messages

## Expected Result

After fixing the database connection, you should see:

- ✅ **Stats cards** showing numbers (Valid: 3, Expiring: 1, Expired: 1)
- ✅ **Certificate list** with sample certificates
- ✅ **Working filters** and search functionality
- ✅ **No console errors**

## Verification Steps

1. Open the Compliance page
2. Check that stats cards show non-zero numbers
3. Verify certificate list displays sample data
4. Test search and filter functionality
5. Check browser console for any errors

## If Still Not Working

1. **Check server logs** for database connection errors
2. **Verify API endpoints** are responding
3. **Check network tab** in browser dev tools for failed requests
4. **Review console errors** for specific error messages

The issue is definitely database-related, and one of these solutions should resolve it quickly.