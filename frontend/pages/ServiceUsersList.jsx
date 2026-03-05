/* eslint-disable no-unused-vars */
// src/pages/ServiceUsersList.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { api } from "../src/utils/axiosConfig";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { usePermissions } from "../hooks/usePermissions";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";
import { Plus } from "lucide-react";

const DELETE_STYLE_ID = 'service-users-list-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
 const style = document.createElement('style');
 style.id = DELETE_STYLE_ID;
 style.textContent = `
  @keyframes serviceUserCardDelete {
   0%   { opacity: 1; transform: scale(1) rotate(0deg); }
   30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
   100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
  }
  .service-user-card-deleting {
   animation: serviceUserCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
   pointer-events: none;
  }
 `;
 document.head.appendChild(style);
}

/**
 * Build a list of candidate API bases.
 */
export default function ServiceUsersList({ user, openAddModal = false }) {
 const [users, setUsers] = useState([]);
 const [deletingIds, setDeletingIds] = useState(new Set());
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [filtersOpen, setFiltersOpen] = useState(false);
 const [statusFilter, setStatusFilter] = useState('all');
 const [sortMode, setSortMode] = useState('latest');
 const filtersRef = useRef(null);
 const apiRef = useRef(api);

 useEffect(() => {
  try {
   const raw = localStorage.getItem('serviceUsersListSnapshot.v1');
   if (!raw) return;
   const snap = JSON.parse(raw);
   if (!snap || typeof snap !== 'object') return;

   if (Array.isArray(snap.users)) setUsers(snap.users);
   if (snap.stats && typeof snap.stats === 'object') setStats(snap.stats);
   if (Array.isArray(snap.hotels)) setHotels(snap.hotels);
   setLoading(false);
  } catch {
  }
 }, []);

 const MODULE_KEY = 'su_data';
 const {
 loading: permissionsLoading,
 canRead,
 canCreate,
 canUpdate,
 canDelete
 } = usePermissions(user);

 const canReadSU = canRead(MODULE_KEY);
 const canCreateSU = canCreate(MODULE_KEY);
 const canUpdateSU = canUpdate(MODULE_KEY);
 const canDeleteSU = canDelete(MODULE_KEY);

 useEffect(() => {
  let cancelled = false;
  const init = async () => {
   if (cancelled) return;
   if (permissionsLoading) return;
   if (!canReadSU) {
    setLoading(false);
    return;
   }
   await fetchHotels();
   await fetchUsers();
  };
  init();
  return () => {
   cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [permissionsLoading, canReadSU]);

 /* Dialog State */
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

 const [showExportModal, setShowExportModal] = useState(false);
 const [exportFormat, setExportFormat] = useState(null);
 const [selectedExportKeys, setSelectedExportKeys] = useState([]);

 const [stats, setStats] = useState({
 total: 0,
 active: 0,
 attention: 0,
 movedOut: 0,
 });

 const [isModalOpen, setIsModalOpen] = useState(false);
 const [hotels, setHotels] = useState([]);
 const [rooms, setRooms] = useState([]);
 const [submitting, setSubmitting] = useState(false);
 const [suColumns, setSuColumns] = useState([]);
 const [suColumnsLoading, setSuColumnsLoading] = useState(false);

 // Pagination State
 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 12;

 const initialFormState = {
  id: null,
  first_name: "",
  last_name: "",
 date_of_birth: "",
 dob: "",
 nationality: "",
 gender: "",
 immigration_status: "",
 home_office_reference: "",
 hotel_id: "",
 room_id: "",
 room_number: "",
 admission_date: "",
 number_of_dependents: "",
 emergency_contact_name: "",
 emergency_contact_phone: "",
 vulnerabilities: "",
 medical_conditions: "",
 dietary_requirements: "",
  family_type: "",
  status: "Active",
 };

 const BASE_FORM_KEYS = useMemo(
  () => new Set(Object.keys(initialFormState)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []
 );

 const RESERVED_FORM_KEYS = useMemo(
  () => new Set([
   ...Array.from(BASE_FORM_KEYS),
   'id',
   'created_at',
   'updated_at',
   'created_by',
   'property',
   'hotel_name',
   'property_name',
  ]),
  [BASE_FORM_KEYS]
 );

 const HIDDEN_DYNAMIC_KEYS = useMemo(
  () => new Set([
   'property_id',
   'propertyid',
   'documents',
   'complaints_summary',
   'maintenance_summary',
   'move_in_date',
   'movein_date',
  ]),
  []
 );

 const [formData, setFormData] = useState(initialFormState);

 const fetchUsers = async () => {
  try {
   setLoading(true);
   const res = await apiRef.current.get('/su/users', { noCache: true });
   const list = Array.isArray(res?.data) ? res.data : [];
   setUsers(list);

   const nextStats = {
    total: list.length,
    active: list.filter((u) => String(u?.status || '').toLowerCase() === 'active').length,
    attention: list.filter((u) => String(u?.status || '').toLowerCase() === 'pending').length,
    movedOut: list.filter((u) => {
     const s = String(u?.status || '').toLowerCase().replace(/\s+/g, ' ').trim();
     return s === 'moved out' || s === 'moved_out' || s === 'movedout';
    }).length,
   };
   setStats(nextStats);

   try {
    const snap = {
     users: list,
     stats: nextStats,
     hotels,
     savedAt: Date.now(),
    };
    localStorage.setItem('serviceUsersListSnapshot.v1', JSON.stringify(snap));
   } catch {
   }
  } catch (e) {
   console.error('Failed to fetch service users', e?.response?.data || e?.message || e);
   setUsers([]);
   setStats({ total: 0, active: 0, attention: 0, movedOut: 0 });
  } finally {
   setLoading(false);
  }
 };

 const fetchHotels = async () => {
  try {
   const res = await apiRef.current.get('/hotels', { noCache: true });
   const list = Array.isArray(res?.data?.hotels) ? res.data.hotels : Array.isArray(res?.data) ? res.data : [];
   const normalized = (list || []).map((h) => ({
    ...h,
    _displayName: h?._displayName || h?.name || h?.hotel_name || h?.property_name || `Hotel ${h?.id ?? ''}`,
   }));
   setHotels(normalized);
   try {
    const raw = localStorage.getItem('serviceUsersListSnapshot.v1');
    const snap = raw ? JSON.parse(raw) : null;
    const next = snap && typeof snap === 'object' ? { ...snap, hotels: normalized } : { users, stats, hotels: normalized };
    localStorage.setItem('serviceUsersListSnapshot.v1', JSON.stringify(next));
   } catch {
   }
   return normalized;
  } catch (e) {
   console.error('Failed to fetch hotels', e?.response?.data || e?.message || e);
   setHotels([]);
   return [];
  }
 };

 const fetchRooms = async (hotelId) => {
  if (!hotelId) {
   setRooms([]);
   return [];
  }
  try {
   const res = await apiRef.current.get(`/su/rooms/${hotelId}`, { noCache: true });
   const list = Array.isArray(res?.data?.rooms) ? res.data.rooms : Array.isArray(res?.data) ? res.data : [];
   setRooms(list);
   return list;
  } catch (e) {
   console.error('Failed to fetch rooms', e?.response?.data || e?.message || e);
   setRooms([]);
   return [];
  }
 };

 const fetchServiceUserColumns = async () => {
  setSuColumnsLoading(true);
  try {
   const res = await apiRef.current.get('/forms-builder/tables/service_users/columns');
   const cols = res?.data?.columns || [];
   setSuColumns(Array.isArray(cols) ? cols : []);
   return Array.isArray(cols) ? cols : [];
  } catch (e) {
   setSuColumns([]);
   return [];
  } finally {
   setSuColumnsLoading(false);
  }
 };

 const dynamicColumns = useMemo(() => {
  const cols = Array.isArray(suColumns) ? suColumns : [];
  return cols
   .filter((c) => {
    const name = String(c?.column_name || '').trim();
    if (!name) return false;
    if (RESERVED_FORM_KEYS.has(name)) return false;
    if (HIDDEN_DYNAMIC_KEYS.has(String(name).toLowerCase())) return false;
    return true;
   })
   .sort((a, b) => String(a?.ordinal_position || 0) - String(b?.ordinal_position || 0));
 }, [suColumns, RESERVED_FORM_KEYS, HIDDEN_DYNAMIC_KEYS]);

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

 const renderDynamicField = (col) => {
  const key = String(col?.column_name || '').trim();
  if (!key) return null;
  const label = labelize(key);
  const inputTypeRaw = String(col?.input_type || '').toLowerCase();
  const inputType = inputTypeRaw === 'dropdown' ? 'select' : inputTypeRaw;
  const dataType = String(col?.data_type || '').toLowerCase();
  const opts = parseInputOptions(col?.input_options);

  // Prefer forms-builder input_type when present
  if (inputType === 'textarea') {
   return (
    <div key={key} className="form-group">
     <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
     <textarea
      name={key}
      value={formData?.[key] ?? ''}
      onChange={handleFormChange}
      rows={2}
      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
     ></textarea>
    </div>
   );
  }

  if (inputType === 'select' || inputType === 'radio') {
   return (
    <div key={key} className="form-group">
     <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
     <select
      name={key}
      value={formData?.[key] ?? ''}
      onChange={handleFormChange}
      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
     >
      <option value="">Select {label}</option>
      {(opts || []).map((o, idx) => {
       const v = typeof o === 'string' ? o : (o?.value ?? o?.label ?? String(o));
       const t = typeof o === 'string' ? o : (o?.label ?? o?.value ?? String(o));
       return (
        <option key={`${key}-${idx}`} value={v}>{t}</option>
       );
      })}
     </select>
    </div>
   );
  }

  if (inputType === 'checkbox') {
  // If options exist => multi-select checkbox list (array)
  const selected = Array.isArray(formData?.[key]) ? formData[key] : [];

  if (opts && opts.length) {
   return (
    <div key={key} className="form-group">
     <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
       {(opts || []).map((o, idx) => {
        const v = typeof o === 'string' ? o : (o?.value ?? o?.label ?? String(o));
        const t = typeof o === 'string' ? o : (o?.label ?? o?.value ?? String(o));
        const checked = selected.includes(v);
        return (
         <label key={`${key}-${idx}`} className="flex items-center gap-2 text-sm text-slate-700">
          <input
           type="checkbox"
           checked={checked}
           onChange={(e) => {
            const next = new Set(selected);
            if (e.target.checked) next.add(v);
            else next.delete(v);
            setFormData((prev) => ({ ...prev, [key]: Array.from(next) }));
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

  // No explicit options => single boolean checkbox
  return (
   <div key={key} className="form-group">
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
     <input
      type="checkbox"
      name={key}
      checked={Boolean(formData?.[key])}
      onChange={(e) => {
       const checked = !!e.target.checked;
       setFormData((prev) => ({ ...prev, [key]: checked }));
      }}
     />
     <span>{label}</span>
    </label>
   </div>
  );
 }

  // Fallback based on DB type
  let htmlType = 'text';
  if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('double') || dataType.includes('real')) {
   htmlType = 'number';
  } else if (dataType === 'date') {
   htmlType = 'date';
  } else if (dataType.includes('timestamp')) {
   htmlType = 'datetime-local';
  } else if (dataType === 'boolean') {
   htmlType = 'checkbox';
  }

  if (htmlType === 'checkbox') {
   return (
    <div key={key} className="form-group">
     <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <input
       type="checkbox"
       name={key}
       checked={Boolean(formData?.[key])}
       onChange={(e) => {
        const checked = !!e.target.checked;
        setFormData((prev) => ({ ...prev, [key]: checked }));
       }}
      />
      <span>{label}</span>
     </label>
    </div>
   );
  }

  return (
   <div key={key} className="form-group">
    <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
    <input
     type={htmlType}
     name={key}
     value={formData?.[key] ?? ''}
     onChange={handleFormChange}
     className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
    />
   </div>
  );
 };

 const normalizeInputValue = (col, rawValue) => {
  const v = rawValue;
  const inputType = String(col?.input_type || '').toLowerCase();
  const dataType = String(col?.data_type || '').toLowerCase();
  const opts = parseInputOptions(col?.input_options);

  if (v === null || v === undefined) {
   if (inputType === 'checkbox') return (opts && opts.length) ? [] : false;
   return '';
  }

  if (inputType === 'checkbox') {
  // If options exist => multi-select checkbox list (array)
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

  // No explicit options => single boolean checkbox
  return Boolean(v);
 }

  if (dataType === 'boolean') {
   return Boolean(v);
  }

  return String(v);
 };

 const resetForm = () => {
  setFormData((prev) => {
   const next = { ...initialFormState };
   // keep dynamic keys cleared if they existed
   for (const k of Object.keys(prev || {})) {
    if (!RESERVED_FORM_KEYS.has(k)) next[k] = '';
   }
   return next;
  });
  setRooms([]);
  setSubmitting(false);
 };

 useEffect(() => {
 if (openAddModal && canCreateSU) {
  resetForm();
  setIsModalOpen(true);
 }
 }, [openAddModal, canCreateSU]);

 useEffect(() => {
  if (!isModalOpen) return;
  fetchServiceUserColumns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isModalOpen]);

 // Hide sidebar and navbar when modal/dialog is open
 useEffect(() => {
 if (isModalOpen || confirmDialog.isOpen) {
 document.body.classList.add('form-modal-open');
 } else {
 document.body.classList.remove('form-modal-open');
 }
 return () => {
 document.body.classList.remove('form-modal-open');
 };
 }, [isModalOpen, confirmDialog.isOpen]);

 const handleFormChange = (e) => {
 const { name, value, type, checked } = e.target;

 setFormData((prev) => {
  const newValue = type === "checkbox" ? checked : value;

 if (name === "date_of_birth") {
 return {
 ...prev,
 date_of_birth: newValue,
 dob: newValue,
 };
 }

 if (name === "hotel_id") {
 fetchRooms(newValue);
 return {
 ...prev,
 hotel_id: newValue,
 room_id: "",
 room_number: "",
 };
 }

 if (name === "room_id") {
 const matched = rooms.find((r) => String(r.id) === String(newValue));
 return {
 ...prev,
 room_id: newValue,
 room_number: matched?.room_number ? String(matched.room_number) : "",
 };
 }

  return {
   ...prev,
   [name]: newValue,
  };
 });
 };

 const handleSubmitUser = async (e) => {
  e.preventDefault();

 if (formData.id) {
 if (!canUpdateSU) {
 setAlertDialog({
 isOpen: true,
 title: 'Permission Denied',
 message: 'You do not have permission to update service users.',
 type: 'warning'
 });
 return;
 }
 } else {
 if (!canCreateSU) {
 setAlertDialog({
 isOpen: true,
 title: 'Permission Denied',
 message: 'You do not have permission to create service users.',
 type: 'warning'
 });
 return;
 }
 }

 setSubmitting(true);
 try {
 const selectedHotel = hotels.find((h) => String(h.id) === String(formData.hotel_id));

 const cleanDob = formData.date_of_birth || formData.dob || null;
 const cleanAdmission = formData.admission_date || null;

 const payload = {
  first_name: formData.first_name,
  last_name: formData.last_name,
 // backend normalizes (date_of_birth || dob)
 date_of_birth: cleanDob,
 nationality: formData.nationality,
 gender: formData.gender,
 immigration_status: formData.immigration_status,
 home_office_reference: formData.home_office_reference,
 // backend prefers property_id/hotel_id/accommodation_id
 property_id: formData.hotel_id ? Number(formData.hotel_id) : null,
 hotel_id: formData.hotel_id ? Number(formData.hotel_id) : null,
 room_id: formData.room_id ? Number(formData.room_id) : null,
 room_number: formData.room_number,
 admission_date: cleanAdmission,
 number_of_dependents: formData.number_of_dependents === "" || formData.number_of_dependents === null || formData.number_of_dependents === undefined
 ? null
 : parseInt(formData.number_of_dependents, 10),
 family_type: formData.family_type,
 emergency_contact_name: formData.emergency_contact_name,
 emergency_contact_phone: formData.emergency_contact_phone,
 vulnerabilities: formData.vulnerabilities,
 medical_conditions: formData.medical_conditions,
 dietary_requirements: formData.dietary_requirements,
 status: formData.status || "Active",
 // this will be used on UPDATE if your table has "property"
  property: selectedHotel?._displayName,
 };

  for (const c of dynamicColumns) {
   const k = String(c?.column_name || '').trim();
   if (!k) continue;
   if (RESERVED_FORM_KEYS.has(k)) continue;
   const inputType = String(c?.input_type || '').toLowerCase();
   const opts = parseInputOptions(c?.input_options);
   const v = formData?.[k];
   if (inputType === 'checkbox') {
    // backend stores checkbox as JSON string (or text)
    if (opts && opts.length) {
     if (Array.isArray(v)) payload[k] = v;
     else if (typeof v === 'string' && v.trim()) payload[k] = v.split(',').map((s) => s.trim()).filter(Boolean);
     else if (v === true) payload[k] = [true];
     else if (v === false) payload[k] = [];
     else payload[k] = [];
    } else {
     // single checkbox -> send as array so backend keeps consistent JSON storage
     payload[k] = v ? [true] : [];
    }
   } else if (String(c?.data_type || '').toLowerCase() === 'boolean') {
    payload[k] = Boolean(v);
   } else {
    payload[k] = v;
   }
  }

 Object.keys(payload).forEach((key) => {
 if (key === "family_type" && !payload[key]) {
 delete payload[key];
 return;
 }
 if (key === "property" && !payload[key]) {
 delete payload[key];
 }
 });


 let res;
 if (formData.id) {
 res = await apiRef.current.put(`/su/users/${formData.id}`, payload);
 } else {
 res = await apiRef.current.post("/su/users", payload);
 }

 if (res.status === 200 || res.status === 201) {
 await fetchUsers();
 setIsModalOpen(false);
 resetForm();
 setAlertDialog({
 isOpen: true,
 title: 'Success',
 message: formData.id
 ? "User updated successfully"
 : "User created successfully",
 type: 'success'
 });
 } else {
 throw new Error(
 formData.id ? "Failed to update user" : "Failed to create user"
 );
 }
 } catch (error) {
 console.error(
 "Error saving user:",
 error.response?.data || error.message || error
 );
 setAlertDialog({
 isOpen: true,
 title: 'Save Failed',
 message: error.response?.data?.error ||
 error.response?.data?.details ||
 "Failed to save user. Please check console for details.",
 type: 'error'
 });
 } finally {
 setSubmitting(false);
 }
 };

 const getInitials = (first, last) =>
 `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase();

 const formatDate = (d) =>
 d
 ? new Date(d).toLocaleDateString("en-GB", {
 day: "2-digit",
 month: "short",
 year: "numeric",
 })
 : "N/A";

 const getAvatarColor = (index) => {
 const colors = [
 "bg-blue-100 text-blue-600",
 "bg-emerald-100 text-emerald-600",
 "bg-purple-100 text-purple-600",
 "bg-orange-100 text-orange-600",
 ];
 return colors[index % colors.length];
 };

 const filteredUsers = useMemo(() => {
  const normalize = (v) => String(v ?? '').toLowerCase();

  const bySearch = (users || []).filter((user) => {
   if (!search || !search.trim()) return true;
   const term = normalize(search).trim();
   const fullName = normalize(`${user.first_name || ""} ${user.last_name || ""}`);
   const room = normalize(user.room_number);
   const property = normalize(user.property || user.hotel_name || user.property_name || "");
   const nationality = normalize(user.nationality);
   const homeOfficeRef = normalize(user.home_office_reference);
   const gender = normalize(user.gender);
   const status = normalize(user.status);

   return (
    fullName.includes(term) ||
    property.includes(term) ||
    room.includes(term) ||
    nationality.includes(term) ||
    homeOfficeRef.includes(term) ||
    gender.includes(term) ||
    status.includes(term)
   );
  });

  const statusNorm = (u) => normalize(u?.status).replace(/\s+/g, ' ').trim();
  const byStatus = bySearch.filter((u) => {
   if (statusFilter === 'all') return true;
   const s = statusNorm(u);
   if (statusFilter === 'active') return s === 'active';
   if (statusFilter === 'inactive') return s === 'inactive';
   if (statusFilter === 'moved_out') return s === 'moved out' || s === 'moved_out' || s === 'movedout';
   return true;
  });

  const pickDate = (u) => {
   const raw = u?.created_at ?? u?.createdAt ?? u?.admission_date ?? u?.updated_at ?? u?.updatedAt ?? null;
   if (!raw) return null;
   const d = new Date(raw);
   return Number.isNaN(d.getTime()) ? null : d;
  };

  const nameKey = (u) => normalize(`${u?.first_name ?? ''} ${u?.last_name ?? ''}`).trim();
  const out = [...byStatus];
  if (sortMode === 'alpha') {
   out.sort((a, b) => nameKey(a).localeCompare(nameKey(b)));
  } else {
   out.sort((a, b) => {
    const da = pickDate(a);
    const db = pickDate(b);
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return nameKey(a).localeCompare(nameKey(b));
   });
  }

  return out;
 }, [users, search, statusFilter, sortMode]);

 // Calculate Pagination
 const { paginatedUsers, totalPages, indexOfFirstItem, indexOfLastItem } = useMemo(() => {
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  return { paginatedUsers, totalPages, indexOfFirstItem, indexOfLastItem };
 }, [filteredUsers, currentPage, itemsPerPage]);

 // Reset to page 1 when search changes
 useEffect(() => {
  setCurrentPage(1);
 }, [search]);

 const closeModalAndReset = () => {
 setIsModalOpen(false);
 resetForm();
 };

 if (permissionsLoading) {
 return (
 <div className="p-6 bg-[#F8FAFC] min-h-screen relative font-sans">
 <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">Loading...</div>
 </div>
 );
 }

 if (!canReadSU) {
 return (
 <div className="p-6 bg-[#F8FAFC] min-h-screen relative font-sans">
 <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-700">
 You do not have permission to view Service Users.
 </div>
 </div>
 );
 }

 return (
 <div className="p-6 bg-[#F8FAFC] min-h-screen relative font-sans">
 {/* HEADER */}
 {/* HEADER SECTION - Unified Card */}
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
 <div className="flex items-start justify-between gap-6">
 <div>
 <div className="flex items-center gap-3 mb-4">
 <Breadcrumbs
 items={[
 { label: 'Resident Management' },
 { label: 'Service Users', path: '/admin/service-users' }
 ]}
 />
 </div>
 <h1 className="text-3xl font-black text-slate-900 mt-1">Service Users Dashboard</h1>
 <p className="text-sm text-gray-500">Manage all service user records</p>
 </div>
 <div className="flex items-center gap-3">
 <DownloadDropdown
 onDownloadPDF={() => openExport('pdf')}
 onDownloadCSV={() => openExport('csv')}
 />
 </div>
 </div>
 </div>

 {/* STATS */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
 <StatCard
 color="bg-blue-500"
 icon="users"
 title="Total Users"
 value={stats.total}
 />
 <StatCard
 color="bg-emerald-500"
 icon="active"
 title="Active Users"
 value={stats.active}
 />
 <StatCard
 color="bg-orange-500"
 icon="alert"
 title="Requires Attention"
 value={stats.attention}
 />
 <StatCard
 color="bg-purple-500"
 icon="out"
 title="Moved Out"
 value={stats.movedOut}
 />
 </div>

 {/* SEARCH BAR WRAPPER */}
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 px-4 py-3 flex items-center gap-4">
 {/* LEFT LABEL */}
 <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
 User List
 </span>

 {/* SEARCH INPUT */}
 <div className="flex-1 flex items-center border border-gray-200 bg-gray-50 rounded-xl px-3 py-2">
 <svg
 className="text-gray-400 mr-2"
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <circle cx="11" cy="11" r="8" />
 <line x1="21" y1="21" x2="16.65" y2="16.65" />
 </svg>

 <input
 type="text"
 placeholder="Search by name, room, or property..."
 className="rounded-xl form-input !bg-transparent !border-none !focus:ring-0 !shadow-none !h-auto pt-0 pb-0"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>

 {/* FILTER BUTTON */}
 <div className="relative" ref={filtersRef}>
  <button
   type="button"
   onClick={() => setFiltersOpen((v) => !v)}
   className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50"
  >
   <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
   >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
   </svg>
   Filters
  </button>

  {filtersOpen && (
   <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20">
    <div className="text-xs font-semibold text-gray-500 mb-2">Status</div>
    <div className="grid grid-cols-2 gap-2 mb-3">
     <button
      type="button"
      onClick={() => setStatusFilter('all')}
      className={`px-3 py-2 rounded-lg text-sm border ${statusFilter === 'all' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
     >
      All
     </button>
     <button
      type="button"
      onClick={() => setStatusFilter('active')}
      className={`px-3 py-2 rounded-lg text-sm border ${statusFilter === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
     >
      Active
     </button>
     <button
      type="button"
      onClick={() => setStatusFilter('inactive')}
      className={`px-3 py-2 rounded-lg text-sm border ${statusFilter === 'inactive' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
     >
      Inactive
     </button>
     <button
      type="button"
      onClick={() => setStatusFilter('moved_out')}
      className={`px-3 py-2 rounded-lg text-sm border ${statusFilter === 'moved_out' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
     >
      Moved Out
     </button>
    </div>

    <div className="text-xs font-semibold text-gray-500 mb-2">Sort</div>
    <div className="grid grid-cols-2 gap-2 mb-3">
     <button
      type="button"
      onClick={() => setSortMode('latest')}
      className={`px-3 py-2 rounded-lg text-sm border ${sortMode === 'latest' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
     >
      Latest
     </button>
     <button
      type="button"
      onClick={() => setSortMode('alpha')}
      className={`px-3 py-2 rounded-lg text-sm border ${sortMode === 'alpha' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
     >
      A-Z
     </button>
    </div>

    <div className="flex items-center justify-between gap-2">
     <button
      type="button"
      onClick={() => {
       setStatusFilter('all');
       setSortMode('latest');
      }}
      className="text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
     >
      Reset
     </button>
     <button
      type="button"
      onClick={() => setFiltersOpen(false)}
      className="text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
     >
      Done
     </button>
    </div>
   </div>
  )}
 </div>
 </div>

 {/* GRID */}
 {loading ? (
 <div className="text-center py-20 text-gray-400">Loading...</div>
 ) : filteredUsers.length === 0 ? (
 <div className="text-center py-20 text-gray-400">
 No users found matching your search.
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 {paginatedUsers.map((user, index) => {
 let tags = [];
 if (user.vulnerabilities) {
 if (Array.isArray(user.vulnerabilities)) {
 tags = user.vulnerabilities;
 } else if (typeof user.vulnerabilities === "string") {
 tags = user.vulnerabilities
 .split(",")
 .map((t) => t.trim())
 .filter((t) => t.length > 0);
 }
 }

 const isDeleting = deletingIds.has(user.id);
 return (
 <div
 key={user.id || `${user.first_name}-${index}`}
 className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 ${isDeleting ? 'service-user-card-deleting' : ''}`}
 >
 <div
 className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shrink-0 ${getAvatarColor(
 index
 )}`}
 >
 {getInitials(user.first_name, user.last_name)}
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-start mb-2">
 <h3 className="text-lg font-semibold text-slate-900">
 {user.first_name} {user.last_name}
 </h3>
 <span
 className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${user.status === "Active"
 ? "bg-emerald-100 text-emerald-700"
 : user.status === "Moved Out"
 ? "bg-purple-100 text-purple-700"
 : "bg-gray-100 text-gray-700"
 }`}
 >
 {user.status || "N/A"}
 </span>
 </div>

 <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
 <div className="flex items-center gap-1.5">
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 className="text-gray-400 flex-shrink-0"
 >
 <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
 <circle cx="12" cy="10" r="3"></circle>
 </svg>
 <span className="truncate">
 {user.property ||
 user.hotel_name ||
 user.property_name ||
 "No Property"}
 {user.room_number && ` (Room ${user.room_number})`}
 </span>
 </div>
 <div className="flex items-center gap-1.5 text-gray-600">
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 className="text-gray-400 flex-shrink-0"
 >
 <rect
 x="3"
 y="4"
 width="18"
 height="18"
 rx="2"
 ry="2"
 ></rect>
 <line x1="16" y1="2" x2="16" y2="6"></line>
 <line x1="8" y1="2" x2="8" y2="6"></line>
 <line x1="3" y1="10" x2="21" y2="10"></line>
 </svg>
 <span>Move-in: {formatDate(user.admission_date)}</span>
 </div>
 </div>

 {tags.length > 0 && (
 <div className="flex flex-wrap gap-2 mb-3">
 {tags.map((tag, i) => (
 <span
 key={i}
 className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
 >
 <svg
 width="10"
 height="10"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <circle cx="12" cy="12" r="10"></circle>
 <line x1="12" y1="8" x2="12" y2="12"></line>
 <line x1="12" y1="16" x2="12.01" y2="16"></line>
 </svg>
 {tag}
 </span>
 ))}
 </div>
 )}

 <div className="flex gap-2">
 <button
 onClick={() => user.id && navigate(`/su/users/${user.id}`)
 }
 className="btn-secondary btn-sm rounded-xl"
 title="View Profile"
 >
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
 <circle cx="12" cy="12" r="3"></circle>
 </svg>
 View Profile
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleEditUser(user);
 }}
 disabled={!canUpdateSU}
 className="btn-secondary btn-sm rounded-xl"
 title="Edit User"
 >
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
 <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
 </svg>
 Edit
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteUser(user.id);
 }}
 disabled={!canDeleteSU}
 className="btn-secondary btn-sm hover:!text-red-600 hover:!bg-red-50 hover:!border-red-200 rounded-xl"
 title="Delete User"
 >
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <polyline points="3 6 5 6 21 6"></polyline>
 <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
 </svg>
 Delete
 </button>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Pagination Controls */}
 {filteredUsers.length > itemsPerPage && (
 <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
 <div className="text-sm text-gray-500">
 Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to <span className="font-medium">{Math.min(indexOfLastItem, filteredUsers.length)}</span> of <span className="font-medium">{filteredUsers.length}</span> results
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
 disabled={currentPage === 1}
 className="p-2 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="15 18 9 12 15 6"></polyline>
 </svg>
 </button>
 <span className="text-sm font-medium text-gray-700">
 Page {currentPage} of {totalPages}
 </span>
 <button
 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
 disabled={currentPage === totalPages}
 className="p-2 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="9 18 15 12 9 6"></polyline>
 </svg>
 </button>
 </div>
 </div>
 )}
 </>
 )}

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
 className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
 title="Close"
 >
 <svg
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <path d="M18 6L6 18M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="px-5 py-4">
 <div className="flex items-center justify-between mb-3">
 <div className="text-sm font-medium text-gray-700">Columns</div>
 <div className="flex items-center gap-3 text-xs">
 <button
 onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))}
 className="text-teal-600 hover:text-teal-700 font-medium rounded-xl"
 >
 Select all
 </button>
 <button
 onClick={() => setSelectedExportKeys([])}
 className="text-gray-600 hover:text-gray-700 font-medium rounded-xl"
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
 className="flex items-center gap-2 p-2 rounded-xl border border-gray-100 hover:bg-gray-50"
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
 className="w-4 h-4 text-teal-600 rounded-xl"
 />
 <span className="text-sm text-gray-700">{col.header}</span>
 </label>
 );
 })}
 </div>
 </div>

 <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
 <button
 onClick={closeExport}
 className="rounded-xl btn-secondary btn-sm"
 >
 Cancel
 </button>
 <button
 onClick={runExport}
 className="rounded-xl btn-primary btn-sm"
 >
 Download
 </button>
 </div>
 </div>
 </div>
 )}

 {/* MODAL */}
 {isModalOpen && (
 <div className="modal-overlay">
 <div className="modal-container h-[70vh]">
 <div className="modal-header">
 <div>
 <h2 className="modal-title">
 {formData.id ? "Edit Service User" : "Add Service User"}
 </h2>
 <p className="modal-subtitle">
 {formData.id
 ? "Update the service user record."
 : "Create a new service user record."}{" "}
 All fields marked with * are required.
 </p>
 </div>
 <button
 onClick={closeModalAndReset}
 className="rounded-xl modal-close-btn"
 >
 <svg
 width="24"
 height="24"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <path d="M18 6L6 18M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="modal-content">
 <form
 id="service-user-form"
 onSubmit={handleSubmitUser}
 className="form-section"
 >
 <div className="form-grid-2">
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 First Name <span className="text-red-500">*</span>
 </label>
 <input
 required
 name="first_name"
 value={formData.first_name}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Last Name <span className="text-red-500">*</span>
 </label>
 <input
 required
 name="last_name"
 value={formData.last_name}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 </div>

 <div className="form-grid-2">
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Date of Birth <span className="text-red-500">*</span>
 </label>
 <input
 type="date"
 required
 name="date_of_birth"
 value={formData.date_of_birth}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Nationality <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 name="nationality"
 value={formData.nationality}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 </div>

 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Home Office Reference <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 name="home_office_reference"
 value={formData.home_office_reference}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>

 <div className="form-grid-2">
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Gender <span className="text-red-500">*</span>
 </label>
 <select
 required
 name="gender"
 value={formData.gender || ""}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
 >
 <option value="">Select gender</option>
 <option value="Female">Female</option>
 <option value="Male">Male</option>
 <option value="Other">Other</option>
 <option value="Prefer not to say">
 Prefer not to say
 </option>
 </select>
 </div>
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Immigration Status <span className="text-red-500">*</span>
 </label>
 <select
 required
 name="immigration_status"
 value={formData.immigration_status || ""}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
 >
 <option value="">Select status</option>
 <option value="Pending">Pending</option>
 <option value="Approved">Approved</option>
 <option value="Refused">Refused</option>
 <option value="On Hold">On Hold</option>
 </select>
 </div>
 </div>

 <div className="form-grid-2">
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Property <span className="text-red-500">*</span>
 </label>
 <select
 required
 name="hotel_id"
 value={formData.hotel_id}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
 >
 <option value="">Select property</option>
 {hotels.map((h) => (
 <option key={h.id} value={h.id}>
 {h._displayName}
 </option>
 ))}
 </select>
 </div>
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Room <span className="text-red-500">*</span>
 </label>
 <select
 required
 name="room_id"
 value={formData.room_id}
 onChange={handleFormChange}
 disabled={!formData.hotel_id}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
 >
 <option value="">
 {formData.hotel_id
 ? "Select room"
 : "Select property first"}
 </option>
 {rooms.map((room) => (
 <option key={room.id} value={room.id}>
 {room.room_number}
 {room.type ? ` - ${room.type}` : ""}
 {room.status ? ` (${room.status})` : ""}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div className="form-grid-2">
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Number of Dependents <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 min="0"
 required
 name="number_of_dependents"
 value={
 formData.number_of_dependents === null ||
 formData.number_of_dependents === undefined
 ? ""
 : formData.number_of_dependents
 }
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Emergency Contact Name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 name="emergency_contact_name"
 value={formData.emergency_contact_name ?? ""}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 </div>

 <div className="form-grid-2">
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Emergency Contact Phone <span className="text-red-500">*</span>
 </label>
 <input
 type="tel"
 required
 name="emergency_contact_phone"
 value={formData.emergency_contact_phone ?? ""}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Move-in Date <span className="text-red-500">*</span>
 </label>
 <input
 type="date"
 required
 name="admission_date"
 value={formData.admission_date || ""}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>
 </div>

 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Vulnerabilities <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 name="vulnerabilities"
 value={formData.vulnerabilities ?? ""}
 onChange={handleFormChange}
 placeholder="Separate multiple items with commas"
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
 />
 </div>

 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Medical Conditions <span className="text-red-500">*</span>
 </label>
 <textarea
 required
 name="medical_conditions"
 value={formData.medical_conditions || ""}
 onChange={handleFormChange}
 rows={2}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
 ></textarea>
 </div>

 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Dietary Requirements <span className="text-red-500">*</span>
 </label>
 <textarea
 required
 name="dietary_requirements"
 value={formData.dietary_requirements || ""}
 onChange={handleFormChange}
 rows={2}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
 ></textarea>
 </div>

 {dynamicColumns.length > 0 && (
  <div className="mt-2">
   {suColumnsLoading ? (
    <div className="text-sm text-gray-400">Loading custom fields...</div>
   ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     {dynamicColumns.map((c) => renderDynamicField(c))}
    </div>
   )}
  </div>
 )}

 <div className="form-group">
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Status <span className="text-red-500">*</span>
 </label>
 <select
 required
 name="status"
 value={formData.status}
 onChange={handleFormChange}
 className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
 >
 <option value="Active">Active</option>
 <option value="Moved Out">Moved Out</option>
 <option value="Pending">Pending</option>
 </select>
 </div>
 </form>
 </div>

 <div className="modal-footer">
 <button
 type="button"
 onClick={closeModalAndReset}
 disabled={submitting}
 className="rounded-xl btn-secondary"
 >
 Cancel
 </button>
 <button
 type="submit"
 form="service-user-form"
 disabled={submitting}
 className="rounded-xl btn-primary"
 >
 {submitting
 ? formData.id
 ? "Updating..."
 : "Creating..."
 : formData.id
 ? "Update Service User"
 : "Create Service User"}
 </button>
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

function StatCard({ color, icon, title, value }) {
 const getIcon = () => {
 if (icon === "users")
 return (
 <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
 );
 if (icon === "active") return <path d="M20 6L9 17l-5-5" />;
 if (icon === "alert")
 return (
 <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 );
 return (
 <>
 <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
 <path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
 <path d="M18 8l5 5" />
 <path d="M23 8l-5 5" />
 </>
 );
 };

 return (
 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200">
 <div
 className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${color}`}
 >
 <svg
 width="24"
 height="24"
 viewBox="0 0 24 24"
 fill="none"
 stroke="white"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 {getIcon()}
 </svg>
 </div>
 <div>
 <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
 {title}
 </div>
 <div className="text-3xl font-bold text-slate-800 leading-none">
 {value}
 </div>
 </div>
 </div>
 );
}