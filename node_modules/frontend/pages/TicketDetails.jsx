/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/TicketDetails.jsx */
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

/**
 * TicketDetails page (polished)
 * - Loads ticket + support agents (with fallbacks)
 * - Supports updating priority, assignee, status (PUT)
 * - Posting replies (POST)
 * - Renders attachments and comment list
 */

axios.defaults.withCredentials = true;

export default function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState(null);
  const [error, setError] = useState(null);

  const [agents, setAgents] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [postingReply, setPostingReply] = useState(false);

  // local selects use strings: agent id as string, or "null" for unassigned
  const [localPriority, setLocalPriority] = useState("");
  const [localAssignee, setLocalAssignee] = useState("null");
  const [localStatus, setLocalStatus] = useState("");

  useEffect(() => {
    if (!id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /**
   * Try multiple endpoints to fetch support agents:
   * 1. /api/admin/tickets/support-agents (preferred for admin responses)
   * 2. /api/tickets/agent-open-counts (non-admin endpoint created server-side)
   * 3. /api/admin/users?limit=200 (fallback)
   */
  async function fetchSupportAgents() {
    // 1) try admin-specific agents endpoint
    try {
      const aRes = await axios.get("/api/admin/tickets/support-agents");
      const ags = aRes?.data?.agents || aRes?.data || [];
      if (Array.isArray(ags)) return ags.map(normalizeAgent);
    } catch (e) {
      // ignore, try next
    }

    // 2) try agent counts endpoint
    try {
      const r = await axios.get("/api/tickets/agent-open-counts");
      const ags = r?.data?.agents || [];
      if (Array.isArray(ags)) return ags.map(normalizeAgent);
    } catch (e) {
      // ignore
    }

    // 3) fallback to admin users listing (may require admin rights)
    try {
      const r2 = await axios.get("/api/admin/users?limit=200");
      const users = (r2?.data?.users) || [];
      return users.map((u) =>
        normalizeAgent({
          id: u.id,
          name: u.name || u.email || `User ${u.id}`,
          avatar: u.avatar || null,
          open_count: u.open_count || 0,
        })
      );
    } catch (e) {
      // final fallback -> empty
    }

    return [];
  }

  function normalizeAgent(a) {
    // keep id as-is (could be number or string) but we'll stringify when using <option>
    return {
      id: a.id ?? null,
      name: a.name ?? (a.id ? `User ${a.id}` : "Unassigned"),
      avatar: a.avatar ?? null,
      open_count: Number(a.open_count || 0),
    };
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      // 1) fetch ticket details (prefer admin endpoint if present)
      let tRes;
      try {
        tRes = await axios.get(`/api/admin/tickets/${encodeURIComponent(id)}`);
      } catch (e) {
        // fallback to public tickets endpoint
        tRes = await axios.get(`/api/tickets/${encodeURIComponent(id)}`);
      }

      const t = tRes?.data?.ticket || tRes?.data || null;

      // fetch agents (best-effort)
      const ags = await fetchSupportAgents();

      setTicket(t);
      setAgents(Array.isArray(ags) ? ags : []);

      // set locals safely
      setLocalPriority(t?.priority || "medium");
      setLocalStatus(t?.status || "open");

      // prefer nested assignee object, fallback to assignee_id; localAssignee stored as string or "null"
      const assigneeId = t?.assignee?.id ?? t?.assignee_id ?? null;
      setLocalAssignee(assigneeId != null ? String(assigneeId) : "null");

      // store last viewed ticket id for sidebar convenience (non-critical)
      try {
        if (t && (t.id || t.ticket_no)) {
          localStorage.setItem("lastViewedTicketId", String(t.id ?? t.ticket_no));
        }
      } catch (_) {}
    } catch (err) {
      console.error("Failed to load ticket:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }

  const createdFromNow = useMemo(() => (ticket?.created_at ? dayjs(ticket.created_at).fromNow() : null), [ticket]);
  const updatedFromNow = useMemo(() => (ticket?.updated_at ? dayjs(ticket.updated_at).fromNow() : null), [ticket]);

  /**
   * Generic field updater. fieldName is the DB column name (e.g. 'priority', 'status', 'assignee_id').
   * Value conversion: when value === null, we send JSON null (server should accept null).
   */
  async function updateField(fieldName, value) {
    if (!ticket?.id) return;
    setSavingField(fieldName);
    try {
      const payload = { [fieldName]: value };
      // prefer admin endpoint PUT, fallback to public tickets PUT
      let res;
      try {
        res = await axios.put(`/api/admin/tickets/${encodeURIComponent(ticket.id)}`, payload);
      } catch (e) {
        res = await axios.put(`/api/tickets/${encodeURIComponent(ticket.id)}`, payload);
      }
      const updated = res?.data?.ticket || res?.data || null;
      if (updated) {
        setTicket(updated);
        // update locals if backend changed them
        setLocalPriority(updated.priority ?? localPriority);
        setLocalStatus(updated.status ?? localStatus);
        const assigneeId = updated.assignee?.id ?? updated.assignee_id ?? null;
        setLocalAssignee(assigneeId != null ? String(assigneeId) : "null");
      } else {
        // safety: reload full model
        await loadAll();
      }
    } catch (err) {
      console.error("Failed to update ticket:", err);
      setError(err?.response?.data?.message || "Failed to update");
    } finally {
      setSavingField(null);
    }
  }

  async function handlePriorityChange(e) {
    const v = e.target.value;
    setLocalPriority(v);
    await updateField("priority", v);
  }

  async function handleStatusChange(e) {
    const v = e.target.value;
    setLocalStatus(v);
    await updateField("status", v);
  }

  async function handleAssigneeChange(e) {
    // select values are strings; "null" encodes unassigned
    const raw = e.target.value;
    const v = raw === "null" ? null : raw;
    setLocalAssignee(raw);
    // If agent ids in DB are integers, backend should coerce; otherwise pass string id
    await updateField("assignee_id", v);
  }

  async function handlePostReply(e) {
    e.preventDefault();
    if (!replyText || !ticket?.id) return;
    setPostingReply(true);
    try {
      // try admin replies endpoint first
      let res;
      try {
        res = await axios.post(`/api/admin/tickets/${encodeURIComponent(ticket.id)}/replies`, { message: replyText });
      } catch (e) {
        // fallback to public/tickets replies endpoint
        res = await axios.post(`/api/tickets/${encodeURIComponent(ticket.id)}/replies`, { message: replyText });
      }

      const newComment = res?.data?.comment || res?.data || null;
      if (newComment) {
        setTicket((prev) => ({
          ...prev,
          comments: prev?.comments ? [newComment, ...prev.comments] : [newComment],
          updated_at: newComment.created_at || prev?.updated_at,
        }));
        setReplyText("");
      } else {
        // fallback to reload full data
        await loadAll();
      }
    } catch (err) {
      console.error("Failed to post reply:", err);
      setError(err?.response?.data?.message || "Failed to post reply");
    } finally {
      setPostingReply(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading ticket...</div>
      </div>
    );

  if (error)
    return (
      <div className="p-6">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <button className="px-3 py-2 border rounded" onClick={loadAll}>
          Retry
        </button>
      </div>
    );

  if (!ticket)
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Ticket not found</h2>
        <p className="text-sm text-gray-600">The requested ticket could not be loaded.</p>
      </div>
    );

  return (
    <div className="p-6">
      <div className="mb-4">
        <button className="text-sm text-gray-600" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <div className="bg-white rounded shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <a className="text-indigo-600 font-medium">{ticket?.category || "General"}</a>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`inline-block text-white text-xs font-semibold px-3 py-1 rounded ${
                    ticket.priority === "high" ? "bg-red-600" : ticket.priority === "low" ? "bg-green-500" : "bg-orange-500"
                  }`}
                >
                  {ticket.priority ? ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1) : "Medium"}
                </div>
                <button className="px-3 py-1 border rounded text-sm" onClick={() => window.alert("Mark as Private - not implemented")}>
                  Mark as Private ▾
                </button>
              </div>
            </div>

            <div className="mb-2">
              <div className="inline-flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded"> {ticket.ticket_no || `TCK-${ticket.id}`} </span>
              </div>
              <h1 className="text-2xl font-bold mt-3">{ticket.title || "Untitled ticket"}</h1>

              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  {ticket.assignee?.avatar ? <img src={ticket.assignee.avatar} alt="assignee" className="w-7 h-7 rounded-full" /> : <div className="w-7 h-7 rounded-full bg-gray-200" />}
                  <span>
                    Assigned to <strong className="ml-1">{ticket.assignee?.name || ticket.assignee_name || "Unassigned"}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" />
                  </svg>
                  <span>Updated {updatedFromNow || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 0 1 2 2v6" />
                  </svg>
                  <span>{ticket.comments && ticket.comments.length ? `${ticket.comments.length} Comments` : "0 Comments"}</span>
                </div>
              </div>
            </div>

            <hr className="my-4" />

            <div className="prose max-w-none text-gray-700 mb-6">{ticket.description ? <div style={{ whiteSpace: "pre-line" }}>{ticket.description}</div> : <div className="text-sm text-gray-500">No description provided.</div>}</div>

            <hr className="my-4" />

            <div>
              {ticket.comments && ticket.comments.length > 0 ? (
                ticket.comments.map((c) => (
                  <div key={c.id} className="mb-6">
                    <div className="flex items-start gap-4">
                      {c.user?.avatar ? <img src={c.user.avatar} alt={c.user.name} className="w-12 h-12 rounded-full" /> : <div className="w-12 h-12 rounded-full bg-gray-200" />}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{c.user?.name || "User"}</div>
                            <div className="text-xs text-gray-500">Updated {dayjs(c.created_at).fromNow()}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-gray-700" style={{ whiteSpace: "pre-line" }}>
                          {c.message}
                        </div>

                        {c.attachments && c.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {c.attachments.map((att, idx) => (
                              <a key={idx} href={att.url || "#"} className="text-sm text-indigo-600 underline" target="_blank" rel="noreferrer">
                                {att.filename || "attachment"}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <hr className="mt-4" />
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">No replies yet.</div>
              )}
            </div>

            <form onSubmit={handlePostReply} className="mt-6">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="w-full border rounded p-3 min-h-[90px] focus:outline-none focus:ring" />
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-gray-500">Attach files not implemented in this demo</div>
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={postingReply || !replyText.trim()} className="px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-50">
                    {postingReply ? "Posting..." : "Post a Reply"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <aside className="col-span-4">
          <div className="bg-white rounded shadow p-4 mb-6">
            <h3 className="font-semibold text-lg mb-4">Ticket Details</h3>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Change Priority</label>
              <select value={localPriority} onChange={handlePriorityChange} className="w-full border rounded p-2">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              {savingField === "priority" && <div className="text-xs text-gray-500 mt-1">Saving...</div>}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Assign To</label>
              <select value={localAssignee} onChange={handleAssigneeChange} className="w-full border rounded p-2">
                <option value="null">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id ?? a.name} value={a.id == null ? "null" : String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </select>
              {savingField === "assignee_id" && <div className="text-xs text-gray-500 mt-1">Saving...</div>}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Ticket Status</label>
              <select value={localStatus} onChange={handleStatusChange} className="w-full border rounded p-2">
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="solved">Solved</option>
                <option value="closed">Closed</option>
              </select>
              {savingField === "status" && <div className="text-xs text-gray-500 mt-1">Saving...</div>}
            </div>
          </div>

          <div className="bg-white rounded shadow p-4 mb-4">
            <div className="text-xs text-gray-500">User</div>
            <div className="mt-3 flex items-center gap-3">
              {ticket.requester?.avatar ? <img src={ticket.requester.avatar} className="w-10 h-10 rounded-full" alt="user" /> : <div className="w-10 h-10 rounded-full bg-gray-200" />}
              <div>
                <div className="font-semibold">{ticket.requester?.name || ticket.requester?.full_name || "User"}</div>
                <div className="text-xs text-gray-500">{ticket.requester?.email || ""}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow p-4 mb-4">
            <div className="text-xs text-gray-500">Support Agent</div>
            <div className="mt-3 flex items-center gap-3">
              {ticket.assignee?.avatar ? <img src={ticket.assignee.avatar} className="w-10 h-10 rounded-full" alt="agent" /> : <div className="w-10 h-10 rounded-full bg-gray-200" />}
              <div>
                <div className="font-semibold">{ticket.assignee?.name || ticket.assignee_name || "Unassigned"}</div>
                <div className="text-xs text-gray-500">{ticket.assignee?.email || ""}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow p-4 mb-4">
            <div className="text-xs text-gray-500">Category</div>
            <div className="mt-2 font-medium">{ticket.category || "General"}</div>
          </div>

          <div className="bg-white rounded shadow p-4">
            <div className="text-xs text-gray-500">Created</div>
            <div className="mt-2">{ticket.created_at ? dayjs(ticket.created_at).format("DD MMM YYYY, h:mm A") : "—"}</div>

            {ticket.hotel && (
              <>
                <div className="text-xs text-gray-500 mt-4">Hotel</div>
                <div className="mt-2 font-medium">{ticket.hotel.name}</div>
              </>
            )}

            {ticket.updated_at && (
              <>
                <div className="text-xs text-gray-500 mt-4">Last Updated</div>
                <div className="mt-2">{dayjs(ticket.updated_at).format("DD MMM YYYY, h:mm A")}</div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
