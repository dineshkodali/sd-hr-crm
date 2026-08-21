/* src/pages/EmergencyProtocols.jsx */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
import { ConfirmDialog, AlertDialog } from "../components/ConfirmDialog";
import { generatePDF } from '../utils/pdfGenerator';
import { generateCSV } from '../utils/csvGenerator';
import { DownloadDropdown } from '../components/DownloadDropdown';
import Breadcrumbs from "../components/Breadcrumbs";
import {
import ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';
    Home,
    Building2,
    AlertCircle,
    Clock,
    CheckCircle,
    Search,
    ChevronDown,
    Filter,
    Columns,
    Download,
    Edit,
    Trash2,
    X,
    Eye,
    EyeOff,
    Wrench
} from "lucide-react";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'emergency-protocols-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes emergencyProtocolSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      @keyframes emergencyProtocolCardDelete {
        0%   { opacity: 1; transform: scale(1) rotate(0deg); }
        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
      }
      tr.emergency-protocol-deleting {
        animation: emergencyProtocolSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
      .emergency-protocol-card-deleting {
        animation: emergencyProtocolCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

/* --- CONFIGURATION --- */
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    timeout: 15000,
});

const emergencyProtocolsColumnsCache = {
    ts: 0,
    columns: null,
};

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

/* --- UTILS --- */
function normalizeHotelsResponse(data) {
    if (!data) return [];
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data.rows)) items = data.rows;
    else if (Array.isArray(data.hotels)) items = data.hotels;

    return items.map((h) => ({
        id: h?.id ?? h?.hotel_id ?? null,
        name: h?.name ?? h?.title ?? h?.hotel_name ?? "Unknown Property",
    })).filter((x) => x.id);
}

const SAMPLE = [
    { id: 1, title: "Passport & VISA Verification", reference: "EMP-2025-e519", description: "Operation work required as per inspection.", priority: "Medium", status: "Completed", assignedTo: "ABC Maintenance", date: "2025-02-08", type: "Emergency Protocols" },
    { id: 2, title: "Resident Data Update", reference: "EMP-2025-c516", description: "Update resident database.", priority: "Medium", status: "Pending", assignedTo: "Unassigned", date: "2025-09-26", type: "Emergency Protocols" },
];

function formatDate(value) {
    if (!value) return "-";
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return value; }
}

function formatDateISO(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().slice(0, 10);
    } catch { return ""; }
}

