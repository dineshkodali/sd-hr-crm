/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* src/pages/Tickets.jsx */
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

axios.defaults.withCredentials = true;

function KPI({ title, value, children }) {
  return (
    <div className="bg-white rounded-md shadow p-4 flex items-center justify-between">
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-bold mt-2">{value}</div>
      </div>
      <div className="w-20 h-12 flex items-center justify-center">{children}</div>
    </div>
  );
}

function formatDateShort(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

/* Ticket card now wraps with Link to details page so clicking opens TicketDetails */
function TicketCard({ t }) {
  const assigneeAvatar = t.assignee_avatar || `https://i.pravatar.cc/32?u=${encodeURIComponent(t.assignee_name || t.assignee_id || t.ticket_no)}`;
  return (
    <Link to={`/admin/tickets/${encodeURIComponent(t.id)}`} className="block">
      <div className="bg-white rounded-md shadow p-4 mb-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-blue-600 font-semibold mb-2">{t.category || "Uncategorized"}</div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-block text-xs bg-sky-100 text-sky-700 px-3 py-1 rounded-full">{t.ticket_no || "—"}</span>
              <h3 className="text-lg font-bold">{t.title || "No title"}</h3>
              <span
                className={`ml-3 text-xs px-2 py-1 rounded ${
                  t.priority === "high" ? "bg-red-100 text-red-700"
                    : t.priority === "low" ? "bg-emerald-100 text-emerald-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {t.priority || "medium"}
              </span>
              <span
                className={`ml-2 text-xs px-2 py-1 rounded ${
                  t.status === "open" ? "bg-pink-50 text-pink-600"
                    : t.status === "solved" ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-50 text-gray-700"
                }`}
              >
                {t.status || "open"}
              </span>
            </div>

            <div className="mt-3 text-sm text-gray-600 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <img
                  src={assigneeAvatar}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
                <span>Assigned to <strong>{t.assignee_name || "Unassigned"}</strong></span>
              </div>
              <div>Updated {t.updated_at_str || t.created_at_str || formatDateShort(t.updated_at || t.created_at)}</div>
              <div>{t.comments_count ?? 0} Comments</div>
            </div>
          </div>

          <div className="text-right">{/* placeholder for actions */}</div>
        </div>
      </div>
    </Link>
  );
}

/* AddTicketModal component (unchanged except kept inside file) */
function AddTicketModal({ open, onClose, onCreated, categories = [], agents = [] }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] || "");
  const [subject, setSubject] = useState("");
  const [assignee, setAssignee] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory(categories[0] || "");
      setSubject("");
      setAssignee("");
      setDescription("");
      setPriority("medium");
      setStatus("open");
      setError("");
    }
  }, [open, categories]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Please enter a title.");
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category: category || null,
        subject: subject || null,
        assignee_id: assignee || null,
        description: description || null,
        priority,
        status,
      };

      const res = await axios.post("/api/tickets", payload);
      onCreated && onCreated(res.data);
      onClose && onClose();
    } catch (err) {
      console.error("Failed to create ticket:", err);
      try {
        const res2 = await axios.post("/api/admin/tickets", {
          title: title.trim(),
          category: category || null,
          subject: subject || null,
          assignee_id: assignee || null,
          description: description || null,
          priority,
          status,
        });
        onCreated && onCreated(res2.data);
        onClose && onClose();
        return;
      } catch (e2) {
        console.error("Fallback admin/tickets also failed:", e2);
        setError(e2?.response?.data?.message || err?.response?.data?.message || "Failed to create ticket.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded shadow-lg mx-4">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Add Ticket</h3>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" placeholder="Enter Title" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Event Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
                <option value="">Select</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" placeholder="Enter Subject" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Assign To</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
                <option value="">Unassigned</option>
                {agents.map((a) => {
                  const id = a && typeof a === 'object' ? a.id : a;
                  const name = a && typeof a === 'object' ? (a.name || (a.id ? `User ${a.id}` : 'Unassigned')) : String(a || 'Unassigned');
                  return (
                    <option key={id ?? name} value={id ?? ''}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ticket Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" rows={4} placeholder="Add Question" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="solved">Solved</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded bg-white">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded">{saving ? "Adding..." : "Add Ticket"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tickets() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({});
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fixedCategories = ["cleaning", "washing", "Internet issue", "water issue", "payment issue"];

  function isGenericName(n) {
    if (!n) return true;
    if (n === "Unassigned") return true;
    return /^User\s+\d+$/.test(n);
  }

  function mergeAgents(prev = [], incoming = []) {
    const map = {};
    (prev || []).forEach((p) => { map[p.id || "__unassigned__"] = { ...p }; });
    (incoming || []).forEach((a) => {
      const key = a.id || "__unassigned__";
      const existing = map[key];
      const existingName = existing?.name;
      const incomingName = a.name;
      const nameToUse = (existingName && !isGenericName(existingName)) ? existingName : (incomingName || existingName || `User ${a.id || ''}`);
      map[key] = {
        id: a.id ?? existing?.id ?? null,
        name: nameToUse,
        avatar: a.avatar ?? existing?.avatar ?? null,
        open_count: (existing?.open_count || 0) + (a.open_count || 0),
      };
    });
    return Object.values(map);
  }

  // fetch authoritative agents (counts) from backend
  const fetchAgentCounts = useCallback(async () => {
    try {
      const res = await axios.get('/api/tickets/agent-open-counts');
      if (res?.data?.agents && Array.isArray(res.data.agents)) {
        const normalized = res.data.agents.map(a => ({
          id: a.id ?? null,
          name: a.name || (a.id ? `User ${a.id}` : 'Unassigned'),
          avatar: a.avatar || null,
          open_count: Number(a.open_count || 0),
        }));
        if (mounted.current) setAgents(normalized);
        return normalized;
      }
    } catch (e) {
      console.warn('agent counts endpoint failed', e?.message || e);
    }
    return null;
  }, []);

  function deriveFromArray(rows) {
    const statusCounts = { newTickets: 0, openTickets: 0, solvedTickets: 0, pendingTickets: 0 };
    const catMap = {};
    const agentsMap = {};

    rows.forEach((r) => {
      const st = (r.status || "open").toLowerCase();
      if (st === "open") statusCounts.openTickets++;
      else if (st === "solved" || st === "closed") statusCounts.solvedTickets++;
      else if (st === "pending") statusCounts.pendingTickets++;
      try {
        if (r.created_at) {
          const created = new Date(r.created_at);
          const days = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
          if (days <= 30) statusCounts.newTickets++;
        } else {
          statusCounts.newTickets++;
        }
      } catch { /* ignore */ }

      const cat = r.category || "Uncategorized";
      catMap[cat] = (catMap[cat] || 0) + 1;

      const aidKey = (r.assignee_id == null) ? "__unassigned__" : r.assignee_id;
      const aname = r.assignee_name || (r.assignee_id ? `User ${r.assignee_id}` : "Unassigned");
      if (!agentsMap[aidKey]) {
        agentsMap[aidKey] = { id: r.assignee_id || null, name: aname, avatar: r.assignee_avatar || null, open_count: 0 };
      }
      if (st === "open") {
        agentsMap[aidKey].open_count += 1;
      }
    });

    const categoryList = fixedCategories.slice();
    Object.keys(catMap).forEach((c) => {
      if (!categoryList.includes(c)) categoryList.push(c);
    });

    const agentsList = Object.values(agentsMap).map((a) => ({ ...a }));

    return { statusCounts, catMap, categoryList, agentsList };
  }

  const load = useCallback(async () => {
    if (!mounted.current) return;
    setLoading(true);
    try {
      const res = await axios.get("/api/tickets", { params: { limit, offset } });
      const data = res.data;

      if (Array.isArray(data)) {
        const rows = data.map((r) => ({
          id: r.id,
          ticket_no: r.ticket_no,
          title: r.title,
          subject: r.subject,
          category: r.category,
          description: r.description,
          assignee_id: r.assignee_id,
          assignee_name: r.assignee_name || (r.assignee_id ? `User ${r.assignee_id}` : null),
          assignee_avatar: r.assignee_avatar || null,
          priority: r.priority,
          status: r.status,
          comments_count: r.comments_count ?? 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
          created_at_str: r.created_at ? formatDateShort(r.created_at) : undefined,
          updated_at_str: r.updated_at ? formatDateShort(r.updated_at) : undefined,
        }));

        const derived = deriveFromArray(rows);
        if (!mounted.current) return;
        setTickets(rows);
        setKpis(derived.statusCounts);
        setCategories(derived.categoryList);

        const fetched = await fetchAgentCounts();
        if (!fetched) {
          setAgents((prev) => mergeAgents(prev, derived.agentsList));
        }
        setTotal(rows.length);
      } else if (data && typeof data === "object") {
        if (!mounted.current) return;
        setKpis(data.kpis || {});
        setCategories((data.categories && data.categories.map((c) => c.name)) || fixedCategories);
        const rows = (data.tickets || []).map((r) => ({
          id: r.id,
          ticket_no: r.ticket_no,
          title: r.title,
          subject: r.subject,
          category: r.category,
          description: r.description,
          assignee_id: r.assignee_id,
          assignee_name: r.assignee_name || (r.assignee_id ? `User ${r.assignee_id}` : null),
          assignee_avatar: r.assignee_avatar || null,
          priority: r.priority,
          status: r.status,
          comments_count: r.comments_count ?? 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
          created_at_str: r.created_at_str || (r.created_at ? formatDateShort(r.created_at) : undefined),
          updated_at_str: r.updated_at_str || (r.updated_at ? formatDateShort(r.updated_at) : undefined),
        }));
        setTickets(rows);
        const supportAgents = (data.supportAgents || []).map((a) => ({ id: a.id, name: a.name, avatar: a.avatar, open_count: a.open_count }));
        if (supportAgents.length > 0) {
          setAgents(supportAgents);
        } else {
          const fetched = await fetchAgentCounts();
          if (!fetched) setAgents((prev) => mergeAgents(prev, derived.agentsList));
        }
        setTotal(data.total || rows.length);
      } else {
        if (!mounted.current) return;
        setKpis({});
        setCategories(fixedCategories);
        setTickets([]);
        await fetchAgentCounts();
        setTotal(0);
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);

      try {
        const res2 = await axios.get("/api/admin/tickets", { params: { limit, offset } });
        const body = res2.data || {};
        if (!mounted.current) return;
        setKpis(body.kpis || {});
        setCategories((body.categories && body.categories.map((c) => c.name)) || fixedCategories);
        setTickets((body.tickets || []).map((r) => ({
          id: r.id,
          ticket_no: r.ticket_no,
          title: r.title,
          subject: r.subject,
          category: r.category,
          description: r.description,
          assignee_id: r.assignee_id,
          assignee_name: r.assignee_name || (r.assignee_id ? `User ${r.assignee_id}` : null),
          assignee_avatar: r.assignee_avatar || null,
          priority: r.priority,
          status: r.status,
          comments_count: r.comments_count ?? 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
          created_at_str: r.created_at_str || (r.created_at ? formatDateShort(r.created_at) : undefined),
          updated_at_str: r.updated_at_str || (r.updated_at ? formatDateShort(r.updated_at) : undefined),
        })));
        if (body.supportAgents && body.supportAgents.length) {
          setAgents(body.supportAgents.map(a => ({ id: a.id, name: a.name, avatar: a.avatar, open_count: a.open_count })));
        } else {
          await fetchAgentCounts();
        }
        setTotal(body.total || 0);
      } catch (err2) {
        console.error("Fallback /api/admin/tickets failed:", err2);
        if (!mounted.current) return;
        setKpis({});
        setCategories(fixedCategories);
        setTickets([]);
        await fetchAgentCounts();
        setTotal(0);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [limit, offset, fetchAgentCounts]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchAgentCounts();
  }, [fetchAgentCounts]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-9xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Tickets</h1>
            <div className="text-sm text-gray-500 mt-1">Home / Employee / Tickets</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-orange-600 text-white rounded">Add Ticket</button>
            <button className="px-3 py-2 bg-white border rounded">Export</button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <KPI title="New Tickets" value={kpis.newTickets ?? 0}><div className="w-16 h-8 bg-orange-100 rounded" /></KPI>
          <KPI title="Open Tickets" value={kpis.openTickets ?? 0}><div className="w-16 h-8 bg-purple-100 rounded" /></KPI>
          <KPI title="Solved Tickets" value={kpis.solvedTickets ?? 0}><div className="w-16 h-8 bg-green-100 rounded" /></KPI>
          <KPI title="Pending Tickets" value={kpis.pendingTickets ?? 0}><div className="w-16 h-8 bg-sky-100 rounded" /></KPI>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-md shadow mb-4 p-4 flex items-center justify-between">
              <h2 className="font-semibold">Ticket List</h2>
              <div>
                <select className="border rounded px-3 py-1" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div>
              {tickets.length === 0 ? (
                <div className="p-6 bg-white rounded-md shadow text-center text-gray-500">No tickets found.</div>
              ) : (
                tickets.map((t) => <TicketCard key={t.id} t={t} />)
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">Showing {total === 0 ? 0 : Math.min(offset + 1, total)} - {total === 0 ? 0 : Math.min(offset + limit, total)} of {total}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setOffset(Math.max(0, offset - limit))} className="px-3 py-1 border rounded">Prev</button>
                <button onClick={() => setOffset(Math.min(Math.max(0, total - limit), offset + limit))} className="px-3 py-1 border rounded">Next</button>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-white rounded-md shadow p-4">
              <h3 className="font-semibold mb-3">Ticket Categories</h3>
              <ul className="space-y-2">
                {categories.map((c) => (
                  <li key={c} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <span className="text-sm">{c}</span>
                    <span className="inline-block bg-gray-900 text-white text-xs px-2 py-1 rounded-full">{
                      tickets.filter((r) => (r.category || "Uncategorized") === c).length
                    }</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-md shadow p-4">
              <h3 className="font-semibold mb-3">Support Agents</h3>
              <ul className="space-y-3">
                {agents.length === 0 ? <li className="text-sm text-gray-500">No agents</li> :
                  agents.map((a) => (
                    <li key={a.id || a.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={a.avatar || `https://i.pravatar.cc/32?u=${a.id || a.name}`} alt="" className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="text-sm">{a.name}</div>
                          <div className="text-xs text-gray-400">Agent</div>
                        </div>
                      </div>
                      <div className="inline-block bg-gray-900 text-white text-xs px-2 py-1 rounded-full">{a.open_count || 0}</div>
                    </li>
                  ))
                }
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* Add ticket modal */}
      <AddTicketModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { load(); }}
        categories={categories.length ? categories : fixedCategories}
        agents={agents}
      />
    </div>
  );
}
