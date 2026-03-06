import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Home, Building, BedDouble, Users, MapPin, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";

export default function PropertyDetails({ property }) {
    const {
        name,
        address,
        tags = [],
        totalFloors = 0,
        totalRooms = 0,
        totalBedspaces = 0,
        occupiedBeds = 0,
    } = property || {};

    const [liveHotel, setLiveHotel] = useState(null);

    const hotelId = useMemo(() => {
        const raw = property?._raw;
        return raw?.id ?? raw?.hotel_id ?? raw?.property_id ?? null;
    }, [property]);

    useEffect(() => {
        let mounted = true;
        if (!hotelId) {
            setLiveHotel(null);
            return;
        }
        axios
            .get(`/api/hotels/${hotelId}`)
            .then((res) => {
                if (!mounted) return;
                setLiveHotel(res?.data?.hotel ?? res?.data ?? null);
            })
            .catch(() => {
                if (!mounted) return;
                setLiveHotel(null);
            });
        return () => {
            mounted = false;
        };
    }, [hotelId]);

    const liveTotalBedspaces = useMemo(() => {
        const v =
            liveHotel?.total_beds ??
            liveHotel?.total_bed ??
            liveHotel?.beds ??
            null;
        return Number(v ?? totalBedspaces) || 0;
    }, [liveHotel, totalBedspaces]);

    const liveOccupiedBeds = useMemo(() => {
        const v =
            liveHotel?.occupied_beds ??
            liveHotel?.occupied ??
            liveHotel?.occupied_bed ??
            null;
        return Number(v ?? occupiedBeds) || 0;
    }, [liveHotel, occupiedBeds]);

    const hotelName = useMemo(() => {
        return name || property?._raw?.name || "";
    }, [name, property]);

    const [activeTab, setActiveTab] = useState("overview");
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [realTotalRooms, setRealTotalRooms] = useState(totalRooms);
    const [statsBeds, setStatsBeds] = useState({ total: totalBedspaces, occupied: occupiedBeds });

    useEffect(() => {
        let cancelled = false;
        if (!hotelId) return;

        const loadData = async () => {
            try {
                const [roomsRes, hotelRes] = await Promise.all([
                    axios.get(`/api/hotels/${hotelId}/rooms`, { withCredentials: true }),
                    axios.get(`/api/hotels/${hotelId}`, { withCredentials: true })
                ]);

                if (cancelled) return;

                const rooms = Array.isArray(roomsRes.data?.rooms)
                    ? roomsRes.data.rooms
                    : Array.isArray(roomsRes.data)
                        ? roomsRes.data
                        : [];

                const hotelData = hotelRes?.data?.hotel ?? hotelRes?.data ?? null;
                setLiveHotel(hotelData);
                setRealTotalRooms(rooms.length);

                const occupied = rooms.reduce((sum, r) => {
                    const n = Number(r?.bedspaces ?? r?.bedspace ?? r?.beds ?? 0);
                    return sum + (Number.isFinite(n) ? n : 0);
                }, 0);

                const total = Number(hotelData?.total_beds ?? hotelData?.total_bed ?? hotelData?.beds ?? totalBedspaces) || 0;
                setStatsBeds({ total, occupied });

            } catch (err) {
                console.error("Failed to fetch property details", err);
            }
        };

        loadData();
        return () => { cancelled = true; };
    }, [hotelId, totalBedspaces]);
    // const [creating, setCreating] = useState(false);

    // Form State
    const [form, setForm] = useState({
        name: "",
        property_type: "Hotel Style",
        status: "Active",
        address: "",
        city: "",
        postcode: "",
        total_beds: 0,
        occupied_beds: 0,
        manager_name: "",
        manager_phone: "",
        manager_email: "",
        about: "",
    });

    // const [showAdd, setShowAdd] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const occupancyRate =
        (Number(statsBeds.total) || 0) === 0
            ? 0
            : Math.round(((Number(statsBeds.occupied) || 0) / (Number(statsBeds.total) || 0)) * 100);


    // --- CREATE PROPERTY ---
    const handleCreate = async (e) => {
        e?.preventDefault();
        setErrorMsg("");
        // setCreating(true);
        try {
            const payload = {
                name: (form.name || "").trim(),
                property_type: form.property_type || null,
                status: form.status || null,
                address: form.address || null,
                city: form.city || null,
                postcode: form.postcode || null,
                total_beds: Number(form.total_beds) || 0,
                occupied_beds: Number(form.occupied_beds) || 0,
                manager_name: form.manager_name || null,
                manager_phone: form.manager_phone || null,
                manager_email: form.manager_email || null,
                description: form.about || null,
            };

            // if (user?.role === "manager") {
            // payload.manager = user.id;
            // }

            await axios.post("/api/hotels", payload, { withCredentials: true });

            setForm({
                name: "",
                property_type: "Hotel Style",
                status: "Active",
                address: "",
                city: "",
                postcode: "",
                total_beds: 0,
                occupied_beds: 0,
                manager_name: "",
                manager_phone: "",
                manager_email: "",
                about: "",
            });

            setShowCreateRoom(false);
            // await fetchHotels();
        } catch (err) {
            console.error("create hotel error:", err);
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                "Server error";
            setErrorMsg(msg);
            alert(msg);
        } finally {
            // setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">

                {/* HEADER SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
                    <div className="flex items-start justify-between gap-6">
                        {/* LEFT SIDE */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    type="button"
                                    onClick={() => window.history.back()}
                                    className="group flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm hover:border-teal-500 hover:text-teal-600 "
                                >
                                    <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    <span>Back</span>
                                </button>

                                <Breadcrumbs
                                    items={[
                                        { label: 'Hotels', path: '/admin/hotels' },
                                        { label: name }
                                    ]}
                                />
                            </div>

                            {/* Title */}
                            <h1 className="text-3xl font-bold text-gray-900 mb-3">{name}</h1>

                            {/* Address */}
                            <p className="text-sm text-gray-600 flex items-center gap-2 mb-3">
                                <MapPin className="w-4 h-4" />
                                {address}
                            </p>

                            {/* Tags */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {tags.map((t, index) => {
                                    const label = String(t).toLowerCase();

                                    let tagClass =
                                        "px-3 py-1 rounded-full text-xs font-medium capitalize";

                                    if (label === "hotel" || label === "hotel style") {
                                        tagClass += " bg-[#e8fbf8] text-[#0b6b60] border border-[#baf1e9]";
                                    } else if (label === "active") {
                                        tagClass += " bg-green-50 text-green-700 border border-green-200";
                                    } else {
                                        tagClass += " bg-gray-100 text-gray-700 border border-gray-200";
                                    }

                                    return (
                                        <span key={index} className={tagClass}>
                                            {t}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT SIDE – Create Room */}
                        <div className="pt-6">
                            <button
                                onClick={() => window.location.assign(`/hotels/${hotelId}/rooms`)}
                                className="btn-primary rounded-xl"
                            >
                                <Plus className="w-4 h-4" />
                                Create Room
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard icon={<Building className="w-5 h-5" />} title="Total Floors" value={totalFloors} />
                    <StatCard icon={<Home className="w-5 h-5" />} title="Total Rooms" value={realTotalRooms} />
                    <StatCard
                        icon={<BedDouble className="w-5 h-5" />}
                        title="Total Bedspaces"
                        value={statsBeds.total}
                        subtitle={`${statsBeds.occupied} occupied`}
                    />
                    <StatCard
                        icon={<Users className="w-5 h-5" />}
                        title="Occupancy Rate"
                        value={`${occupancyRate}%`}
                        subtitle={`${statsBeds.occupied} / ${statsBeds.total} beds`}
                    />
                </div>

                {/* Tabs */}
                <div className="mb-6">
                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                        <div className="flex items-center gap-1 whitespace-nowrap min-w-max">
                            <button onClick={() => setActiveTab("overview")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "overview" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Overview</button>
                            <button onClick={() => setActiveTab("floors")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "floors" ? "bg-[#66f1dd] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Floors & Rooms</button>
                            <button onClick={() => setActiveTab("residents")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "residents" ? "bg-[#66f1dd] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Residents</button>
                            <button onClick={() => setActiveTab("maintenance")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "maintenance" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Maintenance</button>
                            <button onClick={() => setActiveTab("inspections")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "inspections" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Inspections</button>
                            <button onClick={() => setActiveTab("incidents")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "incidents" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Incidents</button>
                            <button onClick={() => setActiveTab("compliance")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "compliance" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Compliance</button>
                            <button onClick={() => setActiveTab("complaints")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "complaints" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Complaints</button>
                            <button onClick={() => setActiveTab("aire_tasks")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "aire_tasks" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>AIRE Tasks</button>
                            <button onClick={() => setActiveTab("litigation")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "litigation" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Litigation</button>
                            <button onClick={() => setActiveTab("hse_incidents")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "hse_incidents" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>HSE Incidents</button>
                            <button onClick={() => setActiveTab("hse_risk_management")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "hse_risk_management" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>HSE Risk Management</button>
                            <button onClick={() => setActiveTab("hse_audits")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "hse_audits" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>HSE Audits</button>
                            <button onClick={() => setActiveTab("hse_training")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "hse_training" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>HSE Training</button>
                            <button onClick={() => setActiveTab("safeguarding_referrals")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "safeguarding_referrals" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Safeguarding Referrals</button>
                            <button onClick={() => setActiveTab("risk_assessments")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "risk_assessments" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Risk Assessments</button>
                            <button onClick={() => setActiveTab("vulnerable_users")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "vulnerable_users" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Vulnerable Users</button>
                            <button onClick={() => setActiveTab("multi_agency")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "multi_agency" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Multi Agency</button>
                            <button onClick={() => setActiveTab("vcs_organisations")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "vcs_organisations" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>VCS Organisations</button>
                            <button onClick={() => setActiveTab("case_management")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "case_management" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Case Management</button>
                            <button onClick={() => setActiveTab("emergency_protocols")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "emergency_protocols" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>Emergency Protocols</button>
                            <button onClick={() => setActiveTab("history")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "history" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>History</button>
                        </div>
                    </div>
                </div>

                {/* TAB CONTENT */}
                <div>
                    {activeTab === "overview" && (
                        <FloorsRoomsCard hotelId={hotelId} viewMode="grid" />
                    )}
                    {activeTab === "floors" && (
                        <FloorsRoomsCard hotelId={hotelId} viewMode="list" />
                    )}
                    {activeTab === "residents" && <ResidentsCard hotelId={hotelId} />}
                    {activeTab === "maintenance" && (
                        <MaintenanceCard hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "inspections" && (
                        <InspectionsCard hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "incidents" && (
                        <IncidentsCard hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "compliance" && (
                        <ComplianceCard hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "complaints" && (
                        <ModuleRecordsCard title="Complaints" path="/api/complaints" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "aire_tasks" && (
                        <ModuleRecordsCard title="AIRE Tasks" path="/api/aire-tasks" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "litigation" && (
                        <ModuleRecordsCard title="Litigation" path="/api/litigation" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "hse_incidents" && (
                        <ModuleRecordsCard title="HSE Incidents" path="/api/hse/hse-incidents" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "hse_risk_management" && (
                        <ModuleRecordsCard title="HSE Risk Management" path="/api/hse/risk-management" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "hse_audits" && (
                        <ModuleRecordsCard title="HSE Audits" path="/api/hse/audits" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "hse_training" && (
                        <ModuleRecordsCard title="HSE Training" path="/api/hse/training" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "safeguarding_referrals" && (
                        <ModuleRecordsCard title="Safeguarding Referrals" path="/api/safeguarding/referrals" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "risk_assessments" && (
                        <ModuleRecordsCard title="Risk Assessments" path="/api/safeguarding/risk-assessments" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "vulnerable_users" && (
                        <ModuleRecordsCard title="Vulnerable Users" path="/api/safeguarding/vulnerable-users" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "multi_agency" && (
                        <ModuleRecordsCard title="Multi Agency" path="/api/safeguarding/multi-agency" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "vcs_organisations" && (
                        <ModuleRecordsCard title="VCS Organisations" path="/api/vcs-organisations" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "case_management" && (
                        <ModuleRecordsCard title="Case Management" path="/api/case-management" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "emergency_protocols" && (
                        <ModuleRecordsCard title="Emergency Protocols" path="/api/emergency-protocols" hotelId={hotelId} hotelName={hotelName} />
                    )}
                    {activeTab === "history" && (
                        <HistoryCard hotelId={hotelId} hotelName={hotelName} />
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, subtitle }) {
    return (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
                    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                </div>
                <div className="text-blue-600 bg-blue-50 p-2 rounded-xl">{icon}</div>
            </div>
        </div>
    );
}

function ModuleRecordsCard({ title, path, hotelId, hotelName }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [rows, setRows] = useState([]);

    const matchesProperty = (row) => {
        const pid = row?.property_id ?? row?.propertyId ?? row?.hotel_id ?? row?.hotelId ?? row?.property ?? null;
        const pname = row?.property_name ?? row?.propertyName ?? row?.hotel_name ?? row?.hotelName ?? null;
        if (hotelId && pid != null && String(pid) === String(hotelId)) return true;
        if (hotelName && pname && String(pname).toLowerCase() === String(hotelName).toLowerCase()) return true;
        return false;
    };

    const normalizeDate = (row) => {
        const candidates = [
            row?.incident_date,
            row?.incidentDate,
            row?.reported_date,
            row?.reportedDate,
            row?.inspection_date,
            row?.inspectionDate,
            row?.scheduled_date,
            row?.scheduledDate,
            row?.issue_date,
            row?.expiry_date,
            row?.date,
            row?.created_at,
            row?.createdAt,
            row?.updated_at,
            row?.updatedAt,
        ];
        for (const c of candidates) {
            if (!c) continue;
            const d = new Date(c);
            if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        return "-";
    };

    const getReference = (row) => row?.reference ?? row?.ref ?? row?.case_reference ?? row?.id ?? "-";
    const getStatus = (row) => row?.status ?? row?.state ?? row?.outcome ?? "-";
    const getType = (row) => row?.type ?? row?.category ?? row?.incident_type ?? row?.inspection_type ?? row?.certificate_type ?? row?.title ?? "-";

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!hotelId && !hotelName) {
                setRows([]);
                return;
            }
            setLoading(true);
            setError("");
            try {
                const res = await axios.get(path, {
                    withCredentials: true,
                    params: {
                        limit: 2000,
                        property: hotelId,
                        property_id: hotelId,
                        propertyId: hotelId,
                        hotel_id: hotelId,
                        hotelId: hotelId,
                        property_name: hotelName,
                        propertyName: hotelName,
                        hotel_name: hotelName,
                        hotelName: hotelName,
                    },
                });
                const data = res?.data?.data ?? res?.data?.rows ?? res?.data?.records ?? res?.data?.items ?? res?.data ?? [];
                const list = Array.isArray(data) ? data : [];
                const filtered = list.filter(matchesProperty);
                if (!cancelled) setRows(filtered);
            } catch (e) {
                if (cancelled) return;
                const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || `Failed to load ${title}`;
                setError(msg);
                setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [path, hotelId, hotelName]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">{title}</h2>
            <p className="text-sm text-gray-500 mb-6">Records logged for this property</p>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view {String(title || '').toLowerCase()}</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>No records found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type / Title</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((r, idx) => (
                                <tr key={r?.id ?? `${title}-${idx}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{getReference(r)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{getType(r)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{getStatus(r)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{normalizeDate(r)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function RecordsCard({ hotelId, hotelName }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [dataByType, setDataByType] = useState({});

    const matchesProperty = (row) => {
        const pid = row?.property_id ?? row?.propertyId ?? row?.hotel_id ?? row?.hotelId ?? row?.property ?? null;
        const pname = row?.property_name ?? row?.propertyName ?? row?.hotel_name ?? row?.hotelName ?? null;
        if (hotelId && pid != null && String(pid) === String(hotelId)) return true;
        if (hotelName && pname && String(pname).toLowerCase() === String(hotelName).toLowerCase()) return true;
        return false;
    };

    const fetchList = async (path, params) => {
        const res = await axios.get(path, { withCredentials: true, params: params || {} });
        const rows = res?.data?.data ?? res?.data?.rows ?? res?.data?.records ?? res?.data?.items ?? res?.data ?? [];
        return Array.isArray(rows) ? rows : [];
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!hotelId) {
                setDataByType({});
                return;
            }
            setLoading(true);
            setError("");
            try {
                const sources = [
                    { type: 'Inspections', path: '/api/inspections', limit: 500 },
                    { type: 'Incidents', path: '/api/incidents', limit: 500 },
                    { type: 'Complaints', path: '/api/complaints', limit: 2000 },
                    { type: 'Compliance', path: '/api/compliance', limit: 500 },
                    { type: 'Maintenance', path: '/api/maintenance', limit: 500 },
                    { type: 'AIRE Tasks', path: '/api/aire-tasks', limit: 500 },
                    { type: 'Litigation', path: '/api/litigation', limit: 500 },
                    { type: 'HSE Audits', path: '/api/hse/audits', limit: 500 },
                    { type: 'HSE Incidents', path: '/api/hse/hse-incidents', limit: 500 },
                    { type: 'HSE Risk Management', path: '/api/hse/risk-management', limit: 500 },
                    { type: 'HSE Training', path: '/api/hse/training', limit: 500 },
                    { type: 'Safeguarding Referrals', path: '/api/safeguarding/referrals', limit: 500 },
                    { type: 'Risk Assessments', path: '/api/safeguarding/risk-assessments', limit: 500 },
                    { type: 'Vulnerable Users', path: '/api/safeguarding/vulnerable-users', limit: 500 },
                    { type: 'Multi Agency', path: '/api/safeguarding/multi-agency', limit: 500 },
                    { type: 'VCS Organisations', path: '/api/vcs-organisations', limit: 2000 },
                    { type: 'Case Management', path: '/api/case-management', limit: 2000 },
                    { type: 'Emergency Protocols', path: '/api/emergency-protocols', limit: 500 },
                ];

                const results = await Promise.allSettled(
                    sources.map(async (s) => {
                        const rows = await fetchList(s.path, {
                            limit: s.limit,
                            property_id: hotelId,
                            propertyId: hotelId,
                            hotel_id: hotelId,
                            hotelId: hotelId,
                            property: hotelId,
                        });
                        return { type: s.type, rows };
                    })
                );

                const next = {};
                for (const r of results) {
                    if (r.status !== 'fulfilled') continue;
                    next[r.value.type] = (r.value.rows || []).filter(matchesProperty);
                }
                if (!cancelled) setDataByType(next);
            } catch (e) {
                if (cancelled) return;
                setError(e?.message || 'Failed to load records');
                setDataByType({});
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId, hotelName]);

    const types = useMemo(() => Object.keys(dataByType || {}).sort((a, b) => a.localeCompare(b)), [dataByType]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Records</h2>
                <p className="text-sm text-gray-500">All module records under this property</p>
            </div>
            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">Select a property to view records</div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {types.map((t) => (
                        <div key={t} className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold text-gray-900">{t}</div>
                                <div className="text-sm font-semibold text-gray-600">{Array.isArray(dataByType[t]) ? dataByType[t].length : 0}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function HistoryCard({ hotelId, hotelName }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState("date_desc");
    const [selectedTypes, setSelectedTypes] = useState(() => new Set());

    const normalizeDate = (row) => {
        const candidates = [
            row?.incident_date,
            row?.incidentDate,
            row?.reported_date,
            row?.reportedDate,
            row?.inspection_date,
            row?.inspectionDate,
            row?.scheduled_date,
            row?.scheduledDate,
            row?.date,
            row?.created_at,
            row?.createdAt,
            row?.updated_at,
            row?.updatedAt,
        ];
        for (const c of candidates) {
            if (!c) continue;
            const d = new Date(c);
            if (!Number.isNaN(d.getTime())) return d.toISOString();
        }
        return null;
    };

    const matchesProperty = (row) => {
        const pid = row?.property_id ?? row?.propertyId ?? row?.hotel_id ?? row?.hotelId ?? row?.property ?? null;
        const pname = row?.property_name ?? row?.propertyName ?? row?.hotel_name ?? row?.hotelName ?? null;
        if (hotelId && pid != null && String(pid) === String(hotelId)) return true;
        if (hotelName && pname && String(pname).toLowerCase() === String(hotelName).toLowerCase()) return true;
        return false;
    };

    const fetchList = async (path, params) => {
        const res = await axios.get(path, { withCredentials: true, params: params || {} });
        const rows = res?.data?.data ?? res?.data?.rows ?? res?.data?.records ?? res?.data?.items ?? res?.data ?? [];
        return Array.isArray(rows) ? rows : [];
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!hotelId) {
                setItems([]);
                return;
            }
            setLoading(true);
            setError("");
            try {
                const sources = [
                    { type: 'Inspections', path: '/api/inspections', limit: 500 },
                    { type: 'Incidents', path: '/api/incidents', limit: 500 },
                    { type: 'Complaints', path: '/api/complaints', limit: 2000 },
                    { type: 'Compliance', path: '/api/compliance', limit: 500 },
                    { type: 'Maintenance', path: '/api/maintenance', limit: 500 },
                    { type: 'AIRE Tasks', path: '/api/aire-tasks', limit: 500 },
                    { type: 'Litigation', path: '/api/litigation', limit: 500 },
                    { type: 'HSE Audits', path: '/api/hse/audits', limit: 500 },
                    { type: 'HSE Incidents', path: '/api/hse/hse-incidents', limit: 500 },
                    { type: 'HSE Risk Management', path: '/api/hse/risk-management', limit: 500 },
                    { type: 'HSE Training', path: '/api/hse/training', limit: 500 },
                    { type: 'Safeguarding Referrals', path: '/api/safeguarding/referrals', limit: 500 },
                    { type: 'Risk Assessments', path: '/api/safeguarding/risk-assessments', limit: 500 },
                    { type: 'Vulnerable Users', path: '/api/safeguarding/vulnerable-users', limit: 500 },
                    { type: 'Multi Agency', path: '/api/safeguarding/multi-agency', limit: 500 },
                    { type: 'VCS Organisations', path: '/api/vcs-organisations', limit: 2000 },
                    { type: 'Case Management', path: '/api/case-management', limit: 2000 },
                    { type: 'Emergency Protocols', path: '/api/emergency-protocols', limit: 500 },
                ];

                const results = await Promise.allSettled(
                    sources.map(async (s) => {
                        const rows = await fetchList(s.path, {
                            limit: s.limit,
                            property_id: hotelId,
                            propertyId: hotelId,
                            hotel_id: hotelId,
                            hotelId: hotelId,
                            property: hotelId,
                        });
                        return { type: s.type, rows };
                    })
                );

                const merged = [];
                for (const r of results) {
                    if (r.status !== 'fulfilled') continue;
                    const type = r.value.type;
                    for (const row of r.value.rows || []) {
                        if (!matchesProperty(row)) continue;
                        merged.push({
                            type,
                            id: row?.id ?? row?.reference ?? row?._id ?? `${type}-${merged.length}`,
                            reference: row?.reference ?? row?.ref ?? row?.case_reference ?? null,
                            title: row?.title ?? row?.type ?? row?.incident_type ?? row?.inspection_type ?? row?.category ?? null,
                            status: row?.status ?? null,
                            date: normalizeDate(row),
                            raw: row,
                        });
                    }
                }

                if (cancelled) return;
                setItems(merged);
                setSelectedTypes((prev) => {
                    if (prev && prev.size) return prev;
                    return new Set(sources.map((s) => s.type));
                });
            } catch (e) {
                if (cancelled) return;
                setError(e?.message || 'Failed to load history');
                setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId, hotelName]);

    const typeOptions = useMemo(() => {
        const set = new Set(items.map((x) => x.type).filter(Boolean));
        return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
    }, [items]);

    const filtered = useMemo(() => {
        const q = (query || '').trim().toLowerCase();
        let list = items.filter((it) => selectedTypes.has(it.type));
        if (q) {
            list = list.filter((it) => {
                const hay = [it.reference, it.title, it.status]
                    .filter(Boolean)
                    .map((s) => String(s).toLowerCase())
                    .join(' ');
                return hay.includes(q);
            });
        }
        const dateVal = (d) => {
            if (!d) return 0;
            const t = new Date(d).getTime();
            return Number.isFinite(t) ? t : 0;
        };
        if (sortBy === 'date_asc') list.sort((a, b) => dateVal(a.date) - dateVal(b.date));
        else if (sortBy === 'type') list.sort((a, b) => String(a.type).localeCompare(String(b.type)));
        else list.sort((a, b) => dateVal(b.date) - dateVal(a.date));
        return list;
    }, [items, query, sortBy, selectedTypes]);

    const toggleType = (t) => {
        setSelectedTypes((prev) => {
            const next = new Set(prev);
            if (next.has(t)) next.delete(t);
            else next.add(t);
            return next;
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">History</h2>
                    <p className="text-sm text-gray-500">Unified timeline under this property</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="h-9 w-56 bg-white border border-gray-200 rounded-xl px-3 text-sm" />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 bg-white border border-gray-200 rounded-xl px-3 text-sm">
                        <option value="date_desc">Newest</option>
                        <option value="date_asc">Oldest</option>
                        <option value="type">Type</option>
                    </select>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
                {typeOptions.map((t) => (
                    <button key={t} type="button" onClick={() => toggleType(t)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${selectedTypes.has(t) ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
                ))}
            </div>
            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">Select a property to view history</div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No history found</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((it) => (
                                <tr key={`${it.type}-${it.id}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{it.date ? it.date.slice(0, 10) : '-'}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{it.type}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{it.reference || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{it.title || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{it.status || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function OverviewCard({ totalFloors, totalRooms }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Property Overview</h2>
            <p className="text-sm text-gray-500 mb-6">
                Hotel room structure and occupancy
            </p>

            <div className="flex justify-center items-center mt-10">
                {totalFloors === 0 && totalRooms === 0 ? (
                    <EmptyOverview />
                ) : (
                    <div className="text-gray-400 text-sm">
                        (Structure preview goes here)
                    </div>
                )}
            </div>
        </div>
    );
}

function FloorsRoomsCard({ hotelId, viewMode = "list" }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [floors, setFloors] = useState([]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hotelId) {
                setFloors([]);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const [roomsRes, residentsRes] = await Promise.all([
                    axios.get(`/api/hotels/${hotelId}/rooms`, { withCredentials: true }),
                    axios.get("/api/su/users", { withCredentials: true, params: { hotel_id: hotelId } }),
                ]);

                const rooms = Array.isArray(roomsRes.data?.rooms)
                    ? roomsRes.data.rooms
                    : Array.isArray(roomsRes.data)
                        ? roomsRes.data
                        : [];

                const residents = Array.isArray(residentsRes.data)
                    ? residentsRes.data
                    : Array.isArray(residentsRes.data?.users)
                        ? residentsRes.data.users
                        : Array.isArray(residentsRes.data?.data)
                            ? residentsRes.data.data
                            : [];

                const residentsByRoom = new Map();
                for (const r of residents) {
                    const key = (r.room_number ?? r.room ?? "")?.toString?.() ?? "";
                    if (!key) continue;
                    const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || "";
                    if (!name) continue;
                    if (!residentsByRoom.has(key)) residentsByRoom.set(key, []);
                    residentsByRoom.get(key).push(name);
                }

                const bedspaceCountsEntries = await Promise.all(
                    rooms.map(async (room) => {
                        if (!room?.id) return [room?.id, null];
                        const direct = room?.bedspaces ?? room?.bedspace ?? room?.beds ?? null;
                        const directNum = Number(direct);
                        if (Number.isFinite(directNum)) return [room.id, directNum];
                        try {
                            const res = await axios.get(
                                `/api/hotels/${hotelId}/rooms/${room.id}/bedspaces`,
                                { withCredentials: true }
                            );
                            const list = Array.isArray(res.data?.bedspaces)
                                ? res.data.bedspaces
                                : Array.isArray(res.data)
                                    ? res.data
                                    : [];
                            return [room.id, list.length];
                        } catch {
                            return [room.id, null];
                        }
                    })
                );
                const bedspaceCounts = new Map(bedspaceCountsEntries);

                const grouped = new Map();
                for (const room of rooms) {
                    const rawFloor = room?.floor ?? room?.Floor ?? room?.floor_name ?? null;
                    const floorKey = rawFloor === null || rawFloor === undefined || String(rawFloor).trim() === ""
                        ? "Unassigned"
                        : String(rawFloor);

                    if (!grouped.has(floorKey)) grouped.set(floorKey, []);
                    grouped.get(floorKey).push(room);
                }

                const asList = Array.from(grouped.entries()).map(([floor, rs]) => {
                    const roomsForFloor = [...rs].sort((a, b) => String(a?.room_number ?? "").localeCompare(String(b?.room_number ?? "")));
                    const normalizedRooms = roomsForFloor.map((room) => {
                        const roomKey = (room?.room_number ?? "")?.toString?.() ?? "";
                        const resNames = residentsByRoom.get(roomKey) || [];
                        const totalBeds = bedspaceCounts.get(room?.id) ?? null;
                        const occupiedBeds = roomKey ? resNames.length : 0;
                        return {
                            ...room,
                            _residentNames: resNames,
                            _totalBeds: totalBeds,
                            _occupiedBeds: occupiedBeds,
                        };
                    });
                    return { floor, rooms: normalizedRooms };
                });

                const orderFloor = (name) => {
                    const s = String(name || "").toLowerCase();
                    if (s.includes("ground")) return -1;
                    if (s === "unassigned") return 9999;
                    const n = Number.parseInt(s, 10);
                    if (Number.isFinite(n)) return n;
                    const m = s.match(/(\d+)/);
                    if (m) return Number.parseInt(m[1], 10);
                    return 1000;
                };

                asList.sort((a, b) => {
                    const na = orderFloor(a.floor);
                    const nb = orderFloor(b.floor);
                    if (na !== nb) return na - nb;
                    return String(a.floor).localeCompare(String(b.floor));
                });

                if (!cancelled) setFloors(asList);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load rooms";
                setError(msg);
                setFloors([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {viewMode === "grid" ? "Property Overview" : "Floors & Rooms"}
                </h2>
                <p className="text-sm text-gray-500">
                    {viewMode === "grid" ? "Hotel room structure and occupancy" : "Detailed floor and room information with occupancy status"}
                </p>
            </div>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view floors and rooms</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : floors.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>No rooms found</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {floors.map((floor, idx) => (
                        <div key={idx}>
                            <div className="flex items-center gap-3 mb-4">
                                {viewMode === "grid" && (
                                    <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                )}
                                <div className={viewMode === "grid" ? "flex items-center gap-3" : "block"}>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {floor.floor === "Unassigned"
                                            ? "Unassigned Rooms"
                                            : String(floor.floor) === "0"
                                                ? (viewMode === "grid" ? "Floor 0 - Ground Floor" : "Ground Floor")
                                                : !isNaN(Number(floor.floor))
                                                    ? `Floor ${floor.floor}`
                                                    : floor.floor}
                                    </h3>
                                    {viewMode === "list" && (
                                        <p className="text-sm text-gray-500 font-medium pl-0.5">
                                            {floor.rooms.length} room{floor.rooms.length !== 1 ? 's' : ''}
                                        </p>
                                    )}
                                    {viewMode === "grid" && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                                            {floor.rooms.length} rooms
                                        </span>
                                    )}
                                </div>
                            </div>

                            {viewMode === "grid" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {floor.rooms.map((room) => (
                                        <div
                                            key={room.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => navigate(`/hotels/${hotelId}/rooms/${room.id}`)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    navigate(`/hotels/${hotelId}/rooms/${room.id}`);
                                                }
                                            }}
                                            className="bg-white border border-gray-200 rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="font-bold text-gray-900 text-lg">Room {room.room_number || "000"}</div>
                                                <span className="px-2 py-1 rounded-xl text-[10px] uppercase font-bold tracking-wide bg-gray-100 text-gray-500">
                                                    {room.type || "Standard"}
                                                </span>
                                            </div>

                                            <div className="space-y-3 text-sm text-slate-600 mb-5">
                                                <div className="flex items-center gap-3">
                                                    <BedDouble className="w-4 h-4 text-slate-400" />
                                                    <span>{room._totalBeds || 0} bedspaces</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                    </svg>
                                                    <span>Shared Facilities</span>
                                                </div>
                                                <div className={`flex items-center gap-3 font-semibold ${room._occupiedBeds > (room._totalBeds || 0) ? "text-red-600" : "text-slate-900"}`}>
                                                    <Users className="w-4 h-4" />
                                                    <span>{room._occupiedBeds || 0}/{room._totalBeds || "-"} occupied</span>
                                                    {room._occupiedBeds > (room._totalBeds || 0) && (
                                                        <span className="text-red-600 text-[10px] font-bold px-2 py-0.5 bg-red-50 rounded-full border border-red-100">Overcrowded</span>
                                                    )}
                                                </div>
                                            </div>

                                            {room._residentNames && room._residentNames.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Residents</p>
                                                    <div className="flex flex-col gap-2">
                                                        {room._residentNames.map((name, i) => (
                                                            <div key={i} className="bg-slate-50 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 border border-slate-100/50">
                                                                {name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {floor.rooms.map((room) => (
                                        <div key={room.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="font-bold text-gray-900 text-lg">Room {room.room_number}</span>
                                                    <span className="text-sm text-gray-500 capitalize">{room.type || "Standard"}</span>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${(room.status || 'available').toLowerCase() === 'available'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}>
                                                        {room.status || "available"}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600 flex flex-wrap items-center gap-x-6 gap-y-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-gray-900">Beds:</span>
                                                        {room._occupiedBeds}/{room._totalBeds || 0}
                                                    </span>
                                                    {room._residentNames && room._residentNames.length > 0 && (
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="font-semibold text-gray-900">Resident:</span>
                                                            <span>{room._residentNames.join(", ")}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <button className="rounded-xl text-[#5cd9c7] hover:text-[#4fcfbe] text-sm font-medium transition-colors">
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ResidentsCard({ hotelId }) {
    const [residents, setResidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hotelId) {
                setResidents([]);
                return;
            }
            try {
                setLoading(true);
                setError("");
                const res = await axios.get("/api/su/users", {
                    withCredentials: true,
                    params: { hotel_id: hotelId },
                });

                const data = Array.isArray(res.data)
                    ? res.data
                    : Array.isArray(res.data?.users)
                        ? res.data.users
                        : Array.isArray(res.data?.data)
                            ? res.data.data
                            : [];

                if (!cancelled) setResidents(data);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load residents";
                setError(msg);
                setResidents([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Current Residents</h2>
            <p className="text-sm text-gray-500 mb-6">
                All service users currently residing in this property
            </p>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view residents</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : (

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Resident Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Room</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Move-in Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {residents.map((resident) => (
                                <tr key={resident.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {[resident.first_name, resident.last_name].filter(Boolean).join(" ") || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{resident.room_number || resident.room || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{resident.admission_date || resident.move_in_date || "-"}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                            {resident.status || "Active"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function IncidentsCard({ hotelId, hotelName }) {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hotelId) {
                setIncidents([]);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const res = await axios.get("/api/incidents", {
                    withCredentials: true,
                    params: { property_id: hotelId, limit: 200 },
                });

                const data = Array.isArray(res.data?.data)
                    ? res.data.data
                    : Array.isArray(res.data)
                        ? res.data
                        : [];

                if (!cancelled) setIncidents(data);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load incidents";
                setError(msg);
                setIncidents([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId]);

    const statusBadge = (status) => {
        const s = String(status || "").toLowerCase();
        if (s === "resolved" || s === "closed" || s === "completed") {
            return "bg-green-50 text-green-700 border border-green-200";
        }
        if (s === "open" || s === "pending") {
            return "bg-orange-50 text-orange-700 border border-orange-200";
        }
        if (s === "in progress") {
            return "bg-purple-50 text-purple-700 border border-purple-200";
        }
        return "bg-gray-100 text-gray-700 border border-gray-200";
    };

    const severityBadge = (severity) => {
        const s = String(severity || "").toLowerCase();
        if (s === "high" || s === "urgent" || s === "critical") {
            return "bg-red-50 text-red-700 border border-red-200";
        }
        if (s === "medium") {
            return "bg-orange-50 text-orange-700 border border-orange-200";
        }
        if (s === "low") {
            return "bg-green-50 text-green-700 border border-green-200";
        }
        return "bg-gray-100 text-gray-700 border border-gray-200";
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Incidents</h2>
            <p className="text-sm text-gray-500 mb-6">
                {hotelName ? `Incidents logged for ${hotelName}` : "Incidents logged for this property"}
            </p>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view incidents</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : incidents.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>No incidents found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Severity</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reported</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {incidents.map((it) => (
                                <tr key={it.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{it.reference || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{it.type || "-"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityBadge(it.severity)}`}>
                                            {it.severity || "-"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(it.status)}`}>
                                            {it.status || "-"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{it.reported_date || it.reportedDate || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function InspectionsCard({ hotelId, hotelName }) {
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hotelId) {
                setInspections([]);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const res = await axios.get("/api/inspections", {
                    withCredentials: true,
                    params: {
                        property: hotelId,
                        property_id: hotelId,
                        propertyId: hotelId,
                        hotel_id: hotelId,
                        hotelId: hotelId,
                        property_name: hotelName,
                        propertyName: hotelName,
                        hotel_name: hotelName,
                        hotelName: hotelName,
                        limit: 200,
                    },
                });

                const data = Array.isArray(res.data?.data)
                    ? res.data.data
                    : Array.isArray(res.data)
                        ? res.data
                        : [];

                const filtered = (Array.isArray(data) ? data : []).filter((it) => {
                    const pid = it.property_id ?? it.propertyId ?? it.hotel_id ?? it.hotelId ?? it.property ?? null;
                    const pname = it.property_name ?? it.propertyName ?? it.hotel_name ?? it.hotelName ?? null;
                    if (hotelId && pid != null && String(pid) === String(hotelId)) return true;
                    if (hotelName && pname && String(pname).toLowerCase() === String(hotelName).toLowerCase()) return true;
                    return false;
                });

                if (!cancelled) setInspections(filtered);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load inspections";
                setError(msg);
                setInspections([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId]);

    const statusBadge = (status) => {
        const s = String(status || "").toLowerCase();
        if (s === "completed" || s === "resolved") {
            return "bg-green-50 text-green-700 border border-green-200";
        }
        if (s === "pending" || s === "open") {
            return "bg-orange-50 text-orange-700 border border-orange-200";
        }
        if (s === "in progress" || s === "in_progress") {
            return "bg-purple-50 text-purple-700 border border-purple-200";
        }
        return "bg-gray-100 text-gray-700 border border-gray-200";
    };

    const priorityBadge = (priority) => {
        const p = String(priority || "").toLowerCase();
        if (p === "urgent" || p === "high") {
            return "bg-red-50 text-red-700 border border-red-200";
        }
        if (p === "medium") {
            return "bg-orange-50 text-orange-700 border border-orange-200";
        }
        if (p === "low") {
            return "bg-green-50 text-green-700 border border-green-200";
        }
        return "bg-gray-100 text-gray-700 border border-gray-200";
    };

    const formatDateCell = (value) => {
        if (!value) return "-";
        try {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return String(value);
            return d.toISOString().slice(0, 10);
        } catch {
            return String(value);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Inspections</h2>
            <p className="text-sm text-gray-500 mb-6">
                {hotelName ? `Inspections logged for ${hotelName}` : "Inspections logged for this property"}
            </p>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view inspections</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : inspections.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>No inspections found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Priority</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Inspector</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {inspections.map((it) => (
                                <tr key={it.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{it.reference || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{it.inspection_type || it.inspectionType || "-"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityBadge(it.priority)}`}>
                                            {it.priority || "-"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(it.status)}`}>
                                            {it.status || "-"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{it.inspector_name || it.inspectorName || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{formatDateCell(it.inspection_date || it.inspectionDate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function MaintenanceCard({ hotelId, hotelName }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hotelId && !hotelName) {
                setTasks([]);
                return;
            }
            try {
                setLoading(true);
                setError("");
                const res = await axios.get("/api/maintenance", {
                    withCredentials: true,
                    params: { limit: 200, ...(hotelId ? { hotel_id: hotelId } : {}), ...(hotelName ? { hotel_name: hotelName } : {}) },
                });
                const data = res?.data?.data ?? res?.data ?? [];
                if (!cancelled) setTasks(Array.isArray(data) ? data : []);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load maintenance";
                setError(msg);
                setTasks([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Maintenance</h2>
            <p className="text-sm text-gray-500 mb-6">
                Maintenance requests and status
            </p>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view maintenance</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Priority</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tasks.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-600">{t.reference || t.id}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.title || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{t.status || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{t.priority || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ComplianceCard({ hotelId, hotelName }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!hotelId && !hotelName) {
                setItems([]);
                return;
            }
            try {
                setLoading(true);
                setError("");
                const res = await axios.get("/api/compliance", {
                    withCredentials: true,
                    params: { limit: 200, ...(hotelId ? { hotel_id: hotelId } : {}), ...(hotelName ? { hotel_name: hotelName } : {}) },
                });
                const data = res?.data?.ok ? res.data.data || [] : [];
                if (!cancelled) setItems(Array.isArray(data) ? data : []);
            } catch (err) {
                if (cancelled) return;
                const msg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to load compliance";
                setError(msg);
                setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [hotelId]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Compliance</h2>
            <p className="text-sm text-gray-500 mb-6">
                Property compliance and certifications
            </p>

            {!hotelId ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Select a property to view compliance</p>
                </div>
            ) : loading ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Loading...</p>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">
                    <p>{error}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Issue Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Expiry Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.certificate_type || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{c.issue_date || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{c.expiry_date || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Input({ label, placeholder, value, onChange, type = "text", required = false }) {
    return (
        <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">{label}</label>
            <input
                type={type}
                required={required}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="rounded-xl form-input w-full"
            />
        </div>
    );
}

function Select({ label, value, onChange, options = [], placeholder }) {
    return (
        <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">{label}</label>
            <select
                value={value}
                onChange={onChange}
                className="rounded-xl form-select w-full"
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(opt => (
                    <option key={opt.value || opt} value={opt.value || opt}>
                        {opt.label || opt}
                    </option>
                ))}
            </select>
        </div>
    );
}

function Toggle({ label, description }) {
    return (
        <div>
            <label className="block text-sm text-gray-700 mb-1">{label}</label>
            <div className="flex items-center gap-3">
                <input type="checkbox" className="h-5 w-9 rounded-full" />
                <span className="text-xs text-gray-500">{description}</span>
            </div>
        </div>
    );
}