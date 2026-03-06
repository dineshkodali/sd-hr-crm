/* src/pages/MoveInOut.jsx */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Eye, ChevronDown, Filter, Columns, X, Home } from "lucide-react";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { usePermissions } from "../hooks/usePermissions";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'moveinout-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = DELETE_STYLE_ID;
  style.textContent = `
    @keyframes moveInOutCardDelete {
      0%   { opacity: 1; transform: scale(1) rotate(0deg); }
      30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
      100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
    }
    .moveinout-card-deleting {
      animation: moveInOutCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function toDateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.includes("T")) return value.slice(0, 10);
  }
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

const MOVE_IN_CHECKLIST_ITEMS = [
  "Verify identity documents",
  "Complete property induction",
  "Issue room keys",
  "Explain fire evacuation procedures",
  "Review house rules",
  "Check room condition",
  "Set up meal plan (if applicable)",
  "Provide emergency contacts",
  "Complete ARC/BRP check",
  "Assign bedspace",
];

const MOVE_OUT_CHECKLIST_ITEMS = [
  "Return room keys",
  "Room inspection completed",
  "No damage recorded",
  "Personal belongings removed",
  "Signature obtained",
];

export default function MoveInOutPage({ user }) {
  const MODULE_KEY = 'move_in_out';
  const {
    loading: permissionsLoading,
    canRead,
    canCreate,
    canUpdate,
    canDelete
  } = usePermissions(user);

  const canReadPage = canRead(MODULE_KEY);
  const canCreatePage = canCreate(MODULE_KEY);
  const canUpdatePage = canUpdate(MODULE_KEY);
  const canDeletePage = canDelete(MODULE_KEY);

  const [showModal, setShowModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Track cards currently being deleted for animation
  const [deletingIds, setDeletingIds] = useState(new Set());

  const pendingDeleteId = useRef(null);
  const pendingDeleteType = useRef(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning'
  });
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false, title: '', message: '', type: 'info'
  });

  useEffect(() => {
    const shouldHide = Boolean(showModal || showOutModal || showDetailModal || confirmDialog.isOpen);
    try {
      document.body.classList.toggle("form-modal-open", shouldHide);
    } catch (error) { console.error(error); }
    return () => {
      try { document.body.classList.remove("form-modal-open"); } catch (error) { console.error(error); }
    };
  }, [showModal, showOutModal, showDetailModal, confirmDialog.isOpen]);

  const [hotels, setHotels] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bedspaces, setBedspaces] = useState([]);
  const [recent, setRecent] = useState([]);
  const [moveOuts, setMoveOuts] = useState([]);
  const [counts, setCounts] = useState({ active: 0, moveIns: 0, moveOuts: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('moveInOutSnapshot.v1');
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (!snap || typeof snap !== 'object') return;
      if (Array.isArray(snap.hotels)) setHotels(snap.hotels);
      if (Array.isArray(snap.serviceUsers)) setServiceUsers(snap.serviceUsers);
      if (Array.isArray(snap.recent)) setRecent(snap.recent);
      if (Array.isArray(snap.moveOuts)) setMoveOuts(snap.moveOuts);
      if (snap.counts && typeof snap.counts === 'object') setCounts(snap.counts);
    } catch { }
  }, []);

  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState("ins");
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [sortBy, setSortBy] = useState('');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const viewRef = useRef(null);

  const ALL_COLUMNS = ["serviceUser", "property", "room", "moveInDate", "status", "actions"];
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}));
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedExportKeys, setSelectedExportKeys] = useState([]);

  const api = useMemo(() => axios.create({
    baseURL: import.meta.env.VITE_API_URL || "", withCredentials: true, timeout: 15000,
  }), []);

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

  const activeMoveIns = useMemo(() => {
    const movedOutIds = new Set((moveOuts || []).map((o) => String(o.service_user_id || o.serviceUserId).toLowerCase()));
    return (recent || []).filter((r) => {
      const suId = String(r.service_user_id || r.serviceUserId).toLowerCase();
      if (movedOutIds.has(suId)) return false;
      if (filterProperty && String(r.property_id || r.propertyId) !== String(filterProperty)) return false;
      return true;
    });
  }, [recent, moveOuts, filterProperty]);

  const moveInStatus = useCallback((r) => {
    const suId = String(r?.service_user_id || r?.serviceUserId).toLowerCase();
    return (moveOuts || []).some((m) => String(m?.service_user_id || m?.serviceUserId).toLowerCase() === suId) ? 'inactive' : 'active';
  }, [moveOuts]);

  const resolveServiceUserName = useCallback((record) => {
    const r = record || {};
    const explicitName = r.service_user_name || r.serviceUserName || r.serviceUser;
    if (explicitName && String(explicitName).trim() && !/^\d+$/.test(String(explicitName).trim())) return String(explicitName).trim();
    const suId = r.service_user_id || r.serviceUserId || r.service_user || r.serviceUser;
    if (!suId) return "Unknown User";
    const match = (serviceUsers || []).find((s) => String(s.id) === String(suId));
    if (match?.name) return String(match.name);
    return "Unknown User";
  }, [serviceUsers]);

  const sortRecords = useCallback((items, getDate, getName, getProperty) => {
    const arr = Array.isArray(items) ? [...items] : [];
    if (!sortBy) return arr;
    if (sortBy === 'date') return arr.sort((a, b) => (new Date(getDate(b) || 0).getTime()) - (new Date(getDate(a) || 0).getTime()));
    if (sortBy === 'name') return arr.sort((a, b) => String(getName(a) || '').localeCompare(String(getName(b) || ''), undefined, { sensitivity: 'base' }));
    if (sortBy === 'property') return arr.sort((a, b) => String(getProperty(a) || '').localeCompare(String(getProperty(b) || ''), undefined, { sensitivity: 'base' }));
    return arr;
  }, [sortBy]);

  const moveInsForDisplay = useMemo(() => {
    const base = Array.isArray(recent) ? recent : [];
    const pf = filterProperty ? base.filter((r) => String(r.property_id || r.propertyId) === String(filterProperty)) : base;
    const sf = filterStatus && filterStatus !== 'All Status' ? pf.filter((r) => moveInStatus(r) === String(filterStatus).toLowerCase()) : pf;
    return sortRecords(sf, (r) => r?.move_in_date || r?.moveInDate || r?.created_at, (r) => resolveServiceUserName(r), (r) => r?.property_name || r?.propertyName || '');
  }, [recent, filterProperty, filterStatus, moveInStatus, resolveServiceUserName, sortRecords]);

  const activeMoveInsForDisplay = useMemo(() => {
    const base = Array.isArray(activeMoveIns) ? activeMoveIns : [];
    const sf = filterStatus && filterStatus !== 'All Status' ? base.filter((r) => moveInStatus(r) === String(filterStatus).toLowerCase()) : base;
    return sortRecords(sf, (r) => r?.move_in_date || r?.moveInDate || r?.created_at, (r) => resolveServiceUserName(r), (r) => r?.property_name || r?.propertyName || '');
  }, [activeMoveIns, filterStatus, moveInStatus, resolveServiceUserName, sortRecords]);

  const moveOutsForDisplay = useMemo(() => {
    const base = Array.isArray(moveOuts) ? moveOuts : [];
    const sf = filterStatus && filterStatus !== 'All Status' ? base.filter(() => String(filterStatus).toLowerCase() === 'inactive') : base;
    return sortRecords(sf, (r) => r?.move_out_date || r?.created_at, (r) => r?.service_user_name || '', (r) => r?.property_name || r?.propertyName || '');
  }, [moveOuts, filterStatus, sortRecords]);

  const exportColumns = useMemo(() => [
    { header: 'Service User', key: 'serviceUser' }, { header: 'Property', key: 'property' },
    { header: 'Room', key: 'room' }, { header: 'Bedspace', key: 'bedspace' },
    { header: 'Date', key: 'date' }, { header: 'Status', key: 'status' }, { header: 'Notes', key: 'notes' },
  ], []);

  useEffect(() => {
    const nextKeys = exportColumns.map((c) => c.key);
    setSelectedExportKeys((prev) => {
      const prevSet = new Set(prev);
      const merged = nextKeys.filter((k) => prevSet.has(k));
      if (merged.length === 0) return nextKeys;
      for (const k of nextKeys) { if (!prevSet.has(k)) merged.push(k); }
      return merged;
    });
  }, [exportColumns]);

  const getExportList = useCallback(() => {
    if (activeTab === 'active') return activeMoveInsForDisplay || [];
    if (activeTab === 'outs') return moveOutsForDisplay || [];
    return moveInsForDisplay || [];
  }, [activeTab, activeMoveInsForDisplay, moveInsForDisplay, moveOutsForDisplay]);

  const normalizeExportRow = useCallback((r) => {
    const isOut = activeTab === 'outs';
    return {
      serviceUser: isOut ? (r.service_user_name || r.serviceUserName || r.serviceUser || 'Unknown User') : resolveServiceUserName(r),
      property: r.property_name || r.propertyName || 'No Property',
      room: r.room_name || r.roomName || '',
      bedspace: r.bedspace_name || r.bedspaceName || '',
      date: isOut ? (r.move_out_date || r.moveOutDate || r.created_at || '') : (r.move_in_date || r.moveInDate || r.created_at || ''),
      status: isOut ? 'inactive' : moveInStatus(r),
      notes: r.notes || '',
    };
  }, [activeTab, resolveServiceUserName, moveInStatus]);

  const openExport = (format) => { setExportFormat(format); setShowExportModal(true); setSelectedExportKeys((prev) => (prev && prev.length ? prev : exportColumns.map((c) => c.key))); };
  const closeExport = () => { setShowExportModal(false); setExportFormat(null); };
  const runExport = () => {
    try {
      const keySet = new Set(selectedExportKeys || []);
      const columns = (exportColumns || []).filter((c) => keySet.has(c.key));
      if (!columns.length) { alert('Please select at least one column to download.'); return; }
      const list = getExportList();
      const data = (list || []).map(normalizeExportRow);
      const fileBase = activeTab === 'outs' ? 'move-outs' : activeTab === 'active' ? 'active-residents' : 'move-ins';
      const title = activeTab === 'outs' ? 'Move-Outs Report' : activeTab === 'active' ? 'Active Residents Report' : 'Move-Ins Report';
      if (exportFormat === 'pdf') generatePDF(data, columns, title, fileBase);
      else if (exportFormat === 'csv') generateCSV(data, columns, fileBase);
      closeExport();
    } catch (error) { console.error('Error exporting:', error); alert('Failed to download: ' + error.message); }
  };

  useEffect(() => {
    setCounts({ active: activeMoveIns.length, moveIns: Array.isArray(recent) ? recent.length : 0, moveOuts: Array.isArray(moveOuts) ? moveOuts.length : 0 });
  }, [recent, moveOuts, activeMoveIns.length]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    async function fetchData() {
      try {
        const [moveInsRes, moveOutsRes, hotelsRes, suRes] = await Promise.all([
          api.get("/api/move-ins", { signal: controller.signal }),
          api.get("/api/move-outs", { signal: controller.signal }),
          api.get("/api/hotels", { params: { limit: 200 }, signal: controller.signal }),
          api.get("/api/su", { params: { limit: 200 }, signal: controller.signal }).catch(() => ({ data: [] }))
        ]);
        if (!mounted) return;

        const miList = moveInsRes?.data?.rows ?? moveInsRes?.data?.data ?? moveInsRes?.data ?? [];
        const normalizedMi = Array.isArray(miList) ? miList.map(r => ({
          id: r.id,
          service_user_id: r.service_user_id ?? r.serviceUserId ?? r.service_userId,
          service_user_name: r.service_user_name ?? r.serviceUserName ?? '',
          property_id: r.property_id ?? r.propertyId,
          property_name: r.property_name ?? r.propertyName ?? null,
          room_id: r.room_id ?? r.roomId,
          room_name: r.room_name ?? r.roomName ?? null,
          bedspace_id: r.bedspace_id ?? r.bedspaceId,
          bedspace_name: r.bedspace_name ?? r.bedspaceName ?? null,
          move_in_date: r.move_in_date ?? r.moveInDate ?? r.created_at ?? null,
          checklist: r.checklist || r.check_list || {},
          notes: r.notes || null, signature: r.signature || null,
          created_at: r.created_at || r.createdAt || null,
        })) : [];
        const uniqueMi = [];
        const seenMi = new Set();
        for (const item of normalizedMi) {
          if (item.id && !seenMi.has(String(item.id))) { seenMi.add(String(item.id)); uniqueMi.push(item); }
        }
        setRecent(uniqueMi);

        const moList = moveOutsRes?.data?.rows ?? moveOutsRes?.data?.data ?? moveOutsRes?.data ?? [];
        const normalizedMo = Array.isArray(moList) ? moList.map(r => ({
          id: r.id,
          service_user_id: r.service_user_id ?? r.serviceUserId ?? r.service_user ?? r.serviceUser,
          service_user_name: r.service_user_name ?? r.serviceUserName ?? r.serviceUser ?? null,
          property_name: r.property_name ?? r.propertyName ?? null,
          move_out_date: r.move_out_date ?? r.moveOutDate ?? r.created_at ?? null,
          checklist: r.checklist || {}, notes: r.notes || null, created_at: r.created_at || null,
        })) : [];
        const uniqueMo = [];
        const seenMo = new Set();
        for (const item of normalizedMo) {
          if (item.id && item.service_user_id && !seenMo.has(String(item.id))) { seenMo.add(String(item.id)); uniqueMo.push(item); }
        }
        setMoveOuts(uniqueMo);

        const hs = (hotelsRes?.data?.hotels ?? hotelsRes?.data?.data ?? hotelsRes?.data ?? []) || [];
        const nextHotels = Array.isArray(hs) ? hs.map(h => ({ id: h.id, name: h.name, total_beds: h.total_beds ?? h.totalBeds ?? null, occupied_beds: h.occupied_beds ?? h.occupiedBeds ?? null })) : [];
        setHotels(nextHotels);

        const sus = (suRes?.data?.data ?? suRes?.data ?? []) || [];
        const nextServiceUsers = Array.isArray(sus) ? sus.map(s => ({
          id: s.id,
          name: [s.first_name, s.last_name].filter(Boolean).join(" ") || s.name || "Unknown User",
          property_id: s.property_id ?? s.hotel_id ?? null,
        })) : [];
        setServiceUsers(nextServiceUsers);

        const movedOutIds = new Set((uniqueMo || []).map((o) => String(o?.service_user_id || o?.serviceUserId).toLowerCase()));
        const activeCount = (uniqueMi || []).filter((r) => !movedOutIds.has(String(r?.service_user_id || r?.serviceUserId).toLowerCase())).length;
        try {
          localStorage.setItem('moveInOutSnapshot.v1', JSON.stringify({
            hotels: nextHotels, serviceUsers: nextServiceUsers, recent: uniqueMi, moveOuts: uniqueMo,
            counts: { active: activeCount, moveIns: uniqueMi.length, moveOuts: uniqueMo.length },
          }));
        } catch { }
      } catch (error) {
        const name = error?.name;
        const msg = String(error?.message || "");
        if (name === 'CanceledError' || name === 'AbortError' || msg.toLowerCase().includes('canceled')) return;
        console.error('Failed to load MoveInOut data:', error);
      }
    }
    fetchData();
    return () => { mounted = false; controller.abort(); };
  }, [api]);

  // Icons
  const IconUsers = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
  const IconMoveIn = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>);
  const IconMoveOut = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>);
  const IconEmpty = ({ size = 48 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>);
  const IconEdit = ({ size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
  const IconTrash = ({ size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>);
  const IconEye = ({ size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>);

  const fetchRooms = useCallback(async (hotelId) => {
    if (!hotelId) { setRooms([]); return []; }
    try {
      const r = await api.get(`/api/su/rooms/${encodeURIComponent(hotelId)}`);
      const list = r?.data?.rooms ?? r?.data?.data ?? r?.data ?? [];
      const normalized = Array.isArray(list) ? list.map((x) => ({ id: x.id, room_number: x.room_number ?? x.number ?? x.name ?? x.id })) : [];
      setRooms(normalized.map((x) => ({ id: x.id, room_number: x.room_number, name: x.room_number || x.name || x.id })));
      return normalized;
    } catch (err) { console.warn("fetchRooms failed", err?.message || err); setRooms([]); return []; }
  }, [api]);

  const fetchBedspaces = useCallback(async (hotelId, roomId) => {
    if (!hotelId || !roomId) { setBedspaces([]); return []; }
    try {
      const r = await api.get(`/api/hotels/${encodeURIComponent(hotelId)}/rooms/${encodeURIComponent(roomId)}/bedspaces`);
      const list = r?.data?.bedspaces ?? r?.data?.data ?? r?.data ?? [];
      const normalized = Array.isArray(list) ? list.map((b) => ({ id: b.id, name: b.name ?? b.label ?? String(b.id) })) : [];
      setBedspaces(normalized);
      return normalized;
    } catch (err) { console.warn("fetchBedspaces failed", err?.message || err); setBedspaces([]); return []; }
  }, [api]);

  const onSave = useCallback(async (payload) => {
    try {
      if (payload && payload.id) { if (!canUpdatePage) throw new Error("Permission denied"); }
      else { if (!canCreatePage) throw new Error("Permission denied"); }
      const su = serviceUsers.find((s) => String(s.id) === String(payload.serviceUserId));
      const hotel = hotels.find((h) => String(h.id) === String(payload.propertyId));
      const room = rooms.find((r) => String(r.id) === String(payload.roomId));
      const bed = bedspaces.find((b) => String(b.id) === String(payload.bedspaceId));
      const body = {
        service_user_id: payload.serviceUserId ? String(payload.serviceUserId) : payload.serviceUserId,
        service_user_name: su?.name || null,
        property_id: payload.propertyId ? String(payload.propertyId) : payload.propertyId,
        property_name: hotel?.name || hotel?._displayName || null,
        room_id: payload.roomId ? String(payload.roomId) : payload.roomId,
        room_name: room?.room_number || room?.name || null,
        bedspace_id: payload.bedspaceId ? String(payload.bedspaceId) : null,
        bedspace_name: bed?.name || null,
        move_in_date: toDateInputValue(payload.moveInDate),
        checklist: payload.checklist || {},
        notes: payload.notes || null,
        signature: payload.signature || null,
      };
      if (payload && payload.id) {
        const res = await api.put(`/api/move-ins/${encodeURIComponent(payload.id)}`, body);
        if (res?.data?.row) return res.data.row;
        return res?.data || null;
      }
      const res = await api.post("/api/move-ins", body);
      if (res?.data?.row) return res.data.row;
      return res?.data || null;
    } catch (err) { console.error("saveMoveIn failed", err && err.response ? err.response.data : err); throw err; }
  }, [api, serviceUsers, hotels, rooms, bedspaces, canCreatePage, canUpdatePage]);

  const onDelete = useCallback(async (id) => {
    if (!id) return;
    try {
      if (!canDeletePage) throw new Error("Permission denied");
      await api.delete(`/api/move-ins/${encodeURIComponent(id)}`);
      setRecent((prev) => prev.filter((r) => String(r.id) !== String(id)));
    } catch (err) { console.error("deleteMoveIn failed", err && err.response ? err.response.data : err); throw err; }
  }, [api, canDeletePage]);

  const onDeleteMoveOut = useCallback(async (id) => {
    if (!id) return;
    try {
      if (!canDeletePage) throw new Error("Permission denied");
      await api.delete(`/api/move-outs/${encodeURIComponent(id)}`);
      setMoveOuts((prev) => prev.filter((m) => String(m.id) !== String(id)));
    } catch (err) { console.error("deleteMoveOut failed", err && err.response ? err.response.data : err); throw err; }
  }, [api, canDeletePage]);

  const handleDeleteConfirm = useCallback(async () => {
    const id = pendingDeleteId.current;
    const type = pendingDeleteType.current;
    if (!canDeletePage) {
      setAlertDialog({ isOpen: true, title: 'Permission Denied', message: 'You do not have permission to delete records.', type: 'warning' });
      pendingDeleteId.current = null; pendingDeleteType.current = null;
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      return;
    }
    if (!id || !type) return;
    try {
      setDeleting(true);
      setDeletingIds(prev => new Set(prev).add(id));
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));

      const ANIM_DURATION = 460;
      setTimeout(() => {
        if (type === "move-in") setRecent((prev) => prev.filter((r) => String(r.id) !== String(id)));
        else if (type === "move-out") setMoveOuts((prev) => prev.filter((m) => String(m.id) !== String(id)));
        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      }, ANIM_DURATION);

      if (type === "move-in") await api.delete(`/api/move-ins/${encodeURIComponent(id)}`).catch(() => null);
      else if (type === "move-out") await api.delete(`/api/move-outs/${encodeURIComponent(id)}`).catch(() => null);
    } catch (err) {
      console.error(err);
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      setAlertDialog({ isOpen: true, title: 'Delete Failed', message: 'Delete failed. See console for details.', type: 'error' });
    } finally {
      setDeleting(false); pendingDeleteId.current = null; pendingDeleteType.current = null;
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  }, [canDeletePage, api]);

  const openDeleteConfirm = useCallback((id, type, title, message) => {
    pendingDeleteId.current = id; pendingDeleteType.current = type;
    setConfirmDialog({ isOpen: true, title, message, type: 'danger', confirmText: 'Confirm', onConfirm: handleDeleteConfirm });
  }, [handleDeleteConfirm]);

  const activeResidents = useMemo(() => {
    if (!Array.isArray(recent)) return [];
    const movedOutIds = new Set((moveOuts || []).map((o) => String(o.service_user_id || o.serviceUserId).trim().toLowerCase()));
    return recent
      .filter((r) => !movedOutIds.has(String(r.service_user_id || r.serviceUserId).trim().toLowerCase()))
      .map((r) => ({ id: r.service_user_id || r.serviceUserId || r.service_user || r.serviceUser, name: r.service_user_name || r.serviceUserName || r.serviceUser || "Unknown" }));
  }, [recent, moveOuts]);

  const saveMoveOut = useCallback(async (payload) => {
    try {
      if (editing && editing.id) { if (!canUpdatePage) throw new Error("Permission denied"); }
      else { if (!canCreatePage) throw new Error("Permission denied"); }
      let userName = payload.service_user_name || null;
      if (!userName) { const su = activeResidents.find((s) => String(s.id) === String(payload.serviceUserId)); if (su) userName = su.name; }
      if (!userName) { const ru = recent.find((r) => String(r.service_user_id || r.serviceUserId) === String(payload.serviceUserId)); if (ru) userName = ru.service_user_name || ru.serviceUserName; }
      const body = { service_user_id: payload.serviceUserId, service_user_name: userName, move_out_date: payload.moveOutDate || payload.move_out_date || null, checklist: payload.checklist || {}, notes: payload.notes || null, signature: payload.signature || null };
      if (editing && editing.id) { const res = await api.patch(`/api/move-outs/${editing.id}`, body); return res?.data?.row ?? res?.data ?? null; }
      const res = await api.post("/api/move-outs", body);
      return res?.data?.row ?? res?.data ?? null;
    } catch (err) { console.error("saveMoveOut failed", err && err.response ? err.response.data : err); throw err; }
  }, [api, activeResidents, editing, recent, canCreatePage, canUpdatePage]);

  function handleOutCreated(saved) {
    if (!saved) return;
    const record = { id: saved.id || Math.floor(Math.random() * 1000000), service_user_id: saved.service_user_id, service_user_name: saved.service_user_name || null, move_out_date: saved.move_out_date || saved.moveOutDate || saved.created_at || null, notes: saved.notes || null, checklist: saved.checklist || null, created_at: saved.created_at || new Date().toISOString() };
    if (editing) { setMoveOuts((prev) => prev.map((m) => (String(m.id) === String(record.id) ? record : m))); }
    else { setMoveOuts((prev) => [record, ...(prev || [])]); }
    setShowOutModal(false); setEditing(null);
  }

  if (permissionsLoading) {
    return (<div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700"><div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto"><div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">Loading...</div></div></div>);
  }
  if (!canReadPage) {
    return (<div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700"><div className="w-[90%] max-w-[1800px] mx-auto"><div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-700">You do not have permission to view Move-In/Out.</div></div></div>);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Breadcrumbs items={[{ label: 'Resident Management' }, { label: 'Move-In/Out' }]} />
            <h1 className="text-3xl font-black text-slate-900 mt-1">Move-In/Out Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
            {canCreatePage && (
              <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary rounded-xl">
                <IconMoveIn size={18} /> Process Move-In
              </button>
            )}
            {canCreatePage && (
              <button onClick={() => { setEditing(null); setShowOutModal(true); }} className="btn-secondary rounded-xl">
                <IconMoveOut size={18} /> Process Move-Out
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all duration-200">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0"><IconUsers size={24} /></div>
            <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Active Residents</div><div className="text-2xl font-black text-slate-800 leading-none">{counts.active}</div><div className="text-xs text-gray-500 mt-1">Currently housed</div></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all duration-200">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0"><IconMoveIn size={24} /></div>
            <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Recent Move-Ins</div><div className="text-2xl font-black text-slate-800 leading-none">{counts.moveIns}</div><div className="text-xs text-gray-500 mt-1">Last 30 days</div></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all duration-200">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0"><IconMoveOut size={24} /></div>
            <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Recent Move-Outs</div><div className="text-2xl font-black text-slate-800 leading-none">{counts.moveOuts}</div><div className="text-xs text-gray-500 mt-1">Last 30 days</div></div>
          </div>
        </div>

        {/* Content Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[400px] transition-all duration-200">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200 px-6 pt-6">
            {[["ins", "Move-Ins"], ["outs", "Move-Outs"], ["active", "Active Residents"]].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>{label}</button>
            ))}
          </div>

          <div className="p-6">
            <div className="mb-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{activeTab === "ins" ? "Recent Move-Ins" : activeTab === "outs" ? "Recent Move-Outs" : "Active Residents"}</h3>
                <p className="text-sm text-gray-500">{activeTab === "ins" ? "Service users who recently moved into accommodation" : activeTab === "outs" ? "Service users who recently moved out" : "Currently active residents"}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" /><select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} className="form-select !pl-10 rounded-xl"><option value="">All Properties</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" /><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select !pl-10 rounded-xl"><option value="All Status">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                <div className="relative"><Columns className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" /><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-select !pl-10 rounded-xl"><option value="">Sort by...</option><option value="date">Date (Newest)</option><option value="name">Name</option><option value="property">Property</option></select></div>

                <div className="relative ml-auto" ref={viewRef}>
                  <button onClick={() => setShowViewMenu(!showViewMenu)} className="btn-secondary rounded-xl"><Eye className="w-4 h-4" /><span>View</span><ChevronDown className="w-4 h-4" /></button>
                  {showViewMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">View Settings</h3>
                        <button onClick={() => setShowPropertyVisibility(!showPropertyVisibility)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 rounded-xl transition-colors">
                          <span>Column visibility</span>
                          <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{Object.values(visibleColumns).filter(Boolean).length} shown</span><ChevronDown className={`w-4 h-4 transition-transform ${showPropertyVisibility ? 'rotate-180' : ''}`} /></div>
                        </button>
                        {showPropertyVisibility && (
                          <div className="mt-2 border-t border-gray-200 pt-3">
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Shown in view</span><button onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: false }), {}))} className="text-xs text-teal-600 font-medium rounded-xl">Hide all</button></div>
                              <div className="space-y-1">{ALL_COLUMNS.filter(col => visibleColumns[col]).map(col => (<button key={col} onClick={() => setVisibleColumns({ ...visibleColumns, [col]: false })} className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 rounded-xl transition-colors"><span className="capitalize">{col === 'serviceUser' ? 'Service User' : col === 'moveInDate' ? 'Move-In Date' : col}</span><Eye className="w-4 h-4 text-teal-600" /></button>))}</div>
                            </div>
                            {Object.values(visibleColumns).some(v => !v) && (
                              <div>
                                <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hidden in view</span><button onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}))} className="text-xs text-teal-600 font-medium rounded-xl">Show all</button></div>
                                <div className="space-y-1">{ALL_COLUMNS.filter(col => !visibleColumns[col]).map(col => (<button key={col} onClick={() => setVisibleColumns({ ...visibleColumns, [col]: true })} className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-400 rounded-xl transition-colors"><span className="capitalize">{col === 'serviceUser' ? 'Service User' : col === 'moveInDate' ? 'Move-In Date' : col}</span></button>))}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTIVE RESIDENTS LIST */}
            {activeTab === "active" && (
              activeMoveInsForDisplay.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {activeMoveInsForDisplay.map((r) => {
                    const name = resolveServiceUserName(r);
                    const dateStr = r.move_in_date || r.moveInDate || r.created_at;
                    const formatted = dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                    return (
                      <div key={r.id} className="group bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-600 font-bold text-lg">{name.charAt(0)}</div>
                          <div>
                            <div className="text-slate-800 font-bold text-base">{name}</div>
                            <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-medium text-emerald-700">{r.property_name || "No Property"}</span>
                              <span className="w-1 h-1 rounded-full bg-emerald-300"></span>
                              <span>Since {formatted}</span>
                              {r.room_name && <><span className="w-1 h-1 rounded-full bg-emerald-300"></span><span>Room {r.room_name}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:flex flex-col items-end"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>Active Resident</span></div>
                          <div className="h-8 w-px bg-emerald-200/50"></div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setDetailRecord(r); setShowDetailModal(true); }} className="group relative p-2 text-gray-400 rounded-xl" title="View details"><Eye size={18} /></button>
                            {canUpdatePage && <button onClick={() => { setEditing(r); setShowModal(true); }} className="group relative p-2 text-gray-400 rounded-xl" title="Edit Record"><svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="bg-white p-4 rounded-full mb-4 shadow-sm"><Home className="text-slate-400" size={32} /></div>
                  <div className="text-slate-600 font-semibold text-lg">No active residents found</div>
                  <div className="text-slate-400 text-sm mt-1">Start by moving in a service user.</div>
                </div>
              )
            )}

            {/* MOVE INS LIST */}
            {activeTab === "ins" && (
              moveInsForDisplay.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {moveInsForDisplay.map((r) => {
                    const name = resolveServiceUserName(r);
                    const dateStr = r.move_in_date || r.moveInDate || r.created_at;
                    const formatted = dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                    const isInactive = moveOuts.some((m) => String(m.service_user_id || m.serviceUserId) === String(r.service_user_id || r.serviceUserId));
                    return (
                      <div key={r.id} className={`group bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between ${deletingIds.has(r.id) ? 'moveinout-card-deleting' : ''}`}>
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold text-lg">{name.charAt(0)}</div>
                          <div>
                            <div className="text-slate-800 font-bold text-base">{name}</div>
                            <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-medium text-slate-600">{r.property_name || "No Property"}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>Moved in {formatted}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:flex flex-col items-end">
                            {isInactive ? (<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>Inactive</span>) : (<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>Active</span>)}
                          </div>
                          <div className="h-8 w-px bg-slate-100"></div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setDetailRecord(r); setShowDetailModal(true); }} className="group relative p-2 text-gray-400 rounded-xl" title="View details"><IconEye size={18} /></button>
                            {canUpdatePage && <button onClick={() => { setEditing(r); setShowModal(true); }} className="group relative p-2 text-gray-400 rounded-xl" title="Edit Record"><IconEdit size={18} /></button>}
                            {canDeletePage && <button onClick={() => openDeleteConfirm(r.id, "move-in", "Delete Move-In", "Delete this move-in record? This action cannot be undone.")} className="group relative p-2 text-gray-400 rounded-xl" title="Delete Record" disabled={deleting}><IconTrash size={16} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="bg-white p-4 rounded-full mb-4 shadow-sm"><IconEmpty /></div>
                  <div className="text-slate-600 font-semibold text-lg">No recent move-ins found</div>
                  <div className="text-slate-400 text-sm mt-1">New move-ins will appear here.</div>
                </div>
              )
            )}

            {/* MOVE OUTS LIST */}
            {activeTab === "outs" && (
              moveOutsForDisplay.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {moveOutsForDisplay.map((r) => {
                    const name = r.service_user_name || "Unknown User";
                    const dateStr = r.move_out_date || r.created_at;
                    const formatted = dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                    return (
                      <div key={r.id} className={`group bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between ${deletingIds.has(r.id) ? 'moveinout-card-deleting' : ''}`}>
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold text-lg">{name.charAt(0)}</div>
                          <div>
                            <div className="text-slate-800 font-bold text-base">{name}</div>
                            <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5"><span>Moved out {formatted}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:flex flex-col items-end"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">Departed</span></div>
                          <div className="h-8 w-px bg-slate-100"></div>
                          <div className="flex items-center gap-1.5">
                            {canUpdatePage && <button onClick={() => { setEditing(r); setShowOutModal(true); }} className="group relative p-2 text-gray-400 rounded-xl" title="Edit Record"><IconEdit size={18} /></button>}
                            {canDeletePage && <button onClick={() => openDeleteConfirm(r.id, "move-out", "Delete Move-Out", "Delete this move-out record? This action cannot be undone.")} className="group relative p-2 text-gray-400 rounded-xl" title="Delete Record" disabled={deleting}><IconTrash size={18} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="bg-white p-4 rounded-full mb-4 shadow-sm"><IconEmpty /></div>
                  <div className="text-slate-600 font-semibold text-lg">No recent move-outs found</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <MoveInModal
          hotels={hotels} serviceUsers={serviceUsers} rooms={rooms} recent={recent} moveOuts={moveOuts}
          onClose={() => { setShowModal(false); setEditing(null); }}
          initialRecord={editing}
          onCreate={(record) => {
            setRecent((prev) => {
              if (!record) return prev;
              const idx = prev.findIndex((p) => String(p.id) === String(record.id));
              if (idx >= 0) { const next = [...prev]; next[idx] = record; return next; }
              return [record, ...prev];
            });
            setShowModal(false); setEditing(null);
          }}
          fetchRooms={fetchRooms} bedspaces={bedspaces} fetchBedspaces={fetchBedspaces} onSave={onSave}
          onError={(message) => setAlertDialog({ isOpen: true, title: 'Error', message, type: 'error' })}
        />
      )}

      {showOutModal && (
        <MoveOutModal
          activeResidents={activeResidents} moveOuts={moveOuts}
          onClose={() => { setShowOutModal(false); setEditing(null); }}
          onSave={saveMoveOut} onSuccess={handleOutCreated} initialRecord={editing}
          onError={(message) => setAlertDialog({ isOpen: true, title: 'Error', message, type: 'error' })}
        />
      )}

      {showDetailModal && <DetailModal record={detailRecord} onClose={() => { setShowDetailModal(false); setDetailRecord(null); }} moveOuts={moveOuts} />}

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.confirmText || 'Confirm'} />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />

      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div><div className="text-lg font-semibold text-gray-900">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div><div className="text-xs text-gray-500 mt-0.5">Select the columns you want to include</div></div>
              <button onClick={closeExport} className="p-2 rounded-xl text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">Columns</div>
                <div className="flex items-center gap-3 text-xs"><button onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))} className="text-teal-600 font-medium rounded-xl">Select all</button><button onClick={() => setSelectedExportKeys([])} className="text-gray-600 font-medium rounded-xl">Clear</button></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto pr-1">
                {exportColumns.map((col) => {
                  const checked = (selectedExportKeys || []).includes(col.key);
                  return (
                    <label key={col.key} className="flex items-center gap-2 p-2 rounded-xl border border-gray-100">
                      <input type="checkbox" checked={checked} onChange={(e) => { const isChecked = e.target.checked; setSelectedExportKeys((prev) => { const set = new Set(prev || []); if (isChecked) set.add(col.key); else set.delete(col.key); return Array.from(set); }); }} className="w-4 h-4 text-teal-600 rounded-xl" />
                      <span className="text-sm text-gray-700">{col.header}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={closeExport} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={runExport} className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl transition-colors">Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DetailModal ──────────────────────────────────────────────────────────────
function DetailModal({ record = null, onClose = () => { }, moveOuts = [] }) {
  const r = record || {};
  const movedOut = moveOuts.find((m) => String(m.service_user_id) === String(r.service_user_id || r.serviceUserId));
  const fmt = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "Not specified";
  const get = (key) => r[key] || r[key.replace(/_/g, "")] || "Not specified";

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-slate-900/60 backdrop-blur-md p-4 pt-10 overflow-y-auto">
      <div className="bg-transparent w-full max-w-5xl">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50/30">
            <div><h2 className="text-xl font-semibold text-slate-900">Move-In/Out Details</h2><p className="text-sm text-slate-500 mt-1">Detailed move-in & move-out information</p></div>
            <div className="flex items-center gap-3">
              <div>{movedOut ? (<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">Inactive</span>) : (<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">Active</span>)}</div>
              <button onClick={() => onClose()} className="p-2 rounded-full text-slate-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-slate-800">Move-In Details</h4>
              <p className="text-sm text-slate-400 mt-1">Checklist, notes and signature captured at move-in</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-slate-700">
                <div><div className="text-xs text-slate-400">Move-In Date</div><div className="mt-1 font-medium">{get("move_in_date") !== "Not specified" ? fmt(get("move_in_date")) : "Not specified"}</div></div>
                <div><div className="text-xs text-slate-400">Notes</div><div className="mt-1 font-medium">{r.notes || "Not specified"}</div></div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-400">Checklist</div>
                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm">
                    <ul className="space-y-2">{MOVE_IN_CHECKLIST_ITEMS.map((label, i) => { const v = (r.checklist && (r.checklist[i] !== undefined ? r.checklist[i] : r.checklist[String(i)])) || false; return (<li key={i} className="flex items-start gap-3"><div className={`w-5 h-5 rounded-full flex items-center justify-center ${v ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{v ? "✓" : ""}</div><div className="text-slate-700">{label}</div></li>); })}</ul>
                  </div>
                </div>
                <div><div className="text-xs text-slate-400">Signature</div><div className="mt-1 font-medium">{r.signature ? (typeof r.signature === "string" && r.signature.startsWith("data:") ? <img src={r.signature} alt="signature" className="max-h-28 rounded-xl border" /> : <span className="font-mono text-xs break-all">{r.signature}</span>) : "Not provided"}</div></div>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-slate-800">Move-Out Details</h4>
              <p className="text-sm text-slate-400 mt-1">Checklist, notes and signature captured at move-out</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-slate-700">
                <div><div className="text-xs text-slate-400">Move-Out Date</div><div className="mt-1 font-medium">{movedOut ? (movedOut.move_out_date ? fmt(movedOut.move_out_date) : movedOut.created_at ? fmt(movedOut.created_at) : "Not specified") : "Not specified"}</div></div>
                <div><div className="text-xs text-slate-400">Notes</div><div className="mt-1 font-medium">{movedOut?.notes || "Not specified"}</div></div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-400">Checklist</div>
                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm">
                    <ul className="space-y-2">{MOVE_OUT_CHECKLIST_ITEMS.map((label, i) => { const v = (movedOut && movedOut.checklist && (movedOut.checklist[i] !== undefined ? movedOut.checklist[i] : movedOut.checklist[String(i)])) || false; return (<li key={i} className="flex items-start gap-3"><div className={`w-5 h-5 rounded-full flex items-center justify-center ${v ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{v ? "✓" : ""}</div><div className="text-slate-700">{label}</div></li>); })}</ul>
                  </div>
                </div>
                <div><div className="text-xs text-slate-400">Signature</div><div className="mt-1 font-medium">{movedOut && movedOut.signature ? (typeof movedOut.signature === "string" && movedOut.signature.startsWith("data:") ? <img src={movedOut.signature} alt="move-out signature" className="max-h-28 rounded-xl border" /> : <span className="font-mono text-xs break-all">{movedOut.signature}</span>) : "Not provided"}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MoveInModal ──────────────────────────────────────────────────────────────
// THE FIX: Form state is initialised directly from initialRecord so Room and
// Bedspace IDs are present from the very first render.  The two cascade effects
// (propertyId → fetchRooms, roomId → fetchBedspaces) are guarded by an
// `isMounting` ref so they do NOT fire on the initial render and do NOT wipe
// the pre-filled roomId / bedspaceId values.  They only run when the user
// deliberately changes Property or Room via the dropdowns.
function MoveInModal({
  hotels = [], serviceUsers = [], rooms = [], bedspaces = [],
  recent = [], moveOuts = [], onClose = () => { }, onCreate = () => { },
  fetchRooms = async () => [], fetchBedspaces = async () => [],
  onSave = async () => null, initialRecord = null, onError = () => { },
}) {
  // ── 1. Initialise form directly from initialRecord (no empty-then-populate) ──
  const [form, setForm] = useState(() => ({
    serviceUserId: initialRecord?.serviceUserId || initialRecord?.service_user_id || initialRecord?.service_user || "",
    propertyId:    initialRecord?.propertyId    || initialRecord?.property_id    || "",
    roomId:        initialRecord?.roomId        || initialRecord?.room_id        || "",
    bedspaceId:    initialRecord?.bedspaceId    || initialRecord?.bedspace_id    || "",
    moveInDate:    toDateInputValue(initialRecord?.moveInDate || initialRecord?.move_in_date) || new Date().toISOString().slice(0, 10),
    checklist:     initialRecord?.checklist     || initialRecord?.check_list     || {},
    notes:         initialRecord?.notes         || "",
    signature:     initialRecord?.signature     || "",
  }));

  // ── 2. Guard: skip cascade effects on the very first render ──────────────────
  const isMounting = useRef(true);

  // ── 3. On mount: fetch rooms & bedspaces for the pre-filled IDs ──────────────
  useEffect(() => {
    const propId = initialRecord?.propertyId || initialRecord?.property_id || "";
    const roomId = initialRecord?.roomId     || initialRecord?.room_id     || "";
    if (propId) {
      fetchRooms(propId).then(() => {
        if (roomId) fetchBedspaces(propId, roomId);
      });
    }
    // Mark mounting done after this tick so subsequent user-driven changes work
    const t = setTimeout(() => { isMounting.current = false; }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  const activeMoveInByServiceUserId = useMemo(() => {
    const movedOutIds = new Set(
      (Array.isArray(moveOuts) ? moveOuts : []).map((o) => o?.service_user_id ?? o?.serviceUserId).filter(Boolean).map((id) => String(id).toLowerCase())
    );
    const map = new Map();
    (Array.isArray(recent) ? recent : []).forEach((r) => {
      const suId = r?.service_user_id ?? r?.serviceUserId;
      if (!suId) return;
      const key = String(suId).toLowerCase();
      if (movedOutIds.has(key)) return;
      if (!map.has(key)) map.set(key, r);
    });
    return map;
  }, [recent, moveOuts]);

  const eligibleResidents = useMemo(() => {
    const movedInIds = new Set((Array.isArray(recent) ? recent : []).map((r) => r?.service_user_id ?? r?.serviceUserId).filter(Boolean).map((id) => String(id)));
    const movedOutIds = new Set((Array.isArray(moveOuts) ? moveOuts : []).map((r) => r?.service_user_id ?? r?.serviceUserId).filter(Boolean).map((id) => String(id)));
    return (Array.isArray(serviceUsers) ? serviceUsers : [])
      .filter((su) => su?.id)
      .filter((su) => {
        const id = String(su.id);
        return (!movedInIds.has(id) && !movedOutIds.has(id)) || activeMoveInByServiceUserId.has(id.toLowerCase());
      })
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }));
  }, [serviceUsers, recent, moveOuts, activeMoveInByServiceUserId]);

  const checklistItems = MOVE_IN_CHECKLIST_ITEMS;
  const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || "", withCredentials: true, timeout: 15000 }), []);
  const [roomCapacity, setRoomCapacity] = useState(null);

  const remainingBedsForProperty = useMemo(() => {
    if (!form.propertyId) return 0;
    const hotel = (Array.isArray(hotels) ? hotels : []).find((h) => String(h.id) === String(form.propertyId));
    if (!hotel) return 0;
    const total = Number(hotel.total_beds ?? hotel.totalBeds);
    const occupied = Number(hotel.occupied_beds ?? hotel.occupiedBeds);
    if (!Number.isFinite(total) || total <= 0) return 0;
    const free = total - (Number.isFinite(occupied) ? occupied : 0);
    return free > 0 ? free : 0;
  }, [form.propertyId, hotels]);

  useEffect(() => {
    let mounted = true;
    async function loadRoomCapacity() {
      if (!form.propertyId || !form.roomId) { if (mounted) setRoomCapacity(null); return; }
      try {
        const res = await api.get(`/api/hotels/${encodeURIComponent(form.propertyId)}/rooms/${encodeURIComponent(form.roomId)}`);
        const room = res?.data || {};
        const cap = room.bedspaces ?? room.bedspace_count ?? room.capacity ?? room.total_bedspaces ?? null;
        const n = cap == null ? null : Number(cap);
        if (mounted) setRoomCapacity(Number.isFinite(n) ? n : null);
      } catch { if (mounted) setRoomCapacity(null); }
    }
    loadRoomCapacity();
    return () => { mounted = false; };
  }, [api, form.propertyId, form.roomId]);

  const availableBedspacesForRoom = useMemo(() => {
    if (!form.roomId) return [];
    const movedOutIds = new Set((Array.isArray(moveOuts) ? moveOuts : []).map((o) => String(o.service_user_id || o.serviceUserId).toLowerCase()));
    const activeMI = (Array.isArray(recent) ? recent : []).filter((r) => !movedOutIds.has(String(r.service_user_id || r.serviceUserId).toLowerCase()));
    const occupiedIds = new Set(
      activeMI.filter((r) => String(r.room_id || r.roomId) === String(form.roomId))
        .map((r) => r.bedspace_id || r.bedspaceId).filter(Boolean).map((id) => String(id))
    );
    // When editing, exclude the current record's bedspace from "occupied" so it shows as available
    if (initialRecord) {
      const currentBedId = String(initialRecord.bedspace_id || initialRecord.bedspaceId || "");
      if (currentBedId) occupiedIds.delete(currentBedId);
    }
    return (Array.isArray(bedspaces) ? bedspaces : []).filter((b) => !occupiedIds.has(String(b.id)));
  }, [form.roomId, bedspaces, recent, moveOuts, initialRecord]);

  const availableSlotsCount = useMemo(() => {
    if (!form.roomId) return 0;
    const movedOutIds = new Set((Array.isArray(moveOuts) ? moveOuts : []).map((o) => String(o.service_user_id || o.serviceUserId).toLowerCase()));
    const activeMI = (Array.isArray(recent) ? recent : []).filter((r) => !movedOutIds.has(String(r.service_user_id || r.serviceUserId).toLowerCase()));
    let occupiedCount = activeMI.filter((r) => String(r.room_id || r.roomId) === String(form.roomId)).length;
    // When editing, don't count the current record as occupying a slot
    if (initialRecord) occupiedCount = Math.max(0, occupiedCount - 1);
    const cap = Number(roomCapacity);
    if (!Number.isFinite(cap) || cap <= 0) return 0;
    const free = cap - occupiedCount;
    return free > 0 ? free : 0;
  }, [form.roomId, recent, moveOuts, roomCapacity, initialRecord]);

  const bedspaceOptions = useMemo(() => {
    if (availableBedspacesForRoom.length > 0) return availableBedspacesForRoom.map((b) => ({ value: String(b.id), label: b.name }));
    const n = form.roomId ? availableSlotsCount : remainingBedsForProperty;
    if (n > 0) return Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: `Bedspace ${i + 1}` }));
    return [];
  }, [form.roomId, availableBedspacesForRoom, availableSlotsCount, remainingBedsForProperty]);

  // ── 4. Property change effect — guarded, only runs after mount ────────────────
  useEffect(() => {
    if (isMounting.current) return; // skip on initial render
    if (form.propertyId) {
      fetchRooms(form.propertyId);
      setForm((f) => ({ ...f, roomId: "", bedspaceId: "" }));
    } else {
      setForm((f) => ({ ...f, roomId: "", bedspaceId: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.propertyId]);

  // ── 5. Room change effect — guarded, only runs after mount ───────────────────
  useEffect(() => {
    if (isMounting.current) return; // skip on initial render
    if (form.propertyId && form.roomId) {
      fetchBedspaces(form.propertyId, form.roomId);
      setForm((f) => ({ ...f, bedspaceId: "" }));
    } else {
      setForm((f) => ({ ...f, bedspaceId: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.roomId]);

  function toggleItem(idx) {
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [idx]: !f.checklist[idx] } }));
  }

  function handleChange(field, value) {
    if (field === "serviceUserId") {
      const su = (Array.isArray(serviceUsers) ? serviceUsers : []).find((s) => String(s.id) === String(value));
      const nextPropertyId = su?.property_id ? String(su.property_id) : (su?.propertyId ? String(su.propertyId) : "");
      setForm((f) => ({ ...f, serviceUserId: value, propertyId: nextPropertyId, roomId: "", bedspaceId: "" }));
      return;
    }
    if (field === "propertyId") {
      setForm((f) => ({ ...f, propertyId: value, roomId: "", bedspaceId: "" }));
      return;
    }
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.serviceUserId) { onError("Please select a resident."); return; }
    if (!form.propertyId) { onError("Please select a property."); return; }
    if (!form.roomId) { onError("Please select a room."); return; }
    if (!form.bedspaceId) { onError("Please select a bedspace."); return; }
    if (!form.moveInDate) { onError("Please select a move-in date."); return; }
    if (!String(form.notes || '').trim()) { onError("Please enter additional notes."); return; }

    const payload = { ...form };
    const isEditing = Boolean(initialRecord && initialRecord.id);
    if (isEditing) {
      payload.id = initialRecord.id;
    } else {
      const active = activeMoveInByServiceUserId.get(String(payload.serviceUserId).trim().toLowerCase());
      if (active?.id) {
        const fromPropId = String(active.property_id || active.propertyId || "").trim().toLowerCase();
        const toPropId = String(payload.propertyId || "").trim().toLowerCase();
        if (fromPropId && toPropId && fromPropId === toPropId) { onError("This resident is already moved in."); return; }
        payload.id = active.id;
        if (fromPropId && toPropId && fromPropId !== toPropId) {
          const fromPropertyName = active.property_name || active.propertyName || "";
          const toPropertyName = hotels.find((h) => String(h.id) === String(payload.propertyId))?.name || "";
          const transferNote = `Moved from ${fromPropertyName || "previous property"} to ${toPropertyName || "new property"} on ${payload.moveInDate}.`;
          payload.notes = payload.notes ? `${transferNote}\n${payload.notes}` : transferNote;
        }
      }
    }

    try {
      const suObj = serviceUsers.find((s) => String(s.id) === String(payload.serviceUserId));
      if (suObj) payload.service_user_name = suObj.name;
      const propObj = hotels.find((h) => String(h.id) === String(payload.propertyId));
      if (propObj) payload.property_name = propObj.name || propObj._displayName || null;
      const roomObj = rooms.find((r) => String(r.id) === String(payload.roomId));
      if (roomObj) payload.room_name = roomObj.room_number || roomObj.name || null;
      const bedObj = bedspaces.find((b) => String(b.id) === String(payload.bedspaceId));
      if (bedObj) payload.bedspace_name = bedObj.name || null;

      const saved = await onSave(payload);
      if (saved) {
        const record = {
          id: saved.id || Math.floor(Math.random() * 1000000),
          serviceUserId: saved.service_user_id || payload.serviceUserId,
          service_user_id: saved.service_user_id || payload.serviceUserId,
          service_user_name: saved.service_user_name || saved.serviceUserName || payload.service_user_name || null,
          propertyId: saved.property_id || payload.propertyId,
          property_id: saved.property_id || payload.propertyId,
          property_name: saved.property_name || saved.propertyName || payload.property_name || null,
          roomId: saved.room_id || payload.roomId,
          room_id: saved.room_id || payload.roomId,
          room_name: saved.room_name || saved.roomName || payload.room_name || null,
          bedspaceId: saved.bedspace_id || payload.bedspaceId,
          bedspace_id: saved.bedspace_id || payload.bedspaceId,
          bedspace_name: saved.bedspace_name || saved.bedspaceName || payload.bedspace_name || null,
          moveInDate: saved.move_in_date || payload.moveInDate,
          move_in_date: saved.move_in_date || payload.moveInDate,
          checklist: saved.checklist || payload.checklist,
          notes: saved.notes || payload.notes,
          signature: saved.signature || payload.signature,
          created_at: saved.created_at || new Date().toISOString(),
        };
        onCreate(record);
      } else {
        onCreate({ ...payload, id: Math.floor(Math.random() * 1000000), created_at: new Date().toISOString() });
      }
    } catch (err) {
      console.error("save move-in failed", err);
      onError("Failed to save move-in. See console for details.");
    }
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-container h-[73vh]">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{initialRecord ? "Edit Move-In" : "Process Move-In"}</h2>
            <p className="modal-subtitle">{initialRecord ? "Update the move-in record" : "Complete the move-in checklist for a new resident"}</p>
          </div>
          <button onClick={onClose} className="rounded-xl modal-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="modal-content">
          <form id="moveInForm" onSubmit={handleSubmit} className="form-section">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Resident <span className="text-red-500">*</span></label>
                <select
                  className="rounded-xl form-select"
                  required
                  value={form.serviceUserId}
                  onChange={(e) => handleChange("serviceUserId", e.target.value)}
                  disabled={!!initialRecord}
                >
                  <option value="">Select resident</option>
                  {/* Always include the current resident when editing, even if filtered out of eligible list */}
                  {initialRecord && form.serviceUserId && !eligibleResidents.find(s => String(s.id) === String(form.serviceUserId)) && (
                    <option value={form.serviceUserId}>
                      {initialRecord.service_user_name || initialRecord.serviceUserName || `Resident ${form.serviceUserId}`}
                    </option>
                  )}
                  {eligibleResidents.map((su) => (
                    <option key={su.id} value={su.id}>{su.name}</option>
                  ))}
                </select>
                {!initialRecord && eligibleResidents.length === 0 && (
                  <div className="text-xs text-slate-500 mt-1">No eligible residents available.</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                <select className="rounded-xl form-select" required value={form.propertyId} onChange={(e) => handleChange("propertyId", e.target.value)}>
                  <option value="">Select property</option>
                  {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Room <span className="text-red-500">*</span></label>
                <select
                  className="rounded-xl form-select"
                  required
                  value={form.roomId}
                  onChange={(e) => handleChange("roomId", e.target.value)}
                  disabled={!form.propertyId}
                >
                  <option value="">{form.propertyId ? "Select room" : "Select property first"}</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number || r.name || r.id}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bedspace <span className="text-red-500">*</span></label>
                <select
                  className="rounded-xl form-select"
                  required
                  value={form.bedspaceId}
                  onChange={(e) => handleChange("bedspaceId", e.target.value)}
                  disabled={!form.propertyId || !form.roomId}
                >
                  <option value="">
                    {!form.propertyId ? "Select property first" : !form.roomId ? "Select room first" : bedspaceOptions.length === 0 ? "No bedspaces available" : "Select bedspace"}
                  </option>
                  {/* When editing, always include the saved bedspace even if it's not in bedspaceOptions */}
                  {initialRecord && form.bedspaceId && !bedspaceOptions.find(o => o.value === String(form.bedspaceId)) && (
                    <option value={String(form.bedspaceId)}>
                      {initialRecord.bedspace_name || initialRecord.bedspaceName || `Bedspace ${form.bedspaceId}`}
                    </option>
                  )}
                  {bedspaceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Move-In Date <span className="text-red-500">*</span></label>
              <input type="date" className="rounded-xl form-input" required value={form.moveInDate} onChange={(e) => handleChange("moveInDate", e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label mb-3">Move-In Checklist <span className="text-red-500">*</span></label>
              <div className="form-grid-2 gap-3">
                {checklistItems.map((t, i) => (
                  <label key={i} className={`checkbox-card ${form.checklist[i] ? "checked" : ""}`}>
                    <div className="pt-0.5">
                      <input type="checkbox" className="rounded-xl border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4" checked={!!form.checklist[i]} onChange={() => toggleItem(i)} />
                    </div>
                    <span className={`checkbox-card-text ${form.checklist[i] ? "checked" : ""}`}>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Additional Notes <span className="text-red-500">*</span></label>
              <textarea className="rounded-xl form-input h-auto resize-none" rows={3} required value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Any additional observations or comments..." />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="rounded-xl btn-secondary">Cancel</button>
          <button type="submit" form="moveInForm" className="rounded-xl btn-primary">{initialRecord ? "Save Changes" : "Complete Move-In"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── MoveOutModal ─────────────────────────────────────────────────────────────
function MoveOutModal({
  activeResidents = [], moveOuts = [], onClose = () => { },
  onSave = async () => { }, onSuccess = () => { }, initialRecord = null, onError = () => { },
}) {
  const [form, setForm] = useState(() => ({
    serviceUserId:     initialRecord?.service_user_id || initialRecord?.serviceUserId || "",
    service_user_name: initialRecord?.service_user_name || "",
    moveOutDate:       toDateInputValue(initialRecord?.move_out_date || initialRecord?.moveOutDate) || new Date().toISOString().slice(0, 10),
    checklist:         initialRecord?.checklist || {},
    notes:             initialRecord?.notes || "",
  }));

  const checklistItems = MOVE_OUT_CHECKLIST_ITEMS;

  function toggleItem(idx) {
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [idx]: !f.checklist[idx] } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.serviceUserId) { onError("Please select a resident."); return; }
    if (!form.moveOutDate) { onError("Please select a move-out date."); return; }
    if (!String(form.notes || '').trim()) { onError("Please enter notes."); return; }

    if (!initialRecord) {
      const movedOutIds = new Set((Array.isArray(moveOuts) ? moveOuts : []).map((o) => String(o?.service_user_id || o?.serviceUserId).trim().toLowerCase()));
      const key = String(form.serviceUserId).trim().toLowerCase();
      if (key && movedOutIds.has(key)) { onError("This resident is already moved out!"); return; }
    }

    try {
      const saved = await onSave(form);
      onSuccess(saved);
    } catch (err) {
      console.error(err);
      onError("Failed to process move-out");
    }
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{initialRecord ? "Edit Move-Out" : "Process Move-Out"}</h2>
            <p className="modal-subtitle">{initialRecord ? "Update move-out details" : "Finalize residency and check out user"}</p>
          </div>
          <button onClick={onClose} className="rounded-xl modal-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="modal-content">
          <form id="moveOutForm" onSubmit={handleSubmit} className="form-section">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Resident <span className="text-red-500">*</span></label>
                <select
                  required
                  disabled={!!initialRecord}
                  className="rounded-xl form-select disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.serviceUserId}
                  onChange={(e) => {
                    const selectedUser = activeResidents.find((r) => String(r.id) === String(e.target.value));
                    setForm({ ...form, serviceUserId: e.target.value, service_user_name: selectedUser?.name || "" });
                  }}
                >
                  <option value="">Select resident</option>
                  {/* Always show the saved resident in edit mode */}
                  {initialRecord && form.serviceUserId && !activeResidents.find(r => String(r.id) === String(form.serviceUserId)) && (
                    <option value={form.serviceUserId}>{initialRecord.service_user_name || `Resident ${form.serviceUserId}`}</option>
                  )}
                  {activeResidents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Move-Out Date <span className="text-red-500">*</span></label>
                <input type="date" className="rounded-xl form-input" required value={form.moveOutDate} onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label mb-3">Move-Out Checklist <span className="text-red-500">*</span></label>
              <div className="form-grid-2 gap-3">
                {checklistItems.map((t, i) => (
                  <label key={i} className={`checkbox-card ${form.checklist[i] ? "checked" : ""}`}>
                    <div className="pt-0.5">
                      <input type="checkbox" className="rounded-xl border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4" checked={!!form.checklist[i]} onChange={() => toggleItem(i)} />
                    </div>
                    <span className={`checkbox-card-text ${form.checklist[i] ? "checked" : ""}`}>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes <span className="text-red-500">*</span></label>
              <textarea className="rounded-xl form-input h-auto resize-none" rows={3} required value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Final remarks..." />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="rounded-xl btn-secondary">Cancel</button>
          <button type="submit" form="moveOutForm" className="rounded-xl btn-primary">{initialRecord ? "Save Changes" : "Confirm Move-Out"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
