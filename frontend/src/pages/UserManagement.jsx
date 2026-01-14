import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { validatePassword, passwordStrengthLabel, passwordStrengthPercent } from '../utils/passwordUtils';
import {
  UserPlus, Edit2, Trash2, Lock, Search, Filter,
  Shield, Mail, Phone, Building, CheckCircle, XCircle,
  Users as UsersIcon, UserCheck, Activity, Eye, EyeOff,
  Home, ChevronDown, X, Gavel
} from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'password'
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState(null);

  // Filters and pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    phone: '',
    branch: '',
    status: 'active'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [pwStrengthLabelState, setPwStrengthLabelState] = useState('');
  const [pwPercent, setPwPercent] = useState(0);
  const [pwFieldErrors, setPwFieldErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage, search, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/users', {
        params: {
          page: currentPage,
          limit: 10,
          search,
          role: roleFilter === 'All Roles' ? '' : roleFilter,
          status: statusFilter === 'All Status' ? '' : statusFilter
        },
        withCredentials: true
      });

      setUsers(res.data.users || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err.response?.data?.error || 'Failed to fetch users');
      setUsers([]);
      setPagination({ total: 0, page: 1, limit: 10, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/admin/stats/users', { withCredentials: true });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleCreateUser = () => {
    setModalType('create');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'staff',
      phone: '',
      branch: '',
      status: 'active'
    });
    setPwStrengthLabelState('');
    setPwPercent(0);
    setPwFieldErrors([]);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setModalType('edit');
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'staff',
      phone: user.phone || '',
      branch: user.branch || '',
      status: user.status || 'active'
    });
    setShowModal(true);
  };

  const handlePasswordReset = (user) => {
    setModalType('password');
    setSelectedUser(user);
    setFormData({ password: '', confirmPassword: '' });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password' && (modalType === 'create' || modalType === 'password')) {
      try {
        setPwStrengthLabelState(passwordStrengthLabel(value));
        setPwPercent(passwordStrengthPercent(value));
        const v = validatePassword(value);
        setPwFieldErrors(v.errors || []);
      } catch (err) { }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let url = '/api/admin/users';
      let method = 'post';
      let payload = { ...formData };

      // Validation
      if (modalType === 'create' || modalType === 'edit') {
        if (!payload.name || !payload.email || !payload.role) {
          throw new Error('Name, email, and role are required');
        }
      }

      if (modalType === 'create') {
        // Auto-generate password if blank
        if (!payload.password) {
          payload.password = `${payload.name.split(' ')[0].toLowerCase()}${Math.floor(Math.random() * 10000)}`;
        } else {
          const { valid, errors } = validatePassword(payload.password);
          if (!valid) throw new Error(errors.join('; '));
          if (payload.password !== payload.confirmPassword) throw new Error('Passwords do not match');
        }
      } else if (modalType === 'edit') {
        url = `/api/admin/users/${selectedUser.id}`;
        method = 'put';
        delete payload.password;
        delete payload.confirmPassword;
      } else if (modalType === 'password') {
        const { valid, errors } = validatePassword(payload.password);
        if (!valid) throw new Error(errors.join('; '));
        if (payload.password !== payload.confirmPassword) throw new Error('Passwords do not match');

        url = `/api/admin/users/${selectedUser.id}/password`;
        method = 'post';
        payload = { new_password: payload.password };
      }

      const res = await axios({
        method,
        url,
        data: payload,
        withCredentials: true
      });

      alert(res.data.message || 'Success');
      setShowModal(false);
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      await axios.delete(`/api/admin/users/${userId}`, { withCredentials: true });
      alert('User deactivated successfully');
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-50 text-red-700 border-red-100';
      case 'manager': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'staff': return 'bg-teal-50 text-teal-700 border-teal-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getStatusColor = (s) => {
    const low = String(s).toLowerCase();
    if (low === "active") return { dot: "bg-green-500", text: "text-green-700" };
    if (low === "pending") return { dot: "bg-orange-500", text: "text-orange-700" };
    if (low === "inactive") return { dot: "bg-red-500", text: "text-red-700" };
    return { dot: "bg-gray-500", text: "text-gray-700" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">User Management</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home className="w-4 h-4" />
              <span>&gt;</span>
              <span>Settings</span>
              <span>&gt;</span>
              <span>User Management</span>
            </div>
          </div>
          <button
            onClick={handleCreateUser}
            className="bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-teal-100 text-teal-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                <UsersIcon className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-500 text-sm mb-1">Total Users</div>
                <div className="text-2xl font-bold text-gray-900">{stats.total_users}</div>
                <div className="text-xs text-gray-500 mt-1">All registered accounts</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-500 text-sm mb-1">Active Users</div>
                <div className="text-2xl font-bold text-gray-900">{stats.active_users}</div>
                <div className="text-xs text-gray-500 mt-1">Currently enabled</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-500 text-sm mb-1">Admins & Managers</div>
                <div className="text-2xl font-bold text-gray-900">{parseInt(stats.admin_count) + parseInt(stats.manager_count)}</div>
                <div className="text-xs text-gray-500 mt-1">Management roles</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                <Activity className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-500 text-sm mb-1">Active Recently</div>
                <div className="text-2xl font-bold text-gray-900">{stats.active_last_week}</div>
                <div className="text-xs text-gray-500 mt-1">Joined in last 7 days</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area - Users Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {/* Table Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">System Users</h2>
                <p className="text-sm text-gray-500">{pagination.total} total records</p>
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="bg-white border-2 border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-full transition-all shadow-sm hover:shadow-md"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[140px]"
                >
                  <option>All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg pl-10 pr-8 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none min-w-[140px]"
                >
                  <option>All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {(search || roleFilter !== 'All Roles' || statusFilter !== 'All Status') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setRoleFilter('All Roles');
                    setStatusFilter('All Status');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-teal-500"></div>
              <p className="text-gray-500 mt-4">Loading users...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="text-red-500 text-lg font-medium">{error}</div>
              <button onClick={fetchUsers} className="mt-4 text-teal-600 hover:underline">Try Again</button>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">USER</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">ROLE</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">CONTACT</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">JOINED</th>
                    <th className="text-right py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {users.map((user) => {
                    const statusStyle = getStatusColor(user.status || 'Active');
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                              {(user.name || 'U')[0].toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadgeColor(user.role)}`}>
                            {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate max-w-[180px]">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              {user.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                            <span className={`text-sm font-medium ${statusStyle.text}`}>
                              {user.status?.charAt(0).toUpperCase() + user.status?.slice(1) || 'Active'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }) : <span className="text-gray-400 italic">N/A</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                              title="Edit User"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePasswordReset(user)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deactivate User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} users
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(pagination.totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${currentPage === i + 1
                          ? 'bg-teal-500 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {modalType === 'create' && 'Create New User'}
                  {modalType === 'edit' && 'Edit User'}
                  {modalType === 'password' && 'Reset Password'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {modalType !== 'password' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                          placeholder="John Doe"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                          placeholder="user@example.com"
                        />
                      </div>

                      {modalType === 'create' && (
                        <div className="md:col-span-2 space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                              Password <span className="text-gray-400 text-xs font-normal ml-2">(Auto-generated if left blank)</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleFormChange}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none pr-10"
                                placeholder="Create a strong password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            {formData.password && (
                              <div className="mt-3">
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${pwStrengthLabelState === 'Weak' ? 'bg-red-500' :
                                        pwStrengthLabelState === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}
                                    style={{ width: `${pwPercent}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-xs font-medium text-gray-500">{pwStrengthLabelState} Strength</span>
                                </div>
                                {pwFieldErrors.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {pwFieldErrors.map((err, i) => <li key={i} className="text-[10px] text-red-500 flex items-center gap-1">
                                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                      {err}
                                    </li>)}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>

                          {formData.password && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password *</label>
                              <input
                                type={showPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleFormChange}
                                required
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                                placeholder="Repeat password"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">System Role *</label>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none cursor-pointer"
                        >
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Account Status *</label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleFormChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none cursor-pointer"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleFormChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                          placeholder="+44 123 456 7890"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Branch / Hotel</label>
                        <input
                          type="text"
                          name="branch"
                          value={formData.branch}
                          onChange={handleFormChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                          placeholder="Main Branch"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Updating password for <span className="font-semibold text-gray-700">{selectedUser?.name}</span></p>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">New Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleFormChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none pr-10"
                          placeholder="Min. 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formData.password && (
                        <div className="mt-3">
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${pwStrengthLabelState === 'Weak' ? 'bg-red-500' :
                                  pwStrengthLabelState === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                              style={{ width: `${pwPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs font-medium text-gray-500">{pwStrengthLabelState} Strength</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password *</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleFormChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                        placeholder="Repeat new password"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Processing...' : modalType === 'create' ? 'Create User' : modalType === 'edit' ? 'Save Changes' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;