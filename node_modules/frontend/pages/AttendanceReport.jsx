/* eslint-disable no-unused-vars */
// src/pages/AttendanceReport.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

axios.defaults.withCredentials = true;

function KPI({ title, value, note }) {
  return (
    <div className="bg-white rounded-md shadow p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
      {note && <div className="text-xs text-green-500 mt-2">{note}</div>}
    </div>
  );
}

function TableRow({ r }) {
  return (
    <tr>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <img src={r.avatar || `https://i.pravatar.cc/40?u=${r.employee_id}`} alt="" className="w-10 h-10 rounded-full" />
          <div>
            <div className="font-medium">{r.employee_name}</div>
            <div className="text-xs text-slate-500">{r.designation}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">{r.date_str}</td>
      <td className="py-3 px-4">{r.check_in || "-"}</td>
      <td className="py-3 px-4">
        <span className={`inline-block text-xs px-2 py-1 rounded ${r.status === "present" ? "bg-emerald-100 text-emerald-700" : r.status === "absent" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
          {r.status}
        </span>
      </td>
      <td className="py-3 px-4">{r.check_out || "-"}</td>
      <td className="py-3 px-4">{r.break_minutes ? `${r.break_minutes} Min` : "-"}</td>
      <td className="py-3 px-4">{r.late_minutes ? `${r.late_minutes} Min` : "-"}</td>
      <td className="py-3 px-4">{r.overtime_minutes ? `${r.overtime_minutes} Min` : "-"}</td>
      <td className="py-3 px-4">{r.production_hours ? `${Number(r.production_hours).toFixed(2)} Hrs` : "-"}</td>
    </tr>
  );
}

export default function AttendanceReport() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});
  const [monthly, setMonthly] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  // filters
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [statusFilter, setStatusFilter] = useState(""); // present/absent/leave/any

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { limit, offset };
      if (dateRange.start) params.start = dateRange.start;
      if (dateRange.end) params.end = dateRange.end;
      if (statusFilter) params.status = statusFilter;

      const res = await axios.get("/api/admin/reports/attendance", { params });
      const body = res?.data || {};
      setMetrics(body.metrics || {});
      setMonthly(body.monthly || []);
      setRows(body.attendance || []);
      setTotal(body.total || 0);
    } catch (err) {
      console.error("Failed to load attendance report:", err);
      setMetrics({});
      setMonthly([]);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, dateRange.start, dateRange.end, statusFilter]);

  // When data finishes loading, trigger a resize event to help ResponsiveContainer recalc
  useEffect(() => {
    if (!loading) {
      // small timeout helps when component is inside a transition/tab
      const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
      return () => clearTimeout(t);
    }
  }, [loading, monthly]);

  const chartData = useMemo(() => {
    // monthly is [{month, present, absent, late}]
    return (monthly || []).map((m) => ({ name: m.month, present: m.present, absent: m.absent }));
  }, [monthly]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-9xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Attendance Report</h1>
          <div className="flex gap-3">
            <button className="bg-white px-3 py-2 rounded shadow">Export</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <KPI title="Total Working Days" value={metrics.totalWorkingDays ?? 0} note={null} />
          <KPI title="Total Leave Taken" value={metrics.totalLeave ?? 0} />
          <KPI title="Total Holidays" value={metrics.totalHolidays ?? 0} />
          <KPI title="Total Halfdays" value={metrics.totalHalfdays ?? 0} />
          <div className="bg-white rounded-md shadow p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Attendance</h3>
              <select className="text-sm border rounded px-2 py-1" onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter}>
                <option value="">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">Leave</option>
              </select>
            </div>

            {/* IMPORTANT: explicit height/minHeight so ResponsiveContainer has positive size */}
            <div style={{ width: "100%", height: 260, minWidth: 0, minHeight: 200 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="absent" stroke="#ec4899" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="font-semibold">Employee Attendance</div>
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
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-sm text-slate-600">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check In</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Check Out</th>
                  <th className="py-3 px-4">Break</th>
                  <th className="py-3 px-4">Late</th>
                  <th className="py-3 px-4">Overtime</th>
                  <th className="py-3 px-4">Production Hours</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-6 text-center">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="p-6 text-center">No results</td></tr>
                ) : (
                  rows.map((r) => <TableRow key={r.id} r={r} />)
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 flex items-center justify-between text-sm">
            <div>Showing {Math.min(offset + 1, total)} - {Math.min(offset + limit, total)} of {total}</div>
            <div className="flex gap-2">
              <button disabled={offset === 0} className="border px-3 py-1 rounded" onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</button>
              <button disabled={offset + limit >= total} className="border px-3 py-1 rounded" onClick={() => setOffset(offset + limit)}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
