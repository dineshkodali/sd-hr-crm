/* src/pages/EmergencyProtocols.jsx */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
import { AlertModal, ConfirmModal } from "../components/ModalDialogs";
import { generatePDF } from '../utils/pdfGenerator';
import { generateCSV } from '../utils/csvGenerator';
import { DownloadDropdown } from '../components/DownloadDropdown';
import {
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
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnMetadata, setCustomColumnMetadata] = useState({});
  const [availableColumns, setAvailableColumns] = useState(DEFAULT_COLUMNS);

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
    const intervalId = setInterval(fetchAvailableColumns, 60000);
    return () => clearInterval(intervalId);
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
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: '', message: '', type: 'info' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState({ title: '', message: '' });
  const [confirmAction, setConfirmAction] = useState(null);

  const showAlert = (title, message, type = 'info') => {
    setAlertMessage({ title, message, type });
    setShowAlertModal(true);
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmMessage({ title, message });
    setConfirmAction(() => onConfirm);
    setShowConfirmModal(true);
  };

  // Reset form
  useEffect(() => {
    if (!showCreate && !showEdit) {
      setForm(initialForm);
      setCreating(false);
      setEditing(false);
      setEditingId(null);
    }
  }, [showCreate, showEdit, initialForm]);

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


  async function handleSubmit(e) {
    e.preventDefault();
    const isEdit = !!editingId;
    isEdit ? setEditing(true) : setCreating(true);

    const cleanVal = (val) => (val === "" || val === undefined ? null : val);

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
      ...Object.fromEntries(customColumns.map(col => [col, cleanVal(form[col])]))
    };

    try {
      let response;
      if (isEdit) {
        response = await api.put(`/api/emergency-protocols/${editingId}`, payload);
      } else {
        response = await api.post("/api/emergency-protocols", payload);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      await loadTasks();

      setShowCreate(false);
      setShowEdit(false);
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
      () => handleDeleteConfirmed(id)
    );
  }

  async function handleDeleteConfirmed(id) {
    try {
      await api.delete(`/api/emergency-protocols/${id}`);
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadTasks();
    } catch (err) {
      console.error("Delete error:", err);
      showAlert("Error", "Failed to delete task: " + (err.response?.data?.error || err.message), "error");
    }
  }

  function openEdit(task) {
    setEditingId(task.id);
    const raw = task.raw || {};
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
      ...customColumns.reduce((acc, col) => ({ ...acc, [col]: raw[col] || '' }), {})
    });

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
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">

        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergency Protocols</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Escalations</span>
              <span>&gt;</span>
              <span>Emergency Protocols</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
              <button
                onClick={() => setShowCreate(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <span>+</span>
                <span>Create Work Order</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Overdue</div>
              <div className="text-2xl font-bold text-gray-900">{stats.overdue}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Due This Week</div>
              <div className="text-2xl font-bold text-gray-900">{stats.dueThisWeek}</div>
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

        {/* Main Content Area - Emergency Protocols Table */}
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
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
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
                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors border ${visibleColumns[col]
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
                                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors border ${visibleColumns[col]
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
                    <span>+</span>
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
                    {visibleColumns.assigned && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ASSIGNED TO</th>
                    )}
                    {visibleColumns.date && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DATE</th>
                    )}
                    {/* Custom columns in table header - POSITIONED BEFORE ACTIONS with STANDARD UI */}
                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                      <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">{col}</th>
                    ))}
                    {visibleColumns.actions && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
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
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 whitespace-nowrap">
                              {row.type}
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
                                className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
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
                              <span className={`text-sm font-semibold ${statusStyle.text}`}>{row.status}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.assigned && (
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
                        {visibleColumns.date && (
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-gray-900 font-medium">{formatDate(row.date)}</span>
                          </td>
                        )}
                        {/* Custom columns in table rows - POSITIONED BEFORE ACTIONS with STANDARD UI */}
                        {customColumns.filter(col => visibleColumns[col]).map(col => (
                          <td key={col} className="py-4 px-4">
                            <span className="text-gray-900 font-medium">{row.raw?.[col] ?? '-'}</span>
                          </td>
                        ))}
                        {visibleColumns.actions && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleView(row)}
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
                      <td colSpan="9" className="py-8 text-center text-gray-500">No work orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['Pending', 'In Progress', 'Completed'].map((status) => {
                  const statusItems = filtered.filter((protocol) => {
                    const protocolStatus = protocol.status || 'Pending';
                    return protocolStatus.toLowerCase() === status.toLowerCase();
                  });

                  const getStatusStyle = (status) => {
                    if (status === 'Pending') {
                      return {
                        bg: 'bg-orange-50',
                        border: 'border-orange-200',
                        header: 'bg-orange-100',
                        text: 'text-orange-700',
                        dot: 'bg-orange-500'
                      };
                    }
                    if (status === 'In Progress') {
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
                            statusItems.map((protocol) => {
                              const priorityColor = getPriorityColor(protocol.priority || "Medium");

                              return (
                                <div
                                  key={protocol.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => handleView(protocol)}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{protocol.reference || `EP-${protocol.id}`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {protocol.priority || "Medium"}
                                      </span>
                                    </div>
                                  </div>

                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {protocol.title || "Emergency Task"}
                                  </h4>

                                  {protocol.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {protocol.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 mb-3">
                                    {protocol.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {protocol.category}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    <div className="flex items-center gap-2">
                                      {protocol.assignedTo && protocol.assignedTo !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(protocol.assignedTo)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(protocol.assignedTo)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {protocol.assignedTo}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>

                                    <span className="text-xs text-gray-500">
                                      {formatDate(protocol.date)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleView(protocol);
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
                                          openEdit(protocol);
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
                                          handleDelete(protocol.id);
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

      {/* --- VIEW MODAL --- */}
      {showView && viewing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full h-[70vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Task Details</h2>
                <p className="text-xs text-gray-500 mt-1">View protocol information</p>
              </div>
              <button onClick={() => { setViewing(null); setShowView(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <>
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
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

              <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setViewing(null); setShowView(false); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </>
          </div>
        </div>
      )}

      {/* --- FORM MODAL --- */}
      {(showCreate || showEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative h-[70vh] flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {showEdit ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                onClick={() => { setShowCreate(false); setShowEdit(false); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form id="taskForm" onSubmit={handleSubmit} className="p-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">

                {showEdit && (
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reference ID</label>
                    <input disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500" value={form.reference} />
                  </div>
                )}

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                  <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>



                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Property</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white" value={form.property_id} onChange={handleHotelChange}>
                    <option value="">Select Property</option>
                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white" value={form.category} onChange={handleCategoryChange}>
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
                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                      />
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <button
                          type="button"
                          onClick={saveCustomCategory}
                          className="px-3 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 text-sm font-medium whitespace-nowrap"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomCategoryInput(false);
                            setCustomCategoryValue('');
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                  {form.property_id && staffMembers.length > 0 ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-gray-50"
                      value={form.assigned_to_name}
                      onChange={e => setForm({ ...form, assigned_to_name: e.target.value })}
                      placeholder={form.property_id ? "Loading staff..." : "Select property first"}
                      disabled={!form.property_id}
                    />
                  )}
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reported By</label>
                  <input
                    type="text"
                    value={form.reported_by}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200" value={formatDateISO(form.scheduled_date)} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>

                {/* Render custom columns in form - Standardized UI */}
                {customColumns.map(col => {
                  const meta = customColumnMetadata[col] || {};
                  const inputType = meta.input_type || 'text';
                  const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                  return (
                    <div key={col} className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {col.replace(/_/g, ' ').toUpperCase()}
                      </label>
                      {inputType === 'checkbox' ? (
                        <div className="flex items-center h-10">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            checked={!!form[col]}
                            onChange={(e) => setForm({ ...form, [col]: e.target.checked })}
                          />
                          <span className="ml-2 text-sm text-gray-700">Yes</span>
                        </div>
                      ) : inputType === 'dropdown' || inputType === 'select' ? (
                        <select
                          value={form[col] || ''}
                          onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                        >
                          <option value="">Select...</option>
                          {options.map((opt, idx) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : inputType === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={form[col] || ''}
                          onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                        />
                      ) : inputType === 'date' ? (
                        <input
                          type="date"
                          value={form[col] ? formatDateISO(form[col]) : ''}
                          onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                        />
                      ) : (
                        <input
                          type={inputType}
                          value={form[col] || ''}
                          onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                          placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setShowEdit(false); }}
                  className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || editing}
                  className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                >
                  {creating ? "Creating..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialogs */}
      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title={alertMessage.title}
        message={alertMessage.message}
        type={alertMessage.type}
      />
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmAction}
        title={confirmMessage.title}
        message={confirmMessage.message}
      />
    </div>
  );
}