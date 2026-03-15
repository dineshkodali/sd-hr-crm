/* eslint-disable no-unused-vars */
// src/pages/HotelsList.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate, useOutletContext } from "react-router-dom";
// This imports the component code you provided in your prompt
import PropertyDetails from "./PropertyDetailsComponent";
import Breadcrumbs from "../components/Breadcrumbs";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';

const DELETE_STYLE_ID = 'hotels-list-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = DELETE_STYLE_ID;
  style.textContent = `
    @keyframes hotelsListCardDelete {
      0%   { opacity: 1; transform: scale(1) rotate(0deg); }
      30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: var(--hover-bg); }
      100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
    }
    .hotels-list-card-deleting {
      animation: hotelsListCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

export default function HotelsList({ user: userProp }) {
  const context = useOutletContext();
  const user = userProp || context?.user || {};
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  const [hotels, setHotels] = useState([]);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [roomsOccupiedByHotel, setRoomsOccupiedByHotel] = useState({});
  const roomsOccupiedCacheRef = useRef({});

  // Form State
  const [form, setForm] = useState({
    name: "",
    property_type: "Hotel Style",
    status: "Active",
    address: "",
    city: "",
    postcode: "",
    total_beds: 0,
    occupied_beds: 0,
    total_floors: 0,
    manager_name: "",
    manager_phone: "",
    manager_email: "",
    about: "",
  });

  const [showAdd, setShowAdd] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const navigate = useNavigate();

  // Edit modal state
  const [editingHotel, setEditingHotel] = useState(null);
  const [editTab, setEditTab] = useState("basic");
  const [savingEdit, setSavingEdit] = useState(false);
  const modalRef = useRef(null);

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


  // Access tab
  const [accessStaffList, setAccessStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");

  // Staff list for manager dropdown in edit modal
  const [managersList, setManagersList] = useState([]);

  // Property detail state
  const [detailProperty, setDetailProperty] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Toggle body class for hiding navbars
  useEffect(() => {
    const shouldHide = Boolean(showAdd || editingHotel || confirmDialog.isOpen);
    if (shouldHide) {
      document.body.classList.add("form-modal-open");
    } else {
      document.body.classList.remove("form-modal-open");
    }
    return () => {
      document.body.classList.remove("form-modal-open");
    };
  }, [showAdd, editingHotel, confirmDialog.isOpen]);

  axios.defaults.withCredentials = true;

  // --- FETCH HOTELS ---
  const lastHotelsFetchRef = useRef(0);
  const HOTELS_REFRESH_STALE_MS = 30_000;

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/hotels");
      const list = Array.isArray(res.data?.hotels)
        ? res.data.hotels
        : Array.isArray(res.data)
          ? res.data
          : res.data?.data ?? [];
      setHotels(list);
      lastHotelsFetchRef.current = Date.now();
    } catch (err) {
      console.error("fetch hotels error:", err);
      setHotels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  useEffect(() => {
    const maybeRefresh = () => {
      const last = Number(lastHotelsFetchRef.current || 0);
      const now = Date.now();
      if (now - last < HOTELS_REFRESH_STALE_MS) return;
      fetchHotels();
    };
    const onFocus = () => {
      maybeRefresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (e.target.closest && e.target.closest(".card-menu")) return;
      setOpenMenuId(null);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  // Close modal on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!modalRef.current) return;
      if (editingHotel && !modalRef.current.contains(e.target)) {
        setEditingHotel(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [editingHotel]);

  // Fetch managers when Add Modal is opened
  useEffect(() => {
    if (showAdd) {
      fetchAllManagers();
    }
  }, [showAdd]);

  // --- CREATE PROPERTY ---
  const handleCreate = async (e) => {
    e?.preventDefault();
    setErrorMsg("");

    if (!String(form.name || "").trim()) {
      setErrorMsg("Please enter property name");
      return;
    }
    if (!String(form.property_type || "").trim()) {
      setErrorMsg("Please select property type");
      return;
    }
    if (!String(form.status || "").trim()) {
      setErrorMsg("Please select status");
      return;
    }
    if (!String(form.address || "").trim()) {
      setErrorMsg("Please enter address");
      return;
    }
    if (!String(form.city || "").trim()) {
      setErrorMsg("Please enter city");
      return;
    }
    if (!String(form.postcode || "").trim()) {
      setErrorMsg("Please enter postcode");
      return;
    }
    if (!Number(form.total_beds)) {
      setErrorMsg("Please enter total beds");
      return;
    }
    if (!Number(form.total_floors)) {
      setErrorMsg("Please enter total floors");
      return;
    }
    if (user?.role !== "manager") {
      if (!String(form.manager_name || "").trim()) {
        setErrorMsg("Please select manager name");
        return;
      }
      if (!String(form.manager_phone || "").trim()) {
        setErrorMsg("Please enter manager phone");
        return;
      }
      if (!String(form.manager_email || "").trim()) {
        setErrorMsg("Please select manager email");
        return;
      }
    }
    if (!String(form.about || "").trim()) {
      setErrorMsg("Please enter about");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: (form.name || "").trim(),
        property_type: form.property_type || null,
        status: form.status || null,
        address: form.address || null,
        city: form.city || null,
        postcode: form.postcode || null,
        total_beds: Number(form.total_beds) || 0,
        occupied_beds: Number(form.occupied_beds) || 0,
        total_floors: Number(form.total_floors) || 0,
        manager_name: form.manager_name || null,
        manager_phone: form.manager_phone || null,
        manager_email: form.manager_email || null,
        description: form.about || null,
      };

      if (user?.role === "manager") {
        payload.manager = user.id;
      }

      await axios.post("/api/hotels", payload, { withCredentials: true });

      setForm({
        name: "",
        property_type: "Hotel Style",
        status: "Active",
        address: "",
        city: "",
        postcode: "",
        total_beds: 0,
        occupied_beds: 0,
        total_floors: 0,
        manager_name: "",
        manager_phone: "",
        manager_email: "",
        about: "",
      });

      setShowAdd(false);
      await fetchHotels();
    } catch (err) {
      console.error("create hotel error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Server error";
      setErrorMsg(msg);
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Property',
      message: 'Delete this property? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setDeletingIds(prev => new Set(prev).add(id));
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          const ANIM_DURATION = 460;
          setTimeout(() => {
            setHotels(prev => (Array.isArray(prev) ? prev.filter(h => String(h.id) !== String(id)) : prev));
            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          }, ANIM_DURATION);

          await axios.delete(`/api/hotels/${id}`, { withCredentials: true });
          await fetchHotels();
        } catch (err) {
          console.error("delete property:", err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: err?.response?.data?.message || 'Failed to delete property',
            type: 'error'
          });
        } finally {
          setOpenMenuId(null);
        }
      }
    });
  };

  async function fetchAllowedUsersForHotel(hotelId) {
    try {
      const r = await axios.get(`/api/hotels/${hotelId}/access`);
      const allowed = r?.data?.users ?? [];
      setEditingHotel((prev) =>
        prev ? { ...prev, allowed_users: allowed } : prev
      );
    } catch (err) {
      setEditingHotel((prev) =>
        prev ? { ...prev, allowed_users: prev.allowed_users || [] } : prev
      );
    }
  }

  // helpers for computing top stat cards
  const totalCount = hotels.length;
  const hotelStyleCount = hotels.filter(
    (h) => String(h.property_type || "").toLowerCase() === "hotel style"
  ).length;
  const selfContainedCount = hotels.filter((h) => {
    if (
      typeof h.is_self_contained !== "undefined" &&
      h.is_self_contained !== null
    ) {
      return !!h.is_self_contained;
    }
    return String(h.property_type || "").toLowerCase() === "self-contained";
  }).length;

  const fullyOccupiedCount = hotels.filter((h) => {
    const tb = Number(h.total_beds || h.total_bed || 0);
    const ob = Number(h.occupied_beds || h.occupied || 0);
    if (tb === 0) return false;
    return ob >= tb;
  }).length;

  const canCreateHotel = user?.role === "admin" || user?.role === "manager";

  // Filtered list based on search and property type
  const filteredHotels = useMemo(() => {
    let list = [...hotels];
    const q = (search || "").trim().toLowerCase();

    if (filterType) {
      const ft = filterType.toLowerCase();
      list = list.filter((h) => {
        const type = String(h.property_type || (h.is_self_contained ? "self-contained" : "")).toLowerCase();
        return type.includes(ft);
      });
    }

    if (q) {
      list = list.filter((h) => {
        const name = (h.name || "").toLowerCase();
        const address = (h.address || "").toLowerCase();
        const city = (h.city || "").toLowerCase();
        const postcode = (h.postcode || "").toLowerCase();
        const manager = (h.manager_name || "").toLowerCase();
        const managerEmail = (h.manager_email || "").toLowerCase();
        const type = String(h.property_type || (h.is_self_contained ? "self-contained" : "")).toLowerCase();
        return (
          name.includes(q) ||
          address.includes(q) ||
          city.includes(q) ||
          postcode.includes(q) ||
          manager.includes(q) ||
          managerEmail.includes(q) ||
          type.includes(q)
        );
      });
    }

    return list;
  }, [hotels, search, filterType]);

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  // --- EDIT LOGIC ---
  const handleEditChange = (field, value) => {
    setEditingHotel((prev) => {
      if (!prev) return prev;
      let newVal = value;
      if (field === "rating" || field === "reviews") {
        if (value === "" || value === null) {
          newVal = "";
        } else {
          const asNum = Number(value);
          if (!Number.isNaN(asNum)) {
            newVal = asNum;
          }
        }
      }
      return { ...prev, [field]: newVal };
    });
  };

  // Fetch all staff (potentially filtered by branch/role server-side) for the manager dropdown
  async function fetchAllManagers() {
    try {
      const res = await axios.get("/api/staff");
      const list = res?.data?.users ?? res.data ?? [];
      const normalized = (Array.isArray(list) ? list : [])
        .filter((u) => (u.role || "").toLowerCase() === "manager") // Filter only managers
        .map((u) => ({
          id: u.id,
          name: u.name || u.email || "Unknown",
          email: u.email || null,
          avatar: u.avatar || u.photo || null,
          role: u.role || "staff",
          manager_id: u.manager_id ?? null,
          branch: u.branch ?? null,
        }));
      setManagersList(normalized);
    } catch (err) {
      console.error("fetchAllManagers error:", err);
      // fallback to empty or handle gracefully
      setManagersList([]);
    }
  }

  async function fetchStaffForHotel(hotelOrId) {
    setLoadingStaff(true);
    setAccessStaffList([]);
    setAccessMessage("");
    try {
      const hotelId = typeof hotelOrId === "object" ? hotelOrId.id : hotelOrId;
      try {
        const res = await axios.get(
          `/api/staff/for-hotel/${encodeURIComponent(hotelId)}`
        );
        const list = res?.data?.staff ?? res?.data?.users ?? res?.data ?? [];
        const normalized = (Array.isArray(list) ? list : []).map((u) => ({
          id: u.id,
          name: u.name || u.email || "Unknown",
          email: u.email || null,
          avatar: u.avatar || u.photo || null,
          role: u.role || "staff",
          manager_id: u.manager_id ?? null,
          branch: u.branch ?? null,
        }));
        setAccessStaffList(normalized);
        // Do NOT set managersList here anymore; we want the full list
        return;
      } catch (err) {
        console.warn(
          "Specialized endpoint failed, using fallback:",
          err.message
        );
      }
      // Fallback
      const rAll = await axios.get(`/api/staff`);
      const list = rAll?.data?.users ?? rAll?.data ?? [];
      const normalized = Array.isArray(list) ? list : [];
      setAccessStaffList(normalized);
    } catch (err) {
      console.error("fetchStaffForHotel critical error:", err);
      setAccessStaffList([]);
    } finally {
      setLoadingStaff(false);
    }
  }

  async function fetchAllowedUsersForHotel(hotelId) {
    try {
      const r = await axios.get(`/api/hotels/${hotelId}/access`);
      const allowed = r?.data?.users ?? [];
      setEditingHotel((prev) =>
        prev ? { ...prev, allowed_users: allowed } : prev
      );
    } catch (err) {
      setEditingHotel((prev) =>
        prev ? { ...prev, allowed_users: prev.allowed_users || [] } : prev
      );
    }
  }

  const openEditModal = async (hotel) => {
    const rawRating =
      hotel.rating != null
        ? hotel.rating
        : hotel.reviews || hotel.review || 4.3;
    const numericRating = Number.isFinite(Number(rawRating))
      ? Number(rawRating)
      : 4.3;

    const init = {
      id: hotel.id,
      name: hotel.name || "",
      manager_name: hotel.manager_name || hotel.manager || "",
      manager_email:
        hotel.manager_email || hotel.manager_email || hotel.email || "",
      phone: hotel.phone || hotel.contact_phone || "",
      rating: numericRating,
      about: hotel.about || hotel.description || "",
      address_line: hotel.address || "",
      country: hotel.country || hotel.country_name || "",
      state: hotel.state || "",
      city: hotel.city || "",
      zipcode: hotel.postcode || hotel.zipcode || hotel.postal_code || "",
      visibility: hotel.visibility || "private",
      allowed_users: hotel.allowed_users || hotel.allowed || [],
      status: hotel.status || "",
      branch: hotel.branch ?? hotel._raw?.branch ?? null,
      manager_id: hotel.manager_id ?? hotel._raw?.manager_id ?? null,
      total_beds: hotel.total_beds ?? hotel.total_bed ?? 0,
      occupied_beds: hotel.occupied_beds ?? hotel.occupied ?? 0,
      property_type: hotel.property_type || "Hotel Style",
      is_self_contained: hotel.is_self_contained ?? false,
      _raw: hotel,
    };

    setOpenMenuId(null);
    setTimeout(() => {
      setEditingHotel(init);
      fetchStaffForHotel(init);
      fetchAllManagers(); // Fetch full list for the dropdown
      fetchAllowedUsersForHotel(init.id);
    }, 0);
  };

  const saveEdit = async () => {
    if (!editingHotel || !editingHotel.id) return;

    if (!String(editingHotel.name || "").trim()) {
      alert("Please enter property name");
      return;
    }
    if (!String(editingHotel.property_type || "").trim()) {
      alert("Please select property type");
      return;
    }
    if (!String(editingHotel.status || "").trim()) {
      alert("Please select status");
      return;
    }
    if (!Number(editingHotel.total_beds)) {
      alert("Please enter total beds");
      return;
    }
    if (!Number(editingHotel.total_floors)) {
      alert("Please enter total floors");
      return;
    }
    if (!String(editingHotel.manager_name || "").trim()) {
      alert("Please select manager name");
      return;
    }
    if (!String(editingHotel.manager_email || "").trim()) {
      alert("Please enter manager email");
      return;
    }
    if (!String(editingHotel.phone || "").trim()) {
      alert("Please enter phone number");
      return;
    }
    if (!String(editingHotel.about || "").trim()) {
      alert("Please enter about");
      return;
    }
    if (!String(editingHotel.address_line || "").trim()) {
      alert("Please enter address");
      return;
    }
    if (!String(editingHotel.country || "").trim()) {
      alert("Please enter country");
      return;
    }
    if (!String(editingHotel.state || "").trim()) {
      alert("Please enter state");
      return;
    }
    if (!String(editingHotel.city || "").trim()) {
      alert("Please enter city");
      return;
    }
    if (!String(editingHotel.zipcode || "").trim()) {
      alert("Please enter zipcode");
      return;
    }
    if (!String(editingHotel.visibility || "").trim()) {
      alert("Please select visibility");
      return;
    }

    setSavingEdit(true);
    try {
      const original = editingHotel._raw || {};
      const payload = {};

      const setIfChanged = (key, newVal, originalKey = key) => {
        if (typeof newVal === "undefined") return;
        const origVal = original[originalKey];
        if (
          (newVal === "" &&
            (origVal === null || typeof origVal === "undefined")) ||
          String(newVal) === String(origVal)
        ) {
          return;
        }
        payload[key] = newVal;
      };

      setIfChanged("name", editingHotel.name, "name");
      setIfChanged(
        "property_type",
        editingHotel.property_type,
        "property_type"
      );
      setIfChanged("address", editingHotel.address_line ?? null, "address");
      setIfChanged("city", editingHotel.city ?? null, "city");
      setIfChanged("state", editingHotel.state ?? null, "state");
      setIfChanged("country", editingHotel.country ?? null, "country");
      setIfChanged("phone", editingHotel.phone ?? null, "phone");
      setIfChanged("status", editingHotel.status ?? null, "status");
      setIfChanged(
        "total_beds",
        Number(editingHotel.total_beds ?? 0),
        "total_beds"
      );
      setIfChanged(
        "occupied_beds",
        undefined,
        "occupied_beds"
      );
      setIfChanged("postcode", editingHotel.zipcode ?? null, "postcode");
      setIfChanged(
        "is_self_contained",
        editingHotel.is_self_contained ?? false,
        "is_self_contained"
      );
      setIfChanged(
        "total_floors",
        Number(editingHotel.total_floors ?? 0),
        "total_floors"
      );

      if (typeof editingHotel.rating !== "undefined") {
        const ratingVal =
          editingHotel.rating === ""
            ? null
            : Number.isFinite(Number(editingHotel.rating))
              ? Number(editingHotel.rating)
              : editingHotel.rating;
        setIfChanged("rating", ratingVal, "rating");
      }

      if (editingHotel.allowed_users) {
        payload.allowed_users = editingHotel.allowed_users;
      }

      if (user?.role === "admin") {
        const origManagerName =
          original.manager_name || original.manager || null;
        if ((editingHotel.manager_name || "") !== (origManagerName || "")) {
          payload.manager = editingHotel.manager_name || null;
        }
        setIfChanged(
          "manager_email",
          editingHotel.manager_email ?? null,
          "manager_email"
        );
        setIfChanged(
          "manager_phone",
          editingHotel.manager_phone ?? null,
          "manager_phone"
        );
      }

      if (Object.keys(payload).length > 0) {
        await axios.put(`/api/hotels/${editingHotel.id}`, payload, {
          withCredentials: true,
        });
      }

      await fetchHotels();
      setEditingHotel(null);
    } catch (err) {
      console.error("save hotel error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save property";
      alert(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleAllowedUser = (userObj) => {
    if (!editingHotel) return;
    const id = userObj.id ?? userObj.email ?? userObj.name;
    const exists = (editingHotel.allowed_users || []).find((u) =>
      u.id ? String(u.id) === String(id) : u === id
    );
    let next;
    if (exists) {
      next = (editingHotel.allowed_users || []).filter((u) =>
        u.id ? String(u.id) !== String(id) : u !== id
      );
    } else {
      next = [
        ...(editingHotel.allowed_users || []),
        { id: userObj.id, name: userObj.name, email: userObj.email },
      ];
    }
    setEditingHotel({ ...editingHotel, allowed_users: next });
  };

  const confirmAccessSave = async () => {
    if (!editingHotel) return;
    setAccessSaving(true);
    setAccessMessage("");
    try {
      const allowed = (editingHotel.allowed_users || [])
        .map((u) => u.id)
        .filter(Boolean);
      await axios.put(`/api/hotels/${editingHotel.id}/access`, {
        allowedUserIds: allowed,
      });
      setAccessMessage("Access updated");
      await fetchHotels();
      await fetchAllowedUsersForHotel(editingHotel.id);
    } catch (err) {
      setAccessMessage(
        err?.response?.data?.message || "Failed to update access"
      );
    } finally {
      setAccessSaving(false);
      setTimeout(() => setAccessMessage(""), 3000);
    }
  };

  // Open the property details in "Full Page" mode
  const openDetails = (hotel) => {
    const property = {
      name: hotel.name || "Unnamed Property",
      address:
        hotel.address || `${hotel.city || ""} ${hotel.postcode || ""}`.trim(),
      tags: [
        hotel.property_type ||
        (hotel.is_self_contained ? "Self-Contained" : "Hotel"),
        (hotel.status || "").toLowerCase(),
      ].filter(Boolean),
      totalFloors: hotel.total_floors ?? hotel.floor_count ?? 0,
      totalRooms: hotel.total_rooms ?? hotel.rooms_count ?? 0,
      totalBedspaces: hotel.total_beds ?? hotel.total_bed ?? 0,
      occupiedBeds: hotel.occupied_beds ?? hotel.occupied ?? 0,
      _raw: hotel,
    };
    setDetailProperty(property);
    setShowDetail(true);
  };

  const closeDetails = () => {
    setShowDetail(false);
    setDetailProperty(null);
  };

  // --- RENDER ---

  // FULL PAGE DETAIL VIEW
  if (showDetail && detailProperty) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] font-sans text-[var(--text-primary)]">
        <div className="p-3 sm:p-4 md:p-6">
          {/* Header Row: Arrow Left, Admin Button Right */}
          <div className="flex items-center justify-between mb-0">
            <button
              onClick={closeDetails}
              className="w-10 h-10 flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full hover:bg-[var(--bg-primary)] hover:shadow-sm transition-all text-[var(--text-secondary)]"
              title="Back to Properties"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          </div>

          {/* REMOVED DUPLICATE CONTENT (Name/Address/Tags) HERE.
 Your PropertyDetails component (provided in the prompt) 
 already has Breadcrumbs, Title, Address, and Tags.
 So we just render the component below.
 */}

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <PropertyDetails property={detailProperty} />
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW (Default) ---
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Breadcrumbs
              items={[
                { label: 'Properties', path: '/admin/hotels' },
                { label: 'Property List' }
              ]}
            />
            <h1 className="text-3xl font-black text-[var(--text-primary)] mt-1">Properties Dashboard</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Manage your hotel and property portfolio</p>
          </div>

          {canCreateHotel && (
            <button
              onClick={() => {
                setErrorMsg("");
                setShowAdd(true);
              }}
              className="btn-primary rounded-xl"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Property
            </button>
          )}
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Properties */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-sm border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] font-medium">
                Total Properties
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">
                {totalCount}
              </div>
            </div>
          </div>

          {/* Hotel Style */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-sm border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30">
            <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] font-medium">
                Hotel Style
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">
                {hotelStyleCount}
              </div>
            </div>
          </div>

          {/* Self Contained */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-sm border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30">
            <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] font-medium">
                Self-Contained
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">
                {selfContainedCount}
              </div>
            </div>
          </div>

          {/* Fully Occupied */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-5 shadow-sm border border-[var(--border-color)] flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] font-medium">
                Fully Occupied
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] leading-none">
                {fullyOccupiedCount}
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH BAR & FILTERS */}
        {/* <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
 <div className="font-semibold text-lg text-slate-800 px-2">
 Property List
 </div>
 <div className="flex w-full sm:w-auto gap-3">
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
 className="rounded-xl w-full bg-transparent focus:ring-0 text-sm text-gray-700 placeholder-gray-400 outline-none"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>
 <select className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
 <option>All Types</option>
 <option>Hotel Style</option>

        <input
          type="text"
          placeholder="Search by name, room, or property..."
          className="rounded-xl w-full bg-transparent focus:ring-0 text-sm text-gray-700 placeholder-gray-400 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option>All Types</option>
        <option>Hotel Style</option>
        <option>Self-Contained</option>
      </select>
    </div>
  </div> */}

        <div className="bg-[var(--bg-surface)] rounded-xl shadow-lg border border-[var(--border-color)] mb-8 px-4 py-3 flex items-center gap-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30">
          {/* LEFT LABEL */}
          <span className="text-lg font-semibold text-[var(--text-primary)] whitespace-nowrap">
            Property List
          </span>

          {/* SEARCH INPUT */}
          <div className="flex-[8] md:flex-[10] min-w-[200px] flex items-center border border-[var(--border-color)] bg-[var(--bg-primary)] rounded-xl px-3 py-2 ">
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
              placeholder="Search properties..."
              className="rounded-xl w-full bg-transparent focus:ring-0 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* FILTER BUTTON */}
          <select className="border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl px-2 py-2 text-sm text-[var(--text-secondary)] focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 max-w-[140px]">
            <option>All Types</option>
            <option>Hotel Style</option>
            <option>Self-Contained</option>
          </select>
        </div>

        {/* PROPERTY CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full p-12 text-center text-gray-500">
              Loading properties...
            </div>
          ) : filteredHotels.length === 0 ? (
            <div className="col-span-full p-12 text-center text-gray-500">
              No properties found{search ? " for your search." : "."}
            </div>
          ) : (
            filteredHotels.map((h) => {
              const id = h.id ?? h._id ?? h.name;
              const isDeleting = deletingIds.has(h.id);
              const total = Number(h.total_beds ?? h.total_bed ?? 0);
              const occFromRooms = roomsOccupiedByHotel[String(h.id)] ?? roomsOccupiedByHotel[String(id)] ?? null;
              const occ = Number(occFromRooms ?? 0);
              const overcrowded = total > 0 && occ > total;
              const percent = total > 0 ? Math.min(100, Math.round((occ / total) * 100)) : 0;
              const typeName = h.property_type === "Hotel Style" ? "Hotel" : h.property_type || "Property";

              return (
                <div
                  key={id}
                  className={`bg-[var(--bg-surface)] rounded-xl p-5 shadow-sm border border-[var(--border-color)] relative group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/30 ${isDeleting ? 'hotels-list-card-deleting' : ''}`}
                >
                  {/* 3-DOT MENU (Top Right) */}
                  <div className="absolute top-4 right-4 card-menu z-10">
                    <button
                      onClick={(e) => toggleMenu(id, e)}
                      className="w-8 h-8 rounded-full bg-[var(--bg-primary)] hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] flex items-center justify-center transition-colors border border-[var(--border-color)]"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>

                    {openMenuId === id && (
                      <div
                        className="mt-2 w-40 bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-color)] py-1 right-0 absolute z-50 animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEditModal(h)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[var(--hover-bg)] text-sm text-[var(--text-primary)] transition-colors"
                        >
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/hotels/${h.id}/rooms`);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[var(--hover-bg)] text-sm text-[var(--text-primary)] transition-colors"
                        >
                          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                          Manage Rooms
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Icon Header */}
                  <div className="flex flex-col items-center mt-2">
                    <div
                      className="
                w-15 h-15
                rounded-full
                bg-[var(--accent-primary)]
                flex items-center justify-center
                text-white
                shadow-lg shadow-[var(--accent-primary)]/30
                mb-4
              "
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>

                    <h3 className="text-lg font-bold text-[var(--text-primary)] text-center px-2 truncate w-full">
                      {h.name || "Unnamed"}
                    </h3>

                    <span className="mt-2 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      {typeName}
                    </span>

                    <div className="flex items-center gap-1 text-[var(--text-secondary)] text-xs mt-3 mb-4">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate max-w-[180px] font-medium">{h.address || h.city || "No Address"}</span>
                    </div>
                  </div>

                  {/* Capacity & Occupancy */}
                  <div className="mt-2 mb-6 space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium text-[var(--text-secondary)]">
                      <span>Capacity:</span>
                      <span className="text-[var(--text-primary)]">
                        {occ}/{total}
                        {overcrowded && <span className="text-red-600 text-xs font-bold ml-1">(Overcrowded)</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
                      <span>Occupancy</span>
                      <span className={`${overcrowded ? "text-red-600" : "text-green-600"} font-bold`}>{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${overcrowded ? "bg-red-500" : "bg-green-500"} rounded-full `}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex gap-3">
                    <button onClick={() => openDetails(h)} className="btn-secondary btn-sm flex-1 rounded-xl">
                      View Details
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(h.id);
                      }}
                      className="btn-secondary btn-sm w-10 !px-0 bg-[var(--bg-surface)] hover:!bg-red-500 hover:!text-white hover:!border-red-500 rounded-xl transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Property Modal */}
        {showAdd && createPortal(
          <div className="modal-overlay">
            <div className="modal-container h-[70vh]">
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Add New Property</h2>
                  <p className="modal-subtitle">
                    Create a new property in the system. Fill in all required fields.
                  </p>
                </div>

                <button
                  onClick={() => setShowAdd(false)}
                  className="modal-close-btn rounded-xl"
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                {errorMsg && (
                  <div className="text-red-700 bg-red-50 p-2 rounded-xl">
                    {errorMsg}
                  </div>
                )}

                <form id="addPropertyForm" onSubmit={handleCreate} className="form-section">
                  <div className="form-group">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                      Property Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                      placeholder="Riverside Hotel"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Property Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.property_type}
                        onChange={(e) => setForm({ ...form, property_type: e.target.value })
                        }
                        required
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                      >
                        <option value="Hotel Style">Hotel Style</option>
                        <option value="Self-Contained">Self-Contained</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })
                        }
                        required
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })
                      }
                      required
                      className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                      placeholder="123 River Road"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })
                        }
                        required
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                        placeholder="Manchester"
                      />
                    </div>
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Postcode <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.postcode}
                        onChange={(e) => setForm({ ...form, postcode: e.target.value })
                        }
                        required
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                        placeholder="M1 2AB"
                      />
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Total Beds <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.total_beds}
                        onChange={(e) => setForm({ ...form, total_beds: Number(e.target.value) })
                        }
                        required
                        min={1}
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                      />
                    </div>
                    <input type="hidden" value={form.occupied_beds} readOnly className="rounded-xl" />
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Total Floors <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.total_floors}
                        onChange={(e) => setForm({
                          ...form,
                          total_floors: Number(e.target.value),
                        })
                        }
                        required
                        min={1}
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Manager Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={form.manager_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const manager = managersList.find(m => m.name === val);
                            setForm({
                              ...form,
                              manager_name: val,
                              manager_email: manager?.email || form.manager_email,
                              manager_phone: manager?.phone || form.manager_phone
                            });
                          }}
                          required={user?.role !== "manager"}
                          className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all appearance-none"
                        >
                          <option value="">Select Manager</option>
                          {managersList.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-secondary)]">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                        Manager Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.manager_phone}
                        onChange={(e) => setForm({ ...form, manager_phone: e.target.value })
                        }
                        required={user?.role !== "manager"}
                        className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                        placeholder="07700 900000"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                      Manager Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.manager_email}
                      onChange={(e) => setForm({ ...form, manager_email: e.target.value })
                      }
                      className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm opacity-60 cursor-not-allowed focus:outline-none"
                      placeholder="manager@example.com"
                      required={user?.role !== "manager"}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                      About <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={form.about}
                      onChange={(e) => setForm({ ...form, about: e.target.value })
                      }
                      required
                      className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all resize-none placeholder-[var(--text-secondary)]/30"
                      rows={3}
                      placeholder="Short description"
                    />
                  </div>

                </form>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="btn-secondary rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="addPropertyForm"
                  disabled={creating}
                  className="rounded-xl btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Submit"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Modal (UNCHANGED) */}
        {editingHotel && createPortal(
          <div className="modal-overlay">
            <div ref={modalRef} className="modal-container h-[70vh]">
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Edit Property</h2>
                  <p className="modal-subtitle">Update property information</p>
                </div>
                <button
                  onClick={() => setEditingHotel(null)}
                  className="modal-close-btn rounded-xl"
                >
                  ✕
                </button>
              </div>

              <div className="modal-content">
                <div className="flex gap-6 border-b border-[var(--border-color)] px-6">
                  <button
                    onClick={() => setEditTab("basic")}
                    className={`py-4 text-xs font-mono uppercase tracking-widest transition-all ${editTab === "basic"
                      ? "border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                  >
                    Basic Info
                  </button>
                  <button
                    onClick={() => setEditTab("address")}
                    className={`py-4 text-xs font-mono uppercase tracking-widest transition-all ${editTab === "address"
                      ? "border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                  >
                    Address
                  </button>
                  <button
                    onClick={() => {
                      setEditTab("access");
                      fetchStaffForHotel(editingHotel);
                      fetchAllowedUsersForHotel(editingHotel.id);
                    }}
                    className={`py-4 text-xs font-mono uppercase tracking-widest transition-all ${editTab === "access"
                      ? "border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                  >
                    Access
                  </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                  {editTab === "basic" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                          Property Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          value={editingHotel.name}
                          onChange={(e) => handleEditChange("name", e.target.value)
                          }
                          className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Property Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={editingHotel.property_type || "Hotel Style"}
                            onChange={(e) => handleEditChange("property_type", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all appearance-none"
                          >
                            <option>Hotel Style</option>
                            <option>Self-Contained</option>
                            <option>Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Status <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={editingHotel.status ?? "Active"}
                            onChange={(e) => handleEditChange("status", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all appearance-none"
                          >
                            <option>Active</option>
                            <option>Inactive</option>
                            <option>Pending</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Total Beds <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={editingHotel.total_beds ?? 0}
                            onChange={(e) => handleEditChange(
                              "total_beds",
                              Number(e.target.value)
                            )
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                          />
                        </div>

                        <input type="hidden" value={editingHotel.occupied_beds ?? 0} readOnly className="rounded-xl" />

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Total Floors <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={editingHotel.total_floors ?? 0}
                            onChange={(e) => handleEditChange(
                              "total_floors",
                              Number(e.target.value)
                            )
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Manager Name <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={editingHotel.manager_name || ""}
                            onChange={(e) => {
                              const selectedName = e.target.value;
                              const selectedManager = managersList.find(m => m.name === selectedName);
                              handleEditChange("manager_name", selectedName);
                              if (selectedManager?.email) {
                                handleEditChange("manager_email", selectedManager.email);
                              }
                            }}
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all appearance-none"
                          >
                            <option value="">Select Manager</option>
                            {managersList.map((manager) => (
                              <option key={manager.id} value={manager.name}>
                                {manager.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Manager Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            value={editingHotel.manager_email}
                            onChange={(e) => handleEditChange("manager_email", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          value={editingHotel.phone}
                          onChange={(e) => handleEditChange("phone", e.target.value)
                          }
                          className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Review <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            required
                            value={editingHotel.rating}
                            onChange={(e) => handleEditChange("rating", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            About <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            required
                            value={editingHotel.about}
                            onChange={(e) => handleEditChange("about", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all resize-none placeholder-[var(--text-secondary)]/30"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {editTab === "address" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          value={editingHotel.address_line}
                          onChange={(e) => handleEditChange("address_line", e.target.value)
                          }
                          className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                          placeholder="Street, building, etc."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Country <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            value={editingHotel.country}
                            onChange={(e) => handleEditChange("country", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            State <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            value={editingHotel.state}
                            onChange={(e) => handleEditChange("state", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            City <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            value={editingHotel.city}
                            onChange={(e) => handleEditChange("city", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Zipcode <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            value={editingHotel.zipcode}
                            onChange={(e) => handleEditChange("zipcode", e.target.value)
                            }
                            className="w-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all placeholder-[var(--text-secondary)]/30"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {editTab === "access" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Visibility
                        </label>
                        <div className="flex items-center gap-6 text-[var(--text-primary)]">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="visibility"
                              checked={editingHotel.visibility === "public"}
                              onChange={() => handleEditChange("visibility", "public")
                              }
                              className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/20 border-[var(--border-color)]" />
                            <span>Public</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="visibility"
                              checked={editingHotel.visibility === "private"}
                              onChange={() => handleEditChange("visibility", "private")
                              }
                              className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/20 border-[var(--border-color)]" />
                            <span>Private</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="visibility"
                              checked={editingHotel.visibility === "select"}
                              onChange={() => handleEditChange("visibility", "select")
                              }
                              className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]/20 border-[var(--border-color)]" />
                            <span>Select People</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="space-y-3">
                          {loadingStaff ? (
                            <div className="text-sm text-gray-500">
                              Loading users...
                            </div>
                          ) : (accessStaffList || []).length === 0 ? (
                            <div className="text-sm text-gray-500">
                              No users available to select.
                            </div>
                          ) : (
                            accessStaffList.slice(0, 200).map((u, idx) => {
                              const uid = u.id ?? `${u.email || u.name}_${idx}`;
                              const selected = !!(
                                editingHotel.allowed_users || []
                              ).find((au) => String(au.id) === String(uid));
                              return (
                                <label
                                  key={uid}
                                  className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl p-2 border border-[var(--border-color)] hover:border-[var(--accent-primary)]/30 transition-all cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleAllowedUser(u)}
                                    className="rounded-xl text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex items-center gap-3">
                                    {u.avatar ? (
                                      <img
                                        src={u.avatar}
                                        className="w-8 h-8 rounded-full object-cover"
                                        alt={u.name}
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                        {(u.name || u.email || "U").charAt(0)}
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-[var(--text-primary)]">
                                        {u.name || u.email || `User ${idx + 1}`}
                                      </div>
                                      {u.email && (
                                        <div className="text-xs text-[var(--text-secondary)] opacity-70">
                                          {u.email}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>

                        <div className="pt-4 text-center">
                          <button
                            onClick={confirmAccessSave}
                            disabled={accessSaving}
                            className="px-4 py-2 bg-slate-900 text-white bg-teal-400
 hover:bg-teal-500
 active:bg-teal-600 disabled:bg-teal-300
 disabled:cursor-not-allowed rounded-xl text-sm hover:bg-slate-800"
                          >
                            {accessSaving
                              ? "Saving..."
                              : "Confirm Access Updates"}
                          </button>
                          {accessMessage && (
                            <div className="mt-2 text-sm text-green-600">
                              {accessMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingHotel(null)}
                  className="btn-secondary rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="rounded-xl btn-primary disabled:bg-teal-300 disabled:cursor-not-allowed"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body
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

        <div className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Property Manager
        </div>
      </div>
    </div >
  );
}