function getInitials(name) {
    if (!name || name === "Unassigned") return "UA";
    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

// STYLING HELPERS MATCHING REFERENCE
function getPriorityColor(p) {
    const low = String(p).toLowerCase();
    if (low === "urgent" || low === "high") return { dot: "bg-red-500", text: "text-red-700" };
    if (low === "medium") return { dot: "bg-orange-500", text: "text-orange-700" };
    return { dot: "bg-green-500", text: "text-green-700" };
}

function getStatusColor(s) {
    const low = String(s).toLowerCase();
    if (low === "completed") return { dot: "bg-green-500", text: "text-green-700" };
    if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
    if (low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
    return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
    // Using reference teal style
    return "bg-teal-100 text-teal-700";
}

/* Helper for View Details */
const DetailField = ({ label, value }) => (
    <div>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
        <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
    </div>
);

/* --- MAIN COMPONENT --- */
export default function EmergencyProtocols() {
    // Custom columns state (AIRETasks pattern)
    // Image gallery hook — opens in-page modal instead of new tab
    const { galleryOpen: _galleryOpen, galleryItems: _galleryItems, galleryTitle: _galleryTitle, galleryApi: _galleryApi, openGallery: _openGallery, closeGallery: _closeGallery } = useImageGallery();

    const [customColumns, setCustomColumns] = useState([]);
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});
    const [availableColumns, setAvailableColumns] = useState(DEFAULT_COLUMNS);

    // Track rows/cards currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());

    // Poll columns from backend and update visibility state
    const fetchAvailableColumns = useCallback(async () => {
        try {
            const now = Date.now();
            if (emergencyProtocolsColumnsCache.columns && now - emergencyProtocolsColumnsCache.ts < 60_000) {
                const cached = emergencyProtocolsColumnsCache.columns;
                const columns = cached?.columns || cached || [];

                const systemColumns = [
                    'id', 'reference', 'type', 'title', 'description', 'property_id', 'property_name', 'category',
                    'priority', 'reported_by', 'assigned_to_id', 'assigned_to_name', 'scheduled_date', 'due_date',
                    'status', 'created_by_id', 'created_at', 'updated_at', 'deleted', 'completed_date', 'notes'
                ];
                const columnNames = (Array.isArray(columns) ? columns : []).map(col => typeof col === 'string' ? col : (col.column_name || col.name || String(col)));
                const customCols = columnNames.filter(col => !systemColumns.includes(col) && !DEFAULT_COLUMNS.includes(col));
                const newColumns = [...DEFAULT_COLUMNS.slice(0, -1), ...customCols, DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]];

                setCustomColumns(prev => {
                    if (JSON.stringify(customCols) !== JSON.stringify(prev)) {
                        setAvailableColumns(newColumns);
                        return customCols;
                    }
                    return prev;
                });
                return;
            }

            const res = await api.get('/api/emergency-protocols/columns', { timeout: 60000 });
            const columns = res?.data?.columns || res?.data || [];

            emergencyProtocolsColumnsCache.ts = now;
            emergencyProtocolsColumnsCache.columns = columns;
            const systemColumns = [
                'id', 'reference', 'type', 'title', 'description', 'property_id', 'property_name', 'category',
                'priority', 'reported_by', 'assigned_to_id', 'assigned_to_name', 'scheduled_date', 'due_date',
                'status', 'created_by_id', 'created_at', 'updated_at', 'deleted', 'completed_date', 'notes'
            ];
            const columnNames = columns.map(col => typeof col === 'string' ? col : (col.column_name || col.name || String(col)));
            const customCols = columnNames.filter(col => !systemColumns.includes(col) && !DEFAULT_COLUMNS.includes(col));

            // Logic to insert custom columns right before the last column ("actions")
            const newColumns = [...DEFAULT_COLUMNS.slice(0, -1), ...customCols, DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]];

            if (JSON.stringify(customCols) !== JSON.stringify(customColumns)) {
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

                setCustomColumns(customCols);
                setAvailableColumns(newColumns);
                setVisibleColumns(prev => {
                    const updated = { ...prev };
                    customCols.forEach(col => {
                        if (!(col in updated)) {
                            try {
                                const saved = localStorage.getItem('emergencyProtocolsVisibleColumns');
                                if (saved) {
                                    const parsed = JSON.parse(saved);
                                    updated[col] = parsed[col] ?? false;
                                } else {
                                    updated[col] = false;
                                }
                            } catch (e) {
                                updated[col] = false;
                            }
                        }
                    });
                    return updated;
                });
            }
        } catch (err) {
            console.warn('Failed to fetch columns:', err);
        }
    }, [api, customColumns]);

    useEffect(() => {
        fetchAvailableColumns();
        return () => { };
    }, [fetchAvailableColumns]);

    // Get current user from props or localStorage
    const currentUser = (() => {
        try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    // Get permissions
    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
    const hasRead = canRead("emergency_protocols");
    const hasCreate = canCreate("emergency_protocols");
    const hasUpdate = canUpdate("emergency_protocols");
    const hasDelete = canDelete("emergency_protocols");

    const [query, setQuery] = useState("");
    const [tasks, setTasks] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filter and Sort State
    const [priorityFilter, setPriorityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [propertyFilter, setPropertyFilter] = useState("");
    const [sortBy, setSortBy] = useState("");

    const [hotels, setHotels] = useState([]);
    const [hotelsLoading, setHotelsLoading] = useState(false);
    const [staffMembers, setStaffMembers] = useState([]);

    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    const [showEdit, setShowEdit] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editing, setEditing] = useState(false);

    // View modal state
    const [showView, setShowView] = useState(false);
    const [viewing, setViewing] = useState(null);

    // --- View Button / Column Visibility State ---
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
    const [viewMode, setViewMode] = useState('table');
    const viewRef = useRef(null);

    // ALL_COLUMNS is now derived from availableColumns
    const ALL_COLUMNS = availableColumns;

    // Column visibility state - default columns visible, custom columns from localStorage or hidden
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('emergencyProtocolsVisibleColumns');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
            }
        } catch { }
        return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
    });

    // Persist visibleColumns to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('emergencyProtocolsVisibleColumns', JSON.stringify(visibleColumns));
        } catch { }
    }, [visibleColumns]);

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

    // Form State (AIRETasks pattern: always include custom columns)
    const initialForm = useMemo(() => ({
        title: "",
        description: "",
        property_id: "",
        property_name: "",
        category: "Emergency Protocols",
        priority: "Medium",
        status: "Pending",
        reported_by: currentUser?.name || '',
        assigned_to_name: "",
        scheduled_date: "",
        reference: "",
        ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
    }), [customColumns]);

    const [form, setForm] = useState(initialForm);

    const [photos, setPhotos] = useState([]);

    const CATEGORY_OPTIONS = ["Emergency Protocols", "Maintenance"];
    const CATEGORY_STORAGE_KEY = 'emergencyProtocols.customCategories';
    const [customCategories, setCustomCategories] = useState([]);
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

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

        const builtinLower = new Set((CATEGORY_OPTIONS || []).map((t) => String(t).toLowerCase()));
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

    // When customColumns change, add new fields to form state
    useEffect(() => {
        setForm(prev => {
            const newForm = { ...prev };
            customColumns.forEach(col => {
                if (!(col in newForm)) newForm[col] = '';
            });
            return newForm;
        });
    }, [customColumns]);

    // Modal states
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

    const showConfirm = (title, message, onConfirm, type = 'warning') => {
        setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
    };

    // Reset form
    useEffect(() => {
        if (!showCreate && !showEdit) {
            setForm(initialForm);
            setCreating(false);
            setEditing(false);
            setEditingId(null);
            setPhotos([]);
        }
    }, [showCreate, showEdit, initialForm]);

    // Hide sidebar and navbar when modal is open
    useEffect(() => {
        const isModalOpen = showCreate || showEdit || showView || confirmDialog.isOpen || alertDialog.isOpen;
        if (isModalOpen) {
            document.body.classList.add('form-modal-open');
        } else {
            document.body.classList.remove('form-modal-open');
        }
        return () => {
            document.body.classList.remove('form-modal-open');
        };
    }, [showCreate, showEdit, showView, confirmDialog.isOpen, alertDialog.isOpen]);

    /* --- API CALLS --- */
    const fetchHotels = useCallback(async () => {
        try {
            setHotelsLoading(true);
            const res = await api.get("/api/hotels?limit=1000");
            setHotels(normalizeHotelsResponse(res?.data ?? {}));
        } catch (err) {
            console.error("fetchHotels error:", err);
        } finally {
            setHotelsLoading(false);
        }
    }, []);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/emergency-protocols?limit=200");
            const data = res?.data?.data ?? res?.data ?? [];
            const list = Array.isArray(data) ? data : [];

            const formatted = list.map((t) => ({
                id: t.id,
                title: t.title ?? "Untitled",
                reference: t.reference ?? `EMP-${t.id}`,
                description: t.description || "No description provided.",
                priority: t.priority || "Medium",
                status: t.status || "Pending",
                assignedTo: t.assigned_to_name || t.assigned_to || "Unassigned",
                date: t.due_date || t.scheduled_date || t.created_at,
                type: t.type || "Emergency Protocols",
                raw: t,
            }));
            setTasks(formatted);
        } catch (err) {
            console.error("loadTasks error:", err);
            setTasks(SAMPLE);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHotels();
        loadTasks();
    }, [fetchHotels, loadTasks]);

    /* --- HANDLERS --- */
    const filtered = useMemo(() => {
        const q = (query || "").toLowerCase();
        let list = tasks || [];

        // Apply search filter
        if (q) {
            list = list.filter((r) =>
                r.title.toLowerCase().includes(q) ||
                r.reference.toLowerCase().includes(q) ||
                String(r.assignedTo).toLowerCase().includes(q)
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
                String(r.raw?.property_id || "") === String(propertyFilter)
            );
        }

        // Apply sorting
        if (sortBy) {
            list = [...list].sort((a, b) => {
                if (sortBy === 'date') {
                    const dateA = new Date(a.date || 0);
                    const dateB = new Date(b.date || 0);
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
                if (sortBy === 'title') {
                    const titleA = (a.title || '').toLowerCase();
                    const titleB = (b.title || '').toLowerCase();
                    return titleA.localeCompare(titleB);
                }
                return 0;
            });
        }

        return list;
    }, [tasks, query, priorityFilter, statusFilter, propertyFilter, sortBy]);

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    // Define BASE_EXPORT_COLUMNS and exportColumns
    const BASE_EXPORT_COLUMNS = useMemo(
        () => [
            { header: 'Reference', key: 'reference' },
            { header: 'Title', key: 'title' },
            { header: 'Priority', key: 'priority' },
            { header: 'Status', key: 'status' },
            { header: 'Assigned To', key: 'assignedTo' },
            { header: 'Date', key: 'date' },
            { header: 'Property', key: 'property' }
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

    // Initialize selectedExportKeys when exportColumns changes
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

    // Normalize protocol for export
    const normalizeProtocolExportRow = (task) => {
        const base = {
            reference: task.reference || 'N/A',
            title: task.title || 'N/A',
            priority: task.priority || 'N/A',
            status: task.status || 'N/A',
            assignedTo: task.assignedTo || 'N/A',
            date: task.date ? new Date(task.date).toLocaleDateString() : 'N/A',
            property: task.property || 'N/A'
        };

        for (const col of customColumns || []) {
            base[col] = task?.raw?.[col] ?? '';
        }

        return base;
    };

    // Export modal handlers
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
        const columnsToExport = exportColumns.filter((c) => selectedExportKeys.includes(c.key));
        const data = filtered.map(normalizeProtocolExportRow).map((row) => {
            const filteredRow = {};
            columnsToExport.forEach((col) => {
                filteredRow[col.key] = row[col.key];
            });
            return filteredRow;
        });

        if (exportFormat === 'pdf') {
            generatePDF(data, columnsToExport, 'Emergency Protocols', 'emergency-protocols');
        } else if (exportFormat === 'csv') {
            generateCSV(data, columnsToExport, 'emergency-protocols');
        }

        closeExport();
    };

    const stats = useMemo(() => {
        const list = tasks || [];
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 86400000);

        return {
            total: list.length,
            overdue: list.filter(t => t.status !== "Completed" && t.date && new Date(t.date) < now).length,
            dueThisWeek: list.filter(t => t.status !== "Completed" && t.date && new Date(t.date) <= nextWeek && new Date(t.date) >= now).length,
            completed: list.filter(t => t.status?.toLowerCase() === "completed").length,
        };
    }, [tasks]);

    async function handleRemoveEmergencyAttachment(attachmentId) {
        if (!attachmentId) return;
        try {
            await api.delete(`/api/emergency-protocols/attachments/${encodeURIComponent(String(attachmentId))}`).catch(() => null);
            setForm((p) => {
                let atts = p?.attachments ?? [];
                try {
                    if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                } catch {
                    atts = [];
                }
                const next = (Array.isArray(atts) ? atts : []).filter((x) => String(x) !== String(attachmentId));
                return { ...p, attachments: next };
            });
        } catch (err) {
            console.warn('Failed to remove attachment', err);
        }
    }

        function openAttachmentsGallery(attachments) {
        let atts = attachments || [];
        try { if (typeof atts === 'string' && atts) atts = JSON.parse(atts); } catch { atts = []; }
        const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
        if (!list.length) return;
        _openGallery(list, "Emergency Protocol Documents", "/api/emergency-protocols/attachments");
    }


    async function handleSubmit(e) {
        e.preventDefault();
        const isEdit = !!editingId;
        isEdit ? setEditing(true) : setCreating(true);

        const cleanVal = (val) => (val === "" || val === undefined ? null : val);

        const missing = [];
        if (!String(form.title || '').trim()) missing.push('Title');
        if (!String(form.description || '').trim()) missing.push('Description');
        if (!String(form.property_id || '').trim()) missing.push('Property');
        if (!String(form.property_name || '').trim()) missing.push('Property Name');
        if (!String(form.category || '').trim()) missing.push('Category');
        if (!String(form.priority || '').trim()) missing.push('Priority');
        if (!String(form.reported_by || '').trim()) missing.push('Reported By');
        if (!String(form.assigned_to_name || '').trim()) missing.push('Assigned To');
        if (!String(form.scheduled_date || '').trim()) missing.push('Scheduled Date');

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
            showAlert("Required fields missing", `Please fill required fields: ${missing.join(', ')}.`, "warning");
            setCreating(false);
            setEditing(false);
            return;
        }

        const payload = {
            title: form.title,
            description: form.description,
            property_id: form.property_id || null,
            property_name: form.property_name || null,
            category: form.category || "Emergency Protocols",
            priority: form.priority || "Medium",
            status: form.status || "Pending",
            reported_by: form.reported_by || null,
            assigned_to: form.assigned_to_name || null,
            assigned_to_name: form.assigned_to_name || null,
            scheduled_date: cleanVal(form.scheduled_date),
            due_date: cleanVal(form.scheduled_date),
            ...Object.fromEntries(customColumns.map(col => {
                const meta = customColumnMetadata[col] || {};
                const inputType = meta.input_type || 'text';
                if (inputType === 'checkbox') {
                    return [col, form[col] === 'true' ? true : form[col] === 'false' ? false : null];
                }
                return [col, cleanVal(form[col])];
            }))
        };
        delete payload.attachments;

        try {
            const multipart = new FormData();
            Object.entries(payload || {}).forEach(([k, v]) => {
                if (v === undefined) return;
                if (k === 'attachments') return;
                if (v === null) multipart.append(k, '');
                else multipart.append(k, String(v));
            });
            (photos || []).forEach((f) => multipart.append('photos', f));

            if (isEdit) {
                await api.put(`/api/emergency-protocols/${editingId}`, multipart, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                await api.post("/api/emergency-protocols", multipart, { headers: { 'Content-Type': 'multipart/form-data' } });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            await loadTasks();

            setShowCreate(false);
            setShowEdit(false);
            setPhotos([]);
        } catch (err) {
            console.error("Submit error:", err);
            showAlert("Error", `Failed to ${isEdit ? 'update' : 'create'} task: ${err.response?.data?.error || err.message}`, "error");
        } finally {
            setCreating(false);
            setEditing(false);
        }
    }

    async function handleDelete(id) {
        showConfirm(
            "Delete Task",
            "Are you sure you want to delete this task? This action cannot be undone.",
            () => handleDeleteConfirmed(id),
            "danger"
        );
    }

    async function handleDeleteConfirmed(id) {
        try {
            setDeletingIds(prev => new Set(prev).add(id));

            const ANIM_DURATION = 460;
            setTimeout(() => {
                setTasks(prev => (Array.isArray(prev) ? prev.filter(t => String(t.id) !== String(id)) : prev));
                setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }, ANIM_DURATION);

            await api.delete(`/api/emergency-protocols/${id}`).catch(() => null);
            await loadTasks();
        } catch (err) {
            console.error("Delete error:", err);
            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            showAlert("Error", "Failed to delete task: " + (err.response?.data?.error || err.message), "error");
        }
    }

    function openEdit(task) {
        setEditingId(task.id);
        const raw = task.raw || {};
        let attachments = raw?.attachments ?? [];
        try {
            if (typeof attachments === 'string' && attachments) attachments = JSON.parse(attachments);
        } catch {
            attachments = [];
        }
        setForm({
            title: task.title,
            description: raw.description || task.description,
            property_id: raw.property_id || "",
            property_name: raw.property_name || "",
            category: raw.category || task.type,
            priority: raw.priority || task.priority,
            status: raw.status || task.status,
            reported_by: raw.reported_by || "",
            assigned_to_name: task.assignedTo === "Unassigned" ? "" : task.assignedTo,
            scheduled_date: formatDateISO(task.date),
            reference: task.reference,
            attachments: Array.isArray(attachments) ? attachments : [],
            ...customColumns.reduce((acc, col) => ({ ...acc, [col]: raw[col] || '' }), {})
        });

        setPhotos([]);

        // Fetch staff members if property is already set
        if (raw.property_id) {
            (async () => {
                try {
                    const response = await api.get(`/api/staff/for-hotel/${raw.property_id}`);
                    const staff = response?.data?.staff || [];
                    setStaffMembers(staff);
                } catch (err) {
                    console.warn('Failed to fetch staff for property:', err);
                    setStaffMembers([]);
                }
            })();
        } else {
            setStaffMembers([]);
        }

        setShowEdit(true);
    }

    function handleView(task) {
        setViewing(task);
        setShowView(true);
    }

    async function handleHotelChange(e) {
        const val = e.target.value;
        const h = hotels.find(x => String(x.id) === String(val));
        setForm(p => ({ ...p, property_id: val, property_name: h ? h.name : "", assigned_to_name: "", reported_by: currentUser?.name || '' }));

        // Fetch staff members for the selected property
        if (val) {
            try {
                const response = await api.get(`/api/staff/for-hotel/${val}`);
                const staff = response?.data?.staff || [];
                setStaffMembers(staff);
            } catch (err) {
                console.warn('Failed to fetch staff for property:', err);
                setStaffMembers([]);
            }
        } else {
            setStaffMembers([]);
        }
    }

    /* --- RENDER --- */
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">

                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Breadcrumbs items={[{ label: 'Escalations' }, { label: 'Emergency Protocols', path: '/admin/emergency-protocols' }]} />
                        <h1 className="text-3xl font-black text-slate-900 mt-1">Emergency Protocols Dashboard</h1>
                    </div>
                    {hasCreate && (
                        <div className="flex items-center gap-3">
                            <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
                        </div>
                    )}
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all">
                        <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
                            <Building2 className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Work Orders</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.total}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all">
                        <div className="bg-rose-100 text-rose-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
                            <AlertCircle className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Overdue</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.overdue}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all">
                        <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Due This Week</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.dueThisWeek}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all">
                        <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
                            <CheckCircle className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Completed</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.completed}</div>
                        </div>
                    </div>
                </div>

                {/* Export Column Selection Modal */}
                {showExportModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Select columns you want to include</div>
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

                {/* Main Content Area - Emergency Protocols Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

                    {/* Table Header Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Work Orders</h2>
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
                                        placeholder="Search work orders..."
                                        className="bg-white border-2 border-gray-200 rounded-xl !pl-14 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm "
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

                                    {/* View Settings Dropdown Panel */}
                                    {showViewMenu && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                                            <div className="p-4">
                                                <h3 className="text-sm font-semibold text-gray-900 mb-3">View settings</h3>

                                                {/* View Mode Selector */}
                                                <div className="mb-3 pb-3 border-b border-gray-200">
                                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Display Mode</div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setViewMode('table')}
                                                            className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1 ${viewMode === 'table'
                                                                ? 'bg-teal-500 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            <Columns className="w-4 h-4" />
                                                            <span>Table</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setViewMode('board')}
                                                            className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1 ${viewMode === 'board'
                                                                ? 'bg-teal-500 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            <Wrench className="w-4 h-4" />
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
                                                            <span>Property visibility</span>
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

                                {hasCreate && (
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="bg-teal-500 text-white font-medium rounded-xl py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md "
                                    >
                                        <span>+</span>
                                        <span>Create Work Order</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Row */}
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={priorityFilter}
                                    onChange={(e) => setPriorityFilter(e.target.value)}
                                    className="h-10 bg-white border border-gray-300 rounded-xl !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">All Priority</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="h-10 bg-white border border-gray-300 rounded-xl !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="in progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Home className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={propertyFilter}
                                    onChange={(e) => setPropertyFilter(e.target.value)}
                                    className="h-10 bg-white border border-gray-300 rounded-xl !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">All Properties</option>
                                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Columns className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="h-10 bg-white border border-gray-300 rounded-xl !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">Sort By</option>
                                    <option value="date">Date (Newest)</option>
                                    <option value="priority">Priority</option>
                                    <option value="status">Status</option>
                                    <option value="title">Title</option>
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
                                    className="h-10 bg-gray-100 text-gray-700 rounded-xl px-4 py-0 text-sm font-semibold transition-all flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    <span>Clear</span>
                                </button>
                            )}
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
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">TYPE</th>
                                        )}
                                        {visibleColumns.reference && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">REFERENCE</th>
                                        )}
                                        {visibleColumns.description && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DESCRIPTION</th>
                                        )}
                                        {visibleColumns.attachments && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ATTACHMENTS</th>
                                        )}
                                        {visibleColumns.priority && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">PRIORITY</th>
                                        )}

                                        {visibleColumns.status && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>
                                        )}
                                        {visibleColumns.assigned && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ASSIGNED TO</th>
                                        )}
                                        {visibleColumns.date && (
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DATE</th>
                                        )}
                                        {/* Custom columns in table header - POSITIONED BEFORE ACTIONS with STANDARD UI */}
                                        {customColumns.filter(col => visibleColumns[col]).map(col => (
                                            <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{col}</th>
                                        ))}
                                        {visibleColumns.actions && (
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 z-10 bg-[var(--bg-primary)]" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>ACTIONS</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                                        </tr>
                                    ) : filtered.length > 0 ? filtered.map((row) => {
                                        const priorityStyle = getPriorityColor(row.priority);
                                        const statusStyle = getStatusColor(row.status);
                                        const isDeleting = deletingIds.has(row.id);
                                        return (
                                            <tr key={row.id} className={`transition-colors ${isDeleting ? 'emergency-protocol-deleting' : ''}`}>
                                                {visibleColumns.checkbox && (
                                                    <td className="py-5 px-6">
                                                        <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                    </td>
                                                )}
                                                {visibleColumns.type && (
                                                    <td className="py-5 px-6">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 whitespace-nowrap">
                                                            {row.type}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.reference && (
                                                    <td className="py-5 px-6">
                                                        <span className="text-slate-900 font-semibold text-sm whitespace-nowrap">{row.reference}</span>
                                                    </td>
                                                )}
                                                {visibleColumns.description && (
                                                    <td className="py-5 px-6">
                                                        <div>
                                                            <div
                                                                className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
                                                                onClick={hasUpdate ? () => openEdit(row) : undefined}
                                                            >
                                                                <Home className="w-4 h-4 text-gray-400" />
                                                                <span>{hotels.find(h => h.id == row.raw?.property_id)?.name || row.raw?.property_name || 'Unknown Property'}</span>
                                                            </div>
                                                            <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">
                                                                {row.title}
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.attachments && (
                                                    <td className="py-5 px-6">
                                                        {(() => {
                                                            let atts = row?.raw?.attachments ?? [];
                                                            try {
                                                                if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                                                            } catch {
                                                                atts = [];
                                                            }
                                                            const count = Array.isArray(atts) ? atts.length : 0;
                                                            if (!count) return <span className="text-gray-400 text-sm">-</span>;
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openAttachmentsGallery(row?.raw?.attachments)}
                                                                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-xl transition-all hover:bg-teal-100 shadow-sm"
                                                                    title="View attachments"
                                                                >
                                                                    <span>{count}</span>
                                                                    <span className="text-xs font-bold uppercase tracking-wide">Photos</span>
                                                                </button>
                                                            );
                                                        })()}
                                                    </td>
                                                )}
                                                {
                                                    visibleColumns.priority && (
                                                        <td className="py-5 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${priorityStyle.text}`}>{row.priority}</span>
                                                            </div>
                                                        </td>
                                                    )
                                                }
                                                {
                                                    visibleColumns.status && (
                                                        <td className="py-5 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                                                                <span className={`text-sm font-semibold ${statusStyle.text}`}>{row.status}</span>
                                                            </div>
                                                        </td>
                                                    )
                                                }
                                                {
                                                    visibleColumns.assigned && (
                                                        <td className="py-5 px-6">
                                                            {row.assignedTo === "Unassigned" ? (
                                                                <span className="text-gray-400 text-sm">Unassigned</span>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.assignedTo)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                                                        {getInitials(row.assignedTo)}
                                                                    </div>
                                                                    <span className="text-gray-900 text-sm font-medium">{row.assignedTo}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )
                                                }
                                                {
                                                    visibleColumns.date && (
                                                        <td className="py-5 px-6 whitespace-nowrap">
                                                            <span className="text-gray-900 font-medium">{formatDate(row.date)}</span>
                                                        </td>
                                                    )
                                                }
                                                {/* Custom columns in table rows - POSITIONED BEFORE ACTIONS with STANDARD UI */}
                                                {
                                                    customColumns.filter(col => visibleColumns[col]).map(col => (
                                                        <td key={col} className="py-4 px-4">
                                                            <span className="text-gray-900 font-medium">{row.raw?.[col] ?? '-'}</span>
                                                        </td>
                                                    ))
                                                }
                                                {
                                                    visibleColumns.actions && (
                                                        <td className="py-5 px-6 text-center sticky right-0 z-10 bg-white" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleView(row)}
                                                                    className="p-1.5 text-gray-600 rounded-xl transition-all"
                                                                    title="View"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                {hasUpdate && (
                                                                    <button
                                                                        onClick={() => openEdit(row)}
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
                                                    )
                                                }
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="9" className="py-8 text-center text-gray-500">No work orders found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Board/Kanban View */
                        <div className="overflow-x-auto scrollbar-hide -mx-6 px-6">
                            <div className="flex gap-4 min-w-max pb-4">
                                {['Pending', 'In Progress', 'Completed'].map((status) => {
                                    const statusItems = filtered.filter((protocol) => {
                                        const protocolStatus = protocol.status || 'Pending';
                                        return protocolStatus.toLowerCase() === status.toLowerCase();
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
                                        <div key={status} className="shrink-0 w-80">
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
                                                            <Wrench className="w-10 h-10 mx-auto mb-2 text-[var(--text-secondary)]" />
                                                            <p className="text-[var(--text-secondary)] text-sm">No tasks</p>
                                                        </div>
                                                    ) : (
                                                        statusItems.map((protocol) => {
                                                            const priorityColor = getPriorityColor(protocol.priority || "Medium");
                                                            const isDeleting = deletingIds.has(protocol.id);

                                                            return (
                                                                <div
                                                                    key={protocol.id}
                                                                    className={`bg-[var(--bg-surface)] rounded-xl p-4 shadow-sm border border-[var(--border-color)] transition-all cursor-pointer ${isDeleting ? 'emergency-protocol-card-deleting' : ''}`}
                                                                    onClick={() => handleView(protocol)}
                                                                >
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-mono text-[var(--text-secondary)]">{protocol.reference || `EP-${protocol.id}`}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`w-2 h-2 rounded-full ${priorityColor.dot} shadow-sm`}></span>
                                                                            <span className={`text-xs font-medium ${priorityColor.text}`}>
                                                                                {protocol.priority || "Medium"}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-2 line-clamp-2">
                                                                        {protocol.title || "Emergency Task"}
                                                                    </h4>

                                                                    {protocol.description && (
                                                                        <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
                                                                            {protocol.description}
                                                                        </p>
                                                                    )}

                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        {protocol.category && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">
                                                                                {protocol.category}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            {protocol.assignedTo && protocol.assignedTo !== 'Unassigned' ? (
                                                                                <>
                                                                                    <div className={`w-6 h-6 rounded-full ${getAvatarColor(protocol.assignedTo)} flex items-center justify-center text-xs font-semibold`}>
                                                                                        {getInitials(protocol.assignedTo)}
                                                                                    </div>
                                                                                    <span className="text-xs text-[var(--text-primary)] truncate max-w-[100px]">
                                                                                        {protocol.assignedTo}
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-xs text-[var(--text-secondary)]">Unassigned</span>
                                                                            )}
                                                                        </div>

                                                                        <span className="text-xs text-[var(--text-secondary)]">
                                                                            {formatDate(protocol.date)}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleView(protocol);
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
                                                                                    openEdit(protocol);
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
                                                                                    handleDelete(protocol.id);
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

            {/* --- VIEW MODAL --- */}
            {
                showView && viewing && (
                    <div className="modal-overlay">
                        <div className="modal-container h-[70vh]">
                            <div className="modal-header">
                                <div>
                                    <h2 className="modal-title">Task Details</h2>
                                    <p className="modal-subtitle">View protocol information</p>
                                </div>
                                <button onClick={() => { setViewing(null); setShowView(false); }} className="modal-close-btn rounded-xl">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <>
                                <div className="modal-content space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reference</label>
                                            <p className="text-gray-900 font-medium">{viewing.reference || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                {viewing.status || 'N/A'}
                                            </span>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label>
                                            <p className="text-gray-900 font-medium">{viewing.title || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                                            <p className="text-gray-900">{viewing.raw?.category || viewing.type || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Property</label>
                                            <p className="text-gray-900">{hotels.find(h => h.id == viewing.raw?.property_id)?.name || viewing.raw?.property_name || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Due Date</label>
                                            <p className="text-gray-900">{formatDate(viewing.date) || 'N/A'}</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Priority</label>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                {viewing.priority || 'N/A'}
                                            </span>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Assigned To</label>
                                            <p className="text-gray-900">{viewing.assignedTo || 'N/A'}</p>
                                        </div>

                                        {(customColumns || []).map((col) => {
                                            const meta = customColumnMetadata?.[col] || {};
                                            const label = String(meta.label || col)
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, (m) => m.toUpperCase());
                                            const rawVal = viewing?.raw?.[col];
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
                                        <p className="text-gray-700">{viewing.description || 'No description provided.'}</p>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        onClick={() => { setViewing(null); setShowView(false); }}
                                        className="btn-secondary rounded-xl"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewing(null);
                                            setShowView(false);
                                            openEdit(viewing);
                                        }}
                                        className="btn-primary rounded-xl"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                </div>
                            </>
                        </div>
                    </div>
                )
            }

            {/* --- FORM MODAL --- */}
            {
                (showCreate || showEdit) && (
                    <div className="modal-overlay">
                        <div className="modal-container h-[70vh]">

                            {/* Modal Header */}
                            <div className="modal-header">
                                <div>
                                    <h3 className="modal-title">
                                        {showEdit ? "Edit Task" : "Create New Task"}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => { setShowCreate(false); setShowEdit(false); }}
                                    className="modal-close-btn rounded-xl"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Form Content */}
                            <form id="emergency-protocol-form" onSubmit={handleSubmit} className="modal-content form-section">
                                <div className="form-grid-2">

                                    {showEdit && (
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Reference ID</label>
                                            <input
                                                disabled
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-100 cursor-not-allowed focus:outline-none"
                                                value={form.reference}
                                            />
                                        </div>
                                    )}

                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                                        <input
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            value={form.title}
                                            onChange={e => setForm({ ...form, title: e.target.value })}
                                        />
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                                        <select
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                            value={form.property_id}
                                            onChange={handleHotelChange}
                                        >
                                            <option value="">Select Property</option>
                                            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Category <span className="text-red-500">*</span></label>
                                        <select
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                            value={form.category}
                                            onChange={handleCategoryChange}
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

                                    <div className="col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Priority <span className="text-red-500">*</span></label>
                                        <select
                                            required
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                            value={form.priority}
                                            onChange={e => setForm({ ...form, priority: e.target.value })}
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                            value={form.status}
                                            onChange={e => setForm({ ...form, status: e.target.value })}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Assigned To <span className="text-red-500">*</span></label>
                                        {form.property_id && staffMembers.length > 0 ? (
                                            <select
                                                required
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                value={form.assigned_to_name}
                                                onChange={e => setForm({ ...form, assigned_to_name: e.target.value })}
                                            >
                                                <option value="">Select staff member</option>
                                                {staffMembers.map(staff => (
                                                    <option key={staff.id} value={staff.name}>{staff.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                required
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-100 cursor-not-allowed focus:outline-none"
                                                value={form.assigned_to_name}
                                                onChange={e => setForm({ ...form, assigned_to_name: e.target.value })}
                                                placeholder={form.property_id ? "Loading staff..." : "Select property first"}
                                                disabled={!form.property_id}
                                            />
                                        )}
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Reported By <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            value={form.reported_by}
                                            readOnly
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-100 cursor-not-allowed focus:outline-none"
                                        />
                                    </div>

                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Date <span className="text-red-500">*</span></label>
                                        <input
                                            required
                                            type="date"
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            value={formatDateISO(form.scheduled_date)}
                                            onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                                        />
                                    </div>

                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Description <span className="text-red-500">*</span></label>
                                        <textarea
                                            required
                                            rows={3}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
                                            value={form.description || ''}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            placeholder="Describe the emergency protocol details..."
                                        />
                                    </div>

                                    <div className="col-span-1 md:col-span-2 mt-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Attachments</label>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all"
                                            onChange={(e) => {
                                                const next = Array.from(e.target.files || []);
                                                setPhotos(next);
                                            }}
                                        />

                                        {(() => {
                                            let atts = form?.attachments ?? form?.raw?.attachments ?? [];
                                            try { if (typeof atts === 'string' && atts) atts = JSON.parse(atts); } catch { atts = []; }
                                            const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
                                            if (!list.length) return null;
                                            return (
                                                <div className="mt-8 space-y-4">
                                                    <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 ml-1">Existing Attachments</h3>
                                                    {list.map((attId, idx) => (
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
                                                                    onClick={() => openAttachmentsGallery([attId])}
                                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[11px] font-bold text-teal-700 shadow-sm hover:bg-gray-50 hover:border-teal-200 transition-all uppercase tracking-wider"
                                                                >
                                                                    <Eye size={14} />
                                                                    View
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveEmergencyAttachment(attId)}
                                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-100 rounded-xl text-[11px] font-bold text-red-600 shadow-sm hover:bg-red-50 hover:border-red-200 transition-all uppercase tracking-wider"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Render custom columns in form - Standardized UI */}
                                    {customColumns.map(col => {
                                        const meta = customColumnMetadata[col] || {};
                                        const inputType = meta.input_type || 'text';
                                        const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                                        return (
                                            <div key={col} className="col-span-1 md:col-span-2">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                    {col.replace(/_/g, ' ').toUpperCase()} <span className="text-red-500">*</span>
                                                </label>
                                                {inputType === 'checkbox' ? (
                                                    <select
                                                        required
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                        value={form[col] === 'true' || form[col] === 'false' ? form[col] : form[col] === true ? 'true' : form[col] === false ? 'false' : ''}
                                                        onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="true">Yes</option>
                                                        <option value="false">No</option>
                                                    </select>
                                                ) : inputType === 'dropdown' || inputType === 'select' ? (
                                                    <select
                                                        required
                                                        value={form[col] || ''}
                                                        onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                    >
                                                        <option value="">Select...</option>
                                                        {options.map((opt, idx) => (
                                                            <option key={idx} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : inputType === 'textarea' ? (
                                                    <textarea
                                                        rows={3}
                                                        required
                                                        value={form[col] || ''}
                                                        onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
                                                    />
                                                ) : inputType === 'date' ? (
                                                    <input
                                                        type="date"
                                                        required
                                                        value={form[col] ? formatDateISO(form[col]) : ''}
                                                        onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                    />
                                                ) : (
                                                    <input
                                                        type={inputType}
                                                        required
                                                        value={form[col] || ''}
                                                        onChange={(e) => setForm({ ...form, [col]: e.target.value })}
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
                                    onClick={() => { setShowCreate(false); setShowEdit(false); }}
                                    className="btn-secondary rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="emergency-protocol-form"
                                    disabled={creating || editing}
                                    className="rounded-xl btn-primary"
                                >
                                    {creating ? "Creating..." : "Save Task"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Dialogs */}
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
                title={alertDialog.title}
                message={alertDialog.message}
                type={alertDialog.type}
            />
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
            />
            <ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />
        </div >
    );
}