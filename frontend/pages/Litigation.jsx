/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
    Home,
    Gavel,
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
    AlertCircle,
    CheckCircle,
    Clock,
    Check
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'litigation-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
  @keyframes litigationSlideOut {
   0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
   40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
   100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
  }
  @keyframes litigationCardDelete {
   0%   { opacity: 1; transform: scale(1) rotate(0deg); }
   30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
   100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
  }
  tr.litigation-deleting {
   animation: litigationSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
   overflow: hidden;
   pointer-events: none;
  }
  .litigation-card-deleting {
   animation: litigationCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
   pointer-events: none;
  }
 `;
    document.head.appendChild(style);
}

const litigationColumnsCache = {
    ts: 0,
    columns: null,
};

/* --- Helper: Normalize API Data --- */
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
    return items
        .map((h) => {
            const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;
            const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ''}`;
            return { id, name };
        })
        .filter((x) => x.id && x.name);
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
        if (Number.isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    } catch {
        return "";
    }
}

function getPriorityColor(p) {
    const low = String(p).toLowerCase();
    if (low === "urgent" || low === "high") return { dot: "bg-red-500", text: "text-red-700" };
    if (low === "medium") return { dot: "bg-orange-500", text: "text-orange-700" };
    return { dot: "bg-green-500", text: "text-green-700" };
}

function getStatusColor(s) {
    const low = String(s).toLowerCase();
    if (low === "completed" || low === "closed" || low === "resolved") return { dot: "bg-green-500", text: "text-green-700" };
    if (low === "pending") return { dot: "bg-orange-500", text: "text-orange-700" };
    if (low === "in progress" || low === "in court") return { dot: "bg-purple-500", text: "text-purple-700" };
    return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
    return "bg-teal-100 text-teal-700";
}

