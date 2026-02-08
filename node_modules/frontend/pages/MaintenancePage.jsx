/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/MaintenancePage.jsx */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
  Home,
  Wrench,
  Search,
  ChevronDown,
  Filter,
  Columns,
  Download,
  X,
  Edit,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
  Check,
  Calendar,
  User,
  Building,
  Tag
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

/* axios instance */
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

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

/* --- Helpers --- */
function formatDateISO(value) {
  if (!value) return "";
  // Check if it's already YYYY-MM-DD
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  } catch { return value; }
}

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  if (low === "completed") return { dot: "bg-green-500", text: "text-green-700" };
  if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
  if (low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
  return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
  return "bg-teal-100 text-teal-700";
}

/* Helper for View Details */
const DetailField = ({ label, value, icon: Icon }) => (
  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon className="w-3 h-3 text-gray-400" />}
      <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">{label}</div>
    </div>
    <div className="text-gray-900 font-medium text-sm truncate" title={value}>{value || '-'}</div>
  </div>
);

/* Form Input Component */
const FormInput = ({ label, value, onChange, type = "text", required = false, placeholder, icon: Icon }) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <input
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 transition-all ${Icon ? 'pl-10' : ''}`}
      />
    </div>
  </div>
);

/* Form Select Component */
const FormSelect = ({ label, value, onChange, options, required = false, disabled = false, icon: Icon }) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <select
        required={required}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white transition-all ${Icon ? 'pl-10' : ''} ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      >
        {options}
      </select>
    </div>
  </div>
);

export default function MaintenancePage({ user }) {
  // Get current user from props or localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for maintenance module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("maintenance");
  const hasCreate = canCreate("maintenance");
  const hasUpdate = canUpdate("maintenance");
  const hasDelete = canDelete("maintenance");

  const [query, setQuery] = useState("");
  // CHANGED: Initialized to empty array instead of null to prevent issues
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedExportKeys, setSelectedExportKeys] = useState([]);

  // Filter and Sort State
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [sortBy, setSortBy] = useState("");

  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);

  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(false);

  // VIEW STATE
  const [showView, setShowView] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);

  // Dialog States
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

  // Column Visibility State
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
  const viewRef = useRef(null);

  const hotelsControllerRef = useRef(null);

  // Updated form state
  const initialForm = useMemo(() => ({
    title: "",
    room: "",
    start: "",
    raisedBy: currentUser?.name || '',
    assignedTo: "",
    category: "",
    status: "Open",
    hotelId: "",
    hotelName: "",
    action: "",
    dueDate: "",
    closed: "",
    description: "",
    priority: "Medium"
  }), [currentUser?.name]);
  const [form, setForm] = useState(initialForm);

  // Custom columns from Forms Builder
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnMetadata, setCustomColumnMetadata] = useState({});
  const [availableColumns, setAvailableColumns] = useState([]);

  const BASE_EXPORT_COLUMNS = useMemo(
    () => [
      { header: 'Title', key: 'title' },
      { header: 'Property', key: 'hotel' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Assigned To', key: 'assignedTo' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Description', key: 'description' }
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
  const DEFAULT_COLUMNS = useMemo(() => [
    "checkbox",
    "type",
    "reference",
    "description",

    "priority",
    "status",
    "assigned_to",
    "start_date",
    "due_date",
    "actions",
  ], []);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('maintenance_visible_columns');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn('Failed to load column visibility', err);
    }
    return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  // Fetch custom columns from Forms Builder
  useEffect(() => {
    let mounted = true;
    const fetchAvailableColumns = async () => {
      try {
        const res = await api.get('/api/forms-builder/tables/maintenance_tasks/columns');
        if (!mounted) return;

        const cols = res?.data?.columns || res?.data || [];
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

        const standardCols = DEFAULT_COLUMNS;
        const customCols = columnNames.filter(col => !standardCols.includes(col));

        setCustomColumns(prevCustom => {
          // Only auto-show columns that are truly new (never seen before)
          const newCols = customCols.filter(c => !prevCustom.includes(c));
          if (newCols.length > 0) {
            setVisibleColumns(prev => {
              const updated = { ...prev };
              newCols.forEach(col => {
                // Only act if not explicitly set in localStorage
                if (prev[col] === undefined) {
                  updated[col] = true;
                }
              });
              return updated;
            });
          }
          return customCols;
        });
      } catch (err) {
        console.warn('Failed to fetch custom columns', err);
      }
    };

    fetchAvailableColumns();
    const interval = setInterval(fetchAvailableColumns, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [DEFAULT_COLUMNS]);

  // Save column visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('maintenance_visible_columns', JSON.stringify(visibleColumns));
    } catch (err) {
      console.warn('Failed to save column visibility', err);
    }
  }, [visibleColumns]);

  useEffect(() => {
    if (!showCreate && !showEdit && !showView) {
      setForm(initialForm);
      setCreating(false);
      setEditing(false);
      setEditingId(null);
    }
  }, [showCreate, showEdit, showView, initialForm]);

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

  // Hide sidebar and navbar when modal is open
  useEffect(() => {
    const isModalOpen = showCreate || showEdit || showView;
    if (isModalOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showCreate, showEdit, showView]);

  /* ------------------------- Data Loading ------------------------- */
  const fetchHotels = useCallback(async (signal) => {
    try {
      setHotelsLoading(true);
      const res = await api.get("/api/hotels", { params: { limit: 1000 }, signal });
      const normalized = normalizeHotelsResponse(res?.data ?? {});
      setHotels(normalized);
    } catch (err) {
      const isCanceled = err && (err.name === "CanceledError" || err.code === "ERR_CANCELED" || axios.isCancel?.(err));
      if (!isCanceled) {
        console.error("fetchHotels error:", err);
        setHotels([]);
      }
    } finally {
      setHotelsLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await api.get("/api/maintenance", { signal, params: { limit: 200 } });
      const data = res?.data?.data ?? res?.data ?? [];
      let mapped = Array.isArray(data) ? data : [];

      const formattedTasks = mapped.map((t) => {
        const baseTask = {
          id: t.id ?? t.task_id ?? t._id ?? t.ref ?? null,
          title: t.title ?? t.name ?? "",
          start: formatDateISO(t.start_date || t.start),
          category: t.category || "Maintenance",
          hotel: t.site || t.hotel_name || "",
          room: t.room || "",
          raisedBy: t.raised_by || "Unassigned",
          assignedTo: t.assigned_to || t.assignedTo || "",
          status: t.status || "Open",
          action: t.action || "",
          dueDate: formatDateISO(t.due_date),
          closed: formatDateISO(t.closed_date || t.closed),
          priority: t.priority || "Medium",
          ref: t.ref || (t.id ? Number(t.id).toString(36).padStart(8, '0').slice(-8) : Math.random().toString(36).slice(-8)),
          description: t.description || "",
          raw: t,
        };

        // Include all properties from API response that might be custom columns
        Object.keys(t).forEach(key => {
          if (!(key in baseTask)) {
            baseTask[key] = t[key];
          }
        });

        return baseTask;
      });
      setTasks(formattedTasks);
      setLoading(false);
    } catch (err) {
      if (err.name === "AbortError" || err.code === "ERR_CANCELED") return;
      console.error("Failed to load tasks:", err);
      setTasks([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    hotelsControllerRef.current = ac;
    fetchHotels(ac.signal);
    loadTasks(ac.signal);
    return () => {
      try { ac.abort(); } catch { }
      hotelsControllerRef.current = null;
    };
  }, [fetchHotels, loadTasks]);

  const fetchStaffForHotel = useCallback(async (hotelId) => {
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
  }, []);

  const fetchRoomsForHotel = useCallback(async (hotelId) => {
    if (!hotelId) {
      setRooms([]);
      return;
    }
    try {
      setRoomsLoading(true);

      const tryPath = async (path) => {
        const r = await api.get(path);
        return r?.data;
      };

      const paths = [
        `/api/hotels/${encodeURIComponent(String(hotelId))}/rooms`,
        `/hotels/${encodeURIComponent(String(hotelId))}/rooms`,
        `/api/su/rooms/${encodeURIComponent(String(hotelId))}`,
        `/su/rooms/${encodeURIComponent(String(hotelId))}`,
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

      if (!data) throw lastErr || new Error('Unable to load rooms');

      const list = data?.rooms ?? data?.data ?? data ?? [];
      const normalized = (Array.isArray(list) ? list : [])
        .map((r) => ({
          id: r.id,
          room_number: r.room_number ?? r.room ?? r.roomNo ?? r.number ?? '',
          type: r.type ?? null,
          status: r.status ?? null,
        }))
        .filter((r) => r.id && String(r.room_number).trim() !== '');

      normalized.sort((a, b) => {
        const numA = parseInt(a.room_number, 10) || 0;
        const numB = parseInt(b.room_number, 10) || 0;
        return numA - numB;
      });

      setRooms(normalized);
    } catch (err) {
      console.error('fetchRoomsForHotel error:', err);
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  /* ------------------------- Logic ------------------------- */
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    // CHANGED: Use empty array as fallback instead of tasks || []
    let list = tasks;

    // Apply search filter
    if (q) {
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.hotel.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
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
        String(r.raw?.hotel_id || "") === String(propertyFilter)
      );
    }

    // Apply sorting
    if (sortBy) {
      list = [...list].sort((a, b) => {
        if (sortBy === 'date') {
          const dateA = new Date(a.dueDate || 0);
          const dateB = new Date(b.dueDate || 0);
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

  const normalizeMaintenanceExportRow = (task) => {
    const base = {
      title: task.title || '-',
      hotel: task.hotel || '-',
      priority: task.priority || '-',
      status: task.status || '-',
      assignedTo: task.assignedTo || '-',
      dueDate: task.dueDate || '-',
      description: task.description || '-',
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

      const data = (filtered || []).map(normalizeMaintenanceExportRow);

      if (exportFormat === 'pdf') {
        generatePDF(data, columns, 'Maintenance Tasks Report', 'maintenance-tasks-report');
      } else if (exportFormat === 'csv') {
        generateCSV(data, columns, 'maintenance-tasks-report');
      }

      closeExport();
    } catch (error) {
      console.error('Error exporting maintenance tasks:', error);
      alert('Failed to download: ' + error.message);
    }
  };

  const stats = useMemo(() => {
    // CHANGED: Removed "|| SAMPLE" fallback. Stats will be 0 if tasks is empty.
    const list = tasks;
    const total = list.length;
    const pending = list.filter(t => ["pending", "open"].includes(t.status.toLowerCase())).length;
    const inProgress = list.filter(t => ["in progress", "under review"].includes(t.status.toLowerCase())).length;
    const completed = list.filter(t => t.status.toLowerCase() === "completed").length;
    return { total, pending, inProgress, completed };
  }, [tasks]);

  /* ------------------------- Handlers ------------------------- */
  async function handleDelete(id) {
    if (!hasDelete) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: "You don't have permission to delete maintenance tasks.",
        type: 'warning'
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Work Order',
      message: 'Delete this work order? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/api/maintenance/${id}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await loadTasks(); // No abort signal here
          setAlertDialog({
            isOpen: true,
            title: 'Success',
            message: 'Work order deleted successfully!',
            type: 'success'
          });
        } catch (error) {
          console.error("Error deleting maintenance task:", error);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: 'Failed to delete work order. Please try again.',
            type: 'error'
          });
        }
      }
    });
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreating(true);

    try {
      const createData = {
        title: form.title,
        start_date: formatDateISO(form.start) || null,
        category: form.category,
        hotel_name: form.hotelName,
        hotel_id: form.hotelId || null,
        property_id: form.hotelId || null,
        room: form.room,
        raised_by: form.raisedBy,
        assigned_to: form.assignedTo,
        status: form.status || "Pending",
        action: form.action,
        due_date: formatDateISO(form.dueDate) || null,
        closed_date: formatDateISO(form.closed) || null,
        priority: form.priority || "Medium",
        description: form.description
      };

      // Include custom columns
      customColumns.forEach(col => {
        if (form[col] !== undefined) {
          createData[col] = form[col];
        }
      });

      await api.post("/api/maintenance", createData);
      await loadTasks(); // No abort signal here
      setShowCreate(false);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Work order created successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error("Error creating maintenance task:", error);
      setAlertDialog({
        isOpen: true,
        title: 'Create Failed',
        message: error?.response?.data?.message || 'Failed to create work order. Please try again.',
        type: 'error'
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditing(true);

    try {
      const updateData = {
        title: form.title,
        start_date: formatDateISO(form.start) || null,
        category: form.category,
        hotel_name: form.hotelName,
        hotel_id: form.hotelId || null,
        property_id: form.hotelId || null,
        room: form.room,
        raised_by: form.raisedBy,
        assigned_to: form.assignedTo,
        status: form.status,
        action: form.action,
        due_date: formatDateISO(form.dueDate) || null,
        closed_date: formatDateISO(form.closed) || null,
        priority: form.priority,
        description: form.description
      };

      // Include custom columns
      customColumns.forEach(col => {
        if (form[col] !== undefined) {
          updateData[col] = form[col];
        }
      });

      const res = await api.put(`/api/maintenance/${editingId}`, updateData);
      await loadTasks(); // No abort signal here
      setShowEdit(false);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Work order updated successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error("Error updating maintenance task:", error);
      setAlertDialog({
        isOpen: true,
        title: 'Update Failed',
        message: error?.response?.data?.message || 'Failed to update work order. Please try again.',
        type: 'error'
      });
    } finally {
      setEditing(false);
    }
  }

  function openEdit(task) {
    // Prefer the raw DB id when available to avoid using non-numeric reference keys
    const numericId = task?.raw?.id ?? task.id ?? task.task_id ?? task._id ?? null;
    setEditingId(numericId);
    const hotelRecord = hotels.find((h) => h.name === task.hotel || String(h.id) === String(task.hotel)) || null;
    const hotelId = hotelRecord?.id ?? (typeof task.hotel === 'number' ? task.hotel : '');
    const hotelName = hotelRecord?.name ?? task.hotel ?? '';

    const formData = {
      ...task,
      hotelId: hotelId,
      hotelName: hotelName
    };

    customColumns.forEach(col => {
      if (task[col] !== undefined) {
        formData[col] = task[col];
      }
    });

    setForm(formData);
    if (hotelId) {
      fetchStaffForHotel(hotelId);
      fetchRoomsForHotel(hotelId);
    } else {
      setStaffUsers([]);
      setRooms([]);
    }
    setShowEdit(true);
  }

  function openView(task) {
    const hotelRecord = hotels.find((h) => h.name === task.hotel || String(h.id) === String(task.hotel)) || null;
    const hotelId = hotelRecord?.id ?? (typeof task.hotel === 'number' ? task.hotel : '');
    const hotelName = hotelRecord?.name ?? task.hotel ?? '';

    setViewingTask({
      ...task,
      hotelId: hotelId,
      hotelName: hotelName
    });

    setForm({
      ...task,
      hotelId: hotelId,
      hotelName: hotelName
    });

    if (hotelId) {
      fetchStaffForHotel(hotelId);
      fetchRoomsForHotel(hotelId);
    } else {
      setStaffUsers([]);
      setRooms([]);
    }
    setShowView(true);
  }

  function handleFormChange(field, value) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function handleHotelChange(e) {
    const hotelId = e.target.value;
    const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
    setForm((p) => {
      const changed = String(p.hotelId || '') !== String(hotelId || '');
      return {
        ...p,
        hotelId: hotelId,
        hotelName: hotel ? hotel.name : '',
        room: changed ? '' : p.room,
        raisedBy: currentUser?.name || '',
      };
    });
    setStaffUsers([]);
    setRooms([]);
    if (hotelId) {
      fetchStaffForHotel(hotelId);
      fetchRoomsForHotel(hotelId);
    }
  }

  /* ------------------------- UI RENDERER ------------------------- */
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">

        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Maintenance</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>Maintenance</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown
                onDownloadPDF={() => openExport('pdf')}
                onDownloadCSV={() => openExport('csv')}
              />
              <button
                onClick={() => setShowCreate(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Wrench className="w-4 h-4" />
                <span>Create Work Order</span>
              </button>
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <Wrench className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Pending</div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">In Progress</div>
              <div className="text-2xl font-bold text-gray-900">{stats.inProgress}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Work Orders Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">

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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search work orders..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                {/* View Dropdown */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* View Settings Dropdown Panel */}
                  {showViewMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">View settings</h3>

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
                              <Wrench className="w-4 h-4" />
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
                  <button
                    onClick={() => setShowCreate(true)}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Create Work Order</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
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
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="in progress">In Progress</option>
                  <option value="completed">Completed</option>
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
                    {visibleColumns.checkbox && (
                      <th className="text-left py-4 px-4">
                        <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">TYPE</th>
                    )}
                    {visibleColumns.reference && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">REFERENCE</th>
                    )}
                    {visibleColumns.description && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DESCRIPTION</th>
                    )}
                    {visibleColumns.priority && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">PRIORITY</th>
                    )}
                    {visibleColumns.status && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>
                    )}

                    {visibleColumns.assigned_to && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ASSIGNED TO</th>
                    )}
                    {visibleColumns.start_date && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">START DATE</th>
                    )}
                    {visibleColumns.due_date && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">DUE DATE</th>
                    )}
                    {/* Custom Columns (Inserted Before Actions) */}
                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                      <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                    {visibleColumns.actions && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={DEFAULT_COLUMNS.length + customColumns.length} className="py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : filtered.length > 0 ? filtered.map((row) => {
                    const priorityStyle = getPriorityColor(row.priority);
                    const statusStyle = getStatusColor(row.status);

                    return (
                      <tr key={row.id} className="hover:bg-teal-50/30 transition-all border-b border-gray-100 last:border-0">
                        {visibleColumns.checkbox && (
                          <td className="py-4 px-4">
                            <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
                              {row.category || "Maintenance"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.reference && (
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-slate-900 font-semibold text-sm">MNT-2025-{row.ref || (row.id ? Number(row.id).toString(36).padStart(8, '0').slice(-8) : '')}</span>
                          </td>
                        )}
                        {visibleColumns.description && (
                          <td className="py-4 px-4">
                            <div>
                              <div
                                className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
                                onClick={hasUpdate ? () => openEdit(row) : undefined}
                              >
                                <Home className="w-4 h-4 text-gray-400" />
                                <span>{row.hotel || 'Unknown Property'}</span>
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
                              <span className={`text-sm font-semibold ${priorityStyle.text}`}>{row.priority}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                              <span className={`text-sm font-semibold ${statusStyle.text}`}>{row.status === "Open" ? "Pending" : row.status}</span>
                            </div>
                          </td>
                        )}

                        {visibleColumns.assigned_to && (
                          <td className="py-4 px-4">
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
                        )}
                        {visibleColumns.start_date && (
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-gray-900 font-medium text-sm">{formatDate(row.start)}</span>
                          </td>
                        )}
                        {visibleColumns.due_date && (
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-gray-900 font-medium text-sm">{formatDate(row.dueDate)}</span>
                          </td>
                        )}
                        {/* Custom Column Cells (Inserted Before Actions) */}
                        {customColumns.filter(col => visibleColumns[col]).map(col => (
                          <td key={col} className="py-4 px-4">
                            <span className="text-gray-900 font-medium text-sm">{row[col] || '-'}</span>
                          </td>
                        ))}
                        {visibleColumns.actions && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openView(row)}
                                className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {hasUpdate && (
                                <button
                                  onClick={() => openEdit(row)}
                                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {hasDelete && (
                                <button
                                  onClick={() => handleDelete(row.id)}
                                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
                      <td colSpan={DEFAULT_COLUMNS.length + customColumns.length} className="py-8 text-center text-gray-500">No work orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['Open', 'Pending', 'Completed'].map((status) => {
                  const statusItems = filtered.filter((task) => {
                    return (task.status || 'Open').toLowerCase() === status.toLowerCase();
                  });

                  // ... (Kanban card rendering remains the same, omitted for brevity but part of full file) ...
                  const getStatusStyle = (status) => {
                    if (status === 'Open') {
                      return {
                        bg: 'bg-orange-50',
                        border: 'border-orange-200',
                        header: 'bg-orange-100',
                        text: 'text-orange-700',
                        dot: 'bg-orange-500'
                      };
                    }
                    if (status === 'Pending') {
                      return {
                        bg: 'bg-purple-50',
                        border: 'border-purple-200',
                        header: 'bg-purple-100',
                        text: 'text-purple-700',
                        dot: 'bg-purple-500'
                      };
                    }
                    if (status === 'Completed') {
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

                  return (
                    <div key={status} className="shrink-0 w-80">
                      <div className={`rounded-lg border ${style.border} ${style.bg}`}>
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

                        <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                          {statusItems.length === 0 ? (
                            <div className="text-center py-8 px-4">
                              <Wrench className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No tasks</p>
                            </div>
                          ) : (
                            statusItems.map((task) => {
                              const priorityColor = getPriorityColor(task.priority || "Medium");

                              return (
                                <div
                                  key={task.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => openView(task)}
                                >
                                  {/* ... Kanban Card Content ... */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{task.ref || `WO-${task.id}`}</span>
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

                                  {task.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-1 mb-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openView(task);
                                      }}
                                      className="flex-1 py-1 px-2 bg-gray-50 text-gray-600 hover:text-teal-600 rounded text-xs border border-gray-100"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEdit(task);
                                      }}
                                      className="flex-1 py-1 px-2 bg-gray-50 text-blue-600 hover:bg-blue-50 rounded text-xs border border-gray-100"
                                    >
                                      Edit
                                    </button>
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
      {(showCreate || showEdit || showView) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[70vh] animate-in fade-in zoom-in duration-200">

            {/* Modal Header (Fixed) */}
            <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {showView ? "Task Details" : (showEdit ? "Edit Work Order" : "New Work Order")}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {showView ? "View details for maintenance task" : "Fill in the details below to create a request"}
                </p>
              </div>
              <button
                onClick={() => { setShowCreate(false); setShowEdit(false); setShowView(false); }}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {showView ? (
                <div className="space-y-6">
                  {/* Primary Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailField label="TASK TITLE" value={form.title} icon={Wrench} />
                    <DetailField label="PROPERTY" value={form.hotelName} icon={Building} />
                    <DetailField label="ROOM / AREA" value={form.room} icon={Home} />
                    <DetailField label="CATEGORY" value={form.category} icon={Tag} />
                  </div>

                  {/* Status & Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">PRIORITY</div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${form.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                        form.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                        {form.priority}
                      </span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">STATUS</div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {form.status}
                      </span>
                    </div>
                    <DetailField label="DUE DATE" value={form.dueDate ? formatDate(form.dueDate) : '-'} icon={Calendar} />
                  </div>

                  {/* Description */}
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2">DESCRIPTION / NOTES</div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed min-h-[100px]">
                      {form.description || "No additional description provided."}
                    </div>
                  </div>

                  {/* Secondary Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <DetailField label="RAISED BY" value={form.raisedBy} icon={User} />
                    <DetailField label="ACTION REQUIRED" value={form.action} icon={Check} />
                  </div>

                  {/* Custom Fields in View */}
                  {customColumns.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Custom Fields</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customColumns.map(col => (
                          <DetailField key={col} label={col.replace(/_/g, ' ')} value={form[col]} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit/Create Form Content */
                <form id="maintenance-form" onSubmit={showEdit ? handleEditSubmit : handleCreateSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Row 1 */}
                    <FormInput
                      label="Task Title"
                      required
                      value={form.title}
                      onChange={e => handleFormChange("title", e.target.value)}
                      placeholder="e.g., Leaking Tap"
                      icon={Wrench}
                    />
                    <FormSelect
                      label="Room / Area"
                      value={form.room}
                      onChange={e => handleFormChange("room", e.target.value)}
                      disabled={!form.hotelId || roomsLoading}
                      icon={Home}
                      options={
                        <>
                          <option value="">
                            {!form.hotelId
                              ? "Select property first"
                              : roomsLoading
                                ? "Loading rooms..."
                                : "Select room"}
                          </option>
                          {!!form.room && !rooms.some((r) => String(r.room_number) === String(form.room)) && (
                            <option value={form.room}>{form.room}</option>
                          )}
                          {rooms.map((r) => (
                            <option key={r.id} value={String(r.room_number)}>
                              {r.room_number}
                              {r.type ? ` - ${r.type}` : ""}
                              {r.status ? ` (${r.status})` : ""}
                            </option>
                          ))}
                        </>
                      }
                    />

                    {/* Row 2 */}
                    <FormSelect
                      label="Property"
                      value={form.hotelId}
                      onChange={handleHotelChange}
                      icon={Building}
                      options={
                        <>
                          <option value="">-- Select Property --</option>
                          {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </>
                      }
                    />
                    <FormInput
                      label="Category"
                      value={form.category}
                      onChange={e => handleFormChange("category", e.target.value)}
                      placeholder="e.g., Plumbing, Electrical"
                      icon={Tag}
                    />

                    {/* Row 3 */}
                    <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                      <FormSelect
                        label="Priority"
                        value={form.priority}
                        onChange={e => handleFormChange("priority", e.target.value)}
                        options={
                          <>
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                            <option>Urgent</option>
                          </>
                        }
                      />
                      <FormSelect
                        label="Status"
                        value={form.status}
                        onChange={e => handleFormChange("status", e.target.value)}
                        options={
                          <>
                            <option>Open</option>
                            <option>Pending</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                          </>
                        }
                      />
                    </div>

                    {/* Row 4 */}
                    <FormInput
                      label="Start Date"
                      type="date"
                      value={formatDateISO(form.start)}
                      onChange={e => handleFormChange("start", e.target.value)}
                    />
                    <FormInput
                      label="Due Date"
                      type="date"
                      value={formatDateISO(form.dueDate)}
                      onChange={e => handleFormChange("dueDate", e.target.value)}
                    />

                    {/* Row 5 */}
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Raised By</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={form.raisedBy}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-gray-100 cursor-not-allowed pl-10"
                        />
                      </div>
                    </div>
                    <FormSelect
                      label="Assigned To"
                      value={form.assignedTo}
                      onChange={e => handleFormChange("assignedTo", e.target.value)}
                      disabled={!form.hotelId || staffLoading}
                      icon={User}
                      options={
                        <>
                          <option value="">
                            {!form.hotelId
                              ? "Select property first"
                              : staffLoading
                                ? "Loading staff..."
                                : "Select staff"}
                          </option>
                          {form.assignedTo && !staffUsers.some((u) => String(u.name) === String(form.assignedTo)) && (
                            <option value={form.assignedTo}>{form.assignedTo} (Current)</option>
                          )}
                          {staffUsers.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name}
                            </option>
                          ))}
                        </>
                      }
                    />

                    {/* Row 6 */}
                    <FormInput
                      label="Action Required"
                      value={form.action}
                      onChange={e => handleFormChange("action", e.target.value)}
                      placeholder="e.g., Replace part"
                    />

                    {/* Description */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 resize-y transition-all"
                        value={form.description}
                        onChange={e => handleFormChange("description", e.target.value)}
                        placeholder="Detailed description of the issue..."
                      />
                    </div>

                    {/* Custom Columns Section */}
                    {customColumns.length > 0 && (
                      <div className="col-span-1 md:col-span-2 pt-4 mt-2 border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Additional Fields</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                          {customColumns.map(col => {
                            const meta = customColumnMetadata[col] || {};
                            const inputType = meta.input_type || 'text';
                            const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                            return (
                              <div key={col}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </label>

                                {inputType === 'checkbox' ? (
                                  <div className="flex items-center h-10">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                                      checked={!!form[col]}
                                      onChange={e => handleFormChange(col, e.target.checked)}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Yes</span>
                                  </div>
                                ) : inputType === 'dropdown' || inputType === 'select' ? (
                                  <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white transition-all"
                                    value={form[col] || ''}
                                    onChange={e => handleFormChange(col, e.target.value)}
                                  >
                                    <option value="">Select...</option>
                                    {options.map((opt, idx) => (
                                      <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : inputType === 'textarea' ? (
                                  <textarea
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 transition-all"
                                    rows={3}
                                    value={form[col] || ''}
                                    onChange={e => handleFormChange(col, e.target.value)}
                                  />
                                ) : inputType === 'date' ? (
                                  <input
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 transition-all"
                                    value={form[col] ? formatDateISO(form[col]) : ''}
                                    onChange={e => handleFormChange(col, e.target.value)}
                                  />
                                ) : (
                                  <input
                                    type={inputType}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white transition-all"
                                    value={form[col] || ''}
                                    onChange={e => handleFormChange(col, e.target.value)}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer (Fixed) */}
            <div className="shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setShowEdit(false); setShowView(false); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white hover:shadow-sm font-medium transition-all text-sm"
              >
                {showView ? "Close" : "Cancel"}
              </button>
              {!showView && (
                <button
                  type="submit"
                  form="maintenance-form"
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium shadow-sm hover:shadow transition-all text-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {creating || editing ? "Saving..." : (showEdit ? "Update Order" : "Create Order")}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showView && viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg relative">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Work Order Details</h3>
              <button
                onClick={() => { setShowView(false); setViewingTask(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">REFERENCE & TITLE</div>
                <div className="text-gray-500 font-mono text-sm mb-1">MNT-2025-{viewingTask.ref || (viewingTask.id ? Number(viewingTask.id).toString(36).padStart(8, '0').slice(-8) : '')}</div>
                <div className="text-xl font-bold text-gray-800">{viewingTask.title}</div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">DESCRIPTION</div>
                <p className="text-gray-600 text-sm leading-relaxed">{viewingTask.description || "No description provided."}</p>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                <DetailField label="PROPERTY" value={viewingTask.hotel || viewingTask.hotelName} icon={Building} />
                <DetailField label="ROOM" value={viewingTask.room} />

                <DetailField label="CATEGORY" value={viewingTask.category} icon={Tag} />
                <DetailField label="PRIORITY" value={viewingTask.priority} />

                <DetailField label="STATUS" value={viewingTask.status} />
                <DetailField label="RAISED BY" value={viewingTask.raisedBy} icon={User} />

                <DetailField label="START DATE" value={formatDate(viewingTask.start)} icon={Calendar} />
                <DetailField label="DUE DATE" value={formatDate(viewingTask.dueDate)} icon={Calendar} />

                <DetailField label="ACTION REQUIRED" value={viewingTask.action} />
                <DetailField label="CLOSED DATE" value={formatDate(viewingTask.closed)} />
                <div className="grid md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                  {customColumns.map(col => (
                    <DetailField key={col} label={col.replace(/_/g, ' ')} value={viewingTask[col]} />
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => { setShowView(false); setViewingTask(null); }}
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