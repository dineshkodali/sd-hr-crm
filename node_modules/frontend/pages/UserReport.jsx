/* eslint-disable no-prototype-builtins */
/* src/pages/UserReport.jsx */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
axios.defaults.withCredentials = true;

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

function safeDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString();
}

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString();
}

/* small month bar chart (client-side) */
function MonthBarChart({ months = [] /* [{month:'Jan',value:10},...] */, height = 120 }) {
  if (!months || months.length === 0) {
    return <div className="h-32 flex items-center justify-center text-sm text-gray-400">No chart data</div>;
  }
  const max = Math.max(...months.map((m) => m.value), 1);
  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${months.length * 40} ${height}`} preserveAspectRatio="xMidYMid meet">
        {months.map((m, i) => {
          const barH = (m.value / max) * (height - 30);
          const x = i * 40 + 10;
          const y = height - barH - 20;
          return (
            <g key={m.month || i}>
              <rect x={x} y={y} width="20" height={barH} rx="3" ry="3" fill="#34D399" />
              <text x={x + 10} y={height - 6} textAnchor="middle" fontSize="10" fill="#374151">{m.month}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function UserReport() {
  const q = useQuery();
  const branch = q.get("branch") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    newUsers: 0,
    inactive: 0,
  });
  const [months, setMonths] = useState([]);

  // table / ui state
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState(`${new Date().toLocaleDateString()}`);
  const [sortBy, setSortBy] = useState("last7");

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        // Fetch users from backend endpoint that already enforces admin/manager scoping
        const res = await axios.get("/api/admin/users", {
          params: {}, // server scoping; frontend filters further
          withCredentials: true,
          signal: controller.signal,
        });
        if (!mounted) return;
        const rows = res.data?.users || [];
        setUsers(rows);

        // Compute metrics
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        let total = rows.length;
        let active = 0;
        let inactive = 0;
        let newUsers = 0;

        // build months map (last 12 months)
        const monthsMap = {};
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = d.toLocaleString(undefined, { month: "short" });
          monthsMap[key] = 0;
        }

        rows.forEach((u) => {
          const s = (u.status || "").toString().toLowerCase();
          if (s === "active" || s === "1" || s === "true") active++;
          else inactive++;

          const created = u.joining_date || u.created_at || u.created_on || u.createdDate || null;
          if (created) {
            const d = new Date(created);
            if (!isNaN(d.getTime())) {
              if (d >= thirtyDaysAgo) newUsers++;
              const key = d.toLocaleString(undefined, { month: "short" });
              if (Object.prototype.hasOwnProperty.call(monthsMap, key)) monthsMap[key] += 1;
            }
          }
        });

        setMetrics({ total, active, newUsers, inactive });

        const monthsArr = Object.keys(monthsMap).map((k) => ({ month: k, value: monthsMap[k] }));
        setMonths(monthsArr);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("users load error:", err);
        setError(err?.response?.data?.message || err.message || "Failed to load users");
        setUsers([]);
        setMetrics({ total: 0, active: 0, newUsers: 0, inactive: 0 });
        setMonths([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [branch]); // branch included if you pass ?branch= in URL

  // client-side filtered list
  const filtered = useMemo(() => {
    if (!users || users.length === 0) return [];
    const s = (search || "").toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter && String(u.role || "").toLowerCase() !== String(roleFilter).toLowerCase()) return false;
      if (statusFilter && String(u.status || "").toLowerCase() !== String(statusFilter).toLowerCase()) return false;
      if (!s) return true;
      const name = (u.name || "").toString().toLowerCase();
      const email = (u.email || "").toString().toLowerCase();
      const phone = (u.phone || "").toString().toLowerCase();
      return name.includes(s) || email.includes(s) || phone.includes(s);
    });
  }, [users, search, roleFilter, statusFilter]);

  const exportCSV = () => {
    const headers = ["Name", "Email", "Role", "Status", "Phone", "Joining Date", "Branch"];
    const rows = (filtered || []).map((u) => [
      u.name || "",
      u.email || "",
      u.role || "",
      u.status || "",
      u.phone || "",
      u.joining_date || u.created_at || "",
      u.branch || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users${branch ? `-${branch}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showFrom = offset + 1;
  const showTo = Math.min(offset + limit, filtered.length);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-9xl mx-auto">
        {/* header */}
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">User Report</h1>
            <div className="text-sm text-gray-500 mt-1">Home / HR / User Report {branch ? ` (Branch: ${branch})` : ""}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2">
              <button onClick={exportCSV} className="px-4 py-2 border rounded bg-white">Export</button>
              <button className="px-3 py-2 border rounded bg-white">↑</button>
            </div>
          </div>
        </header>

        {/* KPI + chart */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">Total Users</div>
              <div className="text-2xl font-bold mt-2">{metrics.total}</div>
              <div className="text-xs text-green-600 mt-2">↗ +20.01% from last week</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">Active Users</div>
              <div className="text-2xl font-bold mt-2">{metrics.active}</div>
              <div className="text-xs text-green-600 mt-2">↗ +17.02% from last week</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">New Users</div>
              <div className="text-2xl font-bold mt-2">{metrics.newUsers}</div>
              <div className="text-xs text-green-600 mt-2">↗ +10.01% from last week</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">Inactive Users</div>
              <div className="text-2xl font-bold mt-2">{metrics.inactive}</div>
              <div className="text-xs text-red-600 mt-2">↘ -10.01% from last week</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">Users</div>
                <div className="text-xs text-gray-400">Active Users / Inactive Users</div>
              </div>
              <div>
                <select className="px-3 py-2 border rounded bg-white text-sm">
                  <option>This Year</option>
                </select>
              </div>
            </div>

            <div className="mb-2">
              <MonthBarChart months={months} height={140} />
            </div>
          </div>
        </section>

        {/* filters */}
        <section className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <div>
                <label className="text-xs text-gray-400">Date range</label>
                <input type="text" value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="ml-2 px-3 py-2 border rounded" placeholder="11/13/2025 - 11/19/2025" />
              </div>

              <div>
                <label className="text-xs text-gray-400">Role</label>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="thisyear">This Year</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">Row Per Page</div>
              <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }} className="px-3 py-2 border rounded">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>

              <div>
                <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 border rounded" />
              </div>
            </div>
          </div>
        </section>

        {/* table */}
        <section className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Users List</h3>
              <div className="text-sm text-gray-500">Showing {showFrom} to {showTo} of {(filtered || []).length}</div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  {/* checkbox column removed */}
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="p-6 text-center">Loading users...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No users found.</td></tr>
                ) : (
                  filtered.slice(offset, offset + limit).map((u) => {
                    const id = u.id || u.email || JSON.stringify(u);
                    const name = u.name || "—";
                    const email = u.email || "—";
                    const created = u.joining_date || u.created_at || u.created_on || "";
                    const role = u.role || "—";
                    const status = (u.status || "").toString().toLowerCase();
                    return (
                      <tr key={id} className="border-b hover:bg-gray-50">
                        {/* checkbox removed */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs">
                              {u.avatar ? <img src={u.avatar} alt={name} className="w-full h-full object-cover" /> : (name || "U").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{name}</div>
                              <div className="text-xs text-gray-400">{u.designation || u.title || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{email}</td>
                        <td className="p-3">{safeDate(created)}</td>
                        <td className="p-3">{role}</td>
                        <td className="p-3">
                          {status === "active" ? <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Active</span> :
                           status === "inactive" ? <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Inactive</span> :
                           <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{u.status || "—"}</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500"> {/* selection count removed */} </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded">Prev</button>
              <button onClick={() => setOffset(Math.min(Math.max(0, filtered.length - limit), offset + limit))} className="px-3 py-1 border rounded">Next</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
