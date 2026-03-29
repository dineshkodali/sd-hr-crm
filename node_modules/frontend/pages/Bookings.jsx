/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Home,
  UserPlus,
  Search,
  Users,
  UserCheck,
  UserX,
  Calendar,
  Building,
  BedDouble,
  Check,
  X,
  ChevronDown,
  Filter,
  Eye,
  EyeOff,
  Columns,
  ClipboardList,
  Upload,
  Edit,
  Trash2
} from "lucide-react";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

/* Helper functions */
function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  } catch { return value; }
}

function getStatusColor(s) {
  const low = String(s).toLowerCase();
  if (low === "checked in") return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
  if (low === "checked out") return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
  if (low === "late checkout") return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
  if (low === "pending") return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
}

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'bookings-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = DELETE_STYLE_ID;
  style.textContent = `
    @keyframes bookingSlideOut {
      0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
      40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
      100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
    }
    @keyframes boardCardDelete {
      0%   { opacity: 1; transform: scale(1) rotate(0deg); }
      30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
      100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
    }
    tr.booking-deleting {
      animation: bookingSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
      overflow: hidden;
      pointer-events: none;
    }
    .board-card-deleting {
      animation: boardCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

/* Static mock rooms — defined outside component to avoid recreation */
const MOCK_ROOMS = [
  { id: 1, room_number: '101', type: 'Single', capacity: 1, property_id: 1, status: 'Available' },
  { id: 2, room_number: '102', type: 'Single', capacity: 1, property_id: 1, status: 'Available' },
  { id: 3, room_number: '103', type: 'Private', capacity: 2, property_id: 1, status: 'Available' },
  { id: 4, room_number: '104', type: 'Private', capacity: 2, property_id: 1, status: 'Occupied' },
  { id: 5, room_number: '105', type: 'Shared', capacity: 4, property_id: 1, status: 'Available' },
  { id: 6, room_number: '106', type: 'Shared', capacity: 4, property_id: 1, status: 'Available' },
  { id: 7, room_number: '107', type: 'Sole', capacity: 1, property_id: 1, status: 'Available' },
  { id: 8, room_number: '108', type: 'Sole', capacity: 1, property_id: 1, status: 'Available' },
  { id: 9, room_number: '201', type: 'Single', capacity: 1, property_id: 2, status: 'Available' },
  { id: 10, room_number: '202', type: 'Private', capacity: 2, property_id: 2, status: 'Available' },
  { id: 11, room_number: '203', type: 'Shared', capacity: 6, property_id: 2, status: 'Available' },
  { id: 12, room_number: '204', type: 'Shared', capacity: 6, property_id: 2, status: 'Occupied' },
  { id: 13, room_number: '205', type: 'Single', capacity: 1, property_id: 2, status: 'Available' },
  { id: 14, room_number: '206', type: 'Sole', capacity: 1, property_id: 2, status: 'Available' },
  { id: 15, room_number: '301', type: 'Private', capacity: 2, property_id: 3, status: 'Available' },
  { id: 16, room_number: '302', type: 'Private', capacity: 2, property_id: 3, status: 'Available' },
  { id: 17, room_number: '303', type: 'Shared', capacity: 4, property_id: 3, status: 'Available' },
  { id: 18, room_number: '304', type: 'Single', capacity: 1, property_id: 3, status: 'Available' },
  { id: 19, room_number: '305', type: 'Sole', capacity: 1, property_id: 3, status: 'Occupied' },
  { id: 20, room_number: '306', type: 'Shared', capacity: 8, property_id: 3, status: 'Available' },
  { id: 21, room_number: 'A1', type: 'Single', capacity: 1, property_id: 4, status: 'Available' },
  { id: 22, room_number: 'A2', type: 'Private', capacity: 2, property_id: 4, status: 'Available' },
  { id: 23, room_number: 'A3', type: 'Shared', capacity: 4, property_id: 4, status: 'Available' },
  { id: 24, room_number: 'B1', type: 'Single', capacity: 1, property_id: 4, status: 'Available' },
  { id: 25, room_number: 'B2', type: 'Sole', capacity: 1, property_id: 4, status: 'Available' },
  { id: 26, room_number: 'B3', type: 'Shared', capacity: 6, property_id: 4, status: 'Available' },
];

const ALL_COLUMNS = [
  "checkbox", "name", "order_no", "room", "check_in",
  "day", "guests", "origin", "immigration_status", "status", "actions",
];

/* Build booking from service-user + lookup maps */
function buildBooking(su, moveInMap, roomMap, propertyMap) {
  const moveIn = moveInMap[su.id] ?? moveInMap[su.service_user_id];
  const roomId = su.room_id ?? moveIn?.room_id;
  const propertyId = su.property_id ?? moveIn?.property_id;
  const room = roomId != null ? roomMap[roomId] : undefined;
  const property = propertyId != null ? propertyMap[propertyId] : undefined;
  const checkInDate = su.admission_date ?? su.check_in_date ?? moveIn?.move_in_date;
  let dayOfWeek = '';
  if (checkInDate) {
    try { dayOfWeek = new Date(checkInDate).toLocaleDateString('en-US', { weekday: 'short' }); } catch { }
  }
  return {
    id: su.id ?? su.service_user_id,
    service_user_id: su.id ?? su.service_user_id,
    _su: su,
    move_in_id: moveIn?.id,
    full_name: `${su.first_name ?? ''} ${su.last_name ?? ''}`.trim(),
    first_name: su.first_name,
    last_name: su.last_name,
    order_no: su.home_office_reference ?? 'N/A',
    room: room?.room_number ?? 'Unassigned',
    room_type: room?.type ?? 'N/A',
    room_id: roomId,
    property_id: propertyId,
    property_name: property?.name ?? su.property_name ?? moveIn?.property_name ?? 'Unknown',
    check_in: checkInDate ?? 'N/A',
    day: dayOfWeek,
    guests: 1,
    origin: su.nationality ?? 'N/A',
    immigration_status: su.immigration_status ?? 'Pending',
    status: su.status ?? moveIn?.status ?? 'Pending',
    date_of_birth: su.date_of_birth ?? su.dob,
    nationality: su.nationality,
    home_office_reference: su.home_office_reference,
    vulnerabilities: su.vulnerabilities,
    medical_conditions: su.medical_conditions,
    dietary_requirements: su.dietary_requirements,
  };
}

export default function Bookings({ user }) {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [suColumns, setSuColumns] = useState([]);
  const [suColumnsLoading, setSuColumnsLoading] = useState(false);

  /* ─── Data ─── */
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  // Track rows currently being deleted for animation
  const [deletingIds, setDeletingIds] = useState(new Set());
  // Separate loading flags so we can show partial data immediately
  const [loadingServiceUsers, setLoadingServiceUsers] = useState(false);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);

  /* ─── Filters ─── */
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [sortBy, setSortBy] = useState('');

  /* ─── View ─── */
  const [viewMode, setViewMode] = useState('table');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showColumnVisibility, setShowColumnVisibility] = useState(false);
  const viewRef = useRef(null);
  const [visibleColumns, setVisibleColumns] = useState(
    ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {})
  );

  /* ─── Form ─── */
  const BASE_FORM_STATE = useMemo(() => ({
    first_name: '', last_name: '', date_of_birth: '', nationality: '',
    home_office_reference: '', property_id: '', room_id: '',
    check_in_date: '', vulnerabilities: '', medical_conditions: '', dietary_requirements: ''
  }), []);

  const [formData, setFormData] = useState(BASE_FORM_STATE);

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning' });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedExportKeys, setSelectedExportKeys] = useState([]);

  const api = useMemo(() => axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
    timeout: 15000
  }), []);

  const labelize = (name) => {
    return String(name || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const parseInputOptions = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.options)) return parsed.options;
        return [];
      } catch {
        return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    if (typeof raw === 'object') {
      if (Array.isArray(raw.options)) return raw.options;
    }
    return [];
  };

  const fetchServiceUserColumns = useCallback(async () => {
    setSuColumnsLoading(true);
    try {
      const res = await api.get('/api/forms-builder/tables/service_users/columns', { noCache: true });
      const cols = res?.data?.columns || [];
      setSuColumns(Array.isArray(cols) ? cols : []);
      return Array.isArray(cols) ? cols : [];
    } catch {
      setSuColumns([]);
      return [];
    } finally {
      setSuColumnsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchServiceUserColumns().catch(() => null);
  }, [fetchServiceUserColumns]);

  const RESERVED_KEYS = useMemo(() => new Set([
    'id', 'created_at', 'updated_at', 'created_by',
    'first_name', 'last_name', 'full_name',
    'date_of_birth', 'dob',
    'nationality', 'gender', 'immigration_status', 'home_office_reference',
    'hotel_id', 'property_id', 'room_id', 'room_number',
    'admission_date', 'check_in_date',
    'number_of_dependents',
    'emergency_contact_name', 'emergency_contact_phone',
    'vulnerabilities', 'medical_conditions', 'dietary_requirements',
    'family_type', 'status',
  ]), []);

  const HIDDEN_DYNAMIC_KEYS = useMemo(() => new Set([
    'property_id', 'propertyid',
    'documents',
    'complaints_summary',
    'maintenance_summary',
    'move_in_date', 'movein_date',
  ]), []);

  const dynamicColumns = useMemo(() => {
    const cols = Array.isArray(suColumns) ? suColumns : [];
    return cols
      .filter((c) => {
        const name = String(c?.column_name || '').trim();
        if (!name) return false;
        const lower = name.toLowerCase();
        if (RESERVED_KEYS.has(lower)) return false;
        if (HIDDEN_DYNAMIC_KEYS.has(lower)) return false;
        return true;
      })
      .sort((a, b) => Number(a?.ordinal_position || 0) - Number(b?.ordinal_position || 0));
  }, [suColumns, RESERVED_KEYS, HIDDEN_DYNAMIC_KEYS]);

  const normalizeDynamicInputValue = (col, rawValue) => {
    const v = rawValue;
    const inputType = String(col?.input_type || '').toLowerCase();
    const inputTypeNorm = inputType === 'dropdown' ? 'select' : inputType;
    const opts = parseInputOptions(col?.input_options);

    if (v === null || v === undefined) {
      if (inputTypeNorm === 'checkbox') return (opts && opts.length) ? [] : false;
      return '';
    }

    if (inputTypeNorm === 'checkbox') {
      if (opts && opts.length) {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
          }
        }
        return [v];
      }
      return Boolean(v);
    }

    return String(v);
  };

  const renderDynamicField = useCallback((col) => {
    const key = String(col?.column_name || '').trim();
    if (!key) return null;
    const label = labelize(key);
    const inputTypeRaw = String(col?.input_type || '').toLowerCase();
    const inputType = inputTypeRaw === 'dropdown' ? 'select' : inputTypeRaw;
    const dataType = String(col?.data_type || '').toLowerCase();
    const opts = parseInputOptions(col?.input_options);

    if (inputType === 'textarea') {
      return (
        <div key={key} className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">{label}</label>
          <textarea
            rows={2}
            value={formData?.[key] ?? ''}
            onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
            className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 !h-auto"
          />
        </div>
      );
    }

    if (inputType === 'select' || inputType === 'radio') {
      return (
        <div key={key} className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">{label}</label>
          <select
            value={formData?.[key] ?? ''}
            onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
            className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            <option value="">Select</option>
            {(opts || []).map((o, idx) => {
              const v = typeof o === 'string' ? o : (o?.value ?? o?.label ?? String(o));
              const t = typeof o === 'string' ? o : (o?.label ?? o?.value ?? String(o));
              return <option key={`${key}-${idx}`} value={v}>{t}</option>;
            })}
          </select>
        </div>
      );
    }

    if (inputType === 'checkbox') {
      if (opts && opts.length) {
        const selected = Array.isArray(formData?.[key]) ? formData[key] : [];
        return (
          <div key={key} className="form-group">
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">{label}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(opts || []).map((o, idx) => {
                const v = typeof o === 'string' ? o : (o?.value ?? o?.label ?? String(o));
                const t = typeof o === 'string' ? o : (o?.label ?? o?.value ?? String(o));
                const checked = selected.includes(v);
                return (
                  <label key={`${key}-${idx}`} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-primary)] p-2 rounded-xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-primary)]/80 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      className="w-4 h-4 text-teal-500 border-[var(--border-color)] bg-[var(--bg-surface)] rounded"
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(v);
                        else next.delete(v);
                        setFormData((p) => ({ ...p, [key]: Array.from(next) }));
                      }}
                    />
                    <span>{t}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      }

      return (
        <div key={key} className="form-group">
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-primary)]/80 transition-colors">
            <input
              type="checkbox"
              checked={Boolean(formData?.[key])}
              className="w-4 h-4 text-teal-500 border-[var(--border-color)] bg-[var(--bg-surface)] rounded"
              onChange={(e) => setFormData((p) => ({ ...p, [key]: !!e.target.checked }))}
            />
            <span>{label}</span>
          </label>
        </div>
      );
    }

    let htmlType = 'text';
    if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('double') || dataType.includes('real')) {
      htmlType = 'number';
    } else if (dataType === 'date') {
      htmlType = 'date';
    } else if (dataType.includes('timestamp')) {
      htmlType = 'datetime-local';
    }

    return (
      <div key={key} className="form-group">
        <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">{label}</label>
        <input
          type={htmlType}
          value={formData?.[key] ?? ''}
          onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
          className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
        />
      </div>
    );
  }, [formData, dynamicColumns, parseInputOptions, labelize]);

  const formatDynamicValue = (col, rawValue) => {
    const inputType = String(col?.input_type || '').toLowerCase();
    const inputTypeNorm = inputType === 'dropdown' ? 'select' : inputType;
    const opts = parseInputOptions(col?.input_options);
    const v = rawValue;

    if (v === null || v === undefined || v === '') return 'N/A';

    if (inputTypeNorm === 'checkbox') {
      if (opts && opts.length) {
        let arr = [];
        if (Array.isArray(v)) arr = v;
        else if (typeof v === 'string') {
          const trimmed = v.trim();
          if (!trimmed) arr = [];
          else {
            try {
              const parsed = JSON.parse(trimmed);
              arr = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              arr = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
            }
          }
        } else {
          arr = [v];
        }
        return arr.length ? arr.map((x) => String(x)).join(', ') : 'No';
      }

      if (v === true) return 'Yes';
      if (v === false) return 'No';
      if (Array.isArray(v)) return v.length ? 'Yes' : 'No';
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes') return 'Yes';
        if (s === 'false' || s === '0' || s === 'no' || s === '[]') return 'No';
      }
    }

    return String(v);
  };

  /* ═══════════════════════════════════════════════════════
     PERFORMANCE FIX: Parallel data loading
     1. Fetch service-users AND properties AND move-ins simultaneously
     2. Show booking rows as soon as service-users arrive (no enrichment wait)
     3. Enrich with room/property names in a second pass, also in parallel
  ═══════════════════════════════════════════════════════ */
  const loadData = useCallback(async () => {
    setLoadingServiceUsers(true);

    try {
      /* Phase 1 — fetch the three core datasets in parallel */
      const [suResult, propertiesResult, moveInsResult] = await Promise.allSettled([
        api.get('/api/su/users'),
        api.get('/api/hotels'),
        api.get('/api/move-ins'),
      ]);

      /* Extract safe values */
      const rawUsers = suResult.status === 'fulfilled'
        ? (suResult.value.data?.users ?? suResult.value.data ?? [])
        : [];
      const serviceUsers = Array.isArray(rawUsers) ? rawUsers : [];

      const rawProps = propertiesResult.status === 'fulfilled'
        ? (propertiesResult.value.data?.hotels ?? propertiesResult.value.data?.data ?? propertiesResult.value.data ?? [])
        : [];
      const fetchedProperties = Array.isArray(rawProps) ? rawProps : [];

      const rawMoveIns = moveInsResult.status === 'fulfilled'
        ? (moveInsResult.value.data?.moveIns ?? moveInsResult.value.data ?? [])
        : [];
      const moveIns = Array.isArray(rawMoveIns) ? rawMoveIns : [];

      /* Update properties immediately so filters populate */
      setProperties(fetchedProperties);

      /* Build fast lookup maps */
      const moveInMap = {};
      for (const m of moveIns) {
        const key = m.service_user_id;
        if (key != null) moveInMap[key] = m;
      }

      const propertyMap = {};
      for (const p of fetchedProperties) {
        if (p.id != null) propertyMap[p.id] = p;
      }

      /* Phase 2a — render rows immediately using mock rooms as placeholder */
      const roomMap = {};
      for (const r of MOCK_ROOMS) roomMap[r.id] = r;

      const initialBookings = serviceUsers.map(su =>
        buildBooking(su, moveInMap, roomMap, propertyMap)
      );
      setBookings(initialBookings);
      setLoadingServiceUsers(false); // table shows now

      /* Phase 2b — fetch real rooms for each unique property in parallel */
      setLoadingEnrichment(true);
      const uniquePropertyIds = [
        ...new Set(
          serviceUsers.map(s => s.property_id)
            .concat(moveIns.map(m => m.property_id))
            .filter(v => v != null && v !== '')
            .map(v => String(v))
        )
      ];

      const roomResults = await Promise.allSettled(
        uniquePropertyIds.map(pid =>
          api.get(`/api/hotels/${encodeURIComponent(pid)}/rooms`)
            .then(r => ({ pid, rooms: r.data?.rooms ?? r.data?.data ?? r.data ?? [] }))
        )
      );

      const realRoomMap = { ...roomMap }; // start with mock as fallback
      let anyRealRooms = false;
      for (const res of roomResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value.rooms)) {
          for (const r of res.value.rooms) {
            if (r.id != null) { realRoomMap[r.id] = r; anyRealRooms = true; }
          }
        }
      }

      /* Phase 2c — re-render with enriched data if we got real rooms */
      if (anyRealRooms) {
        const enriched = serviceUsers.map(su =>
          buildBooking(su, moveInMap, realRoomMap, propertyMap)
        );
        setBookings(enriched);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
      /* Fallback stub */
      setBookings([{
        id: 1, full_name: "Ahmad Martin", order_no: "H0-202512-7467",
        room: "005", room_type: "Standard", check_in: "2025-12-16",
        day: "Tue", guests: 1, origin: "Syria", status: "Checked In"
      }]);
    } finally {
      setLoadingServiceUsers(false);
      setLoadingEnrichment(false);
    }
  }, [api]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Modal body scroll lock */
  useEffect(() => {
    if (showModal || showViewModal || showEditModal || confirmDialog.isOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => { document.body.classList.remove('form-modal-open'); };
  }, [showModal, showViewModal, showEditModal, confirmDialog.isOpen]);

  /* Close view menu on outside click */
  useEffect(() => {
    function handleClickOutside(e) {
      if (viewRef.current && !viewRef.current.contains(e.target)) {
        setShowViewMenu(false);
        setShowColumnVisibility(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Room loader for form selects */
  const handlePropertyChange = useCallback(async (propertyId) => {
    setFormData(prev => ({ ...prev, property_id: propertyId, room_id: '' }));
    if (!propertyId) { setRooms([]); return; }
    try {
      const res = await api.get(`/api/hotels/${propertyId}/rooms`);
      const list = res.data?.rooms ?? res.data?.data ?? res.data ?? [];
      setRooms(Array.isArray(list) ? list : []);
    } catch {
      setRooms(MOCK_ROOMS.filter(r => r.property_id === parseInt(propertyId)));
    }
  }, [api]);

  /* ─── View / Edit handlers ─── */
  const handleView = useCallback((booking) => {
    setSelectedBooking(booking);
    setShowViewModal(true);
  }, []);

  const normalizeDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      if (value.includes("T")) return value.slice(0, 10);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  const handleEdit = useCallback((booking) => {
    setSelectedBooking(booking);
    if (booking?.property_id) handlePropertyChange(String(booking.property_id));
    const dobValue = booking.date_of_birth ?? booking.dob;
    setFormData((prev) => {
      const next = {
        first_name: booking.first_name ?? '',
        last_name: booking.last_name ?? '',
        date_of_birth: normalizeDateInput(dobValue),
        nationality: booking.nationality ?? '',
        home_office_reference: booking.home_office_reference ?? '',
        property_id: booking.property_id ?? '',
        room_id: booking.room_id ?? '',
        check_in_date: normalizeDateInput(booking.check_in),
        vulnerabilities: booking.vulnerabilities ?? '',
        medical_conditions: booking.medical_conditions ?? '',
        dietary_requirements: booking.dietary_requirements ?? ''
      };

      const rawSu = booking?._su || booking || {};
      for (const c of dynamicColumns) {
        const k = String(c?.column_name || '').trim();
        if (!k) continue;
        next[k] = normalizeDynamicInputValue(c, rawSu?.[k]);
      }
      return next;
    });
    setShowEditModal(true);
  }, [dynamicColumns, handlePropertyChange]);

  /* ─── DELETE with smooth animation ─── */
  const handleDelete = useCallback((booking) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Booking',
      message: `Are you sure you want to delete the booking for ${booking.full_name}?`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));

        /* Start animation immediately — optimistic UI */
        const id = booking.id;
        setDeletingIds(prev => new Set(prev).add(id));

        /* Wait for animation to finish, then remove from state */
        const ANIM_DURATION = 460;
        setTimeout(() => {
          setBookings(prev => prev.filter(b => b.id !== id));
          setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        }, ANIM_DURATION);

        /* Fire API calls in background (don't block UI) */
        try {
          if (booking.move_in_id) await api.delete(`/api/move-ins/${booking.move_in_id}`);
          if (booking.service_user_id) await api.delete(`/api/su/users/${booking.service_user_id}`);
        } catch (err) {
          console.error('Delete error:', err);
          /* On failure: restore the row */
          setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          setBookings(prev => {
            if (prev.find(b => b.id === id)) return prev;
            return [...prev, booking];
          });
          setAlertDialog({
            isOpen: true, title: 'Delete Failed',
            message: 'Failed to delete booking: ' + (err.response?.data?.error || err.message),
            type: 'error'
          });
        }
      }
    });
  }, [api]);

  /* ─── Submit new booking ─── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const required = ['first_name', 'last_name', 'date_of_birth', 'nationality',
      'property_id', 'room_id', 'check_in_date', 'vulnerabilities',
      'medical_conditions', 'dietary_requirements'];
    if (required.some(k => !formData[k])) { setError('Please fill in all required fields'); return; }
    try {
      setSubmitting(true);
      const isAdmin = user?.role === 'admin' || user?.role === 'manager';
      const initialStatus = isAdmin ? 'Active' : 'Pending Approval';
      const suData = {
        first_name: formData.first_name, last_name: formData.last_name,
        date_of_birth: formData.date_of_birth, nationality: formData.nationality,
        home_office_reference: formData.home_office_reference,
        vulnerabilities: formData.vulnerabilities || null,
        medical_conditions: formData.medical_conditions || null,
        dietary_requirements: formData.dietary_requirements || null,
        property_id: parseInt(formData.property_id), room_id: parseInt(formData.room_id),
        admission_date: formData.check_in_date, status: initialStatus,
        created_by: user?.id ?? user?.user_id ?? null
      };

      for (const c of dynamicColumns) {
        const k = String(c?.column_name || '').trim();
        if (!k) continue;
        const inputType = String(c?.input_type || '').toLowerCase();
        const opts = parseInputOptions(c?.input_options);
        const v = formData?.[k];
        if (inputType === 'checkbox') {
          if (opts && opts.length) {
            if (Array.isArray(v)) suData[k] = v;
            else if (typeof v === 'string' && v.trim()) suData[k] = v.split(',').map((s) => s.trim()).filter(Boolean);
            else if (v === true) suData[k] = [true];
            else suData[k] = [];
          } else {
            suData[k] = v ? [true] : [];
          }
        } else {
          suData[k] = v;
        }
      }
      const suResponse = await api.post('/api/su/users', suData);
      const serviceUserId = suResponse.data.id ?? suResponse.data.service_user_id ?? suResponse.data.user_id;
      if (!serviceUserId) throw new Error('Failed to create service user');
      await api.post('/api/move-ins', {
        service_user_id: serviceUserId, room_id: parseInt(formData.room_id),
        property_id: parseInt(formData.property_id), move_in_date: formData.check_in_date,
        status: initialStatus, notes: `Booking created on ${new Date().toLocaleDateString()}.`
      });
      setFormData((prev) => {
        const next = { ...BASE_FORM_STATE };
        for (const c of dynamicColumns) {
          const k = String(c?.column_name || '').trim();
          if (!k) continue;
          next[k] = '';
        }
        return next;
      });
      setShowModal(false);
      setRooms([]);
      await loadData();
      setAlertDialog({ isOpen: true, title: isAdmin ? 'Booking Created' : 'Booking Requested', message: isAdmin ? 'Booking created and active.' : 'Booking submitted! Pending admin approval.', type: 'success' });
    } catch (err) {
      setError(err.response?.data?.error ?? err.response?.data?.message ?? err.message ?? 'Failed to create booking.');
    } finally { setSubmitting(false); }
  };

  /* ─── Approval actions ─── */
  const handleApprove = useCallback(async (booking) => {
    try {
      await api.put(`/api/su/users/${booking.service_user_id}`, { status: 'Active' });
      if (booking.move_in_id) await api.put(`/api/move-ins/${booking.move_in_id}`, { status: 'Active' });
      /* Optimistic update */
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'Active' } : b));
      setAlertDialog({ isOpen: true, title: 'Approved', message: 'Booking approved successfully', type: 'success' });
    } catch (err) {
      setAlertDialog({ isOpen: true, title: 'Approval Failed', message: 'Failed to approve: ' + (err.response?.data?.error ?? err.message), type: 'error' });
    }
  }, [api]);

  const handleReject = useCallback((booking) => {
    setConfirmDialog({
      isOpen: true, title: 'Reject Booking',
      message: `Reject the booking for ${booking.full_name}? This cannot be undone.`,
      type: 'danger', confirmText: 'Reject',
      onConfirm: async () => {
        try {
          await api.put(`/api/su/users/${booking.service_user_id}`, { status: 'Rejected' });
          if (booking.move_in_id) await api.put(`/api/move-ins/${booking.move_in_id}`, { status: 'Rejected' });
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'Rejected' } : b));
          setAlertDialog({ isOpen: true, title: 'Rejected', message: 'Booking rejected.', type: 'info' });
        } catch (err) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({ isOpen: true, title: 'Rejection Failed', message: 'Failed: ' + (err.response?.data?.error ?? err.message), type: 'error' });
        }
      }
    });
  }, [api]);

  /* ─── Stats ─── */
  const stats = useMemo(() => ({
    checkedIn: bookings.filter(b => ['checked in', 'active'].includes(b.status?.toLowerCase())).length,
    checkedOut: bookings.filter(b => b.status?.toLowerCase() === 'checked out').length,
    totalGuests: bookings.reduce((s, b) => s + (b.guests || 0), 0),
    arrivingToday: bookings.filter(b => new Date(b.check_in).toDateString() === new Date().toDateString()).length,
    pendingApproval: bookings.filter(b => ['pending', 'pending approval'].includes(b.status?.toLowerCase())).length,
  }), [bookings]);

  /* ─── Filtering ─── */
  const filteredBookings = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = bookings.filter(b => {
      const s = (b.status || "").toLowerCase();
      if (activeTab === 'checked-in' && s !== 'checked in' && s !== 'active') return false;
      if (activeTab === 'arriving' && b.day?.toLowerCase() !== 'today') return false;
      if (activeTab === 'late' && !s.includes('late')) return false;
      if (activeTab === 'pending' && s !== 'pending' && s !== 'pending approval') return false;
      if (q && ![b.full_name, b.order_no, b.room, b.room_type, b.property_name, b.status].some(v => (v || '').toLowerCase().includes(q))) return false;
      if (filterStatus && s !== filterStatus.toLowerCase()) return false;
      if (filterProperty && String(b.property_id) !== String(filterProperty)) return false;
      return true;
    });
    if (sortBy) {
      list = [...list].sort((a, b) => {
        if (sortBy === 'date') return new Date(b.check_in || 0) - new Date(a.check_in || 0);
        if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
        if (sortBy === 'room') return (a.room || '').localeCompare(b.room || '');
        if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
        return 0;
      });
    }
    return list;
  }, [bookings, query, filterStatus, filterProperty, sortBy, activeTab]);

  /* ─── Export ─── */
  const exportColumns = useMemo(() => [
    { header: 'Name', key: 'full_name' }, { header: 'Order No', key: 'order_no' },
    { header: 'Property', key: 'property_name' }, { header: 'Room', key: 'room_number' },
    { header: 'Check-In', key: 'check_in' }, { header: 'Day', key: 'day' },
    { header: 'Guests', key: 'guests' }, { header: 'Origin', key: 'origin' },
    { header: 'Immigration Status', key: 'immigration_status' }, { header: 'Status', key: 'status' },
  ], []);

  useEffect(() => {
    const keys = exportColumns.map(c => c.key);
    setSelectedExportKeys(prev => {
      const set = new Set(prev);
      const merged = keys.filter(k => set.has(k));
      if (merged.length === 0) return keys;
      for (const k of keys) { if (!set.has(k)) merged.push(k); }
      return merged;
    });
  }, [exportColumns]);

  const normalizeBookingExportRow = (b) => ({
    full_name: b.full_name ?? `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim(),
    order_no: b.order_no ?? '', property_name: b.property_name ?? '',
    room_number: b.room_number ?? b.room ?? '', check_in: b.check_in ?? '',
    day: b.day ?? '', guests: b.guests ?? '', origin: b.origin ?? '',
    immigration_status: b.immigration_status ?? '', status: b.status ?? '',
  });

  const runExport = () => {
    const keySet = new Set(selectedExportKeys ?? []);
    const cols = exportColumns.filter(c => keySet.has(c.key));
    if (!cols.length) { alert('Select at least one column.'); return; }
    const data = filteredBookings.map(normalizeBookingExportRow);
    if (exportFormat === 'pdf') generatePDF(data, cols, 'Bookings Report', 'bookings-report');
    else generateCSV(data, cols, 'bookings-report');
    setShowExportModal(false);
    setExportFormat(null);
  };

  /* ─── Shared form fields ─── */
  const renderBookingFormFields = useCallback((isEdit = false) => (
    <>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-2 rounded-xl text-sm">{error}</div>}
      <div className="form-grid-2">
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">First Name <span className="text-red-500">*</span></label>
          <input type="text" required value={formData.first_name} onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
        </div>
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Last Name <span className="text-red-500">*</span></label>
          <input type="text" required value={formData.last_name} onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
        </div>
      </div>
      <div className="form-grid-2">
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Date of Birth <span className="text-red-500">*</span></label>
          <input type="date" required value={formData.date_of_birth} onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
        </div>
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Nationality <span className="text-red-500">*</span></label>
          <input type="text" required value={formData.nationality} onChange={e => setFormData(p => ({ ...p, nationality: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
        </div>
      </div>
      <div className="form-group">
        <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Home Office Reference <span className="text-red-500">*</span></label>
        <input type="text" required value={formData.home_office_reference} onChange={e => setFormData(p => ({ ...p, home_office_reference: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
      </div>
      <div className="form-grid-3">
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Property <span className="text-red-500">*</span></label>
          <select required value={formData.property_id} onChange={e => { const v = e.target.value; setFormData(p => ({ ...p, property_id: v, room_id: '' })); handlePropertyChange(v); }} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500">
            <option value="">Select</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Room <span className="text-red-500">*</span></label>
          <select required value={formData.room_id} onChange={e => setFormData(p => ({ ...p, room_id: e.target.value }))} disabled={!formData.property_id} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="">{formData.property_id ? 'Select' : 'Select property first'}</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number} - {r.type}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Check-in Date <span className="text-red-500">*</span></label>
          <input type="date" required value={formData.check_in_date} onChange={e => setFormData(p => ({ ...p, check_in_date: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
        </div>
      </div>
      <div className="form-group">
        <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Vulnerabilities <span className="text-red-500">*</span></label>
        <input type="text" required value={formData.vulnerabilities} onChange={e => setFormData(p => ({ ...p, vulnerabilities: e.target.value }))} placeholder="Separate multiple items with commas" className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
      </div>
      <div className="form-grid-2">
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Medical Conditions <span className="text-red-500">*</span></label>
          <textarea rows={2} required value={formData.medical_conditions} onChange={e => setFormData(p => ({ ...p, medical_conditions: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 !h-auto" />
        </div>
        <div className="form-group">
          <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Dietary Requirements <span className="text-red-500">*</span></label>
          <textarea rows={2} required value={formData.dietary_requirements} onChange={e => setFormData(p => ({ ...p, dietary_requirements: e.target.value }))} className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 !h-auto" />
        </div>
      </div>

      {dynamicColumns.length > 0 && (
        <div className="mt-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Custom Fields</div>
          <div className="form-grid-2">
            {dynamicColumns.map((c) => renderDynamicField(c))}
          </div>
        </div>
      )}
    </>
  ), [dynamicColumns, error, formData, handlePropertyChange, properties, renderDynamicField, rooms]);

  const visibleColCount = Object.values(visibleColumns).filter(Boolean).length;
  const isLoading = loadingServiceUsers; // show spinner only on first load

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6">

        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Bookings</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" /><span>&gt;</span><span>Properties</span><span>&gt;</span><span>Bookings</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Manage reservations and check-ins</p>
          </div>
          <div className="flex items-center gap-3">
            <DownloadDropdown onDownloadPDF={() => { setExportFormat('pdf'); setShowExportModal(true); setSelectedExportKeys(prev => prev.length ? prev : exportColumns.map(c => c.key)); }} onDownloadCSV={() => { setExportFormat('csv'); setShowExportModal(true); setSelectedExportKeys(prev => prev.length ? prev : exportColumns.map(c => c.key)); }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          {[
            { icon: <UserCheck className="w-7 h-7" />, color: 'bg-green-500/10 text-green-500', label: 'Checked In', value: stats.checkedIn },
            { icon: <UserX className="w-7 h-7" />, color: 'bg-blue-500/10 text-blue-500', label: 'Checked Out', value: stats.checkedOut },
            { icon: <Users className="w-7 h-7" />, color: 'bg-purple-500/10 text-purple-500', label: 'Total Guests', value: stats.totalGuests },
            { icon: <Calendar className="w-7 h-7" />, color: 'bg-orange-500/10 text-orange-500', label: 'Arriving Today', value: stats.arrivingToday },
            { icon: <ClipboardList className="w-7 h-7" />, color: 'bg-teal-500/10 text-teal-500', label: 'Pending Approval', value: stats.pendingApproval, onClick: () => setActiveTab('pending'), extra: 'cursor-pointer' },
          ].map(({ icon, color, label, value, onClick, extra }) => (
            <div key={label} onClick={onClick} className={`bg-[var(--bg-surface)] rounded-xl p-5 shadow-sm border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200 ${extra ?? ''}`}>
              <div className={`${color} h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0`}>{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[var(--text-secondary)]/60 uppercase tracking-widest mb-0.5">{label}</div>
                <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-color)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <div>
                  <div className="text-lg font-semibold text-[var(--text-primary)]">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>
                  <div className="text-xs text-[var(--text-secondary)]/60 mt-0.5">Select columns to include</div>
                </div>
                <button onClick={() => { setShowExportModal(false); setExportFormat(null); }} className="p-2 rounded-xl text-[var(--text-secondary)]/60 hover:bg-[var(--bg-primary)]"><X className="w-5 h-5" /></button>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-[var(--text-secondary)]">Columns</div>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => setSelectedExportKeys(exportColumns.map(c => c.key))} className="text-teal-500 font-medium">Select all</button>
                    <button onClick={() => setSelectedExportKeys([])} className="text-[var(--text-secondary)]/60 font-medium">Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto">
                  {exportColumns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-primary)] cursor-pointer">
                      <input type="checkbox" checked={(selectedExportKeys ?? []).includes(col.key)} onChange={e => { setSelectedExportKeys(prev => { const s = new Set(prev ?? []); e.target.checked ? s.add(col.key) : s.delete(col.key); return Array.from(s); }); }} className="w-4 h-4 text-teal-500 rounded border-[var(--border-color)] bg-[var(--bg-surface)]" />
                      <span className="text-sm text-[var(--text-secondary)]">{col.header}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
                <button onClick={() => { setShowExportModal(false); setExportFormat(null); }} className="rounded-xl btn-secondary btn-sm">Cancel</button>
                <button onClick={runExport} className="rounded-xl btn-primary btn-sm">Download</button>
              </div>
            </div>
          </div>
        )}

        {/* Main Table Card */}
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 transition-all duration-200">

          {/* Tabs */}
          <div className="mb-6 flex items-center gap-3 border-b border-[var(--border-color)]">
            {[
              { key: 'all', label: 'All Bookings' }, { key: 'checked-in', label: 'Checked In' },
              { key: 'arriving', label: 'Arriving Today' }, { key: 'late', label: 'Late Checkout' },
              { key: 'pending', label: 'Pending' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? 'border-teal-500 text-teal-600' : 'border-transparent text-[var(--text-secondary)]'}`}>{label}</button>
            ))}
          </div>

          {/* Table Toolbar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  {activeTab === 'all' ? 'All Bookings' : activeTab === 'checked-in' ? 'Checked In' : activeTab === 'arriving' ? 'Arriving Today' : activeTab === 'late' ? 'Late Checkout' : 'Pending'}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                  {filteredBookings.length} of {bookings.length} bookings
                  {loadingEnrichment && <span className="inline-flex items-center gap-1 text-xs text-teal-600"><span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>enriching…</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60" />
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search bookings…" className="form-input !pl-10 !w-72 rounded-xl bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-primary)]" />
                </div>

                {/* View Dropdown */}
                <div className="relative" ref={viewRef}>
                  <button onClick={() => setShowViewMenu(!showViewMenu)} className="btn-secondary rounded-xl">
                    <Eye className="w-4 h-4" /><span>{viewMode === 'table' ? 'Table' : 'Board'}</span><ChevronDown className="w-4 h-4" />
                  </button>
                  {showViewMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-color)] z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">View Settings</h3>
                        <div className="mb-3 pb-3 border-b border-[var(--border-color)]">
                          <div className="text-xs font-medium text-[var(--text-secondary)]/60 uppercase tracking-wider mb-2">Display Mode</div>
                          <div className="flex gap-2">
                            {[['table', <Columns className="w-4 h-4" />, 'Table'], ['board', <ClipboardList className="w-4 h-4" />, 'Board']].map(([mode, icon, label]) => (
                              <button key={mode} onClick={() => setViewMode(mode)} className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${viewMode === mode ? 'bg-teal-500 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}>{icon}<span>{label}</span></button>
                            ))}
                          </div>
                        </div>
                        {viewMode === 'table' && (
                          <>
                            <button onClick={() => setShowColumnVisibility(!showColumnVisibility)} className="w-full flex items-center justify-between px-2 py-2 text-sm text-[var(--text-secondary)] rounded-xl hover:bg-[var(--bg-primary)]">
                              <span className="font-medium">Column visibility</span>
                              <div className="flex items-center gap-2"><span className="text-xs text-[var(--text-secondary)]/60">{Object.values(visibleColumns).filter(Boolean).length} shown</span><ChevronDown className={`w-4 h-4 transition-transform ${showColumnVisibility ? 'rotate-180' : ''}`} /></div>
                            </button>
                            {showColumnVisibility && (
                              <div className="mt-2 border-t border-[var(--border-color)] pt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Columns</span>
                                  <div className="text-xs font-medium flex gap-2">
                                    <button onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}))} className="text-teal-500">Show all</button>
                                    <span className="text-[var(--border-color)]">|</span>
                                    <button onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: false }), {}))} className="text-teal-500">Hide all</button>
                                  </div>
                                </div>
                                <div className="max-h-72 overflow-y-auto space-y-2">
                                  {ALL_COLUMNS.map(col => (
                                    <button key={col} type="button" onClick={() => setVisibleColumns(p => ({ ...p, [col]: !p[col] }))} className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] transition-colors hover:bg-[var(--bg-primary)]">
                                      <span className={`text-sm font-medium ${visibleColumns[col] ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>{col === 'order_no' ? 'Order no' : col.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())}</span>
                                      {visibleColumns[col] ? <Eye className="w-4 h-4 text-teal-500" /> : <EyeOff className="w-4 h-4 text-[var(--text-secondary)]/40" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => setShowModal(true)} className="btn-primary rounded-xl"><Upload className="w-4 h-4" /><span>New Booking</span></button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none z-10" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="appearance-none h-10 py-0 !pl-10 !pr-10 w-44 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] hover:bg-[var(--bg-primary)] transition-all cursor-pointer shadow-sm leading-none text-left">
                  <option value="">All Status</option>
                  <option value="Checked In">Checked In</option>
                  <option value="Checked Out">Checked Out</option>
                  <option value="Pending">Pending</option>
                  <option value="Late Checkout">Late Checkout</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none z-10" />
              </div>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/60 pointer-events-none z-10" />
                <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} className="appearance-none h-10 py-0 !pl-10 !pr-10 w-48 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] hover:bg-[var(--bg-primary)] transition-all cursor-pointer shadow-sm leading-none text-left">
                  <option value="">All Properties</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none z-10" />
              </div>
              <div className="relative">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="appearance-none h-10 py-0 !pl-4 !pr-10 w-40 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] hover:bg-[var(--bg-primary)] transition-all cursor-pointer shadow-sm leading-none text-left">
                  <option value="">Sort by…</option>
                  <option value="date">Check-in Date</option>
                  <option value="name">Name</option>
                  <option value="room">Room</option>
                  <option value="status">Status</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none z-10" />
              </div>
            </div>
          </div>

          {/* ── Table View ── */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-primary)]">
                  <tr className="border-b border-[var(--border-color)]">
                    {visibleColumns.checkbox && <th className="w-12 py-3 px-4"><input type="checkbox" className="rounded border-[var(--border-color)] bg-[var(--bg-surface)]" /></th>}
                    {visibleColumns.name && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Full Name</th>}
                    {visibleColumns.order_no && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Order No.</th>}
                    {visibleColumns.room && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Room</th>}
                    {visibleColumns.check_in && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Check-In</th>}
                    {visibleColumns.day && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Day</th>}
                    {visibleColumns.guests && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Guests</th>}
                    {visibleColumns.origin && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Origin</th>}
                    {visibleColumns.immigration_status && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Immigration Status</th>}
                    {visibleColumns.status && <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Status</th>}
                    {visibleColumns.actions && <th className="text-center py-3 px-4 text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={visibleColCount} className="py-8 text-center text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div>
                          <span>Loading bookings…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr><td colSpan={visibleColCount} className="py-8 text-center text-[var(--text-secondary)]/60">No bookings found</td></tr>
                  ) : (
                    filteredBookings.map(booking => {
                      const statusColors = getStatusColor(booking.status);
                      const isPending = (booking.status ?? '').toLowerCase().includes('pending');
                      const isDeleting = deletingIds.has(booking.id);
                      return (
                        <tr key={booking.id} className={`transition-colors ${isDeleting ? 'booking-deleting' : ''}`}>
                          {visibleColumns.checkbox && <td className="py-3 px-4"><input type="checkbox" className="rounded border-[var(--border-color)] bg-[var(--bg-surface)]" /></td>}
                          {visibleColumns.name && <td className="py-3 px-4"><div className="font-medium text-[var(--text-primary)]">{booking.full_name}</div></td>}
                          {visibleColumns.order_no && <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{booking.order_no}</td>}
                          {visibleColumns.room && (
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-[var(--text-primary)]">{booking.room}</span>
                                <span className="text-xs text-[var(--text-secondary)]/60">{booking.room_type}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.check_in && <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{formatDate(booking.check_in)}</td>}
                          {visibleColumns.day && <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{booking.day}</td>}
                          {visibleColumns.guests && <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{booking.guests}</td>}
                          {visibleColumns.origin && <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{booking.origin}</td>}
                          {visibleColumns.immigration_status && (
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{booking.immigration_status ?? 'Pending'}</span>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>{booking.status}</span>
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isPending && (
                                  <>
                                    <button onClick={() => handleApprove(booking)} className="group p-2 text-gray-400 rounded-xl" title="Approve"><Check className="w-4 h-4 transition-transform" /></button>
                                    <button onClick={() => handleReject(booking)} className="group p-2 text-gray-400 rounded-xl" title="Reject"><X className="w-4 h-4 transition-transform" /></button>
                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                  </>
                                )}
                                <button onClick={() => handleView(booking)} className="group p-2 text-gray-400 rounded-xl" title="View"><Eye className="w-4 h-4 transition-transform" /></button>
                                <button onClick={() => handleEdit(booking)} className="group p-2 text-gray-400 rounded-xl" title="Edit"><Edit className="w-4 h-4 transition-transform" /></button>
                                <button onClick={() => handleDelete(booking)} className="group p-2 text-gray-400 rounded-xl" title="Delete"><Trash2 className="w-4 h-4 transition-transform" /></button>
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
          )}

          {/* ── Board View ── */}
          {viewMode === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading ? (
                <div className="col-span-full py-8 text-center text-gray-500 flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div><span>Loading bookings…</span>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-500">No bookings found</div>
              ) : (
                filteredBookings.map(booking => {
                  const statusColors = getStatusColor(booking.status);
                  const isPending = (booking.status ?? '').toLowerCase().includes('pending');
                  const isDeleting = deletingIds.has(booking.id);
                  return (
                    <div key={booking.id} className={`bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 transition-all hover:shadow-md ${isDeleting ? 'board-card-deleting' : ''}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)]">{booking.full_name}</h3>
                          <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">{booking.order_no}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>{booking.status}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm"><BedDouble className="w-4 h-4 text-[var(--text-secondary)]/40 mr-2" /><span className="text-[var(--text-secondary)]">{booking.room} - {booking.room_type}</span></div>
                        <div className="flex items-center text-sm"><Calendar className="w-4 h-4 text-[var(--text-secondary)]/40 mr-2" /><span className="text-[var(--text-secondary)]">{formatDate(booking.check_in)} ({booking.day})</span></div>
                        <div className="flex items-center text-sm"><Users className="w-4 h-4 text-[var(--text-secondary)]/40 mr-2" /><span className="text-[var(--text-secondary)]">{booking.guests} guest{booking.guests > 1 ? 's' : ''}</span></div>
                        <div className="flex items-center text-sm"><Home className="w-4 h-4 text-[var(--text-secondary)]/40 mr-2" /><span className="text-[var(--text-secondary)]">{booking.origin}</span></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex gap-2">
                        {isPending ? (
                          <>
                            <button onClick={() => handleApprove(booking)} className="flex-1 py-1.5 text-center text-sm bg-green-500/10 text-green-500 rounded-xl font-medium hover:bg-green-500/20 transition-colors">Approve</button>
                            <button onClick={() => handleReject(booking)} className="flex-1 py-1.5 text-center text-sm bg-red-500/10 text-red-500 rounded-xl font-medium hover:bg-red-500/20 transition-colors">Reject</button>
                          </>
                        ) : (
                          <div className="flex w-full gap-1.5">
                            <button onClick={() => handleView(booking)} className="flex-1 text-center text-sm text-teal-500 font-medium rounded-xl py-1.5 hover:bg-teal-500/10 transition-colors">View</button>
                            <button onClick={() => handleEdit(booking)} className="flex-1 text-center text-sm text-emerald-500 font-medium rounded-xl py-1.5 hover:bg-emerald-500/10 transition-colors">Edit</button>
                            <button onClick={() => handleDelete(booking)} className="flex-1 text-center text-sm text-rose-500 font-medium rounded-xl py-1.5 hover:bg-rose-500/10 transition-colors">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── New Booking Modal ── */}
      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container h-[70vh]">
            <div className="modal-header">
              <div><h2 className="modal-title">New Booking</h2><p className="modal-subtitle">Register a new arrival.</p></div>
              <button onClick={() => setShowModal(false)} className="modal-close-btn rounded-xl"><X className="w-5 h-5 text-[var(--text-secondary)]/60" /></button>
            </div>
            <form id="booking-form" onSubmit={handleSubmit} className="modal-content form-section">
              {renderBookingFormFields(false)}
            </form>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowModal(false)} disabled={submitting} className="px-3 py-2.5 border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors">Cancel</button>
              <button type="submit" form="booking-form" disabled={submitting} className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition-colors">{submitting ? 'Creating…' : 'Create Booking'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── View Modal ── */}
      {showViewModal && selectedBooking && createPortal(
        <div className="modal-overlay">
          <div className="modal-container h-[70vh]">
            <div className="modal-header">
              <div><h2 className="modal-title">Booking Details</h2><p className="modal-subtitle">View booking information</p></div>
              <button onClick={() => setShowViewModal(false)} className="modal-close-btn rounded-xl"><X className="w-5 h-5 text-[var(--text-secondary)]/60" /></button>
            </div>
            <div className="modal-content">
              <div className="form-grid-2">
                {[
                  ['Full Name', selectedBooking.full_name],
                  ['Order Number', selectedBooking.order_no],
                  ['Date of Birth', formatDate(selectedBooking.date_of_birth) || 'N/A'],
                  ['Nationality', selectedBooking.nationality || 'N/A'],
                  ['Home Office Reference', selectedBooking.home_office_reference || 'N/A'],
                  ['Room', `${selectedBooking.room} - ${selectedBooking.room_type}`],
                  ['Property', selectedBooking.property_name || 'N/A'],
                  ['Check-In Date', formatDate(selectedBooking.check_in)],
                  ['Day', selectedBooking.day],
                  ['Guests', selectedBooking.guests],
                  ['Origin', selectedBooking.origin],
                ].map(([label, val]) => (
                  <div key={label}>
                    <label className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wide block mb-1">{label}</label>
                    <p className="text-[var(--text-primary)] font-medium">{val}</p>
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wide block mb-1">Immigration Status</label>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">{selectedBooking.immigration_status || 'Pending'}</span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wide block mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedBooking.status).bg} ${getStatusColor(selectedBooking.status).text} ${getStatusColor(selectedBooking.status).border}`}>{selectedBooking.status}</span>
                </div>
              </div>
              {dynamicColumns.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wide block mb-2">Custom Fields</div>
                  {suColumnsLoading ? (
                    <div className="text-sm text-[var(--text-secondary)]/40">Loading custom fields...</div>
                  ) : (
                    <div className="form-grid-2">
                      {dynamicColumns.map((c) => {
                        const k = String(c?.column_name || '').trim();
                        if (!k) return null;
                        const label = labelize(k);
                        const raw = selectedBooking?.[k] ?? selectedBooking?._su?.[k];
                        const val = formatDynamicValue(c, raw);
                        return (
                          <div key={k}>
                            <label className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wide block mb-1">{label}</label>
                            <p className="text-[var(--text-primary)] font-medium">{val}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {['vulnerabilities', 'medical_conditions', 'dietary_requirements'].map(k => selectedBooking[k] ? (
                <div key={k} className="mt-4">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]/60 uppercase tracking-wide block mb-1">{k.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())}</label>
                  <p className="text-[var(--text-secondary)]">{selectedBooking[k]}</p>
                </div>
              ) : null)}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowViewModal(false)} className="btn-secondary btn-sm rounded-xl">Close</button>
              <button onClick={() => { setShowViewModal(false); handleEdit(selectedBooking); }} className="btn-primary btn-sm flex items-center gap-2 rounded-xl"><Edit className="w-4 h-4" />Edit</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && selectedBooking && createPortal(
        <div className="modal-overlay">
          <div className="modal-container h-[70vh]">
            <div className="modal-header">
              <div><h2 className="modal-title">Edit Booking</h2><p className="modal-subtitle">Update booking information</p></div>
              <button onClick={() => setShowEditModal(false)} className="modal-close-btn rounded-xl"><X className="w-5 h-5 text-[var(--text-secondary)]/60" /></button>
            </div>
            <form id="edit-booking-form" onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setSubmitting(true);
              try {
                const safePropertyId = String(formData.property_id);
                const safeRoomId = String(formData.room_id);
                const safeDob = normalizeDateInput(formData.date_of_birth);
                const safeCheckIn = normalizeDateInput(formData.check_in_date);
                const selectedRoomObj = rooms.find(r => String(r.id) === safeRoomId);
                if (selectedBooking.service_user_id) {
                  const suUpdate = {
                    first_name: formData.first_name, last_name: formData.last_name,
                    date_of_birth: safeDob, nationality: formData.nationality,
                    home_office_reference: formData.home_office_reference,
                    vulnerabilities: formData.vulnerabilities || null,
                    medical_conditions: formData.medical_conditions || null,
                    dietary_requirements: formData.dietary_requirements || null,
                    property_id: safePropertyId, room_id: safeRoomId,
                    room_number: selectedRoomObj?.room_number ?? null,
                    admission_date: safeCheckIn,
                    updated_by: user?.id ?? user?.user_id ?? null
                  };

                  for (const c of dynamicColumns) {
                    const k = String(c?.column_name || '').trim();
                    if (!k) continue;
                    const inputType = String(c?.input_type || '').toLowerCase();
                    const opts = parseInputOptions(c?.input_options);
                    const v = formData?.[k];
                    if (inputType === 'checkbox') {
                      if (opts && opts.length) {
                        if (Array.isArray(v)) suUpdate[k] = v;
                        else if (typeof v === 'string' && v.trim()) suUpdate[k] = v.split(',').map((s) => s.trim()).filter(Boolean);
                        else if (v === true) suUpdate[k] = [true];
                        else suUpdate[k] = [];
                      } else {
                        suUpdate[k] = v ? [true] : [];
                      }
                    } else {
                      suUpdate[k] = v;
                    }
                  }

                  await api.put(`/api/su/users/${selectedBooking.service_user_id}`, suUpdate);
                }
                if (selectedBooking.move_in_id) {
                  await api.put(`/api/move-ins/${selectedBooking.move_in_id}`, { room_id: safeRoomId, property_id: safePropertyId, move_in_date: safeCheckIn, updated_by: user?.id ?? user?.user_id ?? null });
                } else {
                  await api.post('/api/move-ins', { service_user_id: selectedBooking.service_user_id, room_id: safeRoomId, property_id: safePropertyId, move_in_date: safeCheckIn, status: 'Active' });
                }
                setShowEditModal(false);
                setSelectedBooking(null);
                setRooms([]);
                await loadData();
                setAlertDialog({ isOpen: true, title: 'Success', message: 'Booking updated successfully!', type: 'success' });
              } catch (err) {
                setError(err.response?.data?.error ?? err.response?.data?.message ?? err.message ?? 'Failed to update booking');
              } finally { setSubmitting(false); }
            }} className="modal-content form-section">
              {renderBookingFormFields(true)}
            </form>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowEditModal(false)} disabled={submitting} className="px-3 py-2.5 border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors">Cancel</button>
              <button type="submit" form="edit-booking-form" disabled={submitting} className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition-colors">{submitting ? 'Updating…' : 'Update Booking'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.confirmText || 'Confirm'} />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(p => ({ ...p, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
    </div>
  );
}