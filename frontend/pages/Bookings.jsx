/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
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

export default function Bookings({ user }) {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Data States
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Mock Rooms Data
  const mockRooms = [
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

  // Filter States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'checked-in', 'arriving', 'late', 'pending'
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [sortBy, setSortBy] = useState('');

  // View States
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showColumnVisibility, setShowColumnVisibility] = useState(false);
  const viewRef = useRef(null);

  // Define all available columns
  const ALL_COLUMNS = [
    "checkbox",
    "name",
    "order_no",
    "room",
    "check_in",
    "day",
    "guests",
    "origin",
    "immigration_status",
    "status",
    "actions",
  ];

  // Column visibility state - all visible by default
  const [visibleColumns, setVisibleColumns] = useState(
    ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {})
  );

  // Form States
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    nationality: '',
    home_office_reference: '',
    property_id: '',
    room_id: '',
    check_in_date: '',
    vulnerabilities: '',
    medical_conditions: '',
    dietary_requirements: ''
  });

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

  const api = useMemo(() => axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
    timeout: 15000
  }), []);

  // Load properties first, then bookings
  useEffect(() => {
    const loadData = async () => {
      await loadProperties();
      await loadBookings();
    };
    loadData();
  }, []);

  // Hide modal styles
  useEffect(() => {
    if (showModal || showViewModal || showEditModal) {
      document.body.classList.add('form-modal-open');
    } else {
      document.body.classList.remove('form-modal-open');
    }
    return () => {
      document.body.classList.remove('form-modal-open');
    };
  }, [showModal, showViewModal, showEditModal]);

  // Close view menu on outside click
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

  const loadBookings = async () => {
    try {
      setLoadingBookings(true);

      // Fetch service users (bookings are service users)
      const suResponse = await api.get('/api/su/users');
      const serviceUsers = Array.isArray(suResponse.data?.users)
        ? suResponse.data.users
        : Array.isArray(suResponse.data)
          ? suResponse.data
          : [];

      // Fetch move-ins to get room and property associations
      let moveIns = [];
      try {
        const moveInsResponse = await api.get('/api/move-ins');
        moveIns = Array.isArray(moveInsResponse.data?.moveIns)
          ? moveInsResponse.data.moveIns
          : Array.isArray(moveInsResponse.data)
            ? moveInsResponse.data
            : [];
      } catch (err) {
      }

      // Fetch rooms to get room details
      let allRooms = mockRooms; // Use mock rooms as fallback
      try {
        const propertyIds = Array.from(
          new Set(
            serviceUsers
              .map((s) => s.property_id)
              .concat(moveIns.map((m) => m.property_id))
              .filter((v) => v !== null && v !== undefined && v !== "")
              .map((v) => String(v))
          )
        );

        const roomsMerged = [];
        for (const pid of propertyIds) {
          try {
            const roomsResponse = await api.get(`/api/hotels/${encodeURIComponent(pid)}/rooms`);
            const list =
              (roomsResponse.data?.rooms ?? roomsResponse.data?.data ?? roomsResponse.data) || [];
            if (Array.isArray(list)) roomsMerged.push(...list);
          } catch {
            // ignore
          }
        }
        if (roomsMerged.length > 0) {
          allRooms = roomsMerged;
        }
      } catch (err) {
      }

      // Combine data to create bookings
      const bookingsData = serviceUsers.map(su => {
        // Find move-in record for this service user
        const moveIn = moveIns.find(mi => mi.service_user_id === su.id || mi.service_user_id === su.service_user_id);

        // Find room details
        const room = allRooms.find(r => r.id === su.room_id || r.id === moveIn?.room_id);

        // Find property from properties list
        const property = properties.find(p => p.id === su.property_id || p.id === moveIn?.property_id);

        // Format check-in date to get day of week
        const checkInDate = su.admission_date || su.check_in_date || moveIn?.move_in_date;
        let dayOfWeek = '';
        if (checkInDate) {
          try {
            const date = new Date(checkInDate);
            dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
          } catch (e) {
            dayOfWeek = '';
          }
        }

        return {
          id: su.id || su.service_user_id,
          service_user_id: su.id || su.service_user_id,
          move_in_id: moveIn?.id,
          full_name: `${su.first_name || ''} ${su.last_name || ''}`.trim(),
          first_name: su.first_name,
          last_name: su.last_name,
          order_no: su.home_office_reference || 'N/A',
          room: room?.room_number || 'Unassigned',
          room_type: room?.type || 'N/A',
          room_id: su.room_id || moveIn?.room_id,
          property_id: su.property_id || moveIn?.property_id,
          property_name: property?.name || su.property_name || moveIn?.property_name || 'Unknown',
          check_in: checkInDate || 'N/A',
          day: dayOfWeek,
          guests: 1, // Single person booking
          origin: su.nationality || 'N/A',
          immigration_status: su.immigration_status || 'Pending',
          status: su.status || moveIn?.status || 'Pending',
          date_of_birth: su.date_of_birth || su.dob,
          nationality: su.nationality,
          home_office_reference: su.home_office_reference,
          vulnerabilities: su.vulnerabilities,
          medical_conditions: su.medical_conditions,
          dietary_requirements: su.dietary_requirements
        };
      });

      setBookings(bookingsData);

    } catch (err) {
      console.error('Failed to load bookings:', err);
      // Use fallback mock data if API fails
      setBookings([
        {
          id: 1,
          full_name: "Ahmad Martin",
          order_no: "H0-202512-7467",
          room: "005",
          room_type: "Standard",
          check_in: "2025-12-16",
          day: "Tue",
          guests: 1,
          origin: "Syria",
          status: "Checked In"
        }
      ]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadProperties = async () => {
    try {
      setLoadingProperties(true);
      const res = await api.get('/api/hotels');
      const list = Array.isArray(res.data?.hotels)
        ? res.data.hotels
        : Array.isArray(res.data)
          ? res.data
          : res.data?.data ?? [];
      setProperties(list);
    } catch (err) {
      console.error('Failed to load properties', err);
      setProperties([]);
    } finally {
      setLoadingProperties(false);
    }
  };

  const handlePropertyChange = async (propertyId) => {
    setFormData({ ...formData, property_id: propertyId, room_id: '' });
    if (propertyId) {
      try {
        const res = await api.get(`/api/hotels/${propertyId}/rooms`);
        const roomsList = Array.isArray(res.data?.rooms)
          ? res.data.rooms
          : Array.isArray(res.data)
            ? res.data
            : res.data?.data ?? [];
        setRooms(roomsList);
      } catch (err) {
        console.error('Failed to load rooms from API, using mock data', err);
        // Fallback to mock data filtered by property_id
        const filteredMockRooms = mockRooms.filter(r => r.property_id === parseInt(propertyId));
        setRooms(filteredMockRooms);
      }
    } else {
      setRooms([]);
    }
  };

  const handleView = (booking) => {
    setSelectedBooking(booking);
    setShowViewModal(true);
  };

  const normalizeDateInput = (value) => {
    if (!value) return "";

    // If it's a string
    if (typeof value === "string") {
      // Already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      // ISO string -> YYYY-MM-DD
      if (value.includes("T")) return value.slice(0, 10);
      // Try to parse as date
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }

    // Try to parse as date object
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const handleEdit = (booking) => {
    setSelectedBooking(booking);
    if (booking?.property_id) {
      handlePropertyChange(String(booking.property_id));
    }
    // Try to get DOB from either date_of_birth or dob field
    const dobValue = booking.date_of_birth || booking.dob;
    setFormData({
      first_name: booking.first_name || '',
      last_name: booking.last_name || '',
      date_of_birth: normalizeDateInput(dobValue),
      nationality: booking.nationality || '',
      home_office_reference: booking.home_office_reference || '',
      property_id: booking.property_id || '',
      room_id: booking.room_id || '',
      check_in_date: normalizeDateInput(booking.check_in),
      vulnerabilities: booking.vulnerabilities || '',
      medical_conditions: booking.medical_conditions || '',
      dietary_requirements: booking.dietary_requirements || ''
    });
    setShowEditModal(true);
  };

  const handleDelete = async (booking) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Booking',
      message: `Are you sure you want to delete the booking for ${booking.full_name}?`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          // Delete move-in record first
          if (booking.move_in_id) {
            await api.delete(`/api/move-ins/${booking.move_in_id}`);
          }

          // Then delete service user if needed
          if (booking.service_user_id) {
            await api.delete(`/api/su/users/${booking.service_user_id}`);
          }

          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          loadBookings();
        } catch (err) {
          console.error('Delete error:', err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: 'Failed to delete booking: ' + (err.response?.data?.error || err.message),
            type: 'error'
          });
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.date_of_birth ||
      !formData.nationality || !formData.property_id || !formData.room_id ||
      !formData.check_in_date) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      // Step 1: Create service user with all required fields
      const suData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        nationality: formData.nationality,
        home_office_reference: formData.home_office_reference,
        vulnerabilities: formData.vulnerabilities || null,
        medical_conditions: formData.medical_conditions || null,
        dietary_requirements: formData.dietary_requirements || null,
        property_id: parseInt(formData.property_id), // Ensure integer
        room_id: parseInt(formData.room_id), // Link to room
        admission_date: formData.check_in_date,
        status: 'Active', // Set status
        created_by: user?.id || user?.user_id || null // Track who created
      };

      const suResponse = await api.post('/api/su/users', suData);
      const serviceUserId = suResponse.data.id || suResponse.data.service_user_id || suResponse.data.user_id;

      if (!serviceUserId) {
        throw new Error('Failed to create service user - no ID returned');
      }


      // Step 2: Create move-in record to link SU to room and property
      const moveInData = {
        service_user_id: serviceUserId,
        room_id: parseInt(formData.room_id),
        property_id: parseInt(formData.property_id),
        move_in_date: formData.check_in_date,
        status: 'Active',
        notes: `Check-in via booking system on ${new Date().toLocaleDateString()}`
      };

      await api.post('/api/move-ins', moveInData);


      // Step 3: Reset form and refresh data
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        nationality: '',
        home_office_reference: '',
        property_id: '',
        room_id: '',
        check_in_date: '',
        vulnerabilities: '',
        medical_conditions: '',
        dietary_requirements: ''
      });
      setShowModal(false);
      setRooms([]); // Clear rooms selection

      // Reload bookings to show the new entry
      await loadBookings();

      // Show success message
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Booking created successfully! Service user has been added to the property.',
        type: 'success'
      });

    } catch (err) {
      console.error('Create booking error:', err);
      const errorMsg = err.response?.data?.error
        || err.response?.data?.message
        || err.message
        || 'Failed to create booking. Please check all fields and try again.';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const checkedIn = bookings.filter(b => b.status?.toLowerCase() === 'checked in').length;
    const checkedOut = bookings.filter(b => b.status?.toLowerCase() === 'checked out').length;
    const totalGuests = bookings.reduce((sum, b) => sum + (b.guests || 0), 0);
    const arrivingToday = bookings.filter(b => {
      const today = new Date().toDateString();
      const checkIn = new Date(b.check_in).toDateString();
      return today === checkIn;
    }).length;
    return { checkedIn, checkedOut, totalGuests, arrivingToday };
  }, [bookings]);

  // Filtering
  const filteredBookings = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let list = bookings.filter(b => {
      // Tab filter
      if (activeTab === 'checked-in' && b.status?.toLowerCase() !== 'checked in') return false;
      if (activeTab === 'arriving' && b.day?.toLowerCase() !== 'today') return false;
      if (activeTab === 'late' && b.status?.toLowerCase() !== 'late checkout') return false;
      if (activeTab === 'pending' && b.status?.toLowerCase() !== 'pending') return false;

      // Search filter
      if (q) {
        const fullName = (b.full_name || '').toLowerCase();
        const orderNo = (b.order_no || '').toLowerCase();
        const room = (b.room || '').toLowerCase();
        const roomType = (b.room_type || '').toLowerCase();
        const property = (b.property_name || b.property || '').toLowerCase();
        const status = (b.status || '').toLowerCase();

        if (!fullName.includes(q) &&
          !orderNo.includes(q) &&
          !room.includes(q) &&
          !roomType.includes(q) &&
          !property.includes(q) &&
          !status.includes(q)) {
          return false;
        }
      }

      // Status filter
      if (filterStatus && b.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;

      // Property filter  
      if (filterProperty && String(b.property_id) !== String(filterProperty)) return false;

      return true;
    });

    // Apply sorting
    if (sortBy) {
      list = [...list].sort((a, b) => {
        if (sortBy === 'date') {
          const dateA = new Date(a.check_in || 0);
          const dateB = new Date(b.check_in || 0);
          return dateB - dateA;
        }
        if (sortBy === 'name') {
          return (a.full_name || '').localeCompare(b.full_name || '');
        }
        if (sortBy === 'room') {
          return (a.room || '').localeCompare(b.room || '');
        }
        if (sortBy === 'status') {
          return (a.status || '').localeCompare(b.status || '');
        }
        return 0;
      });
    }

    return list;
  }, [bookings, query, filterStatus, filterProperty, sortBy, activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bookings</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Properties</span>
              <span>&gt;</span>
              <span>Bookings</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Manage reservations and check-ins</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Booking</span>
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Checked In</div>
              <div className="text-2xl font-bold text-gray-900">{stats.checkedIn}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <UserX className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Checked Out</div>
              <div className="text-2xl font-bold text-gray-900">{stats.checkedOut}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Guests</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalGuests}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Arriving Today</div>
              <div className="text-2xl font-bold text-gray-900">{stats.arrivingToday}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Bookings Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {/* Tab Switcher */}
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              All Bookings
            </button>
            <button
              onClick={() => setActiveTab('checked-in')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'checked-in'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Checked In
            </button>
            <button
              onClick={() => setActiveTab('arriving')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'arriving'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Arriving Today
            </button>
            <button
              onClick={() => setActiveTab('late')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'late'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Late Checkout
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending'
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Pending
            </button>
          </div>

          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {activeTab === 'all' ? 'All Bookings' :
                    activeTab === 'checked-in' ? 'Checked In' :
                      activeTab === 'arriving' ? 'Arriving Today' :
                        activeTab === 'late' ? 'Late Checkout' : 'Pending'}
                </h2>
                <p className="text-sm text-gray-500">{filteredBookings.length} of {bookings.length} bookings</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search bookings..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                {/* View Dropdown */}
                <div className="relative" ref={viewRef}>
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* View Settings Dropdown Panel */}
                  {showViewMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">View Settings</h3>

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
                          <button
                            onClick={() => setShowColumnVisibility(!showColumnVisibility)}
                            className="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                          >
                            <span className="font-medium">Column visibility</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {Object.values(visibleColumns).filter(Boolean).length} shown
                              </span>
                              <ChevronDown className={`w-4 h-4 transition-transform ${showColumnVisibility ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                        )}

                        {/* Column Visibility Panel */}
                        {showColumnVisibility && (
                          <div className="mt-2 border-t border-gray-200 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Default columns</span>
                              <div className="text-xs font-medium">
                                <button
                                  onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}))}
                                  className="text-teal-600 hover:text-teal-700"
                                  type="button"
                                >
                                  Show all
                                </button>
                                <span className="text-gray-300 mx-2">|</span>
                                <button
                                  onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: false }), {}))}
                                  className="text-teal-600 hover:text-teal-700"
                                  type="button"
                                >
                                  Hide all
                                </button>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 mb-3">Toggle column visibility by clicking</div>

                            <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                              {ALL_COLUMNS.map((col) => {
                                const isVisible = Boolean(visibleColumns[col]);
                                return (
                                  <button
                                    key={col}
                                    type="button"
                                    onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !isVisible })}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                                  >
                                    <span className={`text-sm font-medium ${isVisible ? 'text-gray-800' : 'text-gray-400'}`}>
                                      {col === 'order_no' ? 'Order no' : col.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())}
                                    </span>
                                    {isVisible ? (
                                      <Eye className="w-4 h-4 text-teal-600" />
                                    ) : (
                                      <EyeOff className="w-4 h-4 text-gray-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>New Booking</span>
                </button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Status</option>
                  <option value="Checked In">Checked In</option>
                  <option value="Checked Out">Checked Out</option>
                  <option value="Pending">Pending</option>
                  <option value="Late Checkout">Late Checkout</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={filterProperty}
                  onChange={e => setFilterProperty(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">All Properties</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-4 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Sort by...</option>
                  <option value="date">Check-in Date</option>
                  <option value="name">Name</option>
                  <option value="room">Room</option>
                  <option value="status">Status</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {visibleColumns.checkbox && <th className="w-12 py-3 px-4"><input type="checkbox" className="rounded border-gray-300" /></th>}
                    {visibleColumns.name && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</th>}
                    {visibleColumns.order_no && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Order No.</th>}
                    {visibleColumns.room && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Room</th>}
                    {visibleColumns.check_in && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Check-In</th>}
                    {visibleColumns.day && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Day</th>}
                    {visibleColumns.guests && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Guests</th>}
                    {visibleColumns.origin && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Origin</th>}
                    {visibleColumns.immigration_status && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Immigration Status</th>}
                    {visibleColumns.status && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>}
                    {visibleColumns.actions && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingBookings ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="py-8 text-center text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div>
                          <span>Loading bookings...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="py-8 text-center text-gray-500">
                        No bookings found
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => {
                      const statusColors = getStatusColor(booking.status);
                      return (
                        <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                          {visibleColumns.checkbox && <td className="py-3 px-4"><input type="checkbox" className="rounded border-gray-300" /></td>}
                          {visibleColumns.name && (
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{booking.full_name}</div>
                            </td>
                          )}
                          {visibleColumns.order_no && <td className="py-3 px-4 text-sm text-gray-600">{booking.order_no}</td>}
                          {visibleColumns.room && (
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{booking.room}</span>
                                <span className="text-xs text-gray-500">{booking.room_type}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.check_in && <td className="py-3 px-4 text-sm text-gray-600">{formatDate(booking.check_in)}</td>}
                          {visibleColumns.day && <td className="py-3 px-4 text-sm text-gray-600">{booking.day}</td>}
                          {visibleColumns.guests && <td className="py-3 px-4 text-sm text-gray-600">{booking.guests}</td>}
                          {visibleColumns.origin && <td className="py-3 px-4 text-sm text-gray-600">{booking.origin}</td>}
                          {visibleColumns.immigration_status && (
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {booking.immigration_status || 'Pending'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                                {booking.status}
                              </span>
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleView(booking)}
                                  className="group relative p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="View"
                                >
                                  <Eye className="w-4 h-4 transition-transform group-hover:scale-110" />
                                </button>
                                <button
                                  onClick={() => handleEdit(booking)}
                                  className="group relative p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4 transition-transform group-hover:scale-110" />
                                </button>
                                <button
                                  onClick={() => handleDelete(booking)}
                                  className="group relative p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-all duration-200 hover:shadow-sm"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                                </button>
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

          {/* Board View */}
          {viewMode === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loadingBookings ? (
                <div className="col-span-full py-8 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div>
                    <span>Loading bookings...</span>
                  </div>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-500">
                  No bookings found
                </div>
              ) : (
                filteredBookings.map((booking) => {
                  const statusColors = getStatusColor(booking.status);
                  return (
                    <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{booking.full_name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{booking.order_no}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm">
                          <BedDouble className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-600">{booking.room} - {booking.room_type}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-600">{formatDate(booking.check_in)} ({booking.day})</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Users className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-600">{booking.guests} guest{booking.guests > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Home className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-gray-600">{booking.origin}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium">
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Booking Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden h-[70vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">New Booking</h2>
                <p className="text-xs text-gray-500 mt-0.5">Register a new arrival. This will create a booking and service user record.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nationality <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Home Office Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.home_office_reference}
                  onChange={e => setFormData({ ...formData, home_office_reference: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                />
              </div>

              {/* Property & Room Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.property_id}
                    onChange={e => handlePropertyChange(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white"
                  >
                    <option value="">Select</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Room <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.room_id}
                    onChange={e => setFormData({ ...formData, room_id: e.target.value })}
                    required
                    disabled={!formData.property_id}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200 bg-white disabled:bg-gray-100"
                  >
                    <option value="">{formData.property_id ? 'Select' : 'Select property first'}</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.room_number} - {r.type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Check-in Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.check_in_date}
                    onChange={e => setFormData({ ...formData, check_in_date: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vulnerabilities</label>
                <input
                  type="text"
                  value={formData.vulnerabilities}
                  onChange={e => setFormData({ ...formData, vulnerabilities: e.target.value })}
                  placeholder="Separate multiple items with commas"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Medical Conditions</label>
                  <textarea
                    value={formData.medical_conditions}
                    onChange={e => setFormData({ ...formData, medical_conditions: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dietary Requirements</label>
                  <textarea
                    value={formData.dietary_requirements}
                    onChange={e => setFormData({ ...formData, dietary_requirements: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* View Modal */}
      {showViewModal && selectedBooking && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
                <p className="text-xs text-gray-500 mt-1">View booking information</p>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Full Name</label>
                  <p className="text-gray-900 font-medium">{selectedBooking.full_name}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Order Number</label>
                  <p className="text-gray-900">{selectedBooking.order_no}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Date of Birth</label>
                  <p className="text-gray-900">{formatDate(selectedBooking.date_of_birth) || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nationality</label>
                  <p className="text-gray-900">{selectedBooking.nationality || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Home Office Reference</label>
                  <p className="text-gray-900">{selectedBooking.home_office_reference || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Room</label>
                  <p className="text-gray-900">{selectedBooking.room} - {selectedBooking.room_type}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Property</label>
                  <p className="text-gray-900">{selectedBooking.property_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Check-In Date</label>
                  <p className="text-gray-900">{formatDate(selectedBooking.check_in)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Day</label>
                  <p className="text-gray-900">{selectedBooking.day}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Guests</label>
                  <p className="text-gray-900">{selectedBooking.guests}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Origin</label>
                  <p className="text-gray-900">{selectedBooking.origin}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Immigration Status</label>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedBooking.immigration_status || 'Pending'}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedBooking.status).bg} ${getStatusColor(selectedBooking.status).text} ${getStatusColor(selectedBooking.status).border}`}>
                    {selectedBooking.status}
                  </span>
                </div>
              </div>

              {selectedBooking.vulnerabilities && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Vulnerabilities</label>
                  <p className="text-gray-700">{selectedBooking.vulnerabilities}</p>
                </div>
              )}

              {selectedBooking.medical_conditions && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Medical Conditions</label>
                  <p className="text-gray-700">{selectedBooking.medical_conditions}</p>
                </div>
              )}

              {selectedBooking.dietary_requirements && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Dietary Requirements</label>
                  <p className="text-gray-700">{selectedBooking.dietary_requirements}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEdit(selectedBooking);
                }}
                className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {showEditModal && selectedBooking && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full h-[70vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 border border-gray-100">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit Booking</h2>
                <p className="text-xs text-gray-500 mt-1">Update booking information</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setError(null);

              if (!formData.first_name || !formData.last_name || !formData.date_of_birth ||
                !formData.nationality || !formData.property_id || !formData.room_id ||
                !formData.check_in_date) {
                setError('Please fill in all required fields');
                return;
              }

              try {
                setSubmitting(true);

                const safePropertyId = String(formData.property_id);
                const safeRoomId = String(formData.room_id);
                const safeDob = normalizeDateInput(formData.date_of_birth);
                const safeCheckIn = normalizeDateInput(formData.check_in_date);
                const selectedRoomObj = (Array.isArray(rooms) ? rooms : []).find(
                  (r) => String(r.id) === String(safeRoomId)
                );
                const safeRoomNumber =
                  selectedRoomObj?.room_number ??
                  selectedRoomObj?.number ??
                  selectedRoomObj?.name ??
                  null;

                // Step 1: Update service user with all fields
                if (selectedBooking.service_user_id) {
                  const updateSuData = {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    date_of_birth: safeDob,
                    nationality: formData.nationality,
                    home_office_reference: formData.home_office_reference,
                    vulnerabilities: formData.vulnerabilities || null,
                    medical_conditions: formData.medical_conditions || null,
                    dietary_requirements: formData.dietary_requirements || null,
                    property_id: safePropertyId,
                    room_id: safeRoomId,
                    room_number: safeRoomNumber,
                    admission_date: safeCheckIn,
                    updated_by: user?.id || user?.user_id || null
                  };

                  await api.put(`/api/su/users/${selectedBooking.service_user_id}`, updateSuData);
                }

                // Step 2: Update move-in record if room/property changed
                if (selectedBooking.move_in_id) {
                  const updateMoveInData = {
                    room_id: safeRoomId,
                    property_id: safePropertyId,
                    move_in_date: safeCheckIn,
                    updated_by: user?.id || user?.user_id || null
                  };

                  await api.put(`/api/move-ins/${selectedBooking.move_in_id}`, updateMoveInData);
                } else {
                  // If no move-in record exists, create one
                  const moveInData = {
                    service_user_id: selectedBooking.service_user_id,
                    room_id: safeRoomId,
                    property_id: safePropertyId,
                    move_in_date: safeCheckIn,
                    status: 'Active'
                  };
                  await api.post('/api/move-ins', moveInData);
                }


                setShowEditModal(false);
                setSelectedBooking(null);
                setRooms([]); // Clear rooms selection
                await loadBookings();

                setAlertDialog({
                  isOpen: true,
                  title: 'Success',
                  message: 'Booking updated successfully!',
                  type: 'success'
                });

              } catch (err) {
                console.error('Update error:', err);
                const errorMsg = err.response?.data?.error
                  || err.response?.data?.message
                  || err.message
                  || 'Failed to update booking';
                setError(errorMsg);
              } finally {
                setSubmitting(false);
              }
            }} className="overflow-y-auto flex-1 p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nationality *</label>
                  <input
                    type="text"
                    required
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Home Office Reference *</label>
                <input
                  type="text"
                  required
                  value={formData.home_office_reference}
                  onChange={(e) => setFormData({ ...formData, home_office_reference: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Property *</label>
                  <select
                    required
                    value={formData.property_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, property_id: val, room_id: '' });
                      handlePropertyChange(val);
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  >
                    <option value="">Select Property</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Room *</label>
                  <select
                    required
                    value={formData.room_id}
                    onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                    disabled={!formData.property_id}
                  >
                    <option value="">Select Room</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.room_number}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Check-In Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.check_in_date}
                    onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vulnerabilities</label>
                <textarea
                  rows="2"
                  value={formData.vulnerabilities}
                  onChange={(e) => setFormData({ ...formData, vulnerabilities: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Medical Conditions</label>
                  <textarea
                    rows="2"
                    value={formData.medical_conditions}
                    onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dietary Requirements</label>
                  <textarea
                    rows="2"
                    value={formData.dietary_requirements}
                    onChange={(e) => setFormData({ ...formData, dietary_requirements: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating...' : 'Update Booking'}
                </button>
              </div>
            </form>
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
