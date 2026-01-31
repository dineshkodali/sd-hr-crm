// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { protect, requireRole } from "../middleware/auth.js";
import {
  generateAuthenticatorSecret,
  verifyAuthenticatorCode,
  generateBackupCodes,
  verifyBackupCode
} from '../utils/authenticatorUtils.js';
import { createOTP, verifyOTP, sendOTPEmail } from '../utils/otpHelper.js';
import {
  logLoginAttempt,
  createAuthSession
} from '../utils/sessionHelper.js';
import { logActivity, getActivityLogs, getActivityStats } from '../utils/activityLogger.js';

const router = express.Router();

// Production-ready cookie options.
// In production, set sameSite: 'None' and secure: true (and serve over HTTPS).
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // only true in production (https)
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Lax in dev
  path: "/", // ensure cookie is sent to all routes on the domain
  maxAge: 30 * 24 * 60 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || (process.env.NODE_ENV === "production" ? undefined : undefined),
};

const generateToken = (id) => {
  // Use same fallback JWT_SECRET as auth middleware
  const jwtSecret = process.env.JWT_SECRET || 
    process.env.JWT_SECRET_KEY || 
    "default-jwt-secret-for-production-change-this-in-env-32-chars-minimum";
  
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: "30d",
  });
};

/* ---------- DEBUG: show token and decoded (non-production only) ---------- */
if (process.env.NODE_ENV !== "production") {
  router.get("/debug-token", (req, res) => {
    try {
      // Check cookie first, then Authorization header
      const cookieToken = req.cookies?.token || null;
      const header = req.header("Authorization") || req.header("authorization") || null;
      let token = cookieToken;

      if (!token && header) {
        // header may be "Bearer <token>" or just "<token>"
        token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header;
      }

      let decoded = null;
      if (token) {
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
          decoded = { error: e.message };
        }
      }

      return res.json({
        cookiePresent: !!cookieToken,
        headerPresent: !!header,
        tokenPreview: token ? `${String(token).slice(0, 80)}...` : null,
        decoded,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || String(err) });
    }
  });
}

