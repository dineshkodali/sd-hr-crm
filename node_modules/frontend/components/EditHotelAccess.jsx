// src/components/EditHotelAccess.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

// ensure cookies are sent (if using auth cookies)
axios.defaults.withCredentials = true;

export default function EditHotelAccess({ hotelId, initialAccessUserIds = [], branches = [], managers = [] }) {
  const [visibility, setVisibility] = useState("private"); // "public", "private", "select"
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [staff, setStaff] = useState([]); // fetched staff list
  const [selectedUsers, setSelectedUsers] = useState(new Set(initialAccessUserIds));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // helper: fetch staff by branch or manager
  async function fetchStaffByBranch(branchId) {
    if (!branchId) {
      setStaff([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/staff/branch/${branchId}`);
      setStaff(res.data || []);
    } catch (err) {
      console.error(err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaffByManager(managerId) {
    if (!managerId) {
      setStaff([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/staff/manager/${managerId}`);
      setStaff(res.data || []);
    } catch (err) {
      console.error(err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  // effect: when branch changes, clear manager and fetch
  useEffect(() => {
    if (selectedBranch) {
      setSelectedManager("");
      fetchStaffByBranch(selectedBranch);
    } else {
      setStaff([]);
    }
  }, [selectedBranch]);

  // effect: when manager changes, clear branch and fetch
  useEffect(() => {
    if (selectedManager) {
      setSelectedBranch("");
      fetchStaffByManager(selectedManager);
    } else {
      // if no manager and no branch, clear
      if (!selectedBranch) setStaff([]);
    }
  }, [selectedManager]);

  // toggle selection
  function toggleUser(userId) {
    setSelectedUsers(prev => {
      const copy = new Set(prev);
      if (copy.has(userId)) copy.delete(userId); else copy.add(userId);
      return copy;
    });
  }

  // confirm/save selected users for the hotel
  async function handleConfirm() {
    setSaving(true);
    setMessage("");
    try {
      const allowedUserIds = Array.from(selectedUsers);
      await axios.put(`/api/hotels/${hotelId}/access`, { allowedUserIds });
      setMessage("Access updated.");
    } catch (err) {
      console.error(err);
      setMessage("Failed to update access.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-3">Visibility</h3>
      <div className="space-y-2">
        <label className="flex items-center space-x-2">
          <input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} />
          <span>Public</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="radio" name="visibility" value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} />
          <span>Private</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="radio" name="visibility" value="select" checked={visibility === "select"} onChange={() => setVisibility("select")} />
          <span>Select People</span>
        </label>
      </div>

      {visibility === "select" && (
        <div className="mt-4 border p-4 bg-gray-50 rounded">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Filter by Branch</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="mt-1 block w-full border rounded p-2">
                <option value="">-- select branch --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Or filter by Manager</label>
              <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} className="mt-1 block w-full border rounded p-2">
                <option value="">-- select manager --</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.branch_name || ""})</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div>Loading staff...</div>
            ) : staff.length === 0 ? (
              <div className="p-6 bg-white rounded text-gray-500">No users available to select.</div>
            ) : (
              <div className="max-h-64 overflow-auto border rounded p-2 bg-white">
                {staff.map(u => (
                  <label key={u.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center space-x-2">
            <button className="px-4 py-2 bg-orange-600 text-white rounded" onClick={handleConfirm} disabled={saving}>
              {saving ? "Saving..." : "Confirm"}
            </button>
            <span className="text-sm text-gray-600">{message}</span>
          </div>
        </div>
      )}

      {/* Status select shown in your screenshot */}
      <div className="mt-4">
        <label className="block text-sm font-medium">Status</label>
        <select className="mt-1 block w-full border rounded p-2">
          <option value="">Select</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );
}
