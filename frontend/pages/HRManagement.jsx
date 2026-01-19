/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/HRManagement.jsx */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";

/* --- CONFIGURATION --- */
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

/* --- ICONS COLLECTION --- */
// Fixed: Destructured 'size' to apply width/height correctly to SVGs
const Icons = {
  Home: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Search: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Building: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><line x1="9" y1="9" x2="9" y2="9"></line><line x1="9" y1="12" x2="9" y2="12"></line><line x1="9" y1="15" x2="9" y2="15"></line><line x1="9" y1="18" x2="9" y2="18"></line></svg>,
  Alert: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Clock: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Check: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  ChevronDown: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  List: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
  Filter: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  Columns: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path></svg>,
  Upload: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
  Trash: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Edit: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  X: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  FileText: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  User: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Calendar: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  Eye: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  Zap: ({ size = 24, ...p }) => <svg width={size} height={size} {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
};

/* --- UTILS --- */
function normalizeHotelsResponse(data) {
  if (!data) return [];
  let items = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data.data)) items = data.data;
  else if (Array.isArray(data.rows)) items = data.rows;
  else if (Array.isArray(data.hotels)) items = data.hotels;

  return items.map((h) => ({
    id: h?.id ?? h?.hotel_id ?? null,
    name: h?.name ?? h?.title ?? h?.hotel_name ?? "Unknown Property",
  })).filter((x) => x.id);
}

/* SAMPLE fallback data */
const SAMPLE = [
  { id: 1, title: "Passport & VISA Verification", reference: "HRM-2025-e5198a6e", description: "Operation work required as per inspection report.", priority: "Medium", status: "Completed", assignedTo: "ABC Maintenance", date: "2025-02-08", type: "HR Management" },
  { id: 2, title: "Resident Data Update", reference: "HRM-2025-c51690eb", description: "Operation work required as per inspection report.", priority: "Medium", status: "Pending", assignedTo: "Unassigned", date: "2025-09-26", type: "HR Management" },
];

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return value; }
}

function formatDateISO(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  } catch { return value; }
}

