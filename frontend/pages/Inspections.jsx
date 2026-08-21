/* eslint-disable no-empty */

/* eslint-disable no-unused-vars */

import React, { useEffect, useMemo, useRef, useState } from "react";

import axios from "axios";

import { usePermissions } from "../hooks/usePermissions";

import { AlertModal, ConfirmModal } from "../components/ModalDialogs";

import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';

import {

  Home,

  Building,

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

  Check,

  Users,

  User,

  ListFilter

} from "lucide-react";

import { generatePDF } from "../utils/pdfGenerator";

import { generateCSV } from "../utils/csvGenerator";

import { DownloadDropdown } from "../components/DownloadDropdown";

import Breadcrumbs from "../components/Breadcrumbs";
import ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';



/* Inject delete animation CSS once */

const DELETE_STYLE_ID = 'inspections-delete-anim';

if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {

  const style = document.createElement('style');

  style.id = DELETE_STYLE_ID;

  style.textContent = `

    @keyframes inspectionSlideOut {

      0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }

      40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }

      100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }

    }

    @keyframes inspectionCardDelete {

      0%   { opacity: 1; transform: scale(1) rotate(0deg); }

      30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }

      100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }

    }

    tr.inspection-deleting {

      animation: inspectionSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;

      overflow: hidden;

      pointer-events: none;

    }

    .inspection-card-deleting {

      animation: inspectionCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;

      pointer-events: none;

    }

  `;

  document.head.appendChild(style);

}



const inspectionsColumnsCache = {

  ts: 0,

  columns: null,

};



