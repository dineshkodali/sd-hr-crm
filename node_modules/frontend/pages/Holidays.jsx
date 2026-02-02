// src/pages/Holidays.jsx
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";

/**
 * Holidays.jsx
 * - load() is reusable and used on mount + fallback after POST
 * - Cache-bust GETs with a timestamp to avoid 304 cached responses
 * - If POST returns created row, prepend it; otherwise re-fetch list
 * - Keeps Add form in DOM and toggles visibility via opacity/transform
 * - Uses table-fixed + precise column widths and reduced padding to avoid horizontal overflow
 * - Action column uses clean icon-only Edit and Delete buttons matching screenshot
 */

function SkeletonTable({ rows = 1 }) {
  return (
    <div className="border rounded bg-white p-4" aria-hidden>
      <div className="mb-4 h-12 rounded bg-gray-100 animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="w-1/4 h-4 rounded bg-gray-100 animate-pulse" />
          <div className="w-1/6 h-4 rounded bg-gray-100 animate-pulse" />
          <div className="flex-1 h-4 rounded bg-gray-100 animate-pulse" />
          <div className="w-20 h-4 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EditModal({ open, onClose, holiday, onSave, saving }) {
  const [form, setForm] = useState({ title: "", date: "", description: "", status: "Active" });

  useEffect(() => {
    if (holiday) {
      setForm({
        title: holiday.title ?? "",
        date: holiday.date ? new Date(holiday.date).toISOString().slice(0, 10) : "",
        description: holiday.description ?? "",
        status: holiday.status ?? "Active",
      });
    } else {
      setForm({ title: "", date: "", description: "", status: "Active" });
    }
  }, [holiday]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-full max-w-md p-4 z-10">
        <h2 className="text-lg font-semibold mb-3">{holiday ? "Edit Holiday" : "Add Holiday"}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...form });
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Title</label>
              <input
                required
                className="w-full border p-2 rounded"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Date</label>
              <input
                required
                type="date"
                className="w-full border p-2 rounded"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full border p-2 rounded"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Status</label>
              <select
                className="w-full border p-2 rounded"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="px-3 py-1 border rounded" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-60" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDelete({ open, onClose, onConfirm, deleting }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-full max-w-sm p-4 z-10">
        <h3 className="text-lg font-semibold mb-2">Confirm delete</h3>
        <p className="text-sm text-gray-600">Are you sure you want to delete this holiday? This action cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="px-3 py-1 border rounded" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-60"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // edit modal state
  const [editing, setEditing] = useState(null); // holiday object being edited
  const [editSaving, setEditSaving] = useState(false);

  // delete confirm state
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // reserve height to avoid jumps when loading
  const reservedContentMinHeight = 140;

  const load = useCallback(
    async (opts = { silent: false }) => {
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const res = await axios.get("/api/holidays", {
          withCredentials: true,
          params: { t: Date.now() },
          headers: { "Cache-Control": "no-cache" },
        });
        setHolidays(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load holidays", err);
        const msg = err?.response?.data?.message || "Failed to load holidays";
        setError(msg);
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    []
  );

  // initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        await load();
      } catch {
        /* noop */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  function safeDateDisplay(d) {
    try {
      if (!d) return "-";
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return d || "-";
      return dt.toLocaleDateString();
    } catch {
      return d || "-";
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!form.title || !form.date) {
      setError("Title and date are required");
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post("/api/holidays", form, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });

      if (res && res.data && res.data.id) {
        setHolidays((prev) => [res.data, ...prev]);
        setForm({ title: "", date: "", description: "" });
        setShowAdd(false);
        setSuccessMsg("Holiday added");
      } else {
        await load({ silent: true });
        setForm({ title: "", date: "", description: "" });
        setShowAdd(false);
        setSuccessMsg("Holiday added (list refreshed)");
      }
    } catch (err) {
      console.error("Failed to save holiday", err);
      const msg = err?.response?.data?.message || err.message || "Failed to save holiday";
      setError(msg);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  }

  async function handleEditSave(payload) {
    if (!editing) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await axios.put(`/api/holidays/${editing.id}`, payload, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });
      if (res && res.data) {
        setHolidays((prev) => prev.map((p) => (p.id === editing.id ? res.data : p)));
        setEditing(null);
        setSuccessMsg("Holiday updated");
        setTimeout(() => setSuccessMsg(null), 2500);
      } else {
        // fallback: reload
        await load({ silent: true });
        setEditing(null);
      }
    } catch (err) {
      console.error("Failed to update holiday", err);
      const msg = err?.response?.data?.message || err.message || "Update failed";
      setError(msg);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      // eslint-disable-next-line no-unused-vars
      const res = await axios.delete(`/api/holidays/${toDelete.id}`, {
        withCredentials: true,
      });
      // remove from list
      setHolidays((prev) => prev.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
      setSuccessMsg("Holiday deleted");
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error("Failed to delete holiday", err);
      const msg = err?.response?.data?.message || err.message || "Delete failed";
      setError(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Holidays</h1>
            <p className="text-sm text-gray-500">Manage company holidays</p>
          </div>

          <div>
            <button
              onClick={() => {
                setError(null);
                setSuccessMsg(null);
                setShowAdd((s) => !s);
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded shadow-sm hover:bg-orange-700 transition"
              aria-expanded={showAdd}
            >
              {showAdd ? "Close" : "Add Holiday"}
            </button>
          </div>
        </div>

        {/* Add form */}
        <div className="mt-6">
          <div
            className={`transform transition-opacity transition-transform duration-200 ${
              showAdd ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
            aria-hidden={!showAdd}
          >
            <form onSubmit={handleAddSubmit} className="bg-gray-50 border rounded p-4 mb-4">
              <div className="grid grid-cols-3 gap-3">
                <input
                  className="col-span-1 p-2 border rounded"
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  aria-label="Holiday title"
                />
                <input
                  className="col-span-1 p-2 border rounded"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  aria-label="Holiday date"
                />
                <input
                  className="col-span-1 p-2 border rounded"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  aria-label="Holiday description"
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button type="submit" disabled={saving} className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-60">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1 border rounded">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Content */}
        <div style={{ minHeight: reservedContentMinHeight }}>
          {loading ? (
            <SkeletonTable rows={1} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-white border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm text-gray-700">
                    <th className="px-2 py-2 border-b w-[22%]">Title</th>
                    <th className="px-2 py-2 border-b w-[14%]">Date</th>
                    <th className="px-2 py-2 border-b w-[44%]">Description</th>
                    <th className="px-2 py-2 border-b w-[10%]">Status</th>
                    <th className="px-2 py-2 border-b w-[10%]">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-gray-500">
                        No holidays found.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => (
                      <tr key={h.id ?? JSON.stringify(h)} className="border-b odd:bg-white even:bg-gray-50">
                        <td className="px-2 py-3 font-medium truncate" title={h.title}>
                          {h.title}
                        </td>
                        <td className="px-2 py-3">{safeDateDisplay(h.date)}</td>
                        <td className="px-2 py-3 text-gray-600 truncate" title={h.description}>
                          {h.description}
                        </td>
                        <td className="px-2 py-3">{h.status || "Active"}</td>

                        {/* Action column: icon-only Edit & Delete (matches screenshot) */}
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditing(h);
                              }}
                              className="text-gray-600 hover:text-blue-600 transition"
                              title="Edit"
                              aria-label={`Edit ${h.title}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => {
                                setToDelete(h);
                              }}
                              className="text-gray-600 hover:text-red-600 transition"
                              title="Delete"
                              aria-label={`Delete ${h.title}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        {successMsg && <div className="mt-4 text-sm text-green-600">{successMsg}</div>}
      </div>

      {/* Edit modal */}
      <EditModal
        open={!!editing}
        onClose={() => setEditing(null)}
        holiday={editing}
        saving={editSaving}
        onSave={handleEditSave}
      />

      {/* Confirm delete */}
      <ConfirmDelete
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}
