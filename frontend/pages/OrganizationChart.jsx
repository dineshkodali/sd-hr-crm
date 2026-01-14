/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Home, 
  Building2, 
  Users, 
  Search, 
  ChevronDown, 
  ChevronRight,
  MapPin, 
  Phone, 
  Mail,
  User,
  UserCheck,
  Shield,
  Briefcase,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  Filter,
  Minus
} from "lucide-react";

export default function OrganizationChart({ user }) {
  const [orgData, setOrgData] = useState({ orgChart: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBranches, setExpandedBranches] = useState(new Set());
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'grid'
  const [filterRole, setFilterRole] = useState('all');
  
  axios.defaults.withCredentials = true;

  useEffect(() => {
    loadOrgChart();
  }, []);

  const loadOrgChart = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/org-chart');
      setOrgData(res.data);
      // Expand all branches by default
      const allBranchIds = new Set(res.data.orgChart.map(b => b.id));
      setExpandedBranches(allBranchIds);
    } catch (error) {
      console.error('Load org chart error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBranch = (branchId) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set(orgData.orgChart.map(b => b.id));
    setExpandedBranches(allIds);
  };

  const collapseAll = () => {
    setExpandedBranches(new Set());
  };

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return orgData.orgChart.filter(branch => {
      const matchesSearch = !searchQuery || 
        branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.employees.some(emp => 
          emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      
      const matchesRole = filterRole === 'all' || 
        branch.employees.some(emp => emp.role === filterRole);
      
      return matchesSearch && matchesRole;
    });
  }, [orgData.orgChart, searchQuery, filterRole]);

  const getRoleIcon = (role) => {
    if (role === 'admin') return <Shield className="w-4 h-4" />;
    if (role === 'manager') return <Briefcase className="w-4 h-4" />;
    return <User className="w-4 h-4" />;
  };

  const getRoleColor = (role) => {
    if (role === 'admin') return { 
      bg: 'bg-purple-50', 
      text: 'text-purple-700', 
      badge: 'bg-purple-500',
      border: 'border-purple-200'
    };
    if (role === 'manager') return { 
      bg: 'bg-blue-50', 
      text: 'text-blue-700', 
      badge: 'bg-blue-500',
      border: 'border-blue-200'
    };
    return { 
      bg: 'bg-teal-50', 
      text: 'text-teal-700', 
      badge: 'bg-teal-500',
      border: 'border-teal-200'
    };
  };

  const getStatusColor = (status) => {
    if (status === 'active') return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
    return { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
          <p className="text-gray-600">Loading organization chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-full max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization Chart</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Home className="w-4 h-4" />
            <span>&gt;</span>
            <span>Properties</span>
            <span>&gt;</span>
            <span>Organization Chart</span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 h-12 w-12 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 text-xs">Branches</div>
                <div className="text-xl font-bold text-gray-900">{orgData.stats.totalBranches || 0}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 text-teal-600 h-12 w-12 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 text-xs">Employees</div>
                <div className="text-xl font-bold text-gray-900">{orgData.stats.totalEmployees || 0}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 text-purple-600 h-12 w-12 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 text-xs">Admins</div>
                <div className="text-xl font-bold text-gray-900">{orgData.stats.byRole?.admin || 0}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 text-orange-600 h-12 w-12 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <div className="text-gray-500 text-xs">Managers</div>
                <div className="text-xl font-bold text-gray-900">{orgData.stats.byRole?.manager || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search branches or employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="staff">Staff</option>
            </select>

            <button
              onClick={expandAll}
              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Organization Tree */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          {filteredBranches.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No branches found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredBranches.map((branch, branchIndex) => {
                const isExpanded = expandedBranches.has(branch.id);
                const statusColor = getStatusColor(branch.status);
                
                return (
                  <div key={branch.id} className="relative">
                    {/* Branch Node */}
                    <div className="flex items-start gap-4">
                      {/* Vertical Line Connector */}
                      {branchIndex < filteredBranches.length - 1 && (
                        <div className="absolute left-8 top-24 bottom-0 w-0.5 bg-gray-200" style={{ height: isExpanded ? 'calc(100% - 96px)' : '0px' }}></div>
                      )}
                      
                      {/* Branch Card */}
                      <div className="flex-1">
                        <div className="bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all">
                          <div className="flex items-center gap-4">
                            {/* Expand/Collapse Button */}
                            <button
                              onClick={() => toggleBranch(branch.id)}
                              className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-white" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-white" />
                              )}
                            </button>

                            {/* Branch Icon */}
                            <div className="bg-white h-16 w-16 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <Building2 className="w-8 h-8 text-teal-600" />
                            </div>

                            {/* Branch Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold text-white">{branch.name}</h3>
                                {branch.code && (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/20 text-white">
                                    {branch.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
                                {branch.city && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {branch.city}
                                  </span>
                                )}
                                {branch.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {branch.phone}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 font-semibold bg-white/20 px-2 py-1 rounded-full">
                                  <Users className="w-4 h-4" />
                                  {branch.employeeCount} {branch.employeeCount === 1 ? 'Employee' : 'Employees'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Employees Tree */}
                        {isExpanded && (
                          <div className="mt-4 ml-8 relative">
                            {/* Branch Manager */}
                            {branch.manager && (
                              <div className="mb-4 relative pl-8">
                                {/* Connector Line */}
                                <div className="absolute left-0 top-0 w-6 h-1/2 border-l-2 border-b-2 border-gray-300 rounded-bl-lg"></div>
                                
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 inline-flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
                                  <div className="bg-blue-500 h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 shadow">
                                    <Briefcase className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <div className="text-xs text-blue-600 font-semibold mb-0.5">BRANCH MANAGER</div>
                                    <div className="font-bold text-gray-900">{branch.manager.name}</div>
                                    <div className="text-xs text-gray-600 flex items-center gap-2">
                                      {branch.manager.email && (
                                        <span className="flex items-center gap-1">
                                          <Mail className="w-3 h-3" />
                                          {branch.manager.email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Employees List */}
                            {branch.employees.length > 0 ? (
                              <div className="space-y-3 relative">
                                {branch.employees.map((employee, empIndex) => {
                                  const roleColor = getRoleColor(employee.role);
                                  const empStatusColor = getStatusColor(employee.status);
                                  const isLastEmployee = empIndex === branch.employees.length - 1;
                                  
                                  return (
                                    <div key={employee.id} className="relative pl-8">
                                      {/* Connector Line */}
                                      <div 
                                        className="absolute left-0 top-0 w-6 border-l-2 border-b-2 border-gray-300 rounded-bl-lg"
                                        style={{ 
                                          height: '50%',
                                          borderBottom: '2px solid #d1d5db'
                                        }}
                                      ></div>
                                      {!isLastEmployee && (
                                        <div className="absolute left-0 top-1/2 bottom-0 w-0.5 bg-gray-300"></div>
                                      )}
                                      
                                      {/* Employee Card */}
                                      <div className={`${roleColor.bg} border-2 ${roleColor.border || 'border-gray-200'} rounded-lg p-3 inline-flex items-center gap-3 shadow-sm hover:shadow-md transition-all min-w-[320px]`}>
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                          {employee.avatar ? (
                                            <img 
                                              src={employee.avatar} 
                                              alt={employee.name}
                                              className="h-12 w-12 rounded-full object-cover border-2 border-white shadow"
                                            />
                                          ) : (
                                            <div className={`${roleColor.badge} h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow border-2 border-white`}>
                                              {employee.name.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                          {/* Role Badge */}
                                          <div className={`absolute -bottom-1 -right-1 ${roleColor.badge} h-6 w-6 rounded-full flex items-center justify-center shadow-md border-2 border-white`}>
                                            {getRoleIcon(employee.role)}
                                          </div>
                                        </div>
                                        
                                        {/* Employee Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-gray-900 truncate">{employee.name}</h4>
                                            <span className={`w-2 h-2 rounded-full ${empStatusColor.dot} flex-shrink-0`}></span>
                                          </div>
                                          <div className="mb-1">
                                            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${roleColor.text} uppercase`}>
                                              {employee.role}
                                            </span>
                                          </div>
                                          {employee.email && (
                                            <div className="text-xs text-gray-600 flex items-center gap-1 truncate">
                                              <Mail className="w-3 h-3 flex-shrink-0" />
                                              <span className="truncate">{employee.email}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="pl-8 relative">
                                <div className="absolute left-0 top-0 w-6 h-1/2 border-l-2 border-b-2 border-gray-300 rounded-bl-lg"></div>
                                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 inline-block text-center">
                                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                  <p className="text-gray-500 text-sm">No employees assigned</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
