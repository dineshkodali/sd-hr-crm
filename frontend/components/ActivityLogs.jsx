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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setActionTypeFilter('');
                  setResourceFilter('');
                }}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
                    <div className={`p-2 rounded-lg ${getActionColor(log.action_type)}`}>
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
                      
                      {/* Expandable metadata */}
                      {log.metadata && (
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
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
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Additional Details:</div>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                          </pre>
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
    </div>
  );
};

export default ActivityLogs;
