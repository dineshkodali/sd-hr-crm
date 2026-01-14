import React, { useState } from "react";
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
                    tagClass += " bg-blue-50 text-blue-700 border border-blue-200";
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
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
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("floors")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "floors"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Floors & Rooms
            </button>
            <button
              onClick={() => setActiveTab("residents")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "residents"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Residents
            </button>
            <button
              onClick={() => setActiveTab("maintenance")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "maintenance"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Maintenance
            </button>
            <button
              onClick={() => setActiveTab("compliance")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "compliance"
                  ? "bg-blue-600 text-white shadow-sm"
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

          {activeTab === "floors" && <FloorsRoomsCard property={property} />}

          {activeTab === "residents" && <ResidentsCard property={property} />}

          {activeTab === "maintenance" && <MaintenanceCard />}

          {activeTab === "compliance" && <ComplianceCard />}
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

function FloorsRoomsCard({ property }) {
  // Mock data - replace with actual API call
  const floors = [
    {
      floor: "Ground Floor",
      rooms: [
        { id: 1, room_number: "G01", type: "Single", status: "Occupied", bedspaces: 1, occupied: 1, resident: "John Doe" },
        { id: 2, room_number: "G02", type: "Double", status: "Available", bedspaces: 2, occupied: 0, resident: null },
        { id: 3, room_number: "G03", type: "Twin", status: "Occupied", bedspaces: 2, occupied: 2, resident: "Jane Smith, Mary Johnson" },
      ]
    },
    {
      floor: "First Floor",
      rooms: [
        { id: 4, room_number: "101", type: "Single", status: "Occupied", bedspaces: 1, occupied: 1, resident: "Bob Wilson" },
        { id: 5, room_number: "102", type: "Double", status: "Available", bedspaces: 2, occupied: 0, resident: null },
        { id: 6, room_number: "103", type: "Family", status: "Occupied", bedspaces: 4, occupied: 3, resident: "Sarah Brown & Family" },
      ]
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Floors & Rooms</h2>
      <p className="text-sm text-gray-500 mb-6">
        Detailed floor and room information with occupancy status
      </p>

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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          room.status === 'Available' 
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                          {room.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          <span className="font-medium">Beds:</span> {room.occupied}/{room.bedspaces}
                        </span>
                        {room.resident && (
                          <span className="text-gray-600">
                            <span className="font-medium">Resident:</span> {room.resident}
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResidentsCard({ property }) {
  // Mock data - replace with actual API call
  const residents = [
    { id: 1, name: "John Doe", room: "G01", floor: "Ground Floor", move_in_date: "2024-01-15", added_by: "Admin User", status: "Active" },
    { id: 2, name: "Jane Smith", room: "G03", floor: "Ground Floor", move_in_date: "2024-02-20", added_by: "Manager Name", status: "Active" },
    { id: 3, name: "Mary Johnson", room: "G03", floor: "Ground Floor", move_in_date: "2024-02-20", added_by: "Manager Name", status: "Active" },
    { id: 4, name: "Bob Wilson", room: "101", floor: "First Floor", move_in_date: "2024-03-10", added_by: "Admin User", status: "Active" },
    { id: 5, name: "Sarah Brown", room: "103", floor: "First Floor", move_in_date: "2024-03-25", added_by: "Staff Member", status: "Active" },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Current Residents</h2>
      <p className="text-sm text-gray-500 mb-6">
        All service users currently residing in this property
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Resident Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Room</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Floor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Move-in Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Added By</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {residents.map((resident) => (
              <tr key={resident.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{resident.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{resident.room}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{resident.floor}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{resident.move_in_date}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{resident.added_by}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    {resident.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <button className="text-blue-600 hover:text-blue-700 font-medium">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceCard() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Maintenance</h2>
      <p className="text-sm text-gray-500 mb-6">
        Maintenance requests and status
      </p>

      <div className="text-center py-12 text-gray-400">
        <p>Maintenance cards / table will appear here</p>
      </div>
    </div>
  );
}

function ComplianceCard() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Compliance</h2>
      <p className="text-sm text-gray-500 mb-6">
        Property compliance and certifications
      </p>

      <div className="text-center py-12 text-gray-400">
        <p>Compliance data will appear here</p>
      </div>
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