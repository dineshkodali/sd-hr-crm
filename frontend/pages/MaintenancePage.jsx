/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/MaintenancePage.jsx */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
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
  Check 
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

/* SAMPLE fallback data */
const SAMPLE = [
  { id: 1, title: "Fix heating system malfunction", start: "2024-03-12", category: "Maintenance", hotel: "Building C", room: "Main Panel", raisedBy: "ABC Maintenance", status: "Completed", action: "Review", dueDate: "2024-03-12", closed: null, priority: "Medium", ref: "e5198a6e" },
  { id: 2, title: "Unblock kitchen sink", start: "2024-03-01", category: "Plumbing", hotel: "Building B", room: "Flat 301", raisedBy: "Unassigned", status: "Pending", action: "Under Repair", dueDate: "2024-03-18", closed: null, priority: "Medium", ref: "c51690eb" },
  { id: 3, title: "Repair leaking tap in bathroom", start: "2024-03-08", category: "Plumbing", hotel: "Building D", room: "Generator Room", raisedBy: "In-house Team", status: "Completed", action: "Closed", dueDate: "2024-03-10", closed: "2024-03-10", priority: "Low", ref: "cda9bd4e" },
  { id: 4, title: "Repair shower head", start: "2025-09-04", category: "Sanitary", hotel: "Parmiter", room: "Room 100", raisedBy: "Quick Fix Services", status: "Completed", action: "Pending", dueDate: "2025-09-30", closed: null, priority: "Urgent", ref: "2b9c6ef8" },
  { id: 5, title: "Repair ceiling leak", start: "2024-03-10", category: "Structural", hotel: "Building A", room: "Flat 203", raisedBy: "Unassigned", status: "Pending", action: "Pending", dueDate: "2024-03-20", closed: null, priority: "Low", ref: "f3c0c417" },
];