function getInitials(name) {
    if (!name || name === "Unassigned") return "UA";
    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

export default function Litigation({ user }) {
    // Get current user from props or localStorage
    const currentUser = user || (() => {
        try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    // Get permissions for litigation module
    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
    const hasRead = canRead("litigation");
    const hasCreate = canCreate("litigation");
    const hasUpdate = canUpdate("litigation");
    const hasDelete = canDelete("litigation");

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [hotels, setHotels] = useState([]);
    const [hotelsLoading, setHotelsLoading] = useState(false);
    const [tasks, setTasks] = useState([]);
    // Track rows/cards currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [tasksLoading, setTasksLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [modalMode, setModalMode] = useState('create');

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    // Filter States
    const [query, setQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState('All Priority');
    const [filterStatus, setFilterStatus] = useState('All Status');
    const [filterProperty, setFilterProperty] = useState('All Properties');
    const [sortBy, setSortBy] = useState('');

    // Column Visibility & View Menu
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
    const viewRef = useRef(null);

    // Custom columns from Forms Builder
    const [customColumns, setCustomColumns] = useState([]);
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});
    const [availableColumns, setAvailableColumns] = useState([]);

    const BASE_EXPORT_COLUMNS = useMemo(
        () => [
            { header: 'Reference', key: 'reference' },
            { header: 'Title', key: 'title' },
            { header: 'Case Type', key: 'caseType' },
            { header: 'Priority', key: 'priority' },
            { header: 'Status', key: 'status' },
            { header: 'Filing Date', key: 'filingDate' },
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
            const saved = localStorage.getItem('litigation_visible_columns');
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

    const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

    // Fetch available columns from Forms Builder
    const fetchAvailableColumns = async () => {
        try {
            const now = Date.now();
            if (litigationColumnsCache.columns && now - litigationColumnsCache.ts < 60_000) {
                const cols = litigationColumnsCache.columns?.columns || litigationColumnsCache.columns || [];

                // Extract column names (handle both string arrays and object arrays)
                const columnNames = (Array.isArray(cols) ? cols : []).map(col => {
                    if (typeof col === 'string') return col;
                    if (col.column_name) return col.column_name;
                    if (col.name) return col.name;
                    return String(col);
                });

                setAvailableColumns(columnNames);

                const nextMetadata = {};
                (Array.isArray(cols) ? cols : []).forEach(col => {
                    const cName = typeof col === 'string' ? col : (col.column_name || col.name);
                    if (cName) {
                        nextMetadata[cName] = {
                            input_type: col.input_type || 'text',
                            input_options: col.input_options || []
                        };
                    }
                });
                setCustomColumnMetadata(nextMetadata);

                // Filter out standard columns to get custom ones
                const standardCols = ['id', 'reference', 'title', 'description', 'priority', 'status',
                    'assigned_to_id', 'assigned_to_name', 'service_user_id', 'property_id',
                    'property_name', 'scheduled_date', 'reported_by', 'category', 'notes',
                    'created_at', 'updated_at'];
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
                return;
            }

            const res = await api.get('/api/forms-builder/tables/litigation_tasks/columns', { timeout: 60000 });
            const cols = res.data?.columns || [];

            litigationColumnsCache.ts = now;
            litigationColumnsCache.columns = cols;

            // Extract column names (handle both string arrays and object arrays)
            const columnNames = cols.map(col => {
                if (typeof col === 'string') return col;
                if (col.column_name) return col.column_name;
                if (col.name) return col.name;
                return String(col);
            });

            setAvailableColumns(columnNames);

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

            // Filter out standard columns to get custom ones
            const standardCols = ['id', 'reference', 'title', 'description', 'priority', 'status',
                'assigned_to_id', 'assigned_to_name', 'service_user_id', 'property_id',
                'property_name', 'scheduled_date', 'reported_by', 'category', 'notes',
                'created_at', 'updated_at'];
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
            localStorage.setItem('litigation_visible_columns', JSON.stringify(visibleColumns));
        } catch (e) {
            console.error('Error saving column visibility:', e);
        }
    }, [visibleColumns]);

    // Hide sidebar and navbar when modal is open
    useEffect(() => {
        if (showModal || confirmDialog.isOpen) {
            document.body.classList.add('form-modal-open');
        } else {
            document.body.classList.remove('form-modal-open');
        }
        // Cleanup on unmount
        return () => {
            document.body.classList.remove('form-modal-open');
        };
    }, [showModal, confirmDialog.isOpen]);

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
                setHotelsLoading(true);
                const res = await api.get('/api/hotels', { params: { limit: 1000 } }).catch(() => ({ data: [] }));
                const normalized = normalizeHotelsResponse(res?.data ?? {});
                if (mounted) setHotels(normalized);
            } catch (err) {
                console.warn('Failed to load hotels', err);
            } finally { if (mounted) setHotelsLoading(false); }
        }
        load();

        async function loadTasks() {
            try {
                setTasksLoading(true);
                const r = await api.get('/api/litigation?limit=500').catch(() => ({ data: [] }));
                if (mounted) setTasks(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? []));
            } catch (err) {
                console.warn('Failed to load tasks', err);
            } finally { if (mounted) setTasksLoading(false); }
        }
        loadTasks();
        return () => { mounted = false; };
    }, [api]);

    const refreshTasks = async () => {
        try {
            setTasksLoading(true);
            const r = await api.get('/api/litigation?limit=500').catch(() => ({ data: [] }));
            setTasks(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? []));
        } catch (err) {
            console.warn('refreshTasks failed', err);
        } finally { setTasksLoading(false); }
    };

    const handleDelete = async (t) => {
        const id = t?.id;
        if (!id) return;
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Task',
            message: 'Are you sure you want to delete this task? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                await handleDeleteConfirmed(id);
            }
        });
    };

    const handleDeleteConfirmed = async (id) => {
        try {
            setDeletingIds(prev => new Set(prev).add(id));

            const ANIM_DURATION = 460;
            setTimeout(() => {
                setTasks(prev => (Array.isArray(prev) ? prev.filter(t => String(t.id) !== String(id)) : prev));
                setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }, ANIM_DURATION);

            await api.delete(`/api/litigation/${id}`).catch(() => null);
            await refreshTasks();
        } catch (err) {
            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            setAlertDialog({
                isOpen: true,
                title: 'Error',
                message: 'Failed to delete task. Please try again.',
                type: 'error'
            });
        }
    };

    // Stats
    const stats = useMemo(() => {
        const total = tasks.length;
        const highPriority = tasks.filter(t => ['high', 'urgent'].includes((t.priority || '').toLowerCase())).length;
        const inCourt = tasks.filter(t => (t.status || '').toLowerCase().includes('court') || (t.status || '').toLowerCase().includes('progress')).length;
        const closed = tasks.filter(t => ['closed', 'completed', 'resolved'].includes((t.status || '').toLowerCase())).length;
        return { total, highPriority, inCourt, closed };
    }, [tasks]);

    // Filtering
    const filteredTasks = useMemo(() => {
        const q = (query || "").trim().toLowerCase();
        let list = tasks.filter(t => {
            if (q && !t.reference?.toLowerCase().includes(q) && !t.title?.toLowerCase().includes(q)) return false;
            if (filterPriority !== 'All Priority' && (t.priority || '').toLowerCase() !== filterPriority.toLowerCase()) return false;
            if (filterStatus !== 'All Status' && (t.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterProperty !== 'All Properties' && (t.property_name || t.property) !== filterProperty) return false;
            return true;
        });

        // Apply sorting
        if (sortBy) {
            list = [...list].sort((a, b) => {
                if (sortBy === 'date') {
                    const dateA = new Date(a.scheduled_date || a.created_at || 0);
                    const dateB = new Date(b.scheduled_date || b.created_at || 0);
                    return dateB - dateA;
                }
                if (sortBy === 'priority') {
                    const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                    const priorityA = (a.priority || 'medium').toLowerCase();
                    const priorityB = (b.priority || 'medium').toLowerCase();
                    return (priorityOrder[priorityA] || 2) - (priorityOrder[priorityB] || 2);
                }
                if (sortBy === 'status') {
                    return (a.status || '').localeCompare(b.status || '');
                }
                if (sortBy === 'title') {
                    return (a.title || '').localeCompare(b.title || '');
                }
                return 0;
            });
        }

        return list;
    }, [tasks, query, filterPriority, filterStatus, filterProperty, sortBy]);

    const normalizeLitigationExportRow = (task) => {
        const base = {
            reference: task.reference || '-',
            title: task.title || '-',
            caseType: task.caseType || task.case_type || '-',
            priority: task.priority || '-',
            status: task.status || '-',
            filingDate: task.filingDate || task.filing_date || '-',
            propertyName: task.property_name || task.property || '-',
        };

        for (const col of customColumns || []) {
            base[col] = task?.[col] ?? '';
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

            const data = (filteredTasks || []).map(normalizeLitigationExportRow);

            if (exportFormat === 'pdf') {
                generatePDF(data, columns, 'Litigation Cases Report', 'litigation-cases-report');
            } else if (exportFormat === 'csv') {
                generateCSV(data, columns, 'litigation-cases-report');
            }

            closeExport();
        } catch (error) {
            console.error('Error exporting litigation cases:', error);
            alert('Failed to download: ' + error.message);
        }
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">
                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Litigation</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Home className="w-4 h-4" />
                            <span>&gt;</span>
                            <span>Property</span>
                            <span>&gt;</span>
                            <span>Litigation</span>
                        </div>
                    </div>
                    {hasCreate && (
                        <div className="flex items-center gap-3">
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
                            <Gavel size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Cases</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.total}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-red-50 text-red-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <AlertCircle size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">High Priority</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.highPriority}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-yellow-50 text-yellow-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <Clock size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">In Court</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.inCourt}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all duration-200">
                        <div className="bg-emerald-50 text-emerald-500 h-12 w-12 rounded-xl-[14px] flex items-center justify-center shrink-0">
                            <CheckCircle size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Closed</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.closed}</div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area - Litigation Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-200">
                    {/* Table Header Section */}
                    <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">All Work Orders</h2>
                                <p className="text-sm text-gray-500">{filteredTasks.length} total records</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 justify-start sm:justify-end">
                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Search work orders..."
                                        className="bg-white border-2 border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-full sm:w-72 transition-all shadow-sm "
                                    />
                                </div>

                                {/* View Dropdown */}
                                <div className="relative" ref={viewRef}>
                                    <button
                                        onClick={() => setShowViewMenu(!showViewMenu)}
                                        className="bg-white border border-gray-300 text-gray-700 rounded-xl px-4 py-2 text-sm font-medium transition-all flex items-center gap-2"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    {showViewMenu && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-bold text-gray-800">View Settings</h3>
                                                    <button onClick={() => setShowViewMenu(false)} className="text-gray-400 rounded-xl">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setViewMode('table')}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
                                                    >
                                                        <Columns className="w-3.5 h-3.5" /> Table
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMode('board')}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${viewMode === 'board' ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
                                                    >
                                                        <Gavel className="w-3.5 h-3.5" /> Board
                                                    </button>
                                                </div>
                                            </div>

                                            {viewMode === 'table' && (
                                                <div className="p-4 bg-white max-h-[400px] overflow-y-auto">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">Columns</span>
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
                                            )}
                                        </div>
                                    )}
                                </div>

                                {hasCreate && (
                                    <button
                                        onClick={() => { setSelectedTask(null); setModalMode('create'); setShowModal(true); }}
                                        className="bg-teal-500 text-white font-medium rounded-xl py-2 px-5 text-sm flex items-center gap-2 transition-all shadow-md "
                                    >
                                        <Gavel className="w-4 h-4" />
                                        <span>Create Case</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter and Sorting Row */}
                        <div className="flex items-center gap-4 py-4 px-6 bg-gray-50/50 border-y border-gray-100">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={filterPriority}
                                    onChange={e => setFilterPriority(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                                >
                                    <option>All Priority</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                                >
                                    <option>All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="in progress">In Progress</option>
                                    <option value="in court">In Court</option>
                                    <option value="completed">Completed</option>
                                    <option value="closed">Closed</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={filterProperty}
                                    onChange={e => setFilterProperty(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                                >
                                    <option>All Properties</option>
                                    {hotels.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                                >
                                    <option value="">Sort By</option>
                                    <option value="date">Date (Newest)</option>
                                    <option value="priority">Priority</option>
                                    <option value="status">Status</option>
                                    <option value="title">Title</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            {(filterPriority !== 'All Priority' || filterStatus !== 'All Status' || filterProperty !== 'All Properties' || sortBy) && (
                                <button
                                    onClick={() => {
                                        setFilterPriority('All Priority');
                                        setFilterStatus('All Status');
                                        setFilterProperty('All Properties');
                                        setSortBy('');
                                    }}
                                    className="text-sm text-red-600 font-medium whitespace-nowrap px-2 flex items-center gap-1 rounded-xl"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Data Display - Table or Board View */}
                    <div className="p-6">
                        {viewMode === 'table' ? (
                            <div className="overflow-x-auto scrollbar-hide rounded-xl border border-gray-200 shadow-sm transition-all duration-200 relative">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                        <tr className="border-b border-gray-200">
                                            {visibleColumns.checkbox && (
                                                <th className="text-left py-4 px-4">
                                                    <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                </th>
                                            )}
                                            {visibleColumns.type && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">TYPE</th>}
                                            {visibleColumns.reference && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">REFERENCE</th>}
                                            {visibleColumns.description && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DESCRIPTION</th>}
                                            {visibleColumns.priority && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">PRIORITY</th>}
                                            {visibleColumns.status && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>}
                                            {visibleColumns.assigned && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ASSIGNED TO</th>}
                                            {visibleColumns.date && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DATE</th>}
                                            {/* Custom Columns */}
                                            {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                    {col.replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                            {visibleColumns.actions && <th className="text-center py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 z-10 bg-gray-50" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>ACTIONS</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {tasksLoading ? (
                                            <tr>
                                                <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                                            </tr>
                                        ) : filteredTasks.length > 0 ? filteredTasks.map((task, idx) => {
                                            const priorityStyle = getPriorityColor(task.priority || "Medium");
                                            const statusStyle = getStatusColor(task.status || "Pending");
                                            const isDeleting = deletingIds.has(task.id);

                                            return (
                                                <tr key={idx} className={`transition-colors ${isDeleting ? 'litigation-deleting' : ''}`}>
                                                    {visibleColumns.checkbox && (
                                                        <td className="py-4 px-4">
                                                            <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                        </td>
                                                    )}
                                                    {visibleColumns.type && (
                                                        <td className="py-4 px-4">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
                                                                {task.category || "Litigation"}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.reference && (
                                                        <td className="py-4 px-4">
                                                            <span className="text-slate-900 font-semibold text-sm whitespace-nowrap">{task.reference}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.description && (
                                                        <td className="py-4 px-4">
                                                            <div>
                                                                <div
                                                                    className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
                                                                    onClick={() => { setSelectedTask(task); setModalMode('edit'); setShowModal(true); }}
                                                                >
                                                                    <Home className="w-4 h-4 text-gray-400" />
                                                                    <span>{task.property_name || task.propertyName || 'Unknown Property'}</span>
                                                                </div>
                                                                <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">
                                                                    {task.title || "Litigation Case"}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.priority && (
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${priorityStyle.text}`}>{task.priority || "Medium"}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.status && (
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${statusStyle.text}`}>{task.status || "Pending"}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.assigned && (
                                                        <td className="py-4 px-4">
                                                            {(task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned || "").trim() === "" ? (
                                                                <span className="text-gray-400 text-sm">Unassigned</span>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                                                        {getInitials(task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned)}
                                                                    </div>
                                                                    <span className="text-gray-900 text-sm font-medium">{task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    {visibleColumns.date && (
                                                        <td className="py-4 px-4 whitespace-nowrap">
                                                            <span className="text-gray-900 font-medium text-sm">{formatDate(task.scheduled_date || task.date)}</span>
                                                        </td>
                                                    )}
                                                    {/* Custom Column Cells */}
                                                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                        <td key={col} className="py-4 px-4">
                                                            <span className="text-gray-900 font-medium text-sm">{task[col] || '-'}</span>
                                                        </td>
                                                    ))}
                                                    {visibleColumns.actions && (
                                                        <td className="py-4 px-4 text-center sticky right-0 z-10 bg-white" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => { setSelectedTask(task); setModalMode('view'); setShowModal(true); }}
                                                                    className="p-1.5 text-gray-600 rounded-xl transition-all"
                                                                    title="View"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                {hasUpdate && (
                                                                    <button
                                                                        onClick={() => { setSelectedTask(task); setModalMode('edit'); setShowModal(true); }}
                                                                        className="p-1.5 text-gray-600 rounded-xl transition-all"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {hasDelete && (
                                                                    <button
                                                                        onClick={() => handleDelete(task)}
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
                                                <td colSpan="9" className="py-8 text-center text-gray-500">No tasks found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Board/Kanban View */
                            <div className="overflow-x-auto -mx-6 px-6">
                                <div className="flex gap-4 min-w-max pb-4">
                                    {['pending', 'in court', 'closed'].map((status) => {
                                        const statusItems = filteredTasks.filter((task) => {
                                            return (task.status || 'pending').toLowerCase() === status.toLowerCase();
                                        });

                                        const getStatusStyle = (status) => {
                                            if (status === 'pending') {
                                                return {
                                                    bg: 'bg-orange-50',
                                                    border: 'border-orange-200',
                                                    header: 'bg-orange-100',
                                                    text: 'text-orange-700',
                                                    dot: 'bg-orange-500'
                                                };
                                            }
                                            if (status === 'in court') {
                                                return {
                                                    bg: 'bg-purple-50',
                                                    border: 'border-purple-200',
                                                    header: 'bg-purple-100',
                                                    text: 'text-purple-700',
                                                    dot: 'bg-purple-500'
                                                };
                                            }
                                            if (status === 'closed') {
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

                                                    <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                                                        {statusItems.length === 0 ? (
                                                            <div className="text-center py-8 px-4">
                                                                <Gavel className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                                <p className="text-gray-400 text-sm">No cases</p>
                                                            </div>
                                                        ) : (
                                                            statusItems.map((task) => {
                                                                const priorityColor = getPriorityColor(task.priority || "Medium");

                                                                const isDeleting = deletingIds.has(task.id);
                                                                return (
                                                                    <div
                                                                        key={task.id}
                                                                        className={`bg-white rounded-xl p-4 shadow-sm border border-gray-200 transition-all cursor-pointer ${isDeleting ? 'litigation-card-deleting' : ''}`}
                                                                        onClick={() => { setSelectedTask(task); setModalMode('view'); setShowModal(true); }}
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="text-xs font-mono text-gray-500">{task.reference}</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                                                                <span className={`text-xs font-medium ${priorityColor.text}`}>
                                                                                    {task.priority || "Medium"}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                                                            {task.case_title || task.title}
                                                                        </h4>

                                                                        {(task.case_description || task.description) && (
                                                                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                                                                {task.case_description || task.description}
                                                                            </p>
                                                                        )}

                                                                        {task.category && (
                                                                            <div className="mb-3">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-xl text-xs font-medium">
                                                                                    {task.category}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                {(task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned) ? (
                                                                                    <>
                                                                                        <div className={`w-6 h-6 rounded-full ${getAvatarColor(task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned)} flex items-center justify-center text-xs font-semibold`}>
                                                                                            {getInitials(task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned)}
                                                                                        </div>
                                                                                        <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                                                                            {task.assigned_to_name || task.assigned_to || task.assignedTo || task.lawyer_assigned}
                                                                                        </span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-xs text-gray-400">Unassigned</span>
                                                                                )}
                                                                            </div>

                                                                            <span className="text-xs text-gray-500">
                                                                                {formatDate(task.next_hearing_date)}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedTask(task); setModalMode('view'); setShowModal(true);
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
                                                                                        setSelectedTask(task); setModalMode('edit'); setShowModal(true);
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
                                                                                        handleDelete(task);
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


                {
                    showModal && (
                        <LitigationModal
                            api={api} hotels={hotels} hotelsLoading={hotelsLoading}
                            currentUser={currentUser}
                            onClose={() => setShowModal(false)}
                            onRequestEdit={() => setModalMode('edit')}
                            submitting={submitting} setSubmitting={setSubmitting}
                            error={error} setError={setError}
                            refreshTasks={refreshTasks}
                            initialData={selectedTask} mode={modalMode}
                            customColumns={customColumns}
                            customColumnMetadata={customColumnMetadata}
                        />
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
        </div>
    );
}


function LitigationModal({ api, hotels = [], hotelsLoading = false, onClose, onRequestEdit, submitting, setSubmitting, error, setError, refreshTasks = () => { }, initialData = null, mode = 'create', customColumns = [], customColumnMetadata = {}, currentUser }) {
    const isView = mode === 'view';
    const isEdit = mode === 'edit';
    const [form, setForm] = useState({ title: '', description: '', property: '', propertyName: '', category: '', priority: 'medium', reportedBy: currentUser?.name || '', assignedTo: '', assignedToId: '', serviceUserId: '', scheduledDate: '', status: 'Pending' });
    const [serviceUsers, setServiceUsers] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const staffCacheRef = useRef({});
    const staffAbortRef = useRef(null);

    const CATEGORY_STORAGE_KEY = 'litigation.customCategories';
    const [customCategories, setCustomCategories] = useState([]);
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

    // Initialize custom columns in form
    useEffect(() => {
        if (customColumns.length > 0) {
            setForm(prev => {
                const newForm = { ...prev };
                customColumns.forEach(col => {
                    if (!(col in newForm)) {
                        newForm[col] = '';
                    }
                });
                return newForm;
            });
        }
    }, [customColumns.join(',')]);

    useEffect(() => {
        if (initialData) {
            const baseData = {
                ...form,
                title: initialData.title ?? form.title,
                description: initialData.description ?? form.description,
                property: initialData.property_id ?? initialData.property ?? form.property,
                propertyName: initialData.property_name ?? form.property_name ?? form.propertyName,
                category: initialData.category ?? form.category,
                priority: (initialData.priority ?? form.priority) || 'medium',
                reportedBy: initialData.reported_by ?? form.reportedBy,
                assignedTo: initialData.assigned_to_name ?? form.assignedTo,
                serviceUserId: initialData.service_user_id ?? form.serviceUserId,
                scheduledDate: initialData.scheduled_date ? String(initialData.scheduled_date).slice(0, 10) : form.scheduledDate,
                status: initialData.status ?? form.status
            };
            // Add custom column values
            customColumns.forEach(col => {
                baseData[col] = initialData[col] ?? '';
            });
            setForm(baseData);
            if (initialData.property_id) {
                fetchServiceUsers(initialData.property_id);
                fetchStaffForHotel(initialData.property_id);
            }
        }
    }, [initialData, customColumns.join(',')]);

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
            setForm((p) => ({ ...p, category: '' }));
            return;
        }
        setShowCustomCategoryInput(false);
        setCustomCategoryValue('');
        setForm((p) => ({ ...p, category: value }));
    };

    const saveCustomCategory = () => {
        const next = String(customCategoryValue || '').trim();
        if (!next) return;

        const builtins = CATEGORY_OPTIONS;
        const builtinLower = new Set((builtins || []).map((t) => String(t).toLowerCase()));
        const merged = [...customCategories];
        if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
            merged.push(next);
            setCustomCategories(merged);
            persistCustomCategories(merged);
        }

        setForm((p) => ({ ...p, category: next }));
        setShowCustomCategoryInput(false);
        setCustomCategoryValue('');
    };

    async function fetchServiceUsers(hotelId) {
        if (!hotelId) { setServiceUsers([]); return; }
        try {
            const canonical = `/api/hotels/${hotelId}/service-users`;
            const r = await api.get(canonical).catch(() => ({ data: [] }));
            const rows = r?.data?.data ?? r?.data ?? [];
            const normalized = (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ''}` })).filter(Boolean);
            setServiceUsers(normalized);
        } catch (err) { setServiceUsers([]); }
    }

    async function fetchStaffForHotel(hotelId) {
        if (!hotelId) {
            setStaffUsers([]);
            return;
        }

        const cacheKey = String(hotelId);
        const cached = staffCacheRef.current?.[cacheKey];
        if (Array.isArray(cached)) {
            setStaffUsers(cached);
            return;
        }

        if (staffAbortRef.current) {
            try { staffAbortRef.current.abort(); } catch { }
        }
        const controller = new AbortController();
        staffAbortRef.current = controller;

        try {
            setStaffLoading(true);
            const paths = [
                `/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
                `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
            ];

            const requests = paths.map((p) =>
                api.get(p, { signal: controller.signal }).then((r) => r?.data)
            );
            const settled = await Promise.allSettled(requests);
            const firstOk = settled.find((s) => s.status === 'fulfilled' && s.value);
            const data = firstOk && firstOk.status === 'fulfilled' ? firstOk.value : null;

            if (!data) {
                const firstErr = settled.find((s) => s.status === 'rejected');
                throw (firstErr && firstErr.status === 'rejected' ? firstErr.reason : null) || new Error('Unable to load staff');
            }

            const list = data?.staff ?? data?.users ?? data ?? [];
            const normalized = (Array.isArray(list) ? list : [])
                .map((u) => ({
                    id: u.id,
                    name: u.name || u.email || `User ${u.id}`,
                    email: u.email || null,
                }))
                .filter((u) => u.id && u.name);
            setStaffUsers(normalized);

            staffCacheRef.current = { ...staffCacheRef.current, [cacheKey]: normalized };
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
            console.error('fetchStaffForHotel error:', err);
            setStaffUsers([]);
        } finally {
            if (staffAbortRef.current === controller) {
                setStaffLoading(false);
            }
        }
    }

    function handlePropertyChange(e) {
        const hotelId = e.target.value;
        const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
        setForm((p) => ({
            ...p,
            property: hotelId,
            propertyName: hotel ? hotel.name : '',
            reportedBy: currentUser?.name || '',
            assignedTo: '',
            assignedToId: '',
            serviceUserId: '',
        }));
        setServiceUsers([]);
        setStaffUsers([]);
        if (hotelId) {
            fetchServiceUsers(hotelId);
            fetchStaffForHotel(hotelId);
        }
    }

    function handleServiceUserChange(e) {
        const suId = e.target.value;
        const su = serviceUsers.find((s) => String(s.id) === String(suId)) || null;
        setForm((p) => ({ ...p, assignedTo: su ? `${su.first_name}` : '', assignedToId: su ? String(su.id) : '', serviceUserId: su ? String(su.id) : '' }));
    }

    const submit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true); setError(null);
        try {
            const missing = [];
            if (!String(form.title || '').trim()) missing.push('Title');
            if (!String(form.description || '').trim()) missing.push('Description');
            if (!form.property) missing.push('Property');
            if (!form.category) missing.push('Category');
            if (!form.priority) missing.push('Priority');
            if (!String(form.reportedBy || '').trim()) missing.push('Reported By');
            if (!form.assignedTo) missing.push('Assigned To');
            if (!form.scheduledDate) missing.push('Date');
            if (!form.status) missing.push('Status');

            for (const col of customColumns || []) {
                const meta = customColumnMetadata[col] || {};
                const inputType = meta.input_type || 'text';
                const v = form[col];
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

            const payload = {
                title: form.title,
                description: form.description || null,
                priority: form.priority || 'medium',
                assigned_to_name: form.assignedTo || null,
                service_user_id: form.serviceUserId || null,
                property_id: form.property || null,
                property_name: form.propertyName || null,
                scheduled_date: form.scheduledDate || null,
                category: form.category || null,
                reported_by: form.reportedBy || null,
                status: form.status
            };
            // Include custom columns
            customColumns.forEach(col => {
                if (form[col] !== undefined) {
                    const meta = customColumnMetadata[col] || {};
                    const inputType = meta.input_type || 'text';
                    if (inputType === 'checkbox') {
                        if (form[col] === true || String(form[col]).toLowerCase() === 'true' || String(form[col]) === 'true') payload[col] = true;
                        else if (form[col] === false || String(form[col]).toLowerCase() === 'false' || String(form[col]) === 'false') payload[col] = false;
                        else payload[col] = null;
                    } else {
                        payload[col] = form[col];
                    }
                }
            });
            if (isEdit && initialData && initialData.id) {
                await api.patch(`/api/litigation/${initialData.id}`, payload);
            } else {
                await api.post('/api/litigation', payload);
            }
            await refreshTasks();
            setSubmitting(false);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to create task');
            setSubmitting(false);
        }
    };

    const CATEGORY_OPTIONS = ['Plumbing', 'Electrical', 'HVAC', 'Structural', 'Appliances', 'Doors & Windows', 'Flooring', 'Roofing', 'Pest Control', 'Other'];

    // --- VIEW MODE UI ---
    if (isView) {
        return (
            <div className="modal-overlay">
                <div className="modal-container h-[70vh]">
                    <div className="modal-header">
                        <div>
                            <h2 className="modal-title">Case Details</h2>
                            <p className="modal-subtitle">View litigation case information</p>
                        </div>
                        <button onClick={onClose} className="rounded-xl modal-close-btn">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="modal-content">
                        <div className="form-grid-2">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label>
                                <p className="text-gray-900 font-medium">{form.title || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {form.status || 'N/A'}
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Property</label>
                                <p className="text-gray-900">{form.propertyName || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                                <p className="text-gray-900">{form.category || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Scheduled Date</label>
                                <p className="text-gray-900">{form.scheduledDate ? new Date(form.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Priority</label>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {form.priority || 'N/A'}
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reported By</label>
                                <p className="text-gray-900">{form.reportedBy || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Assigned To</label>
                                <p className="text-gray-900">{form.assignedTo || 'N/A'}</p>
                            </div>

                            {(customColumns || []).map((col) => {
                                const meta = customColumnMetadata?.[col] || {};
                                const label = String(meta.label || col)
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, (m) => m.toUpperCase());
                                const rawVal = form?.[col];
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
                            <p className="text-gray-700">{form.description || 'No description provided.'}</p>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            onClick={onClose}
                            className="rounded-xl btn-secondary"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof onRequestEdit === 'function') {
                                    onRequestEdit();
                                }
                            }}
                            className="btn-primary rounded-xl"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- EDIT/CREATE FORM UI ---
    return (
        <div className="modal-overlay">
            <div className="modal-container h-[70vh]">
                {/* Modal Header */}
                <div className="modal-header">
                    <h3 className="modal-title">
                        {isEdit ? "Edit Case" : "New Case"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-xl modal-close-btn"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Form Content */}
                <form id="lit-form" onSubmit={submit} className="modal-content form-section">
                    <div className="form-grid-2">
                        {error && (
                            <div className="col-span-1 md:col-span-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Row 1: Title (Full Width) */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="form-label">Title <span className="text-red-500">*</span></label>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="form-input rounded-xl"
                            />
                        </div>

                        {/* Row 2: Description (Full Width) */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="form-label">Description <span className="text-red-500">*</span></label>
                            <textarea
                                required
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="form-input resize-y rounded-xl"
                            />
                        </div>

                        {/* Row 3: Property & Category */}
                        <div className="col-span-1">
                            <label className="form-label">Property <span className="text-red-500">*</span></label>
                            <select
                                required
                                value={form.property}
                                onChange={handlePropertyChange}
                                className="rounded-xl form-select"
                            >
                                <option value="">Select property</option>
                                {hotelsLoading ? <option>Loading...</option> : hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="form-label">Category <span className="text-red-500">*</span></label>
                            <select
                                required
                                value={form.category}
                                onChange={handleCategoryChange}
                                className="rounded-xl form-select"
                            >
                                <option value="">Select category</option>
                                {[...CATEGORY_OPTIONS, ...customCategories].map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                                {!!form.category && ![...CATEGORY_OPTIONS, ...customCategories].some((c) => String(c) === String(form.category)) && (
                                    <option value={form.category}>{form.category}</option>
                                )}
                                <option value="__add_new__">+ Add new...</option>
                            </select>
                            {showCustomCategoryInput && (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={customCategoryValue}
                                        onChange={(e) => setCustomCategoryValue(e.target.value)}
                                        placeholder="Enter new category"
                                        className="form-input rounded-xl"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveCustomCategory}
                                        className="px-3 py-1.5 bg-teal-500 text-white rounded-xl text-sm font-medium"
                                    >
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCustomCategoryInput(false);
                                            setCustomCategoryValue('');
                                        }}
                                        className="px-3 py-1.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Row 4: Priority & Assigned To */}
                        <div className="col-span-1">
                            <label className="form-label">Priority <span className="text-red-500">*</span></label>
                            <select
                                required
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                className="form-select rounded-xl"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="form-label">Assigned To <span className="text-red-500">*</span></label>
                            {form.property ? (
                                <select
                                    value={form.assignedTo || ''}
                                    onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value, assignedToId: '' }))}
                                    disabled={!form.property || staffLoading}
                                    className="form-select disabled:bg-gray-100 disabled:cursor-not-allowed rounded-xl"
                                    required
                                >
                                    <option value="">
                                        {!form.property
                                            ? "Select property first"
                                            : staffLoading
                                                ? "Loading staff..."
                                                : "Select staff"}
                                    </option>
                                    {!!form.assignedTo && !staffUsers.some((u) => String(u.name) === String(form.assignedTo)) && (
                                        <option value={form.assignedTo}>{form.assignedTo}</option>
                                    )}
                                    {staffUsers.map((u) => (
                                        <option key={u.id} value={u.name}>{u.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={form.assignedTo}
                                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                                    disabled={!form.property}
                                    placeholder={!form.property ? "Select property first" : "Name"}
                                    className="form-input disabled:bg-gray-100 disabled:cursor-not-allowed rounded-xl"
                                    required
                                />
                            )}
                        </div>
                        {/* Row 5: Reported By & Date */}
                        <div className="col-span-1">
                            <label className="form-label">Reported By <span className="text-red-500">*</span></label>
                            <input
                                value={form.reportedBy}
                                readOnly
                                required
                                className="rounded-xl form-input bg-gray-100 cursor-not-allowed"
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="form-label">Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={form.scheduledDate}
                                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                                className="form-input rounded-xl"
                                required
                            />
                        </div>

                        {/* Custom Columns from Forms Builder */}
                        {customColumns.map(col => {
                            const meta = customColumnMetadata[col] || {};
                            const inputType = meta.input_type || 'text';
                            const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                            return (
                                <div key={col} className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} <span className="text-red-500">*</span>
                                    </label>
                                    {inputType === 'checkbox' ? (
                                        <select
                                            required
                                            value={form[col] === true ? 'true' : form[col] === false ? 'false' : (form[col] || '')}
                                            onChange={e => setForm({ ...form, [col]: e.target.value })}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                                        >
                                            <option value="">Select...</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    ) : inputType === 'dropdown' || inputType === 'select' ? (
                                        <select
                                            required
                                            value={form[col] || ''}
                                            onChange={e => setForm({ ...form, [col]: e.target.value })}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
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
                                            value={form[col] || ''}
                                            onChange={e => setForm({ ...form, [col]: e.target.value })}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                                        />
                                    ) : inputType === 'date' ? (
                                        <input
                                            type="date"
                                            required
                                            value={form[col] ? formatDateISO(form[col]) : ''}
                                            onChange={e => setForm({ ...form, [col]: e.target.value })}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                                        />
                                    ) : (
                                        <input
                                            type={inputType}
                                            required
                                            value={form[col] || ''}
                                            onChange={e => setForm({ ...form, [col]: e.target.value })}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                                            placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </form>

                {/* Footer Buttons */}
                <div className="modal-footer">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="lit-form"
                        disabled={submitting}
                        className="rounded-xl btn-primary"
                    >
                        {submitting ? 'Saving...' : 'Save Record'}
                    </button>
                </div>
            </div>
        </div>
    );
}