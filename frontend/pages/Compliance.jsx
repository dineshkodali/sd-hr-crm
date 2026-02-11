/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
// Ensure you have these icons installed: npm install lucide-react
import {
  Download, Eye, Trash2, Edit, Plus, Search, FileText,
  CheckCircle, AlertTriangle, XCircle, ChevronDown, Filter
} from "lucide-react";
// You can keep your utils imports if they exist, or mock them if needed for UI only
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";

// --- Components from your project (Mocked or Inline for completeness) ---
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, type }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
        <h3 className={`text-lg font-bold mb-2 ${type === 'danger' ? 'text-red-600' : 'text-slate-800'}`}>{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-md">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-md ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500'}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

const AlertDialog = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <button onClick={onClose} className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-md font-medium text-slate-700">Close</button>
      </div>
    </div>
  );
};

// --- Inline Download Dropdown to match Screenshot ---
const DownloadDropdown = ({ onDownloadPDF, onDownloadCSV }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-teal-400 hover:bg-teal-500 text-white px-4 py-2.5 rounded-md font-medium shadow-sm flex items-center gap-2 transition-colors"
      >
        <Download size={18} />
        <span>Download</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { onDownloadCSV(); setIsOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <FileText size={14} className="text-teal-500" /> Download CSV
          </button>
          <button
            onClick={() => { onDownloadPDF(); setIsOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <FileText size={14} className="text-red-500" /> Download PDF
          </button>
        </div>
      )}
    </div>
  );
};

// --- API Config ---
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
  // timeout removed: requests will not time out from frontend
});

const PROPERTY_FIELD = "property_id";

const CERTIFICATE_TYPES = [
  "Gas Safety Certificate", "Electrical Installation (EICR)", "Fire Alarm Test",
  "Legionella Risk Assessment", "PAT Testing", "Energy Performance Certificate",
  "Fire Safety Certificate", "Other",
];

// --- Helper Functions ---
function formatLongDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch { return value; }
}

function getTodayYMD(offsetYears = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + offsetYears);
  return d.toISOString().split('T')[0];
}

function toInputYMD(value) {
  if (!value) return "";
  try { return new Date(value).toISOString().split('T')[0]; } catch { return String(value); }
}

