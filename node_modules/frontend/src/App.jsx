/* eslint-disable no-unused-vars */
/* src/App.jsx */

import React, { Component, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import axios from "axios";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";
import UserManagement from "./pages/UserManagement";
import Navbar from "../pages/Navbar";
import AdminDashboard from "../pages/AdminDashboard";
import ManagerDashboard from "../pages/ManagerDashboard";
import StaffDashboard from "../pages/StaffDashboard";
import HotelsList from "../pages/HotelsList";
import HotelDetails from "../pages/HotelDetails";
import RoomsManager from "../pages/RoomsManager";
import RoomDetails from "../pages/RoomDetails";
import Notifications from "../pages/Notifications";

import AdminAddMember from "../pages/AdminAddMember";
import Profile from "../pages/Profile";
import Activity from "../pages/Activity";
import Users from "../pages/Users";
import ServiceUsers from "../pages/ServiceUsersList";
import ServiceUserProfile from "../pages/ServiceUserProfile";
import ServiceUserAnalytics from "../pages/ServiceUserAnalytics";
import MoveInOut from "../pages/MoveInOut";
import MealManagement from "../pages/MealManagement";
import PparUpload from "../pages/PparUpload";

import StaffRooms from "../pages/StaffRooms";
import ManagerStaff from "../pages/ManagerStaff";
import StaffGrid from "../pages/StaffGrid";

import AdminLayout from "../components/AdminLayout";
import UserReport from "../pages/UserReport";

import MaintenancePage from "../pages/MaintenancePage";
import Compliance from "../pages/Compliance";
import Inspections from "../pages/Inspections";
import Incidents from "../pages/Incidents";
import AIRETasks from "../pages/AIRETasks";
import Litigation from "../pages/Litigation";
import Forms from "../pages/Forms";
import FormView from "../pages/FormView";
import FormSubmissions from "../pages/FormSubmissions";
import SafeguardingReferrals from "../pages/SafeguardingReferrals";
import RiskAssessments from "../pages/RiskAssessments";
import VulnerableUsers from "../pages/VulnerableUsers";
import MultiAgency from "../pages/MultiAgency";
import HSEIncidents from "../pages/HSEIncidents";
import HSERiskManagement from "../pages/HSERiskManagement";
import HSETraining from "../pages/HSETraining";
import HSEAudits from "../pages/HSEAudits";
import Complaints from "../pages/Complaints";
import VCSOrganisations from "../pages/VCSOrganisations";
import CaseManagement from "../pages/CaseManagement";
import EmergencyProtocols from "../pages/EmergencyProtocols";
import EmployeeTraining from "../pages/EmployeeTraining";
import AccessManagement from "../pages/AccessManagement";
import Settings from "../pages/Settings";
import Bookings from "../pages/Bookings";
import OrganizationChart from "../pages/OrganizationChart";

import { applyTheme, applyCustomTheme } from "./utils/themeUtils";

import "./index.css";

axios.defaults.withCredentials = true;

function ThemeBootstrap() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("appTheme") || "lighter";
    if (savedTheme === "custom") {
      const savedColor = localStorage.getItem("customThemeColor") || "#3deedd";
      applyCustomTheme(savedColor);
      return;
    }
    applyTheme(savedTheme);
  }, []);
  return null;
}

// Safe fallback helper
function makeSafe(ComponentImport, name = "Page") {
  if (ComponentImport && (typeof ComponentImport === "function" || typeof ComponentImport === "object")) {
    return ComponentImport;
  }
  return function Missing() {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">{name} not found</h2>
        <p className="text-sm text-gray-600">
          The <strong>{name}</strong> component is missing or failed to load.
        </p>
      </div>
    );
  };
}
const AdminAddMemberSafe = makeSafe(AdminAddMember, "AdminAddMember");
const ProfileSafe = makeSafe(Profile, "Profile");
const ActivitySafe = makeSafe(Activity, "Activity");
const UsersSafe = makeSafe(Users, "Users"); // admin/employee users
const ServiceUsersSafe = makeSafe(ServiceUsers, "ServiceUsers"); // service users
const ServiceUserProfileSafe = makeSafe(ServiceUserProfile, "ServiceUserProfile");
const ServiceUserAnalyticsSafe = makeSafe(ServiceUserAnalytics, "ServiceUserAnalytics");
const HotelsListSafe = makeSafe(HotelsList, "HotelsList");
const HotelDetailsSafe = makeSafe(HotelDetails, "HotelDetails");
const RoomsManagerSafe = makeSafe(RoomsManager, "RoomsManager");
const RoomDetailsSafe = makeSafe(RoomDetails, "RoomDetails");
const HomeSafe = makeSafe(Home, "Home");
const LoginSafe = makeSafe(Login, "Login");
const RegisterSafe = makeSafe(Register, "Register");
const NavbarSafe = makeSafe(Navbar, "Navbar");
const NotificationsSafe = makeSafe(Notifications, "Notifications");
const StaffRoomsSafe = makeSafe(StaffRooms, "StaffRooms");

