/* src/pages/RoomsManager.jsx */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";

// ensure cookies are sent for protected endpoints (explicit)
axios.defaults.withCredentials = true;

export default function RoomsManager({ user }) {
  const { hotelId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ room_number: "", type: "", rate: "" });
  const [editing, setEditing] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [saving, setSaving] = useState(false);

  // Determine if current user is allowed to manage rooms for this hotel
  const computeCanManage = (userObj, hotelObj) => {
    if (!userObj) return false;
    if (userObj.role === "admin") return true;
    if (!hotelObj) return false;
    if (String(userObj.id) === String(hotelObj.manager_id)) return true;
    if (userObj.role === "staff") {
      const userHotelId = userObj.hotel_id || userObj.hotelId || userObj.hotel || null;
      if (userHotelId && String(userHotelId) === String(hotelObj.id)) return true;
      if (userObj.branch && hotelObj.branch && String(userObj.branch) === String(hotelObj.branch)) return true;
    }
    return false;
  };

  const fetchHotel = async () => {
    try {
      const res = await axios.get(`/api/hotels/${hotelId}`);
      // some APIs return { hotel: {...} } while others return the object directly
      setHotel(res.data && res.data.hotel ? res.data.hotel : res.data);
    } catch (err) {
      console.error("Failed to load hotel:", err);
      setHotel(null);
    }
  };

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/hotels/${hotelId}/rooms`);
      setRooms(res.data && res.data.rooms ? res.data.rooms : (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      console.error("Failed to load rooms:", err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotel();
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const canManage = computeCanManage(user, hotel);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!canManage) return alert("You are not authorized to create rooms for this hotel.");
    setSaving(true);
    try {
      const payload = {
        room_number: form.room_number,
        type: form.type,
        rate: form.rate !== "" ? Number(form.rate) : null,
      };
      const res = await axios.post(`/api/hotels/${hotelId}/rooms`, payload);
      setForm({ room_number: "", type: "", rate: "" });
      await fetch();
      // optionally show server message
      if (res.data && res.data.message) {
        // lightweight non-blocking feedback
        console.info(res.data.message);
      }
    } catch (err) {
      console.error("Create room error:", err);
      alert(err?.response?.data?.message || "Failed to create room");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r) => {
    setEditing(r.id);
    setForm({
      room_number: r.room_number || "",
      type: r.type || "",
      rate: (r.rate !== undefined && r.rate !== null) ? String(r.rate) : "",
    });
    // scroll into view or focus can be added here if desired
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!canManage) return alert("You are not authorized to edit rooms for this hotel.");
    if (!editing) return alert("No room selected for editing.");
    setSaving(true);
    try {
      const payload = {
        room_number: form.room_number,
        type: form.type,
        rate: form.rate !== "" ? Number(form.rate) : null,
      };
      // IMPORTANT: use the hotel-scoped route for editing
      await axios.put(`/api/hotels/${hotelId}/rooms/${editing}`, payload);
      setEditing(null);
      setForm({ room_number: "", type: "", rate: "" });
      await fetch();
    } catch (err) {
      console.error("Save edit error:", err);
      alert(err?.response?.data?.message || "Failed to update room");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete room?")) return;
    if (!canManage) return alert("You are not authorized to delete rooms for this hotel.");
    try {
      // IMPORTANT: use the hotel-scoped route for delete
      await axios.delete(`/api/hotels/${hotelId}/rooms/${id}`);
      await fetch();
    } catch (err) {
      console.error("Delete room error:", err);
      alert(err?.response?.data?.message || "Failed to delete room");
    }
  };

  return (
    /* SCROLL FIX: 
      Changed 'min-h-screen' to 'h-screen overflow-y-auto'. 
      This forces this container to manage its own scrolling if the parent layout is fixed.
      Added 'pb-24' to ensure the last item is never hidden behind the bottom edge.
    */
    <div className="h-screen overflow-y-auto bg-[#f0faf9] font-sans p-3 sm:p-4 md:p-6 pb-24" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-[90%] max-w-[1800px] mx-auto">
        {/* Breadcrumb & Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-[#d3f1ec] px-4 py-2.5 rounded-full shadow-sm">
            <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
            <button 
              onClick={() => navigate('/hotels')} 
              className="hover:text-teal-600 transition-colors"
            >
              Hotels
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-teal-700 font-bold">Manage Rooms</span>
          </div>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight mb-2">
            Manage Rooms
          </h1>
          <p className="text-slate-500 font-medium text-lg">
            {hotel?.name ? `Managing rooms for ${hotel.name}` : 'Configure and manage hotel rooms'}
          </p>
        </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-[#d3f1ec] p-16 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#d3f1ec] border-t-teal-600 mb-4"></div>
          <div className="text-slate-500 font-medium">Loading rooms...</div>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* Create / Edit Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#d3f1ec] p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#f0faf9] border border-[#d3f1ec] flex items-center justify-center text-teal-700">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {editing ? "Edit Room Details" : "Add New Room"}
                </h3>
                <p className="text-slate-500 text-sm">Enter the details below to update your inventory.</p>
              </div>
            </div>

            <form onSubmit={editing ? saveEdit : createRoom} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Room Number <span className="text-teal-500">*</span>
                </label>
                <input
                  value={form.room_number}
                  onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                  placeholder="e.g., 101, 102"
                  required
                  className="w-full px-4 py-3 bg-[#f0faf9] border border-[#d3f1ec] rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-[#d3f1ec] text-slate-700 placeholder-slate-400 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Room Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-3 bg-[#f0faf9] border border-[#d3f1ec] rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-[#d3f1ec] text-slate-700 transition-all outline-none"
                >
                  <option value="">Select Type</option>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Suite">Suite</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Family">Family</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Rate (₹)
                </label>
                <input
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="e.g., 1500"
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 bg-[#f0faf9] border border-[#d3f1ec] rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-[#d3f1ec] text-slate-700 placeholder-slate-400 transition-all outline-none"
                />
              </div>

              <div className="md:col-span-3 flex gap-3 pt-2">
                <button
                  type="submit"
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm
                    ${canManage 
                      ? 'bg-teal-700 hover:bg-teal-800 text-white transform active:scale-95' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }
                  `}
                  disabled={!canManage || saving}
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {editing ? "Saving..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      {editing ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {editing ? "Save Changes" : "Create Room"}
                    </>
                  )}
                </button>

                {editing && (
                  <button
                    type="button"
                    onClick={() => { 
                      setEditing(null); 
                      setForm({ room_number: "", type: "", rate: "" }); 
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {!canManage && (
                <div className="md:col-span-3 flex items-center gap-3 text-sm bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 text-orange-800">
                  <svg className="w-5 h-5 flex-shrink-0 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <span>You are not authorized to manage rooms for this hotel.</span>
                </div>
              )}
            </form>
          </div>

          {/* Rooms List */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#d3f1ec] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#f0faf9]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#f0faf9] border border-[#d3f1ec] flex items-center justify-center text-teal-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Rooms List</h3>
                  <p className="text-sm text-slate-500">{rooms.length} room{rooms.length !== 1 ? 's' : ''} total</p>
                </div>
              </div>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-16 bg-[#f0faf9] rounded-2xl border border-dashed border-[#d3f1ec]">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <svg className="w-8 h-8 text-[#d3f1ec]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd"/>
                  </svg>
                </div>
                <p className="text-slate-600 font-medium">No rooms yet.</p>
                <p className="text-sm text-slate-400 mt-1">Create your first room using the form above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {rooms.map(r => (
                  <div 
                    key={r.id} 
                    className="group bg-white rounded-xl border border-[#d3f1ec] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-teal-200 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[#f0faf9] border border-[#d3f1ec] flex items-center justify-center text-teal-800 font-bold text-lg">
                          {r.room_number}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-lg group-hover:text-teal-700 transition-colors">Room {r.room_number}</div>
                          <div className="text-sm text-slate-500">{r.type || 'Standard'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-2">
                          Rate
                        </span>
                        <span className="font-bold text-slate-700">₹{Number(r.rate || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Status</span>
                        <span className={`
                          px-2.5 py-0.5 rounded-full text-xs font-semibold
                          ${r.status === 'available' || r.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                            r.status === 'occupied' || r.status === 'Occupied' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 
                            'bg-slate-100 text-slate-600 border border-slate-200'}
                        `}>
                          {r.status || 'Available'}
                        </span>
                      </div>
                    </div>

                    {canManage ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => startEdit(r)} 
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-[#f0faf9] hover:bg-[#d3f1ec] text-teal-800 rounded-lg font-medium text-sm transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button 
                          onClick={() => remove(r.id)} 
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 text-slate-600 rounded-lg font-medium text-sm transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-slate-100 text-center">
                        <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                          </svg>
                          Read-only
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}