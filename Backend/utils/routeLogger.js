// Utility to easily add before/after logging to any route
import pool from '../config/db.js';
import { logActivityWithComparison } from './activityLogger.js';

/**
 * Wrapper function to add before/after logging to update routes
 */
export const withBeforeAfterLogging = (routeHandler, options = {}) => {
  const {
    resourceName,
    tableName,
    getResourceId = (req) => req.params.id,
    getDescription = (req, afterData) => `Updated ${resourceName} (ID: ${getResourceId(req)})`,
    sensitiveFields = ['password', 'token', 'secret', 'key']
  } = options;

  return async (req, res, next) => {
    try {
      const resourceId = getResourceId(req);
      let beforeData = null;

      // Get before data
      if (tableName && resourceId) {
        try {
          const beforeResult = await pool.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [resourceId]
          );
          beforeData = beforeResult.rows[0] || null;
        } catch (error) {
          console.warn(`Could not fetch before data from ${tableName}:`, error.message);
        }
      }

      // Store original res.json
      const originalJson = res.json;

      // Override res.json to capture after data and log
      res.json = function(data) {
        // Log the activity with comparison
        if (beforeData && data && req.user) {
          setImmediate(async () => {
            try {
              await logActivityWithComparison({
                userId: req.user.id,
                action: `update_${resourceName}`,
                actionType: 'crud',
                resource: resourceName,
                resourceId: resourceId,
                description: getDescription(req, data),
                beforeData: sanitizeData(beforeData, sensitiveFields),
                afterData: sanitizeData(data, sensitiveFields),
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers['user-agent']
              });
            } catch (logError) {
              console.error('Route logging failed:', logError);
            }
          });
        }

        return originalJson.call(this, data);
      };

      // Call the original route handler
      return routeHandler(req, res, next);
    } catch (error) {
      console.error('Route logger wrapper error:', error);
      return routeHandler(req, res, next);
    }
  };
};

/**
 * Remove sensitive data
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
 * Quick setup for common CRUD logging
 */
export const setupCrudLogging = (router, resourceName, tableName) => {
  // Add logging to PUT routes
  router.put(`/${resourceName}/:id`, withBeforeAfterLogging(
    router.stack.find(layer => layer.route?.path === `/${resourceName}/:id` && layer.route?.methods?.put)?.route?.stack?.[0]?.handle,
    {
      resourceName,
      tableName
    }
  ));

  return router;
};