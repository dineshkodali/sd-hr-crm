// src/pages/ServiceUserProfile.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { Home, ArrowLeft, User, MapPin, Calendar, FileText, Heart, Shield } from "lucide-react";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';

axios.defaults.withCredentials = true;

// Reuse the resilient API base resolution used elsewhere
const buildCandidateBases = () => {
 const list = [];
 // Priority 1: Environment variable
 if (import.meta.env.VITE_API_URL) list.push(import.meta.env.VITE_API_URL);

 if (typeof window !== "undefined") {
 const { origin, hostname, protocol } = window.location;

 // Priority 2: Same-origin API (for production deployments)
 list.push(`${origin}/api`);

 // Priority 3: Common development ports
 const ports = [4001, 4000, 4002, 4003, 4004, 4005, 5000, 8000, 8080, 3000];
 ports.forEach((p) => {
 list.push(`${protocol}//localhost:${p}/api`);
 list.push(`${protocol}//127.0.0.1:${p}/api`);
 if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
 list.push(`${protocol}//${hostname}:${p}/api`);
 }
 });
 }
 return Array.from(new Set(list));
};

const candidateBases = buildCandidateBases();
const createApi = (baseURL) =>
 axios.create({
 baseURL,
 withCredentials: true,
 });

const infoRow = (label, value) => (
 <div className="flex flex-col gap-1">
 <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
 {label}
 </span>
 <span className="text-base text-slate-800 font-medium">{value || "Not specified"}</span>
 </div>
);

