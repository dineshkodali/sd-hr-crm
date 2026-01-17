/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { Download, Eye, Trash2, Edit, Plus, Search, FileText, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

// Use global baseURL if set in main.jsx; otherwise fallback to env
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

const PROPERTY_FIELD = "property_id";

const CERTIFICATE_TYPES = [
  "Gas Safety Certificate",
  "Electrical Installation (EICR)",
  "Fire Alarm Test",
  "Legionella Risk Assessment",
  "PAT Testing",
  "Energy Performance Certificate",
  "Fire Safety Certificate",
  "Other",
];

/* --- Helpers --- */
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
  try {
    return new Date(value).toISOString().split('T')[0];
  } catch { return String(value); }
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

/* --- UI Components --- */
function StatCard({ colorBg, icon, title, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-5 flex-1 min-w-[240px] border border-slate-100">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-sm ${colorBg}`}>
        {icon}
      </div>
      <div>
        <div className="text-slate-500 text-sm font-medium">{title}</div>
        <div className="text-3xl font-bold text-slate-800 mt-1">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  if (s === "expired") return <span className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full font-semibold">Expired</span>;
  if (s === "expiring" || s.includes("soon")) return <span className="bg-orange-100 text-orange-600 text-xs px-3 py-1 rounded-full font-semibold">Expiring Soon</span>;
  return <span className="bg-green-100 text-green-600 text-xs px-3 py-1 rounded-full font-semibold">Valid</span>;
}

/* --- Main Component --- */
export default function Compliance() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  
  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  
  // Data State
  const [certificates, setCertificates] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [stats, setStats] = useState({ valid_count: 0, expiring_count: 0, expired_count: 0 });
  const [loading, setLoading] = useState(false);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);

  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
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

  // Debounce Search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // --- 1. Data Fetching ---
  const normalizeHotelsResponse = (data) => {
    if (!data) return [];
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data.rows)) items = data.rows;
    else if (Array.isArray(data.hotels)) items = data.hotels;
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
      if (normalized.length === 1 && !form.property_id) {
        setForm((f) => ({ ...f, property_id: normalized[0].id }));
      }
    } catch (err) {
      if (err?.name !== "CanceledError") setHotels([]);
    } finally {
      setHotelsLoading(false);
    }
  };

  const fetchStats = async (signal) => {
    try {
      const res = await api.get("/api/compliance/stats/summary", { signal });
      if (res?.data?.ok && res.data.data) setStats(res.data.data);
    } catch (err) {}
  };

  const fetchData = async (signal) => {
    try {
      setLoading(true);
      const res = await api.get("/api/compliance", { 
        params: { limit: 200, _t: Date.now() }, 
        signal 
      });
      let items = res?.data?.ok ? res.data.data || [] : [];
      
      const augmented = items.map((c) => ({ 
        ...c, 
        hotel_name: (c?.hotel_name ?? c?.property_name ?? "").toString().trim() 
      }));
      setCertificates(augmented);
    } catch (err) {
      if (err?.name !== "CanceledError") setCertificates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchHotels(controller.signal);
    fetchStats(controller.signal);
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (modalOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [modalOpen]);

  const fetchStaffForHotel = async (hotelId) => {
    if (!hotelId) {
      setStaffUsers([]);
      return;
    }
    try {
      setStaffLoading(true);

      const tryPath = async (path) => {
        const r = await api.get(path);
        return r?.data;
      };

      const paths = [
        `/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
        `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`,
      ];

      let data = null;
      let lastErr = null;
      for (const p of paths) {
        try {
          data = await tryPath(p);
          if (data) break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!data) throw lastErr || new Error('Unable to load staff');

      const list = data?.staff ?? data?.users ?? data ?? [];
      const normalized = (Array.isArray(list) ? list : [])
        .map((u) => ({
          id: u.id,
          name: u.name || u.email || `User ${u.id}`,
          email: u.email || null,
        }))
        .filter((u) => u.id && u.name);

      setStaffUsers(normalized);
    } catch (err) {
      console.error('fetchStaffForHotel error:', err);
      setStaffUsers([]);
    } finally {
      setStaffLoading(false);
    }
  };

  // --- 2. Centralized Filtering Logic ---
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

  // --- 3. Form Handlers ---
  function resetForm() {
    setForm({
      certificate_type: "",
      property_id: hotels.length === 1 ? hotels[0].id : "",
      certificate_number: "",
      issue_date: getTodayYMD(),
      expiry_date: getTodayYMD(1),
      issued_by: "",
      status: "valid",
      notes: "",
    });
    setStaffUsers([]);
    setDocumentFile(null);
    setFormError("");
    setIsEditing(false);
    setViewMode(false);
    setEditId(null);
  }

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
      });
      setEditId(cert.id);

      const pid = cert.property_id ?? cert.hotel_id;
      if (pid) {
        fetchStaffForHotel(pid);
      }
    }
    if (mode === 'edit') setIsEditing(true);
    if (mode === 'view') setViewMode(true);
    setModalOpen(true);
  }

  async function submitCertificate(e) {
    e?.preventDefault();
    setFormError("");
    setSubmitting(true);

    const selectedHotelId = form.property_id;
    const hotelName = hotels.find((h) => String(h.id) === String(selectedHotelId))?.name;
    const clean = (v) => (v === "" ? null : v);

    const payload = {
      ...form,
      [PROPERTY_FIELD]: selectedHotelId,
      hotel_name: hotelName,
      certificate_type: clean(form.certificate_type),
      certificate_number: clean(form.certificate_number),
    };

    try {
      const url = isEditing ? `/api/compliance/${editId}` : "/api/compliance";
      const method = isEditing ? "put" : "post";

      if (documentFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          formData.append(k, v);
        });
        formData.append('document', documentFile);
        await api[method](url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api[method](url, payload);
      }

      setModalOpen(false);
      resetForm();
      fetchStats();
      fetchData();
    } catch (err) {
      setFormError(err?.response?.data?.error || err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  // --- 4. Action Handlers ---
  const handleDelete = (c) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Certificate',
      message: `Are you sure you want to delete the ${c.certificate_type} for ${c.hotel_name}?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/api/compliance/${c.id}`);
          setCertificates((prev) => prev.filter((x) => x.id !== c.id));
          fetchStats();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({ isOpen: true, title: 'Delete Failed', message: err.message || 'Could not delete certificate', type: 'error' });
        }
      }
    });
  };

  const prepareDownloadData = () => {
    return filteredCertificates.map(cert => ({
      certificateType: cert.certificate_type || '-',
      propertyName: cert.hotel_name || '-',
      issueDate: formatLongDate(cert.issue_date),
      expiryDate: formatLongDate(cert.expiry_date),
      status: cert.status || computeStatusFromExpiry(cert.expiry_date),
      issuedBy: cert.issued_by || '-'
    }));
  };

  const handleDownloadPDF = () => {
    const columns = [
      { header: 'Type', key: 'certificateType' },
      { header: 'Property', key: 'propertyName' },
      { header: 'Issue Date', key: 'issueDate' },
      { header: 'Expiry Date', key: 'expiryDate' },
      { header: 'Status', key: 'status' },
      { header: 'Issued By', key: 'issuedBy' }
    ];
    generatePDF(prepareDownloadData(), columns, 'Compliance Certificates Report', 'compliance-report');
  };

  const handleDownloadCSV = () => {
    const columns = [
      { header: 'Certificate Type', key: 'certificateType' },
      { header: 'Property', key: 'propertyName' },
      { header: 'Issue Date', key: 'issueDate' },
      { header: 'Expiry Date', key: 'expiryDate' },
      { header: 'Status', key: 'status' },
      { header: 'Issued By', key: 'issuedBy' }
    ];
    generateCSV(prepareDownloadData(), columns, 'compliance-report');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6 font-sans text-slate-700">
      <div className="w-[90%] max-w-[1800px] mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Compliance</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <span>Operations Hub</span> <span>&gt;</span> <span className="text-slate-900 font-medium">Compliance</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DownloadDropdown onDownloadPDF={handleDownloadPDF} onDownloadCSV={handleDownloadCSV} />
            <button onClick={() => openModal('create')} className="bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-md font-medium shadow-sm flex items-center gap-2">
              <Plus size={18} /> Add Certificate
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-5 mb-8">
          <StatCard colorBg="bg-green-500" icon={<CheckCircle />} title="Valid Certificates" value={stats.valid_count ?? 0} />
          <StatCard colorBg="bg-[#e77a40]" icon={<AlertTriangle />} title="Expiring Soon" value={stats.expiring_count ?? 0} />
          <StatCard colorBg="bg-pink-500" icon={<XCircle />} title="Expired" value={stats.expired_count ?? 0} />
        </div>

        {/* Toolbar */}
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-3">
          <div className="px-4 font-bold text-slate-700 hidden md:block">Certificates</div>
          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
          
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search certificates..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 focus:ring-0 rounded-md"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto p-1">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-600 text-sm rounded px-3 py-2">
              <option value="all">All Status</option>
              <option value="valid">Valid</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
            </select>
            <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-600 text-sm rounded px-3 py-2">
              <option value="all">All Properties</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading certificates...</div>
          ) : filteredCertificates.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">No certificates found matching your criteria.</div>
          ) : (
            filteredCertificates.map((c) => {
              const status = c.status || computeStatusFromExpiry(c.expiry_date);
              const hasDocument = !!(
                c.document_data ||
                c.document_name ||
                c.document_mime ||
                c.file_path
              );
              return (
                <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-slate-800">{c.certificate_type}</h3>
                        <StatusBadge status={status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-3">
                        <div className="flex items-center gap-1.5"><FileText size={14} /> <span>{c.hotel_name || "Unknown Property"}</span></div>
                        <div className="flex items-center gap-1.5"><CheckCircle size={14} /> <span>Issued: {formatLongDate(c.issue_date)}</span></div>
                        <div className="flex items-center gap-1.5"><AlertTriangle size={14} /> <span>Expires: {formatLongDate(c.expiry_date)}</span></div>
                      </div>
                      <div className="text-sm text-slate-500 mt-2">
                        <span className="opacity-70">Issued by: </span> <span className="font-medium text-slate-600">{c.issued_by}</span>
                      </div>
                    </div>

                    {/* MODIFIED ACTION BUTTONS */}
                    <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                      {hasDocument && (
                        <button
                          onClick={() => {
                            try {
                              window.open(`/api/compliance/${c.id}/document`, '_blank');
                            } catch {}
                          }}
                          className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                          title="View Document"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      )}
                      <button onClick={() => openModal('view', c)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors" title="View Details">
                        <Eye className="w-5 h-5" /> {/* Increased size to w-5 h-5 */}
                      </button>
                      <button onClick={() => openModal('edit', c)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors" title="Edit">
                        <Edit className="w-5 h-5" /> {/* Standardized style and increased size */}
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                         <Trash2 className="w-5 h-5" /> {/* Replaced text button with SVG, increased size, added red hover */}
                      </button>
                    </div>
                    {/* END MODIFIED ACTION BUTTONS */}

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal and Dialogs remain unchanged below */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
              <div className="flex justify-between items-start p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{viewMode ? "View Certificate" : isEditing ? "Edit Certificate" : "Add Certificate"}</h2>
                  <p className="text-sm text-slate-500 mt-1">Form for recording compliance certificates and documentation</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={submitCertificate} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {formError && <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">{formError}</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Type <span className="text-red-500">*</span></label>
                    <select value={form.certificate_type} onChange={(e) => setForm({ ...form, certificate_type: e.target.value })} disabled={viewMode} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none">
                      <option value="">Select certificate type</option>
                      {CERTIFICATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
                    <select value={form.property_id} onChange={(e) => {
                      const nextPropertyId = e.target.value;
                      setForm({ ...form, property_id: nextPropertyId, issued_by: '' });
                      setStaffUsers([]);
                      if (nextPropertyId) fetchStaffForHotel(nextPropertyId);
                    }} disabled={viewMode} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none">
                      <option value="">Select property</option>
                      {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Number</label>
                    <input value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} disabled={viewMode} placeholder="Reference number" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issued By</label>
                    <select
                      value={form.issued_by}
                      onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
                      disabled={viewMode || !form.property_id || staffLoading}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!form.property_id
                          ? "Select property first"
                          : staffLoading
                          ? "Loading staff..."
                          : "Select staff"}
                      </option>
                      {!!form.issued_by && !staffUsers.some((u) => String(u.name) === String(form.issued_by)) && (
                        <option value={form.issued_by}>{form.issued_by}</option>
                      )}
                      {staffUsers.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date <span className="text-red-500">*</span></label>
                    <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} disabled={viewMode} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date <span className="text-red-500">*</span></label>
                    <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} disabled={viewMode} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={viewMode} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none">
                      <option value="valid">Valid</option>
                      <option value="expiring-soon">Expiring Soon</option>
                      <option value="expired">Expired</option>
                      <option value="pending-renewal">Pending Renewal</option>
                    </select>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Document</label>
                   <input
                     type="file"
                     accept="application/pdf,image/*"
                     disabled={viewMode}
                     onChange={(e) => {
                       const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                       setDocumentFile(f);
                     }}
                     className="hidden"
                     id="certificate-document-input"
                   />
                   <label
                     htmlFor={viewMode ? undefined : "certificate-document-input"}
                     className={`border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center transition ${viewMode ? 'cursor-default opacity-80' : 'cursor-pointer hover:border-emerald-400'}`}
                   >
                     <Download className="text-gray-400 mb-2" />
                     <p className="text-sm text-gray-500">{documentFile ? documentFile.name : "Click to upload files (PDF preferred)"}</p>
                     {!viewMode && isEditing && !documentFile && editId && (
                       <button
                         type="button"
                         onClick={() => {
                           try {
                             window.open(`/api/compliance/${editId}/document`, '_blank');
                           } catch {}
                         }}
                         className="mt-2 text-xs text-teal-600 hover:text-teal-700"
                       >
                         View existing document
                       </button>
                     )}
                   </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-lg border text-sm text-slate-600 hover:bg-gray-50">{viewMode ? "Close" : "Cancel"}</button>
                  {!viewMode && (
                    <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg bg-teal-400 hover:bg-teal-500 text-white text-sm font-medium shadow-sm">
                      {submitting ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update" : "Create")}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
        />

        <AlertDialog
          isOpen={alertDialog.isOpen}
          onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
          title={alertDialog.title}
          message={alertDialog.message}
          type={alertDialog.type}
        />
      </div>
    </div>
  );
}