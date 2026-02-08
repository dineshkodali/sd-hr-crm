/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
  Home,
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
  EyeOff
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

/* axios instance (matches your other pages) */
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

/* helper for normalizing hotels responses */
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

/* format date like "Feb 8, 2025" */
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

/* Helper for View Details */
const DetailField = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
    <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
  </div>
);

export default function Incidents({ user }) {
  // Get user from localStorage if not passed as prop
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for inspections module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("incidents");
  const hasCreate = canCreate("incidents");
  const hasUpdate = canUpdate("incidents");
  const hasDelete = canDelete("incidents");

  const [rows, setRows] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal States
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

  // Filter and Sort State
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [sortBy, setSortBy] = useState("");

  // View Dropdown States
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'

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
    reportedBy: '',
    reportedDate: '',
    assignedTo: '',
    status: 'Open',
  });

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
    } catch {
      // ignore storage errors
    }
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

  const ALL_COLUMNS = availableColumns;

  // Column visibility state - default columns visible, custom columns from localStorage or hidden
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('incidentsVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load visible columns from localStorage:', e);
    }
    return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('incidentsVisibleColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn('Failed to save visible columns to localStorage:', e);
    }
  }, [visibleColumns]);

  // Fetch available columns from the database
  const fetchAvailableColumns = useCallback(async () => {
    try {
      const res = await api.get('/api/forms-builder/tables/incidents/columns');
      const columns = res?.data?.columns || res?.data || [];
      const defaultColumns = [
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
        // Initialize custom columns in formData if they don't exist
        setFormData(prev => {
          const updated = { ...prev };
          customCols.forEach(col => {
            if (!(col in updated)) {
              updated[col] = '';
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.warn('Failed to fetch columns:', err);
    }
  }, [customColumns]);

  // Auto-refresh columns every 5 seconds
  useEffect(() => {
    let mounted = true;
    fetchAvailableColumns();
    const intervalId = setInterval(() => {
      if (mounted) fetchAvailableColumns();
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
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

    // Apply search filter - improved to search multiple fields
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

        return title.includes(q) ||
          description.includes(q) ||
          propertyName.includes(q) ||
          status.includes(q) ||
          incidentType.includes(q) ||
          reference.includes(q) ||
          reportedBy.includes(q) ||
          assignedTo.includes(q) ||
          severity.includes(q);
      });
    }

    // Apply severity filter
    if (severityFilter) {
      list = list.filter((r) =>
        (r.severity || "").toLowerCase() === severityFilter.toLowerCase()
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
        String(r.propertyId || r.property_id || "") === String(propertyFilter)
      );
    }

    // Apply sorting
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
          const statusA = (a.status || '').toLowerCase();
          const statusB = (b.status || '').toLowerCase();
          return statusA.localeCompare(statusB);
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

  // Hide sidebar and navbar when modal is open
  useEffect(() => {
    if (showModal || showViewModal) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showModal, showViewModal]);

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

  async function fetchIncidents() {
    try {
      setLoading(true);
      const res = await api.get('/api/incidents', { params: { limit: 200 } });
      const data = res?.data?.data ?? res?.data ?? [];
      if (!Array.isArray(data)) return setRows([]);
      const mapped = data.map((created) => ({
        ...created, // Spread all backend fields, including new columns
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
    if (!hotelId) {
      setServiceUsers([]);
      return;
    }

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
    } catch (err) {
      // ignore
    }

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
        const normalized = (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ''}` })).filter(Boolean);
        if (normalized.length) {
          setServiceUsers(normalized);
          return;
        }
      } catch (err) {
        // ignore
      }
    }

    setServiceUsers([]);
  }

  async function fetchStaffForHotel(hotelId) {
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

      if (!data) {
        throw lastErr || new Error('Unable to load staff');
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
    } catch (err) {
      console.error('fetchStaffForHotel error:', err);
      setStaffUsers([]);
    } finally {
      setStaffLoading(false);
    }
  }

  /* View Handler */
  const handleView = (row) => {
    setViewingIncident(row);
    setShowViewModal(true);
  };

  /* Edit/Delete handlers */
  const handleEdit = async (row) => {
    if (!hasUpdate) {
      alert("You don't have permission to edit inspections.");
      return;
    }
    let record = row.raw ?? null;
    // Map record to formData including custom columns
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
    // Add custom columns from record
    const customFormData = customColumns && customColumns.length > 0
      ? customColumns.reduce((acc, col) => ({ ...acc, [col]: record[col] ?? '' }), {})
      : {};
    setFormData({ ...baseFormData, ...customFormData });
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
          await api.delete(`/api/incidents/${id}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setRows((prev) => prev.filter((r) => String(r.raw?.id) !== String(id)));
        } catch (err) {
          console.error('delete incident error', err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
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
    if (type === 'checkbox') {
      setFormData((p) => ({ ...p, [name]: checked }));
      return;
    }
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
      // Build payload with default and custom columns
      const basePayload = {
        type: formData.incidentType,
        severity: formData.severity,
        property_id: formData.propertyId,
        property_name: formData.propertyName || null,
        service_user_id: formData.serviceUserId || null,
        description: formData.description,
        reported_by: formData.reportedBy,
        reported_date: formData.reportedDate,
        assigned_to: formData.assignedTo,
        status: formData.status,
      };
      // Add custom columns to payload - use snake_case for database columns
      const customPayload = customColumns && customColumns.length > 0
        ? customColumns.reduce((acc, col) => {
          const value = formData[col];
          // Send both snake_case (for DB) and camelCase (for compatibility)
          acc[col] = value !== undefined && value !== null && value !== '' ? value : null;
          return acc;
        }, {})
        : {};
      const payload = { ...basePayload, ...customPayload };

      let res;
      if (editingId) {
        // Update existing incident
        res = await api.put(`/api/incidents/${editingId}`, payload);
        if (!res?.data?.success) {
          throw new Error(res?.data?.message || 'Failed to update incident');
        }
      } else {
        // Create new incident
        res = await api.post('/api/incidents', payload);
        if (!res?.data?.success) {
          throw new Error(res?.data?.message || 'Failed to create incident');
        }
      }

      // Refresh the incidents list from server
      await fetchIncidents();

      // Capture editingId before resetting for success message
      const wasEditing = !!editingId;

      // Close modal and reset state
      setShowModal(false);
      setEditingId(null);
      setError(null);

      // Show success message
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
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: errorMessage,
        type: 'error'
      });
      // Don't close modal on error - let user fix and retry
      // Don't create fallback row - this was causing new tasks to appear
    } finally {
      setSubmitting(false);
    }
  }

  const openReportModal = () => {
    setEditingId(null);
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
    // Reset custom columns to empty strings
    const customFormData = customColumns && customColumns.length > 0
      ? customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
      : {};
    setFormData({ ...baseFormData, ...customFormData });
    setStaffUsers([]);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Incidents</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>Incidents</span>
            </div>
          </div>
          {hasCreate && (
            <button
              onClick={openReportModal}
              className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>+</span>
              <span>Report Incident</span>
            </button>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Incidents</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Open</div>
              <div className="text-2xl font-bold text-gray-900">{stats.open}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Zap className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">In Progress</div>
              <div className="text-2xl font-bold text-gray-900">{stats.inProgress}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Resolved</div>
              <div className="text-2xl font-bold text-gray-900">{stats.resolved}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Incidents Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Incidents</h2>
                <p className="text-sm text-gray-500">{stats.total} total records</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search incidents..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                {/* View Dropdown */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* View Settings Dropdown Panel */}
                  {showViewMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">View Settings</h3>

                        {/* View Mode Selector */}
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Display Mode</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewMode('table')}
                              className={`flex-1 px-3 py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'table'
                                ? 'bg-teal-500 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                              <Columns className="w-4 h-4" />
                              <span>Table</span>
                            </button>
                            <button
                              onClick={() => setViewMode('board')}
                              className={`flex-1 px-3 py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'board'
                                ? 'bg-teal-500 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
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
                                        className="text-xs text-teal-600 hover:text-teal-700 font-medium"
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
                                        className="text-xs text-teal-600 hover:text-teal-700 font-medium"
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
                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors border ${visibleColumns[col]
                                          ? 'text-gray-700 hover:bg-gray-50 border-gray-200 bg-white'
                                          : 'text-gray-500 hover:bg-teal-50 hover:text-teal-700 border-gray-100 bg-gray-50'
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
                                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
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
                                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
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
                                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors border ${visibleColumns[col]
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
                  <>
                    <DownloadDropdown
                      onDownloadPDF={() => openExport('pdf')}
                      onDownloadCSV={() => openExport('csv')}
                    />
                    <button
                      onClick={openReportModal}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Report Incident</span>
                    </button>
                  </>
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
                      className="p-2 rounded-lg hover:bg-gray-50 text-gray-500"
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
                          className="text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Select all
                        </button>
                        <button
                          onClick={() => setSelectedExportKeys([])}
                          className="text-gray-600 hover:text-gray-700 font-medium"
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
                            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
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
                              className="h-4 w-4 accent-teal-600"
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
                      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-white border border-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={runExport}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Row */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="in progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Properties</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Sort By</option>
                  <option value="date">Date (Newest)</option>
                  <option value="severity">Severity</option>
                  <option value="status">Status</option>
                  <option value="type">Type</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Clear Filters Button */}
              {(severityFilter || statusFilter || propertyFilter || sortBy) && (
                <button
                  onClick={() => {
                    setSeverityFilter('');
                    setStatusFilter('');
                    setPropertyFilter('');
                    setSortBy('');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Data Display - Table or Board View */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-md">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr className="border-b border-gray-200">
                    {/* Removed duplicate manual checkbox block */}
                    {ALL_COLUMNS.map(col => (
                      visibleColumns[col] && (
                        <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {col === 'checkbox' ? (
                            <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                          ) : col === 'actions' ? 'ACTIONS' : col.replace(/_/g, ' ').toUpperCase()}
                        </th>
                      )
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : filtered.length > 0 ? filtered.map((row) => {
                    const priorityStyle = getPriorityColor(row.priority || "Medium");
                    const statusStyle = getStatusColor(row.status || "pending");

                    return (
                      <tr key={row.ref} className="hover:bg-teal-50/30 transition-all border-b border-gray-100 last:border-0">
                        {/* Removed duplicate manual checkbox block */}
                        {ALL_COLUMNS.map(col => (
                          visibleColumns[col] && (
                            <td key={col} className={`py-4 px-4 ${col === 'date' || col === 'reference' ? 'whitespace-nowrap' : ''}`}>
                              {(() => {
                                if (col === 'checkbox') return <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />;
                                if (col === 'type') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">{row.title || "Incident"}</span>;
                                if (col === 'reference') return <span className="text-slate-900 font-semibold text-sm whitespace-nowrap">{row.ref}</span>;
                                if (col === 'description') return <div><div className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`} onClick={hasUpdate ? () => handleEdit(row) : undefined}><Home className="w-4 h-4 text-gray-400" /><span>{hotels.find(h => h.id == row.propertyId)?.name || row.propertyName || "Unknown Property"}</span></div><div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">{row.desc || "No description recorded."}</div></div>;
                                if (col === 'priority') { const priorityStyle = getPriorityColor(row.priority || "Medium"); return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span><span className={`text-sm font-semibold ${priorityStyle.text}`}>{row.priority || "Medium"}</span></div>; }
                                if (col === 'status') { const statusStyle = getStatusColor(row.status || "pending"); return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span><span className={`text-sm font-semibold ${statusStyle.text}`}>{row.status || "Pending"}</span></div>; }
                                if (col === 'assigned') return !row.assigned || row.assigned === 'Unassigned' ? <span className="text-gray-400 text-sm">Unassigned</span> : <div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-full ${getAvatarColor(row.assigned)} flex items-center justify-center text-xs font-semibold shadow-sm`}>{getInitials(row.assigned)}</div><span className="text-gray-900 text-sm font-medium">{row.assigned}</span></div>;
                                if (col === 'date') return <span className="text-gray-900 font-medium text-sm">{formatDate(row.date)}</span>;
                                if (col === 'actions') return <div className="flex items-center gap-2"><button onClick={() => handleView(row)} className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" title="View"><Eye className="w-4 h-4" /></button>{hasUpdate && (<button onClick={() => handleEdit(row)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit"><Edit className="w-4 h-4" /></button>)}{hasDelete && (<button onClick={() => handleDelete(row)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>)}</div>;
                                // Render custom columns
                                if (customColumns.includes(col)) return <span className="text-gray-900 font-medium text-sm">{row.raw?.[col] ?? ''}</span>;
                                return null;
                              })()}
                            </td>
                          )
                        ))}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-gray-500">No incidents found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['Open', 'In Progress', 'Resolved'].map((status) => {
                  const statusItems = filtered.filter(
                    (row) => (row.status || '').toLowerCase() === status.toLowerCase()
                  );

                  const getStatusStyle = (status) => {
                    if (status === 'Open') return {
                      bg: 'bg-orange-50',
                      border: 'border-orange-200',
                      header: 'bg-orange-100',
                      text: 'text-orange-700',
                      dot: 'bg-orange-500'
                    };
                    if (status === 'In Progress') return {
                      bg: 'bg-purple-50',
                      border: 'border-purple-200',
                      header: 'bg-purple-100',
                      text: 'text-purple-700',
                      dot: 'bg-purple-500'
                    };
                    if (status === 'Resolved') return {
                      bg: 'bg-emerald-50',
                      border: 'border-emerald-200',
                      header: 'bg-emerald-100',
                      text: 'text-emerald-700',
                      dot: 'bg-emerald-500'
                    };
                    return {
                      bg: 'bg-gray-50',
                      border: 'border-gray-200',
                      header: 'bg-gray-100',
                      text: 'text-gray-700',
                      dot: 'bg-gray-500'
                    };
                  };

                  const style = getStatusStyle(status);

                  return (
                    <div key={status} className="flex-shrink-0 w-80">
                      <div className={`rounded-lg border ${style.border} ${style.bg}`}>
                        {/* Column Header */}
                        <div className={`${style.header} px-4 py-3 border-b ${style.border}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
                              <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>
                                {status}
                              </h3>
                            </div>
                            <span className="bg-white px-2 py-0.5 rounded-md text-xs font-semibold text-gray-600">
                              {statusItems.length}
                            </span>
                          </div>
                        </div>

                        {/* Cards Container */}
                        <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                          {statusItems.length === 0 ? (
                            <div className="text-center py-8 px-4">
                              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No incidents</p>
                            </div>
                          ) : (
                            statusItems.map((row) => {
                              const priorityStyle = getPriorityColor(row.priority || "Medium");

                              return (
                                <div
                                  key={row.ref}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => handleView(row)}
                                >
                                  {/* Card Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{row.ref}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityStyle.text}`}>
                                        {row.priority}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Title */}
                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {row.title || "Incident"}
                                  </h4>

                                  {/* Property */}
                                  <div className="flex items-center gap-1.5 text-gray-600 text-xs mb-2">
                                    <Home className="w-3 h-3" />
                                    <span className="truncate">
                                      {hotels.find(h => h.id == row.propertyId)?.name || row.propertyName || "Unknown Property"}
                                    </span>
                                  </div>

                                  {/* Description */}
                                  {row.desc && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {row.desc}
                                    </p>
                                  )}

                                  {/* Card Footer */}
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    {/* Assigned */}
                                    <div className="flex items-center gap-2">
                                      {row.assigned && row.assigned !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(row.assigned)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(row.assigned)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {row.assigned}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>

                                    {/* Date */}
                                    <span className="text-xs text-gray-500">
                                      {formatDate(row.date)}
                                    </span>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleView(row);
                                      }}
                                      className="flex-1 py-1.5 px-2 bg-gray-50 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-md transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                      title="View"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      View
                                    </button>
                                    {hasUpdate && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEdit(row);
                                        }}
                                        className="p-1.5 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors"
                                        title="Edit"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {hasDelete && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(row);
                                        }}
                                        className="p-1.5 bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[70vh]">

            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? "Edit Incident" : "Report Incident"}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                  setEditingId(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              {/* Error Message Display */}
              {error && (
                <div className="mb-4 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Form fields same as original */}
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type <span className="text-red-500">*</span></label>
                    <select
                      name="incidentType"
                      required
                      value={formData.incidentType}
                      onChange={handleIncidentTypeChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                    >
                      <option value="">Select type</option>
                      {[...BUILTIN_INCIDENT_TYPES, ...customIncidentTypes].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      {!!formData.incidentType &&
                        ![...BUILTIN_INCIDENT_TYPES, ...customIncidentTypes].some((t) => String(t) === String(formData.incidentType)) && (
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
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                        />
                        <button
                          type="button"
                          onClick={saveCustomIncidentType}
                          className="px-3 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 text-sm font-medium"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomIncidentTypeInput(false);
                            setCustomIncidentTypeValue('');
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severity <span className="text-red-500">*</span></label>
                    <select
                      name="severity"
                      required
                      value={formData.severity}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
                    <select
                      name="propertyId"
                      required
                      value={formData.propertyId}
                      onChange={handlePropertyChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                    >
                      <option value="">Select property</option>
                      {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    {hotelsLoading && <div className="text-xs text-gray-400 mt-0.5">Loading hotels...</div>}
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service User</label>
                    <select
                      name="serviceUserId"
                      value={formData.serviceUserId}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                    >
                      <option value="">Select service user</option>
                      {serviceUsers.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea
                      name="description"
                      required
                      rows={3}
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Detailed description of the incident..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 resize-y"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reported By <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="reportedBy"
                      readOnly
                      value={formData.reportedBy}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reported Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="reportedDate"
                      required
                      value={formatDateISO(formData.reportedDate)}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                    <select
                      name="assignedTo"
                      value={formData.assignedTo}
                      onChange={handleInputChange}
                      disabled={!formData.propertyId || staffLoading}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!formData.propertyId
                          ? "Select property first"
                          : staffLoading
                            ? "Loading staff..."
                            : "Select staff"}
                      </option>
                      {!!formData.assignedTo && !staffUsers.some((u) => String(u.name) === String(formData.assignedTo)) && (
                        <option value={formData.assignedTo}>{formData.assignedTo}</option>
                      )}
                      {staffUsers.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                    <select
                      name="status"
                      required
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  {/* Custom Fields - Moved to bottom */}
                  {customColumns.map((col) => {
                    const meta = customColumnMetadata[col] || {};
                    const inputType = meta.input_type || 'text';
                    const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                    return (
                      <div key={col} className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {col.replace(/_/g, ' ').toUpperCase()}
                        </label>
                        {inputType === 'checkbox' ? (
                          <div className="flex items-center h-10">
                            <input
                              type="checkbox"
                              name={col}
                              checked={!!formData[col]}
                              onChange={(e) => setFormData({ ...formData, [col]: e.target.checked })}
                              className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Yes</span>
                          </div>
                        ) : inputType === 'dropdown' || inputType === 'select' ? (
                          <select
                            name={col}
                            value={formData[col] || ''}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                          >
                            <option value="">Select...</option>
                            {options.map((opt, idx) => (
                              <option key={idx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : inputType === 'textarea' ? (
                          <textarea
                            name={col}
                            rows={3}
                            value={formData[col] || ''}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 resize-y"
                          />
                        ) : (
                          <input
                            name={col}
                            type={inputType}
                            value={formData[col] || ''}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setEditingId(null);
                  }}
                  className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                >
                  {submitting ? "Saving..." : (editingId ? "Update Incident" : "Report Incident")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && viewingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg relative">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Incident Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">REFERENCE & TITLE</div>
                <div className="text-gray-500 font-mono text-sm mb-1">{viewingIncident.ref}</div>
                <div className="text-xl font-bold text-gray-800">{viewingIncident.title}</div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">DESCRIPTION</div>
                <p className="text-gray-600 text-sm leading-relaxed">{viewingIncident.desc || "No description provided."}</p>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                <DetailField label="PROPERTY" value={hotels.find(h => h.id == viewingIncident.propertyId)?.name || viewingIncident.propertyName || viewingIncident.property || "Unknown Property"} />
                <DetailField label="TYPE" value={viewingIncident.title} />

                <DetailField label="PRIORITY" value={viewingIncident.priority} />
                <DetailField label="STATUS" value={viewingIncident.status} />

                <DetailField label="REPORTED BY" value={viewingIncident.raw.reported_by || viewingIncident.raw.reportedBy} />
                <DetailField label="ASSIGNED TO" value={viewingIncident.assigned} />

                <DetailField label="REPORTED DATE" value={formatDate(viewingIncident.date)} />
                <DetailField label="SERVICE USER" value={viewingIncident.serviceUserId || '-'} />
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                >
                  Close
                </button>
              </div>
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
    </div>
  );
}