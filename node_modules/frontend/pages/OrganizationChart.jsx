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

/* Inject org-tree animation CSS once */
const ORG_TREE_STYLE_ID = 'org-chart-tree-anim';
if (typeof document !== 'undefined' && !document.getElementById(ORG_TREE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = ORG_TREE_STYLE_ID;
  style.textContent = `
    @keyframes orgNodeIn {
      0%   { opacity: 0; transform: translateY(10px) scale(0.94); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes orgLineGrowV {
      0%   { transform: scaleY(0); }
      100% { transform: scaleY(1); }
    }
    @keyframes orgLineGrowH {
      0%   { transform: scaleX(0); }
      100% { transform: scaleX(1); }
    }
    .org-node-anim {
      animation: orgNodeIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
    }
    .org-line-anim-v {
      transform-origin: top;
      animation: orgLineGrowV 0.35s ease-out both;
    }
    .org-line-anim-h::before {
      transform-origin: left;
      animation: orgLineGrowH 0.35s ease-out both;
    }
    .org-line-anim-h::after {
      transform-origin: right;
      animation: orgLineGrowH 0.35s ease-out both;
    }
  `;
  document.head.appendChild(style);
}

/* Tree-connector utility classes (classic pure-CSS org-chart pattern):
   each child in a row grows a vertical stub up to a shared horizontal bus,
   which is trimmed to a half-line for the first/last child so the bus only
   spans between siblings (and vanishes entirely for a single/only child). */
const TREE_CHILD = "relative pt-10 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-[var(--border-color)] first:before:left-1/2 last:before:right-1/2 after:content-[''] after:absolute after:top-0 after:left-1/2 after:-translate-x-1/2 after:w-px after:h-10 after:bg-[var(--border-color)]";

export default function OrganizationChart({ user }) {
  const [orgData, setOrgData] = useState({ orgChart: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBranches, setExpandedBranches] = useState(new Set());
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [treeMode, setTreeMode] = useState('animated'); // 'animated' or 'standard'
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
      bg: 'bg-[var(--bg-surface)]',
      text: 'text-purple-500',
      badge: 'bg-purple-500',
      border: 'border-[var(--border-color)]'
    };
    if (role === 'manager') return {
      bg: 'bg-[var(--bg-surface)]',
      text: 'text-blue-500',
      badge: 'bg-blue-500',
      border: 'border-[var(--border-color)]'
    };
    return {
      bg: 'bg-[var(--bg-surface)]',
      text: 'text-teal-500',
      badge: 'bg-teal-500',
      border: 'border-[var(--border-color)]'
    };
  };

  const getStatusColor = (status) => {
    if (status === 'active') return { bg: 'bg-[var(--bg-primary)]', text: 'text-green-500', dot: 'bg-green-500' };
    return { bg: 'bg-[var(--bg-primary)]', text: 'text-[var(--text-secondary)]', dot: 'bg-gray-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading organization chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-full max-w-[1800px] mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Organization Chart</h1>
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Home className="w-4 h-4" />
            <span>&gt;</span>
            <span>Properties</span>
            <span>&gt;</span>
            <span>Organization Chart</span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-md border border-[var(--border-color)] transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 h-12 w-12 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Branches</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{orgData.stats.totalBranches || 0}</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-md border border-[var(--border-color)] transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 text-teal-600 h-12 w-12 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Employees</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{orgData.stats.totalEmployees || 0}</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-md border border-[var(--border-color)] transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 text-purple-600 h-12 w-12 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Admins</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{orgData.stats.byRole?.admin || 0}</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl p-4 shadow-md border border-[var(--border-color)] transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 text-orange-600 h-12 w-12 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Managers</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{orgData.stats.byRole?.manager || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-md border border-[var(--border-color)] p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)]/60 w-4 h-4" />
              <input
                type="text"
                placeholder="Search branches or employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none text-sm placeholder:text-[var(--text-secondary)]/50"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none text-sm"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="staff">Staff</option>
            </select>

            <button
              onClick={expandAll}
              className="px-4 py-2 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-medium rounded-xl hover:bg-[var(--bg-primary)] transition-colors"
            >
              Collapse All
            </button>

            {/* Standard / Animated tree toggle */}
            <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-1">
              <button
                onClick={() => setTreeMode('standard')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${treeMode === 'standard'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                  }`}
              >
                Standard
              </button>
              <button
                onClick={() => setTreeMode('animated')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${treeMode === 'animated'
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                  }`}
              >
                Animated
              </button>
            </div>
          </div>
        </div>

        {/* Organization Tree */}
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-md border border-[var(--border-color)] p-6 overflow-x-auto">
          {filteredBranches.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-[var(--text-secondary)]/30 mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">No branches found</p>
            </div>
          ) : (
            <div className="min-w-max flex flex-col items-center py-2">
              {/* Root: Main Branch */}
              <div
                key={treeMode}
                className={`flex flex-col items-center gap-2 bg-[var(--accent-primary)] rounded-2xl px-8 py-4 shadow-lg ${treeMode === 'animated' ? 'org-node-anim' : ''}`}
                style={treeMode === 'animated' ? { animationDelay: '0ms' } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-white leading-tight">Main Branch</div>
                    <div className="text-xs text-white/80">
                      {orgData.stats.totalBranches || 0} branches &middot; {orgData.stats.totalEmployees || 0} employees
                    </div>
                  </div>
                </div>
              </div>

              {/* Stem from root down to the branch row */}
              <div
                className={`w-px h-10 bg-[var(--border-color)] ${treeMode === 'animated' ? 'org-line-anim-v' : ''}`}
                style={treeMode === 'animated' ? { animationDelay: '150ms' } : undefined}
              />

              {/* Branch row */}
              <div className="flex items-start gap-6 px-4">
                {filteredBranches.map((branch, branchIndex) => {
                  const isExpanded = expandedBranches.has(branch.id);
                  const nodeDelay = 200 + branchIndex * 90;

                  return (
                    <div key={branch.id} className={TREE_CHILD}>
                      {/* Branch Card */}
                      <div
                        className={`w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${treeMode === 'animated' ? 'org-node-anim' : ''}`}
                        style={treeMode === 'animated' ? { animationDelay: `${nodeDelay}ms` } : undefined}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] h-14 w-14 rounded-xl flex items-center justify-center shadow-sm">
                            <Building2 className="w-7 h-7 text-[var(--accent-primary)]" />
                          </div>
                          <div className="min-w-0 w-full">
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                              <h3 className="font-bold text-[var(--text-primary)] truncate">{branch.name}</h3>
                              {branch.code && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] flex-shrink-0">
                                  {branch.code}
                                </span>
                              )}
                            </div>
                            {branch.city && (
                              <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-secondary)] mb-2">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{branch.city}</span>
                              </div>
                            )}
                            <button
                              onClick={() => toggleBranch(branch.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/30 transition-colors"
                            >
                              <Users className="w-3.5 h-3.5" />
                              {branch.employeeCount} {branch.employeeCount === 1 ? 'Employee' : 'Employees'}
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Employees under this branch */}
                      {isExpanded && (
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-px h-8 bg-[var(--border-color)] ${treeMode === 'animated' ? 'org-line-anim-v' : ''}`}
                            style={treeMode === 'animated' ? { animationDelay: `${nodeDelay + 120}ms` } : undefined}
                          />
                          {branch.manager || branch.employees.length > 0 ? (
                            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/60 p-3 flex flex-wrap justify-center gap-2 max-w-[280px]">
                              {branch.manager && (
                                <EmployeeChip
                                  key={`mgr-${branch.id}`}
                                  name={branch.manager.name}
                                  email={branch.manager.email}
                                  isManager
                                  delay={treeMode === 'animated' ? nodeDelay + 180 : null}
                                  animated={treeMode === 'animated'}
                                />
                              )}
                              {branch.employees.map((employee, empIndex) => (
                                <EmployeeChip
                                  key={employee.id}
                                  name={employee.name}
                                  email={employee.email}
                                  role={employee.role}
                                  status={employee.status}
                                  avatar={employee.avatar}
                                  roleColor={getRoleColor(employee.role)}
                                  statusColor={getStatusColor(employee.status)}
                                  roleIcon={getRoleIcon(employee.role)}
                                  delay={treeMode === 'animated' ? nodeDelay + 180 + empIndex * 30 : null}
                                  animated={treeMode === 'animated'}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/60 px-4 py-3 text-center">
                              <p className="text-[var(--text-secondary)] text-xs">No employees assigned</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Small leaf node used under a branch to represent its manager/employees */
function EmployeeChip({ name, email, role, status, avatar, roleColor, statusColor, roleIcon, isManager, delay, animated }) {
  const bg = isManager ? 'bg-blue-500' : (roleColor?.badge || 'bg-teal-500');

  return (
    <div
      className={`w-[124px] flex flex-col items-center text-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-2.5 shadow-sm transition-all hover:shadow-md ${animated ? 'org-node-anim' : ''}`}
      style={animated ? { animationDelay: `${delay}ms` } : undefined}
      title={email || name}
    >
      <div className="relative">
        {avatar ? (
          <img src={avatar} alt={name} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow" />
        ) : (
          <div className={`${bg} h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow border-2 border-white`}>
            {name?.charAt(0).toUpperCase()}
          </div>
        )}
        {!isManager && status && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-surface)] ${statusColor?.dot || 'bg-gray-400'}`} />
        )}
        {isManager && (
          <div className="absolute -bottom-1 -right-1 bg-blue-500 h-5 w-5 rounded-full flex items-center justify-center shadow-md border-2 border-[var(--bg-surface)]">
            <Briefcase className="w-3 h-3 text-white" />
          </div>
        )}
        {!isManager && roleIcon && (
          <div className={`absolute -top-1 -right-1 ${bg} h-5 w-5 rounded-full flex items-center justify-center shadow-md border-2 border-[var(--bg-surface)]`}>
            {roleIcon}
          </div>
        )}
      </div>
      <div className="min-w-0 w-full">
        <div className="text-xs font-bold text-[var(--text-primary)] truncate">{name}</div>
        <div className={`text-[10px] font-semibold uppercase truncate ${isManager ? 'text-blue-500' : (roleColor?.text || 'text-[var(--text-secondary)]')}`}>
          {isManager ? 'Manager' : role}
        </div>
      </div>
    </div>
  );
}
