/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/ManagerDashboard.jsx */
/* Manager dashboard that reuses the Admin dashboard UI, but is scoped to manager’s branch */

import React, { useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import AdminDashboard from "./AdminDashboard";

export default function ManagerDashboard({ user: userProp }) {
  // load manager user
  const [user] = useState(() => {
    if (userProp) return userProp;
    try {
      const raw = localStorage.getItem("user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  });

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* SAME SIDEBAR AS ADMIN */}
      <AdminSidebar user={user} />

      <main className="flex-1 p-6">
        {/* FULL ADMIN DASHBOARD UI (all cards, all KPIs, charts, attendance, etc.) */}
        <AdminDashboard userProp={user} />
      </main>
    </div>
  );
}
