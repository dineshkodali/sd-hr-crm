// Backend/utils/emailNotificationHelper.js
import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { getEmailConfig } from '../config/emailConfig.js';

// Create transporter (using encrypted configuration)
const createTransporter = () => {
  const emailConfig = getEmailConfig();
  return nodemailer.createTransport({
    host: emailConfig.notifications.host || 'smtp.gmail.com',
    port: emailConfig.notifications.port || 587,
    secure: false,
    auth: {
      user: emailConfig.notifications.user,
      pass: emailConfig.notifications.password,
    },
  });
};

/**
 * Replace variables in template with actual values
 * @param {string} text - Template text with {variable} placeholders
 * @param {object} variables - Object with variable values
 * @returns {string} Text with variables replaced
 */
export function replaceVariables(text, variables) {
  if (!text) return '';
  let result = text;
  for (const [key, value] of Object.entries(variables || {})) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * Send email using template
 * @param {object} options
 * @param {number} options.templateId - Template ID
 * @param {string} options.recipientEmail - Recipient email
 * @param {string} options.recipientName - Recipient name
 * @param {object} options.variables - Variables to replace in template
 * @param {object} options.metadata - Additional metadata to log
 * @returns {Promise<object>} Result object
 */
export async function sendEmailFromTemplate({
  templateId,
  recipientEmail,
  recipientName,
  variables = {},
  metadata = {}
}) {
  let logId;
  try {
    // Get template
    const templateResult = await pool.query(
      'SELECT * FROM email_templates WHERE id = $1 AND is_active = true',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      throw new Error('Template not found or inactive');
    }

    const template = templateResult.rows[0];

    // Add recipient_name to variables if not present
    if (!variables.recipient_name) {
      variables.recipient_name = recipientName || recipientEmail;
    }

    // Replace variables in subject and body
    const subject = replaceVariables(template.subject, variables);
    const body = replaceVariables(template.body, variables);

    // Create log entry
    const logResult = await pool.query(
      `INSERT INTO email_notifications_log 
       (template_id, module, recipient_email, recipient_name, subject, body, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [templateId, template.module, recipientEmail, recipientName, subject, body, 'pending', JSON.stringify(metadata)]
    );

    logId = logResult.rows[0].id;

    // Send email
    const emailConfig = getEmailConfig();
    if (emailConfig.notifications.user && emailConfig.notifications.password) {
      const transporter = createTransporter();
      
      await transporter.sendMail({
        from: `"${emailConfig.notifications.fromName || 'System'}" <${emailConfig.notifications.user}>`,
        to: recipientEmail,
        subject: subject,
        html: body,
      });

      // Update log as sent
      await pool.query(
        'UPDATE email_notifications_log SET status = $1, sent_at = NOW() WHERE id = $2',
        ['sent', logId]
      );

      return { success: true, logId, message: 'Email sent successfully' };
    } else {
      // Email not configured, just log it
      console.log('Email would be sent:', { recipientEmail, subject });
      await pool.query(
        'UPDATE email_notifications_log SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', 'Email not configured', logId]
      );
      
      return { success: false, logId, message: 'Email configuration missing' };
    }
  } catch (error) {
    console.error('Send email error:', error);
    
    // Try to update log if we have logId
    try {
      if (logId) {
        await pool.query(
          'UPDATE email_notifications_log SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error.message, logId]
        );
      }
    } catch (logError) {
      console.error('Failed to update log:', logError);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Send notification to module users
 * @param {string} module - Module name
 * @param {string} templateName - Template name
 * @param {object} variables - Variables for template
 * @param {object} metadata - Additional metadata
 */
export async function notifyModuleUsers(module, templateName, variables, metadata = {}) {
  try {
    // Get module settings
    const settingsResult = await pool.query(
      'SELECT * FROM email_module_settings WHERE module = $1 AND enabled = true',
      [module]
    );

    if (settingsResult.rows.length === 0) {
      console.log(`Email notifications disabled for module: ${module}`);
      return { success: false, message: 'Module notifications disabled' };
    }

    const settings = settingsResult.rows[0];

    // Get template
    const templateResult = await pool.query(
      'SELECT id FROM email_templates WHERE name = $1 AND module = $2 AND is_active = true',
      [templateName, module]
    );

    if (templateResult.rows.length === 0) {
      console.log(`Template not found: ${templateName} for module: ${module}`);
      return { success: false, message: 'Template not found' };
    }

    const templateId = templateResult.rows[0].id;

    // Get users to notify based on roles
    const notifyRoles = settings.notify_roles || [];
    const notifyUsers = settings.notify_users || [];

    let users = [];

    if (notifyRoles.length > 0) {
      const rolesResult = await pool.query(
        'SELECT id, email, name FROM users WHERE role = ANY($1) AND email IS NOT NULL',
        [notifyRoles]
      );
      users = users.concat(rolesResult.rows);
    }

    if (notifyUsers.length > 0) {
      const usersResult = await pool.query(
        'SELECT id, email, name FROM users WHERE id = ANY($1) AND email IS NOT NULL',
        [notifyUsers]
      );
      users = users.concat(usersResult.rows);
    }

    // Remove duplicates
    users = users.filter((user, index, self) =>
      index === self.findIndex((u) => u.id === user.id)
    );

    // Send email to each user
    const results = await Promise.allSettled(
      users.map(user =>
        sendEmailFromTemplate({
          templateId,
          recipientEmail: user.email,
          recipientName: user.name,
          variables,
          metadata: { ...metadata, user_id: user.id }
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - sent;

    return { success: true, sent, failed, total: results.length };
  } catch (error) {
    console.error('Notify module users error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get email notification statistics
 */
export async function getEmailStats() {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) as total
      FROM email_notifications_log
    `);

    return stats.rows[0];
  } catch (error) {
    console.error('Get email stats error:', error);
    return { sent: 0, failed: 0, pending: 0, total: 0 };
  }
}
