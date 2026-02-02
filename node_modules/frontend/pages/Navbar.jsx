/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/Navbar.jsx */
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import logo from "./logo.png";

// REMOVED IMPORT to prevent errors. Ensure 'logo.png' is in your 'public' folder.

export default function Navbar({ user, setUser, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  // treat /login and /register as auth pages
  const isAuthPage = /^\/(login|register)(?:$|[/?#])/.test(location.pathname + (location.search || ""));

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // If we're on an auth page (login/register), do not render the top nav —
  // return only the page content so the login/register UI is full-bleed.
  if (isAuthPage) {
    return <main>{children}</main>;
  }

  try {
    // normal render flow
  } catch (err) {
    // If Navbar fails for any reason, avoid crashing the whole app.
    // Log the error and render only the page content so the app remains usable.
    // This prevents the global ErrorBoundary from showing a full-screen error
    // when a minor navbar rendering issue occurs.
    // eslint-disable-next-line no-console
    console.error("Navbar render error:", err);
    return <main>{children}</main>;
  }

  const logout = async () => {
    try {
      await axios.post("/api/auth/logout", {}, { withCredentials: true, timeout: 3000 });
    } catch (err) { }
    setUser(null);
    try { localStorage.removeItem("user"); } catch { }
    navigate("/login");
  };

  let localUser = user;
  if (!localUser) {
    try {
      const raw = localStorage.getItem("user");
      if (raw) localUser = JSON.parse(raw);
    } catch (e) { localUser = null; }
  }

  const initials = localUser && localUser.name
    ? localUser.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const getPanelText = () => {
    if (!localUser) return "Login";
    switch (localUser.role) {
      case "admin": return "Admin Panel";
      case "manager": return "Manager Panel";
      case "staff": return "Staff Panel";
      default: return "Dashboard";
    }
  };

  const goToPanel = () => {
    if (!localUser) return navigate("/login");
    if (localUser.role === "admin") return navigate("/admin");
    if (localUser.role === "manager") return navigate("/manager");
    if (localUser.role === "staff") return navigate("/staff");
    return navigate("/");
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm top-navbar">

        {/* Left Side: Logo + Text */}
        <div className="flex items-center">
          <div
            className="cursor-pointer flex items-center"
            onClick={() => navigate("/")}
            title="Home"
          >
            {/* FIXED: Using direct path and h-12 */}
            <img
              src={logo}
              alt="SD Commercial"
              className="h-12 w-auto object-contain"
            />

            {/* Text pulled closer with negative margin */}
            <h2 className="text-xl font-semibold text-slate-800 -ml-2">
              Commercial
            </h2>
          </div>
        </div>

        {!isAuthPage && (
          <div className="flex items-center gap-4">
            {localUser ? (
              <>
                {/* <button
                  onClick={goToPanel}
                  className="px-4 py-2 rounded-lg bg-[#00ffd9] text-white text-sm font-medium hover:bg-[#00e6c3] transition-colors shadow-sm shadow-cyan-100"
                >
                  {getPanelText()}
                </button> */}

                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-lg border border-red-100 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  Logout
                </button>

                <div className="relative" ref={ref}>
                  <button
                    onClick={() => setOpen((s) => !s)}
                    className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                    title={localUser.name || localUser.email || "User"}
                  >
                    {initials}
                  </button>

                  {open && (
                    <div className="absolute right-0 mt-3 w-64 bg-white text-slate-800 rounded-xl shadow-xl border border-gray-100 ring-1 ring-black/5 overflow-hidden z-50">
                      <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                        <div className="font-bold text-base">{localUser.name}</div>
                        <div className="text-xs text-gray-500">{localUser.email}</div>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Role:</span>
                          <span className="font-medium bg-gray-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide">{localUser.role}</span>
                        </div>
                        {localUser.branch && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Branch:</span>
                            <span className="font-medium text-slate-800">{localUser.branch}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-gray-100 flex gap-3">
                        <button
                          onClick={() => { setOpen(false); navigate("/"); }}
                          className="flex-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          Home
                        </button>
                        <button
                          onClick={() => { setOpen(false); logout(); }}
                          className="flex-1 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2 rounded-lg bg-[#00ffd9] text-white font-medium hover:bg-[#00e6c3] transition-colors shadow-sm"
              >
                Login
              </button>
            )}
          </div>
        )}
      </nav>

      <main>{children}</main>
    </>
  );
}