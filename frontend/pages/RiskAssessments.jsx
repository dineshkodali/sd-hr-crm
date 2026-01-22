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
  if (low === "completed" || low === "closed" || low === "resolved") return { dot: "bg-green-500", text: "text-green-700" };
  if (low === "pending" || low === "open" || low === "new") return { dot: "bg-orange-500", text: "text-orange-700" };
  if (low === "under review" || low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
  if (low === "escalated") return { dot: "bg-red-500", text: "text-red-700" };
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

const priorityColors = {
  'Urgent': '#EF4444',
  'High': '#F97316',
  'Medium': '#EABF00',
  'Low': '#10B981',
};

const categoryOptions = ['Safety Concern', 'Health Risk', 'Behavioral Risk', 'Environmental Risk', 'Financial Risk', 'Other'];

export default function RiskAssessments({ user }) {
  // Get current user from props or localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for safeguarding_risk_assessments module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasCreate = canCreate("safeguarding_risk_assessments");
  const hasUpdate = canUpdate("safeguarding_risk_assessments");
  const hasDelete = canDelete("safeguarding_risk_assessments");

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [modalMode, setModalMode] = useState('create');

  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
   
  // Filter States
  const [query, setQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Enhanced Filter and Sort State
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
    risk_level: 'Medium',
    assigned_to: '',
    reported_by: '',
    assessment_date: '',
    status: 'New',
    findings: '',
    recommendations: '',
  });

  // Default visible columns for Risk Assessments (must match other pages)
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

  // Custom columns from Forms Builder
  const [customColumns, setCustomColumns] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);

  // Define all available columns
  const ALL_COLUMNS = availableColumns;

  // Column visibility state - default columns visible, custom columns from localStorage or hidden
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('riskAssessmentsVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load column visibility from localStorage', e);
    }
    return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  // Save column visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('riskAssessmentsVisibleColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn('Failed to save column visibility', e);
    }
  }, [visibleColumns]);

  const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

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

  // Fetch available columns from Forms Builder with polling
  useEffect(() => {
    let mounted = true;
    
    const fetchAvailableColumns = async () => {
      try {
        const res = await api.get('/api/forms-builder/tables/risk_assessments/columns');
        if (!mounted) return;
        
        const cols = res?.data?.columns || res?.data || [];
        const columnNames = cols.map(col => {
          if (typeof col === 'string') return col;
          if (col.column_name) return col.column_name;
          if (col.name) return col.name;
          return String(col);
        });
        
        setAvailableColumns(columnNames);
        
        const standardCols = ['id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by', 'title', 'description', 'property_id', 'property_name', 'category', 'risk_level', 'assigned_to', 'reported_by', 'assessment_date', 'status', 'findings', 'recommendations'];
        const customCols = columnNames.filter(col => !standardCols.includes(col));
        
        // Only update if columns have changed
        if (JSON.stringify(customCols) !== JSON.stringify(customColumns)) {
          setCustomColumns(customCols);
          
          // Update visible columns - default new columns to visible
          setVisibleColumns(prev => {
            const updated = { ...prev };
            customCols.forEach(col => {
              if (prev[col] === undefined) {
                 updated[col] = true; 
              }
            });
            return updated;
          });
        }
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
  }, [api]);

  // Hide sidebar and navbar when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
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

    async function loadAssessments() {
      try {
        setAssessmentsLoading(true);
        const r = await api.get('/api/safeguarding/risk-assessments?limit=500').catch(() => ({ data: [] }));
        if (mounted) setAssessments(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? []));
      } catch (err) {
        console.warn('Failed to load assessments', err);
      } finally { if (mounted) setAssessmentsLoading(false); }
    }
    loadAssessments();
    return () => { mounted = false; };
  }, [api]);

  const refreshAssessments = async () => {
    try {
      setAssessmentsLoading(true);
      const r = await api.get('/api/safeguarding/risk-assessments?limit=500').catch(() => ({ data: [] }));
      setAssessments(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? []));
    } catch (err) {
      console.warn('refreshAssessments failed', err);
    } finally { setAssessmentsLoading(false); }
  };

  const handlePropertyChange = (propId) => {
    const prop = hotels.find(h => h.id == propId);
    setFormData(prev => ({
      ...prev,
      property_id: propId,
      property_name: prop?.name || '',
      reported_by: '',
      assigned_to: '',
    }));
  };

  useEffect(() => {
    if (!showModal || modalMode === 'view') return;
    if (!formData?.property_id) {
      setStaffUsers([]);
      return;
    }
    fetchStaffForHotel(formData.property_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, modalMode, formData?.property_id]);

  const handleOpenModal = (mode = 'create', assessment = null) => {
    setModalMode(mode);
    if (mode === 'create') {
      const baseData = {
        title: '',
        description: '',
        property_id: '',
        property_name: '',
        category: '',
        risk_level: 'Medium',
        assigned_to: '',
        reported_by: '',
        assessment_date: '',
        status: 'New',
        findings: '',
        recommendations: '',
      };
      // Initialize custom columns with empty values
      const customData = {};
      customColumns.forEach(col => {
        customData[col] = '';
      });
      setFormData({ ...baseData, ...customData });
    } else {
      // Fix: Ensure no null values are passed to inputs
      const safeData = { ...assessment };
      Object.keys(safeData).forEach(key => {
        if (safeData[key] === null) safeData[key] = '';
      });

      setFormData({
        ...safeData,
        property_id: assessment?.property_id || '',
        property_name: assessment?.property_name || '',
      });
    }
    setSelectedAssessment(assessment);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalMode('create');
    setSelectedAssessment(null);
    setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (modalMode === 'create') {
        await api.post('/api/safeguarding/risk-assessments', formData);
      } else {
        await api.patch(`/api/safeguarding/risk-assessments/${selectedAssessment?.id}`, formData);
      }
      await refreshAssessments();
      handleCloseModal();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this assessment?')) return;
    try {
      await api.delete(`/api/safeguarding/risk-assessments/${id}`);
      await refreshAssessments();
    } catch (err) {
      alert('Delete failed: ' + (err?.response?.data?.message || err?.message));
    }
  };

  // Compute stats
  const stats = {
    'New': assessments.filter(a => a.status === 'New').length,
    'Under Review': assessments.filter(a => a.status === 'Under Review').length,
    'Escalated': assessments.filter(a => a.status === 'Escalated').length,
    'Completed': assessments.filter(a => a.status === 'Completed').length,
  };

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let filtered = assessments.filter(a => {
      const matchSearch = !q || 
        a.title?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.reference?.toLowerCase().includes(q);
      const matchPriority = !filterPriority || a.risk_level === filterPriority;
      const matchStatus = !filterStatus || a.status === filterStatus;
      const matchProperty = !propertyFilter || String(a.property_id) === String(propertyFilter) || String(a.hotel_id) === String(propertyFilter);
      return matchSearch && matchPriority && matchStatus && matchProperty;
    });

    // Sorting logic
    if (sortBy === "date") {
      filtered.sort((a, b) => new Date(b.assessment_date || 0) - new Date(a.assessment_date || 0));
    } else if (sortBy === "priority") {
      const order = { "Critical": 0, "High": 1, "Medium": 2, "Low": 3 };
      filtered.sort((a, b) => (order[a.risk_level] || 4) - (order[b.risk_level] || 4));
    } else if (sortBy === "status") {
      filtered.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
    } else if (sortBy === "title") {
      filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return filtered;
  }, [assessments, query, filterPriority, filterStatus, propertyFilter, sortBy]);

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
      { header: 'Scheduled Date', key: 'scheduled_date' },
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

  // Normalize assessment for export
  const normalizeAssessmentExportRow = (assessment) => {
    const base = {
      reference: assessment.reference || 'N/A',
      title: assessment.title || 'N/A',
      priority: assessment.priority || 'N/A',
      status: assessment.status || 'N/A',
      scheduled_date: assessment.scheduled_date ? new Date(assessment.scheduled_date).toLocaleDateString() : 'N/A',
      property: assessment.property_name || assessment.hotel_name || 'N/A'
    };

    for (const col of customColumns || []) {
      base[col] = assessment?.[col] ?? '';
    }

    return base;
  };

  // Export modal handlers
  const openExport = (format) => {
    setExportFormat(format);
    setShowExportModal(true);
  };

  const closeExport = () => {
    setShowExportModal(false);
    setExportFormat(null);
  };

  const runExport = () => {
    const columnsToExport = exportColumns.filter((c) => selectedExportKeys.includes(c.key));
    const data = filteredAssessments.map(normalizeAssessmentExportRow).map((row) => {
      const filteredRow = {};
      columnsToExport.forEach((col) => {
        filteredRow[col.key] = row[col.key];
      });
      return filteredRow;
    });

    if (exportFormat === 'pdf') {
      generatePDF(data, columnsToExport, 'Risk Assessments', 'risk-assessments');
    } else if (exportFormat === 'csv') {
      generateCSV(data, columnsToExport, 'risk-assessments');
    }

    closeExport();
  };

  // Calculate stats
  const statsData = useMemo(() => ({
    total: assessments.length,
    new: stats['New'],
    underReview: stats['Under Review'],
    escalated: stats['Escalated'],
    completed: stats['Completed'],
  }), [assessments, stats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Risk Assessments</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>Risk Assessments</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
              <button
                onClick={() => handleOpenModal('create')}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <span>+</span>
                <span>New Assessment</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">New</div>
              <div className="text-2xl font-bold text-gray-900">{statsData.new}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Under Review</div>
              <div className="text-2xl font-bold text-gray-900">{statsData.underReview}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Escalated</div>
              <div className="text-2xl font-bold text-gray-900">{statsData.escalated}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-gray-900">{statsData.completed}</div>
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

        {/* Main Content Area - Risk Assessments Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Risk Assessments</h2>
                <p className="text-sm text-gray-500">{statsData.total} total records</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search assessments..."
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
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors border ${
                                      visibleColumns[col] 
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
                                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors border ${
                                        visibleColumns[col] 
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
                    onClick={() => handleOpenModal('create')}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <span>+</span>
                    <span>New Assessment</span>
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
                  onChange={(e)=>setFilterPriority(e.target.value)} 
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Priority</option>
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={filterStatus}
                  onChange={(e)=>setFilterStatus(e.target.value)} 
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Status</option>
                  <option>New</option>
                  <option>Under Review</option>
                  <option>Escalated</option>
                  <option>Completed</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={propertyFilter}
                  onChange={(e)=>setPropertyFilter(e.target.value)}
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
                  onChange={(e)=>setSortBy(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Sort By</option>
                  <option value="date">Date (Newest)</option>
                  <option value="priority">Risk Level</option>
                  <option value="status">Status</option>
                  <option value="title">Title</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              {(filterPriority || filterStatus || propertyFilter || sortBy) && (
                <button
                  onClick={() => {
                    setFilterPriority('');
                    setFilterStatus('');
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">CATEGORY</th>
                  )}
                  {visibleColumns.reference && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">REFERENCE</th>
                  )}
                  {visibleColumns.description && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DESCRIPTION</th>
                  )}
                  {visibleColumns.priority && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RISK LEVEL</th>
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
                  {/* Custom column headers - UI Matched to other columns */}
                  {customColumns.map(col => visibleColumns[col] && (
                    <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                  {visibleColumns.actions && (
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assessmentsLoading ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : filteredAssessments.length > 0 ? filteredAssessments.map((assess, idx) => {
                  const priorityStyle = getPriorityColor(assess.risk_level || "Medium");
                  const statusStyle = getStatusColor(assess.status || "New");
                  
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
                            {assess.category || "Risk Assessment"}
                          </span>
                        </td>
                      )}
                      {visibleColumns.reference && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-medium">{assess.reference || `RAST-${assess.id || idx}`}</span>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="py-4 px-4">
                          <div>
                            <div 
                              className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors`}
                              onClick={hasUpdate ? () => handleOpenModal('edit', assess) : undefined}
                            >
                              {assess.title || "Risk Assessment Title"}
                            </div>
                            <div className="text-gray-500 text-xs mt-1">
                              {assess.description || "Risk assessment description and information."}
                            </div>
                            {assess.property_name && <div className="text-gray-500 text-xs mt-1">Property: {assess.property_name}</div>}
                          </div>
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`}></span>
                            <span className={`text-sm ${priorityStyle.text}`}>{assess.risk_level || "Medium"}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                            <span className={`text-sm ${statusStyle.text}`}>{assess.status || "New"}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.assigned && (
                        <td className="py-4 px-4">
                          {!assess.assigned_to ? (
                            <span className="text-gray-500 text-sm">Unassigned</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${getAvatarColor(assess.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                {getInitials(assess.assigned_to)}
                              </div>
                              <span className="text-gray-900 text-sm">{assess.assigned_to}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="py-4 px-4">
                          <span className="text-gray-700 text-sm">{formatDate(assess.assessment_date)}</span>
                        </td>
                      )}
                      {/* Custom column cells - UI Matched to other columns */}
                      {customColumns.map(col => visibleColumns[col] && (
                        <td key={col} className="py-4 px-4">
                          <span className="text-gray-700 text-sm">{assess[col] || '-'}</span>
                        </td>
                      ))}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenModal('view', assess)}
                              className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasUpdate && (
                              <button
                                onClick={() => handleOpenModal('edit', assess)}
                                className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {hasDelete && (
                              <button
                                onClick={() => handleDelete(assess.id)}
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
                    <td colSpan="9" className="py-8 text-center text-gray-500">No assessments found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['New', 'Under Review', 'Completed'].map((status) => {
                  const statusItems = filteredAssessments.filter((assessment) => {
                    return (assessment.status || 'New').toLowerCase() === status.toLowerCase();
                  });
                  
                  const getStatusStyle = (status) => {
                    if (status === 'New') {
                      return {
                        bg: 'bg-orange-50',
                        border: 'border-orange-200',
                        header: 'bg-orange-100',
                        text: 'text-orange-700',
                        dot: 'bg-orange-500'
                      };
                    }
                    if (status === 'Under Review') {
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
                              <p className="text-gray-400 text-sm">No assessments</p>
                            </div>
                          ) : (
                            statusItems.map((assessment) => {
                              const priorityColor = getPriorityColor(assessment.risk_level || "Medium");
                              
                              return (
                                <div
                                  key={assessment.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => {setSelectedAssessment(assessment); setModalMode('view'); setShowModal(true);}}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{assessment.reference || `RISK-${assessment.id}`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {assessment.risk_level || "Medium"}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {assessment.title || "Risk Assessment"}
                                  </h4>
                                  
                                  {assessment.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {assessment.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mb-3">
                                    {assessment.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {assessment.category}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    <div className="flex items-center gap-2">
                                      {assessment.assessed_by && assessment.assessed_by !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(assessment.assessed_by)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(assessment.assessed_by)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {assessment.assessed_by}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>
                                    
                                    <span className="text-xs text-gray-500">
                                      {formatDate(assessment.assessment_date)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAssessment(assessment); setModalMode('view'); setShowModal(true);
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
                                          setSelectedAssessment(assessment); setModalMode('edit'); setShowModal(true);
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
                                          handleDelete(assessment.id);
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
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {modalMode === 'create' ? "New Risk Assessment" : modalMode === 'edit' ? "Edit Risk Assessment" : "View Risk Assessment"}
                </h3>
                {modalMode === 'view' && (
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${
                    (formData.status||'').toLowerCase() === 'open' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                    (formData.status||'').toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600 border-red-100' :
                    'bg-green-50 text-green-600 border-green-100'
                  }`}>
                    {formData.status}
                  </span>
                )}
              </div>
              <button 
                onClick={handleCloseModal} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Content */}
            {modalMode === 'view' ? (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
                  <DetailField label="TITLE" value={formData.title} />
                  <DetailField label="PROPERTY" value={formData.property_name} />
                  
                  <DetailField label="CATEGORY" value={formData.category} />
                  <DetailField label="RISK LEVEL" value={formData.risk_level} />
                  
                  <DetailField label="REPORTED BY" value={formData.reported_by} />
                  <DetailField label="ASSIGNED TO" value={formData.assigned_to} />
                  
                  <DetailField label="ASSESSMENT DATE" value={formatDate(formData.assessment_date)} />
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

                <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-4">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">DESCRIPTION</div>
                    <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[80px]">
                      {formData.description || "No description provided."}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">FINDINGS</div>
                    <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[80px]">
                      {formData.findings || "No findings recorded."}
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">RECOMMENDATIONS</div>
                  <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[60px]">
                    {formData.recommendations || "No recommendations recorded."}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleCloseModal} 
                    className="px-5 py-2 border border-slate-200 text-slate-700 font-medium rounded hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Create/Edit Form Content */
              <form onSubmit={submit} className="p-4">
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  
                  {/* Row 1: Title & Description */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      value={formData.title || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief description of task" 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea 
                      required 
                      value={formData.description || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      placeholder="Detailed description of the risk assessment..." 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" 
                    />
                  </div>

                  {/* Row 2: Property & Category */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Property <span className="text-red-500">*</span></label>
                    <select 
                      required 
                      value={formData.property_id || ''} 
                      onChange={(e) => handlePropertyChange(e.target.value)}
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
                      value={formData.category || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  {/* Row 3: Risk Level & Reported By */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Risk Level <span className="text-red-500">*</span></label>
                    <select 
                      value={formData.risk_level || 'Medium'} 
                      onChange={(e) => setFormData(prev => ({ ...prev, risk_level: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    >
                      <option>Critical</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reported By <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={formData.reported_by || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, reported_by: e.target.value }))}
                      disabled={!formData.property_id || staffLoading}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!formData.property_id
                          ? "Select property first"
                          : staffLoading
                          ? "Loading staff..."
                          : "Select staff"}
                      </option>
                      {!!formData.reported_by && !staffUsers.some((u) => String(u.name) === String(formData.reported_by)) && (
                        <option value={formData.reported_by}>{formData.reported_by}</option>
                      )}
                      {staffUsers.map((u) => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Row 4: Assigned To & Assessment Date */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                    <select
                      value={formData.assigned_to || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                      disabled={!formData.property_id || staffLoading}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Date</label>
                    <input 
                      type="date" 
                      value={formatDateISO(formData.assessment_date) || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, assessment_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" 
                    />
                  </div>

                  {/* Row 5: Findings (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Findings</label>
                    <textarea 
                      value={formData.findings || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
                      rows={2}
                      placeholder="Assessment findings..." 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" 
                    />
                  </div>

                  {/* Row 6: Recommendations (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Recommendations</label>
                    <textarea 
                      value={formData.recommendations || ''} 
                      onChange={(e) => setFormData(prev => ({ ...prev, recommendations: e.target.value }))}
                      rows={2}
                      placeholder="Recommended actions..." 
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" 
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

                  {/* Row 7: Status (if not create mode) */}
                  {modalMode !== 'create' && (
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select 
                        value={formData.status || 'New'} 
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                      >
                        <option>New</option>
                        <option>Under Review</option>
                        <option>Escalated</option>
                        <option>Completed</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-200">
                  <button 
                    type="button" 
                    onClick={handleCloseModal} 
                    className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                  >
                    {submitting ? "Saving..." : (modalMode === 'create' ? "Create Task" : "Save Changes")}
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