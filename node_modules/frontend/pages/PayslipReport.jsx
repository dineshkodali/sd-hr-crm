/* src/pages/PayslipReport.jsx */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
axios.defaults.withCredentials = true;

/* Helpers */
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
function money(v) {
  const n = Number(v) || 0;
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(n)}`;
  }
}

/* small month line/area chart (SVG) */
function PayrollLineChart({ points = [], width = "100%", height = 160 }) {
  if (!points || points.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400">No chart data</div>;
  }
  const max = Math.max(...points.map((p) => p.value || 0), 1);
  const stepX =  (points.length > 1 ? (600 / (points.length - 1)) : 600);
  const svgW = Math.max(600, points.length * 40);
  const path = points.map((p, i) => {
    const x = i * (svgW / Math.max(1, points.length - 1));
    const y = (1 - (Number(p.value || 0) / max)) * (height - 20) + 10;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={svgW} height={height} viewBox={`0 0 ${svgW} ${height}`} preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(0,0)`}>
          {/* horizontal grid lines */}
          {[0.25, 0.5, 0.75].map((t, idx) => (
            <line key={idx} x1="0" x2={svgW} y1={(t*(height-20)+10)} y2={(t*(height-20)+10)} stroke="#f3f4f6" strokeWidth="1" />
          ))}
          {/* path */}
          <path d={path} fill="none" stroke="#f97316" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          {/* points */}
          {points.map((p, i) => {
            const x = i * (svgW / Math.max(1, points.length - 1));
            const y = (1 - (Number(p.value || 0) / max)) * (height - 20) + 10;
            return <circle key={i} cx={x} cy={y} r={4} fill="#ffffff" stroke="#f97316" strokeWidth="2" />;
          })}
          {/* labels */}
          {points.map((p, i) => {
            const x = i * (svgW / Math.max(1, points.length - 1));
            return <text key={i} x={x} y={height - 2} fontSize="10" textAnchor="middle" fill="#6b7280">{p.month}</text>;
          })}
        </g>
      </svg>
    </div>
  );
}

