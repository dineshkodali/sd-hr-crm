/* src/pages/DailyReport.jsx */
/* A dashboard-style Daily Report page that mirrors the screenshot you provided.
   - Fetches KPIs, chart series and rows from /api/admin/reports/daily (branch supported via ?branch=)
   - Layout: KPI cards (4), right-side line chart, table list below
   - Uses Recharts ResponsiveContainer for the chart
*/
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

axios.defaults.withCredentials = true;

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

function KPI({ title, value, note, badge }) {
  return (
    <div className="bg-white rounded-md shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="text-2xl font-bold mt-2">{value}</div>
          {note && <div className="text-xs text-slate-500 mt-2">{note}</div>}
        </div>

        {badge && (
          <div className="w-10 h-10 rounded-full border flex items-center justify-center text-slate-600">{badge}</div>
        )}
      </div>
    </div>
  );
}

function TableRow({ r }) {
  return (
    <tr>
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <img src={r.avatar || `https://i.pravatar.cc/40?u=${r.user_id || r.id}`} alt="" className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-medium">{r.name || r.employee_name || r.user_name}</div>
            <div className="text-xs text-slate-500">{r.department || r.designation || "-"}</div>
          </div>
        </div>
      </td>
      <td className="py-4 px-6">{r.date_str || r.date || "-"}</td>
      <td className="py-4 px-6">{r.check_in || "-"}</td>
      <td className="py-4 px-6">
        <span className={`inline-block text-xs px-2 py-1 rounded ${r.status === "present" ? "bg-emerald-100 text-emerald-700" : r.status === "absent" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
          {r.status}
        </span>
      </td>
      <td className="py-4 px-6">{r.notes || r.remarks || "-"}</td>
    </tr>
  );
}

export default function DailyReport() {
  const q = useQuery();
  const branch = q.get("branch") || "";

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});
  const [series, setSeries] = useState([]); // monthly/daily points for chart
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/admin/reports/daily", { params: { branch: branch || undefined, limit, offset } });
      const body = res?.data || {};

      // metrics expected: { totalPresent, completedTasks, totalAbsent, pendingTasks }
      setMetrics(body.metrics || body.kpis || {});

      // series expected: [{name: 'Jan', present: 10, absent:5}, ...] or daily points
      setSeries(body.series || body.monthly || []);

      // rows expected as array
      setRows(body.rows || body.attendance || body.daily || []);

      setTotal(Number(body.total ?? body.count ?? (body.rows || []).length ?? 0));
    } catch (err) {
      console.error("Daily report load failed:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load daily report");
      setMetrics({});
      setSeries([]);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
      // trigger resize to help chart libraries
      setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, limit, offset]);

  const chartData = useMemo(() => (series || []).map((s) => ({ name: s.month || s.day || s.label || s.name, present: s.present || s.present_count || s.present_total || 0, absent: s.absent || s.absent_count || 0 })), [series]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-9xl mx-auto">
        {/* header */}
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Daily Report</h1>
            <div className="text-sm text-gray-500 mt-1">Home / HR / Daily Report {branch ? `(Branch: ${branch})` : ""}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2">
              <button className="px-4 py-2 border rounded bg-white">Export</button>
              <button className="px-3 py-2 border rounded bg-white">↑</button>
            </div>
          </div>
        </header>

        {/* KPI + chart */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <KPI title="Total Present" value={metrics.totalPresent ?? metrics.present ?? 0} note={metrics.deltaPresent ? `${metrics.deltaPresent} from last week` : null} badge={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="#FB923C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>} />

            <KPI title="Completed Tasks" value={metrics.completedTasks ?? 0} note={metrics.deltaCompleted ? `${metrics.deltaCompleted} from last week` : null} badge={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12l4 4L21 6" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>} />

            <KPI title="Total Absent" value={metrics.totalAbsent ?? metrics.absent ?? 0} note={metrics.deltaAbsent ? `${metrics.deltaAbsent} from last week` : null} badge={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="19" r="1.5" fill="#EF4444"/></svg>} />

            <KPI title="Pending Tasks" value={metrics.pendingTasks ?? 0} note={metrics.deltaPending ? `${metrics.deltaPending} from last week` : null} badge={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2v4M12 18v4M4 12h16" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-lg font-semibold">Daily Attendance</div>
                <div className="text-xs text-gray-400">Present / Absent</div>
              </div>

              <div>
                <select className="px-3 py-2 border rounded bg-white text-sm">
                  <option>This Year</option>
                </select>
              </div>
            </div>

            <div style={{ width: "100%", height: 180, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Table */}
        <div className="bg-white rounded-md shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="font-semibold">Daily Attendance List</div>
              <div className="text-sm text-slate-500">Row Per Page
                <select className="ml-2 border rounded px-2 py-1" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="text" placeholder="Search" className="border rounded px-3 py-2 text-sm" onChange={() => {}} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="p-4">Name</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Check In</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Notes</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No records found.</td></tr>
                ) : (
                  rows.map((r) => <TableRow key={r.id || `${r.user_id || r.name}_${r.date_str || r.date}`} r={r} />)
                )}
              </tbody>
            </table>
          </div>

          {/* pagination toolbar */}
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Showing {Math.min(offset+1, total)} - {Math.min(offset+limit, total)} of {total}</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded">Prev</button>
              <button onClick={() => setOffset(Math.min(Math.max(0, total - limit), offset + limit))} className="px-3 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 text-red-600">{error}</div>}
      </div>
    </div>
  );
}
