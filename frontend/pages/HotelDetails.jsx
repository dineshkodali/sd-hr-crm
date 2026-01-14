/* src/pages/HotelDetails.jsx */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";

/**
 * HotelDetails page
 */
export default function HotelDetails() {
  const { user } = useOutletContext() || {};
  const { id } = useParams();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // load hotel details
  const fetchHotel = async () => {
    try {
      const res = await axios.get(`/api/hotels/${id}`);
      setHotel(res.data || null);
    } catch (err) {
      console.error("Failed to load hotel:", err);
      setHotel(null);
    }
  };

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const res = await axios.get(`/api/hotels/${id}/rooms`);
      setRooms(res.data.rooms || []);
    } catch (err) {
      console.error("Failed to load rooms:", err);
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchHotel();
    fetchRooms();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // compute canManage using the same logic as RoomsManager
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

  const canManage = computeCanManage(user, hotel);

  const goToManage = () => {
    if (!hotel || !hotel.id) return;
    navigate(`/hotels/${hotel.id}/rooms`);
  };

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><div className="text-gray-600">Loading hotel...</div></div>;

  if (!hotel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
        <div className="w-[90%] max-w-[1800px] mx-auto">
          <div className="text-lg text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">Hotel not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        {/* UPDATED UI INDICATOR - VERY VISIBLE */}
        <div className="mb-6 bg-gradient-to-r from-green-500 via-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl shadow-2xl text-center animate-pulse">
          <div className="text-2xl font-bold mb-1">🎉 NEW UI IS ACTIVE! 🎉</div>
          <div className="text-sm">If you see this colorful banner, the changes are working! Please hard refresh (Ctrl+Shift+R)</div>
        </div>
        
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-base font-semibold text-gray-700 bg-white px-4 py-3 rounded-lg shadow-sm">
          <span className="text-purple-500">🏠</span>
          <button onClick={() => navigate('/hotels')} className="hover:text-purple-600 transition-colors">Hotels</button>
          <span className="text-purple-400">→</span>
          <span className="text-purple-600">{hotel.name}</span>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-xl border-2 border-purple-200 p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold mb-3 uppercase">Property Details</div>
              <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4 tracking-tight">{hotel.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                {hotel.city && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 shadow-sm">
                    <span className="text-lg">📍</span>
                    <span className="text-sm font-bold text-blue-700">{hotel.city}</span>
                  </div>
                )}
                {hotel.manager_name && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border-2 border-green-300 shadow-sm">
                    <span className="text-lg">👤</span>
                    <span className="text-sm text-green-700 font-bold">Manager: {hotel.manager_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Manage button visible when allowed */}
            <div className="flex items-center gap-2">
              {canManage ? (
                <button
                  onClick={goToManage}
                  className="px-8 py-3 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-xl text-base font-bold shadow-xl hover:shadow-2xl transition-all whitespace-nowrap transform hover:scale-105"
                >
                  🔧 Manage Rooms
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏨</span>
            <h3 className="text-3xl font-black text-gray-900">Available Rooms</h3>
            <span className="ml-auto bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-bold">{rooms.length} Rooms</span>
          </div>
          {roomsLoading ? (
            <div className="text-center text-gray-500 py-16">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600"></div>
              <p className="mt-4 text-xl font-bold text-purple-600">Loading rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🏨</div>
              <div className="text-xl text-gray-500 font-semibold">No rooms found for this hotel.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((r, idx) => (
                <div key={r.id} className="border-2 border-purple-200 rounded-2xl p-6 hover:shadow-2xl hover:border-purple-400 hover:scale-105 transition-all duration-300 bg-gradient-to-br from-white to-purple-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-2xl font-black text-purple-900">🚪 Room {r.room_number}</div>
                      <div className="text-base text-gray-700 mt-2 font-bold bg-gray-100 px-3 py-1 rounded-full inline-block">{r.type || 'Standard'}</div>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap border-2 shadow-md ${
                      (r.status || '').toLowerCase() === 'available' 
                        ? 'bg-gradient-to-r from-green-400 to-green-500 text-white border-green-600' 
                        : (r.status || '').toLowerCase() === 'occupied'
                        ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white border-orange-600'
                        : 'bg-gray-300 text-gray-700 border-gray-400'
                    }`}>
                      {r.status || 'Pending'}
                    </span>
                  </div>
                  <div className="pt-4 border-t-2 border-purple-200">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">₹{Number(r.rate || 0).toFixed(2)}</div>
                        <div className="text-xs text-gray-600 mt-1 font-bold">per night</div>
                      </div>
                      <div className="text-right bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                        <div className="text-xs uppercase tracking-wide text-purple-600 font-black">ID</div>
                        <div className="text-lg font-black text-purple-900">{r.id}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}