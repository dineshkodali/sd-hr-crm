/* eslint-disable no-unused-vars */
/* src/pages/PaymentReport.jsx
   Layout tweaks only:
   - parent grid changed to 4 columns on large screens
   - KPI cards reduced in size (padding & font sizes)
   - right chart panel enlarged (now spans 2 of 4 cols) and donut size increased
   No logic or endpoints were changed.
*/
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
axios.defaults.withCredentials = true;

/* --- helpers --- */
function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

function money(v) {
  const n = Number(v) || 0;
  try {
    // keep as USD for now (you can change currency if needed)
    return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(n)}`;
  }
}

function safeDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString();
}

/* Small donut renderer (SVG) — simple and safe */
function DonutSimple({ data = [], size = 240, inner = 80 }) {
  const r = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = (data || []).reduce((s, x) => s + (Number(x.value) || 0), 0);
  const colors = ["#60A5FA", "#FB7185", "#A78BFA", "#F59E0B", "#34D399", "#F97316"];

  if (!total) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center text-sm text-gray-400">
        No chart data
      </div>
    );
  }

  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
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
        <text x="0" y="-6" textAnchor="middle" style={{ fontSize: 20, fontWeight: 700 }}>
          {data[0] ? `${Math.round((Number(data[0].value) / total) * 100)}%` : "0%"}
        </text>
        <text x="0" y="18" textAnchor="middle" style={{ fontSize: 12, fill: "#6b7280" }}>
          vs last year
        </text>
      </g>
    </svg>
  );
}

/* -------------------------
   PaymentReport component
   ------------------------- */
export default function PaymentReport() {
  const q = useQuery();
  const branch = q.get("branch") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    totalPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    successRate: 0,
    totalCount: 0,
  });
  const [revenueByMonth, setRevenueByMonth] = useState([]);
  const [revenueByHotel, setRevenueByHotel] = useState([]);
  const [payments, setPayments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // paging/filter state (simple)
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectAllPage, setSelectAllPage] = useState(false);

  // UI filter controls (non-blocking — adjust params as needed)
  const [dateRange, setDateRange] = useState(`${new Date().toLocaleDateString()}`); // placeholder (you have your own datepicker)
  const [amountRange, setAmountRange] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [sortBy, setSortBy] = useState("last7");

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get("/api/admin/reports/payments", {
          params: { branch: branch || undefined, limit, offset },
          withCredentials: true,
          signal: controller.signal,
        });

        if (!mounted) return;
        const data = res.data || {};
        setMetrics({
          totalPayments: Number(data.metrics?.totalPayments ?? data.metrics?.total ?? 0),
          pendingPayments: Number(data.metrics?.pendingPayments ?? data.metrics?.pending ?? 0),
          failedPayments: Number(data.metrics?.failedPayments ?? data.metrics?.failed ?? 0),
          successRate: Number(data.metrics?.successRate ?? data.metrics?.success_rate ?? 0),
          totalCount: Number(data.metrics?.totalCount ?? data.totalCount ?? data.total ?? 0),
        });

        setRevenueByMonth(Array.isArray(data.revenueByMonth) ? data.revenueByMonth : []);
        setRevenueByHotel(
          (data.revenueByHotel || []).map((r) => ({
            name: r.name ?? r.hotel_name ?? r.label ?? "Hotel",
            value: Number(r.value ?? r.total ?? 0),
          }))
        );

        setPayments(Array.isArray(data.payments) ? data.payments : (Array.isArray(data.rows) ? data.rows : []));
        setTotalCount(Number(data.total ?? data.metrics?.totalCount ?? data.totalCount ?? (data.payments || []).length ?? 0));
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("payments load error:", err);
        setError(err?.response?.data?.message || err.message || "Failed to load payments");
        setPayments([]);
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

  // client-side search filter (keeps original dataset intact)
  const filtered = useMemo(() => {
    if (!search) return payments;
    const s = search.trim().toLowerCase();
    return payments.filter((p) => {
      const client = (p.payer_name || p.client_name || p.payer || p.customer_name || p.reference || p.name || "").toString().toLowerCase();
      const hotel = (p.hotel_name || (p.hotel && (p.hotel.name || p.hotel.title)) || p.company_name || p.company || "").toString().toLowerCase();
      const type = (p.payment_type || p.payment_method || p.method || "").toString().toLowerCase();
      return client.includes(s) || hotel.includes(s) || type.includes(s);
    });
  }, [payments, search]);

  const exportCSV = () => {
    const headers = ["Client Name", "Hotel Name", "Payment Type", "Paid Date", "Paid Amount", "Status"];
    const rows = (payments || []).map((p) => {
      const client = p.payer_name || p.client_name || p.payer || p.customer_name || p.name || p.reference || "";
      const hotel = p.hotel_name || (p.hotel && (p.hotel.name || p.hotel.title)) || p.company_name || p.company || "";
      const type = p.payment_type || p.payment_method || p.method || "";
      const date = p.created_at || p.paid_date || p.date || "";
      const amount = p.amount ?? p.paid_amount ?? p.value ?? 0;
      const status = p.status || p.payment_status || "";
      return [client, hotel, type, date, amount, status];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments${branch ? `-${branch}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* selection helpers */
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
      const pageIds = (filtered || []).slice(0, limit).map((p) => p.id || p.invoice_id || p.reference || JSON.stringify(p));
      setSelectedRows(new Set(pageIds));
      setSelectAllPage(true);
    }
  };

  /* pagination helpers */
  const showFrom = offset + 1;
  const showTo = Math.min(offset + limit, totalCount || (filtered || []).length);

  /* small renderers */
  const KPI = ({ title, value, note, accent }) => (
    <div className="bg-white rounded-md shadow-sm p-3">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {note && <div className="text-xs text-green-600 mt-1">{note}</div>}
      <div className="mt-2 text-xs text-gray-400">{/* cta placeholder */}</div>
    </div>
  );

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-9xl mx-auto">
        {/* Header */}
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Payment Report</h1>
            <div className="text-sm text-gray-500 mt-1">Home / HR / Payment Report {branch ? ` (Branch: ${branch})` : ""}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2">
              <button onClick={exportCSV} className="px-4 py-2 border rounded bg-white">Export</button>
              <button className="px-3 py-2 border rounded bg-white">↑</button>
            </div>
          </div>
        </header>

        {/* KPI + chart row */}
        {/* Changed to 4 cols on large screens so the right side can be wider */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* left: smaller KPIs (spans 2 of 4 -> half width) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <KPI
              title="Total Payments"
              value={money(metrics.totalPayments)}
              note="↗ +20.01% from last week"
              accent="#F97316"
            />
            <KPI
              title="Pending Payments"
              value={money(metrics.pendingPayments)}
              note="↗ +20.01% from last week"
              accent="#60A5FA"
            />
            <KPI
              title="Failed Payments"
              value={money(metrics.failedPayments)}
              note="↘ -5.12% from last week"
              accent="#EF4444"
            />
            <KPI
              title="Payment Success Rate"
              value={`${metrics.successRate ?? 0}%`}
              note="↗ +20.01% from last week"
              accent="#EC4899"
            />
          </div>

          {/* right: bigger chart panel (now spans 2 of 4 -> half width, visually larger than before) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">Payments By Payment Methods</div>
                <div className="text-xs text-gray-400">This Year</div>
              </div>
              <div className="text-sm text-gray-500"> </div>
            </div>

            <div className="flex gap-4 items-center">
              {/* increased donut size for more prominence */}
              <div style={{ width: 320, height: 320 }}>
                <DonutSimple data={revenueByHotel} size={320} inner={96} />
              </div>

              <div className="flex-1">
                <ul className="space-y-3 text-sm">
                  {revenueByHotel && revenueByHotel.length ? (
                    revenueByHotel.map((r, i) => (
                      <li key={r.name + i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 6,
                              background: ["#60A5FA", "#FB7185", "#A78BFA", "#F59E0B", "#34D399", "#F97316"][i % 6],
                              flex: "0 0 10px",
                            }}
                          />
                          <div className="truncate" style={{ maxWidth: 220 }}>{r.name}</div>
                        </div>
                        <div className="font-semibold">{money(r.value)}</div>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-400">No breakdown available</li>
                  )}
                </ul>
              </div>
            </div>
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
                  <option value="0-100">$0 - $100</option>
                  <option value="100-1000">$100 - $1,000</option>
                  <option value="1000+">$1,000+</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Payment Type</label>
                <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="ml-2 px-3 py-2 border rounded">
                  <option value="">All</option>
                  <option value="paypal">Paypal</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
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
              <h3 className="text-lg font-semibold">Payment List</h3>

              <div className="text-sm text-gray-500">Showing {showFrom} to {showTo} of {totalCount || (filtered||[]).length}</div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="p-3 w-6">
                    <input type="checkbox" checked={selectAllPage} onChange={toggleSelectAllPage} />
                  </th>

                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Hotel Name</th>
                  <th className="p-3">Payment Type</th>
                  <th className="p-3">Paid Date</th>
                  <th className="p-3 text-right">Paid Amount</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="p-6 text-center">Loading payments...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="6" className="p-6 text-center text-gray-500">No payments found.</td></tr>
                ) : (
                  filtered.slice(0, limit).map((p) => {
                    const id = p.id || p.invoice_id || p.reference || JSON.stringify(p);
                    const customer = p.payer_name || p.client_name || p.payer || p.customer_name || p.name || "";
                    const hotel = p.hotel_name || (p.hotel && (p.hotel.name || p.hotel.title)) || p.company_name || p.company || "";
                    const type = p.payment_type || p.payment_method || p.method || "";
                    const date = p.created_at || p.paid_date || p.date || "";
                    const amount = p.amount ?? p.paid_amount ?? p.value ?? 0;
                    const checked = selectedRows.has(id);
                    return (
                      <tr key={id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <input type="checkbox" checked={checked} onChange={() => toggleRow(id)} />
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs">
                              {p.avatar ? <img src={p.avatar} alt={customer} className="w-full h-full object-cover" /> : (customer || "U").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{customer}</div>
                              <div className="text-xs text-gray-400 truncate">{p.title || p.designation || ""}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-gray-600 truncate">{hotel}</td>

                        <td className="p-3">{type}</td>
                        <td className="p-3">{safeDate(date)}</td>
                        <td className="p-3 text-right font-semibold">{money(amount)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* footer / pagination */}
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Selected: {selectedRows.size}</div>

            <div className="flex items-center gap-3">
              <div>
                <button onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded">Prev</button>
              </div>
              <div>
                <button onClick={() => setOffset(Math.min(Math.max(0, totalCount - limit), offset + limit))} className="px-3 py-1 border rounded">Next</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
