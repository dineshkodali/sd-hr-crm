// Backend/utils/authenticatorUtils.js
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate a new authenticator secret and QR code for a user
 */
export async function generateAuthenticatorSecret(userEmail, appName = 'SD-CRM') {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${userEmail})`,
    length: 32,
  });

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32, // Store this in database
    qrCode: qrCodeUrl,
    manualEntryKey: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyAuthenticatorCode(secret, token) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2, // Allow 60 seconds time drift
  });
}

/**
 * Generate backup codes for account recovery
 */
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Verify a backup code
 */
export function verifyBackupCode(storedCodes, providedCode) {
  if (!Array.isArray(storedCodes)) return { valid: false, remainingCodes: [] };
  
  const upperCode = providedCode.toUpperCase().trim();
  const index = storedCodes.indexOf(upperCode);
  
  if (index === -1) {
    return { valid: false, remainingCodes: storedCodes };
  }
  
  // Remove used code
  const remainingCodes = storedCodes.filter((_, i) => i !== index);
  return { valid: true, remainingCodes };
}
