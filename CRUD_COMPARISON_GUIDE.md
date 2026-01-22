# CRUD Operations Comparison Tables Implementation Guide

This guide explains how the enhanced activity logging system with comparison tables works and how to implement it across your application.

## Overview

The system automatically captures "before" and "after" data for all CRUD operations and displays them in beautiful comparison tables in the Activity Logs interface.

## Features

✅ **Automatic Before/After Capture**: Middleware automatically captures data before and after updates
✅ **Beautiful Comparison Tables**: Side-by-side comparison with color-coded changes
✅ **Multiple View Modes**: Cards view with expandable details and Table view with modal popups
✅ **Change Type Detection**: Automatically detects Added, Modified, and Removed fields
✅ **Sensitive Data Protection**: Automatically redacts passwords, tokens, and secrets
✅ **Field-Level Granularity**: Shows exactly which fields changed and their values

## Components

### 1. Backend Components

#### `activityLogger.js`
- Core logging utilities
- `logActivityWithComparison()` - Enhanced logging with before/after data
- `compareData()` - Compares two objects and identifies changes
- Data sanitization and field formatting

#### `activityMiddleware.js`
- Middleware for automatic CRUD logging
- `applyCrudLogging()` - Apply to any router for full CRUD logging
- `logCreate()`, `crudLogging()`, `logDelete()` - Individual operation middlewares

### 2. Frontend Components

#### `ComparisonTable.jsx`
- Reusable comparison table component
- Shows before/after values in a structured table format
- Expandable long content
- Change type indicators (Added/Modified/Removed)

#### `ComparisonModal.jsx`
- Modal for displaying comparison tables in table view
- Full activity details with metadata
- Device and browser information

#### `ActivityLogs.jsx`
- Main activity logs interface
- Cards and Table view modes
- Integrated comparison table display

## Implementation

### 1. Adding CRUD Logging to Routes

#### Option A: Full CRUD Logging (Recommended)
```javascript
import { applyCrudLogging } from "../middleware/activityMiddleware.js";

const router = express.Router();

// Apply logging to all CRUD operations on this router
applyCrudLogging(router, 'resource_name', 'table_name');

// Your routes...
router.post('/', createHandler);
router.put('/:id', updateHandler);
router.delete('/:id', deleteHandler);
```

#### Option B: Individual Operation Logging
```javascript
import { logCreate, crudLogging, logDelete } from "../middleware/activityMiddleware.js";

const router = express.Router();

// Apply to specific operations
router.use(logCreate('resource_name', 'table_name'));
router.use(crudLogging('resource_name', 'table_name'));
router.use(logDelete('resource_name', 'table_name'));
```

#### Option C: Manual Logging (For Complex Cases)
```javascript
import { logActivityWithComparison } from "../utils/activityLogger.js";

router.put('/:id', async (req, res) => {
  // Get before data
  const beforeResult = await pool.query('SELECT * FROM table WHERE id = $1', [req.params.id]);
  const beforeData = beforeResult.rows[0];
  
  // Perform update
  const result = await pool.query('UPDATE table SET ... WHERE id = $1 RETURNING *', [...]);
  const afterData = result.rows[0];
  
  // Log with comparison
  await logActivityWithComparison({
    userId: req.user.id,
    action: 'update_resource',
    actionType: 'crud',
    resource: 'resource_name',
    resourceId: req.params.id,
    description: 'Updated resource',
    beforeData,
    afterData,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.json(afterData);
});
```

### 2. Routes Already Updated

The following routes have been updated with enhanced logging:

- ✅ `Backend/routes/su.js` - Service Users (manual implementation)
- ✅ `Backend/routes/admin.js` - Admin operations (manual implementation)  
- ✅ `Backend/routes/tickets.js` - Tickets (middleware implementation)

### 3. Routes That Need Updating

Apply `applyCrudLogging()` to these routes:

- `Backend/routes/moveouts.js`
- `Backend/routes/vulnerable-users.js`
- `Backend/routes/vcs-organisations.js`
- `Backend/routes/rooms.js`
- `Backend/routes/safeguarding.js`
- `Backend/routes/risk-assessments.js`
- `Backend/routes/performance-management.js`
- `Backend/routes/payroll.js`
- `Backend/routes/multi-agency.js`
- `Backend/routes/moveins.js`
- `Backend/routes/meals.js`
- `Backend/routes/maintenance.js`
- `Backend/routes/litigation.js`

