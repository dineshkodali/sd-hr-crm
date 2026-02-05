/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// File: src/components/AdminSidebar.jsx

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

// --- ICONS ---
const Icons = {
  Grid: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  Chart: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>,
  UserGroup: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Bulb: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 12 4a4.65 4.65 0 0 0-4.5 7.5c.76.76 1.23 1.52 1.41 2.5" /></svg>,
  Warning: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Shield: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  ShieldCheck: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 12 15 15 9" /></svg>,
  Building: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="9" y1="22" x2="9" y2="22.01" /><line x1="15" y1="22" x2="15" y2="22.01" /><line x1="12" y1="22" x2="12" y2="22.01" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="8" y1="6" x2="8" y2="6.01" /><line x1="16" y1="6" x2="16" y2="6.01" /><line x1="8" y1="10" x2="8" y2="10.01" /><line x1="16" y1="10" x2="16" y2="10.01" /><line x1="8" y1="14" x2="8" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /><line x1="8" y1="18" x2="8" y2="18.01" /><line x1="16" y1="18" x2="16" y2="18.01" /></svg>,
  Heart: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  AlertTriangle: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Users: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Building2: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21v-4a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v4" /><circle cx="9" cy="9" r="2" /><circle cx="15" cy="9" r="2" /></svg>,
  Dollar: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  Clipboard: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>,
  Wrench: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,

  // SU Data Icons
  BarChart: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  PieChart: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
  Clock: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Home: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  Utensils: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>,
  Upload: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  FileText: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  Calendar: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Network: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></svg>,

  SubItemDot: () => <span className="block w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
};

// Map route paths to module keys for permission checking
const routeToModuleMap = {
  "/": "dashboard",
  "/admin": "dashboard",
  "/manager": "dashboard",
  "/su/users": "su_data",
  "/su/analytics": "su_data",
  "/su/demographics": "su_data",
  "/su/accommodation": "su_data",
  "/su/move-in-out": "move_in_out",
  "/su/meals": "meals",
  "/su/reports": "su_data",
  "/su/ppar": "properties",
  "/hotels": "properties",
  "/admin/hotels": "properties",
  "/admin/org-chart": "properties",
  "/bookings": "properties",
  "/admin/bookings": "properties",
  "/admin/users": "employees",
  "/manager/users": "employees",
  "/manager/staff": "employees",
  "/admin/staff-grid": "employees",
  "/admin/staff-details": "employees",
  "/admin/inspections": "inspections",
  "/manager/inspections": "inspections",
  "/admin/incidents": "incidents",
  "/manager/incidents": "incidents",
  "/admin/complaints": "complaints",
  "/manager/complaints": "complaints",
  "/admin/compliance": "compliance",
  "/manager/compliance": "compliance",
  "/compliance": "compliance",
  "/admin/maintenance": "maintenance",
  "/manager/maintenance": "maintenance",
  "/admin/aire-tasks": "aire_tasks",
  "/manager/aire-tasks": "aire_tasks",
  "/admin/litigation": "litigation",
  "/manager/litigation": "litigation",
  "/admin/hse/incidents": "hse_incidents",
  "/manager/hse/incidents": "hse_incidents",
  "/admin/hse/risk-management": "hse_risk_management",
  "/manager/hse/risk-management": "hse_risk_management",
  "/admin/hse/training": "hse_training",
  "/manager/hse/training": "hse_training",
  "/admin/hse/audits": "hse_audits",
  "/manager/hse/audits": "hse_audits",
  "/admin/safeguarding/referrals": "safeguarding_referrals",
  "/manager/safeguarding/referrals": "safeguarding_referrals",
  "/admin/safeguarding/risk-assessments": "safeguarding_risk_assessments",
  "/manager/safeguarding/risk-assessments": "safeguarding_risk_assessments",
  "/admin/safeguarding/vulnerable-users": "vulnerable_users",
  "/manager/safeguarding/vulnerable-users": "vulnerable_users",
  "/admin/safeguarding/multi-agency": "multi_agency",
  "/manager/safeguarding/multi-agency": "multi_agency",
  "/admin/vcs-organisations": "vcs_organisations",
  "/manager/vcs-organisations": "vcs_organisations",
  "/admin/case-management": "case_management",
  "/manager/case-management": "case_management",
  "/admin/emergency-protocols": "emergency_protocols",
  "/manager/emergency-protocols": "emergency_protocols",
  "/admin/tickets": "tickets",
  "/tasks": "tasks",
  "/admin/hr-management": "hr_management",
  "/manager/hr-management": "hr_management",
  "/admin/holidays": "holidays",
  "/manager/holidays": "holidays",
  "/admin/attendance": "attendance",
  "/admin/timesheets": "timesheets",
  "/performance": "performance",
  "/training": "training",
  "/admin/overtime": "overtime",
  "/admin/payroll": "payroll",
  "/manager/payroll": "payroll",
  "/admin/forms": "forms",
  "/manager/forms": "forms",
  "/admin/forms/submissions": "forms",
  "/manager/forms/submissions": "forms",
  "/admin/settings/users": "manage_users",
  "/admin/reports/task": "reports",
  "/manager/reports/task": "reports",
  "/admin/reports/daily": "reports",
  "/manager/reports/daily": "reports",
};