function getInitials(name) {
  if (!name || name === "Unassigned") return "UA";
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

function getPriorityColor(p) {
  const low = String(p).toLowerCase();
  if (low === "urgent") return "text-red-500";
  if (low === "medium") return "text-amber-400";
  return "text-emerald-500";
}

function getStatusColor(s) {
  const low = String(s).toLowerCase();
  if (low === "completed") return "text-emerald-500";
  if (low === "pending" || low === "open" || low === "in progress") return "text-amber-400";
  return "text-slate-500";
}

function getAvatarColor(name) {
  const n = String(name).toLowerCase();
  if (n.includes("abc")) return "bg-amber-400";
  if (n.includes("house") || n.includes("in-house")) return "bg-blue-500";
  if (n.includes("quick")) return "bg-orange-500";
  return "bg-slate-300";
}

export default function HRManagement() {
  // Get current user from props or localStorage
  const currentUser = (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Get permissions for hr_management module (matches AccessManagement MODULES keys)
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const hasRead = canRead("hr_management");
  const hasCreate = canCreate("hr_management");
  const hasUpdate = canUpdate("hr_management");
  const hasDelete = canDelete("hr_management");

  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);

  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);

  const hotelsControllerRef = useRef(null);

  // Form state
  const initialForm = useMemo(() => ({
    title: "",
    description: "",
    property_id: "",
    property_name: "",
    category: "",
    priority: "medium",
    reported_by: "",
    assigned_to_name: "",
    scheduled_date: "",
  }), []);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!showCreate && !showEdit) {
      setForm(initialForm);
      setCreating(false);
      setEditing(false);
      setEditingId(null);
    }
  }, [showCreate, showEdit, initialForm]);

  /* ------------------------- Data Loading ------------------------- */
  const fetchHotels = useCallback(async (signal) => {
    try {
      setHotelsLoading(true);
      const res = await api.get("/api/hotels", { params: { limit: 1000 }, signal });
      const normalized = normalizeHotelsResponse(res?.data ?? {});
      setHotels(normalized);
    } catch (err) {
      if (err.name !== "CanceledError") {
        console.error("fetchHotels error:", err);
        setHotels([]);
      }
    } finally {
      setHotelsLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await api.get("/api/hr-management", { signal, params: { limit: 200 } });
      const data = res?.data?.data ?? res?.data ?? [];
      let mapped = Array.isArray(data) ? data : [];

      const formattedTasks = mapped.map((t) => ({
        id: t.id,
        title: t.title ?? "",
        reference: t.reference ?? `HRM-2025-${String(t.id).slice(0, 4)}`,
        description: t.description || "Operation work required as per inspection report.",
        priority: t.priority || "Medium",
        status: t.status || "Pending",
        assignedTo: t.assigned_to_name || "Unassigned",
        date: formatDateISO(t.due_date || t.scheduled_date || t.created_at),
        type: t.type || "HR Management",
        raw: t,
      }));
      setTasks(formattedTasks);
      setLoading(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("loadTasks error:", err);
      setTasks(SAMPLE);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    hotelsControllerRef.current = ac;
    fetchHotels(ac.signal);
    loadTasks(ac.signal);
    return () => {
      try { ac.abort(); } catch { }
      hotelsControllerRef.current = null;
    };
  }, [fetchHotels, loadTasks]);

  /* ------------------------- Logic ------------------------- */
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const list = tasks || [];
    if (!q) return list;
    return list.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.reference.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  }, [tasks, query]);

  const stats = useMemo(() => {
    const list = tasks || SAMPLE;
    const total = list.length;
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overdue = list.filter(t => {
      if (t.status === "Completed") return false;
      const dueDate = t.date ? new Date(t.date) : null;
      return dueDate && dueDate < now;
    }).length;

    const dueThisWeek = list.filter(t => {
      if (t.status === "Completed") return false;
      const dueDate = t.date ? new Date(t.date) : null;
      return dueDate && dueDate >= now && dueDate <= oneWeekFromNow;
    }).length;

    const completed = list.filter(t => t.status.toLowerCase() === "completed").length;

    return { total, overdue, dueThisWeek, completed };
  }, [tasks]);

  /* ------------------------- Handlers ------------------------- */
  async function handleDelete(id) {
    if (!confirm("Delete this task?")) return;
    try {
      await api.delete(`/api/hr-management/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete task");
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post("/api/hr-management", form);
      const newTask = {
        id: res.data.data.id,
        title: form.title,
        reference: res.data.data.reference,
        description: form.description || "Operation work required as per inspection report.",
        priority: form.priority,
        status: "Pending",
        assignedTo: form.assigned_to_name || "Unassigned",
        date: formatDateISO(form.scheduled_date),
        type: "HR Management",
      };
      setTasks([newTask, ...(tasks || [])]);
      setCreating(false);
      setShowCreate(false);
    } catch (err) {
      console.error("Create error:", err);
      alert("Failed to create task");
      setCreating(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditing(true);
    try {
      await api.put(`/api/hr-management/${editingId}`, form);
      const updatedTask = {
        ...tasks.find(t => t.id === editingId),
        title: form.title,
        description: form.description,
        priority: form.priority,
        assignedTo: form.assigned_to_name || "Unassigned",
        date: formatDateISO(form.scheduled_date),
      };
      setTasks(prev => prev.map(t => t.id === editingId ? updatedTask : t));
      setEditing(false);
      setShowEdit(false);
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update task");
      setEditing(false);
    }
  }

  function openEdit(task) {
    setEditingId(task.id);
    const raw = task.raw || {};
    setForm({
      title: task.title || "",
      description: raw.description || "",
      property_id: raw.property_id || "",
      property_name: raw.property_name || "",
      category: raw.category || "",
      priority: task.priority?.toLowerCase() || "medium",
      reported_by: raw.reported_by || "",
      assigned_to_name: task.assignedTo === "Unassigned" ? "" : task.assignedTo,
      scheduled_date: formatDateISO(task.date),
    });
    setShowEdit(true);
  }

  function openView(task) {
    setViewingTask(task);
    setShowView(true);
  }

  function handleFormChange(field, value) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function handleHotelChange(e) {
    const hotelId = e.target.value;
    const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
    setForm((p) => ({ ...p, property_id: hotelId, property_name: hotel ? hotel.name : "" }));
  }

  /* ------------------------- UI RENDERER ------------------------- */
  return (
    <div className="min-h-screen bg-white font-sans text-slate-700 pb-12">

      {/* Header */}
      <div className="bg-white px-8 py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">HR Management</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <Icons.Home size={14} className="text-slate-400" />
              <span>/</span> <span>Employees</span> <span>/</span> <span className="text-slate-900">HR Management</span>
            </div>
          </div>
          {hasCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-[#e87c48] hover:bg-[#d66b38] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2"
            >
              <Icons.Upload size={16} /> Add Task
            </button>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard title="Total Tasks" count={stats.total} color="blue" icon={<Icons.Building size={20} />} />
          <KPICard title="Overdue" count={stats.overdue} color="red" icon={<Icons.Alert size={20} />} />
          <KPICard title="Due This Week" count={stats.dueThisWeek} color="orange" icon={<Icons.Clock size={20} />} />
          <KPICard title="Completed" count={stats.completed} color="green" icon={<Icons.Check size={20} />} />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8">

        {/* Toolbar - MOVED OUTSIDE THE TABLE AND REDUCED GAP */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">All Tasks</h2>
              <p className="text-xs text-slate-500">{stats.total} total records</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter tasks..."
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-md text-sm w-64 focus:outline-none focus:border-slate-400 transition-all"
                />
              </div>
              <ToolbarButton icon={<Icons.List size={16} />} label="View" hasDropdown />
              <ToolbarButton icon={<Icons.Filter size={16} />} label="Filter" />
              <ToolbarButton icon={<Icons.Columns size={16} />} label="Columns" />
            </div>
          </div>

          <div className="flex gap-3">
            <FilterDropdown label="All Priority" />
            <FilterDropdown label="All Status" />
            <FilterDropdown label="All Properties" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-300 accent-[#e87c48]" /></th>
                  <Th label="Type" />
                  <Th label="Reference" icon={<Icons.FileText size={12} />} />
                  <Th label="Description" icon={<Icons.FileText size={12} />} className="w-1/3" />
                  <Th label="Priority" icon={<Icons.Clock size={12} />} />
                  <Th label="Status" icon={<Icons.Zap size={12} />} />
                  <Th label="Assigned To" icon={<Icons.User size={12} />} />
                  <Th label="Date" icon={<Icons.Calendar size={12} />} />
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loading ? (
                  <tr><td colSpan="9" className="p-10 text-center text-slate-400 font-medium">Loading data...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="9" className="p-10 text-center text-slate-400">No tasks found.</td></tr>
                ) : filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-center"><input type="checkbox" className="rounded border-slate-300 accent-[#e87c48]" /></td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-400 border border-orange-100 text-[11px] font-bold uppercase whitespace-nowrap">
                        {row.type}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-700 text-xs">{row.reference}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm cursor-pointer hover:text-[#e87c48]" onClick={() => openEdit(row)}>{row.title}</div>
                      <div className="text-slate-500 text-xs truncate max-w-[240px] mt-0.5">{row.description}</div>
                    </td>
                    <td className="p-4">
                      <div className={`flex items-center gap-2 text-xs font-medium ${getPriorityColor(row.priority)}`}>
                        <span className={`w-2 h-2 rounded-full bg-current opacity-60`}></span>
                        <span className="capitalize">{row.priority}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className={`flex items-center gap-2 text-xs font-medium ${getStatusColor(row.status)}`}>
                        <span className={`w-2 h-2 rounded-full bg-current opacity-60`}></span>
                        <span className="capitalize">{row.status}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {row.assignedTo === "Unassigned" ? (
                          <span className="text-slate-400 text-xs">Unassigned</span>
                        ) : (
                          <>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAvatarColor(row.assignedTo)}`}>
                              {getInitials(row.assignedTo)}
                            </div>
                            <span className="text-slate-600 font-medium text-sm">{row.assignedTo}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 text-xs whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <ActionButton onClick={() => openView(row)} icon={<Icons.Eye size={16} />} title="View" />
                        {hasUpdate && <ActionButton onClick={() => openEdit(row)} icon={<Icons.Edit size={16} />} title="Edit" />}
                        {hasDelete && <ActionButton onClick={() => handleDelete(row.id)} icon={<Icons.Trash size={16} />} title="Delete" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ----------------- VIEW MODAL ----------------- */}
      {showView && viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Task Details</h3>
              <button onClick={() => { setShowView(false); setViewingTask(null); }} className="text-slate-400 hover:text-slate-600"><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Title & Reference</div>
                <div className="text-lg font-bold text-slate-800">{viewingTask.title}</div>
                <div className="text-sm font-mono text-slate-500">{viewingTask.reference}</div>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</div>
                <p className="text-sm text-slate-600">{viewingTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Property" value={viewingTask.raw?.property_name || '-'} />
                <ViewField label="Category" value={viewingTask.raw?.category || viewingTask.type} />
                <ViewField label="Priority" value={viewingTask.priority} />
                <ViewField label="Status" value={viewingTask.status} />
                <ViewField label="Assigned To" value={viewingTask.assignedTo} />
                <ViewField label="Reported By" value={viewingTask.raw?.reported_by || '-'} />
                <ViewField label="Due Date" value={formatDate(viewingTask.date)} />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => { setShowView(false); setViewingTask(null); }} className="px-4 py-2 bg-white border border-slate-300 rounded text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- FORM MODAL ----------------- */}
      {(showCreate || showEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{showEdit ? "Edit Task" : "Create New Task"}</h3>
                <p className="text-xs text-slate-500">Fill in the details below.</p>
              </div>
              <button onClick={() => { setShowCreate(false); setShowEdit(false); }} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <Icons.X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <form id="taskForm" onSubmit={showEdit ? handleEditSubmit : handleCreateSubmit} className="space-y-6">
                {/* Form fields identical to logic but tighter UI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
                    <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-[#e87c48] outline-none" placeholder="Brief description" value={form.title} onChange={e => handleFormChange("title", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea required rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-[#e87c48] outline-none resize-none" placeholder="Detailed description..." value={form.description} onChange={e => handleFormChange("description", e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-5 col-span-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Property</label>
                      <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={form.property_id} onChange={handleHotelChange}>
                        <option value="">Select Property</option>
                        {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                      <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={form.category} onChange={e => handleFormChange("category", e.target.value)}>
                        <option value="">Select category</option>
                        <option value="HR Management">HR Management</option>
                        <option value="Employee Relations">Employee Relations</option>
                        <option value="Recruitment">Recruitment</option>
                        <option value="Training">Training</option>
                        <option value="Compliance">Compliance</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 col-span-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Priority</label>
                      <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={form.priority} onChange={e => handleFormChange("priority", e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Reported By</label>
                      <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={form.reported_by} onChange={e => handleFormChange("reported_by", e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 col-span-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Assigned To</label>
                      <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={form.assigned_to_name} onChange={e => handleFormChange("assigned_to_name", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                      <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={formatDateISO(form.scheduled_date)} onChange={e => handleFormChange("scheduled_date", e.target.value)} />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowCreate(false); setShowEdit(false); }} className="px-5 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-white font-medium text-sm">Cancel</button>
              <button form="taskForm" type="submit" disabled={creating || editing} className="px-6 py-2 bg-[#e87c48] text-white rounded-lg hover:bg-[#d66b38] font-medium text-sm shadow-sm flex items-center gap-2">
                {creating || editing ? "Saving..." : "Save Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Sub-Components --- */
function KPICard({ title, count, color, icon }) {
  const styles = {
    blue: "bg-blue-500 shadow-blue-500/20",
    red: "bg-red-500 shadow-red-500/20",
    orange: "bg-[#e87c48] shadow-orange-500/20",
    green: "bg-emerald-500 shadow-emerald-500/20",
  };
  // Fixed: Smaller size w-10 h-10 and p-4 padding
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full ${styles[color]} flex items-center justify-center text-white shrink-0 shadow-lg`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{count}</div>
        <div className="text-slate-500 text-xs font-medium uppercase">{title}</div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon, label, hasDropdown }) {
  return (
    <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50">
      {icon} {label} {hasDropdown && <Icons.ChevronDown size={12} />}
    </button>
  );
}

function FilterDropdown({ label }) {
  return (
    <button className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-600 w-32 hover:bg-slate-100">
      {label} <Icons.ChevronDown size={12} />
    </button>
  );
}

function Th({ label, icon, className }) {
  return (
    <th className={`p-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${className}`}>
      <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600">
        {label} {icon || <Icons.ChevronDown size={12} />}
      </div>
    </th>
  );
}

function ActionButton({ onClick, icon, title }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title={title} className="p-1.5 hover:text-[#e87c48] transition-colors">
      {icon}
    </button>
  );
}

function ViewField({ label, value }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}