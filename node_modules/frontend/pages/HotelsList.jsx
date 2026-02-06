/* eslint-disable no-unused-vars */
// src/pages/HotelsList.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate, useOutletContext } from "react-router-dom";
// This imports the component code you provided in your prompt
import PropertyDetails from "./PropertyDetailsComponent";

export default function HotelsList({ user: userProp }) {
  const context = useOutletContext();
  const user = userProp || context?.user || {};
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  const [hotels, setHotels] = useState([]);
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

  /* Delete Modal */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteHotelId, setDeleteHotelId] = useState(null);
  const [deleting, setDeleting] = useState(false);


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
    const shouldHide = Boolean(showAdd || editingHotel);
    if (shouldHide) {
      document.body.classList.add("form-modal-open");
    } else {
      document.body.classList.remove("form-modal-open");
    }
    return () => {
      document.body.classList.remove("form-modal-open");
    };
  }, [showAdd, editingHotel]);

  axios.defaults.withCredentials = true;

  // --- FETCH HOTELS ---
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
    let cancelled = false;
    const ids = (hotels || [])
      .map((h) => h?.id)
      .filter((id) => id !== undefined && id !== null);

    const missing = ids.filter((id) => roomsOccupiedCacheRef.current[String(id)] === undefined);
    if (missing.length === 0) return;

    const load = async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (id) => {
            try {
              const res = await axios.get(`/api/hotels/${id}/rooms`, { withCredentials: true });
              const rooms = Array.isArray(res.data?.rooms)
                ? res.data.rooms
                : Array.isArray(res.data)
                  ? res.data
                  : [];

              const occupied = rooms.reduce((sum, r) => {
                const n = Number(r?.bedspaces ?? r?.bedspace ?? r?.beds ?? 0);
                return sum + (Number.isFinite(n) ? n : 0);
              }, 0);

              return [String(id), occupied];
            } catch {
              return [String(id), null];
            }
          })
        );

        if (cancelled) return;
        const next = { ...roomsOccupiedCacheRef.current };
        for (const [id, v] of entries) next[id] = v;
        roomsOccupiedCacheRef.current = next;
        setRoomsOccupiedByHotel(next);
      } catch {
        // ignore; fallback behavior will apply
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [hotels]);

  useEffect(() => {
    const onFocus = () => {
      fetchHotels();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchHotels();
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

  // --- CREATE PROPERTY ---
  const handleCreate = async (e) => {
    e?.preventDefault();
    setErrorMsg("");
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
    if (!confirm("Delete property?")) return;
    try {
      await axios.delete(`/api/hotels/${id}`, { withCredentials: true });
      fetchHotels();
    } catch (err) {
      console.error("delete property:", err);
      alert(err?.response?.data?.message || "Failed to delete property");
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteHotelId) return;

    try {
      setDeleting(true);

      await axios.delete(`/api/hotels/${deleteHotelId}`, {
        withCredentials: true,
      });

      await fetchHotels();
    } catch (err) {
      console.error("delete property:", err);
      alert(err?.response?.data?.message || "Failed to delete property");
    } finally {
      setDeleting(false);
      setOpenMenuId(null);
      setShowDeleteModal(false);
      setDeleteHotelId(null);
    }
  };


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
      const normalized = (Array.isArray(list) ? list : []).map((u) => ({
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
      <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
        <div className="max-w-8xl mx-auto p-6">
          {/* Header Row: Arrow Left, Admin Button Right */}
          <div className="flex items-center justify-between mb-0">
            <button
              onClick={closeDetails}
              className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:shadow-sm transition-all text-gray-500"
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
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-800">
      <div className="max-w-8xl mx-auto">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Properties</h1>
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
              <span>&gt;</span> <span>Properties</span> <span>&gt;</span>
              <span className="text-slate-900 font-medium">Property List</span>
            </div>
          </div>

          {canCreateHotel && (
            <button
              onClick={() => {
                setErrorMsg("");
                setShowAdd(true);
              }}
              className="
    inline-flex items-center gap-2
    px-5 py-2.5
    bg-teal-400
    hover:bg-teal-500
    active:bg-teal-600
    text-white
    rounded-lg
    shadow-sm
    transition-colors
  "
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
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
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
              <div className="text-sm text-gray-500 font-medium">
                Total Properties
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {totalCount}
              </div>
            </div>
          </div>

          {/* Hotel Style */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
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
              <div className="text-sm text-gray-500 font-medium">
                Hotel Style
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {hotelStyleCount}
              </div>
            </div>
          </div>

          {/* Self Contained */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
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
              <div className="text-sm text-gray-500 font-medium">
                Self-Contained
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {selfContainedCount}
              </div>
            </div>
          </div>

          {/* Fully Occupied */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-600">
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
              <div className="text-sm text-gray-500 font-medium">
                Fully Occupied
              </div>
              <div className="text-2xl font-bold text-slate-900">
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
            <div className="flex-1 flex items-center border border-gray-200 bg-gray-50 rounded-lg px-3 py-2">
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
                className="w-full bg-transparent focus:ring-0 text-sm text-gray-700 placeholder-gray-400 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>All Types</option>
              <option>Hotel Style</option>
              <option>Self-Contained</option>
            </select>
          </div>
        </div> */}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8 px-4 py-3 flex items-center gap-4">
          {/* LEFT LABEL */}
          <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
            Property List
          </span>

          {/* SEARCH INPUT */}
          <div className="flex-1 flex items-center border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 ">
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
              className="w-full bg-transparent focus:ring-0 text-sm text-gray-700 placeholder-gray-400 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* FILTER BUTTON */}
          <select className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300">
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
              // Calculate Occupancy for UI
              const total = Number(h.total_beds ?? h.total_bed ?? 0);
              const occFromRooms = roomsOccupiedByHotel[String(h.id)] ?? roomsOccupiedByHotel[String(id)] ?? null;
              const occ = Number(occFromRooms ?? 0);
              const overcrowded = total > 0 && occ > total;
              const percent = total > 0 ? Math.min(100, Math.round((occ / total) * 100)) : 0;
              const typeName =
                h.property_type === "Hotel Style"
                  ? "Hotel"
                  : h.property_type || "Property";

              return (
                <div
                  key={id}
                  className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 relative group hover:shadow-2xl hover:-translate-y-1 transition-all duration-200"
                >
                  {/* 3-DOT MENU (Top Right) */}
                  <div className="absolute top-4 right-4 card-menu z-10">
                    <button
                      onClick={(e) => toggleMenu(id, e)}
                      className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>

                    {openMenuId === id && (
                      <div
                        className="mt-2 w-40 bg-white rounded-lg shadow-xl border py-1 right-0 absolute z-50 animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEditModal(h)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-50 text-sm text-gray-700"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                          className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-50 text-sm text-gray-700"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
  bg-violet-500
  flex items-center justify-center
  text-white
  shadow-lg shadow-violet-300/50
  mb-4
"
                    >
                      {/* Building Icon */}
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 text-center px-2 truncate w-full">
                      {h.name || "Unnamed"}
                    </h3>

                    <span className="mt-2 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      {typeName}
                    </span>

                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-3 mb-4">
                      <svg
                        className="w-3 h-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                      <span className="truncate max-w-[180px]">
                        {h.address || h.city || "No Address"}
                      </span>
                    </div>
                  </div>

                  {/* Capacity & Occupancy */}
                  <div className="mt-2 mb-6 space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium text-gray-600">
                      <span>Capacity:</span>
                      <span className="text-slate-900">
                        {occ}/{total}
                        {overcrowded && <span className="text-red-600 text-xs font-bold ml-1">(Overcrowded)</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Occupancy</span>
                      <span className={`${overcrowded ? "text-red-600" : "text-green-600"} font-bold`}>
                        {percent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${overcrowded ? "bg-red-500" : "bg-green-500"} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => openDetails(h)}
                      className="flex-1 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-slate-700 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      View Details
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                        setDeleteHotelId(h.id);
                        setShowDeleteModal(true);
                      }}
                      className="w-10 flex items-center justify-center
             bg-white border border-gray-200
             hover:border-red-200 hover:bg-red-50
             text-gray-400 hover:text-red-500
             rounded-lg transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden h-[75vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-gray-100">
              <div className="flex items-start justify-between p-5">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Add New Property
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create a new property in the system. Fill in all required
                    fields.
                  </p>
                </div>

                <button
                  onClick={() => setShowAdd(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleCreate}
                className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar"
              >
                {errorMsg && (
                  <div className="text-red-700 bg-red-50 p-2 rounded">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-700 font-medium mb-1">
                    Property Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Riverside Hotel"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Property Type
                    </label>
                    <select
                      value={form.property_type}
                      onChange={(e) =>
                        setForm({ ...form, property_type: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    >
                      <option>Hotel Style</option>
                      <option>Self-Contained</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                      <option>Pending</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-medium mb-1">
                    Address
                  </label>
                  <input
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    placeholder="123 River Road"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      City
                    </label>
                    <input
                      value={form.city}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Manchester"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Postcode
                    </label>
                    <input
                      value={form.postcode}
                      onChange={(e) =>
                        setForm({ ...form, postcode: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                      placeholder="M1 2AB"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Total Beds
                    </label>
                    <input
                      type="number"
                      value={form.total_beds}
                      onChange={(e) =>
                        setForm({ ...form, total_beds: Number(e.target.value) })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <input type="hidden" value={form.occupied_beds} readOnly />
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Total Floors
                    </label>
                    <input
                      type="number"
                      value={form.total_floors}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          total_floors: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Manager Name
                    </label>
                    <input
                      value={form.manager_name}
                      onChange={(e) =>
                        setForm({ ...form, manager_name: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Manager Phone
                    </label>
                    <input
                      value={form.manager_phone}
                      onChange={(e) =>
                        setForm({ ...form, manager_phone: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                      placeholder="07700 900000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-medium mb-1">
                    Manager Email
                  </label>
                  <input
                    value={form.manager_email}
                    onChange={(e) =>
                      setForm({ ...form, manager_email: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    placeholder="manager@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-medium mb-1">
                    About (optional)
                  </label>
                  <textarea
                    value={form.about}
                    onChange={(e) =>
                      setForm({ ...form, about: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-200 p-2 h-24 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Short description"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="
    px-4 py-2
    rounded-lg
    bg-teal-400
    hover:bg-teal-500
    active:bg-teal-600
    text-white
    font-medium
    shadow-sm
    transition-colors
    disabled:bg-teal-300
    disabled:cursor-not-allowed
  "
                  >
                    {creating ? "Creating..." : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Modal (UNCHANGED) */}
        {editingHotel && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
            <div
              ref={modalRef}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden h-[75vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-gray-100"
            >
              <div className="flex items-center justify-between p-4">
                <h3 className="text-lg font-semibold">Edit Property</h3>
                <button
                  onClick={() => setEditingHotel(null)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 pt-4">
                <div className="flex gap-6 border-b">
                  <button
                    onClick={() => setEditTab("basic")}
                    className={`py-3 text-sm font-medium ${editTab === "basic"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Basic Information
                  </button>
                  <button
                    onClick={() => setEditTab("address")}
                    className={`py-3 text-sm font-medium ${editTab === "address"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
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
                    className={`py-3 text-sm font-medium ${editTab === "access"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Access
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                {editTab === "basic" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Property Name
                      </label>
                      <input
                        value={editingHotel.name}
                        onChange={(e) =>
                          handleEditChange("name", e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 "
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Property Type
                        </label>
                        <select
                          value={editingHotel.property_type || "Hotel Style"}
                          onChange={(e) =>
                            handleEditChange("property_type", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        >
                          <option>Hotel Style</option>
                          <option>Self-Contained</option>
                          <option>Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={editingHotel.status ?? "Active"}
                          onChange={(e) =>
                            handleEditChange("status", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        >
                          <option>Active</option>
                          <option>Inactive</option>
                          <option>Pending</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Total Beds
                        </label>
                        <input
                          type="number"
                          value={editingHotel.total_beds ?? 0}
                          onChange={(e) =>
                            handleEditChange(
                              "total_beds",
                              Number(e.target.value)
                            )
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      <input type="hidden" value={editingHotel.occupied_beds ?? 0} readOnly />

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Total Floors
                        </label>
                        <input
                          type="number"
                          value={editingHotel.total_floors ?? 0}
                          onChange={(e) =>
                            handleEditChange(
                              "total_floors",
                              Number(e.target.value)
                            )
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Manager Name
                        </label>
                        <select
                          value={editingHotel.manager_name || ""}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            const selectedManager = managersList.find(m => m.name === selectedName);
                            handleEditChange("manager_name", selectedName);
                            if (selectedManager?.email) {
                              handleEditChange("manager_email", selectedManager.email);
                            }
                          }}
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 bg-white"
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
                        <label className="block text-sm text-gray-700 mb-1">
                          Manager Email
                        </label>
                        <input
                          value={editingHotel.manager_email}
                          onChange={(e) =>
                            handleEditChange("manager_email", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        value={editingHotel.phone}
                        onChange={(e) =>
                          handleEditChange("phone", e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Review
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={editingHotel.rating}
                          onChange={(e) =>
                            handleEditChange("rating", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          About
                        </label>
                        <textarea
                          value={editingHotel.about}
                          onChange={(e) =>
                            handleEditChange("about", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 h-24 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editTab === "address" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Address
                      </label>
                      <input
                        value={editingHotel.address_line}
                        onChange={(e) =>
                          handleEditChange("address_line", e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        placeholder="Street, building, etc."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          value={editingHotel.country}
                          onChange={(e) =>
                            handleEditChange("country", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          State
                        </label>
                        <input
                          value={editingHotel.state}
                          onChange={(e) =>
                            handleEditChange("state", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          value={editingHotel.city}
                          onChange={(e) =>
                            handleEditChange("city", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Zipcode
                        </label>
                        <input
                          value={editingHotel.zipcode}
                          onChange={(e) =>
                            handleEditChange("zipcode", e.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
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
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="visibility"
                            checked={editingHotel.visibility === "public"}
                            onChange={() =>
                              handleEditChange("visibility", "public")
                            }
                          />
                          <span>Public</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="visibility"
                            checked={editingHotel.visibility === "private"}
                            onChange={() =>
                              handleEditChange("visibility", "private")
                            }
                          />
                          <span>Private</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="visibility"
                            checked={editingHotel.visibility === "select"}
                            onChange={() =>
                              handleEditChange("visibility", "select")
                            }
                          />
                          <span>Select People</span>
                        </label>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded p-4">
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
                                className="flex items-center gap-3 bg-white rounded p-2 border border-gray-100"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleAllowedUser(u)}
                                  className="rounded text-blue-600 focus:ring-blue-500"
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
                                    <div className="text-sm font-medium">
                                      {u.name || u.email || `User ${idx + 1}`}
                                    </div>
                                    {u.email && (
                                      <div className="text-xs text-gray-400">
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
                           disabled:cursor-not-allowed rounded text-sm hover:bg-slate-800"
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

              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => setEditingHotel(null)}
                  className="px-4 py-2 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="
    px-4 py-2
    rounded-lg
    bg-teal-400
    hover:bg-teal-500
    active:bg-teal-600
    text-white
    font-medium
    shadow-sm
    transition-colors
    disabled:bg-teal-300
    disabled:cursor-not-allowed
  "
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
              <p className="text-sm text-gray-500 mb-6">
                This action cannot be undone. This will permanently delete the
                user.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteHotelId(null);
                  }}
                  className="px-4 py-2 bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-white rounded-md"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Property Manager
        </div>
      </div>
    </div >
  );
}