const SummaryCard = ({ title, value, subtitle, icon }) => (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
 <div className="bg-blue-100 text-blue-600 h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0">
 {icon}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{title}</div>
 <div className="text-2xl font-black text-slate-800 leading-none">{value}</div>
 {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
 </div>
 </div>
);

// Helper to render a list of tags (for vulnerabilities, medical, etc.)
const TagList = ({ items, emptyText = "None recorded" }) => {
 let list = [];
 if (Array.isArray(items)) {
 list = items;
 } else if (typeof items === "string" && items.trim().length > 0) {
 list = items.split(",").map((i) => i.trim());
 }

 if (list.length === 0) {
 return <span className="text-slate-500 italic">{emptyText}</span>;
 }

 return (
 <div className="flex flex-wrap gap-2">
 {list.map((item, idx) => (
 <span
 key={idx}
 className="px-3 py-1.5 rounded-xl text-sm bg-slate-50 text-slate-700 border border-slate-200 font-medium"
 >
 {item}
 </span>
 ))}
 </div>
 );
};

export default function ServiceUserProfile() {
 const { id } = useParams();
 const navigate = useNavigate();
 const apiRef = useRef(createApi(candidateBases[0]));
 const [apiBase, setApiBase] = useState(candidateBases[0]);
 const [user, setUser] = useState(null);
 const [suColumns, setSuColumns] = useState([]);
 const [suColumnsLoading, setSuColumnsLoading] = useState(false);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [activeTab, setActiveTab] = useState("profile");

 const [recordsLoading, setRecordsLoading] = useState(false);
 const [recordsError, setRecordsError] = useState('');
 const [recordsByModule, setRecordsByModule] = useState(null);

 // Move Room Modal State
 const [showMoveRoomModal, setShowMoveRoomModal] = useState(false);
 const [properties, setProperties] = useState([]);
 const [selectedProperty, setSelectedProperty] = useState(null);
 const [floors, setFloors] = useState([]);
 const [selectedFloor, setSelectedFloor] = useState(null);
 const [availableRooms, setAvailableRooms] = useState({});
 const [moveRoomFormData, setMoveRoomFormData] = useState({
 property_id: "",
 property_name: "",
 floor: "",
 room_id: "",
 room_name: "",
 move_in_date: new Date().toISOString().substr(0, 10),
 notes: "",
 });
 const [movingRoom, setMovingRoom] = useState(false);

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

 // Move Room Functions
 const fetchProperties = async () => {
 try {
 const res = await axios.get("/api/hotels", { withCredentials: true });
 // Backend returns { hotels: [...] }
 setProperties(res.data?.hotels || res.data || []);
 } catch (err) {
 console.error("Failed to load properties:", err);
 setProperties([]); // Set empty array on error
 }
 };

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

 const fetchRoomsForProperty = async (propertyId) => {
 try {
 const res = await axios.get(`/api/hotels/${propertyId}/rooms`, { withCredentials: true });
 const rooms = res.data?.rooms || res.data || [];

 const floorMap = {};
 rooms.forEach((room) => {
 const floor = room.floor || "Ground Floor";
 if (!floorMap[floor]) floorMap[floor] = [];
 floorMap[floor].push(room);
 });

 setFloors(Object.keys(floorMap).sort());
 setAvailableRooms(floorMap);
 setSelectedFloor(null);
 setMoveRoomFormData((prev) => ({ ...prev, floor: "", room_id: "", room_name: "" }));
 } catch (err) {
 console.error("Failed to load rooms:", err);
 setFloors([]);
 setAvailableRooms({});
 }
 };

 const openMoveRoom = async () => {
 setMoveRoomFormData({
 property_id: "",
 property_name: "",
 floor: "",
 room_id: "",
 room_name: "",
 move_in_date: new Date().toISOString().substr(0, 10),
 notes: "",
 });
 await fetchProperties();
 setShowMoveRoomModal(true);
 };

 const closeMoveRoom = () => {
 setShowMoveRoomModal(false);
 setMoveRoomFormData({
 property_id: "",
 property_name: "",
 floor: "",
 room_id: "",
 room_name: "",
 move_in_date: new Date().toISOString().substr(0, 10),
 notes: "",
 });
 setMovingRoom(false);
 };

 const handlePropertyChange = (e) => {
 const propId = e.target.value;
 const property = properties.find((p) => p.id === parseInt(propId));

 setMoveRoomFormData((prev) => ({
 ...prev,
 property_id: propId,
 property_name: property?.name || "",
 }));
 setSelectedProperty(property);

 if (propId) {
 fetchRoomsForProperty(propId);
 }
 };

 const handleFloorChange = (e) => {
 const floor = e.target.value;
 setSelectedFloor(floor);
 setMoveRoomFormData((prev) => ({ ...prev, floor, room_id: "", room_name: "" }));
 };

 const handleRoomChange = (e) => {
 const roomId = e.target.value;
 const room = availableRooms[selectedFloor]?.find((r) => r.id === parseInt(roomId));

 setMoveRoomFormData((prev) => ({
 ...prev,
 room_id: roomId,
 room_name: room?.room_number || "",
 }));
 };

 const handleMoveRoomSubmit = async (e) => {
 e?.preventDefault?.();
 if (!moveRoomFormData.property_id || !moveRoomFormData.room_id) {
 setAlertDialog({
 isOpen: true,
 title: 'Missing Information',
 message: 'Please select property and room',
 type: 'warning'
 });
 return;
 }

 setMovingRoom(true);
 try {
 const payload = {
 service_user_id: user?.id || id,
 service_user_name: computed.fullName || "",
 property_id: moveRoomFormData.property_id,
 property_name: moveRoomFormData.property_name,
 room_id: moveRoomFormData.room_id,
 room_name: moveRoomFormData.room_name,
 move_in_date: moveRoomFormData.move_in_date,
 notes: moveRoomFormData.notes,
 };

 const moveRes = await axios.post("/api/move-ins", payload, { withCredentials: true });
 const userUpdate = moveRes?.data?.user_update;
 if (userUpdate?.attempted && userUpdate?.success === false) {
 throw new Error(
 userUpdate?.error ||
 "Move-in saved, but failed to update service user's current property/room in database."
 );
 }

 // Reload user data
 const res = await apiRef.current.get(`/su/users/${id}`);
 const userData = res?.data || res;
 setUser(userData);

 closeMoveRoom();
 setAlertDialog({
 isOpen: true,
 title: 'Success',
 message: 'User moved to new room successfully!',
 type: 'success'
 });
 } catch (err) {
 console.error("move room error:", err);
 setAlertDialog({
 isOpen: true,
 title: 'Move Failed',
 message: err?.response?.data?.message || "Failed to move user",
 type: 'error'
 });
 } finally {
 setMovingRoom(false);
 }
 };

 useEffect(() => {
 if (!id) return;
 let mounted = true;

 const resolveApiBase = async () => {
 let lastError = null;
 for (const base of candidateBases) {
 try {
 await axios.get(`${base}/health`, { timeout: 1500, withCredentials: true });
 if (!mounted) return null;
 apiRef.current = createApi(base);
 setApiBase(base);
 return base;
 } catch (err) {
 lastError = err;
 }
 }
 console.warn("ServiceUserProfile: no API base responded to /health", lastError?.message || lastError);
 return null;
 };

 async function load() {
 setLoading(true);
 setError("");
 try {
 // Do not block on /health checks; use default base immediately
 resolveApiBase().catch(() => null);
 if (!mounted) return;
 fetchServiceUserColumns().catch(() => null);
 const res = await apiRef.current.get(`/su/users/${id}`);
 // Handle response structure - axios wraps data in res.data
 const userData = res?.data || res;
 if (mounted) {
 setUser(userData);
 }
 } catch (err) {
 console.error("Failed to load service user", err);
 if (mounted)
 setError(
 err?.response?.data?.error ||
 err?.message ||
 "Unable to load service user"
 );
 } finally {
 if (mounted) setLoading(false);
 }
 }
 load();
 return () => {
 mounted = false;
 };
 }, [id]);

 const formatDate = (value, opts = { day: "2-digit", month: "long", year: "numeric" }) => {
 if (!value) return "Not specified";
 const d = new Date(value);
 if (Number.isNaN(d.getTime())) return "Not specified";
 return d.toLocaleDateString("en-GB", opts);
 };

 const computed = useMemo(() => {
 if (!user) {
 return { fullName: "", ageText: "â€”", property: "Not assigned" };
 }
 const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

 let ageText = "Not specified";
 if (user.date_of_birth || user.dob) {
 const dob = new Date(user.date_of_birth || user.dob);
 if (!Number.isNaN(dob.getTime())) {
 const diff = Date.now() - dob.getTime();
 const ageDate = new Date(diff);
 ageText = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
 }
 }

 const property =
 user.property ||
 user.hotel_name ||
 user.property_name ||
 user.hotel ||
 "Not assigned";

 return {
 fullName: fullName || "Service User",
 ageText,
 property,
 };
 }, [user]);

 const RESERVED_KEYS = useMemo(() => {
  return new Set([
   'id',
   'created_at',
   'updated_at',
   'created_by',
   'property',
   'hotel_name',
   'property_name',
   'first_name',
   'last_name',
   'date_of_birth',
   'dob',
   'nationality',
   'gender',
   'immigration_status',
   'home_office_reference',
   'hotel_id',
   'property_id',
   'room_id',
   'room_number',
   'admission_date',
   'number_of_dependents',
   'emergency_contact_name',
   'emergency_contact_phone',
   'vulnerabilities',
   'medical_conditions',
   'dietary_requirements',
   'family_type',
   'status',
  ]);
 }, []);

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

 const formatDynamicValue = (col, rawValue) => {
  const inputType = String(col?.input_type || '').toLowerCase();
  const inputTypeNorm = inputType === 'dropdown' ? 'select' : inputType;
  const opts = parseInputOptions(col?.input_options);
  const v = rawValue;

  if (v === null || v === undefined || v === '') return 'Not specified';

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
   return String(v);
  }

  return String(v);
 };

 const extractArray = (res) => {
 if (!res) return [];
 const outer = res.data ?? res;
 if (!outer) return [];
 if (Array.isArray(outer)) return outer;
 if (Array.isArray(outer.data)) return outer.data;
 if (Array.isArray(outer.rows)) return outer.rows;
 if (Array.isArray(outer.items)) return outer.items;
 return [];
 };

 const normalize = (v) => String(v ?? '').toLowerCase().trim();

 const matchesServiceUser = (row) => {
 if (!row || !user) return false;

 const rowId = row?.service_user_id ?? row?.serviceUserId ?? row?.resident_id ?? row?.residentId ?? row?.su_id ?? row?.suId ?? row?.user_id ?? row?.userId ?? null;
 if (rowId !== null && rowId !== undefined && String(rowId) === String(user?.id ?? id)) return true;

 const ho = normalize(user?.home_office_reference);
 if (ho) {
 const rowHo = normalize(row?.home_office_reference ?? row?.homeOfficeReference ?? row?.ho_ref ?? row?.hoRef);
 if (rowHo && rowHo === ho) return true;
 }

 const name = normalize(`${user?.first_name ?? ''} ${user?.last_name ?? ''}`).replace(/\s+/g, ' ').trim();
 if (name) {
 const candidates = [
 row?.service_user_name,
 row?.serviceUserName,
 row?.resident_name,
 row?.residentName,
 row?.user_name,
 row?.userName,
 row?.name,
 row?.full_name,
 row?.fullName,
 ].map((v) => normalize(v).replace(/\s+/g, ' ').trim());
 if (candidates.some((c) => c && c === name)) return true;
 }

 return false;
 };

 const RECORD_SOURCES = useMemo(() => {
 return [
 {
 module: 'Operation Hub',
 pages: [
 {
 key: 'inspections',
 title: 'Inspections',
 endpoint: '/api/inspections',
 route: '/admin/inspections'
 },
 {
 key: 'complaints',
 title: 'Complaints',
 endpoint: '/api/complaints',
 route: '/admin/complaints'
 },
 {
 key: 'litigation',
 title: 'Litigation',
 endpoint: '/api/litigation',
 route: '/admin/litigation'
 },
 {
 key: 'incidents',
 title: 'Incidents',
 endpoint: '/api/incidents',
 route: '/admin/incidents'
 },
 {
 key: 'maintenance',
 title: 'Maintenance',
 endpoint: '/api/maintenance',
 route: '/admin/maintenance'
 },
 {
 key: 'aire_tasks',
 title: 'AIRE Tasks',
 endpoint: '/api/aire-tasks',
 route: '/admin/aire-tasks'
 },
 ],
 },
 {
 module: 'HSE',
 pages: [
 {
 key: 'hse_incidents',
 title: 'HSE Incidents',
 endpoint: '/api/hse/hse-incidents',
 route: '/admin/hse/incidents'
 },
 {
 key: 'hse_audits',
 title: 'Audits',
 endpoint: '/api/hse/audits',
 route: '/admin/hse/audits'
 },
 {
 key: 'hse_risk',
 title: 'Risk Management',
 endpoint: '/api/hse/risk-management',
 route: '/admin/hse/risk-management'
 },
 {
 key: 'hse_training',
 title: 'Training',
 endpoint: '/api/hse/training',
 route: '/admin/hse/training'
 },
 ],
 },
 {
 module: 'Safeguarding',
 pages: [
 {
 key: 'sg_referrals',
 title: 'Referrals',
 endpoint: '/api/safeguarding/referrals',
 route: '/admin/safeguarding/referrals'
 },
 {
 key: 'sg_risk_assessments',
 title: 'Risk Assessments',
 endpoint: '/api/safeguarding/risk-assessments',
 route: '/admin/safeguarding/risk-assessments'
 },
 {
 key: 'sg_vulnerable_users',
 title: 'Vulnerable Users',
 endpoint: '/api/safeguarding/vulnerable-users',
 route: '/admin/safeguarding/vulnerable-users'
 },
 {
 key: 'sg_multi_agency',
 title: 'Multi-Agency',
 endpoint: '/api/safeguarding/multi-agency',
 route: '/admin/safeguarding/multi-agency'
 },
 ],
 },
 {
 module: 'Escalations',
 pages: [
 {
 key: 'case_management',
 title: 'Case Management',
 endpoint: '/api/case-management',
 route: '/admin/case-management'
 },
 {
 key: 'vcs_organisations',
 title: 'VCS Organisations',
 endpoint: '/api/vcs-organisations',
 route: '/admin/vcs-organisations'
 },
 {
 key: 'emergency_protocols',
 title: 'Emergency Protocols',
 endpoint: '/api/emergency-protocols',
 route: '/admin/emergency-protocols'
 },
 ],
 },
 ];
 }, []);

 const loadRelatedRecords = async () => {
 if (!user) return;
 if (recordsByModule) return;
 setRecordsError('');
 setRecordsLoading(true);
 try {
 const requests = [];
 const map = [];
 RECORD_SOURCES.forEach((group) => {
 (group.pages || []).forEach((p) => {
 requests.push(apiRef.current.get(p.endpoint, { params: { limit: 2000 } }));
 map.push({ module: group.module, page: p });
 });
 });

 const results = await Promise.allSettled(requests);
 const out = {};
 results.forEach((r, idx) => {
 const meta = map[idx];
 if (!meta) return;
 if (r.status !== 'fulfilled') return;
 const rows = extractArray(r.value);
 const matched = (rows || []).filter(matchesServiceUser);
 if (!matched.length) return;
 if (!out[meta.module]) out[meta.module] = {};
 out[meta.module][meta.page.key] = { page: meta.page, rows: matched };
 });

 setRecordsByModule(out);
 } catch (err) {
 console.error('Failed to load related records', err);
 setRecordsError(err?.message || 'Failed to load related records');
 } finally {
 setRecordsLoading(false);
 }
 };

 useEffect(() => {
 if (!String(activeTab || '').startsWith('records:')) return;
 loadRelatedRecords();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [activeTab, user?.id]);

 useEffect(() => {
 if (!showMoveRoomModal) {
 document.body.classList.remove('form-modal-open');
 return;
 }
 document.body.classList.add('form-modal-open');
 return () => {
 document.body.classList.remove('form-modal-open');
 };
 }, [showMoveRoomModal]);

 const recordPageTabs = useMemo(() => {
 return RECORD_SOURCES.flatMap((g) => (g.pages || []).map((p) => ({ ...p, module: g.module })));
 }, [RECORD_SOURCES]);

 const selectedRecordPageKey = useMemo(() => {
 const t = String(activeTab || '');
 if (!t.startsWith('records:')) return null;
 return t.slice('records:'.length) || null;
 }, [activeTab]);

 const selectedRecordEntry = useMemo(() => {
 if (!selectedRecordPageKey || !recordsByModule) return null;
 const moduleNames = Object.keys(recordsByModule);
 for (const moduleName of moduleNames) {
 const pages = recordsByModule[moduleName] || {};
 if (pages[selectedRecordPageKey]) return pages[selectedRecordPageKey];
 }
 return null;
 }, [recordsByModule, selectedRecordPageKey]);

 // Handle family type, gender, and emergency contact data from the database
 // Normalize array/string/null values
 const familyType = user?.family_type
 ? (Array.isArray(user.family_type)
 ? (user.family_type[0] || user.family_type.join(", ") || "Not specified")
 : (String(user.family_type).trim() || "Not specified"))
 : "Not specified";

 const gender = user?.gender
 ? (Array.isArray(user.gender)
 ? (user.gender[0] || "Not specified")
 : (String(user.gender).trim() || "Not specified"))
 : "Not specified";

 // Ensure dependents is a number
 const dependents = user?.number_of_dependents !== null && user?.number_of_dependents !== undefined
 ? Number(user.number_of_dependents) || 0
 : 0;

 // Handle emergency contact information - normalize arrays/strings
 const emergencyContactName = user?.emergency_contact_name
 ? (Array.isArray(user.emergency_contact_name)
 ? (user.emergency_contact_name[0] || user.emergency_contact_name.join(", ") || "Not specified")
 : (String(user.emergency_contact_name).trim() || "Not specified"))
 : "Not specified";

 const emergencyContactPhone = user?.emergency_contact_phone
 ? (Array.isArray(user.emergency_contact_phone)
 ? (user.emergency_contact_phone[0] || user.emergency_contact_phone.join(", ") || "Not specified")
 : (String(user.emergency_contact_phone).trim() || "Not specified"))
 : "Not specified";

 if (loading) {
 return (
 <div className="p-8">
 <div className="text-center text-slate-500">Loading service user...</div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="p-8 space-y-4">
 <button
 onClick={() => navigate(-1)}
 className="text-sm text-slate-500 hover:text-slate-800 rounded-xl"
 >
 â† Back
 </button>
 <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl">
 {error}
 </div>
 </div>
 );
 }

 if (!user) return null;

 const documentsCount = user?.documents_count || user?.documents?.length || 0;
 const statusPill = (label, tone = "emerald") => (
 <span
 className={`px-3 py-1 rounded-full text-xs font-semibold capitalize bg-${tone}-50 text-${tone}-600`}
 >
 {label}
 </span>
 );

 const handleBack = () => {
 try {
 if (window.history.length > 1) {
 navigate(-1);
 } else {
 navigate("/su/users");
 }
 } catch {
 navigate("/su/users");
 }
 };

 return (
 <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
 <div className="p-3 sm:p-4 md:p-6">
 {/* Header */}
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
 <div className="mb-4">
 <button
 type="button"
 onClick={handleBack}
 className="rounded-xl inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
 >
 <ArrowLeft className="w-4 h-4" />
 Back
 </button>
 </div>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{computed.fullName}</h1>
 <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
 <Home size={16} className="text-teal-500" />
 <span className="text-gray-400">/</span>
 <button onClick={() => navigate("/su/users")} className="hover:text-teal-600 font-medium transition-colors rounded-xl">Service Users</button>
 <span className="text-gray-400">/</span>
 <span className="text-gray-900 font-medium">Profile</span>
 </div>
 </div>
 <button
 onClick={openMoveRoom}
 className="bg-[#3deedd] hover:bg-[#34d7cd] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
 >
 <MapPin size={18} /> Move Room
 </button>
 </div>

 <div className="flex items-center gap-3 flex-wrap">
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status:</span>
 <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${user.status?.toLowerCase() === 'active'
 ? 'bg-green-100 text-green-700'
 : 'bg-red-100 text-red-700'
 }`}>
 {user.status || "Active"}
 </span>
 </div>
 {gender && gender !== "Not specified" && (
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gender:</span>
 <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">
 {gender}
 </span>
 </div>
 )}
 {user.immigration_status && (
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Immigration:</span>
 <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
 {user.immigration_status}
 </span>
 </div>
 )}
 {user.home_office_reference && (
 <div className="ml-auto flex items-center gap-2 text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
 <span className="font-semibold text-gray-700">HO Ref:</span>
 <span className="text-gray-600">{user.home_office_reference}</span>
 </div>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <SummaryCard
 title="Age"
 value={computed.ageText}
 subtitle={`DOB: ${formatDate(user.date_of_birth || user.dob, {
 day: "2-digit",
 month: "short",
 year: "numeric",
 })}`}
 icon={
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <circle cx="12" cy="12" r="10" />
 <polyline points="12 6 12 12 16 14" />
 </svg>
 }
 />
 <SummaryCard
 title="Property"
 value={computed.property === "Not assigned" ? "â€”" : computed.property}
 subtitle={user.room_number ? `Room ${user.room_number}` : "Room not assigned"}
 icon={
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
 <polyline points="9 22 9 12 15 12 15 22" />
 </svg>
 }
 />
 <SummaryCard
 title="Family"
 value={dependents}
 subtitle={familyType}
 icon={
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
 <circle cx="9" cy="7" r="4" />
 <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
 <path d="M16 3.13a4 4 0 0 1 0 7.75" />
 </svg>
 }
 />
 <SummaryCard
 title="Documents"
 value={documentsCount}
 subtitle="uploaded"
 icon={
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
 <polyline points="14 2 14 8 20 8" />
 </svg>
 }
 />
 </div>

 <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
 <div className="border-b border-gray-200 px-8 bg-white">
 <div className="flex gap-8 overflow-x-auto scrollbar-hide">
 {['profile', 'occupants', 'documents', 'health', 'checklists'].map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={`-mb-px px-1 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap rounded-t-xl ${activeTab === tab
 ? "border-teal-500 text-teal-600 bg-white"
 : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
 }`}
 >
 {tab === "health" ? "Health & Diet" : tab === "occupants" ? "Family / Occupants" : tab}
 </button>
 ))}
 {recordPageTabs.map((p) => {
 const tabKey = `records:${p.key}`;
 return (
 <button
 key={tabKey}
 onClick={() => setActiveTab(tabKey)}
 className={`-mb-px px-1 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap rounded-t-xl ${activeTab === tabKey
 ? "border-teal-500 text-teal-600 bg-white"
 : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
 }`}
 >
 {p.title}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 <div className="min-h-[300px]">
        {activeTab === "profile" && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-7 bg-teal-500 rounded-xl"></div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Personal Information
                  </h2>
                </div>
                <p className="text-sm text-gray-500 ml-4">
                  Basic demographic and contact information
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {infoRow("Full Name", computed.fullName)}
                {infoRow("Date of Birth", formatDate(user.date_of_birth || user.dob))}
                {infoRow("Gender", gender)}
                {infoRow("Nationality", user.nationality)}
                {infoRow("Immigration Status", user.immigration_status)}
                {infoRow("Home Office Reference", user.home_office_reference)}
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-7 bg-purple-500 rounded-xl"></div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Family & Emergency Information
                  </h2>
                </div>
                <p className="text-sm text-gray-500 ml-4">
                  Family structure and emergency contacts
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {infoRow("Family Type", familyType)}
                {infoRow("Number of Dependents", dependents.toString())}
                {infoRow("Emergency Contact Name", emergencyContactName)}
                {infoRow("Emergency Contact Phone", emergencyContactPhone)}
              </div>
            </section>
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-7 bg-blue-500 rounded-xl"></div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Accommodation
                  </h2>
                </div>
                <p className="text-sm text-gray-500 ml-4">
                  Current placement details
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {infoRow("Property", computed.property === "Not assigned" ? "Not assigned" : computed.property)}
                {infoRow("Move-in Date", formatDate(user.admission_date))}
              </div>
            </section>

            {dynamicColumns.length > 0 && (
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1.5 h-7 bg-slate-900 rounded-xl"></div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                      Custom Fields
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500 ml-4">
                    Additional information captured for this service user
                  </p>
                </div>

                {suColumnsLoading ? (
                  <div className="text-sm text-gray-400">Loading custom fields...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    {dynamicColumns.map((c) => {
                      const k = String(c?.column_name || '').trim();
                      if (!k) return null;
                      const label = labelize(k);
                      const value = formatDynamicValue(c, user?.[k]);
                      return (
                        <React.Fragment key={k}>
                          {infoRow(label, value)}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

 {activeTab === "health" && (
 <div className="space-y-6">
 <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
 <div className="mb-8">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-1.5 h-7 bg-red-500 rounded-xl"></div>
 <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
 Vulnerabilities
 </h2>
 </div>
 <p className="text-sm text-gray-500 ml-4">
 Recorded vulnerabilities and risk factors
 </p>
 </div>
 <TagList items={user.vulnerabilities} />
 </section>

 <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
 <div className="mb-8">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-1.5 h-7 bg-orange-500 rounded-xl"></div>
 <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
 Medical Conditions
 </h2>
 </div>
 <p className="text-sm text-gray-500 ml-4">
 Known medical conditions and requirements
 </p>
 </div>
 <TagList items={user.medical_conditions} />
 </section>

 <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
 <div className="mb-8">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-1.5 h-7 bg-green-500 rounded-xl"></div>
 <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
 Dietary Requirements
 </h2>
 </div>
 <p className="text-sm text-gray-500 ml-4">
 Specific dietary needs and allergies
 </p>
 </div>
 <TagList items={user.dietary_requirements} />
 </section>
 </div>
 )}

 {String(activeTab || '').startsWith('records:') && (
 <div className="space-y-6">
 <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
 <div className="mb-6">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-1.5 h-7 bg-slate-900 rounded-xl"></div>
 <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Records</h2>
 </div>
 <p className="text-sm text-gray-500 ml-4">
 Records linked to this service user across Operation Hub, HSE, Safeguarding and Escalations
 </p>
 </div>

 {recordsLoading ? (
 <div className="text-center py-16 text-gray-400">Loading records...</div>
 ) : recordsError ? (
 <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl">{recordsError}</div>
 ) : !recordsByModule ? (
 <div className="text-center py-16 text-gray-400">No records found for this service user.</div>
 ) : !selectedRecordEntry || !(selectedRecordEntry?.rows || []).length ? (
 <div className="text-center py-16 text-gray-400">No records found for this page.</div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={() => navigate(selectedRecordEntry.page.route)}
 className="text-sm font-semibold text-teal-700 hover:text-teal-800"
 >
 {selectedRecordEntry.page.title}
 </button>
 <div className="text-xs font-semibold text-slate-500">{(selectedRecordEntry.rows || []).length}</div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 {(selectedRecordEntry.rows || []).slice(0, 12).map((r, idx) => {
 const label = r?.title || r?.name || r?.subject || r?.reference || r?.ref || `Record ${idx + 1}`;
 const status = r?.status || r?.state || r?.stage || '';
 const dateRaw = r?.created_at ?? r?.createdAt ?? r?.admission_date ?? r?.date ?? r?.updated_at ?? r?.updatedAt ?? null;
 const dateText = dateRaw ? formatDate(dateRaw, { day: "2-digit", month: "short", year: "numeric" }) : '';
 return (
 <div key={idx} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
 <div className="flex items-center justify-between gap-2">
 <div className="text-sm font-semibold text-slate-900 truncate" title={label}>{label}</div>
 {status ? (
 <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{status}</span>
 ) : null}
 </div>
 <div className="text-xs text-slate-500 mt-1">{dateText}</div>
 </div>
 );
 })}
 </div>
 {(selectedRecordEntry.rows || []).length > 12 && (
 <div className="text-xs text-slate-500">Showing 12 of {(selectedRecordEntry.rows || []).length}</div>
 )}
 </div>
 )}
 </section>
 </div>
 )}

 {activeTab === "occupants" && (
    <OccupantsCard serviceUserId={id} />
 )}

 {activeTab === "documents" && (
    <TenantDocumentsCard serviceUserId={id} />
 )}

 {activeTab === "checklists" && (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-10 text-center text-gray-400">
 "Checklist management coming soon."
 </div>
 )}
 </div>
 </div>

 {/* Move Room Modal */}
 {showMoveRoomModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 sm:p-8">
 <div className="mb-6">
 <h2 className="text-2xl font-bold text-gray-900 mb-1">
 Move Resident to Different Room
 </h2>
 <p className="text-slate-600">
 Select property, floor, and available room for this resident
 </p>
 </div>

 <div className="space-y-6">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Property <span className="text-red-500">*</span>
 </label>
 <select
 value={moveRoomFormData.property_id || ""}
 onChange={handlePropertyChange}
 className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
 disabled={properties.length === 0}
 >
 <option value="">
 {properties.length === 0 ? "Loading..." : "Select Property"}
 </option>
 {properties.map((prop) => (
 <option key={prop.id} value={prop.id}>
 {prop.name || prop.property_name || `Hotel ${prop.id}`}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Floor <span className="text-red-500">*</span>
 </label>
 <select
 value={moveRoomFormData.floor || ""}
 onChange={handleFloorChange}
 className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
 disabled={!moveRoomFormData.property_id || floors.length === 0}
 >
 <option value="">
 {floors.length === 0 ? "Select property first" : "Select Floor"}
 </option>
 {floors.map((floor) => (
 <option key={floor} value={floor}>
 Floor {floor}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Room <span className="text-red-500">*</span>
 </label>
 <select
 value={moveRoomFormData.room_id || ""}
 onChange={handleRoomChange}
 className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
 disabled={!selectedFloor || !availableRooms[selectedFloor] || availableRooms[selectedFloor].length === 0}
 >
 <option value="">
 {!selectedFloor ? "Select floor first" : "Select Room"}
 </option>
 {selectedFloor && availableRooms[selectedFloor] && availableRooms[selectedFloor].map((room) => (
 <option key={room.id} value={room.id}>
 Room {room.room_number}
 {room.room_name ? ` - ${room.room_name}` : ""}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Move Date <span className="text-red-500">*</span>
 </label>
 <input
 type="date"
 value={moveRoomFormData.move_in_date || ""}
 onChange={(e) => setMoveRoomFormData({
 ...moveRoomFormData,
 move_in_date: e.target.value,
 })
 }
 className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-semibold text-gray-700 mb-2">
 Notes
 </label>
 <textarea
 value={moveRoomFormData.notes || ""}
 onChange={(e) => setMoveRoomFormData({
 ...moveRoomFormData,
 notes: e.target.value,
 })
 }
 className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
 rows="3"
 placeholder="Additional notes about the room move..."
 />
 </div>

 {moveRoomFormData.room_id && selectedFloor && availableRooms[selectedFloor] && (
 <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
 <p className="text-sm text-blue-900">
 <span className="font-semibold">Move Summary:</span> Moving to Room{" "}
 {availableRooms[selectedFloor].find((r) => r.id === parseInt(moveRoomFormData.room_id))
 ?.room_number || "N/A"}{" "}
 on {moveRoomFormData.move_in_date || "TBD"}
 </p>
 </div>
 )}
 </div>

 <div className="flex gap-3 mt-8">
 <button
 onClick={closeMoveRoom}
 className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleMoveRoomSubmit}
 disabled={
 movingRoom ||
 !moveRoomFormData.property_id ||
 !moveRoomFormData.floor ||
 !moveRoomFormData.room_id ||
 !moveRoomFormData.move_in_date
 }
 className="flex-1 px-4 py-2 bg-[#3deedd] hover:bg-[#22d7e5] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
 >
 {movingRoom ? "Processing..." : "Confirm Move"}
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

function TenantDocumentsCard({ serviceUserId }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [docType, setDocType] = useState('ID Document');

    const fetchDocs = async () => {
        if (!serviceUserId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/tenant-documents/${serviceUserId}`, { withCredentials: true });
            setDocs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
    }, [serviceUserId]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !serviceUserId) return;

        const formData = new FormData();
        formData.append('document', file);
        formData.append('document_type', docType);

        setUploading(true);
        try {
            await axios.post(`/api/tenant-documents/${serviceUserId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            setFile(null);
            
            const fileInput = document.getElementById('tenant-doc-file-input');
            if (fileInput) fileInput.value = '';
            
            fetchDocs();
        } catch (err) {
            alert(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await axios.delete(`/api/tenant-documents/${docId}`, { withCredentials: true });
            fetchDocs();
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between flex-wrap gap-4 mb-6 items-end">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Tenant Documents</h2>
                    <p className="text-sm text-gray-500">Manage ID proofs, contracts, and other related files.</p>
                </div>
                
                <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-inner">
                    <select 
                        value={docType} 
                        onChange={e => setDocType(e.target.value)}
                        className="border border-gray-300 rounded top-navbar text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="ID Document">ID Document</option>
                        <option value="Contract">Contract</option>
                        <option value="Medical Record">Medical Record</option>
                        <option value="Visa/Immigration">Visa/Immigration</option>
                        <option value="Other">Other</option>
                    </select>
                    <input 
                        id="tenant-doc-file-input"
                        type="file" 
                        onChange={e => setFile(e.target.files[0])} 
                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                        required
                    />
                    <button 
                        type="submit" 
                        disabled={uploading || !file}
                        className="btn-primary btn-sm rounded-lg px-6 py-2 disabled:opacity-50 transition-all font-medium whitespace-nowrap"
                    >
                        {uploading ? 'Uploading...' : 'Upload File'}
                    </button>
                </form>
            </div>

            {loading ? (
                <p className="text-center py-6 text-gray-500">Loading documents...</p>
            ) : docs.length === 0 ? (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-gray-500 font-medium tracking-wide">No documents uploaded yet.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Document Type</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">File Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date Uploaded</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {docs.map(doc => (
                                <tr key={doc.id} className="hover:bg-teal-50/50 transition-colors group">
                                    <td className="px-4 py-4 text-sm font-semibold text-gray-800">
                                        <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-md">{doc.document_type}</span>
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium">
                                        <a 
                                            href={doc.file_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                            {doc.file_name}
                                        </a>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500 font-medium">
                                        {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button 
                                            onClick={() => handleDelete(doc.id)} 
                                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Delete Document"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function OccupantsCard({ serviceUserId }) {
    const [occupants, setOccupants] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        relation: 'Child',
        dob: ''
    });

    const fetchOccupants = async () => {
        if (!serviceUserId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/occupants/${serviceUserId}`, { withCredentials: true });
            setOccupants(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load occupants', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOccupants();
    }, [serviceUserId]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axios.put(`/api/occupants/${editingId}`, form, { withCredentials: true });
            } else {
                await axios.post(`/api/occupants/${serviceUserId}`, form, { withCredentials: true });
            }
            setShowForm(false);
            setEditingId(null);
            setForm({ first_name: '', last_name: '', relation: 'Child', dob: '' });
            fetchOccupants();
        } catch (err) {
            alert(err.response?.data?.error || 'Save failed');
        }
    };

    const handleEdit = (occ) => {
        setForm({
            first_name: occ.first_name || '',
            last_name: occ.last_name || '',
            relation: occ.relation || 'Child',
            dob: occ.dob ? new Date(occ.dob).toISOString().split('T')[0] : ''
        });
        setEditingId(occ.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to remove this occupant?')) return;
        try {
            await axios.delete(`/api/occupants/${id}`, { withCredentials: true });
            fetchOccupants();
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Family & Occupants</h2>
                    <p className="text-sm text-gray-500">Manage family members residing with this tenant.</p>
                </div>
                {!showForm && (
                    <button 
                        onClick={() => setShowForm(true)}
                        className="btn-primary rounded-xl flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        Add Occupant
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                    <h3 className="text-md font-bold text-slate-800 mb-4">{editingId ? 'Edit Occupant' : 'New Occupant'}</h3>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                            <input 
                                required 
                                type="text" 
                                value={form.first_name} 
                                onChange={e => setForm({...form, first_name: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                            <input 
                                required 
                                type="text" 
                                value={form.last_name} 
                                onChange={e => setForm({...form, last_name: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Relation</label>
                            <select 
                                value={form.relation}
                                onChange={e => setForm({...form, relation: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                            >
                                <option value="Spouse">Spouse</option>
                                <option value="Child">Child</option>
                                <option value="Parent">Parent</option>
                                <option value="Sibling">Sibling</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                            <input 
                                type="date" 
                                value={form.dob} 
                                onChange={e => setForm({...form, dob: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-2">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingId(null);
                                    setForm({ first_name: '', last_name: '', relation: 'Child', dob: '' });
                                }}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p className="text-center py-6 text-gray-500">Loading occupants...</p>
            ) : occupants.length === 0 && !showForm ? (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-gray-500 font-medium tracking-wide">No occupants recorded.</p>
                </div>
            ) : occupants.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {occupants.map(occ => {
                        let ageText = '';
                        if (occ.dob) {
                            const dob = new Date(occ.dob);
                            if (!Number.isNaN(dob.getTime())) {
                                const diff = Date.now() - dob.getTime();
                                ageText = Math.abs(new Date(diff).getUTCFullYear() - 1970) + " yrs";
                            }
                        }
                        
                        return (
                            <div key={occ.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow relative group">
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={() => handleEdit(occ)} className="p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                    </button>
                                    <button onClick={() => handleDelete(occ.id)} className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                        {occ.first_name?.[0]}{occ.last_name?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">{occ.first_name} {occ.last_name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <span className="font-medium text-slate-700 bg-slate-100 px-1.5 rounded">{occ.relation}</span>
                                            {ageText && <span>â€¢ {ageText}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
