/* eslint-disable no-unused-vars */
/* src/pages/Users.jsx */
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { validatePassword, passwordStrengthLabel, passwordStrengthPercent } from '../src/utils/passwordUtils';
import {
  Home,
  UserPlus,
  Search,
  Users as UsersIcon,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Building,
  Filter,
  X,
  ChevronDown,
  Columns,
  Eye,
  MapPin,
  Plus
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";

const DELETE_STYLE_ID = 'admin-users-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = DELETE_STYLE_ID;
  style.textContent = `
    @keyframes adminUsersSlideOut {
      0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
      40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: var(--bg-primary); max-height: 80px; }
      100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
    }
    tr.admin-user-deleting {
      animation: adminUsersSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
      overflow: hidden;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

axios.defaults.withCredentials = true;

function AddEmployeeModal({ open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    permission_role_id: '',
    phone: '',
    branch: '',
    hotel_id: '',
    hotel_name: '',
    address: '',
    city: '',
    status: 'active'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStrengthLabelState, setPwStrengthLabelState] = useState('');
  const [pwPercent, setPwPercent] = useState(0);
  const [pwFieldErrors, setPwFieldErrors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchInputFocused, setBranchInputFocused] = useState(false);

  const [permissionRoles, setPermissionRoles] = useState([]);

  const [hotels, setHotels] = useState([]);

  // Dynamic Columns State
  const [dynamicColumns, setDynamicColumns] = useState([]);

  const fetchDynamicColumns = async () => {
    try {
      const res = await axios.get('/api/forms-builder/tables/users/columns', { withCredentials: true });
      if (res.data?.columns) {
        // Filter out standard fields that are already hardcoded in the form
        const standardFields = [
          'id', 'name', 'email', 'password', 'role', 'phone', 'branch', 'address', 'city', 'status',
          'created_at', 'updated_at', 'last_login', 'hotel_id', 'is_active',
          'property',
          // Internal/System fields to hide:
          'country', 'authenticator_secret', 'authenticator_enabled', 'backup_codes',
          // User requested removal:
          'gender', 'dob', 'nationality', 'religion', 'marital_status', 'state', 'resume_url', 'avatar'
        ];
        const customCols = res.data.columns.filter(col => !standardFields.includes(col.column_name));
        setDynamicColumns(customCols);
      }
    } catch (err) {
      console.error("Error fetching dynamic user columns:", err);
    }
  };

  const fetchPermissionRoles = async () => {
    try {
      const res = await axios.get('/api/access/roles', { withCredentials: true });
      setPermissionRoles(res?.data?.roles || []);
    } catch (err) {
      console.error('Failed to fetch permission roles:', err);
      setPermissionRoles([]);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/admin/users', {
        params: { limit: 1000 },
        withCredentials: true
      });

      const allUsers = res.data.users || [];
      const uniqueBranches = [...new Set(
        allUsers
          .map(user => user.branch)
          .filter(branch => branch && branch.trim() !== '')
      )].sort();

      setBranches(uniqueBranches);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      setBranches([]);
    }
  };

  const fetchHotels = async () => {
    try {
      const res = await axios.get('/api/hotels', {
        params: { limit: 500 },
        withCredentials: true,
      });
      const list = res?.data?.hotels ?? res?.data?.data ?? res?.data ?? [];
      setHotels(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch hotels:', err);
      setHotels([]);
    }
  };

  React.useEffect(() => {
    if (open) {
      document.body.classList.add("form-modal-open");
      fetchBranches();
      fetchDynamicColumns();
      fetchHotels();
      fetchPermissionRoles();
    } else {
      document.body.classList.remove("form-modal-open");
    }
    return () => {
      document.body.classList.remove("form-modal-open");
    };
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password') {
      try {
        const label = passwordStrengthLabel(value);
        const pct = passwordStrengthPercent(value);
        setPwStrengthLabelState(label);
        setPwPercent(pct);
        const v = validatePassword(value);
        setPwFieldErrors(v.errors || []);
      } catch {
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const requiredFields = [
      { key: 'name', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Role' },
      { key: 'branch', label: 'Branch' },
      { key: 'hotel_id', label: 'Property' },
      { key: 'status', label: 'Status' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'password', label: 'Password' },
      { key: 'confirmPassword', label: 'Confirm Password' },
    ];

    const missing = requiredFields
      .filter((f) => String(formData?.[f.key] ?? '').trim() === '')
      .map((f) => f.label);

    if (missing.length) {
      setError(`Please fill all required fields: ${missing.join(', ')}`);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    const password = String(formData.password || '');
    const { valid, errors } = validatePassword(password);
    if (!valid) {
      setError((errors || []).join('; ') || 'Password is not strong enough');
      return;
    }

    if (String(formData.confirmPassword || '') !== password) {
      setError('Password and confirmation do not match');
      return;
    }

    for (const col of dynamicColumns || []) {
      const key = col.column_name;
      const inputType = col.input_type || '';
      const dataType = col.data_type || '';

      if (inputType === 'checkbox' || dataType === 'BOOLEAN') {
        if (!formData[key]) {
          setError(`Please fill all required fields: ${key.replace(/_/g, ' ')}`);
          return;
        }
        continue;
      }

      const v = formData?.[key];
      if (v === undefined || v === null || String(v).trim() === '') {
        setError(`Please fill all required fields: ${key.replace(/_/g, ' ')}`);
        return;
      }
    }

    try {
      setSubmitting(true);

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: password,
        role: formData.role,
        phone: formData.phone.trim(),
        branch: formData.branch.trim(),
        hotel_id: formData.hotel_id,
        hotel_name: formData.hotel_name,
        address: formData.address.trim(),
        city: formData.city.trim(),
        status: formData.status
      };

      (dynamicColumns || []).forEach((col) => {
        const key = col.column_name;
        if (key in formData) payload[key] = formData[key];
      });

      const response = await axios.post('/api/admin/users', payload, {
        withCredentials: true
      });

      if (response.data) {
        const createdUserId = response.data?.user?.id;
        if (createdUserId && formData.permission_role_id) {
          try {
            await axios.put(
              `/api/access/users/${createdUserId}/roles`,
              { role_id: Number(formData.permission_role_id) },
              { withCredentials: true }
            );
          } catch (err) {
            console.error('Failed to assign permission role to new user:', err);
          }
        }

        if (onSuccess) onSuccess();
        onClose();
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'staff',
          permission_role_id: '',
          phone: '',
          branch: '',
          hotel_id: '',
          hotel_name: '',
          address: '',
          city: '',
          status: 'active'
        });
        setShowBranchDropdown(false);
        setBranchInputFocused(false);
      }
    } catch (err) {
      console.error('Error creating employee:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create employee';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-all">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative bg-[var(--bg-surface)] rounded-xl w-full max-w-3xl shadow-2xl border border-[var(--border-color)] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col h-[72vh]">
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border-color)] shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Add Employee</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Add a new employee to the system.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl shrink-0">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">Permission Role</label>
                <select
                  name="permission_role_id"
                  value={formData.permission_role_id}
                  onChange={handleChange}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                >
                  <option value="">None</option>
                  {permissionRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Branch <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    required
                    onFocus={() => {
                      setBranchInputFocused(true);
                      setShowBranchDropdown(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setBranchInputFocused(false);
                        setShowBranchDropdown(false);
                      }, 200);
                    }}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                    placeholder="Select existing branch or type new one"
                  />
                  {showBranchDropdown && branches.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {branches
                        .filter(branch =>
                          branch.toLowerCase().includes(formData.branch.toLowerCase())
                        )
                        .map((branch, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, branch });
                              setShowBranchDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 transition-colors text-sm border-b border-[var(--border-color)] last:border-b-0 flex items-center gap-2 hover:bg-[var(--bg-primary)]"
                          >
                            <Building className="w-4 h-4 text-[var(--text-secondary)]" />
                            <span className="text-[var(--text-primary)] font-medium">{branch}</span>
                          </button>
                        ))}

                      {formData.branch &&
                        !branches.some(b => b.toLowerCase() === formData.branch.toLowerCase()) && (
                          <div className="px-4 py-3 text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50">
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-4 h-4 text-[var(--accent-primary)]" />
                              <span>Create new branch: <strong className="text-[var(--accent-primary)]">&quot;{formData.branch}&quot;</strong></span>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Property <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.hotel_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const h = hotels.find((x) => String(x.id) === String(nextId));
                    setFormData({
                      ...formData,
                      hotel_id: nextId,
                      hotel_name: h?.name || '',
                    });
                  }}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                >
                  <option value="">Select property</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                  placeholder="Full address"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                  placeholder="City"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 rounded-xl"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.054.164-2.066.468-3.012" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        <circle cx="12" cy="12" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-3">
                  <div className="pw-strength">
                    <div
                      className={`pw-strength-inner ${pwStrengthLabelState === 'Weak' ? 'pw-weak' : pwStrengthLabelState === 'Medium' ? 'pw-medium' : pwStrengthLabelState === 'Strong' ? 'pw-strong' : ''}`}
                      style={{ width: `${pwPercent}%` }}
                    />
                  </div>
                  <div className="pw-strength-label">{pwStrengthLabelState}</div>
                  {pwFieldErrors && pwFieldErrors.length > 0 && (
                    <div className="text-xs text-red-600 mt-2">
                      {pwFieldErrors.map((e, i) => (
                        <div key={i}>• {e}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">Confirm Password <span className="text-red-500">*</span></label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              {/* Dynamic Fields Section */}
              {dynamicColumns.length > 0 && (
                <div className="md:col-span-2 pt-6 border-t border-[var(--border-color)]">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4">Additional Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    {dynamicColumns.map((col) => (
                      <div key={col.column_name} className={['textarea', 'text', 'varchar'].includes(col.input_type || 'text') && (col.max_length > 100 || col.data_type === 'TEXT') ? "md:col-span-2" : ""}>
                        <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
                          {col.column_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          {!col.is_nullable && <span className="text-red-500">*</span>}
                        </label>

                        {col.input_type === 'dropdown' || col.input_type === 'select' ? (
                          <select
                            name={col.column_name}
                            value={formData[col.column_name] || ''}
                            onChange={handleChange}
                            required
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                          >
                            <option value="">Select {col.column_name.replace(/_/g, ' ')}</option>
                            {Array.isArray(col.input_options) && col.input_options.map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : col.input_type === 'checkbox' || col.data_type === 'BOOLEAN' ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="checkbox"
                              name={col.column_name}
                              checked={!!formData[col.column_name]}
                              onChange={(e) => setFormData(prev => ({ ...prev, [col.column_name]: e.target.checked }))}
                              className="w-4 h-4 text-[var(--accent-primary)] rounded-md border-[var(--border-color)] focus:ring-[var(--accent-shadow)]"
                            />
                            <span className="text-sm text-[var(--text-secondary)] font-medium">Yes</span>
                          </div>
                        ) : col.input_type === 'textarea' || col.data_type === 'TEXT' ? (
                          <textarea
                            name={col.column_name}
                            value={formData[col.column_name] || ''}
                            onChange={handleChange}
                            required
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all resize-y min-h-[80px]"
                            placeholder={`Enter ${col.column_name.replace(/_/g, ' ')}`}
                          />
                        ) : (
                          <input
                            type={col.input_type === 'number' || col.data_type === 'INTEGER' ? 'number' :
                              col.input_type === 'date' || col.data_type === 'DATE' ? 'date' : 'text'}
                            name={col.column_name}
                            value={formData[col.column_name] || ''}
                            onChange={handleChange}
                            required
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                            placeholder={`Enter ${col.column_name.replace(/_/g, ' ')}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-5 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl btn-primary"
            >
              {submitting ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const outlet = useOutletContext();
  const { user } = outlet || {};

  const [hotels, setHotels] = useState([]);

  const [permissionRoles, setPermissionRoles] = useState([]);

  const [users, setUsers] = useState([]);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning'
  });

  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);

  /* Move Room Modal */
  const [showMoveRoomModal, setShowMoveRoomModal] = useState(false);
  const [moveRoomUserId, setMoveRoomUserId] = useState(null);
  const [moveRoomUser, setMoveRoomUser] = useState(null);

  // Move room form state
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [moveRoomFormData, setMoveRoomFormData] = useState({
    property_id: "",
    property_name: "",
    floor: "",
    room_id: "",
    room_name: "",
    move_in_date: new Date().toISOString().substr(0, 10),
    notes: "",
  });
  const [movingRoom, setMovingRoom] = useState(false);

  // Toggle body class for Focus Mode (Hide Navbars)
  useEffect(() => {
    if (isEditOpen || showMoveRoomModal || confirmDialog.isOpen) {
      document.body.classList.add("form-modal-open");
    } else {
      // clear only if add modal is also closed (handled by its own component, but safe to check)
      // Actually AddEmployeeModal handles its own, but we should be careful not to remove it if Add is open?
      // Since AddEmployeeModal adds it on mount/open, and we are in same parent
      // styling might conflict if we race.
      // However, usually only one modal is open at a time.
      document.body.classList.remove("form-modal-open");
    }
    return () => document.body.classList.remove("form-modal-open");
  }, [isEditOpen, showMoveRoomModal, confirmDialog.isOpen]);

  // --- EXISTING LOGIC & HANDLERS (UNCHANGED) ---

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/admin/users", { withCredentials: true });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to load staff:", err);
      setError(err?.response?.data?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchHotels = async () => {
    try {
      const res = await axios.get('/api/hotels', {
        params: { limit: 500 },
        withCredentials: true,
      });
      const list = res?.data?.hotels ?? res?.data?.data ?? res?.data ?? [];
      setHotels(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch hotels:', err);
      setHotels([]);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchPermissionRoles = async () => {
    try {
      const res = await axios.get('/api/access/roles', { withCredentials: true });
      setPermissionRoles(res?.data?.roles || []);
    } catch (err) {
      console.error('Failed to fetch permission roles:', err);
      setPermissionRoles([]);
    }
  };

  useEffect(() => {
    fetchPermissionRoles();
  }, []);

  const handleDelete = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: 'Delete user? This cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setDeletingIds(prev => new Set(prev).add(id));
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          const ANIM_DURATION = 460;
          setTimeout(() => {
            setUsers(prev => (Array.isArray(prev) ? prev.filter(u => String(u.id) !== String(id)) : prev));
            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          }, ANIM_DURATION);

          await axios.delete(`/api/admin/users/${id}`, { withCredentials: true });
          fetchUsers();
        } catch (err) {
          console.error('delete user error:', err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: err?.response?.data?.message || 'Failed to delete user',
            type: 'error'
          });
        }
      }
    });
  };

  // Move Room Functions
  const fetchProperties = async () => {
    try {
      const res = await axios.get("/api/properties", { withCredentials: true });
      setProperties(res.data || []);
    } catch (err) {
      console.error("Failed to load properties:", err);
    }
  };

  const fetchRoomsForProperty = async (propertyId) => {
    try {
      const res = await axios.get(`/api/properties/${propertyId}/rooms`, { withCredentials: true });
      const rooms = res.data || [];

      // Group rooms by floor
      const floorMap = {};
      rooms.forEach((room) => {
        const floor = room.floor || "Ground Floor";
        if (!floorMap[floor]) floorMap[floor] = [];
        floorMap[floor].push(room);
      });

      setFloors(Object.keys(floorMap).sort());
      setAvailableRooms(floorMap);
      setSelectedFloor(null);
      setMoveRoomFormData((prev) => ({ ...prev, floor: "", room_id: "", room_name: "" }));
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  const openMoveRoom = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setMoveRoomUserId(userId);
    setMoveRoomUser(user);
    setMoveRoomFormData({
      property_id: "",
      property_name: "",
      floor: "",
      room_id: "",
      room_name: "",
      move_in_date: new Date().toISOString().substr(0, 10),
      notes: "",
    });

    await fetchProperties();
    setShowMoveRoomModal(true);
  };

  const closeMoveRoom = () => {
    setShowMoveRoomModal(false);
    setMoveRoomUserId(null);
    setMoveRoomUser(null);
    setMoveRoomFormData({
      property_id: "",
      property_name: "",
      floor: "",
      room_id: "",
      room_name: "",
      move_in_date: new Date().toISOString().substr(0, 10),
      notes: "",
    });
    setMovingRoom(false);
  };

  const handlePropertyChange = (e) => {
    const propId = e.target.value;
    const property = properties.find((p) => p.id === parseInt(propId));

    setMoveRoomFormData((prev) => ({
      ...prev,
      property_id: propId,
      property_name: property?.name || "",
    }));
    setSelectedProperty(property);

    if (propId) {
      fetchRoomsForProperty(propId);
    }
  };

  const handleFloorChange = (e) => {
    const floor = e.target.value;
    setSelectedFloor(floor);
    setMoveRoomFormData((prev) => ({ ...prev, floor, room_id: "", room_name: "" }));
  };

  const handleRoomChange = (e) => {
    const roomId = e.target.value;
    const room = availableRooms[selectedFloor]?.find((r) => r.id === parseInt(roomId));

    setMoveRoomFormData((prev) => ({
      ...prev,
      room_id: roomId,
      room_name: room?.room_number || "",
    }));
  };

  const handleMoveRoomSubmit = async (e) => {
    e?.preventDefault?.();
    if (!moveRoomFormData.property_id || !moveRoomFormData.room_id) {
      setAlertDialog({
        isOpen: true,
        title: 'Select Property and Room',
        message: 'Please select property and room',
        type: 'warning'
      });
      return;
    }

    setMovingRoom(true);
    try {
      const payload = {
        service_user_id: moveRoomUserId,
        service_user_name: moveRoomUser?.name || "",
        property_id: moveRoomFormData.property_id,
        property_name: moveRoomFormData.property_name,
        room_id: moveRoomFormData.room_id,
        room_name: moveRoomFormData.room_name,
        move_in_date: moveRoomFormData.move_in_date,
        notes: moveRoomFormData.notes,
      };

      await axios.post("/api/move-ins", payload, { withCredentials: true });

      await fetchUsers();
      closeMoveRoom();
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'User moved to new room successfully!',
        type: 'success'
      });
    } catch (err) {
      console.error("move room error:", err);
      setAlertDialog({
        isOpen: true,
        title: 'Move Failed',
        message: err?.response?.data?.message || 'Failed to move user',
        type: 'error'
      });
    } finally {
      setMovingRoom(false);
    }
  };

  const getStaffId = (u) => u?.staff_id || u?.emp_id || u?.employee_id || u?.id || "—";
  const getPhone = (u) => u?.phone || u?.mobile || u?.contact || "—";
  const getStatus = (u) => {
    if (u?.status) return u.status;
    if (typeof u?.active === "boolean") return u.active ? "Active" : "Inactive";
    if (u?.account_status) return u.account_status;
    return "Active"; // Default for UI matching
  };
  const getJoinDateRaw = (u) => u?.joining_date || u?.joined_on || u?.join_date || u?.created_at || u?.createdAt || null;
  const formatJoinDate = (u) => {
    const d = getJoinDateRaw(u);
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(d);
    }
  };

  // Edit Handlers
  const openEdit = async (id) => {
    setEditingId(id);
    setIsEditOpen(true);
    setEditUser(null);
    setAvatarPreview(null);
    setAvatarFile(null);

    try {
      const res = await axios.get(`/api/admin/users/${id}`, { withCredentials: true });
      const u = res.data.user || res.data || {};

      let permissionRoleId = '';
      try {
        const roleRes = await axios.get(`/api/access/users/${id}/roles`, { withCredentials: true });
        const first = (roleRes?.data?.roles || [])[0];
        if (first?.id) permissionRoleId = String(first.id);
      } catch (err) {
        console.error('Failed to fetch user permission role:', err);
      }

      const payload = {
        id: u.id,
        first_name: u.first_name || u.firstName || (u.name ? u.name.split(" ")[0] : ""),
        last_name: u.last_name || u.lastName || (u.name ? u.name.split(" ").slice(1).join(" ") : ""),
        staff_id: u.staff_id || u.emp_id || u.employee_id || u.id,
        username: u.username || u.user_name || u.email,
        email: u.email || "",
        phone: u.phone || u.mobile || u.contact || "",
        joining_date: getJoinDateRaw(u) ? new Date(getJoinDateRaw(u)).toISOString().substr(0, 10) : "",
        branch: u.branch || u.company || u.organisation || u.org || "",
        hotel_id: u.hotel_id || u.hotelId || "",
        hotel_name: u.hotel_name || u.hotelName || u.assigned_hotel || u.assignedHotel || "",
        role: u.role || u.user_role || "",
        permission_role_id: permissionRoleId,
        status: getStatus(u),
        avatar: u.avatar || u.photo || u.image || null,
      };
      setEditUser(payload);
      if (payload.avatar) setAvatarPreview(payload.avatar);
    } catch (err) {
      console.error("fetch user details error:", err);
      setAlertDialog({
        isOpen: true,
        title: 'Load Failed',
        message: 'Failed to load user details',
        type: 'error'
      });
      setIsEditOpen(false);
    }
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingId(null);
    setEditUser(null);
    setAvatarPreview(null);
    setAvatarFile(null);
    setSaving(false);
  };

  const onEditChange = (key, value) => {
    setEditUser((s) => ({ ...s, [key]: value }));
  };

  const onAvatarChange = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editUser || !editingId) return;

    const requiredFields = [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'staff_id', label: 'Staff ID' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' },
    ];

    const missing = requiredFields
      .filter((f) => String(editUser?.[f.key] ?? '').trim() === '')
      .map((f) => f.label);

    if (missing.length) {
      setAlertDialog({
        isOpen: true,
        title: 'Required fields',
        message: `Please fill all required fields: ${missing.join(', ')}`,
        type: 'warning'
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(editUser.email || '').trim())) {
      setAlertDialog({
        isOpen: true,
        title: 'Invalid email',
        message: 'Please enter a valid email address',
        type: 'warning'
      });
      return;
    }

    const password = String(editUser.password || '');
    if (password) {
      const { valid, errors } = validatePassword(password);
      if (!valid) {
        setAlertDialog({
          isOpen: true,
          title: 'Weak password',
          message: (errors || []).join('; ') || 'Password is not strong enough',
          type: 'warning'
        });
        return;
      }

      if (String(editUser.confirmPassword || '') !== password) {
        setAlertDialog({
          isOpen: true,
          title: 'Password mismatch',
          message: 'Password and confirmation do not match',
          type: 'warning'
        });
        return;
      }
    }

    setSaving(true);
    try {
      const fullName = `${(editUser.first_name || "").trim()} ${(editUser.last_name || "").trim()}`.trim();
      const form = new FormData();
      form.append("name", fullName);
      form.append("email", editUser.email);
      if (password) form.append("password", editUser.password);
      form.append("branch", editUser.branch || "");
      form.append("hotel_id", editUser.hotel_id || "");
      form.append("hotel_name", editUser.hotel_name || "");
      form.append("role", editUser.role);
      form.append("status", editUser.status);
      form.append("phone", editUser.phone);
      if (avatarFile) form.append("avatar", avatarFile);

      await axios.put(`/api/admin/users/${editingId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });

      try {
        await axios.put(
          `/api/access/users/${editingId}/roles`,
          { role_id: editUser.permission_role_id ? Number(editUser.permission_role_id) : null },
          { withCredentials: true }
        );
      } catch (err) {
        console.error('Failed to update user permission role:', err);
      }

      await fetchUsers();
      closeEdit();
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Saved successfully',
        type: 'success'
      });
    } catch (err) {
      console.error("save user error:", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to save";
      setAlertDialog({
        isOpen: true,
        title: 'Save Failed',
        message: msg,
        type: 'error'
      });
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  // --- CALCULATE STATS FOR UI ---
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Compute stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => String(getStatus(u)).toLowerCase() === 'active').length;
    const inactive = total - active;
    const newJoiners = users.filter(u => {
      const joinDate = getJoinDateRaw(u);
      if (!joinDate) return false;
      const days = Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30;
    }).length;
    return { total, active, inactive, newJoiners };
  }, [users]);

  // Filter users based on tab, search, and filters
  const filteredUsers = useMemo(() => {
    let list = [...users];

    // Tab filter
    if (activeTab === 'active') {
      list = list.filter(u => String(getStatus(u)).toLowerCase() === 'active');
    } else if (activeTab === 'inactive') {
      list = list.filter(u => String(getStatus(u)).toLowerCase() !== 'active');
    }

    // Search filter - improved to handle all cases
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(u => {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const staffId = String(getStaffId(u)).toLowerCase();
        const phone = String(getPhone(u)).toLowerCase();
        const role = (u.role || '').toLowerCase();
        const branch = (u.branch || '').toLowerCase();

        return name.includes(q) ||
          email.includes(q) ||
          staffId.includes(q) ||
          phone.includes(q) ||
          role.includes(q) ||
          branch.includes(q);
      });
    }

    // Designation filter
    if (filterDesignation) {
      list = list.filter(u => (u.role || '').toLowerCase() === filterDesignation.toLowerCase());
    }

    // Status filter
    if (filterStatus) {
      list = list.filter(u => String(getStatus(u)).toLowerCase() === filterStatus.toLowerCase());
    }

    // Branch filter
    if (filterBranch) {
      list = list.filter(u => (u.branch || '') === filterBranch);
    }

    // Sorting
    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'email') {
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    } else if (sortBy === 'role') {
      list.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
    } else if (sortBy === 'branch') {
      list.sort((a, b) => (a.branch || '').localeCompare(b.branch || ''));
    } else if (sortBy === 'recent') {
      list.sort((a, b) => {
        const dateA = new Date(getJoinDateRaw(a) || 0);
        const dateB = new Date(getJoinDateRaw(b) || 0);
        return dateB - dateA;
      });
    }

    return list;
  }, [users, activeTab, searchQuery, filterDesignation, filterStatus, filterBranch, sortBy]);

  // Get unique branches and roles for dropdowns
  const uniqueBranches = useMemo(() => {
    const branches = [...new Set(users.map(u => u.branch).filter(Boolean))];
    return branches.sort();
  }, [users]);

  const uniqueRoles = useMemo(() => {
    const roles = [...new Set(users.map(u => u.role).filter(Boolean))];
    return roles.sort();
  }, [users]);

  /* -------------------------
  RENDER (ENHANCED UI MATCHING BOOKINGS)
  ------------------------- */
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:px-8 py-6">

        {/* Page Header */}
        {/* HEADER SECTION - Unified Card */}
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Breadcrumbs
                  items={[
                    { label: 'Admin' },
                    { label: 'Users' }
                  ]}
                />
              </div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-tight mb-1">Users & Staff</h1>
              <p className="text-sm text-[var(--text-secondary)]">Manage staff members and their information</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary rounded-xl"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-[var(--bg-surface)] rounded-2xl p-6 shadow-sm border border-[var(--border-color)] flex items-center gap-5 transition-all duration-300 hover:shadow-md group">
            <div className="bg-[var(--accent-shadow)] text-[var(--accent-primary)] h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              <UsersIcon className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mb-1.5 font-mono">Total Employees</div>
              <div className="text-3xl font-black text-[var(--text-primary)] leading-none tabular-nums">{stats.total}</div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl p-6 shadow-sm border border-[var(--border-color)] flex items-center gap-5 transition-all duration-300 hover:shadow-md group">
            <div className="bg-emerald-50 text-emerald-600 h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mb-1.5 font-mono">Active</div>
              <div className="text-3xl font-black text-[var(--text-primary)] leading-none tabular-nums">{stats.active}</div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl p-6 shadow-sm border border-[var(--border-color)] flex items-center gap-5 transition-all duration-300 hover:shadow-md group">
            <div className="bg-red-50 text-red-600 h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              <UserX className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mb-1.5 font-mono">Inactive</div>
              <div className="text-3xl font-black text-[var(--text-primary)] leading-none tabular-nums">{stats.inactive}</div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-2xl p-6 shadow-sm border border-[var(--border-color)] flex items-center gap-5 transition-all duration-300 hover:shadow-md group">
            <div className="bg-amber-50 text-amber-600 h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              <Calendar className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mb-1.5 font-mono">New Joiners</div>
              <div className="text-3xl font-black text-[var(--text-primary)] leading-none tabular-nums">{stats.newJoiners}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 transition-all duration-200">
          {/* Tab Switcher */}
          <div className="mb-6 flex items-center gap-3 border-b border-[var(--border-color)]">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)]'
                }`}
            >
              All Employees
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeTab === 'active'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)]'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inactive'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)]'
                }`}
            >
              Inactive
            </button>
          </div>

          {/* Search & Filter Controls */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px] relative group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-primary)] transition-colors" />
              <input
                type="text"
                placeholder="Search by name, email, staff ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full !pl-14 pr-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border border-[var(--border-color)] rounded-2xl px-4 py-2.5 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/30 transition-all cursor-pointer">
                <Filter className="w-4 h-4 text-[var(--accent-primary)]" />
                <select
                  value={filterDesignation}
                  onChange={(e) => setFilterDesignation(e.target.value)}
                  className="text-xs font-bold text-[var(--text-primary)] focus:outline-none bg-transparent cursor-pointer"
                >
                  <option value="">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 border border-[var(--border-color)] rounded-2xl px-4 py-2.5 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/30 transition-all cursor-pointer">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs font-bold text-[var(--text-primary)] focus:outline-none bg-transparent cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-2 border border-[var(--border-color)] rounded-2xl px-4 py-2.5 bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/30 transition-all cursor-pointer">
                <Building className="w-4 h-4 text-[var(--accent-primary)]" />
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="text-xs font-bold text-[var(--text-primary)] focus:outline-none bg-transparent cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {uniqueBranches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterDesignation('');
                  setFilterStatus('');
                  setFilterBranch('');
                }}
                className="p-3 text-[var(--text-secondary)] border border-[var(--border-color)] rounded-2xl bg-[var(--bg-primary)] hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                title="Clear Filters"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest bg-[var(--bg-primary)] font-mono">
                  <th className="p-4 w-10 text-center">
                    <input type="checkbox" className="w-4 h-4 text-[var(--accent-primary)] rounded-md border-[var(--border-color)] focus:ring-[var(--accent-shadow)]" />
                  </th>
                  <th className="p-4">Staff ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4">Joined At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center sticky right-0 z-10 bg-[var(--bg-primary)]" style={{ boxShadow: '-5px 0 10px -5px rgba(0,0,0,0.05)' }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="p-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 border-4 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] rounded-full animate-spin"></div>
                      <p className="font-bold text-sm tracking-wide">Loading employees...</p>
                    </div>
                  </td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="8" className="p-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-4 bg-[var(--bg-primary)]/30 rounded-2xl py-12 border border-dashed border-[var(--border-color)]">
                      <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shadow-sm">
                        <UsersIcon className="opacity-20 w-8 h-8" />
                      </div>
                      <div className="max-w-xs mx-auto">
                        <p className="font-bold text-[var(--text-primary)] text-lg mb-1">{searchQuery ? "No matches found" : "No employees added"}</p>
                        <p className="text-sm">{searchQuery ? "Try adjusting your search terms or filters" : "Start by adding your first employee to the system"}</p>
                      </div>
                    </div>
                  </td></tr>
                ) : filteredUsers.map((u, index) => {
                  const isDeleting = deletingIds.has(u.id);
                  return (
                    <tr key={u.id || index} className={`border-b border-[var(--border-color)] last:border-b-0 transition-all hover:bg-[var(--bg-primary)]/30 group ${isDeleting ? 'admin-user-deleting' : ''}`}>
                      <td className="p-4 text-center">
                        <input type="checkbox" className="w-4 h-4 text-[var(--accent-primary)] rounded-md border-[var(--border-color)] focus:ring-[var(--accent-shadow)]" />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[var(--text-primary)] tracking-wide font-mono">{getStaffId(u)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden flex-shrink-0 shadow-sm">
                            {u.avatar || u.photo ? (
                              <img src={u.avatar || u.photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[var(--accent-primary)] text-xs font-black bg-[var(--accent-shadow)]">
                                {(u.name || "U").substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[var(--text-primary)] mb-0.5">{u.name || "Unknown"}</div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-secondary)]/70 uppercase">
                              <Building className="w-3 h-3 text-[var(--accent-primary)]" />
                              <span className="truncate max-w-[120px]">{u.branch || "Global"}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                            <Mail className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                            {u.email || "—"}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]/60">
                            <Phone className="w-3.5 h-3.5" />
                            {getPhone(u)}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] shadow-sm">
                          {u.role ? u.role : "Staff"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
                          <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          {formatJoinDate(u)}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${getStatus(u).toLowerCase() === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-100/30'
                          : 'bg-red-50 text-red-700 border-red-100 shadow-sm shadow-red-100/30'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatus(u).toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}> </span>
                          {getStatus(u)}
                        </span>
                      </td>
                      <td className="p-4 sticky right-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-primary)] transition-colors" style={{ boxShadow: '-10px 0 15px -10px rgba(0,0,0,0.05)' }}>
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openMoveRoom(u.id)} title="Move Room" className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--accent-primary)] border border-transparent hover:border-[var(--border-color)] transition-all shadow-none hover:shadow-sm"><MapPin size={16} /></button>
                          <button onClick={() => openEdit(u.id)} title="Edit Employee" className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--accent-primary)] border border-transparent hover:border-[var(--border-color)] transition-all shadow-none hover:shadow-sm"><Edit size={16} /></button>
                          <button onClick={() => handleDelete(u.id)} title="Delete Employee" className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all shadow-none hover:shadow-sm"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="mt-8 flex items-center justify-between border-t border-[var(--border-color)] pt-6">
              <div className="text-sm font-medium text-[var(--text-secondary)]">
                Showing <span className="text-[var(--text-primary)] font-bold">{filteredUsers.length}</span> of <span className="text-[var(--text-primary)] font-bold">{users.length}</span> employees
              </div>
              <div className="flex gap-2">
                <button className="px-5 py-2.5 border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-primary)] transition-all">
                  Previous
                </button>
                <button className="px-5 py-2.5 bg-[var(--accent-primary)] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md shadow-[var(--accent-primary)]/20">
                  1
                </button>
                <button className="px-5 py-2.5 border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:bg-[var(--bg-primary)] transition-all">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {
        error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )
      }

      {/* -------------------------
 EDIT MODAL (Kept Functional, styled cleanly)
 ------------------------- */}
      {
        isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="modal-container bg-[var(--bg-surface)] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-[var(--border-color)]">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div>
                  <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Edit Employee Profile</h3>
                  <p className="text-xs font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mt-1">Update staff information and system access</p>
                </div>
                <button onClick={closeEdit} className="p-2 hover:bg-[var(--bg-primary)] rounded-xl text-[var(--text-secondary)] transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <form onSubmit={saveEdit} className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-8 p-6 bg-[var(--bg-primary)]/50 rounded-2xl border border-[var(--border-color)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <UsersIcon size={80} />
                    </div>
                    <div className="w-24 h-24 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-color)] overflow-hidden flex items-center justify-center shrink-0 shadow-inner group-hover:border-[var(--accent-primary)] transition-all">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl text-[var(--accent-primary)] font-black">{(editUser?.first_name || "U").charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Profile Photograph</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="block w-full text-xs text-[var(--text-secondary)] file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[var(--accent-primary)] file:text-white hover:file:bg-[var(--accent-primary)]/90 file:cursor-pointer transition-all"
                        onChange={(ev) => {
                          const f = ev.target.files?.[0];
                          if (f) onAvatarChange(f);
                        }}
                      />
                      <p className="mt-2 text-[10px] font-bold text-[var(--text-secondary)]/50 uppercase tracking-wide">JPG/PNG format, Recommended size 512x512px</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">First Name</label>
                      <input required value={editUser?.first_name || ""} onChange={(e) => onEditChange("first_name", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-medium focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Last Name</label>
                      <input required value={editUser?.last_name || ""} onChange={(e) => onEditChange("last_name", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-medium focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Staff ID / Employee Code</label>
                      <input required value={editUser?.staff_id || ""} onChange={(e) => onEditChange("staff_id", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all tracking-wider" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Email Address</label>
                      <input required value={editUser?.email || ""} onChange={(e) => onEditChange("email", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-medium focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Contact Number</label>
                      <input required value={editUser?.phone || ""} onChange={(e) => onEditChange("phone", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-medium focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Designation / Role</label>
                      <select required value={editUser?.role || ""} onChange={(e) => onEditChange("role", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer">
                        <option value="">Select Role</option>
                        <option value="staff">Staff / Developer</option>
                        <option value="manager">Manager</option>
                        {editUser?.role && !['staff', 'manager'].includes(editUser.role) && (
                          <option value={editUser.role}>{editUser.role.charAt(0).toUpperCase() + editUser.role.slice(1)}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">System Permission Group</label>
                      <select
                        value={editUser?.permission_role_id || ''}
                        onChange={(e) => onEditChange('permission_role_id', e.target.value)}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                      >
                        <option value="">No Special Permissions</option>
                        {permissionRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Account Status</label>
                      <select required value={editUser?.status || ""} onChange={(e) => onEditChange("status", e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-black focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer">
                        <option value="Active">Operational / Active</option>
                        <option value="Inactive">Suspended / Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border border-[var(--color-error)]/30 bg-[var(--bg-primary)] shadow-inner">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-error)] uppercase tracking-widest mb-2 font-mono">Reset System Password</label>
                      <input
                        type="password"
                        value={editUser?.password || ""}
                        onChange={(e) => onEditChange("password", e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[var(--bg-surface)] border border-[var(--color-error)]/20 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--color-error)]/10 focus:border-[var(--color-error)] outline-none transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-error)] uppercase tracking-widest mb-2 font-mono">Confirm New Password</label>
                      <input
                        type="password"
                        value={editUser?.confirmPassword || ""}
                        onChange={(e) => onEditChange("confirmPassword", e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[var(--bg-surface)] border border-[var(--color-error)]/20 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--color-error)]/10 focus:border-[var(--color-error)] outline-none transition-all font-mono"
                      />
                    </div>
                    <p className="col-span-full text-[10px] font-bold text-[var(--color-error)] opacity-80 uppercase tracking-wide">Leave fields blank if you do not wish to update the system password</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border-color)]">
                    <button type="button" onClick={closeEdit} className="px-8 py-3 rounded-2xl border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-black uppercase tracking-widest hover:bg-[var(--bg-primary)] transition-all">Dismiss</button>
                    <button type="submit" disabled={saving} className="px-8 py-3 rounded-2xl bg-[var(--accent-primary)] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[var(--accent-primary)]/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                      {saving ? "Updating Profile..." : "Apply Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* MOVE ROOM MODAL */}
      {
        showMoveRoomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="modal-container bg-[var(--bg-surface)] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-[var(--border-color)]">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div>
                  <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Relocate Employee</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black bg-[var(--accent-shadow)] text-[var(--accent-primary)] px-2 py-0.5 rounded uppercase tracking-widest leading-none">{moveRoomUser?.name}</span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]/50 uppercase tracking-tighter">{moveRoomUser?.email}</span>
                  </div>
                </div>
                <button onClick={closeMoveRoom} className="p-2 hover:bg-[var(--bg-primary)] rounded-xl text-[var(--text-secondary)] transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <form onSubmit={handleMoveRoomSubmit} className="space-y-5">
                  {/* Property Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Select Destination Property *</label>
                    <select
                      value={moveRoomFormData.property_id}
                      onChange={handlePropertyChange}
                      required
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Choose a property --</option>
                      {properties.map((prop) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name} ({prop.code || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Floor Selection */}
                  {moveRoomFormData.property_id && (
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Select Floor Level *</label>
                      <select
                        value={moveRoomFormData.floor}
                        onChange={handleFloorChange}
                        required
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                      >
                        <option value="">-- Choose a floor --</option>
                        {floors.map((floor) => (
                          <option key={floor} value={floor}>
                            {floor}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Room Selection */}
                  {selectedFloor && (
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Assign Room *</label>
                      <select
                        value={moveRoomFormData.room_id}
                        onChange={handleRoomChange}
                        required
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all cursor-pointer"
                      >
                        <option value="">-- Choose a room --</option>
                        {(availableRooms[selectedFloor] || []).map((room) => (
                          <option key={room.id} value={room.id}>
                            Room {room.room_number} - {room.type || "Standard"} (Status: {room.status || "Available"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Move-in Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Effective Relocation Date</label>
                    <input
                      type="date"
                      value={moveRoomFormData.move_in_date}
                      onChange={(e) => setMoveRoomFormData((prev) => ({ ...prev, move_in_date: e.target.value }))}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-bold focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 font-mono">Additional Notes / Remarks</label>
                    <textarea
                      value={moveRoomFormData.notes}
                      onChange={(e) => setMoveRoomFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-medium focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-shadow)] outline-none transition-all"
                      rows="3"
                      placeholder="Enter any additional details about the relocation..."
                    />
                  </div>

                  {/* Room Info Card */}
                  {moveRoomFormData.room_id && (
                    <div className="p-6 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <MapPin size={60} />
                      </div>
                      <h4 className="text-[10px] font-black text-[var(--accent-primary)] uppercase tracking-widest mb-4 font-mono">Relocation Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-[var(--text-secondary)]/60 uppercase tracking-tighter">Property</span>
                          <span className="font-black text-[var(--text-primary)]">{moveRoomFormData.property_name}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-[var(--text-secondary)]/60 uppercase tracking-tighter">Floor Level</span>
                          <span className="font-black text-[var(--text-primary)]">{moveRoomFormData.floor}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-[var(--text-secondary)]/60 uppercase tracking-tighter">Room Identifier</span>
                          <span className="font-black text-[var(--text-primary)]">{moveRoomFormData.room_name}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-[var(--text-secondary)]/60 uppercase tracking-tighter">Effective Date</span>
                          <span className="font-black text-[var(--text-primary)]">{new Date(moveRoomFormData.move_in_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={closeMoveRoom}
                      className="px-8 py-3 rounded-2xl border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-black uppercase tracking-widest hover:bg-[var(--bg-primary)] transition-all"
                    >
                      Dismiss
                    </button>
                    <button
                      type="submit"
                      disabled={movingRoom || !moveRoomFormData.room_id}
                      className="px-8 py-3 rounded-2xl bg-[var(--accent-primary)] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[var(--accent-primary)]/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      {movingRoom ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Execute Move
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      <AddEmployeeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchUsers}
      />

    </div>
  );
}