/* Component */
export default function PayslipReport() {
  const q = useQuery();
  const branch = q.get("branch") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState({
    totalPayroll: 0,
    deductions: 0,
    netPay: 0,
    allowances: 0,
  });

  const [monthly, setMonthly] = useState([]); // [{month:'Jan', value: 10000}, ...]
  const [payslips, setPayslips] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // UI controls
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [amountRange, setAmountRange] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [sortBy, setSortBy] = useState("last7");
  const [dateRange, setDateRange] = useState(`${new Date().toLocaleDateString()}`);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get("/api/admin/reports/payslips", {
          params: { branch: branch || undefined, limit, offset },
          withCredentials: true,
          signal: controller.signal,
        });

        if (!mounted) return;
        const data = res.data || {};
        // KPIs might be in data.metrics or data.kpis
        const metrics = data.metrics || data.kpis || {};
        setKpis({
          totalPayroll: Number(metrics.totalPayroll ?? metrics.total_payroll ?? data.totalPayroll ?? 0),
          deductions: Number(metrics.deductions ?? metrics.total_deductions ?? 0),
          netPay: Number(metrics.netPay ?? metrics.net_pay ?? 0),
          allowances: Number(metrics.allowances ?? 0),
        });

        // monthly time series
        const months = Array.isArray(data.monthly) ? data.monthly : (Array.isArray(data.revenueByMonth) ? data.revenueByMonth : []);
        setMonthly(months.map((m) => ({ month: m.month || m.label || "N/A", value: Number(m.value ?? m.total ?? 0) })));

        const rows = Array.isArray(data.payslips) ? data.payslips : (Array.isArray(data.rows) ? data.rows : []);
        setPayslips(rows);
        setTotalCount(Number(data.total ?? data.count ?? rows.length ?? 0));
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("payslips load error:", err);
        setError(err?.response?.data?.message || err.message || "Failed to load payslips");
        setPayslips([]);
        setMonthly([]);
        setKpis({ totalPayroll: 0, deductions: 0, netPay: 0, allowances: 0 });
        setTotalCount(0);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [branch, limit, offset]);

  // client-side filtering and search
  useEffect(() => {
    const s = (search || "").toLowerCase().trim();
    const rows = (payslips || []).filter((r) => {
      if (amountRange) {
        const [min, max] = String(amountRange).split("-").map((x) => Number(x || 0));
        const v = Number(r.amount ?? r.paid_amount ?? r.value ?? 0);
        if (min && v < min) return false;
        if (max && max !== 0 && v > max) return false;
      }
      if (paymentType) {
        const t = (r.payment_type || r.method || r.type || "").toString().toLowerCase();
        if (!t.includes(paymentType.toLowerCase())) return false;
      }
      if (!s) return true;
      const name = (r.employee_name || r.name || r.payer_name || "").toString().toLowerCase();
      const email = (r.employee_email || r.email || "").toString().toLowerCase();
      const month = (r.paid_month || r.month || "").toString().toLowerCase();
      return name.includes(s) || email.includes(s) || month.includes(s);
    });
    setFiltered(rows);
    setTotalCount(rows.length);
    setOffset(0);
  }, [payslips, search, amountRange, paymentType]);

  const exportCSV = () => {
    const headers = ["Name", "Paid Amount", "Paid Month", "Paid Year", "Payment Method", "Status", "Branch"];
    const rows = (filtered || []).map((r) => [
      r.employee_name || r.name || r.payer_name || "",
      r.amount ?? r.paid_amount ?? 0,
      r.paid_month || r.month || "",
      r.paid_year || (r.paid_date ? new Date(r.paid_date).getFullYear() : ""),
      r.payment_type || r.method || r.type || "",
      r.status || "",
      r.branch || r.hotel_branch || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslips${branch ? `-${branch}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showFrom = Math.min(filtered.length ? offset + 1 : 0, filtered.length);
  const showTo = Math.min(offset + limit, filtered.length);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-9xl mx-auto">
        {/* Header */}
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Payslip Report</h1>
            <div className="text-sm text-gray-500 mt-1">Home / HR / Payslip Report {branch ? ` (Branch: ${branch})` : ""}</div>
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
              <div className="text-sm text-gray-500">Total Payroll</div>
              <div className="text-2xl font-bold mt-2">{money(kpis.totalPayroll)}</div>
              <div className="text-xs text-green-600 mt-2">↗ +20.01% from last week</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">Deductions</div>
              <div className="text-2xl font-bold mt-2">{money(kpis.deductions)}</div>
              <div className="text-xs text-green-600 mt-2">↗ +17.01% from last week</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">Net Pay</div>
              <div className="text-2xl font-bold mt-2">{money(kpis.netPay)}</div>
              <div className="text-xs text-green-600 mt-2">↗ +10.01% from last week</div>
            </div>

            <div className="bg-white rounded-md shadow-sm p-5">
              <div className="text-sm text-gray-500">Allowances</div>
              <div className="text-2xl font-bold mt-2">{money(kpis.allowances)}</div>
              <div className="text-xs text-red-600 mt-2">↘ -10.01% from last week</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">Payroll</div>
                <div className="text-xs text-gray-400">This Year</div>
              </div>
              <div className="text-sm text-gray-500"> </div>
            </div>

            <PayrollLineChart points={monthly} height={160} />
          </div>
        </section>

        {/* Filters */}
        <section className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <div>
                <label className="text-xs text-gray-400">Date range</label>
                <input type="text" value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="ml-2 px-3 py-2 border rounded" placeholder="11/13/2025 - 11/19/2025" />
              </div>

              <div>
                <label className="text-xs text-gray-400">Amount</label>
                <select value={amountRange} onChange={(e) => setAmountRange(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="0-100">0 - 100</option>
                  <option value="100-1000">100 - 1,000</option>
                  <option value="1000-10000">1,000 - 10,000</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Payment Type</label>
                <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="salary">Salary</option>
                  <option value="bonus">Bonus</option>
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

        {/* Table */}
        <section className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Payslip List</h3>
              <div className="text-sm text-gray-500">Showing {showFrom} to {showTo} of {filtered.length}</div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="p-3 w-6">{/* left checkbox intentionally preserved in screenshot; keep if you want to enable batch actions later */}</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Paid Amount</th>
                  <th className="p-3">Paid Month</th>
                  <th className="p-3">Paid Year</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="p-6 text-center">Loading payslips...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No payslips found.</td></tr>
                ) : (
                  filtered.slice(offset, offset + limit).map((r) => {
                    const id = r.id || r.reference || JSON.stringify(r);
                    const name = r.employee_name || r.name || r.payer_name || "—";
                    const avatar = r.avatar || r.employee_avatar || r.profile_pic || null;
                    const amount = r.amount ?? r.paid_amount ?? r.value ?? 0;
                    const month = r.paid_month || r.month || (r.paid_date ? new Date(r.paid_date).toLocaleString(undefined, { month: "short" }) : "");
                    const year = r.paid_year || (r.paid_date ? new Date(r.paid_date).getFullYear() : "");
                    return (
                      <tr key={id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <input type="checkbox" />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs">
                              {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : (name || "U").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{name}</div>
                              <div className="text-xs text-gray-400">{r.designation || r.title || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold">{money(amount)}</td>
                        <td className="p-3">{month}</td>
                        <td className="p-3">{year}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Selected: 0</div>
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