function computeStatusFromExpiry(expiryDate) {
  if (!expiryDate) return "";
  try {
    const expiry = new Date(expiryDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "expired";
    if (diffDays <= 30) return "expiring";
    return "valid";
  } catch { return ""; }
}

// --- UI Components ---
function StatCard({ colorBg, icon, title, value }) {
  return (
    <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 flex items-center gap-5 flex-1 min-w-[240px] border border-slate-100">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md ${colorBg}`}>
        {/* Clone element to increase icon size slightly */}
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div>
        <div className="text-slate-500 text-sm font-semibold tracking-wide uppercase mb-1">{title}</div>
        <div className="text-3xl font-extrabold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  if (s === "expired") return <span className="bg-pink-100 text-pink-700 text-xs px-3 py-1 rounded-full font-bold">Expired</span>;
  if (s === "expiring" || s.includes("soon")) return <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-bold">Expiring Soon</span>;
  return <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-bold">Valid</span>;
}

// --- Main Page Component ---
export default function Compliance() {
  const currentUser = (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const { canCreate: canCreatePerm } = usePermissions(currentUser);
  const canCreateTasks = canCreatePerm("aire_tasks");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");

  const CERTIFICATE_TYPE_STORAGE_KEY = 'compliance.customCertificateTypes';
  const [customCertificateTypes, setCustomCertificateTypes] = useState([]);
  const [showCustomCertificateTypeInput, setShowCustomCertificateTypeInput] = useState(false);
  const [customCertificateTypeValue, setCustomCertificateTypeValue] = useState('');

  // Modal & Form
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Data
  const [certificates, setCertificates] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [stats, setStats] = useState({ valid_count: 0, expiring_count: 0, expired_count: 0 });
  const [loading, setLoading] = useState(false);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    status: "Pending",
    property_id: "",
    property_name: "",
    due_date: "",
    scheduled_date: "",
    category: "Compliance",
  });

  // Dialogs
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning' });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const [form, setForm] = useState({
    certificate_type: "",
    property_id: "",
    certificate_number: "",
    issue_date: getTodayYMD(),
    expiry_date: getTodayYMD(1),
    issued_by: "",
    status: "valid",
    notes: "",
  });

  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnMetadata, setCustomColumnMetadata] = useState({});
  const [availableColumns, setAvailableColumns] = useState([]);

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

  const fetchAvailableColumns = async () => {
    try {
      const res = await api.get('/api/forms-builder/tables/certificates/columns');
      const columns = res?.data?.columns || res?.data || [];

      const systemColumns = [
        'id', 'certificate_type', 'property_id', 'hotel_id', 'certificate_number',
        'issue_date', 'expiry_date', 'issued_by', 'status', 'notes',
        'created_at', 'updated_at', 'document_data', 'document_name', 'file_path', 'hotel_name', 'property_name'
      ];

      const columnNames = columns.map(col => {
        if (typeof col === 'string') return col;
        if (col.column_name) return col.column_name;
        if (col.name) return col.name;
        return String(col);
      });

      const customCols = columnNames.filter(col => !systemColumns.includes(col));

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
      }
    } catch (err) {
      console.warn('Failed to fetch columns:', err);
    }
  };

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CERTIFICATE_TYPE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomCertificateTypes(parsed.filter(Boolean).map(String));
      }
    } catch {
      setCustomCertificateTypes([]);
    }
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      setShowCustomCertificateTypeInput(false);
      setCustomCertificateTypeValue('');
    }
  }, [modalOpen]);

  useEffect(() => {
    const isModalOpen = modalOpen;
    if (isModalOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [modalOpen]);

  // --- Data Fetching ---
  const normalizeHotelsResponse = (data) => {
    if (!data) return [];
    let items = Array.isArray(data) ? data : (data.data || data.rows || data.hotels || []);
    return items.map((h) => ({
      id: h?.id ?? h?.hotel_id ?? h?._id ?? null,
      name: h?.name ?? h?.title ?? h?.hotel_name ?? `${h?.id ?? ""}`
    })).filter((x) => x.id && x.name);
  };

  const fetchHotels = async (signal) => {
    try {
      setHotelsLoading(true);
      const res = await api.get("/api/hotels", { params: { limit: 500 }, signal });
      const normalized = normalizeHotelsResponse(res?.data ?? {});
      setHotels(normalized);
      if (normalized.length === 1 && !form.property_id) setForm((f) => ({ ...f, property_id: normalized[0].id }));
    } catch (err) {
      if (axios.isCancel?.(err) || err?.name === "CanceledError") return;
      if (err?.code === 'ECONNABORTED') {
        setAlertDialog({
          isOpen: true,
          title: 'Timeout',
          message: 'Fetching hotels took too long. Please try again.',
          type: 'error'
        });
      }
      setHotels([]);
    } finally { setHotelsLoading(false); }
  };

  const fetchStats = async (signal) => {
    try {
      console.log('Fetching compliance stats...');
      const res = await api.get("/api/compliance/stats/summary", { signal });
      console.log('Stats API response:', res.data);
      if (res?.data?.ok && res.data.data) {
        // Ensure counts are numbers to avoid string concatenation
        const d = res.data.data;
        setStats({
          valid_count: Number(d.valid_count || 0),
          expiring_count: Number(d.expiring_count || 0),
          expired_count: Number(d.expired_count || 0)
        });
      }
    } catch (err) {
      if (axios.isCancel?.(err) || err?.name === "CanceledError") return;
      if (err?.code === 'ECONNABORTED') {
        setAlertDialog({
          isOpen: true,
          title: 'Timeout',
          message: 'Fetching compliance stats took too long. Please try again.',
          type: 'error'
        });
      }
      console.error('Stats fetch error:', err);
      // Reset stats on error
      setStats({ valid_count: 0, expiring_count: 0, expired_count: 0 });
    }
  };

  const fetchData = async (signal) => {
    try {
      setLoading(true);
      console.log('Fetching compliance data...');
      const res = await api.get("/api/compliance", { params: { limit: 200, _t: Date.now() }, signal });
      console.log('Compliance API response:', res.data);

      let items = res?.data?.ok ? res.data.data || [] : [];
      console.log('Processed items:', items);

      setCertificates(items.map((c) => ({ ...c, hotel_name: (c?.hotel_name ?? c?.property_name ?? "").toString().trim() })));
      console.log(`[Compliance] Loaded ${items.length} certificates.`);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.name === "CanceledError") return;
      console.error('Compliance fetch error:', err);
      setCertificates([]);
      // Show user-friendly error message
      if (err?.code === 'ECONNREFUSED' || err?.response?.status >= 500) {
        setAlertDialog({
          isOpen: true,
          title: 'Database Connection Error',
          message: 'Unable to connect to the database. Please ensure the database service is running.',
          type: 'error'
        });
      } else if (err?.code === 'ECONNABORTED') {
        setAlertDialog({
          isOpen: true,
          title: 'Timeout',
          message: 'Fetching compliance data took too long. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchHotels(controller.signal);
    fetchStats(controller.signal);
    fetchData(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    fetchAvailableColumns();
  }, [modalOpen]);

  const fetchStaffForHotel = async (hotelId) => {
    if (!hotelId) { setStaffUsers([]); return; }
    try {
      setStaffLoading(true);
      // Try multiple endpoints for robustness
      const paths = [`/api/staff/for-hotel/${hotelId}`, `/staff/for-hotel/${hotelId}`];
      let data = null;
      for (const p of paths) {
        try { const r = await api.get(p); if (r?.data) { data = r.data; break; } } catch { }
      }
      const list = data?.staff ?? data?.users ?? data ?? [];
      setStaffUsers(Array.isArray(list) ? list.map(u => ({ id: u.id, name: u.name || u.email })).filter(u => u.id) : []);
    } catch { setStaffUsers([]); } finally { setStaffLoading(false); }
  };

  // --- Filtering ---
  const filteredCertificates = useMemo(() => {
    return certificates.filter(c => {
      const matchSearch = !debouncedSearch ||
        (c.certificate_type || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (c.hotel_name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (c.certificate_number || '').toLowerCase().includes(debouncedSearch.toLowerCase());

      const computedStatus = c.status || computeStatusFromExpiry(c.expiry_date);
      const matchStatus = statusFilter === 'all' || (computedStatus || '').toLowerCase() === statusFilter.toLowerCase();
      const matchProperty = propertyFilter === 'all' || String(c[PROPERTY_FIELD]) === String(propertyFilter);
      return matchSearch && matchStatus && matchProperty;
    });
  }, [certificates, debouncedSearch, statusFilter, propertyFilter]);

  // --- Handlers ---
  function resetForm() {
    setForm({
      certificate_type: "", property_id: hotels.length === 1 ? hotels[0].id : "",
      certificate_number: "", issue_date: getTodayYMD(), expiry_date: getTodayYMD(1),
      issued_by: "", status: "valid", notes: "",
      ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
    });
    setStaffUsers([]); setDocumentFile(null); setFormError(""); setIsEditing(false); setViewMode(false); setEditId(null);
  }

  const persistCustomCertificateTypes = (list) => {
    try {
      localStorage.setItem(CERTIFICATE_TYPE_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore storage errors
    }
  };

  const handleCertificateTypeChange = (e) => {
    const value = e.target.value;
    if (value === '__add_new__') {
      setShowCustomCertificateTypeInput(true);
      setCustomCertificateTypeValue('');
      setForm((p) => ({ ...p, certificate_type: '' }));
      return;
    }
    setShowCustomCertificateTypeInput(false);
    setCustomCertificateTypeValue('');
    setForm((p) => ({ ...p, certificate_type: value }));
  };

  const saveCustomCertificateType = () => {
    const next = String(customCertificateTypeValue || '').trim();
    if (!next) return;

    const builtinLower = new Set(CERTIFICATE_TYPES.map((t) => String(t).toLowerCase()));
    const merged = [...customCertificateTypes];
    if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
      merged.push(next);
      setCustomCertificateTypes(merged);
      persistCustomCertificateTypes(merged);
    }

    setForm((p) => ({ ...p, certificate_type: next }));
    setShowCustomCertificateTypeInput(false);
    setCustomCertificateTypeValue('');
  };

  function openModal(mode, cert = null) {
    resetForm();
    if (cert) {
      setForm({
        certificate_type: cert.certificate_type ?? "",
        property_id: cert.property_id ?? cert.hotel_id ?? "",
        certificate_number: cert.certificate_number ?? "",
        issue_date: toInputYMD(cert.issue_date) || "",
        expiry_date: toInputYMD(cert.expiry_date) || "",
        issued_by: cert.issued_by ?? "",
        status: cert.status ?? "valid",
        notes: cert.notes ?? "",
        ...customColumns.reduce((acc, col) => ({ ...acc, [col]: cert[col] || '' }), {})
      });
      setEditId(cert.id);
      if (cert.property_id ?? cert.hotel_id) fetchStaffForHotel(cert.property_id ?? cert.hotel_id);
    }
    if (mode === 'edit') setIsEditing(true);
    if (mode === 'view') setViewMode(true);
    setModalOpen(true);
  }

  function openTaskModalForCertificate(cert) {
    if (!cert) return;
    setTaskError("");

    const pid = cert.property_id ?? cert.hotel_id ?? "";
    const pname = cert.hotel_name || cert.property_name || "";
    const expiry = cert.expiry_date ? toInputYMD(cert.expiry_date) : "";

    setTaskForm({
      title: `Renew: ${cert.certificate_type || "Certificate"} (${pname || "Property"})`,
      description: `Compliance certificate renewal reminder.\n\nCertificate Type: ${cert.certificate_type || ""}\nCertificate Number: ${cert.certificate_number || ""}\nProperty: ${pname || ""}\nIssue Date: ${cert.issue_date || ""}\nExpiry Date: ${cert.expiry_date || ""}`,
      priority: "Medium",
      status: "Pending",
      property_id: pid,
      property_name: pname,
      due_date: expiry,
      scheduled_date: "",
      category: "Compliance",
    });
    setTaskModalOpen(true);
  }

  async function submitTask(e) {
    e?.preventDefault();
    setTaskError("");
    setTaskSubmitting(true);
    try {
      if (!canCreateTasks) {
        throw new Error("Permission denied");
      }

      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        status: taskForm.status,
        property_id: taskForm.property_id || null,
        property_name: taskForm.property_name || null,
        due_date: taskForm.due_date || null,
        scheduled_date: taskForm.scheduled_date || null,
        category: taskForm.category || "Compliance",
      };

      await api.post("/api/aire-tasks", payload);
      setTaskModalOpen(false);
    } catch (err) {
      setTaskError(err?.response?.data?.message || err?.message || "Failed to create task");
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function submitCertificate(e) {
    e?.preventDefault();
    setFormError(""); setSubmitting(true);
    const selectedHotelId = form.property_id;
    const hotelName = hotels.find((h) => String(h.id) === String(selectedHotelId))?.name;
    const clean = (v) => (v === "" ? null : v);

    const payload = {
      ...form,
      [PROPERTY_FIELD]: selectedHotelId,
      hotel_name: hotelName,
      certificate_type: clean(form.certificate_type),
      certificate_number: clean(form.certificate_number),
      ...Object.fromEntries(customColumns.map(col => [col, clean(form[col])]))
    };

    try {
      const url = isEditing ? `/api/compliance/${editId}` : "/api/compliance";
      const method = isEditing ? "put" : "post";
      if (documentFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => { if (v != null) formData.append(k, v); });
        formData.append('document', documentFile);
        await api[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api[method](url, payload);
      }
      setModalOpen(false); resetForm(); fetchStats(); fetchData();
    } catch (err) { setFormError(err?.response?.data?.error || err.message || "Submission failed"); } finally { setSubmitting(false); }
  }

  const handleDelete = (c) => {
    setConfirmDialog({
      isOpen: true, title: 'Delete Certificate', message: `Delete ${c.certificate_type} for ${c.hotel_name}?`, type: 'danger',
      onConfirm: async () => {
        try { await api.delete(`/api/compliance/${c.id}`); setCertificates((p) => p.filter((x) => x.id !== c.id)); fetchStats(); setConfirmDialog(p => ({ ...p, isOpen: false })); }
        catch (err) { setConfirmDialog(p => ({ ...p, isOpen: false })); setAlertDialog({ isOpen: true, title: 'Error', message: 'Could not delete', type: 'error' }); }
      }
    });
  };

  const EXPORT_COLUMNS = useMemo(() => {
    const base = [
      { header: 'Certificate Type', key: 'certificate_type' },
      { header: 'Property', key: 'hotel_name' },
      { header: 'Certificate Number', key: 'certificate_number' },
      { header: 'Issue Date', key: 'issue_date' },
      { header: 'Expiry Date', key: 'expiry_date' },
      { header: 'Status', key: 'status' },
      { header: 'Issued By', key: 'issued_by' },
      { header: 'Notes', key: 'notes' },
    ];
    const custom = (customColumns || []).map(col => ({
      header: String(col).replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
      key: col,
    }));
    return [...base, ...custom];
  }, [customColumns]);

  const normalizeComplianceExportRow = (c) => {
    const computedStatus = c?.status || computeStatusFromExpiry(c?.expiry_date);
    const row = {
      certificate_type: c?.certificate_type || 'N/A',
      hotel_name: c?.hotel_name || c?.property_name || 'N/A',
      certificate_number: c?.certificate_number || 'N/A',
      issue_date: c?.issue_date || 'N/A',
      expiry_date: c?.expiry_date || 'N/A',
      status: computedStatus || 'N/A',
      issued_by: c?.issued_by || 'N/A',
      notes: c?.notes || '',
    };
    (customColumns || []).forEach(col => {
      row[col] = c[col] || '';
    });
    return row;
  };

  const handleDownloadPDF = () => {
    const data = (filteredCertificates || []).map(normalizeComplianceExportRow);
    generatePDF(data, EXPORT_COLUMNS, 'Compliance Certificates', 'compliance-certificates');
  };

  const handleDownloadCSV = () => {
    const data = (filteredCertificates || []).map(normalizeComplianceExportRow);
    generateCSV(data, EXPORT_COLUMNS, 'compliance-certificates');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-700">
      <div className="max-w-[1600px] mx-auto">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Compliance</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-2 font-medium">
              <span>Operations Hub</span>
              <span className="text-slate-300">›</span>
              <span className="text-slate-900">Compliance</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DownloadDropdown onDownloadPDF={handleDownloadPDF} onDownloadCSV={handleDownloadCSV} />
            <button
              onClick={() => openModal('create')}
              className="bg-teal-400 hover:bg-teal-500 text-white px-5 py-2.5 rounded-md font-medium shadow-sm flex items-center gap-2 transition-colors"
            >
              <Plus size={18} strokeWidth={2.5} /> Add Certificate
            </button>
          </div>
        </div>

        {/* Stats Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            colorBg="bg-emerald-500"
            icon={<CheckCircle />}
            title="Valid Certificates"
            value={stats.valid_count ?? 0}
          />
          <StatCard
            colorBg="bg-[#E88B5D]" // Matches the distinct orange in screenshot
            icon={<AlertTriangle />}
            title="Expiring Soon"
            value={stats.expiring_count ?? 0}
          />
          <StatCard
            colorBg="bg-pink-500"
            icon={<XCircle />}
            title="Expired"
            value={stats.expired_count ?? 0}
          />
        </div>

        {/* Filter Toolbar Section */}
        <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center">
          {/* Label */}
          <div className="px-5 py-3 font-bold text-slate-700 text-base hidden md:block whitespace-nowrap">
            Certificates
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-slate-200 hidden md:block mx-1"></div>

          {/* Search Bar */}
          <div className="flex-1 w-full relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search certificates..."
              className="w-full pl-11 pr-4 py-3 text-sm border-none focus:ring-0 text-slate-600 placeholder:text-slate-400 bg-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 w-full md:w-auto p-1.5 border-t md:border-t-0 border-slate-100">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium rounded-md pl-4 pr-10 py-2.5 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all cursor-pointer min-w-[140px]"
              >
                <option value="all">All Status</option>
                <option value="valid">Valid</option>
                <option value="expiring">Expiring</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>

            <div className="relative">
              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium rounded-md pl-4 pr-10 py-2.5 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all cursor-pointer min-w-[160px]"
              >
                <option value="all">All Properties</option>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
              <p>Loading certificates...</p>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
              <p className="text-slate-500 font-medium">No certificates found matching your criteria.</p>
              {certificates.length > 0 && (
                <p className="text-slate-400 text-sm mt-2">
                  {certificates.length} total certificates exist but are filtered out by your current search/filter settings.
                </p>
              )}
              {certificates.length === 0 && (Number(stats.valid_count) > 0 || Number(stats.expiring_count) > 0 || Number(stats.expired_count) > 0) && (
                <div className="text-slate-400 text-sm mt-2 text-center">
                  <p>Stats show {Number(stats.valid_count) + Number(stats.expiring_count) + Number(stats.expired_count)} certificates exist,</p>
                  <p>but none were loaded. Check browser console for API errors.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCertificates.map((c) => {
                const status = c.status || computeStatusFromExpiry(c.expiry_date);
                const hasDocument = !!(c.document_data || c.document_name || c.file_path);
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-slate-800">{c.certificate_type}</h3>
                          <StatusBadge status={status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 mt-3">
                          <div className="flex items-center gap-2"><div className="p-1 bg-blue-50 text-blue-500 rounded"><FileText size={14} /></div> <span className="font-medium text-slate-700">{c.hotel_name || "Unknown Property"}</span></div>
                          <div className="flex items-center gap-2"><div className="p-1 bg-emerald-50 text-emerald-500 rounded"><CheckCircle size={14} /></div> <span>Issued: {formatLongDate(c.issue_date)}</span></div>
                          <div className="flex items-center gap-2"><div className="p-1 bg-orange-50 text-orange-500 rounded"><AlertTriangle size={14} /></div> <span>Expires: {formatLongDate(c.expiry_date)}</span></div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-4 md:mt-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                        {hasDocument && (
                          <button onClick={() => window.open(`/api/compliance/${c.id}/document`, '_blank')} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="View Document">
                            <FileText className="w-5 h-5" />
                          </button>
                        )}
                        <button onClick={() => openModal('view', c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button onClick={() => openModal('edit', c)} className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Edit">
                          <Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-5 h-5" />
                        </button>
                        {canCreateTasks && (
                          <button
                            onClick={() => openTaskModalForCertificate(c)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Create Task"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {taskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative flex flex-col h-[70vh]">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Create Task</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Create a compliance renewal task</p>
                </div>
                <button onClick={() => setTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full p-2 transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={submitTask} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                {taskError && (
                  <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2 border border-red-100">
                    <AlertTriangle size={16} /> {taskError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={taskForm.due_date || ""}
                      onChange={(e) => setTaskForm((p) => ({ ...p, due_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      value={taskForm.scheduled_date || ""}
                      onChange={(e) => setTaskForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={6}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setTaskModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={taskSubmitting} className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors">{taskSubmitting ? "Creating..." : "Create Task"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Logic (Same as before but styled) */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative flex flex-col h-[70vh]">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{viewMode ? "View Certificate" : isEditing ? "Edit Certificate" : "New Certificate"}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Enter certificate details and compliance info</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full p-2 transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={submitCertificate} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {formError && <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2 border border-red-100"><AlertTriangle size={16} /> {formError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Form fields here (same logic as provided code but consistent styling) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Type <span className="text-red-500">*</span></label>
                    <select required value={form.certificate_type} onChange={handleCertificateTypeChange} disabled={viewMode} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none">
                      <option value="">Select type...</option>
                      {[...CERTIFICATE_TYPES, ...customCertificateTypes].map((t) => <option key={t} value={t}>{t}</option>)}
                      {!!form.certificate_type &&
                        ![...CERTIFICATE_TYPES, ...customCertificateTypes].some((t) => String(t) === String(form.certificate_type)) && (
                          <option value={form.certificate_type}>{form.certificate_type}</option>
                        )}
                      <option value="__add_new__">+ Add new...</option>
                    </select>
                    {showCustomCertificateTypeInput && !viewMode && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={customCertificateTypeValue}
                          onChange={(e) => setCustomCertificateTypeValue(e.target.value)}
                          placeholder="Enter new certificate type"
                          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                        />
                        <button
                          type="button"
                          onClick={saveCustomCertificateType}
                          className="px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium shadow-sm transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomCertificateTypeInput(false);
                            setCustomCertificateTypeValue('');
                          }}
                          className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
                    <select required value={form.property_id} onChange={(e) => { const pid = e.target.value; setForm({ ...form, property_id: pid, issued_by: '' }); if (pid) fetchStaffForHotel(pid); }} disabled={viewMode} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none">
                      <option value="">Select property...</option>
                      {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={viewMode} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none">
                      <option value="valid">Valid</option>
                      <option value="expiring-soon">Expiring Soon</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                    <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} disabled={viewMode} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} disabled={viewMode} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none" />
                  </div>
                  {/* ... other fields ... */}
                  {/* Custom columns */}
                  {customColumns.map(col => {
                    const meta = customColumnMetadata[col] || {};
                    const inputType = meta.input_type || 'text';
                    const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                    return (
                      <div key={col} className={inputType === 'textarea' ? "md:col-span-2" : ""}>
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
                              disabled={viewMode}
                            />
                            <span className="ml-2 text-sm text-gray-700">Yes</span>
                          </div>
                        ) : inputType === 'dropdown' || inputType === 'select' ? (
                          <select
                            value={form[col] || ''}
                            onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                            disabled={viewMode}
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
                            onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                            disabled={viewMode}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                        ) : inputType === 'date' ? (
                          <input
                            type="date"
                            value={form[col] ? toInputYMD(form[col]) : ''}
                            onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                            disabled={viewMode}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                        ) : (
                          <input
                            type={inputType}
                            value={form[col] || ''}
                            onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                            placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                            disabled={viewMode}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* File Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Document</label>
                  <label className={`border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${viewMode ? 'bg-gray-50' : 'hover:border-emerald-400 hover:bg-emerald-50/30 cursor-pointer'}`}>
                    <input type="file" className="hidden" disabled={viewMode} onChange={(e) => setDocumentFile(e.target.files?.[0])} accept="application/pdf,image/*" />
                    <div className="bg-teal-100 text-teal-600 p-3 rounded-full mb-3"><Download size={24} /></div>
                    <p className="text-sm font-medium text-slate-700">{documentFile ? documentFile.name : "Click to upload certificate (PDF/Image)"}</p>
                    <p className="text-xs text-slate-400 mt-1">Max file size 10MB</p>
                  </label>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                  {!viewMode && <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium shadow-sm transition-colors">{submitting ? "Saving..." : "Save Certificate"}</button>}
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} />
        <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(p => ({ ...p, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      </div>
    </div>
  );
}