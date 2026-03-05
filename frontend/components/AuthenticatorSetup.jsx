// frontend/components/AuthenticatorSetup.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, Key, Download, Copy, Check, Lock, Unlock, AlertCircle, CheckCircle } from 'lucide-react';

const api = axios.create({
  baseURL: window.location.origin,
  withCredentials: true,
});

export default function AuthenticatorSetup() {
  const [status, setStatus] = useState({ enabled: false, backupCodesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('status'); // status, setup, verify, backup
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/auth/authenticator/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch authenticator status:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Please log in to access authenticator settings');
      } else {
        setError(err.response?.data?.message || 'Failed to load authenticator status');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/api/auth/authenticator/setup');
      setQrCode(res.data.qrCode);
      setManualKey(res.data.manualEntryKey);
      setStep('setup');
    } catch (err) {
      console.error('Setup error:', err);
      if (err.response?.status === 403) {
        setError(err.response?.data?.message || 'Authenticator setup is not available for your account type. Please use a regular user account.');
      } else if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to generate QR code. Please try again.');
      }
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      const res = await api.post('/api/auth/authenticator/enable', {
        token: verificationCode,
      });
      setBackupCodes(res.data.backupCodes);
      setStep('backup');
      setSuccess('Authenticator enabled successfully!');
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!disablePassword) {
      setError('Please enter your password');
      return;
    }

    try {
      await api.post('/api/auth/authenticator/disable', {
        password: disablePassword,
      });
      setSuccess('Authenticator disabled successfully');
      setDisablePassword('');
      setStep('status');
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable authenticator');
    }
  };

  const downloadBackupCodes = () => {
    const content = `SD-CRM Backup Codes\n${'='.repeat(30)}\n\nSave these codes in a safe place.\nEach code can only be used once.\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sd-crm-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyManualKey = () => {
    navigator.clipboard.writeText(manualKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-xl w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded-xl w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Smartphone className="w-6 h-6" style={{ color: '#4ae6ce' }} />
          <h2 className="text-xl font-semibold text-gray-800">Google Authenticator / TOTP</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Add an extra layer of security to your account with two-factor authentication
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {step === 'status' && (
          <div>
            {status.enabled ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600">
                  <Lock className="w-5 h-5" />
                  <span className="font-medium">Authenticator is enabled</span>
                </div>
                <p className="text-sm text-gray-600">
                  You have {status.backupCodesCount} backup codes remaining.
                </p>
                <form onSubmit={handleDisable} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter your password to disable
                    </label>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4ae6ce] focus:border-transparent"
                      placeholder="Enter password"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                  >
                    <Unlock className="w-4 h-4 inline mr-2" />
                    Disable Authenticator
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Unlock className="w-5 h-5" />
                  <span className="font-medium">Authenticator is not enabled</span>
                </div>
                <p className="text-sm text-gray-600">
                  Secure your account with time-based codes from an authenticator app.
                </p>
                <button
                  onClick={handleSetup}
                  className="px-4 py-2 text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#4ae6ce' }}
                >
                  <Key className="w-4 h-4 inline mr-2" />
                  Set Up Authenticator
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Step 1: Scan QR Code</h3>
              <p className="text-sm text-gray-600 mb-4">
                Open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.) and scan this QR code:
              </p>
              <div className="flex justify-center p-4 bg-gray-50 rounded-xl">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Or enter manually:</h3>
              <div className="flex items-center space-x-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm font-mono">
                  {manualKey}
                </code>
                <button
                  onClick={copyManualKey}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step 2: Enter 6-digit code from your app
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4ae6ce] focus:border-transparent text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength="6"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#4ae6ce' }}
                >
                  Verify & Enable
                </button>
                <button
                  type="button"
                  onClick={() => setStep('status')}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Save Your Backup Codes</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Store these codes in a safe place. Each code can only be used once if you lose access to your authenticator app.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-800">Backup Codes:</h3>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <div key={i} className="px-3 py-2 bg-gray-100 rounded-xl font-mono text-sm">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={downloadBackupCodes}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Download
              </button>
              <button
                onClick={copyBackupCodes}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 inline mr-2" /> : <Copy className="w-4 h-4 inline mr-2" />}
                Copy
              </button>
            </div>

            <button
              onClick={() => {
                setStep('status');
                setBackupCodes([]);
              }}
              className="w-full px-4 py-2 text-white rounded-xl hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#4ae6ce' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
