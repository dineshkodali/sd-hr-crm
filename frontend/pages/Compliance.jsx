/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
// Ensure you have these icons installed: npm install lucide-react
import {
    Download, Eye, Trash2, Edit, Plus, Search, FileText,
    CheckCircle, AlertTriangle, XCircle, ChevronDown, Filter, Building
} from "lucide-react";
// You can keep your utils imports if they exist, or mock them if needed for UI only
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import Breadcrumbs from "../components/Breadcrumbs";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'compliance-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes complianceSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      tr.compliance-deleting {
        animation: complianceSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

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
                className="bg-teal-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-colors"
            >
                <Download size={18} />
                <span>Download</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                    <button
                        onClick={() => { onDownloadCSV(); setIsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 flex items-center gap-2 rounded-xl"
                    >
                        <FileText size={14} className="text-teal-500" /> Download CSV
                    </button>
                    <button
                        onClick={() => { onDownloadPDF(); setIsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 flex items-center gap-2 rounded-xl"
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

/* Helper for View Details */
const DetailField = ({ label, value, fullWidth = false }) => (
    <div className={fullWidth ? "md:col-span-2" : ""}>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
        <p className="text-gray-900 font-medium">{value || '-'}</p>
    </div>
);

// --- UI Components ---
function StatCard({ colorBg, colorText, icon, title, value }) {
    return (
        <div className="bg-white rounded-xl p-5 flex items-center gap-4 flex-1 min-w-[240px] border border-gray-100 transition-all duration-200">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorBg} ${colorText} shrink-0`}>
                {React.cloneElement(icon, { size: 28 })}
            </div>
            <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{title}</div>
                <div className="text-2xl font-black text-slate-800 leading-none">{value}</div>
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

    // Image gallery hook — opens in-page modal instead of new tab
    const { galleryOpen: compGalleryOpen, galleryItems: compGalleryItems, galleryTitle: compGalleryTitle, galleryApi: compGalleryApi, openGallery: compOpenGallery, closeGallery: compCloseGallery } = useImageGallery();
    const openAttachmentsGallery = (items = []) => {
        if (!items.length) return;
        compOpenGallery(items, "Compliance Documents", "/api/compliance/attachments");
    };

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
    const [activeCertificate, setActiveCertificate] = useState(null);
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
        issue_date: getTodayYMD(),
        expiry_date: getTodayYMD(1),
        issued_by: currentUser?.name || "",
        status: "valid",
        notes: "",
    });

    const [customColumns, setCustomColumns] = useState([]);
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});
    const [availableColumns, setAvailableColumns] = useState([]);

    // Track rows currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());

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

    // If custom columns arrive after opening edit/view, hydrate them from the selected record
    useEffect(() => {
        if (!modalOpen) return;
        if (!activeCertificate) return;
        if (!customColumns.length) return;
        if (!isEditing && !viewMode) return;

        setForm((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const col of customColumns) {
                if (!(col in next) || next[col] === '' || next[col] === null || next[col] === undefined) {
                    if (activeCertificate[col] !== undefined && activeCertificate[col] !== null) {
                        next[col] = activeCertificate[col];
                    } else if (!(col in next)) {
                        next[col] = '';
                    }
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [customColumns, modalOpen, activeCertificate, isEditing, viewMode]);

    const fetchAvailableColumns = async () => {
        try {
            const res = await api.get('/api/forms-builder/tables/certificates/columns');
            const columns = res?.data?.columns || res?.data || [];
            const systemColumns = [
                'id', 'certificate_type', 'property_id', 'hotel_id', 'certificate_number',
                'issue_date', 'expiry_date', 'issued_by', 'status', 'notes',
                'created_at', 'updated_at', 'document_data', 'document_name', 'document_mime',
                'file_path', 'hotel_name', 'property_name', 'is_active', 'created_by', 'attachments'
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
        const isModalOpen = modalOpen || confirmDialog.isOpen || taskModalOpen;
        if (isModalOpen) {
            document.body.classList.add('form-modal-open');
        } else {
            document.body.classList.remove('form-modal-open');
        }
        return () => {
            document.body.classList.remove('form-modal-open');
        };
    }, [modalOpen, confirmDialog.isOpen, taskModalOpen]);

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
            issue_date: getTodayYMD(), expiry_date: getTodayYMD(1),
            issued_by: currentUser?.name || "",
            status: "valid", notes: "",
            ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
        });
        setStaffUsers([]); setDocumentFile(null); setFormError(""); setIsEditing(false); setViewMode(false); setEditId(null); setActiveCertificate(null);
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

    const openModal = (mode, cert = null) => {
        if (mode === 'create') {
            resetForm();
            setForm(prev => ({ ...prev, issued_by: currentUser?.name || "" }));
            setIsEditing(false); setViewMode(false); setActiveCertificate(null);
        } else if (mode === 'edit') {
            setActiveCertificate(cert);
            setForm({
                certificate_type: cert.certificate_type ?? "",
                property_id: cert.property_id ?? cert.hotel_id ?? "",
                issue_date: toInputYMD(cert.issue_date) || "",
                expiry_date: toInputYMD(cert.expiry_date) || "",
                issued_by: cert.issued_by ?? "",
                status: cert.status ?? "valid",
                notes: cert.notes ?? "",
                ...customColumns.reduce((acc, col) => ({ ...acc, [col]: cert[col] || '' }), {})
            });
            setEditId(cert.id); setIsEditing(true); setViewMode(false);
            if (cert.property_id ?? cert.hotel_id) fetchStaffForHotel(cert.property_id ?? cert.hotel_id);
        } else { // mode === 'view'
            setActiveCertificate(cert);
            setForm({
                certificate_type: cert.certificate_type ?? "",
                property_id: cert.property_id ?? cert.hotel_id ?? "",
                issue_date: toInputYMD(cert.issue_date) || "",
                expiry_date: toInputYMD(cert.expiry_date) || "",
                issued_by: cert.issued_by ?? "",
                status: cert.status ?? "valid",
                notes: cert.notes ?? "",
                ...customColumns.reduce((acc, col) => ({ ...acc, [col]: cert[col] || '' }), {})
            });
            setEditId(cert.id); setIsEditing(false); setViewMode(true);
            if (cert.property_id ?? cert.hotel_id) fetchStaffForHotel(cert.property_id ?? cert.hotel_id);
        }
        setModalOpen(true);
    };

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

        const missing = [];
        if (!String(form.certificate_type || '').trim()) missing.push('Certificate Type');
        if (!String(form.property_id || '').trim()) missing.push('Property');
        if (!String(form.status || '').trim()) missing.push('Status');
        if (!String(form.issue_date || '').trim()) missing.push('Issue Date');
        if (!String(form.expiry_date || '').trim()) missing.push('Expiry Date');
        if (!String(form.issued_by || '').trim()) missing.push('Issued By');
        if (!String(form.notes || '').trim()) missing.push('Notes');

        for (const col of customColumns || []) {
            const meta = customColumnMetadata[col] || {};
            const inputType = meta.input_type || 'text';
            const v = form[col];
            if (inputType === 'checkbox') {
                if (v !== 'true' && v !== 'false') missing.push(col.replace(/_/g, ' '));
            } else if (v === undefined || v === null || String(v).trim() === '') {
                missing.push(col.replace(/_/g, ' '));
            }
        }

        if (missing.length) {
            setFormError(`Please fill required fields: ${missing.join(', ')}.`);
            setSubmitting(false);
            return;
        }

        const payload = {
            ...form,
            [PROPERTY_FIELD]: selectedHotelId,
            hotel_id: selectedHotelId,
            hotel_name: hotelName,
            certificate_type: clean(form.certificate_type),
            ...Object.fromEntries(customColumns.map(col => {
                const meta = customColumnMetadata[col] || {};
                const inputType = meta.input_type || 'text';
                if (inputType === 'checkbox') {
                    const v = form[col];
                    if (v === true || String(v).toLowerCase() === 'true' || String(v) === 'true') return [col, true];
                    if (v === false || String(v).toLowerCase() === 'false' || String(v) === 'false') return [col, false];
                    return [col, null];
                }
                return [col, clean(form[col])];
            }))
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
                try {
                    const id = c.id;
                    setDeletingIds(prev => new Set(prev).add(id));
                    setConfirmDialog(p => ({ ...p, isOpen: false }));

                    const ANIM_DURATION = 460;
                    setTimeout(() => {
                        setCertificates((p) => p.filter((x) => String(x.id) !== String(id)));
                        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    }, ANIM_DURATION);

                    await api.delete(`/api/compliance/${c.id}`);
                    fetchStats();
                }
                catch (err) {
                    setDeletingIds(prev => { const next = new Set(prev); next.delete(c?.id); return next; });
                    setConfirmDialog(p => ({ ...p, isOpen: false }));
                    setAlertDialog({ isOpen: true, title: 'Error', message: 'Could not delete', type: 'error' });
                }
            }
        });
    };

    const EXPORT_COLUMNS = useMemo(() => {
        const base = [
            { header: 'Certificate Type', key: 'certificate_type' },
            { header: 'Property', key: 'hotel_name' },
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
        <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">

                {/* Header Section */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Breadcrumbs items={[{ label: 'Property', path: '/admin/hotels' }, { label: 'Compliance', path: '/admin/compliance' }]} />
                        <h1 className="text-3xl font-black text-slate-900 mt-1">Compliance Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <DownloadDropdown onDownloadPDF={handleDownloadPDF} onDownloadCSV={handleDownloadCSV} />
                    </div>
                </div>

                {/* Stats Cards Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard
                        colorBg="bg-emerald-50"
                        colorText="text-emerald-600"
                        icon={<CheckCircle />}
                        title="Valid Certificates"
                        value={stats.valid_count ?? 0}
                    />
                    <StatCard
                        colorBg="bg-orange-50"
                        colorText="text-orange-600"
                        icon={<AlertTriangle />}
                        title="Expiring Soon"
                        value={stats.expiring_count ?? 0}
                    />
                    <StatCard
                        colorBg="bg-pink-50"
                        colorText="text-pink-600"
                        icon={<XCircle />}
                        title="Expired"
                        value={stats.expired_count ?? 0}
                    />
                </div>

                {/* Filter Toolbar Section */}
                <div className="flex flex-col md:flex-row items-center gap-3 mb-6">
                    <div className="flex-1 w-full relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search certificates..."
                            className="w-full h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-4 py-0 leading-none text-sm font-semibold text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[140px]"
                            >
                                <option value="all">All Status</option>
                                <option value="valid">Valid</option>
                                <option value="expiring">Expiring</option>
                                <option value="expired">Expired</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>

                        <div className="relative flex-1 md:flex-none">
                            <Building className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <select
                                value={propertyFilter}
                                onChange={(e) => setPropertyFilter(e.target.value)}
                                className="w-full h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[160px]"
                            >
                                <option value="all">All Properties</option>
                                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>

                        <button
                            onClick={() => openModal('create')}
                            className="h-9 bg-teal-500 text-white px-4 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-colors text-xs whitespace-nowrap"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            <span>Add Certificate</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}

                <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden transition-all duration-200">
                    <div className="min-h-[400px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                                <p className="text-sm font-medium">Loading certificates...</p>

                            </div>
                        ) : filteredCertificates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium">No certificates found matching your criteria.</p>
                                {certificates.length > 0 && (
                                    <p className="text-slate-400 text-sm mt-1">
                                        Try adjusting your filters or search terms.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto relative">
                                <table className="w-full">
                                    <thead className="bg-[var(--bg-primary)]">
                                        <tr className="border-b border-[var(--border-color)]">
                                            <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Type</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Property</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Issued</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Expires</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider sticky right-0 z-10 bg-[var(--bg-primary)]" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-[var(--bg-surface)] divide-y divide-[var(--border-color)]">
                                        {filteredCertificates.map((c) => {
                                            const status = c.status || computeStatusFromExpiry(c.expiry_date);
                                            const hasDocument = !!(c.document_data || c.document_name || c.file_path);
                                            const isDeleting = deletingIds.has(c.id);
                                            return (
                                                <tr key={c.id} className={`transition-colors group ${isDeleting ? 'compliance-deleting' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="text-sm font-semibold text-[var(--text-primary)]">{c.certificate_type}</span>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-xl border border-[var(--border-color)]">
                                                                <Building size={14} />
                                                            </div>
                                                            <span className="text-sm text-[var(--text-secondary)] font-medium">{c.hotel_name || "Unknown Property"}</span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <StatusBadge status={status} />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)] font-medium">
                                                        {formatLongDate(c.issue_date)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)] font-medium">
                                                        {formatLongDate(c.expiry_date)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right sticky right-0 z-10 bg-[var(--bg-surface)]" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                        <div className="flex items-center justify-end gap-1 transition-opacity">
                                                            {hasDocument && (
                                                                <button
                                                                    onClick={() => openAttachmentsGallery([`/api/compliance/${c.id}/document`])}
                                                                    className="p-1.5 text-teal-600 bg-teal-50 rounded-xl transition-colors hover:bg-teal-100"
                                                                    title="View Document"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => openModal('view', c)}
                                                                className="p-1.5 text-slate-400 rounded-xl transition-colors"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openModal('edit', c)}
                                                                className="p-1.5 text-slate-400 rounded-xl transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(c)}
                                                                className="p-1.5 text-slate-400 rounded-xl transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            {canCreateTasks && (
                                                                <button
                                                                    onClick={() => openTaskModalForCertificate(c)}
                                                                    className="p-1.5 text-slate-400 rounded-xl transition-colors"
                                                                    title="Create Task"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {taskModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative flex flex-col h-[70vh]">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Create Task</h2>
                                    <p className="text-sm text-slate-500 mt-0.5">Create a compliance renewal task</p>
                                </div>
                                <button onClick={() => setTaskModalOpen(false)} className="text-slate-400 rounded-full p-2 transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <form id="compliance-task-form" onSubmit={submitTask} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                                {taskError && (
                                    <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2 border border-red-100">
                                        <AlertTriangle size={16} /> {taskError}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        value={taskForm.title}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                        <select
                                            value={taskForm.priority}
                                            onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
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
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
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
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                                        <input
                                            type="date"
                                            value={taskForm.scheduled_date || ""}
                                            onChange={(e) => setTaskForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        rows={6}
                                        value={taskForm.description}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                                    />
                                </div>

                            </form>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    onClick={() => setTaskModalOpen(false)}
                                    className="btn-secondary rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="compliance-task-form"
                                    disabled={taskSubmitting}
                                    className="rounded-xl btn-primary"
                                >
                                    {taskSubmitting ? "Creating..." : "Create Task"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Logic (Same as before but styled) */}
                {
                    modalOpen && (
                        <div className="modal-overlay">
                            <div className="modal-container h-[70vh]">
                                <div className="modal-header">
                                    <div>
                                        <h2 className="modal-title">
                                            {viewMode ? "Certificate Details" : isEditing ? "Edit Certificate" : "New Certificate"}
                                        </h2>
                                        <p className="modal-subtitle">
                                            {viewMode ? "View compliance certificate information" : "Enter certificate details and compliance info"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setModalOpen(false)}
                                        className="modal-close-btn rounded-xl"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                {viewMode ? (
                                    <div className="modal-content text-left">
                                        <div className="form-grid-2">
                                            <DetailField label="Certificate Type" value={form.certificate_type} />
                                            <DetailField
                                                label="Property"
                                                value={hotels.find((h) => String(h.id) === String(form.property_id))?.name || 'N/A'}
                                            />
                                            <DetailField label="Status" value={form.status} />
                                            <DetailField label="Issue Date" value={formatLongDate(form.issue_date)} />
                                            <DetailField label="Expiry Date" value={formatLongDate(form.expiry_date)} />
                                            <DetailField label="Issued By" value={form.issued_by} />

                                            {customColumns.map(col => {
                                                const meta = customColumnMetadata[col] || {};
                                                const inputType = meta.input_type || 'text';
                                                let val = form[col];
                                                if (inputType === 'checkbox') {
                                                    val = (val === true || String(val) === 'true') ? 'Yes' : (val === false || String(val) === 'false') ? 'No' : '-';
                                                } else if (inputType === 'date' && val) {
                                                    val = formatLongDate(val);
                                                }
                                                return (
                                                    <DetailField
                                                        key={col}
                                                        label={col.replace(/_/g, ' ').toUpperCase()}
                                                        value={String(val || '-')}
                                                        fullWidth={inputType === 'textarea'}
                                                    />
                                                );
                                            })}
                                            <DetailField label="Notes" value={form.notes} fullWidth={true} />

                                            {documentFile || certificates.find(c => c.id === editId)?.document_name ? (
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Document</label>
                                                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="bg-teal-100 text-teal-600 p-2 rounded-lg">
                                                            <FileText size={20} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 truncate">
                                                                {documentFile ? documentFile.name : certificates.find(c => c.id === editId)?.document_name || "certificate.pdf"}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openAttachmentsGallery([`/api/compliance/${editId}/document`])}
                                                            className="inline-flex items-center gap-2 text-xs font-bold text-teal-600 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition-all shadow-sm"
                                                        >
                                                            <Eye size={14} />
                                                            <span>VIEW DOCUMENT</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <form id="compliance-certificate-form" onSubmit={submitCertificate} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                                        {formError && <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2 border border-red-100"><AlertTriangle size={16} /> {formError}</div>}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Form fields here */}
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Certificate Type <span className="text-red-500">*</span></label>
                                                <select required value={form.certificate_type} onChange={handleCertificateTypeChange} className="w-full border border-gray-300 rounded-xl -xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                    <option value="">Select type...</option>
                                                    {[...CERTIFICATE_TYPES, ...customCertificateTypes].map((t) => <option key={t} value={t}>{t}</option>)}
                                                    {!!form.certificate_type &&
                                                        ![...CERTIFICATE_TYPES, ...customCertificateTypes].some((t) => String(t) === String(form.certificate_type)) && (
                                                            <option value={form.certificate_type}>{form.certificate_type}</option>
                                                        )}
                                                    <option value="__add_new__">+ Add new...</option>
                                                </select>
                                                {showCustomCertificateTypeInput && (
                                                    <div className="mt-3 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={customCertificateTypeValue}
                                                            onChange={(e) => setCustomCertificateTypeValue(e.target.value)}
                                                            placeholder="Enter new certificate type"
                                                            className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={saveCustomCertificateType}
                                                            className="px-4 py-2.5 rounded-xl -xl bg-teal-500 text-white font-medium shadow-sm transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowCustomCertificateTypeInput(false);
                                                                setCustomCertificateTypeValue('');
                                                            }}
                                                            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                                                <select required value={form.property_id} onChange={(e) => { const pid = e.target.value; setForm({ ...form, property_id: pid }); if (pid) fetchStaffForHotel(pid); }} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                    <option value="">Select property...</option>
                                                    {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status <span className="text-red-500">*</span></label>
                                                <select required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                    <option value="valid">Valid</option>
                                                    <option value="expiring-soon">Expiring Soon</option>
                                                    <option value="expired">Expired</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Issue Date <span className="text-red-500">*</span></label>
                                                <input required type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Expiry Date <span className="text-red-500">*</span></label>
                                                <input required type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Issued By <span className="text-red-500">*</span></label>
                                                <input
                                                    readOnly
                                                    type="text"
                                                    value={form.issued_by}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-slate-50 cursor-not-allowed text-slate-500"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes <span className="text-red-500">*</span></label>
                                                <textarea
                                                    required
                                                    rows={3}
                                                    value={form.notes}
                                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                />
                                            </div>
                                            {/* Custom columns */}
                                            {customColumns.map(col => {
                                                const meta = customColumnMetadata[col] || {};
                                                const inputType = meta.input_type || 'text';
                                                const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                                                return (
                                                    <div key={col} className={inputType === 'textarea' ? "md:col-span-2" : ""}>
                                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                            {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} <span className="text-red-500">*</span>
                                                        </label>
                                                        {inputType === 'checkbox' ? (
                                                            <select
                                                                required
                                                                value={form[col] === true ? 'true' : form[col] === false ? 'false' : (form[col] || '')}
                                                                onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                            >
                                                                <option value="">Select...</option>
                                                                <option value="true">Yes</option>
                                                                <option value="false">No</option>
                                                            </select>
                                                        ) : inputType === 'dropdown' || inputType === 'select' ? (
                                                            <select
                                                                required
                                                                value={form[col] || ''}
                                                                onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                                            >
                                                                <option value="">Select...</option>
                                                                {options.map((opt, idx) => (
                                                                    <option key={idx} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        ) : inputType === 'textarea' ? (
                                                            <textarea
                                                                required
                                                                rows={3}
                                                                value={form[col] || ''}
                                                                onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                            />
                                                        ) : inputType === 'date' ? (
                                                            <input
                                                                type="date"
                                                                required
                                                                value={form[col] ? toInputYMD(form[col]) : ''}
                                                                onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                            />
                                                        ) : (
                                                            <input
                                                                type={inputType}
                                                                required
                                                                value={form[col] || ''}
                                                                onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                                                                placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* File Upload Section */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Document</label>
                                            <label className={`border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer`}>
                                                <input type="file" className="rounded-xl hidden" onChange={(e) => setDocumentFile(e.target.files?.[0])} accept="application/pdf,image/*" />
                                                <div className="bg-teal-100 text-teal-600 p-3 rounded-full mb-3"><Download size={24} /></div>
                                                <p className="text-sm font-medium text-slate-700">{documentFile ? documentFile.name : "Click to upload certificate (PDF/Image)"}</p>
                                                <p className="text-xs text-slate-400 mt-1">Max file size 10MB</p>
                                            </label>
                                        </div>
                                    </form>
                                )}

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="btn-secondary btn-sm rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    {!viewMode && (
                                        <button
                                            type="submit"
                                            form="compliance-certificate-form"
                                            disabled={submitting}
                                            className="rounded-xl btn-primary btn-sm"
                                        >
                                            {submitting ? "Saving..." : "Save Certificate"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} />
                <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(p => ({ ...p, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
                <ImageGalleryModal open={compGalleryOpen} onClose={compCloseGallery} items={compGalleryItems} title={compGalleryTitle} apiBase={compGalleryApi} />
            </div >
        </div >
    );
}