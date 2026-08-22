/* eslint-disable no-empty */

/* eslint-disable no-unused-vars */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';

import axios from "axios";

import { usePermissions } from "../hooks/usePermissions";

import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { FiltersButton, FiltersDrawer, FilterField } from '../components/TableToolbar';

import {

    Home,

    Building,

    ClipboardList,

    Search,

    ChevronDown,

    Filter,

    Columns,

    Download,

    X,

    Edit,

    Trash2,

    AlertTriangle,

    CheckCircle,

    Clock,

    Zap,

    Check,

    Eye,

    EyeOff,

    ChevronRight,

    ListFilter,

    User,

    Users,

    AlertCircle

} from "lucide-react";

import { generatePDF } from "../utils/pdfGenerator";

import { generateCSV } from "../utils/csvGenerator";

import { DownloadDropdown } from "../components/DownloadDropdown";



/* Inject delete animation CSS once */

const DELETE_STYLE_ID = 'incidents-delete-anim';

if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {

    const style = document.createElement('style');

    style.id = DELETE_STYLE_ID;

    style.textContent = `

      @keyframes incidentSlideOut {

        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }

        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }

        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }

      }

      @keyframes incidentCardDelete {

        0%   { opacity: 1; transform: scale(1) rotate(0deg); }

        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }

        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }

      }

      tr.incident-deleting {

        animation: incidentSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;

        overflow: hidden;

        pointer-events: none;

      }

      .incident-card-deleting {

        animation: incidentCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;

        pointer-events: none;

      }

    `;

    document.head.appendChild(style);

}



/* axios instance */

const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";

const api = axios.create({

    baseURL: API_BASE,

    withCredentials: true,

    timeout: 15000,

});



/* Helper functions */

function formatDateISO(value) {

    if (!value) return "";

    try {

        const d = new Date(value);

        if (Number.isNaN(d.getTime())) return value;

        return d.toISOString().slice(0, 10);

    } catch { return value; }

}



function getInitials(name) {

    if (!name || name === "Unassigned") return "UA";

    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);

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