const DEFAULT_COLUMNS = [

  "checkbox",

  "type",

  "reference",

  "description",

  "attachments",

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



function getCategoryStyle(type) {

  const t = String(type || "").toLowerCase();

  if (t.includes("emergency") || t.includes("urgent")) return "text-blue-700 bg-blue-50 border-blue-200";

  if (t.includes("voluntary") || t.includes("internal")) return "text-amber-700 bg-amber-50 border-amber-200";

  if (t.includes("social") || t.includes("external")) return "text-indigo-700 bg-indigo-50 border-indigo-200";

  if (t.includes("community") || t.includes("audit")) return "text-teal-700 bg-teal-50 border-teal-200";

  return "text-[var(--text-primary)] bg-[var(--bg-primary)] border-[var(--border-color)]";

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

const DetailField = ({ label, value, fullWidth = false }) => (

  <div className={fullWidth ? "md:col-span-2" : ""}>

    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide block mb-1">{label}</label>

    <p className="text-[var(--text-primary)] font-medium">{value || '-'}</p>

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

  // Image gallery hook — opens in-page modal instead of new tab
  const { galleryOpen: _galleryOpen, galleryItems: _galleryItems, galleryTitle: _galleryTitle, galleryApi: _galleryApi, openGallery: _openGallery, closeGallery: _closeGallery } = useImageGallery();

  const [loading, setLoading] = useState(true);

  const [inspections, setInspections] = useState([]);

  // Track rows/cards currently being deleted for animation

  const [deletingIds, setDeletingIds] = useState(new Set());

  const [hotels, setHotels] = useState([]);

  const [staffUsers, setStaffUsers] = useState([]);

  const [serviceUsers, setServiceUsers] = useState([]);

  const [showModal, setShowModal] = useState(false);

  const [staffLoading, setStaffLoading] = useState(false);

  const [hotelsLoading, setHotelsLoading] = useState(false);

  const [serviceUsersLoading, setServiceUsersLoading] = useState(false);



  const staffCacheRef = useRef({});

  const staffAbortRef = useRef(null);



  // Modals State

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

  const [availableColumns, setAvailableColumns] = useState(["checkbox", "type", "reference", "description", "attachments", "priority", "status", "assigned", "date", "actions"]);



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

    actionRequired: "",

    status: "pending",

    ...customColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})

  });



  const [photos, setPhotos] = useState([]);



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

        if (!(col in newForm)) {

          if ((customColumnTypes[col] || "text") === "boolean") newForm[col] = "";

          else newForm[col] = '';

        }

      });

      return newForm;

    });

  }, [customColumns, customColumnTypes]);



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



        const reservedColumns = new Set([

          ...systemColumns,

          ...DEFAULT_COLUMNS,

          'service_user',

          'serviceuser',

          'service_userid',

          'service_username'

        ]);



        const customCols = (Array.isArray(columns) ? columns : [])

          .filter(col => !reservedColumns.has(String(col.column_name || '').toLowerCase()))

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



      const reservedColumns = new Set([

        ...systemColumns,

        ...DEFAULT_COLUMNS,

        'service_user',

        'serviceuser',

        'service_userid',

        'service_username'

      ]);



      const customCols = columns

        .filter(col => !reservedColumns.has(String(col.column_name || '').toLowerCase()))

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



    return () => {

      mounted = false;

    };

  }, []);



  useEffect(() => {

    const onStorage = (e) => {

      if (!e || e.key !== 'formsBuilderColumnsUpdated') return;

      try {

        const payload = e.newValue ? JSON.parse(e.newValue) : null;

        if (!payload || !payload.table) return;

        if (String(payload.table).toLowerCase() !== 'inspections') return;

      } catch (err) {

        return;

      }



      inspectionsColumnsCache.ts = 0;

      inspectionsColumnsCache.columns = null;

      fetchAvailableColumns();

    };



    window.addEventListener('storage', onStorage);

    return () => window.removeEventListener('storage', onStorage);

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



    try {

      setServiceUsersLoading(true);

      async function tryPath(path) {

        const r = await api.get(path);

        return r?.data?.data ?? r?.data ?? [];

      }



      try {

        const canonical = `/api/hotels/${hotelId}/service-users`;

        const rows = await tryPath(canonical);

        const normalized = (Array.isArray(rows) ? rows : [])

          .map((r) => ({

            id: r.id,

            first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ""}`

          })).filter(Boolean);

        setServiceUsers(normalized);

        return;

      } catch (err) {

        if (err?.response?.status !== 404) {

          console.error("fetchServiceUsers error (canonical):", err);

          setServiceUsers([]);

          return;

        }

      }



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

          const normalized = (Array.isArray(rows) ? rows : [])

            .map((r) => ({

              id: r.id,

              first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ""}`

            })).filter(Boolean);

          if (normalized.length) {

            setServiceUsers(normalized);

            return;

          }

        } catch {

        }

      }

      setServiceUsers([]);

    } catch (err) {

      console.error("fetchServiceUsers final error:", err);

      setServiceUsers([]);

    } finally {

      setServiceUsersLoading(false);

    }

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

    if (customColumnTypes[name] === "boolean" || name === "actionRequired") {

      const v = String(value);

      if (v === "true" || v === "false" || v === "") {

        setFormData((p) => ({ ...p, [name]: v }));

      } else {

        setFormData((p) => ({ ...p, [name]: value }));

      }

    } else {

      setFormData((p) => ({ ...p, [name]: value }));

    }



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



    const missing = [];

    if (!formData.inspectionType) missing.push("Inspection Type");

    if (!formData.propertyId) missing.push("Property");

    if (!formData.serviceUserId) missing.push("Service User");

    if (!formData.inspectorName) missing.push("Inspector Name");

    if (!formData.inspectionDate) missing.push("Inspection Date");

    if (!formData.status) missing.push("Status");

    if (!String(formData.findings || "").trim()) missing.push("Findings");

    if (formData.issuesFound === "" || formData.issuesFound === null || formData.issuesFound === undefined || Number.isNaN(Number(formData.issuesFound))) {

      missing.push("Issues Found");

    }

    if (formData.actionRequired === "") missing.push("Action Required");



    for (const col of customColumns) {

      const t = customColumnTypes[col] || "text";

      const v = formData[col];

      const isEmptyString = typeof v === "string" && v.trim() === "";

      const isEmpty = v === undefined || v === null || v === "" || isEmptyString;

      if (t === "boolean") {

        if (v === "") missing.push(col.replace(/_/g, " "));

      } else if (isEmpty) {

        missing.push(col.replace(/_/g, " "));

      }

    }



    if (missing.length) {

      setError(`Please fill required fields: ${missing.join(", ")}.`);

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

      serviceUserId: formData.serviceUserId,

      service_user_id: formData.serviceUserId,

      serviceUser: formData.serviceUserName,

      service_user: formData.serviceUserName,

      inspectorName: formData.inspectorName,

      inspector_name: formData.inspectorName,

      inspectionDate: formData.inspectionDate,

      inspection_date: formData.inspectionDate,

      findings: formData.findings,

      issuesFound: Number(formData.issuesFound),

      issues_found: Number(formData.issuesFound),

      actionRequired: formData.actionRequired === true || String(formData.actionRequired).toLowerCase() === "true",

      action_required: formData.actionRequired === true || String(formData.actionRequired).toLowerCase() === "true",

      status: formData.status || "pending",

    };

    // Add custom column values to payload

    customColumns.forEach(col => {

      const val = formData[col];

      if (val === undefined) return;



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



      const hasPhotos = Array.isArray(photos) && photos.length > 0;

      if (hasPhotos) {

        const fd = new FormData();

        Object.entries(payload).forEach(([k, v]) => {

          if (v === undefined) return;

          if (v === null) {

            fd.append(k, '');

            return;

          }

          if (typeof v === 'object') {

            fd.append(k, JSON.stringify(v));

            return;

          }

          fd.append(k, String(v));

        });

        delete payload.attachments;

        photos.forEach((f) => fd.append('photos', f));



        if (editingId) {

          res = await api.put(`/api/inspections/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

        } else {

          res = await api.post('/api/inspections', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

        }

      } else {

        if (editingId) {

          delete payload.attachments;

          res = await api.put(`/api/inspections/${editingId}`, payload);

        } else {

          delete payload.attachments;

          res = await api.post("/api/inspections", payload);

        }

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

        setPhotos([]);

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

          actionRequired: "",

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



    let attachments = item.attachments ?? item.attachments_ids ?? item.photos ?? [];

    try {

      if (typeof attachments === 'string' && attachments) attachments = JSON.parse(attachments);

    } catch {

      attachments = [];

    }



    setFormData({ ...baseFormData, ...customFieldData, attachments: Array.isArray(attachments) ? attachments : [] });

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

          const record = inspections.find((i) => String(i.id) === String(id)) ?? null;

          setDeletingIds(prev => new Set(prev).add(id));

          setConfirmDialog(prev => ({ ...prev, isOpen: false }));



          const ANIM_DURATION = 460;

          setTimeout(() => {

            setInspections((prev) => prev.filter((p) => String(p.id) !== String(id)));

            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });

          }, ANIM_DURATION);



          await api.delete(`/api/inspections/${id}`);

        } catch (err) {

          console.error('handleDelete error:', err);

          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });

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



  const openNewInspection = (e) => {

    if (e && typeof e.preventDefault === "function") e.preventDefault();

    if (e && typeof e.stopPropagation === "function") e.stopPropagation();



    if (!hasCreate) {

      alert("You don't have permission to create inspections.");

      return;

    }



    setShowViewMenu(false);

    setShowPropertyVisibility(false);

    setShowExportModal(false);



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



  // Hide sidebar and navbar when modal is open

  useEffect(() => {

    if (showModal || showViewModal || confirmDialog.isOpen) {

      document.body.classList.add('form-modal-open');

    } else {

      document.body.classList.remove('form-modal-open');

    }

    return () => {

      document.body.classList.remove('form-modal-open');

    };

  }, [showModal, showViewModal, confirmDialog.isOpen]);



  async function removeAttachment(attachmentId) {

    if (!attachmentId || submitting) return;

    try {

      setSubmitting(true);

      await api.delete(`/api/inspections/attachments/${encodeURIComponent(String(attachmentId))}`).catch(() => null);

      setFormData((p) => {

        let atts = p?.attachments ?? [];

        try {

          if (typeof atts === 'string' && atts) atts = JSON.parse(atts);

        } catch {

          atts = [];

        }

        const next = (Array.isArray(atts) ? atts : []).filter((x) => String(x) !== String(attachmentId));

        return { ...p, attachments: next };

      });

      await fetchInspections();

    } catch (err) {

      console.warn('Failed to remove attachment', err);

    } finally {

      setSubmitting(false);

    }

  }



    function openAttachmentsGallery(attachments) {
      let atts = attachments || [];
      try { if (typeof atts === 'string' && atts) atts = JSON.parse(atts); } catch { atts = []; }
      const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
      if (!list.length) return;
      _openGallery(list, "Inspection Documents", "/api/inspections/attachments");
  }



  return (

    <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      <div className="p-3 sm:p-4 md:p-6">

        {/* Page Header */}

        <div className="mb-6 flex items-start justify-between">

          <div>

            <Breadcrumbs items={[{ label: 'Property', path: '/admin/hotels' }, { label: 'Inspections', path: '/admin/inspections' }]} />

            <h1 className="text-3xl font-black text-[var(--text-primary)] mt-1">Inspections Dashboard</h1>

          </div>

          <div className="flex items-center gap-3">

            <DownloadDropdown

              onDownloadPDF={() => openExport('pdf')}

              onDownloadCSV={() => openExport('csv')}

            />

          </div>

        </div>



        {/* Stats Overview */}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-4">

          <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200">

            <div className="bg-[var(--accent-shadow)] text-[var(--accent-primary)] h-14 w-14 rounded-xl flex items-center justify-center shrink-0">

              <Building size={28} />

            </div>

            <div className="flex-1 min-w-0">

              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mb-0.5">Total Inspections</div>

              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{stats.total}</div>

            </div>

          </div>



          <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200">

            <div className="bg-[var(--accent-shadow)] text-[var(--accent-primary)] h-14 w-14 rounded-xl flex items-center justify-center shrink-0">

              <Users size={28} />

            </div>

            <div className="flex-1 min-w-0">

              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-wider mb-0.5">Open Inspections</div>

              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{stats.pending}</div>

            </div>

          </div>



          <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200">

            <div className="bg-red-500/10 text-red-500 h-14 w-14 rounded-xl flex items-center justify-center shrink-0">

              <AlertCircle size={28} />

            </div>

            <div className="flex-1 min-w-0">

              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-wider mb-0.5">High Risk</div>

              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{stats.actionRequired}</div>

            </div>

          </div>



          <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200">

            <div className="bg-blue-500/10 text-blue-500 h-14 w-14 rounded-xl flex items-center justify-center shrink-0">

              <User size={28} />

            </div>

            <div className="flex-1 min-w-0">

              <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-wider mb-0.5">Assigned Tasks</div>

              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{stats.completed}</div>

            </div>

          </div>

        </div>



        {/* Main Content Area - Enhanced Table */}

        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] transition-all duration-200">

          {/* Search & Filter Bar */}

          <div className="p-6 pb-0">

            <div className="mb-6">

              <div className="flex items-center justify-between mb-4">

                <div>

                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Inspections Directory</h2>

                  <p className="text-sm text-[var(--text-secondary)]">{stats.total} total records</p>

                </div>

                <div className="flex items-center gap-3">

                  {/* SEARCH INPUT */}

                  <div className="relative">

                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60" />

                    <input

                      type="text"

                      value={query}

                      onChange={e => setQuery(e.target.value)}

                      placeholder="Search inspections..."

                      className="h-9 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-64 text-[var(--text-primary)]"

                    />

                  </div>



                  {/* View Dropdown */}

                  <div className="relative" ref={viewRef}>

                    <button

                      onClick={() => setShowViewMenu(!showViewMenu)}

                      className="h-9 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 text-xs font-medium flex items-center gap-2"

                    >

                      <Eye className="w-4 h-4" />

                      <span className="font-semibold">{viewMode === 'table' ? 'Table' : 'Board'}</span>

                      <ChevronDown className="w-4 h-4" />

                    </button>

                    {/* View Settings Dropdown Panel */}

                    {showViewMenu && (

                      <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-surface)] rounded-xl shadow-2xl border border-[var(--border-color)] z-50 animate-in fade-in duration-200">

                        <div className="p-4">

                          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">View settings</h3>



                          {/* View Mode Selector */}

                          <div className="mb-3 pb-3 border-b border-[var(--border-color)]">

                            <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">Display Mode</div>

                            <div className="flex gap-2">

                              <button

                                onClick={() => setViewMode('table')}

                                className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'table'

                                  ? 'bg-teal-500 text-white shadow-sm'

                                  : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'

                                  }`}

                              >

                                <Columns className="w-4 h-4" />

                                <span>Table</span>

                              </button>

                              <button

                                onClick={() => setViewMode('board')}

                                className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === 'board'

                                  ? 'bg-teal-500 text-white shadow-sm'

                                  : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'

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

                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[var(--text-primary)] rounded-xl transition-colors"

                              >

                                <span>Column visibility</span>

                                <div className="flex items-center gap-2">

                                  <span className="text-xs text-[var(--text-secondary)]/60">

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

                                          className="text-xs text-teal-600 font-medium rounded-xl"

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

                                          className="text-xs text-teal-600 font-medium rounded-xl"

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

                                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors border ${visibleColumns[col]

                                            ? 'text-[var(--text-primary)] border-[var(--border-color)] bg-[var(--bg-surface)]'

                                            : 'text-[var(--text-secondary)]/60 border-[var(--border-color)]/50 bg-[var(--bg-primary)]/50'

                                            }`}

                                        >

                                          <span className="capitalize font-medium">{col}</span>

                                          <div className="flex items-center gap-2">

                                            {visibleColumns[col] ? (

                                              <Eye className="w-4 h-4 text-teal-600" />

                                            ) : (

                                              <EyeOff className="w-4 h-4 text-[var(--text-secondary)]/60" />

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

                                            className="text-xs text-teal-600 font-medium rounded-xl"

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

                                            className="text-xs text-teal-600 font-medium rounded-xl"

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

                                            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors border ${visibleColumns[col]

                                              ? 'text-[var(--text-primary)] border-[var(--border-color)] bg-[var(--bg-surface)]'

                                              : 'text-[var(--text-secondary)]/60 border-[var(--border-color)]/50 bg-[var(--bg-primary)]/50'

                                              }`}

                                          >

                                            <span className="capitalize">{col.replace(/_/g, ' ')}</span>

                                            <div className="flex items-center gap-2">

                                              {visibleColumns[col] ? (

                                                <Eye className="w-4 h-4 text-teal-600" />

                                              ) : (

                                                <EyeOff className="w-4 h-4 text-[var(--text-secondary)]/60" />

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

                      type="button"

                      onClick={openNewInspection}

                      className="h-9 bg-teal-500 text-white font-semibold rounded-xl px-4 text-xs flex items-center gap-2 shadow-sm"

                    >

                      <ClipboardList className="w-4 h-4" />

                      <span>New Inspection</span>

                    </button>

                  )}

                </div>

              </div>



              {showExportModal && (

                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">

                  <div className="w-full max-w-2xl rounded-xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-color)] overflow-hidden">

                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">

                      <div>

                        <div className="text-lg font-semibold text-[var(--text-primary)]">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>

                        <div className="text-xs text-[var(--text-secondary)] mt-0.5">Select the columns you want to include</div>

                      </div>

                      <button

                        onClick={closeExport}

                        className="p-2 rounded-xl text-[var(--text-secondary)]"

                        aria-label="Close"

                      >

                        <X className="w-5 h-5" />

                      </button>

                    </div>



                    <div className="px-5 py-4">

                      <div className="flex items-center justify-between mb-3">

                        <div className="text-sm font-medium text-[var(--text-primary)]">Columns</div>

                        <div className="flex items-center gap-3 text-xs">

                          <button

                            onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))}

                            className="text-teal-600 font-medium rounded-xl"

                          >

                            Select all

                          </button>

                          <button

                            onClick={() => setSelectedExportKeys([])}

                            className="text-gray-600 font-medium rounded-xl"

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

                              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] cursor-pointer"

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

                                className="h-4 w-4 accent-teal-600 rounded-xl"

                              />

                              <span className="text-sm text-[var(--text-primary)]">{col.header}</span>

                            </label>

                          );

                        })}

                      </div>

                    </div>



                    <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50">

                      <button

                        onClick={closeExport}

                        className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-primary)] border border-[var(--border-color)]"

                      >

                        Cancel

                      </button>

                      <button

                        onClick={runExport}

                        className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-teal-600 shadow-sm hover:bg-teal-700 transition-all"

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
                  <Clock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-10 py-0 leading-none text-sm text-[var(--text-primary)] font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer appearance-none min-w-[130px]"
                  >
                    <option value="">All Priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                </div>

                <div className="relative">
                  <CheckCircle className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-10 py-0 leading-none text-sm text-[var(--text-primary)] font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer appearance-none min-w-[130px]"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                </div>

                <div className="relative">
                  <Building className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                  <select
                    value={propertyFilter}
                    onChange={(e) => setPropertyFilter(e.target.value)}
                    className="h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-10 py-0 leading-none text-sm text-[var(--text-primary)] font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer appearance-none min-w-[130px]"
                  >
                    <option value="">All Properties</option>
                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                </div>

                <div className="relative">
                  <ListFilter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl !pl-14 pr-10 py-0 leading-none text-sm text-[var(--text-primary)] font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer appearance-none min-w-[130px]"
                  >
                    <option value="">Sort By</option>
                    <option value="date">Date (Newest)</option>

                    <option value="priority">Priority</option>

                    <option value="status">Status</option>

                    <option value="type">Type</option>

                  </select>

                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none" />

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

                    className="bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-[var(--bg-primary)]/80 transition-all"

                  >

                    <X className="w-4 h-4" />

                    <span>Clear</span>

                  </button>

                )}

              </div>

            </div>

          </div>



          {/* Data Display - Table or Board View */}

          {viewMode === 'table' ? (

            <div className="overflow-x-auto border-t border-gray-100 relative">

              <table className="w-full">

                <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                  <tr>

                    {visibleColumns.checkbox && (

                      <th className="text-left py-4 px-4">

                        <input type="checkbox" className="rounded-xl border-[var(--border-color)] text-teal-500 focus:ring-teal-500" />

                      </th>

                    )}

                    {visibleColumns.type && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">CATEGORY</th>

                    )}

                    {visibleColumns.reference && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">REFERENCE</th>

                    )}

                    {visibleColumns.description && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">DESCRIPTION</th>

                    )}

                    {visibleColumns.attachments && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">ATTACHMENTS</th>

                    )}

                    {visibleColumns.priority && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">PRIORITY</th>

                    )}

                    {visibleColumns.status && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">STATUS</th>

                    )}

                    {visibleColumns.assigned && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">ASSIGNED TO</th>

                    )}

                    {visibleColumns.date && (

                      <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">DATE</th>

                    )}

                    {/* Custom Columns Headers */}

                    {customColumns.filter(col => visibleColumns[col]).map(col => (

                      <th key={col} className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">

                        {col.replace(/_/g, ' ').toUpperCase()}

                      </th>

                    ))}

                    {visibleColumns.actions && (

                      <th className="text-center py-4 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider sticky right-0 z-10 bg-[var(--bg-primary)]" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>ACTIONS</th>

                    )}

                  </tr>

                </thead>

                <tbody className="bg-[var(--bg-surface)] divide-y divide-[var(--border-color)]">

                  {loading ? (

                    <tr>

                      <td colSpan="9" className="py-12 text-center text-[var(--text-secondary)]">Loading inspections...</td>

                    </tr>

                  ) : filtered.length === 0 ? (

                    <tr>

                      <td colSpan="9" className="py-12 text-center text-[var(--text-secondary)]">No inspections found.</td>

                    </tr>

                  ) : (

                    filtered.map((row) => {

                      const priorityStyle = getPriorityColor(row.priority || "Medium");

                      const statusStyle = getStatusColor(row.status || "pending");

                      const isDeleting = deletingIds.has(row.id);



                      return (

                        <tr key={row.id ?? row.reference} className={`transition-colors border-b border-[var(--border-color)] last:border-0 group ${isDeleting ? 'inspection-deleting' : ''}`}>

                          {visibleColumns.checkbox && (

                            <td className="py-4 px-4">

                              <input type="checkbox" className="rounded-xl border-[var(--border-color)] text-teal-500 focus:ring-teal-500" />

                            </td>

                          )}

                          {visibleColumns.type && (

                            <td className="py-4 px-4">

                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getCategoryStyle(row.inspectionType || row.inspection_type)}`}>

                                {row.inspectionType || row.inspection_type || "Inspection"}

                              </span>

                            </td>

                          )}

                          {visibleColumns.reference && (

                            <td className="py-4 px-4">

                              <span className="text-[var(--text-primary)] font-semibold text-sm">{row.reference || `INS-${row.id}`}</span>

                            </td>

                          )}

                          {visibleColumns.description && (

                            <td className="py-4 px-4">

                              <div>

                                <div className={`text-[var(--text-primary)] font-medium ${hasUpdate ? 'cursor-pointer' : ''} transition-colors flex items-center gap-2`}

                                  onClick={hasUpdate ? () => handleEdit(row.id) : undefined}>

                                  <Building className="w-4 h-4 text-[var(--text-secondary)]/60" />

                                  <span className="font-semibold text-[var(--text-primary)]">{row.propertyName || row.property_name || "Unknown Property"}</span>

                                </div>

                                <div className="text-[var(--text-secondary)] text-xs mt-1 truncate max-w-xs">

                                  {row.findings || "No findings recorded."}

                                </div>

                              </div>

                            </td>

                          )}

                          {visibleColumns.attachments && (

                            <td className="py-4 px-4">

                              {(() => {

                                let atts = row?.attachments ?? row?.raw?.attachments ?? [];

                                try {

                                  if (typeof atts === 'string' && atts) atts = JSON.parse(atts);

                                } catch {

                                  atts = [];

                                }

                                const list = Array.isArray(atts) ? atts.filter(Boolean) : [];

                                if (list.length === 0) return <span className="text-[var(--text-secondary)]/40 text-sm">—</span>;

                                return (

                                  <button

                                    type="button"

                                    onClick={() => openAttachmentsGallery(row?.attachments ?? row?.raw?.attachments)}

                                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-xl"

                                    title="View attachments"

                                  >

                                    <span>{list.length}</span>

                                    <span className="text-xs font-bold uppercase tracking-wide">Photos</span>

                                  </button>

                                );

                              })()}

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

                                <span className="text-[var(--text-secondary)]/40 text-sm">Unassigned</span>

                              ) : (

                                <div className="flex items-center gap-2">

                                  <div className={`w-8 h-8 rounded-full ${getAvatarColor(row.inspectorName || row.inspector_name)} flex items-center justify-center text-xs font-semibold shadow-sm`}>

                                    {getInitials(row.inspectorName || row.inspector_name)}

                                  </div>

                                  <span className="text-[var(--text-primary)] text-sm font-medium">{row.inspectorName || row.inspector_name}</span>

                                </div>

                              )}

                            </td>

                          )}

                          {visibleColumns.date && (

                            <td className="py-4 px-4 whitespace-nowrap">

                              <span className="text-[var(--text-primary)] font-medium text-sm">{formatDate(row.inspectionDate || row.inspection_date)}</span>

                            </td>

                          )}

                          {/* Custom Columns Cells */}

                          {customColumns.filter(col => visibleColumns[col]).map(col => (

                            <td key={col} className="py-4 px-4">

                              <span className="text-[var(--text-primary)] font-medium text-sm">{row[col] || '-'}</span>

                            </td>

                          ))}

                          {visibleColumns.actions && (

                            <td className="py-4 px-4 text-center sticky right-0 z-10 bg-[var(--bg-surface)]" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>

                              <div className="flex items-center justify-center gap-1">

                                <button

                                  onClick={() => handleView(row.id)}

                                  className="p-1.5 text-[var(--text-secondary)] rounded-xl transition-all hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"

                                  title="View"

                                >

                                  <Eye className="w-4 h-4" />

                                </button>

                                {hasUpdate && (

                                  <button

                                    onClick={() => handleEdit(row.id)}

                                    className="p-1.5 text-[var(--text-secondary)] rounded-xl transition-all hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"

                                    title="Edit"

                                  >

                                    <Edit className="w-4 h-4" />

                                  </button>

                                )}

                                {hasDelete && (

                                  <button

                                    onClick={() => handleDelete(row.id)}

                                    className="p-1.5 text-[var(--text-secondary)] rounded-xl transition-all hover:bg-red-50 hover:text-red-600"

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

                      bg: 'bg-[var(--bg-primary)]',

                      border: 'border-[var(--border-color)]',

                      header: 'bg-[var(--bg-surface)]',

                      text: 'text-[var(--color-warning)]',

                      dot: 'bg-orange-500'

                    };

                    if (status === 'completed') return {

                      bg: 'bg-[var(--bg-primary)]',

                      border: 'border-[var(--border-color)]',

                      header: 'bg-[var(--bg-surface)]',

                      text: 'text-[var(--color-success)]',

                      dot: 'bg-emerald-500'

                    };

                    if (status === 'action required') return {

                      bg: 'bg-[var(--bg-primary)]',

                      border: 'border-[var(--border-color)]',

                      header: 'bg-[var(--bg-surface)]',

                      text: 'text-[var(--color-error)]',

                      dot: 'bg-red-500'

                    };

                    return {

                      bg: 'bg-[var(--bg-primary)]',

                      border: 'border-[var(--border-color)]',

                      header: 'bg-[var(--bg-surface)]',

                      text: 'text-[var(--text-primary)]',

                      dot: 'bg-gray-500'

                    };

                  };



                  const style = getStatusStyle(status);

                  const displayStatus = status.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');



                  return (

                    <div key={status} className="shrink-0 w-80">

                      <div className={`rounded-xl border ${style.border} ${style.bg}`}>

                        {/* Column Header */}

                        <div className={`${style.header} px-4 py-3 border-b ${style.border}`}>

                          <div className="flex items-center justify-between">

                            <div className="flex items-center gap-2">

                              <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>

                              <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>

                                {displayStatus}

                              </h3>

                            </div>



                            <span className="bg-[var(--bg-surface)] px-2 py-0.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)]">

                              {statusItems.length}

                            </span>

                          </div>

                        </div>



                        {/* Cards Container */}

                        <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">

                          {statusItems.length === 0 ? (

                            <div className="text-center py-8 px-4">

                              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-[var(--text-secondary)]/40" />

                              <p className="text-[var(--text-secondary)] text-sm">No inspections</p>

                            </div>

                          ) : (

                            statusItems.map((insp) => {

                              const priorityColor = getPriorityColor(insp.priority || "Medium");



                              return (

                                <div

                                  key={insp.id}

                                  className={`bg-[var(--bg-surface)] rounded-xl p-4 shadow-sm border border-[var(--border-color)] hover:shadow-md transition-all cursor-pointer ${deletingIds.has(insp.id) ? 'inspection-card-deleting' : ''}`}

                                  onClick={() => handleView(insp.id)}

                                >

                                  {/* Card Header */}

                                  <div className="flex items-center justify-between mb-2">

                                    <span className="text-xs font-mono text-[var(--text-secondary)]/60">{insp.reference || `INS-${insp.id}`}</span>

                                    <div className="flex items-center gap-1.5">

                                      <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>

                                      <span className={`text-xs font-medium ${priorityColor.text}`}>

                                        {insp.priority || "Medium"}

                                      </span>

                                    </div>

                                  </div>



                                  {/* Title */}

                                  <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-2 line-clamp-2">

                                    {insp.inspectionType || insp.inspection_type || "Inspection"}

                                  </h4>



                                  {/* Property */}

                                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs mb-2">

                                    <Home className="w-3 h-3" />

                                    <span className="truncate">

                                      {insp.propertyName || insp.property_name || "Unknown Property"}

                                    </span>

                                  </div>



                                  {/* Findings */}

                                  {insp.findings && (

                                    <p className="text-xs text-[var(--text-secondary)]/80 mb-3 line-clamp-2">

                                      {insp.findings}

                                    </p>

                                  )}



                                  {/* Issues Badge */}

                                  {insp.issuesFound > 0 && (

                                    <div className="mb-3">

                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium border border-[var(--border-color)]"

                                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--color-error)' }}>

                                        <AlertCircle className="w-3 h-3" />

                                        {insp.issuesFound} {insp.issuesFound === 1 ? 'issue' : 'issues'} found

                                      </span>

                                    </div>

                                  )}



                                  {/* Card Footer */}

                                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mb-2">

                                    {/* Inspector */}

                                    <div className="flex items-center gap-2">

                                      {insp.inspectorName || insp.inspector_name ? (

                                        <>

                                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(insp.inspectorName || insp.inspector_name)} flex items-center justify-center text-xs font-semibold`}>

                                            {getInitials(insp.inspectorName || insp.inspector_name)}

                                          </div>

                                          <span className="text-xs text-[var(--text-primary)] truncate max-w-[100px]">

                                            {insp.inspectorName || insp.inspector_name}

                                          </span>

                                        </>

                                      ) : (

                                        <span className="text-xs text-[var(--text-secondary)]/40">No inspector</span>

                                      )}

                                    </div>



                                    {/* Date */}

                                    <span className="text-xs text-[var(--text-secondary)]/60">

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

                                      className="flex-1 py-1.5 px-2 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl text-xs font-medium flex items-center justify-center gap-1 hover:bg-[var(--bg-primary)]/80 transition-colors"

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

                                        className="p-1.5 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-primary)]/80 transition-colors"

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

                                        className="p-1.5 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"

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

      {

        showModal && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">

            <div className="bg-[var(--bg-surface)] rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[70vh] border border-[var(--border-color)]">



              {/* Modal Header */}

              <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] shrink-0">

                <h3 className="text-lg font-bold text-[var(--text-primary)]">

                  {editingId ? "Edit Inspection" : "Create Inspection"}

                </h3>

                <button

                  onClick={() => { setShowModal(false); setError(null); }}

                  className="text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] transition-colors rounded-xl"

                >

                  <X className="w-5 h-5" />

                </button>

              </div>



              {/* Modal Form Content */}

              <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                  {error && (

                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">

                      {error}

                    </div>

                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Same form fields as original */}

                    <div className="col-span-1 md:col-span-2">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Inspection Type <span className="text-red-500">*</span></label>

                      <select

                        name="inspectionType"

                        required

                        value={formData.inspectionType}

                        onChange={handleInspectionTypeChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

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

                            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"

                          />

                          <button

                            type="button"

                            onClick={saveCustomInspectionType}

                            className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors"

                          >

                            Add

                          </button>

                          <button

                            type="button"

                            onClick={() => {

                              setShowCustomInspectionTypeInput(false);

                              setCustomInspectionTypeValue('');

                            }}

                            className="px-3 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium transition-colors"

                          >

                            Cancel

                          </button>

                        </div>

                      )}

                    </div>



                    <div className="col-span-1">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Property <span className="text-red-500">*</span></label>

                      <select

                        name="propertyId"

                        required

                        value={formData.propertyId}

                        onChange={handlePropertyChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      >

                        <option value="">Select property</option>

                        {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}

                      </select>

                      {hotelsLoading && <div className="text-xs text-gray-400 mt-0.5">Loading hotels...</div>}

                    </div>

                    <div className="col-span-1">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Service User <span className="text-red-500">*</span></label>

                      <select

                        name="serviceUserId"

                        required

                        value={formData.serviceUserId}

                        onChange={handleServiceUserChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      >

                        <option value="">Select service user</option>

                        {!!formData.serviceUserId && !serviceUsers.some(s => String(s.id) === String(formData.serviceUserId)) && (

                          <option value={formData.serviceUserId}>{formData.serviceUserName || formData.serviceUserId}</option>

                        )}

                        {serviceUsers.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}

                      </select>

                    </div>



                    <div className="col-span-1">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Inspector Name <span className="text-red-500">*</span></label>

                      <input

                        type="text"

                        name="inspectorName"

                        value={formData.inspectorName}

                        readOnly

                        title="Inspector name is automatically set to your user name"

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] cursor-not-allowed focus:outline-none"

                      />

                    </div>

                    <div className="col-span-1">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Inspection Date <span className="text-red-500">*</span></label>

                      <input

                        type="date"

                        name="inspectionDate"

                        required

                        value={formData.inspectionDate}

                        onChange={handleInputChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      />

                    </div>



                    <div className="col-span-1 md:col-span-2">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Findings <span className="text-red-500">*</span></label>

                      <textarea

                        name="findings"

                        required

                        rows={3}

                        value={formData.findings}

                        onChange={handleInputChange}

                        placeholder="Describe inspection findings..."

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      />

                    </div>



                    <div className="col-span-1">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Issues Found <span className="text-red-500">*</span></label>

                      <input

                        type="number"

                        name="issuesFound"

                        required

                        value={formData.issuesFound}

                        onChange={handleInputChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      />

                    </div>

                    <div className="col-span-1">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Action Required <span className="text-red-500">*</span></label>

                      <select

                        name="actionRequired"

                        required

                        value={formData.actionRequired}

                        onChange={handleInputChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      >

                        <option value="">Select</option>

                        <option value="true">Yes</option>

                        <option value="false">No</option>

                      </select>

                    </div>



                    <div className="col-span-1 md:col-span-2">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Status <span className="text-red-500">*</span></label>

                      <select

                        name="status"

                        required

                        value={formData.status}

                        onChange={handleInputChange}

                        className="w-full border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"

                      >

                        <option value="pending">Pending</option>

                        <option value="completed">Completed</option>

                        <option value="in_progress">In Progress</option>

                      </select>

                    </div>



                    <div className="col-span-1 md:col-span-2 mt-4">

                      <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Attachments</label>

                      <input

                        type="file"

                        accept="image/*"

                        multiple

                        onChange={(e) => {

                          const files = Array.from(e.target.files || []);

                          setPhotos(files);

                        }}

                        className="w-full border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all"

                      />



                      {editingId && (() => {

                        const inspection = inspections.find(i => String(i.id) === String(editingId));

                        if (!inspection) return null;

                        let list = [];

                        try {

                          const raw = inspection.attachments ?? inspection.attachments_ids ?? inspection.photos ?? [];

                          if (Array.isArray(raw)) list = raw;

                          else if (typeof raw === 'string' && raw.trim()) {

                            const parsed = JSON.parse(raw);

                            if (Array.isArray(parsed)) list = parsed;

                          }

                        } catch { list = []; }

                        const items = list.filter(Boolean);

                        if (items.length === 0) return null;

                        return (

                          <div className="mt-8 space-y-4">

                            <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 ml-1">Existing Attachments</h3>

                            {items.map((id, idx) => (

                              <div key={idx} className="flex items-center justify-between bg-white border border-gray-100/80 rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] transition-all duration-300">

                                <div className="flex items-center gap-3">

                                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">

                                    <Eye size={18} className="text-slate-400" />

                                  </div>

                                  <span className="text-sm font-bold text-slate-700">Attachment #{idx + 1}</span>

                                </div>

                                <div className="flex gap-3">

                                  <button

                                    type="button"

                                    onClick={() => openAttachmentsGallery([id])}

                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[11px] font-bold text-teal-700 shadow-sm hover:bg-gray-50 hover:border-teal-200 transition-all uppercase tracking-wider"

                                  >

                                    <Eye size={14} />

                                    View

                                  </button>

                                  <button

                                    type="button"

                                    onClick={() => removeAttachment(id)}

                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-100 rounded-xl text-[11px] font-bold text-red-600 shadow-sm hover:bg-red-50 hover:border-red-200 transition-all uppercase tracking-wider"

                                  >

                                    <Trash2 size={14} />

                                    Remove

                                  </button>

                                </div>

                              </div>

                            ))}

                          </div>

                        );

                      })()}

                    </div>

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

                          <label className="block text-sm font-semibold text-slate-700 mb-2">

                            {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} <span className="text-red-500">*</span>

                          </label>

                          {isCheckbox ? (

                            <select

                              name={col}

                              required

                              value={formData[col] === true ? 'true' : formData[col] === false ? 'false' : (formData[col] || '')}

                              onChange={handleInputChange}

                              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}

                            >

                              <option value="">Select</option>

                              <option value="true">Yes</option>

                              <option value="false">No</option>

                            </select>

                          ) : inputType === 'dropdown' || inputType === 'select' ? (

                            <select

                              name={col}

                              required

                              value={formData[col] || ''}

                              onChange={handleInputChange}

                              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}

                            >

                              <option value="">Select {col.replace(/_/g, ' ')}</option>

                              {parsedOptions.map((opt, idx) => (

                                <option key={idx} value={opt}>{opt}</option>

                              ))}

                            </select>

                          ) : inputType === 'textarea' ? (

                            <textarea

                              name={col}

                              required

                              value={formData[col] || ''}

                              onChange={handleInputChange}

                              rows={3}

                              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}

                              placeholder={`Enter ${col.replace(/_/g, ' ')}`}

                            />

                          ) : (

                            <input

                              type={inputType === 'number' || customColumnTypes[col] === 'number' ? 'number' : inputType === 'date' || customColumnTypes[col] === 'date' ? 'date' : 'text'}

                              name={col}

                              required

                              value={formData[col] || ''}

                              onChange={handleInputChange}

                              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 ${fieldErrors[col] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}

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

                <div className="shrink-0 flex justify-end gap-3 p-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/50 rounded-b-xl">

                  {error && <div className="text-sm text-red-500 mr-auto font-medium">{error}</div>}

                  <button

                    type="button"

                    onClick={() => { setShowModal(false); setError(null); setPhotos([]); }}

                    className="px-6 py-2.5 border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] bg-[var(--bg-surface)] font-medium transition-all text-sm shadow-sm hover:bg-[var(--bg-primary)]"

                  >

                    Cancel

                  </button>

                  <button

                    type="submit"

                    disabled={submitting}

                    className="px-6 py-2.5 bg-teal-500 text-white rounded-xl font-medium shadow-md transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"

                  >

                    {submitting ? "Saving..." : (editingId ? "Update Inspection" : "Create Inspection")}

                  </button>

                </div>

              </form>

            </div>

          </div>

        )

      }



      {/* View Details Modal */}

      {

        showViewModal && viewingInspection && (

          <div className="modal-overlay">

            <div className="modal-container h-[70vh]">

              <div className="modal-header">

                <div>

                  <h2 className="modal-title">Inspection Details</h2>

                  <p className="modal-subtitle">View inspection information</p>

                </div>

                <button

                  onClick={() => setShowViewModal(false)}

                  className="modal-close-btn"

                >

                  <X className="w-5 h-5" />

                </button>

              </div>



              <div className="modal-content text-left">

                <div className="form-grid-2">

                  <DetailField label="Inspection Type" value={viewingInspection.inspectionType || viewingInspection.inspection_type} />

                  <DetailField label="Property" value={viewingInspection.propertyName || viewingInspection.property_name} />

                  <DetailField label="Inspector" value={viewingInspection.inspectorName || viewingInspection.inspector_name} />

                  <DetailField label="Date" value={formatDate(viewingInspection.inspectionDate || viewingInspection.inspection_date)} />

                  <DetailField label="Service User" value={viewingInspection.serviceUserName || viewingInspection.serviceUser || viewingInspection.service_user_name || viewingInspection.service_user} />

                  <DetailField label="Issues Found" value={viewingInspection.issuesFound || viewingInspection.issues_found || '0'} />



                  <DetailField label="Action Required" value={(viewingInspection.actionRequired || viewingInspection.action_required) ? 'Yes' : 'No'} />

                  <DetailField label="Status" value={viewingInspection.status} />

                  <DetailField label="Priority" value={viewingInspection.priority} />



                  {(customColumns || []).map(col => (

                    <DetailField

                      key={col}

                      label={col.replace(/_/g, ' ')}

                      value={viewingInspection[col] !== undefined && viewingInspection[col] !== null && viewingInspection[col] !== ''

                        ? String(viewingInspection[col])

                        : '-'}

                      fullWidth={customColumnMetadata[col]?.input_type === 'textarea'}

                    />

                  ))}



                  <DetailField label="Findings" value={viewingInspection.findings} fullWidth={true} />



                  {(() => {

                    let list = viewingInspection.attachments ?? viewingInspection.attachments_ids ?? viewingInspection.photos ?? [];

                    try {

                      if (typeof list === 'string' && list) list = JSON.parse(list);

                    } catch {

                      list = [];

                    }

                    const items = (Array.isArray(list) ? list : []).filter(Boolean);

                    if (!items.length) return null;

                    return (

                      <div className="md:col-span-2">

                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Attachments</label>

                        <button

                          type="button"

                          onClick={() => openAttachmentsGallery(items)}

                          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-4 py-2 rounded-xl"

                        >

                          <Eye className="w-4 h-4" />

                          <span>View {items.length} Photos</span>

                        </button>

                      </div>

                    );

                  })()}

                </div>

              </div>



              <div className="modal-footer">

                <button

                  onClick={() => setShowViewModal(false)}

                  className="btn-secondary btn-sm rounded-xl"

                >

                  Close

                </button>

                {hasUpdate && (

                  <button

                    onClick={() => {

                      setShowViewModal(false);

                      handleEdit(viewingInspection.id);

                    }}

                    className="btn-primary btn-sm flex items-center gap-2 rounded-xl"

                  >

                    <Edit className="w-4 h-4" />

                    Edit

                  </button>

                )}

              </div>

            </div>

          </div>

        )

      }



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

        <ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />

    </div >

  );

}