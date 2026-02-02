/* eslint-disable no-unused-vars */
/* src/pages/LeaveReport.jsx */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

axios.defaults.withCredentials = true;

function IconBadge({ color = "#111827", children }) {
  // light background using a low-opacity tint of the color
  const bg = `${color}20`; // tailwind-like hex + alpha fallback (not perfect but ok)
  return (
    <div
      className="w-10 h-10 rounded-md flex items-center justify-center"
      style={{
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function KPI({ title, value, note, icon }) {
  return (
    <div className="bg-white rounded-md shadow p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="text-2xl font-bold mt-2">{value}</div>
          {note && <div className="text-xs text-green-500 mt-2">{note}</div>}
        </div>
        {icon && <div className="text-2xl text-slate-300">{icon}</div>}
      </div>
    </div>
  );
}

function LeaveRow({ r }) {
  return (
    <tr>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <img src={r.avatar || `https://i.pravatar.cc/40?u=${r.employee_id}`} alt="" className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-medium">{r.employee_name}</div>
            <div className="text-xs text-slate-500">{r.hotel_name || r.branch || ""}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm">{r.from_date_str} — {r.to_date_str}</div>
        <div className="text-xs text-slate-400">{r.days} day(s)</div>
      </td>
      <td className="py-3 px-4">{r.type}</td>
      <td className="py-3 px-4">
        <span className={`inline-block text-xs px-2 py-1 rounded ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" : r.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-rose-100 text-rose-700"}`}>
          {r.status}
        </span>
      </td>
      <td className="py-3 px-4">{r.reason ? (r.reason.length > 60 ? r.reason.slice(0, 60) + "..." : r.reason) : "-"}</td>
    </tr>
  );
}

export default function LeaveReport() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});
  const [monthly, setMonthly] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  // filters
  const [range, setRange] = useState({ start: null, end: null });
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("thisyear");

  async function fetchData() {
    setLoading(true);
    try {
      const params = { limit, offset };
      if (range.start) params.start = range.start;
      if (range.end) params.end = range.end;
      if (typeFilter) params.type = typeFilter;
      if (sortBy) params.sort = sortBy;

      const res = await axios.get("/api/admin/reports/leaves", { params });
      const body = res?.data || {};
      setMetrics(body.metrics || {});
      setMonthly(body.monthly || []);
      setRows(body.leaves || []);
      setTotal(body.total || 0);
    } catch (err) {
      console.error("Leave report load failed:", err);
      setMetrics({});
      setMonthly([]);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, range.start, range.end, typeFilter, sortBy]);

  // Trigger resize after loading so charts recalc dimensions
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
      return () => clearTimeout(t);
    }
  }, [loading, monthly]);

  const chartData = useMemo(() => {
    // monthly: [{month, annual, casual, medical, others}]
    return (monthly || []).map((m) => ({
      name: m.month,
      annual: m.annual,
      casual: m.casual,
      medical: m.medical,
      others: m.others,
    }));
  }, [monthly]);

  // SVG icons (matching style in your second screenshot)
  const IconUser = (
    <IconBadge color="#FB923C">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.2" stroke="#FB923C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" stroke="#FB923C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </IconBadge>
  );

  const IconCheck = (
    <IconBadge color="#10B981">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="#10B981" strokeWidth="1.4" fill="none" />
        <path d="M7 12.5l2.5 2.5L17 8" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </IconBadge>
  );

  const IconHourglass = (
    <IconBadge color="#60A5FA">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 4h10M7 20h10M7 4v4a4 4 0 004 4 4 4 0 004-4V4" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M7 20v-4a4 4 0 004-4 4 4 0 004 4v4" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </IconBadge>
  );

  const IconX = (
    <IconBadge color="#EF4444">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="#EF4444" strokeWidth="1.4" fill="none" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </IconBadge>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading hotel...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-9xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Leave Report</h1>
            <div className="text-sm text-slate-500 mt-1">Home / HR / Leave Report</div>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-white px-3 py-2 rounded shadow">Export</button>
            <button className="bg-white p-2 rounded shadow">^</button>
          </div>
        </div>

        {/* KPIs and chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <KPI title="Total Leaves" value={metrics.totalLeaves ?? 0} note="Last Month" icon={IconUser} />
          <KPI title="Approved Leaves" value={metrics.approvedLeaves ?? 0} note="Last Month" icon={IconCheck} />
          <KPI title="Pending Requests" value={metrics.pendingRequests ?? 0} note="Last Month" icon={IconHourglass} />
          <KPI title="Rejected Leaves" value={metrics.rejectedLeaves ?? 0} note="Last Month" icon={IconX} />
          <div className="bg-white rounded-md shadow p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Leaves</div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500">This Year</div>
                <select className="border rounded px-2 py-1 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="thisyear">This Year</option>
                  <option value="lastyear">Last Year</option>
                </select>
              </div>
            </div>

            {/* IMPORTANT: explicit height so ResponsiveContainer has positive size */}
            <div style={{ width: "100%", height: 260, minWidth: 0, minHeight: 200 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="annual" stackId="a" />
                  <Bar dataKey="casual" stackId="a" />
                  <Bar dataKey="medical" stackId="a" />
                  <Bar dataKey="others" stackId="a" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-md shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="font-semibold">Employee Leaves</div>
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
                  <th className="p-4">Employee</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Reason</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No leaves found.</td></tr>
                ) : (
                  rows.map((r) => <LeaveRow key={r.id || `${r.employee_id}_${r.from_date_str}`} r={r} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
