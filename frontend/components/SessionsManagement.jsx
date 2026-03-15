// Sessions and Login History Management Component
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Monitor, Smartphone, Tablet, MapPin, Clock, CheckCircle, XCircle, Trash2, Shield, AlertTriangle, Globe } from 'lucide-react';

const api = axios.create({
  baseURL: '',
  withCredentials: true
});

const SessionsManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' or 'history'
  
  // Terminate session states
  const [terminateSessionId, setTerminateSessionId] = useState(null);
  const [terminatePassword, setTerminatePassword] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'sessions') {
        const res = await api.get('/api/auth/sessions');
        setSessions(res.data.sessions || []);
      } else {
        const res = await api.get('/api/auth/login-history');
        setLoginHistory(res.data.history || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateSession = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!terminatePassword) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/api/auth/sessions/${terminateSessionId}`, {
        data: { password: terminatePassword }
      });

      setSuccess('Session terminated successfully');
      setTerminateSessionId(null);
      setTerminatePassword('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to terminate session');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateOthers = async () => {
    const password = prompt('Enter your password to terminate all other sessions:');
    if (!password) return;

    try {
      setLoading(true);
      await api.post('/api/auth/sessions/terminate-others', { password });
      setSuccess('All other sessions terminated successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to terminate sessions');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      default: return <Monitor className="w-5 h-5" />;
    }
  };

  const getBrowserIcon = (browser) => {
    // Use Globe icon for all browsers since lucide-react doesn't have specific browser icons
    return <Globe className="w-4 h-4" />;
  };

  const getMethodBadge = (method) => {
    const colors = {
      password: 'bg-gray-100 text-gray-700',
      authenticator: 'bg-blue-100 text-blue-700',
      otp: 'bg-green-100 text-green-700',
      backup_code: 'bg-yellow-100 text-yellow-700',
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[method] || colors.password}`}>
        {method === 'authenticator' ? 'Authenticator' : method === 'otp' ? 'Email OTP' : method === 'backup_code' ? 'Backup Code' : 'Password'}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const formatRelativeTime = (date) => {
    if (!date) return 'N/A';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Authentication & Sessions</h3>
        {sessions.length > 1 && activeTab === 'sessions' && (
          <button
            onClick={handleTerminateOthers}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm"
          >
            <Shield className="w-4 h-4" />
            Terminate Other Sessions
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-start gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Active Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Login History
        </button>
      </div>

      {loading && <div className="text-center py-8">Loading...</div>}

      {/* Active Sessions Tab */}
      {!loading && activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active sessions</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      {getDeviceIcon(session.device_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {session.device_name || session.browser || 'Unknown Device'}
                        </h4>
                        {getMethodBadge(session.login_method)}
                      </div>
                      
                      {/* Device & Browser Info */}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          {getBrowserIcon(session.browser)}
                          <span className="font-medium">{session.browser || 'Unknown Browser'}</span>
                          <span className="text-gray-400">•</span>
                          <span>{session.os || 'Unknown OS'}</span>
                        </div>
                        
                        {/* IP Address & Location */}
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-xl">
                            {session.ip_address || 'Unknown IP'}
                          </span>
                          {session.location && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-xs">{session.location}</span>
                            </>
                          )}
                        </div>
                        
                        {/* Device Type */}
                        {session.device_type && (
                          <div className="flex items-center gap-2 text-gray-600">
                            {getDeviceIcon(session.device_type)}
                            <span className="text-xs capitalize">{session.device_type} Device</span>
                          </div>
                        )}
                        
                        {/* Login Time */}
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4 text-green-500" />
                          <span>Logged in {formatRelativeTime(session.login_at)}</span>
                          <span className="text-gray-400 text-xs">({formatDate(session.login_at)})</span>
                        </div>
                        
                        {/* User Agent - Expandable */}
                        {session.user_agent && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                              View full user agent
                            </summary>
                            <div className="mt-1 p-2 bg-gray-50 rounded-xl text-xs font-mono text-gray-600 break-all">
                              {session.user_agent}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setTerminateSessionId(session.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
                    title="Terminate session"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Login History Tab */}
      {!loading && activeTab === 'history' && (
        <div className="space-y-2">
          {loginHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No login history</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Method</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Device & Browser</th>
                    <th className="text-left p-3 font-semibold text-gray-700">IP & Location</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-blue-50/30 transition-colors">
                      <td className="p-3">
                        {log.success ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="font-medium">Success</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-red-600">
                              <XCircle className="w-4 h-4" />
                              <span className="font-medium">Failed</span>
                            </div>
                            {log.failure_reason && (
                              <div className="text-xs text-red-500 mt-0.5 ml-6">
                                {log.failure_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div>
                          {getMethodBadge(log.login_method)}
                          {log.device_name && (
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {log.device_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 bg-gray-100 rounded-xl">
                            {getDeviceIcon(log.device_type)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{log.browser || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">{log.os || 'Unknown OS'}</div>
                            {log.device_type && (
                              <div className="text-xs text-gray-400 capitalize mt-0.5">
                                {log.device_type}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-xl">
                              {log.ip_address === '::1' ? 'localhost (::1)' : (log.ip_address || 'Unknown IP')}
                            </span>
                          </div>
                          {log.location && (
                            <div className="text-xs text-gray-500 ml-5">
                              {log.location}
                            </div>
                          )}
                          {!log.location && log.ip_address && log.ip_address !== '::1' && (
                            <div className="text-xs text-gray-400 ml-5">
                              Location unavailable
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <div className="font-medium text-gray-900">{formatRelativeTime(log.attempted_at)}</div>
                          <div className="text-xs text-gray-500">{formatDate(log.attempted_at)}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Terminate Session Modal */}
      {terminateSessionId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <form onSubmit={handleTerminateSession}>
              <h3 className="text-xl font-semibold mb-4 text-red-600">Terminate Session</h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to terminate this session? Enter your password to confirm.
              </p>

              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-700">Password</span>
                <input
                  type="password"
                  value={terminatePassword}
                  onChange={(e) => setTerminatePassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2"
                  required
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTerminateSessionId(null);
                    setTerminatePassword('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Terminating...' : 'Terminate Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsManagement;
