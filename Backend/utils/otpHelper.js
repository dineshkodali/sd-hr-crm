// Backend/utils/otpHelper.js
import crypto from 'crypto';
import pool from '../config/db.js';
import nodemailer from 'nodemailer';
import { getEmailConfig } from '../config/emailConfig.js';

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Store OTP in database with expiration
 */
export async function createOTP(email, userId = null, otpType = 'login', expiryMinutes = 10) {
  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await pool.query(
    `INSERT INTO user_otps (user_id, email, otp_code, otp_type, expires_at, used)
     VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [userId, email, otpCode, otpType, expiresAt]
  );

  return otpCode;
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email, otpCode, otpType = 'login') {
  const result = await pool.query(
    `SELECT id, user_id, expires_at, used 
     FROM user_otps 
     WHERE email = $1 AND otp_code = $2 AND otp_type = $3 AND used = FALSE
     ORDER BY created_at DESC 
     LIMIT 1`,
    [email, otpCode, otpType]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid or expired OTP', userId: null };
  }

  const otp = result.rows[0];

  // Check if OTP is expired
  if (new Date() > new Date(otp.expires_at)) {
    return { valid: false, error: 'OTP has expired', userId: null };
  }

  // Mark OTP as used
  await pool.query('UPDATE user_otps SET used = TRUE WHERE id = $1', [otp.id]);

  return { valid: true, userId: otp.user_id, error: null };
}

/**
 * Clean up expired or used OTPs
 */
export async function cleanupExpiredOTPs() {
  await pool.query(
    `DELETE FROM user_otps 
     WHERE expires_at < NOW() 
     OR (used = TRUE AND created_at < NOW() - INTERVAL '24 hours')`
  );
}

/**
 * Send OTP via email with device and location metadata
 */
export async function sendOTPEmail(email, otpCode, otpType = 'login', metadata = {}) {
  try {
    const emailConfig = getEmailConfig();
    const emailConfigured = emailConfig.otp.user && 
                          emailConfig.otp.pass && 
                          emailConfig.otp.user !== 'your-email@gmail.com';

    if (!emailConfigured) {
      console.log("\n" + "=".repeat(50));
      console.log("⚠️  EMAIL NOT CONFIGURED - OTP logged to console");
      console.log("📧 To:", email);
      console.log("🔐 OTP Code:", otpCode);
      console.log("⏱️  Valid for 10 minutes");
      console.log("🎯 Type:", otpType);
      console.log("=".repeat(50) + "\n");
      return true;
    }

    // Remove spaces from app password (Gmail app passwords sometimes have spaces)
    const emailPassword = emailConfig.otp.pass.replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
      service: emailConfig.otp.service || 'gmail',
      auth: {
        user: emailConfig.otp.user,
        pass: emailPassword
      }
    });

    const subject = otpType === 'login' ? 'Your Login OTP Code - SD CRM' : 'Password Reset OTP - SD CRM';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 SD CRM Security</h1>
          </div>
          <div class="content">
            <h2>Your One-Time Password (OTP)</h2>
            <p>Hello,</p>
            <p>You requested to ${otpType === 'login' ? 'sign in to your account' : 'reset your password'}. Please use the following OTP code:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
              <p style="margin: 10px 0 0 0; color: #666;">Valid for 10 minutes</p>
            </div>

            <p><strong>Important:</strong></p>
            <ul>
              <li>This code expires in <strong>10 minutes</strong></li>
              <li>Never share this code with anyone</li>
              <li>SD CRM staff will never ask for your OTP</li>
            </ul>

            <div class="warning">
              <strong>⚠️ Didn't request this?</strong><br>
              If you didn't request this OTP, please secure your account immediately.
            </div>

            <p style="margin-top: 30px;">Best regards,<br><strong>SD CRM Security Team</strong></p>
          </div>
          <div class="footer">
            <p style="margin-bottom: 15px; padding: 15px; background: #f0f0f0; border-radius: 5px; text-align: left;">
              <strong>📍 Login Attempt Details:</strong><br>
              ${metadata.ipAddress ? `<span style="color: #555;">🌐 IP Address: ${metadata.ipAddress}</span><br>` : ''}
              ${metadata.browser ? `<span style="color: #555;">🖥️ Browser: ${metadata.browser}</span><br>` : ''}
              ${metadata.os ? `<span style="color: #555;">💻 Device: ${metadata.os}</span><br>` : ''}
              ${metadata.deviceType ? `<span style="color: #555;">📱 Type: ${metadata.deviceType}</span><br>` : ''}
              ${metadata.location ? `<span style="color: #555;">📍 Location: ${metadata.location}</span><br>` : ''}
              <span style="color: #555;">🕒 Time: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </p>
            <p>This is an automated message. Please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} SD CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: emailConfig.otp.from || emailConfig.otp.user,
      to: email,
      subject: subject,
      html: htmlContent
    });

    console.log("✅ OTP email sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Email send error:", error.message);
    
    // Fallback to console
    console.log("\n" + "=".repeat(50));
    console.log("⚠️  EMAIL FAILED - Fallback to console");
    console.log("📧 To:", email);
    console.log("🔐 OTP:", otpCode);
    console.log("=".repeat(50) + "\n");
    
    return true;
  }
}
