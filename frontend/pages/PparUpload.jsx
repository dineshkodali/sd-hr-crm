/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { Download, Upload, Check, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || "";
const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    timeout: 15000,
});

// --- Helpers for Formatting ---
function formatDate(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return isoString;
    }
}

function getPriorityColor(p) {
    const low = String(p).toLowerCase();
    if (low === "urgent" || low === "high" || low === "critical")
        return "text-red-500";
    if (low === "medium") return "text-amber-400";
    return "text-emerald-500"; // Low
}

function getStatusColor(s) {
    const low = String(s).toLowerCase();
    if (low === "resolved" || low === "completed") return "text-emerald-500";
    if (low === "pending" || low === "open") return "text-amber-400";
    return "text-slate-500";
}

function getAvatarColor(name) {
    const n = String(name || "").toLowerCase();
    if (n.includes("manager")) return "bg-amber-400";
    if (n.includes("house")) return "bg-blue-500";
    if (n.includes("quick")) return "bg-orange-500";
    return "bg-slate-300";
}

function getInitials(name) {
    if (!name || name === "Unassigned") return "";
    return name
        .match(/(\b\S)?/g)
        .join("")
        .match(/(^\S|\S$)?/g)
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function normalizeHotelsResponse(data) {
    if (!data) return [];
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data.rows)) items = data.rows;
    else if (Array.isArray(data.hotels)) items = data.hotels;
    else if (typeof data === "object") {
        const vals = Object.values(data);
        const possibleObjects = vals.filter(
            (v) => v && (v.id || v.name || v.hotel_name)
        );
        if (possibleObjects.length && !Array.isArray(data)) {
            items = Array.isArray(possibleObjects[0])
                ? possibleObjects[0]
                : possibleObjects;
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

function toCsvCell(value) {
    const s = String(value ?? "");
    const escaped = s.replace(/"/g, '""');
    if (/[\n\r,\"]/g.test(escaped)) return `"${escaped}"`;
    return escaped;
}

function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export default function PPARFileUpload() {
    // Empty initial data — user will provide new data
    const [rows, setRows] = useState([]);
    const [editingId, setEditingId] = useState(null);

    const [hotels, setHotels] = useState([]);
    const [serviceUsers, setServiceUsers] = useState([]);
    const [hotelsLoading, setHotelsLoading] = useState(false);
    const hotelsControllerRef = useRef(null);

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // File upload state
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Dialog states
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    const [alertDialog, setAlertDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const [formData, setFormData] = useState({
        incidentType: "",
        severity: "Medium",
        propertyId: "",
        propertyName: "",
        serviceUserId: "",
        description: "",
        reportedBy: "",
        reportedDate: "",
        assignedTo: "",
        status: "Open",
    });

    useEffect(() => {
        const ctrl = new AbortController();
        hotelsControllerRef.current = ctrl;
        fetchHotels(ctrl.signal);
        fetchIncidents();
        return () => {
            try {
                ctrl.abort();
            } catch { }
            hotelsControllerRef.current = null;
        };
    }, []);

    async function fetchIncidents() {
        try {
            const res = await api.get("/api/incidents", { params: { limit: 200 } });
            const data = res?.data?.data ?? res?.data ?? [];
            if (!Array.isArray(data)) return setRows([]);
            const mapped = data.map((created) => ({
                ref: created.reference ?? created.ref ?? String(created.id ?? ""),
                title: created.type ?? created.title ?? created.reference ?? "",
                desc: created.description ?? created.desc ?? "",
                priority: created.severity ?? created.priority ?? "Medium",
                status: created.status ?? "Open",
                assigned: created.assigned_to ?? created.assigned ?? "",
                date:
                    created.reported_date ??
                    created.created_at ??
                    created.reportedDate ??
                    null,
                propertyName: created.property_name ?? created.propertyName ?? null,
                serviceUserId: created.service_user_id ?? created.serviceUserId ?? null,
                raw: created,
            }));
            setRows(mapped);
        } catch (err) {
            console.error("fetchIncidents error", err);
            setRows([]);
        }
    }

    async function fetchHotels(signal) {
        try {
            setHotelsLoading(true);
            const res = await api.get("/api/hotels", {
                params: { limit: 1000 },
                signal,
            });
            const normalized = normalizeHotelsResponse(res?.data ?? {});
            setHotels(normalized);
            if (normalized.length === 1 && !formData.propertyId) {
                setFormData((f) => ({ ...f, propertyId: normalized[0].id }));
                fetchServiceUsers(normalized[0].id);
            }
        } catch (err) {
            const isCanceled =
                err &&
                (err.name === "CanceledError" ||
                    err.code === "ERR_CANCELED" ||
                    axios.isCancel?.(err));
            if (!isCanceled) {
                console.error("fetchHotels error:", err);
                setHotels([]);
            }
        } finally {
            setHotelsLoading(false);
        }
    }

    async function fetchServiceUsers(hotelId) {
        if (!hotelId) {
            setServiceUsers([]);
            return;
        }

        async function tryPath(path) {
            const r = await api.get(path);
            return r?.data?.data ?? r?.data ?? [];
        }

        try {
            const canonical = `/api/hotels/${hotelId}/service-users`;
            const rows = await tryPath(canonical);
            const normalized = (Array.isArray(rows) ? rows : [])
                .map((r) => ({
                    id: r.id,
                    first_name: r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ""}`,
                }))
                .filter(Boolean);
            setServiceUsers(normalized);
            return;
        } catch (err) {
            const status = err?.response?.status;
            if (status !== 404) {
                console.error("fetchServiceUsers error (canonical):", err);
                setServiceUsers([]);
                return;
            }
        }

        const fallbacks = [
            `/api/su?hotel_id=${encodeURIComponent(hotelId)}`,
            `/api/su?hotelId=${encodeURIComponent(hotelId)}`,
            `/api/su?hotel=${encodeURIComponent(hotelId)}`,
            `/api/su/${encodeURIComponent(hotelId)}`,
            `/api/service_users?hotel_id=${encodeURIComponent(hotelId)}`,
            `/api/service_users/${encodeURIComponent(hotelId)}`,
        ];

        for (const path of fallbacks) {
            try {
                const rows = await tryPath(path);
                const normalized = (Array.isArray(rows) ? rows : [])
                    .map((r) => ({
                        id: r.id,
                        first_name:
                            r.first_name ?? r.firstName ?? r.first ?? `${r.id ?? ""}`,
                    }))
                    .filter(Boolean);
                if (normalized.length) {
                    setServiceUsers(normalized);
                    return;
                }
            } catch (err) {
                // ignore
            }
        }

        setServiceUsers([]);
    }

    /* Edit/Delete handlers */
    const handleEdit = async (row) => {
        // row.raw should contain backend record; if not, try fetching
        let record = row.raw ?? null;
        try {
            if (!record || !record.id) {
                const ref = row.ref;
                // attempt to find by reference via list or fetch
                if (ref) {
                    const found = rows.find((r) => r.ref === ref);
                    record = found?.raw ?? null;
                }
            }
            if (!record || !record.id) {
                // fallback: fetch from server by id/ref if id present
                if (row.raw?.id) {
                    const res = await api.get(`/api/incidents/${row.raw.id}`);
                    record = res?.data?.data ?? res?.data ?? null;
                }
            }
        } catch (err) {
            console.error("handleEdit fetch error", err);
        }
        if (!record) {
            setAlertDialog({
                isOpen: true,
                title: 'Load Failed',
                message: 'Unable to load incident for editing',
                type: 'error'
            });
            return;
        }
        // Map record to formData
        setFormData({
            incidentType: record.type ?? record.incidentType ?? "",
            severity: record.severity ?? "Medium",
            propertyId: record.property_id ?? record.propertyId ?? "",
            serviceUserId: record.service_user_id ?? record.serviceUserId ?? "",
            description: record.description ?? "",
            reportedBy: record.reported_by ?? record.reportedBy ?? "",
            reportedDate: record.reported_date
                ? String(record.reported_date).substring(0, 10)
                : "",
            assignedTo: record.assigned_to ?? record.assignedTo ?? "",
            status: record.status ?? "Open",
        });
        if (record.property_id || record.propertyId)
            fetchServiceUsers(record.property_id ?? record.propertyId);
        // ensure we store numeric id for editing (backend expects id param)
        setEditingId(record.id ?? null);
        setShowModal(true);
    };

    const handleDelete = async (row) => {
        const id = row.raw?.id ?? null;
        if (!id) {
            // try to locate by reference
            setAlertDialog({
                isOpen: true,
                title: 'Delete Failed',
                message: 'Unable to determine incident id to delete',
                type: 'error'
            });
            return;
        }
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Incident',
            message: 'Delete this incident? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/incidents/${id}`);
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    setRows((prev) => prev.filter((r) => String(r.raw?.id) !== String(id)));
                } catch (err) {
                    console.error("delete incident error", err);
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    setAlertDialog({
                        isOpen: true,
                        title: 'Delete Failed',
                        message: 'Unable to delete incident. See console for details.',
                        type: 'error'
                    });
                }
            }
        });
    };

    function handleInputChange(e) {
        const { name, type, value, checked } = e.target;
        if (type === "checkbox") {
            setFormData((p) => ({ ...p, [name]: checked }));
            return;
        }
        setFormData((p) => ({ ...p, [name]: value }));
    }

    function handlePropertyChange(e) {
        const hotelId = e.target.value;
        const hotel = hotels.find((h) => String(h.id) === String(hotelId)) || null;
        setFormData((p) => ({
            ...p,
            propertyId: hotelId,
            propertyName: hotel ? hotel.name : "",
            serviceUserId: "",
        }));
        setServiceUsers([]);
        if (hotelId) fetchServiceUsers(hotelId);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                type: formData.incidentType,
                severity: formData.severity,
                property_id: formData.propertyId,
                property_name: formData.propertyName || null,
                service_user_id: formData.serviceUserId || null,
                description: formData.description,
                reported_by: formData.reportedBy,
                reported_date: formData.reportedDate,
                assigned_to: formData.assignedTo,
                status: formData.status,
            };
            let res;
            if (editingId) {
                // update existing incident
                res = await api.put(`/api/incidents/${editingId}`, payload);
            } else {
                res = await api.post("/api/incidents", payload);
            }
            // refresh list from server to ensure DB is authoritative
            await fetchIncidents();
            setShowModal(false);
            setEditingId(null);
        } catch (err) {
            console.error("create incident error", err);
            // Fallback for demo if API fails
            const fallbackRow = {
                ref: `INC-2025-${Math.floor(Math.random() * 10000)}`,
                title: formData.incidentType || "Incident",
                desc: formData.description,
                priority: formData.severity,
                status: formData.status,
                assigned: formData.assignedTo || "Unassigned",
                date: formData.reportedDate || new Date().toISOString(),
            };
            setRows((prev) => [fallbackRow, ...prev]);
            setShowModal(false);
        } finally {
            setSubmitting(false);
        }
    }

    const openReportModal = () => setShowModal(true);

    // Generate and download sample PPAR file
    const downloadSample = () => {
        const sampleData = [
            {
                Floor: "1",
                "Room Number": "101",
                "Room Type": "Single",
                Bedspaces: "1",
                Kitchen: "No",
                Bathroom: "En-suite",
                "Size (m²)": "18.5",
                "Fully Equipped": "Yes",
                Equipment: "Bed, Wardrobe, Desk, Chair",
            },
            {
                Floor: "1",
                "Room Number": "102",
                "Room Type": "Double",
                Bedspaces: "2",
                Kitchen: "Yes",
                Bathroom: "Shared",
                "Size (m²)": "25.0",
                "Fully Equipped": "No",
                Equipment: "Bed, Wardrobe",
            },
            {
                Floor: "1",
                "Room Number": "103",
                "Room Type": "Shared",
                Bedspaces: "3",
                Kitchen: "No",
                Bathroom: "Shared",
                "Size (m²)": "22.0",
                "Fully Equipped": "Yes",
                Equipment: "3 Beds, 3 Wardrobes",
            },
            {
                Floor: "2",
                "Room Number": "201",
                "Room Type": "Single",
                Bedspaces: "1",
                Kitchen: "No",
                Bathroom: "En-suite",
                "Size (m²)": "18.5",
                "Fully Equipped": "Yes",
                Equipment: "Bed, Wardrobe, Desk",
            },
            {
                Floor: "2",
                "Room Number": "202",
                "Room Type": "Family",
                Bedspaces: "4",
                Kitchen: "Yes",
                Bathroom: "En-suite",
                "Size (m²)": "35.0",
                "Fully Equipped": "Yes",
                Equipment: "2 Double Beds, Wardrobe, TV",
            },
        ];

        const headers = Object.keys(sampleData[0] || {});
        const lines = [headers.map(toCsvCell).join(",")];
        for (const row of sampleData) {
            lines.push(headers.map((h) => toCsvCell(row[h])).join(","));
        }
        downloadTextFile("PPAR_Sample.csv", lines.join("\n"), "text/csv;charset=utf-8");
    };

    // Parse and process uploaded file
    const handleFileUpload = async (file) => {
        if (!file) return;

        try {
            setUploading(true);
            setUploadProgress(0);

            if (!file.name.endsWith('.csv')) {
                setAlertDialog({
                    isOpen: true,
                    title: 'Unsupported File',
                    message: 'Please upload a .csv file.',
                    type: 'warning'
                });
                return;
            }

            let data = [];

            // Determine file type and parse accordingly
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = lines[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((h, idx) => {
                        row[h] = values[idx];
                    });
                    data.push(row);
                }
            } else {
                setAlertDialog({
                    isOpen: true,
                    title: 'Unsupported File',
                    message: 'Please upload a .csv file.',
                    type: 'warning'
                });
                return;
            }

            if (data.length === 0) {
                setAlertDialog({
                    isOpen: true,
                    title: 'No Data',
                    message: 'File appears to be empty or could not be parsed.',
                    type: 'warning'
                });
                return;
            }

            setUploadProgress(30);

            // Validate required columns
            const requiredColumns = ['Floor', 'Room Number', 'Room Type', 'Bedspaces'];
            const headers = Object.keys(data[0]);
            const missingColumns = requiredColumns.filter(col => !headers.some(h => h.toLowerCase() === col.toLowerCase()));

            if (missingColumns.length > 0) {
                setAlertDialog({
                    isOpen: true,
                    title: 'Invalid Format',
                    message: `Missing required columns: ${missingColumns.join(', ')}`,
                    type: 'error'
                });
                return;
            }

            setUploadProgress(50);

            // Ask for property confirmation
            if (!formData.propertyId) {
                setAlertDialog({
                    isOpen: true,
                    title: 'Select Property',
                    message: 'Please select a property from the dropdown first.',
                    type: 'warning'
                });
                return;
            }

            // Prepare payload and send to API
            const roomsData = data.map(row => ({
                floor: String(row.Floor || row.floor || ''),
                room_number: String(row['Room Number'] || row['Room #'] || row.room_number || ''),
                room_type: String(row['Room Type'] || row.room_type || ''),
                bedspaces: parseInt(row.Bedspaces || row.bedspaces || 1),
                kitchen: String(row.Kitchen || row.kitchen || 'No').toLowerCase() === 'yes',
                bathroom: String(row.Bathroom || row.bathroom || ''),
                size: parseFloat(row['Size (m²)'] || row.size || 0),
                fully_equipped: String(row['Fully Equipped'] || row.fully_equipped || 'No').toLowerCase() === 'yes',
                equipment: String(row.Equipment || row.equipment || ''),
            }));

            setUploadProgress(70);

            // Send to API
            const response = await api.post(`/api/hotels/${formData.propertyId}/rooms/import`, {
                rooms: roomsData,
                property_id: formData.propertyId,
            });

            setUploadProgress(90);

            // Success response
            setTimeout(() => {
                setUploadProgress(100);
                setAlertDialog({
                    isOpen: true,
                    title: 'Success',
                    message: `Successfully imported ${roomsData.length} rooms to property "${formData.propertyName}"!`,
                    type: 'success'
                });
                setSelectedFile(null);
                setUploadProgress(0);
            }, 500);

        } catch (err) {
            console.error('File upload error:', err);
            setAlertDialog({
                isOpen: true,
                title: 'Upload Failed',
                message: err.response?.data?.message || err.message || 'Failed to import rooms. See console for details.',
                type: 'error'
            });
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-800">
            <div className="p-3 sm:p-4 md:p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">PPAR File Management</h1>
                    <p className="text-sm text-gray-500 mt-2">Upload and manage property room data, create and track incidents</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
                    {/* Title */}
                    <h2 className="text-lg font-bold text-slate-800">Upload PPAR File</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Select a property and upload an Excel or CSV file containing room
                        and bedspace data
                    </p>

                    {/* Property */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Property
                        </label>
                        <select
                            value={formData.propertyId}
                            onChange={handlePropertyChange}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-teal-200 focus:ring-2 focus:ring-teal-300"
                        >
                            <option value="">Select a property...</option>
                            {hotels.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* File Upload */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            PPAR File
                        </label>

                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <input
                                type="file"
                                id="ppar-file"
                                accept=".csv"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    setSelectedFile(file || null);
                                }}
                                className="hidden rounded-xl"
                                disabled={uploading}
                            />
                            <label htmlFor="ppar-file" className="cursor-pointer block">
                                <div className="flex flex-col items-center gap-3">
                                    <Upload className="w-8 h-8 text-slate-400" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            Click to select file or drag and drop
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Supported: .csv
                                        </p>
                                    </div>
                                </div>
                            </label>
                        </div>

                        {selectedFile && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                                <span className="text-sm text-blue-700 font-medium">
                                    Selected: {selectedFile.name}
                                </span>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium rounded-xl"
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2">
                            Required columns: Floor, Room Number, Room Type, Bedspaces
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={downloadSample}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download Sample
                        </button>

                        <button
                            onClick={() => {
                                if (!selectedFile) {
                                    setAlertDialog({
                                        isOpen: true,
                                        title: 'No File Selected',
                                        message: 'Please select a file to upload.',
                                        type: 'warning'
                                    });
                                    return;
                                }
                                if (!formData.propertyId) {
                                    setAlertDialog({
                                        isOpen: true,
                                        title: 'Select Property',
                                        message: 'Please select a property first.',
                                        type: 'warning'
                                    });
                                    return;
                                }
                                handleFileUpload(selectedFile);
                            }}
                            disabled={uploading || !selectedFile || !formData.propertyId}
                            className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            {uploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Upload and Import
                                </>
                            )}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {uploading && uploadProgress > 0 && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-slate-600">Uploading...</span>
                                <span className="text-xs font-medium text-slate-600">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-teal-500 h-full rounded-full "
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
                    {/* Title */}
                    <h3 className="text-lg font-semibold text-slate-800">
                        File Format Requirements
                    </h3>

                    {/* Subtitle */}
                    <p className="text-sm text-slate-500 mt-2">
                        Your PPAR file should include the following columns
                        (case-insensitive):
                    </p>

                    {/* Requirements List */}
                    <ul className="mt-4 space-y-3 text-sm text-slate-600">
                        <li>
                            <span className="font-semibold text-slate-700">
                                Floor or Floor Number:
                            </span>{" "}
                            Numeric floor number
                        </li>

                        <li>
                            <span className="font-semibold text-slate-700">
                                Room or Room Number:
                            </span>{" "}
                            Room identifier (e.g., “101”, “A1”)
                        </li>

                        <li>
                            <span className="font-semibold text-slate-700">
                                Room Type or Type:
                            </span>{" "}
                            single, shared, dormitory, or family
                        </li>

                        <li>
                            <span className="font-semibold text-slate-700">
                                Beds or Bedspaces:
                            </span>{" "}
                            Total number of beds in the room
                        </li>

                        <li>
                            <span className="font-semibold text-slate-700">
                                Kitchen (optional):
                            </span>{" "}
                            Yes/No or True/False
                        </li>

                        <li>
                            <span className="font-semibold text-slate-700">
                                Bathroom (optional):
                            </span>{" "}
                            Yes/No or True/False
                        </li>

                        <li>
                            <span className="font-semibold text-slate-700">
                                Size (optional):
                            </span>{" "}
                            Room size in square meters
                        </li>
                    </ul>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
                confirmText={confirmDialog.confirmText || 'Confirm'}
            />

            {/* Alert Dialog */}
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
                title={alertDialog.title}
                message={alertDialog.message}
                type={alertDialog.type}
            />
        </div>
    );
}