export default function AdminSidebar(props) {
  const user = props?.user || {};
  const location = useLocation();
  // include search so paths with query params are considered active
  const cur = (location?.pathname || "") + (location?.search || "");
  const navigate = useNavigate();
  const [userPermissions, setUserPermissions] = useState({});
  const [showAccessMenu, setShowAccessMenu] = useState(localStorage.getItem('showAccessMenu') === 'true');

  useEffect(() => {
    const handleStorageChange = () => {
      setShowAccessMenu(localStorage.getItem('showAccessMenu') === 'true');
    };

    // Listen for custom event from Settings page
    window.addEventListener('accessMenuChanged', handleStorageChange);
    // Listen for cross-tab changes
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('accessMenuChanged', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Helper to get the correct path prefix based on user role
  const pathPrefix = user?.role === 'manager' ? '/manager' : '/admin';

  // Fetch user permissions
  useEffect(() => {
    if (user?.role === 'admin') {
      // Admins have full access, no need to fetch
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
    if (user?.role === 'admin') return true; // Admins have full access
    if (!path) return true; // Allow if no path specified

    const module = routeToModuleMap[path] || routeToModuleMap[path.split('?')[0]];
    if (!module) return true; // Allow if module not mapped (e.g., profile, settings)

    // If no permissions loaded yet, allow (will be filtered once loaded)
    if (Object.keys(userPermissions).length === 0 && user?.role !== 'admin') {
      return true; // Temporary allow until permissions load
    }

    const perm = userPermissions[module];
    return perm && perm.read === true;
  };

  // Filter menu items based on permissions
  const filterMenuItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    return items.filter(item => hasAccess(item.path));
  };

  // Menu Definition
  const menuStructure = [
    {
      id: "dashboard",
      icon: <Icons.Grid />,
      label: "Dashboards",
      items: [
        { path: "/", label: "Main Dashboard", icon: <Icons.Chart /> },
        { path: user?.role === 'admin' ? "/admin" : "/manager", label: "Widget Dashboard", icon: <Icons.Grid /> },
      ]
    },
    {
      id: "su_data",
      icon: <Icons.UserGroup />,
      label: "SU Data",
      items: [
        // --- Service Users List (Links to ServiceUsersList.jsx) ---
        { path: "/su/users", label: "Service Users", icon: <Icons.UserGroup /> },
        { path: "/su/analytics", label: "Analytics", icon: <Icons.BarChart /> },
        { path: "/su/accommodation", label: "Accommodation", icon: <Icons.Clock /> },
        { path: "/su/move-in-out", label: "Move-In/Out", icon: <Icons.Home /> },
        { path: "/su/meals", label: "Meals", icon: <Icons.Utensils /> },
      ]
    },
    {
      id: "company",
      icon: <Icons.Building />,
      label: "Property",
      items: [
        { path: user?.role === 'manager' ? "/hotels" : "/admin/hotels", label: "Properties", icon: <Icons.Building /> },
        { path: user?.role === 'manager' ? "/bookings" : "/admin/bookings", label: "Bookings", icon: <Icons.Calendar /> },
        { path: "/admin/org-chart", label: "Organization Chart", icon: <Icons.Network /> },
        { path: "/su/ppar", label: "PPAR Upload", icon: <Icons.Upload /> },
        { path: user?.role === 'manager' ? "/manager/users" : "/admin/users", label: "Employee List", icon: <Icons.UserGroup /> },
        { path: "/admin/staff-grid", label: "Staff Grid", icon: <Icons.Grid /> },
      ]
    },
    {
      id: "inspections",
      icon: <Icons.Clipboard />,
      label: "Operation Hub",
      items: [
        { path: `${pathPrefix}/inspections`, label: "Inspections", icon: <Icons.Clipboard /> },
        { path: `${pathPrefix}/incidents`, label: "Incidents", icon: <Icons.Warning /> },
        { path: `${pathPrefix}/complaints`, label: "Complaints", icon: <Icons.Warning /> },
        { path: `${pathPrefix}/compliance`, label: "Compliance", icon: <Icons.Shield /> },
        // maintenance item uses fallback paths logic in render
        { path: `${pathPrefix}/maintenance`, label: "Maintenance", icon: <Icons.Wrench /> },
        { path: `${pathPrefix}/aire-tasks`, label: "AIRE Tasks", icon: <Icons.Clipboard /> },
        { path: `${pathPrefix}/litigation`, label: "Litigation", icon: <Icons.Clipboard /> },
      ]
    },
    {
      id: "hse",
      icon: <Icons.Warning />,
      label: "HSE",
      items: [
        { path: `${pathPrefix}/hse/incidents`, label: "HSE Incidents", icon: <Icons.Warning /> },
        { path: `${pathPrefix}/hse/risk-management`, label: "Risk Management", icon: <Icons.AlertTriangle /> },
        { path: `${pathPrefix}/hse/training`, label: "Training", icon: <Icons.Clipboard /> },
        { path: `${pathPrefix}/hse/audits`, label: "Audits", icon: <Icons.Clipboard /> },
      ]
    },
    {
      id: "safeguarding",
      icon: <Icons.ShieldCheck />,
      label: "Safeguarding",
      items: [
        { path: `${pathPrefix}/safeguarding/referrals`, label: "Referrals", icon: <Icons.Users /> },
        { path: `${pathPrefix}/safeguarding/risk-assessments`, label: "Risk Assessment", icon: <Icons.AlertTriangle /> },
        { path: `${pathPrefix}/safeguarding/vulnerable-users`, label: "Vulnerable Users", icon: <Icons.Heart /> },
        { path: `${pathPrefix}/safeguarding/multi-agency`, label: "Multi-Agency", icon: <Icons.Building2 /> },
      ]
    },
    {
      id: "escalations",
      icon: <Icons.AlertTriangle />,
      label: "Escalations",
      items: [
        { path: `${pathPrefix}/vcs-organisations`, label: "VCS Organisations", icon: <Icons.Building /> },
        { path: `${pathPrefix}/case-management`, label: "Case Management", icon: <Icons.Clipboard /> },
        { path: `${pathPrefix}/emergency-protocols`, label: "Emergency Protocols", icon: <Icons.AlertTriangle /> },
      ]
    },
    // TEMPORARILY HIDDEN - Projects Section
    // {
    //   id: "projects",
    //   icon: <Icons.Bulb />,
    //   label: "Projects",
    //   items: [
    //     { path: `${pathPrefix}/reports/task`, label: "Task Report", icon: <Icons.SubItemDot /> },
    //     { path: `${pathPrefix}/reports/daily`, label: "Daily Report", icon: <Icons.SubItemDot /> },
    //     { path: "/admin/tickets", label: "Tickets", icon: <Icons.Warning /> },
    //     { path: "/tasks", label: "My Tasks", icon: <Icons.SubItemDot /> },
    //   ]
    // },
    // TEMPORARILY HIDDEN - HR Section
    // {
    //   id: "hr",
    //   icon: <Icons.UserGroup />,
    //   label: "HR",
    //   items: [
    //     { path: `${pathPrefix}/hr-management`, label: "HR Management", icon: <Icons.SubItemDot /> },
    //     { path: user?.role === 'manager' ? "/manager/holidays" : "/admin/holidays", label: "Holidays", icon: <Icons.SubItemDot /> },
    //     { path: "/admin/attendance", label: "Attendance", icon: <Icons.SubItemDot /> },
    //     { path: "/admin/timesheets", label: "Timesheets", icon: <Icons.SubItemDot /> },
    //     { path: "/performance", label: "Performance", icon: <Icons.Chart /> },
    //     { path: "/training", label: "Training", icon: <Icons.SubItemDot /> },
    //   ]
    // },
    // TEMPORARILY HIDDEN - Finance Section
    // {
    //   id: "finance",
    //   icon: <Icons.Dollar />,
    //   label: "Finance",
    //   items: [
    //      { path: "/admin/overtime", label: "Overtime", icon: <Icons.SubItemDot /> },
    //      { path: user?.role === 'manager' ? "/manager/payroll" : "/admin/payroll", label: "Payroll", icon: <Icons.SubItemDot /> },
    //   ]
    // },
    {
      id: "forms",
      icon: <Icons.FileText />,
      label: "Forms",
      items: [
        { path: `${pathPrefix}/forms`, label: "Form Builder", icon: <Icons.FileText /> },
        { path: `${pathPrefix}/forms/submissions`, label: "Submissions", icon: <Icons.Clipboard /> },
      ]
    },
    // Access Management (Admin Only)
    ...(user?.role === 'admin' && showAccessMenu ? [{
      id: "access",
      icon: <Icons.ShieldCheck />,
      label: "Access",
      items: [
        { path: "/admin/access", label: "User Access Control", icon: <Icons.ShieldCheck /> },
        { path: "/admin/reports", label: "Reports", icon: <Icons.Chart /> },
      ]
    }] : []),
    {
      id: "system",
      icon: <Icons.Shield />,
      label: "System",
      items: [
        { path: "/profile", label: "Profile", icon: <Icons.User /> },
        { path: "/notifications", label: "Notifications", icon: <Icons.Bell /> },
        ...(user?.role === 'admin' ? [{ path: "/admin/settings/users", label: "User Management", icon: <Icons.UserGroup /> }] : []),
        { path: "/admin/settings", label: "Settings", icon: <Icons.Settings /> },
      ]
    },
  ];

  // State defaults to null (CLOSED)
  const [activeCategory, setActiveCategory] = useState(null);

  // Toggle Logic
  const handleToggle = (id) => {
    if (activeCategory === id) setActiveCategory(null);
    else setActiveCategory(id);
  };

  const isCategoryRouteActive = (items) => {
    if (!Array.isArray(items)) return false;
    return items.some(item => item && item.path && (cur === item.path || (item.path !== '/' && cur.startsWith(item.path))));
  };

  const getSubLinkClass = (path) => {
    const isActive = cur === path || (path !== "/" && cur.startsWith(path));
    return isActive
      ? "text-[#10b981] font-bold bg-[#10b981]/10"
      : "text-gray-600 font-medium hover:text-black hover:bg-black/5 hover:font-bold";
  };

  // Generic fallback navigator: try multiple candidate paths and stop when router matches one.
  const tryNavigateWithFallbacks = async (candidates = []) => {
    const list = Array.from(new Set((candidates || []).filter(Boolean)));

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      try {
        navigate(p);
      } catch (e) {
        try { window.location.href = p; } catch (_) { }
      }
      await new Promise((res) => setTimeout(res, 120));
      const current = window.location.pathname || "";
      if (current === p || (p !== "/" && current.startsWith(p))) {
        setTimeout(() => setActiveCategory(null), 80);
        return;
      }
    }
    setTimeout(() => setActiveCategory(null), 80);
  };

  return (
    <div className="flex h-full relative z-40 admin-sidebar" style={{ backgroundColor: '#ffffff' }}>

      {/* ICON RAIL */}
      <div className="w-[80px] border-r border-gray-200 flex flex-col items-center py-3 z-50 shrink-0 h-full" style={{ backgroundColor: '#ffffff' }}>
        <div className="flex flex-col gap-2 w-full items-center">
          {menuStructure.map((cat) => {
            const isOpen = activeCategory === cat.id;
            const isContextActive = isCategoryRouteActive(cat.items);

            return (
              <button
                key={cat.id}
                onClick={() => handleToggle(cat.id)}
                title={cat.label}
                className="relative group focus:outline-none"
              >
                {(isOpen || isContextActive) && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#00ffd9] rounded-full border-2 border-white translate-x-1 -translate-y-1 z-10"></span>
                )}

                <div
                  className={`
                    w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                    ${isOpen ? "bg-[#00ffd9]/10 text-[#00ffd9] shadow-sm ring-1 ring-[#00ffd9]/20" : isContextActive ? "text-[#00ffd9] bg-gray-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}
                  `}
                >
                  {cat.icon}
                </div>

                {!activeCategory && (
                  <div className="absolute left-full ml-3 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {cat.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SLIDE-OUT PANEL */}
      <div className={`border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${activeCategory ? "w-64 opacity-100" : "w-0 opacity-0"}`} style={{ backgroundColor: '#ffffff' }}>
        <div className="w-64 flex flex-col h-full">
          <div className="h-[70px] flex items-center px-6 border-b border-gray-50 shrink-0">
            <h2 className="text-lg font-bold text-slate-800 truncate">
              {menuStructure.find(m => m.id === activeCategory)?.label || "Menu"}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
            {(() => {
              const menu = menuStructure.find(m => m.id === activeCategory);
              if (!menu || !Array.isArray(menu.items)) return <div className="text-xs text-gray-400">No items</div>;

              // Filter items based on permissions
              const filteredItems = filterMenuItems(menu.items);
              if (filteredItems.length === 0) return <div className="text-xs text-gray-400">No accessible items</div>;

              return filteredItems.map((item, idx) => {
                const lowerLabel = (item.label || "").toLowerCase();
                const lowerPath = (item.path || "").toLowerCase();

                const isMaintenance =
                  lowerLabel.includes("maintenance") || lowerPath.includes("maintenance");

                const isCompliance =
                  lowerLabel.includes("compliance") || lowerPath.includes("compliance");

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (isMaintenance) {
                        const fallbacks = [
                          item.path,
                          "/admin/maintenance",
                          "/maintenance",
                          "/ops/maintenance",
                          "/maintenance-page",
                          "/admin/ops/maintenance"
                        ];
                        tryNavigateWithFallbacks(fallbacks);
                        return;
                      }

                      if (isCompliance) {
                        const fallbacks = [
                          item.path,
                          "/admin/compliance",
                          "/compliance",
                          "/property/compliance",
                          "/admin/property/compliance"
                        ];
                        tryNavigateWithFallbacks(fallbacks);
                        return;
                      }

                      // Default Nav
                      try {
                        navigate(item.path);
                      } catch (e) {
                        try { window.location.href = item.path; } catch (_) { }
                      }
                      setTimeout(() => setActiveCategory(null), 80);
                    }}
                    className={`flex items-center px-3 py-3 rounded-lg text-sm transition-colors mb-1 whitespace-nowrap ${getSubLinkClass(item.path)}`}
                  >
                    <span className="mr-3 shrink-0 opacity-80">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              });
            })()}
          </div>

          <div className="p-4 border-t border-gray-50 text-xs text-gray-400 shrink-0">
            © 2025 SD Commercial
          </div>
        </div>
      </div>
    </div>
  );
}