import React, { useEffect, useState } from "react";
import axios from "axios";

// Extract all modules from sidebar - these are the pages that need access control
const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "su_data", label: "SU Data" },
  { key: "properties", label: "Properties" },
  { key: "employees", label: "Employees" },
  { key: "inspections", label: "Inspections" },
  { key: "incidents", label: "Incidents" },
  { key: "complaints", label: "Complaints" },
  { key: "compliance", label: "Compliance" },
  { key: "maintenance", label: "Maintenance" },
  { key: "aire_tasks", label: "AIRE Tasks" },
  { key: "litigation", label: "Litigation" },
  { key: "hse_incidents", label: "HSE Incidents" },
  { key: "hse_risk_management", label: "HSE Risk Management" },
  { key: "hse_training", label: "HSE Training" },
  { key: "hse_audits", label: "HSE Audits" },
  { key: "safeguarding_referrals", label: "Safeguarding Referrals" },
  { key: "safeguarding_risk_assessments", label: "Risk Assessments" },
  { key: "vulnerable_users", label: "Vulnerable Users" },
  { key: "multi_agency", label: "Multi-Agency" },
  { key: "vcs_organisations", label: "VCS Organisations" },
  { key: "case_management", label: "Case Management" },
  { key: "emergency_protocols", label: "Emergency Protocols" },
  { key: "tickets", label: "Tickets" },
  { key: "tasks", label: "Tasks" },
  { key: "hr_management", label: "HR Management" },
  { key: "holidays", label: "Holidays" },
  { key: "attendance", label: "Attendance" },
  { key: "timesheets", label: "Timesheets" },
  { key: "performance", label: "Performance" },
  { key: "training", label: "Training" },
  { key: "payroll", label: "Payroll" },
  { key: "overtime", label: "Overtime" },
  { key: "forms", label: "Forms" },
  { key: "reports", label: "Reports" },
];

export default function AccessManagement() {
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localPermissions, setLocalPermissions] = useState({});

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get("/api/access", {
          signal: controller.signal,
          withCredentials: true
        });
        if (mounted && res?.data) {
          setUsers(res.data.users || []);
          const perms = res.data.permissions || {};
          setPermissions(perms);
          setLocalPermissions(JSON.parse(JSON.stringify(perms))); // Deep copy for local editing
        }
      } catch (err) {
        if (mounted && !controller.signal.aborted) {
          setError(err.response?.data?.message || "Failed to load access data");
          console.error("Error loading access data:", err);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const handlePermissionChange = (userId, module, permissionType, value) => {
    const userPerms = localPermissions[userId] || {};
    const modulePerms = userPerms[module] || { read: false, create: false, update: false, delete: false };
    const newPerms = { ...modulePerms, [permissionType]: !!value };

    setLocalPermissions({
      ...localPermissions,
      [userId]: {
        ...userPerms,
        [module]: newPerms,
      },
    });
  };

  const handleSaveAll = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const userPerms = localPermissions[selectedUser.id] || {};
      // Only include modules with at least one permission set to true
      const modules = Object.keys(userPerms).filter((module) => {
        const perms = userPerms[module] || {};
        return perms.read || perms.create || perms.update || perms.delete;
      });

      if (modules.length === 0) {
        // Nothing to save
        alert("No permissions to save for this user.");
        setSaving(false);
        return;
      }

      const promises = modules.map((module) => {
        const modulePerms = userPerms[module] || { read: false, create: false, update: false, delete: false };
        return axios.post(
          "/api/access",
          {
            user_id: selectedUser.id,
            module: module,
            can_read: !!modulePerms.read,
            can_create: !!modulePerms.create,
            can_update: !!modulePerms.update,
            can_delete: !!modulePerms.delete,
          },
          { withCredentials: true }
        );
      });

      // Use allSettled so one failing module doesn't cause the whole save to be reported as failed
      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected');

      if (rejected.length === 0) {
        // All succeeded - update permissions state to match local edits
        setPermissions(JSON.parse(JSON.stringify(localPermissions)));
        alert("Permissions saved successfully!");
      } else {
        console.error("Some permissions failed to save:", rejected);

        // Merge successful updates into permissions state so the saved ones reflect backend
        const newPermissions = JSON.parse(JSON.stringify(permissions || {}));
        results.forEach((res, idx) => {
          const mod = modules[idx];
          if (res.status === 'fulfilled') {
            if (!newPermissions[selectedUser.id]) newPermissions[selectedUser.id] = {};
            newPermissions[selectedUser.id][mod] = userPerms[mod];
          }
        });
        setPermissions(newPermissions);

        if (rejected.length === modules.length) {
          alert("Failed to save permissions. Please try again.");
        } else {
          alert(`${rejected.length} permission(s) failed to save. Successfully saved the rest.`);
        }
      }
    } catch (err) {
      console.error("Error saving permissions:", err);
      alert(err?.response?.data?.message || err?.message || "Failed to save permissions. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset local permissions to match saved permissions
    setLocalPermissions(JSON.parse(JSON.stringify(permissions)));
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const userPermissions = selectedUser ? (localPermissions[selectedUser.id] || {}) : {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">User Access Control</h2>
        <p className="text-gray-600">Manage module permissions for each user</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Users</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {users.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No users found
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        // Initialize local permissions for this user
                        const userPerms = permissions[user.id] || {};
                        setLocalPermissions({
                          ...localPermissions,
                          [user.id]: userPerms
                        });
                      }}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedUser?.id === user.id ? "bg-orange-50 border-l-4 border-orange-500" : ""
                      }`}
                    >
                      <div className="font-semibold text-gray-800">{user.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{user.email}</div>
                      <div className="text-xs text-gray-400 mt-1 capitalize">{user.role}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Permissions Panel */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Edit User Permissions</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedUser.name} ({selectedUser.email})</p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Module Permissions */}
              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Module Permissions</h4>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {MODULES.map((module) => {
                    const modulePerms = userPermissions[module.key] || { read: false, create: false, update: false, delete: false };
                    const flags = [];
                    if (modulePerms.read) flags.push('Read');
                    if (modulePerms.create) flags.push('Create');
                    if (modulePerms.update) flags.push('Update');
                    if (modulePerms.delete) flags.push('Delete');
                    const permissionLevel = flags.length ? flags.join(' + ') : 'None';

                    return (
                      <div key={module.key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-700">{module.label}</div>
                          <div className="text-xs text-gray-500">{permissionLevel}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modulePerms.read}
                              onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'read', e.target.checked)}
                              className="form-checkbox h-4 w-4 text-orange-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Read</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modulePerms.create}
                              onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'create', e.target.checked)}
                              className="form-checkbox h-4 w-4 text-orange-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Create</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modulePerms.update}
                              onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'update', e.target.checked)}
                              className="form-checkbox h-4 w-4 text-orange-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Update</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modulePerms.delete}
                              onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'delete', e.target.checked)}
                              className="form-checkbox h-4 w-4 text-orange-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Delete</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-gray-200">
                <div className="flex justify-end gap-4">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAll}
                    disabled={saving}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      saving ? "bg-orange-600 text-white cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600"
                    }`}
                  >
                    {saving && (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4zm16 0a8 8 0 01-8 8v-8h8z" />
                      </svg>
                    )}
                    Save Permissions
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-sm">Select a user to edit permissions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
