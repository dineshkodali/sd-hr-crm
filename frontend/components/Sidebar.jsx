// src/components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";

/**
 * user: { id, name, role, branchId, ... }
 * role: 'admin' | 'manager' | 'staff' ...
 */
export default function Sidebar({ user }) {
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  // For manager, prefer manager-scoped routes
  const link = (to, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "block px-4 py-2 rounded hover:bg-slate-100 " + (isActive ? "bg-slate-100 font-semibold" : "")
      }
    >
      {label}
    </NavLink>
  );

  return (
    <aside className="w-64 bg-white border-r min-h-screen p-4">
      <div className="mb-6">
        <div className="font-semibold">{user?.name || "User"}</div>
        <div className="text-xs text-slate-500">{user?.role || ""}{user?.branch ? ` — Branch ${user.branch}` : ""}</div>
      </div>

      <nav className="space-y-1 text-sm">
        {link("/dashboard", "Dashboard")}

        {/* Manager-friendly routing */}
        {isManager
          ? link(`/hotels`, "Hotels (My Hotels)")  // Hotels page will be filtered by backend for manager
          : link("/hotels", "Hotels")}

        {isManager
          ? link(`/manager/staff`, "Staff (My Hotels)")
          : link("/staff", "Staff")}

        {isManager
          ? link(`/manager`, "Rooms (My Hotels)")
          : link("/rooms", "Rooms")}

        {/* Tasks and Reports (managers can also have these in branch scope) */}
        {isManager ? link(`/manager/staff`, "Staff Management") : link("/tasks", "Tasks")}
        {link("/reports", "Reports")}

        {/* Admin-only area */}
        {isAdmin && (
          <>
            <div className="mt-4 text-xs text-slate-400 px-4">Admin</div>
            {link("/admin/users", "User Management")}
            {link("/admin/settings", "Settings")}
          </>
        )}
      </nav>
    </aside>
  );
}
