import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { Search, ChevronDown, Plus, X, Check, Home, Building, ChevronRight } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";

axios.defaults.withCredentials = true;

const DEFAULT_INVENTORY_OPTIONS = [
 "Single Bed", "Double Bed", "Mattress", "Wardrobe", "Chest of Drawers",
 "Bedside Table", "Desk", "Chair", "Curtains", "Blinds",
 "Mirror", "Television", "Mini Fridge", "Fan", "Heater",
 "Kettle", "Microwave", "Towel Rail", "Bin"
];

export default function RoomDetails() {
 const { hotelId, roomId } = useParams();
 const navigate = useNavigate();

 const [hotel, setHotel] = useState(null);
 const [room, setRoom] = useState(null);
 const [bedspacesCount, setBedspacesCount] = useState(null);
 const [residents, setResidents] = useState([]);
 const [activeTab, setActiveTab] = useState("overview");

 // Multi-dropdown state
 const [openInventoryDropdown, setOpenInventoryDropdown] = useState(false);
 const [inventorySearch, setInventorySearch] = useState("");
 const inventoryDropdownRef = useRef(null);

 const [openResidentDropdown, setOpenResidentDropdown] = useState(false);
 const [residentSearch, setResidentSearch] = useState("");
 const residentDropdownRef = useRef(null);
 const [availableSU, setAvailableSU] = useState([]); // All SU for selection
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [customInventoryOptions, setCustomInventoryOptions] = useState([]);

 // Edit states for Overview tab
 const [isEditingOverview, setIsEditingOverview] = useState(false);
 const [overviewFormData, setOverviewFormData] = useState({});

 // Edit states for Inventory tab
 const [isEditingInventory, setIsEditingInventory] = useState(false);
 const [inventoryFormData, setInventoryFormData] = useState("");

 // Edit states for Residents tab
 const [isEditingResidents, setIsEditingResidents] = useState(false);
 const [residentsFormData, setResidentsFormData] = useState([]);

 const [saving, setSaving] = useState(false);

 const roomNumber = useMemo(() => {
 const rn = room?.room_number ?? room?.room ?? room?.number ?? "";
 return rn === null || rn === undefined ? "" : String(rn);
 }, [room]);

 useEffect(() => {
 const stored = localStorage.getItem("customInventoryOptions");
 if (stored) {
 try {
 setCustomInventoryOptions(JSON.parse(stored));
 } catch (e) {
 console.error("Failed to parse customInventoryOptions", e);
 }
 }
 }, []);

 useEffect(() => {
 const handleClickOutside = (event) => {
 if (inventoryDropdownRef.current && !inventoryDropdownRef.current.contains(event.target)) {
 setOpenInventoryDropdown(false);
 }
 if (residentDropdownRef.current && !residentDropdownRef.current.contains(event.target)) {
 setOpenResidentDropdown(false);
 }
 };
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 useEffect(() => {
 let cancelled = false;
 const fetchAvailableSU = async () => {
 if (!hotelId) return;
 try {
 const res = await axios.get("/api/su/users", { params: { hotel_id: hotelId } });
 const list = Array.isArray(res.data)
 ? res.data
 : Array.isArray(res.data?.users)
 ? res.data.users
 : Array.isArray(res.data?.data)
 ? res.data.data
 : [];
 // Only active SU
 const filtered = list.filter(u => String(u.status || "").toLowerCase() === "active");
 if (!cancelled) setAvailableSU(filtered);
 } catch (err) {
 console.error("Failed to load available SU", err);
 }
 };
 fetchAvailableSU();
 return () => { cancelled = true; };
 }, [hotelId]);

 useEffect(() => {
 let cancelled = false;

 const load = async () => {
 if (!hotelId || !roomId) return;
 setLoading(true);
 setError("");
 try {
 const [hotelRes, roomRes] = await Promise.all([
 axios.get(`/api/hotels/${hotelId}`),
 axios.get(`/api/hotels/${hotelId}/rooms/${roomId}`),
 ]);

 if (cancelled) return;
 setHotel(hotelRes?.data?.hotel ?? hotelRes?.data ?? null);
 const loadedRoom = roomRes?.data?.room ?? roomRes?.data ?? null;
 setRoom(loadedRoom);

 const loadedHasKitchen = loadedRoom?.has_kitchen ?? loadedRoom?.kitchen ?? loadedRoom?.hasKitchen ?? null;
 const loadedHasBathroom = loadedRoom?.has_bathroom ?? loadedRoom?.bathroom ?? loadedRoom?.bathroom_available ?? loadedRoom?.hasBathroom ?? null;
 setOverviewFormData({
 type: loadedRoom?.type || "",
 length: loadedRoom?.length ?? loadedRoom?.room_length ?? "",
 width: loadedRoom?.width ?? loadedRoom?.room_width ?? "",
 bathroom_type: loadedRoom?.bathroom_type ?? loadedRoom?.bathroom ?? "",
 has_kitchen: loadedHasKitchen === true ? "yes" : loadedHasKitchen === false ? "no" : "",
 has_bathroom: loadedHasBathroom === true ? "yes" : loadedHasBathroom === false ? "no" : "",
 });
 setInventoryFormData(
 Array.isArray(loadedRoom?.inventory)
 ? loadedRoom?.inventory?.join(", ") || ""
 : loadedRoom?.inventory || ""
 );
 } catch (err) {
 if (cancelled) return;
 const msg =
 err?.response?.data?.error ||
 err?.response?.data?.message ||
 err?.message ||
 "Failed to load room details";
 setError(msg);
 setHotel(null);
 setRoom(null);
 } finally {
 if (!cancelled) setLoading(false);
 }
 };

 load();
 return () => {
 cancelled = true;
 };
 }, [hotelId, roomId]);

 useEffect(() => {
 let cancelled = false;

 const loadBedspaces = async () => {
 if (!hotelId || !roomId) return;
 try {
 const res = await axios.get(`/api/hotels/${hotelId}/rooms/${roomId}/bedspaces`);
 const list = Array.isArray(res.data?.bedspaces)
 ? res.data.bedspaces
 : Array.isArray(res.data)
 ? res.data
 : [];
 if (!cancelled) setBedspacesCount(list.length);
 } catch {
 if (!cancelled) setBedspacesCount(null);
 }
 };

 loadBedspaces();
 return () => {
 cancelled = true;
 };
 }, [hotelId, roomId]);

 useEffect(() => {
 let cancelled = false;

 const loadResidents = async () => {
 if (!hotelId) return;
 try {
 const res = await axios.get("/api/su/users", { params: { hotel_id: hotelId } });
 const list = Array.isArray(res.data)
 ? res.data
 : Array.isArray(res.data?.users)
 ? res.data.users
 : Array.isArray(res.data?.data)
 ? res.data.data
 : [];

 const filtered = list.filter((u) => {
 const key = (u?.room_number ?? u?.room ?? "")?.toString?.() ?? "";
 return roomNumber && key && String(key) === String(roomNumber);
 });

 if (!cancelled) setResidents(filtered);
 } catch {
 if (!cancelled) setResidents([]);
 }
 };

 loadResidents();
 return () => {
 cancelled = true;
 };
 }, [hotelId, roomNumber]);

 const goBack = () => {
 try {
 if (window.history.length > 1) {
 navigate(-1);
 } else {
 navigate(`/hotels/${hotelId}/rooms`);
 }
 } catch {
 navigate(`/hotels/${hotelId}/rooms`);
 }
 };

 // Edit handlers
 const startEditingOverview = () => {
 // Pre-populate form with current room data
 if (room) {
 setOverviewFormData({
 type: room?.type || "",
 length: room?.length ?? room?.room_length ?? "",
 width: room?.width ?? room?.room_width ?? "",
 bathroom_type: room?.bathroom_type ?? room?.bathroom ?? "",
 has_kitchen: (room?.has_kitchen ?? room?.kitchen ?? room?.hasKitchen) === true ? "yes" : (room?.has_kitchen ?? room?.kitchen ?? room?.hasKitchen) === false ? "no" : "",
 has_bathroom: (room?.has_bathroom ?? room?.bathroom ?? room?.bathroom_available ?? room?.hasBathroom) === true ? "yes" : (room?.has_bathroom ?? room?.bathroom ?? room?.bathroom_available ?? room?.hasBathroom) === false ? "no" : "",
 });
 }
 setIsEditingOverview(true);
 };

 const cancelEditingOverview = () => {
 setIsEditingOverview(false);
 // Reset form to current room data (no API call, just reset form)
 if (room) {
 setOverviewFormData({
 type: room?.type || "",
 length: room?.length ?? room?.room_length ?? "",
 width: room?.width ?? room?.room_width ?? "",
 bathroom_type: room?.bathroom_type ?? room?.bathroom ?? "",
 has_kitchen: (room?.has_kitchen ?? room?.kitchen ?? room?.hasKitchen) === true ? "yes" : (room?.has_kitchen ?? room?.kitchen ?? room?.hasKitchen) === false ? "no" : "",
 has_bathroom: (room?.has_bathroom ?? room?.bathroom ?? room?.bathroom_available ?? room?.hasBathroom) === true ? "yes" : (room?.has_bathroom ?? room?.bathroom ?? room?.bathroom_available ?? room?.hasBathroom) === false ? "no" : "",
 });
 }
 };

 const saveOverviewChanges = async () => {
 setSaving(true);
 try {
 const updateData = {
 type: overviewFormData.type || null,
 length: overviewFormData.length ? Number(overviewFormData.length) : null,
 width: overviewFormData.width ? Number(overviewFormData.width) : null,
 bathroom_type: overviewFormData.bathroom_type || null,
 has_kitchen: overviewFormData.has_kitchen === "yes" ? true : overviewFormData.has_kitchen === "no" ? false : null,
 has_bathroom: overviewFormData.has_bathroom === "yes" ? true : overviewFormData.has_bathroom === "no" ? false : null,
 };

 // Schema compatibility: some DBs use `kitchen`/`bathroom` boolean columns instead.
 updateData.kitchen = updateData.has_kitchen;
 updateData.bathroom = updateData.has_bathroom;

 const response = await axios.put(
 `/api/hotels/${hotelId}/rooms/${roomId}`,
 updateData,
 { withCredentials: true }
 );

 // Update room with response data
 const updatedRoom = response?.data?.room || response?.data;
 setRoom(updatedRoom);

 // Update form data with the saved data
 setOverviewFormData({
 type: updatedRoom?.type || "",
 length: updatedRoom?.length ?? updatedRoom?.room_length ?? "",
 width: updatedRoom?.width ?? updatedRoom?.room_width ?? "",
 bathroom_type: updatedRoom?.bathroom_type ?? updatedRoom?.bathroom ?? "",
 has_kitchen: updatedRoom?.has_kitchen === true ? "yes" : updatedRoom?.has_kitchen === false ? "no" : "",
 has_bathroom: updatedRoom?.has_bathroom === true ? "yes" : updatedRoom?.has_bathroom === false ? "no" : "",
 });

 setIsEditingOverview(false);
 } catch (err) {
 alert("Failed to save changes: " + (err?.response?.data?.message || err?.message));
 } finally {
 setSaving(false);
 }
 };

 const startEditingInventory = () => {
 // Current inventory as array
 const currentItems = Array.isArray(room?.inventory)
 ? room.inventory
 : typeof room?.inventory === 'string'
 ? room.inventory.split(",").map(i => i.trim()).filter(Boolean)
 : [];
 setInventoryFormData(currentItems);
 setIsEditingInventory(true);
 };

 const cancelEditingInventory = () => {
 setIsEditingInventory(false);
 setInventorySearch("");
 };

 const saveInventoryChanges = async () => {
 setSaving(true);
 try {
 // Send as joined string to satisfy backend expectation
 const inventoryStr = Array.isArray(inventoryFormData) ? inventoryFormData.join(", ") : inventoryFormData;
 const response = await axios.put(
 `/api/hotels/${hotelId}/rooms/${roomId}`,
 { inventory: inventoryStr },
 { withCredentials: true }
 );

 const updatedRoom = response?.data?.room || response?.data;
 setRoom(updatedRoom);
 setIsEditingInventory(false);
 } catch (err) {
 alert("Failed to save inventory: " + (err?.response?.data?.message || err?.message));
 } finally {
 setSaving(false);
 }
 };

 const startEditingResidents = () => {
 setResidentsFormData([...residents]);
 setIsEditingResidents(true);
 };

 const cancelEditingResidents = () => {
 setIsEditingResidents(false);
 setResidentSearch("");
 };

 const saveResidentsChanges = async () => {
 setSaving(true);
 try {
 const added = residentsFormData.filter(r => !residents.some(old => old.id === r.id));
 const removed = residents.filter(old => !residentsFormData.some(newR => newR.id === old.id));

 if (added.length === 0 && removed.length === 0) {
 setIsEditingResidents(false);
 setSaving(false);
 return;
 }

 await Promise.all([
 ...added.map(u => axios.put(`/api/su/users/${u.id}`, {
 room_id: roomId,
 room_number: roomNumber,
 room: roomNumber
 }, { withCredentials: true })),
 ...removed.map(u => axios.put(`/api/su/users/${u.id}`, {
 room_id: null,
 room_number: null,
 room: null
 }, { withCredentials: true }))
 ]);

 setResidents(residentsFormData);
 setIsEditingResidents(false);
 } catch (err) {
 alert("Failed to save residents: " + (err?.response?.data?.message || err?.message));
 } finally {
 setSaving(false);
 }
 };

 const roomTypeLabel = room?.type || "";
 const bedspacesFromRoom = useMemo(() => {
 const v = room?.bedspaces ?? room?.bedspace ?? room?.beds ?? null;
 const n = Number(v);
 return Number.isFinite(n) ? n : null;
 }, [room]);

 const totalBedspaces = bedspacesFromRoom !== null ? bedspacesFromRoom : (bedspacesCount === null ? null : bedspacesCount);
 const totalBedspacesLabel = totalBedspaces === null ? "-" : String(totalBedspaces);
 const occupiedLabel = totalBedspaces !== null
 ? `${residents.length} / ${totalBedspaces}`
 : `${residents.length} / -`;

 const lengthVal = room?.length ?? room?.room_length ?? null;
 const widthVal = room?.width ?? room?.room_width ?? null;

 const bathroomTypeVal = room?.bathroom_type ?? room?.bathroom ?? room?.bathroomType ?? null;
 const hasKitchenVal = room?.has_kitchen ?? room?.kitchen ?? room?.hasKitchen ?? null;
 const hasBathroomVal = room?.has_bathroom ?? room?.bathroom ?? room?.bathroom_available ?? room?.hasBathroom ?? null;

 const yesNoUnknown = (v) => {
 const s = String(v).toLowerCase();
 if (v === true || s === "true" || s === "t" || s === "1" || s === "yes") return "Yes";
 if (v === false || s === "false" || s === "f" || s === "0" || s === "no") return "No";
 return "—";
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-gray-50 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
 <div className="p-6">
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center text-gray-500">
 <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-teal-500 mb-4"></div>
 <div className="font-medium">Loading room...</div>
 </div>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="min-h-screen bg-gray-50 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
 <div className="p-6">
 <button
 type="button"
 onClick={goBack}
 className="group mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 px-5 py-2.5 rounded-xl -xl shadow-sm hover:border-teal-500 hover:text-teal-600 "
 >
 <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
 </svg>
 <span>Back</span>
 </button>
 <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 text-red-700">
 {error}
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-gray-50 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
 <div className="p-6">
 <div className="mb-6">
 {/* HEADER SECTION - Unified Card */}
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
 <div className="flex items-start justify-between gap-6">
 <div>
 <div className="flex items-center gap-3 mb-4">
 <button
 type="button"
 onClick={goBack}
 className="group flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl -xl shadow-sm hover:border-teal-500 hover:text-teal-600 "
 >
 <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
 </svg>
 <span>Back</span>
 </button>

 <Breadcrumbs
 items={[
 { label: 'Hotels', path: '/admin/hotels' },
 { label: hotel?.name || 'Property', path: `/hotels/${hotelId}/rooms` },
 { label: `Room ${roomNumber || "-"}` }
 ]}
 />
 </div>

 <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-1">Room {roomNumber || "-"}</h1>
 <div className="text-sm text-gray-500">{hotel?.name || ""}</div>
 </div>

 <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-100 px-3 py-1 rounded-full border border-gray-200 mt-1">
 {String(room?.status || "active")}
 </div>
 </div>
 </div>
 </div>

 <div className="mb-6">
 <div className="flex flex-wrap items-center gap-1 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
 <button
 onClick={() => setActiveTab("overview")}
 className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "overview" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
 }`}
 >
 Overview
 </button>
 <button
 onClick={() => setActiveTab("inventory")}
 className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "inventory" ? "bg-[#66f1dd] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
 }`}
 >
 Inventory & Equipment
 </button>
 <button
 onClick={() => setActiveTab("residents")}
 className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "residents" ? "bg-[#66f1dd] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
 }`}
 >
 Residents ({residents.length})
 </button>
 </div>
 </div>

 {activeTab === "overview" && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-gray-900">Room Details</h2>
 {!isEditingOverview && (
 <button
 onClick={startEditingOverview}
 className="rounded-xl btn-edit"
 >
 Edit
 </button>
 )}
 </div>
 {isEditingOverview ? (
 <div className="space-y-4">
 <div>
 <label className="text-xs text-gray-500 block mb-1">Room Type</label>
 <select
 value={overviewFormData.type || ""}
 onChange={(e) => setOverviewFormData(prev => ({ ...prev, type: e.target.value }))}
 className="form-select w-full h-[2.25rem] py-0 rounded-xl"
 >
 <option value="">Select Room Type</option>
 <option value="Single">Single</option>
 <option value="Double">Double</option>
 <option value="Twin">Twin</option>
 <option value="Family">Family</option>
 <option value="Studio">Studio</option>
 <option value="Deluxe">Deluxe</option>
 <option value="Standard">Standard</option>
 <option value="Suite">Suite</option>
 </select>
 </div>
 <div className="flex gap-2">
 <button
 onClick={saveOverviewChanges}
 disabled={saving}
 className="rounded-xl flex-1 btn-primary justify-center h-[2.25rem]"
 >
 Save
 </button>
 <button
 onClick={cancelEditingOverview}
 disabled={saving}
 className="rounded-xl flex-1 btn-secondary justify-center h-[2.25rem]"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-500">Room Type</span>
 <span className="text-sm font-semibold text-gray-900">{roomTypeLabel || "—"}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-500">Total Bedspaces</span>
 <span className="text-sm font-semibold text-gray-900">{totalBedspacesLabel}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-500">Occupied Bedspaces</span>
 <span className="text-sm font-semibold text-gray-900">{occupiedLabel}</span>
 </div>
 </div>
 )}
 </div>

 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-gray-900">Dimensions</h2>
 </div>
 {isEditingOverview ? (
 <div className="space-y-4">
 <div>
 <label className="text-xs text-gray-500 block mb-1">Length (m)</label>
 <input
 type="number"
 step="0.1"
 value={overviewFormData.length}
 onChange={(e) => setOverviewFormData(prev => ({ ...prev, length: e.target.value }))}
 className="form-input w-full h-[2.25rem] rounded-xl"
 />
 </div>
 <div>
 <label className="text-xs text-gray-500 block mb-1">Width (m)</label>
 <input
 type="number"
 step="0.1"
 value={overviewFormData.width}
 onChange={(e) => setOverviewFormData(prev => ({ ...prev, width: e.target.value }))}
 className="form-input w-full h-[2.25rem] rounded-xl"
 />
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div>
 <div className="text-xs text-gray-500">Length</div>
 <div className="text-sm font-semibold text-gray-900">{lengthVal ? `${lengthVal}m` : "—"}</div>
 </div>
 <div>
 <div className="text-xs text-gray-500">Width</div>
 <div className="text-sm font-semibold text-gray-900">{widthVal ? `${widthVal}m` : "—"}</div>
 </div>
 <div>
 <div className="text-xs text-gray-500">Area</div>
 <div className="text-sm font-semibold text-gray-900">
 {lengthVal && widthVal ? `${(Number(lengthVal) * Number(widthVal)).toFixed(2)} m²` : "—"}
 </div>
 </div>
 </div>
 )}
 </div>

 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-gray-900">Facilities</h2>
 </div>
 {isEditingOverview ? (
 <div className="space-y-4">
 <div>
 <label className="text-xs text-gray-500 block mb-1">Bathroom Type</label>
 <select
 value={overviewFormData.bathroom_type || ""}
 onChange={(e) => setOverviewFormData(prev => ({ ...prev, bathroom_type: e.target.value }))}
 className="form-select w-full h-[2.25rem] py-0 rounded-xl"
 >
 <option value="">Select Bathroom Type</option>
 <option value="Ensuite">Ensuite</option>
 <option value="Shared">Shared</option>
 <option value="Private">Private</option>
 <option value="Bathroom">Bathroom</option>
 <option value="Half Bath">Half Bath</option>
 <option value="Full Bath">Full Bath</option>
 </select>
 </div>
 <div>
 <label className="text-xs text-gray-500 block mb-1">Has Bathroom</label>
 <select
 value={overviewFormData.has_bathroom === true ? "yes" : overviewFormData.has_bathroom === false ? "no" : ""}
 onChange={(e) => {
 if (e.target.value === "yes") setOverviewFormData(prev => ({ ...prev, has_bathroom: true }));
 else if (e.target.value === "no") setOverviewFormData(prev => ({ ...prev, has_bathroom: false }));
 else setOverviewFormData(prev => ({ ...prev, has_bathroom: "" }));
 }}
 className="form-select w-full h-[2.25rem] py-0 rounded-xl"
 >
 <option value="">Unknown</option>
 <option value="yes">Yes</option>
 <option value="no">No</option>
 </select>
 </div>
 <div>
 <label className="text-xs text-gray-500 block mb-1">Kitchen</label>
 <select
 value={overviewFormData.has_kitchen === true ? "yes" : overviewFormData.has_kitchen === false ? "no" : ""}
 onChange={(e) => {
 if (e.target.value === "yes") setOverviewFormData(prev => ({ ...prev, has_kitchen: true }));
 else if (e.target.value === "no") setOverviewFormData(prev => ({ ...prev, has_kitchen: false }));
 else setOverviewFormData(prev => ({ ...prev, has_kitchen: "" }));
 }}
 className="form-select w-full h-[2.25rem] py-0 rounded-xl"
 >
 <option value="">Unknown</option>
 <option value="yes">Yes</option>
 <option value="no">No</option>
 </select>
 </div>
 <div className="flex gap-2">
 <button
 onClick={saveOverviewChanges}
 disabled={saving}
 className="rounded-xl flex-1 btn-primary justify-center h-[2.25rem]"
 >
 Save All
 </button>
 <button
 onClick={cancelEditingOverview}
 disabled={saving}
 className="rounded-xl flex-1 btn-secondary justify-center h-[2.25rem]"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-500">Bathroom</span>
 <span className="text-sm font-semibold text-gray-900">{bathroomTypeVal || "—"}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-500">Has Bathroom</span>
 <span className="text-sm font-semibold text-gray-900">{yesNoUnknown(hasBathroomVal)}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-500">Kitchen</span>
 <span className="text-sm font-semibold text-gray-900">{yesNoUnknown(hasKitchenVal)}</span>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {activeTab === "inventory" && (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-gray-900">Inventory & Equipment</h2>
 {!isEditingInventory && (
 <button
 onClick={startEditingInventory}
 className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors"
 >
 Edit
 </button>
 )}
 </div>
 {isEditingInventory ? (
 <div className="space-y-6">
 <div ref={inventoryDropdownRef} className="relative">
 <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
 Select Inventory Items
 </label>

 <div
 onClick={() => setOpenInventoryDropdown(!openInventoryDropdown)}
 className="w-full flex flex-wrap gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors min-h-[2.25rem]"
 >
 {Array.isArray(inventoryFormData) && inventoryFormData.length > 0 ? (
 inventoryFormData.map((item) => (
 <span
 key={item}
 className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-xl text-xs font-semibold border border-teal-100"
 >
 {item}
 <X
 size={12}
 className="cursor-pointer hover:text-teal-900"
 onClick={(e) => {
 e.stopPropagation();
 setInventoryFormData(inventoryFormData.filter(i => i !== item));
 }}
 />
 </span>
 ))
 ) : (
 <span className="text-sm text-gray-400">Select furniture, appliances...</span>
 )}
 <ChevronDown size={16} className={`ml-auto text-gray-400 transition-transform ${openInventoryDropdown ? 'rotate-180' : ''}`} />
 </div>

 {openInventoryDropdown && (
 <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
 <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
 <Search size={14} className="text-gray-400" />
 <input
 autoFocus
 type="text"
 placeholder="Search or add custom item..."
 value={inventorySearch}
 onChange={(e) => setInventorySearch(e.target.value)}
 className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 rounded-xl"
 />
 </div>
 <div className="max-h-60 overflow-y-auto p-1">
 {[...DEFAULT_INVENTORY_OPTIONS, ...customInventoryOptions]
 .filter(opt =>
 opt.toLowerCase().includes(inventorySearch.toLowerCase()) &&
 !(inventoryFormData || []).includes(opt)
 ).map((opt) => (
 <div
 key={opt}
 className="group w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-xl transition-colors"
 >
 <button
 onClick={() => {
 setInventoryFormData([...(inventoryFormData || []), opt]);
 setInventorySearch("");
 }}
 className="flex-1 text-left rounded-xl"
 >
 {opt}
 </button>
 <div className="flex items-center gap-1">
 {customInventoryOptions.includes(opt) && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 const next = customInventoryOptions.filter(o => o !== opt);
 setCustomInventoryOptions(next);
 localStorage.setItem("customInventoryOptions", JSON.stringify(next));
 }}
 className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
 title="Delete custom option"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 <Plus size={14} className="opacity-40" />
 </div>
 </div>
 ))}
 {inventorySearch &&
 !DEFAULT_INVENTORY_OPTIONS.find(o => o.toLowerCase() === inventorySearch.toLowerCase()) &&
 !customInventoryOptions.find(o => o.toLowerCase() === inventorySearch.toLowerCase()) && (
 <div className="p-2 border-t border-gray-100 bg-teal-50/50">
 <button
 onClick={() => {
 const newItem = inventorySearch.trim();
 if (!newItem) return;
 setInventoryFormData([...(inventoryFormData || []), newItem]);
 const nextCustom = [...customInventoryOptions, newItem];
 setCustomInventoryOptions(nextCustom);
 localStorage.setItem("customInventoryOptions", JSON.stringify(nextCustom));
 setInventorySearch("");
 }}
 className="w-full flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-teal-700 transition-all active:scale-[0.98]"
 >
 <Plus size={16} />
 <span>Add "{inventorySearch}" as permanent option</span>
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 <div className="flex gap-3">
 <button
 onClick={saveInventoryChanges}
 disabled={saving}
 className="rounded-xl flex-1 btn-primary justify-center h-[2.25rem]"
 >
 {saving ? "Saving..." : "Save Changes"}
 </button>
 <button
 onClick={cancelEditingInventory}
 disabled={saving}
 className="rounded-xl flex-1 btn-secondary justify-center h-[2.25rem]"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 (() => {
 const inventoryData = room?.inventory;
 if (!inventoryData || (Array.isArray(inventoryData) && inventoryData.length === 0)) {
 return (
 <div className="text-gray-500">
 No inventory items assigned to this room.
 </div>
 );
 }

 let inventoryItems = [];
 if (Array.isArray(inventoryData)) {
 inventoryItems = inventoryData;
 } else if (typeof inventoryData === 'string') {
 try {
 const parsed = JSON.parse(inventoryData);
 inventoryItems = Array.isArray(parsed) ? parsed : [inventoryData];
 } catch {
 inventoryItems = inventoryData.split(',').map(item => item.trim()).filter(Boolean);
 }
 }

 if (inventoryItems.length === 0) {
 return (
 <div className="text-gray-500">
 No inventory items assigned to this room.
 </div>
 );
 }

 const getInventoryIcon = (item) => {
 const itemName = String(item).toLowerCase().trim();

 // Furniture items
 if (itemName.includes('bed') || itemName.includes('mattress')) {
 return (
 <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
 </svg>
 );
 }
 if (itemName.includes('chair') || itemName.includes('sofa') || itemName.includes('couch')) {
 return (
 <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 );
 }
 if (itemName.includes('table') || itemName.includes('desk')) {
 return (
 <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
 </svg>
 );
 }
 if (itemName.includes('wardrobe') || itemName.includes('closet') || itemName.includes('drawer')) {
 return (
 <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
 </svg>
 );
 }

 // Electronics
 if (itemName.includes('tv') || itemName.includes('television')) {
 return (
 <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 );
 }
 if (itemName.includes('fan') || itemName.includes('ac') || itemName.includes('air')) {
 return (
 <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
 </svg>
 );
 }
 if (itemName.includes('fridge') || itemName.includes('refrigerator') || itemName.includes('microwave')) {
 return (
 <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 );
 }

 // Bathroom items
 if (itemName.includes('toilet') || itemName.includes('bathroom')) {
 return (
 <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 );
 }
 if (itemName.includes('shower') || itemName.includes('bathtub')) {
 return (
 <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
 </svg>
 );
 }

 // Kitchen items
 if (itemName.includes('stove') || itemName.includes('oven') || itemName.includes('cooking')) {
 return (
 <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
 </svg>
 );
 }

 // Lighting
 if (itemName.includes('lamp') || itemName.includes('light') || itemName.includes('bulb')) {
 return (
 <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 );
 }

 // Default icon for other items
 return (
 <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
 </svg>
 );
 };

 return (
 <div className="space-y-2">
 {inventoryItems.map((item, index) => (
 <div
 key={index}
 className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100"
 >
 {getInventoryIcon(item)}
 <span className="text-sm font-medium text-gray-800">
 {String(item).trim()}
 </span>
 </div>
 ))}
 </div>
 );
 })()
 )}
 </div>
 )}

 {activeTab === "residents" && (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-gray-900">Residents ({residents.length})</h2>
 {!isEditingResidents && (
 <button
 onClick={startEditingResidents}
 className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors"
 >
 Edit
 </button>
 )}
 </div>
 {isEditingResidents ? (
 <div className="space-y-6">
 <div ref={residentDropdownRef} className="relative">
 <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
 Manage Occupants
 </label>

 <div
 onClick={() => setOpenResidentDropdown(!openResidentDropdown)}
 className="w-full flex flex-wrap gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors min-h-[2.25rem]"
 >
 {Array.isArray(residentsFormData) && residentsFormData.length > 0 ? (
 residentsFormData.map((u) => {
 const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.name || "Unknown";
 return (
 <span
 key={u.id}
 className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold border border-blue-100"
 >
 {name}
 <X
 size={12}
 className="cursor-pointer hover:text-blue-900"
 onClick={(e) => {
 e.stopPropagation();
 setResidentsFormData(residentsFormData.filter(r => r.id !== u.id));
 }}
 />
 </span>
 );
 })
 ) : (
 <span className="text-sm text-gray-400">Search for active residents...</span>
 )}
 <ChevronDown size={16} className={`ml-auto text-gray-400 transition-transform ${openResidentDropdown ? 'rotate-180' : ''}`} />
 </div>

 {openResidentDropdown && (
 <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
 <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
 <Search size={14} className="text-gray-400" />
 <input
 autoFocus
 type="text"
 placeholder="Type a name to search..."
 value={residentSearch}
 onChange={(e) => setResidentSearch(e.target.value)}
 className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 rounded-xl"
 />
 </div>
 <div className="max-h-60 overflow-y-auto p-1">
 {availableSU.filter(su => {
 const name = [su.first_name, su.last_name].filter(Boolean).join(" ") || su.name || "";
 const matchesSearch = name.toLowerCase().includes(residentSearch.toLowerCase());
 const notSelected = !(residentsFormData || []).some(r => r.id === su.id);
 return matchesSearch && notSelected;
 }).map((su) => {
 const fullName = [su.first_name, su.last_name].filter(Boolean).join(" ") || su.name || "";
 return (
 <button
 key={su.id}
 onClick={() => {
 setResidentsFormData([...(residentsFormData || []), su]);
 setResidentSearch("");
 }}
 className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 rounded-xl transition-colors flex items-center justify-between"
 >
 <div>
 <div className="font-medium">{fullName}</div>
 <div className="text-[10px] text-gray-400">ID: {su.id} • Room: {su.room_number || "Unassigned"}</div>
 </div>
 <Plus size={14} className="opacity-40" />
 </button>
 );
 })}
 {residentSearch && availableSU.filter(su => {
 const name = [su.first_name, su.last_name].filter(Boolean).join(" ") || su.name || "";
 const matchesSearch = name.toLowerCase().includes(residentSearch.toLowerCase());
 const notSelected = !(residentsFormData || []).some(r => r.id === su.id);
 return matchesSearch && notSelected;
 }).length === 0 && (
 <div className="px-3 py-4 text-center text-sm text-gray-400">
 No active service users found matching "{residentSearch}"
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 <div className="flex gap-3">
 <button
 onClick={saveResidentsChanges}
 disabled={saving}
 className="rounded-xl flex-1 btn-primary justify-center h-[2.25rem]"
 >
 {saving ? "Saving..." : "Save Occupants"}
 </button>
 <button
 onClick={cancelEditingResidents}
 disabled={saving}
 className="rounded-xl flex-1 btn-secondary justify-center h-[2.25rem]"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <>
 {residents.length === 0 ? (
 <div className="text-gray-500">No residents assigned to this room.</div>
 ) : (
 <div className="space-y-2">
 {residents.map((u, idx) => {
 const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.name || "Unknown";
 return (
 <div
 key={`${u.id}-${idx}`}
 className="bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-800 border border-gray-100"
 >
 {name}
 </div>
 );
 })}
 </div>
 )}
 </>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
