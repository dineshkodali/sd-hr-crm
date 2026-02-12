/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
import { AlertModal, ConfirmModal } from "../components/ModalDialogs";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
  Home,
  ClipboardList,
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
  Zap,
  Check
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

const inspectionsColumnsCache = {
  ts: 0,
  columns: null,
};

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

/* axios instance (matches your other pages) */
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

/* Helper functions */
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
  if (low === "completed" || low === "resolved") return { dot: "bg-green-500", text: "text-green-700" };
  if (low === "pending" || low === "open") return { dot: "bg-orange-500", text: "text-orange-700" };
  if (low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
  return { dot: "bg-gray-500", text: "text-gray-700" };
}

function getAvatarColor(name) {
  return "bg-teal-100 text-teal-700";
}

function normalizeColumnDataType(dt) {
  const t = String(dt || "").toLowerCase();
  if (!t) return "text";
  if (t.includes("int") || t.includes("numeric") || t.includes("decimal") || t.includes("real") || t.includes("double") || t.includes("float")) return "number";
  if (t.includes("bool")) return "boolean";
  if (t === "date") return "date";
  if (t.includes("timestamp") || t.includes("time")) return "datetime";
  return "text";
}

function typeLabel(t) {
  if (t === "number") return "number";
  if (t === "boolean") return "boolean (true/false)";
  if (t === "date") return "date (YYYY-MM-DD)";
  if (t === "datetime") return "date-time";
  return "text";
}

function validateValueByType(value, t) {
  if (value === null || value === undefined || value === "") return null;
  if (t === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? null : `Please enter the correct type of data (${typeLabel(t)})`;
  }
  if (t === "boolean") {
    if (typeof value === "boolean") return null;
    const v = String(value).toLowerCase().trim();
    if (["true", "false", "1", "0", "yes", "no"].includes(v)) return null;
    return `Please enter the correct type of data (${typeLabel(t)})`;
  }
  if (t === "date") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? `Please enter the correct type of data (${typeLabel(t)})` : null;
  }
  if (t === "datetime") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? `Please enter the correct type of data (${typeLabel(t)})` : null;
  }
  return null;
}

