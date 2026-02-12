/* eslint-disable no-unused-vars */
// src/pages/ServiceUsersList.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { usePermissions } from "../hooks/usePermissions";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";

/**
 * Build a list of candidate API bases.
 */
const buildCandidateBases = () => {
  const list = [];

  // Priority 1: Environment variable
  if (import.meta.env.VITE_API_URL) list.push(import.meta.env.VITE_API_URL);

  if (typeof window !== "undefined") {
    const { origin, hostname, protocol } = window.location;

    // Priority 2: Same-origin API (for production deployments)
    list.push(`${origin}/api`);

    // Priority 3: Common development ports
    const ports = [4000, 4001, 4002, 4003, 4004, 4005, 5000, 8000, 8080, 3000];
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

export default function ServiceUsersList({ user, openAddModal = false }) {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const apiRef = useRef(createApi(candidateBases[0]));
  const [apiBase, setApiBase] = useState(candidateBases[0]);

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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
  const [formData, setFormData] = useState(initialFormState);

  const BASE_EXPORT_COLUMNS = useMemo(
    () => [
      { header: 'First Name', key: 'first_name' },
      { header: 'Last Name', key: 'last_name' },
      { header: 'Property', key: 'property' },
      { header: 'Room', key: 'room_number' },
      { header: 'Move-in Date', key: 'admission_date' },
      { header: 'Status', key: 'status' },
      { header: 'DOB', key: 'date_of_birth' },
      { header: 'Nationality', key: 'nationality' },
      { header: 'Gender', key: 'gender' },
      { header: 'Immigration Status', key: 'immigration_status' },
      { header: 'HO Reference', key: 'home_office_reference' },
    ],
    []
  );

  const exportColumns = useMemo(() => BASE_EXPORT_COLUMNS, [BASE_EXPORT_COLUMNS]);

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

  const normalizeServiceUserExportRow = (u) => {
    const property = u.property || u.hotel_name || u.property_name || 'No Property';
    const dob = u.date_of_birth || u.dob || '';
    return {
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      property,
      room_number: u.room_number || '',
      admission_date: u.admission_date || '',
      status: u.status || '',
      date_of_birth: dob || '',
      nationality: u.nationality || '',
      gender: u.gender || '',
      immigration_status: u.immigration_status || '',
      home_office_reference: u.home_office_reference || '',
    };
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

      const data = (filteredUsers || []).map(normalizeServiceUserExportRow);

      if (exportFormat === 'pdf') {
        generatePDF(data, columns, 'Service Users Report', 'service-users-report');
      } else if (exportFormat === 'csv') {
        generateCSV(data, columns, 'service-users-report');
      }

      closeExport();
    } catch (error) {
      console.error('Error exporting service users:', error);
      alert('Failed to download: ' + error.message);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const resolveApiBase = async () => {
      let lastError = null;
      for (const base of candidateBases) {
        try {
          await axios.get(`${base}/health`, {
            timeout: 1500,
            withCredentials: true,
          });
          if (cancelled) return null;
          apiRef.current = createApi(base);
          setApiBase(base);
          return base;
        } catch (err) {
          lastError = err;
        }
      }
      console.warn(
        "No API base responded to /health",
        lastError?.message || lastError
      );
      return null;
    };

    const init = async () => {
      await resolveApiBase();
      if (cancelled) return;
      fetchUsers();
      fetchHotels();
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (openAddModal && canCreateSU) {
      resetForm();
      setIsModalOpen(true);
    }
  }, [openAddModal, canCreateSU]);

  // Hide sidebar and navbar when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [isModalOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiRef.current.get("/su/users");
      let usersList = [];
      if (Array.isArray(res.data)) {
        usersList = res.data;
      } else if (Array.isArray(res.data?.users)) {
        usersList = res.data.users;
      } else if (Array.isArray(res.data?.data)) {
        usersList = res.data.data;
      }
      setUsers(usersList);
      calculateStats(usersList);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHotels = async () => {
    try {
      const res = await apiRef.current.get("/hotels");
      let raw = res.data;
      let list = [];

      if (Array.isArray(raw)) list = raw;
      else if (Array.isArray(raw?.data)) list = raw.data;
      else if (Array.isArray(raw?.hotels)) list = raw.hotels;
      else if (Array.isArray(raw?.rows)) list = raw.rows;

      list = (list || []).filter(
        (h) =>
          h &&
          (h.id !== undefined || h.hotel_id !== undefined) &&
          (h.name || h.hotel_name || h.property_name)
      );

      const normalised = list.map((h) => ({
        ...h,
        id: h.id ?? h.hotel_id,
        _displayName: h.name ?? h.hotel_name ?? h.property_name,
      }));

      setHotels(normalised);
    } catch (err) {
      console.error("Error fetching hotels:", err);
    }
  };

  const fetchRooms = async (hotelId) => {
    if (!hotelId) {
      setRooms([]);
      return;
    }
    try {
      const res = await apiRef.current.get(`/su/rooms/${hotelId}`);
      let roomsList = [];

      if (Array.isArray(res.data)) roomsList = res.data;
      else if (Array.isArray(res.data?.rooms)) roomsList = res.data.rooms;
      else if (Array.isArray(res.data?.data)) roomsList = res.data.data;

      roomsList.sort((a, b) => {
        const numA = parseInt(a.room_number, 10) || 0;
        const numB = parseInt(b.room_number, 10) || 0;
        return numA - numB;
      });

      setRooms(roomsList);
      return roomsList;
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setRooms([]);
      return [];
    }
  };

  const calculateStats = (data) => {
    setStats({
      total: data.length,
      active: data.filter((u) => u.status === "Active").length || 0,
      attention: Math.floor(data.length * 0.1),
      movedOut: data.filter((u) => u.status === "Moved Out").length || 0,
    });
  };

  const handleEditUser = async (user) => {
    if (!canUpdateSU) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: 'You do not have permission to update service users.',
        type: 'warning'
      });
      return;
    }
    try {
      const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        return date.toISOString().split("T")[0];
      };

      const admissionDate = formatDateForInput(user.admission_date);

      const userData = {
        ...user,
        date_of_birth: formatDateForInput(user.date_of_birth || user.dob),
        dob: formatDateForInput(user.dob || user.date_of_birth),
        admission_date: admissionDate,
        hotel_id: String(user.hotel_id || user.property_id || ""),
        room_id: String(user.room_id || ""),
        room_number: user.room_number || "",
        number_of_dependents: user.number_of_dependents ?? "",
        vulnerabilities: Array.isArray(user.vulnerabilities)
          ? user.vulnerabilities.join(", ")
          : user.vulnerabilities || "",
        medical_conditions: Array.isArray(user.medical_conditions)
          ? user.medical_conditions.join(", ")
          : user.medical_conditions || "",
        dietary_requirements: Array.isArray(user.dietary_requirements)
          ? user.dietary_requirements.join(", ")
          : user.dietary_requirements || "",
      };

      setFormData(userData);
      setIsModalOpen(true);

      if (userData.hotel_id) {
        const roomsList = await fetchRooms(userData.hotel_id);
        if ((!userData.room_id || String(userData.room_id).trim() === "") && userData.room_number) {
          const match = (roomsList || []).find(
            (r) => String(r.room_number) === String(userData.room_number)
          );
          if (match?.id) {
            setFormData((prev) => ({ ...prev, room_id: String(match.id) }));
          }
        }
      }
    } catch (error) {
      console.error("Error preparing user data for edit:", error);
      setAlertDialog({
        isOpen: true,
        title: 'Load Error',
        message: 'Error loading user data for editing',
        type: 'error'
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!canDeleteSU) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: 'You do not have permission to delete service users.',
        type: 'warning'
      });
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          const response = await apiRef.current.delete(`/su/users/${userId}`);
          if (response.status === 200 || response.status === 204) {
            const updatedUsers = users.filter((user) => user.id !== userId);
            setUsers(updatedUsers);
            calculateStats(updatedUsers);
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            setAlertDialog({
              isOpen: true,
              title: 'Success',
              message: 'User deleted successfully.',
              type: 'success'
            });
          } else {
            throw new Error("Failed to delete user");
          }
        } catch (error) {
          console.error("Error deleting user:", error);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: error.response?.data?.error || "Failed to delete user",
            type: 'error'
          });
        }
      }
    });
  };

  const handleDeleteUserConfirm = async () => {
    if (!canDeleteSU) {
      setAlertDialog({
        isOpen: true,
        title: 'Permission Denied',
        message: 'You do not have permission to delete service users.',
        type: 'warning'
      });
      setShowDeleteModal(false);
      setDeleteUserId(null);
      return;
    }
    if (!deleteUserId) return;

    try {
      setDeleting(true);

      const response = await apiRef.current.delete(
        `/su/users/${deleteUserId}`
      );

      if (response.status === 200 || response.status === 204) {
        const updatedUsers = users.filter(
          (user) => user.id !== deleteUserId
        );

        setUsers(updatedUsers);
        calculateStats(updatedUsers);
      } else {
        throw new Error("Failed to delete user");
      }

      setShowDeleteModal(false);
      setDeleteUserId(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      setAlertDialog({
        isOpen: true,
        title: 'Delete Failed',
        message: error.response?.data?.error || "Failed to delete user",
        type: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };


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
        number_of_dependents: formData.number_of_dependents
          ? parseInt(formData.number_of_dependents, 10)
          : null,
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

      Object.keys(payload).forEach((key) => {
        if (key === "family_type" && !payload[key]) {
          delete payload[key];
          return;
        }
        if (
          payload[key] === null ||
          payload[key] === undefined ||
          payload[key] === ""
        ) {
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

  const filteredUsers = users.filter((user) => {
    if (!search || !search.trim()) return true; // Show all if search is empty

    const term = search.toLowerCase().trim();
    const fullName = `${user.first_name || ""} ${user.last_name || ""
      }`.toLowerCase();
    const room = (user.room_number || "").toLowerCase();
    const property = (
      user.property ||
      user.hotel_name ||
      user.property_name ||
      ""
    ).toLowerCase();
    const nationality = (user.nationality || "").toLowerCase();
    const homeOfficeRef = (user.home_office_reference || "").toLowerCase();
    const gender = (user.gender || "").toLowerCase();
    const status = (user.status || "").toLowerCase();

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

  const resetForm = () => {
    setFormData({
      ...initialFormState,
      id: null,
    });
    setRooms([]);
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Service Users</h1>
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
            <span>&gt;</span> <span>Service Users</span> <span>&gt;</span>
            <span className="text-slate-900 font-medium">User List</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <DownloadDropdown
              onDownloadPDF={() => openExport('pdf')}
              onDownloadCSV={() => openExport('csv')}
            />
            {canCreateSU && (
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="
        flex items-center gap-2
        bg-teal-400
        hover:bg-teal-500
        active:bg-teal-600
        text-white
        px-5 py-2.5
        rounded-lg
        text-sm font-semibold
        transition-colors
        shadow-sm
      "
            >
              <span className="text-lg leading-none">+</span>
              Add Service User
            </button>
            )}
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

        {/* FILTER BUTTON */}
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
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
      </div>

      {/* GRID */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No users found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredUsers.map((user, index) => {
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

            return (
              <div
                key={user.id || `${user.first_name}-${index}`}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-start gap-4 hover:shadow-md transition-shadow"
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
                      onClick={() =>
                        user.id && navigate(`/su/users/${user.id}`)
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.75 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
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
                      className="flex items-center gap-1.5 px-3.5 py-1.75 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
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
                        if (!canDeleteSU) {
                          setAlertDialog({
                            isOpen: true,
                            title: 'Permission Denied',
                            message: 'You do not have permission to delete service users.',
                            type: 'warning'
                          });
                          return;
                        }
                        setDeleteUserId(user.id);
                        setShowDeleteModal(true);
                      }}
                      disabled={!canDeleteSU}
                      className="flex items-center gap-1.5 px-3.5 py-1.75 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors"
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
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50"
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
                        className="w-4 h-4 text-teal-600 rounded"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runExport}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {formData.id ? "Edit Service User" : "Add Service User"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {formData.id
                    ? "Update the service user record."
                    : "Create a new service user record."}{" "}
                  All fields marked with * are required.
                </p>
              </div>
              <button
                onClick={closeModalAndReset}
                className="text-gray-400 hover:text-gray-600"
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

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <form
                id="service-user-form"
                onSubmit={handleSubmitUser}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      required
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      required
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality *
                    </label>
                    <input
                      type="text"
                      required
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Office Reference *
                  </label>
                  <input
                    type="text"
                    required
                    name="home_office_reference"
                    value={formData.home_office_reference}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender || ""}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none bg-white"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Immigration Status
                    </label>
                    <select
                      name="immigration_status"
                      value={formData.immigration_status || ""}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none bg-white"
                    >
                      <option value="">Select status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Refused">Refused</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Property
                    </label>
                    <select
                      name="hotel_id"
                      value={formData.hotel_id}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none bg-white"
                    >
                      <option value="">Select property</option>
                      {hotels.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h._displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room
                    </label>
                    <select
                      name="room_id"
                      value={formData.room_id}
                      onChange={handleFormChange}
                      disabled={!formData.hotel_id}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Dependents
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="number_of_dependents"
                      value={
                        formData.number_of_dependents === null ||
                          formData.number_of_dependents === undefined
                          ? ""
                          : formData.number_of_dependents
                      }
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      value={formData.emergency_contact_name ?? ""}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      value={formData.emergency_contact_phone ?? ""}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Move-in Date
                    </label>
                    <input
                      type="date"
                      name="admission_date"
                      value={formData.admission_date || ""}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vulnerabilities
                  </label>
                  <input
                    type="text"
                    name="vulnerabilities"
                    value={formData.vulnerabilities ?? ""}
                    onChange={handleFormChange}
                    placeholder="Separate multiple items with commas"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medical Conditions
                  </label>
                  <textarea
                    name="medical_conditions"
                    value={formData.medical_conditions || ""}
                    onChange={handleFormChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dietary Requirements
                  </label>
                  <textarea
                    name="dietary_requirements"
                    value={formData.dietary_requirements || ""}
                    onChange={handleFormChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    required
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300  outline-none bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Moved Out">Moved Out</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={closeModalAndReset}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="service-user-form"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete User?
            </h3>

            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. The user will be permanently removed.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteUserId(null);
                }}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteUserConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-md bg-teal-400 hover:bg-teal-500 text-white font-medium disabled:opacity-50"
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
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
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