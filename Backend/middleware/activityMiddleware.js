// Enhanced activity logging middleware for all routes
import { logActivityWithComparison } from '../utils/activityLogger.js';
import pool from '../config/db.js';

/**
 * Middleware to automatically capture before/after data for update operations
 */
export const enhancedActivityLogging = (options = {}) => {
  const {
    resourceName = null,
    getResourceId = (req) => req.params.id,
    getTableName = (resourceName) => resourceName,
    skipRoutes = [],
    sensitiveFields = ['password', 'token', 'secret', 'key']
  } = options;

  return async (req, res, next) => {
    // Skip if route is in skip list
    if (skipRoutes.some(route => req.originalUrl.includes(route))) {
      return next();
    }

    // Only process PUT/PATCH requests (updates)
    if (!['PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Only process if user is authenticated
    if (!req.user || !req.user.id) {
      return next();
    }

    try {
      const resourceId = getResourceId(req);
      const tableName = getTableName(resourceName || extractResourceFromUrl(req.originalUrl));
      
      if (!resourceId || !tableName) {
        return next();
      }

      // Store original res.json to intercept response
      const originalJson = res.json;
      let beforeData = null;

      // Try to get before data if we have a valid table and ID
      try {
        const beforeResult = await pool.query(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [resourceId]
        );
        beforeData = beforeResult.rows[0] || null;
      } catch (error) {
        console.warn(`Could not fetch before data for ${tableName}:`, error.message);
      }

      // Override res.json to capture after data
      res.json = function(data) {
        // Log the activity with before/after comparison
        if (beforeData && data && req.user) {
          setImmediate(async () => {
            try {
              await logActivityWithComparison({
                userId: req.user.id,
                action: `update_${resourceName || extractResourceFromUrl(req.originalUrl)}`,
                actionType: 'crud',
                resource: resourceName || extractResourceFromUrl(req.originalUrl),
                resourceId: resourceId,
                description: `Updated ${resourceName || extractResourceFromUrl(req.originalUrl)} (ID: ${resourceId})`,
                beforeData: sanitizeData(beforeData, sensitiveFields),
                afterData: sanitizeData(data, sensitiveFields),
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers['user-agent']
              });
            } catch (logError) {
              console.error('Enhanced activity logging failed:', logError);
            }
          });
        }

        // Call original res.json
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Enhanced activity middleware error:', error);
      next();
    }
  };
};

/**
 * Generic CRUD logging middleware that can be applied to any route
 */
export const crudLogging = (resourceName, tableName = null) => {
  return enhancedActivityLogging({
    resourceName,
    getTableName: () => tableName || resourceName
  });
};

/**
 * Middleware for CREATE operations
 */
export const logCreate = (resourceName, tableName = null) => {
  return async (req, res, next) => {
    if (req.method !== 'POST' || !req.user?.id) {
      return next();
    }

    const originalJson = res.json;
    
    res.json = function(data) {
      if (data && req.user) {
        setImmediate(async () => {
          try {
            await logActivityWithComparison({
              userId: req.user.id,
              action: `create_${resourceName}`,
              actionType: 'crud',
              resource: resourceName,
              resourceId: data.id || data.insertId || null,
              description: `Created new ${resourceName}${data.id ? ` (ID: ${data.id})` : ''}`,
              beforeData: null,
              afterData: sanitizeData(data, ['password', 'token', 'secret', 'key']),
              ipAddress: req.ip || req.connection?.remoteAddress,
              userAgent: req.headers['user-agent']
            });
          } catch (logError) {
            console.error('Create logging failed:', logError);
          }
        });
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware for DELETE operations
 */
export const logDelete = (resourceName, tableName = null) => {
  return async (req, res, next) => {
    if (req.method !== 'DELETE' || !req.user?.id) {
      return next();
    }

    try {
      const resourceId = req.params.id;
      let beforeData = null;

      // Try to get the data before deletion
      if (resourceId && (tableName || resourceName)) {
        try {
          const beforeResult = await pool.query(
            `SELECT * FROM ${tableName || resourceName} WHERE id = $1`,
            [resourceId]
          );
          beforeData = beforeResult.rows[0] || null;
        } catch (error) {
          console.warn(`Could not fetch before data for deletion:`, error.message);
        }
      }

      const originalJson = res.json;
      
      res.json = function(data) {
        if (req.user) {
          setImmediate(async () => {
            try {
              await logActivityWithComparison({
                userId: req.user.id,
                action: `delete_${resourceName}`,
                actionType: 'crud',
                resource: resourceName,
                resourceId: resourceId,
                description: `Deleted ${resourceName}${resourceId ? ` (ID: ${resourceId})` : ''}`,
                beforeData: sanitizeData(beforeData, ['password', 'token', 'secret', 'key']),
                afterData: null,
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers['user-agent']
              });
            } catch (logError) {
              console.error('Delete logging failed:', logError);
            }
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Delete logging middleware error:', error);
      next();
    }
  };
};

/**
 * Extract resource name from URL
 */
function extractResourceFromUrl(url) {
  const parts = url.split('/').filter(part => part && !part.match(/^\d+$/));
  return parts[parts.length - 1] || 'resource';
}

/**
 * Remove sensitive fields from data
 */
function sanitizeData(data, sensitiveFields) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    Object.keys(sanitized).forEach(key => {
      if (key.toLowerCase().includes(field.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });
  }
  
  return sanitized;
}

/**
 * Apply enhanced logging to specific routes
 */
export const applyEnhancedLogging = (router, resourceName, options = {}) => {
  router.use(enhancedActivityLogging({
    resourceName,
    ...options
  }));
  return router;
};

/**
 * Apply full CRUD logging to a router
 */
export const applyCrudLogging = (router, resourceName, tableName = null) => {
  router.use(logCreate(resourceName, tableName));
  router.use(crudLogging(resourceName, tableName));
  router.use(logDelete(resourceName, tableName));
  return router;
};