/* ---------- REGISTER ---------- */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "staff", branch } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide name, email and password" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    // Managers require approval -> pending; staff are active immediately
    const status = role === "manager" ? "pending" : "active";

    const insert = await pool.query(
      `INSERT INTO users (name, email, password, role, status, branch)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, status, branch`,
      [name, email, hashed, role, status, branch || null]
    );

    // If account is active, set cookie (auto-login). Pending accounts are not logged in.
    if (status === "active") {
      const token = generateToken(insert.rows[0].id);
      // set cookie for browser sessions
      res.cookie("token", token, cookieOptions);
      // return token in body for dev/testing convenience
      return res.status(201).json({ user: insert.rows[0], token });
    }

    return res.status(201).json({ user: insert.rows[0] });
  } catch (err) {
    console.error("Register error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---------- LOGIN ---------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password, totpCode, backupCode, otpCode } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Please provide email and password" });

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const userRes = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];

      if (user.status !== "active") {
        // Log failed attempt
        await logLoginAttempt({
          userId: user.id,
          email,
          success: false,
          loginMethod: 'password',
          failureReason: 'Account not active',
          ipAddress,
          userAgent
        });
        return res.status(403).json({ message: "Account not active. Await approval." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        // Log failed password attempt
        await logLoginAttempt({
          userId: user.id,
          email,
          success: false,
          loginMethod: 'password',
          failureReason: 'Invalid password',
          ipAddress,
          userAgent
        });
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Check if user has authenticator enabled
      if (user.authenticator_enabled) {
        // If authenticator is enabled, require TOTP, backup code, or OTP
        if (!totpCode && !backupCode && !otpCode) {
          return res.json({
            require2FA: true,
            hasAuthenticator: true,
            userEmail: user.email,
            message: "Please complete two-factor authentication"
          });
        }

        // Verify OTP code if provided
        if (otpCode) {
          const otpResult = await verifyOTP(user.email, otpCode, 'login');
          if (!otpResult.valid) {
            await logLoginAttempt({
              userId: user.id,
              email: user.email,
              success: false,
              loginMethod: 'otp',
              failureReason: otpResult.error || 'Invalid OTP code',
              ipAddress,
              userAgent
            });
            return res.status(400).json({ message: otpResult.error || "Invalid or expired OTP code" });
          }

          // Login successful with OTP
          const token = generateToken(user.id);
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          
          await logLoginAttempt({
            userId: user.id,
            email: user.email,
            success: true,
            loginMethod: 'otp',
            ipAddress,
            userAgent
          });
          
          await createAuthSession({
            userId: user.id,
            sessionToken: token,
            loginMethod: 'otp',
            ipAddress,
            userAgent,
            expiresAt
          });
          
          // Log activity
          await logActivity({
            userId: user.id,
            action: 'login',
            actionType: 'auth',
            description: `Logged in using email OTP`,
            ipAddress,
            userAgent
          });
          
          res.cookie("token", token, cookieOptions);
          
          const { id, name, email: e, role, branch } = user;
          return res.json({ user: { id, name, email: e, role, branch }, token });
        }

        // Verify backup code if provided
        if (backupCode) {
          const backupCodes = user.backup_codes || [];
          const { valid, remainingCodes } = verifyBackupCode(backupCodes, backupCode);
          
          if (!valid) {
            await logLoginAttempt({
              userId: user.id,
              email: user.email,
              success: false,
              loginMethod: 'backup_code',
              failureReason: 'Invalid backup code',
              ipAddress,
              userAgent
            });
            return res.status(400).json({ message: "Invalid backup code" });
          }
          
          // Update remaining backup codes
          await pool.query(
            "UPDATE users SET backup_codes = $1 WHERE id = $2",
            [remainingCodes, user.id]
          );
          
          // Login successful with backup code
          const token = generateToken(user.id);
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          await logLoginAttempt({
            userId: user.id,
            email: user.email,
            success: true,
            loginMethod: 'backup_code',
            ipAddress,
            userAgent
          });
          
          await createAuthSession({
            userId: user.id,
            sessionToken: token,
            loginMethod: 'backup_code',
            ipAddress,
            userAgent,
            expiresAt
          });
          
          // Log activity
          await logActivity({
            userId: user.id,
            action: 'login',
            actionType: 'auth',
            description: `Logged in using backup code (${remainingCodes.length} codes remaining)`,
            ipAddress,
            userAgent
          });
          
          res.cookie("token", token, cookieOptions);
          
          const { id, name, email: e, role, branch } = user;
          return res.json({
            user: { id, name, email: e, role, branch },
            token,
            message: `Backup code used. ${remainingCodes.length} codes remaining.`
          });
        }

        // Verify TOTP code
        if (totpCode) {
          // First check the primary authenticator secret (backward compatibility)
          let isValid = false;
          let matchedDeviceId = null;
          let matchedDevice = null;
          
          if (user.authenticator_secret) {
            isValid = verifyAuthenticatorCode(user.authenticator_secret, totpCode);
          }
          
          // If primary secret doesn't match, check all active devices
          if (!isValid) {
            const devicesResult = await pool.query(
              "SELECT id, device_name, secret FROM authenticator_devices WHERE user_id = $1 AND is_active = TRUE",
              [user.id]
            );
            
            for (const device of devicesResult.rows) {
              if (verifyAuthenticatorCode(device.secret, totpCode)) {
                isValid = true;
                matchedDeviceId = device.id;
                matchedDevice = device;
                break;
              }
            }
          }
          
          if (!isValid) {
            await logLoginAttempt({
              userId: user.id,
              email: user.email,
              success: false,
              loginMethod: 'authenticator',
              deviceId: matchedDeviceId,
              failureReason: 'Invalid authenticator code',
              ipAddress,
              userAgent
            });
            return res.status(400).json({ message: "Invalid authenticator code" });
          }
          
          // Update last_used_at for the matched device
          if (matchedDeviceId) {
            await pool.query(
              "UPDATE authenticator_devices SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1",
              [matchedDeviceId]
            );
          }
          
          // Login successful with TOTP
          const token = generateToken(user.id);
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          await logLoginAttempt({
            userId: user.id,
            email: user.email,
            success: true,
            loginMethod: 'authenticator',
            deviceId: matchedDeviceId,
            ipAddress,
            userAgent
          });
          
          await createAuthSession({
            userId: user.id,
            sessionToken: token,
            loginMethod: 'authenticator',
            deviceId: matchedDeviceId,
            ipAddress,
            userAgent,
            expiresAt
          });
          
          // Log activity
          await logActivity({
            userId: user.id,
            action: 'login',
            actionType: 'auth',
            description: `Logged in using authenticator (${matchedDevice?.device_name || 'primary device'})`,
            metadata: { deviceId: matchedDeviceId },
            ipAddress,
            userAgent
          });
          
          res.cookie("token", token, cookieOptions);
          
          const { id, name, email: e, role, branch } = user;
          return res.json({ user: { id, name, email: e, role, branch }, token });
        }
      }

      // Normal login (no authenticator) - but still offer OTP option
      if (!otpCode) {
        return res.json({
          require2FA: true,
          hasAuthenticator: false,
          userEmail: user.email,
          message: "Two-factor authentication available"
        });
      }

      // Verify OTP for users without authenticator
      const otpResult = await verifyOTP(user.email, otpCode, 'login');
      if (!otpResult.valid) {
        await logLoginAttempt({
          userId: user.id,
          email: user.email,
          success: false,
          loginMethod: 'otp',
          failureReason: otpResult.error || 'Invalid OTP code',
          ipAddress,
          userAgent
        });
        return res.status(400).json({ message: otpResult.error || "Invalid or expired OTP code" });
      }

      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      await logLoginAttempt({
        userId: user.id,
        email: user.email,
        success: true,
        loginMethod: 'otp',
        ipAddress,
        userAgent
      });
      
      await createAuthSession({
        userId: user.id,
        sessionToken: token,
        loginMethod: 'otp',
        ipAddress,
        userAgent,
        expiresAt
      });
      
      res.cookie("token", token, cookieOptions);

      const { id, name, email: e, role, branch } = user;
      return res.json({ user: { id, name, email: e, role, branch }, token });
    }

    // fallback to env-based admin if configured
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const syntheticAdmin = {
          id: "admin-synthetic",
          name: process.env.ADMIN_NAME || "Site Admin",
          email: process.env.ADMIN_EMAIL,
          role: "admin",
        };
        const token = generateToken(syntheticAdmin.id);
        res.cookie("token", token, cookieOptions);
        return res.json({ user: syntheticAdmin, token });
      }
    }

    return res.status(400).json({ message: "Invalid credentials" });
  } catch (err) {
    console.error("Login error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---------- REQUEST LOGIN OTP ---------- */
router.post("/request-login-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    const userRes = await pool.query(
      "SELECT id, email, status FROM users WHERE email = $1",
      [email]
    );

    if (userRes.rows.length === 0) {
      // Don't reveal if user exists - security best practice
      return res.json({ message: "If the account exists, an OTP has been sent to your email" });
    }

    const user = userRes.rows[0];

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account not active" });
    }

    // Generate and send OTP with device metadata
    const otpCode = await createOTP(user.email, user.id, 'login', 10); // 10 minute expiry
    
    // Parse device metadata
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const { parseUserAgent } = await import('../utils/sessionHelper.js');
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    
    await sendOTPEmail(user.email, otpCode, 'login', {
      ipAddress,
      browser,
      os,
      deviceType,
      userAgent
    });

    return res.json({ 
      message: "OTP sent to your email",
      expiresIn: 10 // minutes
    });
  } catch (err) {
    console.error("Request OTP error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ---------- ME ---------- */
router.get("/me", protect, async (req, res) => {
  const { id, name, email, role, branch } = req.user;
  res.json({ id, name, email, role, branch });
});

/* ---------- LOGOUT ---------- */
router.post("/logout", (req, res) => {
  // Expire cookie immediately
  res.cookie("token", "", { ...cookieOptions, maxAge: 1 });
  res.json({ message: "Logged out successfully" });
});

/* ---------- ADMIN: pending managers ---------- */
router.get("/admin/pending-managers", protect, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, branch, status, created_at FROM users WHERE role = 'manager' AND status = 'pending' ORDER BY created_at DESC"
    );
    return res.json({ pending: result.rows });
  } catch (err) {
    console.error("pending-managers:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/admin/approve-manager/:id", protect, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("UPDATE users SET status = 'active' WHERE id = $1 AND role = 'manager'", [id]);
    return res.json({ message: "Manager approved" });
  } catch (err) {
    console.error("approve-manager:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/admin/reject-manager/:id", protect, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("UPDATE users SET status = 'rejected' WHERE id = $1 AND role = 'manager'", [id]);
    return res.json({ message: "Manager rejected" });
  } catch (err) {
    console.error("reject-manager:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---------- ADMIN: add-member ---------- */
router.post("/admin/add-member", protect, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role = "staff", branch = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide name, email and password" });
    }

    if (role === "admin") {
      return res.status(403).json({ message: "Cannot create admin via this endpoint" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const status = "active";

    const insert = await pool.query(
      `INSERT INTO users (name, email, password, role, status, branch)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, branch, status`,
      [name, email, hashed, role, status, branch]
    );

    return res.status(201).json({ user: insert.rows[0], message: "Member created successfully" });
  } catch (err) {
    console.error("admin add-member:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ---------- AUTHENTICATOR: Setup (Generate QR Code) ---------- */
router.post("/authenticator/setup", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Handle synthetic admin (doesn't exist in database)
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Authenticator setup is not available for synthetic admin accounts. Please use a real user account." 
      });
    }
    
    // Get user email
    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Generate secret and QR code
    const { secret, qrCode, manualEntryKey } = await generateAuthenticatorSecret(userEmail);
    
    // Store secret temporarily (not enabled yet until verified)
    await pool.query(
      "UPDATE users SET authenticator_secret = $1 WHERE id = $2",
      [secret, userId]
    );
    
    return res.json({
      success: true,
      qrCode,
      manualEntryKey,
      message: "Scan QR code with your authenticator app"
    });
  } catch (err) {
    console.error("authenticator setup error:", err);
    return res.status(500).json({ message: err.message || "Failed to generate authenticator setup" });
  }
});

/* ---------- AUTHENTICATOR: Enable (Verify and Activate) ---------- */
router.post("/authenticator/enable", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    // Handle synthetic admin
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Authenticator is not available for synthetic admin accounts" 
      });
    }
    
    if (!token || token.length !== 6) {
      return res.status(400).json({ message: "Please provide a valid 6-digit code" });
    }
    
    // Get user's secret
    const userResult = await pool.query(
      "SELECT authenticator_secret FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows.length || !userResult.rows[0].authenticator_secret) {
      return res.status(400).json({ message: "Authenticator not set up. Please run setup first." });
    }
    
    const secret = userResult.rows[0].authenticator_secret;
    
    // Verify the code
    const isValid = verifyAuthenticatorCode(secret, token);
    
    if (!isValid) {
      return res.status(400).json({ message: "Invalid code. Please try again." });
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    
    // Enable authenticator
    await pool.query(
      "UPDATE users SET authenticator_enabled = TRUE, backup_codes = $1 WHERE id = $2",
      [backupCodes, userId]
    );
    
    return res.json({
      success: true,
      message: "Authenticator enabled successfully!",
      backupCodes,
    });
  } catch (err) {
    console.error("authenticator enable error:", err);
    return res.status(500).json({ message: "Failed to enable authenticator" });
  }
});

/* ---------- AUTHENTICATOR: Disable ---------- */
router.post("/authenticator/disable", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    // Handle synthetic admin
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Authenticator is not available for synthetic admin accounts" 
      });
    }
    
    if (!password) {
      return res.status(400).json({ message: "Password required to disable authenticator" });
    }
    
    // Verify password
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    
    // Disable authenticator
    await pool.query(
      "UPDATE users SET authenticator_enabled = FALSE, authenticator_secret = NULL, backup_codes = NULL WHERE id = $1",
      [userId]
    );
    
    return res.json({
      success: true,
      message: "Authenticator disabled successfully"
    });
  } catch (err) {
    console.error("authenticator disable error:", err);
    return res.status(500).json({ message: "Failed to disable authenticator" });
  }
});

