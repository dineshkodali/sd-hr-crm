// Activity Logs Helper
// Utilities for logging user activities
import pool from '../config/db.js';
import { parseUserAgent } from './sessionHelper.js';

/**
 * Log user activity
 */
export async function logActivity({
  userId,
  action,
  actionType,
  resource = null,
  resourceId = null,
  description = null,
  metadata = null,
  beforeData = null,
  afterData = null,
  changedFields = null,
  ipAddress = null,
  userAgent = null,
  status = 'success'
}) {
  try {
    // Skip logging for synthetic admin users
    if (userId === "admin-synthetic" || typeof userId !== 'number') {
      return;
    }

    // Parse user agent if provided
    let browser = null, os = null, deviceType = null;
    if (userAgent) {
      const parsed = parseUserAgent(userAgent);
      browser = parsed.browser;
      os = parsed.os;
      deviceType = parsed.deviceType;
    }

    // Enhanced metadata with before/after comparison
    const enhancedMetadata = {
      ...(metadata || {}),
      beforeData: beforeData || null,
      afterData: afterData || null,
      changedFields: changedFields || null,
      hasChanges: !!(beforeData && afterData)
    };

    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, action, action_type, resource, resource_id, description, 
        metadata, ip_address, user_agent, browser, os, device_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        userId,
        action,
        actionType,
        resource,
        resourceId,
        description,
        JSON.stringify(enhancedMetadata),
        ipAddress,
        userAgent,
        browser,
        os,
        deviceType,
        status
      ]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Get user activity logs
 */
export async function getActivityLogs(userId, options = {}) {
  try {
    // Skip logs for synthetic admin users
    if (userId === "admin-synthetic" || typeof userId !== 'number') {
      return [];
    }

    const {
      limit = 100,
      offset = 0,
      actionType = null,
      resource = null,
      startDate = null,
      endDate = null
    } = options;

    let query = `
      SELECT 
        id, action, action_type, resource, resource_id, description,
        metadata, ip_address, browser, os, device_type, status, created_at
      FROM activity_logs
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (actionType) {
      paramCount++;
      query += ` AND action_type = $${paramCount}`;
      params.push(actionType);
    }

    if (resource) {
      paramCount++;
      query += ` AND resource = $${paramCount}`;
      params.push(resource);
    }

    if (startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting activity logs:', error);
    return [];
  }
}

/**
 * Get activity statistics
 */
export async function getActivityStats(userId, days = 30) {
  try {
    // Skip stats for synthetic admin users
    if (userId === "admin-synthetic" || typeof userId !== 'number') {
      return [];
    }

    const safeDays = Number.isFinite(Number(days)) ? Math.max(0, Math.floor(Number(days))) : 30;

    const result = await pool.query(
      `SELECT 
         action_type,
         COUNT(*) as count,
         MAX(created_at) as last_activity
       FROM activity_logs
       WHERE user_id = $1 
         AND created_at >= NOW() - make_interval(days => $2)
       GROUP BY action_type
       ORDER BY count DESC`,
      [userId, safeDays]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting activity stats:', error);
    return [];
  }
}

/**
 * Compare two objects and return the differences
 */
export function compareData(beforeData, afterData, sensitiveFields = ['password', 'token', 'secret']) {
  if (!beforeData || !afterData) return null;

  const changes = {};
  const changedFields = [];

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);

  for (const key of allKeys) {
    // Skip sensitive fields
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      continue;
    }

    const beforeValue = beforeData[key];
    const afterValue = afterData[key];

    // Check if values are different
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[key] = {
        before: beforeValue,
        after: afterValue,
        type: getChangeType(beforeValue, afterValue)
      };
      changedFields.push(key);
    }
  }

  return {
    changes,
    changedFields,
    totalChanges: changedFields.length
  };
}

/**
 * Determine the type of change
 */
function getChangeType(beforeValue, afterValue) {
  if (beforeValue === null || beforeValue === undefined) return 'added';
  if (afterValue === null || afterValue === undefined) return 'removed';
  return 'modified';
}

/**
 * Format field names for display
 */
export function formatFieldName(fieldName) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Enhanced activity logging with before/after comparison
 */
export async function logActivityWithComparison({
  userId,
  action,
  actionType,
  resource,
  resourceId,
  description,
  beforeData,
  afterData,
  metadata = {},
  ipAddress,
  userAgent,
  status = 'success'
}) {
  let comparison = null;
  let enhancedDescription = description;

  // Generate comparison for update operations
  if (beforeData && afterData && (action.includes('update') || action.includes('edit'))) {
    comparison = compareData(beforeData, afterData);
    
    if (comparison && comparison.totalChanges > 0) {
      enhancedDescription = `${description} (${comparison.totalChanges} field${comparison.totalChanges > 1 ? 's' : ''} changed: ${comparison.changedFields.map(formatFieldName).join(', ')})`;
    }
  }

  await logActivity({
    userId,
    action,
    actionType,
    resource,
    resourceId,
    description: enhancedDescription,
    beforeData,
    afterData,
    changedFields: comparison?.changedFields || null,
    metadata: {
      ...metadata,
      comparison: comparison || null
    },
    ipAddress,
    userAgent,
    status
  });
}

/**
 * Delete old activity logs (cleanup)
 */
export async function cleanupOldLogs(daysToKeep = 90) {
  try {
    const result = await pool.query(
      `DELETE FROM activity_logs 
       WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
    );

    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    return 0;
  }
}