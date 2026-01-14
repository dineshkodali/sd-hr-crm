/* src/pages/TaskReport.jsx */
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

/* tiny donut component */
function DonutSimple({ data = [], size = 220, inner = 72 }) {
  const r = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = (data || []).reduce((s, x) => s + (Number(x.value) || 0), 0);
  const colors = ["#34D399", "#60A5FA", "#F59E0B", "#A78BFA", "#FB7185", "#EF4444"];

  if (!total) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center text-sm text-gray-400">
        No chart data
      </div>
    );
  }

  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${r},${r})`}>
        <circle r={r} fill="transparent" stroke="#f3f4f6" strokeWidth={r - inner} />
        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const frac = v / total;
          const dash = frac * circumference;
          const gap = Math.max(0, circumference - dash);
          const rotate = (acc / Math.max(total, 1)) * 360;
          acc += v;
          return (
            <circle
              key={i}
              r={r}
              fill="transparent"
              stroke={colors[i % colors.length]}
              strokeWidth={r - inner}
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rotate})`}
            />
          );
        })}
        <circle r={inner} fill="#fff" />
        <text x="0" y="-6" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: "#10B981" }}>
          {data[0] ? `${Math.round((Number(data[0].value) / total) * 100)}%` : "0%"}
        </text>
        <text x="0" y="18" textAnchor="middle" style={{ fontSize: 12, fill: "#6b7280" }}>
          Pending
        </text>
      </g>
    </svg>
  );
}

