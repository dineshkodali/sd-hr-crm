// Backend/routes/email-config.js
import express from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { getEmailConfig, updateEmailConfig, isEmailConfigured } from '../config/emailConfig.js';

const router = express.Router();

// Get email configuration status (without exposing credentials)
router.get('/status', protect, requireRole(['admin']), async (req, res) => {
  try {
    const config = getEmailConfig();
    
    // Return masked configuration (security: don't expose actual credentials)
    const maskedConfig = {
      otp: {
        service: config.otp.service,
        user: config.otp.user ? maskEmail(config.otp.user) : '',
        configured: !!(config.otp.user && config.otp.pass),
        from: config.otp.from ? maskEmail(config.otp.from) : ''
      },
      notifications: {
        host: config.notifications.host,
        port: config.notifications.port,
        user: config.notifications.user ? maskEmail(config.notifications.user) : '',
        configured: !!(config.notifications.user && config.notifications.password),
        fromName: config.notifications.fromName
      },
      isConfigured: isEmailConfigured()
    };
    
    return res.json({ config: maskedConfig });
  } catch (error) {
    console.error('Get email config status error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update email configuration
router.put('/update', protect, requireRole(['admin']), async (req, res) => {
  try {
    const { otp, notifications } = req.body;
    
    const updateData = {};
    
    if (otp) {
      updateData.otp = {};
      if (otp.service) updateData.otp.service = otp.service;
      if (otp.user) updateData.otp.user = otp.user;
      if (otp.pass) updateData.otp.pass = otp.pass;
      if (otp.from) updateData.otp.from = otp.from;
    }
    
    if (notifications) {
      updateData.notifications = {};
      if (notifications.host) updateData.notifications.host = notifications.host;
      if (notifications.port) updateData.notifications.port = parseInt(notifications.port);
      if (notifications.user) updateData.notifications.user = notifications.user;
      if (notifications.password) updateData.notifications.password = notifications.password;
      if (notifications.fromName) updateData.notifications.fromName = notifications.fromName;
    }
    
    const updatedConfig = updateEmailConfig(updateData);
    
    // Return masked configuration
    const maskedConfig = {
      otp: {
        service: updatedConfig.otp.service,
        user: updatedConfig.otp.user ? maskEmail(updatedConfig.otp.user) : '',
        configured: !!(updatedConfig.otp.user && updatedConfig.otp.pass),
        from: updatedConfig.otp.from ? maskEmail(updatedConfig.otp.from) : ''
      },
      notifications: {
        host: updatedConfig.notifications.host,
        port: updatedConfig.notifications.port,
        user: updatedConfig.notifications.user ? maskEmail(updatedConfig.notifications.user) : '',
        configured: !!(updatedConfig.notifications.user && updatedConfig.notifications.password),
        fromName: updatedConfig.notifications.fromName
      }
    };
    
    return res.json({ 
      message: 'Email configuration updated successfully',
      config: maskedConfig 
    });
  } catch (error) {
    console.error('Update email config error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test email configuration
router.post('/test', protect, requireRole(['admin']), async (req, res) => {
  try {
    const { type, recipientEmail } = req.body; // type: 'otp' or 'notification'
    
    if (!recipientEmail) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }
    
    if (type === 'otp') {
      // Test OTP email
      const { sendOTPEmail } = await import('../utils/otpHelper.js');
      const testOTP = '123456';
      await sendOTPEmail(recipientEmail, testOTP, 'test', {
        device: 'Test Device',
        location: 'Test Location'
      });
      return res.json({ message: 'Test OTP email sent successfully' });
    } else if (type === 'notification') {
      // Test notification email
      const { sendEmailFromTemplate } = await import('../utils/emailNotificationHelper.js');
      
      // Create a simple test template or use existing one
      const nodemailer = (await import('nodemailer')).default;
      const { getEmailConfig } = await import('../config/emailConfig.js');
      const emailConfig = getEmailConfig();
      
      const transporter = nodemailer.createTransport({
        host: emailConfig.notifications.host,
        port: emailConfig.notifications.port,
        secure: false,
        auth: {
          user: emailConfig.notifications.user,
          pass: emailConfig.notifications.password,
        },
      });
      
      await transporter.sendMail({
        from: `"${emailConfig.notifications.fromName}" <${emailConfig.notifications.user}>`,
        to: recipientEmail,
        subject: 'Test Email Configuration',
        html: '<h1>Test Email</h1><p>This is a test email from SD CRM. Your email notification system is configured correctly.</p>',
      });
      
      return res.json({ message: 'Test notification email sent successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid type. Use "otp" or "notification"' });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return res.status(500).json({ 
      message: 'Failed to send test email', 
      error: error.message 
    });
  }
});

// Helper function to mask email addresses
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const maskedLocal = local.substring(0, 2) + '***' + local.substring(local.length - 1);
  return maskedLocal + '@' + domain;
}

export default router;