/* ---------- AUTHENTICATOR: Status ---------- */
router.get("/authenticator/status", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Handle synthetic admin (doesn't exist in database)
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.json({
        enabled: false,
        backupCodesCount: 0,
      });
    }
    
    const result = await pool.query(
      "SELECT authenticator_enabled, backup_codes FROM users WHERE id = $1",
      [userId]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { authenticator_enabled, backup_codes } = result.rows[0];
    
    return res.json({
      enabled: authenticator_enabled || false,
      backupCodesCount: backup_codes ? backup_codes.length : 0,
    });
  } catch (err) {
    console.error("authenticator status error:", err);
    return res.status(500).json({ message: "Failed to get authenticator status" });
  }
});

/* ---------- AUTHENTICATOR DEVICES: List all devices ---------- */
router.get("/authenticator/devices", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Device management is not available for synthetic admin accounts" 
      });
    }
    
    const result = await pool.query(
      `SELECT id, device_name, device_type, device_fingerprint, is_active, last_used_at, created_at
       FROM authenticator_devices 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return res.json({ devices: result.rows });
  } catch (err) {
    console.error("Get devices error:", err);
    return res.status(500).json({ message: "Failed to retrieve devices" });
  }
});

/* ---------- AUTHENTICATOR DEVICES: Add new device ---------- */
router.post("/authenticator/devices/add", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceName, deviceType, deviceFingerprint } = req.body;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Device management is not available for synthetic admin accounts" 
      });
    }
    
    if (!deviceName) {
      return res.status(400).json({ message: "Device name is required" });
    }
    
    // Generate a unique secret for this device
    const userEmail = req.user.email;
    const appName = `SD-CRM (${deviceName})`;
    const { secret, qrCode, manualEntryKey, otpauthUrl } = await generateAuthenticatorSecret(userEmail, appName);
    
    // Insert device
    const result = await pool.query(
      `INSERT INTO authenticator_devices (user_id, device_name, device_type, device_fingerprint, secret, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, device_name, device_type, created_at`,
      [userId, deviceName, deviceType || 'unknown', deviceFingerprint || null, secret]
    );
    
    return res.json({
      success: true,
      device: result.rows[0],
      qrCode,
      manualEntryKey,
      message: "Device added successfully. Scan QR code with your authenticator app."
    });
  } catch (err) {
    console.error("Add device error:", err);
    return res.status(500).json({ message: "Failed to add device" });
  }
});

/* ---------- AUTHENTICATOR DEVICES: Verify and activate device ---------- */
router.post("/authenticator/devices/:deviceId/verify", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const { token } = req.body;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Device management is not available for synthetic admin accounts" 
      });
    }
    
    if (!token || token.length !== 6) {
      return res.status(400).json({ message: "Please provide a valid 6-digit code" });
    }
    
    // Get device secret
    const deviceResult = await pool.query(
      "SELECT secret, is_active FROM authenticator_devices WHERE id = $1 AND user_id = $2",
      [deviceId, userId]
    );
    
    if (!deviceResult.rows.length) {
      return res.status(404).json({ message: "Device not found" });
    }
    
    const { secret, is_active } = deviceResult.rows[0];
    
    // Verify the code
    const isValid = verifyAuthenticatorCode(secret, token);
    
    if (!isValid) {
      return res.status(400).json({ message: "Invalid code. Please try again." });
    }
    
    // Update last_used_at
    await pool.query(
      "UPDATE authenticator_devices SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1",
      [deviceId]
    );
    
    // Enable authenticator for user if not already enabled
    await pool.query(
      "UPDATE users SET authenticator_enabled = TRUE WHERE id = $1",
      [userId]
    );
    
    return res.json({
      success: true,
      message: "Device verified successfully!"
    });
  } catch (err) {
    console.error("Verify device error:", err);
    return res.status(500).json({ message: "Failed to verify device" });
  }
});

/* ---------- AUTHENTICATOR DEVICES: Remove device ---------- */
router.delete("/authenticator/devices/:deviceId", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const { password } = req.body;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Device management is not available for synthetic admin accounts" 
      });
    }
    
    if (!password) {
      return res.status(400).json({ message: "Password required to remove device" });
    }
    
    // Verify password
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    
    // Delete device
    const deleteResult = await pool.query(
      "DELETE FROM authenticator_devices WHERE id = $1 AND user_id = $2 RETURNING id",
      [deviceId, userId]
    );
    
    if (!deleteResult.rows.length) {
      return res.status(404).json({ message: "Device not found" });
    }
    
    // Check if user has any remaining active devices
    const remainingDevices = await pool.query(
      "SELECT COUNT(*) as count FROM authenticator_devices WHERE user_id = $1 AND is_active = TRUE",
      [userId]
    );
    
    // If no devices left, disable authenticator
    if (parseInt(remainingDevices.rows[0].count) === 0) {
      await pool.query(
        "UPDATE users SET authenticator_enabled = FALSE WHERE id = $1",
        [userId]
      );
    }
    
    return res.json({
      success: true,
      message: "Device removed successfully"
    });
  } catch (err) {
    console.error("Remove device error:", err);
    return res.status(500).json({ message: "Failed to remove device" });
  }
});

/* ---------- AUTHENTICATOR DEVICES: Toggle device active status ---------- */
router.patch("/authenticator/devices/:deviceId/toggle", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Device management is not available for synthetic admin accounts" 
      });
    }
    
    // Toggle device status
    const result = await pool.query(
      `UPDATE authenticator_devices 
       SET is_active = NOT is_active, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 
       RETURNING is_active`,
      [deviceId, userId]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ message: "Device not found" });
    }
    
    return res.json({
      success: true,
      isActive: result.rows[0].is_active,
      message: result.rows[0].is_active ? "Device activated" : "Device deactivated"
    });
  } catch (err) {
    console.error("Toggle device error:", err);
    return res.status(500).json({ message: "Failed to toggle device status" });
  }
});

/* ---------- AUTH SESSIONS: Get active sessions ---------- */
router.get("/sessions", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Session management is not available for synthetic admin accounts" 
      });
    }
    
    const result = await pool.query(
      `SELECT 
         s.id, s.login_method, s.device_id,
         s.ip_address, s.browser, s.os, s.device_type,
         s.login_at, s.expires_at, s.is_active,
         d.device_name
       FROM auth_sessions s
       LEFT JOIN authenticator_devices d ON s.device_id = d.id
       WHERE s.user_id = $1 AND s.is_active = TRUE
       ORDER BY s.login_at DESC`,
      [userId]
    );
    
    return res.json({ sessions: result.rows });
  } catch (err) {
    console.error("Get sessions error:", err);
    return res.status(500).json({ message: "Failed to retrieve sessions" });
  }
});

/* ---------- AUTH SESSIONS: Get login history ---------- */
router.get("/login-history", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Login history is not available for synthetic admin accounts" 
      });
    }
    
    const result = await pool.query(
      `SELECT 
         l.id, l.success, l.login_method, l.device_id,
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
    
    return res.json({ history: result.rows });
  } catch (err) {
    console.error("Get login history error:", err);
    return res.status(500).json({ message: "Failed to retrieve login history" });
  }
});