const AdminDashboardSafe = makeSafe(AdminDashboard, "AdminDashboard");
const ManagerDashboardSafe = makeSafe(ManagerDashboard, "ManagerDashboard");
const StaffDashboardSafe = makeSafe(StaffDashboard, "StaffDashboard");

const MoveInOutSafe = makeSafe(MoveInOut, "MoveInOut");
const MealManagementSafe = makeSafe(MealManagement, "MealManagement");
const PparUploadSafe = makeSafe(PparUpload, "PparUpload");

const ManagerStaffSafe = makeSafe(ManagerStaff, "ManagerStaff");
const StaffGridSafe = makeSafe(StaffGrid, "StaffGrid");

const AdminLayoutSafe = makeSafe(AdminLayout, "AdminLayout");
const MaintenancePageSafe = makeSafe(MaintenancePage, "MaintenancePage");
const ComplianceSafe = makeSafe(Compliance, "Compliance");
const InspectionsSafe = makeSafe(Inspections, "Inspections");
const IncidentsSafe = makeSafe(Incidents, "Incidents");
const AIRETasksSafe = makeSafe(AIRETasks, "AIRETasks");
const LitigationSafe = makeSafe(Litigation, "Litigation");
const FormsSafe = makeSafe(Forms, "Forms");
const SafeguardingReferralsSafe = makeSafe(SafeguardingReferrals, "SafeguardingReferrals");
const RiskAssessmentsSafe = makeSafe(RiskAssessments, "RiskAssessments");
const VulnerableUsersSafe = makeSafe(VulnerableUsers, "VulnerableUsers");
const MultiAgencySafe = makeSafe(MultiAgency, "MultiAgency");
const FormViewSafe = makeSafe(FormView, "FormView");
const FormSubmissionsSafe = makeSafe(FormSubmissions, "FormSubmissions");
const HSEIncidentsSafe = makeSafe(HSEIncidents, "HSEIncidents");
const HSERiskManagementSafe = makeSafe(HSERiskManagement, "HSERiskManagement");
const HSETrainingSafe = makeSafe(HSETraining, "HSETraining");
const HSEAuditsSafe = makeSafe(HSEAudits, "HSEAudits");
const ComplaintsSafe = makeSafe(Complaints, "Complaints");
const VCSOrganisationsSafe = makeSafe(VCSOrganisations, "VCSOrganisations");
const CaseManagementSafe = makeSafe(CaseManagement, "CaseManagement");
const EmergencyProtocolsSafe = makeSafe(EmergencyProtocols, "EmergencyProtocols");
const EmployeeTrainingSafe = makeSafe(EmployeeTraining, "EmployeeTraining");
const AccessManagementSafe = makeSafe(AccessManagement, "AccessManagement");
const SettingsSafe = makeSafe(Settings, "Settings");
const BookingsSafe = makeSafe(Bookings, "Bookings");
const UserManagementSafe = makeSafe(UserManagement, "UserManagement");
const OrganizationChartSafe = makeSafe(OrganizationChart, "OrganizationChart");

/* --------------------------
   Error boundary
   -------------------------- */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error in App tree:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      // Log the error but avoid blocking the entire app with a full-screen error.
      // Render children so the app remains usable; the error has been reported to console.
      // This prevents transient UI errors (e.g., during logout/login) from forcing a reload.
      // eslint-disable-next-line no-console
      console.error("Recoverable UI error in App ErrorBoundary:", this.state.error, this.state.info);
      return this.props.children;
    }
    return this.props.children;
  }
}

