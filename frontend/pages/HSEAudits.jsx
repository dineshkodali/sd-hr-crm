/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import {
    Home,
    ClipboardCheck,
    Search,
    ChevronDown,
    Filter,
    Columns,
    Download,
    X,
    Edit,
    Trash2,
    Eye,
    EyeOff,
    Check
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'hse-audits-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes hseAuditSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      @keyframes hseAuditCardDelete {
        0%   { opacity: 1; transform: scale(1) rotate(0deg); }
        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
      }
      tr.hse-audit-deleting {
        animation: hseAuditSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
      .hse-audit-card-deleting {
        animation: hseAuditCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

/* --- Helpers --- */
function normalizeHotelsResponse(data) {
    if (!data) return [];
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data.rows)) items = data.rows;
    else if (Array.isArray(data.hotels)) items = data.hotels;
    else if (typeof data === 'object') {
        const vals = Object.values(data);
        const possibleObjects = vals.filter((v) => v && (v.id || v.name || v.hotel_name));
        if (possibleObjects.length && !Array.isArray(data)) {
            items = Array.isArray(possibleObjects[0]) ? possibleObjects[0] : possibleObjects;
        }
    }
    return items.map((h) => {
        const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;
        const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ''}`;
        return { id, name };
    }).filter((x) => x.id && x.name);
}

/* Helper functions */
function formatDate(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return value; }
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
    if (low === "urgent" || low === "high" || low === "critical") return { dot: "bg-red-500", text: "text-red-700" };
    if (low === "medium") return { dot: "bg-orange-500", text: "text-orange-700" };
    return { dot: "bg-green-500", text: "text-green-700" };
}

function getStatusColor(s) {
    const low = String(s).toLowerCase();
    if (low === "completed" || low === "closed" || low === "passed") return { dot: "bg-green-500", text: "text-green-700" };
    if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
    if (low === "failed" || low === "overdue") return { dot: "bg-red-500", text: "text-red-700" };
    return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
    return "bg-teal-100 text-teal-700";
}

function getInitials(name) {
    if (!name || name === "Unassigned") return "UA";
    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

/* Helper for View Details */
const DetailField = ({ label, value }) => (
    <div>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
        <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
    </div>
);

const categoryOptions = ['Internal Audit', 'External Audit', 'Compliance Check', 'Safety Inspection', 'Environmental', 'Other'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

export default function HSEAudits({ user }) {
    // Get current user from props or localStorage
    const currentUser = user || (() => {
        try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    // Get permissions for hse_audits module
    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
    const hasRead = canRead("hse_audits");
    const hasCreate = canCreate("hse_audits");
    const hasUpdate = canUpdate("hse_audits");
    const hasDelete = canDelete("hse_audits");

    // Image gallery hook — opens in-page modal instead of new tab
    const { galleryOpen: _galleryOpen, galleryItems: _galleryItems, galleryTitle: _galleryTitle, galleryApi: _galleryApi, openGallery: _openGallery, closeGallery: _closeGallery } = useImageGallery();

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);

    /* Dialog State */
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger'
    });
    const [alertDialog, setAlertDialog] = useState({
        isOpen: false, title: '', message: '', type: 'error'
    });
    const [hotels, setHotels] = useState([]);
    const [records, setRecords] = useState([]);
    // Track rows/cards currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [mode, setMode] = useState('create');

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    const [staffUsers, setStaffUsers] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);

    const [query, setQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

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
        property_id: '',
        property_name: '',
        category: '',
        priority: 'Medium',
        reported_by: '',
        assigned_to: '',
        scheduled_date: '',
        status: 'Open'
    });

    const CATEGORY_STORAGE_KEY = 'hseAudits.customCategories';
    const [customCategories, setCustomCategories] = useState([]);
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

    // Custom columns from Forms Builder
    const [customColumns, setCustomColumns] = useState([]);
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});
    const [availableColumns, setAvailableColumns] = useState([
        "checkbox",
        "type",
        "reference",
        "description",
        "attachments",
        "priority",
        "status",
        "assigned",
        "date",
        "actions",
    ]);

    // Define all available columns
    const DEFAULT_COLUMNS = [
        "checkbox",
        "type",
        "reference",
        "description",
        "attachments",
        "priority",
        "status",
        "assigned",
        "date",
        "actions",
    ];

    const ALL_COLUMNS = availableColumns;

    // Column visibility state - load from localStorage or default to all visible
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('hseAuditsVisibleColumns');
            if (saved) {
                const parsed = JSON.parse(saved);
                const defaultCols = availableColumns.reduce((a, c) => ({ ...a, [c]: true }), {});
                return { ...defaultCols, ...parsed };
            }
        } catch (e) {
            console.error('Error loading column visibility:', e);
        }
        return availableColumns.reduce((a, c) => ({ ...a, [c]: true }), {});
    });

    const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

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

    useEffect(() => {
        if (!showCustomCategoryInput) {
            setCustomCategoryValue('');
        }
    }, [showCustomCategoryInput]);

    const persistCustomCategories = (list) => {
        try {
            localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(list));
        } catch {
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

        const builtins = categoryOptions;
        const builtinLower = new Set((builtins || []).map((t) => String(t).toLowerCase()));
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

    const normalizeStaffResponse = (data) => {
        const list = data?.staff ?? data?.users ?? data?.rows ?? data?.data ?? data ?? [];
        const arr = Array.isArray(list) ? list : [];
        return arr
            .map((u) => ({
                id: u?.id ?? u?.user_id ?? null,
                name: u?.name ?? u?.email ?? [u?.first_name, u?.last_name].filter(Boolean).join(' ') ?? ''
            }))
            .filter((u) => u?.id && u?.name);
    };

    const fetchStaffForHotel = async (hotelId) => {
        if (!hotelId) {
            setStaffUsers([]);
            return;
        }
        try {
            setStaffLoading(true);

            const paths = [
                `/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
                `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
            ];

            let data = null;
            let lastErr = null;
            for (const p of paths) {
                try {
                    const r = await api.get(p);
                    data = r?.data;
                    if (data) break;
                } catch (e) {
                    lastErr = e;
                }
            }

            if (!data) throw lastErr || new Error('Unable to load staff');
            setStaffUsers(normalizeStaffResponse(data));
        } catch (err) {
            console.error('fetchStaffForHotel error:', err);
            setStaffUsers([]);
        } finally {
            setStaffLoading(false);
        }
    };

    // Save visible columns to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('hseAuditsVisibleColumns', JSON.stringify(visibleColumns));
        } catch (e) {
            console.warn('Failed to save visible columns to localStorage:', e);
        }
    }, [visibleColumns]);

    // Fetch available columns from Forms Builder
    const fetchAvailableColumns = async () => {
        try {
            const res = await api.get('/api/forms-builder/tables/hse_audits/columns');
            const columns = res?.data?.columns || res?.data || [];

            // Default UI columns
            const defaultColumns = ["checkbox", "type", "reference", "description", "attachments", "priority", "status", "assigned", "date", "actions"];

            // System and known HSE Audits columns to exclude
            const systemColumns = [
                'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
                'title', 'description', 'property_id', 'property_name', 'category',
                'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'
            ];

            // Extract column names (handle both string arrays and object arrays)
            const columnNames = columns.map(col => {
                if (typeof col === 'string') return col;
                if (col.column_name) return col.column_name;
                if (col.name) return col.name;
                return String(col);
            });

            const customCols = columnNames
                .filter(col => !systemColumns.includes(col) && !defaultColumns.includes(col));

            // Insert custom columns before "actions" column
            const newColumns = [...defaultColumns.slice(0, -1), ...customCols, defaultColumns[defaultColumns.length - 1]];

            const nextMetadata = {};
            columns.forEach(col => {
                const cName = typeof col === 'string' ? col : (col.column_name || col.name);
                if (cName) {
                    nextMetadata[cName] = {
                        input_type: col.input_type || 'text',
                        input_options: col.input_options || []
                    };
                }
            });
            setCustomColumnMetadata(nextMetadata);

            // Only update if columns have changed
            if (JSON.stringify(customCols) !== JSON.stringify(customColumns)) {
                setCustomColumns(customCols);
                setAvailableColumns(newColumns);

                // Update visible columns - restore from localStorage or default to hidden
                setVisibleColumns(prev => {
                    const updated = { ...prev };
                    customCols.forEach(col => {
                        // Only set visibility if not already in state (truly new column)
                        if (prev[col] === undefined) {
                            // Check localStorage for this column's visibility
                            try {
                                const saved = localStorage.getItem('hseAuditsVisibleColumns');
                                if (saved) {
                                    const parsed = JSON.parse(saved);
                                    updated[col] = parsed[col] ?? false; // Use saved value or default to hidden
                                } else {
                                    updated[col] = false; // Default to hidden for new columns
                                }
                            } catch (e) {
                                updated[col] = false; // Default to hidden on error
                            }
                        }
                    });
                    return updated;
                });
            }
        } catch (err) {
            console.warn('Failed to fetch columns:', err);
        }
    };

    // Auto-refresh columns every 5 seconds
    useEffect(() => {
        let mounted = true;

        // Initial fetch
        fetchAvailableColumns();

        return () => {
            mounted = false;
        };
    }, [api]);

    // Hide sidebar and navbar when modal is open
    useEffect(() => {
        const isModalOpen = showModal || confirmDialog.isOpen || alertDialog.isOpen;
        if (isModalOpen) {
            document.body.classList.add('form-modal-open');
        } else {
            document.body.classList.remove('form-modal-open');
        }
        // Cleanup on unmount
        return () => {
            document.body.classList.remove('form-modal-open');
        };
    }, [showModal, confirmDialog.isOpen, alertDialog.isOpen]);

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

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                setLoading(true);
                const r1 = await api.get('/api/hotels', { params: { limit: 1000 } }).catch(() => ({ data: [] }));
                const normalized = normalizeHotelsResponse(r1?.data ?? {});
                if (mounted) setHotels(normalized);

                const r2 = await api.get('/api/hse/audits?limit=500').catch(() => ({ data: [] }));
                if (mounted) setRecords(Array.isArray(r2?.data) ? r2.data : (r2?.data?.rows ?? r2?.data ?? []));
            } catch (err) {
                console.warn('load HSE audits failed', err);
            } finally { if (mounted) setLoading(false); }
        }
        load();
        return () => { mounted = false; };
    }, [api]);

    const refresh = async () => { try { setLoading(true); const r = await api.get('/api/hse/audits?limit=500'); setRecords(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? [])); } catch (err) { console.warn('refresh failed', err); } finally { setLoading(false); } };

    const openModal = (m = 'create', rec = null) => {
        setMode(m);
        setSelectedPhotos([]);
        if (m === 'create') {
            setFormData({
                title: '', description: '', property_id: '', property_name: '', category: '',
                priority: 'Medium', reported_by: currentUser?.name || '', assigned_to: '', scheduled_date: '', status: 'Open',
                ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
            });
            setExistingAttachments([]);
        } else {
            setFormData({
                ...rec,
                property_id: rec?.property_id ?? rec?.propertyId ?? rec?.property ?? '',
                property_name: rec?.property_name ?? rec?.propertyName ?? rec?.property ?? '',
                scheduled_date: rec?.scheduled_date ?? rec?.scheduledDate ?? rec?.date ?? '',
                ...customColumns.reduce((acc, col) => ({ ...acc, [col]: rec?.[col] ?? '' }), {})
            });

            let atts = rec?.attachments ?? [];
            try {
                if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
            } catch {
                atts = [];
            }
            setExistingAttachments(Array.isArray(atts) ? atts : []);
        }
        setSelected(rec);
        setShowModal(true);
    };

        const openAttachmentsGallery = (items = []) => {
        if (!items.length) return;
        _openGallery(items, "HSE Audit Documents", "/api/hse/audits/attachments");
    };

    const removeAttachment = async (attachmentId) => {
        if (!attachmentId) return;
        try {
            await api.delete(`/api/hse/audits/attachments/${attachmentId}`);
            setExistingAttachments((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x) !== String(attachmentId)) : []));
            await refresh();
        } catch (err) {
            console.error('removeAttachment error:', err);
            setAlertDialog({
                isOpen: true,
                title: 'Remove Failed',
                message: err?.response?.data?.message || 'Failed to remove attachment',
                type: 'error'
            });
        }
    };

    useEffect(() => {
        if (!showModal || mode === 'view') return;
        if (!formData?.property_id) {
            setStaffUsers([]);
            return;
        }
        fetchStaffForHotel(formData.property_id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal, mode, formData?.property_id]);
    const closeModal = () => { setShowModal(false); setSelected(null); setMode('create'); setError(null); };

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {

            const missing = [];
            if (!String(formData.title || '').trim()) missing.push('Title');
            if (!String(formData.description || '').trim()) missing.push('Description');
            if (!String(formData.property_id || '').trim()) missing.push('Property');
            if (!String(formData.category || '').trim()) missing.push('Category');
            if (!String(formData.priority || '').trim()) missing.push('Priority');
            if (!String(formData.reported_by || '').trim()) missing.push('Reported By');
            if (!String(formData.assigned_to || '').trim()) missing.push('Assigned To');
            if (!String(formData.scheduled_date || '').trim()) missing.push('Scheduled Date');

            for (const col of customColumns || []) {
                const meta = customColumnMetadata[col] || {};
                const inputType = meta.input_type || 'text';
                const v = formData[col];
                if (inputType === 'checkbox') {
                    if (v !== 'true' && v !== 'false') missing.push(col.replace(/_/g, ' '));
                } else if (v === undefined || v === null || String(v).trim() === '') {
                    missing.push(col.replace(/_/g, ' '));
                }
            }

            if (missing.length) {
                setError(`Please fill required fields: ${missing.join(', ')}.`);
                setSubmitting(false);
                return;
            }

            const payload = { ...formData };
            delete payload.attachments; // Prevent backend overwrite corruption

            for (const col of customColumns || []) {
                const meta = customColumnMetadata[col] || {};
                const inputType = meta.input_type || 'text';
                if (inputType === 'checkbox') {
                    payload[col] = formData[col] === 'true' ? true : formData[col] === 'false' ? false : null;
                } else {
                    payload[col] = formData[col];
                }
            }

            const fd = new FormData();
            Object.entries(payload).forEach(([k, v]) => {
                if (v === undefined || v === null) return;
                fd.append(k, String(v));
            });
            (selectedPhotos || []).forEach((f) => {
                if (f) fd.append('photos', f);
            });

            if (mode === 'create') await api.post('/api/hse/audits', fd);
            else await api.patch(`/api/hse/audits/${selected?.id}`, fd);
            await refresh();
            closeModal();
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };


    const doDelete = async (id) => {
        if (!id) return;
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Audit Record',
            message: 'Delete this audit record? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    setDeletingIds(prev => new Set(prev).add(id));
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

                    const ANIM_DURATION = 460;
                    setTimeout(() => {
                        setRecords(prev => (Array.isArray(prev) ? prev.filter(r => String(r.id) !== String(id)) : prev));
                        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    }, ANIM_DURATION);

                    await api.delete(`/api/hse/audits/${id}`).catch(() => null);
                    await refresh();
                } catch (err) {
                    console.error('Delete failed', err);
                    setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    setAlertDialog({
                        isOpen: true,
                        title: 'Delete Failed',
                        message: err?.response?.data?.message || 'Delete failed',
                        type: 'error'
                    });
                }
            }
        });
    };

    const filtered = useMemo(() => {
        const q = (query || "").trim().toLowerCase();
        let result = records.filter(r => {
            const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.reference?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q);
            const matchPriority = filterPriority === 'All' || r.priority === filterPriority;
            const matchStatus = filterStatus === 'All' || r.status === filterStatus;
            const matchNewPriority = !priorityFilter || r.priority === priorityFilter;
            const matchNewStatus = !statusFilter || r.status === statusFilter;
            const matchProperty = !propertyFilter || String(r.property_id) === String(propertyFilter) || String(r.hotel_id) === String(propertyFilter);
            return matchSearch && matchPriority && matchStatus && matchNewPriority && matchNewStatus && matchProperty;
        });

        // Sorting
        if (sortBy === "date") {
            result.sort((a, b) => new Date(b.scheduled_date || b.created_at || 0) - new Date(a.scheduled_date || a.created_at || 0));
        } else if (sortBy === "priority") {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            result.sort((a, b) => (priorityOrder[String(a.priority || '').toLowerCase()] ?? 4) - (priorityOrder[String(b.priority || '').toLowerCase()] ?? 4));
        } else if (sortBy === "status") {
            result.sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')));
        } else if (sortBy === "title") {
            result.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
        }

        return result;
    }, [records, query, filterPriority, filterStatus, priorityFilter, statusFilter, propertyFilter, sortBy]);

    const BASE_EXPORT_COLUMNS = useMemo(
        () => [
            { header: 'Reference', key: 'reference' },
            { header: 'Title', key: 'title' },
            { header: 'Category', key: 'category' },
            { header: 'Priority', key: 'priority' },
            { header: 'Status', key: 'status' },
            { header: 'Scheduled Date', key: 'scheduledDate' },
            { header: 'Property', key: 'propertyName' }
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

    const normalizeAuditExportRow = (item) => {
        const base = {
            reference: item.reference || '-',
            title: item.title || '-',
            category: item.category || '-',
            priority: item.priority || '-',
            status: item.status || '-',
            scheduledDate: item.scheduled_date || '-',
            propertyName: item.property_name || item.hotel_name || '-',
        };

        for (const col of customColumns || []) {
            base[col] = item?.[col] ?? '';
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

            const data = (filtered || []).map(normalizeAuditExportRow);

            if (exportFormat === 'pdf') {
                generatePDF(data, columns, 'HSE Audits Report', 'hse-audits-report');
            } else if (exportFormat === 'csv') {
                generateCSV(data, columns, 'hse-audits-report');
            }

            closeExport();
        } catch (e) {
            console.error('Error exporting HSE audits:', e);
            alert('Failed to download: ' + (e?.message || e));
        }
    };

    // Calculate stats
    const stats = useMemo(() => {
        const total = records.length;
        const overdue = records.filter(r => (r.status || '').toLowerCase() === 'overdue').length;
        const dueThisWeek = 0; // placeholder
        const completed = records.filter(r => (r.status || '').toLowerCase() === 'completed').length;
        return { total, overdue, dueThisWeek, completed };
    }, [records]);

    return (
        <>
            <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="p-3 sm:p-4 md:p-6">
                    {/* Page Header */}
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <Breadcrumbs items={[{ label: 'Property', path: '/admin/hotels' }, { label: 'HSE Audits', path: '/admin/hse-audits' }]} />
                            <h1 className="text-3xl font-black text-slate-900 mt-1">HSE Audits Dashboard</h1>
                        </div>
                        {hasCreate && (
                            <div className="flex items-center gap-3">
                                <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
                            </div>
                        )}
                    </div>

                    {showExportModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                            <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                    <div>
                                        <div className="text-lg font-semibold text-gray-900">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">Select the columns you want to include</div>
                                    </div>
                                    <button
                                        onClick={closeExport}
                                        className="p-2 rounded-xl text-gray-500"
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

                                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
                                    <button
                                        onClick={closeExport}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={runExport}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-teal-600"
                                    >
                                        Download
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4 transition-all duration-200">
                            <div className="bg-blue-50 text-blue-600 h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Audits</div>
                                <div className="text-2xl font-black text-slate-800 leading-none">{stats.total}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4 transition-all duration-200">
                            <div className="bg-rose-50 text-rose-600 h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Overdue</div>
                                <div className="text-2xl font-black text-slate-800 leading-none">{stats.overdue}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4 transition-all duration-200">
                            <div className="bg-orange-50 text-orange-600 h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Due This Week</div>
                                <div className="text-2xl font-black text-slate-800 leading-none">{stats.dueThisWeek}</div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4 transition-all duration-200">
                            <div className="bg-emerald-50 text-emerald-600 h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0">
                                <ClipboardCheck className="w-7 h-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Completed</div>
                                <div className="text-2xl font-black text-slate-800 leading-none">{stats.completed}</div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area - HSE Audits Table */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 transition-all duration-200">
                        {/* Table Header Section */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 mb-1">All Audits</h2>
                                    <p className="text-sm text-gray-500">{stats.total} total records</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Search Input */}
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={e => setQuery(e.target.value)}
                                            placeholder="Search..."
                                            className="bg-white border-2 border-gray-300 rounded-xl !pl-14 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-72 shadow-sm "
                                        />
                                    </div>
                                    {/* View Dropdown */}
                                    <div className="relative" ref={viewRef}>
                                        <button
                                            onClick={() => setShowViewMenu(!showViewMenu)}
                                            className="bg-white border border-gray-300 text-gray-700 rounded-xl px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                            <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
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
                                                                <ClipboardCheck className="w-4 h-4" />
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
                                                                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl border ${visibleColumns[col]
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
                                                                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl border ${visibleColumns[col]
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

                                    {hasCreate && (
                                        <button
                                            onClick={() => openModal('create')}
                                            className="bg-teal-500 text-white font-medium rounded-xl py-2.5 px-5 text-sm flex items-center gap-2 transition-colors shadow-md "
                                        >
                                            <span>+</span>
                                            <span>New Audit</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Filter Row */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="relative">
                                    <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select
                                        value={priorityFilter}
                                        onChange={(e) => setPriorityFilter(e.target.value)}
                                        className="form-select !pl-14 pr-10 rounded-xl h-10 py-0 leading-none text-sm font-semibold"
                                    >
                                        <option value="">All Priorities</option>
                                        <option value="Urgent">Urgent</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                <div className="relative">
                                    <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="form-select !pl-14 pr-10 rounded-xl h-10 py-0 leading-none text-sm font-semibold"
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="Open">Open</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Passed">Passed</option>
                                        <option value="Failed">Failed</option>
                                        <option value="Overdue">Overdue</option>
                                    </select>
                                </div>

                                <div className="relative">
                                    <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select
                                        value={propertyFilter}
                                        onChange={(e) => setPropertyFilter(e.target.value)}
                                        className="form-select !pl-14 pr-10 rounded-xl h-10 py-0 leading-none text-sm font-semibold"
                                    >
                                        <option value="">All Properties</option>
                                        {hotels.map(h => (
                                            <option key={h.id} value={h.id}>{h.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative">
                                    <Columns className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="form-select !pl-14 pr-10 rounded-xl h-10 py-0 leading-none text-sm font-semibold"
                                    >
                                        <option value="">Sort By</option>
                                        <option value="date">Date (Newest)</option>
                                        <option value="priority">Priority</option>
                                        <option value="status">Status</option>
                                        <option value="title">Title</option>
                                    </select>
                                </div>

                                {(priorityFilter || statusFilter || propertyFilter || sortBy) && (
                                    <button
                                        onClick={() => {
                                            setPriorityFilter("");
                                            setStatusFilter("");
                                            setPropertyFilter("");
                                            setSortBy("");
                                        }}
                                        className="h-10 text-sm text-teal-600 font-semibold px-3 py-0 rounded-xl transition-colors"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>

                            {/* Old Filter Row - Keep for backward compatibility */}
                            <div className="hidden">
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="All">All Priority</option>
                                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="All">All Status</option>
                                    <option>Open</option>
                                    <option>Pending</option>
                                    <option>Completed</option>
                                    <option>Overdue</option>
                                </select>
                                <select className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
                                    <option>All Properties</option>
                                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Data Display - Table or Board View */}
                        {viewMode === 'table' ? (
                            <div className="overflow-x-auto scrollbar-hide relative">
                                <table className="w-full">
                                    <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                        <tr>
                                            {visibleColumns.checkbox && (
                                                <th className="text-left py-4 px-4">
                                                    <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                </th>
                                            )}
                                            {visibleColumns.type && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">CATEGORY</th>
                                            )}
                                            {visibleColumns.reference && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">REFERENCE</th>
                                            )}
                                            {visibleColumns.description && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</th>
                                            )}
                                            {visibleColumns.attachments && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ATTACHMENTS</th>
                                            )}
                                            {visibleColumns.priority && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PRIORITY</th>
                                            )}
                                            {visibleColumns.status && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>
                                            )}
                                            {visibleColumns.assigned && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ASSIGNED TO</th>
                                            )}
                                            {visibleColumns.date && (
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DATE</th>
                                            )}
                                            {/* Custom columns */}
                                            {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    {col.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                            {visibleColumns.actions && (
                                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-[var(--bg-primary)]" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>ACTIONS</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                                            </tr>
                                        ) : filtered.length > 0 ? filtered.map((r, idx) => {
                                            const priorityStyle = getPriorityColor(r.priority || "Medium");
                                            const statusStyle = getStatusColor(r.status || "Open");
                                            const isDeleting = deletingIds.has(r.id);

                                            return (
                                                <tr key={idx} className={`transition-colors ${isDeleting ? 'hse-audit-deleting' : ''}`}>
                                                    {visibleColumns.checkbox && (
                                                        <td className="py-5 px-6">
                                                            <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                        </td>
                                                    )}
                                                    {visibleColumns.type && (
                                                        <td className="py-5 px-6">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                                                {r.category || "General"}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.reference && (
                                                        <td className="py-5 px-6">
                                                            <span className="text-slate-900 font-semibold text-sm whitespace-nowrap">{r.reference || `AUD-${r.id || idx}`}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.description && (
                                                        <td className="py-5 px-6">
                                                            <div>
                                                                <div
                                                                    className={`text-gray-900 font-medium transition-colors flex items-center gap-2 whitespace-nowrap`}
                                                                    onClick={hasUpdate ? () => openModal('edit', r) : undefined}
                                                                >
                                                                    <Home className="w-4 h-4 text-gray-400" />
                                                                    <span>{r.property_name || 'Unknown Property'}</span>
                                                                </div>
                                                                <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">
                                                                    {r.title || "Audit Title"}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.attachments && (
                                                        <td className="py-5 px-6">
                                                            {(() => {
                                                                let atts = r?.attachments ?? [];
                                                                try {
                                                                    if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                                                                } catch {
                                                                    atts = [];
                                                                }
                                                                const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
                                                                if (!list.length) return <span className="text-gray-400 text-sm font-medium">—</span>;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openAttachmentsGallery(list)}
                                                                        className="inline-flex items-center gap-2 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-2xl transition-all hover:bg-teal-100 shadow-sm uppercase tracking-wider"
                                                                    >
                                                                        <span>{list.length}</span>
                                                                        <span>Photos</span>
                                                                    </button>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}
                                                    {visibleColumns.priority && (
                                                        <td className="py-5 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${priorityStyle.text}`}>{r.priority || "Medium"}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.status && (
                                                        <td className="py-5 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${statusStyle.text}`}>{r.status || "Open"}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.assigned && (
                                                        <td className="py-5 px-6">
                                                            {!r.assigned_to ? (
                                                                <span className="text-gray-400 text-sm">Unassigned</span>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(r.assigned_to)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                                                        {getInitials(r.assigned_to)}
                                                                    </div>
                                                                    <span className="text-gray-900 text-sm font-medium">{r.assigned_to}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    {visibleColumns.date && (
                                                        <td className="py-5 px-6 whitespace-nowrap">
                                                            <span className="text-gray-900 font-medium text-sm">{formatDate(r.scheduled_date)}</span>
                                                        </td>
                                                    )}
                                                    {/* Custom columns */}
                                                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                        <td key={col} className="py-5 px-6">
                                                            <span className="text-gray-900 font-medium text-sm">{r[col] || '-'}</span>
                                                        </td>
                                                    ))}
                                                    {visibleColumns.actions && (
                                                        <td className="py-5 px-6 text-center sticky right-0 z-10 bg-white" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => openModal('view', r)}
                                                                    className="p-1.5 text-gray-600 transition-colors"
                                                                    title="View"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                {hasUpdate && (
                                                                    <button
                                                                        onClick={() => openModal('edit', r)}
                                                                        className="p-1.5 text-gray-600 transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {hasDelete && (
                                                                    <button
                                                                        onClick={() => doDelete(r.id)}
                                                                        className="p-1.5 text-gray-600 transition-colors"
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
                                                <td colSpan="9" className="py-8 text-center text-gray-500">No audits found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Board/Kanban View */
                            <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                                <div className="flex gap-4 min-w-max pb-4">
                                    {['Open', 'Pending', 'Completed'].map((status) => {
                                        const statusItems = filtered.filter((audit) => {
                                            return (audit.status || 'Open').toLowerCase() === status.toLowerCase();
                                        });

                                        const getStatusStyle = (status) => {
                                            const low = String(status || '').toLowerCase();
                                            const isCompleted = low === 'completed' || low === 'closed' || low === 'passed' || low === 'resolved';
                                            const isError = low === 'action required' || low === 'overdue' || low === 'failed' || low === 'escalated';
                                            const isWarning = !isCompleted && !isError;

                                            return {
                                                bg: 'bg-[var(--bg-primary)]',
                                                border: 'border-[var(--border-color)]',
                                                header: 'bg-[var(--bg-surface)]',
                                                text: isCompleted
                                                    ? 'text-[var(--color-success)]'
                                                    : isError
                                                        ? 'text-[var(--color-error)]'
                                                        : 'text-[var(--color-warning)]',
                                                dot: isCompleted
                                                    ? 'bg-emerald-500'
                                                    : isError
                                                        ? 'bg-red-500'
                                                        : 'bg-orange-500',
                                            };
                                        };

                                        const style = getStatusStyle(status);

                                        return (
                                            <div key={status} className="flex-shrink-0 w-80">
                                                <div className={`rounded-xl border ${style.border} ${style.bg}`}>
                                                    <div className={`${style.header} px-4 py-3 border-b ${style.border}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
                                                                <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>
                                                                    {status}
                                                                </h3>
                                                            </div>
                                                            <span className="bg-[var(--bg-surface)] px-2 py-0.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)]">
                                                                {statusItems.length}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                                                        {statusItems.length === 0 ? (
                                                            <div className="text-center py-8 px-4">
                                                                <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-[var(--text-secondary)]" />
                                                                <p className="text-[var(--text-secondary)] text-sm">No audits</p>
                                                            </div>
                                                        ) : (
                                                            statusItems.map((audit) => {
                                                                const priorityColor = getPriorityColor(audit.priority || "Medium");
                                                                const isDeleting = deletingIds.has(audit.id);

                                                                return (
                                                                    <div
                                                                        key={audit.id}
                                                                        className={`bg-[var(--bg-surface)] rounded-xl p-4 shadow-sm border border-[var(--border-color)] cursor-pointer ${isDeleting ? 'hse-audit-card-deleting' : ''}`}
                                                                        onClick={() => { setSelected(audit); setMode('view'); setShowModal(true); }}
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-xs font-mono text-[var(--text-secondary)]">{audit.reference || `AUD-${audit.id}`}</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                                                                <span className={`text-xs font-medium ${priorityColor.text}`}>
                                                                                    {audit.priority || "Medium"}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-2 line-clamp-2">
                                                                            {audit.title}
                                                                        </h4>

                                                                        {audit.description && (
                                                                            <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
                                                                                {audit.description}
                                                                            </p>
                                                                        )}

                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            {audit.category && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">
                                                                                    {audit.category}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                {audit.assigned_to && audit.assigned_to !== 'Unassigned' ? (
                                                                                    <>
                                                                                        <div className={`w-6 h-6 rounded-full ${getAvatarColor(audit.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                                                                            {getInitials(audit.assigned_to)}
                                                                                        </div>
                                                                                        <span className="text-xs text-[var(--text-primary)] truncate max-w-[100px]">
                                                                                            {audit.assigned_to}
                                                                                        </span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-xs text-[var(--text-secondary)]">Unassigned</span>
                                                                                )}
                                                                            </div>

                                                                            <span className="text-xs text-[var(--text-secondary)]">
                                                                                {formatDate(audit.scheduled_date)}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelected(audit); setMode('view'); setShowModal(true);
                                                                                }}
                                                                                className="flex-1 py-1.5 px-2 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                                                                title="View"
                                                                            >
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                View
                                                                            </button>

                                                                            {hasUpdate && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSelected(audit); setMode('edit'); setFormData({ ...audit }); setShowModal(true);
                                                                                    }}
                                                                                    className="p-1.5 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-colors"
                                                                                    title="Edit"
                                                                                >
                                                                                    <Edit className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}

                                                                            {hasDelete && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        doDelete(audit.id);
                                                                                    }}
                                                                                    className="p-1.5 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-colors"
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

                {/* ----------------- MODAL SECTION ----------------- */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-container h-[70vh]">

                            {/* Modal Header */}
                            <div className="modal-header">
                                <div>
                                    <h2 className="modal-title">
                                        {mode === 'create' ? "New HSE Audit" : mode === 'edit' ? "Edit Audit" : "Audit Details"}
                                    </h2>
                                    <p className="modal-subtitle">
                                        {mode === 'view' ? 'View audit information' : 'Enter audit details'}
                                    </p>
                                </div>
                                <button onClick={closeModal} className="rounded-xl modal-close-btn">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* View Mode Content */}
                            {mode === 'view' ? (
                                <>
                                    <div className="modal-content space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label>
                                                <p className="text-gray-900 font-medium">{formData.title || 'N/A'}</p>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    {formData.status || 'N/A'}
                                                </span>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Property</label>
                                                <p className="text-gray-900">{formData.property_name || 'N/A'}</p>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                                                <p className="text-gray-900">{formData.category || 'N/A'}</p>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Priority</label>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    {formData.priority || 'N/A'}
                                                </span>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Scheduled Date</label>
                                                <p className="text-gray-900">{formatDate(formData.scheduled_date) || 'N/A'}</p>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reported By</label>
                                                <p className="text-gray-900">{formData.reported_by || 'N/A'}</p>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Assigned To</label>
                                                <p className="text-gray-900">{formData.assigned_to || 'N/A'}</p>
                                            </div>

                                            {(customColumns || []).map((col) => {
                                                const meta = customColumnMetadata?.[col] || {};
                                                const label = String(meta.label || col)
                                                    .replace(/_/g, ' ')
                                                    .replace(/\b\w/g, (m) => m.toUpperCase());
                                                const rawVal = formData?.[col];
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
                                            <p className="text-gray-700">{formData.description || 'No description provided.'}</p>
                                        </div>

                                        {Array.isArray(existingAttachments) && existingAttachments.length > 0 && (
                                            <div className="pt-4 border-t border-gray-100">
                                                <button
                                                    type="button"
                                                    onClick={() => openAttachmentsGallery(existingAttachments)}
                                                    className="inline-flex items-center px-4 py-2 rounded-xl bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors"
                                                >
                                                    View {existingAttachments.length} Photos
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="rounded-xl btn-secondary"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMode('edit')}
                                            className="btn-primary rounded-xl"
                                        >
                                            <Edit className="w-4 h-4" />
                                            Edit
                                        </button>
                                    </div>
                                </>
                            ) : (
                                /* Edit/Create Form Content */
                                <>
                                    <form id="hse-audits-form" onSubmit={submit} className="modal-content form-section">
                                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
                                        <div className="form-grid-2">

                                            {/* Row 1: Title & Description */}
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                                                <input
                                                    required
                                                    value={formData.title}
                                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                    placeholder="Brief description of task"
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                />
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Description <span className="text-red-500">*</span></label>
                                                <textarea
                                                    required
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    rows={3}
                                                    placeholder="Detailed description of the audit..."
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
                                                />
                                            </div>

                                            {/* Row 2: Property & Category */}
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                                                <select
                                                    required
                                                    value={formData.property_id}
                                                    onChange={(e) => {
                                                        const id = e.target.value;
                                                        const h = hotels.find(h => h.id == id);
                                                        setFormData({ ...formData, property_id: id, property_name: h?.name || '', reported_by: currentUser?.name || '', assigned_to: '' });
                                                    }}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                >
                                                    <option value="">Select property</option>
                                                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Category <span className="text-red-500">*</span></label>
                                                <select
                                                    required
                                                    value={formData.category}
                                                    onChange={handleCategoryChange}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                >
                                                    <option value="">Select category</option>
                                                    {[...categoryOptions, ...customCategories].map((c) => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                    {!!formData.category && ![...categoryOptions, ...customCategories].some((c) => String(c) === String(formData.category)) && (
                                                        <option value={formData.category}>{formData.category}</option>
                                                    )}
                                                    <option value="__add_new__">+ Add new...</option>
                                                </select>
                                                {showCustomCategoryInput && (
                                                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={customCategoryValue}
                                                            onChange={(e) => setCustomCategoryValue(e.target.value)}
                                                            placeholder="Enter new category"
                                                            className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                        />
                                                        <div className="flex items-center gap-2 sm:shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={saveCustomCategory}
                                                                className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
                                                            >
                                                                Add
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowCustomCategoryInput(false);
                                                                    setCustomCategoryValue('');
                                                                }}
                                                                className="px-3 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium transition-colors whitespace-nowrap"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Row 3: Priority & Reported By */}
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Priority <span className="text-red-500">*</span></label>
                                                <select
                                                    required
                                                    value={formData.priority}
                                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                >
                                                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Reported By <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.reported_by}
                                                    readOnly
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-100 cursor-not-allowed focus:outline-none"
                                                />
                                            </div>

                                            {/* Row 4: Assigned To & Scheduled Date */}
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Assigned To <span className="text-red-500">*</span></label>
                                                <select
                                                    required
                                                    value={formData.assigned_to || ''}
                                                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                                                    disabled={!formData.property_id || staffLoading}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                >
                                                    <option value="">
                                                        {!formData.property_id
                                                            ? "Select property first"
                                                            : staffLoading
                                                                ? "Loading staff..."
                                                                : "Select staff"}
                                                    </option>
                                                    {!!formData.assigned_to && !staffUsers.some((u) => String(u.name) === String(formData.assigned_to)) && (
                                                        <option value={formData.assigned_to}>{formData.assigned_to}</option>
                                                    )}
                                                    {staffUsers.map((u) => (
                                                        <option key={u.id} value={u.name}>{u.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Date <span className="text-red-500">*</span></label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={formatDateISO(formData.scheduled_date)}
                                                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                />
                                            </div>

                                            <div className="col-span-1 md:col-span-2 mt-4">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Attachments</label>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={(e) => setSelectedPhotos(Array.from(e.target.files || []))}
                                                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all"
                                                />

                                                {mode !== 'create' && Array.isArray(existingAttachments) && existingAttachments.length > 0 && (
                                                    <div className="mt-8 space-y-4">
                                                        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 ml-1">Existing Attachments</h3>
                                                        {existingAttachments.filter(Boolean).map((id, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-white border border-gray-100/80 rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] transition-all duration-300">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                                                                        <Eye size={18} className="text-slate-400" />
                                                                    </div>
                                                                    <span className="text-sm font-bold text-slate-700">Attachment #{idx + 1}</span>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openAttachmentsGallery([id])}
                                                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[11px] font-bold text-teal-700 shadow-sm hover:bg-gray-50 hover:border-teal-200 transition-all uppercase tracking-wider"
                                                                    >
                                                                        <Eye size={14} />
                                                                        View
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeAttachment(id)}
                                                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-100 rounded-xl text-[11px] font-bold text-red-600 shadow-sm hover:bg-red-50 hover:border-red-200 transition-all uppercase tracking-wider"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Custom columns from Forms Builder */}
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
                                                                value={formData[col] === 'true' || formData[col] === 'false' ? formData[col] : ''}
                                                                onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                            >
                                                                <option value="">Select...</option>
                                                                <option value="true">Yes</option>
                                                                <option value="false">No</option>
                                                            </select>
                                                        ) : inputType === 'dropdown' || inputType === 'select' ? (
                                                            <select
                                                                required
                                                                value={formData[col] || ''}
                                                                onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                            >
                                                                <option value="">Select...</option>
                                                                {options.map((opt, idx) => (
                                                                    <option key={idx} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        ) : inputType === 'textarea' ? (
                                                            <textarea
                                                                required
                                                                rows={3}
                                                                value={formData[col] || ''}
                                                                onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
                                                            />
                                                        ) : inputType === 'date' ? (
                                                            <input
                                                                type="date"
                                                                required
                                                                value={formData[col] ? formatDateISO(formData[col]) : ''}
                                                                onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                            />
                                                        ) : (
                                                            <input
                                                                type={inputType}
                                                                required
                                                                value={formData[col] || ''}
                                                                onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                                                                placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </form>

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="rounded-xl btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            form="hse-audits-form"
                                            disabled={submitting}
                                            className="rounded-xl btn-primary"
                                        >
                                            {submitting ? "Saving..." : (mode === 'create' ? "Create" : "Save Changes")}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div >
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
            <ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />
        </>
    );
}