/* ---------- AUTH SESSIONS: Terminate specific session ---------- */
router.delete("/sessions/:sessionId", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { password } = req.body;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Session management is not available for synthetic admin accounts" 
      });
    }
    
    if (!password) {
      return res.status(400).json({ message: "Password required to terminate session" });
    }
    
    // Verify password
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    
    // Terminate session
    const result = await pool.query(
      `UPDATE auth_sessions 
       SET is_active = FALSE, logout_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, userId]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    return res.json({
      success: true,
      message: "Session terminated successfully"
    });
  } catch (err) {
    console.error("Terminate session error:", err);
    return res.status(500).json({ message: "Failed to terminate session" });
  }
});

/* ---------- AUTH SESSIONS: Terminate all other sessions ---------- */
router.post("/sessions/terminate-others", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    if (userId === 'admin-synthetic' || typeof userId === 'string') {
      return res.status(403).json({ 
        message: "Session management is not available for synthetic admin accounts" 
      });
    }
    
    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }
    
    // Verify password
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: "Incorrect password" });
    }
    
    // Get current session token
    const cookieToken = req.cookies?.token;
    const header = req.header("Authorization") || req.header("authorization");
    let currentToken = cookieToken;
    
    if (!currentToken && header) {
      currentToken = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header;
    }
    
    // Terminate all sessions except current
    await pool.query(
      `UPDATE auth_sessions 
       SET is_active = FALSE, logout_at = NOW()
       WHERE user_id = $1 AND session_token != $2 AND is_active = TRUE`,
      [userId, currentToken]
    );
    
    return res.json({
      success: true,
      message: "All other sessions terminated successfully"
    });
  } catch (err) {
    console.error("Terminate other sessions error:", err);
    return res.status(500).json({ message: "Failed to terminate sessions" });
  }
});

/* ---------- ACTIVITY LOGS ---------- */
// Get user activity logs
router.get("/activity-logs", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 100, offset = 0, actionType, resource, startDate, endDate } = req.query;

    const logs = await getActivityLogs(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      actionType,
      resource,
      startDate,
      endDate
    });

    // Log this activity view (skip for synthetic admin)
    if (userId !== "admin-synthetic") {
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      const userAgent = req.headers['user-agent'];
      await logActivity({
        userId,
        action: 'view_activity_logs',
        actionType: 'view',
        resource: 'activity_logs',
        description: 'Viewed activity logs',
        ipAddress,
        userAgent
      });
    }

    return res.json({ logs });
  } catch (err) {
    console.error('Get activity logs error:', err);
    return res.status(500).json({ message: 'Failed to load activity logs' });
  }
});

// Get activity statistics
router.get("/activity-stats", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const stats = await getActivityStats(userId, parseInt(days));

    return res.json({ stats });
  } catch (err) {
    console.error('Get activity stats error:', err);
    return res.status(500).json({ message: 'Failed to load activity statistics' });
  }
});

/* ---------- OTP Password Reset Implementation ---------- */
// 1. Request OTP for password reset
router.post("/request-reset-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    // Check if user exists
    const userRes = await pool.query(
      "SELECT id, email, status FROM users WHERE email = $1",
      [email]
    );
    if (userRes.rows.length === 0) {
      // Don't reveal if user exists
      return res.json({ message: "If the account exists, an OTP has been sent to your email" });
    }
    const user = userRes.rows[0];
    if (user.status !== "active") {
      return res.status(403).json({ message: "Account not active" });
    }
    // Generate and send OTP for password reset
    const otpCode = await createOTP(user.email, user.id, 'password_reset', 10); // 10 min expiry
    // Device metadata
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const userAgent = req.headers['user-agent'] || 'Unknown';
    let browser = '', os = '', deviceType = '';
    try {
      const { parseUserAgent } = await import('../utils/sessionHelper.js');
      ({ browser, os, deviceType } = parseUserAgent(userAgent));
    } catch {}
    await sendOTPEmail(user.email, otpCode, 'password_reset', {
      ipAddress,
      browser,
      os,
      deviceType,
      userAgent
    });
    return res.json({ message: "If the account exists, an OTP has been sent to your email", expiresIn: 10 });
  } catch (err) {
    console.error("Request password reset OTP error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

// 2. Verify OTP (optional, for frontend step-by-step flows)
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }
    const result = await verifyOTP(email, otp, 'password_reset');
    if (!result.valid) {
      return res.status(400).json({ message: result.error || "Invalid or expired OTP" });
    }
    return res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    console.error("Verify reset OTP error:", err);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
});

// 3. Reset password with OTP
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }
    // Verify OTP
    const result = await verifyOTP(email, otp, 'password_reset');
    if (!result.valid) {
      return res.status(400).json({ message: result.error || "Invalid or expired OTP" });
    }
    // Update password
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1 WHERE email = $2",
      [hashed, email]
    );
    return res.json({ success: true, message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
