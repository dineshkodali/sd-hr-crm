-- Email Notification Templates and Logs
-- Schema: public (or maintenance if preferred)

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    module VARCHAR(100) NOT NULL, -- e.g., 'litigation', 'maintenance', 'hr', 'incidents'
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    description TEXT,
    variables JSONB, -- Available variables like {user_name}, {case_reference}, etc.
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Notification Logs Table
CREATE TABLE IF NOT EXISTS email_notifications_log (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES email_templates(id) ON DELETE SET NULL,
    module VARCHAR(100),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB, -- Additional data like user_id, record_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module Email Settings Table
CREATE TABLE IF NOT EXISTS email_module_settings (
    id SERIAL PRIMARY KEY,
    module VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    notify_on_create BOOLEAN DEFAULT false,
    notify_on_update BOOLEAN DEFAULT false,
    notify_on_delete BOOLEAN DEFAULT false,
    notify_on_status_change BOOLEAN DEFAULT true,
    notify_roles JSONB, -- Array of roles to notify, e.g., ["admin", "manager"]
    notify_users JSONB, -- Array of specific user IDs to notify
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_templates_module ON email_templates(module);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON email_notifications_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created ON email_notifications_log(created_at);

-- Insert default templates
INSERT INTO email_templates (name, module, subject, body, description, variables, is_system, is_active) VALUES
('New Litigation Case', 'litigation', 'New Litigation Case Created: {case_reference}', 
'<html><body><h2>New Litigation Case</h2><p>Dear {recipient_name},</p><p>A new litigation case has been created:</p><ul><li><strong>Reference:</strong> {case_reference}</li><li><strong>Title:</strong> {case_title}</li><li><strong>Priority:</strong> {priority}</li><li><strong>Status:</strong> {status}</li><li><strong>Created By:</strong> {created_by}</li></ul><p>Please review the case details in the system.</p><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification sent when a new litigation case is created',
'{"case_reference": "Case reference number", "case_title": "Case title", "priority": "Case priority", "status": "Case status", "created_by": "User who created the case", "recipient_name": "Recipient name"}'::jsonb,
true, true),

('Maintenance Request Created', 'maintenance', 'New Maintenance Request: {request_id}',
'<html><body><h2>Maintenance Request</h2><p>Dear {recipient_name},</p><p>A new maintenance request has been submitted:</p><ul><li><strong>Request ID:</strong> {request_id}</li><li><strong>Property:</strong> {property_name}</li><li><strong>Priority:</strong> {priority}</li><li><strong>Description:</strong> {description}</li></ul><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification for new maintenance requests',
'{"request_id": "Request ID", "property_name": "Property name", "priority": "Priority level", "description": "Request description", "recipient_name": "Recipient name"}'::jsonb,
true, true),

('Incident Report Filed', 'incidents', 'New Incident Report: {incident_id}',
'<html><body><h2>Incident Report</h2><p>Dear {recipient_name},</p><p>An incident has been reported:</p><ul><li><strong>Incident ID:</strong> {incident_id}</li><li><strong>Type:</strong> {incident_type}</li><li><strong>Severity:</strong> {severity}</li><li><strong>Location:</strong> {location}</li><li><strong>Reported By:</strong> {reported_by}</li></ul><p>Immediate attention may be required.</p><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification for incident reports',
'{"incident_id": "Incident ID", "incident_type": "Type of incident", "severity": "Severity level", "location": "Incident location", "reported_by": "Reporter name", "recipient_name": "Recipient name"}'::jsonb,
true, true),

('HR Document Uploaded', 'hr', 'New HR Document: {document_name}',
'<html><body><h2>HR Document Notification</h2><p>Dear {recipient_name},</p><p>A new HR document has been uploaded:</p><ul><li><strong>Document:</strong> {document_name}</li><li><strong>Employee:</strong> {employee_name}</li><li><strong>Type:</strong> {document_type}</li></ul><p>Best regards,<br/>HR Department</p></body></html>',
'Notification for HR document uploads',
'{"document_name": "Document name", "employee_name": "Employee name", "document_type": "Document type", "recipient_name": "Recipient name"}'::jsonb,
true, true),

('Task Assigned', 'tasks', 'Task Assigned: {task_title}',
'<html><body><h2>Task Assignment</h2><p>Dear {recipient_name},</p><p>You have been assigned a new task:</p><ul><li><strong>Title:</strong> {task_title}</li><li><strong>Priority:</strong> {priority}</li><li><strong>Due Date:</strong> {due_date}</li><li><strong>Assigned By:</strong> {assigned_by}</li></ul><p>Please complete this task by the due date.</p><p>Best regards,<br/>System Administrator</p></body></html>',
'Notification for task assignments',
'{"task_title": "Task title", "priority": "Priority level", "due_date": "Due date", "assigned_by": "Assigner name", "recipient_name": "Recipient name"}'::jsonb,
true, true)

ON CONFLICT (name) DO NOTHING;

-- Insert default module settings
INSERT INTO email_module_settings (module, enabled, notify_on_create, notify_on_update, notify_on_status_change, notify_roles) VALUES
('litigation', true, true, false, true, '["admin", "manager"]'::jsonb),
('maintenance', true, true, false, true, '["admin", "manager"]'::jsonb),
('incidents', true, true, false, true, '["admin", "manager"]'::jsonb),
('hr', true, true, false, false, '["admin"]'::jsonb),
('tasks', true, true, false, true, '["admin", "manager"]'::jsonb),
('complaints', true, true, false, true, '["admin", "manager"]'::jsonb),
('safeguarding', true, true, true, true, '["admin", "manager"]'::jsonb)
ON CONFLICT (module) DO NOTHING;

COMMENT ON TABLE email_templates IS 'Email templates for system notifications';
COMMENT ON TABLE email_notifications_log IS 'Log of all sent email notifications';
COMMENT ON TABLE email_module_settings IS 'Email notification settings per module';
