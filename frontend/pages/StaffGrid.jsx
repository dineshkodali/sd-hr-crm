/* eslint-disable no-unused-vars */
// src/pages/StaffGrid.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { validatePassword, passwordStrengthLabel, passwordStrengthPercent } from '../src/utils/passwordUtils';

axios.defaults.withCredentials = true;

/* Avatar Component - Slight visual tweak for cleaner look */
function Avatar({ user, size = 20 }) {
  const src =
    user?.avatar ||
    user?.avatar_url ||
    user?.photo ||
    user?.picture ||
    user?.profile_url ||
    user?.image;
  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dim = size;
  const style = {
    width: `${dim}px`,
    height: `${dim}px`,
    minWidth: `${dim}px`,
    minHeight: `${dim}px`,
  };
  const fontSize = Math.floor(dim / 2.4);

  if (src) {
    return (
      <div
        className="rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-gray-100 bg-white"
        style={style}
      >
        <img
          src={src}
          alt={user?.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center font-bold shrink-0 shadow-inner"
      style={{ ...style, fontSize: `${fontSize}px` }}
    >
      {initials}
    </div>
  );
}

/* Staff Detail Panel */
function StaffDetailPanel({ open, onClose, user, loading }) {
  if (!open) return null;

  const name =
    user?.name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    "Unknown";
  const avatar = user?.avatar || user?.photo || user?.image || null;
  const email = user?.email || "—";
  const phone = user?.phone || "—";
  const role = user?.role || "—";
  const joiningDate = user?.joining_date
    ? new Date(user.joining_date).toLocaleDateString()
    : user?.created_at
      ? new Date(user.created_at).toLocaleDateString()
      : "—";

  const dob = user?.dob
    ? new Date(user.dob).toLocaleDateString()
    : user?.date_of_birth
      ? new Date(user.date_of_birth).toLocaleDateString()
      : "—";
  const gender = user?.gender || "—";
  const nationality = user?.nationality || "—";
  const religion = user?.religion || "—";
  const marital_status = user?.marital_status || "—";

  const address = user?.address || user?.addr || "—";
  const city = user?.city || "—";
  const state = user?.state || "—";
  const country = user?.country || "—";

  const resumeUrl = user?.resume_url || user?.resume || user?.cv || null;

  return (
    // FIXED: Added 'top-[60px]' to push the panel below the Navbar height
    // z-index is kept high, but this physical spacing ensures visibility regardless of stacking context
    <div className="fixed inset-0 top-[64px] z-[100] flex justify-end h-[calc(100vh-64px)]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Side Panel */}
      <aside className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-slide-in-right border-l border-gray-100">
        {/* Panel Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-5">
            {/* Large Avatar in Header */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-2xl font-bold border border-gray-200 shadow-sm shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (name || "U")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{name}</div>
              <div className="text-sm font-medium text-gray-500 capitalize mt-0.5">
                {role}
              </div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Joined: {joiningDate}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={resumeUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${resumeUrl
                  ? "bg-slate-800 text-white hover:bg-slate-900 shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              onClick={(e) => !resumeUrl && e.preventDefault()}
            >
              {resumeUrl ? "Download Resume" : "No Resume"}
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
          {loading ? (
            <div className="text-center text-gray-500 py-12">
              Loading profile details...
            </div>
          ) : (
            <>
              {/* Contact Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    EMAIL
                  </div>
                  <div className="text-sm font-semibold text-gray-800 break-all">
                    {email}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    PHONE
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {phone}
                  </div>
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800">
                    Personal Information
                  </h4>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Full Name</div>
                    <div className="font-medium text-gray-800 text-sm">
                      {name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Date of Birth
                    </div>
                    <div className="font-medium text-gray-800 text-sm">
                      {dob}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Gender</div>
                    <div className="font-medium text-gray-800 text-sm">
                      {gender}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Nationality
                    </div>
                    <div className="font-medium text-gray-800 text-sm">
                      {nationality}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Religion</div>
                    <div className="font-medium text-gray-800 text-sm">
                      {religion}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Marital Status
                    </div>
                    <div className="font-medium text-gray-800 text-sm">
                      {marital_status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800">
                    Address Information
                  </h4>
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Address</div>
                    <div className="font-medium text-gray-800 text-sm">
                      {address}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">City</div>
                      <div className="font-medium text-gray-800 text-sm">
                        {city}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">State</div>
                      <div className="font-medium text-gray-800 text-sm">
                        {state}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Country</div>
                      <div className="font-medium text-gray-800 text-sm">
                        {country}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}


function AddEmployeeModal({ open, onClose, onSuccess }) {
  // Password helpers (imported at top of file)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    phone: '',
    branch: '',
    status: 'active'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStrengthLabelState, setPwStrengthLabelState] = useState('');
  const [pwPercent, setPwPercent] = useState(0);
  const [pwFieldErrors, setPwFieldErrors] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password') {
      // Live strength and partial feedback
      try {
        const label = passwordStrengthLabel(value);
        const pct = passwordStrengthPercent(value);
        setPwStrengthLabelState(label);
        setPwPercent(pct);
        const v = validatePassword(value);
        // For live feedback, show missing criteria but don't block submit yet
        setPwFieldErrors(v.errors || []);
      } catch (err) {
        // ignore if utils not available
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!formData.name || !formData.email || !formData.role) {
      setError('Name, email, and role are required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password if provided, otherwise generate one
    let password = formData.password;
    if (password) {
      const { valid, errors } = validatePassword(password);
      if (!valid) {
        setError(errors.join('; '));
        return;
      }

      if (formData.confirmPassword && formData.confirmPassword !== password) {
        setError('Password and confirmation do not match');
        return;
      }
    } else {
      password = `${formData.name.split(' ')[0]}${Math.floor(Math.random() * 10000)}`;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: password,
        role: formData.role,
        phone: formData.phone?.trim() || null,
        branch: formData.branch?.trim() || null,
        status: formData.status || 'active'
      };

      console.log('Sending payload:', { ...payload, password: '***' }); // Log without exposing password

      const response = await axios.post('/api/admin/users', payload, {
        withCredentials: true
      });

      if (response.data) {
        // Success - close modal and refresh list
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'staff',
          phone: '',
          branch: '',
          status: 'active'
        });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Add Employee</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Add a new employee to the system.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="John Smith"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="email@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Phone
                </label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="Phone number"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Branch
                </label>
                <input
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="Branch name"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Password with strength and confirm */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Password <span className="text-gray-400 text-xs">(Optional - will be auto-generated)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm pr-10
                               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                    placeholder="Leave empty for auto-generated password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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

                {/* Strength meter */}
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

                {/* Confirm password */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 rounded-lg border border-gray-300 text-slate-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-teal-400 text-white font-medium hover:bg-teal-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --- Main Component --- */
export default function StaffGrid() {
  const outlet = useOutletContext();
  const { user } = outlet || {};

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [sortBy, setSortBy] = useState("name");

  // Drawer state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  /* Delete Modal */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* Dialog State */
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

  const fetchStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/admin/users", {
        withCredentials: true,
      });
      const rows = res?.data?.users || [];
      setStaff(rows);
    } catch (err) {
      console.error("Failed to load staff:", err);
      setError(err?.response?.data?.message || "Failed to load staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Filter and sort staff
  const filteredAndSortedStaff = React.useMemo(() => {
    let result = [...staff];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(searchLower) ||
          s.email?.toLowerCase().includes(searchLower) ||
          s.phone?.includes(search)
      );
    }

    // Apply role filter
    if (filterRole) {
      result = result.filter((s) => s.role === filterRole);
    }

    // Apply branch filter
    if (filterBranch) {
      result = result.filter((s) => s.branch === filterBranch);
    }

    // Apply sorting
    if (sortBy === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "email") {
      result.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    } else if (sortBy === "role") {
      result.sort((a, b) => (a.role || "").localeCompare(b.role || ""));
    } else if (sortBy === "branch") {
      result.sort((a, b) => (a.branch || "").localeCompare(b.branch || ""));
    } else if (sortBy === "recent") {
      result.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });
    }

    return result;
  }, [staff, search, filterRole, filterBranch, sortBy]);

  // Get unique branches and roles for filters
  const uniqueBranches = React.useMemo(() => {
    const branches = [...new Set(staff.map((s) => s.branch).filter(Boolean))];
    return branches.sort();
  }, [staff]);

  const uniqueRoles = React.useMemo(() => {
    const roles = [...new Set(staff.map((s) => s.role).filter(Boolean))];
    return roles.sort();
  }, [staff]);

  const openProfile = async (id) => {
    setSelectedUserId(id);
    setDrawerOpen(true);
    setSelectedUser(null);
    setLoadingUser(true);
    try {
      // Optimistic load
      const preUser = staff.find((s) => s.id === id);
      if (preUser) setSelectedUser(preUser);

      const res = await axios.get(`/api/admin/users/${id}`, {
        withCredentials: true,
      });
      setSelectedUser(res.data.user || res.data || {});
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setLoadingUser(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedUserId(null);
    setSelectedUser(null);
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: 'Delete user? This cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/users/${id}`, { withCredentials: true });
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await fetchStaff();
          if (selectedUserId === id) closeDrawer();
        } catch (err) {
          console.error("delete error:", err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: 'Failed to delete user',
            type: 'error'
          });
        }
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteUserId) return;

    try {
      setDeleting(true);

      await axios.delete(`/api/admin/users/${deleteUserId}`, {
        withCredentials: true,
      });

      await fetchStaff();

      if (selectedUserId === deleteUserId) {
        setDrawerOpen(false);
        setSelectedUserId(null);
      }

      setShowDeleteModal(false);
      setDeleteUserId(null);
    } catch (err) {
      console.error("delete error:", err);
      setAlertDialog({
        isOpen: true,
        title: 'Delete Failed',
        message: 'Failed to delete user',
        type: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-800">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Employee</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>&gt;</span> <span>Property</span> <span>&gt;</span>
              <span className="text-slate-900 font-medium">Employee Grid</span>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-400 hover:bg-teal-500 active:bg-teal-600 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add Employee
          </button>
        </div>


        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8 px-4 py-3 flex items-center gap-4">
          {/* LEFT LABEL */}
          <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
            Employees Grid
          </span>

          {/* SEARCH INPUT */}
          <div className="flex-1 flex items-center border border-gray-200 bg-gray-50 rounded-lg px-3 py-2">
            <svg
              className="text-gray-400 mr-2"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              type="text"
              placeholder="Search employees..."
              className="w-full bg-transparent focus:ring-0 text-sm text-gray-700 placeholder-gray-400 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* FILTERS */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">All Branches</option>
            {uniqueBranches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300"
          >
            <option value="recent">Sort By: Recent</option>
            <option value="name">Sort By: Name (A–Z)</option>
            <option value="email">Sort By: Email</option>
            <option value="role">Sort By: Role</option>
            <option value="branch">Sort By: Branch</option>
          </select>
        </div>

        {/* Grid */}
        <div className="p-2">
          {loading ? (
            <div className="col-span-full p-12 text-center text-gray-500">
              Loading staff...
            </div>
          ) : error ? (
            <div className="col-span-full p-12 text-center text-red-500">{error}</div>
          ) : filteredAndSortedStaff.length === 0 ? (
            <div className="col-span-full p-12 text-center text-gray-500">
              No staff found matching your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedStaff.map((s) => {
                return (
                  <div
                    key={s.id || s.email}
                    className="group relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* 3-DOT MENU (Top Right) */}
                    <div className="absolute top-4 right-4 z-10">
                      <button className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors">
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    </div>

                    {/* Avatar with Ring */}
                    <div className="relative mb-4 mt-2">
                      <div className="p-1 rounded-full border-2 border-teal-50 bg-white">
                        <Avatar user={s} size={80} />
                      </div>
                      <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>

                    {/* Basic Info */}
                    <div className="text-center w-full mb-6">
                      <h3 className="text-lg font-bold text-slate-800 truncate px-2 mb-1">
                        {s.name || s.email}
                      </h3>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="inline-block bg-teal-50 text-teal-600 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide border border-teal-100">
                          {s.role || "Staff"}
                        </span>
                        {s.branch && (
                          <span className="inline-block bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1 rounded-full tracking-wide border border-blue-100">
                            {s.branch}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact Details Replacement */}
                    <div className="w-full space-y-3 mb-6 border-t border-b border-gray-50 py-4">
                      <div className="flex items-center gap-3 text-sm text-gray-500 justify-center">
                        <svg
                          className="w-4 h-4 text-gray-400 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="truncate max-w-[150px]">
                          {s.email || "No Email"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 justify-center">
                        <svg
                          className="w-4 h-4 text-gray-400 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <span>{s.phone || "No Phone"}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-3 w-full mt-auto">
                      <button
                        onClick={() => openProfile(s.id)}
                        className="flex-1 bg-white border border-gray-200 hover:border-teal-200 hover:bg-teal-50 text-slate-600 hover:text-teal-600 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
                      >
                        Profile
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setDeleteUserId(s.id);
                          setShowDeleteModal(true);
                        }}
                        className="w-10 flex items-center justify-center bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Add Employee Modal & Delete Modal */}
          {/* ---------------- DELETE MODAL ---------------- */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Are you sure?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  This action cannot be undone. This will permanently delete the
                  user.
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteUserId(null);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <AddEmployeeModal
            open={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSuccess={fetchStaff}
          />
        </div>



        <StaffDetailPanel
          open={drawerOpen}
          onClose={closeDrawer}
          user={selectedUser}
          loading={loadingUser}
        />

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
      </div>
    </div>
  );
}