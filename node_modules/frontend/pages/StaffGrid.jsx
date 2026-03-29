/* eslint-disable no-unused-vars */
// src/pages/StaffGrid.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { validatePassword, passwordStrengthLabel, passwordStrengthPercent } from '../src/utils/passwordUtils';
import { ArrowLeft, Home, AlertCircle, CheckCircle, XCircle, Building, ChevronDown, UserPlus } from "lucide-react";

const DELETE_STYLE_ID = 'staff-grid-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes staffGridCardDelete {
        0%   { opacity: 1; transform: scale(1) rotate(0deg); }
        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
      }
      .staff-grid-card-deleting {
        animation: staffGridCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

axios.defaults.withCredentials = true;

/* Avatar Component - Restored to Teal theme */
function Avatar({ user, size = 20, fontSizeOverride }) {
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
    const fontSize = fontSizeOverride || Math.floor(dim / 2.4);

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
            className="rounded-full bg-teal-500 text-white flex items-center justify-center font-bold shrink-0 shadow-inner"
            style={{ ...style, fontSize: `${fontSize}px` }}
        >
            {initials}
        </div>
    );
}

/* --- NEW COMPLIANCE & PROFILE UI --- */

function StaffDetailPanel({ open, onClose, user, loading, currentUser, onEditSuccess }) {
    const [activeTab, setActiveTab] = useState("Compliance");
    const [showEditModal, setShowEditModal] = useState(false);

    const isAdmin = currentUser?.role === 'admin';
    const showEditButton = true;

    if (!open) return null;

    const name = user?.name || "Unknown Staff";
    const role = user?.role || "Staff";
    const department = user?.department || user?.branch || "General";
    const empId = user?.employee_id || `EMP${String(user?.id || "000").padStart(5, '0')}`;
    const joiningDate = user?.joining_date
        ? new Date(user.joining_date).toLocaleDateString()
        : user?.created_at
            ? new Date(user.created_at).toLocaleDateString()
            : "—";
    const status = user?.status || "active";

    const dbsStatus = user?.dbs_status || 'Pending';
    const dbsFile = user?.dbs_document_url || null;

    const trainingList = [
        { label: 'Safeguarding Training', status: user?.training_safeguarding || 'Pending' },
        { label: 'First Aid', status: user?.training_first_aid || 'Pending' },
        { label: 'Fire Safety', status: user?.training_fire_safety || 'Pending' },
        { label: 'Health & Safety', status: user?.training_health_safety || 'Pending' },
    ];

    const getStatusBadge = (statusText) => {
        const s = (statusText || '').toLowerCase();
        if (s === 'completed' || s === 'clear' || s === 'valid') {
            return <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full capitalize">{statusText}</span>;
        }
        if (s === 'expired' || s === 'failed') {
            return <span className="bg-red-100 text-red-700 text-xs font-medium px-3 py-1 rounded-full capitalize">{statusText}</span>;
        }
        return <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-3 py-1 rounded-full capitalize">{statusText || 'Pending'}</span>;
    };

    return (
        <div className="fixed inset-0 top-[64px] z-[100] flex justify-end h-[calc(100vh-64px)]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
                onClick={onClose}
            />

            {/* Side Panel */}
            <aside className="relative w-full max-w-6xl bg-[#F8F9FA] shadow-2xl h-full flex flex-col animate-slide-in-right overflow-y-auto">

                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">Loading Profile...</div>
                ) : (
                    <div className="p-6 md:p-8 space-y-6">

                        {/* --- TOP HEADER NAVIGATION --- */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={onClose}
                                className="rounded-xl flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {status}
                            </div>
                        </div>

                        {/* --- NAME & BREADCRUMBS --- */}
                        <div>
                            <h1 className="text-3xl font-bold text-[#1F2937]">{name}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <Home className="w-3.5 h-3.5" />
                                <span>›</span>
                                <span>Staff</span>
                                <span>›</span>
                                <span className="text-gray-700">{name}</span>
                            </div>
                        </div>

                        {/* --- HERO CARD (Teal Avatar) --- */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row items-center md:items-start gap-6 relative">
                            <div className="relative">
                                <Avatar user={user} size={100} fontSizeOverride={36} />
                                <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#4ADE80] border-4 border-white rounded-full"></div>
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-xl font-bold text-gray-900">{name}</h2>
                                <p className="text-gray-500 text-sm mt-1">{role} • {department}</p>

                                {/* Action Buttons */}
                                <div className="mt-4 flex gap-2">
                                    <button className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        Upload Avatar
                                    </button>
                                    {showEditButton && (
                                        <button
                                            onClick={() => setShowEditModal(true)}
                                            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- INFO CARDS ROW --- */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <p className="text-xs text-gray-400 mb-1">Employee ID</p>
                                <p className="font-semibold text-gray-800">{empId}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <p className="text-xs text-gray-400 mb-1">Department</p>
                                <p className="font-semibold text-gray-800">{department}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <p className="text-xs text-gray-400 mb-1">Role</p>
                                <p className="font-semibold text-gray-800 capitalize">{role}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <p className="text-xs text-gray-400 mb-1">Joining Date</p>
                                <p className="font-semibold text-gray-800">{joiningDate}</p>
                            </div>
                        </div>

                        {/* --- TABS --- */}
                        <div className="bg-white rounded-t-xl border border-gray-200 shadow-sm">
                            <div className="flex border-b border-gray-100">
                                {['Overview', 'Compliance', 'Leave', 'Documents'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${activeTab === tab
                                            ? 'text-teal-600 bg-teal-50/50'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {tab}
                                        {activeTab === tab && (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-500"></div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* --- TAB CONTENT --- */}
                            <div className="p-6 min-h-[300px]">

                                {/* COMPLIANCE TAB */}
                                {activeTab === 'Compliance' && (
                                    <div className="space-y-6">
                                        <div className={`flex items-start gap-4 p-4 border rounded-xl bg-white shadow-sm ${dbsStatus.toLowerCase() === 'clear' ? 'border-green-100' : 'border-orange-100'}`}>
                                            <div className={`mt-1 ${dbsStatus.toLowerCase() === 'clear' ? 'text-green-500' : 'text-orange-500'}`}>
                                                {dbsStatus.toLowerCase() === 'clear' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900">DBS Check</h4>
                                                <p className="text-sm text-gray-500">
                                                    {dbsFile ? "Document on file" : "No DBS document uploaded"}
                                                </p>
                                            </div>
                                            {getStatusBadge(dbsStatus)}
                                        </div>

                                        <div className="bg-[#F8F9FA] rounded-xl p-4">
                                            <h4 className="text-gray-500 text-sm font-medium mb-4">Mandatory Training Status</h4>
                                            <div className="space-y-3">
                                                {trainingList.map((training, idx) => (
                                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                                                        <span className="text-sm text-gray-700 font-medium">{training.label}</span>
                                                        {getStatusBadge(training.status)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* OVERVIEW TAB */}
                                {activeTab === 'Overview' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-bold text-gray-800 mb-4">Contact Info</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-400">Email</label>
                                                    <p className="text-sm font-medium">{user?.email}</p>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400">Phone</label>
                                                    <p className="text-sm font-medium">{user?.phone || "No phone listed"}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 mb-4">Address</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-400">Full Address</label>
                                                    <p className="text-sm font-medium">{user?.address || user?.addr || "No address listed"}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs text-gray-400">City</label>
                                                        <p className="text-sm font-medium">{user?.city || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400">Country</label>
                                                        <p className="text-sm font-medium">{user?.country || "-"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'Leave' && (
                                    <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                        <div className="bg-gray-100 p-3 rounded-full mb-3"><Home className="w-6 h-6 text-gray-300" /></div>
                                        No leave history available.
                                    </div>
                                )}
                                {activeTab === 'Documents' && (
                                    <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                        <div className="bg-gray-100 p-3 rounded-full mb-3">
                                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        No documents uploaded.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </aside>

            {/* Edit Modal — rendered outside the aside so it's not clipped */}
            {showEditModal && (
                <EditEmployeeModal
                    open={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    employee={user}
                    onSuccess={() => {
                        setShowEditModal(false);
                        if (onEditSuccess) onEditSuccess();
                    }}
                />
            )}
        </div>
    );
}


function AddEmployeeModal({ open, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'staff',
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

    const [dynamicColumns, setDynamicColumns] = useState([]);
    const [hotels, setHotels] = useState([]);

    const fetchDynamicColumns = async () => {
        try {
            const res = await axios.get('/api/forms-builder/tables/users/columns', { withCredentials: true });
            if (res.data?.columns) {
                const standardFields = [
                    'id', 'name', 'email', 'password', 'role', 'phone', 'branch', 'address', 'city', 'status',
                    'created_at', 'updated_at', 'last_login', 'hotel_id', 'is_active',
                    'property',
                    'country', 'authenticator_secret', 'authenticator_enabled', 'backup_codes',
                    'gender', 'dob', 'nationality', 'religion', 'marital_status', 'state', 'resume_url', 'avatar'
                ];
                const customCols = res.data.columns.filter(col => !standardFields.includes(col.column_name));
                setDynamicColumns(customCols);
            }
        } catch (err) {
            console.error("Error fetching dynamic user columns:", err);
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

    React.useEffect(() => {
        if (open) {
            document.body.classList.add("form-modal-open");
            fetchBranches();
            fetchDynamicColumns();
            fetchHotels();
        } else {
            document.body.classList.remove("form-modal-open");
        }
        return () => {
            document.body.classList.remove("form-modal-open");
        };
    }, [open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'hotel_id') {
            const selected = hotels.find((h) => String(h.id) === String(value));
            setFormData(prev => ({
                ...prev,
                hotel_id: value,
                hotel_name: selected?.name || ''
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        if (name === 'password') {
            try {
                const label = passwordStrengthLabel(value);
                const pct = passwordStrengthPercent(value);
                setPwStrengthLabelState(label);
                setPwPercent(pct);
                const v = validatePassword(value);
                setPwFieldErrors(v.errors || []);
            } catch (err) {
                // ignore
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
                if (onSuccess) onSuccess();
                onClose();
                setFormData({
                    name: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    role: 'staff',
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
            const errorMessage = err.response?.data?.error || err.message || 'Failed to create employee';
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-white rounded-xl w-full max-w-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col h-[72vh]">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Add Employee</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Add a new employee to the system.</p>
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
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl shrink-0">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    placeholder="John Smith"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    placeholder="email@example.com"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Phone <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    placeholder="Phone number"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                >
                                    <option value="staff">Staff</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            {/* Property / Hotel */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Property <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="hotel_id"
                                    value={formData.hotel_id}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                >
                                    <option value="">Select property</option>
                                    {hotels.map((h) => (
                                        <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Branch */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
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
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                        placeholder="Select existing branch or type new one"
                                    />

                                    {showBranchDropdown && branches.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                            {branches
                                                .filter(branch =>
                                                    branch.toLowerCase().includes(String(formData.branch || '').toLowerCase())
                                                )
                                                .map((branch, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, branch });
                                                            setShowBranchDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-teal-50 hover:text-teal-700 transition-colors text-sm border-b border-gray-100 last:border-b-0 flex items-center gap-2 rounded-xl"
                                                    >
                                                        <Building className="w-4 h-4 text-gray-400" />
                                                        <span>{branch}</span>
                                                    </button>
                                                ))
                                            }

                                            {formData.branch &&
                                                !branches.some(b => b.toLowerCase() === formData.branch.toLowerCase()) && (
                                                    <div className="px-4 py-2.5 text-sm text-gray-500 border-t border-gray-200 bg-gray-50">
                                                        <div className="flex items-center gap-2">
                                                            <UserPlus className="w-4 h-4 text-teal-500" />
                                                            <span>Create new branch: <strong className="text-teal-600">"{formData.branch}"</strong></span>
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Status <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                >
                                    <option value="active">Active</option>
                                    <option value="pending">Pending</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    placeholder="Full address"
                                />
                            </div>

                            {/* City */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    City <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    placeholder="City"
                                />
                            </div>

                            {/* Password */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                        placeholder="Enter password"
                                    />
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

                                <div className="mt-3">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Confirm Password <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            </div>

                            {/* Dynamic Fields */}
                            {dynamicColumns.length > 0 && (
                                <div className="md:col-span-2 pt-4 border-t border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3">Additional Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                        {dynamicColumns.map((col) => (
                                            <div key={col.column_name} className={['textarea', 'text', 'varchar'].includes(col.input_type || 'text') && (col.max_length > 100 || col.data_type === 'TEXT') ? "md:col-span-2" : ""}>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                    {col.column_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    {!col.is_nullable && <span className="text-red-500">*</span>}
                                                </label>

                                                {col.input_type === 'dropdown' || col.input_type === 'select' ? (
                                                    <select
                                                        name={col.column_name}
                                                        value={formData[col.column_name] || ''}
                                                        onChange={handleChange}
                                                        required
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                    >
                                                        <option value="">Select {col.column_name.replace(/_/g, ' ')}</option>
                                                        {Array.isArray(col.input_options) && col.input_options.map((opt, i) => (
                                                            <option key={i} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : col.input_type === 'checkbox' || col.data_type === 'BOOLEAN' ? (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <input
                                                            type="checkbox"
                                                            name={col.column_name}
                                                            checked={!!formData[col.column_name]}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, [col.column_name]: e.target.checked }))}
                                                            className="rounded-xl border-gray-300 text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span className="text-sm text-gray-700">Yes</span>
                                                    </div>
                                                ) : col.input_type === 'textarea' ? (
                                                    <textarea
                                                        name={col.column_name}
                                                        value={formData[col.column_name] || ''}
                                                        onChange={handleChange}
                                                        required
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y min-h-[80px]"
                                                        placeholder={`Enter ${col.column_name.replace(/_/g, ' ')}`}
                                                    />
                                                ) : (
                                                    <input
                                                        type={col.input_type === 'date' ? 'date' : 'text'}
                                                        name={col.column_name}
                                                        value={formData[col.column_name] || ''}
                                                        onChange={handleChange}
                                                        required
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
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

                    {/* Footer — outside scroll area, always visible */}
                    <div className="flex justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-5 py-2 rounded-xl border border-gray-300 text-slate-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 rounded-xl bg-teal-400 text-white font-medium hover:bg-teal-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Adding...' : 'Add Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Edit Employee Modal ─────────────────────────────────────────────────── */
function EditEmployeeModal({ open, onClose, employee, onSuccess }) {
    const [editingId, setEditingId] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // ── Permission roles ──────────────────────────────────────────────────
    const [permissionRoles, setPermissionRoles] = useState([]);

    const fetchPermissionRoles = async () => {
        try {
            const res = await axios.get('/api/access/roles', { withCredentials: true });
            setPermissionRoles(res?.data?.roles || []);
        } catch (err) {
            console.error('Failed to fetch permission roles:', err);
            setPermissionRoles([]);
        }
    };

    // ── Hotels ────────────────────────────────────────────────────────────
    const [hotels, setHotels] = useState([]);

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

    // ── Branches ──────────────────────────────────────────────────────────
    const [branches, setBranches] = useState([]);
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);
    const [originalBranchValue, setOriginalBranchValue] = useState('');

    const fetchBranches = async () => {
        try {
            const res = await axios.get('/api/admin/users', {
                params: { limit: 1000 },
                withCredentials: true
            });
            const allUsers = res.data.users || [];
            const uniqueBranches = [...new Set(
                allUsers
                    .map(u => u.branch)
                    .filter(b => b && b.trim() !== '')
            )].sort();
            setBranches(uniqueBranches);
        } catch (err) {
            console.error('Failed to fetch branches:', err);
            setBranches([]);
        }
    };

    // ── Load full user details from API ───────────────────────────────────
    const loadUserDetails = async (id) => {
        if (!id) return;
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

            setEditUser({
                id: u.id,
                name: String(u.name || '').trim(),
                email: u.email || '',
                phone: u.phone || u.mobile || u.contact || '',
                branch: u.branch || u.department || '',
                hotel_id: u.hotel_id || u.hotelId || '',
                hotel_name: u.hotel_name || u.hotelName || '',
                role: u.role || 'staff',
                permission_role_id: permissionRoleId,
                status: u.status || 'active',
                address: u.address || u.addr || '',
                city: u.city || '',
                avatar: u.avatar || u.photo || u.image || null,
                password: '',
                confirmPassword: ''
            });
            setAvatarPreview(u.avatar || u.photo || u.image || null);
        } catch (err) {
            console.error('Failed to load user details:', err);
            setError('Failed to load employee details');
        }
    };

    // ── Open effect ───────────────────────────────────────────────────────
    React.useEffect(() => {
        if (open) {
            document.body.classList.add("form-modal-open");
            const id = employee?.id || null;
            setEditingId(id);
            setOriginalBranchValue(employee?.branch || employee?.department || '');
            setError('');
            setAvatarFile(null);
            setAvatarPreview(null);
            setEditUser(null);
            // Parallel fetches
            fetchBranches();
            fetchHotels();
            fetchPermissionRoles();
            loadUserDetails(id);
        } else {
            document.body.classList.remove("form-modal-open");
        }
        return () => {
            document.body.classList.remove("form-modal-open");
        };
    }, [open, employee]);

    const onEditChange = (key, value) => {
        setEditUser((s) => ({ ...s, [key]: value }));
    };

    const onAvatarChange = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => setAvatarPreview(e.target.result);
        reader.readAsDataURL(file);
        setAvatarFile(file);
    };

    // ── Submit ────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!editUser || !editingId) return;
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
            .filter((f) => String(editUser?.[f.key] ?? '').trim() === '')
            .map((f) => f.label);

        if (missing.length) {
            setError(`Please fill all required fields: ${missing.join(', ')}`);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(editUser.email || '').trim())) {
            setError('Please enter a valid email address');
            return;
        }

        const password = String(editUser.password || '');
        const { valid, errors } = validatePassword(password);
        if (!valid) {
            setError((errors || []).join('; ') || 'Password is not strong enough');
            return;
        }
        if (String(editUser.confirmPassword || '') !== password) {
            setError('Password and confirmation do not match');
            return;
        }

        try {
            setSaving(true);
            const form = new FormData();
            form.append('name', String(editUser.name || '').trim());
            form.append('email', String(editUser.email || '').trim());
            if (password) form.append('password', password);
            form.append('branch', editUser.branch);
            form.append('hotel_id', editUser.hotel_id);
            form.append('hotel_name', editUser.hotel_name || '');
            form.append('role', editUser.role);
            form.append('status', editUser.status);
            form.append('phone', editUser.phone);
            form.append('address', editUser.address);
            form.append('city', editUser.city);
            if (avatarFile) form.append('avatar', avatarFile);

            await axios.put(`/api/admin/users/${editingId}`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
            });

            // Update permission role (non-blocking)
            try {
                await axios.put(
                    `/api/access/users/${editingId}/roles`,
                    { role_id: editUser.permission_role_id ? Number(editUser.permission_role_id) : null },
                    { withCredentials: true }
                );
            } catch (err) {
                console.error('Failed to update user permission role:', err);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error updating employee:', err);
            const errorMessage =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err.message ||
                'Failed to update employee';
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-white rounded-xl w-full max-w-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Edit Employee</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Update employee information for {employee?.name}
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
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl shrink-0">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Loading state */}
                {!editUser && (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                        Loading employee data…
                    </div>
                )}

                {/* Form */}
                {editUser && (
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        {/* Scrollable body */}
                        <div className="px-6 py-6 overflow-y-auto flex-1">
                            <div className="space-y-6">

                                {/* Avatar */}
                                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl border border-dashed border-gray-300">
                                    <div className="w-24 h-24 rounded-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl text-gray-300 font-bold">
                                                {(editUser?.name || 'U').charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                                            onChange={(ev) => {
                                                const f = ev.target.files?.[0];
                                                if (f) onAvatarChange(f);
                                            }}
                                        />
                                        <p className="mt-1 text-xs text-gray-400">Recommended: Square JPG/PNG, max 4 MB.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

                                    {/* Full Name */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editUser?.name || ''}
                                            onChange={(e) => onEditChange('name', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="John Smith"
                                        />
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={editUser?.email || ''}
                                            onChange={(e) => onEditChange('email', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="email@example.com"
                                        />
                                    </div>

                                    {/* Phone */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Phone <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editUser?.phone || ''}
                                            onChange={(e) => onEditChange('phone', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="Phone number"
                                        />
                                    </div>

                                    {/* Role */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Role <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editUser?.role || 'staff'}
                                            onChange={(e) => onEditChange('role', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                        >
                                            <option value="staff">Staff</option>
                                            <option value="manager">Manager</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>

                                    {/* Permission Role */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Permission Role</label>
                                        <select
                                            value={editUser?.permission_role_id || ''}
                                            onChange={(e) => onEditChange('permission_role_id', e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                        >
                                            <option value="">None</option>
                                            {permissionRoles.map((r) => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Branch */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Branch <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                value={editUser?.branch || ''}
                                                onChange={(e) => onEditChange('branch', e.target.value)}
                                                required
                                                onFocus={() => setShowBranchDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowBranchDropdown(false), 200)}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                placeholder="Select existing branch or type new one"
                                            />

                                            {showBranchDropdown && branches.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                    {branches
                                                        .filter(branch => {
                                                            if (String(editUser?.branch || '') === String(originalBranchValue || '')) return true;
                                                            return branch.toLowerCase().includes(String(editUser?.branch || '').toLowerCase());
                                                        })
                                                        .map((branch, index) => (
                                                            <button
                                                                key={index}
                                                                type="button"
                                                                onClick={() => {
                                                                    onEditChange('branch', branch);
                                                                    setShowBranchDropdown(false);
                                                                }}
                                                                className="w-full text-left px-4 py-2.5 hover:bg-teal-50 hover:text-teal-700 transition-colors text-sm border-b border-gray-100 last:border-b-0 flex items-center gap-2 rounded-xl"
                                                            >
                                                                <Building className="w-4 h-4 text-gray-400" />
                                                                <span>{branch}</span>
                                                            </button>
                                                        ))
                                                    }

                                                    {editUser?.branch &&
                                                        String(editUser.branch) !== String(originalBranchValue || '') &&
                                                        !branches.some(b => b.toLowerCase() === String(editUser.branch).toLowerCase()) && (
                                                            <div className="px-4 py-2.5 text-sm text-gray-500 border-t border-gray-200 bg-gray-50">
                                                                <div className="flex items-center gap-2">
                                                                    <UserPlus className="w-4 h-4 text-teal-500" />
                                                                    <span>Create new branch: <strong className="text-teal-600">"{editUser.branch}"</strong></span>
                                                                </div>
                                                            </div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Status <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editUser?.status || 'active'}
                                            onChange={(e) => onEditChange('status', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                        >
                                            <option value="active">Active</option>
                                            <option value="pending">Pending</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>

                                    {/* Property */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Property <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editUser?.hotel_id || ''}
                                            onChange={(e) => {
                                                const nextId = e.target.value;
                                                const selected = hotels.find((h) => String(h.id) === String(nextId));
                                                onEditChange('hotel_id', nextId);
                                                onEditChange('hotel_name', selected?.name || '');
                                            }}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                        >
                                            <option value="">Select property</option>
                                            {hotels.map((h) => (
                                                <option key={h.id} value={h.id}>{h.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editUser?.address || ''}
                                            onChange={(e) => onEditChange('address', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="Full address"
                                        />
                                    </div>

                                    {/* City */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            City <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={editUser?.city || ''}
                                            onChange={(e) => onEditChange('city', e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="City"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            value={editUser?.password || ''}
                                            onChange={(e) => onEditChange('password', e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="Leave blank to keep current"
                                        />
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={editUser?.confirmPassword || ''}
                                            onChange={(e) => onEditChange('confirmPassword', e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            placeholder="Leave blank to keep current"
                                        />
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Footer — always visible, outside scroll area */}
                        <div className="flex justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-5 py-2 rounded-xl border border-gray-300 text-slate-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Updating…' : 'Update Employee'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function StaffGrid() {
    const outlet = useOutletContext();
    const { user } = outlet || {};

    const [staff, setStaff] = useState([]);
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
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

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning'
    });

    const [alertDialog, setAlertDialog] = useState({
        isOpen: false, title: '', message: '', type: 'info'
    });

    useEffect(() => {
        const shouldHide = Boolean(confirmDialog.isOpen || alertDialog.isOpen || showAddModal || drawerOpen);
        try {
            document.body.classList.toggle('form-modal-open', shouldHide);
        } catch { }
        return () => {
            try { document.body.classList.remove('form-modal-open'); } catch { }
        };
    }, [confirmDialog.isOpen, alertDialog.isOpen, showAddModal, drawerOpen]);

    const fetchStaff = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await axios.get("/api/admin/users", { withCredentials: true });
            setStaff(res?.data?.users || []);
        } catch (err) {
            console.error("Failed to load staff:", err);
            setError(err?.response?.data?.message || "Failed to load staff");
            setStaff([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStaff(); }, []);

    const filteredAndSortedStaff = React.useMemo(() => {
        let result = [...staff];

        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(
                (s) =>
                    s.name?.toLowerCase().includes(searchLower) ||
                    s.email?.toLowerCase().includes(searchLower) ||
                    s.phone?.includes(search)
            );
        }
        if (filterRole) result = result.filter((s) => s.role === filterRole);
        if (filterBranch) result = result.filter((s) => s.branch === filterBranch);

        if (sortBy === "name") result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        else if (sortBy === "email") result.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
        else if (sortBy === "role") result.sort((a, b) => (a.role || "").localeCompare(b.role || ""));
        else if (sortBy === "branch") result.sort((a, b) => (a.branch || "").localeCompare(b.branch || ""));
        else if (sortBy === "recent") result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        return result;
    }, [staff, search, filterRole, filterBranch, sortBy]);

    const uniqueBranches = React.useMemo(() => {
        return [...new Set(staff.map((s) => s.branch).filter(Boolean))].sort();
    }, [staff]);

    const uniqueRoles = React.useMemo(() => {
        return [...new Set(staff.map((s) => s.role).filter(Boolean))].sort();
    }, [staff]);

    const openProfile = async (id) => {
        setSelectedUserId(id);
        setDrawerOpen(true);
        setSelectedUser(null);
        setLoadingUser(true);
        try {
            const preUser = staff.find((s) => s.id === id);
            if (preUser) setSelectedUser(preUser);

            const res = await axios.get(`/api/admin/users/${id}`, { withCredentials: true });
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
                    setDeletingIds(prev => new Set(prev).add(id));
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

                    const ANIM_DURATION = 460;
                    setTimeout(() => {
                        setStaff(prev => (Array.isArray(prev) ? prev.filter(s => String(s.id) !== String(id)) : prev));
                        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    }, ANIM_DURATION);

                    await axios.delete(`/api/admin/users/${id}`, { withCredentials: true });
                    await fetchStaff();
                    if (selectedUserId === id) closeDrawer();
                } catch (err) {
                    console.error("delete error:", err);
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    const backendMessage = err?.response?.data?.message || err?.response?.data?.error;
                    const status = err?.response?.status;
                    setAlertDialog({
                        isOpen: true,
                        title: 'Delete Failed',
                        message: backendMessage || (status ? `Failed to delete user (HTTP ${status})` : 'Failed to delete user'),
                        type: 'error'
                    });
                }
            }
        });
    };

    return (
        <div className="-m-6 p-6 min-h-screen bg-[var(--bg-primary)] font-sans text-slate-800">
            <div className="p-3 sm:p-4 md:p-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Employee</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                <polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            <span>&gt;</span> <span>Property</span> <span>&gt;</span>
                            <span className="text-slate-900 font-medium">Employee Grid</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-400 hover:bg-teal-500 active:bg-teal-600 text-white rounded-xl shadow-sm font-medium transition-colors"
                    >
                        <span className="text-lg leading-none">+</span> Add Employee
                    </button>
                </div>

                {/* Toolbar */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8 px-4 py-3 flex items-center gap-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-gray-300">
                    <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Employees Grid</span>

                    <div className="flex-[8] md:flex-[10] min-w-[200px] flex items-center border border-gray-200 bg-gray-50 rounded-xl px-3 py-2">
                        <input
                            type="text"
                            placeholder="Search employees..."
                            className="rounded-xl w-full bg-transparent focus:ring-0 text-sm text-gray-700 placeholder-gray-400 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="border border-gray-200 rounded-xl px-2 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 max-w-[140px]"
                    >
                        <option value="">All Roles</option>
                        {uniqueRoles.map((role) => (
                            <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                        ))}
                    </select>

                    <select
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                        className="border border-gray-200 rounded-xl px-2 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 max-w-[140px]"
                    >
                        <option value="">All Branches</option>
                        {uniqueBranches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="border border-gray-200 rounded-xl px-2 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 max-w-[140px]"
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
                        <div className="col-span-full p-12 text-center text-gray-500">Loading staff...</div>
                    ) : error ? (
                        <div className="col-span-full p-12 text-center text-red-500">{error}</div>
                    ) : filteredAndSortedStaff.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-gray-500">No staff found matching your filters.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredAndSortedStaff.map((s) => {
                                const isDeleting = deletingIds.has(s.id);
                                return (
                                    <div
                                        key={s.id || s.email}
                                        className={`group relative bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 ${isDeleting ? 'staff-grid-card-deleting' : ''}`}
                                    >
                                        {/* 3-dot menu */}
                                        <div className="absolute top-4 right-4 z-10">
                                            <button className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                    <circle cx="12" cy="5" r="2" />
                                                    <circle cx="12" cy="12" r="2" />
                                                    <circle cx="12" cy="19" r="2" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Avatar */}
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
                                                    <span className="inline-block bg-[var(--accent-shadow)] text-[var(--accent-primary)] text-xs font-bold px-3 py-1 rounded-full tracking-wide border border-[var(--accent-primary)]/30 shadow-sm">
                                                        {s.branch}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Contact */}
                                        <div className="w-full space-y-3 mb-6 border-t border-b border-gray-50 py-4">
                                            <div className="flex items-center gap-3 text-sm text-gray-500 justify-center">
                                                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span className="truncate max-w-[150px]">{s.email || "No Email"}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 justify-center">
                                                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                <span>{s.phone || "No Phone"}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-3 w-full mt-auto">
                                            <button
                                                onClick={() => openProfile(s.id)}
                                                className="flex-1 bg-white border border-gray-200 hover:border-teal-200 hover:bg-teal-50 text-slate-600 hover:text-teal-600 text-sm font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                            >
                                                Profile
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="w-10 flex items-center justify-center bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Add Employee Modal */}
                    <AddEmployeeModal
                        open={showAddModal}
                        onClose={() => setShowAddModal(false)}
                        onSuccess={fetchStaff}
                    />
                </div>

                {/* Staff Detail Panel */}
                <StaffDetailPanel
                    open={drawerOpen}
                    onClose={closeDrawer}
                    user={selectedUser}
                    loading={loadingUser}
                    currentUser={user}
                    onEditSuccess={async () => {
                        await fetchStaff();
                        if (selectedUserId) {
                            try {
                                const res = await axios.get(`/api/admin/users/${selectedUserId}`, { withCredentials: true });
                                setSelectedUser(res.data?.user || res.data);
                            } catch (err) {
                                console.error('Failed to refresh user data:', err);
                            }
                        }
                    }}
                />

                {/* Confirm Dialog */}
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