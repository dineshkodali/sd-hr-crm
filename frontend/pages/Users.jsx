/* eslint-disable no-unused-vars */
/* src/pages/Users.jsx */
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { validatePassword, passwordStrengthLabel, passwordStrengthPercent } from '../src/utils/passwordUtils';
import {
  Home,
  UserPlus,
  Search,
  Users as UsersIcon,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Building,
  Filter,
  X,
  ChevronDown,
  Columns,
  Eye,
  MapPin
} from "lucide-react";

axios.defaults.withCredentials = true;

function AddEmployeeModal({ open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    phone: '',
    branch: '',
    address: '',
    city: '',
    status: 'active'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStrengthLabelState, setPwStrengthLabelState] = useState('');
  const [pwPercent, setPwPercent] = useState(0);
  const [pwFieldErrors, setPwFieldErrors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchInputFocused, setBranchInputFocused] = useState(false);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/admin/users', {
        params: { limit: 1000 },
        withCredentials: true
      });

      const allUsers = res.data.users || [];
      const uniqueBranches = [...new Set(
        allUsers
          .map(user => user.branch)
          .filter(branch => branch && branch.trim() !== '')
      )].sort();

      setBranches(uniqueBranches);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      setBranches([]);
    }
  };

  React.useEffect(() => {
    if (open) {
      fetchBranches();
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password') {
      try {
        const label = passwordStrengthLabel(value);
        const pct = passwordStrengthPercent(value);
        setPwStrengthLabelState(label);
        setPwPercent(pct);
        const v = validatePassword(value);
        setPwFieldErrors(v.errors || []);
      } catch {
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.role) {
      setError('Name, email, and role are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    let password = formData.password;
    if (password) {
      const { valid, errors } = validatePassword(password);
      if (!valid) {
        setError(errors.join('; '));
        return;
      }

      if (formData.confirmPassword && formData.confirmPassword !== password) {
        setError('Password and confirmation do not match');
        return;
      }
    } else {
      password = `${formData.name.split(' ')[0]}${Math.floor(Math.random() * 10000)}`;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: password,
        role: formData.role,
        phone: formData.phone?.trim() || null,
        branch: formData.branch?.trim() || null,
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        status: formData.status || 'active'
      };

      const response = await axios.post('/api/admin/users', payload, {
        withCredentials: true
      });

      if (response.data) {
        if (onSuccess) onSuccess();
        onClose();
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'staff',
          phone: '',
          branch: '',
          address: '',
          city: '',
          status: 'active'
        });
        setShowBranchDropdown(false);
        setBranchInputFocused(false);
      }
    } catch (err) {
      console.error('Error creating employee:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create employee';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Add Employee</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Add a new employee to the system.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Phone
                </label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Branch
                </label>
                <div className="relative">
                  <input
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    onFocus={() => {
                      setBranchInputFocused(true);
                      setShowBranchDropdown(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setBranchInputFocused(false);
                        setShowBranchDropdown(false);
                      }, 200);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm pr-10
                               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                    placeholder="Select existing branch or type new one"
                  />
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  />

                  {showBranchDropdown && branches.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {branches
                        .filter(branch =>
                          branch.toLowerCase().includes(formData.branch.toLowerCase())
                        )
                        .map((branch, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, branch });
                              setShowBranchDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-teal-50 hover:text-teal-700 transition-colors text-sm border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                          >
                            <Building className="w-4 h-4 text-gray-400" />
                            <span>{branch}</span>
                          </button>
                        ))
                      }

                      {formData.branch &&
                        !branches.some(b => b.toLowerCase() === formData.branch.toLowerCase()) && (
                          <div className="px-4 py-2.5 text-sm text-gray-500 border-t border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-4 h-4 text-teal-500" />
                              <span>Create new branch: <strong className="text-teal-600">&quot;{formData.branch}&quot;</strong></span>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Address
                </label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="Full address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  City
                </label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                             focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                  placeholder="City"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Password <span className="text-gray-400 text-xs">(Optional - will be auto-generated)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm pr-10
                               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                    placeholder="Leave empty for auto-generated password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.054.164-2.066.468-3.012" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        <circle cx="12" cy="12" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-3">
                  <div className="pw-strength">
                    <div
                      className={`pw-strength-inner ${pwStrengthLabelState === 'Weak' ? 'pw-weak' : pwStrengthLabelState === 'Medium' ? 'pw-medium' : pwStrengthLabelState === 'Strong' ? 'pw-strong' : ''}`}
                      style={{ width: `${pwPercent}%` }}
                    />
                  </div>
                  <div className="pw-strength-label">{pwStrengthLabelState}</div>
                  {pwFieldErrors && pwFieldErrors.length > 0 && (
                    <div className="text-xs text-red-600 mt-2">
                      {pwFieldErrors.map((e, i) => (
                        <div key={i}>• {e}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
                               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
                    placeholder="Confirm password"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 rounded-lg border border-gray-300 text-slate-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-teal-400 text-white font-medium hover:bg-teal-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const outlet = useOutletContext();
  const { user } = outlet || {};

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Dialog states
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

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);

  /* Delete Modal */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* Move Room Modal */
  const [showMoveRoomModal, setShowMoveRoomModal] = useState(false);
  const [moveRoomUserId, setMoveRoomUserId] = useState(null);
  const [moveRoomUser, setMoveRoomUser] = useState(null);

  // Move room form state
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
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

  // --- EXISTING LOGIC & HANDLERS (UNCHANGED) ---

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/admin/users", { withCredentials: true });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to load staff:", err);
      setError(err?.response?.data?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: 'Delete user? This cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/admin/users/${id}`, { withCredentials: true });
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          fetchUsers();
        } catch (err) {
          console.error('delete user error:', err);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setAlertDialog({
            isOpen: true,
            title: 'Delete Failed',
            message: err?.response?.data?.message || 'Failed to delete user',
            type: 'error'
          });
        }
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteUserId) return;

    try {
      setDeleting(true);

      await axios.delete(`/api/admin/users/${deleteUserId}`, {
        withCredentials: true,
      });

      await fetchUsers();
    } catch (err) {
      console.error("delete user error:", err);
      setAlertDialog({
        isOpen: true,
        title: 'Delete Failed',
        message: err?.response?.data?.message || 'Failed to delete user',
        type: 'error'
      });
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeleteUserId(null);
    }
  };

  // Move Room Functions
  const fetchProperties = async () => {
    try {
      const res = await axios.get("/api/properties", { withCredentials: true });
      setProperties(res.data || []);
    } catch (err) {
      console.error("Failed to load properties:", err);
    }
  };

  const fetchRoomsForProperty = async (propertyId) => {
    try {
      const res = await axios.get(`/api/properties/${propertyId}/rooms`, { withCredentials: true });
      const rooms = res.data || [];

      // Group rooms by floor
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
    }
  };

  const openMoveRoom = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setMoveRoomUserId(userId);
    setMoveRoomUser(user);
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
    setMoveRoomUserId(null);
    setMoveRoomUser(null);
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
        title: 'Select Property and Room',
        message: 'Please select property and room',
        type: 'warning'
      });
      return;
    }

    setMovingRoom(true);
    try {
      const payload = {
        service_user_id: moveRoomUserId,
        service_user_name: moveRoomUser?.name || "",
        property_id: moveRoomFormData.property_id,
        property_name: moveRoomFormData.property_name,
        room_id: moveRoomFormData.room_id,
        room_name: moveRoomFormData.room_name,
        move_in_date: moveRoomFormData.move_in_date,
        notes: moveRoomFormData.notes,
      };

      await axios.post("/api/move-ins", payload, { withCredentials: true });

      await fetchUsers();
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
        message: err?.response?.data?.message || 'Failed to move user',
        type: 'error'
      });
    } finally {
      setMovingRoom(false);
    }
  };




  const getStaffId = (u) => u?.staff_id || u?.emp_id || u?.employee_id || u?.id || "—";
  const getPhone = (u) => u?.phone || u?.mobile || u?.contact || "—";
  const getStatus = (u) => {
    if (u?.status) return u.status;
    if (typeof u?.active === "boolean") return u.active ? "Active" : "Inactive";
    if (u?.account_status) return u.account_status;
    return "Active"; // Default for UI matching
  };
  const getJoinDateRaw = (u) => u?.joining_date || u?.joined_on || u?.join_date || u?.created_at || u?.createdAt || null;
  const formatJoinDate = (u) => {
    const d = getJoinDateRaw(u);
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(d);
    }
  };

  // Edit Handlers
  const openEdit = async (id) => {
    setEditingId(id);
    setIsEditOpen(true);
    setEditUser(null);
    setAvatarPreview(null);
    setAvatarFile(null);

    try {
      const res = await axios.get(`/api/admin/users/${id}`, { withCredentials: true });
      const u = res.data.user || res.data || {};
      const payload = {
        id: u.id,
        first_name: u.first_name || u.firstName || (u.name ? u.name.split(" ")[0] : ""),
        last_name: u.last_name || u.lastName || (u.name ? u.name.split(" ").slice(1).join(" ") : ""),
        staff_id: u.staff_id || u.emp_id || u.employee_id || u.id,
        username: u.username || u.user_name || u.email,
        email: u.email || "",
        phone: u.phone || u.mobile || u.contact || "",
        joining_date: getJoinDateRaw(u) ? new Date(getJoinDateRaw(u)).toISOString().substr(0, 10) : "",
        branch: u.branch || u.company || u.organisation || u.org || "",
        role: u.role || u.user_role || "",
        status: getStatus(u),
        avatar: u.avatar || u.photo || u.image || null,
      };
      setEditUser(payload);
      if (payload.avatar) setAvatarPreview(payload.avatar);
    } catch (err) {
      console.error("fetch user details error:", err);
      setAlertDialog({
        isOpen: true,
        title: 'Load Failed',
        message: 'Failed to load user details',
        type: 'error'
      });
      setIsEditOpen(false);
    }
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingId(null);
    setEditUser(null);
    setAvatarPreview(null);
    setAvatarFile(null);
    setSaving(false);
  };

  const onEditChange = (key, value) => {
    setEditUser((s) => ({ ...s, [key]: value }));
  };

  const onAvatarChange = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editUser || !editingId) return;
    setSaving(true);
    try {
      const fullName = `${(editUser.first_name || "").trim()} ${(editUser.last_name || "").trim()}`.trim();
      const form = new FormData();
      if (fullName) form.append("name", fullName);
      if (editUser.email !== undefined) form.append("email", editUser.email || "");
      if (editUser.password) form.append("password", editUser.password);
      if (editUser.branch !== undefined) form.append("branch", editUser.branch || "");
      if (editUser.role !== undefined) form.append("role", editUser.role || "");
      if (editUser.status !== undefined) form.append("status", editUser.status || "");
      if (editUser.phone !== undefined) form.append("phone", editUser.phone || "");
      if (avatarFile) form.append("avatar", avatarFile);

      await axios.put(`/api/admin/users/${editingId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });

      await fetchUsers();
      closeEdit();
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: 'Saved successfully',
        type: 'success'
      });
    } catch (err) {
      console.error("save user error:", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to save";
      setAlertDialog({
        isOpen: true,
        title: 'Save Failed',
        message: msg,
        type: 'error'
      });
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  // --- CALCULATE STATS FOR UI ---
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Compute stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => String(getStatus(u)).toLowerCase() === 'active').length;
    const inactive = total - active;
    const newJoiners = users.filter(u => {
      const joinDate = getJoinDateRaw(u);
      if (!joinDate) return false;
      const days = Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30;
    }).length;
    return { total, active, inactive, newJoiners };
  }, [users]);

  // Filter users based on tab, search, and filters
  const filteredUsers = useMemo(() => {
    let list = [...users];

    // Tab filter
    if (activeTab === 'active') {
      list = list.filter(u => String(getStatus(u)).toLowerCase() === 'active');
    } else if (activeTab === 'inactive') {
      list = list.filter(u => String(getStatus(u)).toLowerCase() !== 'active');
    }

    // Search filter - improved to handle all cases
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(u => {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const staffId = String(getStaffId(u)).toLowerCase();
        const phone = String(getPhone(u)).toLowerCase();
        const role = (u.role || '').toLowerCase();
        const branch = (u.branch || '').toLowerCase();

        return name.includes(q) ||
          email.includes(q) ||
          staffId.includes(q) ||
          phone.includes(q) ||
          role.includes(q) ||
          branch.includes(q);
      });
    }

    // Designation filter
    if (filterDesignation) {
      list = list.filter(u => (u.role || '').toLowerCase() === filterDesignation.toLowerCase());
    }

    // Status filter
    if (filterStatus) {
      list = list.filter(u => String(getStatus(u)).toLowerCase() === filterStatus.toLowerCase());
    }

    // Branch filter
    if (filterBranch) {
      list = list.filter(u => (u.branch || '') === filterBranch);
    }

    // Sorting
    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'email') {
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    } else if (sortBy === 'role') {
      list.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
    } else if (sortBy === 'branch') {
      list.sort((a, b) => (a.branch || '').localeCompare(b.branch || ''));
    } else if (sortBy === 'recent') {
      list.sort((a, b) => {
        const dateA = new Date(getJoinDateRaw(a) || 0);
        const dateB = new Date(getJoinDateRaw(b) || 0);
        return dateB - dateA;
      });
    }

    return list;
  }, [users, activeTab, searchQuery, filterDesignation, filterStatus, filterBranch, sortBy]);

  // Get unique branches and roles for dropdowns
  const uniqueBranches = useMemo(() => {
    const branches = [...new Set(users.map(u => u.branch).filter(Boolean))];
    return branches.sort();
  }, [users]);

  const uniqueRoles = useMemo(() => {
    const roles = [...new Set(users.map(u => u.role).filter(Boolean))];
    return roles.sort();
  }, [users]);

  /* -------------------------
       RENDER (ENHANCED UI MATCHING BOOKINGS)
     ------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">

        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Employee Management</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Property</span>
              <span>&gt;</span>
              <span>Employee List</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Manage staff members and their information</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-400 hover:bg-teal-500 active:bg-teal-600 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Add Employee
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-teal-100 text-teal-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Employees</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Active</div>
              <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-red-100 text-red-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <UserX className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Inactive</div>
              <div className="text-2xl font-bold text-gray-900">{stats.inactive}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">New Joiners (30d)</div>
              <div className="text-2xl font-bold text-gray-900">{stats.newJoiners}</div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
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
              All Employees
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'inactive'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Inactive
            </button>
          </div>

          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {activeTab === 'all' ? 'All Employees' :
                    activeTab === 'active' ? 'Active Employees' : 'Inactive Employees'}
                </h2>
                <p className="text-sm text-gray-500">{filteredUsers.length} of {users.length} employees</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search employees..."
                    className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-72 transition-all shadow-sm hover:shadow-md"
                  />
                </div>

                {/* Filter Dropdown */}
                <select
                  value={filterDesignation}
                  onChange={e => setFilterDesignation(e.target.value)}
                  className="bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm hover:shadow-md"
                >
                  <option value="">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                  ))}
                </select>

                {/* Branch Filter */}
                <select
                  value={filterBranch}
                  onChange={e => setFilterBranch(e.target.value)}
                  className="bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm hover:shadow-md"
                >
                  <option value="">All Branches</option>
                  {uniqueBranches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm hover:shadow-md"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-white border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm hover:shadow-md"
                >
                  <option value="name">Sort: Name</option>
                  <option value="email">Sort: Email</option>
                  <option value="role">Sort: Role</option>
                  <option value="branch">Sort: Branch</option>
                  <option value="recent">Sort: Recent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wide bg-gray-50">
                  <th className="p-4 w-10">
                    <input type="checkbox" className="rounded border-gray-300 cursor-pointer" />
                  </th>
                  <th className="p-4">Staff ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Designation</th>
                  <th className="p-4">Joining Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="p-8 text-center text-gray-500">
                    <div className="flex justify-center">
                      <svg className="w-8 h-8 animate-spin text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <p className="mt-2">Loading employees...</p>
                  </td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="9" className="p-8 text-center text-gray-500">
                    <UsersIcon className="mx-auto mb-3 opacity-50 w-12 h-12" />
                    <p>{searchQuery ? "No employees found matching your search" : "No employees found"}</p>
                  </td></tr>
                ) : filteredUsers.map((u, index) => (
                  <tr key={u.id || index} className="border-b border-gray-100 hover:bg-teal-50/50 transition-colors">
                    <td className="p-4"><input type="checkbox" className="rounded border-gray-300 cursor-pointer" /></td>
                    <td className="p-4 text-sm font-semibold text-slate-800">{getStaffId(u)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 overflow-hidden flex-shrink-0 border-2 border-gray-200">
                          {u.avatar || u.photo ? (
                            <img src={u.avatar || u.photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold bg-gradient-to-br from-teal-100 to-cyan-100">
                              {(u.name || "U").substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{u.name || "Unknown"}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {u.branch || u.role || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {u.email || "—"}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {getPhone(u)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-2 border border-teal-200 rounded-full px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50">
                        {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "Staff"}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatJoinDate(u)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${getStatus(u).toLowerCase() === 'active'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${getStatus(u).toLowerCase() === 'active' ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                        {getStatus(u)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openMoveRoom(u.id)}
                          title="Move to another room"
                          className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 border border-gray-200 p-2 rounded-lg bg-white transition-all hover:border-purple-300 hover:shadow-md"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(u.id)}
                          title="Edit details"
                          className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 p-2 rounded-lg bg-white transition-all hover:border-blue-300 hover:shadow-md"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteUserId(u.id);
                            setShowDeleteModal(true);
                          }}
                          title="Delete user"
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 p-2 rounded-lg bg-white transition-all hover:border-red-300 hover:shadow-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredUsers.length}</span> of <span className="font-semibold">{users.length}</span> employees
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Previous
                </button>
                <button className="px-3 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
                  1
                </button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* -------------------------
           EDIT MODAL (Kept Functional, styled cleanly)
         ------------------------- */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-slate-800">Edit Employee Details</h3>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={saveEdit} className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-lg border border-dashed border-gray-300">
                  <div className="w-24 h-24 rounded-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-gray-300 font-bold">{(editUser?.first_name || "U").charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                      onChange={(ev) => {
                        const f = ev.target.files?.[0];
                        if (f) onAvatarChange(f);
                      }}
                    />
                    <p className="mt-1 text-xs text-gray-400">Recommended: Square JPG/PNG, max 4MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input value={editUser?.first_name || ""} onChange={(e) => onEditChange("first_name", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input value={editUser?.last_name || ""} onChange={(e) => onEditChange("last_name", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
                    <input value={editUser?.staff_id || ""} onChange={(e) => onEditChange("staff_id", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input value={editUser?.email || ""} onChange={(e) => onEditChange("email", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={editUser?.phone || ""} onChange={(e) => onEditChange("phone", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation / Role</label>
                    <select value={editUser?.role || ""} onChange={(e) => onEditChange("role", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all">
                      <option value="">Select Role</option>
                      <option value="staff">Staff / Developer</option>
                      <option value="manager">Manager</option>
                      {/* <option value="executive">Executive</option>
                      <option value="finance">Finance</option> */}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={editUser?.status || ""} onChange={(e) => onEditChange("status", e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={closeEdit} className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-teal-400
 hover:bg-teal-500
 active:bg-teal-600 text-white text-sm font-medium transition-all disabled:opacity-50">
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. This will permanently delete the property.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteUserId(null);
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

      {/* MOVE ROOM MODAL */}
      {showMoveRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Move to Another Room</h3>
                <p className="text-sm text-gray-500 mt-1">{moveRoomUser?.name} ({moveRoomUser?.email})</p>
              </div>
              <button onClick={closeMoveRoom} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleMoveRoomSubmit} className="space-y-5">

                {/* Property Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Property *</label>
                  <select
                    value={moveRoomFormData.property_id}
                    onChange={handlePropertyChange}
                    required
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  >
                    <option value="">-- Choose a property --</option>
                    {properties.map((prop) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.name} ({prop.code || "N/A"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Floor Selection */}
                {moveRoomFormData.property_id && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Floor *</label>
                    <select
                      value={moveRoomFormData.floor}
                      onChange={handleFloorChange}
                      required
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                    >
                      <option value="">-- Choose a floor --</option>
                      {floors.map((floor) => (
                        <option key={floor} value={floor}>
                          {floor}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Room Selection */}
                {selectedFloor && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Room *</label>
                    <select
                      value={moveRoomFormData.room_id}
                      onChange={handleRoomChange}
                      required
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                    >
                      <option value="">-- Choose a room --</option>
                      {(availableRooms[selectedFloor] || []).map((room) => (
                        <option key={room.id} value={room.id}>
                          Room {room.room_number} - {room.type || "Standard"} (Status: {room.status || "Available"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Move-in Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Move-in Date</label>
                  <input
                    type="date"
                    value={moveRoomFormData.move_in_date}
                    onChange={(e) => setMoveRoomFormData((prev) => ({ ...prev, move_in_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
                  <textarea
                    value={moveRoomFormData.notes}
                    onChange={(e) => setMoveRoomFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                    rows="3"
                    placeholder="Add any additional details about the room move..."
                  />
                </div>

                {/* Room Info Card */}
                {moveRoomFormData.room_id && (
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Move Summary</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">Property:</span> <span className="font-medium">{moveRoomFormData.property_name}</span></p>
                      <p><span className="text-gray-600">Floor:</span> <span className="font-medium">{moveRoomFormData.floor}</span></p>
                      <p><span className="text-gray-600">Room:</span> <span className="font-medium">{moveRoomFormData.room_name}</span></p>
                      <p><span className="text-gray-600">Move-in Date:</span> <span className="font-medium">{new Date(moveRoomFormData.move_in_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={closeMoveRoom}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={movingRoom || !moveRoomFormData.room_id}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {movingRoom ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Moving...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                        Move User to Room
                      </>
                    )}
                  </button>
                </div>
              </form>
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

      <AddEmployeeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchUsers}
      />

    </div>
  );
}