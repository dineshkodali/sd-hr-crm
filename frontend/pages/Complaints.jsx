/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { AlertModal, ConfirmModal } from '../components/ModalDialogs';
import { 
  Home, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Search, 
  ChevronDown, 
  Filter, 
  Columns, 
  Download, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff, 
  X, 
  Check, 
  ClipboardList 
} from 'lucide-react';
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || '';
const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 15000 });

// --- Helpers for Formatting ---
function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
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

function getInitials(name) {
  if (!name) return '?';
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

export default function Complaints({ user }) {
  // Get current user from props or localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for complaints module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("complaints");
  const hasCreate = canCreate("complaints");
  const hasUpdate = canUpdate("complaints");
  const hasDelete = canDelete("complaints");

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingComplaint, setViewingComplaint] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  
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
    category: '',
    priority: 'medium',
    property_id: '',
    reported_by: '',
    reported_date: '',
    assigned_to: '',
    scheduled_date: '',
  });
  const [properties, setProperties] = useState([]);

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
      const saved = localStorage.getItem('complaints_visible_columns');
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

  // Fetch available columns from Forms Builder
  const fetchAvailableColumns = async () => {
    try {
      const res = await api.get('/api/forms-builder/tables/complaints/columns');
      const cols = res.data?.columns || [];
      
      // Extract column names (handle both string arrays and object arrays)
      const columnNames = cols.map(col => {
        if (typeof col === 'string') return col;
        if (col.column_name) return col.column_name;
        if (col.name) return col.name;
        return String(col);
      });
      
      setAvailableColumns(columnNames);
      
      // Filter out standard columns to get custom ones
      const standardCols = ['id', 'reference', 'title', 'description', 'category', 'priority',
                           'property_id', 'property_name', 'status', 'reported_by', 'reported_date',
                           'assigned_to', 'scheduled_date', 'notes', 'created_at', 'updated_at'];
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
      localStorage.setItem('complaints_visible_columns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.error('Error saving column visibility:', e);
    }
  }, [visibleColumns]);

  // Fetch complaints
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/complaints?limit=2000');
      const data = res.data?.data || res.data || [];
      
      // Normalize data for table
      const mapped = (Array.isArray(data) ? data : []).map(item => ({
        ...item,
        reference: item.reference || `COM-${item.id}`, // Ensure reference exists
        status: item.status || "open"
      }));
      
      setComplaints(mapped);
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch properties for dropdown
  const fetchProperties = async () => {
    try {
      const res = await api.get('/api/hotels?limit=1000');
      const hotelsList = res.data?.hotels || res.data?.data || [];
      setProperties(Array.isArray(hotelsList) ? hotelsList : []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchProperties();
  }, []);

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

  // Hide sidebar/navbar when modal open
  useEffect(() => {
    const isModalOpen = showForm || showViewModal;
    if (isModalOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showForm, showViewModal]);

  /* --- Handlers --- */
  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      priority: 'medium',
      property_id: '',
      reported_by: '',
      reported_date: '',
      assigned_to: '',
      scheduled_date: '',
    });
    setShowForm(true);
  };

  const handleEditClick = (complaint) => {
    setEditingId(complaint.id);
    const baseFormData = {
      title: complaint.title || '',
      description: complaint.description || '',
      category: complaint.category || '',
      priority: complaint.priority || 'medium',
      property_id: complaint.property_id || '',
      reported_by: complaint.reported_by || '',
      reported_date: complaint.reported_date ? formatDateISO(complaint.reported_date) : '',
      assigned_to: complaint.assigned_to || '',
      scheduled_date: complaint.scheduled_date ? formatDateISO(complaint.scheduled_date) : '',
    };
    // Add custom column values
    const customFieldData = {};
    customColumns.forEach(col => {
      customFieldData[col] = complaint[col] ?? '';
    });
    setFormData({ ...baseFormData, ...customFieldData });
    setShowForm(true);
  };

  const handleViewClick = (complaint) => {
    // Find property name for display
    const propName = properties.find(p => String(p.id) === String(complaint.property_id))?.name;
    setViewingComplaint({ ...complaint, property_name: propName });
    setShowViewModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create payload with base fields and custom columns
      const payload = { ...formData };
      // Include custom column values
      customColumns.forEach(col => {
        if (formData[col] !== undefined) {
          payload[col] = formData[col];
        }
      });
      
      if (editingId) {
        await api.put(`/api/complaints/${editingId}`, payload);
      } else {
        await api.post('/api/complaints', payload);
      }
      setShowForm(false);
      fetchComplaints();
    } catch (err) {
      console.error('Error submitting form:', err);
      showAlert('Error', 'Failed to submit complaint. Please try again.', 'error');
    }
  };

  const handleDelete = async (id) => {
    showConfirm(
      'Delete Complaint',
      'Are you sure you want to delete this complaint? This action cannot be undone.',
      () => handleDeleteConfirmed(id)
    );
  };
  
  const handleDeleteConfirmed = async (id) => {
    try {
      await api.delete(`/api/complaints/${id}`);
      fetchComplaints();
    } catch (err) {
      console.error('Error deleting complaint:', err);
      showAlert('Error', 'Failed to delete complaint. Please try again.', 'error');
    }
  };

  // Logic
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = complaints || [];
    
    // Apply search filter
    if (q) {
      list = list.filter((r) => 
        (r.title || "").toLowerCase().includes(q) || 
        (r.reference || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
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
        String(r.property_id || "") === String(propertyFilter)
      );
    }
    
    // Apply sorting
    if (sortBy) {
      list = [...list].sort((a, b) => {
        if (sortBy === 'date') {
          const dateA = new Date(a.reported_date || 0);
          const dateB = new Date(b.reported_date || 0);
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
        if (sortBy === 'category') {
          const catA = (a.category || '').toLowerCase();
          const catB = (b.category || '').toLowerCase();
          return catA.localeCompare(catB);
        }
        return 0;
      });
    }
    
    return list;
  }, [complaints, query, priorityFilter, statusFilter, propertyFilter, sortBy]);

  const handleDownloadPDF = () => {
    const columns = [
      { header: 'Reference', key: 'reference' },
      { header: 'Title', key: 'title' },
      { header: 'Type', key: 'complaintType' },
      { header: 'Property', key: 'propertyName' },
      { header: 'Status', key: 'status' },
      { header: 'Date Filed', key: 'dateFiled' },
      { header: 'Complainant', key: 'complainant' }
    ];
    
    const data = filtered.map(complaint => ({
      reference: complaint.reference || '-',
      title: complaint.title || '-',
      complaintType: complaint.complaintType || '-',
      propertyName: complaint.propertyName || '-',
      status: complaint.status || '-',
      dateFiled: complaint.dateFiled || '-',
      complainant: complaint.complainant || '-'
    }));
    
    generatePDF(data, columns, 'Complaints Report', 'complaints-report');
  };

  // CSV Download Handler
  const handleDownloadCSV = () => {
    const columns = [
      { header: 'Reference', key: 'reference' },
      { header: 'Title', key: 'title' },
      { header: 'Type', key: 'complaintType' },
      { header: 'Property', key: 'propertyName' },
      { header: 'Status', key: 'status' },
      { header: 'Date Filed', key: 'dateFiled' },
      { header: 'Complainant', key: 'complainant' }
    ];
    
    const data = filtered.map(complaint => ({
      reference: complaint.reference || '-',
      title: complaint.title || '-',
      complaintType: complaint.complaintType || '-',
      propertyName: complaint.propertyName || '-',
      status: complaint.status || '-',
      dateFiled: complaint.dateFiled || '-',
      complainant: complaint.complainant || '-'
    }));
    
    generateCSV(data, columns, 'complaints-report');
  };

  // Stats
  const stats = useMemo(() => {
    const total = complaints.length;
    const high = complaints.filter((c) => (c.priority || '').toLowerCase() === 'high' || (c.priority || '').toLowerCase() === 'urgent').length;
    const open = complaints.filter((c) => (c.status || '').toLowerCase() === 'open' || (c.status || '').toLowerCase() === 'pending').length;
    const resolved = complaints.filter((c) => (c.status || '').toLowerCase() === 'completed' || (c.status || '').toLowerCase() === 'resolved').length;
    return { total, high, open, resolved };
  }, [complaints]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Incident Complaints</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Incidents</span>
              <span>&gt;</span>
              <span>Complaints</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown 
                onDownloadPDF={handleDownloadPDF}
                onDownloadCSV={handleDownloadCSV}
              />
              <button
                onClick={handleAddClick}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Create Complaint</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Complaints</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">High Priority</div>
              <div className="text-2xl font-bold text-gray-900">{stats.high}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-yellow-100 text-yellow-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Open Complaints</div>
              <div className="text-2xl font-bold text-gray-900">{stats.open}</div>
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

        {/* Main Content Area - Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Complaints</h2>
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
                    placeholder="Search complaints..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                {/* View Dropdown */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border-2 border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
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
                              <ClipboardList className="w-4 h-4" />
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
                          <div className="mt-2 border-t border-gray-200 pt-3 max-h-[400px] overflow-y-auto">
                            {/* Default Columns Section */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Default Columns</span>
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
                                {DEFAULT_COLUMNS.map(col => (
                                  <button
                                    key={col}
                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })}
                                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-gray-50 rounded transition-colors"
                                  >
                                    <span className="capitalize text-gray-700">{col}</span>
                                    {visibleColumns[col] ? (
                                      <Eye className="w-4 h-4 text-teal-600" />
                                    ) : (
                                      <EyeOff className="w-4 h-4 text-gray-400" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Custom Columns Section */}
                            {customColumns.length > 0 && (
                              <div className="mb-2 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                                    Custom Columns ({customColumns.length})
                                  </span>
                                  {customColumns.length > 0 && (
                                    <span className="text-xs text-gray-500 italic">Auto-refreshing...</span>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {customColumns.map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })}
                                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-purple-50 rounded transition-colors"
                                    >
                                      <span className="text-gray-700 capitalize">
                                        {col.replace(/_/g, ' ')}
                                      </span>
                                      {visibleColumns[col] ? (
                                        <Eye className="w-4 h-4 text-purple-600" />
                                      ) : (
                                        <EyeOff className="w-4 h-4 text-gray-400" />
                                      )}
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
                    onClick={handleAddClick} 
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Create Complaint</span>
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
                  className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-8 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none shadow-sm hover:shadow-md"
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
                  className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-8 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none shadow-sm hover:shadow-md"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select 
                  value={propertyFilter} 
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-8 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none shadow-sm hover:shadow-md"
                >
                  <option value="">All Properties</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              <div className="relative">
                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-8 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none shadow-sm hover:shadow-md"
                >
                  <option value="">Sort By</option>
                  <option value="date">Date (Newest)</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="category">Category</option>
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
                  const priorityStyle = getPriorityColor(row.priority || 'medium');
                  const statusStyle = getStatusColor(row.status || 'open');
                  
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
                            Complaint
                          </span>
                        </td>
                      )}
                      {visibleColumns.reference && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-medium">{row.reference}</span>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="py-4 px-4">
                          <div>
                            <div 
                              className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors`}
                              onClick={hasUpdate ? () => handleEditClick(row) : undefined}
                            >
                              {row.title}
                            </div>
                            <div className="text-gray-500 text-xs mt-1 truncate max-w-[200px]">
                              {row.description}
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                            <span className={`text-sm ${priorityStyle.text}`}>{row.priority || "Medium"}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                            <span className={`text-sm ${statusStyle.text}`}>{row.status || "Pending"}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.assigned && (
                        <td className="py-4 px-4">
                          {!row.assigned_to || row.assigned_to === 'Unassigned' ? (
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                {getInitials(row.assigned_to)}
                              </div>
                              <span className="text-gray-900 text-sm">{row.assigned_to}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 text-sm">{formatDate(row.scheduled_date)}</span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewClick(row)}
                              className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasUpdate && (
                              <button
                                onClick={() => handleEditClick(row)}
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
                    <td colSpan="9" className="py-8 text-center text-gray-500">No complaints found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['open', 'in progress', 'resolved'].map((status) => {
                  const statusItems = filtered.filter((complaint) => {
                    return (complaint.status || 'open').toLowerCase() === status.toLowerCase();
                  });
                  
                  const getStatusStyle = (status) => {
                    if (status === 'open') {
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
                    if (status === 'resolved') {
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
                        {/* Column Header */}
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
                        
                        {/* Cards Container */}
                        <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                          {statusItems.length === 0 ? (
                            <div className="text-center py-8 px-4">
                              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No complaints</p>
                            </div>
                          ) : (
                            statusItems.map((complaint) => {
                              const priorityColor = getPriorityColor(complaint.priority || "Medium");
                              
                              return (
                                <div
                                  key={complaint.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => handleViewClick(complaint)}
                                >
                                  {/* Reference and Priority */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{complaint.reference}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {complaint.priority || "Medium"}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Title */}
                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {complaint.title}
                                  </h4>
                                  
                                  {/* Description */}
                                  {complaint.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {complaint.description}
                                    </p>
                                  )}
                                  
                                  {/* Category Badge */}
                                  {complaint.category && (
                                    <div className="mb-3">
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs font-medium">
                                        {complaint.category}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Footer: Assigned To and Date */}
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    {/* Assigned To */}
                                    <div className="flex items-center gap-2">
                                      {complaint.assigned_to && complaint.assigned_to !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(complaint.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(complaint.assigned_to)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {complaint.assigned_to}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>
                                    
                                    {/* Date */}
                                    <span className="text-xs text-gray-500">
                                      {formatDate(complaint.scheduled_date)}
                                    </span>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewClick(complaint);
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
                                          handleEditClick(complaint);
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
                                          handleDelete(complaint.id);
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

      {/* --- FORM MODAL --- */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? "Edit Complaint" : "Create Complaint"}
              </h3>
              <button 
                onClick={() => setShowForm(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                
                {/* Row 1: Title & Description */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                  <input 
                    required 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                  <textarea 
                    required 
                    rows={3}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" 
                  />
                </div>

                {/* Row 2: Property & Category */}
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Property <span className="text-red-500">*</span></label>
                  <select 
                    required 
                    value={formData.property_id} 
                    onChange={e => setFormData({...formData, property_id: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                  >
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
                  <select 
                    required 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                  >
                    <option value="">Select Category</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Security">Security</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Noise">Noise</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Row 3: Priority & Status */}
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reported By</label>
                  <input 
                    value={formData.reported_by} 
                    onChange={e => setFormData({...formData, reported_by: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                  />
                </div>

                {/* Row 4: Dates & Assignment */}
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reported Date</label>
                  <input 
                    type="date" 
                    value={formData.reported_date} 
                    onChange={e => setFormData({...formData, reported_date: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                  <input 
                    value={formData.assigned_to} 
                    onChange={e => setFormData({...formData, assigned_to: e.target.value})} 
                    placeholder="Staff Name"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
                  <input 
                    type="date" 
                    value={formData.scheduled_date} 
                    onChange={e => setFormData({...formData, scheduled_date: e.target.value})} 
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                  />
                </div>

                {/* Custom Columns from Forms Builder */}
                {customColumns.map(col => (
                  <div key={col} className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <input
                      type="text"
                      value={formData[col] || ''}
                      onChange={e => setFormData({...formData, [col]: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                    />
                  </div>
                ))}
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                >
                  {editingId ? "Update Complaint" : "Create Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW MODAL --- */}
      {showViewModal && viewingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg relative">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Complaint Details</h3>
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
                <div className="text-gray-500 font-mono text-sm mb-1">{viewingComplaint.reference}</div>
                <div className="text-xl font-bold text-gray-800">{viewingComplaint.title}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">DESCRIPTION</div>
                <p className="text-gray-600 text-sm leading-relaxed">{viewingComplaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">PROPERTY</div>
                  <div className="font-semibold text-gray-700 text-sm">{viewingComplaint.property_name || `ID: ${viewingComplaint.property_id}`}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CATEGORY</div>
                  <div className="font-semibold text-gray-700 text-sm">{viewingComplaint.category}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">PRIORITY</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getPriorityColor(viewingComplaint.priority).dot}`}></span>
                    <span className="font-semibold text-gray-700 text-sm capitalize">{viewingComplaint.priority}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">STATUS</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(viewingComplaint.status).dot}`}></span>
                    <span className="font-semibold text-gray-700 text-sm capitalize">{viewingComplaint.status}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">REPORTED BY</div>
                  <div className="font-semibold text-gray-700 text-sm">{viewingComplaint.reported_by}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ASSIGNED TO</div>
                  <div className="font-semibold text-gray-700 text-sm">{viewingComplaint.assigned_to || 'Unassigned'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">REPORTED DATE</div>
                  <div className="font-semibold text-gray-700 text-sm">{formatDate(viewingComplaint.reported_date)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">SCHEDULED DATE</div>
                  <div className="font-semibold text-gray-700 text-sm">{formatDate(viewingComplaint.scheduled_date)}</div>
                </div>
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
