/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { AlertModal, ConfirmModal } from '../components/ModalDialogs';
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

  const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

  // Fetch available columns from Forms Builder
  const fetchAvailableColumns = async () => {
    try {
      const res = await api.get('/api/forms-builder/tables/litigation_tasks/columns');
      const cols = res.data?.columns || [];

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

  // Poll for new columns every 5 seconds
  useEffect(() => {
    fetchAvailableColumns();
    const interval = setInterval(fetchAvailableColumns, 5000);
    return () => clearInterval(interval);
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
    showConfirm(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      () => handleDeleteConfirmed(t.id)
    );
  };

  const handleDeleteConfirmed = async (id) => {
    try {
      await api.delete(`/api/litigation/${id}`);
      await refreshTasks();
    } catch (err) {
      showAlert('Error', 'Failed to delete task. Please try again.', 'error');
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
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
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
              <button
                onClick={() => { setSelectedTask(null); setModalMode('create'); setShowModal(true); }}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Gavel className="w-4 h-4" />
                <span>Create Task</span>
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
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Gavel className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Cases</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">High Priority</div>
              <div className="text-2xl font-bold text-gray-900">{stats.highPriority}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-yellow-100 text-yellow-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">In Court</div>
              <div className="text-2xl font-bold text-gray-900">{stats.inCourt}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Closed</div>
              <div className="text-2xl font-bold text-gray-900">{stats.closed}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Litigation Table */}
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
                    placeholder="Search work orders..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                {/* Action Buttons */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* View Settings Dropdown */}
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
                              <Gavel className="w-4 h-4" />
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
                    onClick={() => { setSelectedTask(null); setModalMode('create'); setShowModal(true); }}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Gavel className="w-4 h-4" />
                    <span>Create Task</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
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
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
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
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
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

              {(filterPriority !== 'All Priority' || filterStatus !== 'All Status' || filterProperty !== 'All Properties' || sortBy) && (
                <button
                  onClick={() => {
                    setFilterPriority('All Priority');
                    setFilterStatus('All Status');
                    setFilterProperty('All Properties');
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
                    {visibleColumns.type && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">TYPE</th>}
                    {visibleColumns.reference && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">REFERENCE</th>}
                    {visibleColumns.description && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DESCRIPTION</th>}
                    {visibleColumns.priority && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">PRIORITY</th>}
                    {visibleColumns.status && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">STATUS</th>}
                    {visibleColumns.assigned && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ASSIGNED TO</th>}
                    {visibleColumns.date && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">DATE</th>}
                    {visibleColumns.actions && <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ACTIONS</th>}
                    {/* Custom Columns */}
                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                      <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tasksLoading ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : filteredTasks.length > 0 ? filteredTasks.map(task => {
                    const priorityStyle = getPriorityColor(task.priority || "Medium");
                    const statusStyle = getStatusColor(task.status || "Pending");

                    return (
                      <tr key={task.id} className="hover:bg-teal-50/30 transition-all border-b border-gray-100 last:border-0">
                        {visibleColumns.checkbox && (
                          <td className="py-4 px-4">
                            <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
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
                                className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
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
                          <td className="py-4 px-4">
                            <span className="text-gray-600 text-sm">{formatDate(task.scheduled_date || task.date)}</span>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setSelectedTask(task); setModalMode('view'); setShowModal(true); }}
                                className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {hasUpdate && (
                                <button
                                  onClick={() => { setSelectedTask(task); setModalMode('edit'); setShowModal(true); }}
                                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {hasDelete && (
                                <button
                                  onClick={() => handleDelete(task)}
                                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
                            <span className="text-gray-700 text-sm">{task[col] || '-'}</span>
                          </td>
                        ))}
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
                              <Gavel className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No cases</p>
                            </div>
                          ) : (
                            statusItems.map((task) => {
                              const priorityColor = getPriorityColor(task.priority || "Medium");

                              return (
                                <div
                                  key={task.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
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
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs font-medium">
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
                                          setSelectedTask(task); setModalMode('edit'); setShowModal(true);
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
                                          showConfirm('Delete Litigation Case', 'Are you sure you want to delete this case?', () => handleDelete(task.id));
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

      {showModal && (
        <LitigationModal
          api={api} hotels={hotels} hotelsLoading={hotelsLoading}
          currentUser={currentUser}
          onClose={() => setShowModal(false)}
          submitting={submitting} setSubmitting={setSubmitting}
          error={error} setError={setError}
          refreshTasks={refreshTasks}
          initialData={selectedTask} mode={modalMode}
          customColumns={customColumns}
        />
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


function LitigationModal({ api, hotels = [], hotelsLoading = false, onClose, submitting, setSubmitting, error, setError, refreshTasks = () => { }, initialData = null, mode = 'create', customColumns = [], currentUser }) {
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
          payload[col] = form[col];
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
    const DetailField = ({ label, value }) => (
      <div>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
        <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
      </div>
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-gray-900">Task Details</h3>
              <span className={`px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-xs font-bold uppercase tracking-wide border border-orange-100`}>
                {form.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
              <DetailField label="TITLE" value={form.title} />
              <DetailField label="PROPERTY" value={form.propertyName} />

              <DetailField label="SCHEDULED DATE" value={form.scheduledDate ? new Date(form.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : '-'} />
              <DetailField label="CATEGORY" value={form.category} />

              <DetailField label="PRIORITY" value={form.priority} />
              <DetailField label="REPORTED BY" value={form.reportedBy} />

              <DetailField label="ASSIGNED TO" value={form.assignedTo} />
              <div>{/* Empty slot to balance grid if needed */}</div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">ADDITIONAL NOTES / DESCRIPTION</div>
              <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[80px]">
                {form.description}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 border border-slate-200 text-slate-700 font-medium rounded hover:bg-slate-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- EDIT/CREATE FORM UI ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-hidden">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative flex flex-col h-[70vh]">
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? "Edit Case" : "New Case"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form id="lit-form" onSubmit={submit} className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Row 1: Title (Full Width) */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                />
              </div>
              {/* Row 2: Description (Full Width) */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none resize-y"
                />
              </div>
              {/* Row 3: Property & Category */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
                <select
                  required
                  value={form.property}
                  onChange={handlePropertyChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                >
                  <option value="">Select property</option>
                  {hotelsLoading ? <option>Loading...</option> : hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={form.category}
                  onChange={handleCategoryChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
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
              {/* Row 4: Priority & Assigned To */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                {form.property ? (
                  <select
                    value={form.assignedTo || ''}
                    onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value, assignedToId: '' }))}
                    disabled={!form.property || staffLoading}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                )}
              </div>
              {/* Row 5: Reported By & Date */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reported By</label>
                <input
                  value={form.reportedBy}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
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
                      {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                        onChange={e => setForm({ ...form, [col]: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
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
                        onChange={e => setForm({ ...form, [col]: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                      />
                    ) : inputType === 'date' ? (
                      <input
                        type="date"
                        value={form[col] ? formatDate(form[col]) : ''} /* Note: formatDate helper might need ISO format, checking... use simple logic if unsure */
                        onChange={e => setForm({ ...form, [col]: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                      />
                    ) : (
                      <input
                        type={inputType}
                        value={form[col] || ''}
                        onChange={e => setForm({ ...form, [col]: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        placeholder={`Enter ${col.replace(/_/g, ' ')}`}
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
              onClick={onClose}
              className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lit-form"
              disabled={submitting}
              className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
            >
              {submitting ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