export default function TaskReport() {
  const q = useQuery();
  const projectParam = q.get("project") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    total: 0,
    completed: 0,
    inprogress: 0,
    pending: 0,
  });
  const [breakdown, setBreakdown] = useState([]); // pie segments
  const [tasks, setTasks] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // UI state
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(`${new Date().toLocaleDateString()}`);
  const [priority, setPriority] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("last7");
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectAllPage, setSelectAllPage] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        // WIRED to backend endpoint /api/admin/reports/tasks
        const res = await axios.get("/api/admin/reports/tasks", {
          params: {
            project: projectParam || undefined,
            limit,
            offset,
            priority: priority || undefined,
            status: statusFilter || undefined,
            sort: sortBy || undefined,
            date_range: dateRange || undefined,
          },
          withCredentials: true,
          signal: controller.signal,
        });

        if (!mounted) return;
        const d = res.data || {};

        setMetrics({
          total: Number(d.metrics?.total ?? (d.total || 0)),
          completed: Number(d.metrics?.completed ?? 0),
          inprogress: Number(d.metrics?.inprogress ?? 0),
          pending: Number(d.metrics?.pending ?? 0),
        });

        // breakdown: accept {name, value} or map common shaped payloads
        setBreakdown(
          (d.breakdown || d.byStatus || []).map((r) => ({
            name: r.name || r.status || r.label || "Unknown",
            value: Number(r.value ?? r.count ?? r.total ?? 0),
          }))
        );

        setTasks(Array.isArray(d.tasks) ? d.tasks : (Array.isArray(d.rows) ? d.rows : []));
        setTotalCount(Number(d.total ?? d.metrics?.total ?? (d.tasks || []).length ?? 0));
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("tasks load error:", err);
        setError(err?.response?.data?.message || err.message || "Failed to load tasks");
        setTasks([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [projectParam, limit, offset, priority, statusFilter, sortBy, dateRange]);

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const s = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const name = (t.name || t.task_name || "").toString().toLowerCase();
      const project = (t.project_name || t.project || "").toString().toLowerCase();
      const status = (t.status || "").toString().toLowerCase();
      return name.includes(s) || project.includes(s) || status.includes(s);
    });
  }, [tasks, search]);

  const toggleRow = (id) => {
    setSelectedRows((prev) => {
      const next = new Set([...prev]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (selectAllPage) {
      setSelectedRows(new Set());
      setSelectAllPage(false);
    } else {
      const pageIds = (filtered || []).slice(0, limit).map((r) => r.id || r.task_id || JSON.stringify(r));
      setSelectedRows(new Set(pageIds));
      setSelectAllPage(true);
    }
  };

  const showFrom = offset + 1;
  const showTo = Math.min(offset + limit, totalCount || (filtered || []).length);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-9xl mx-auto">
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Task Report</h1>
            <div className="text-sm text-gray-500 mt-1">Home / HR / Task Report {projectParam ? ` (Project: ${projectParam})` : ""}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2">
              <button className="px-4 py-2 border rounded bg-white">Export</button>
              <button className="px-3 py-2 border rounded bg-white">↑</button>
            </div>
          </div>
        </header>

        {/* main KPI + chart row */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-md shadow-sm p-4">
              <div className="text-sm text-gray-500">Total Tasks</div>
              <div className="text-2xl font-bold mt-2">{metrics.total ?? 0}</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-4">
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold mt-2">{metrics.completed ?? 0}</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-4">
              <div className="text-sm text-gray-500">In Progress</div>
              <div className="text-2xl font-bold mt-2">{metrics.inprogress ?? 0}</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-4">
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-2xl font-bold mt-2">{metrics.pending ?? 0}</div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">Tasks</div>
              </div>

              <div>
                <select value={projectParam} onChange={() => {}} className="px-3 py-2 border rounded bg-white text-sm">
                  <option value="">All Projects</option>
                  <option value="Office Management App">Office Management App</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div style={{ width: 260, height: 260 }}>
                <DonutSimple data={breakdown} size={260} inner={88} />
              </div>

              <div className="flex-1">
                <ul className="grid grid-cols-2 gap-3 text-sm">
                  {breakdown && breakdown.length ? (
                    breakdown.map((b, i) => (
                      <li key={b.name + i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span style={{ width: 10, height: 10, borderRadius: 6, background: ["#34D399", "#60A5FA", "#F59E0B", "#A78BFA", "#FB7185", "#EF4444"][i % 6] }} />
                          <div>
                            <div className="font-medium">{b.name}</div>
                            <div className="text-xs text-gray-400">{b.value}</div>
                          </div>
                        </div>

                        <div className="font-semibold">{Math.round((Number(b.value) / Math.max(breakdown.reduce((s,x)=>s+(Number(x.value)||0),0),1)) * 100)}%</div>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400 col-span-2">No data</li>
                  )}
                </ul>
              </div>
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
                <label className="text-xs text-gray-400">Select Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Select Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="completed">Completed</option>
                  <option value="inprogress">In Progress</option>
                  <option value="pending">Pending</option>
                  <option value="onhold">On Hold</option>
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
              <h3 className="text-lg font-semibold">Tasks List</h3>
              <div className="text-sm text-gray-500">Showing {showFrom} to {showTo} of {totalCount || (filtered || []).length}</div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="p-3 w-6">
                    <input type="checkbox" checked={selectAllPage} onChange={toggleSelectAllPage} />
                  </th>
                  <th className="p-3">Task Name</th>
                  <th className="p-3">Project Name</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="p-6 text-center">Loading tasks...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="7" className="p-6 text-center text-gray-500">No tasks found.</td></tr>
                ) : (
                  filtered.slice(offset, offset + limit).map((t) => {
                    const id = t.id || t.task_id || JSON.stringify(t);
                    const name = t.name || t.task_name || "Untitled";
                    const proj = t.project_name || t.project || "—";
                    const created = t.created_at || t.created_date || t.created_on || "";
                    const due = t.due_date || t.due || "";
                    const pr = (t.priority || "").toString().toLowerCase();
                    const status = (t.status || "").toString().toLowerCase();

                    const prBadge =
                      pr === "low" ? <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Low</span> :
                      pr === "medium" ? <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">Medium</span> :
                      pr === "high" ? <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">High</span> :
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">—</span>;

                    const statusBadge =
                      status === "completed" ? <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Completed</span> :
                      status === "inprogress" ? <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">Inprogress</span> :
                      status === "pending" ? <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Pending</span> :
                      status === "onhold" ? <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">On Hold</span> :
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{t.status || "—"}</span>;

                    return (
                      <tr key={id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <input type="checkbox" checked={selectedRows.has(id)} onChange={() => toggleRow(id)} />
                        </td>
                        <td className="p-3 font-medium">{name}</td>
                        <td className="p-3 text-gray-600">{proj}</td>
                        <td className="p-3">{safeDate(created)}</td>
                        <td className="p-3">{safeDate(due)}</td>
                        <td className="p-3">{prBadge}</td>
                        <td className="p-3">{statusBadge}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Selected: {selectedRows.size}</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded">Prev</button>
              <button onClick={() => setOffset(Math.min(Math.max(0, totalCount - limit), offset + limit))} className="px-3 py-1 border rounded">Next</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
