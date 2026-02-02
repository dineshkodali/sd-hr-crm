// ManagerStaff.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ManagerStaff() {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [assigning, setAssigning] = useState(null); // { staffName, currentHotelName }
  const [selectedHotelName, setSelectedHotelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Ensure axios sends cookies in dev. If you already set global axios.defaults.withCredentials = true, this still works.
  axios.defaults.withCredentials = true;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/manager/staff");
      // server returns { hotels: [...], staff: [...] }
      setHotels(res.data.hotels || []);
      setStaffList(res.data.staff || []);
    } catch (err) {
      console.error("Failed to load manager staff data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAssignModal = (staff) => {
    setAssigning({ staffName: staff.name, currentHotelName: staff.hotel_name || staff.assigned_hotel_name || null });
    // default selected hotel to first manager hotel or current hotel
    setSelectedHotelName(staff.hotel_name || (hotels[0] && hotels[0].name) || "");
    setError(null);
  };

  const closeAssignModal = () => {
    setAssigning(null);
    setSelectedHotelName("");
    setError(null);
  };

  const doAssign = async () => {
    if (!assigning || !assigning.staffName) return;
    if (!selectedHotelName) {
      setError("Please select a hotel");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = {
        staff_name: assigning.staffName,
        hotel_name: selectedHotelName,
      };

      // Use Authorization header or cookie depending on your auth setup.
      // axios has withCredentials true above; if you prefer Authorization header, set it here.
      const res = await axios.put("/api/manager/assign-staff", payload, { withCredentials: true });

      if (res.data && res.data.message) {
        // success -> refresh staff list
        await fetchData();
        closeAssignModal();
      } else {
        setError("Unexpected response from server");
      }
    } catch (err) {
      console.error("Assign failed:", err);
      const msg = err?.response?.data?.message || err.message || "Assign failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading manager data...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Manage Staff</h1>

      <div className="space-y-4">
        {staffList.length === 0 ? (
          <div className="text-gray-600">No staff found.</div>
        ) : (
          staffList.map((s) => (
            <div key={s.id} className="border rounded p-4 flex justify-between items-center">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-sm text-gray-600">{s.email}</div>
                <div className="text-sm text-gray-500 mt-2">
                  Assigned Hotel:{" "}
                  <span className="font-medium">{s.hotel_name || s.hotel || s.hotel_id ? (s.hotel_name || s.hotel || s.hotel_id) : "No hotel assigned"}</span>
                </div>
              </div>
              <div>
                <button
                  onClick={() => openAssignModal(s)}
                  className="px-4 py-2 bg-green-600 text-white rounded shadow"
                >
                  Assign
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Assign modal */}
      {assigning && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40"
          onClick={closeAssignModal}
        >
          <div
            className="bg-white rounded shadow-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-3">Assign hotel to: {assigning.staffName}</h2>

            <label className="block text-sm mb-2">Select Hotel (by name)</label>
            <select
              value={selectedHotelName}
              onChange={(e) => setSelectedHotelName(e.target.value)}
              className="w-full border p-2 rounded mb-3"
            >
              <option value="">-- select hotel --</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>

            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

            <div className="flex gap-3 justify-end">
              <button onClick={closeAssignModal} className="px-3 py-2 border rounded">Cancel</button>
              <button
                onClick={doAssign}
                className="px-3 py-2 bg-blue-600 text-white rounded"
                disabled={busy}
              >
                {busy ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
