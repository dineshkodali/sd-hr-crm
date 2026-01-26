import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

axios.defaults.withCredentials = true;

export default function RoomDetails() {
  const { hotelId, roomId } = useParams();
  const navigate = useNavigate();

  const [hotel, setHotel] = useState(null);
  const [room, setRoom] = useState(null);
  const [bedspacesCount, setBedspacesCount] = useState(null);
  const [residents, setResidents] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const roomNumber = useMemo(() => {
    const rn = room?.room_number ?? room?.room ?? room?.number ?? "";
    return rn === null || rn === undefined ? "" : String(rn);
  }, [room]);

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
        setRoom(roomRes?.data?.room ?? roomRes?.data ?? null);
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

        const names = filtered
          .map((u) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.name || "")
          .filter(Boolean);

        if (!cancelled) setResidents(names);
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
  const hasBathroomVal = room?.has_bathroom ?? room?.bathroom_available ?? room?.hasBathroom ?? null;

  const yesNoUnknown = (v) => {
    const s = String(v).toLowerCase();
    if (v === true || s === "true" || s === "t" || s === "1" || s === "yes") return "Yes";
    if (v === false || s === "false" || s === "f" || s === "0" || s === "no") return "No";
    return "—";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="p-6 w-[90%] max-w-[1800px] mx-auto">
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
        <div className="p-6 w-[90%] max-w-[1800px] mx-auto">
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-gray-200 px-4 py-2.5 rounded-full shadow-sm hover:text-teal-700 transition-colors"
          >
            <span className="text-lg leading-none">←</span>
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
      <div className="p-6 w-[90%] max-w-[1800px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
            <button onClick={() => navigate("/hotels")} className="hover:text-teal-700 transition-colors">
              Home
            </button>
            <span>/</span>
            <button onClick={() => navigate(`/hotels/${hotelId}/rooms`)} className="hover:text-teal-700 transition-colors">
              Properties
            </button>
            <span>/</span>
            <span className="text-gray-800 font-medium">Room {roomNumber || "-"}</span>
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={goBack}
                className="mt-1 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                aria-label="Back"
              >
                ←
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">Room {roomNumber || "-"}</h1>
                <div className="text-sm text-gray-500">{hotel?.name || ""}</div>
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {String(room?.status || "active")}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-1 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "overview" ? "bg-[#5cd9c7] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "inventory" ? "bg-[#66f1dd] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Inventory & Equipment
            </button>
            <button
              onClick={() => setActiveTab("residents")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "residents" ? "bg-[#66f1dd] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Residents ({residents.length})
            </button>
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Room Details</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Room Type</div>
                  <div className="text-sm font-semibold text-gray-900">{roomTypeLabel || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Bedspaces</div>
                  <div className="text-sm font-semibold text-gray-900">{totalBedspacesLabel}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Occupied Bedspaces</div>
                  <div className="text-sm font-semibold text-gray-900">{occupiedLabel}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Dimensions</h2>
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
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Facilities</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500">Bathroom</div>
                  <div className="text-sm font-semibold text-gray-900">{bathroomTypeVal || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Has Bathroom</div>
                  <div className="text-sm font-semibold text-gray-900">{yesNoUnknown(hasBathroomVal)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Kitchen</div>
                  <div className="text-sm font-semibold text-gray-900">{yesNoUnknown(hasKitchenVal)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory & Equipment</h2>
            {(() => {
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
                      className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-lg border border-gray-100"
                    >
                      {getInventoryIcon(item)}
                      <span className="text-sm font-medium text-gray-800">
                        {String(item).trim()}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "residents" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {residents.length === 0 ? (
              <div className="text-gray-500">No residents assigned to this room.</div>
            ) : (
              <div className="space-y-2">
                {residents.map((name, idx) => (
                  <div
                    key={`${name}-${idx}`}
                    className="bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-800 border border-gray-100"
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