/* helper for normalizing hotels responses */
function normalizeHotelsResponse(data) {
  if (!data) return [];
  let items = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data.data)) items = data.data;
  else if (Array.isArray(data.rows)) items = data.rows;
  else if (Array.isArray(data.hotels)) items = data.hotels;
  else if (typeof data === "object") {
    const vals = Object.values(data);
    const possibleObjects = vals.filter((v) => v && (v.id || v.name || v.hotel_name));
    if (possibleObjects.length && !Array.isArray(data)) {
      items = Array.isArray(possibleObjects[0]) ? possibleObjects[0] : possibleObjects;
    }
  }
  return items
    .map((h) => {
      const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;
      const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ""}`;
      const address = h?.address ?? null;
      return { id, name, address };
    })
    .filter((x) => x.id && x.name);
}

/* format date like "Feb 8, 2025" */
function formatDate(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

/* Helper for View Details */
const DetailField = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
    <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
  </div>
);

export default function Inspections({ user }) {
  // Get user from localStorage if not passed as prop
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for inspections module
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("inspections");
  const hasCreate = canCreate("inspections");
  const hasUpdate = canUpdate("inspections");
  const hasDelete = canDelete("inspections");

  const [inspections, setInspections] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const staffCacheRef = useRef({});
  const staffAbortRef = useRef(null);

  // Modals State
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingInspection, setViewingInspection] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedExportKeys, setSelectedExportKeys] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [query, setQuery] = useState("");

  // Filter and Sort State
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [sortBy, setSortBy] = useState("");

  // View Dropdown State
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'

  const hotelsControllerRef = useRef(null);
  const viewRef = useRef(null);

  // Custom columns from Forms Builder
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnTypes, setCustomColumnTypes] = useState({});
  const [customColumnMetadata, setCustomColumnMetadata] = useState({});
  // ...existing code...
  const [availableColumns, setAvailableColumns] = useState(["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "actions"]);

  const BASE_EXPORT_COLUMNS = useMemo(
    () => [
      { header: 'Inspection Type', key: 'inspectionType' },
      { header: 'Property', key: 'propertyName' },
      { header: 'Inspector', key: 'inspectorName' },
      { header: 'Date', key: 'inspectionDate' },
      { header: 'Status', key: 'status' },
      { header: 'Issues Found', key: 'issuesFound' },
      { header: 'Action Required', key: 'actionRequired' }
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

  const [formData, setFormData] = useState({
    inspectionType: "",
    propertyId: "",
    propertyName: "",
    serviceUserId: "",
    serviceUserName: "",
    inspectorName: "",
    inspectionDate: "",
    findings: "",
    issuesFound: 0,
    actionRequired: false,
    status: "pending",
    ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
  });

  const INSPECTION_TYPE_STORAGE_KEY = 'inspections.customInspectionTypes';
  const BUILTIN_INSPECTION_TYPES = [
    'Fire Safety',
    'Room Inspection',
    'Welfare Check',
    'Routine',
    'Emergency',
  ];

  const [customInspectionTypes, setCustomInspectionTypes] = useState([]);
  const [showCustomInspectionTypeInput, setShowCustomInspectionTypeInput] = useState(false);
  const [customInspectionTypeValue, setCustomInspectionTypeValue] = useState('');

  useEffect(() => {
    if (!showModal) {
      setShowCustomInspectionTypeInput(false);
      setCustomInspectionTypeValue('');
    }
  }, [showModal]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSPECTION_TYPE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomInspectionTypes(parsed.filter(Boolean).map(String));
      }
    } catch {
      setCustomInspectionTypes([]);
    }
  }, []);

  const persistCustomInspectionTypes = (list) => {
    try {
      localStorage.setItem(INSPECTION_TYPE_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore storage errors
    }
  };

  const handleInspectionTypeChange = (e) => {
    const value = e.target.value;
    if (value === '__add_new__') {
      setShowCustomInspectionTypeInput(true);
      setCustomInspectionTypeValue('');
      setFormData((p) => ({ ...p, inspectionType: '' }));
      return;
    }
    setShowCustomInspectionTypeInput(false);
    setCustomInspectionTypeValue('');
    setFormData((p) => ({ ...p, inspectionType: value }));
  };

  const saveCustomInspectionType = () => {
    const next = String(customInspectionTypeValue || '').trim();
    if (!next) return;

    const builtinLower = new Set(BUILTIN_INSPECTION_TYPES.map((t) => String(t).toLowerCase()));
    const merged = [...customInspectionTypes];
    if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
      merged.push(next);
      setCustomInspectionTypes(merged);
      persistCustomInspectionTypes(merged);
    }

    setFormData((p) => ({ ...p, inspectionType: next }));
    setShowCustomInspectionTypeInput(false);
    setCustomInspectionTypeValue('');
  };

  // When customColumns change, add new fields to form state
  useEffect(() => {
    setFormData(prev => {
      const newForm = { ...prev };
      customColumns.forEach(col => {
        if (!(col in newForm)) newForm[col] = '';
      });
      return newForm;
    });
  }, [customColumns]);

  const stats = {
    total: inspections.length,
    pending: inspections.filter((i) => i.status === "pending").length,
    completed: inspections.filter((i) => i.status === "completed").length,
    actionRequired: inspections.filter((i) => !!(i.actionRequired ?? i.action_required)).length,
  };

  // ...existing code...

  // Column visibility state - default columns visible, custom columns from localStorage or hidden
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('inspectionsVisibleColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
      }
    } catch (e) {
      console.error('Error loading column visibility:', e);
    }
    return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
  });

  // Fetch available columns from the database
  const fetchAvailableColumns = async () => {
    try {
      const now = Date.now();
      if (inspectionsColumnsCache.columns && now - inspectionsColumnsCache.ts < 60_000) {
        const cachedColumns = inspectionsColumnsCache.columns;
        const columns = cachedColumns?.columns || cachedColumns || [];

        // System and known inspection columns to exclude
        const systemColumns = [
          'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
          'inspection_type', 'property_id', 'property_name', 'service_user_id',
          'service_user_name', 'inspector_name', 'inspection_date', 'findings',
          'issues_found', 'action_required', 'status', 'priority', 'assigned_to'
        ];

        const customCols = (Array.isArray(columns) ? columns : [])
          .filter(col => !systemColumns.includes(col.column_name) && !DEFAULT_COLUMNS.includes(col.column_name))
          .map(col => col.column_name);

        const nextTypes = {};
        (Array.isArray(columns) ? columns : []).forEach((col) => {
          const name = col?.column_name;
          if (!name) return;
          nextTypes[name] = normalizeColumnDataType(col?.data_type ?? col?.udt_name ?? col?.type);
        });

        const nextMetadata = {};
        (Array.isArray(columns) ? columns : []).forEach((col) => {
          const name = col?.column_name;
          if (!name) return;
          nextMetadata[name] = {
            input_type: col.input_type || 'text',
            input_options: col.input_options || []
          };
        });

        const newColumns = [...DEFAULT_COLUMNS.slice(0, -1), ...customCols, DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]];

        setCustomColumns(prevCols => {
          if (JSON.stringify(customCols) !== JSON.stringify(prevCols)) {
            setCustomColumnTypes((prev) => ({ ...prev, ...nextTypes }));
            setCustomColumnMetadata((prev) => ({ ...prev, ...nextMetadata }));
            setAvailableColumns(newColumns);
            return customCols;
          }
          setCustomColumnTypes((prev) => ({ ...prev, ...nextTypes }));
          setCustomColumnMetadata((prev) => ({ ...prev, ...nextMetadata }));
          return prevCols;
        });
        return;
      }

      const res = await api.get('/api/forms-builder/tables/inspections/columns', { timeout: 60000 });
      const columns = res?.data?.columns || res?.data || [];

      inspectionsColumnsCache.ts = now;
      inspectionsColumnsCache.columns = columns;

      // System and known inspection columns to exclude
      const systemColumns = [
        'id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by',
        'inspection_type', 'property_id', 'property_name', 'service_user_id',
        'service_user_name', 'inspector_name', 'inspection_date', 'findings',
        'issues_found', 'action_required', 'status', 'priority', 'assigned_to'
      ];

      const customCols = columns
        .filter(col => !systemColumns.includes(col.column_name) && !DEFAULT_COLUMNS.includes(col.column_name))
        .map(col => col.column_name);

      const nextTypes = {};
      (Array.isArray(columns) ? columns : []).forEach((col) => {
        const name = col?.column_name;
        if (!name) return;
        nextTypes[name] = normalizeColumnDataType(col?.data_type ?? col?.udt_name ?? col?.type);
      });

      const nextMetadata = {};
      (Array.isArray(columns) ? columns : []).forEach((col) => {
        const name = col?.column_name;
        if (!name) return;
        nextMetadata[name] = {
          input_type: col.input_type || 'text',
          input_options: col.input_options || []
        };
      });

      // Insert custom columns before "actions" column
      const newColumns = [...DEFAULT_COLUMNS.slice(0, -1), ...customCols, DEFAULT_COLUMNS[DEFAULT_COLUMNS.length - 1]];

      // Always update to ensure we have the latest
      setCustomColumns(prevCols => {
        // Only trigger update if columns actually changed
        if (JSON.stringify(customCols) !== JSON.stringify(prevCols)) {
          setCustomColumnTypes((prev) => ({ ...prev, ...nextTypes }));
          setCustomColumnMetadata((prev) => ({ ...prev, ...nextMetadata }));
          setAvailableColumns(newColumns);

          // Update visible columns - restore from localStorage or default to hidden
          setVisibleColumns(prev => {
            const updated = { ...prev };
            customCols.forEach(col => {
              // Only set visibility if not already in state (truly new column)
              if (prev[col] === undefined) {
                // Check localStorage for this column's visibility
                try {
                  const saved = localStorage.getItem('inspectionsVisibleColumns');
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

          return customCols;
        }
        setCustomColumnTypes((prev) => ({ ...prev, ...nextTypes }));
        setCustomColumnMetadata((prev) => ({ ...prev, ...nextMetadata }));
        return prevCols;
      });
    } catch (err) {
      console.error('Error fetching custom columns:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initial fetch
    fetchAvailableColumns();

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (mounted) {
        fetchAvailableColumns();
      }
    }, 60000); // Check every 60 seconds

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('inspectionsVisibleColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.error('Error saving column visibility:', e);
    }
  }, [visibleColumns]);

  useEffect(() => {
    const ctrl = new AbortController();
    hotelsControllerRef.current = ctrl;
    fetchHotels(ctrl.signal);
    fetchInspections();
    return () => {
      try { ctrl.abort(); } catch { }
      hotelsControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fetch hotels - ignores canceled errors */
  async function fetchHotels(signal) {
    try {
      setHotelsLoading(true);
      const res = await api.get("/api/hotels", { params: { limit: 1000 }, signal });
      const normalized = normalizeHotelsResponse(res?.data ?? {});
      setHotels(normalized);
      if (normalized.length === 1 && !formData.propertyId) {
        setFormData((f) => ({ ...f, propertyId: normalized[0].id, propertyName: normalized[0].name }));
        fetchServiceUsers(normalized[0].id);
      }
    } catch (err) {
      const isCanceled = err && (err.name === "CanceledError" || err.code === "ERR_CANCELED" || axios.isCancel?.(err));
      if (!isCanceled) {
        console.error("fetchHotels error:", err);
        setHotels([]);
      }
    } finally {
      setHotelsLoading(false);
    }
  }

  /* Fetch service users for a given hotel id. */
  async function fetchServiceUsers(hotelId) {
    if (!hotelId) {
      setServiceUsers([]);
      return;
    }

    async function tryPath(path) {
      const r = await api.get(path);
      return r?.data?.data ?? r?.data ?? [];
    }

    try {
      // canonical path used in some apps
      const canonical = `/api/hotels/${hotelId}/service-users`;
      const rows = await tryPath(canonical);
      const normalized = (Array.isArray(rows) ? rows : []).map((r) => ({
        id: r.id,
        first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ""}`
      })).filter(Boolean);
      setServiceUsers(normalized);
      return;
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404) {
        console.error("fetchServiceUsers error (canonical):", err);
        setServiceUsers([]);
        return;
      }
    }

    // Fallbacks
    const fallbacks = [
      `/api/su?hotel_id=${encodeURIComponent(hotelId)}`,
      `/api/su?hotelId=${encodeURIComponent(hotelId)}`,
      `/api/su?hotel=${encodeURIComponent(hotelId)}`,
      `/api/su/${encodeURIComponent(hotelId)}`,
      `/api/service_users?hotel_id=${encodeURIComponent(hotelId)}`,
      `/api/service_users/${encodeURIComponent(hotelId)}`,
    ];

    for (const path of fallbacks) {
      try {
        const rows = await tryPath(path);
        const normalized = (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.id,
          first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ""}`
        })).filter(Boolean);
        if (normalized.length) {
          setServiceUsers(normalized);
          return;
        }
      } catch (err) {
        // ignore
      }
    }

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

  async function fetchInspections() {
    try {
      setLoading(true);
      const res = await api.get("/api/inspections", { params: { limit: 200 } });
      const rows = res?.data?.data ?? res?.data ?? [];
      setInspections(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("fetchInspections error:", err);
      setInspections([]);
      setError("Unable to load inspections. See console for details.");
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e) {
    const { name, type, value, checked } = e.target;
    if (type === "checkbox") {
      setFormData((p) => ({ ...p, [name]: checked }));
      if (customColumnTypes[name] === "boolean") {
        setFieldErrors((prev) => {
          const next = { ...prev };
          const msg = validateValueByType(checked, "boolean");
          if (msg) next[name] = msg;
          else delete next[name];
          return next;
        });
      }
      return;
    }
    if (type === "number") {
      setFormData((p) => ({ ...p, [name]: value === "" ? "" : Number(value) }));
      if (customColumnTypes[name]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          const msg = validateValueByType(value, customColumnTypes[name]);
          if (msg) next[name] = msg;
          else delete next[name];
          return next;
        });
      }
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));

    if (customColumnTypes[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        const msg = validateValueByType(value, customColumnTypes[name]);
        if (msg) next[name] = msg;
        else delete next[name];
        return next;
      });
    }
  }

  async function handlePropertyChange(e) {
    const hotelId = e.target.value;
    const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
    setFormData((prev) => ({
      ...prev,
      propertyId: hotelId,
      propertyName: hotel ? hotel.name : "",
      serviceUserId: "",
      serviceUserName: "",
      inspectorName: currentUser?.name || "", // Set to current user
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
    setFormData((prev) => ({ ...prev, serviceUserId: suId, serviceUserName: su ? su.first_name : "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      setError('Please fix the highlighted fields before saving.');
      return;
    }

    // Check permissions
    if (editingId && !hasUpdate) {
      setError("You don't have permission to update inspections.");
      return;
    }
    if (!editingId && !hasCreate) {
      setError("You don't have permission to create inspections.");
      return;
    }

    if (!formData.inspectionType || !formData.propertyId || !formData.inspectorName || !formData.inspectionDate) {
      setError("Please fill required fields: Inspection Type, Property, Inspector Name, Inspection Date.");
      return;
    }

    setSubmitting(true);

    const payload = {
      inspectionType: formData.inspectionType,
      inspection_type: formData.inspectionType,
      propertyId: formData.propertyId,
      property_id: formData.propertyId,
      property: formData.propertyId,
      propertyName: formData.propertyName,
      property_name: formData.propertyName,
      serviceUserId: formData.serviceUserId || null,
      service_user_id: formData.serviceUserId || null,
      serviceUser: formData.serviceUserName || null,
      service_user: formData.serviceUserName || null,
      inspectorName: formData.inspectorName,
      inspector_name: formData.inspectorName,
      inspectionDate: formData.inspectionDate,
      inspection_date: formData.inspectionDate,
      findings: formData.findings || null,
      issuesFound: Number.isFinite(Number(formData.issuesFound)) ? Number(formData.issuesFound) : 0,
      issues_found: Number.isFinite(Number(formData.issuesFound)) ? Number(formData.issuesFound) : 0,
      actionRequired: !!formData.actionRequired,
      action_required: !!formData.actionRequired,
      status: formData.status || "pending",
    };
    // Add custom column values to payload
    customColumns.forEach(col => {
      const val = formData[col];
      if (val === undefined) return;
      if (typeof val === 'string' && val.trim() === '') return;

      const t = customColumnTypes[col] || "text";
      if (t === "number") {
        payload[col] = Number(val);
        return;
      }
      if (t === "boolean") {
        if (typeof val === "boolean") payload[col] = val;
        else {
          const v = String(val).toLowerCase().trim();
          payload[col] = v === "true" || v === "1" || v === "yes";
        }
        return;
      }
      if (t === "date") {
        payload[col] = formatDateISO(val);
        return;
      }
      payload[col] = val;
    });
    try {
      let res;
      if (editingId) {
        res = await api.put(`/api/inspections/${editingId}`, payload);
      } else {
        res = await api.post("/api/inspections", payload);
      }
      const result = res?.data?.data ?? res?.data ?? null;
      if (result) {
        setInspections((prev) => {
          if (editingId) {
            return prev.map((p) => (String(p.id) === String(editingId) ? result : p));
          }
          return [result, ...prev];
        });
        setShowModal(false);
        setEditingId(null);
        setFormData({
          inspectionType: "",
          propertyId: "",
          propertyName: "",
          serviceUserId: "",
          serviceUserName: "",
          inspectorName: "",
          inspectionDate: "",
          findings: "",
          issuesFound: 0,
          actionRequired: false,
          status: "pending",
        });
      } else {
        setError("Unexpected server response.");
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message;
      console.error("handleSubmit error:", err);
      setError(String(serverMsg || "Submission failed, see console."));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = inspections || [];

    // Apply search filter
    if (q) {
      list = list.filter((r) =>
        (r.inspectionType || r.inspection_type || "").toLowerCase().includes(q) ||
        (r.propertyName || r.property_name || r.property || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q)
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
        String(r.propertyId || r.property_id || "") === String(propertyFilter)
      );
    }

    // Apply sorting
    if (sortBy) {
      list = [...list].sort((a, b) => {
        if (sortBy === 'date') {
          const dateA = new Date(a.inspectionDate || a.inspection_date || 0);
          const dateB = new Date(b.inspectionDate || b.inspection_date || 0);
          return dateB - dateA; // Most recent first
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
        if (sortBy === 'type') {
          const typeA = (a.inspectionType || a.inspection_type || '').toLowerCase();
          const typeB = (b.inspectionType || b.inspection_type || '').toLowerCase();
          return typeA.localeCompare(typeB);
        }
        return 0;
      });
    }

    return list;
  }, [inspections, query, priorityFilter, statusFilter, propertyFilter, sortBy]);

  const normalizeInspectionExportRow = (inspection) => {
    const base = {
      inspectionType: inspection.inspectionType || inspection.inspection_type || 'N/A',
      propertyName: inspection.propertyName || inspection.property_name || inspection.property || 'N/A',
      inspectorName: inspection.inspectorName || inspection.inspector_name || 'N/A',
      inspectionDate: inspection.inspectionDate || inspection.inspection_date || 'N/A',
      status: inspection.status || 'N/A',
      issuesFound: inspection.issuesFound ?? inspection.issues_found ?? 0,
      actionRequired: (inspection.actionRequired || inspection.action_required) ? 'Yes' : 'No',
    };

    for (const col of customColumns || []) {
      base[col] = inspection?.[col] ?? '';
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

      const data = (filtered || []).map(normalizeInspectionExportRow);

      if (exportFormat === 'pdf') {
        generatePDF(data, columns, 'Inspections Report', 'inspections-report');
      } else if (exportFormat === 'csv') {
        generateCSV(data, columns, 'inspections-report');
      }

      closeExport();
    } catch (error) {
      console.error('Error exporting inspections:', error);
      alert('Failed to download: ' + error.message);
    }
  };

  /* Handlers */
  const handleView = (id) => {
    const item = inspections.find((i) => String(i.id) === String(id) || i.reference === id);
    if (item) {
      setViewingInspection(item);
      setShowViewModal(true);
    }
  };

  const handleEdit = (id) => {
    if (!hasUpdate) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: "You don't have permission to edit inspections.",
        type: 'warning'
      });
      return;
    }
    const item = inspections.find((i) => String(i.id) === String(id) || i.reference === id);
    if (!item) return;

    // --- FIX: Resolve Property ID against the available Hotels list ---
    let resolvedPropId = item.propertyId ?? item.property_id;
    let resolvedPropName = item.propertyName ?? item.property_name ?? item.property;

    if (hotels.length > 0) {
      // 1. Try to find match by ID
      let matched = hotels.find(h => String(h.id) === String(resolvedPropId));

      // 2. If ID match fails (or ID missing), try to find by Name
      // (This handles case where item.property is just the name "Hotel X")
      if (!matched && resolvedPropName) {
        matched = hotels.find(h => h.name.toLowerCase() === String(resolvedPropName).toLowerCase());
      } else if (!matched && item.property) {
        // Fallback check against item.property directly
        matched = hotels.find(h => h.name.toLowerCase() === String(item.property).toLowerCase());
      }

      // 3. If match found, ensure we use the correct ID for the select input
      if (matched) {
        resolvedPropId = matched.id;
        resolvedPropName = matched.name;
      }
    }
    // --- END FIX ---

    // populate form with existing values (normalize keys)
    const baseFormData = {
      inspectionType: item.inspectionType ?? item.inspection_type ?? "",
      propertyId: resolvedPropId ?? "", // Use resolved ID
      propertyName: resolvedPropName ?? "",
      serviceUserId: item.serviceUserId ?? item.service_user_id ?? item.service_user ?? "",
      serviceUserName: item.serviceUser ?? item.service_user ?? item.serviceUserName ?? "",
      inspectorName: item.inspectorName ?? item.inspector_name ?? "",
      inspectionDate: (item.inspectionDate ?? item.inspection_date ?? "").toString().substring(0, 10),
      findings: item.findings ?? "",
      issuesFound: item.issuesFound ?? item.issues_found ?? 0,
      actionRequired: !!(item.actionRequired ?? item.action_required),
      status: item.status ?? "pending",
    };
    // Add custom column values
    const customFieldData = {};
    customColumns.forEach(col => {
      customFieldData[col] = item[col] ?? "";
    });
    setFormData({ ...baseFormData, ...customFieldData });
    // fetch service users for property if present
    if (resolvedPropId) fetchServiceUsers(resolvedPropId);
    setEditingId(id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!hasDelete) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: "You don't have permission to delete inspections.",
        type: 'warning'
      });
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Inspection',
      message: 'Delete this inspection? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/api/inspections/${id}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setInspections((prev) => prev.filter((p) => String(p.id) !== String(id)));
        } catch (err) {
          console.error('handleDelete error:', err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: 'Unable to delete inspection. See console for details.',
            type: 'error'
          });
        }
      }
    });
  };

  const openNewInspection = () => {
    if (!hasCreate) {
      alert("You don't have permission to create inspections.");
      return;
    }
    setEditingId(null);
    setFormData({
      inspectionType: "",
      propertyId: "",
      propertyName: "",
      serviceUserId: "",
      serviceUserName: "",
      inspectorName: currentUser?.name || "",
      inspectionDate: "",
      findings: "",
      issuesFound: 0,
      actionRequired: false,
      status: "pending",
    });
    setShowModal(true);
  };

  // Modal states
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: '', message: '', type: 'info' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState({ title: '', message: '' });
  const [confirmAction, setConfirmAction] = useState(null);

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

  // Hide sidebar and navbar when modal is open
  useEffect(() => {
    if (showModal || showViewModal) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showModal, showViewModal]);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Inspections</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Escalations</span>
              <span>&gt;</span>
              <span>Inspections</span>
            </div>
          </div>
          {hasCreate && (
            <button
              onClick={openNewInspection}
              className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>+</span>
              <span>Report Inspection</span>
            </button>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm font-medium mb-1">Total Inspections</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm font-medium mb-1">Open</div>
              <div className="text-2xl font-bold text-slate-900">{stats.pending}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <Zap className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm font-medium mb-1">Action Required</div>
              <div className="text-2xl font-bold text-slate-900">{stats.actionRequired}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm font-medium mb-1">Resolved</div>
              <div className="text-2xl font-bold text-slate-900">{stats.completed}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Enhanced Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {/* Search & Filter Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">All Inspections</h2>
                <p className="text-sm text-gray-500">{stats.total} total records</p>
              </div>
              <div className="flex items-center gap-3">
                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search inspections..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
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
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 animate-in fade-in duration-200">
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
                              <ClipboardList className="w-4 h-4" />
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
                  <>
                    <DownloadDropdown
                      onDownloadPDF={() => openExport('pdf')}
                      onDownloadCSV={() => openExport('csv')}
                    />
                    <button
                      onClick={openNewInspection}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>New Inspection</span>
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

            {/* FILTER DROPDOWNS */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer appearance-none"
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
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer appearance-none"
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
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Sort By</option>
                  <option value="date">Date (Newest)</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="type">Type</option>
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
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    )}
                    {visibleColumns.reference && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Reference</th>
                    )}
                    {visibleColumns.description && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                    )}
                    {visibleColumns.priority && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                    )}
                    {visibleColumns.status && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    )}
                    {visibleColumns.assigned && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Inspector</th>
                    )}
                    {visibleColumns.date && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    )}
                    {/* Custom Columns Headers */}
                    {customColumns.filter(col => visibleColumns[col]).map(col => (
                      <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                    {visibleColumns.actions && (
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-gray-500">Loading inspections...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-gray-500">No inspections found.</td>
                    </tr>
                  ) : (
                    filtered.map((row) => {
                      const priorityStyle = getPriorityColor(row.priority || "Medium");
                      const statusStyle = getStatusColor(row.status || "pending");

                      return (
                        <tr key={row.id ?? row.reference} className="hover:bg-teal-50/30 transition-all border-b border-gray-100 last:border-0">
                          {visibleColumns.checkbox && (
                            <td className="py-4 px-4">
                              <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-500" />
                            </td>
                          )}
                          {visibleColumns.type && (
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
                                {row.inspectionType || row.inspection_type || "Inspection"}
                              </span>
                            </td>
                          )}
                          {visibleColumns.reference && (
                            <td className="py-4 px-4">
                              <span className="text-slate-900 font-semibold text-sm">{row.reference || `INS-${row.id}`}</span>
                            </td>
                          )}
                          {visibleColumns.description && (
                            <td className="py-4 px-4">
                              <div>
                                <div className={`text-gray-900 font-medium ${hasUpdate ? 'cursor-pointer hover:text-teal-600' : ''} transition-colors flex items-center gap-2`}
                                  onClick={hasUpdate ? () => handleEdit(row.id) : undefined}>
                                  <Home className="w-4 h-4 text-gray-400" />
                                  <span>{row.propertyName || row.property_name || "Unknown Property"}</span>
                                </div>
                                <div className="text-gray-500 text-xs mt-1 truncate max-w-xs">
                                  {row.findings || "No findings recorded."}
                                </div>
                              </div>
                            </td>
                          )}
                          {visibleColumns.priority && (
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${priorityStyle.dot} shadow-sm`}></span>
                                <span className={`text-sm font-semibold ${priorityStyle.text}`}>{row.priority || "Medium"}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${statusStyle.dot} shadow-sm`}></span>
                                <span className={`text-sm font-semibold ${statusStyle.text}`}>{row.status || "Pending"}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.assigned && (
                            <td className="py-4 px-4">
                              {!row.inspectorName && !row.inspector_name ? (
                                <span className="text-gray-400 text-sm">Unassigned</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.inspectorName || row.inspector_name)} flex items-center justify-center text-xs font-semibold shadow-sm`}>
                                    {getInitials(row.inspectorName || row.inspector_name)}
                                  </div>
                                  <span className="text-gray-900 text-sm font-medium">{row.inspectorName || row.inspector_name}</span>
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.date && (
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="text-gray-900 font-medium text-sm">{formatDate(row.inspectionDate || row.inspection_date)}</span>
                            </td>
                          )}
                          {/* Custom Columns Cells */}
                          {customColumns.filter(col => visibleColumns[col]).map(col => (
                            <td key={col} className="py-4 px-4">
                              <span className="text-gray-900 font-medium text-sm">{row[col] || '-'}</span>
                            </td>
                          ))}
                          {visibleColumns.actions && (
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleView(row.id)}
                                  className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                                  title="View"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {hasUpdate && (
                                  <button
                                    onClick={() => handleEdit(row.id)}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {hasDelete && (
                                  <button
                                    onClick={() => handleDelete(row.id)}
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Board/Kanban View */
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4 min-w-max pb-4">
                {['pending', 'completed', 'action required'].map((status) => {
                  const statusItems = filtered.filter((insp) => {
                    if (status === 'action required') {
                      return !!(insp.actionRequired ?? insp.action_required);
                    }
                    return (insp.status || '').toLowerCase() === status.toLowerCase();
                  });

                  const getStatusStyle = (status) => {
                    if (status === 'pending') return {
                      bg: 'bg-orange-50',
                      border: 'border-orange-200',
                      header: 'bg-orange-100',
                      text: 'text-orange-700',
                      dot: 'bg-orange-500'
                    };
                    if (status === 'completed') return {
                      bg: 'bg-emerald-50',
                      border: 'border-emerald-200',
                      header: 'bg-emerald-100',
                      text: 'text-emerald-700',
                      dot: 'bg-emerald-500'
                    };
                    if (status === 'action required') return {
                      bg: 'bg-red-50',
                      border: 'border-red-200',
                      header: 'bg-red-100',
                      text: 'text-red-700',
                      dot: 'bg-red-500'
                    };
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
                    <div key={status} className="shrink-0 w-80">
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
                              <p className="text-gray-400 text-sm">No inspections</p>
                            </div>
                          ) : (
                            statusItems.map((insp) => {
                              const priorityColor = getPriorityColor(insp.priority || "Medium");

                              return (
                                <div
                                  key={insp.id}
                                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                                  onClick={() => handleView(insp.id)}
                                >
                                  {/* Card Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-gray-500">{insp.reference || `INS-${insp.id}`}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                      <span className={`text-xs font-medium ${priorityColor.text}`}>
                                        {insp.priority || "Medium"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Title */}
                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                                    {insp.inspectionType || insp.inspection_type || "Inspection"}
                                  </h4>

                                  {/* Property */}
                                  <div className="flex items-center gap-1.5 text-gray-600 text-xs mb-2">
                                    <Home className="w-3 h-3" />
                                    <span className="truncate">
                                      {insp.propertyName || insp.property_name || "Unknown Property"}
                                    </span>
                                  </div>

                                  {/* Findings */}
                                  {insp.findings && (
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                                      {insp.findings}
                                    </p>
                                  )}

                                  {/* Issues Badge */}
                                  {insp.issuesFound > 0 && (
                                    <div className="mb-3">
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium">
                                        <AlertCircle className="w-3 h-3" />
                                        {insp.issuesFound} {insp.issuesFound === 1 ? 'issue' : 'issues'} found
                                      </span>
                                    </div>
                                  )}

                                  {/* Card Footer */}
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-2">
                                    {/* Inspector */}
                                    <div className="flex items-center gap-2">
                                      {insp.inspectorName || insp.inspector_name ? (
                                        <>
                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(insp.inspectorName || insp.inspector_name)} flex items-center justify-center text-xs font-semibold`}>
                                            {getInitials(insp.inspectorName || insp.inspector_name)}
                                          </div>
                                          <span className="text-xs text-gray-700 truncate max-w-[100px]">
                                            {insp.inspectorName || insp.inspector_name}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">No inspector</span>
                                      )}
                                    </div>

                                    {/* Date */}
                                    <span className="text-xs text-gray-500">
                                      {formatDate(insp.inspectionDate || insp.inspection_date)}
                                    </span>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleView(insp.id);
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
                                          handleEdit(insp.id);
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
                                          handleDelete(insp.id);
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[70vh]">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? "Edit Inspection" : "Create Inspection"}
              </h3>
              <button
                onClick={() => { setShowModal(false); setError(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Same form fields as original */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Type <span className="text-red-500">*</span></label>
                    <select
                      name="inspectionType"
                      required
                      value={formData.inspectionType}
                      onChange={handleInspectionTypeChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white transition-all"
                    >
                      <option value="">Select inspection type</option>
                      {[...BUILTIN_INSPECTION_TYPES, ...customInspectionTypes].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      {!!formData.inspectionType &&
                        ![...BUILTIN_INSPECTION_TYPES, ...customInspectionTypes].some((t) => String(t) === String(formData.inspectionType)) && (
                          <option value={formData.inspectionType}>{formData.inspectionType}</option>
                        )}
                      <option value="__add_new__">+ Add new...</option>
                    </select>
                    {showCustomInspectionTypeInput && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={customInspectionTypeValue}
                          onChange={(e) => setCustomInspectionTypeValue(e.target.value)}
                          placeholder="Enter new inspection type"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                        />
                        <button
                          type="button"
                          onClick={saveCustomInspectionType}
                          className="px-3 py-1.5 bg-teal-500 text-white rounded-md hover:bg-teal-600 text-sm font-medium"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomInspectionTypeInput(false);
                            setCustomInspectionTypeValue('');
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
                    <select
                      name="propertyId"
                      required
                      value={formData.propertyId}
                      onChange={handlePropertyChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white transition-all"
                    >
                      <option value="">Select property</option>
                      {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    {hotelsLoading && <div className="text-xs text-gray-400 mt-0.5">Loading hotels...</div>}
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service User</label>
                    <select
                      name="serviceUserId"
                      value={formData.serviceUserId}
                      onChange={handleServiceUserChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white transition-all"
                    >
                      <option value="">Select service user</option>
                      {serviceUsers.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inspector Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="inspectorName"
                      value={formData.inspectorName}
                      readOnly
                      title="Inspector name is automatically set to your user name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="inspectionDate"
                      required
                      value={formData.inspectionDate}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none transition-all"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Findings</label>
                    <textarea
                      name="findings"
                      rows={3}
                      value={formData.findings}
                      onChange={handleInputChange}
                      placeholder="Describe inspection findings..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none resize-y transition-all"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issues Found</label>
                    <input
                      type="number"
                      name="issuesFound"
                      value={formData.issuesFound}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action Required</label>
                    <div className="flex items-center gap-3 h-[38px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="actionRequired"
                          checked={!!formData.actionRequired}
                          onChange={handleInputChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                        <span className="ml-3 text-sm font-medium text-gray-700">Yes / No</span>
                      </label>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                    <select
                      name="status"
                      required
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white transition-all"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                  </div>

                  {/* Custom Columns from Forms Builder */}
                  {/* Custom Columns from Forms Builder */}
                  {customColumns.map(col => {
                    const meta = customColumnMetadata[col] || {};
                    const inputType = meta.input_type || 'text';
                    const isCheckbox = inputType === 'checkbox' || customColumnTypes[col] === 'boolean';
                    const options = Array.isArray(meta.input_options) ? meta.input_options : [];

                    // Parse options if string
                    let parsedOptions = options;
                    if (typeof options === 'string') {
                      try { parsedOptions = JSON.parse(options); } catch { parsedOptions = []; }
                    }
                    // Handle case where options is an array of strings but might be wrapped/stringified
                    if (Array.isArray(parsedOptions) && parsedOptions.length === 1 && typeof parsedOptions[0] === 'string' && parsedOptions[0].startsWith('[')) {
                      try { parsedOptions = JSON.parse(parsedOptions[0]); } catch { }
                    }

                    return (
                      <div key={col} className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        {isCheckbox ? (
                          <div className="flex items-center gap-3 h-[38px]">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                name={col}
                                checked={!!formData[col]}
                                onChange={handleInputChange}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                              <span className="ml-3 text-sm font-medium text-gray-700">Yes / No</span>
                            </label>
                          </div>
                        ) : inputType === 'dropdown' || inputType === 'select' ? (
                          <select
                            name={col}
                            value={formData[col] || ''}
                            onChange={handleInputChange}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none transition-all ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                          >
                            <option value="">Select {col.replace(/_/g, ' ')}</option>
                            {parsedOptions.map((opt, idx) => (
                              <option key={idx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : inputType === 'textarea' ? (
                          <textarea
                            name={col}
                            value={formData[col] || ''}
                            onChange={handleInputChange}
                            rows={3}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none transition-all resize-y ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                            placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                          />
                        ) : (
                          <input
                            type={inputType === 'number' || customColumnTypes[col] === 'number' ? 'number' : inputType === 'date' || customColumnTypes[col] === 'date' ? 'date' : 'text'}
                            name={col}
                            value={formData[col] || ''}
                            onChange={handleInputChange}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none transition-all ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                            placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                          />
                        )}
                        {fieldErrors[col] && (
                          <div className="mt-1 text-xs text-red-600 font-medium">
                            {fieldErrors[col]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                {error && <div className="text-sm text-red-500 mr-auto font-medium">{error}</div>}
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(null); }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-all text-sm shadow-sm hover:shadow"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : (editingId ? "Update Inspection" : "Create Inspection")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {/* View Details Modal */}
      {showViewModal && viewingInspection && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full h-[70vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Inspection Details</h2>
                <p className="text-xs text-gray-500 mt-1">View inspection information</p>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailField label="Inspection Type" value={viewingInspection.inspectionType || viewingInspection.inspection_type} />
                <DetailField label="Property" value={viewingInspection.propertyName || viewingInspection.property_name} />
                <DetailField label="Inspector" value={viewingInspection.inspectorName || viewingInspection.inspector_name} />
                <DetailField label="Date" value={formatDate(viewingInspection.inspectionDate || viewingInspection.inspection_date)} />
                <DetailField label="Service User" value={viewingInspection.serviceUserName || viewingInspection.serviceUser || viewingInspection.service_user_name || viewingInspection.service_user} />

                <DetailField label="Issues Found" value={viewingInspection.issuesFound || viewingInspection.issues_found || '0'} />

                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Action Required</div>
                  <div className="text-slate-800 font-medium text-sm">
                    {(viewingInspection.actionRequired || viewingInspection.action_required) ? 'Yes' : 'No'}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Status</div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(viewingInspection.status).dot.replace('bg-', 'border-').replace('text-', 'text-')} bg-white ${getStatusColor(viewingInspection.status).text}`}>
                    {viewingInspection.status}
                  </span>
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Priority</div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(viewingInspection.priority).dot.replace('bg-', 'border-').replace('text-', 'text-')} bg-white ${getPriorityColor(viewingInspection.priority).text}`}>
                    {viewingInspection.priority || 'Medium'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Findings</div>
                  <div className="text-slate-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[60px]">
                    {viewingInspection.findings || '-'}
                  </div>
                </div>

                {customColumns.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    {customColumns.map(col => (
                      <DetailField
                        key={col}
                        label={col.replace(/_/g, ' ')}
                        value={viewingInspection[col] !== undefined && viewingInspection[col] !== null && viewingInspection[col] !== ''
                          ? String(viewingInspection[col])
                          : '-'}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {hasUpdate && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewingInspection.id);
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
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