/* --------------------------
   Route guards
   -------------------------- */
function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ user, allowed = [], children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RedirectToAdminTicket() {
  const { id } = useParams();
  if (!id) return <Navigate to="/admin/tickets" replace />;
  return <Navigate to={`/admin/tickets/${encodeURIComponent(id)}`} replace />;
}

// Permission-based route guard
function PermissionRoute({ user, module, children }) {
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    // Admins have full access
    if (user.role === "admin") {
      setHasAccess(true);
      setLoading(false);
      return;
    }

    // If no module specified, allow access
    if (!module) {
      setHasAccess(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    async function checkPermission() {
      try {
        const res = await axios.get("/api/access/me", {
          signal: controller.signal,
          withCredentials: true
        });
        if (mounted && res?.data?.permissions) {
          const perm = res.data.permissions[module];
          setHasAccess(perm && perm.read === true);
        } else {
          setHasAccess(false);
        }
      } catch (err) {
        if (mounted && !controller.signal.aborted) {
          console.error("Error checking permission:", err);
          setHasAccess(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkPermission();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [user, module]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <div className="h-9 w-9 rounded-full border-2 border-red-400 text-red-500 flex items-center justify-center font-bold">
                  !
                </div>
              </div>
              <p className="text-gray-600">
                You don't have permission to access this page.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-5 py-2 rounded-lg bg-rose-500 text-white font-medium hover:bg-rose-600 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

/* --------------------------
   App component
   -------------------------- */
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // --- INACTIVITY TIMEOUT LOGIC ---
  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

    const handleLogout = async () => {
      console.log("Inactivity timeout reached. Logging out...");
      try {
        await axios.post("/api/auth/logout");
      } catch (err) {
        console.error("Auto-logout error:", err);
      }
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("authToken"); // important to clear this too!
      window.location.href = "/login"; // Force redirect
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_LIMIT);
    };

    // Initial timer start
    resetTimer();

    // Events that reset the inactivity timer
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click"
    ];

    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);
  // --- END INACTIVITY TIMEOUT LOGIC ---

  useEffect(() => {
    let mounted = true;
    const validate = async () => {
      try {
        const res = await axios.get("/api/auth/me");
        if (mounted && res?.data) {
          setUser(res.data);
        }
      } catch (err) {
        if (mounted) {
          // If 401, clear user
          if (err.response?.status === 401) {
            setUser(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    validate();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // --- Layout Wrappers ---

  // 1. For Admin pages (Admin role OR staff/manager with permissions)
  const AdminLayoutWrapper = ({ children }) => (
    <ProtectedRoute user={user}>
      <AdminLayoutSafe user={user}>{children}</AdminLayoutSafe>
    </ProtectedRoute>
  );

  // 2. For General Protected pages (Home, Profile, Tasks) - so they get the sidebar too!
  const GeneralLayoutWrapper = ({ children }) => (
    <ProtectedRoute user={user}>
      <AdminLayoutSafe user={user}>{children}</AdminLayoutSafe>
    </ProtectedRoute>
  );

  return (
    <ErrorBoundary>
      <Router>
        <ThemeBootstrap />
        {/* GLOBAL APP CONTAINER: Flex column with fixed height */}
        <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">

          {/* TOP NAVIGATION: Fixed Height, non-scrolling */}
          <div className="shrink-0 z-50 top-navbar">
            <NavbarSafe user={user} setUser={setUser} />
          </div>

          {/* MAIN CONTENT CONTAINER: Fills remaining height */}
          <div className="flex-1 overflow-hidden relative z-0">
            <Routes>

              {/* --- PUBLIC ROUTES --- */}
              <Route path="/login" element={<LoginSafe setUser={setUser} />} />
              <Route path="/register" element={<RegisterSafe setUser={setUser} />} />


              {/* --- GENERAL PROTECTED ROUTES (Now wrapped in Sidebar Layout) --- */}

              {/* Home / Main Dashboard */}
              <Route path="/" element={
                <GeneralLayoutWrapper>
                  <HomeSafe user={user} setUser={setUser} />
                </GeneralLayoutWrapper>
              } />

              {/* Common Modules */}
              <Route path="/profile" element={
                <GeneralLayoutWrapper>
                  <ProfileSafe user={user} />
                </GeneralLayoutWrapper>
              } />

              <Route path="/activity" element={
                <GeneralLayoutWrapper>
                  <ActivitySafe />
                </GeneralLayoutWrapper>
              } />

              <Route path="/notifications" element={
                <GeneralLayoutWrapper>
                  <NotificationsSafe />
                </GeneralLayoutWrapper>
              } />

              <Route path="/hotels" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="properties">
                    <HotelsListSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              <Route path="/hotels/:id" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="properties">
                    <HotelDetailsSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              <Route path="/bookings" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="properties">
                    <BookingsSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              {/* --- ADDED: Public/General compliance route (protected) --- */}
              <Route path="/compliance" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="compliance">
                    <ComplianceSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              {/* --- ADDED ROUTES FOR SERVICE USERS (uses ServiceUsers page) --- */}
              <Route path="/su/users" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUsersSafe user={user} openAddModal={new URLSearchParams(window.location.search).get("add") === "true"} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />
              <Route path="/su/users/:id" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUserProfileSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />
              <Route path="/su/users/new" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUsersSafe user={user} openAddModal={true} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              {/* Analytics, Demographics, Accommodation, Reports - All use the same Analytics Page */}
              <Route path="/su/analytics" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUserAnalyticsSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />
              <Route path="/su/demographics" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUserAnalyticsSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />
              <Route path="/su/accommodation" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUserAnalyticsSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />
              <Route path="/su/reports" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <ServiceUserAnalyticsSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              <Route path="/su/move-in-out" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="move_in_out">
                    <MoveInOutSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              <Route path="/su/meals" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="meals">
                    <MealManagementSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              <Route path="/su/ppar" element={
                <GeneralLayoutWrapper>
                  <PermissionRoute user={user} module="su_data">
                    <PparUploadSafe user={user} />
                  </PermissionRoute>
                </GeneralLayoutWrapper>
              } />

              {/* --- ADMIN ROUTES --- */}
              <Route path="/admin/*" element={
                <AdminLayoutWrapper>
                  <Routes>
                    <Route index element={
                      <PermissionRoute user={user} module="dashboard">
                        <AdminDashboardSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="hotels" element={
                      <PermissionRoute user={user} module="properties">
                        <HotelsListSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="org-chart" element={
                      <PermissionRoute user={user} module="properties">
                        <OrganizationChartSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="bookings" element={
                      <PermissionRoute user={user} module="properties">
                        <BookingsSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="users" element={
                      <RoleRoute user={user} allowed={["admin", "manager", "staff"]}>
                        <UsersSafe user={user} />
                      </RoleRoute>
                    } />
                    <Route path="add-member" element={
                      <RoleRoute user={user} allowed={["admin"]}>
                        <AdminAddMemberSafe user={user} />
                      </RoleRoute>
                    } />
                    <Route path="staff-grid" element={
                      <RoleRoute user={user} allowed={["admin", "manager", "staff"]}>
                        <StaffGridSafe user={user} />
                      </RoleRoute>
                    } />

                    {/* --- ADDED: Maintenance route --- */}
                    <Route path="maintenance" element={
                      <PermissionRoute user={user} module="maintenance">
                        <MaintenancePageSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- Inspections route --- */}
                    <Route path="inspections" element={
                      <PermissionRoute user={user} module="inspections">
                        <InspectionsSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- Incidents route --- */}
                    <Route path="incidents" element={
                      <PermissionRoute user={user} module="incidents">
                        <IncidentsSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- Complaints route --- */}
                    <Route path="complaints" element={
                      <PermissionRoute user={user} module="complaints">
                        <ComplaintsSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- Case Management route --- */}
                    <Route path="case-management" element={
                      <PermissionRoute user={user} module="case_management">
                        <CaseManagementSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- Emergency Protocols route --- */}
                    <Route path="emergency-protocols" element={
                      <PermissionRoute user={user} module="emergency_protocols">
                        <EmergencyProtocolsSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- VCS Organisations route --- */}
                    <Route path="vcs-organisations" element={
                      <PermissionRoute user={user} module="vcs_organisations">
                        <VCSOrganisationsSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- ADDED: Compliance route under admin --- */}
                    <Route path="compliance" element={
                      <PermissionRoute user={user} module="compliance">
                        <ComplianceSafe user={user} />
                      </PermissionRoute>
                    } />

                    {/* --- Access Management route --- */}
                    <Route path="access" element={
                      <RoleRoute user={user} allowed={["admin"]}>
                        <AccessManagementSafe user={user} />
                      </RoleRoute>
                    } />

                    {/* --- User Management (Settings) --- */}
                    <Route path="settings/users" element={
                      <RoleRoute user={user} allowed={["admin"]}>
                        <UserManagementSafe />
                      </RoleRoute>
                    } />

                    {/* --- Settings route (Enhanced ACL) --- */}
                    <Route path="settings" element={
                      <SettingsSafe user={user} />
                    } />

                    {/* --- AIRE Tasks route --- */}
                    <Route path="aire-tasks" element={
                      <PermissionRoute user={user} module="aire_tasks">
                        <AIRETasksSafe user={user} />
                      </PermissionRoute>
                    } />
                    {/* --- Litigation route --- */}
                    <Route path="litigation" element={
                      <PermissionRoute user={user} module="litigation">
                        <LitigationSafe user={user} />
                      </PermissionRoute>
                    } />
                    {/* --- Safeguarding Referrals route --- */}
                    <Route path="safeguarding/referrals" element={
                      <PermissionRoute user={user} module="safeguarding_referrals">
                        <SafeguardingReferralsSafe user={user} />
                      </PermissionRoute>
                    } />
                    {/* --- Risk Assessments route --- */}
                    <Route path="safeguarding/risk-assessments" element={
                      <PermissionRoute user={user} module="safeguarding_risk_assessments">
                        <RiskAssessmentsSafe user={user} />
                      </PermissionRoute>
                    } />
                    {/* --- HSE Incidents route --- */}
                    <Route path="hse/incidents" element={
                      <PermissionRoute user={user} module="hse_incidents">
                        <HSEIncidentsSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="hse/risk-management" element={
                      <PermissionRoute user={user} module="hse_risk_management">
                        <HSERiskManagementSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="hse/training" element={
                      <PermissionRoute user={user} module="hse_training">
                        <HSETrainingSafe user={user} />
                      </PermissionRoute>
                    } />
                    <Route path="hse/audits" element={
                      <PermissionRoute user={user} module="hse_audits">
                        <HSEAuditsSafe user={user} />
                      </PermissionRoute>
                    } />
                    {/* --- Vulnerable Users route --- */}
                    <Route path="safeguarding/vulnerable-users" element={
                      <PermissionRoute user={user} module="vulnerable_users">
                        <VulnerableUsersSafe user={user} />
                      </PermissionRoute>
                    } />
                    {/* --- Multi-Agency route --- */}
                    <Route path="safeguarding/multi-agency" element={
                      <PermissionRoute user={user} module="multi_agency">
                        <MultiAgencySafe user={user} />
                      </PermissionRoute>
                    } />
                  </Routes>
                </AdminLayoutWrapper>
              } />



              {/* --- MANAGER ROUTES --- */}
              {/* Manager dashboard (standalone page) */}
              <Route path="/manager" element={
                <RoleRoute user={user} allowed={["manager"]}>
                  <ManagerDashboardSafe user={user} />
                </RoleRoute>
              } />

              {/* Manager employee list (Employee Management page) */}
              <Route path="/manager/users" element={
                <GeneralLayoutWrapper>
                  <RoleRoute user={user} allowed={["manager"]}>
                    <PermissionRoute user={user} module="employees">
                      <UsersSafe user={user} />
                    </PermissionRoute>
                  </RoleRoute>
                </GeneralLayoutWrapper>
              } />

              {/* Manager staff management (standalone page) */}
              <Route path="/manager/staff" element={
                <RoleRoute user={user} allowed={["manager"]}>
                  <ManagerStaffSafe user={user} />
                </RoleRoute>
              } />

              {/* Manager Operation Hub routes (inspections, incidents, complaints, etc.) */}
              <Route path="/manager/inspections" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="inspections">
                    <AdminLayoutSafe user={user}>
                      <InspectionsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/incidents" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="incidents">
                    <AdminLayoutSafe user={user}>
                      <IncidentsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/complaints" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="complaints">
                    <AdminLayoutSafe user={user}>
                      <ComplaintsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/compliance" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="compliance">
                    <AdminLayoutSafe user={user}>
                      <ComplianceSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/maintenance" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="maintenance">
                    <AdminLayoutSafe user={user}>
                      <MaintenancePageSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/aire-tasks" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="aire_tasks">
                    <AdminLayoutSafe user={user}>
                      <AIRETasksSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/litigation" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="litigation">
                    <AdminLayoutSafe user={user}>
                      <LitigationSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              {/* Manager HSE routes */}
              <Route path="/manager/hse/incidents" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="hse_incidents">
                    <AdminLayoutSafe user={user}>
                      <HSEIncidentsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/hse/risk-management" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="hse_risk_management">
                    <AdminLayoutSafe user={user}>
                      <HSERiskManagementSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/hse/training" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="hse_training">
                    <AdminLayoutSafe user={user}>
                      <HSETrainingSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/hse/audits" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="hse_audits">
                    <AdminLayoutSafe user={user}>
                      <HSEAuditsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              {/* Manager Safeguarding routes */}
              <Route path="/manager/safeguarding/referrals" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="safeguarding_referrals">
                    <AdminLayoutSafe user={user}>
                      <SafeguardingReferralsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/safeguarding/risk-assessments" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="safeguarding_risk_assessments">
                    <AdminLayoutSafe user={user}>
                      <RiskAssessmentsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/safeguarding/vulnerable-users" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="vulnerable_users">
                    <AdminLayoutSafe user={user}>
                      <VulnerableUsersSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/safeguarding/multi-agency" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="multi_agency">
                    <AdminLayoutSafe user={user}>
                      <MultiAgencySafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              {/* Manager Escalations routes */}
              <Route path="/manager/vcs-organisations" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="vcs_organisations">
                    <AdminLayoutSafe user={user}>
                      <VCSOrganisationsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/case-management" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="case_management">
                    <AdminLayoutSafe user={user}>
                      <CaseManagementSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              <Route path="/manager/emergency-protocols" element={
                <ProtectedRoute user={user}>
                  <PermissionRoute user={user} module="emergency_protocols">
                    <AdminLayoutSafe user={user}>
                      <EmergencyProtocolsSafe user={user} />
                    </AdminLayoutSafe>
                  </PermissionRoute>
                </ProtectedRoute>
              } />

              {/* Manager HR routes */}


              {/* Manager Finance routes */}


              {/* Forms/Table Manager routes */}
              <Route path="/admin/forms" element={
                <AdminLayoutWrapper>
                  <FormsSafe user={user} />
                </AdminLayoutWrapper>
              } />

              <Route path="/manager/forms" element={
                <ProtectedRoute user={user}>
                  <AdminLayoutSafe user={user}>
                    <FormsSafe user={user} />
                  </AdminLayoutSafe>
                </ProtectedRoute>
              } />

              {/* Explicit Performance Management route (HR menu -> Performance) */}


              {/* Explicit Employee Training route (HR menu -> Training) */}
              <Route
                path="/training"
                element={
                  <AdminLayoutWrapper>
                    <EmployeeTrainingSafe user={user} />
                  </AdminLayoutWrapper>
                }
              />

              {/* Payroll (Finance menu -> Payroll) */}


              {/* --- STAFF ROUTES --- */}
              <Route path="/staff" element={
                <RoleRoute user={user} allowed={["staff"]}>
                  <StaffDashboardSafe user={user} />
                </RoleRoute>
              } />

              <Route path="/staff/rooms" element={
                <RoleRoute user={user} allowed={["staff"]}>
                  <StaffRoomsSafe />
                </RoleRoute>
              } />

              {/* Shared Room Manager */}
              <Route path="/hotels/:hotelId/rooms" element={
                <RoleRoute user={user} allowed={["admin", "manager", "staff"]}>
                  <AdminLayoutSafe user={user}>
                    <RoomsManagerSafe user={user} />
                  </AdminLayoutSafe>
                </RoleRoute>
              } />

              <Route path="/hotels/:hotelId/rooms/:roomId" element={
                <RoleRoute user={user} allowed={["admin", "manager", "staff"]}>
                  <AdminLayoutSafe user={user}>
                    <RoomDetailsSafe />
                  </AdminLayoutSafe>
                </RoleRoute>
              } />

              {/* Redirects */}

              <Route path="/tickets/:id" element={<RedirectToAdminTicket />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />

            </Routes>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  );
}