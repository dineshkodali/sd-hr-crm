/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Home, 
  Shield, 
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
  if (low === "completed" || low === "closed") return { dot: "bg-green-500", text: "text-green-700" };
  if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
  if (low === "overdue") return { dot: "bg-red-500", text: "text-red-700" };
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

const categoryOptions = ['Operational', 'Fire Safety', 'Environmental', 'Training', 'Equipment', 'Other'];
const priorities = ['Low','Medium','High','Urgent'];

export default function HSERiskManagement({ user }) {
  // Get current user from props or localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for hse_risk_management module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("hse_risk_management");
  const hasCreate = canCreate("hse_risk_management");
  const hasUpdate = canUpdate("hse_risk_management");
  const hasDelete = canDelete("hse_risk_management");

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('create');

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
  const [viewMode, setViewMode] = useState('table');
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

  // Custom columns from Forms Builder
  const [customColumns, setCustomColumns] = useState([]);
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
  const ALL_COLUMNS = availableColumns;

  // Column visibility state - load from localStorage or default to all visible
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('hseRiskManagementVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default columns to ensure all columns have visibility state
        const defaultCols = availableColumns.reduce((a, c) => ({ ...a, [c]: true }), {});
        return { ...defaultCols, ...parsed };
      }
    } catch (e) {
      console.error('Error loading column visibility:', e);
    }
    return availableColumns.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('hseRiskManagementVisibleColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn('Failed to save visible columns to localStorage:', e);
    }
  }, [visibleColumns]);

  // Fetch available columns from Forms Builder
  const fetchAvailableColumns = async () => {
    try {
      const res = await api.get('/api/forms-builder/tables/hse_risk_management/columns');
      const columns = res?.data?.columns || res?.data || [];
      
      // Default UI columns
      const defaultColumns = ["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"];
      
      // System and known HSE Risk Management columns to exclude
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
                const saved = localStorage.getItem('hseRiskManagementVisibleColumns');
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

        const r2 = await api.get('/api/hse/risk-management?limit=500').catch(() => ({ data: [] }));
        if (mounted) setRecords(Array.isArray(r2?.data) ? r2.data : (r2?.data?.rows ?? r2?.data ?? []));
      } catch (err) {
        console.warn('load HSE risk management failed', err);
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [api]);

  const refresh = async () => {
    try { setLoading(true); const r = await api.get('/api/hse/risk-management?limit=500'); setRecords(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? [])); } catch (err) { console.warn('refresh failed', err); } finally { setLoading(false); }
  };

  const openModal = (m='create', rec=null) => {
    setMode(m);
    if (m === 'create') {
      setFormData({ 
        title:'', description:'', property_id:'', property_name:'', category:'', 
        priority:'Medium', reported_by:'', assigned_to:'', scheduled_date:'', status:'Open',
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
  const closeModal = () => { setShowModal(false); setSelected(null); setMode('create'); setError(null); };

  const submit = async (e) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      // Include custom columns in the payload
      const payload = {
        ...formData,
        ...customColumns.reduce((acc, col) => ({ ...acc, [col]: formData[col] || null }), {})
      };
      if (mode === 'create') await api.post('/api/hse/risk-management', payload);
      else await api.patch(`/api/hse/risk-management/${selected?.id}`, payload);
      await refresh(); closeModal();
    } catch (err) { setError(err?.response?.data?.message || err?.message || 'Failed'); } finally { setSubmitting(false); }
  };

  const doDelete = async (id) => { if (!confirm('Are you sure you want to delete this record?')) return; try { await api.delete(`/api/hse/risk-management/${id}`); await refresh(); } catch (err) { alert('Delete failed'); } };

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
      result.sort((a, b) => (priorityOrder[String(a.priority||'').toLowerCase()] ?? 4) - (priorityOrder[String(b.priority||'').toLowerCase()] ?? 4));
    } else if (sortBy === "status") {
      result.sort((a, b) => String(a.status||'').localeCompare(String(b.status||'')));
    } else if (sortBy === "title") {
      result.sort((a, b) => String(a.title||'').localeCompare(String(b.title||'')));
    }

    return result;
  }, [records, query, filterPriority, filterStatus, priorityFilter, statusFilter, propertyFilter, sortBy]);

  // Handle PDF download
  const handleDownloadPDF = () => {
    const columns = [
      { header: 'Reference', key: 'reference' },
      { header: 'Title', key: 'title' },
      { header: 'Category', key: 'category' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Scheduled Date', key: 'scheduled_date' },
      { header: 'Property', key: 'property' }
    ];

    const data = filtered.map(record => ({
      reference: record.reference || 'N/A',
      title: record.title || 'N/A',
      category: record.category || 'N/A',
      priority: record.priority || 'N/A',
      status: record.status || 'N/A',
      scheduled_date: record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : 'N/A',
      property: record.property_name || record.hotel_name || 'N/A'
    }));

    generatePDF(data, columns, 'HSE Risk Management Records', 'hse-risk-management');
  };

  const handleDownloadCSV = () => {
    const columns = [
      { header: 'Reference', key: 'reference' },
      { header: 'Title', key: 'title' },
      { header: 'Category', key: 'category' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Scheduled Date', key: 'scheduled_date' },
      { header: 'Property', key: 'property' }
    ];

    const data = filtered.map(record => ({
      reference: record.reference || 'N/A',
      title: record.title || 'N/A',
      category: record.category || 'N/A',
      priority: record.priority || 'N/A',
      status: record.status || 'N/A',
      scheduled_date: record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : 'N/A',
      property: record.property_name || record.hotel_name || 'N/A'
    }));

    generateCSV(data, columns, 'hse-risk-management');
  };

  // Calculate stats
  const stats = useMemo(() => {
  const total = records.length;
  const overdue = records.filter(r => (r.status||'').toLowerCase() === 'overdue').length;
  const dueThisWeek = records.filter(r => false).length; // placeholder logic
  const completed = records.filter(r => (r.status||'').toLowerCase() === 'completed').length;
    return { total, overdue, dueThisWeek, completed };
  }, [records]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">HSE Risk Management</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>HSE Risk Management</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown onDownloadPDF={handleDownloadPDF} onDownloadCSV={handleDownloadCSV} />
              <button 
                onClick={() => openModal('create')}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <span>+</span>
                <span>New Risk Assessment</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
              </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              </div>
           </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
              </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Overdue</div>
              <div className="text-2xl font-bold text-gray-900">{stats.overdue}</div>
              </div>
           </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
              </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Due This Week</div>
              <div className="text-2xl font-bold text-gray-900">{stats.dueThisWeek}</div>
              </div>
           </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
              </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
              </div>
           </div>
        </div>

        {/* Main Content Area - HSE Risk Management Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Risk Assessments</h2>
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
                              <Shield className="w-4 h-4" />
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
                          <div className="mt-2 border-t border-gray-200 pt-3">
                            {/* Default Columns Section */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Default Columns</span>
                                <button
                                  onClick={() => {
                                    const defaultCols = ["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"];
                                    setVisibleColumns(prev => {
                                      const updated = { ...prev };
                                      defaultCols.forEach(c => { updated[c] = false; });
                                      return updated;
                                    });
                                  }}
                                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                                >
                                  Hide all
                                </button>
                              </div>
                              <div className="space-y-1">
                                {["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"].filter(col => visibleColumns[col]).map(col => (
                                  <button
                                    key={col}
                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: false })}
                                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                  >
                                    <span className="capitalize">{col}</span>
                                    <Eye className="w-4 h-4 text-teal-600" />
                                  </button>
                                ))}
                              </div>
                              {["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"].some(col => !visibleColumns[col]) && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="space-y-1">
                                    {["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"].filter(col => !visibleColumns[col]).map(col => (
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
                              )}
                            </div>
                            
                            {/* Custom Columns Section */}
                            {customColumns.length > 0 && (
                              <div className="mb-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-purple-600 uppercase tracking-wider">Custom Columns ({customColumns.length})</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setVisibleColumns(prev => {
                                          const updated = { ...prev };
                                          customColumns.forEach(c => { updated[c] = true; });
                                          return updated;
                                        });
                                      }}
                                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                    >
                                      Show all
                                    </button>
                                    <button
                                      onClick={() => {
                                        setVisibleColumns(prev => {
                                          const updated = { ...prev };
                                          customColumns.forEach(c => { updated[c] = false; });
                                          return updated;
                                        });
                                      }}
                                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                    >
                                      Hide all
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {customColumns.filter(col => visibleColumns[col]).map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setVisibleColumns({ ...visibleColumns, [col]: false })}
                                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-purple-700 hover:bg-purple-50 rounded transition-colors"
                                    >
                                      <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                                      <Eye className="w-4 h-4 text-purple-600" />
                                    </button>
                                  ))}
                                </div>
                                {customColumns.some(col => !visibleColumns[col]) && (
                                  <div className="mt-2 pt-2 border-t border-purple-100">
                                    <div className="space-y-1">
                                      {customColumns.filter(col => !visibleColumns[col]).map(col => (
                                        <button
                                          key={col}
                                          onClick={() => setVisibleColumns({ ...visibleColumns, [col]: true })}
                                          className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-purple-400 hover:bg-purple-50 rounded transition-colors"
                                        >
                                          <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                                          <EyeOff className="w-4 h-4 text-purple-400" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
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
                    <span>New Risk Assessment</span>
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
                onChange={(e)=>setFilterPriority(e.target.value)} 
                className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                      <option value="All">All Priority</option>
                      {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
              <select 
                value={filterStatus} 
                onChange={(e)=>setFilterStatus(e.target.value)} 
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
                  {/* Custom columns */}
                  {customColumns.filter(col => visibleColumns[col]).map(col => (
                    <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-purple-600 uppercase tracking-wider">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                  {visibleColumns.actions && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : filtered.length > 0 ? filtered.map((r, idx) => {
                  const priorityStyle = getPriorityColor(r.priority || "Medium");
                  const statusStyle = getStatusColor(r.status || "Open");
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {visibleColumns.checkbox && (
                        <td className="py-4 px-4">
                          <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100">
                            {r.category || "General Risk"}
                          </span>
                        </td>
                      )}
                      {visibleColumns.reference && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-medium">{r.reference || `RISK-${r.id || idx}`}</span>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="py-4 px-4">
                          <div>
                            <div 
                              className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors`}
                              onClick={hasUpdate ? () => openModal('edit', r) : undefined}
                            >
                              {r.title || "Risk Assessment Title"}
                            </div>
                            <div className="text-gray-500 text-xs mt-1">
                              {r.description || "Risk assessment description and information."}
                            </div>
                            {r.property_name && <div className="text-gray-500 text-xs mt-1">Property: {r.property_name}</div>}
                          </div>
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="py-4 px-4">
                           <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                            <span className={`text-sm ${priorityStyle.text}`}>{r.priority || "Medium"}</span>
                              </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                            <span className={`text-sm ${statusStyle.text}`}>{r.status || "Open"}</span>
                           </div>
                        </td>
                      )}
                      {visibleColumns.assigned && (
                        <td className="py-4 px-4">
                          {!r.assigned_to ? (
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${getAvatarColor(r.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                {getInitials(r.assigned_to)}
                              </div>
                              <span className="text-gray-900 text-sm">{r.assigned_to}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 text-sm">{formatDate(r.scheduled_date)}</span>
                        </td>
                      )}
                      {/* Custom columns */}
                      {customColumns.filter(col => visibleColumns[col]).map(col => (
                        <td key={col} className="py-4 px-4">
                          <span className="text-purple-700 text-sm">{r[col] || '-'}</span>
                        </td>
                      ))}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openModal('view', r)}
                              className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasUpdate && (
                              <button
                                onClick={() => openModal('edit', r)}
                                className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {hasDelete && (
                              <button
                                onClick={() => doDelete(r.id)}
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
                    <td colSpan="9" className="py-8 text-center text-gray-500">No risk assessments found.</td>
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
                  const statusItems = filtered.filter((risk) => {
                    return (risk.status || 'Open').toLowerCase() === status.toLowerCase();
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
                              <Shield className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No risks</p>
                            </div>
                          ) : (
                            statusItems.map((risk) => {
                              const priorityColor = getPriorityColor(risk.priority || "Medium");
                              
                              return (
                                <div
                                  key={risk.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => {setSelected(risk); setMode('view'); setShowModal(true);}}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{risk.reference || `RISK-${risk.id}`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {risk.priority || "Medium"}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {risk.title || "Risk Assessment"}
                                  </h4>
                                  
                                  {risk.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {risk.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mb-3">
                                    {risk.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {risk.category}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    <div className="flex items-center gap-2">
                                      {risk.assigned_to && risk.assigned_to !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(risk.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(risk.assigned_to)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {risk.assigned_to}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>
                                    
                                    <span className="text-xs text-gray-500">
                                      {formatDate(risk.scheduled_date)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelected(risk); setMode('view'); setShowModal(true);
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
                                          setSelected(risk); setMode('edit'); setFormData({...risk}); setShowModal(true);
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
                                          doDelete(risk.id);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {mode === 'create' ? "New Risk Assessment" : mode === 'edit' ? "Edit Assessment" : "View Assessment"}
              </h3>
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Content */}
            {mode === 'view' ? (
              <div className="p-6">
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
              <form onSubmit={submit} className="p-4">
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  
                  {/* Row 1: Title & Description */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      value={formData.title} 
                      onChange={(e)=>setFormData({...formData, title: e.target.value})} 
                      placeholder="Brief description of task" 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea 
                      required 
                      value={formData.description} 
                      onChange={(e)=>setFormData({...formData, description: e.target.value})} 
                      rows={3}
                      placeholder="Detailed description of the task..." 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" 
                    />
                  </div>

                  {/* Row 2: Property & Category */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Property <span className="text-red-500">*</span></label>
                    <select 
                      required 
                      value={formData.property_id} 
                      onChange={(e)=>{const id=e.target.value; const h=hotels.find(h=>h.id==id); setFormData({...formData, property_id:id, property_name: h?.name||''})}} 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
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
                      onChange={(e)=>setFormData({...formData, category: e.target.value})} 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Row 3: Priority & Reported By */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority <span className="text-red-500">*</span></label>
                    <select 
                      required 
                      value={formData.priority} 
                      onChange={(e)=>setFormData({...formData, priority: e.target.value})} 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    >
                      {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reported By <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      value={formData.reported_by} 
                      onChange={(e)=>setFormData({...formData, reported_by: e.target.value})} 
                      placeholder="Name of person reporting" 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                    />
                  </div>

                  {/* Row 4: Assigned To & Scheduled Date */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                    <input 
                      value={formData.assigned_to} 
                      onChange={(e)=>setFormData({...formData, assigned_to: e.target.value})} 
                      placeholder="Name of assignee" 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
                    <input 
                      type="date" 
                      value={formatDateISO(formData.scheduled_date)} 
                      onChange={(e)=>setFormData({...formData, scheduled_date: e.target.value})} 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                    />
                  </div>
                  
                  {/* Custom columns from Forms Builder */}
                  {customColumns.map(col => (
                    <div key={col} className="col-span-1">
                      <label className="block text-xs font-medium text-purple-600 mb-1">
                        {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <input 
                        type="text" 
                        value={formData[col] || ''} 
                        onChange={(e) => setFormData({ ...formData, [col]: e.target.value })} 
                        placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                        className="w-full border border-purple-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" 
                      />
                    </div>
                  ))}
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-200">
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
      )}
    </div>
  );
}