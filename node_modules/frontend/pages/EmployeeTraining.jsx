/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/EmployeeTraining.jsx */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { usePermissions } from "../hooks/usePermissions";
import Breadcrumbs from "../components/Breadcrumbs";

/* axios instance */
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
 baseURL: API_BASE,
 withCredentials: true,
 timeout: 15000,
});

/* helper for normalizing hotels responses */
function normalizeHotelsResponse(data) {
 if (!data) return [];
 let items = [];
 if (Array.isArray(data)) items = data;
 else if (Array.isArray(data.data)) items = data.data;
 else if (Array.isArray(data.rows)) items = data.rows;
 else if (Array.isArray(data.hotels)) items = data.hotels;
 else if (typeof data === "object") {
 const vals = Object.values(data);
 const possibleObjects = vals.filter((v) => v && (v.id || v.name || v.hotel_name));
 if (possibleObjects.length && !Array.isArray(data)) {
 items = Array.isArray(possibleObjects[0]) ? possibleObjects[0] : possibleObjects;
 }
 }
 return items
 .map((h) => {
 const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;
 const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ""}`;
 const address = h?.address ?? null;
 return { id, name, address };
 })
 .filter((x) => x.id && x.name);
}

/* SAMPLE fallback data (for UI preview) */
const SAMPLE = [
 { id: 1, title: "Passport & VISA Verification", reference: "EMPT-2025-e5198a6e", description: "Operation work required as per inspection report.", priority: "Medium", status: "Completed", assignedTo: "ABC Maintenance", date: "2025-02-08", type: "Employee Training" },
 { id: 2, title: "Resident Data Update", reference: "EMPT-2025-c51690eb", description: "Operation work required as per inspection report.", priority: "Medium", status: "Pending", assignedTo: "Unassigned", date: "2025-09-26", type: "Employee Training" },
 { id: 3, title: "AIRE Annual Reporting", reference: "EMPT-2025-cda9bd4e", description: "Operation work required as per inspection report.", priority: "Low", status: "Completed", assignedTo: "In-house Team", date: "2025-06-02", type: "Employee Training" },
 { id: 4, title: "Immigrant Status Validation", reference: "EMPT-2025-2b9c6ef8", description: "Operation work required as per inspection report.", priority: "Urgent", status: "Completed", assignedTo: "Quick Fix Services", date: "2025-03-17", type: "Employee Training" },
 { id: 5, title: "Address Verification Support", reference: "EMPT-2025-f3c0c417", description: "Operation work required as per inspection report.", priority: "Low", status: "Pending", assignedTo: "Unassigned", date: "2024-12-19", type: "Employee Training" },
 { id: 6, title: "Residency Renewal Assistance", reference: "EMPT-2025-ca81318f", description: "Operation work required as per inspection report.", priority: "Medium", status: "Completed", assignedTo: "Quick Fix Services", date: "2024-10-24", type: "Employee Training" },
 { id: 7, title: "Fix extractor fan", reference: "EMPT-2025-576b7ce4", description: "Maintenance work required as per inspection report.", priority: "Low", status: "Pending", assignedTo: "Unassigned", date: "2025-04-24", type: "Employee Training" },
];

/* --- Helpers --- */
function formatDate(value) {
 if (!value) return "";
 try {
 const d = new Date(value);
 if (Number.isNaN(d.getTime())) return value;
 return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

// IMPROVED: Styles for badges
function getPriorityStyle(p) {
 const low = String(p).toLowerCase();
 if (low === "urgent") return { bg: "bg-red-50", text: "text-red-600", border: "border-red-100", dot: "text-red-500" };
 if (low === "medium") return { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", dot: "text-amber-500" };
 if (low === "low") return { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", dot: "text-blue-500" };
 return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-100", dot: "text-slate-400" };
}

function getStatusStyle(s) {
 const low = String(s).toLowerCase();
 if (low === "completed") return { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", icon: "text-emerald-500" };
 if (low === "pending" || low === "open" || low === "in progress") return { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", icon: "text-amber-500" };
 if (low === "rejected" || low === "cancelled") return { bg: "bg-red-50", text: "text-red-600", border: "border-red-100", icon: "text-red-500" };
 return { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", icon: "text-slate-400" };
}

function getAvatarColor(name) {
 const n = String(name).toLowerCase();
 if (n.includes("abc")) return "bg-purple-100 text-purple-600";
 if (n.includes("house") || n.includes("in-house")) return "bg-blue-100 text-blue-600";
 if (n.includes("quick")) return "bg-orange-100 text-orange-600";
 return "bg-slate-100 text-slate-500";
}

export default function EmployeeTraining() {
 // Get current user from props or localStorage
 const currentUser = (() => {
 try {
 const raw = localStorage.getItem("user");
 return raw ? JSON.parse(raw) : null;
 } catch {
 return null;
 }
 })();

 // Get permissions for training module (matches AccessManagement MODULES keys)
 const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
 const hasRead = canRead("training");
 const hasCreate = canCreate("training");
 const hasUpdate = canUpdate("training");
 const hasDelete = canDelete("training");

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
 const isCanceled = err && (err.name === "CanceledError" || err.code === "ERR_CANCELED" || axios.isCancel?.(err));
 if (!isCanceled) {
 console.error("EmployeeTraining fetchHotels error:", err);
 setHotels([]);
 }
 } finally {
 setHotelsLoading(false);
 }
 }, []);

 const loadTasks = useCallback(async (signal) => {
 setLoading(true);
 try {
 const res = await api.get("/api/employee-training", { signal, params: { limit: 200 } });
 const data = res?.data?.data ?? res?.data ?? [];
 let mapped = Array.isArray(data) ? data : [];

 const formattedTasks = mapped.map((t) => ({
 id: t.id,
 title: t.title ?? "",
 reference: t.reference ?? `EMPT-2025-${String(t.id).slice(0, 4)}`,
 description: t.description || "Operation work required as per inspection report.",
 priority: t.priority || "Medium",
 status: t.status || "Pending",
 assignedTo: t.assigned_to_name || "Unassigned",
 date: formatDateISO(t.due_date || t.scheduled_date || t.created_at),
 type: "Employee Training",
 raw: t,
 }));
 setTasks(formattedTasks);
 setLoading(false);
 } catch (err) {
 if (err.name === "AbortError") return;
 console.error("EmployeeTraining loadTasks error:", err);
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
 if (!confirm("Are you sure you want to delete this task?")) return;
 try {
 await api.delete(`/api/employee-training/${id}`);
 setTasks(prev => prev.filter(t => t.id !== id));
 } catch (err) {
 console.error("EmployeeTraining delete error:", err);
 alert("Failed to delete task");
 }
 }

 async function handleCreateSubmit(e) {
 e.preventDefault();
 setCreating(true);
 try {
 const res = await api.post("/api/employee-training", form);
 const newTask = {
 id: res.data.data.id,
 title: form.title,
 reference: res.data.data.reference || `EMPT-2025-${String(res.data.data.id).slice(0, 4)}`,
 description: form.description || "Operation work required as per inspection report.",
 priority: form.priority,
 status: "Pending",
 assignedTo: form.assigned_to_name || "Unassigned",
 date: formatDateISO(form.scheduled_date),
 type: "Employee Training",
 };
 setTasks([newTask, ...(tasks || [])]);
 setCreating(false);
 setShowCreate(false);
 } catch (err) {
 console.error("EmployeeTraining create error:", err);
 alert("Failed to create task: " + (err.response?.data?.error || err.message));
 setCreating(false);
 }
 }

 async function handleEditSubmit(e) {
 e.preventDefault();
 setEditing(true);
 try {
 await api.put(`/api/employee-training/${editingId}`, form);
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
 console.error("EmployeeTraining update error:", err);
 alert("Failed to update task: " + (err.response?.data?.error || err.message));
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
 <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
 <div className="p-3 sm:p-4 md:p-6">

 {/* Page Header */}
 <div className="mb-6 flex items-start justify-between">
 <div>
 <Breadcrumbs items={[{ label: 'Employees' }, { label: 'Training & Skills' }]} />
 <h1 className="text-3xl font-black text-slate-900 mt-1">Employee Training Dashboard</h1>
 </div>
 {hasCreate && (
 <button
 onClick={() => setShowCreate(true)}
 className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2"
 >
 <span className="text-lg leading-none">+</span> Add Record
 </button>
 )}
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
 <KPICard title="Total Trainings" count={stats.total} color="blue" icon={<IconBuilding size={20} />} trend="+2 new" />
 <KPICard title="Overdue" count={stats.overdue} color="red" icon={<IconAlertTriangle size={20} />} trend="Action needed" />
 <KPICard title="Due This Week" count={stats.dueThisWeek} color="orange" icon={<IconClock size={20} />} trend="Upcoming" />
 <KPICard title="Completed" count={stats.completed} color="green" icon={<IconCheck size={20} />} trend="Historical" />
 </div>

 {/* Main Content */}
 <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">

 {/* Toolbar */}
 <div className="p-5 border-b border-slate-100 bg-white">
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
 <div className="flex items-center gap-2">
 <h2 className="text-lg font-bold text-slate-800">Training Records</h2>
 <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">{stats.total}</span>
 </div>

 <div className="flex items-center gap-3 w-full sm:w-auto">
 <div className="relative flex-1 sm:flex-none">
 <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
 <input
 type="text"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Search by ID, title..."
 className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
 />
 </div>
 <button className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors" title="Filter">
 <IconFilter size={18} />
 </button>
 <button className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors" title="Export">
 <IconUpload size={18} />
 </button>
 </div>
 </div>

 <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
 <FilterPill label="All Priority" active />
 <FilterPill label="Urgent" />
 <FilterPill label="Pending" />
 <FilterPill label="Assigned" />
 </div>
 </div>

 {/* Table */}
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead className="bg-[var(--bg-primary)]">
 <tr className="border-b border-[var(--border-color)] text-xs font-semibold text-slate-500 uppercase tracking-wider">
 <th className="p-4 w-10 text-center"><input type="checkbox" className="rounded-xl border-slate-300 accent-orange-500 w-4 h-4 cursor-pointer" /></th>
 <th className="p-4 w-32">Reference</th>
 <th className="p-4 min-w-[250px]">Description</th>
 <th className="p-4">Priority</th>
 <th className="p-4">Status</th>
 <th className="p-4">Assigned To</th>
 <th className="p-4">Date</th>
 <th className="p-4 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="text-sm divide-y divide-slate-50">
 {loading ? (
 <tr><td colSpan="8" className="p-12 text-center text-slate-400">Loading records...</td></tr>
 ) : filtered.length > 0 ? filtered.map((row) => {
 const pStyle = getPriorityStyle(row.priority);
 const sStyle = getStatusStyle(row.status);

 return (
 <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
 <td className="p-4 text-center align-top pt-5">
 <input type="checkbox" className="rounded-xl border-slate-300 accent-orange-500 w-4 h-4 cursor-pointer" />
 </td>

 {/* Reference */}
 <td className="p-4 align-top pt-5">
 <div className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-xl w-fit whitespace-nowrap">
 {row.reference}
 </div>
 <div className="mt-2 text-[10px] uppercase text-slate-400 font-bold tracking-wide">
 {row.type}
 </div>
 </td>

 {/* Title & Desc */}
 <td className="p-4 align-top pt-5">
 <div className="font-semibold text-slate-800 text-base cursor-pointer hover:text-orange-600 transition-colors" onClick={() => openEdit(row)}>
 {row.title}
 </div>
 <div className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2">{row.description}</div>
 </td>

 {/* Priority */}
 <td className="p-4 align-top pt-5">
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pStyle.bg} ${pStyle.border} ${pStyle.text}`}>
 <span className={`w-1.5 h-1.5 rounded-full bg-current opacity-75`}></span>
 {row.priority}
 </span>
 </td>

 {/* Status */}
 <td className="p-4 align-top pt-5">
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sStyle.bg} ${sStyle.border} ${sStyle.text}`}>
 {row.status === 'Completed' && <IconCheck size={10} strokeWidth={4} />}
 {row.status}
 </span>
 </td>

 {/* Assigned To */}
 <td className="p-4 align-top pt-5">
 <div className="flex items-center gap-3">
 {row.assignedTo === "Unassigned" ? (
 <span className="text-slate-400 text-xs italic bg-slate-50 px-2 py-1 rounded-xl">Unassigned</span>
 ) : (
 <div className="flex items-center gap-2">
 <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(row.assignedTo)}`}>
 {getInitials(row.assignedTo)}
 </div>
 <div className="flex flex-col">
 <span className="text-slate-700 font-medium text-xs">{row.assignedTo}</span>
 </div>
 </div>
 )}
 </div>
 </td>

 {/* Date */}
 <td className="p-4 align-top pt-5 whitespace-nowrap">
 <div className="flex items-center gap-2 text-slate-600">
 <IconCalendar size={14} className="text-slate-400" />
 {formatDate(row.date)}
 </div>
 </td>

 {/* Actions */}
 <td className="p-4 align-top pt-4 text-right">
 <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
 <button onClick={() => openView(row)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="View Details">
 <IconEye size={18} />
 </button>
 {hasUpdate && <button onClick={() => openEdit(row)} className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors" title="Edit Task">
 <IconEdit size={18} />
 </button>}
 {hasDelete && <button onClick={() => handleDelete(row.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete Task">
 <IconTrash size={18} />
 </button>}
 </div>
 </td>
 </tr>
 );
 }) : (
 <tr>
 <td colSpan="8" className="p-12 text-center">
 <div className="flex flex-col items-center justify-center text-slate-400">
 <div className="bg-slate-50 p-4 rounded-full mb-3">
 <IconList size={32} className="opacity-50" />
 </div>
 <p className="text-base font-medium text-slate-600">No training records found</p>
 <p className="text-sm mt-1">Try adjusting your filters or add a new record.</p>
 <button onClick={() => setShowCreate(true)} className="mt-4 text-orange-500 hover:text-orange-600 text-sm font-medium rounded-xl">Add Record</button>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
 <div>Showing <span className="font-medium text-slate-700">{filtered.length}</span> of {stats.total} results</div>
 <div className="flex gap-2">
 <button className="px-3 py-1 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
 <button className="px-3 py-1 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
 </div>
 </div>
 </div>
 </div>

 {/* ----------------- VIEW MODAL ----------------- */}
 {showView && viewingTask && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">

 <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Training Details</h3>
 <div className="flex items-center gap-2 mt-1">
 <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 rounded-xl">{viewingTask.reference}</span>
 </div>
 </div>
 <button onClick={() => { setShowView(false); setViewingTask(null); }} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors">
 <IconX size={20} />
 </button>
 </div>

 <div className="p-6 overflow-y-auto max-h-[80vh]">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

 {/* Full width section */}
 <div className="md:col-span-2 space-y-4">
 <div>
 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Title</label>
 <p className="text-lg font-medium text-slate-900 mt-1">{viewingTask.title}</p>
 </div>
 <div>
 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</label>
 <div className="mt-1 p-3 bg-slate-50 rounded-xl text-sm text-slate-700 leading-relaxed border border-slate-100">
 {viewingTask.description || viewingTask.raw?.description}
 </div>
 </div>
 </div>

 <ViewField label="Status" value={viewingTask.status} pill={getStatusStyle(viewingTask.status)} />
 <ViewField label="Priority" value={viewingTask.priority} pill={getPriorityStyle(viewingTask.priority)} />

 <ViewField label="Property" value={viewingTask.raw?.property_name || "N/A"} icon={<IconBuilding size={14} />} />
 <ViewField label="Category" value={viewingTask.raw?.category} />

 <ViewField label="Assigned To" value={viewingTask.assignedTo} icon={<IconUser size={14} />} />
 <ViewField label="Reported By" value={viewingTask.raw?.reported_by} />

 <ViewField label="Scheduled Date" value={formatDate(viewingTask.date)} icon={<IconCalendar size={14} />} />
 <ViewField label="Task Type" value={viewingTask.type} />
 </div>

 <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
 <button
 onClick={() => { setShowView(false); setViewingTask(null); }}
 className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm"
 >
 Close
 </button>
 <button
 onClick={() => { setShowView(false); openEdit(viewingTask); }}
 className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-medium shadow-sm transition-colors text-sm flex items-center gap-2"
 >
 <IconEdit size={16} /> Edit Task
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ----------------- CREATE/EDIT MODAL ----------------- */}
 {(showCreate || showEdit) && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">

 <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
 <div>
 <h3 className="text-xl font-bold text-slate-800">{showEdit ? "Edit Task" : "Create New Task"}</h3>
 <p className="text-sm text-slate-500 mt-0.5">Fill in the details below to track employee training.</p>
 </div>
 <button onClick={() => { setShowCreate(false); setShowEdit(false); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors">
 <IconX size={20} />
 </button>
 </div>

 <form onSubmit={showEdit ? handleEditSubmit : handleCreateSubmit} className="p-6">
 <div className="space-y-6">

 {/* Top Section */}
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Task Title <span className="text-red-500">*</span></label>
 <input
 required
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400"
 placeholder="e.g. Compliance Training Module A"
 value={form.title}
 onChange={e => handleFormChange("title", e.target.value)}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-red-500">*</span></label>
 <textarea
 required
 rows={3}
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-y placeholder:text-slate-400"
 placeholder="Detailed description of the training or task..."
 value={form.description}
 onChange={e => handleFormChange("description", e.target.value)}
 />
 </div>
 </div>

 <div className="h-px bg-slate-100 w-full" />

 {/* Grid Section */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Property <span className="text-red-500">*</span></label>
 <div className="relative">
 <select
 required
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white appearance-none"
 value={form.property_id}
 onChange={handleHotelChange}
 >
 <option value="">Select property...</option>
 {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
 </select>
 <IconChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Category <span className="text-red-500">*</span></label>
 <div className="relative">
 <select
 required
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white appearance-none"
 value={form.category}
 onChange={e => handleFormChange("category", e.target.value)}
 >
 <option value="">Select category...</option>
 <option value="Employee Training">Employee Training</option>
 <option value="Onboarding">Onboarding</option>
 <option value="Compliance">Compliance</option>
 <option value="Skills">Skills</option>
 </select>
 <IconChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority <span className="text-red-500">*</span></label>
 <div className="flex gap-3">
 {['Low', 'Medium', 'Urgent'].map(p => (
 <button
 key={p}
 type="button"
 onClick={() => handleFormChange("priority", p.toLowerCase())}
 className={`flex-1 py-2 text-sm border rounded-xl transition-all ${form.priority === p.toLowerCase()
 ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
 : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
 >
 {p}
 </button>
 ))}
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Scheduled Date</label>
 <div className="relative">
 <input
 type="date"
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
 value={formatDateISO(form.scheduled_date)}
 onChange={e => handleFormChange("scheduled_date", e.target.value)}
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Reported By <span className="text-red-500">*</span></label>
 <input
 required
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
 placeholder="Reporter Name"
 value={form.reported_by}
 onChange={e => handleFormChange("reported_by", e.target.value)}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1.5">Assigned To</label>
 <input
 className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
 placeholder="Assignee Name"
 value={form.assigned_to_name}
 onChange={e => handleFormChange("assigned_to_name", e.target.value)}
 />
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-slate-100">
 <button
 type="button"
 onClick={() => { setShowCreate(false); setShowEdit(false); }}
 className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium transition-colors text-sm"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-medium shadow-md shadow-orange-500/20 transition-all text-sm flex items-center gap-2"
 >
 {creating || editing ? "Saving..." : (showEdit ? "Update Task" : "Create Task")}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}

/* --- Sub-Components --- */

function KPICard({ title, count, color, icon, trend }) {
 const styles = {
 blue: { bg: "bg-blue-500", light: "bg-blue-50", text: "text-blue-600" },
 red: { bg: "bg-red-500", light: "bg-red-50", text: "text-red-600" },
 orange: { bg: "bg-orange-500", light: "bg-orange-50", text: "text-orange-600" },
 green: { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600" },
 };
 const theme = styles[color] || styles.blue;

 return (
 <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[120px] relative overflow-hidden group ">
 <div className={`absolute top-0 left-0 w-full h-1 ${theme.bg}`}></div>
 <div className="flex justify-between items-start">
 <div>
 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{title}</div>
 <div className="text-3xl font-bold text-slate-800 mt-2">{count}</div>
 </div>
 <div className={`w-10 h-10 rounded-xl ${theme.light} flex items-center justify-center ${theme.text}`}>
 {icon}
 </div>
 </div>
 {trend && (
 <div className="mt-3 text-xs font-medium text-slate-400 flex items-center gap-1">
 <span className={`${theme.text} bg-white border border-slate-100 px-1.5 py-0.5 rounded-xl`}>{trend}</span>
 <span>since last week</span>
 </div>
 )}
 </div>
 );
}

function FilterPill({ label, active }) {
 return (
 <button className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
 {label}
 </button>
 );
}

function ViewField({ label, value, icon, pill }) {
 return (
 <div>
 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
 {icon} {label}
 </label>
 <div className="mt-1">
 {pill ? (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pill.bg} ${pill.border} ${pill.text}`}>
 {pill.icon && <span className={`w-1.5 h-1.5 rounded-full bg-current`}></span>}
 {value || "N/A"}
 </span>
 ) : (
 <p className="text-sm font-medium text-slate-800">{value || "N/A"}</p>
 )}
 </div>
 </div>
 )
}

/* Icons */
const IconHome = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const IconSearch = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const IconBuilding = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><line x1="9" y1="9" x2="9" y2="9"></line><line x1="9" y1="12" x2="9" y2="12"></line><line x1="9" y1="15" x2="9" y2="15"></line><line x1="9" y1="18" x2="9" y2="18"></line></svg>;
const IconAlertTriangle = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const IconClock = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const IconCheck = ({ size, strokeWidth = 2 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const IconChevronDown = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const IconList = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const IconFilter = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;
const IconUpload = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>;
const IconTrash = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const IconEdit = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const IconEye = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const IconX = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconUser = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const IconCalendar = ({ size, className }) => <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;