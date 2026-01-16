import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Home, Building, BedDouble, Users, MapPin } from "lucide-react";

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

  const hotelId = useMemo(() => {
    const raw = property?._raw;
    return raw?.id ?? raw?.hotel_id ?? raw?.property_id ?? null;
  }, [property]);

  const hotelName = useMemo(() => {
    return name || property?._raw?.name || "";
  }, [name, property]);

  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
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
    totalBedspaces === 0
      ? 0
      : Math.round((occupiedBeds / totalBedspaces) * 100);


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
      //   payload.manager = user.id;
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
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <Home className="w-4 h-4" />
                <span>→</span>
                <span>Properties</span>
                <span>→</span>
                <span className="text-gray-900 font-medium">{name}</span>
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
                onClick={() => setShowCreateRoom(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#66f1dd] hover:bg-[#4fcfbe] text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Room
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Building className="w-5 h-5" />}
            title="Total Floors"
            value={totalFloors}
          />

          <StatCard
            icon={<Home className="w-5 h-5" />}
            title="Total Rooms"
            value={totalRooms}
          />

          <StatCard
            icon={<BedDouble className="w-5 h-5" />}
            title="Total Bedspaces"
            value={totalBedspaces}
            subtitle={`${occupiedBeds} occupied`}
          />

          <StatCard
            icon={<Users className="w-5 h-5" />}
            title="Occupancy Rate"
            value={`${occupancyRate}%`}
            subtitle={`${occupiedBeds} / ${totalBedspaces} beds`}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-1 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "overview"
                  ? "bg-[#5cd9c7] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("floors")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "floors"
                  ? "bg-[#66f1dd] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Floors & Rooms
            </button>
            <button
              onClick={() => setActiveTab("residents")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "residents"
                  ? "bg-[#66f1dd] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Residents
            </button>
            <button
              onClick={() => setActiveTab("maintenance")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "maintenance"
                  ? "bg-[#5cd9c7] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Maintenance
            </button>
            <button
              onClick={() => setActiveTab("inspections")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "inspections"
                  ? "bg-[#5cd9c7] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Inspections
            </button>
            <button
              onClick={() => setActiveTab("incidents")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "incidents"
                  ? "bg-[#5cd9c7] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Incidents
            </button>
            <button
              onClick={() => setActiveTab("compliance")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "compliance"
                  ? "bg-[#5cd9c7] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              Compliance
            </button>
          </div>
        </div>

        {/* TAB CONTENT */}
        <div>
          {activeTab === "overview" && (
            <OverviewCard totalFloors={totalFloors} totalRooms={totalRooms} />
          )}

          {activeTab === "floors" && <FloorsRoomsCard hotelId={hotelId} />}

          {activeTab === "residents" && <ResidentsCard hotelId={hotelId} />}

          {activeTab === "maintenance" && <MaintenanceCard hotelId={hotelId} hotelName={hotelName} />}

          {activeTab === "inspections" && <InspectionsCard hotelId={hotelId} hotelName={hotelName} />}

          {activeTab === "incidents" && <IncidentsCard hotelId={hotelId} hotelName={hotelName} />}

          {activeTab === "compliance" && <ComplianceCard hotelId={hotelId} hotelName={hotelName} />}
        </div>

        {/* Overview Card */}
        {/* <div className="mt-10 bg-white rounded-xl shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Property Overview
          </h2>
          <p className="text-sm text-gray-500 mt-1">
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
        </div> */}
      </div>

      {/* CREATE ROOM MODAL */}
      {showCreateRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm mt-10">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-6 ">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Room Creation
                </h2>
                <p className="text-sm text-gray-500">
                  Form for creating new rooms in a property
                </p>
              </div>
              <button
                onClick={() => setShowCreateRoom(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"
            >
              {errorMsg && (
                <div className="text-red-700 bg-red-50 p-3 rounded-lg text-sm">
                  {errorMsg}
                </div>
              )}

              {/* ROW 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    placeholder="e.g., 101, A1, G-01"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm
          focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier for this room within the property
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Type <span className="text-red-500">*</span>
                  </label>
                  <select className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200">
                    <option>Select room type</option>
                  </select>
                </div>
              </div>

              {/* ROW 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bed Type
                  </label>
                  <select className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200">
                    <option>Select bed type</option>
                    <option>single</option>
                    <option>double</option>
                    <option>bunk</option>
                    <option>twin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Bedspaces <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    defaultValue={1}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm
          focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum number of people this room can accommodate
                  </p>
                </div>
              </div>

              {/* ROW 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Floor
                  </label>
                  <select className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200">
                    <option>Select floor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Has Kitchen
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-300 transition"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-4"></div>
                    </label>
                    <span className="text-sm text-gray-500">Yes / No</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Does this room have kitchen facilities?
                  </p>
                </div>
              </div>

              {/* ROW 4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Has Bathroom
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-emerald-300 transition"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-4"></div>
                    </label>
                    <span className="text-sm text-gray-500">Yes / No</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Does this room have a bathroom?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bathroom Type
                  </label>
                  <select className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200">
                    <option>Select bathroom type</option>
                    <option>ensuite</option>
                    <option>common</option>
                    <option>shared</option>
                  </select>
                </div>
              </div>

              {/* DIMENSIONS */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">
                  Room Dimensions
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Optional measurements for the room
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Length (meters)
                    </label>
                    <input
                      placeholder="Room length in meters"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Width (meters)
                    </label>
                    <input
                      placeholder="Room width in meters"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>
              </div>

              {/* STATUS */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white
      focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                >
                  <option>active</option>
                  <option>inactive</option>
                  <option>maintenance</option>
                </select>
              </div>

              {/* FOOTER */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => setShowCreateRoom(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-400 hover:bg-teal-500 text-white text-sm font-medium shadow-sm"
                >
                  Submit Form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- STAT CARD COMPONENT --- */
function StatCard({ icon, title, value, subtitle }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className="text-blue-600 bg-blue-50 p-2 rounded-lg">{icon}</div>
      </div>
    </div>
  );
}

/* --- EMPTY OVERVIEW --- */
function EmptyOverview() {
  return (
    <div className="flex flex-col items-center text-center py-12">
      <div className="p-6 rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v13h18V7M5 5h14l1 2H4l1-2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mt-4 text-gray-900">
        No floors or rooms yet
      </h3>
      <p className="text-sm mt-1 text-gray-500">
        Add floors and rooms to get started
      </p>
    </div>
  );
}

function OverviewCard({ totalFloors, totalRooms }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

function FloorsRoomsCard({ hotelId }) {
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Floors & Rooms</h2>
      <p className="text-sm text-gray-500 mb-6">
        Detailed floor and room information with occupancy status
      </p>

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
      <div className="space-y-6">
        {floors.map((floor, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{floor.floor}</h3>
              <p className="text-xs text-gray-500">{floor.rooms.length} rooms</p>
            </div>
            <div className="divide-y divide-gray-100">
              {floor.rooms.map((room) => (
                <div key={room.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">Room {room.room_number}</span>
                        <span className="text-sm text-gray-600">{room.type}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${String(room.status || "").toLowerCase() === 'available'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}>
                          {room.status || "-"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          <span className="font-medium">Beds:</span> {room._occupiedBeds}/{room._totalBeds ?? "-"}
                        </span>
                        {Array.isArray(room._residentNames) && room._residentNames.length > 0 && (
                          <span className="text-gray-600">
                            <span className="font-medium">Resident:</span> {room._residentNames.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => window.location.assign(`/hotels/${hotelId}/rooms`)}
                      className="text-[#5cd9c7] hover:text-[#4fcfbe] text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

function Input({ label, placeholder, value }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        className="
          w-full rounded-md border border-gray-300 p-2 text-sm
          focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200
        "
      />
    </div>
  );
}

function Select({ label, placeholder }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <select className="w-full rounded-md border border-gray-300 p-2 text-sm bg-white">
        <option>{placeholder}</option>
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