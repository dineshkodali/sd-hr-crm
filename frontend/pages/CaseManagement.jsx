/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import { AlertModal, ConfirmModal } from '../components/ModalDialogs';
import { generatePDF } from '../utils/pdfGenerator';
import { generateCSV } from '../utils/csvGenerator';
import { DownloadDropdown } from '../components/DownloadDropdown';
import {
  Home,
  Briefcase,
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
  CheckCircle
} from "lucide-react";

/* --- Helpers --- */
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
  if (low === "urgent" || low === "overdue") return { dot: "bg-red-500", text: "text-red-700" };
  return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
  return "bg-teal-100 text-teal-700";
}

/* Helper for View Details Modal */
const DetailField = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
    <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
  </div>
);

const CaseManagement = () => {
  const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true }), []);
  // Default visible columns for Case Management (must match other pages)
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

  // Custom columns and available columns
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnMetadata, setCustomColumnMetadata] = useState({});
  const [availableColumns, setAvailableColumns] = useState(DEFAULT_COLUMNS);

  // Define all available columns
  const ALL_COLUMNS = availableColumns;

  // Column visibility state - default columns visible, custom columns from localStorage or hidden
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('caseManagementVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
      }
    } catch (e) {
      console.error('Error loading column visibility:', e);
    }
    return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('caseManagementVisibleColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn('Failed to save visible columns to localStorage:', e);
    }
  }, [visibleColumns]);

  // Fetch available columns from backend
  const fetchAvailableColumns = async () => {
    try {
      const res = await api.get('/api/case-management/columns');
      const columns = res?.data?.columns || res?.data || [];
      const defaultColumns = ["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"];
      const systemColumns = [
        'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
        'title', 'description', 'property_id', 'property_name', 'category',
        'priority', 'reported_by', 'assigned_to', 'scheduled_date', 'status'
      ];
      const columnNames = columns.map(col => typeof col === 'string' ? col : (col.column_name || col.name || String(col)));
      const customCols = columnNames.filter(col => !systemColumns.includes(col) && !defaultColumns.includes(col));
      // Insert custom columns before "actions"
      const newColumns = [...defaultColumns.slice(0, -1), ...customCols, defaultColumns[defaultColumns.length - 1]];
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
            if (prev[col] === undefined) {
              try {
                const saved = localStorage.getItem('caseManagementVisibleColumns');
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
  };

  // Poll for columns every 5 seconds
  useEffect(() => {
    let mounted = true;
    fetchAvailableColumns();
    const intervalId = setInterval(() => {
      if (mounted) fetchAvailableColumns();
    }, 5000);
    return () => { mounted = false; clearInterval(intervalId); };
  }, [api]);
  // --- Custom Columns State ---
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
  const hasRead = canRead("case_management");
  const hasCreate = canCreate("case_management");
  const hasUpdate = canUpdate("case_management");
  const hasDelete = canDelete("case_management");

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [properties, setProperties] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);

  // Filter and Sort State
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [sortBy, setSortBy] = useState("");

  // --- View Button / Column Visibility State ---
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const viewRef = useRef(null);

  // Define all available columns for Case Management

  // Column visibility state - all visible by default

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

  // Mock Categories
  const categories = [
    'Plumbing', 'Electrical', 'HVAC', 'Structural', 'Appliances',
    'Doors & Windows', 'Flooring', 'Roofing', 'Pest Control', 'Other',
    'Case Management'
  ];

  const initialForm = {
    title: '',
    description: '',
    type: '', // Maps to Category
    priority: 'Medium',
    status: 'Pending',
    property: '',
    assigned_to: '',
    reported_by: currentUser?.name || '',
    scheduled_date: '',
  };
  const [formData, setFormData] = useState(initialForm);

  const CATEGORY_STORAGE_KEY = 'caseManagement.customCategories';
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
      setFormData((p) => ({ ...p, type: '' }));
      return;
    }
    setShowCustomCategoryInput(false);
    setCustomCategoryValue('');
    setFormData((p) => ({ ...p, type: value }));
  };

  const saveCustomCategory = () => {
    const next = String(customCategoryValue || '').trim();
    if (!next) return;

    const builtins = categories;
    const builtinLower = new Set((builtins || []).map((t) => String(t).toLowerCase()));
    const merged = [...customCategories];
    if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
      merged.push(next);
      setCustomCategories(merged);
      persistCustomCategories(merged);
    }

    setFormData((p) => ({ ...p, type: next }));
    setShowCustomCategoryInput(false);
    setCustomCategoryValue('');
  };


  // Hide sidebar and navbar when modal/form is open
  useEffect(() => {
    const isModalOpen = showForm || showView;
    if (isModalOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showForm, showView]);

  /* --- DATA FETCHING --- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/case-management?limit=2000').catch(() => ({ data: [] }));

        let data = res.data?.data || res.data || [];
        if (data.length === 0) {
          data = [
            { id: 1, type: 'Case Management', reference: 'CSM-2025-e5198a6e', title: 'Passport & VISA Verification', description: 'Operation work required as per inspection report.', priority: 'Medium', status: 'Completed', assigned_to: 'ABC Maintenance', scheduled_date: '2025-02-08T10:00:00', property: '1', reported_by: 'John Doe' },
            { id: 2, type: 'Plumbing', reference: 'CSM-2025-c51690eb', title: 'Leaking pipe in kitchen', description: 'Urgent leak under the sink.', priority: 'High', status: 'Pending', assigned_to: 'Unassigned', scheduled_date: '2025-09-26T10:00:00', property: '2', reported_by: 'Jane Smith' },
            { id: 3, type: 'Case Management', reference: 'CSM-2025-cda9bd4e', title: 'AIRE Annual Reporting', description: 'Operation work required as per inspection report.', priority: 'Low', status: 'Completed', assigned_to: 'In-house Team', scheduled_date: '2025-06-02T10:00:00', property: '1', reported_by: 'Admin' },
          ];
        }

        const normalizedData = data.map(item => ({
          ...item,
          type: item.type || item.category || 'Other',
          property: String(item.property || item.property_id || item.propertyId || '')
        }));

        setCases(normalizedData);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchProps = async () => {
      try {
        const r = await api.get('/api/hotels?limit=1000').catch(() => ({ data: [] }));
        let list = r.data?.hotels || r.data?.data || r.data || [];
        if (list.length === 0) {
          list = [{ id: '1', name: 'Block A' }, { id: '2', name: 'Block B' }, { id: '3', name: 'Riverside Apartments' }];
        }
        const cleanList = (Array.isArray(list) ? list : []).map(p => ({ ...p, id: String(p.id) }));
        setProperties(cleanList);
      } catch (e) { setProperties([]); }
    };

    fetchData();
    fetchProps();
  }, [api]);

  /* --- DYNAMIC STATS CALCULATION --- */
  const stats = useMemo(() => {
    const total = cases.length;
    const completed = cases.filter(c => String(c.status || '').toLowerCase() === 'completed').length;
    const overdue = cases.filter(c => {
      if (!c.scheduled_date) return false;
      const d = new Date(c.scheduled_date);
      const now = new Date();
      return d < now && String(c.status || '').toLowerCase() !== 'completed';
    }).length;

    const dueThisWeek = cases.filter(c => {
      if (!c.scheduled_date) return false;
      const d = new Date(c.scheduled_date);
      const now = new Date();
      const diffTime = d - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7 && String(c.status || '').toLowerCase() !== 'completed';
    }).length;

    return { total, overdue, dueThisWeek, completed };
  }, [cases]);


  /* --- HANDLERS --- */
  const handleAdd = () => {
    setEditingId(null);
    setFormData(initialForm);
    setStaffMembers([]); // Clear staff members for new record
    setShowForm(true);
  };

  const handleEdit = async (c) => {
    setEditingId(c.id);
    setFormData({
      ...initialForm,
      ...c,
      scheduled_date: c.scheduled_date ? formatDateISO(c.scheduled_date) : '',
      type: c.type || c.category || '',
      property: String(c.property_id || c.property || c.propertyId || ''),
    });

    // Fetch staff members if property is already set
    const propId = c.property_id || c.property || c.propertyId;
    if (propId) {
      try {
        const response = await api.get(`/api/staff/for-hotel/${propId}`);
        const staff = response?.data?.staff || [];
        setStaffMembers(staff);
      } catch (err) {
        console.warn('Failed to fetch staff for property:', err);
        setStaffMembers([]);
      }
    } else {
      setStaffMembers([]);
    }

    setShowForm(true);
  };

  const handleView = (c) => {
    setViewing(c);
    setShowView(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const propId = formData.property;
    const prop = properties.find(p => String(p.id) === String(propId)) || {};
    const property_name = prop.name || prop.property_name || '';

    // Build payload with standard fields
    const payload = {
      title: formData.title,
      description: formData.description,
      type: formData.type,
      category: formData.type,
      priority: formData.priority || 'Medium',
      status: formData.status || 'Pending',
      property_id: propId || null,
      property: propId || null,
      property_name: property_name || null,
      assigned_to: formData.assigned_to || null,
      assigned_to_name: formData.assigned_to || null,
      reported_by: formData.reported_by || null,
      scheduled_date: formData.scheduled_date || null,
      due_date: formData.scheduled_date || null,
    };
    // Add custom columns to payload
    if (customColumns && customColumns.length) {
      customColumns.forEach(col => {
        if (formData.hasOwnProperty(col)) {
          payload[col] = formData[col];
        }
      });
    }

    try {
      let response;
      if (editingId) {
        response = await api.put(`/api/case-management/${editingId}`, payload);
      } else {
        response = await api.post("/api/case-management", payload);
      }
      // Always refetch columns and table data after save
      await fetchAvailableColumns();
      const res = await api.get('/api/case-management?limit=2000');
      let data = res.data?.data || res.data || [];
      const normalizedData = data.map(item => ({
        ...item,
        type: item.type || item.category || 'Other',
        property: String(item.property || item.property_id || item.propertyId || '')
      }));
      setCases(normalizedData);
      setShowForm(false);
    } catch (err) {
      console.error('Error saving case:', err);
      showAlert('Error', `Failed to ${editingId ? 'update' : 'create'} case: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleDelete = async (id) => {
    showConfirm(
      'Delete Case',
      'Delete this case? This action cannot be undone.',
      () => handleDeleteConfirmed(id)
    );
  };

  const handleDeleteConfirmed = async (id) => {
    try {
      await api.delete(`/api/case-management/${id}`);
      await new Promise(resolve => setTimeout(resolve, 300));
      const res = await api.get('/api/case-management?limit=2000');
      let data = res.data?.data || res.data || [];
      const normalizedData = data.map(item => ({
        ...item,
        type: item.type || item.category || 'Other',
        property: String(item.property || item.property_id || item.propertyId || '')
      }));
      setCases(normalizedData);
    } catch (err) {
      console.error('Delete error:', err);
      showAlert('Error', 'Failed to delete case: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const getPropertyName = (idOrName) => {
    if (!idOrName) return '-';
    if (isNaN(idOrName) && idOrName.length > 3) return idOrName;
    const prop = properties.find(p => String(p.id) === String(idOrName));
    return prop ? (prop.name || prop.property_name) : idOrName;
  };

  /* --- UI FILTER LOGIC --- */
  const filteredCases = useMemo(() => {
    let result = [...cases];

    // Search filtering
    const q = (searchTerm || "").trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        String(r.reference).toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    }

    // Priority filtering
    if (priorityFilter) {
      result = result.filter((r) =>
        String(r.priority).toLowerCase() === priorityFilter.toLowerCase()
      );
    }

    // Status filtering
    if (statusFilter) {
      result = result.filter((r) =>
        String(r.status).toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Property filtering
    if (propertyFilter) {
      result = result.filter((r) =>
        String(r.property) === String(propertyFilter) ||
        String(r.property_id) === String(propertyFilter) ||
        String(r.hotel_id) === String(propertyFilter)
      );
    }

    // Sorting logic
    if (sortBy === "date") {
      result.sort((a, b) => {
        const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
        const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
        return dateB - dateA; // newest first
      });
    } else if (sortBy === "priority") {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      result.sort((a, b) => {
        const priorityA = priorityOrder[String(a.priority).toLowerCase()] || 0;
        const priorityB = priorityOrder[String(b.priority).toLowerCase()] || 0;
        return priorityB - priorityA;
      });
    } else if (sortBy === "status") {
      result.sort((a, b) => String(a.status).localeCompare(String(b.status)));
    } else if (sortBy === "title") {
      result.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    }

    return result;
  }, [cases, searchTerm, priorityFilter, statusFilter, propertyFilter, sortBy]);

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
      { header: 'Assigned To', key: 'assigned_to' },
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

  // Normalize case for export
  const normalizeCaseExportRow = (caseItem) => {
    const base = {
      reference: caseItem.reference || 'N/A',
      title: caseItem.title || 'N/A',
      priority: caseItem.priority || 'N/A',
      status: caseItem.status || 'N/A',
      assigned_to: caseItem.assigned_to || 'N/A',
      date: caseItem.date ? new Date(caseItem.date).toLocaleDateString() : 'N/A',
      property: caseItem.property || 'N/A'
    };

    for (const col of customColumns || []) {
      base[col] = caseItem?.[col] ?? '';
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
    const data = filteredCases.map(normalizeCaseExportRow).map((row) => {
      const filteredRow = {};
      columnsToExport.forEach((col) => {
        filteredRow[col.key] = row[col.key];
      });
      return filteredRow;
    });

    if (exportFormat === 'pdf') {
      generatePDF(data, columnsToExport, 'Case Management', 'case-management');
    } else if (exportFormat === 'csv') {
      generateCSV(data, columnsToExport, 'case-management');
    }

    closeExport();
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">

        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Case Management</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Escalations</span>
              <span>&gt;</span>
              <span>Case Management</span>
            </div>
          </div>
          {hasCreate && (
            <div className="flex items-center gap-3">
              <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
              <button
                onClick={handleAdd}
                className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <span>+</span>
                <span>Create Task</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Tasks</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Overdue</div>
              <div className="text-2xl font-bold text-gray-900">{stats.overdue}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Due This Week</div>
              <div className="text-2xl font-bold text-gray-900">{stats.dueThisWeek}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
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

        {/* Main Content Area - Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Work Orders</h2>
                <p className="text-sm text-gray-500">{cases.length} total records</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="bg-white border-2 border-gray-200 rounded-lg w-72 py-2.5 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm hover:shadow-md transition-shadow"
                  />
                </div>

                {/* View Dropdown - REPLACED OLD VIEW BUTTON WITH NEW LOGIC */}
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
                              <Briefcase className="w-4 h-4" />
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
                    onClick={handleAdd}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <span>+</span>
                    <span>Create Task</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-gray-100 border border-gray-200 rounded-md pl-9 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">All Priority</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-100 border border-gray-200 rounded-md pl-9 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Open">Open</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-gray-100 border border-gray-200 rounded-md pl-9 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">All Properties</option>
                  {properties.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-100 border border-gray-200 rounded-md pl-9 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none cursor-pointer"
                >
                  <option value="">Sort By</option>
                  <option value="date">Date (Newest First)</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="title">Title</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {(priorityFilter || statusFilter || propertyFilter || sortBy) && (
                <button
                  onClick={() => {
                    setPriorityFilter("");
                    setStatusFilter("");
                    setPropertyFilter("");
                    setSortBy("");
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium px-3 py-1.5 hover:bg-teal-50 rounded-md transition-colors"
                >
                  Clear Filters
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
                    {/* Standard columns */}
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
                    {/* Custom columns - Styled exactly like other columns */}
                    {customColumns && customColumns.map(col => visibleColumns[col] && (
                      <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {col}
                      </th>
                    ))}
                    {visibleColumns.actions && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan="9" className="py-8 text-center text-gray-500">Loading...</td></tr>
                  ) : filteredCases.length > 0 ? filteredCases.map((row) => {
                    const priorityStyle = getPriorityColor(row.priority);
                    const statusStyle = getStatusColor(row.status);
                    return (
                      <tr key={row.id} className="hover:bg-teal-50/30 transition-all border-b border-gray-100 last:border-0">
                        {/* Standard columns */}
                        {visibleColumns.checkbox && (
                          <td className="py-4 px-4">
                            <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
                              {row.type || "General"}
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
                                onClick={hasUpdate ? () => handleEdit(row) : undefined}
                              >
                                <Home className="w-4 h-4 text-gray-400" />
                                <span>{row.property_name || 'Unknown Property'}</span>
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
                            {row.assigned_to === "Unassigned" || !row.assigned_to ? (
                              <span className="text-gray-400 text-sm">Unassigned</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.assigned_to)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                  {getInitials(row.assigned_to)}
                                </div>
                                <span className="text-gray-900 text-sm font-medium">{row.assigned_to}</span>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.date && (
                          <td className="py-4 px-4">
                            <span className="text-gray-600 text-sm">{formatDate(row.scheduled_date)}</span>
                          </td>
                        )}
                        {/* Custom columns - Styled exactly like other columns */}
                        {customColumns && customColumns.map(col => visibleColumns[col] && (
                          <td key={col} className="py-4 px-4">
                            <span className="text-gray-700 text-sm">{row[col] ?? '-'}</span>
                          </td>
                        ))}
                        {visibleColumns.actions && (
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleView(row)} className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" title="View">
                                <Eye className="w-4 h-4" />
                              </button>
                              {hasUpdate && (
                                <button onClick={() => handleEdit(row)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {hasDelete && (
                                <button onClick={() => handleDelete(row.id)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="9" className="py-8 text-center text-gray-500">No cases found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['New', 'Under Review', 'Completed'].map((status) => {
                  const statusItems = filteredCases.filter((caseItem) => {
                    const itemStatus = caseItem.status || 'New';
                    return itemStatus.toLowerCase() === status.toLowerCase();
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
                              <Briefcase className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-gray-400 text-sm">No cases</p>
                            </div>
                          ) : (
                            statusItems.map((caseItem) => {
                              const priorityColor = getPriorityColor(caseItem.priority || "Medium");

                              return (
                                <div
                                  key={caseItem.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => handleView(caseItem)}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{caseItem.reference || `CASE-${caseItem.id}`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {caseItem.priority || "Medium"}
                                      </span>
                                    </div>
                                  </div>

                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {caseItem.title || "Case"}
                                  </h4>

                                  {caseItem.description && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {caseItem.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 mb-3">
                                    {caseItem.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                                        {caseItem.category}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    <div className="flex items-center gap-2">
                                      {caseItem.assigned_to && caseItem.assigned_to !== 'Unassigned' ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(caseItem.assigned_to)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(caseItem.assigned_to)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {caseItem.assigned_to}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Unassigned</span>
                                      )}
                                    </div>

                                    <span className="text-xs text-gray-500">
                                      {formatDate(caseItem.date)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleView(caseItem);
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
                                          handleEdit(caseItem);
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
                                          handleDelete(caseItem.id);
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

        {/* --- VIEW DETAILS MODAL --- */}
        {showView && viewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative">

              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Case Details</h3>
                <button
                  onClick={() => setShowView(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* View Mode Content */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
                  <DetailField label="CASE TITLE" value={viewing.title} />
                  <DetailField label="PROPERTY" value={getPropertyName(viewing.property)} />
                  <DetailField label="REFERENCE" value={viewing.reference} />
                  <DetailField label="CATEGORY" value={viewing.type} />
                  <DetailField label="SCHEDULED DATE" value={formatDate(viewing.scheduled_date)} />
                  <DetailField label="PRIORITY" value={viewing.priority} />
                  <DetailField label="STATUS" value={viewing.status} />
                  <DetailField label="ASSIGNED TO" value={viewing.assigned_to} />
                  <DetailField label="REPORTED BY" value={viewing.reported_by} />
                  {/* Custom columns */}
                  {customColumns && customColumns.map(col => (
                    <DetailField key={col} label={col} value={viewing[col]} />
                  ))}
                </div>

                <div className="mb-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-2">DESCRIPTION</div>
                  <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600 border border-slate-100 min-h-[80px]">
                    {viewing.description || "No description provided."}
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
            </div>
          </div>
        )}

        {/* --- FORM MODAL (Create/Edit) --- */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl relative h-[70vh] flex flex-col">

              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId ? "Edit Case" : "Create New Case"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleSubmit} className="p-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">

                  {/* Row 1: Title & Priority */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    >
                      {['Low', 'Medium', 'High', 'Urgent'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Row 2: Property & Category */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Property <span className="text-red-500">*</span></label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                      value={formData.property}
                      onChange={async (e) => {
                        const propId = e.target.value;
                        setFormData({ ...formData, property: propId, assigned_to: '', reported_by: currentUser?.name || '' });
                        // Fetch staff members for the selected property
                        if (propId) {
                          try {
                            const response = await api.get(`/api/staff/for-hotel/${propId}`);
                            const staff = response?.data?.staff || [];
                            setStaffMembers(staff);
                          } catch (err) {
                            console.warn('Failed to fetch staff for property:', err);
                            setStaffMembers([]);
                          }
                        } else {
                          setStaffMembers([]);
                        }
                      }}
                    >
                      <option value="">Select property</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                      value={formData.type}
                      onChange={handleCategoryChange}
                    >
                      <option value="">Select category</option>
                      {[...categories, ...customCategories].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      {!!formData.type && ![...categories, ...customCategories].some((c) => String(c) === String(formData.type)) && (
                        <option value={formData.type}>{formData.type}</option>
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

                  {/* Row 3: Assigned To & Reported By */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                    {formData.property && staffMembers.length > 0 ? (
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                        value={formData.assigned_to}
                        onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                      >
                        <option value="">Select staff member</option>
                        {staffMembers.map(staff => (
                          <option key={staff.id} value={staff.name}>{staff.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-gray-50"
                        value={formData.assigned_to}
                        onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                        placeholder={formData.property ? "Loading staff..." : "Select property first"}
                        disabled={!formData.property}
                      />
                    )}
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

                  {/* Row 4: Scheduled Date (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                      value={formData.scheduled_date}
                      onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                    />
                  </div>

                  {/* Row 5: Description (Full Width) */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea
                      rows={3}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 resize-y"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  {/* Custom columns - Standardized UI to Gray */}
                  {customColumns && customColumns.map(col => {
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
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
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
                    onClick={() => setShowForm(false)}
                    className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 font-medium shadow-sm transition-colors text-sm"
                  >
                    {editingId ? "Update Case" : "Create Case"}
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
    </div>
  );
};

export default CaseManagement;