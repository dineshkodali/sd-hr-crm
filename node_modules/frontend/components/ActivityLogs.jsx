// Activity Logs Component - Read-only activity history
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, 
  Filter, 
  Calendar,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Settings,
  Shield,
  FileText,
  User,
  Clock,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const api = axios.create({
  baseURL: '',
  withCredentials: true
});

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Filters
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [actionTypeFilter, resourceFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (actionTypeFilter) params.actionType = actionTypeFilter;
      if (resourceFilter) params.resource = resourceFilter;
      
      const res = await api.get('/api/auth/activity-logs', { params });
      setLogs(res.data.logs);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/auth/activity-stats');
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const getActionIcon = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('view') || actionLower.includes('read')) return <Eye className="w-4 h-4" />;
    if (actionLower.includes('create') || actionLower.includes('add')) return <Plus className="w-4 h-4" />;
    if (actionLower.includes('update') || actionLower.includes('edit')) return <Edit className="w-4 h-4" />;
    if (actionLower.includes('delete') || actionLower.includes('remove')) return <Trash2 className="w-4 h-4" />;
    if (actionLower.includes('download') || actionLower.includes('export')) return <Download className="w-4 h-4" />;
    if (actionLower.includes('login') || actionLower.includes('logout')) return <Shield className="w-4 h-4" />;
    if (actionLower.includes('setting')) return <Settings className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getActionColor = (actionType) => {
    const colors = {
      auth: 'bg-purple-100 text-purple-700 border-purple-200',
      crud: 'bg-blue-100 text-blue-700 border-blue-200',
      view: 'bg-green-100 text-green-700 border-green-200',
      export: 'bg-orange-100 text-orange-700 border-orange-200',
      settings: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colors[actionType] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (date) => {
    if (!date) return 'N/A';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(date);
  };

  const formatActionName = (action) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper functions for table view
  const getPageName = (resource, action) => {
    const pageMap = {
      'service_users': 'Service Users List',
      'users': 'User Management',
      'hotels': 'Hotels Management',
      'rooms': 'Rooms Management',
      'tasks': 'Tasks',
      'tickets': 'Tickets',
      'complaints': 'Complaints',
      'incidents': 'Incidents',
      'maintenance': 'Maintenance',
      'inspections': 'Inspections',
      'hr_management': 'HR Management',
      'payroll': 'Payroll',
      'employee_training': 'Employee Training',
      'performance_management': 'Performance Management',
      'emergency_protocols': 'Emergency Protocols',
      'case_management': 'Case Management',
      'safeguarding': 'Safeguarding',
      'vulnerable_users': 'Vulnerable Users',
      'risk_assessments': 'Risk Assessments',
      'hse_incidents': 'HSE Incidents',
      'hse_training': 'HSE Training',
      'hse_audits': 'HSE Audits',
      'litigation': 'Litigation',
      'vcs_organisations': 'VCS Organisations',
      'move_ins': 'Move Ins',
      'move_outs': 'Move Outs',
      'meals': 'Meal Management',
      'aire_tasks': 'AIRE Tasks',
      'multi_agency': 'Multi Agency',
      'forms': 'Forms Builder',
      'activity_logs': 'Activity Logs'
    };
    
    return pageMap[resource] || formatActionName(resource);
  };

  const getSectionName = (resource, action) => {
    if (action.includes('auth') || action.includes('login') || action.includes('logout')) {
      return 'Authentication';
    }
    if (resource === 'service_users') return 'Service Users';
    if (resource === 'users') return 'User Management';
    if (resource === 'hotels' || resource === 'rooms') return 'Property Management';
    if (resource === 'tasks' || resource === 'tickets') return 'Task Management';
    if (resource === 'complaints' || resource === 'incidents') return 'Incident Management';
    if (resource === 'maintenance' || resource === 'inspections') return 'Maintenance';
    if (resource.includes('hr') || resource === 'payroll' || resource === 'employee_training') return 'Human Resources';
    if (resource.includes('hse')) return 'Health & Safety';
    if (resource === 'safeguarding' || resource === 'vulnerable_users' || resource === 'risk_assessments') return 'Safeguarding';
    if (resource === 'litigation' || resource === 'case_management') return 'Legal & Compliance';
    if (resource === 'move_ins' || resource === 'move_outs') return 'Accommodation';
    if (resource === 'meals') return 'Meal Management';
    if (resource === 'forms') return 'Forms & Documentation';
    return 'General';
  };

  const getChangesSummary = (metadata) => {
    try {
      const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      if (meta.comparison && meta.comparison.changes) {
        const changes = Object.entries(meta.comparison.changes);
        if (changes.length === 0) return 'No changes';
        
        // Show the actual field names that were changed
        const changedFieldNames = changes.map(([field]) => formatFieldName(field));
        
        if (changes.length === 1) {
          return changedFieldNames[0];
        } else if (changes.length <= 3) {
          return changedFieldNames.join(', ');
        } else {
          return `${changedFieldNames.slice(0, 2).join(', ')} + ${changes.length - 2} more`;
        }
      }
      return 'No field changes';
    } catch {
      return 'No field changes';
    }
  };

  const formatFieldName = (fieldName) => {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Activity Logs
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Complete history of your activities (Read-only)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 grid grid-cols-2 gap-0.5">
                  <div className="bg-current rounded-xl opacity-60"></div>
                  <div className="bg-current rounded-xl opacity-60"></div>
                  <div className="bg-current rounded-xl opacity-60"></div>
                  <div className="bg-current rounded-xl opacity-60"></div>
                </div>
                Cards
              </div>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 flex flex-col gap-0.5">
                  <div className="h-0.5 bg-current rounded-xl opacity-60"></div>
                  <div className="h-0.5 bg-current rounded-xl opacity-60"></div>
                  <div className="h-0.5 bg-current rounded-xl opacity-60"></div>
                </div>
                Table
              </div>
            </button>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Statistics */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.action_type} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                {stat.action_type}
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.count}</div>
              <div className="text-xs text-gray-400 mt-1">
                Last: {formatRelativeTime(stat.last_activity)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={actionTypeFilter}
                onChange={(e) => setActionTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Types</option>
                <option value="auth">Authentication</option>
                <option value="crud">CRUD Operations</option>
                <option value="view">View Actions</option>
                <option value="export">Exports</option>
                <option value="settings">Settings</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource
              </label>
              <input
                type="text"
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                placeholder="e.g., tasks, users, properties"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setActionTypeFilter('');
                  setResourceFilter('');
                }}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 animate-pulse opacity-50" />
          <p>Loading activity logs...</p>
        </div>
      )}

      {/* Activity Logs List */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No activity logs found</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <>
          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Icon */}
                        <div className={`p-2 rounded-xl ${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action)}
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-semibold text-gray-900">
                              {formatActionName(log.action)}
                            </h4>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${getActionColor(log.action_type)}`}>
                              {log.action_type}
                            </span>
                            {log.resource && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                                {log.resource}
                              </span>
                            )}
                          </div>
                          
                          {log.description && (
                            <p className="text-sm text-gray-600 mb-2">{log.description}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatRelativeTime(log.created_at)}</span>
                              <span className="text-gray-400">({formatDate(log.created_at)})</span>
                            </div>
                            
                            {log.ip_address && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="font-mono">{log.ip_address}</span>
                              </div>
                            )}
                            
                            {log.browser && (
                              <div className="flex items-center gap-1">
                                {getDeviceIcon(log.device_type)}
                                <span>{log.browser} • {log.os}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Expandable metadata with enhanced before/after view */}
                          {log.metadata && (
                            <button
                              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                              className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 rounded-xl"
                            >
                              {expandedLog === log.id ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  View Details
                                </>
                              )}
                            </button>
                          )}
                          
                          {expandedLog === log.id && log.metadata && (
                            <div className="mt-3 space-y-3">
                              {(() => {
                                try {
                                  const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
                                  
                                  // Show before/after comparison if available
                                  if (metadata.comparison && metadata.comparison.changes) {
                                    return (
                                      <div className="space-y-4">
                                        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                          <Edit className="w-3 h-3" />
                                          Changes Made ({metadata.comparison.totalChanges} field{metadata.comparison.totalChanges > 1 ? 's' : ''})
                                        </div>
                                        
                                        <div className="space-y-3">
                                          {Object.entries(metadata.comparison.changes).map(([field, change]) => (
                                            <div key={field} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                              <div className="text-xs font-medium text-gray-700 mb-2 capitalize">
                                                {field.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                                              </div>
                                              
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* Before */}
                                                <div className="space-y-1">
                                                  <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                    Before
                                                  </div>
                                                  <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-xs text-red-800 font-mono">
                                                    {change.before === null || change.before === undefined ? (
                                                      <span className="italic text-red-400">Empty</span>
                                                    ) : (
                                                      String(change.before)
                                                    )}
                                                  </div>
                                                </div>
                                                
                                                {/* After */}
                                                <div className="space-y-1">
                                                  <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                    After
                                                  </div>
                                                  <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-xs text-green-800 font-mono">
                                                    {change.after === null || change.after === undefined ? (
                                                      <span className="italic text-green-400">Empty</span>
                                                    ) : (
                                                      String(change.after)
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              {/* Change type badge */}
                                              <div className="mt-2">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                  change.type === 'added' ? 'bg-green-100 text-green-700' :
                                                  change.type === 'removed' ? 'bg-red-100 text-red-700' :
                                                  'bg-blue-100 text-blue-700'
                                                }`}>
                                                  {change.type === 'added' ? '+ Added' :
                                                   change.type === 'removed' ? '- Removed' :
                                                   '~ Modified'}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Show regular metadata if no comparison data
                                  return (
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                      <div className="text-xs font-semibold text-gray-700 mb-2">Additional Details:</div>
                                      <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                                        {JSON.stringify(metadata, null, 2)}
                                      </pre>
                                    </div>
                                  );
                                } catch (error) {
                                  return (
                                    <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                                      <div className="text-xs text-red-600">Error parsing metadata</div>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Section
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Page
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Changes Made
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              getSectionName(log.resource, log.action) === 'Authentication' ? 'bg-purple-500' :
                              getSectionName(log.resource, log.action) === 'Service Users' ? 'bg-blue-500' :
                              getSectionName(log.resource, log.action) === 'User Management' ? 'bg-green-500' :
                              getSectionName(log.resource, log.action) === 'Property Management' ? 'bg-orange-500' :
                              getSectionName(log.resource, log.action) === 'Human Resources' ? 'bg-pink-500' :
                              getSectionName(log.resource, log.action) === 'Health & Safety' ? 'bg-red-500' :
                              getSectionName(log.resource, log.action) === 'Safeguarding' ? 'bg-yellow-500' :
                              'bg-gray-500'
                            }`}></div>
                            <span className="font-medium text-gray-900">
                              {getSectionName(log.resource, log.action)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {getPageName(log.resource, log.action)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-xl ${getActionColor(log.action_type)}`}>
                              {getActionIcon(log.action)}
                            </div>
                            <span className="font-medium text-gray-900">
                              {formatActionName(log.action)}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${getActionColor(log.action_type)}`}>
                              {log.action_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          <div className="truncate" title={getChangesSummary(log.metadata)}>
                            {getChangesSummary(log.metadata)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {formatDate(log.created_at)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatRelativeTime(log.created_at)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.metadata && (
                            <button
                              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                              className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 rounded-xl"
                            >
                              {expandedLog === log.id ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  View
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Expanded details for table view */}
              {expandedLog && (
                <div className="border-t border-gray-200 bg-gray-50">
                  {(() => {
                    const log = logs.find(l => l.id === expandedLog);
                    if (!log || !log.metadata) return null;
                    
                    try {
                      const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
                      
                      if (metadata.comparison && metadata.comparison.changes) {
                        return (
                          <div className="p-4">
                            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <Edit className="w-4 h-4" />
                              Detailed Changes for: {log.description}
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {Object.entries(metadata.comparison.changes).map(([field, change]) => (
                                <div key={field} className="bg-white rounded-xl p-3 border border-gray-200">
                                  <div className="text-sm font-medium text-gray-700 mb-2">
                                    {formatFieldName(field)}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <div className="flex-1">
                                        <div className="text-xs text-red-600 font-medium mb-1">Before</div>
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-sm text-red-800 font-mono">
                                          {change.before === null || change.before === undefined ? (
                                            <span className="italic text-red-400">Empty</span>
                                          ) : (
                                            String(change.before)
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <div className="flex-1">
                                        <div className="text-xs text-green-600 font-medium mb-1">After</div>
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-sm text-green-800 font-mono">
                                          {change.after === null || change.after === undefined ? (
                                            <span className="italic text-green-400">Empty</span>
                                          ) : (
                                            String(change.after)
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      change.type === 'added' ? 'bg-green-100 text-green-700' :
                                      change.type === 'removed' ? 'bg-red-100 text-red-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {change.type === 'added' ? '+ Added' :
                                       change.type === 'removed' ? '- Removed' :
                                       '~ Modified'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="p-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">Additional Details:</div>
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap overflow-x-auto bg-white rounded-xl p-3 border border-gray-200">
                            {JSON.stringify(metadata, null, 2)}
                          </pre>
                        </div>
                      );
                    } catch (error) {
                      return (
                        <div className="p-4">
                          <div className="text-sm text-red-600">Error parsing metadata</div>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActivityLogs;