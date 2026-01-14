import React from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ user, children }) {
  return (
    // Changed to h-full to fit inside the App.jsx flex container
    <div className="flex h-full bg-[#f8f9fa]">
      
      {/* Sidebar Container - Fixed width handled by Sidebar component */}
      <div className="shrink-0 h-full z-10">
        <AdminSidebar user={user} />
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 h-full overflow-y-auto p-6 custom-scrollbar relative z-0">
        {children ? children : <Outlet context={{ user }} />}
      </main>
      
    </div>
  );
}