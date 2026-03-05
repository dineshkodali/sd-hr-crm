/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
    Home,
    Building,
    AlertCircle,
    CheckCircle,
    Clock,
    Search,
    ChevronDown,
    Filter,
    Columns,
    Download,
    Edit,
    Trash2,
    Eye,
    EyeOff,
    X,
    Check,
    ClipboardList
} from 'lucide-react';
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'complaints-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes complaintSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      @keyframes complaintCardDelete {
        0%   { opacity: 1; transform: scale(1) rotate(0deg); }
        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
      }
      tr.complaint-deleting {
        animation: complaintSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
      .complaint-card-deleting {
        animation: complaintCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || '';
const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 15000 });

// --- Helpers for Formatting ---
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '-';
    }
}

function formatDateISO(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toISOString().slice(0, 10);
    } catch { return value; }
}

function getPriorityColor(p) {
    const low = String(p).toLowerCase();
    if (low === "urgent" || low === "high") return { dot: "bg-red-500", text: "text-red-700" };
    if (low === "medium") return { dot: "bg-orange-500", text: "text-orange-700" };
    return { dot: "bg-green-500", text: "text-green-700" };
}

function getStatusColor(s) {
    const low = String(s).toLowerCase();
    if (low === "completed" || low === "resolved") return { dot: "bg-green-500", text: "text-green-700" };
    if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
    if (low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
    return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
    return "bg-teal-100 text-teal-700";
}

function getInitials(name) {
    if (!name) return '?';
    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

export default function Complaints({ user }) {
    // Get current user from props or localStorage
    const currentUser = user || (() => {
        try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    // Get permissions for complaints module
    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
    const hasRead = canRead("complaints");
    const hasCreate = canCreate("complaints");
    const hasUpdate = canUpdate("complaints");
    const hasDelete = canDelete("complaints");

    const [complaints, setComplaints] = useState([]);
    // Track rows/cards currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingComplaint, setViewingComplaint] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [query, setQuery] = useState("");

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    const [staffUsers, setStaffUsers] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [serviceUsers, setServiceUsers] = useState([]);
    const [serviceUsersLoading, setServiceUsersLoading] = useState(false);

    // Filter and Sort State
    const [priorityFilter, setPriorityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [propertyFilter, setPropertyFilter] = useState("");
    const [sortBy, setSortBy] = useState("");

    // Column Visibility State
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
    const viewRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        priority: 'medium',
        property_id: '',
        reported_by: '',
        reported_date: '',
        assigned_to: '',
        scheduled_date: '',
    });
    const [properties, setProperties] = useState([]);

    // Custom Category Options Adder (similar to Inspections.jsx)
    const CATEGORY_STORAGE_KEY = 'complaints.customCategories';
    const BUILTIN_CATEGORIES = [
        'Maintenance',
        'Security',
        'Cleaning',
        'Noise',
        'Other',
    ];

    const [customCategories, setCustomCategories] = useState([]);
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

    useEffect(() => {
        if (!showForm) {
            setShowCustomCategoryInput(false);
            setCustomCategoryValue('');
        }
    }, [showForm]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setCustomCategories(parsed.filter(Boolean).map(String));
            }
        } catch {
            setCustomCategories([]);
        }
    }, []);

    const persistCustomCategories = (list) => {
        try {
            localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(list));
        } catch {
            // ignore storage errors
        }
    };

    const handleCategoryChange = (e) => {
        const value = e.target.value;
        if (value === '__add_new__') {
            setShowCustomCategoryInput(true);
            setCustomCategoryValue('');
            setFormData((p) => ({ ...p, category: '' }));
            return;
        }
        setShowCustomCategoryInput(false);
        setCustomCategoryValue('');
        setFormData((p) => ({ ...p, category: value }));
    };

    const saveCustomCategory = () => {
        const next = String(customCategoryValue || '').trim();
        if (!next) return;

        const builtinLower = new Set(BUILTIN_CATEGORIES.map((t) => String(t).toLowerCase()));
        const merged = [...customCategories];
        if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
            merged.push(next);
            setCustomCategories(merged);
            persistCustomCategories(merged);
        }

        setFormData((p) => ({ ...p, category: next }));
        setShowCustomCategoryInput(false);
        setCustomCategoryValue('');
    };

    // Custom columns from Forms Builder
    const [customColumns, setCustomColumns] = useState([]);
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});
    const [availableColumns, setAvailableColumns] = useState([]);

    const BASE_EXPORT_COLUMNS = useMemo(
        () => [
            { header: 'Reference', key: 'reference' },
            { header: 'Title', key: 'title' },
            { header: 'Type', key: 'complaintType' },
            { header: 'Property', key: 'propertyName' },
            { header: 'Status', key: 'status' },
            { header: 'Date Filed', key: 'dateFiled' },
            { header: 'Complainant', key: 'complainant' }
        ],
        []
    );

    const exportColumns = useMemo(() => {
        const custom = (customColumns || []).map((col) => ({
            header: String(col).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
            key: col,
        }));
        return [...BASE_EXPORT_COLUMNS, ...custom];
    }, [BASE_EXPORT_COLUMNS, customColumns]);

    useEffect(() => {
        const nextKeys = exportColumns.map((c) => c.key);
        setSelectedExportKeys((prev) => {
            const prevSet = new Set(prev);
            const merged = nextKeys.filter((k) => prevSet.has(k));
            if (merged.length === 0) return nextKeys;
            for (const k of nextKeys) {
                if (!prevSet.has(k)) merged.push(k);
            }
            return merged;
        });
    }, [exportColumns]);

    // Define all available columns
    const DEFAULT_COLUMNS = [
        "checkbox",
        "type",
        "reference",
        "description",
        "priority",
        "status",
        "assigned",
        "date",
        "actions",
    ];

    // Column visibility state - load from localStorage or default to all visible
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('complaints_visible_columns');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading column visibility:', e);
        }
        return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
    });

    // Modal states
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

    const showAlert = (title, message, type = 'info') => {
        setAlertDialog({ isOpen: true, title, message, type });
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmDialog({ isOpen: true, title, message, type: 'danger', onConfirm });
    };

    // Fetch available columns from Forms Builder
    const fetchAvailableColumns = async () => {
        try {
            const res = await api.get('/api/forms-builder/tables/complaints/columns');
            const cols = res.data?.columns || [];

            // Extract column names (handle both string arrays and object arrays)
            const columnNames = cols.map(col => {
                if (typeof col === 'string') return col;
                if (col.column_name) return col.column_name;
                if (col.name) return col.name;
                return String(col);
            });

            // Parse metadata
            const nextMetadata = {};
            cols.forEach(col => {
                const cName = typeof col === 'string' ? col : (col.column_name || col.name);
                if (cName) {
                    nextMetadata[cName] = {
                        input_type: col.input_type || 'text',
                        input_options: col.input_options || []
                    };
                }
            });
            setCustomColumnMetadata(nextMetadata);

            setAvailableColumns(columnNames);

            // Filter out standard columns to get custom ones
            const standardCols = ['id', 'reference', 'title', 'description', 'category', 'priority',
                'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
                'assigned_to', 'scheduled_date', 'notes', 'created_at', 'updated_at'];
            const custom = columnNames.filter(col => !standardCols.includes(col));

            // Only update if different to avoid infinite loops
            setCustomColumns(prev => {
                const prevStr = JSON.stringify(prev);
                const newStr = JSON.stringify(custom);
                if (prevStr !== newStr) {
                    // Auto-show new custom columns only if never seen before
                    setVisibleColumns(currentVis => {
                        const updated = { ...currentVis };
                        custom.forEach(col => {
                            // Only auto-show if not explicitly set in localStorage
                            if (currentVis[col] === undefined) {
                                updated[col] = true;
                            }
                        });
                        return updated;
                    });
                    return custom;
                }
                return prev;
            });
        } catch (err) {
            console.error('Error fetching available columns:', err);
        }
    };

    // Fetch once on mount only
    useEffect(() => {
        fetchAvailableColumns();
        return () => { };
    }, []);

    // Save column visibility to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('complaints_visible_columns', JSON.stringify(visibleColumns));
        } catch (e) {
            console.error('Error saving column visibility:', e);
        }
    }, [visibleColumns]);

    // Fetch complaints
    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/complaints?limit=2000');
            const data = res.data?.data || res.data || [];

            // Normalize data for table
            const mapped = (Array.isArray(data) ? data : []).map(item => ({
                ...item,
                reference: item.reference || `COM-${item.id}`, // Ensure reference exists
                status: item.status || "open"
            }));

            setComplaints(mapped);
        } catch (err) {
            console.error('Error fetching complaints:', err);
            setComplaints([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch properties for dropdown
    const fetchProperties = async () => {
        try {
            const res = await api.get('/api/hotels?limit=1000');
            const hotelsList = res.data?.hotels || res.data?.data || [];
            setProperties(Array.isArray(hotelsList) ? hotelsList : []);
        } catch (err) {
            console.error('Error fetching properties:', err);
        }
    };

    const fetchStaffForHotel = async (hotelId) => {
        if (!hotelId) {
            setStaffUsers([]);
            return;
        }
        try {
            setStaffLoading(true);

            const tryPath = async (path) => {
                const r = await api.get(path);
                return r?.data;
            };

            const paths = [
                `/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
                `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
            ];

            let data = null;
            let lastErr = null;
            for (const p of paths) {
                try {
                    data = await tryPath(p);
                    if (data) break;
                } catch (e) {
                    lastErr = e;
                }
            }

            if (!data) throw lastErr || new Error('Unable to load staff');

            const list = data?.staff ?? data?.users ?? data ?? [];
            const normalized = (Array.isArray(list) ? list : [])
                .map((u) => ({
                    id: u.id,
                    name: u.name || u.email || `User ${u.id}`,
                    email: u.email || null,
                }))
                .filter((u) => u.id && u.name);
            setStaffUsers(normalized);
        } catch (err) {
            console.error('fetchStaffForHotel error:', err);
            setStaffUsers([]);
        } finally {
            setStaffLoading(false);
        }
    };

    const fetchServiceUsers = async (hotelId) => {
        if (!hotelId) {
            setServiceUsers([]);
            return;
        }
        try {
            setServiceUsersLoading(true);
            const tryPath = async (path) => {
                const r = await api.get(path);
                return r?.data;
            };
            const paths = [
                `/api/hotels/${hotelId}/service-users`,
                `/hotels/${hotelId}/service-users`,
                `/api/service-users/hotel/${hotelId}`,
            ];
            let data = null;
            for (const p of paths) {
                try {
                    data = await tryPath(p);
                    if (data) break;
                } catch (e) { }
            }

            const list = data?.data ?? data?.rows ?? data ?? [];
            const normalized = (Array.isArray(list) ? list : [])
                .map((u) => ({
                    id: u.id,
                    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || `User ${u.id}`,
                }))
                .filter((u) => u.id && u.name);
            setServiceUsers(normalized);
        } catch (err) {
            console.error('fetchServiceUsers error:', err);
            setServiceUsers([]);
        } finally {
            setServiceUsersLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
        fetchProperties();
    }, []);

    // Close view menu on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (viewRef.current && !viewRef.current.contains(e.target)) {
                setShowViewMenu(false);
                setShowPropertyVisibility(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Hide sidebar/navbar when modal open
    useEffect(() => {
        const isModalOpen = showForm || showViewModal || confirmDialog.isOpen;
        if (isModalOpen) {
            document.body.classList.add('form-modal-open');
        } else {
            document.body.classList.remove('form-modal-open');
        }
        return () => {
            document.body.classList.remove('form-modal-open');
        };
    }, [showForm, showViewModal, confirmDialog.isOpen]);

    useEffect(() => {
        if (!showForm) return;
        if (!formData?.property_id) {
            setStaffUsers([]);
            setServiceUsers([]);
            return;
        }
        fetchStaffForHotel(formData.property_id);
        fetchServiceUsers(formData.property_id);
    }, [showForm, formData?.property_id]);

    /* --- Handlers --- */
    const handleAddClick = () => {
        setEditingId(null);
        setFormData({
            title: '',
            description: '',
            category: '',
            priority: 'medium',
            property_id: '',
            reported_by: currentUser?.name || '',
            reported_date: '',
            assigned_to: '',
            scheduled_date: '',
        });
        setStaffUsers([]);
        setShowForm(true);
    };

    const handleEditClick = (complaint) => {
        setEditingId(complaint.id);
        const baseFormData = {
            title: complaint.title || '',
            description: complaint.description || '',
            category: complaint.category || '',
            priority: (complaint.priority || 'medium').toLowerCase(),
            property_id: complaint.property_id ?? complaint.propertyId ?? complaint.property ?? '',
            reported_by: complaint.reported_by ?? complaint.reportedBy ?? '',
            reported_date: (complaint.reported_date ?? complaint.reportedDate) ? formatDateISO(complaint.reported_date ?? complaint.reportedDate) : '',
            assigned_to: complaint.assigned_to ?? complaint.assignedTo ?? complaint.assigned_to_name ?? '',
            scheduled_date: (complaint.scheduled_date ?? complaint.scheduledDate) ? formatDateISO(complaint.scheduled_date ?? complaint.scheduledDate) : '',
        };
        // Add custom column values
        const customFieldData = {};
        customColumns.forEach(col => {
            customFieldData[col] = complaint[col] ?? '';
        });
        setFormData({ ...baseFormData, ...customFieldData });
        if (complaint.property_id) {
            fetchStaffForHotel(complaint.property_id);
        } else {
            setStaffUsers([]);
        }
        setShowForm(true);
    };

    const handleViewClick = (complaint) => {
        // Find property name for display
        const propName = properties.find(p => String(p.id) === String(complaint.property_id))?.name;
        setViewingComplaint({ ...complaint, property_name: propName });
        setShowViewModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const effectiveTitle = String(formData.title || '').trim() || String(formData.category || '').trim() || 'Complaint';
            const effectiveFormData = { ...formData, title: effectiveTitle };
            const missing = [];
            if (!String(effectiveFormData.description || '').trim()) missing.push('Description');
            if (!effectiveFormData.property_id) missing.push('Property');
            if (!effectiveFormData.category) missing.push('Category');
            if (!effectiveFormData.priority) missing.push('Priority');
            if (!effectiveFormData.reported_by) missing.push('Reported By');
            if (!effectiveFormData.reported_date) missing.push('Reported Date');
            if (!effectiveFormData.assigned_to) missing.push('Assigned To');
            if (!effectiveFormData.scheduled_date) missing.push('Scheduled Date');

            for (const col of customColumns || []) {
                const meta = customColumnMetadata[col] || {};
                const inputType = meta.input_type || 'text';
                const v = effectiveFormData[col];
                if (inputType === 'checkbox') {
                    if (v !== 'true' && v !== 'false') missing.push(col.replace(/_/g, ' '));
                } else if (v === undefined || v === null || String(v).trim() === '') {
                    missing.push(col.replace(/_/g, ' '));
                }
            }

            if (missing.length) {
                showAlert('Required fields', `Please fill required fields: ${missing.join(', ')}.`, 'warning');
                return;
            }

            // Create payload with base fields and custom columns
            const payload = { ...effectiveFormData };
            // Include custom column values
            customColumns.forEach(col => {
                if (effectiveFormData[col] !== undefined) {
                    payload[col] = effectiveFormData[col];
                }
            });

            if (editingId) {
                await api.put(`/api/complaints/${editingId}`, payload);
            } else {
                await api.post('/api/complaints', payload);
            }
            setShowForm(false);
            fetchComplaints();
        } catch (err) {
            console.error('Error submitting form:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to submit complaint. Please try again.';
            showAlert('Error', msg, 'error');
        }
    };

    const handleDelete = async (id) => {
        showConfirm(
            'Delete Complaint',
            'Are you sure you want to delete this complaint? This action cannot be undone.',
            () => handleDeleteConfirmed(id)
        );
    };

    const handleDeleteConfirmed = async (id) => {
        try {
            const record = (complaints || []).find((c) => String(c.id) === String(id)) ?? null;
            setDeletingIds(prev => new Set(prev).add(id));

            const ANIM_DURATION = 460;
            setTimeout(() => {
                setComplaints(prev => (Array.isArray(prev) ? prev.filter(c => String(c.id) !== String(id)) : prev));
                setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }, ANIM_DURATION);

            await api.delete(`/api/complaints/${id}`);
            fetchComplaints();
        } catch (err) {
            console.error('Error deleting complaint:', err);
            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            showAlert('Error', 'Failed to delete complaint. Please try again.', 'error');
        }
    };

    // Logic
    const filtered = useMemo(() => {
        const q = (query || "").trim().toLowerCase();
        let list = complaints || [];

        // Apply search filter
        if (q) {
            list = list.filter((r) =>
                (r.title || "").toLowerCase().includes(q) ||
                (r.reference || "").toLowerCase().includes(q) ||
                (r.description || "").toLowerCase().includes(q)
            );
        }

        // Apply priority filter
        if (priorityFilter) {
            list = list.filter((r) =>
                (r.priority || "").toLowerCase() === priorityFilter.toLowerCase()
            );
        }

        // Apply status filter
        if (statusFilter) {
            list = list.filter((r) =>
                (r.status || "").toLowerCase() === statusFilter.toLowerCase()
            );
        }

        // Apply property filter
        if (propertyFilter) {
            list = list.filter((r) =>
                String(r.property_id || "") === String(propertyFilter)
            );
        }

        // Apply sorting
        if (sortBy) {
            list = [...list].sort((a, b) => {
                if (sortBy === 'date') {
                    const dateA = new Date(a.reported_date || 0);
                    const dateB = new Date(b.reported_date || 0);
                    return dateB - dateA;
                }
                if (sortBy === 'priority') {
                    const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                    const priorityA = (a.priority || 'medium').toLowerCase();
                    const priorityB = (b.priority || 'medium').toLowerCase();
                    return (priorityOrder[priorityA] || 2) - (priorityOrder[priorityB] || 2);
                }
                if (sortBy === 'status') {
                    const statusA = (a.status || '').toLowerCase();
                    const statusB = (b.status || '').toLowerCase();
                    return statusA.localeCompare(statusB);
                }
                if (sortBy === 'category') {
                    const catA = (a.category || '').toLowerCase();
                    const catB = (b.category || '').toLowerCase();
                    return catA.localeCompare(catB);
                }
                return 0;
            });
        }

        return list;
    }, [complaints, query, priorityFilter, statusFilter, propertyFilter, sortBy]);

    const normalizeComplaintExportRow = (complaint) => {
        const base = {
            reference: complaint.reference || complaint.ref || '-',
            title: complaint.title || '-',
            complaintType: complaint.complaintType || complaint.complaint_type || complaint.category || '-',
            propertyName: complaint.propertyName || complaint.property_name || complaint.property || '-',
            status: complaint.status || '-',
            dateFiled: complaint.dateFiled || complaint.reported_date || complaint.reportedDate || '-',
            complainant: complaint.complainant || complaint.reported_by || complaint.reportedBy || '-',
        };

        for (const col of customColumns || []) {
            base[col] = complaint?.[col] ?? '';
        }

        return base;
    };

    const openExport = (format) => {
        setExportFormat(format);
        setShowExportModal(true);
        setSelectedExportKeys((prev) => (prev && prev.length ? prev : exportColumns.map((c) => c.key)));
    };

    const closeExport = () => {
        setShowExportModal(false);
        setExportFormat(null);
    };

    const runExport = () => {
        try {
            const keySet = new Set(selectedExportKeys || []);
            const columns = (exportColumns || []).filter((c) => keySet.has(c.key));
            if (!columns.length) {
                alert('Please select at least one column to download.');
                return;
            }

            const data = (filtered || []).map(normalizeComplaintExportRow);

            if (exportFormat === 'pdf') {
                generatePDF(data, columns, 'Complaints Report', 'complaints-report');
            } else if (exportFormat === 'csv') {
                generateCSV(data, columns, 'complaints-report');
            }

            closeExport();
        } catch (error) {
            console.error('Error exporting complaints:', error);
            alert('Failed to download: ' + error.message);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const total = complaints.length;
        const high = complaints.filter((c) => (c.priority || '').toLowerCase() === 'high' || (c.priority || '').toLowerCase() === 'urgent').length;
        const open = complaints.filter((c) => (c.status || '').toLowerCase() === 'open' || (c.status || '').toLowerCase() === 'pending').length;
        const resolved = complaints.filter((c) => (c.status || '').toLowerCase() === 'completed' || (c.status || '').toLowerCase() === 'resolved').length;
        return { total, high, open, resolved };
    }, [complaints]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">

                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Breadcrumbs items={[{ label: 'Property', path: '/admin/hotels' }, { label: 'Complaints', path: '/admin/complaints' }]} />
                        <h1 className="text-3xl font-black text-slate-900 mt-1">Complaints Dashboard</h1>
                    </div>
                    {hasCreate && (
                        <div className="flex items-center gap-3 mt-1">
                            <DownloadDropdown
                                onDownloadPDF={() => openExport('pdf')}
                                onDownloadCSV={() => openExport('csv')}
                            />
                        </div>
                    )}
                </div>

                {showExportModal && (
                    <div className="modal-overlay">
                        <div className="modal-container h-auto max-h-[85vh]">
                            <div className="modal-header">
                                <div>
                                    <div className="modal-title">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>
                                    <div className="modal-subtitle">Select the columns you want to include</div>
                                </div>
                                <button
                                    onClick={closeExport}
                                    className="rounded-xl modal-close-btn"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm font-medium text-gray-700">Columns</div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <button
                                            onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))}
                                            className="text-teal-600 font-medium rounded-xl"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            onClick={() => setSelectedExportKeys([])}
                                            className="text-gray-600 font-medium rounded-xl"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto pr-1">
                                    {exportColumns.map((col) => {
                                        const checked = (selectedExportKeys || []).includes(col.key);
                                        return (
                                            <label
                                                key={col.key}
                                                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setSelectedExportKeys((prev) => {
                                                            const set = new Set(prev || []);
                                                            if (isChecked) set.add(col.key);
                                                            else set.delete(col.key);
                                                            return Array.from(set);
                                                        });
                                                    }}
                                                    className="h-4 w-4 accent-teal-600 rounded-xl"
                                                />
                                                <span className="text-sm text-gray-800">{col.header}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    onClick={closeExport}
                                    className="rounded-xl btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={runExport}
                                    className="rounded-xl btn-primary"
                                >
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-blue-50 text-blue-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <ClipboardList size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Complaints</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.total}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-rose-50 text-rose-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <AlertCircle size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">High Priority</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.high}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-orange-50 text-orange-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <Clock size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Open Complaints</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.open}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-emerald-50 text-emerald-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <CheckCircle size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Resolved</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.resolved}</div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area - Table */}
                <div className="bg-white rounded-xl border border-gray-100 mt-6 shadow-sm overflow-hidden transition-all duration-200">

                    {/* Table Header Section */}
                    <div className="p-6 pb-2">
                        <div className="mb-4">
                            {/* Header Title and Actions Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div>
                                    <Breadcrumbs items={[{ label: 'Property', path: '/admin/hotels' }, { label: 'Complaints', path: '/admin/complaints' }]} />
                                    <h2 className="text-3xl font-black text-slate-900 mt-1">Complaints Dashboard</h2>
                                    <p className="text-sm text-gray-500">{stats.total} total records</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 justify-start sm:justify-end">
                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={e => setQuery(e.target.value)}
                                            placeholder="Search complaints..."
                                            className="h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-full sm:w-64"
                                        />
                                    </div>

                                    {/* View Dropdown */}
                                    <div className="relative" ref={viewRef}>
                                        <button
                                            onClick={() => setShowViewMenu(!showViewMenu)}
                                            className="h-9 bg-white border border-gray-300 text-gray-700 rounded-xl px-3 text-xs font-medium flex items-center gap-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                            <span className="font-semibold">{viewMode === 'table' ? 'Table' : 'Board'}</span>
                                            <ChevronDown className="w-4 h-4" />
                                        </button>

                                        {/* View Settings Dropdown Panel */}
                                        {showViewMenu && (
                                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                                                <div className="p-4">
                                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">View settings</h3>

                                                    {/* View Mode Selector */}
                                                    <div className="mb-3 pb-3 border-b border-gray-200">
                                                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Display Mode</div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setViewMode('table')}
                                                                className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'table'
                                                                    ? 'bg-teal-500 text-white shadow-sm'
                                                                    : 'bg-gray-100 text-gray-700'
                                                                    }`}
                                                            >
                                                                <Columns className="w-4 h-4" />
                                                                <span>Table</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setViewMode('board')}
                                                                className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'board'
                                                                    ? 'bg-teal-500 text-white shadow-sm'
                                                                    : 'bg-gray-100 text-gray-700'
                                                                    }`}
                                                            >
                                                                <ClipboardList className="w-4 h-4" />
                                                                <span>Board</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {viewMode === 'table' && (
                                                        <>
                                                            <button
                                                                onClick={() => setShowPropertyVisibility(!showPropertyVisibility)}
                                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 rounded-xl transition-colors"
                                                            >
                                                                <span>Column visibility</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-500">
                                                                        {Object.values(visibleColumns).filter(Boolean).length} shown
                                                                    </span>
                                                                    <ChevronDown className={`w-4 h-4 transition-transform ${showPropertyVisibility ? 'rotate-180' : ''}`} />
                                                                </div>
                                                            </button>

                                                            {/* Column Visibility Panel */}
                                                            {showPropertyVisibility && (
                                                                <div className="mt-2 border-t border-gray-200 pt-3 max-h-96 overflow-y-auto">
                                                                    {/* Default Columns Section */}
                                                                    <div className="mb-4">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Default Columns</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const updates = {};
                                                                                        DEFAULT_COLUMNS.forEach(c => updates[c] = true);
                                                                                        setVisibleColumns(prev => ({ ...prev, ...updates }));
                                                                                    }}
                                                                                    className="text-xs text-teal-600 font-medium rounded-xl"
                                                                                >
                                                                                    Show all
                                                                                </button>
                                                                                <span className="text-gray-300">|</span>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const updates = {};
                                                                                        DEFAULT_COLUMNS.forEach(c => updates[c] = false);
                                                                                        setVisibleColumns(prev => ({ ...prev, ...updates }));
                                                                                    }}
                                                                                    className="text-xs text-teal-600 font-medium rounded-xl"
                                                                                >
                                                                                    Hide all
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs text-gray-500 mb-2">Toggle column visibility by clicking</div>
                                                                        <div className="space-y-1">
                                                                            {DEFAULT_COLUMNS.map(col => (
                                                                                <button
                                                                                    key={col}
                                                                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })}
                                                                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors border ${visibleColumns[col]
                                                                                        ? 'text-gray-700 border-gray-200 bg-white'
                                                                                        : 'text-gray-500 border-gray-100 bg-gray-50'
                                                                                        }`}
                                                                                >
                                                                                    <span className="capitalize font-medium">{col}</span>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {visibleColumns[col] ? (
                                                                                            <Eye className="w-4 h-4 text-teal-600" />
                                                                                        ) : (
                                                                                            <EyeOff className="w-4 h-4 text-gray-400" />
                                                                                        )}
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Custom Columns Section - All custom columns */}
                                                                    {customColumns.length > 0 && (
                                                                        <div className="pt-4 border-t border-gray-200">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Custom Columns</span>
                                                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                                                        {customColumns.length}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const updates = {};
                                                                                            customColumns.forEach(c => updates[c] = true);
                                                                                            setVisibleColumns(prev => ({ ...prev, ...updates }));
                                                                                        }}
                                                                                        className="text-xs text-teal-600 font-medium rounded-xl"
                                                                                    >
                                                                                        Show all
                                                                                    </button>
                                                                                    <span className="text-gray-300">|</span>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const updates = {};
                                                                                            customColumns.forEach(c => updates[c] = false);
                                                                                            setVisibleColumns(prev => ({ ...prev, ...updates }));
                                                                                        }}
                                                                                        className="text-xs text-teal-600 font-medium rounded-xl"
                                                                                    >
                                                                                        Hide all
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 mb-2">
                                                                                Custom columns from Forms Builder
                                                                                <span className="text-blue-600 ml-1">(Auto-refreshes every 5s)</span>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                {customColumns.map(col => (
                                                                                    <button
                                                                                        key={col}
                                                                                        onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })}
                                                                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors border ${visibleColumns[col]
                                                                                            ? 'text-gray-700 border-gray-200 bg-white'
                                                                                            : 'text-gray-500 border-gray-100 bg-gray-50'
                                                                                            }`}
                                                                                    >
                                                                                        <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {visibleColumns[col] ? (
                                                                                                <Eye className="w-4 h-4 text-teal-600" />
                                                                                            ) : (
                                                                                                <EyeOff className="w-4 h-4 text-gray-400" />
                                                                                            )}
                                                                                        </div>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Create Button */}
                                    {hasCreate && (
                                        <button
                                            onClick={handleAddClick}
                                            className="h-9 bg-teal-500 text-white font-semibold rounded-xl px-4 text-xs flex items-center gap-2 shadow-sm transition-colors"
                                        >
                                            <ClipboardList className="w-4 h-4" />
                                            <span>Report Complaint</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Filter and Sorting Row */}
                            <div className="flex items-center flex-wrap gap-3 py-3 border-t border-gray-50">
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                    <select
                                        value={priorityFilter}
                                        onChange={(e) => setPriorityFilter(e.target.value)}
                                        className="h-9 bg-white border border-gray-300 rounded-xl pl-9 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none cursor-pointer w-40"
                                    >
                                        <option value="">All Priority</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                </div>

                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="h-9 bg-white border border-gray-300 rounded-xl pl-9 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none cursor-pointer w-40"
                                    >
                                        <option value="">All Status</option>
                                        <option value="open">Open</option>
                                        <option value="pending">Pending</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                </div>

                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                    <select
                                        value={propertyFilter}
                                        onChange={(e) => setPropertyFilter(e.target.value)}
                                        className="h-9 bg-white border border-gray-300 rounded-xl pl-9 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none cursor-pointer w-48"
                                    >
                                        <option value="">All Properties</option>
                                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                </div>

                                <div className="relative">
                                    <ChevronDown className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-8 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer appearance-none min-w-[130px]"
                                    >
                                        <option value="">Sort By</option>
                                        <option value="title">Title</option>
                                        <option value="reference">Reference</option>
                                        <option value="priority">Priority</option>
                                        <option value="status">Status</option>
                                        <option value="scheduled_date">Date</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Clear Filters Button */}
                                {(priorityFilter || statusFilter || propertyFilter || sortBy) && (
                                    <button
                                        onClick={() => {
                                            setPriorityFilter('');
                                            setStatusFilter('');
                                            setPropertyFilter('');
                                            setSortBy('');
                                        }}
                                        className="h-9 bg-gray-100 text-gray-700 rounded-xl px-4 text-xs font-medium transition-all flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        <span>Clear Filters</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Data Display - Table or Board View */}
                        {viewMode === 'table' ? (
                            <div className="overflow-x-auto border-t border-gray-100 relative">
                                <table className="w-full">
                                    <thead className="bg-slate-50/50">
                                        <tr className="border-b border-gray-200">
                                            {visibleColumns.checkbox && (
                                                <th className="text-left py-4 px-4">
                                                    <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                </th>
                                            )}
                                            {visibleColumns.type && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">TYPE</th>
                                            )}
                                            {visibleColumns.reference && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">REFERENCE</th>
                                            )}
                                            {visibleColumns.description && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</th>
                                            )}
                                            {visibleColumns.priority && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PRIORITY</th>
                                            )}
                                            {visibleColumns.status && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>
                                            )}
                                            {visibleColumns.assigned && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ASSIGNED TO</th>
                                            )}
                                            {visibleColumns.date && (
                                                <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DATE</th>
                                            )}
                                            {/* Custom Columns */}
                                            {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    {col.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                            {visibleColumns.actions && (
                                                <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>ACTIONS</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                                            </tr>
                                        ) : filtered.length > 0 ? filtered.map((row) => {
                                            const priorityStyle = getPriorityColor(row.priority || 'medium');
                                            const statusStyle = getStatusColor(row.status || 'open');
                                            const isDeleting = deletingIds.has(row.id);

                                            return (
                                                <tr key={row.id} className={`transition-colors border-b border-gray-100 last:border-0 ${isDeleting ? 'complaint-deleting' : ''}`}>
                                                    {visibleColumns.checkbox && (
                                                        <td className="py-4 px-4">
                                                            <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                        </td>
                                                    )}
                                                    {visibleColumns.type && (
                                                        <td className="py-4 px-4">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
                                                                Complaint
                                                            </span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.reference && (
                                                        <td className="py-4 px-4">
                                                            <span className="text-slate-900 font-semibold text-sm whitespace-nowrap">{row.reference}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.description && (
                                                        <td className="py-4 px-4">
                                                            <div>
                                                                <div
                                                                    className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
                                                                    onClick={hasUpdate ? () => handleEditClick(row) : undefined}
                                                                >
                                                                    <Home className="w-4 h-4 text-gray-400" />
                                                                    <span>{properties.find(p => String(p.id) === String(row.property_id))?.name || row.property_name || '-'}</span>
                                                                </div>
                                                                <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">
                                                                    {row.title || row.description || "No description recorded."}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.priority && (
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${priorityStyle.text}`}>{row.priority || "Medium"}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.status && (
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${statusStyle.text}`}>{row.status || "Pending"}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.assigned && (
                                                        <td className="py-4 px-4">
                                                            {!row.assigned_to || row.assigned_to === 'Unassigned' ? (
                                                                <span className="text-gray-400 text-sm">Unassigned</span>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.assigned_to)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                                                        {getInitials(row.assigned_to)}
                                                                    </div>
                                                                    <span className="text-gray-900 text-sm font-medium">{row.assigned_to}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    {visibleColumns.date && (
                                                        <td className="py-4 px-4 whitespace-nowrap">
                                                            <span className="text-gray-900 font-medium text-sm">{formatDate(row.scheduled_date)}</span>
                                                        </td>
                                                    )}
                                                    {/* Custom Column Cells */}
                                                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                        <td key={col} className="py-4 px-4">
                                                            <span className="text-gray-900 font-medium text-sm">{row[col] || '-'}</span>
                                                        </td>
                                                    ))}
                                                    {visibleColumns.actions && (
                                                        <td className="py-4 px-4 text-center sticky right-0 z-10 bg-white" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleViewClick(row)}
                                                                    className="p-1.5 text-gray-600 rounded-xl transition-all"
                                                                    title="View"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                {hasUpdate && (
                                                                    <button
                                                                        onClick={() => handleEditClick(row)}
                                                                        className="p-1.5 text-gray-600 rounded-xl transition-all"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {hasDelete && (
                                                                    <button
                                                                        onClick={() => handleDelete(row.id)}
                                                                        className="p-1.5 text-gray-600 rounded-xl transition-all"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan="9" className="py-8 text-center text-gray-500">No complaints found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Board/Kanban View */
                            <div className="overflow-x-auto -mx-6 px-6">
                                <div className="flex gap-4 min-w-max pb-4">
                                    {['open', 'in progress', 'resolved'].map((status) => {
                                        const statusItems = filtered.filter((complaint) => {
                                            return (complaint.status || 'open').toLowerCase() === status.toLowerCase();
                                        });

                                        const getStatusStyle = (status) => {
                                            if (status === 'open') {
                                                return {
                                                    bg: 'bg-orange-50',
                                                    border: 'border-orange-200',
                                                    header: 'bg-orange-100',
                                                    text: 'text-orange-700',
                                                    dot: 'bg-orange-500'
                                                };
                                            }
                                            if (status === 'in progress') {
                                                return {
                                                    bg: 'bg-purple-50',
                                                    border: 'border-purple-200',
                                                    header: 'bg-purple-100',
                                                    text: 'text-purple-700',
                                                    dot: 'bg-purple-500'
                                                };
                                            }
                                            if (status === 'resolved') {
                                                return {
                                                    bg: 'bg-emerald-50',
                                                    border: 'border-emerald-200',
                                                    header: 'bg-emerald-100',
                                                    text: 'text-emerald-700',
                                                    dot: 'bg-emerald-500'
                                                };
                                            }
                                            return {
                                                bg: 'bg-gray-50',
                                                border: 'border-gray-200',
                                                header: 'bg-gray-100',
                                                text: 'text-gray-700',
                                                dot: 'bg-gray-500'
                                            };
                                        };

                                        const style = getStatusStyle(status);
                                        const displayStatus = status.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                                        return (
                                            <div key={status} className="flex-shrink-0 w-80">
                                                <div className={`rounded-xl border ${style.border} ${style.bg}`}>
                                                    {/* Column Header */}
                                                    <div className={`${style.header} px-4 py-3 border-b ${style.border}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
                                                                <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>
                                                                    {displayStatus}
                                                                </h3>
                                                            </div>
                                                            <span className="bg-white px-2 py-0.5 rounded-xl text-xs font-semibold text-gray-600">
                                                                {statusItems.length}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Cards Container */}
                                                    <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                                                        {statusItems.length === 0 ? (
                                                            <div className="text-center py-8 px-4">
                                                                <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                                <p className="text-gray-400 text-sm">No complaints</p>
                                                            </div>
                                                        ) : (
                                                            statusItems.map((complaint) => {
                                                                const priorityColor = getPriorityColor(complaint.priority || "Medium");
                                                                const isDeleting = deletingIds.has(complaint.id);

                                                                return (
                                                                    <div
                                                                        key={complaint.id}
                                                                        className={`bg-white rounded-xl p-4 shadow-sm border border-gray-200 transition-all cursor-pointer ${isDeleting ? 'complaint-card-deleting' : ''}`}
                                                                        onClick={() => handleViewClick(complaint)}
                                                                    >
                                                                        {/* Reference and Priority */}
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-xs font-mono text-gray-500">{complaint.reference}</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                                                                <span className={`text-xs font-medium ${priorityColor.text}`}>
                                                                                    {complaint.priority || "Medium"}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Title */}
                                                                        <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                                                            {complaint.title}
                                                                        </h4>

                                                                        {/* Description */}
                                                                        {complaint.description && (
                                                                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                                                                {complaint.description}
                                                                            </p>
                                                                        )}

                                                                        {/* Category Badge */}
                                                                        {complaint.category && (
                                                                            <div className="mb-3">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-xl text-xs font-medium">
                                                                                    {complaint.category}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Footer: Assigned To and Date */}
                                                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                                                            {/* Assigned To */}
                                                                            <div className="flex items-center gap-2">
                                                                                {complaint.assigned_to && complaint.assigned_to !== 'Unassigned' ? (
                                                                                    <>
                                                                                        <div className={`w-6 h-6 rounded-full ${getAvatarColor(complaint.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                                                                            {getInitials(complaint.assigned_to)}
                                                                                        </div>
                                                                                        <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                                                                            {complaint.assigned_to}
                                                                                        </span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-xs text-gray-400">Unassigned</span>
                                                                                )}
                                                                            </div>

                                                                            {/* Date */}
                                                                            <span className="text-xs text-gray-500">
                                                                                {formatDate(complaint.scheduled_date)}
                                                                            </span>
                                                                        </div>

                                                                        {/* Action Buttons */}
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleViewClick(complaint);
                                                                                }}
                                                                                className="flex-1 py-1.5 px-2 bg-gray-50 text-gray-700 rounded-xl transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                                                                title="View"
                                                                            >
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                View
                                                                            </button>
                                                                            {hasUpdate && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleEditClick(complaint);
                                                                                    }}
                                                                                    className="p-1.5 bg-gray-50 text-gray-700 rounded-xl transition-colors"
                                                                                    title="Edit"
                                                                                >
                                                                                    <Edit className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {hasDelete && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDelete(complaint.id);
                                                                                    }}
                                                                                    className="p-1.5 bg-gray-50 text-gray-700 rounded-xl transition-colors"
                                                                                    title="Delete"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- FORM MODAL --- */}
                {
                    showForm && (
                        <div className="modal-overlay">
                            <div className="modal-container h-[70vh]">

                                {/* Modal Header */}
                                <div className="modal-header">
                                    <h3 className="modal-title">
                                        {editingId ? "Edit Complaint" : "Create Complaint"}
                                    </h3>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="modal-close-btn rounded-xl"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Form Content */}
                                <form id="complaint-form" onSubmit={handleSubmit} className="modal-content form-section">
                                    <div className="form-grid-2">

                                        {/* Row 1: Inspection Type (Category) - Full Width */}
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Inspection Type <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={formData.category}
                                                onChange={handleCategoryChange}
                                                className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm"
                                            >
                                                <option value="">Select inspection type</option>
                                                {[...BUILTIN_CATEGORIES, ...customCategories].map((category) => (
                                                    <option key={category} value={category}>{category}</option>
                                                ))}
                                                {!!formData.category &&
                                                    ![...BUILTIN_CATEGORIES, ...customCategories].some((c) => String(c) === String(formData.category)) && (
                                                        <option value={formData.category}>{formData.category}</option>
                                                    )}
                                                <option value="__add_new__">+ Add new...</option>
                                            </select>
                                            {showCustomCategoryInput && (
                                                <div className="mt-3 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={customCategoryValue}
                                                        onChange={(e) => setCustomCategoryValue(e.target.value)}
                                                        placeholder="Enter new category"
                                                        className="flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={saveCustomCategory}
                                                        className="px-5 py-3 bg-teal-500 text-white rounded-xl -xl text-sm font-semibold transition-all shadow-md active:scale-95"
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowCustomCategoryInput(false);
                                                            setCustomCategoryValue('');
                                                        }}
                                                        className="px-5 py-3 border border-gray-200 rounded-xl text-gray-700 text-sm font-semibold transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 2: Property & Service User */}
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={formData.property_id}
                                                onChange={e => {
                                                    const nextPropertyId = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        property_id: nextPropertyId,
                                                        reported_by: currentUser?.name || '',
                                                        assigned_to: '',
                                                    });
                                                    setStaffUsers([]);
                                                    if (nextPropertyId) fetchStaffForHotel(nextPropertyId);
                                                }}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm"
                                            >
                                                <option value="">Select property</option>
                                                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Service User <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={formData.assigned_to}
                                                onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                                                disabled={!formData.property_id || serviceUsersLoading}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="">
                                                    {!formData.property_id
                                                        ? "Select property first"
                                                        : serviceUsersLoading
                                                            ? "Loading..."
                                                            : "Select service user"}
                                                </option>
                                                {!!formData.assigned_to && !serviceUsers.some((u) => String(u.name) === String(formData.assigned_to)) && (
                                                    <option value={formData.assigned_to}>{formData.assigned_to}</option>
                                                )}
                                                {serviceUsers.map((u) => (
                                                    <option key={u.id} value={u.name}>
                                                        {u.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Row 3: Inspector Name & Inspection Date */}
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Inspector Name <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.reported_by}
                                                readOnly
                                                className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm bg-gray-50 cursor-not-allowed focus:outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Inspection Date <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.reported_date}
                                                onChange={e => setFormData({ ...formData, reported_date: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                                            />
                                        </div>

                                        {/* Row 4: Findings (Description) - Full Width */}
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Findings <span className="text-red-500">*</span></label>
                                            <textarea
                                                required
                                                rows={4}
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Describe inspection findings..."
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all shadow-sm"
                                            />
                                        </div>

                                        {/* Row 5: Priority & Status/Scheduled Date */}
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Priority <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={formData.priority}
                                                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm"
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="urgent">Urgent</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Status <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={formData.status || 'Pending'}
                                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Date <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.scheduled_date}
                                                onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                                            />
                                        </div>

                                        {/* Custom Columns Mapping to design (Issues Found, etc.) */}
                                        {customColumns.map(col => {
                                            const meta = customColumnMetadata[col] || {};
                                            const inputType = meta.input_type || 'text';
                                            const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                                            return (
                                                <div key={col} className="col-span-1">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                        {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} <span className="text-red-500">*</span>
                                                    </label>

                                                    {inputType === 'checkbox' ? (
                                                        <select
                                                            required
                                                            className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm"
                                                            value={formData[col] === true ? 'true' : formData[col] === false ? 'false' : (formData[col] || '')}
                                                            onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="true">Yes</option>
                                                            <option value="false">No</option>
                                                        </select>
                                                    ) : inputType === 'dropdown' || inputType === 'select' ? (
                                                        <select
                                                            required
                                                            className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all shadow-sm"
                                                            value={formData[col] || ''}
                                                            onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                        >
                                                            <option value="">Select...</option>
                                                            {options.map((opt, idx) => (
                                                                <option key={idx} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : inputType === 'textarea' ? (
                                                        <textarea
                                                            required
                                                            className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm resize-none"
                                                            rows={3}
                                                            value={formData[col] || ''}
                                                            onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                            placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                                                        />
                                                    ) : inputType === 'date' ? (
                                                        <input
                                                            type="date"
                                                            required
                                                            className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                                                            value={formData[col] ? formatDateISO(formData[col]) : ''}
                                                            onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                        />
                                                    ) : (
                                                        <input
                                                            type={inputType}
                                                            required
                                                            className="w-full border border-gray-200 rounded-xl -xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                                                            value={formData[col] || ''}
                                                            onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                            placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                                                        />
                                                    )
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                </form>

                                <div className="modal-footer px-8 py-6 bg-gray-50 rounded-b-2xl border-t border-gray-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-semibold transition-all shadow-sm active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        form="complaint-form"
                                        className="px-10 py-2.5 bg-teal-500 text-white rounded-xl -xl text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                                    >
                                        {editingId ? "Update Record" : "Create Record"}
                                    </button>
                                </div>
                            </div>
                        </div >
                    )
                }

                {/* --- VIEW MODAL --- */}
                {
                    showViewModal && viewingComplaint && (
                        <div className="modal-overlay">
                            <div className="modal-container h-[70vh]">
                                <div className="modal-header">
                                    <div>
                                        <h2 className="modal-title">Complaint Details</h2>
                                        <p className="modal-subtitle">View complaint information</p>
                                    </div>
                                    <button
                                        onClick={() => setShowViewModal(false)}
                                        className="modal-close-btn rounded-xl"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="modal-content">
                                    <div className="form-grid-2">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reference</label>
                                            <p className="text-gray-900 font-medium">{viewingComplaint.reference || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reported Date</label>
                                            <p className="text-gray-900">{formatDate(viewingComplaint.reported_date) || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label>
                                            <p className="text-gray-900 font-medium">{viewingComplaint.title || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Property</label>
                                            <p className="text-gray-900">{viewingComplaint.property_name || (viewingComplaint.property_id ? `ID: ${viewingComplaint.property_id}` : 'N/A')}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                                            <p className="text-gray-900">{viewingComplaint.category || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Scheduled Date</label>
                                            <p className="text-gray-900">{formatDate(viewingComplaint.scheduled_date) || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Priority</label>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                {viewingComplaint.priority || 'N/A'}
                                            </span>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                {viewingComplaint.status || 'N/A'}
                                            </span>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reported By</label>
                                            <p className="text-gray-900">{viewingComplaint.reported_by || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Assigned To</label>
                                            <p className="text-gray-900">{viewingComplaint.assigned_to || 'Unassigned'}</p>
                                        </div>

                                        {(customColumns || []).map((col) => {
                                            const meta = customColumnMetadata?.[col] || {};
                                            const label = String(meta.label || col)
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (m) => m.toUpperCase());
                                            const rawVal = viewingComplaint?.[col] ?? viewingComplaint?.raw?.[col];
                                            const inputType = String(meta.input_type || meta.inputType || '').toLowerCase();
                                            const isBoolType = inputType === 'checkbox' || inputType === 'boolean';
                                            const isDateType = inputType === 'date';

                                            let valueText = rawVal;
                                            if (valueText === null || valueText === undefined || valueText === '') valueText = 'N/A';

                                            if (isDateType && rawVal) {
                                                const d = new Date(rawVal);
                                                if (!Number.isNaN(d.getTime())) valueText = d.toISOString().slice(0, 10);
                                            }

                                            if (isBoolType) {
                                                const boolVal = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1' || rawVal === 'yes';
                                                return (
                                                    <div key={col}>
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                            {boolVal ? 'Yes' : 'No'}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={col}>
                                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
                                                    <p className="text-gray-900 font-medium">{String(valueText)}</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description</label>
                                        <p className="text-gray-700">{viewingComplaint.description || 'No description provided.'}</p>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        onClick={() => setShowViewModal(false)}
                                        className="btn-secondary rounded-xl"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowViewModal(false);
                                            handleEditClick(viewingComplaint);
                                        }}
                                        className="btn-primary rounded-xl"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Modal Dialogs */}
                <ConfirmDialog
                    isOpen={confirmDialog.isOpen}
                    onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
                    onConfirm={confirmDialog.onConfirm}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    type={confirmDialog.type}
                />
                <AlertDialog
                    isOpen={alertDialog.isOpen}
                    onClose={() => setAlertDialog(p => ({ ...p, isOpen: false }))}
                    title={alertDialog.title}
                    message={alertDialog.message}
                    type={alertDialog.type}
                />
            </div>
        </div >
    );
}
