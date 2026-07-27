// Backend/utils/sessionHelper.js
import pool from '../config/db.js';
import { UAParser } from 'ua-parser-js';

/**
 * Parse user agent string to extract browser, OS, and device info
 */
export function parseUserAgent(userAgentString) {
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();
  
  return {
    browser: result.browser.name ? `${result.browser.name} ${result.browser.version || ''}`.trim() : 'Unknown',
    os: result.os.name ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown',
    deviceType: result.device.type || 'desktop',
    userAgent: userAgentString
  };
}

/**
 * Consistently extract IP and User Agent from request
 */
export function getClientInfo(req) {
  const ipAddress = req.ip || 
                   req.connection?.remoteAddress || 
                   req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || 
                   'unknown';
  const userAgent = req.headers["user-agent"] || 'unknown';
  return { ipAddress, userAgent };
}

/**
 * Log a login attempt (success or failure)
 */
export async function logLoginAttempt({
  userId = null,
  email,
  success,
  loginMethod,
  deviceId = null,
  failureReason = null,
  ipAddress,
  userAgent
}) {
  try {
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    
    await pool.query(
      `INSERT INTO login_logs 
       (user_id, email, success, login_method, device_id, failure_reason, 
        ip_address, user_agent, browser, os, device_type, attempted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [userId, email, success, loginMethod, deviceId, failureReason, 
       ipAddress, userAgent, browser, os, deviceType]
    );
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
}

/**
 * Create a new auth session
 */
export async function createAuthSession({
  userId,
  sessionToken,
  loginMethod,
  deviceId = null,
  ipAddress,
  userAgent,
  expiresAt
}) {
  try {
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    
    const result = await pool.query(
      `INSERT INTO auth_sessions 
       (user_id, session_token, login_method, device_id, ip_address, 
        user_agent, browser, os, device_type, login_at, is_active, expires_at, last_activity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), TRUE, $10, NOW(), NOW())
       RETURNING id`,
      [userId, sessionToken, loginMethod, deviceId, ipAddress, 
       userAgent, browser, os, deviceType, expiresAt]
    );
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creating auth session:', error);
    return null;
  }
}

/**
 * Get a specific session by its token
 */
export async function getSessionByToken(sessionToken) {
  try {
    const result = await pool.query(
      `SELECT * FROM auth_sessions 
       WHERE session_token = $1 AND is_active = TRUE`,
      [sessionToken]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting session by token:', error);
    return null;
  }
}

/**
 * Validate a session with inactivity and client consistency checks
 * Performs time check in SQL to avoid clock drift issues.
 */
export async function validateSession(sessionToken, clientIp, clientUA) {
  try {
    // 1. Initial lookup with inactivity check (5 minutes)
    // We add a 30-second grace period for newly created sessions to avoid race conditions right after login
    // We do the activity check in SQL to ensure consistency regardless of server time drift
    const result = await pool.query(
      `SELECT * FROM auth_sessions 
       WHERE session_token = $1 
       AND is_active = TRUE 
       AND (
         last_activity > NOW() - INTERVAL '5 minutes' 
         OR created_at > NOW() - INTERVAL '30 seconds'
       )`,
      [sessionToken]
    );

    const session = result.rows[0];
    if (!session) {
      console.warn(`Session validation failed (Expired or inactive)`);
      return { valid: false, reason: 'Session expired or invalid' };
    }

    // 2. Client Consistency (IP/UA)
    // Normalize localhost IPs for development environments
    const normalizeIp = (ip) => (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') ? '127.0.0.1' : ip;
    const sIp = normalizeIp(session.ip_address);
    const cIp = normalizeIp(clientIp);

    if (sIp !== cIp || session.user_agent !== clientUA) {
      // If UA matches but IP is slightly different, log it but maybe be more lenient?
      // For now, let's keep it strict but log the exact mismatch to help debug.
      console.warn(`Session Hijacking Check: Stored IP=${sIp}, Current IP=${cIp} | Stored UA=${session.user_agent}, Current UA=${clientUA}`);
      return { valid: false, reason: 'Security violation', session };
    }

    return { valid: true, session };
  } catch (error) {
    console.error('Error validating session:', error);
    return { valid: false, reason: 'Server error' };
  }
}

/**
 * Update the last activity timestamp for a session
 */
export async function updateLastActivity(sessionToken) {
  try {
    await pool.query(
      `UPDATE auth_sessions 
       SET last_activity = NOW() 
       WHERE session_token = $1 AND is_active = TRUE`,
      [sessionToken]
    );
    return true;
  } catch (error) {
    console.error('Error updating last activity:', error);
    return false;
  }
}

/**
 * Get user's active sessions
 */
export async function getActiveSessions(userId) {
  try {
    const result = await pool.query(
      `SELECT 
         s.id, s.session_token, s.login_method, s.device_id,
         s.ip_address, s.browser, s.os, s.device_type,
         s.login_at, s.expires_at, s.last_activity, s.is_active,
         d.device_name, d.device_type as registered_device_type
       FROM auth_sessions s
       LEFT JOIN authenticator_devices d ON s.device_id = d.id
       WHERE s.user_id = $1 AND s.is_active = TRUE
       ORDER BY s.login_at DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
}

/**
 * Get user's login history
 */
export async function getLoginHistory(userId, limit = 50) {
  try {
    const result = await pool.query(
      `SELECT 
         l.id, l.email, l.success, l.login_method, l.device_id,
         l.failure_reason, l.ip_address, l.browser, l.os, l.device_type,
         l.attempted_at,
         d.device_name
       FROM login_logs l
       LEFT JOIN authenticator_devices d ON l.device_id = d.id
       WHERE l.user_id = $1
       ORDER BY l.attempted_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error getting login history:', error);
    return [];
  }
}

/**
 * Terminate a specific session
 */
export async function terminateSession(sessionId, userId) {
  try {
    await pool.query(
      `UPDATE auth_sessions 
       SET is_active = FALSE, logout_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    return true;
  } catch (error) {
    console.error('Error terminating session:', error);
    return false;
  }
}

/**
 * Terminate all user sessions except current
 */
export async function terminateOtherSessions(userId, currentSessionToken) {
  try {
    await pool.query(
      `UPDATE auth_sessions 
       SET is_active = FALSE, logout_at = NOW()
       WHERE user_id = $1 AND session_token != $2 AND is_active = TRUE`,
      [userId, currentSessionToken]
    );
    return true;
  } catch (error) {
    console.error('Error terminating other sessions:', error);
    return false;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  try {
    await pool.query(
      `UPDATE auth_sessions 
       SET is_active = FALSE, logout_at = NOW()
       WHERE expires_at < NOW() AND is_active = TRUE`
    );
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}
