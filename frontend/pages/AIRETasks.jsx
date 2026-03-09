/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { AlertModal, ConfirmModal } from '../components/ModalDialogs';
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
    Home,
    Building,
    CheckSquare,
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
    Clock,
    CheckCircle,
    Check
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'airetasks-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes aireTaskSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      @keyframes aireTaskCardDelete {
        0%   { opacity: 1; transform: scale(1) rotate(0deg); }
        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
      }
      tr.airetask-deleting {
        animation: aireTaskSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
      .airetask-card-deleting {
        animation: aireTaskCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

const DetailField = ({ label, value, fullWidth = false }) => (
    <div className={fullWidth ? "md:col-span-2" : ""}>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
        <p className="text-gray-900 font-medium">{value || '-'}</p>
    </div>
);

const aireStaffCache = {};

/* helper for normalizing hotels responses */
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
            const address = h?.address ?? null;
            return { id, name, address };
        })
        .filter((x) => x.id && x.name);
}

export default function AIRETasks({ user }) {
    // Get current user from props or localStorage
    const currentUser = user || (() => {
        try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    // Get permissions for aire_tasks module
    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
    const hasRead = canRead("aire_tasks");
    const hasCreate = canCreate("aire_tasks");
    const hasUpdate = canUpdate("aire_tasks");
    const hasDelete = canDelete("aire_tasks");

    const [tasks, setTasks] = useState([]);
    // Track rows/cards currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    // State to track if we are in "View Only" mode
    const [isViewing, setIsViewing] = useState(false);

    // Filter States
    const [selectedPriority, setSelectedPriority] = useState('All Priority');
    const [selectedStatus, setSelectedStatus] = useState('All Status');
    const [selectedProperty, setSelectedProperty] = useState('All Properties');
    const [filterProperties, setFilterProperties] = useState([]);
    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState("");
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
    const viewRef = React.useRef(null);

    // Dynamic columns state
    const [availableColumns, setAvailableColumns] = useState([
        "checkbox",
        "type",
        "reference",
        "description",
        "priority",
        "status",
        "assigned",
        "date",
        "actions",
    ]);
    const [customColumns, setCustomColumns] = useState([]); // Columns from Forms Builder
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});
    const [lastColumnCheck, setLastColumnCheck] = useState(Date.now());

    const BASE_EXPORT_COLUMNS = useMemo(
        () => [
            { header: 'Reference', key: 'reference' },
            { header: 'Title', key: 'title' },
            { header: 'Category', key: 'category' },
            { header: 'Priority', key: 'priority' },
            { header: 'Status', key: 'status' },
            { header: 'Property', key: 'propertyName' },
            { header: 'Deadline', key: 'deadline' },
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

    // Default columns shown in frontend
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

    // Define all available columns (will be updated dynamically)
    const ALL_COLUMNS = availableColumns;

    // Column visibility state - default columns visible, custom columns from localStorage or hidden
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const defaults = DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
        try {
            const saved = localStorage.getItem('aire_visible_columns');
            if (saved) {
                const parsed = JSON.parse(saved);
                const merged = { ...defaults, ...(parsed || {}) };
                if (merged.attachments === undefined) merged.attachments = true;
                return merged;
            }
        } catch (e) {
            console.error('Error loading column visibility:', e);
        }
        return defaults;
    });

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

    // Save visible columns to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('aireTasksVisibleColumns', JSON.stringify(visibleColumns));
        } catch (e) {
            console.warn('Failed to save visible columns to localStorage:', e);
        }
    }, [visibleColumns]);

    // Helper functions
    function formatDate(value) {
        if (!value) return "";
        try {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return value;
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
        if (low === "completed") return { dot: "bg-green-500", text: "text-green-700" };
        if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
        if (low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
        return { dot: "bg-gray-500", text: "text-gray-700" };
    }

    function getAvatarColor(name) {
        return "bg-teal-100 text-teal-700";
    }

    function getInitials(name) {
        if (!name || name === "Unassigned") return "UA";
        return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
    }

    const openAttachmentsGallery = (items = []) => {
        if (!items.length) return;
        const base = (import.meta?.env?.VITE_API_URL || window.location.origin || '').replace(/\/$/, '');
        const urls = items.map((x) => {
            // If x is a number or numeric string, it's an ID
            const isNumericId = /^\d+$/.test(String(x));
            const u = isNumericId ? `/api/aire-tasks/attachments/${x}` : String(x);
            return /^https?:\/\//i.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`;
        });

        const safeTitle = `AIRE Photos (${urls.length})`;
        const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${safeTitle}</title>
          <style>
            :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #2dd4bf; }
            body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
            header { position: sticky; top: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); z-index: 10; display: flex; justify-content: space-between; align-items: center; }
            .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; padding: 1.5rem; }
            .card { background: var(--card); border-radius: 1rem; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); transition: transform 0.2s; }
            .card:hover { transform: translateY(-4px); border-color: var(--accent); }
            .card img { width: 100%; height: 250px; object-fit: cover; background: #000; display: block; cursor: pointer; }
            .card-meta { padding: 1rem; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; }
            .btn { background: var(--accent); color: var(--bg); padding: 0.5rem 1rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; font-size: 0.75rem; }
          </style>
        </head>
        <body>
          <header>
            <div style="font-weight: 700; font-size: 1.1rem; letter-spacing: -0.025em;">${safeTitle}</div>
            <div style="font-size: 0.75rem; opacity: 0.6;">Premium Viewer</div>
          </header>
          <div class="gallery">
            ${urls.map((u, i) => `
              <div class="card">
                <img src="${u}" alt="Photo ${i + 1}" onclick="window.open('${u}', '_blank')">
                <div class="card-meta">
                  <span>Photo ${i + 1}</span>
                  <a href="${u}" target="_blank" class="btn">Full View</a>
                </div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;

        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    };

    const api = useMemo(() => axios.create({
        baseURL: import.meta.env.VITE_API_URL || '',
        withCredentials: true,
        timeout: 15000
    }), []);

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

    // Load AIRE tasks
    useEffect(() => {
        let mounted = true;
        async function loadTasks() {
            setLoading(true);
            try {
                const res = await api.get('/api/aire-tasks', { params: { limit: 500 } }).catch(() => ({ data: [] }));
                const list = res?.data?.rows ?? res?.data?.data ?? res?.data ?? [];

                if (!mounted) return;

                if (Array.isArray(list) && list.length > 0) {
                    const normalized = list.map((t, idx) => ({
                        id: t.id ?? idx,
                        type: 'AIRE Tasks',
                        reference: t.reference ?? t.ticket_no ?? `AIRE-2025-${Math.random().toString(36).substr(2, 8)}`,

                        // FIX: Keep Title and Description distinct
                        title: t.title || '',
                        description: t.description || t.title || 'No description',

                        priority: t.priority ?? 'Medium',
                        status: t.status ?? 'Pending',
                        assignedTo: t.assigned_to_name ?? t.assignedToName ?? (t.assignee_id ? `User ${t.assignee_id}` : 'Unassigned'),
                        assignedToId: t.assigned_to_id ?? t.assigned_to_id ?? t.assignedToId,
                        date: t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString() : (t.created_at ? new Date(t.created_at).toLocaleDateString() : new Date().toLocaleDateString()),

                        // Store additional details for View Mode
                        category: t.category,
                        reportedBy: t.reported_by ?? t.reportedBy,
                        propertyId: t.property_id ?? t.propertyId ?? t.property,
                        propertyName: t.property_name ?? t.propertyName ?? t.property,
                        serviceUserId: t.service_user_id ?? t.serviceUserId,
                        rawDate: t.scheduled_date ?? t.scheduledDate,

                        // Preserve all custom columns from API response
                        ...t,
                        raw: t,
                        attachments: t?.attachments ?? t?.raw?.attachments ?? []
                    }));
                    setTasks(normalized);
                } else {
                    setTasks([]);
                }
            } catch (err) {
                console.warn('Failed to load AIRE tasks:', err?.message || err);
                setTasks([]);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        loadTasks();

        // Load properties for filter dropdown
        async function loadProperties() {
            try {
                const res = await api.get('/api/hotels', { params: { limit: 1000 } }).catch(() => ({ data: [] }));
                const normalized = normalizeHotelsResponse(res?.data ?? {});
                if (mounted) {
                    setFilterProperties(normalized);
                }
            } catch (err) {
                console.warn('Failed to load properties for filter:', err?.message || err);
            }
        }
        loadProperties();

        return () => { mounted = false; };
    }, [api]);

    // Fetch available columns from the database
    const fetchAvailableColumns = async () => {
        try {
            const res = await api.get('/api/forms-builder/tables/aire_tasks/columns');
            const columns = res?.data?.columns || res?.data || [];

            // Default UI columns
            const defaultColumns = ["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"];

            // System and known AIRE task columns to exclude (everything except true custom columns)
            const systemColumns = [
                'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
                'title', 'description', 'task_type', 'priority', 'status',
                'assigned_to_id', 'assigned_to_name', 'service_user_id',
                'property_id', 'property_name', 'scheduled_date', 'due_date', 'completed_date',
                'notes', 'attachments', 'category', 'tags', 'created_by_id', 'reported_by'
            ];
            const customCols = columns
                .filter(col => !systemColumns.includes(col.column_name) && !defaultColumns.includes(col.column_name))
                .map(col => col.column_name);

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
                        if (!(col in updated)) {
                            // Check localStorage for this column's visibility
                            try {
                                const saved = localStorage.getItem('aireTasksVisibleColumns');
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
    }, []);

    // Handle New Task Creation
    const handleCreateTask = (newTask) => {
        (async () => {
            setModalError(null);
            setModalSubmitting(true);
            try {
                const customPayload = customColumns.reduce((acc, col) => {
                    const meta = customColumnMetadata?.[col] || {};
                    const inputType = meta.input_type || 'text';
                    const v = newTask?.[col];
                    if (inputType === 'checkbox') {
                        if (v === true || String(v).toLowerCase() === 'true' || String(v) === 'true') acc[col] = true;
                        else if (v === false || String(v).toLowerCase() === 'false' || String(v) === 'false') acc[col] = false;
                        else acc[col] = null;
                    } else {
                        acc[col] = v === undefined ? null : v;
                    }
                    return acc;
                }, {});

                const payload = {
                    title: newTask.title,
                    description: newTask.description || null,
                    priority: newTask.priority || 'Medium',
                    status: 'Pending',
                    assigned_to_id: null,
                    assigned_to_name: newTask.assignedTo || null,
                    service_user_id: newTask.serviceUserId || null,
                    property_id: newTask.property || null,
                    property_name: newTask.propertyName || null,
                    scheduled_date: newTask.scheduledDate || null,
                    category: newTask.category || 'AIRE',
                    reported_by: newTask.reportedBy || null,
                    // Include custom columns in payload
                    ...customPayload
                };

                const hasPhotos = Array.isArray(newTask?.photos) && newTask.photos.length > 0;
                let res;
                if (hasPhotos) {
                    const fd = new FormData();
                    Object.entries(payload).forEach(([k, v]) => {
                        if (v === undefined) return;
                        if (v === null) return;
                        fd.append(k, String(v));
                    });
                    newTask.photos.forEach((f) => fd.append('photos', f));
                    res = await api.post('/api/aire-tasks', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                } else {
                    res = await api.post('/api/aire-tasks', payload);
                }
                const created = res?.data ?? null;
                if (created) {
                    const normalized = {
                        id: created.id,
                        type: 'AIRE Tasks',
                        reference: created.reference ?? `AIRE-2025-${Math.random().toString(36).substr(2, 8)}`,
                        title: created.title,
                        description: created.description ?? created.title ?? 'No description',
                        priority: created.priority ?? 'Medium',
                        status: created.status ?? 'Pending',
                        assignedTo: created.assigned_to_name ?? created.assignedToName ?? 'Unassigned',
                        date: created.scheduled_date ? new Date(created.scheduled_date).toLocaleDateString() : new Date().toLocaleDateString(),

                        category: created.category,
                        reportedBy: created.reported_by,
                        propertyId: created.property_id,
                        propertyName: created.property_name,
                        serviceUserId: created.service_user_id,
                        rawDate: created.scheduled_date,
                        // Include all custom columns
                        ...created,
                        raw: created,
                        attachments: created?.attachments ?? created?.raw?.attachments ?? []
                    };
                    setTasks(prev => [normalized, ...prev]);
                    setShowModal(false);
                    setModalSubmitting(false);
                } else {
                    throw new Error('No response from server');
                }
            } catch (err) {
                console.error('Failed to create AIRE task:', err);
                const errMsg = err?.response?.data?.message || err?.message || 'Failed to create task';
                setModalError(errMsg);
                setModalSubmitting(false);
            }
        })();
    };

    const handleRemoveAttachment = (taskId, attachmentId) => {
        (async () => {
            if (!taskId || !attachmentId) return;
            try {
                await api.delete(`/api/aire-tasks/attachments/${encodeURIComponent(String(attachmentId))}`).catch(() => null);

                setTasks((prev) => {
                    const list = Array.isArray(prev) ? prev : [];
                    return list.map((t) => {
                        if (String(t.id) !== String(taskId)) return t;
                        let atts = t?.attachments ?? t?.raw?.attachments ?? [];
                        try {
                            if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                        } catch {
                            atts = [];
                        }
                        const next = (Array.isArray(atts) ? atts : []).filter((x) => String(x) !== String(attachmentId));
                        return {
                            ...t,
                            attachments: next,
                            raw: { ...(t.raw || {}), attachments: next }
                        };
                    });
                });
            } catch (err) {
                console.warn('Failed to remove attachment:', err?.message || err);
            }
        })();
    };

    // Stats
    const stats = useMemo(() => {
        const total = tasks.length;
        const overdue = tasks.filter(t => t.status === 'Overdue').length;
        const dueThisWeek = tasks.filter(t => t.status === 'Due This Week').length;
        const completed = tasks.filter(t => t.status === 'Completed').length;
        return { total, overdue, dueThisWeek, completed };
    }, [tasks]);

    // Filtered tasks
    const filteredTasks = useMemo(() => {
        const q = (query || "").trim().toLowerCase();
        let list = tasks.filter(t => {
            if (q && !(t.title || "").toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q) && !(t.reference || "").toLowerCase().includes(q)) return false;
            if (selectedPriority !== 'All Priority' && t.priority !== selectedPriority) return false;
            if (selectedStatus !== 'All Status' && t.status !== selectedStatus) return false;
            if (selectedProperty !== 'All Properties' && t.propertyName !== selectedProperty) return false;
            return true;
        });

        // Apply sorting
        if (sortBy) {
            list = [...list].sort((a, b) => {
                if (sortBy === 'date') {
                    const dateA = new Date(a.due_date || a.created_at || 0);
                    const dateB = new Date(b.due_date || b.created_at || 0);
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
    }, [tasks, selectedPriority, selectedStatus, selectedProperty, query, sortBy]);

    const normalizeAireTaskExportRow = (task) => {
        const base = {
            reference: task.reference || '-',
            title: task.title || '-',
            category: task.category || '-',
            priority: task.priority || '-',
            status: task.status || '-',
            propertyName: task.propertyName || task.property_name || '-',
            deadline: task.deadline || task.due_date || task.dueDate || '-',
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

            const data = (filteredTasks || []).map(normalizeAireTaskExportRow);

            if (exportFormat === 'pdf') {
                generatePDF(data, columns, 'AIRE Tasks Report', 'aire-tasks-report');
            } else if (exportFormat === 'csv') {
                generateCSV(data, columns, 'aire-tasks-report');
            }

            closeExport();
        } catch (error) {
            console.error('Error exporting AIRE tasks:', error);
            alert('Failed to download: ' + error.message);
        }
    };


    // Handle View/Edit/Delete Actions
    function handleView(task) {
        setEditingTask(task);
        setIsViewing(true); // Enable View Mode
        setModalError(null);
        setShowModal(true);
    }

    function handleEdit(task) {
        setEditingTask(task);
        setIsViewing(false); // Enable Edit Mode
        setModalError(null);
        setShowModal(true);
    }

    async function handleDelete(task) {
        const taskId = task?.id;
        if (taskId === undefined || taskId === null || String(taskId).trim() === "") {
            setAlertDialog({
                isOpen: true,
                title: 'Delete Failed',
                message: 'Invalid task id.',
                type: 'error'
            });
            return;
        }
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Task',
            message: `Delete task ${task.reference}? This action cannot be undone.`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    const id = task.id;
                    setDeletingIds(prev => new Set(prev).add(id));
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

                    const ANIM_DURATION = 460;
                    setTimeout(() => {
                        setTasks(prev => prev.filter(t => String(t.id) !== String(id)));
                        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    }, ANIM_DURATION);

                    await api.delete(`/api/aire-tasks/${encodeURIComponent(taskId)}`).catch(() => null);
                } catch (err) {
                    console.warn('Failed to delete task', err?.message || err);
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    setDeletingIds(prev => { const next = new Set(prev); next.delete(task?.id); return next; });
                    setAlertDialog({
                        isOpen: true,
                        title: 'Delete Failed',
                        message: 'Failed to delete task.',
                        type: 'error'
                    });
                }
            }
        });
    }

    // Update existing AIRE task
    const handleUpdateTask = (updatedTask, id) => {
        (async () => {
            setModalError(null);
            setModalSubmitting(true);
            try {
                const customPayload = customColumns.reduce((acc, col) => {
                    const meta = customColumnMetadata?.[col] || {};
                    const inputType = meta.input_type || 'text';
                    const v = updatedTask?.[col];
                    if (inputType === 'checkbox') {
                        if (v === true || String(v).toLowerCase() === 'true' || String(v) === 'true') acc[col] = true;
                        else if (v === false || String(v).toLowerCase() === 'false' || String(v) === 'false') acc[col] = false;
                        else acc[col] = null;
                    } else {
                        acc[col] = v === undefined ? null : v;
                    }
                    return acc;
                }, {});

                const payload = {
                    title: updatedTask.title,
                    description: updatedTask.description || null,
                    priority: updatedTask.priority || 'Medium',
                    assigned_to_name: updatedTask.assignedTo || null,
                    service_user_id: updatedTask.serviceUserId || null,
                    property_id: updatedTask.property || null,
                    property_name: updatedTask.propertyName || null,
                    scheduled_date: updatedTask.scheduledDate || null,
                    category: updatedTask.category || 'AIRE',
                    reported_by: updatedTask.reportedBy || null,
                    // Include custom columns in payload
                    ...customPayload
                };

                const hasPhotos = Array.isArray(updatedTask?.photos) && updatedTask.photos.length > 0;
                let res;
                if (hasPhotos) {
                    const fd = new FormData();
                    Object.entries(payload).forEach(([k, v]) => {
                        if (v === undefined) return;
                        if (v === null) return;
                        fd.append(k, String(v));
                    });
                    updatedTask.photos.forEach((f) => fd.append('photos', f));
                    res = await api.patch(`/api/aire-tasks/${encodeURIComponent(id)}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                } else {
                    res = await api.patch(`/api/aire-tasks/${encodeURIComponent(id)}`, payload);
                }
                const updated = res?.data ?? null;
                if (updated) {
                    const normalized = {
                        id: updated.id,
                        type: 'AIRE Tasks',
                        reference: updated.reference ?? updated.ticket_no ?? `AIRE-2025-${Math.random().toString(36).substr(2, 8)}`,
                        title: updated.title,
                        description: updated.description ?? updated.title ?? 'No description',
                        priority: updated.priority ?? 'Medium',
                        status: updated.status ?? 'Pending',
                        assignedTo: updated.assigned_to_name ?? updated.assignedToName ?? 'Unassigned',
                        date: updated.scheduled_date ? new Date(updated.scheduled_date).toLocaleDateString() : new Date().toLocaleDateString(),

                        category: updated.category,
                        reportedBy: updated.reported_by,
                        propertyId: updated.property_id,
                        propertyName: updated.property_name,
                        serviceUserId: updated.service_user_id,
                        rawDate: updated.scheduled_date,
                        // Include all custom columns
                        ...updated,
                        raw: updated,
                        attachments: updated?.attachments ?? updated?.raw?.attachments ?? []
                    };
                    setTasks(prev => prev.map(t => String(t.id) === String(id) ? normalized : t));
                    setShowModal(false);
                    setEditingTask(null);
                    setModalSubmitting(false);

                    // Reload tasks from server to ensure we have the latest data including custom columns
                    try {
                        const refreshRes = await api.get('/api/aire-tasks', { params: { limit: 500 } });
                        const refreshList = refreshRes?.data?.rows ?? refreshRes?.data?.data ?? refreshRes?.data ?? [];
                        if (Array.isArray(refreshList) && refreshList.length > 0) {
                            const refreshNormalized = refreshList.map((t, idx) => ({
                                id: t.id ?? idx,
                                type: 'AIRE Tasks',
                                reference: t.reference ?? t.ticket_no ?? `AIRE-2025-${Math.random().toString(36).substr(2, 8)}`,
                                title: t.title || '',
                                description: t.description || t.title || 'No description',
                                priority: t.priority ?? 'Medium',
                                status: t.status ?? 'Pending',
                                assignedTo: t.assigned_to_name ?? t.assignedToName ?? (t.assignee_id ? `User ${t.assignee_id}` : 'Unassigned'),
                                assignedToId: t.assigned_to_id,
                                date: t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString() : (t.created_at ? new Date(t.created_at).toLocaleDateString() : new Date().toLocaleDateString()),
                                category: t.category,
                                reportedBy: t.reported_by || t.reportedBy,
                                propertyId: t.property_id || t.propertyId,
                                propertyName: t.property_name || t.propertyName,
                                serviceUserId: t.service_user_id,
                                rawDate: t.scheduled_date ?? t.scheduledDate,

                                // Preserve all custom columns from API response
                                ...t,
                                raw: t,
                                attachments: t?.attachments ?? t?.raw?.attachments ?? []
                            }));
                            setTasks(refreshNormalized);
                        }
                    } catch (refreshErr) {
                        console.warn('Failed to refresh tasks after update:', refreshErr);
                    }
                } else {
                    throw new Error('No response from server');
                }
            } catch (err) {
                console.error('Failed to update AIRE task:', err);
                const errMsg = err?.response?.data?.message || err?.message || 'Failed to update task';
                setModalError(errMsg);
                setModalSubmitting(false);
            }
        })();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Breadcrumbs items={[{ label: 'Property', path: '/admin/hotels' }, { label: 'AIRE Tasks', path: '/admin/aire-tasks' }]} />
                        <h1 className="text-3xl font-black text-slate-900 mt-1">AIRE Tasks Dashboard</h1>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200">
                        <div className="bg-blue-50 text-blue-600 h-14 w-14 rounded-xl flex items-center justify-center shrink-0">
                            <CheckSquare size={28} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Tasks</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.total}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200">
                        <div className="bg-red-50 text-red-600 h-14 w-14 rounded-xl flex items-center justify-center shrink-0">
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Overdue</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.overdue}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200">
                        <div className="bg-orange-50 text-orange-600 h-14 w-14 rounded-xl flex items-center justify-center shrink-0">
                            <Clock size={28} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Due This Week</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.dueThisWeek}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 flex items-center gap-4 border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200">
                        <div className="bg-emerald-50 text-emerald-600 h-14 w-14 rounded-xl flex items-center justify-center shrink-0">
                            <CheckCircle size={28} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Completed</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{stats.completed}</div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area - AIRE Tasks Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200">
                    <div className="p-6 pb-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">Task List</h2>
                                <div className="text-sm text-gray-500 font-medium">
                                    {tasks.length} tasks matched
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search tasks..."
                                        className="w-full h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                                    />
                                </div>
                                {/* Action Buttons */}
                                <div className="relative" ref={viewRef}>
                                    <button
                                        onClick={() => setShowViewMenu(!showViewMenu)}
                                        className="h-9 bg-white border border-gray-300 text-gray-700 rounded-xl px-3 text-xs font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    {/* <button
 onClick={() => setShowExportModal(true)}
 className="h-9 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-4 text-xs flex items-center gap-2 transition-colors shadow-sm"
 >
 <Download className="w-4 h-4" />
 <span>Download</span>
 </button> */}
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
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            <Columns className="w-4 h-4" />
                                                            <span>Table</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setViewMode('board')}
                                                            className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'board'
                                                                ? 'bg-teal-500 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            <CheckSquare className="w-4 h-4" />
                                                            <span>Board</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {viewMode === 'table' && (
                                                    <>
                                                        <button
                                                            onClick={() => setShowPropertyVisibility(!showPropertyVisibility)}
                                                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                                                        >
                                                            <span>Property visibility</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-500">
                                                                    {Object.values(visibleColumns).filter(Boolean).length} shown
                                                                </span>
                                                                <ChevronDown className={`w-4 h-4 transition-transform ${showPropertyVisibility ? 'rotate-180' : ''}`} />
                                                            </div>
                                                        </button>
                                                        {showPropertyVisibility && (
                                                            <div className="mt-2 border-t border-gray-200 pt-3 max-h-96 overflow-y-auto">
                                                                {/* Visibility Section - All default columns (shown and hidden) */}
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
                                                                                className="text-xs text-teal-600 hover:text-teal-700 font-medium rounded-xl"
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
                                                                                className="text-xs text-teal-600 hover:text-teal-700 font-medium rounded-xl"
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
                                                                                    ? 'text-gray-700 hover:bg-gray-50 border-gray-200 bg-white'
                                                                                    : 'text-gray-500 hover:bg-teal-50 hover:text-teal-700 border-gray-100 bg-gray-50'
                                                                                    }`}
                                                                            >
                                                                                <span className="capitalize font-medium">{col.replace(/_/g, ' ')}</span>
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
                                                                                    className="text-xs text-teal-600 hover:text-teal-700 font-medium rounded-xl"
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
                                                                                    className="text-xs text-teal-600 hover:text-teal-700 font-medium rounded-xl"
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
                                                                                        ? 'text-gray-700 hover:bg-gray-50 border-gray-200 bg-white'
                                                                                        : 'text-gray-500 hover:bg-teal-50 hover:text-teal-700 border-gray-100 bg-gray-50'
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
                                        onClick={() => { setEditingTask(null); setIsViewing(false); setShowModal(true); }}
                                        className="h-9 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-4 text-xs flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        <span>Create Task</span>
                                    </button>
                                )}
                            </div>
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
                                            className="p-2 rounded-xl -xl hover:bg-gray-50 text-gray-500"
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
                                                    className="text-teal-600 hover:text-teal-700 font-medium rounded-xl"
                                                >
                                                    Select all
                                                </button>
                                                <button
                                                    onClick={() => setSelectedExportKeys([])}
                                                    className="text-gray-600 hover:text-gray-700 font-medium rounded-xl"
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
                                                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer"
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
                                            className="px-4 py-2 rounded-xl -xl text-sm font-medium text-gray-700 hover:bg-white border border-gray-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={runExport}
                                            className="px-4 py-2 rounded-xl -xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
                                        >
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <div className="relative flex-1 md:flex-none">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={selectedPriority}
                                    onChange={e => setSelectedPriority(e.target.value)}
                                    className="w-full h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-8 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[140px]"
                                >
                                    <option>All Priority</option>
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                    <option>Urgent</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative flex-1 md:flex-none">
                                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={selectedStatus}
                                    onChange={e => setSelectedStatus(e.target.value)}
                                    className="w-full h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-8 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[140px]"
                                >
                                    <option>All Status</option>
                                    <option>Pending</option>
                                    <option>In Progress</option>
                                    <option>Completed</option>
                                    <option>Overdue</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative flex-1 md:flex-none">
                                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={selectedProperty}
                                    onChange={e => setSelectedProperty(e.target.value)}
                                    className="w-full h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-8 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[160px]"
                                >
                                    <option>All Properties</option>
                                    {filterProperties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative flex-1 md:flex-none">
                                <ChevronDown className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="w-full h-9 bg-white border border-gray-300 rounded-xl pl-10 pr-8 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[140px]"
                                >
                                    <option value="">Sort By</option>
                                    <option value="date">Date</option>
                                    <option value="priority">Priority</option>
                                    <option value="status">Status</option>
                                    <option value="title">Title</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            {(selectedPriority !== 'All Priority' || selectedStatus !== 'All Status' || selectedProperty !== 'All Properties' || sortBy) && (
                                <button
                                    onClick={() => {
                                        setSelectedPriority('All Priority');
                                        setSelectedStatus('All Status');
                                        setSelectedProperty('All Properties');
                                        setSortBy('');
                                    }}
                                    className="h-9 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-3 text-xs font-medium transition-colors flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Data Display - Table or Board View */}
                    {viewMode === 'table' ? (
                        <div className="overflow-x-auto border-t border-slate-100 relative">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50">
                                    <tr className="border-b border-slate-200">
                                        {visibleColumns.checkbox && (
                                            <th className="py-4 px-4">
                                                <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                            </th>
                                        )}
                                        {visibleColumns.type && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">TYPE</th>}
                                        {visibleColumns.reference && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">REFERENCE</th>}
                                        {visibleColumns.description && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</th>}
                                        {visibleColumns.attachments && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ATTACHMENTS</th>}
                                        {visibleColumns.priority && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PRIORITY</th>}
                                        {visibleColumns.status && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>}
                                        {visibleColumns.assigned && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ASSIGNED TO</th>}
                                        {visibleColumns.date && <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DATE</th>}
                                        {customColumns.filter(col => visibleColumns[col]).map(col => (
                                            <th key={col} className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {col.replace(/_/g, ' ').toUpperCase()}
                                            </th>
                                        ))}
                                        <th className="py-4 px-6 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="12" className="py-12 text-center text-slate-500 font-medium">Loading tasks...</td>
                                        </tr>
                                    ) : filteredTasks.length > 0 ? filteredTasks.map(task => {
                                        const priorityStyle = getPriorityColor(task.priority || "Medium");
                                        const statusStyle = getStatusColor(task.status || "Pending");
                                        const isDeleting = deletingIds.has(task.id);

                                        return (
                                            <tr key={task.id} className={`group hover:bg-slate-50/50 transition-colors ${isDeleting ? 'airetask-deleting' : ''}`}>
                                                {visibleColumns.checkbox && (
                                                    <td className="py-4 px-4">
                                                        <input type="checkbox" className="rounded-xl border-gray-300 text-teal-500 focus:ring-teal-500" />
                                                    </td>
                                                )}

                                                {visibleColumns.type && (
                                                    <td className="py-4 px-4">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 uppercase">
                                                            {task.type || "AIRE Tasks"}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.reference && (
                                                    <td className="py-4 px-4 whitespace-nowrap">
                                                        <span className="text-gray-900 font-medium text-sm">{task.reference}</span>
                                                    </td>
                                                )}
                                                {visibleColumns.description && (
                                                    <td className="py-4 px-4 max-w-xs">
                                                        <div className="flex flex-col">
                                                            <div className="text-sm font-semibold text-gray-900 truncate">
                                                                {task.title || "No Title"}
                                                            </div>
                                                            <div className="text-xs text-gray-500 truncate mt-0.5">
                                                                {task.description || "No description recorded."}
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.attachments && (
                                                    <td className="py-4 px-4">
                                                        {(() => {
                                                            let atts = task?.attachments ?? task?.raw?.attachments ?? [];
                                                            try {
                                                                if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                                                            } catch {
                                                                atts = [];
                                                            }
                                                            const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
                                                            if (list.length === 0) return <span className="text-gray-400 text-xs">—</span>;
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openAttachmentsGallery(list)}
                                                                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-4 py-2 rounded-xl shadow-sm hover:bg-teal-100 transition-all"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    <span>View {list.length} Photos</span>
                                                                </button>
                                                            );
                                                        })()}
                                                    </td>
                                                )}
                                                {visibleColumns.priority && (
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                                                            <span className={`text-sm font-medium ${priorityStyle.text}`}>{task.priority}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.status && (
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                                                            <span className={`text-sm font-medium ${statusStyle.text}`}>{task.status}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.assigned && (
                                                    <td className="py-4 px-4">
                                                        {task.assignedTo === "Unassigned" ? (
                                                            <span className="text-gray-400 text-xs">Unassigned</span>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-7 h-7 rounded-full ${getAvatarColor(task.assignedTo)} flex items-center justify-center text-[10px] font-bold`}>
                                                                    {getInitials(task.assignedTo)}
                                                                </div>
                                                                <span className="text-gray-900 text-sm font-medium">{task.assignedTo}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                {visibleColumns.date && (
                                                    <td className="py-4 px-4 whitespace-nowrap">
                                                        <span className="text-gray-900 font-medium text-sm">{formatDate(task.date)}</span>
                                                    </td>
                                                )}
                                                {customColumns.filter(col => visibleColumns[col]).map(col => (
                                                    <td key={col} className="py-4 px-4">
                                                        <span className="text-gray-900 font-medium text-sm">{task[col] || '-'}</span>
                                                    </td>
                                                ))}
                                                <td className="py-4 px-6 text-center sticky right-0 z-10 bg-white" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                    <div className="flex items-center justify-center gap-1.5 transition-opacity">
                                                        <button
                                                            onClick={() => handleView(task)}
                                                            className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all"
                                                            title="View"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {hasUpdate && (
                                                            <button
                                                                onClick={() => handleEdit(task)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {hasDelete && (
                                                            <button
                                                                onClick={() => handleDelete(task)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="100" className="py-12 text-center text-slate-500 font-medium">No tasks found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Board/Kanban View */
                        <div className="overflow-x-auto -mx-6 px-6">
                            <div className="flex gap-4 min-w-max pb-4">
                                {['pending', 'in progress', 'completed'].map((status) => {
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
                                        if (status === 'in progress') {
                                            return {
                                                bg: 'bg-purple-50',
                                                border: 'border-purple-200',
                                                header: 'bg-purple-100',
                                                text: 'text-purple-700',
                                                dot: 'bg-purple-500'
                                            };
                                        }
                                        if (status === 'completed') {
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
                                                            <CheckSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                            <p className="text-gray-400 text-sm">No tasks</p>
                                                        </div>
                                                    ) : (
                                                        statusItems.map((task) => {
                                                            const priorityColor = getPriorityColor(task.priority || "Medium");
                                                            const isDeleting = deletingIds.has(task.id);

                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    className={`bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-gray-300 transition-all cursor-pointer ${isDeleting ? 'airetask-card-deleting' : ''}`}
                                                                    onClick={() => { setEditingTask(task); setIsViewing(true); setShowModal(true); }}
                                                                >
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-mono text-gray-500">{task.reference || `TASK-${task.id}`}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                                                            <span className={`text-xs font-medium ${priorityColor.text}`}>
                                                                                {task.priority || "Medium"}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                                                        {task.title}
                                                                    </h4>

                                                                    {
                                                                        task.description && (
                                                                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                                                                {task.description}
                                                                            </p>
                                                                        )
                                                                    }

                                                                    {
                                                                        task.task_type && (
                                                                            <div className="mb-3">
                                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">
                                                                                    {task.task_type}
                                                                                </span>
                                                                            </div>
                                                                        )
                                                                    }

                                                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            {task.assigned_to ? (
                                                                                <>
                                                                                    <div className={`w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold`}>
                                                                                        {task.assigned_to.substring(0, 2).toUpperCase()}
                                                                                    </div>
                                                                                    <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                                                                        {task.assigned_to}
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400">Unassigned</span>
                                                                            )}
                                                                        </div>

                                                                        <span className="text-xs text-gray-500">
                                                                            {task.due_date ? formatDate(task.due_date) : '-'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingTask(task); setIsViewing(true); setShowModal(true);
                                                                            }}
                                                                            className="flex-1 py-1.5 px-2 bg-gray-50 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-xl transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                                                            title="View"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                            View
                                                                        </button>
                                                                        {hasUpdate && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingTask(task); setIsViewing(false); setShowModal(true);
                                                                                }}
                                                                                className="p-1.5 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors"
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
                                                                                className="p-1.5 bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
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

            {/* --- ADD/VIEW TASK MODAL --- */}
            {
                showModal && (
                    <AddTaskModal
                        api={api}
                        editingTask={editingTask}
                        readOnly={isViewing}
                        error={modalError}
                        submitting={modalSubmitting}
                        customColumns={customColumns}
                        openAttachmentsGallery={openAttachmentsGallery}
                        customColumnMetadata={customColumnMetadata}
                        currentUser={currentUser}
                        onRemoveAttachment={handleRemoveAttachment}
                        onRequestEdit={() => setIsViewing(false)}
                        onClose={() => { setShowModal(false); setModalError(null); setEditingTask(null); setIsViewing(false); }}
                        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
                    />
                )
            }

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
        </div >
    );
}

// Modal Component
function AddTaskModal({ api, editingTask, readOnly, error, submitting, onClose, onSubmit, onRequestEdit, onRemoveAttachment, openAttachmentsGallery, customColumns = [], customColumnMetadata = {}, currentUser }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        property: '',
        propertyName: '',
        category: '',
        priority: 'Medium',
        reportedBy: currentUser?.name || '',
        assignedTo: '',
        assignedToId: '',
        serviceUserId: '',
        scheduledDate: '',
        status: 'Pending'
    });

    const [photos, setPhotos] = useState([]);

    const CATEGORY_STORAGE_KEY = 'aireTasks.customCategories';
    const [customCategories, setCustomCategories] = useState([]);
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

    const [hotels, setHotels] = useState([]);
    const [serviceUsers, setServiceUsers] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [hotelsLoading, setHotelsLoading] = useState(false);
    const hotelsControllerRef = React.useRef(null);
    const staffCacheRef = React.useRef(aireStaffCache);
    const staffAbortRef = React.useRef(null);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

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

        const builtins = ['Maintenance', 'Inspection', 'General'];
        const builtinLower = new Set(builtins.map((t) => String(t).toLowerCase()));
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

    // Initialize custom columns when customColumns array changes
    React.useEffect(() => {
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
    }, [customColumns.join(',')]); // Re-run when column list changes

    // Prefill when editingTask changes
    React.useEffect(() => {
        if (!editingTask) return;
        setForm((f) => ({
            ...f,
            // FIX: Ensure title doesn't accidentally grab description
            title: editingTask.title || '',
            description: editingTask.description || '',
            property: editingTask.propertyId ?? editingTask.property_id ?? editingTask.property ?? f.property,
            propertyName: editingTask.propertyName ?? editingTask.property_name ?? f.propertyName,
            category: editingTask.category ?? f.category,
            priority: editingTask.priority ?? f.priority,
            reportedBy: editingTask.reportedBy ?? editingTask.reported_by ?? f.reportedBy,
            assignedTo: editingTask.assignedTo ?? editingTask.assigned_to_name ?? f.assignedTo,
            assignedToId: editingTask.assignedToId ?? editingTask.assigned_to_id ?? f.assignedToId,
            serviceUserId: editingTask.serviceUserId ?? editingTask.service_user_id ?? f.serviceUserId,
            scheduledDate: (editingTask.rawDate ?? editingTask.scheduled_date ?? editingTask.scheduledDate) ? ('' + (editingTask.rawDate ?? editingTask.scheduled_date ?? editingTask.scheduledDate)).substring(0, 10) : f.scheduledDate,
            status: editingTask.status ?? 'Pending',
            // Prefill custom columns
            ...customColumns.reduce((acc, col) => ({ ...acc, [col]: editingTask[col] ?? '' }), {})
        }));
        setPhotos([]);
    }, [editingTask]);

    React.useEffect(() => {
        if (!editingTask) return;
        if (editingTask.propertyId || editingTask.property_id) {
            const pid = editingTask.propertyId ?? editingTask.property_id;
            fetchServiceUsers(pid);
            fetchStaffForHotel(pid);
        }
    }, [editingTask]);

    async function fetchHotels(signal) {
        try {
            setHotelsLoading(true);
            const res = await api.get('/api/hotels', { params: { limit: 1000 }, signal });
            const normalized = normalizeHotelsResponse(res?.data ?? {});
            setHotels(normalized);
            if (normalized.length === 1 && !form.property) {
                setForm((f) => ({ ...f, property: normalized[0].id, propertyName: normalized[0].name }));
                fetchServiceUsers(normalized[0].id);
                fetchStaffForHotel(normalized[0].id);
            }
        } catch (err) {
            const isCanceled = err && (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || axios.isCancel?.(err));
            if (!isCanceled) {
                console.error('fetchHotels error:', err);
                setHotels([]);
            }
        } finally {
            setHotelsLoading(false);
        }
    }

    async function fetchServiceUsers(hotelId) {
        if (!hotelId) { setServiceUsers([]); return; }
        async function tryPath(path) {
            const r = await api.get(path);
            return r?.data?.data ?? r?.data ?? [];
        }

        try {
            const canonical = `/api/hotels/${hotelId}/service-users`;
            const rows = await tryPath(canonical);
            const normalized = (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ''}` })).filter(Boolean);
            setServiceUsers(normalized);
            return;
        } catch (err) { /* ignore */ }
        setServiceUsers([]);
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

            staffCacheRef.current[cacheKey] = normalized;
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

    React.useEffect(() => {
        if (!form.property) return;
        fetchStaffForHotel(form.property);
    }, [form.property]);

    function handlePropertyChange(e) {
        const hotelId = e.target.value;
        const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
        setForm((prev) => ({
            ...prev,
            property: hotelId,
            propertyName: hotel ? hotel.name : '',
            reportedBy: currentUser?.name || '',
            assignedTo: '',
            assignedToId: '',
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
        setForm((prev) => ({ ...prev, assignedTo: su ? `${su.first_name}` : '', assignedToId: su ? String(su.id) : '', serviceUserId: su ? String(su.id) : '' }));
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (submitting) return;
        const missing = [];
        if (!String(form.title || '').trim()) missing.push('Title');
        if (!String(form.description || '').trim()) missing.push('Description');
        if (!form.property) missing.push('Property');
        if (!form.category) missing.push('Category');
        if (!form.priority) missing.push('Priority');
        if (!String(form.reportedBy || '').trim()) missing.push('Reported By');
        if (!form.assignedTo) missing.push('Assigned To');
        if (!form.scheduledDate) missing.push('Scheduled Date');
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
            alert(`Please fill required fields: ${missing.join(', ')}.`);
            return;
        }
        onSubmit({ ...form, photos }, editingTask ? editingTask.id : undefined);
    };

    React.useEffect(() => {
        const ctrl = new AbortController();
        hotelsControllerRef.current = ctrl;
        fetchHotels(ctrl.signal);
        return () => { try { ctrl.abort(); } catch { }; hotelsControllerRef.current = null; };
    }, []);

    // --- VIEW ONLY RENDER ---
    if (readOnly) {
        return (
            <div className="modal-overlay">
                <div className="modal-container h-[70vh]">
                    <div className="modal-header">
                        <div>
                            <h2 className="modal-title">Task Details</h2>
                            <p className="modal-subtitle">View AIRE task information</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="modal-close-btn rounded-xl"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="modal-content text-left">
                        <div className="form-grid-2">
                            <DetailField label="Title" value={form.title} />
                            <DetailField label="Status" value={form.status} />
                            <DetailField label="Property" value={form.propertyName} />
                            <DetailField label="Category" value={form.category} />
                            <DetailField label="Scheduled Date" value={form.scheduledDate ? new Date(form.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : '-'} />
                            <DetailField label="Priority" value={form.priority} />
                            <DetailField label="Reported By" value={form.reportedBy} />
                            <DetailField label="Assigned To" value={form.assignedTo} />

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
                                if (valueText === null || valueText === undefined || valueText === '') valueText = '-';

                                if (isDateType && rawVal) {
                                    const d = new Date(rawVal);
                                    if (!Number.isNaN(d.getTime())) valueText = d.toISOString().slice(0, 10);
                                }

                                if (isBoolType) {
                                    const boolVal = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1' || rawVal === 'yes';
                                    valueText = boolVal ? 'Yes' : 'No';
                                }

                                return (
                                    <DetailField key={col} label={label} value={String(valueText)} fullWidth={inputType === 'textarea'} />
                                );
                            })}

                            <DetailField label="Description" value={form.description} fullWidth={true} />

                            {(() => {
                                let atts = editingTask?.attachments ?? editingTask?.raw?.attachments ?? [];
                                try {
                                    if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                                } catch {
                                    atts = [];
                                }
                                const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
                                if (list.length === 0) return null;
                                return (
                                    <div className="col-span-1 md:col-span-2 pt-2">
                                        <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2">ATTACHMENTS</div>
                                        <button
                                            type="button"
                                            onClick={() => openAttachmentsGallery(list)}
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-4 py-2 rounded-xl shadow-sm hover:bg-teal-100 transition-all"
                                        >
                                            <Eye className="w-4 h-4" />
                                            <span>View {list.length} Photos</span>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            onClick={onClose}
                            className="btn-secondary btn-sm rounded-xl"
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
                            className="btn-primary btn-sm flex items-center gap-2 rounded-xl"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- CREATE/EDIT RENDER ---
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative flex flex-col h-[70vh]">
                {/* Modal Header */}
                <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">
                        {editingTask ? "Edit Task" : "Create Task"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Form Content */}
                <form id="aire-form" onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                {error}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Row 1: Title (Full Width) */}
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Brief description of task"
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    required
                                />
                            </div>
                            {/* Row 2: Description (Full Width) */}
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Description <span className="text-red-500">*</span></label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={2}
                                    placeholder="Detailed description of the task..."
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
                                    required
                                />
                            </div>
                            {/* Row 3: Property & Category */}
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                                <select
                                    name="property"
                                    value={form.property}
                                    onChange={handlePropertyChange}
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    required
                                >
                                    <option value="">Select property</option>
                                    {hotelsLoading ? <option value="">Loading...</option> : hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Category <span className="text-red-500">*</span></label>
                                <select
                                    name="category"
                                    value={form.category}
                                    onChange={handleCategoryChange}
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    required
                                >
                                    <option value="">Select category</option>
                                    {['Maintenance', 'Inspection', 'General', ...customCategories].map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    {!!form.category && !['Maintenance', 'Inspection', 'General', ...customCategories].some((c) => String(c) === String(form.category)) && (
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
                                                className="px-3 py-2.5 bg-teal-500 text-white rounded-xl -xl hover:bg-teal-600 text-sm font-medium whitespace-nowrap transition-colors"
                                            >
                                                Add
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowCustomCategoryInput(false);
                                                    setCustomCategoryValue('');
                                                }}
                                                className="px-3 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium whitespace-nowrap transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Row 4: Priority & Reported By */}
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Priority <span className="text-red-500">*</span></label>
                                <select
                                    name="priority"
                                    value={form.priority}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    required
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Urgent">Urgent</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Reported By <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="reportedBy"
                                    value={form.reportedBy}
                                    readOnly
                                    required
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm bg-gray-100 cursor-not-allowed focus:outline-none"
                                />
                            </div>
                            {/* Row 5: Assigned To & Scheduled Date */}
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Assigned To <span className="text-red-500">*</span></label>
                                {form.property ? (
                                    <select
                                        name="assignedTo"
                                        value={form.assignedTo || ''}
                                        onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value, assignedToId: '' }))}
                                        disabled={!form.property || staffLoading}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                                        {staffUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        name="assignedTo"
                                        value={form.assignedTo}
                                        onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value, assignedToId: '', serviceUserId: '' }))}
                                        disabled={!form.property}
                                        placeholder={!form.property ? "Select property first" : "Name"}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        required
                                    />
                                )}
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    name="scheduledDate"
                                    value={form.scheduledDate}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    required
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Attach Photos</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        setPhotos(files);
                                    }}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white"
                                />
                                {photos.length > 0 && (
                                    <div className="text-xs text-gray-500 mt-2">{photos.length} photo(s) selected</div>
                                )}
                            </div>

                            {(() => {
                                if (!editingTask) return null;
                                let atts = editingTask?.attachments ?? editingTask?.raw?.attachments ?? [];
                                try {
                                    if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                                } catch {
                                    atts = [];
                                }
                                const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
                                if (list.length === 0) return null;
                                return (
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Uploaded Photos</label>
                                        <div className="flex flex-wrap gap-2">
                                            {list.map((id) => (
                                                <div key={String(id)} className="inline-flex items-center gap-2 border border-gray-200 bg-white rounded-xl px-3 py-2 shadow-sm">
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttachmentsGallery([id])}
                                                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors"
                                                        title="View"
                                                    >
                                                        View
                                                    </button>
                                                    <span className="w-px h-3 bg-gray-200" />
                                                    {!readOnly && typeof onRemoveAttachment === 'function' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onRemoveAttachment(editingTask.id, id)}
                                                            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                                                            title="Remove"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

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
                                                name={col}
                                                required
                                                value={form[col] === true ? 'true' : form[col] === false ? 'false' : (form[col] || '')}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                            >
                                                <option value="">Select...</option>
                                                <option value="true">Yes</option>
                                                <option value="false">No</option>
                                            </select>
                                        ) : inputType === 'dropdown' || inputType === 'select' ? (
                                            <select
                                                name={col}
                                                required
                                                value={form[col] || ''}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                            >
                                                <option value="">Select...</option>
                                                {options.map((opt, idx) => (
                                                    <option key={idx} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : inputType === 'textarea' ? (
                                            <textarea
                                                name={col}
                                                required
                                                rows={3}
                                                value={form[col] || ''}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            />
                                        ) : inputType === 'date' ? (
                                            <input
                                                type="date"
                                                name={col}
                                                required
                                                value={form[col] ? formatDateISO(form[col]) : ''}
                                                onChange={handleChange}
                                                className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            />
                                        ) : (
                                            <input
                                                type={inputType}
                                                name={col}
                                                required
                                                value={form[col] || ''}
                                                onChange={handleChange}
                                                placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                                                className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                        {error && <div className="text-sm text-red-500 mr-auto">{error}</div>}
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2.5 border border-gray-300 rounded-xl -xl text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="aire-form"
                            disabled={submitting}
                            className="px-4 py-2.5 bg-teal-500 text-white rounded-xl -xl hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                        >
                            {submitting ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}