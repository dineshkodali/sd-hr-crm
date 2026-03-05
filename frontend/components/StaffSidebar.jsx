// src/components/StaffSidebar.jsx
import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import axios from "axios";

// Map route paths to module keys for permission checking
const staffRouteToModuleMap = {
  "/staff": "dashboard",
  "/home": "dashboard",
  "/staff/tasks": "tasks",
  "/staff/leaves": "holidays",
  "/staff/attendance": "attendance",
  "/staff/rooms": "properties",
  "/staff/notifications": "dashboard",
  "/staff/hotels": "properties",
  "/staff/profile": "dashboard", // Profile is always accessible
};

/**
 * Lightweight Staff / Manager sidebar without external icon deps.
 * Keeps visual parity with AdminSidebar but avoids lucide-react package.
 */

export default function StaffSidebar({ user = {} }) {
  const [userPermissions, setUserPermissions] = useState({});
  const activeClass =
    "bg-indigo-50 text-indigo-700 rounded-l-2xl px-3 py-2 flex items-center gap-3";
  const baseClass =
    "text-sm text-slate-600 hover:text-indigo-700 px-3 py-2 flex items-center gap-3";

  // Fetch user permissions
  useEffect(() => {
    if (user?.role === 'admin') {
      setUserPermissions({});
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    async function loadPermissions() {
      try {
        const res = await axios.get("/api/access/me", {
          signal: controller.signal,
          withCredentials: true
        });
        if (mounted && res?.data?.permissions) {
          setUserPermissions(res.data.permissions);
        }
      } catch (err) {
        if (mounted && !controller.signal.aborted) {
          console.error("Error loading permissions:", err);
        }
      }
    }

    loadPermissions();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [user?.role, user?.id]);

  // Check if user has access to a route
  const hasAccess = (path) => {
    if (user?.role === 'admin') return true;
    if (!path) return true;
    
    const module = staffRouteToModuleMap[path];
    if (!module) return true; // Allow if module not mapped (e.g., profile)
    
    // If no permissions loaded yet, allow (will be filtered once loaded)
    if (Object.keys(userPermissions).length === 0 && user?.role !== 'admin') {
      return true; // Temporary allow until permissions load
    }
    
    const perm = userPermissions[module];
    return perm && perm.read === true;
  };

  const allLinks = [
    { to: "/staff", name: "Dashboard", svg: "home" },
    { to: "/home", name: "Home", svg: "home" },
    { to: "/staff/tasks", name: "Tasks", svg: "list" },
    { to: "/staff/leaves", name: "Leaves", svg: "calendar" },
    { to: "/staff/attendance", name: "Attendance", svg: "clock" },
    { to: "/staff/rooms", name: "Rooms", svg: "bed" },
    { to: "/staff/notifications", name: "Notifications", svg: "bell" },
    { to: "/staff/hotels", name: "Hotels", svg: "building" },
    { to: "/staff/profile", name: "My Profile", svg: "user" },
  ];

  // Filter links based on permissions
  const links = allLinks.filter(link => hasAccess(link.to));

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")
    : "S";

  const Icon = ({ name }) => {
    switch (name) {
      case "home":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V11.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "list":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "calendar":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M16 3v4M8 3v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "clock":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" />
            <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "bed":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 7h18v8H3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 15v4M17 15v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "bell":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 17h5l-1.403-1.403A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "building":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 21V3h10v18H3zM21 21V7h-6v14h6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "user":
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
    }
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r">
      {/* TOP USER BLOCK */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
            {initials}
          </div>
          <div>
            <div className="text-sm font-medium">{user?.name || "Staff Member"}</div>
            <div className="text-xs text-slate-400">Staff Panel</div>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="p-3 space-y-1">
        <div className="text-xs text-slate-400 px-3 pb-2">MAIN</div>

        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) => (isActive ? activeClass : baseClass)}
          >
            <Icon name={l.svg} />
            <span>{l.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* FOOTER */}
      <div className="mt-auto p-4 border-t">
        <div className="text-xs text-slate-400">Need help?</div>
        <a href="/support" className="mt-2 inline-block text-sm text-indigo-600">
          Contact IT
        </a>
      </div>
    </aside>
  );
}
