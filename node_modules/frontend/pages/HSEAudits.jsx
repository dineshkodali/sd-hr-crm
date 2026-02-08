/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import {
  Home,
  ClipboardCheck,
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
  Check
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

/* --- Helpers --- */
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
  return items.map((h) => {
    const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;
    const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ''}`;
    return { id, name };
  }).filter((x) => x.id && x.name);
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
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  } catch { return value; }
}

function getPriorityColor(p) {
  const low = String(p).toLowerCase();
  if (low === "urgent" || low === "high" || low === "critical") return { dot: "bg-red-500", text: "text-red-700" };
  if (low === "medium") return { dot: "bg-orange-500", text: "text-orange-700" };
  return { dot: "bg-green-500", text: "text-green-700" };
}

function getStatusColor(s) {
  const low = String(s).toLowerCase();
  if (low === "completed" || low === "closed" || low === "passed") return { dot: "bg-green-500", text: "text-green-700" };
  if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
  if (low === "failed" || low === "overdue") return { dot: "bg-red-500", text: "text-red-700" };
  return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
  return "bg-teal-100 text-teal-700";
}

function getInitials(name) {
  if (!name || name === "Unassigned") return "UA";
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

/* Helper for View Details */
const DetailField = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
    <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
  </div>
);

const categoryOptions = ['Internal Audit', 'External Audit', 'Compliance Check', 'Safety Inspection', 'Environmental', 'Other'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

export default function HSEAudits({ user }) {
  // Get current user from props or localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for hse_audits module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("hse_audits");
  const hasCreate = canCreate("hse_audits");
  const hasUpdate = canUpdate("hse_audits");
  const hasDelete = canDelete("hse_audits");

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('create');

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedExportKeys, setSelectedExportKeys] = useState([]);

  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Filter and Sort State
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [sortBy, setSortBy] = useState("");

  // Column Visibility State
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
  const viewRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    property_id: '',
    property_name: '',
    category: '',
    priority: 'Medium',
    reported_by: '',
    assigned_to: '',
    scheduled_date: '',
    status: 'Open'
  });

  const CATEGORY_STORAGE_KEY = 'hseAudits.customCategories';
  const [customCategories, setCustomCategories] = useState([]);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryValue, setCustomCategoryValue] = useState('');

  // Custom columns from Forms Builder
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnMetadata, setCustomColumnMetadata] = useState({});
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

  const ALL_COLUMNS = availableColumns;

  // Column visibility state - load from localStorage or default to all visible
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('hseAuditsVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultCols = availableColumns.reduce((a, c) => ({ ...a, [c]: true }), {});
        return { ...defaultCols, ...parsed };
      }
    } catch (e) {
      console.error('Error loading column visibility:', e);
    }
    return availableColumns.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

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
      setFormData((p) => ({ ...p, category: '' }));
      return;
    }
    setShowCustomCategoryInput(false);
    setCustomCategoryValue('');
    setFormData((p) => ({ ...p, category: value }));
  };

  const saveCustomCategory = () => {
    const next = String(customCategoryValue || '').trim();
    if (!next) return;

    const builtins = categoryOptions;
    const builtinLower = new Set((builtins || []).map((t) => String(t).toLowerCase()));
    const merged = [...customCategories];
    if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
      merged.push(next);
      setCustomCategories(merged);
      persistCustomCategories(merged);
    }

    setFormData((p) => ({ ...p, category: next }));
    setShowCustomCategoryInput(false);
    setCustomCategoryValue('');
  };

  const normalizeStaffResponse = (data) => {
    const list = data?.staff ?? data?.users ?? data?.rows ?? data?.data ?? data ?? [];
    const arr = Array.isArray(list) ? list : [];
    return arr
      .map((u) => ({
        id: u?.id ?? u?.user_id ?? null,
        name: u?.name ?? u?.email ?? [u?.first_name, u?.last_name].filter(Boolean).join(' ') ?? ''
      }))
      .filter((u) => u?.id && u?.name);
  };

  const fetchStaffForHotel = async (hotelId) => {
    if (!hotelId) {
      setStaffUsers([]);
      return;
    }
    try {
      setStaffLoading(true);

      const paths = [
        `/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
        `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
      ];

      let data = null;
      let lastErr = null;
      for (const p of paths) {
        try {
          const r = await api.get(p);
          data = r?.data;
          if (data) break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!data) throw lastErr || new Error('Unable to load staff');
      setStaffUsers(normalizeStaffResponse(data));
    } catch (err) {
      console.error('fetchStaffForHotel error:', err);
      setStaffUsers([]);
    } finally {
      setStaffLoading(false);
    }
  };

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('hseAuditsVisibleColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn('Failed to save visible columns to localStorage:', e);
    }
  }, [visibleColumns]);

  // Fetch available columns from Forms Builder
  const fetchAvailableColumns = async () => {
    try {
      const res = await api.get('/api/forms-builder/tables/hse_audits/columns');
      const columns = res?.data?.columns || res?.data || [];

      // Default UI columns
      const defaultColumns = ["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"];

      // System and known HSE Audits columns to exclude
      const systemColumns = [
        'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
        'title', 'description', 'property_id', 'property_name', 'category',
        'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'
      ];

      // Extract column names (handle both string arrays and object arrays)
      const columnNames = columns.map(col => {
        if (typeof col === 'string') return col;
        if (col.column_name) return col.column_name;
        if (col.name) return col.name;
        return String(col);
      });

      const customCols = columnNames
        .filter(col => !systemColumns.includes(col) && !defaultColumns.includes(col));

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
            // Only set visibility if not already in state (truly new column)
            if (prev[col] === undefined) {
              // Check localStorage for this column's visibility
              try {
                const saved = localStorage.getItem('hseAuditsVisibleColumns');
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
  }, [api]);

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
        setLoading(true);
        const r1 = await api.get('/api/hotels', { params: { limit: 1000 } }).catch(() => ({ data: [] }));
        const normalized = normalizeHotelsResponse(r1?.data ?? {});
        if (mounted) setHotels(normalized);

        const r2 = await api.get('/api/hse/audits?limit=500').catch(() => ({ data: [] }));
        if (mounted) setRecords(Array.isArray(r2?.data) ? r2.data : (r2?.data?.rows ?? r2?.data ?? []));
      } catch (err) {
        console.warn('load HSE audits failed', err);
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [api]);

  const refresh = async () => { try { setLoading(true); const r = await api.get('/api/hse/audits?limit=500'); setRecords(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? [])); } catch (err) { console.warn('refresh failed', err); } finally { setLoading(false); } };

  const openModal = (m = 'create', rec = null) => {
    setMode(m);
    if (m === 'create') {
      setFormData({
        title: '', description: '', property_id: '', property_name: '', category: '',
        priority: 'Medium', reported_by: currentUser?.name || '', assigned_to: '', scheduled_date: '', status: 'Open',
        ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
      });
    } else {
      setFormData({
        ...rec,
        property_id: rec?.property_id || '',
        property_name: rec?.property_name || '',
        ...customColumns.reduce((acc, col) => ({ ...acc, [col]: rec?.[col] || '' }), {})
      });
    }
    setSelected(rec);
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal || mode === 'view') return;
    if (!formData?.property_id) {
      setStaffUsers([]);
      return;
    }
    fetchStaffForHotel(formData.property_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, mode, formData?.property_id]);
  const closeModal = () => { setShowModal(false); setSelected(null); setMode('create'); setError(null); };

  const submit = async (e) => { e.preventDefault(); setSubmitting(true); setError(null); try { if (mode === 'create') await api.post('/api/hse/audits', formData); else await api.patch(`/api/hse/audits/${selected?.id}`, formData); await refresh(); closeModal(); } catch (err) { setError(err?.response?.data?.message || err?.message || 'Failed'); } finally { setSubmitting(false); } };

  const doDelete = async (id) => { if (!confirm('Delete record?')) return; try { await api.delete(`/api/hse/audits/${id}`); await refresh(); } catch (err) { alert('Delete failed'); } };

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let result = records.filter(r => {
      const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.reference?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q);
      const matchPriority = filterPriority === 'All' || r.priority === filterPriority;
      const matchStatus = filterStatus === 'All' || r.status === filterStatus;
      const matchNewPriority = !priorityFilter || r.priority === priorityFilter;
      const matchNewStatus = !statusFilter || r.status === statusFilter;
      const matchProperty = !propertyFilter || String(r.property_id) === String(propertyFilter) || String(r.hotel_id) === String(propertyFilter);
      return matchSearch && matchPriority && matchStatus && matchNewPriority && matchNewStatus && matchProperty;
    });

    // Sorting
    if (sortBy === "date") {
      result.sort((a, b) => new Date(b.scheduled_date || b.created_at || 0) - new Date(a.scheduled_date || a.created_at || 0));
    } else if (sortBy === "priority") {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      result.sort((a, b) => (priorityOrder[String(a.priority || '').toLowerCase()] ?? 4) - (priorityOrder[String(b.priority || '').toLowerCase()] ?? 4));
    } else if (sortBy === "status") {
      result.sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')));
    } else if (sortBy === "title") {
      result.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }

    return result;
  }, [records, query, filterPriority, filterStatus, priorityFilter, statusFilter, propertyFilter, sortBy]);

  const BASE_EXPORT_COLUMNS = useMemo(
    () => [
      { header: 'Reference', key: 'reference' },
      { header: 'Title', key: 'title' },
      { header: 'Category', key: 'category' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Scheduled Date', key: 'scheduledDate' },
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

  const normalizeAuditExportRow = (item) => {
    const base = {
      reference: item.reference || '-',
      title: item.title || '-',
      category: item.category || '-',
      priority: item.priority || '-',
      status: item.status || '-',
      scheduledDate: item.scheduled_date || '-',
      propertyName: item.property_name || item.hotel_name || '-',
    };

    for (const col of customColumns || []) {
      base[col] = item?.[col] ?? '';
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

      const data = (filtered || []).map(normalizeAuditExportRow);

      if (exportFormat === 'pdf') {
        generatePDF(data, columns, 'HSE Audits Report', 'hse-audits-report');
      } else if (exportFormat === 'csv') {
        generateCSV(data, columns, 'hse-audits-report');
      }

      closeExport();
    } catch (e) {
      console.error('Error exporting HSE audits:', e);
      alert('Failed to download: ' + (e?.message || e));
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = records.length;
    const overdue = records.filter(r => (r.status || '').toLowerCase() === 'overdue').length;
    const dueThisWeek = 0; // placeholder
    const completed = records.filter(r => (r.status || '').toLowerCase() === 'completed').length;
    return { total, overdue, dueThisWeek, completed };
  }, [records]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">HSE Audits</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>HSE Audits</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
              <button
                onClick={() => openModal('create')}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <span>+</span>
                <span>New Audit</span>
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
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Audits</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Overdue</div>
              <div className="text-2xl font-bold text-gray-900">{stats.overdue}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Due This Week</div>
              <div className="text-2xl font-bold text-gray-900">{stats.dueThisWeek}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - HSE Audits Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Audits</h2>
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
                    placeholder="Search..."
                    className="bg-white border-2 border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-72 shadow-sm hover:shadow-md transition-shadow"
                  />
                </div>
                {/* View Dropdown */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
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
                              <ClipboardCheck className="w-4 h-4" />
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
                    onClick={() => openModal('create')}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <span>+</span>
                    <span>New Audit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">All Priorities</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">All Properties</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">Sort By</option>
                  <option value="date">Date (Newest)</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="title">Title</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {(priorityFilter || statusFilter || propertyFilter || sortBy) && (
                <button
                  onClick={() => {
                    setPriorityFilter("");
                    setStatusFilter("");
                    setPropertyFilter("");
                    setSortBy("");
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Old Filter Row - Keep for backward compatibility */}
            <div className="hidden">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="All">All Priority</option>
                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="All">All Status</option>
                <option>Open</option>
                <option>Pending</option>
                <option>Completed</option>
                <option>Overdue</option>
              </select>
              <select className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option>All Properties</option>
                {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
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
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">CATEGORY</th>
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
                    {/* Custom columns */}
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
                      <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : filtered.length > 0 ? filtered.map((r, idx) => {
                    const priorityStyle = getPriorityColor(r.priority || "Medium");
                    const statusStyle = getStatusColor(r.status || "Open");

                    return (
                      <tr key={idx} className="hover:bg-teal-50/30 transition-all border-b border-gray-100 last:border-0">
                        {visibleColumns.checkbox && (
                          <td className="py-4 px-4">
                            <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
                              {r.category || "General"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.reference && (
                          <td className="py-4 px-4">
                            <span className="text-slate-900 font-semibold text-sm whitespace-nowrap">{r.reference || `AUD-${r.id || idx}`}</span>
                          </td>
                        )}
                        {visibleColumns.description && (
                          <td className="py-4 px-4">
                            <div>
                              <div
                                className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors flex items-center gap-2 whitespace-nowrap`}
                                onClick={hasUpdate ? () => openModal('edit', r) : undefined}
                              >
                                <Home className="w-4 h-4 text-gray-400" />
                                <span>{r.property_name || 'Unknown Property'}</span>
                              </div>
                              <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">
                                {r.title || "Audit Title"}
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.priority && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span>
                              <span className={`text-sm font-semibold ${priorityStyle.text}`}>{r.priority || "Medium"}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                              <span className={`text-sm font-semibold ${statusStyle.text}`}>{r.status || "Open"}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.assigned && (
                          <td className="py-4 px-4">
                            {!r.assigned_to ? (
                              <span className="text-gray-400 text-sm">Unassigned</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full ${getAvatarColor(r.assigned_to)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                  {getInitials(r.assigned_to)}
                                </div>
                                <span className="text-gray-900 text-sm font-medium">{r.assigned_to}</span>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.date && (
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-gray-900 font-medium text-sm">{formatDate(r.scheduled_date)}</span>
                          </td>
                        )}
                        {/* Custom columns */}
                        {customColumns.filter(col => visibleColumns[col]).map(col => (
                          <td key={col} className="py-4 px-4">
                            <span className="text-gray-900 font-medium text-sm">{r[col] || '-'}</span>
                          </td>
                        ))}
                        {visibleColumns.actions && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openModal('view', r)}
                                className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {hasUpdate && (
                                <button
                                  onClick={() => openModal('edit', r)}
                                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {hasDelete && (
                                <button
                                  onClick={() => doDelete(r.id)}
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
                      <td colSpan="9" className="py-8 text-center text-gray-500">No audits found.</td>
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
                  const statusItems = filtered.filter((audit) => {
                    return (audit.status || 'Open').toLowerCase() === status.toLowerCase();
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
                              <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No audits</p>
                            </div>
                          ) : (
                            statusItems.map((audit) => {
                              const priorityColor = getPriorityColor(audit.priority || "Medium");

                              return (
                                <div
                                  key={audit.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => { setSelected(audit); setMode('view'); setShowModal(true); }}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{audit.reference || `AUD-${audit.id}`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {audit.priority || "Medium"}
                                      </span>
                                    </div>
                                  </div>

                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {audit.title}
                                  </h4>

                                  {audit.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {audit.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 mb-3">
                                    {audit.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {audit.category}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    <div className="flex items-center gap-2">
                                      {audit.assigned_to && audit.assigned_to !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(audit.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(audit.assigned_to)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {audit.assigned_to}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>

                                    <span className="text-xs text-gray-500">
                                      {formatDate(audit.scheduled_date)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelected(audit); setMode('view'); setShowModal(true);
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
                                          setSelected(audit); setMode('edit'); setFormData({ ...audit }); setShowModal(true);
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
                                          doDelete(audit.id);
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col relative">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {mode === 'create' ? "New HSE Audit" : mode === 'edit' ? "Edit Audit" : "View Audit"}
                </h3>
                {mode === 'view' && (
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${(formData.status || '').toLowerCase() === 'open' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                    (formData.status || '').toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-green-50 text-green-600 border-green-100'
                    }`}>
                    {formData.status}
                  </span>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Content */}
            {mode === 'view' ? (
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
                  <DetailField label="TITLE" value={formData.title} />
                  <DetailField label="PROPERTY" value={formData.property_name} />

                  <DetailField label="CATEGORY" value={formData.category} />
                  <DetailField label="PRIORITY" value={formData.priority} />

                  <DetailField label="REPORTED BY" value={formData.reported_by} />
                  <DetailField label="ASSIGNED TO" value={formData.assigned_to} />

                  <DetailField label="SCHEDULED DATE" value={formatDate(formData.scheduled_date)} />
                  <DetailField label="STATUS" value={formData.status} />

                  {/* Custom columns in view mode */}
                  {customColumns.map(col => (
                    <DetailField
                      key={col}
                      label={col.replace(/_/g, ' ').toUpperCase()}
                      value={formData[col]}
                    />
                  ))}
                </div>

                <div className="mb-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">DESCRIPTION</div>
                  <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[80px]">
                    {formData.description || "No description provided."}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    onClick={closeModal}
                    className="px-5 py-2 border border-slate-200 text-slate-700 font-medium rounded hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Edit/Create Form Content */
              <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Row 1: Title & Description */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                      <input
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Brief description of task"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                      <textarea
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        placeholder="Detailed description of the audit..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 resize-y"
                      />
                    </div>

                    {/* Row 2: Property & Category */}
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Property <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={formData.property_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          const h = hotels.find(h => h.id == id);
                          setFormData({ ...formData, property_id: id, property_name: h?.name || '', reported_by: currentUser?.name || '', assigned_to: '' });
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                      >
                        <option value="">Select property</option>
                        {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={formData.category}
                        onChange={handleCategoryChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                      >
                        <option value="">Select category</option>
                        {[...categoryOptions, ...customCategories].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {!!formData.category && ![...categoryOptions, ...customCategories].some((c) => String(c) === String(formData.category)) && (
                          <option value={formData.category}>{formData.category}</option>
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
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

                    {/* Row 3: Priority & Reported By */}
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Priority <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                      >
                        {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Reported By</label>
                      <input
                        type="text"
                        value={formData.reported_by}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-gray-100 cursor-not-allowed"
                      />
                    </div>

                    {/* Row 4: Assigned To & Scheduled Date */}
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                      <select
                        value={formData.assigned_to || ''}
                        onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                        disabled={!formData.property_id || staffLoading}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {!formData.property_id
                            ? "Select property first"
                            : staffLoading
                              ? "Loading staff..."
                              : "Select staff"}
                        </option>
                        {!!formData.assigned_to && !staffUsers.some((u) => String(u.name) === String(formData.assigned_to)) && (
                          <option value={formData.assigned_to}>{formData.assigned_to}</option>
                        )}
                        {staffUsers.map((u) => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
                      <input
                        type="date"
                        value={formatDateISO(formData.scheduled_date)}
                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                      />
                    </div>

                    {/* Custom columns from Forms Builder */}
                    {customColumns.map(col => {
                      const meta = customColumnMetadata[col] || {};
                      const inputType = meta.input_type || 'text';
                      const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                      return (
                        <div key={col} className="col-span-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </label>
                          {inputType === 'checkbox' ? (
                            <div className="flex items-center h-10">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                                checked={!!formData[col]}
                                onChange={(e) => setFormData({ ...formData, [col]: e.target.checked })}
                              />
                              <span className="ml-2 text-sm text-gray-700">Yes</span>
                            </div>
                          ) : inputType === 'dropdown' || inputType === 'select' ? (
                            <select
                              value={formData[col] || ''}
                              onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
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
                              value={formData[col] || ''}
                              onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                            />
                          ) : inputType === 'date' ? (
                            <input
                              type="date"
                              value={formData[col] ? formatDateISO(formData[col]) : ''}
                              onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                            />
                          ) : (
                            <input
                              type={inputType}
                              value={formData[col] || ''}
                              onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                              placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Row 5: Status (Only for edit) */}
                    {mode !== 'create' && (
                      <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                        >
                          <option>Open</option>
                          <option>Overdue</option>
                          <option>Completed</option>
                        </select>
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                  >
                    {submitting ? "Saving..." : (mode === 'create' ? "Create Task" : "Save Changes")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )
      }
    </div >
  );
}