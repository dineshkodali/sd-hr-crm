/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    Home,
    Mail,
    Search,
    ChevronDown,
    Filter,
    Download,
    X,
    Edit,
    Trash2,
    Eye,
    AlertCircle,
    CheckCircle,
    Clock,
    Send,
    Plus,
    Settings,
    FileText,
    Activity
} from "lucide-react";

export default function EmailNotifications({ user }) {
    const [activeTab, setActiveTab] = useState('templates');
    const [templates, setTemplates] = useState([]);
    const [logs, setLogs] = useState([]);
    const [moduleSettings, setModuleSettings] = useState([]);
    const [stats, setStats] = useState({ sent: 0, failed: 0, pending: 0, total: 0 });
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterModule, setFilterModule] = useState('All Modules');
    const [filterStatus, setFilterStatus] = useState('All Status');

    // Modal states
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showTestEmailModal, setShowTestEmailModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedSettings, setSelectedSettings] = useState(null);
    const [modalMode, setModalMode] = useState('create');

    // Form states
    const [templateForm, setTemplateForm] = useState({
        name: '',
        module: '',
        subject: '',
        body: '',
        description: '',
        variables: {},
        is_active: true
    });

    const [testEmail, setTestEmail] = useState('');
    const [previewVariables, setPreviewVariables] = useState({});
    const [message, setMessage] = useState({ type: '', text: '' });

    axios.defaults.withCredentials = true;

    useEffect(() => {
        loadData();
        loadModules();
    }, [activeTab]);

    // Hide sidebar and navbar when modal is open
    useEffect(() => {
        const isAnyModalOpen = showTemplateModal || showPreviewModal || showTestEmailModal || showSettingsModal;
        if (isAnyModalOpen) {
            document.body.classList.add('form-modal-open');
        } else {
            document.body.classList.remove('form-modal-open');
        }
        // Cleanup on unmount
        return () => {
            document.body.classList.remove('form-modal-open');
        };
    }, [showTemplateModal, showPreviewModal, showTestEmailModal, showSettingsModal]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'templates') {
                const res = await axios.get('/api/email-notifications/templates');
                setTemplates(res.data.templates || []);
            } else if (activeTab === 'logs') {
                const [logsRes, statsRes] = await Promise.all([
                    axios.get('/api/email-notifications/logs?limit=100'),
                    axios.get('/api/email-notifications/stats')
                ]);
                setLogs(logsRes.data.logs || []);
                setStats(statsRes.data || {});
            } else if (activeTab === 'settings') {
                const res = await axios.get('/api/email-notifications/settings');
                setModuleSettings(res.data.settings || []);
            }
        } catch (error) {
            console.error('Load data error:', error);
            showMessage('error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const loadModules = async () => {
        try {
            const res = await axios.get('/api/email-notifications/modules');
            setModules(res.data.modules || []);
        } catch (error) {
            console.error('Load modules error:', error);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    const handleCreateTemplate = () => {
        setTemplateForm({
            name: '',
            module: '',
            subject: '',
            body: '',
            description: '',
            variables: {},
            is_active: true
        });
        setModalMode('create');
        setShowTemplateModal(true);
    };

    const handleEditTemplate = (template) => {
        setSelectedTemplate(template);
        setTemplateForm({
            name: template.name,
            module: template.module,
            subject: template.subject,
            body: template.body,
            description: template.description || '',
            variables: template.variables || {},
            is_active: template.is_active
        });
        setModalMode('edit');
        setShowTemplateModal(true);
    };

    const handleSaveTemplate = async () => {
        try {
            // Auto-extract variables from subject and body
            const allText = (templateForm.subject || '') + ' ' + (templateForm.body || '');
            const matches = allText.match(/\{([a-zA-Z_]+)\}/g) || [];
            const extractedVars = {};
            matches.forEach(m => {
                const varName = m.replace(/[{}]/g, '');
                extractedVars[varName] = varName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            });

            // Handle custom module name
            let finalModule = templateForm.module;
            if (templateForm.module === 'custom' && templateForm.customModuleName) {
                // simple slugify
                finalModule = templateForm.customModuleName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            }

            const formToSave = { ...templateForm, module: finalModule, variables: extractedVars };

            if (modalMode === 'create') {
                await axios.post('/api/email-notifications/templates', formToSave);
                showMessage('success', 'Template created successfully');
            } else {
                await axios.put(`/api/email-notifications/templates/${selectedTemplate.id}`, formToSave);
                showMessage('success', 'Template updated successfully');
            }
            setShowTemplateModal(false);
            loadData();
        } catch (error) {
            console.error('Save template error:', error);
            showMessage('error', error.response?.data?.message || 'Failed to save template');
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            await axios.delete(`/api/email-notifications/templates/${id}`);
            showMessage('success', 'Template deleted successfully');
            loadData();
        } catch (error) {
            console.error('Delete template error:', error);
            showMessage('error', error.response?.data?.message || 'Failed to delete template');
        }
    };

    const handleTestEmail = async () => {
        if (!testEmail) {
            showMessage('error', 'Please enter an email address');
            return;
        }

        try {
            await axios.post(`/api/email-notifications/templates/${selectedTemplate.id}/test`, {
                recipientEmail: testEmail,
                variables: previewVariables
            });
            showMessage('success', 'Test email sent successfully');
            setShowTestEmailModal(false);
            setTestEmail('');
        } catch (error) {
            console.error('Test email error:', error);
            showMessage('error', 'Failed to send test email');
        }
    };

    const handleUpdateSettings = async (module, settings) => {
        try {
            await axios.put(`/api/email-notifications/settings/${module}`, settings);
            showMessage('success', 'Settings updated successfully');
            loadData();
            setShowSettingsModal(false);
        } catch (error) {
            console.error('Update settings error:', error);
            showMessage('error', 'Failed to update settings');
        }
    };

    // Filtered templates
    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            const matchesSearch = !searchQuery ||
                template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.subject.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesModule = filterModule === 'All Modules' || template.module === filterModule;

            return matchesSearch && matchesModule;
        });
    }, [templates, searchQuery, filterModule]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = !searchQuery ||
                log.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.subject.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesModule = filterModule === 'All Modules' || log.module === filterModule;
            const matchesStatus = filterStatus === 'All Status' || log.status === filterStatus;

            return matchesSearch && matchesModule && matchesStatus;
        });
    }, [logs, searchQuery, filterModule, filterStatus]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusColor = (status) => {
        if (status === 'sent') return { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' };
        if (status === 'failed') return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
        return { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' };
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">
                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Notifications</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Home className="w-4 h-4" />
                            <span>&gt;</span>
                            <span>Settings</span>
                            <span>&gt;</span>
                            <span>Email Notifications</span>
                        </div>
                    </div>
                    {activeTab === 'templates' && (
                        <button
                            onClick={handleCreateTemplate}
                            className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md "
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Template</span>
                        </button>
                    )}
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 ">
                        <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            <Mail className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Sent</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.sent || 0}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 ">
                        <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Success Rate</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">
                                {stats.total ? Math.round((stats.sent / stats.total) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 ">
                        <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Failed</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.failed || 0}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 ">
                        <div className="bg-yellow-100 text-yellow-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Pending</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.pending || 0}</div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                    <div className="border-b border-gray-200 px-6">
                        <div className="flex gap-8">
                            <button
                                onClick={() => setActiveTab('templates')}
                                className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates'
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    <span>Templates</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('logs')}
                                className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'logs'
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    <span>Email Logs</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings'
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    <span>Module Settings</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                                />
                            </div>

                            <select
                                value={filterModule}
                                onChange={(e) => setFilterModule(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm bg-white"
                            >
                                <option>All Modules</option>
                                {modules.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            {activeTab === 'logs' && (
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm bg-white"
                                >
                                    <option>All Status</option>
                                    <option value="sent">Sent</option>
                                    <option value="failed">Failed</option>
                                    <option value="pending">Pending</option>
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                                <p className="mt-2 text-gray-500">Loading...</p>
                            </div>
                        ) : (
                            <>
                                {/* Templates Tab */}
                                {activeTab === 'templates' && (
                                    <div className="space-y-4">
                                        {filteredTemplates.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                                <p className="text-gray-500">No templates found</p>
                                            </div>
                                        ) : (
                                            filteredTemplates.map(template => (
                                                <div key={template.id} className="bg-gray-50 rounded-xl p-5 transition-all border border-gray-200">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                                                                <span className="px-3 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                                                                    {template.module}
                                                                </span>
                                                                {template.is_system && (
                                                                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                                                        System
                                                                    </span>
                                                                )}
                                                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${template.is_active
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-gray-200 text-gray-600'
                                                                    }`}>
                                                                    {template.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 mb-2"><strong>Subject:</strong> {template.subject}</p>
                                                            {template.description && (
                                                                <p className="text-sm text-gray-500">{template.description}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-4">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedTemplate(template);
                                                                    setShowPreviewModal(true);
                                                                }}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                                                title="Preview"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedTemplate(template);
                                                                    setShowTestEmailModal(true);
                                                                }}
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                                                                title="Send Test"
                                                            >
                                                                <Send className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditTemplate(template)}
                                                                className="p-2 text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            {!template.is_system && (
                                                                <button
                                                                    onClick={() => handleDeleteTemplate(template.id)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Logs Tab */}
                                {activeTab === 'logs' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-[var(--bg-primary)]">
                                                <tr className="border-b border-[var(--border-color)]">
                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Recipient</th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Subject</th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Module</th>
                                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-12 text-gray-500">
                                                            No logs found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredLogs.map(log => {
                                                        const statusColor = getStatusColor(log.status);
                                                        return (
                                                            <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                                    {formatDate(log.created_at)}
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <div className="text-sm font-medium text-gray-900">{log.recipient_email}</div>
                                                                    {log.recipient_name && (
                                                                        <div className="text-xs text-gray-500">{log.recipient_name}</div>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4 text-sm text-gray-700">{log.subject}</td>
                                                                <td className="py-3 px-4">
                                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                                                                        {log.module}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusColor.bg} ${statusColor.text}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`}></span>
                                                                        {log.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Settings Tab */}
                                {activeTab === 'settings' && (
                                    <div className="space-y-4">
                                        {moduleSettings.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                                <p className="text-gray-500">No module settings found</p>
                                            </div>
                                        ) : (
                                            moduleSettings.map(setting => (
                                                <div key={setting.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900 capitalize">{setting.module}</h3>
                                                            <p className="text-sm text-gray-500">Configure email notifications for this module</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedSettings(setting);
                                                                setShowSettingsModal(true);
                                                            }}
                                                            className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors"
                                                        >
                                                            Configure
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-gray-500">Status:</span>
                                                            <span className={`ml-2 font-medium ${setting.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                                                                {setting.enabled ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">On Create:</span>
                                                            <span className={`ml-2 font-medium ${setting.notify_on_create ? 'text-green-600' : 'text-gray-400'}`}>
                                                                {setting.notify_on_create ? 'Yes' : 'No'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">On Update:</span>
                                                            <span className={`ml-2 font-medium ${setting.notify_on_update ? 'text-green-600' : 'text-gray-400'}`}>
                                                                {setting.notify_on_update ? 'Yes' : 'No'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">Status Change:</span>
                                                            <span className={`ml-2 font-medium ${setting.notify_on_status_change ? 'text-green-600' : 'text-gray-400'}`}>
                                                                {setting.notify_on_status_change ? 'Yes' : 'No'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Template Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full h-[70vh] flex flex-col relative">
                        <div className="p-6 border-b border-gray-200 shrink-0">
                            <h2 className="text-xl font-bold text-gray-900">
                                {modalMode === 'create' ? 'Create Template' : 'Edit Template'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                                <input
                                    type="text"
                                    value={templateForm.name}
                                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    placeholder="e.g., New Case Notification"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Module *</label>
                                <select
                                    value={templateForm.module === 'custom' && !modules.find(m => m.value === templateForm.module) ? 'custom' : templateForm.module}
                                    onChange={(e) => setTemplateForm({ ...templateForm, module: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                >
                                    <option value="">Select Module</option>
                                    {modules.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>

                                {templateForm.module === 'custom' && (
                                    <div className="mt-3">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Enter Custom Module Name *</label>
                                        <input
                                            type="text"
                                            value={templateForm.customModuleName || ''}
                                            onChange={(e) => setTemplateForm({ ...templateForm, customModuleName: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                                            placeholder="e.g. Invoicing, Inventory, etc."
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                                <input
                                    type="text"
                                    value={templateForm.subject}
                                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    placeholder="Use {variable_name} for dynamic content"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Body *</label>
                                <textarea
                                    id="template-body-textarea"
                                    value={templateForm.body}
                                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                                    rows="8"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                                    placeholder="Write your email message here. Use {variable_name} to insert dynamic content.&#10;&#10;Example:&#10;Dear {recipient_name},&#10;&#10;This is to inform you about {subject}."
                                />
                                {/* Variable Insertion Chips */}
                                <div className="mt-3">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Click to insert variable into body:</p>
                                    <div className="space-y-2">
                                        {/* Common Variables */}
                                        <div>
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-2">Common:</span>
                                            {[
                                                { label: 'Recipient Name', value: 'recipient_name' },
                                                { label: 'Date', value: 'date' },
                                                { label: 'Company Name', value: 'company_name' },
                                            ].map(v => (
                                                <button key={v.value} type="button"
                                                    onClick={() => {
                                                        const ta = document.getElementById('template-body-textarea');
                                                        if (ta) {
                                                            const start = ta.selectionStart;
                                                            const end = ta.selectionEnd;
                                                            const text = templateForm.body;
                                                            const newText = text.substring(0, start) + `{${v.value}}` + text.substring(end);
                                                            setTemplateForm({ ...templateForm, body: newText });
                                                            setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.value.length + 2, start + v.value.length + 2); }, 50);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 mb-1.5 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" /> {`{${v.value}}`}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Employee Variables */}
                                        <div>
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-2">Employee:</span>
                                            {[
                                                { label: 'Employee Name', value: 'employee_name' },
                                                { label: 'Employee Email', value: 'employee_email' },
                                                { label: 'Employee Phone', value: 'employee_phone' },
                                                { label: 'Employee Role', value: 'employee_role' },
                                                { label: 'Branch', value: 'branch' },
                                                { label: 'Department', value: 'department' },
                                            ].map(v => (
                                                <button key={v.value} type="button"
                                                    onClick={() => {
                                                        const ta = document.getElementById('template-body-textarea');
                                                        if (ta) {
                                                            const start = ta.selectionStart;
                                                            const end = ta.selectionEnd;
                                                            const text = templateForm.body;
                                                            const newText = text.substring(0, start) + `{${v.value}}` + text.substring(end);
                                                            setTemplateForm({ ...templateForm, body: newText });
                                                            setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.value.length + 2, start + v.value.length + 2); }, 50);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 mb-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" /> {`{${v.value}}`}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Module Variables */}
                                        {templateForm.module && (
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-2">Module:</span>
                                                {(() => {
                                                    const moduleVars = {
                                                        litigation: [
                                                            { label: 'Case Reference', value: 'case_reference' },
                                                            { label: 'Case Title', value: 'case_title' },
                                                            { label: 'Priority', value: 'priority' },
                                                            { label: 'Status', value: 'status' },
                                                            { label: 'Created By', value: 'created_by' },
                                                        ],
                                                        maintenance: [
                                                            { label: 'Request ID', value: 'request_id' },
                                                            { label: 'Property', value: 'property_name' },
                                                            { label: 'Priority', value: 'priority' },
                                                            { label: 'Description', value: 'description' },
                                                        ],
                                                        incidents: [
                                                            { label: 'Incident ID', value: 'incident_id' },
                                                            { label: 'Incident Type', value: 'incident_type' },
                                                            { label: 'Severity', value: 'severity' },
                                                            { label: 'Location', value: 'location' },
                                                            { label: 'Reported By', value: 'reported_by' },
                                                        ],
                                                        hr: [
                                                            { label: 'Document Name', value: 'document_name' },
                                                            { label: 'Document Type', value: 'document_type' },
                                                        ],
                                                        tasks: [
                                                            { label: 'Task Title', value: 'task_title' },
                                                            { label: 'Priority', value: 'priority' },
                                                            { label: 'Due Date', value: 'due_date' },
                                                            { label: 'Assigned By', value: 'assigned_by' },
                                                        ],
                                                        complaints: [
                                                            { label: 'Complaint ID', value: 'complaint_id' },
                                                            { label: 'Complaint Type', value: 'complaint_type' },
                                                            { label: 'Status', value: 'status' },
                                                        ],
                                                        safeguarding: [
                                                            { label: 'Referral ID', value: 'referral_id' },
                                                            { label: 'Risk Level', value: 'risk_level' },
                                                            { label: 'Status', value: 'status' },
                                                        ],
                                                        compliance: [
                                                            { label: 'Audit ID', value: 'audit_id' },
                                                            { label: 'Compliance Type', value: 'compliance_type' },
                                                            { label: 'Status', value: 'status' },
                                                        ],
                                                        training: [
                                                            { label: 'Course Name', value: 'course_name' },
                                                            { label: 'Training Date', value: 'training_date' },
                                                            { label: 'Trainer', value: 'trainer' },
                                                        ],
                                                    };
                                                    const vars = moduleVars[templateForm.module] || [
                                                        { label: 'Reference ID', value: 'reference_id' },
                                                        { label: 'Status', value: 'status' },
                                                        { label: 'Priority', value: 'priority' },
                                                    ];
                                                    return vars.map(v => (
                                                        <button key={v.value} type="button"
                                                            onClick={() => {
                                                                const ta = document.getElementById('template-body-textarea');
                                                                if (ta) {
                                                                    const start = ta.selectionStart;
                                                                    const end = ta.selectionEnd;
                                                                    const text = templateForm.body;
                                                                    const newText = text.substring(0, start) + `{${v.value}}` + text.substring(end);
                                                                    setTemplateForm({ ...templateForm, body: newText });
                                                                    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + v.value.length + 2, start + v.value.length + 2); }, 50);
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 mb-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                                                        >
                                                            <Plus className="w-3 h-3" /> {`{${v.value}}`}
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                <input
                                    type="text"
                                    value={templateForm.description}
                                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    placeholder="Brief description of this template"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={templateForm.is_active}
                                    onChange={(e) => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                                    className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                                    Active
                                </label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTemplate}
                                className="px-5 py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 shadow-md transition-all"
                            >
                                {modalMode === 'create' ? 'Create' : 'Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Email Modal */}
            {showTestEmailModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">Send Test Email</h2>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Email</label>
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                placeholder="test@example.com"
                            />
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowTestEmailModal(false);
                                    setTestEmail('');
                                }}
                                className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTestEmail}
                                className="px-5 py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 shadow-md transition-all flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && selectedSettings && (
                <SettingsModal
                    settings={selectedSettings}
                    onClose={() => {
                        setShowSettingsModal(false);
                        setSelectedSettings(null);
                    }}
                    onSave={(settings) => handleUpdateSettings(selectedSettings.module, settings)}
                />
            )}
        </div>
    );
}

// Settings Modal Component
function SettingsModal({ settings, onClose, onSave }) {
    const [form, setForm] = useState({
        enabled: settings.enabled,
        notify_on_create: settings.notify_on_create,
        notify_on_update: settings.notify_on_update,
        notify_on_delete: settings.notify_on_delete,
        notify_on_status_change: settings.notify_on_status_change,
        notify_roles: settings.notify_roles || [],
        notify_users: settings.notify_users || [],
        custom_triggers: settings.custom_triggers || {}
    });

    const [newTriggerName, setNewTriggerName] = useState('');

    const handleAddCustomTrigger = () => {
        if (!newTriggerName.trim()) return;
        const key = newTriggerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        setForm({
            ...form,
            custom_triggers: { ...form.custom_triggers, [key]: true }
        });
        setNewTriggerName('');
    };

    const toggleCustomTrigger = (key) => {
        setForm({
            ...form,
            custom_triggers: {
                ...form.custom_triggers,
                [key]: !form.custom_triggers[key]
            }
        });
    };

    const roles = ['admin', 'manager', 'staff'];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full h-[70vh] flex flex-col relative">
                <div className="p-6 border-b border-gray-200 shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 capitalize">
                        {settings.module} Settings
                    </h2>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-900">Enable Notifications</h3>
                            <p className="text-sm text-gray-500">Turn on/off all email notifications for this module</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.enabled}
                                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                                className="sr-only peer rounded-xl"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                        </label>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-900">Notify On</h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.notify_on_create}
                                    onChange={(e) => setForm({ ...form, notify_on_create: e.target.checked })}
                                    className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Record Creation</span>
                            </label>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.notify_on_update}
                                    onChange={(e) => setForm({ ...form, notify_on_update: e.target.checked })}
                                    className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Record Update</span>
                            </label>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.notify_on_delete}
                                    onChange={(e) => setForm({ ...form, notify_on_delete: e.target.checked })}
                                    className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Record Deletion</span>
                            </label>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.notify_on_status_change}
                                    onChange={(e) => setForm({ ...form, notify_on_status_change: e.target.checked })}
                                    className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Status Change</span>
                            </label>
                        </div>
                    </div>

                    {/* Custom Triggers Section */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900">Custom Triggers</h3>
                        <p className="text-xs text-gray-500 mb-2">Add named events that trigger emails (e.g. payment_received, document_signed).</p>

                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newTriggerName}
                                onChange={(e) => setNewTriggerName(e.target.value)}
                                placeholder="Trigger name (e.g. payment_received)"
                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTrigger()}
                            />
                            <button
                                type="button"
                                onClick={handleAddCustomTrigger}
                                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Add
                            </button>
                        </div>

                        {Object.keys(form.custom_triggers || {}).length > 0 ? (
                            <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                {Object.entries(form.custom_triggers).map(([key, isEnabled]) => (
                                    <label key={key} className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={() => toggleCustomTrigger(key)}
                                            className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                        />
                                        <span className="text-sm text-gray-700 font-mono text-xs">{key}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-3 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                                <p className="text-xs text-gray-500">No custom triggers defined yet.</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Notify Roles</h3>
                        <div className="space-y-2">
                            {roles.map(role => (
                                <label key={role} className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={form.notify_roles.includes(role)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setForm({ ...form, notify_roles: [...form.notify_roles, role] });
                                            } else {
                                                setForm({ ...form, notify_roles: form.notify_roles.filter(r => r !== role) });
                                            }
                                        }}
                                        className="w-4 h-4 text-teal-500 border-gray-300 rounded-xl focus:ring-teal-500"
                                    />
                                    <span className="text-sm text-gray-700 capitalize">{role}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        className="px-5 py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 shadow-md transition-all"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
