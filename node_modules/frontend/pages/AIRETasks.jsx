/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { AlertModal, ConfirmModal } from '../components/ModalDialogs';
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
  Home,
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
    try {
      const saved = localStorage.getItem('aireTasksVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all default columns are present
        return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load visible columns from localStorage:', e);
    }
    return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
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

  const api = useMemo(() => axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
    timeout: 15000
  }), []);

  // Hide sidebar and navbar when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showModal]);

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
            assignedToId: t.assigned_to_id,
            date: t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString() : (t.created_at ? new Date(t.created_at).toLocaleDateString() : new Date().toLocaleDateString()),

            // Store additional details for View Mode
            category: t.category,
            reportedBy: t.reported_by || t.reportedBy,
            propertyId: t.property_id || t.propertyId,
            propertyName: t.property_name || t.propertyName,
            serviceUserId: t.service_user_id,
            rawDate: t.scheduled_date,

            // Preserve all custom columns from API response
            ...t
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

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (mounted) {
        fetchAvailableColumns();
      }
    }, 5000); // Check every 5 seconds

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Handle New Task Creation
  const handleCreateTask = (newTask) => {
    (async () => {
      setModalError(null);
      setModalSubmitting(true);
      try {
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
          ...customColumns.reduce((acc, col) => ({ ...acc, [col]: newTask[col] || null }), {})
        };
        const res = await api.post('/api/aire-tasks', payload);
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
            ...created
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
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Task',
      message: `Delete task ${task.reference}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setTasks(prev => prev.filter(t => String(t.id) !== String(task.id)));
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await api.delete(`/api/aire-tasks/${encodeURIComponent(task.id)}`).catch(() => null);
        } catch (err) {
          console.warn('Failed to delete task', err?.message || err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
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
          ...customColumns.reduce((acc, col) => ({ ...acc, [col]: updatedTask[col] || null }), {})
        };


        const res = await api.patch(`/api/aire-tasks/${encodeURIComponent(id)}`, payload);
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
            ...updated
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
                rawDate: t.scheduled_date,
                // Preserve all custom columns from API response
                ...t
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">AIRE Tasks</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>AIRE Tasks</span>
            </div>
          </div>
          {hasCreate && (
            <button
              onClick={() => { setEditingTask(null); setIsViewing(false); setShowModal(true); }}
              className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-md py-2 px-4 flex items-center gap-2 transition-colors"
            >
              <span>+</span>
              <span>Create Task</span>
            </button>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex items-center gap-4 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckSquare className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex items-center gap-4 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Overdue</div>
              <div className="text-2xl font-bold text-gray-900">{stats.overdue}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex items-center gap-4 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Due This Week</div>
              <div className="text-2xl font-bold text-gray-900">{stats.dueThisWeek}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex items-center gap-4 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - AIRE Tasks Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Work Orders</h2>
                <p className="text-sm text-gray-500">{filteredTasks.length} total records</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Filter tasks..."
                    className="bg-gray-50 border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-72 shadow-sm hover:shadow-md transition-all duration-200"
                  />
                </div>
                {/* Action Buttons */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
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
                              <CheckSquare className="w-4 h-4" />
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
                      onClick={() => { setEditingTask(null); setIsViewing(false); setShowModal(true); }}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-md py-2 px-4 text-sm flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Create Task</span>
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
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={selectedPriority}
                  onChange={e => setSelectedPriority(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option>All Priority</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option>All Status</option>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Overdue</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={selectedProperty}
                  onChange={e => setSelectedProperty(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option>All Properties</option>
                  {filterProperties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer hover:border-gray-400 transition-colors"
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
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
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
                    {visibleColumns.type && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">TYPE</th>}
                    {visibleColumns.reference && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">REFERENCE</th>}
                    {visibleColumns.description && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</th>}
                    {visibleColumns.priority && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PRIORITY</th>}
                    {visibleColumns.status && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>}
                    {visibleColumns.assigned && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ASSIGNED TO</th>}
                    {visibleColumns.date && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DATE</th>}
                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                      <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {col.replace(/_/g, ' ').toUpperCase()}
                      </th>
                    ))}
                    {visibleColumns.actions && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : filteredTasks.length > 0 ? filteredTasks.map(task => {
                    const priorityStyle = getPriorityColor(task.priority || "Medium");
                    const statusStyle = getStatusColor(task.status || "Pending");

                    return (
                      <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                        {visibleColumns.checkbox && (
                          <td className="py-4 px-4">
                            <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100">
                              {task.type || "AIRE Tasks"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.reference && (
                          <td className="py-4 px-4">
                            <span className="text-gray-700 font-medium">{task.reference}</span>
                          </td>
                        )}
                        {visibleColumns.description && (
                          <td className="py-4 px-4">
                            <div>
                              <div
                                className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors`}
                                onClick={hasUpdate ? () => handleEdit(task) : undefined}
                              >
                                {task.title || task.description || "Task"}
                              </div>
                              <div className="text-gray-500 text-xs mt-1">
                                {task.description || "AIRE task details and requirements."}
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.priority && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                              <span className={`text-sm ${priorityStyle.text}`}>{task.priority || "Medium"}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                              <span className={`text-sm ${statusStyle.text}`}>{task.status || "Pending"}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.assigned && (
                          <td className="py-4 px-4">
                            {task.assignedTo === "Unassigned" || !task.assignedTo ? (
                              <span className="text-gray-500 text-sm">Unassigned</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full ${getAvatarColor(task.assignedTo)} flex items-center justify-center text-xs font-semibold`}>
                                  {getInitials(task.assignedTo)}
                                </div>
                                <span className="text-gray-900 text-sm">{task.assignedTo}</span>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.date && (
                          <td className="py-4 px-4">
                            <span className="text-gray-700 text-sm">{formatDate(task.date)}</span>
                          </td>
                        )}
                        {customColumns.filter(col => visibleColumns[col]).map(col => (
                          <td key={col} className="py-4 px-4">
                            <span className="text-gray-700 text-sm">{task[col] || ''}</span>
                          </td>
                        ))}
                        {visibleColumns.actions && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleView(task)}
                                className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {hasUpdate && (
                                <button
                                  onClick={() => handleEdit(task)}
                                  className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {hasDelete && (
                                <button
                                  onClick={() => handleDelete(task)}
                                  className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
                      <div className={`rounded-lg border ${style.border} ${style.bg}`}>
                        <div className={`${style.header} px-4 py-3 border-b ${style.border}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
                              <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>
                                {displayStatus}
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
                              <CheckSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No tasks</p>
                            </div>
                          ) : (
                            statusItems.map((task) => {
                              const priorityColor = getPriorityColor(task.priority || "Medium");

                              return (
                                <div
                                  key={task.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
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

                                  {task.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  {task.task_type && (
                                    <div className="mb-3">
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {task.task_type}
                                      </span>
                                    </div>
                                  )}

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
                                          setEditingTask(task); setIsViewing(false); setShowModal(true);
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
                                          handleDelete(task.id);
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

      {/* --- ADD/VIEW TASK MODAL --- */}
      {showModal && (
        <AddTaskModal
          api={api}
          editingTask={editingTask}
          readOnly={isViewing}
          error={modalError}
          submitting={modalSubmitting}
          customColumns={customColumns}
          currentUser={currentUser}
          onClose={() => { setShowModal(false); setModalError(null); setEditingTask(null); setIsViewing(false); }}
          onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        />
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

// Modal Component
function AddTaskModal({ api, editingTask, readOnly, error, submitting, onClose, onSubmit, customColumns = [], currentUser }) {
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
  const staffCacheRef = React.useRef({});
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
  }, [customColumns.join(',')]);  // Re-run when column list changes

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
      scheduledDate: editingTask.rawDate ? ('' + editingTask.rawDate).substring(0, 10) : f.scheduledDate,
      status: editingTask.status ?? 'Pending',
      // Prefill custom columns
      ...customColumns.reduce((acc, col) => ({ ...acc, [col]: editingTask[col] ?? '' }), {})
    }));

    if (editingTask.propertyId || editingTask.property_id) {
      const pid = editingTask.propertyId ?? editingTask.property_id;
      fetchServiceUsers(pid);
      fetchStaffForHotel(pid);
    }
  }, [editingTask, customColumns.join(',')]);  // Re-run when task or columns change

  async function fetchHotels(signal) {
    try {
      setHotelsLoading(true);
      const res = await api.get('/api/hotels', { params: { limit: 1000 }, signal });
      const normalized = normalizeHotelsResponse(res?.data ?? {});
      setHotels(normalized);
      if (normalized.length === 1 && !form.property) {
        setForm((f) => ({ ...f, property: normalized[0].id, propertyName: normalized[0].name }));
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
    onSubmit(form, editingTask ? editingTask.id : undefined);
  };

  React.useEffect(() => {
    const ctrl = new AbortController();
    hotelsControllerRef.current = ctrl;
    fetchHotels(ctrl.signal);
    return () => { try { ctrl.abort(); } catch { }; hotelsControllerRef.current = null; };
  }, []);

  // --- VIEW ONLY RENDER ---
  if (readOnly) {
    const DetailItem = ({ label, value }) => (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">{label}</div>
        <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
      </div>
    );

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">Task Details</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${form.status === 'Completed' ? 'bg-green-100 text-green-800' :
                form.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                  form.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-amber-100 text-amber-800'
                }`}>
                {form.status}
              </span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {/* View Body */}
          <div className="p-8 space-y-8 overflow-y-auto">
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <DetailItem label="Title" value={form.title} />
              <DetailItem label="Property" value={form.propertyName} />

              <DetailItem label="Scheduled Date" value={form.scheduledDate ? new Date(form.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : '-'} />
              <DetailItem label="Category" value={form.category} />

              <DetailItem label="Priority" value={form.priority} />
              <DetailItem label="Reported By" value={form.reportedBy} />

              <DetailItem label="Assigned To" value={form.assignedTo} />

              {/* Custom columns in view mode */}
              {customColumns.map(col => (
                <DetailItem key={col} label={col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={form[col]} />
              ))}
            </div>

            {/* Description Box */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-2">Additional Notes / Description</div>
              <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[60px]">
                {form.description || <span className="italic text-slate-400">No description provided</span>}
              </div>
            </div>
          </div>

          {/* Custom fields (read-only) */}
          {customColumns.length > 0 && (
            <div className="p-6 pt-0 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Fields</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customColumns.map((col) => (
                  <DetailItem
                    key={col}
                    label={col.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    value={form[col]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
            <button onClick={onClose} className="px-5 py-2 border border-slate-200 text-slate-700 font-medium rounded hover:bg-slate-50 transition-colors">
              Close
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
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form id="aire-form" onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Row 1: Title (Full Width) */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Brief description of task"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                  required
                />
              </div>
              {/* Row 2: Description (Full Width) */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Detailed description of the task..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none resize-y"
                  required
                />
              </div>
              {/* Row 3: Property & Category */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
                <select
                  name="property"
                  value={form.property}
                  onChange={handlePropertyChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                  required
                >
                  <option value="">Select property</option>
                  {hotelsLoading ? <option value="">Loading...</option> : hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleCategoryChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
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
                      className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
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
              {/* Row 4: Priority & Reported By */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority <span className="text-red-500">*</span></label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reported By</label>
                <input
                  type="text"
                  name="reportedBy"
                  value={form.reportedBy}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-gray-100 cursor-not-allowed"
                />
              </div>
              {/* Row 5: Assigned To & Scheduled Date */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                {form.property ? (
                  <select
                    name="assignedTo"
                    value={form.assignedTo || ''}
                    onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value, assignedToId: '' }))}
                    disabled={!form.property || staffLoading}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                )}
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  name="scheduledDate"
                  value={form.scheduledDate}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                />
              </div>

              {/* Custom columns from Forms Builder */}
              {customColumns.map(col => (
                <div key={col} className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <input
                    type="text"
                    name={col}
                    value={form[col] || ''}
                    onChange={handleChange}
                    placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            {error && <div className="text-sm text-red-500 mr-auto">{error}</div>}
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="aire-form"
              disabled={submitting}
              className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
            >
              {submitting ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}