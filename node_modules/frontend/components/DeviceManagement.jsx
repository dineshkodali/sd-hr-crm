// Device Management Component for Authenticator
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, Tablet, Monitor, Watch, Plus, Trash2, Power, Check, X, Download, Copy, AlertCircle, Clock, Calendar } from 'lucide-react';

const api = axios.create({
  baseURL: '',
  withCredentials: true
});

const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Add device states
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('mobile');
  const [addStep, setAddStep] = useState('form'); // 'form', 'qr', 'verify'
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [newDeviceId, setNewDeviceId] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Remove device states
  const [removeDeviceId, setRemoveDeviceId] = useState(null);
  const [removePassword, setRemovePassword] = useState('');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/auth/authenticator/devices');
      setDevices(res.data.devices);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Please log in to access device management');
      } else {
        setError(err.response?.data?.message || 'Failed to load devices');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/api/auth/authenticator/devices/add', {
        deviceName: deviceName.trim(),
        deviceType,
        deviceFingerprint: navigator.userAgent
      });

      setQrCode(res.data.qrCode);
      setManualKey(res.data.manualEntryKey);
      setNewDeviceId(res.data.device.id);
      setAddStep('qr');
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add device');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDevice = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/auth/authenticator/devices/${newDeviceId}/verify`, {
        token: verificationCode
      });

      setSuccess('Device verified and activated successfully!');
      setAddStep('form');
      setShowAddDevice(false);
      setDeviceName('');
      setDeviceType('mobile');
      setVerificationCode('');
      setQrCode('');
      setManualKey('');
      setNewDeviceId(null);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify device');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDevice = async (deviceId) => {
    try {
      const res = await api.patch(`/api/auth/authenticator/devices/${deviceId}/toggle`);
      setSuccess(res.data.message);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle device');
    }
  };

  const handleRemoveDevice = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!removePassword) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/api/auth/authenticator/devices/${removeDeviceId}`, {
        data: { password: removePassword }
      });

      setSuccess('Device removed successfully');
      setRemoveDeviceId(null);
      setRemovePassword('');
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove device');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-6 h-6" />;
      case 'tablet': return <Tablet className="w-6 h-6" />;
      case 'desktop': return <Monitor className="w-6 h-6" />;
      case 'watch': return <Watch className="w-6 h-6" />;
      default: return <Smartphone className="w-6 h-6" />;
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  if (loading && devices.length === 0) {
    return <div className="text-center py-4">Loading devices...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Authenticator Devices</h3>
        <button
          onClick={() => setShowAddDevice(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-start gap-2">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Devices List */}
      <div className="space-y-3">
        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No devices registered yet</p>
            <p className="text-sm">Add your first authenticator device to get started</p>
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className={`border rounded-xl p-4 ${
                device.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-xl ${device.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                    {getDeviceIcon(device.device_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{device.device_name}</h4>
                      {device.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Added: {formatDate(device.created_at)}</span>
                      </div>
                      {device.last_used_at && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Last used: {formatDate(device.last_used_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleDevice(device.id)}
                    className={`p-2 rounded-xl transition-colors ${
                      device.is_active
                        ? 'hover:bg-gray-100 text-gray-600'
                        : 'hover:bg-green-50 text-green-600'
                    }`}
                    title={device.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setRemoveDeviceId(device.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            {addStep === 'form' && (
              <form onSubmit={handleAddDevice}>
                <h3 className="text-xl font-semibold mb-4">Add New Device</h3>
                
                <label className="block mb-4">
                  <span className="text-sm font-medium text-gray-700">Device Name</span>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="My iPhone, Work Tablet, etc."
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2"
                    required
                  />
                </label>

                <label className="block mb-4">
                  <span className="text-sm font-medium text-gray-700">Device Type</span>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2"
                  >
                    <option value="mobile">Mobile Phone</option>
                    <option value="tablet">Tablet</option>
                    <option value="desktop">Desktop/Laptop</option>
                    <option value="watch">Smart Watch</option>
                  </select>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddDevice(false);
                      setDeviceName('');
                      setDeviceType('mobile');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            {addStep === 'qr' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Scan QR Code</h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>

                {qrCode && (
                  <div className="bg-white p-4 rounded-xl border mb-4">
                    <img src={qrCode} alt="QR Code" className="w-full" />
                  </div>
                )}

                <div className="bg-gray-50 p-3 rounded-xl mb-4">
                  <p className="text-xs text-gray-600 mb-2">Manual Entry Key:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-xl border break-all">
                      {manualKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(manualKey)}
                      className="p-2 hover:bg-gray-200 rounded-xl"
                      title="Copy key"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAddStep('form');
                      setQrCode('');
                      setManualKey('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setAddStep('verify')}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                  >
                    Next: Verify
                  </button>
                </div>
              </div>
            )}

            {addStep === 'verify' && (
              <form onSubmit={handleVerifyDevice}>
                <h3 className="text-xl font-semibold mb-4">Verify Device</h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Enter the 6-digit code from your authenticator app to verify and activate this device.
                </p>

                <label className="block mb-4">
                  <span className="text-sm font-medium text-gray-700">Verification Code</span>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest"
                    autoFocus
                    required
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddStep('qr')}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Activate'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Remove Device Modal */}
      {removeDeviceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <form onSubmit={handleRemoveDevice}>
              <h3 className="text-xl font-semibold mb-4 text-red-600">Remove Device</h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to remove this device? Enter your password to confirm.
              </p>

              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-700">Password</span>
                <input
                  type="password"
                  value={removePassword}
                  onChange={(e) => setRemovePassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2"
                  required
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRemoveDeviceId(null);
                    setRemovePassword('');
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
                  {loading ? 'Removing...' : 'Remove Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;
