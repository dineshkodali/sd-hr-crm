// Backend/routes/email-notifications.js
import express from 'express';
import pool from '../config/db.js';
import { protect, requireRole } from '../middleware/auth.js';
import {
  sendEmailFromTemplate,
  notifyModuleUsers,
  getEmailStats,
  replaceVariables
} from '../utils/emailNotificationHelper.js';

const router = express.Router();

// Get all email templates
router.get('/templates', protect, async (req, res) => {
  try {
    const { module, is_active } = req.query;

    let query = 'SELECT * FROM email_templates WHERE 1=1';
    const params = [];

    if (module) {
      params.push(module);
      query += ` AND module = $${params.length}`;
    }

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY module, name';

    const result = await pool.query(query, params);

    return res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get templates error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Preview template with variables (MUST be before /:id routes)
router.post('/templates/preview', protect, async (req, res) => {
  try {
    const { subject, body, variables } = req.body;

    const previewSubject = replaceVariables(subject, variables);
    const previewBody = replaceVariables(body, variables);

    return res.json({
      subject: previewSubject,
      body: previewBody
    });
  } catch (error) {
    console.error('Preview template error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single template
router.get('/templates/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM email_templates WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    return res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Get template error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create email template
router.post('/templates', protect, requireRole(['admin']), async (req, res) => {
  try {
    const { name, module, subject, body, description, variables, is_active } = req.body;

    if (!name || !module || !subject || !body) {
      return res.status(400).json({ message: 'Name, module, subject, and body are required' });
    }

    const result = await pool.query(
      `INSERT INTO email_templates 
       (name, module, subject, body, description, variables, is_active, is_system, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, module, subject, body, description || null,
        variables ? JSON.stringify(variables) : null,
        is_active !== false, false, req.user.id, req.user.id]
    );

    return res.status(201).json({
      template: result.rows[0],
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('Create template error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Template name already exists' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update email template
router.put('/templates/:id', protect, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, module, subject, body, description, variables, is_active } = req.body;

    // Check if template exists and is not system template
    const checkResult = await pool.query(
      'SELECT is_system FROM email_templates WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const isSystem = checkResult.rows[0].is_system;

    const result = await pool.query(
      `UPDATE email_templates 
       SET name = $1, module = $2, subject = $3, body = $4, description = $5, 
           variables = $6, is_active = $7, updated_by = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, module, subject, body, description || null,
        variables ? JSON.stringify(variables) : null,
        is_active !== false, req.user.id, id]
    );

    return res.json({
      template: result.rows[0],
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('Update template error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Template name already exists' });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete email template
router.delete('/templates/:id', protect, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is system template
    const checkResult = await pool.query(
      'SELECT is_system, name FROM email_templates WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (checkResult.rows[0].is_system) {
      return res.status(403).json({ message: 'Cannot delete system template' });
    }

    await pool.query('DELETE FROM email_templates WHERE id = $1', [id]);

    return res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// (preview route moved above /:id routes)

// Send test email
router.post('/templates/:id/test', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientEmail, variables } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    const result = await sendEmailFromTemplate({
      templateId: id,
      recipientEmail,
      recipientName: req.user.name,
      variables: variables || {},
      metadata: { test: true, sent_by: req.user.id }
    });

    if (result.success) {
      return res.json({ message: 'Test email sent successfully', logId: result.logId });
    } else {
      return res.status(500).json({ message: result.message || 'Failed to send test email' });
    }
  } catch (error) {
    console.error('Send test email error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get notification logs
router.get('/logs', protect, async (req, res) => {
  try {
    const { status, module, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT enl.*, et.name as template_name, et.module
      FROM email_notifications_log enl
      LEFT JOIN email_templates et ON enl.template_id = et.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND enl.status = $${params.length}`;
    }

    if (module) {
      params.push(module);
      query += ` AND enl.module = $${params.length}`;
    }

    query += ' ORDER BY enl.created_at DESC';

    params.push(limit);
    query += ` LIMIT $${params.length}`;

    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM email_notifications_log WHERE 1=1';
    const countParams = [];

    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }

    if (module) {
      countParams.push(module);
      countQuery += ` AND module = $${countParams.length}`;
    }

    const countResult = await pool.query(countQuery, countParams);

    return res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get notification statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await getEmailStats();

    // Get stats by module
    const moduleStats = await pool.query(`
      SELECT module, COUNT(*) as count
      FROM email_notifications_log
      GROUP BY module
      ORDER BY count DESC
    `);

    // Get recent activity (last 7 days)
    const recentActivity = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM email_notifications_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    return res.json({
      ...stats,
      byModule: moduleStats.rows,
      recentActivity: recentActivity.rows
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get module settings
router.get('/settings', protect, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_module_settings ORDER BY module');

    return res.json({ settings: result.rows });
  } catch (error) {
    console.error('Get module settings error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update module settings
router.put('/settings/:module', protect, requireRole(['admin']), async (req, res) => {
  try {
    const { module } = req.params;
    const {
      enabled,
      notify_on_create,
      notify_on_update,
      notify_on_delete,
      notify_on_status_change,
      notify_roles,
      notify_users,
      custom_triggers
    } = req.body;

    // First try to ensure the custom_triggers column exists
    try {
      await pool.query('ALTER TABLE email_module_settings ADD COLUMN IF NOT EXISTS custom_triggers JSONB DEFAULT \'{}\'::jsonb');
    } catch (e) {
      console.warn('Could not auto-add custom_triggers column:', e.message);
    }

    const result = await pool.query(
      `INSERT INTO email_module_settings 
       (module, enabled, notify_on_create, notify_on_update, notify_on_delete, 
        notify_on_status_change, notify_roles, notify_users, custom_triggers, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (module) 
       DO UPDATE SET 
         enabled = $2,
         notify_on_create = $3,
         notify_on_update = $4,
         notify_on_delete = $5,
         notify_on_status_change = $6,
         notify_roles = $7,
         notify_users = $8,
         custom_triggers = $9,
         updated_at = NOW()
       RETURNING *`,
      [module, enabled, notify_on_create, notify_on_update, notify_on_delete,
        notify_on_status_change, JSON.stringify(notify_roles || []), JSON.stringify(notify_users || []), JSON.stringify(custom_triggers || {})]
    );

    return res.json({
      settings: result.rows[0],
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update module settings error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get available modules
router.get('/modules', protect, async (req, res) => {
  try {
    const modules = [
      // Core entities
      { value: 'staff', label: 'Staff Management' },
      { value: 'service_users', label: 'Service Users' },
      { value: 'hotels', label: 'Hotels & Properties' },
      { value: 'rooms', label: 'Rooms Management' },
      // Operations
      { value: 'bookings', label: 'Bookings' },
      { value: 'move_in_out', label: 'Move In/Out' },
      { value: 'meal_management', label: 'Meal Management' },
      { value: 'tasks', label: 'Tasks' },
      // Compliance & Risk
      { value: 'incidents', label: 'Incidents' },
      { value: 'safeguarding', label: 'Safeguarding' },
      { value: 'compliance', label: 'Compliance' },
      { value: 'inspections', label: 'Inspections' },
      { value: 'risk_assessments', label: 'Risk Assessments' },
      { value: 'case_management', label: 'Case Management' },
      { value: 'litigation', label: 'Litigation' },
      { value: 'complaints', label: 'Complaints' },
      { value: 'maintenance', label: 'Maintenance' },
      // HR
      { value: 'hr', label: 'HR Management' },
      { value: 'payroll', label: 'Payroll' },
      { value: 'training', label: 'Training' },
      { value: 'performance', label: 'Performance' },
      // HSE
      { value: 'hse', label: 'HSE' },
      { value: 'hse_audits', label: 'HSE Audits' },
      // Other
      { value: 'reports', label: 'Reports' },
      // Custom
      { value: 'custom', label: 'Custom Module...' },
    ];

    return res.json({ modules });
  } catch (error) {
    console.error('Get modules error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