/* --- Helpers --- */
function formatDateISO(value) {
  if (!value) return "";
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
const DetailField = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
    <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
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
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filter and Sort State
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  
  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(false);

  // VIEW STATE
  const [showView, setShowView] = useState(false);

  // Column Visibility State
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
  const viewRef = useRef(null);

  const hotelsControllerRef = useRef(null);

  // Updated form state to match the new image fields
  const initialForm = useMemo(() => ({
    title: "", 
    room: "",
    start: "", 
    raisedBy: "",
    category: "", 
    status: "Open", 
    hotelId: "",
    hotelName: "", 
    action: "", 
    dueDate: "", 
    closed: "", 
    description: "",
    priority: "Medium"
  }), []);
  const [form, setForm] = useState(initialForm);

  // Custom columns from Forms Builder
  const [customColumns, setCustomColumns] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);

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
                // Only auto-show if not explicitly set in localStorage
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
  }, []);

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
          id: t.id,
          title: t.title ?? t.name ?? "",
          start: formatDateISO(t.start_date || t.start),
          category: t.category || "Maintenance",
          hotel: t.site || t.hotel_name || "",
          room: t.room || "",
          raisedBy: t.raised_by || "Unassigned",
          status: t.status || "Open",
          action: t.action || "",
          dueDate: formatDateISO(t.due_date),
          closed: formatDateISO(t.closed_date),
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
      if (err.name === "AbortError") return;
      console.error("Failed to load tasks:", err);
      setTasks(SAMPLE);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    hotelsControllerRef.current = ac;
    fetchHotels(ac.signal);
    loadTasks(ac.signal);
    return () => {
      try { ac.abort(); } catch {}
      hotelsControllerRef.current = null;
    };
  }, [fetchHotels, loadTasks]);

  /* ------------------------- Logic ------------------------- */
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = tasks || [];
    
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

  const handleDownloadPDF = () => {
    const columns = [
      { header: 'Title', key: 'title' },
      { header: 'Property', key: 'hotel' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Assigned To', key: 'assignedTo' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Description', key: 'description' }
    ];
    
    const data = filtered.map(task => ({
      title: task.title || '-',
      hotel: task.hotel || '-',
      priority: task.priority || '-',
      status: task.status || '-',
      assignedTo: task.assignedTo || '-',
      dueDate: task.dueDate || '-',
      description: task.description || '-'
    }));
    
    generatePDF(data, columns, 'Maintenance Tasks Report', 'maintenance-tasks-report');
  };

  // CSV Download Handler
  const handleDownloadCSV = () => {
    const columns = [
      { header: 'Title', key: 'title' },
      { header: 'Property', key: 'hotel' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Assigned To', key: 'assignedTo' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Description', key: 'description' }
    ];
    
    const data = filtered.map(task => ({
      title: task.title || '-',
      hotel: task.hotel || '-',
      priority: task.priority || '-',
      status: task.status || '-',
      assignedTo: task.assignedTo || '-',
      dueDate: task.dueDate || '-',
      description: task.description || '-'
    }));
    
    generateCSV(data, columns, 'maintenance-tasks-report');
  };

  const stats = useMemo(() => {
    const list = tasks || SAMPLE;
    const total = list.length;
    const pending = list.filter(t => ["pending", "open"].includes(t.status.toLowerCase())).length;
    const inProgress = list.filter(t => ["in progress", "under review"].includes(t.status.toLowerCase())).length;
    const completed = list.filter(t => t.status.toLowerCase() === "completed").length;
    return { total, pending, inProgress, completed };
  }, [tasks]);

  /* ------------------------- Handlers ------------------------- */
  async function handleDelete(id) {
    if (!confirm("Delete this order?")) return;
    
    try {
      // Delete via API
      await api.delete(`/api/maintenance/${id}`);
      
      // Refetch tasks to get updated data
      await loadTasks();
    } catch (error) {
      console.error("Error deleting maintenance task:", error);
      alert("Failed to delete task. Please try again.");
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreating(true);
    
    try {
      // Prepare data for API call
      const createData = {
        title: form.title,
        start_date: form.start,
        category: form.category,
        hotel_name: form.hotelName,
        room: form.room,
        raised_by: form.raisedBy,
        status: form.status || "Pending",
        action: form.action,
        due_date: form.dueDate,
        closed_date: form.closed,
        priority: form.priority || "Medium",
        description: form.description
      };

      // Include custom columns
      customColumns.forEach(col => {
        if (form[col] !== undefined) {
          createData[col] = form[col];
        }
      });

      // Create via API
      await api.post("/api/maintenance", createData);
      
      // Refetch tasks to get updated data
      await loadTasks();
      
      setShowCreate(false);
    } catch (error) {
      console.error("Error creating maintenance task:", error);
      alert("Failed to create task. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditing(true);
    
    try {
      // Prepare data for API call
      const updateData = {
        title: form.title,
        start_date: form.start,
        category: form.category,
        hotel_name: form.hotelName,
        room: form.room,
        raised_by: form.raisedBy,
        status: form.status,
        action: form.action,
        due_date: form.dueDate,
        closed_date: form.closed,
        priority: form.priority,
        description: form.description
      };

      // Include custom columns
      customColumns.forEach(col => {
        if (form[col] !== undefined) {
          updateData[col] = form[col];
        }
      });

      // Update via API
      await api.put(`/api/maintenance/${editingId}`, updateData);
      
      // Refetch tasks to get updated data
      await loadTasks();
      
      setShowEdit(false);
    } catch (error) {
      console.error("Error updating maintenance task:", error);
      alert("Failed to update task. Please try again.");
    } finally {
      setEditing(false);
    }
  }

  function openEdit(task) {
    setEditingId(task.id);
    const hotelRecord = hotels.find((h) => h.name === task.hotel || String(h.id) === String(task.hotel)) || null;
    const hotelId = hotelRecord?.id ?? (typeof task.hotel === 'number' ? task.hotel : '');
    const hotelName = hotelRecord?.name ?? task.hotel ?? '';
    
    // Include custom column values
    const formData = { 
      ...task,
      hotelId: hotelId,
      hotelName: hotelName
    };
    
    // Load custom column values
    customColumns.forEach(col => {
      if (task[col] !== undefined) {
        formData[col] = task[col];
      }
    });
    
    setForm(formData);
    setShowEdit(true);
  }

  function openView(task) {
    const hotelRecord = hotels.find((h) => h.name === task.hotel || String(h.id) === String(task.hotel)) || null;
    const hotelId = hotelRecord?.id ?? (typeof task.hotel === 'number' ? task.hotel : '');
    const hotelName = hotelRecord?.name ?? task.hotel ?? '';
    setForm({ 
      ...task,
      hotelId: hotelId,
      hotelName: hotelName
    });
    setShowView(true);
  }

  function handleFormChange(field, value) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function handleHotelChange(e) {
    const hotelId = e.target.value;
    const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
    setForm((p) => ({ ...p, hotelId: hotelId, hotelName: hotel ? hotel.name : '' }));
  }

  /* ------------------------- UI RENDERER ------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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
                onDownloadPDF={handleDownloadPDF}
                onDownloadCSV={handleDownloadCSV}
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Wrench className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Pending</div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7" />
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
                              className={`flex-1 px-3 py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                                viewMode === 'table'
                                  ? 'bg-teal-500 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <Columns className="w-4 h-4" />
                              <span>Table</span>
                            </button>
                            <button
                              onClick={() => setViewMode('board')}
                              className={`flex-1 px-3 py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                                viewMode === 'board'
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
                        
                        {/* Property Visibility Panel */}
                        {showPropertyVisibility && (
                          <div className="mt-2 border-t border-gray-200 pt-3">
                            {/* Default Columns Section */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Default Columns
                                </span>
                                <button
                                  onClick={() => {
                                    const updated = { ...visibleColumns };
                                    DEFAULT_COLUMNS.forEach(col => { updated[col] = false; });
                                    setVisibleColumns(updated);
                                  }}
                                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                                >
                                  Hide all
                                </button>
                              </div>
                              <div className="space-y-1">
                                {DEFAULT_COLUMNS.filter(col => visibleColumns[col]).map(col => (
                                  <button
                                    key={col}
                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: false })}
                                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                  >
                                    <span className="capitalize">{col}</span>
                                    <Eye className="w-4 h-4 text-teal-600" />
                                  </button>
                                ))}
                                {DEFAULT_COLUMNS.filter(col => !visibleColumns[col]).map(col => (
                                  <button
                                    key={col}
                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: true })}
                                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-50 rounded transition-colors"
                                  >
                                    <span className="capitalize">{col}</span>
                                    <EyeOff className="w-4 h-4 text-gray-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Custom Columns Section */}
                            {customColumns.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                                    Custom Columns ({customColumns.length})
                                  </span>
                                  <button
                                    onClick={() => {
                                      const updated = { ...visibleColumns };
                                      customColumns.forEach(col => { updated[col] = false; });
                                      setVisibleColumns(updated);
                                    }}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                  >
                                    Hide all
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {customColumns.filter(col => visibleColumns[col]).map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setVisibleColumns({ ...visibleColumns, [col]: false })}
                                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-purple-700 hover:bg-purple-50 rounded transition-colors"
                                    >
                                      <span>{col.replace(/_/g, ' ')}</span>
                                      <Eye className="w-4 h-4 text-purple-600" />
                                    </button>
                                  ))}
                                  {customColumns.filter(col => !visibleColumns[col]).map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setVisibleColumns({ ...visibleColumns, [col]: true })}
                                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-50 rounded transition-colors"
                                    >
                                      <span>{col.replace(/_/g, ' ')}</span>
                                      <EyeOff className="w-4 h-4 text-gray-400" />
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
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {visibleColumns.checkbox && (
                    <th className="text-left py-3 px-4">
                      <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                    </th>
                  )}
                  {visibleColumns.type && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">TYPE</th>
                  )}
                  {visibleColumns.reference && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">REFERENCE</th>
                  )}
                  {visibleColumns.description && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</th>
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
                  {visibleColumns.actions && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  )}
                  {/* Custom Columns */}
                  {customColumns.filter(col => visibleColumns[col]).map(col => (
                    <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-purple-600 uppercase tracking-wider">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : filtered.length > 0 ? filtered.map((row) => {
                  const priorityStyle = getPriorityColor(row.priority);
                  const statusStyle = getStatusColor(row.status);
                  
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {visibleColumns.checkbox && (
                        <td className="py-4 px-4">
                          <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100">
                            {row.category || "Maintenance"}
                          </span>
                        </td>
                      )}
                      {visibleColumns.reference && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-medium">MNT-2025-{row.ref || (row.id ? Number(row.id).toString(36).padStart(8, '0').slice(-8) : '')}</span>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="py-4 px-4">
                          <div>
                            <div 
                              className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors`}
                              onClick={hasUpdate ? () => openEdit(row) : undefined}
                            >
                              {row.title}
                            </div>
                            <div className="text-gray-500 text-xs mt-1">
                              {row.description || "Maintenance work required as per inspection report."}
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                            <span className={`text-sm ${priorityStyle.text}`}>{row.priority}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                            <span className={`text-sm ${statusStyle.text}`}>{row.status === "Open" ? "Pending" : row.status}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.assigned && (
                        <td className="py-4 px-4">
                          {row.raisedBy === "Unassigned" ? (
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.raisedBy)} flex items-center justify-center text-xs font-semibold`}>
                                {getInitials(row.raisedBy)}
                              </div>
                              <span className="text-gray-900 text-sm">{row.raisedBy}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 text-sm">{formatDate(row.start || row.dueDate)}</span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openView(row)}
                              className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasUpdate && (
                              <button
                                onClick={() => openEdit(row)}
                                className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {hasDelete && (
                              <button
                                onClick={() => handleDelete(row.id)}
                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {/* Custom Column Cells */}
                      {customColumns.filter(col => visibleColumns[col]).map(col => (
                        <td key={col} className="py-4 px-4">
                          <span className="text-gray-700 text-sm">{row[col] || '-'}</span>
                        </td>
                      ))}
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
                {['Open', 'Pending', 'Completed'].map((status) => {
                  const statusItems = filtered.filter((task) => {
                    return (task.status || 'Open').toLowerCase() === status.toLowerCase();
                  });
                  
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
                    <div key={status} className="flex-shrink-0 w-80">
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
                                  onClick={() => viewTask(task)}
                                >
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
                                  
                                  <div className="flex items-center gap-2 mb-3">
                                    {task.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {task.category}
                                      </span>
                                    )}
                                    {task.room && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs font-medium">
                                        {task.room}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    <div className="flex items-center gap-2">
                                      {task.raisedBy && task.raisedBy !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(task.raisedBy)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(task.raisedBy)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {task.raisedBy}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>
                                    
                                    <span className="text-xs text-gray-500">
                                      {formatDate(task.dueDate)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        viewTask(task);
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
                                          editTask(task);
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
                                          deleteTask(task.id);
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
      {(showCreate || showEdit || showView) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {showView ? "View Maintenance Task" : (showEdit ? "Edit Maintenance Task" : "Create Maintenance Task")}
              </h3>
              <button 
                onClick={() => { setShowCreate(false); setShowEdit(false); setShowView(false); }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Content */}
            {showView ? (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
                  <DetailField label="TASK TITLE" value={form.title} />
                  <DetailField label="PROPERTY" value={form.hotelName} />
                  
                  <DetailField label="ROOM / AREA" value={form.room} />
                  <DetailField label="CATEGORY" value={form.category} />
                  
                  <DetailField label="START DATE" value={form.start ? new Date(form.start).toLocaleDateString(undefined, {weekday:'short', year:'numeric', month:'long', day:'numeric'}) : '-'} />
                  <DetailField label="DUE DATE" value={form.dueDate ? new Date(form.dueDate).toLocaleDateString(undefined, {weekday:'short', year:'numeric', month:'long', day:'numeric'}) : '-'} />

                  <DetailField label="PRIORITY" value={form.priority} />
                  <DetailField label="STATUS" value={form.status} />

                  <DetailField label="RAISED BY" value={form.raisedBy} />
                  <DetailField label="ACTION REQUIRED" value={form.action} />
                </div>

                <div className="mb-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">ADDITIONAL NOTES / DESCRIPTION</div>
                  <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[80px]">
                    {form.description || "No description provided."}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => setShowView(false)} 
                    className="px-5 py-2 border border-slate-200 text-slate-700 font-medium rounded hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Edit/Create Form Content */
              <form onSubmit={showEdit ? handleEditSubmit : handleCreateSubmit} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  
                  {/* Row 1: Title & Room */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Task Title <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={form.title} 
                      onChange={e => handleFormChange("title", e.target.value)} 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Room No</label>
                    <input 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={form.room} 
                      onChange={e => handleFormChange("room", e.target.value)} 
                    />
                  </div>

                  {/* Row 2: Start Date & Raised By */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                    <input 
                      type="date"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={formatDateISO(form.start)} 
                      onChange={e => handleFormChange("start", e.target.value)} 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Raised By</label>
                    <input 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={form.raisedBy} 
                      onChange={e => handleFormChange("raisedBy", e.target.value)} 
                    />
                  </div>

                  {/* Row 3: Category & Status */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <input 
                      placeholder="e.g., CAT1"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={form.category} 
                      onChange={e => handleFormChange("category", e.target.value)} 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white" 
                      value={form.status} 
                      onChange={e => handleFormChange("status", e.target.value)}
                    >
                      <option>Open</option>
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </div>

                  {/* Row 4: Hotel Name & Action */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Property</label>
                    <select 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white" 
                      value={form.hotelId} 
                      onChange={handleHotelChange}
                    >
                      <option value="">-- Select hotel --</option>
                      {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    {hotelsLoading && <div className="text-xs text-gray-400 mt-0.5">Loading hotels...</div>}
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
                    <input 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={form.action} 
                      onChange={e => handleFormChange("action", e.target.value)} 
                    />
                  </div>

                  {/* Row 5: Due Date (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                     <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                     <input 
                      type="date"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={formatDateISO(form.dueDate)} 
                      onChange={e => handleFormChange("dueDate", e.target.value)} 
                    />
                  </div>

                  {/* Row 6: Closed Date (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                     <label className="block text-xs font-medium text-gray-600 mb-1">Closed Date (if any)</label>
                     <input 
                      type="date"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                      value={formatDateISO(form.closed)} 
                      onChange={e => handleFormChange("closed", e.target.value)} 
                    />
                  </div>

                  {/* Row 7: Description (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                    <textarea 
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" 
                      value={form.description} 
                      onChange={e => handleFormChange("description", e.target.value)} 
                    />
                  </div>

                  {/* Custom Columns from Forms Builder */}
                  {customColumns.map(col => (
                    <div key={col} className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-purple-600 mb-1">
                        {col.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        className="w-full border border-purple-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        value={form[col] || ''}
                        onChange={e => handleFormChange(col, e.target.value)}
                      />
                    </div>
                  ))}
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
                    className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                  >
                    {creating || editing ? "Saving..." : (showEdit ? "Update Task" : "Create Task")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}