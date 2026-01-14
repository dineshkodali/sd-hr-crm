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
  ipAddress = null,
  userAgent = null,
  status = 'success'
}) {
  try {
    // Parse user agent if provided
    let browser = null, os = null, deviceType = null;
    if (userAgent) {
      const parsed = parseUserAgent(userAgent);
      browser = parsed.browser;
      os = parsed.os;
      deviceType = parsed.deviceType;
    }

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
        metadata ? JSON.stringify(metadata) : null,
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
    const result = await pool.query(
      `SELECT 
         action_type,
         COUNT(*) as count,
         MAX(created_at) as last_activity
       FROM activity_logs
       WHERE user_id = $1 
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action_type
       ORDER BY count DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error getting activity stats:', error);
    return [];
  }
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
