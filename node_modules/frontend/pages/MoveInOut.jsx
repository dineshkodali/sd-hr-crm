/* src/pages/MoveInOut.jsx */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Eye, ChevronDown, Filter, Columns, X, Home } from "lucide-react";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { usePermissions } from "../hooks/usePermissions";

// Checklist labels reused by MoveInModal, MoveOutModal and DetailModal
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

  useEffect(() => {
    const shouldHide = Boolean(showModal || showOutModal);
    try {
      document.body.classList.toggle("form-modal-open", shouldHide);
    } catch { }
    return () => {
      try {
        document.body.classList.remove("form-modal-open");
      } catch { }
    };
  }, [showModal, showOutModal]);

  const [hotels, setHotels] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bedspaces, setBedspaces] = useState([]);

  const [recent, setRecent] = useState([]); // Move-Ins
  const [moveOuts, setMoveOuts] = useState([]); // Move-Outs

  // Derived counts used by the stat boxes so they update immediately
  const [counts, setCounts] = useState({ active: 0, moveIns: 0, moveOuts: 0 });

  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState("ins");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // "move-in" | "move-out"
  const [deleting, setDeleting] = useState(false);

  // Filter and Sort State (Litigation-style)
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [sortBy, setSortBy] = useState('');

  // View Menu State
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
  const viewRef = useRef(null);

  // Define all available columns
  const ALL_COLUMNS = [
    "serviceUser",
    "property",
    "room",
    "moveInDate",
    "status",
    "actions",
  ];

  // Column visibility state - all visible by default
  const [visibleColumns, setVisibleColumns] = useState(
    ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {})
  );

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


  const api = useMemo(
    () =>
      axios.create({
        baseURL: import.meta.env.VITE_API_URL || "",
        withCredentials: true,
        timeout: 15000,
      }),
    []
  );

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

  // Compute active residents (Move-In Records)
  const activeMoveIns = useMemo(() => {
    const movedOutIds = new Set(
      (moveOuts || []).map((o) =>
        String(o.service_user_id || o.serviceUserId).toLowerCase()
      )
    );
    return (recent || []).filter((r) => {
      const suId = String(r.service_user_id || r.serviceUserId).toLowerCase();
      const isActive = !movedOutIds.has(suId);
      if (!isActive) return false;

      // Filter by property if selected
      if (filterProperty && String(r.property_id || r.propertyId) !== String(filterProperty)) {
        return false;
      }
      return true;
    });
  }, [recent, moveOuts, filterProperty]);

  const activeResidentsCount = activeMoveIns.length;

  // Keep a small derived counts object in state so the top stat boxes
  // update immediately whenever source arrays change.
  useEffect(() => {
    setCounts({
      active: activeResidentsCount,
      moveIns: Array.isArray(recent) ? recent.length : 0,
      moveOuts: Array.isArray(moveOuts) ? moveOuts.length : 0,
    });
  }, [recent, moveOuts, activeResidentsCount]);

  // Load existing move-ins
  useEffect(() => {
    let mounted = true;
    async function fetchMoveIns() {
      try {
        const res = await api.get("/api/move-ins");
        const list = res?.data?.rows ?? res?.data?.data ?? res?.data ?? [];
        const normalized = Array.isArray(list)
          ? list.map((r) => ({
            id: r.id,
            service_user_id:
              r.service_user_id ?? r.serviceUserId ?? r.service_userId,
            service_user_name:
              r.service_user_name ??
              r.serviceUserName ??
              (r.service_user_id || r.serviceUserId),
            property_id: r.property_id ?? r.propertyId,
            property_name: r.property_name ?? r.propertyName ?? null,
            room_id: r.room_id ?? r.roomId,
            room_name: r.room_name ?? r.roomName ?? null,
            bedspace_id: r.bedspace_id ?? r.bedspaceId,
            bedspace_name: r.bedspace_name ?? r.bedspaceName ?? null,
            move_in_date:
              r.move_in_date ?? r.moveInDate ?? r.created_at ?? null,
            checklist: r.checklist || r.check_list || {},
            notes: r.notes || null,
            signature: r.signature || null,
            created_at: r.created_at || r.createdAt || null,
          }))
          : [];

        if (!mounted) return;
        setRecent(normalized);
      } catch (err) {
        console.warn("Failed to load move-ins:", err?.message || err);
      }
    }

    fetchMoveIns();
    return () => {
      mounted = false;
    };
  }, [api]);

  // Load move-outs
  const fetchMoveOuts = useCallback(async () => {
    try {
      const res = await api.get("/api/move-outs");
      const list = res?.data?.rows ?? res?.data?.data ?? res?.data ?? [];
      const normalized = Array.isArray(list)
        ? list.map((r) => ({
          id: r.id,
          service_user_id: r.service_user_id,
          service_user_name: r.service_user_name,
          move_out_date: r.move_out_date,
          checklist: r.checklist || {},
          notes: r.notes || null,
          created_at: r.created_at || null,
        }))
        : [];
      setMoveOuts(normalized);
    } catch (err) {
      console.warn("fetchMoveOuts failed", err?.message || err);
    }
  }, [api]);

  // Fetch move-outs on mount to populate stats on page load/refresh
  useEffect(() => {
    fetchMoveOuts();
  }, [fetchMoveOuts]);

  // Stats are now computed directly from arrays, no need for separate state

  // Icons
  const IconUsers = ({ size = 20 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
  const IconMoveIn = ({ size = 20 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
      <polyline points="10 17 15 12 10 7"></polyline>
      <line x1="15" y1="12" x2="3" y2="12"></line>
    </svg>
  );
  const IconMoveOut = ({ size = 20 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );
  const IconEmpty = ({ size = 48 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#cbd5e1"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
  const IconEdit = ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );
  const IconTrash = ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  );
  const IconEye = ({ size = 18 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );

  // load hotels and service users
  const fetchHotelsAndServiceUsers = useCallback(async () => {
    try {
      const [hRes, suRes] = await Promise.all([
        api.get("/api/hotels", { params: { limit: 200 } }),
        api
          .get("/api/su", { params: { limit: 200 } })
          .catch(() => ({ data: [] })),
      ]);
      const hs =
        (hRes?.data?.hotels ?? hRes?.data?.data ?? hRes?.data ?? []) || [];
      setHotels(
        Array.isArray(hs) ? hs.map((h) => ({ id: h.id, name: h.name })) : []
      );
      const sus = (suRes?.data?.data ?? suRes?.data ?? []) || [];
      setServiceUsers(
        Array.isArray(sus)
          ? sus.map((s) => ({
            id: s.id,
            name: s.first_name ?? s.name ?? `${s.id}`,
            propertyId:
              s.hotel_id ??
              s.property_id ??
              s.hotelId ??
              s.propertyId ??
              s.hotel ??
              s.property ??
              "",
          }))
          : []
      );
    } catch (err) {
      console.warn("fetchHotelsAndServiceUsers failed", err?.message || err);
    }
  }, [api]);

  useEffect(() => {
    fetchHotelsAndServiceUsers();
  }, [fetchHotelsAndServiceUsers]);

  // stable fetchRooms - uses api and sets rooms state
  const fetchRooms = useCallback(
    async (hotelId) => {
      if (!hotelId) {
        setRooms([]);
        return [];
      }
      try {
        const r = await api.get(`/api/su/rooms/${encodeURIComponent(hotelId)}`);
        const list = r?.data?.rooms ?? r?.data?.data ?? r?.data ?? [];
        const normalized = Array.isArray(list)
          ? list.map((x) => ({
            id: x.id,
            room_number: x.room_number ?? x.number ?? x.name ?? x.id,
          }))
          : [];
        setRooms(
          normalized.map((x) => ({
            id: x.id,
            room_number: x.room_number,
            name: x.room_number || x.name || x.id,
          }))
        );
        return normalized;
      } catch (err) {
        console.warn("fetchRooms failed", err?.message || err);
        setRooms([]);
        return [];
      }
    },
    [api]
  );

  const fetchBedspaces = useCallback(
    async (hotelId, roomId) => {
      if (!hotelId || !roomId) {
        setBedspaces([]);
        return [];
      }
      try {
        const r = await api.get(
          `/api/hotels/${encodeURIComponent(
            hotelId
          )}/rooms/${encodeURIComponent(roomId)}/bedspaces`
        );
        const list = r?.data?.bedspaces ?? r?.data?.data ?? r?.data ?? [];
        const normalized = Array.isArray(list)
          ? list.map((b) => ({
            id: b.id,
            name: b.name ?? b.label ?? String(b.id),
          }))
          : [];
        setBedspaces(normalized);
        return normalized;
      } catch (err) {
        console.warn("fetchBedspaces failed", err?.message || err);
        setBedspaces([]);
        return [];
      }
    },
    [api]
  );

  const onSave = useCallback(
    async (payload) => {
      try {
        if (payload && payload.id) {
          if (!canUpdatePage) {
            throw new Error("Permission denied");
          }
        } else {
          if (!canCreatePage) {
            throw new Error("Permission denied");
          }
        }

        const su = serviceUsers.find(
          (s) => String(s.id) === String(payload.serviceUserId)
        );
        const hotel = hotels.find(
          (h) => String(h.id) === String(payload.propertyId)
        );
        const room = rooms.find((r) => String(r.id) === String(payload.roomId));
        const bed = bedspaces.find(
          (b) => String(b.id) === String(payload.bedspaceId)
        );

        const body = {
          service_user_id: payload.serviceUserId,
          service_user_name: su?.name || null,
          property_id: payload.propertyId,
          property_name: hotel?.name || hotel?._displayName || null,
          room_id: payload.roomId,
          room_name: room?.room_number || room?.name || null,
          bedspace_id: payload.bedspaceId || null,
          bedspace_name: bed?.name || null,
          move_in_date: payload.moveInDate,
          checklist: payload.checklist || {},
          notes: payload.notes || null,
          signature: payload.signature || null,
        };

        if (payload && payload.id) {
          // update
          const res = await api.put(
            `/api/move-ins/${encodeURIComponent(payload.id)}`,
            body
          );
          if (res?.data?.row) return res.data.row;
          return res?.data || null;
        }

        // create
        const res = await api.post("/api/move-ins", body);
        if (res?.data?.row) return res.data.row;
        return res?.data || null;
      } catch (err) {
        console.error(
          "saveMoveIn failed",
          err && err.response ? err.response.data : err
        );
        throw err;
      }
    },
    [api, serviceUsers, hotels, rooms, bedspaces, canCreatePage, canUpdatePage]
  );

  const onDelete = useCallback(
    async (id) => {
      if (!id) return;
      try {
        if (!canDeletePage) {
          throw new Error("Permission denied");
        }
        await api.delete(`/api/move-ins/${encodeURIComponent(id)}`);
        setRecent((prev) => prev.filter((r) => String(r.id) !== String(id)));
      } catch (err) {
        console.error(
          "deleteMoveIn failed",
          err && err.response ? err.response.data : err
        );
        throw err;
      }
    },
    [api]
  );

  const onDeleteMoveOut = useCallback(
    async (id) => {
      if (!id) return;
      try {
        if (!canDeletePage) {
          throw new Error("Permission denied");
        }
        await api.delete(`/api/move-outs/${encodeURIComponent(id)}`);
        setMoveOuts((prev) => prev.filter((m) => String(m.id) !== String(id)));
      } catch (err) {
        console.error(
          "deleteMoveOut failed",
          err && err.response ? err.response.data : err
        );
        throw err;
      }
    },
    [api]
  );

  const handleDeleteConfirm = async () => {
    if (!canDeletePage) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: 'You do not have permission to delete records.',
        type: 'warning'
      });
      setShowDeleteModal(false);
      setDeleteId(null);
      setDeleteType(null);
      return;
    }
    if (!deleteId || !deleteType) return;

    try {
      setDeleting(true);

      if (deleteType === "move-in") {
        await onDelete(deleteId);
      }

      if (deleteType === "move-out") {
        await onDeleteMoveOut(deleteId);
      }

      setShowDeleteModal(false);
      setDeleteId(null);
      setDeleteType(null);
    } catch (err) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        title: 'Delete Failed',
        message: 'Delete failed. See console for details.',
        type: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };


  const activeResidents = useMemo(() => {
    if (!Array.isArray(recent)) return [];
    const movedOutIds = new Set(
      (moveOuts || []).map((o) => String(o.service_user_id || o.serviceUserId))
    );
    return recent
      .filter(
        (r) => !movedOutIds.has(String(r.service_user_id || r.serviceUserId))
      )
      .map((r) => ({
        id:
          r.service_user_id ||
          r.serviceUserId ||
          r.service_user ||
          r.serviceUser,
        name:
          r.service_user_name ||
          r.serviceUserName ||
          r.serviceUser ||
          "Unknown",
      }));
  }, [recent, moveOuts]);

  const saveMoveOut = useCallback(
    async (payload) => {
      try {
        if (editing && editing.id) {
          if (!canUpdatePage) {
            throw new Error("Permission denied");
          }
        } else {
          if (!canCreatePage) {
            throw new Error("Permission denied");
          }
        }

        // Get user name from activeResidents first, then from recent array, then from payload
        let userName = payload.service_user_name || null;

        if (!userName) {
          // Try to find in activeResidents
          const su = activeResidents.find(
            (s) => String(s.id) === String(payload.serviceUserId)
          );
          if (su) userName = su.name;
        }

        if (!userName) {
          // Try to find in recent array (fallback)
          const recentUser = recent.find(
            (r) =>
              String(r.service_user_id || r.serviceUserId) ===
              String(payload.serviceUserId)
          );
          if (recentUser)
            userName =
              recentUser.service_user_name || recentUser.serviceUserName;
        }

        const body = {
          service_user_id: payload.serviceUserId,
          service_user_name: userName,
          move_out_date: payload.moveOutDate || payload.move_out_date || null,
          checklist: payload.checklist || {},
          notes: payload.notes || null,
          signature: payload.signature || null,
        };

        // If editing an existing record, use PATCH; otherwise POST for new record
        if (editing && editing.id) {
          const res = await api.patch(`/api/move-outs/${editing.id}`, body);
          return res?.data?.row ?? res?.data ?? null;
        } else {
          const res = await api.post("/api/move-outs", body);
          return res?.data?.row ?? res?.data ?? null;
        }
      } catch (err) {
        console.error(
          "saveMoveOut failed",
          err && err.response ? err.response.data : err
        );
        throw err;
      }
    },
    [api, activeResidents, editing, recent, canCreatePage, canUpdatePage]
  );

  function handleOutCreated(saved) {
    if (!saved) return;
    const record = {
      id: saved.id || Math.floor(Math.random() * 1000000),
      service_user_id: saved.service_user_id,
      service_user_name: saved.service_user_name || null,
      move_out_date:
        saved.move_out_date || saved.moveOutDate || saved.created_at || null,
      notes: saved.notes || null,
      checklist: saved.checklist || null,
      created_at: saved.created_at || new Date().toISOString(),
    };

    // If editing, update the existing record; if creating, add new
    if (editing) {
      setMoveOuts((prev) =>
        prev.map((m) => (String(m.id) === String(record.id) ? record : m))
      );
    } else {
      setMoveOuts((prev) => [record, ...(prev || [])]);
    }
    setShowOutModal(false);
    setEditing(null);
  }

  if (permissionsLoading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700">
        <div className="max-w-[1600px] mx-auto">
          <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!canReadPage) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700">
        <div className="max-w-[1600px] mx-auto">
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-700">
            You do not have permission to view Move-In/Out.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Move-In/Out Management
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>&gt;</span> <span>Move-In/Out</span> <span>&gt;</span>
              <span className="text-slate-900 font-medium">
                Process Residents
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {canCreatePage && (
              <button
                onClick={() => setShowModal(true)}
                className="
      bg-teal-400
      hover:bg-teal-500
      active:bg-teal-600
      text-white
      px-5 py-2.5
      rounded-lg
      shadow-sm
      hover:shadow-md
      font-medium
      flex items-center gap-2
      transition-all duration-200
    "
              >
                <IconMoveIn size={18} />
                Process Move-In
              </button>
            )}

            {canCreatePage && (
              <button
                onClick={() => setShowOutModal(true)}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 px-5 py-2.5 rounded-lg shadow-sm font-medium flex items-center gap-2 transition-all duration-200"
              >
                <IconMoveOut size={18} />
                Process Move-Out
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Active Residents */}
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <IconUsers size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Active Residents</div>
              <div className="text-2xl font-bold text-gray-900">{counts.active}</div>
              <div className="text-xs text-gray-500 mt-1">Currently housed</div>
            </div>
          </div>

          {/* Recent Move-Ins */}
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <IconMoveIn size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Recent Move-Ins</div>
              <div className="text-2xl font-bold text-gray-900">{counts.moveIns}</div>
              <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
            </div>
          </div>

          {/* Recent Move-Outs */}
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <IconMoveOut size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Recent Move-Outs</div>
              <div className="text-2xl font-bold text-gray-900">{counts.moveOuts}</div>
              <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
            </div>
          </div>
        </div>

        {/* Content Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
          {/* Tab Switcher - Bookings Style */}
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200 px-6 pt-6">
            <button
              onClick={() => setActiveTab("ins")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "ins"
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Move-Ins
            </button>
            <button
              onClick={() => {
                setActiveTab("outs");
                fetchMoveOuts();
              }}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "outs"
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Move-Outs
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "active"
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Active Residents
            </button>
          </div>

          {/* List Content */}
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {activeTab === "ins"
                      ? "Recent Move-Ins"
                      : activeTab === "outs"
                        ? "Recent Move-Outs"
                        : "Active Residents"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {activeTab === "ins"
                      ? "Service users who recently moved into accommodation"
                      : activeTab === "outs"
                        ? "Service users who recently moved out"
                        : "Currently active residents"}
                  </p>
                </div>
              </div>

              {/* Filter Row - Bookings Style */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    value={filterProperty}
                    onChange={(e) => setFilterProperty(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">All Properties</option>
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                  >
                    <option value="All Status">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>

                <div className="relative">
                  <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">Sort by...</option>
                    <option value="date">Date (Newest)</option>
                    <option value="name">Name</option>
                    <option value="property">Property</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>

                {/* View Menu */}
                <div className="relative ml-auto" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* View Settings Dropdown */}
                  {showViewMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">View Settings</h3>
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
                          <div className="mt-2 border-t border-gray-200 pt-3">
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Shown in view</span>
                                <button
                                  onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: false }), {}))}
                                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                                >
                                  Hide all
                                </button>
                              </div>
                              <div className="space-y-1">
                                {ALL_COLUMNS.filter(col => visibleColumns[col]).map(col => (
                                  <button
                                    key={col}
                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: false })}
                                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                  >
                                    <span className="capitalize">{col === 'serviceUser' ? 'Service User' : col === 'moveInDate' ? 'Move-In Date' : col}</span>
                                    <Eye className="w-4 h-4 text-teal-600" />
                                  </button>
                                ))}
                              </div>
                            </div>

                            {Object.values(visibleColumns).some(v => !v) && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hidden in view</span>
                                  <button
                                    onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}))}
                                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                                  >
                                    Show all
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {ALL_COLUMNS.filter(col => !visibleColumns[col]).map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setVisibleColumns({ ...visibleColumns, [col]: true })}
                                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-50 rounded transition-colors"
                                    >
                                      <span className="capitalize">{col === 'serviceUser' ? 'Service User' : col === 'moveInDate' ? 'Move-In Date' : col}</span>
                                    </button>
                                  ))}
                                </div>
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
              <>
                {activeMoveIns && activeMoveIns.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {activeMoveIns.map((r) => {
                      const name = r.service_user_name || r.serviceUserName || r.serviceUser || "Unknown User";
                      const dateStr = r.move_in_date || r.moveInDate || r.created_at;
                      const formatted = dateStr
                        ? new Date(dateStr).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        : "";

                      return (
                        <div
                          key={r.id || Math.random()}
                          className="group bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-200"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-600 font-bold text-lg">
                              {name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-slate-800 font-bold text-base">
                                {name}
                              </div>
                              <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-medium text-emerald-700">
                                  {r.property_name || "No Property"}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-emerald-300"></span>
                                <span>Since {formatted}</span>
                                {r.room_name && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-emerald-300"></span>
                                    <span>Room {r.room_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="hidden sm:flex flex-col items-end">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                                Active Resident
                              </span>
                            </div>
                            <div className="h-8 w-px bg-emerald-200/50"></div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setDetailRecord(r);
                                  setShowDetailModal(true);
                                }}
                                className="group relative p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                title="View details"
                              >
                                <Eye size={18} />
                              </button>
                              {canUpdatePage && (
                                <button
                                  onClick={() => {
                                    setEditing(r);
                                    setShowModal(true);
                                  }}
                                  className="group relative p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Edit Record"
                                >
                                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="bg-white p-4 rounded-full mb-4 shadow-sm">
                      <Home className="text-slate-400" size={32} />
                    </div>
                    <div className="text-slate-600 font-semibold text-lg">
                      No active residents found
                    </div>
                    <div className="text-slate-400 text-sm mt-1">
                      Start by moving in a service user.
                    </div>
                  </div>
                )}
              </>
            )}

            {/* MOVE INS LIST */}
            {activeTab === "ins" && (
              <>
                {recent && recent.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {recent.map((r) => {
                      const name =
                        r.service_user_name ||
                        r.serviceUserName ||
                        r.serviceUser ||
                        "Unknown User";
                      const dateStr =
                        r.move_in_date || r.moveInDate || r.created_at;
                      const formatted = dateStr
                        ? new Date(dateStr).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        : "";
                      return (
                        <div
                          key={r.id || Math.random()}
                          className="group bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold text-lg">
                              {name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-slate-800 font-bold text-base">
                                {name}
                              </div>
                              <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-medium text-slate-600">
                                  {r.property_name || "No Property"}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span>Moved in {formatted}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="hidden sm:flex flex-col items-end">
                              {moveOuts.some(
                                (m) =>
                                  String(
                                    m.service_user_id || m.serviceUserId
                                  ) ===
                                  String(r.service_user_id || r.serviceUserId)
                              ) ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
                                  Inactive
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="h-8 w-px bg-slate-100"></div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setDetailRecord(r);
                                  setShowDetailModal(true);
                                }}
                                className="group relative p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                title="View details"
                              >
                                <IconEye size={18} />
                              </button>

                              {canUpdatePage && (
                                <button
                                  onClick={() => {
                                    setEditing(r);
                                    setShowModal(true);
                                  }}
                                  className="group relative p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Edit Record"
                                >
                                  <IconEdit size={18} />
                                </button>
                              )}

                              {canDeletePage && (
                                <button
                                  onClick={() => {
                                    setDeleteId(r.id);
                                    setDeleteType("move-in");
                                    setShowDeleteModal(true);
                                  }}
                                  className="group relative p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Delete Record"
                                >
                                  <IconTrash size={16} />
                                  <span className="text-sm font-medium hidden lg:inline">Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="bg-white p-4 rounded-full mb-4 shadow-sm">
                      <IconEmpty />
                    </div>
                    <div className="text-slate-600 font-semibold text-lg">
                      No recent move-ins found
                    </div>
                    <div className="text-slate-400 text-sm mt-1">
                      New move-ins will appear here.
                    </div>
                  </div>
                )}
              </>
            )}

            {/* MOVE OUTS LIST */}
            {activeTab === "outs" && (
              <>
                {moveOuts && moveOuts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {moveOuts.map((r) => {
                      const name = r.service_user_name || "Unknown User";
                      const dateStr = r.move_out_date || r.created_at;
                      const formatted = dateStr
                        ? new Date(dateStr).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        : "";
                      return (
                        <div
                          key={r.id || Math.random()}
                          className="group bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold text-lg">
                              {name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-slate-800 font-bold text-base">
                                {name}
                              </div>
                              <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>Moved out {formatted}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="hidden sm:flex flex-col items-end">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                Departed
                              </span>
                            </div>
                            <div className="h-8 w-px bg-slate-100"></div>
                            <div className="flex items-center gap-1.5">
                              {canUpdatePage && (
                                <button
                                  onClick={() => {
                                    setEditing(r);
                                    setShowOutModal(true);
                                  }}
                                  className="group relative p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Edit Record"
                                >
                                  <IconEdit size={18} />
                                </button>
                              )}
                              {canDeletePage && (
                                <button
                                  onClick={() => {
                                    setDeleteId(r.id);
                                    setDeleteType("move-out");
                                    setShowDeleteModal(true);
                                  }}
                                  className="group relative p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Delete Record"
                                >
                                  <IconTrash size={18} />
                                </button>
                              )}

                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="bg-white p-4 rounded-full mb-4 shadow-sm">
                      <IconEmpty />
                    </div>
                    <div className="text-slate-600 font-semibold text-lg">
                      No recent move-outs found
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Move In Modal */}
      {showModal && (
        <MoveInModal
          hotels={hotels}
          serviceUsers={serviceUsers}
          rooms={rooms}
          recent={recent}
          moveOuts={moveOuts}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          initialRecord={editing}
          onCreate={(record) => {
            setRecent((prev) => {
              if (!record) return prev;
              const idx = prev.findIndex(
                (p) => String(p.id) === String(record.id)
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = record;
                return next;
              }
              return [record, ...prev];
            });
            setShowModal(false);
            setEditing(null);
          }}
          fetchRooms={fetchRooms}
          bedspaces={bedspaces}
          fetchBedspaces={fetchBedspaces}
          onSave={onSave}
          onError={(message) => {
            setAlertDialog({
              isOpen: true,
              title: 'Error',
              message: message,
              type: 'error'
            });
          }}
        />
      )}

      {/* Move Out Modal */}
      {showOutModal && (
        <MoveOutModal
          activeResidents={activeResidents}
          onClose={() => {
            setShowOutModal(false);
            setEditing(null);
          }}
          onSave={saveMoveOut}
          onSuccess={handleOutCreated}
          initialRecord={editing}
          onError={(message) => {
            setAlertDialog({
              isOpen: true,
              title: 'Error',
              message: message,
              type: 'error'
            });
          }}
        />
      )}
      {showDetailModal && (
        <DetailModal
          record={detailRecord}
          onClose={() => {
            setShowDetailModal(false);
            setDetailRecord(null);
          }}
          moveOuts={moveOuts}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {deleteType === "move-in" ? "Delete Move-In?" : "Delete Move-Out?"}
            </h3>

            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteId(null);
                  setDeleteType(null);
                }}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="
            px-4 py-2 rounded-md
            bg-teal-400 hover:bg-teal-500
            text-white font-medium
            disabled:opacity-50
          "
              >
                {deleting ? "Deleting..." : "Delete"}
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
        confirmText={confirmDialog.confirmText || 'Confirm'}
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

function DetailModal({ record = null, onClose = () => { }, moveOuts = [] }) {
  const r = record || {};
  const movedOut = moveOuts.find(
    (m) =>
      String(m.service_user_id || m.serviceUserId) ===
      String(r.service_user_id || r.serviceUserId || r.serviceUser)
  );
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
      : "Not specified";

  const get = (key) => r[key] || r[key.replace(/_/g, "")] || "Not specified";

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-slate-900/60 p-4 overflow-y-auto mt-10">
      <div className="bg-transparent w-full max-w-5xl mt-10">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50/30">
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                Resident Details
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Detailed move-in & move-out information
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-500">
                {movedOut ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                    Inactive
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                    Active
                  </span>
                )}
              </div>
              <button
                onClick={() => onClose()}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
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
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Move-In Details Card */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h4 className="text-lg font-semibold text-slate-800">
                Move-In Details
              </h4>
              <p className="text-sm text-slate-400 mt-1">
                Checklist, notes and signature captured at move-in
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-slate-700">
                <div>
                  <div className="text-xs text-slate-400">Move-In Date</div>
                  <div className="mt-1 font-medium">
                    {get("move_in_date") !== "Not specified"
                      ? fmt(get("move_in_date"))
                      : "Not specified"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Notes</div>
                  <div className="mt-1 font-medium">
                    {r.notes || "Not specified"}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-xs text-slate-400">Checklist</div>
                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                    {MOVE_IN_CHECKLIST_ITEMS &&
                      MOVE_IN_CHECKLIST_ITEMS.length > 0 ? (
                      <ul className="space-y-2">
                        {MOVE_IN_CHECKLIST_ITEMS.map((label, i) => {
                          const v =
                            (r.checklist &&
                              (r.checklist[i] !== undefined
                                ? r.checklist[i]
                                : r.checklist[String(i)])) ||
                            false;
                          return (
                            <li key={i} className="flex items-start gap-3">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center ${v
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-200 text-slate-500"
                                  }`}
                              >
                                {v ? "✓" : ""}
                              </div>
                              <div className="text-slate-700">{label}</div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-slate-400">
                        No checklist recorded
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Signature</div>
                  <div className="mt-1 font-medium">
                    {r.signature ? (
                      typeof r.signature === "string" &&
                        r.signature.startsWith("data:") ? (
                        <img
                          src={r.signature}
                          alt="signature"
                          className="max-h-28 rounded-md border"
                        />
                      ) : (
                        <span className="font-mono text-xs break-all">
                          {r.signature}
                        </span>
                      )
                    ) : (
                      "Not provided"
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Move-Out Details Card */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h4 className="text-lg font-semibold text-slate-800">
                Move-Out Details
              </h4>
              <p className="text-sm text-slate-400 mt-1">
                Checklist, notes and signature captured at move-out
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm text-slate-700">
                <div>
                  <div className="text-xs text-slate-400">Move-Out Date</div>
                  <div className="mt-1 font-medium">
                    {movedOut
                      ? movedOut.move_out_date
                        ? fmt(movedOut.move_out_date)
                        : movedOut.created_at
                          ? fmt(movedOut.created_at)
                          : "Not specified"
                      : "Not specified"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Notes</div>
                  <div className="mt-1 font-medium">
                    {movedOut?.notes || "Not specified"}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-xs text-slate-400">Checklist</div>
                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                    {MOVE_OUT_CHECKLIST_ITEMS &&
                      MOVE_OUT_CHECKLIST_ITEMS.length > 0 ? (
                      <ul className="space-y-2">
                        {MOVE_OUT_CHECKLIST_ITEMS.map((label, i) => {
                          const v =
                            (movedOut &&
                              movedOut.checklist &&
                              (movedOut.checklist[i] !== undefined
                                ? movedOut.checklist[i]
                                : movedOut.checklist[String(i)])) ||
                            false;
                          return (
                            <li key={i} className="flex items-start gap-3">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center ${v
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-200 text-slate-500"
                                  }`}
                              >
                                {v ? "✓" : ""}
                              </div>
                              <div className="text-slate-700">{label}</div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-slate-400">
                        No checklist recorded
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Signature</div>
                  <div className="mt-1 font-medium">
                    {movedOut && movedOut.signature ? (
                      typeof movedOut.signature === "string" &&
                        movedOut.signature.startsWith("data:") ? (
                        <img
                          src={movedOut.signature}
                          alt="move-out signature"
                          className="max-h-28 rounded-md border"
                        />
                      ) : (
                        <span className="font-mono text-xs break-all">
                          {movedOut.signature}
                        </span>
                      )
                    ) : (
                      "Not provided"
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoveInModal({
  hotels = [],
  serviceUsers = [],
  rooms = [],
  bedspaces = [],
  recent = [],
  moveOuts = [],
  onClose = () => { },
  onCreate = () => { },
  fetchRooms = async () => [],
  fetchBedspaces = async () => [],
  onSave = async () => null,
  initialRecord = null,
  onError = () => { },
}) {
  const [form, setForm] = useState({
    serviceUserId: "",
    propertyId: "",
    roomId: "",
    bedspaceId: "",
    moveInDate: new Date().toISOString().slice(0, 10),
    checklist: {},
    notes: "",
    signature: "",
  });

  useEffect(() => {
    if (!initialRecord) return;
    setForm((f) => ({
      ...f,
      serviceUserId:
        initialRecord.serviceUserId ||
        initialRecord.service_user_id ||
        initialRecord.service_user ||
        f.serviceUserId,
      propertyId:
        initialRecord.propertyId ||
        initialRecord.property_id ||
        initialRecord.propertyId ||
        f.propertyId,
      roomId: initialRecord.roomId || initialRecord.room_id || f.roomId,
      bedspaceId:
        initialRecord.bedspaceId || initialRecord.bedspace_id || f.bedspaceId,
      moveInDate:
        initialRecord.moveInDate || initialRecord.move_in_date || f.moveInDate,
      checklist:
        initialRecord.checklist || initialRecord.check_list || f.checklist,
      notes: initialRecord.notes || f.notes,
      signature: initialRecord.signature || f.signature,
    }));
  }, [initialRecord]);

  const checklistItems = MOVE_IN_CHECKLIST_ITEMS;

  const api = useMemo(
    () =>
      axios.create({
        baseURL: import.meta.env.VITE_API_URL || "",
        withCredentials: true,
        timeout: 15000,
      }),
    []
  );

  const [roomCapacity, setRoomCapacity] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadRoomCapacity() {
      if (!form.propertyId || !form.roomId) {
        if (mounted) setRoomCapacity(null);
        return;
      }
      try {
        const res = await api.get(
          `/api/hotels/${encodeURIComponent(form.propertyId)}/rooms/${encodeURIComponent(form.roomId)}`
        );
        const room = res?.data || {};
        const cap =
          room.bedspaces ??
          room.bedspace_count ??
          room.capacity ??
          room.total_bedspaces ??
          null;
        const n = cap === null || cap === undefined ? null : Number(cap);
        if (mounted) setRoomCapacity(Number.isFinite(n) ? n : null);
      } catch (err) {
        if (mounted) setRoomCapacity(null);
      }
    }
    loadRoomCapacity();
    return () => {
      mounted = false;
    };
  }, [api, form.propertyId, form.roomId]);

  const availableBedspacesForRoom = useMemo(() => {
    if (!form.roomId) return [];

    const movedOutIds = new Set(
      (Array.isArray(moveOuts) ? moveOuts : []).map((o) =>
        String(o.service_user_id || o.serviceUserId).toLowerCase()
      )
    );

    const activeMoveIns = (Array.isArray(recent) ? recent : []).filter((r) => {
      const suId = String(r.service_user_id || r.serviceUserId).toLowerCase();
      return !movedOutIds.has(suId);
    });

    const occupiedBedspaceIds = new Set(
      activeMoveIns
        .filter((r) => String(r.room_id || r.roomId) === String(form.roomId))
        .map((r) => r.bedspace_id || r.bedspaceId)
        .filter(Boolean)
        .map((id) => String(id))
    );

    return (Array.isArray(bedspaces) ? bedspaces : []).filter(
      (b) => !occupiedBedspaceIds.has(String(b.id))
    );
  }, [form.roomId, bedspaces, recent, moveOuts]);

  const availableSlotsCount = useMemo(() => {
    if (!form.roomId) return 0;

    const movedOutIds = new Set(
      (Array.isArray(moveOuts) ? moveOuts : []).map((o) =>
        String(o.service_user_id || o.serviceUserId).toLowerCase()
      )
    );

    const activeMoveIns = (Array.isArray(recent) ? recent : []).filter((r) => {
      const suId = String(r.service_user_id || r.serviceUserId).toLowerCase();
      return !movedOutIds.has(suId);
    });

    const occupiedCount = activeMoveIns.filter(
      (r) => String(r.room_id || r.roomId) === String(form.roomId)
    ).length;

    const cap = Number(roomCapacity);
    if (!Number.isFinite(cap) || cap <= 0) return 0;

    const free = cap - occupiedCount;
    return free > 0 ? free : 0;
  }, [form.roomId, recent, moveOuts, roomCapacity]);

  const bedspaceOptions = useMemo(() => {
    if (!form.roomId) return [];
    if (availableBedspacesForRoom.length > 0) {
      return availableBedspacesForRoom.map((b) => ({ value: String(b.id), label: b.name }));
    }
    if (availableSlotsCount > 0) {
      return Array.from({ length: availableSlotsCount }, (_, i) => {
        const n = i + 1;
        return { value: String(n), label: `Bedspace ${n}` };
      });
    }
    return [];
  }, [form.roomId, availableBedspacesForRoom, availableSlotsCount]);

  useEffect(() => {
    if (form.propertyId) {
      fetchRooms(form.propertyId);
      setForm((f) => ({ ...f, roomId: "", bedspaceId: "" }));
    } else {
      setForm((f) => ({ ...f, roomId: "", bedspaceId: "" }));
    }
  }, [form.propertyId, fetchRooms]);

  useEffect(() => {
    if (form.propertyId && form.roomId) {
      fetchBedspaces(form.propertyId, form.roomId);
      setForm((f) => ({ ...f, bedspaceId: "" }));
    } else {
      setForm((f) => ({ ...f, bedspaceId: "" }));
    }
  }, [form.roomId, form.propertyId, fetchBedspaces]);

  function toggleItem(idx) {
    setForm((f) => ({
      ...f,
      checklist: { ...f.checklist, [idx]: !f.checklist[idx] },
    }));
  }

  function handleChange(field, value) {
    if (field === "serviceUserId") {
      const su = (Array.isArray(serviceUsers) ? serviceUsers : []).find(
        (s) => String(s.id) === String(value)
      );
      const nextPropertyId = su?.propertyId ? String(su.propertyId) : "";
      setForm((f) => ({
        ...f,
        serviceUserId: value,
        propertyId: nextPropertyId,
        roomId: "",
        bedspaceId: "",
      }));
      return;
    }
    if (field === "propertyId") {
      setForm((f) => ({ ...f, propertyId: value, roomId: "" }));
      return;
    }
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    if (initialRecord && initialRecord.id) payload.id = initialRecord.id;
    try {
      const suObj = serviceUsers.find(
        (s) => String(s.id) === String(payload.serviceUserId)
      );
      if (suObj) payload.service_user_name = suObj.name;
      const propObj = hotels.find(
        (h) => String(h.id) === String(payload.propertyId)
      );
      if (propObj)
        payload.property_name = propObj.name || propObj._displayName || null;
      const roomObj = rooms.find(
        (r) => String(r.id) === String(payload.roomId)
      );
      if (roomObj)
        payload.room_name = roomObj.room_number || roomObj.name || null;
      const bedObj = bedspaces.find(
        (b) => String(b.id) === String(payload.bedspaceId)
      );
      if (bedObj) payload.bedspace_name = bedObj.name || null;

      const saved = await onSave(payload);
      if (saved) {
        const record = {
          id: saved.id || Math.floor(Math.random() * 1000000),
          serviceUserId: saved.service_user_id || payload.serviceUserId,
          service_user_name:
            saved.service_user_name ||
            saved.serviceUserName ||
            payload.service_user_name ||
            payload.serviceUserName ||
            null,
          propertyId: saved.property_id || payload.propertyId,
          property_name:
            saved.property_name ||
            saved.propertyName ||
            payload.property_name ||
            payload.propertyName ||
            null,
          roomId: saved.room_id || payload.roomId,
          room_name:
            saved.room_name ||
            saved.roomName ||
            payload.room_name ||
            payload.roomName ||
            null,
          bedspaceId: saved.bedspace_id || payload.bedspaceId,
          bedspace_name:
            saved.bedspace_name ||
            saved.bedspaceName ||
            payload.bedspace_name ||
            payload.bedspaceName ||
            null,
          moveInDate: saved.move_in_date || payload.moveInDate,
          checklist: saved.checklist || payload.checklist,
          notes: saved.notes || payload.notes,
          signature: saved.signature || payload.signature,
          created_at: saved.created_at || new Date().toISOString(),
        };
        onCreate(record);
      } else {
        onCreate({
          ...payload,
          id: Math.floor(Math.random() * 1000000),
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("save move-in failed", err);
      onError("Failed to save move-in. See console for details.");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden h-[73vh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start p-6 border-b border-slate-100 shrink-0 bg-slate-50/30">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Process Move-In
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Complete the move-in checklist for a new resident
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="moveInForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Property
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 transition-all"
                  value={form.propertyId}
                  onChange={(e) => handleChange("propertyId", e.target.value)}
                >
                  <option value="">Select property</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Room
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 transition-all"
                  value={form.roomId}
                  onChange={(e) => handleChange("roomId", e.target.value)}
                  disabled={!form.propertyId}
                >
                  <option value="">
                    {form.propertyId ? "Select room" : "Select property first"}
                  </option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_number || r.name || r.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Bedspace (Optional)
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 transition-all"
                  value={form.bedspaceId}
                  onChange={(e) => handleChange("bedspaceId", e.target.value)}
                  disabled={!form.roomId || bedspaceOptions.length === 0}
                >
                  <option value="">Select bedspace</option>
                  {bedspaceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Move-In Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  transition-all"
                value={form.moveInDate}
                onChange={(e) => handleChange("moveInDate", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Move-In Checklist
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checklistItems.map((t, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 text-sm p-3 border rounded-lg cursor-pointer transition-all duration-200 ${form.checklist[i]
                      ? "bg-emerald-20 border-emerald-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                        checked={!!form.checklist[i]}
                        onChange={() => toggleItem(i)}
                      />
                    </div>
                    <span
                      className={`text-slate-600 ${form.checklist[i] ? "text-slate-900 font-medium" : ""
                        }`}
                    >
                      {t}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Additional Notes
              </label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  transition-all resize-none"
                rows={3}
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Any additional observations or comments..."
              />
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-100 shrink-0 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-white hover:shadow-sm transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="moveInForm"
            className="
    px-6 py-2.5
    bg-teal-400
    hover:bg-teal-500
    active:bg-teal-600
    text-white
    rounded-lg
    font-medium
    shadow-sm
    hover:shadow
    transition-all
  "
          >
            Complete Move-In
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MoveOutModal({
  activeResidents = [],
  onClose = () => { },
  onSave = async () => { },
  onSuccess = () => { },
  initialRecord = null,
  onError = () => { },
}) {
  const [form, setForm] = useState({
    serviceUserId: "",
    service_user_name: "",
    moveOutDate: new Date().toISOString().slice(0, 10),
    checklist: {},
    notes: "",
  });

  useEffect(() => {
    if (!initialRecord) return;
    setForm((f) => ({
      serviceUserId:
        initialRecord.service_user_id ||
        initialRecord.serviceUserId ||
        f.serviceUserId,
      service_user_name: initialRecord.service_user_name || f.service_user_name,
      moveOutDate:
        initialRecord.move_out_date ||
        initialRecord.moveOutDate ||
        f.moveOutDate,
      checklist: initialRecord.checklist || f.checklist,
      notes: initialRecord.notes || f.notes,
    }));
  }, [initialRecord]);

  const checklistItems = MOVE_OUT_CHECKLIST_ITEMS;

  function toggleItem(idx) {
    setForm((f) => ({
      ...f,
      checklist: { ...f.checklist, [idx]: !f.checklist[idx] },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const saved = await onSave(form);
      onSuccess(saved);
    } catch (err) {
      console.error(err);
      onError("Failed to process move-out");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50/30">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {initialRecord ? "Edit Move-Out" : "Process Move-Out"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {initialRecord
                ? "Update move-out details"
                : "Finalize residency and check out user"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="moveOutForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Resident
                </label>
                <select
                  required
                  disabled={initialRecord}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  value={form.serviceUserId}
                  onChange={(e) => {
                    const selectedUser = activeResidents.find(
                      (r) => String(r.id) === String(e.target.value)
                    );
                    setForm({
                      ...form,
                      serviceUserId: e.target.value,
                      service_user_name: selectedUser?.name || "",
                    });
                  }}
                >
                  <option value="">Select resident</option>
                  {activeResidents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Move-Out Date
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 transition-all"
                  value={form.moveOutDate}
                  onChange={(e) =>
                    setForm({ ...form, moveOutDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Move-Out Checklist
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checklistItems.map((t, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 text-sm p-3 border rounded-lg cursor-pointer transition-all duration-200 ${form.checklist[i]
                      ? "bg-emerald-50 border-emerald-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                        checked={!!form.checklist[i]}
                        onChange={() => toggleItem(i)}
                      />
                    </div>
                    <span
                      className={`text-slate-600 ${form.checklist[i] ? "text-slate-900 font-medium" : ""
                        }`}
                    >
                      {t}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  transition-all resize-none"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Final remarks..."
              />
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-white hover:shadow-sm transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="moveOutForm"
            className="
    px-6 py-2.5
    bg-teal-400
    hover:bg-teal-500
    active:bg-teal-600
    text-white
    rounded-lg
    font-medium
    shadow-sm
    hover:shadow
    transition-all
  "
          >
            Confirm Move-Out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}