## Usage Examples

### Example 1: Simple Route Update
```javascript
// Before
import express from "express";
const router = express.Router();

// After
import express from "express";
import { applyCrudLogging } from "../middleware/activityMiddleware.js";

const router = express.Router();
applyCrudLogging(router, 'meals', 'meals');
```

### Example 2: Custom Resource Mapping
```javascript
// For routes where URL doesn't match table name
applyCrudLogging(router, 'service_users', 'service_users_table');
```

### Example 3: Skipping Sensitive Routes
```javascript
import { enhancedActivityLogging } from "../middleware/activityMiddleware.js";

router.use(enhancedActivityLogging({
  resourceName: 'users',
  skipRoutes: ['/api/users/password-reset'],
  sensitiveFields: ['password', 'token', 'secret', 'ssn', 'credit_card']
}));
```

## Frontend Usage

### Using ComparisonTable Component
```jsx
import ComparisonTable from './ComparisonTable';

// In your component
<ComparisonTable
  beforeData={beforeData}
  afterData={afterData}
  changes={changes}
  title="Changes Made"
  showOnlyChanges={true}
/>
```

### Using ComparisonModal Component
```jsx
import ComparisonModal from './ComparisonModal';

// In your component
<ComparisonModal 
  log={selectedLog}
  isOpen={!!selectedLog}
  onClose={() => setSelectedLog(null)}
/>
```

## Database Schema

The activity logging uses the existing `activity_logs` table with these key fields:

```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(255),
  action_type VARCHAR(50),
  resource VARCHAR(100),
  resource_id VARCHAR(50),
  description TEXT,
  metadata JSONB,  -- Contains beforeData, afterData, and comparison
  ip_address INET,
  user_agent TEXT,
  browser VARCHAR(100),
  os VARCHAR(100),
  device_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'success',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Metadata Structure

The `metadata` JSONB field contains:

```json
{
  "beforeData": { /* original data */ },
  "afterData": { /* updated data */ },
  "comparison": {
    "changes": {
      "field_name": {
        "before": "old_value",
        "after": "new_value", 
        "type": "modified|added|removed"
      }
    },
    "changedFields": ["field1", "field2"],
    "totalChanges": 2
  }
}
```

## Security Features

1. **Sensitive Field Redaction**: Automatically redacts fields containing:
   - password
   - token
   - secret
   - key

2. **User Authentication**: Only logs activities for authenticated users

3. **Data Sanitization**: Removes sensitive information before storage

## Performance Considerations

1. **Asynchronous Logging**: Activity logging happens asynchronously to avoid blocking requests
2. **Selective Logging**: Only logs actual changes, not every request
3. **Efficient Queries**: Uses optimized database queries for before/after data capture

## Troubleshooting

### Common Issues

1. **No comparison data showing**
   - Check if middleware is applied to the route
   - Verify table name matches the actual database table
   - Ensure user is authenticated

2. **Sensitive data visible**
   - Add field names to `sensitiveFields` array
   - Check data sanitization is working

3. **Performance issues**
   - Consider adding database indexes on frequently queried fields
   - Implement log cleanup for old entries

### Debug Mode

Enable debug logging:
```javascript
// In activityLogger.js
console.log('Before data:', beforeData);
console.log('After data:', afterData);
console.log('Comparison:', comparison);
```

## Next Steps

1. **Apply to Remaining Routes**: Update all CRUD routes to use the enhanced logging
2. **Custom Comparisons**: Implement custom comparison logic for complex data types
3. **Export Functionality**: Add ability to export comparison data
4. **Real-time Updates**: Consider WebSocket integration for real-time activity feeds
5. **Advanced Filtering**: Add more sophisticated filtering options in the UI

## Support

For questions or issues with the comparison tables implementation, check:
1. Browser console for JavaScript errors
2. Server logs for middleware errors
3. Database logs for query issues
4. Network tab for API request/response issues