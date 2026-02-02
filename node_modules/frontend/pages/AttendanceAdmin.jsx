/* eslint-disable no-unused-vars */
// src/pages/AttendanceAdmin.jsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

/**
 * AttendanceAdmin.jsx
 * - Defensive fetching from /api/admin/reports/attendance and fallback to /api/admin/attendance/stats
 * - Fetches a page from /api/admin/attendance as a list fallback
 * - Robust to multiple API shapes and missing fields
 */

function KPI({ title, value, hint }) {
  return (
    <div className="bg-white border rounded p-5 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{Number(value ?? 0)}</div>
      {hint ? <div className="mt-1 text-xs text-gray-400">{hint}</div> : null}
    </div>
  );
}

function Badge({ children, color = "green" }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
  const colors = {
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
  };
  return <span className={`${base} ${colors[color] || colors.green}`}>{children}</span>;
}

export default function AttendanceAdmin() {
  // Use object instead of null for metrics to avoid accidental property reads on null
  const [metrics, setMetrics] = useState({});
  const [monthly, setMonthly] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to normalise possible report shapes into a canonical shape
  function normalizeReportShape(data) {
    // expected shapes:
    // 1) { metrics: {...}, monthly: [...], attendance: [...], total: N }
    // 2) legacy stats: { present, late, ... } (we treat it as metrics)
    // 3) fallback list shapes may have rows/meta
    if (!data || typeof data !== "object") return { metrics: {}, monthly: [], attendance: [], total: 0 };

    if (data.metrics || data.attendance) {
      return {
        metrics: data.metrics || {},
        monthly: Array.isArray(data.monthly) ? data.monthly : [],
        attendance: Array.isArray(data.attendance) ? data.attendance : [],
        total: Number(data.total ?? 0),
      };
    }

    if (data.fallbackStats) {
      return { metrics: data.fallbackStats || {}, monthly: [], attendance: [], total: 0 };
    }

    // attempt to read directly
    const metricsGuess =
      data.metrics ||
      data.stats ||
      data.fallbackStats ||
      // data might be just a stats object
      (Object.keys(data).length && !Array.isArray(data) && !data.rows && !data.attendance ? data : {});

    const attendanceGuess = Array.isArray(data.attendance) ? data.attendance : Array.isArray(data.rows) ? data.rows : [];
    const monthlyGuess = Array.isArray(data.monthly) ? data.monthly : [];

    return {
      metrics: metricsGuess || {},
      monthly: monthlyGuess,
      attendance: attendanceGuess,
      total: Number(data.total ?? data.count ?? (attendanceGuess.length || 0)),
    };
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const getReport = axios
      .get("/api/admin/reports/attendance", { params: { limit, offset } })
      .then((r) => r.data)
      .catch((err) => {
        // fallback to simple stats endpoint when reports endpoint missing
        if (err && err.response && err.response.status === 404) {
          return axios
            .get("/api/admin/attendance/stats")
            .then((r) => ({ fallbackStats: r.data.stats }))
            .catch(() => ({}));
        }
        // other errors bubble up
        throw err;
      });

    const getList = axios
      .get("/api/admin/attendance", { params: { limit, offset } })
      .then((r) => r.data)
      .catch(() => null); // tolerate list not existing

    Promise.allSettled([getReport, getList])
      .then((results) => {
        if (!mounted) return;

        // Process report result first
        const rep = results[0];
        if (rep && rep.status === "fulfilled") {
          try {
            const canonical = normalizeReportShape(rep.value || {});
            setMetrics(canonical.metrics || {});
            setMonthly(canonical.monthly || []);
            // prefer attendance from report if present
            if (Array.isArray(canonical.attendance) && canonical.attendance.length) {
              setRows(canonical.attendance);
              setTotal(Number(canonical.total ?? canonical.attendance.length ?? 0));
            } else {
              // leave rows to be possibly filled by getList result below
              setTotal(Number(canonical.total ?? 0));
            }
          } catch (e) {
            console.warn("Failed to normalise report:", e);
            setMetrics({});
          }
        } else if (rep && rep.status === "rejected") {
          console.warn("report fetch failed:", rep.reason);
        }

        // Now process list result (lower priority)
        const lst = results[1];
        if (lst && lst.status === "fulfilled" && lst.value) {
          const rv = lst.value;
          // Expected list shape: { meta: { limit, offset, total }, rows: [...] } or { rows: [...] }
          if (rv.rows && Array.isArray(rv.rows)) {
            // If rows are already populated from report, don't overwrite. But if report had no rows, use the list.
            setRows((prev) => (prev && prev.length ? prev : rv.rows));
            setTotal((prevTotal) =>
              prevTotal && prevTotal > 0 ? prevTotal : Number(rv.meta?.total ?? rv.total ?? rv.rows.length ?? 0)
            );
          } else if (Array.isArray(rv)) {
            setRows((prev) => (prev && prev.length ? prev : rv));
            setTotal((prevTotal) => (prevTotal && prevTotal > 0 ? prevTotal : rv.length));
          } else if (typeof rv.total === "number") {
            setTotal((prevTotal) => (prevTotal && prevTotal > 0 ? prevTotal : rv.total));
          }
        }
      })
      .catch((e) => {
        console.error("attendance fetch failed:", e);
        if (mounted) setError(e);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [limit, offset]);

  // map different metric key names into a consistent object
  const mappedMetrics = useMemo(() => {
    const m = metrics || {};
    return {
      total: Number(m.total ?? m.totalWorkingDays ?? m.total_working_days ?? m.totalPresent ?? 0),
      present: Number(
        m.present ??
          m.present_count ??
          m.totalPresent ??
          m.total_present ??
          m.presentCount ??
          m.present_count ??
          0
      ),
      late: Number(m.late ?? m.late_count ?? m.total_late ?? 0),
      uninformed: Number(m.uninformed ?? m.uninformed_count ?? 0),
      permission: Number(m.permission ?? m.permission_count ?? m.total_permission ?? 0),
      absent: Number(m.absent ?? m.absent_count ?? m.totalAbsent ?? m.total_absent ?? m.total_leave ?? 0),
    };
  }, [metrics]);

  function prevPage() {
    setOffset((o) => Math.max(0, o - limit));
  }
  function nextPage() {
    setOffset((o) => o + limit);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading attendance...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Attendance (Admin)</h2>
        <div className="bg-red-50 border border-red-100 p-4 rounded">Failed to load attendance. See console for details.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance Admin</h1>
          <div className="text-sm text-gray-500 mt-1">Overview for the selected date range</div>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border rounded bg-white hover:bg-gray-50">Export</button>
          <button className="px-4 py-2 bg-orange-500 text-white rounded">Report</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPI title="Total" value={mappedMetrics.total} />
        <KPI title="Present" value={mappedMetrics.present} />
        <KPI title="Late" value={mappedMetrics.late} />
        <KPI title="Uninformed" value={mappedMetrics.uninformed} />
        <KPI title="Permission" value={mappedMetrics.permission} />
        <KPI title="Absent" value={mappedMetrics.absent} />
      </div>

      {/* Filters header */}
      <div className="bg-white border rounded p-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Admin Attendance</h2>

          <div className="flex items-center gap-3">
            <input type="text" placeholder="Search" className="border rounded px-3 py-2 text-sm" />
            <select className="border rounded px-3 py-2 text-sm">
              <option>Department</option>
            </select>
            <select className="border rounded px-3 py-2 text-sm">
              <option>Last 7 Days</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm text-gray-500">Row Per Page</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded overflow-hidden">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input type="checkbox" />
              </th>
              <th className="px-6 py-3 text-left">Employee</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Check In</th>
              <th className="px-6 py-3 text-left">Check Out</th>
              <th className="px-6 py-3 text-left">Break</th>
              <th className="px-6 py-3 text-left">Late</th>
              <th className="px-6 py-3 text-left">Production Hours</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows && rows.length ? (
              rows.map((r) => {
                // tolerate many possible field names
                const name = r.employee_name || r.name || r.user_name || r.employee || r.employeeName || "Unknown";
                const avatar = r.avatar || r.avatar_url || r.user_avatar || "";
                const status = (r.status ?? r.state ?? "unknown") + "";
                const checkIn = r.check_in || r.checkIn || r.check_in_raw || "";
                const checkOut = r.check_out || r.checkOut || r.check_out_raw || "";
                const breakMinutes = r.break_minutes ?? r.break ?? 0;
                const lateMinutes = r.late_minutes ?? r.late ?? 0;
                const production = r.production_hours ?? r.production ?? 0;

                return (
                  <tr key={r.id ?? `${name}-${Math.random()}`} className="border-t">
                    <td className="px-4 py-4">
                      <input type="checkbox" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                          {avatar ? (
                            // if absolute/relative URL may need prefixing on your server
                            <img src={avatar} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-medium text-gray-700">{String(name).slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-gray-400">{r.designation || r.department || r.role || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {status && status.toLowerCase() === "present" ? (
                        <Badge color="green">Present</Badge>
                      ) : status && status.toLowerCase() === "absent" ? (
                        <Badge color="red">Absent</Badge>
                      ) : (
                        <Badge color="yellow">{String(status)}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">{checkIn || "-"}</td>
                    <td className="px-6 py-4">{checkOut || "-"}</td>
                    <td className="px-6 py-4">{breakMinutes ? `${breakMinutes} Min` : "-"}</td>
                    <td className="px-6 py-4">{lateMinutes ? `${lateMinutes} Min` : "-"}</td>
                    <td className="px-6 py-4">{production ? <Badge color={production >= 8 ? "green" : "red"}>{production} Hrs</Badge> : "-"}</td>
                    <td className="px-4 py-4">
                      <button className="text-gray-500 hover:text-gray-700">✎</button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-6 py-8 text-center text-gray-500" colSpan={9}>
                  No attendance rows found for the selected range.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-600">
            Showing {rows && rows.length ? offset + 1 : 0} to {Math.min(offset + limit, total || (rows && rows.length) || 0)} of{" "}
            {total || (rows && rows.length) || 0} entries
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevPage} disabled={offset === 0} className="px-3 py-1 border rounded disabled:opacity-50">
              Prev
            </button>
            <button onClick={nextPage} disabled={(offset + limit) >= (total || 0)} className="px-3 py-1 border rounded disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        Tip: if the numbers look wrong, open DevTools → Network and inspect <code>/api/admin/reports/attendance</code> response.
      </div>
    </div>
  );
}