function normalizeHotelsResponse(data) {

    if (!data) return [];

    let items = [];

    if (Array.isArray(data)) items = data;

    else if (Array.isArray(data.data)) items = data.data;

    else if (Array.isArray(data.rows)) items = data.rows;

    else if (Array.isArray(data.hotels)) items = data.hotels;

    else if (typeof data === "object") {

        const vals = Object.values(data);

        const possibleObjects = vals.filter((v) => v && (v.id || v.name || v.hotel_name));

        if (possibleObjects.length && !Array.isArray(data)) {

            items = Array.isArray(possibleObjects[0]) ? possibleObjects[0] : possibleObjects;

        }

    }

    return items

        .map((h) => {

            const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;

            const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ""}`;

            const address = h?.address ?? null;

            return { id, name, address };

        })

        .filter((x) => x.id && x.name);

}



function formatDate(isoString) {

    if (!isoString) return "";

    try {

        const d = new Date(isoString);

        if (isNaN(d.getTime())) return isoString;

        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    } catch {

        return isoString;

    }

}



const DetailField = ({ label, value, fullWidth = false }) => (

    <div className={fullWidth ? "md:col-span-2" : ""}>

        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide block mb-1">{label}</label>

        <p className="text-[var(--text-primary)] font-medium">{value || '-'}</p>

    </div>

);



export default function Incidents({ user }) {

    const currentUser = user || (() => {

        try {

            const raw = localStorage.getItem("user");

            return raw ? JSON.parse(raw) : null;

        } catch {

            return null;

        }

    })();



    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);

    const hasRead = canRead("incidents");

    const hasCreate = canCreate("incidents");

    const hasUpdate = canUpdate("incidents");

    const hasDelete = canDelete("incidents");



    // Image gallery hook — opens in-page modal instead of new tab
    const { galleryOpen: _galleryOpen, galleryItems: _galleryItems, galleryTitle: _galleryTitle, galleryApi: _galleryApi, openGallery: _openGallery, closeGallery: _closeGallery } = useImageGallery();

    const [rows, setRows] = useState([]);

    const [deletingIds, setDeletingIds] = useState(new Set());

    const [hotels, setHotels] = useState([]);

    const [serviceUsers, setServiceUsers] = useState([]);

    const [staffUsers, setStaffUsers] = useState([]);

    const [staffLoading, setStaffLoading] = useState(false);

    const [hotelsLoading, setHotelsLoading] = useState(false);

    const [loading, setLoading] = useState(false);



    const [showModal, setShowModal] = useState(false);

    const [showViewModal, setShowViewModal] = useState(false);

    const [viewingIncident, setViewingIncident] = useState(null);

    const [editingId, setEditingId] = useState(null);



    const [showExportModal, setShowExportModal] = useState(false);

    const [exportFormat, setExportFormat] = useState(null);

    const [selectedExportKeys, setSelectedExportKeys] = useState([]);



    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState(null);

    const [query, setQuery] = useState("");



    const [severityFilter, setSeverityFilter] = useState("");

    const [statusFilter, setStatusFilter] = useState("");

    const [propertyFilter, setPropertyFilter] = useState("");

    const [sortBy, setSortBy] = useState("");



    const [showViewMenu, setShowViewMenu] = useState(false);

    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);

    const [showFilters, setShowFilters] = useState(false);

    const [viewMode, setViewMode] = useState('table');



    const hotelsControllerRef = useRef(null);

    const viewRef = useRef(null);



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



    const [formData, setFormData] = useState({

        incidentType: '',

        severity: 'Medium',

        propertyId: '',

        propertyName: '',

        serviceUserId: '',

        description: '',

        reportedBy: currentUser?.name || '',

        reportedDate: '',

        assignedTo: '',

        status: 'Open',

    });

    const [photos, setPhotos] = useState([]);



    const INCIDENT_TYPE_STORAGE_KEY = 'incidents.customIncidentTypes';

    const BUILTIN_INCIDENT_TYPES = [

        'Injury',

        'Property Damage',

        'Theft',

        'Noise Complaint',

    ];



    const [customIncidentTypes, setCustomIncidentTypes] = useState([]);

    const [showCustomIncidentTypeInput, setShowCustomIncidentTypeInput] = useState(false);

    const [customIncidentTypeValue, setCustomIncidentTypeValue] = useState('');



    useEffect(() => {

        try {

            const raw = localStorage.getItem(INCIDENT_TYPE_STORAGE_KEY);

            if (!raw) return;

            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {

                setCustomIncidentTypes(parsed.filter(Boolean).map(String));

            }

        } catch {

            setCustomIncidentTypes([]);

        }

    }, []);



    useEffect(() => {

        if (!showModal) {

            setShowCustomIncidentTypeInput(false);

            setCustomIncidentTypeValue('');

        }

    }, [showModal]);



    const persistCustomIncidentTypes = (list) => {

        try {

            localStorage.setItem(INCIDENT_TYPE_STORAGE_KEY, JSON.stringify(list));

        } catch { }

    };



    const handleIncidentTypeChange = (e) => {

        const value = e.target.value;

        if (value === '__add_new__') {

            setShowCustomIncidentTypeInput(true);

            setCustomIncidentTypeValue('');

            setFormData((p) => ({ ...p, incidentType: '' }));

            return;

        }

        setShowCustomIncidentTypeInput(false);

        setCustomIncidentTypeValue('');

        setFormData((p) => ({ ...p, incidentType: value }));

    };



    const saveCustomIncidentType = () => {

        const next = String(customIncidentTypeValue || '').trim();

        if (!next) return;

        const builtinLower = new Set(BUILTIN_INCIDENT_TYPES.map((t) => String(t).toLowerCase()));

        const merged = [...customIncidentTypes];

        if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {

            merged.push(next);

            setCustomIncidentTypes(merged);

            persistCustomIncidentTypes(merged);

        }

        setFormData((p) => ({ ...p, incidentType: next }));

        setShowCustomIncidentTypeInput(false);

        setCustomIncidentTypeValue('');

    };



    const [availableColumns, setAvailableColumns] = useState([

        "checkbox", "type", "reference", "description", "attachments",

        "priority", "status", "assigned", "date", "actions",

    ]);

    const [customColumns, setCustomColumns] = useState([]);

    const [customColumnMetadata, setCustomColumnMetadata] = useState({});



    const BASE_EXPORT_COLUMNS = useMemo(

        () => [

            { header: 'Title', key: 'title' },

            { header: 'Type', key: 'incidentType' },

            { header: 'Severity', key: 'severity' },

            { header: 'Property', key: 'propertyName' },

            { header: 'Status', key: 'status' },

            { header: 'Reported Date', key: 'reportedDate' },

            { header: 'Reported By', key: 'reportedBy' }

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



    const DEFAULT_COLUMNS = [

        "checkbox", "type", "reference", "description", "attachments",

        "priority", "status", "assigned", "date", "actions",

    ];



    const ALL_COLUMNS = availableColumns;



    const [visibleColumns, setVisibleColumns] = useState(() => {

        try {

            const saved = localStorage.getItem('incidentsVisibleColumns');

            if (saved) {

                const parsed = JSON.parse(saved);

                return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };

            }

        } catch (e) { }

        return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});

    });



    useEffect(() => {

        try {

            localStorage.setItem('incidentsVisibleColumns', JSON.stringify(visibleColumns));

        } catch (e) { }

    }, [visibleColumns]);



    const fetchAvailableColumns = useCallback(async () => {

        try {

            const res = await api.get('/api/forms-builder/tables/incidents/columns');

            const columns = res?.data?.columns || res?.data || [];

            const defaultColumns = [

                "checkbox", "type", "reference", "description", "attachments",

                "priority", "status", "assigned", "date", "actions",

            ];

            const systemColumns = [

                'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',

                'title', 'description', 'incident_type', 'priority', 'status',

                'assigned_to', 'assigned_to_id', 'assigned_to_name', 'service_user_id',

                'property_id', 'property_name', 'reported_date', 'reported_by',

                'severity', 'category', 'notes', 'attachments', 'tags', 'completed_date', 'raw',

            ];

            const customCols = columns

                .filter(col => !systemColumns.includes(col.column_name) && !defaultColumns.includes(col.column_name))

                .map(col => col.column_name);

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

            if (JSON.stringify(customCols) !== JSON.stringify(customColumns)) {

                setCustomColumns(customCols);

                setAvailableColumns(newColumns);

                setVisibleColumns(prev => {

                    const updated = { ...prev };

                    customCols.forEach(col => {

                        if (!(col in updated)) {

                            try {

                                const saved = localStorage.getItem('incidentsVisibleColumns');

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

                setFormData(prev => {

                    const updated = { ...prev };

                    customCols.forEach(col => {

                        if (!(col in updated)) updated[col] = '';

                    });

                    return updated;

                });

            }

        } catch (err) {

            console.warn('Failed to fetch columns:', err);

        }

    }, [customColumns]);



    useEffect(() => {

        fetchAvailableColumns();

    }, [fetchAvailableColumns]);



    const stats = useMemo(() => {

        const total = rows.length;

        const open = rows.filter((r) => (r.status || '').toLowerCase() === 'open').length;

        const inProgress = rows.filter((r) => (r.status || '').toLowerCase() === 'in progress').length;

        const resolved = rows.filter((r) => (r.status || '').toLowerCase() === 'resolved' || (r.status || '').toLowerCase() === 'completed').length;

        return { total, open, inProgress, resolved };

    }, [rows]);



    const filtered = useMemo(() => {

        const q = (query || "").trim().toLowerCase();

        let list = rows || [];

        if (q) {

            list = list.filter((r) => {

                const title = (r.title || "").toLowerCase();

                const description = (r.description || "").toLowerCase();

                const propertyName = (r.propertyName || r.property_name || "").toLowerCase();

                const status = (r.status || "").toLowerCase();

                const incidentType = (r.incidentType || r.incident_type || "").toLowerCase();

                const reference = (r.reference || r.id || "").toLowerCase();

                const reportedBy = (r.reportedBy || r.reported_by || "").toLowerCase();

                const assignedTo = (r.assignedTo || r.assigned_to || r.assigned_to_name || "").toLowerCase();

                const severity = (r.severity || "").toLowerCase();

                return title.includes(q) || description.includes(q) || propertyName.includes(q) ||

                    status.includes(q) || incidentType.includes(q) || reference.includes(q) ||

                    reportedBy.includes(q) || assignedTo.includes(q) || severity.includes(q);

            });

        }

        if (severityFilter) {

            list = list.filter((r) => (r.severity || "").toLowerCase() === severityFilter.toLowerCase());

        }

        if (statusFilter) {

            list = list.filter((r) => (r.status || "").toLowerCase() === statusFilter.toLowerCase());

        }

        if (propertyFilter) {

            list = list.filter((r) => String(r.propertyId || r.property_id || "") === String(propertyFilter));

        }

        if (sortBy) {

            list = [...list].sort((a, b) => {

                if (sortBy === 'date') {

                    const dateA = new Date(a.reportedDate || a.reported_date || 0);

                    const dateB = new Date(b.reportedDate || b.reported_date || 0);

                    return dateB - dateA;

                }

                if (sortBy === 'severity') {

                    const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };

                    const sevA = (a.severity || 'medium').toLowerCase();

                    const sevB = (b.severity || 'medium').toLowerCase();

                    return (severityOrder[sevA] || 2) - (severityOrder[sevB] || 2);

                }

                if (sortBy === 'status') {

                    return (a.status || '').toLowerCase().localeCompare((b.status || '').toLowerCase());

                }

                if (sortBy === 'type') {

                    const typeA = (a.incidentType || a.incident_type || '').toLowerCase();

                    const typeB = (b.incidentType || b.incident_type || '').toLowerCase();

                    return typeA.localeCompare(typeB);

                }

                return 0;

            });

        }

        return list;

    }, [rows, query, severityFilter, statusFilter, propertyFilter, sortBy]);



    const normalizeIncidentExportRow = (incident) => {

        const base = {

            title: incident.title || '-',

            incidentType: incident.incidentType || incident.incident_type || '-',

            severity: incident.severity || '-',

            propertyName: incident.propertyName || incident.property_name || incident.property || '-',

            status: incident.status || '-',

            reportedDate: incident.reportedDate || incident.reported_date || '-',

            reportedBy: incident.reportedBy || incident.reported_by || '-',

        };

        for (const col of customColumns || []) {

            base[col] = incident?.[col] ?? '';

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

            const data = (filtered || []).map(normalizeIncidentExportRow);

            if (exportFormat === 'pdf') {

                generatePDF(data, columns, 'Incidents Report', 'incidents-report');

            } else if (exportFormat === 'csv') {

                generateCSV(data, columns, 'incidents-report');

            }

            closeExport();

        } catch (error) {

            console.error('Error exporting incidents:', error);

            alert('Failed to download: ' + error.message);

        }

    };



    useEffect(() => {

        const ctrl = new AbortController();

        hotelsControllerRef.current = ctrl;

        fetchHotels(ctrl.signal);

        fetchIncidents();

        return () => {

            try { ctrl.abort(); } catch { }

            hotelsControllerRef.current = null;

        };

        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, []);



    useEffect(() => {

        if (showModal || showViewModal || confirmDialog.isOpen) {

            document.body.classList.add('form-modal-open');

        } else {

            document.body.classList.remove('form-modal-open');

        }

        return () => { document.body.classList.remove('form-modal-open'); };

    }, [showModal, showViewModal, confirmDialog.isOpen]);



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



    async function fetchIncidents() {

        try {

            setLoading(true);

            const res = await api.get('/api/incidents', { params: { limit: 200 } });

            const data = res?.data?.data ?? res?.data ?? [];

            if (!Array.isArray(data)) return setRows([]);

            const mapped = data.map((created) => ({

                ...created,

                ref: created.reference ?? created.ref ?? String(created.id ?? ''),

                title: created.type ?? created.title ?? (created.reference ?? ''),

                desc: created.description ?? created.desc ?? '',

                priority: created.severity ?? created.priority ?? 'Medium',

                status: created.status ?? 'Open',

                assigned: created.assigned_to ?? created.assigned ?? '',

                date: created.reported_date ?? created.created_at ?? created.reportedDate ?? null,

                propertyName: created.property_name ?? created.propertyName ?? null,

                serviceUserId: created.service_user_id ?? created.serviceUserId ?? null,

                raw: created,

            }));

            setRows(mapped);

        } catch (err) {

            console.error('fetchIncidents error', err);

            setRows([]);

        } finally {

            setLoading(false);

        }

    }



    async function fetchHotels(signal) {

        try {

            setHotelsLoading(true);

            const res = await api.get('/api/hotels', { params: { limit: 1000 }, signal });

            const normalized = normalizeHotelsResponse(res?.data ?? {});

            setHotels(normalized);

            if (normalized.length === 1 && !formData.propertyId) {

                setFormData((f) => ({ ...f, propertyId: normalized[0].id }));

                fetchServiceUsers(normalized[0].id);

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

            const rows = await tryPath(`/api/hotels/${hotelId}/service-users`);

            const normalized = (Array.isArray(rows) ? rows : [])

                .map((r) => ({ id: r.id, first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ''}` }))

                .filter(Boolean);

            setServiceUsers(normalized);

            return;

        } catch (err) { }

        const fallbacks = [

            `/api/su?hotel_id=${encodeURIComponent(hotelId)}`,

            `/api/su?hotelId=${encodeURIComponent(hotelId)}`,

            `/api/su?hotel=${encodeURIComponent(hotelId)}`,

            `/api/su/${encodeURIComponent(hotelId)}`,

            `/api/service_users?hotel_id=${encodeURIComponent(hotelId)}`,

            `/api/service_users/${encodeURIComponent(hotelId)}`,

        ];

        for (const path of fallbacks) {

            try {

                const rows = await tryPath(path);

                const normalized = (Array.isArray(rows) ? rows : [])

                    .map((r) => ({ id: r.id, first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ''}` }))

                    .filter(Boolean);

                if (normalized.length) { setServiceUsers(normalized); return; }

            } catch (err) { }

        }

        setServiceUsers([]);

    }



    async function fetchStaffForHotel(hotelId) {

        if (!hotelId) { setStaffUsers([]); return; }

        try {

            setStaffLoading(true);

            const tryPath = async (path) => { const r = await api.get(path); return r?.data; };

            const paths = [

                `/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,

                `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,

            ];

            let data = null;

            let lastErr = null;

            for (const p of paths) {

                try { data = await tryPath(p); if (data) break; } catch (e) { lastErr = e; }

            }

            if (!data) throw lastErr || new Error('Unable to load staff');

            const list = data?.staff ?? data?.users ?? data ?? [];

            const normalized = (Array.isArray(list) ? list : [])

                .map((u) => ({ id: u.id, name: u.name || u.email || `User ${u.id}`, email: u.email || null }))

                .filter((u) => u.id && u.name);

            setStaffUsers(normalized);

        } catch (err) {

            console.error('fetchStaffForHotel error:', err);

            setStaffUsers([]);

        } finally {

            setStaffLoading(false);

        }

    }



    // ── Single declaration of removeAttachment ──

    async function removeAttachment(attachmentId) {

        if (!attachmentId || submitting) return;

        try {

            setSubmitting(true);

            await api.delete(`/api/incidents/attachments/${encodeURIComponent(String(attachmentId))}`).catch(() => null);

            setFormData((p) => {

                let atts = p?.attachments ?? [];

                try {

                    if (typeof atts === 'string' && atts) atts = JSON.parse(atts);

                } catch {

                    atts = [];

                }

                const next = (Array.isArray(atts) ? atts : []).filter((x) => String(x) !== String(attachmentId));

                return { ...p, attachments: next };

            });

            await fetchIncidents();

        } catch (err) {

            console.warn('Failed to remove attachment', err);

        } finally {

            setSubmitting(false);

        }

    }



    function openAttachmentsGallery(attachments) {
        let atts = attachments || [];
        try { if (typeof atts === 'string' && atts) atts = JSON.parse(atts); } catch { atts = []; }
        const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
        if (!list.length) return;
        _openGallery(list, "Incident Photos", "/api/incidents/attachments");
    }



    const handleView = (row) => {

        setViewingIncident(row);

        setShowViewModal(true);

    };



    const handleEdit = async (row) => {

        if (!hasUpdate) { alert("You don't have permission to edit incidents."); return; }

        let record = row.raw ?? null;

        const baseFormData = {

            incidentType: record.type ?? record.incidentType ?? '',

            severity: record.severity ?? 'Medium',

            propertyId: record.property_id ?? record.propertyId ?? '',

            propertyName: record.property_name ?? record.propertyName ?? '',

            serviceUserId: record.service_user_id ?? record.serviceUserId ?? '',

            description: record.description ?? '',

            reportedBy: record.reported_by ?? record.reportedBy ?? '',

            reportedDate: record.reported_date ? String(record.reported_date).substring(0, 10) : '',

            assignedTo: record.assigned_to ?? record.assignedTo ?? '',

            status: record.status ?? 'Open',

        };

        const normalizedCustomFormData = customColumns && customColumns.length > 0

            ? customColumns.reduce((acc, col) => {

                const meta = customColumnMetadata[col] || {};

                const inputType = meta.input_type || 'text';

                const v = record[col];

                if (inputType === 'checkbox') {

                    if (v === true || String(v).toLowerCase() === 'true') acc[col] = 'true';

                    else if (v === false || String(v).toLowerCase() === 'false') acc[col] = 'false';

                    else acc[col] = '';

                } else {

                    acc[col] = v ?? '';

                }

                return acc;

            }, {})

            : {};



        let attachments = record.attachments ?? record.attachments_ids ?? record.photos ?? [];

        try {

            if (typeof attachments === 'string' && attachments) attachments = JSON.parse(attachments);

        } catch {

            attachments = [];

        }



        setFormData({ ...baseFormData, ...normalizedCustomFormData, attachments: Array.isArray(attachments) ? attachments : [] });

        if (record.property_id || record.propertyId) {

            const pid = record.property_id ?? record.propertyId;

            fetchServiceUsers(pid);

            fetchStaffForHotel(pid);

        }

        setEditingId(record.id ?? null);

        setShowModal(true);

    };



    const handleDelete = async (row) => {

        const id = row.raw?.id ?? null;

        if (!id) return;

        setConfirmDialog({

            isOpen: true,

            title: 'Delete Incident',

            message: 'Delete this incident? This action cannot be undone.',

            type: 'danger',

            onConfirm: async () => {

                try {

                    setDeletingIds(prev => new Set(prev).add(id));

                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

                    const ANIM_DURATION = 460;

                    setTimeout(() => {

                        setRows((prev) => prev.filter((r) => String(r.raw?.id) !== String(id)));

                        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });

                    }, ANIM_DURATION);

                    await api.delete(`/api/incidents/${id}`);

                } catch (err) {

                    console.error('delete incident error', err);

                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

                    setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });

                    setAlertDialog({

                        isOpen: true,

                        title: 'Delete Failed',

                        message: 'Unable to delete incident. See console for details.',

                        type: 'error'

                    });

                }

            }

        });

    };



    function handleInputChange(e) {

        const { name, type, value, checked } = e.target;

        if (type === 'checkbox') { setFormData((p) => ({ ...p, [name]: checked })); return; }

        setFormData((p) => ({ ...p, [name]: value }));

    }



    function handlePropertyChange(e) {

        const hotelId = e.target.value;

        const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;

        setFormData((p) => ({

            ...p,

            propertyId: hotelId,

            propertyName: hotel ? hotel.name : '',

            serviceUserId: '',

            reportedBy: currentUser?.name || '',

            assignedTo: '',

        }));

        setServiceUsers([]);

        setStaffUsers([]);

        if (hotelId) {

            fetchServiceUsers(hotelId);

            fetchStaffForHotel(hotelId);

        }

    }



    async function handleSubmit(e) {

        e.preventDefault();

        setSubmitting(true);

        setError(null);

        try {

            const missing = [];

            if (!formData.incidentType) missing.push('Incident Type');

            if (!formData.severity) missing.push('Severity');

            if (!formData.propertyId) missing.push('Property');

            if (!formData.serviceUserId) missing.push('Service User');

            if (!String(formData.description || '').trim()) missing.push('Description');

            if (!formData.reportedBy) missing.push('Reported By');

            if (!formData.reportedDate) missing.push('Reported Date');

            if (!formData.assignedTo) missing.push('Assigned To');

            if (!formData.status) missing.push('Status');

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

            const basePayload = {

                type: formData.incidentType,

                severity: formData.severity,

                property_id: formData.propertyId,

                property_name: formData.propertyName || null,

                service_user_id: formData.serviceUserId,

                description: formData.description,

                reported_by: formData.reportedBy,

                reported_date: formData.reportedDate,

                assigned_to: formData.assignedTo,

                status: formData.status,

            };

            const customPayload = customColumns && customColumns.length > 0

                ? customColumns.reduce((acc, col) => {

                    const value = formData[col];

                    const meta = customColumnMetadata[col] || {};

                    const inputType = meta.input_type || 'text';

                    if (inputType === 'checkbox') {

                        if (value === true || String(value).toLowerCase() === 'true') acc[col] = true;

                        else if (value === false || String(value).toLowerCase() === 'false') acc[col] = false;

                        else acc[col] = null;

                    } else {

                        acc[col] = value;

                    }

                    return acc;

                }, {})

                : {};

            const payload = { ...basePayload, ...customPayload };

            const hasPhotos = Array.isArray(photos) && photos.length > 0;

            let res;

            if (hasPhotos) {

                const fd = new FormData();

                Object.entries(payload).forEach(([k, v]) => {

                    if (v === undefined) return;

                    if (v === null) { fd.append(k, ''); return; }

                    if (typeof v === 'object') { fd.append(k, JSON.stringify(v)); return; }

                    fd.append(k, String(v));

                });

                delete payload.attachments;

                photos.forEach((f) => fd.append('photos', f));

                if (editingId) {

                    res = await api.put(`/api/incidents/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

                } else {

                    res = await api.post('/api/incidents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

                }

            } else {

                if (editingId) {

                    delete payload.attachments;

                    res = await api.put(`/api/incidents/${editingId}`, payload);

                } else {

                    delete payload.attachments;

                    res = await api.post('/api/incidents', payload);

                }

            }

            if (!res?.data?.success) {

                throw new Error(res?.data?.message || (editingId ? 'Failed to update incident' : 'Failed to create incident'));

            }

            await fetchIncidents();

            const wasEditing = !!editingId;

            setShowModal(false);

            setEditingId(null);

            setError(null);

            setPhotos([]);

            setAlertDialog({

                isOpen: true,

                title: 'Success',

                message: wasEditing ? 'Incident updated successfully!' : 'Incident created successfully!',

                type: 'success'

            });

        } catch (err) {

            console.error('Submit incident error:', err);

            const wasEditing = !!editingId;

            const errorMessage = err?.response?.data?.message || err?.message || (wasEditing ? 'Failed to update incident' : 'Failed to create incident');

            setError(errorMessage);

            setAlertDialog({ isOpen: true, title: 'Error', message: errorMessage, type: 'error' });

        } finally {

            setSubmitting(false);

        }

    }



    const openReportModal = () => {

        setEditingId(null);

        setPhotos([]);

        const baseFormData = {

            incidentType: '',

            severity: 'Medium',

            propertyId: '',

            propertyName: '',

            serviceUserId: '',

            description: '',

            reportedBy: currentUser?.name || '',

            reportedDate: '',

            assignedTo: '',

            status: 'Open',

        };

        const customFormData = customColumns && customColumns.length > 0

            ? customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})

            : {};

        setFormData({ ...baseFormData, ...customFormData });

        setStaffUsers([]);

        setShowModal(true);

    };



    const renderExistingAttachments = () => {

        const items = formData?.attachments || [];

        if (!items.length) return null;

        return (

            <div className="col-span-1 md:col-span-2 mt-8 space-y-4">

                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 ml-1">Existing Attachments</h3>

                {items.map((id, idx) => (

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
        );

    };



    return (

        <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            <div className="p-3 sm:p-4 md:p-6">

                {/* Page Header */}

                <div className="flex items-center justify-between mb-2">

                    <div>

                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">

                            <Home className="w-4 h-4" />

                            <ChevronRight className="w-3.5 h-3.5" />

                            <span>Property</span>

                            <ChevronRight className="w-3.5 h-3.5" />

                            <span className="text-[var(--text-primary)] font-medium">Incidents</span>

                        </div>

                        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Incidents Dashboard</h1>

                    </div>

                    <div className="flex items-center gap-3">

                        <DownloadDropdown

                            onDownloadPDF={() => openExport('pdf')}

                            onDownloadCSV={() => openExport('csv')}

                        />

                    </div>

                </div>



                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4 transition-all duration-200 hover:shadow-xs hover:-translate-y-0.5">
                        <div className="bg-[#20b2aa] text-white w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                            <ClipboardList size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Total Incidents</div>
                            <div className="text-2xl font-black text-slate-900 leading-none">{stats.total}</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4 transition-all duration-200 hover:shadow-xs hover:-translate-y-0.5">
                        <div className="bg-amber-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                            <Clock size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Open</div>
                            <div className="text-2xl font-black text-slate-900 leading-none">{stats.open}</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4 transition-all duration-200 hover:shadow-xs hover:-translate-y-0.5">
                        <div className="bg-purple-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                            <Zap size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">In Progress</div>
                            <div className="text-2xl font-black text-slate-900 leading-none">{stats.inProgress}</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4 transition-all duration-200 hover:shadow-xs hover:-translate-y-0.5">
                        <div className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                            <CheckCircle size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Resolved</div>
                            <div className="text-2xl font-black text-slate-900 leading-none">{stats.resolved}</div>
                        </div>
                    </div>
                </div>



                {/* Main Content Area */}

                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] shadow-sm overflow-hidden transition-all duration-200">

                    {/* Search & Filter Bar */}

                    <div className="p-6 pb-0">

                        <div className="mb-6">

                            <div className="flex items-center justify-between mb-4">

                                <div>

                                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Incidents Directory</h2>

                                    <p className="text-sm text-[var(--text-secondary)]">{stats.total} total records</p>

                                </div>

                                <div className="flex items-center gap-3">

                                    {/* Search Input */}

                                    <div className="relative">

                                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />

                                        <input

                                            type="text"

                                            value={query}

                                            onChange={e => setQuery(e.target.value)}

                                            placeholder="Search incidents..."

                                            className="h-9 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-64 text-[var(--text-primary)]"

                                        />

                                    </div>

                                    {/* Filters Toggle */}
                                    <FiltersButton
                                        activeCount={[severityFilter, statusFilter, propertyFilter, sortBy].filter(Boolean).length}
                                        onClick={() => setShowFilters(true)}
                                    />

                                    {/* View Dropdown */}

                                    <div className="relative" ref={viewRef}>

                                        <button

                                            onClick={() => setShowViewMenu(!showViewMenu)}

                                            className="h-9 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 text-xs font-medium flex items-center gap-2"

                                        >

                                            <Eye className="w-4 h-4" />

                                            <span className="font-semibold">{viewMode === 'table' ? 'Table' : 'Board'}</span>

                                            <ChevronDown className="w-4 h-4" />

                                        </button>



                                        {showViewMenu && (

                                            <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-surface)] rounded-xl shadow-2xl border border-[var(--border-color)] z-50">

                                                <div className="p-4">

                                                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">View settings</h3>

                                                    <div className="mb-3 pb-3 border-b border-gray-200">

                                                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Display Mode</div>

                                                        <div className="flex gap-1">

                                                            <button

                                                                onClick={() => setViewMode('table')}

                                                                className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1 ${viewMode === 'table' ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700'}`}

                                                            >

                                                                <Columns className="w-4 h-4" /><span>Table</span>

                                                            </button>

                                                            <button

                                                                onClick={() => setViewMode('board')}

                                                                className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1 ${viewMode === 'board' ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700'}`}

                                                            >

                                                                <ClipboardList className="w-4 h-4" /><span>Board</span>

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

                                                                    <span className="text-xs text-[var(--text-secondary)]/60">{Object.values(visibleColumns).filter(Boolean).length} shown</span>

                                                                    <ChevronDown className={`w-4 h-4 transition-transform ${showPropertyVisibility ? 'rotate-180' : ''}`} />

                                                                </div>

                                                            </button>



                                                            {showPropertyVisibility && (

                                                                <div className="mt-2 border-t border-gray-200 pt-3 max-h-96 overflow-y-auto">

                                                                    <div className="mb-4">

                                                                        <div className="flex items-center justify-between mb-2">

                                                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Default Columns</span>

                                                                            <div className="flex items-center gap-2">

                                                                                <button onClick={() => { const u = {}; DEFAULT_COLUMNS.forEach(c => u[c] = true); setVisibleColumns(p => ({ ...p, ...u })); }} className="text-xs text-teal-600 font-medium">Show all</button>

                                                                                <span className="text-gray-300">|</span>

                                                                                <button onClick={() => { const u = {}; DEFAULT_COLUMNS.forEach(c => u[c] = false); setVisibleColumns(p => ({ ...p, ...u })); }} className="text-xs text-teal-600 font-medium">Hide all</button>

                                                                            </div>

                                                                        </div>

                                                                        <div className="text-xs text-gray-500 mb-2">Toggle column visibility by clicking</div>

                                                                        <div className="space-y-1">

                                                                            {DEFAULT_COLUMNS.map(col => (

                                                                                <button

                                                                                    key={col}

                                                                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })}

                                                                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors border ${visibleColumns[col] ? 'text-gray-700 border-gray-200 bg-white' : 'text-gray-500 border-gray-100 bg-gray-50'}`}

                                                                                >

                                                                                    <span className="capitalize font-medium">{col}</span>

                                                                                    {visibleColumns[col] ? <Eye className="w-4 h-4 text-teal-600" /> : <EyeOff className="w-4 h-4 text-[var(--text-secondary)]/60" />}

                                                                                </button>

                                                                            ))}

                                                                        </div>

                                                                    </div>



                                                                    {customColumns.length > 0 && (

                                                                        <div className="pt-4 border-t border-gray-200">

                                                                            <div className="flex items-center justify-between mb-2">

                                                                                <div className="flex items-center gap-2">

                                                                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Custom Columns</span>

                                                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{customColumns.length}</span>

                                                                                </div>

                                                                                <div className="flex items-center gap-2">

                                                                                    <button onClick={() => { const u = {}; customColumns.forEach(c => u[c] = true); setVisibleColumns(p => ({ ...p, ...u })); }} className="text-xs text-teal-600 font-medium">Show all</button>

                                                                                    <span className="text-gray-300">|</span>

                                                                                    <button onClick={() => { const u = {}; customColumns.forEach(c => u[c] = false); setVisibleColumns(p => ({ ...p, ...u })); }} className="text-xs text-teal-600 font-medium">Hide all</button>

                                                                                </div>

                                                                            </div>

                                                                            <div className="text-xs text-gray-500 mb-2">Custom columns from Forms Builder <span className="text-blue-600 ml-1">(Auto-refreshes every 5s)</span></div>

                                                                            <div className="space-y-1">

                                                                                {customColumns.map(col => (

                                                                                    <button

                                                                                        key={col}

                                                                                        onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })}

                                                                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors border ${visibleColumns[col] ? 'text-gray-700 border-gray-200 bg-white' : 'text-gray-500 border-gray-100 bg-gray-50'}`}

                                                                                    >

                                                                                        <span className="capitalize">{col.replace(/_/g, ' ')}</span>

                                                                                        {visibleColumns[col] ? <Eye className="w-4 h-4 text-teal-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}

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

                                            onClick={openReportModal}

                                            className="h-9 bg-teal-500 text-white font-semibold rounded-xl px-4 text-xs flex items-center gap-2 shadow-sm"

                                        >

                                            <ClipboardList className="w-4 h-4" />

                                            <span>Report Incident</span>

                                        </button>

                                    )}

                                </div>

                            </div>



                            {/* Export Modal */}

                            {showExportModal && (

                                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">

                                    <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">

                                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">

                                            <div>

                                                <div className="text-lg font-semibold text-gray-900">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>

                                                <div className="text-xs text-gray-500 mt-0.5">Select the columns you want to include</div>

                                            </div>

                                            <button onClick={closeExport} className="p-2 rounded-xl text-gray-500" aria-label="Close"><X className="w-5 h-5" /></button>

                                        </div>

                                        <div className="px-5 py-4">

                                            <div className="flex items-center justify-between mb-3">

                                                <div className="text-sm font-medium text-gray-700">Columns</div>

                                                <div className="flex items-center gap-3 text-xs">

                                                    <button onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))} className="text-teal-600 font-medium">Select all</button>

                                                    <button onClick={() => setSelectedExportKeys([])} className="text-gray-600 font-medium">Clear</button>

                                                </div>

                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto pr-1">

                                                {exportColumns.map((col) => {

                                                    const checked = (selectedExportKeys || []).includes(col.key);

                                                    return (

                                                        <label key={col.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">

                                                            <input

                                                                type="checkbox"

                                                                checked={checked}

                                                                onChange={(e) => {

                                                                    const isChecked = e.target.checked;

                                                                    setSelectedExportKeys((prev) => {

                                                                        const set = new Set(prev || []);

                                                                        if (isChecked) set.add(col.key); else set.delete(col.key);

                                                                        return Array.from(set);

                                                                    });

                                                                }}

                                                                className="h-4 w-4 accent-teal-600 rounded"

                                                            />

                                                            <span className="text-sm text-gray-800">{col.header}</span>

                                                        </label>

                                                    );

                                                })}

                                            </div>

                                        </div>

                                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">

                                            <button onClick={closeExport} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200">Cancel</button>

                                            <button onClick={runExport} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-teal-600">Download</button>

                                        </div>

                                    </div>

                                </div>

                            )}



                        </div>

                    </div>



                    {/* Data Display - Table or Board View */}

                    {viewMode === 'table' ? (

                        <div className="overflow-x-auto border-t border-gray-100 relative">

                            <table className="w-full">

                                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                    <tr>

                                        {ALL_COLUMNS.map(col => (

                                            visibleColumns[col] && (

                                                <th

                                                    key={col}

                                                    className={`${col === 'actions' ? 'text-center sticky right-0 z-10 bg-[var(--bg-primary)]' : 'text-left'} py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider`}

                                                    style={col === 'actions' ? { boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' } : undefined}

                                                >

                                                    {col === 'checkbox' ? (

                                                        <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />

                                                    ) : col === 'actions' ? 'ACTIONS' : col.replace(/_/g, ' ').toUpperCase()}

                                                </th>

                                            )

                                        ))}

                                    </tr>

                                </thead>

                                <tbody className="bg-[var(--bg-surface)] divide-y divide-[var(--border-color)]">

                                    {loading ? (

                                        <tr><td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td></tr>

                                    ) : filtered.length > 0 ? (

                                        filtered.map((row) => {

                                            const isDeleting = deletingIds.has(row.raw?.id);

                                            return (

                                                <tr key={row.ref} className={`transition-colors border-b border-gray-100 last:border-0 ${isDeleting ? 'incident-deleting' : 'hover:bg-[var(--bg-primary)]/60'}`}>

                                                    {ALL_COLUMNS.map((col) => (

                                                        visibleColumns[col] ? (

                                                            <td

                                                                key={col}

                                                                className={`py-4 px-4 ${col === 'date' || col === 'reference' ? 'whitespace-nowrap' : ''} ${col === 'actions' ? 'text-center sticky right-0 z-10 bg-white' : ''}`}

                                                                style={col === 'actions' ? { boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' } : undefined}

                                                            >

                                                                {(() => {

                                                                    if (col === 'checkbox') return <input type="checkbox" className="rounded border-[var(--border-color)] text-teal-500 focus:ring-teal-500" />;

                                                                    if (col === 'type') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">{row.title || 'Incident'}</span>;

                                                                    if (col === 'reference') return <span className="text-[var(--text-primary)] font-semibold text-sm whitespace-nowrap">{row.ref}</span>;

                                                                    if (col === 'description') return (

                                                                        <div>

                                                                            <div className={`text-[var(--text-primary)] font-medium ${hasUpdate ? 'cursor-pointer' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`} onClick={hasUpdate ? () => handleEdit(row) : undefined}>

                                                                                <Home className="w-4 h-4 text-[var(--text-secondary)]/60" />

                                                                                <span>{hotels.find(h => h.id == row.propertyId)?.name || row.propertyName || 'Unknown Property'}</span>

                                                                            </div>

                                                                            <div className="text-[var(--text-secondary)] text-xs mt-1 truncate max-w-[200px]">{row.desc || 'No description recorded.'}</div>

                                                                        </div>

                                                                    );

                                                                    if (col === 'attachments') {

                                                                        let atts = row.raw?.attachments ?? [];

                                                                        try { if (typeof atts === 'string' && atts) atts = JSON.parse(atts); } catch { atts = []; }

                                                                        const list = Array.isArray(atts) ? atts.filter(Boolean) : [];

                                                                        if (list.length === 0) return <span className="text-gray-400 text-sm">—</span>;

                                                                        return (

                                                                            <button

                                                                                type="button"

                                                                                onClick={() => openAttachmentsGallery(row.raw?.attachments ?? row.attachments)}

                                                                                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-xl"

                                                                                title="View attachments"

                                                                            >

                                                                                <span>{list.length}</span>

                                                                                <span className="text-xs font-bold uppercase tracking-wide">Photos</span>

                                                                            </button>

                                                                        );

                                                                    }

                                                                    if (col === 'priority') { const style = getPriorityColor(row.priority || "Medium"); return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${style.dot} shadow-sm`}></span><span className={`text-sm font-semibold ${style.text}`}>{row.priority || 'Medium'}</span></div>; }

                                                                    if (col === 'status') { const style = getStatusColor(row.status || 'pending'); return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${style.dot} shadow-sm`}></span><span className={`text-sm font-semibold ${style.text}`}>{row.status || 'Pending'}</span></div>; }

                                                                    if (col === 'assigned') return !row.assigned || row.assigned === 'Unassigned' ? <span className="text-[var(--text-secondary)]/60 text-sm">Unassigned</span> : <div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-full ${getAvatarColor(row.assigned)} flex items-center justify-center text-xs font-semibold`}>{getInitials(row.assigned)}</div><span className="text-[var(--text-primary)] text-sm font-medium">{row.assigned}</span></div>;



                                                                    if (col === 'date') return <span className="text-[var(--text-primary)] font-medium text-sm">{formatDate(row.date)}</span>;

                                                                    if (col === 'actions') return (

                                                                        <div className="flex items-center justify-center gap-1">

                                                                            <button onClick={() => handleView(row)} className="p-1.5 text-[var(--text-secondary)] rounded-xl transition-all" title="View"><Eye className="w-4 h-4" /></button>

                                                                            {hasUpdate && <button onClick={() => handleEdit(row)} className="p-1.5 text-[var(--text-secondary)] rounded-xl transition-all" title="Edit"><Edit className="w-4 h-4" /></button>}

                                                                            {hasDelete && <button onClick={() => handleDelete(row)} className="p-1.5 text-[var(--text-secondary)] rounded-xl transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>}

                                                                        </div>

                                                                    );

                                                                    if (customColumns.includes(col)) return <span className="text-gray-900 font-medium text-sm">{row.raw?.[col] ?? ''}</span>;

                                                                    return null;

                                                                })()}

                                                            </td>

                                                        ) : null

                                                    ))}

                                                </tr>

                                            );

                                        })

                                    ) : (

                                        <tr><td colSpan="9" className="py-8 text-center text-gray-500">No incidents found.</td></tr>

                                    )}

                                </tbody>

                            </table>

                        </div>

                    ) : (

                        /* Board/Kanban View */

                        <div className="overflow-x-auto p-6">

                            <div className="flex gap-4 min-w-max pb-4">

                                {['Open', 'In Progress', 'Resolved'].map((status) => {

                                    const statusItems = filtered.filter(

                                        (row) => (row.status || '').toLowerCase() === status.toLowerCase()

                                    );

                                    const getStatusStyle = (s) => {

                                        if (s === 'Open') return { bg: 'bg-[var(--bg-primary)]', border: 'border-[var(--border-color)]', header: 'bg-[var(--bg-surface)]', text: 'text-[var(--color-warning)]', dot: 'bg-orange-500' };

                                        if (s === 'In Progress') return { bg: 'bg-[var(--bg-primary)]', border: 'border-[var(--border-color)]', header: 'bg-[var(--bg-surface)]', text: 'text-[var(--color-info)]', dot: 'bg-purple-500' };

                                        if (s === 'Resolved') return { bg: 'bg-[var(--bg-primary)]', border: 'border-[var(--border-color)]', header: 'bg-[var(--bg-surface)]', text: 'text-[var(--color-success)]', dot: 'bg-emerald-500' };

                                        return { bg: 'bg-[var(--bg-primary)]', border: 'border-[var(--border-color)]', header: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-primary)]', dot: 'bg-gray-500' };

                                    };

                                    const style = getStatusStyle(status);

                                    return (

                                        <div key={status} className="flex-shrink-0 w-80">

                                            <div className={`rounded-xl border ${style.border} ${style.bg}`}>

                                                {/* Column Header */}

                                                <div className={`${style.header} px-4 py-3 rounded-t-xl border-b ${style.border}`}>

                                                    <div className="flex items-center justify-between">

                                                        <div className="flex items-center gap-2">

                                                            <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>

                                                            <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>{status}</h3>

                                                        </div>

                                                        <span className="bg-[var(--bg-surface)] px-2 py-0.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)]">{statusItems.length}</span>

                                                    </div>

                                                </div>



                                                {/* Cards Container */}

                                                <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">

                                                    {statusItems.length === 0 ? (

                                                        <div className="text-center py-8 px-4">

                                                            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-[var(--text-secondary)]/40" />

                                                            <p className="text-[var(--text-secondary)] text-sm">No incidents</p>

                                                        </div>

                                                    ) : (

                                                        statusItems.map((row) => {

                                                            const priorityStyle = getPriorityColor(row.priority || "Medium");

                                                            const isDeleting = deletingIds.has(row.raw?.id);

                                                            return (

                                                                <div

                                                                    key={row.ref}

                                                                    className={`bg-[var(--bg-surface)] rounded-xl p-4 shadow-sm border border-[var(--border-color)] transition-all cursor-pointer ${isDeleting ? 'incident-card-deleting' : ''}`}

                                                                    onClick={() => handleView(row)}

                                                                >

                                                                    <div className="flex items-center justify-between mb-2">

                                                                        <span className="text-xs font-mono text-[var(--text-secondary)]/60">{row.ref}</span>

                                                                        <div className="flex items-center gap-1.5">

                                                                            <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>

                                                                            <span className={`text-xs font-medium ${priorityStyle.text}`}>{row.priority}</span>

                                                                        </div>

                                                                    </div>

                                                                    <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-2 line-clamp-2">{row.title || "Incident"}</h4>

                                                                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs mb-2">

                                                                        <Home className="w-3 h-3" />

                                                                        <span className="truncate">{hotels.find(h => h.id == row.propertyId)?.name || row.propertyName || "Unknown Property"}</span>

                                                                    </div>

                                                                    {row.desc && <p className="text-xs text-[var(--text-secondary)]/60 mb-3 line-clamp-2">{row.desc}</p>}

                                                                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mb-2">

                                                                        <div className="flex items-center gap-2">

                                                                            {row.assigned && row.assigned !== 'Unassigned' ? (

                                                                                <>

                                                                                    <div className={`w-6 h-6 rounded-full ${getAvatarColor(row.assigned)} flex items-center justify-center text-xs font-semibold`}>{getInitials(row.assigned)}</div>

                                                                                    <span className="text-xs text-[var(--text-primary)] truncate max-w-[100px]">{row.assigned}</span>

                                                                                </>

                                                                            ) : (

                                                                                <span className="text-xs text-[var(--text-secondary)]/60">Unassigned</span>

                                                                            )}

                                                                        </div>

                                                                        <span className="text-xs text-[var(--text-secondary)]/60">{formatDate(row.date)}</span>

                                                                    </div>

                                                                    <div className="flex items-center gap-1">

                                                                        <button onClick={(e) => { e.stopPropagation(); handleView(row); }} className="flex-1 py-1.5 px-2 bg-[var(--bg-primary)]/50 text-[var(--text-primary)] rounded-xl text-xs font-medium flex items-center justify-center gap-1" title="View">

                                                                            <Eye className="w-3.5 h-3.5" />View

                                                                        </button>

                                                                        {hasUpdate && (

                                                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="p-1.5 bg-[var(--bg-primary)]/50 text-[var(--text-primary)] rounded-xl" title="Edit"><Edit className="w-3.5 h-3.5" /></button>

                                                                        )}

                                                                        {hasDelete && (

                                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="p-1.5 bg-[var(--bg-primary)]/50 text-[var(--text-primary)] rounded-xl" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>

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



                {/* ── Create / Edit Modal ── */}

                {showModal && (

                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-hidden">

                        <div className="bg-[var(--bg-surface)] rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[70vh]">

                            {/* Modal Header */}

                            <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200">

                                <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit Incident" : "Report Incident"}</h2>

                                <button

                                    onClick={() => { setShowModal(false); setError(null); setEditingId(null); setPhotos([]); }}

                                    className="text-gray-400 transition-colors rounded-xl"

                                >

                                    <X className="w-5 h-5" />

                                </button>

                            </div>



                            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">

                                {error && (

                                    <div className="mb-4 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">

                                        <p className="text-sm text-red-700">{error}</p>

                                    </div>

                                )}

                                <div className="flex-1 overflow-y-auto p-4">

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                        {/* Incident Type */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Incident Type <span className="text-red-500">*</span></label>

                                            <select name="incidentType" required value={formData.incidentType} onChange={handleIncidentTypeChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                <option value="">Select type</option>

                                                {[...BUILTIN_INCIDENT_TYPES, ...customIncidentTypes].map((t) => (

                                                    <option key={t} value={t}>{t}</option>

                                                ))}

                                                {formData.incidentType && ![...BUILTIN_INCIDENT_TYPES, ...customIncidentTypes].some((t) => String(t) === String(formData.incidentType)) && (

                                                    <option value={formData.incidentType}>{formData.incidentType}</option>

                                                )}

                                                <option value="__add_new__">+ Add new...</option>

                                            </select>

                                            {showCustomIncidentTypeInput && (

                                                <div className="mt-2 flex gap-2">

                                                    <input

                                                        type="text"

                                                        value={customIncidentTypeValue}

                                                        onChange={(e) => setCustomIncidentTypeValue(e.target.value)}

                                                        placeholder="Enter new incident type"

                                                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"

                                                    />

                                                    <button type="button" onClick={saveCustomIncidentType} className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium">Save</button>

                                                    <button type="button" onClick={() => { setShowCustomIncidentTypeInput(false); setCustomIncidentTypeValue(''); }} className="px-3 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium">Cancel</button>

                                                </div>

                                            )}

                                        </div>



                                        {/* Severity */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Severity <span className="text-red-500">*</span></label>

                                            <select name="severity" required value={formData.severity} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                <option value="Low">Low</option>

                                                <option value="Medium">Medium</option>

                                                <option value="High">High</option>

                                                <option value="Urgent">Urgent</option>

                                            </select>

                                        </div>



                                        {/* Property */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Property <span className="text-red-500">*</span></label>

                                            <select name="propertyId" required value={formData.propertyId} onChange={handlePropertyChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                <option value="">Select property</option>

                                                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}

                                            </select>

                                            {hotelsLoading && <div className="text-xs text-[var(--text-secondary)]/60 mt-0.5">Loading hotels...</div>}

                                        </div>



                                        {/* Service User */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Service User <span className="text-red-500">*</span></label>

                                            <select name="serviceUserId" required value={formData.serviceUserId} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                <option value="">Select service user</option>

                                                {serviceUsers.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}

                                            </select>

                                        </div>



                                        {/* Description */}

                                        <div className="col-span-1 md:col-span-2">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Description <span className="text-red-500">*</span></label>

                                            <textarea name="description" required rows={3} value={formData.description} onChange={handleInputChange} placeholder="Detailed description of the incident..." className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y bg-[var(--bg-surface)] text-[var(--text-primary)]" />

                                        </div>



                                        {/* Reported By */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Reported By <span className="text-red-500">*</span></label>

                                            <input type="text" name="reportedBy" required value={formData.reportedBy} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]" />

                                        </div>



                                        {/* Reported Date */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Reported Date <span className="text-red-500">*</span></label>

                                            <input type="date" name="reportedDate" required value={formData.reportedDate} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]" />

                                        </div>



                                        {/* Assigned To */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Assigned To <span className="text-red-500">*</span></label>

                                            {staffUsers.length > 0 ? (

                                                <select name="assignedTo" required value={formData.assignedTo} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                    <option value="">Select staff</option>

                                                    {staffUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}

                                                </select>

                                            ) : (

                                                <input type="text" name="assignedTo" required value={formData.assignedTo} onChange={handleInputChange} placeholder={staffLoading ? "Loading staff..." : "Enter name"} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]" />

                                            )}

                                        </div>



                                        {/* Status */}

                                        <div className="col-span-1">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Status <span className="text-red-500">*</span></label>

                                            <select name="status" required value={formData.status} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                <option value="Open">Open</option>

                                                <option value="In Progress">In Progress</option>

                                                <option value="Resolved">Resolved</option>

                                            </select>

                                        </div>



                                        <div className="col-span-1 md:col-span-2 mt-4">

                                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Attachments</label>

                                            <input

                                                type="file"

                                                accept="image/*"

                                                multiple

                                                onChange={(e) => { const files = Array.from(e.target.files || []); setPhotos(files); }}

                                                className="w-full border border-[var(--border-color)] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all"

                                            />

                                        </div>



                                        {/* Existing Attachments (edit mode) */}

                                        {renderExistingAttachments()}



                                        {/* Custom Columns from Forms Builder */}

                                        {customColumns.map((col) => {

                                            const meta = customColumnMetadata[col] || {};

                                            const inputType = meta.input_type || 'text';

                                            const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                                            return (

                                                <div key={col} className="col-span-1 md:col-span-2">

                                                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">

                                                        {col.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())} <span className="text-red-500">*</span>

                                                    </label>

                                                    {inputType === 'checkbox' ? (

                                                        <select name={col} required value={formData[col] === true ? 'true' : formData[col] === false ? 'false' : (formData[col] || '')} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                            <option value="">Select...</option>

                                                            <option value="true">Yes</option>

                                                            <option value="false">No</option>

                                                        </select>

                                                    ) : inputType === 'dropdown' || inputType === 'select' ? (

                                                        <select name={col} required value={formData[col] || ''} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]">

                                                            <option value="">Select...</option>

                                                            {options.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}

                                                        </select>

                                                    ) : inputType === 'textarea' ? (

                                                        <textarea name={col} required rows={3} value={formData[col] || ''} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y bg-[var(--bg-surface)] text-[var(--text-primary)]" />

                                                    ) : (

                                                        <input name={col} type={inputType} required value={formData[col] || ''} onChange={handleInputChange} className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]" />

                                                    )}

                                                </div>

                                            );

                                        })}

                                    </div>

                                </div>



                                {/* Footer Buttons */}

                                <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50 rounded-b-xl">

                                    <button type="button" onClick={() => { setShowModal(false); setError(null); setEditingId(null); setPhotos([]); }} className="px-4 py-1.5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] font-medium text-sm">Cancel</button>

                                    <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-teal-500 text-white rounded-xl font-medium shadow-sm text-sm">

                                        {submitting ? "Saving..." : (editingId ? "Update Incident" : "Report Incident")}

                                    </button>

                                </div>

                            </form>

                        </div>

                    </div>

                )}



                {/* ── View Details Modal ── */}

                {showViewModal && viewingIncident && (

                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-hidden">

                        <div className="bg-[var(--bg-surface)] rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[70vh]">

                            <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200">

                                <div>

                                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Incident Details</h2>

                                    <p className="text-sm text-[var(--text-secondary)]">View incident information</p>

                                </div>

                                <button onClick={() => setShowViewModal(false)} className="text-gray-400 rounded-xl"><X className="w-5 h-5" /></button>

                            </div>



                            <div className="flex-1 overflow-y-auto p-4">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    <DetailField label="Reference" value={viewingIncident.ref} />

                                    <DetailField label="Reported Date" value={formatDate(viewingIncident.date)} />

                                    <DetailField label="Title" value={viewingIncident.title} />

                                    <DetailField

                                        label="Property"

                                        value={

                                            hotels.find(h => h.id == viewingIncident.propertyId)?.name ||

                                            viewingIncident.propertyName ||

                                            viewingIncident.property ||

                                            'Unknown Property'

                                        }

                                    />

                                    <DetailField label="Priority" value={viewingIncident.priority} />

                                    <DetailField label="Status" value={viewingIncident.status} />

                                    <DetailField label="Reported By" value={viewingIncident.reportedBy || viewingIncident.reported_by} />

                                    <DetailField label="Assigned To" value={viewingIncident.assigned} />

                                    <DetailField label="Service User" value={viewingIncident.serviceUserId} />



                                    {/* Attachments */}

                                    {(() => {

                                        let list = viewingIncident.raw?.attachments ?? viewingIncident.attachments ?? viewingIncident.attachments_ids ?? viewingIncident.photos ?? [];

                                        try {

                                            if (typeof list === 'string' && list) list = JSON.parse(list);

                                        } catch {

                                            list = [];

                                        }

                                        const items = (Array.isArray(list) ? list : []).filter(Boolean);

                                        if (!items.length) return null;

                                        return (

                                            <div className="md:col-span-2">

                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Attachments</label>

                                                <button

                                                    type="button"

                                                    onClick={() => openAttachmentsGallery(items)}

                                                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-4 py-2 rounded-xl shadow-sm"

                                                >

                                                    <Eye className="w-4 h-4" />

                                                    <span>View {items.length} Photos</span>

                                                </button>

                                            </div>

                                        );

                                    })()}



                                    <DetailField label="Description" value={viewingIncident.desc} fullWidth={true} />



                                    {/* Custom columns */}

                                    {customColumns.map((col) => {

                                        const meta = customColumnMetadata?.[col] || {};

                                        const label = String(meta.label || col).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

                                        const rawVal = viewingIncident?.raw?.[col] ?? viewingIncident?.[col];

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

                                        return <DetailField key={col} label={label} value={String(valueText)} />;

                                    })}

                                </div>

                            </div>



                            <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">

                                <button onClick={() => setShowViewModal(false)} className="px-4 py-1.5 border border-gray-300 rounded-xl text-gray-700 font-medium text-sm">Close</button>

                                {hasUpdate && (

                                    <button

                                        onClick={() => { setShowViewModal(false); handleEdit(viewingIncident); }}

                                        className="px-4 py-1.5 bg-teal-500 text-white rounded-xl font-medium shadow-sm text-sm flex items-center gap-2"

                                    >

                                        <Edit className="w-4 h-4" />Edit

                                    </button>

                                )}

                            </div>

                        </div>

                    </div>

                )}



                {/* Filters Drawer */}
                <FiltersDrawer
                    isOpen={showFilters}
                    onClose={() => setShowFilters(false)}
                    onClear={() => { setSeverityFilter(''); setStatusFilter(''); setPropertyFilter(''); setSortBy(''); }}
                >
                    <FilterField label="Severity" icon={Filter} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                        <option value="">All Severity</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </FilterField>

                    <FilterField label="Status" icon={CheckCircle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All Status</option>
                        <option value="open">Open</option>
                        <option value="in progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                    </FilterField>

                    <FilterField label="Property" icon={Building} value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
                        <option value="">All Properties</option>
                        {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </FilterField>

                    <FilterField label="Sort By" icon={ListFilter} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="">Sort By</option>
                        <option value="date">Date (Newest)</option>
                        <option value="severity">Severity</option>
                        <option value="status">Status</option>
                        <option value="type">Type</option>
                    </FilterField>
                </FiltersDrawer>

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

            <ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />

        </div>

    );

}