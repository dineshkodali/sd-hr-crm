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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-gray-600">
            Inventory & Equipment view is not implemented yet.
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
