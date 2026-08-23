/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/pages/Navbar.jsx */
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import logo from "/logo.png";
import { applyTheme as applyThemeUtil, applyCustomTheme as applyCustomThemeUtil } from "../src/utils/themeUtils";

const THEMES = {
    classic: {
        name: "Classic",
        colors: {
            "--bg-primary": "#f9fafb",
            "--bg-surface": "#ffffff",
            "--bg-sidebar": "#ffffff",
            "--text-primary": "#111827",
            "--text-secondary": "#4b5563",
            "--accent-primary": "#4ca99d",
            "--accent-hover": "#3d8b81",
            "--accent-shadow": "rgba(76, 169, 157, 0.2)",
            "--border-color": "#e5e7eb",
            "--text-on-accent": "#ffffff",
            "--text-on-sidebar": "#111827",
            "--color-error": "#ef4444",
            "--color-warning": "#f59e0b",
            "--color-success": "#10b981",
            "--color-info": "#3b82f6"
        }
    },
    nord: {
        name: "Nord",
        colors: {
            "--bg-primary": "#2e3440",
            "--bg-surface": "#3b4252",
            "--bg-sidebar": "#434c5e",
            "--text-primary": "#eceff4",
            "--text-secondary": "#d8dee9",
            "--accent-primary": "#88c0d0",
            "--accent-hover": "#81a1c1",
            "--accent-shadow": "rgba(136, 192, 208, 0.2)",
            "--border-color": "#434c5e",
            "--text-on-accent": "#2e3440",
            "--text-on-sidebar": "#eceff4",
            "--color-error": "#fb7185",
            "--color-warning": "#fcd34d",
            "--color-success": "#a3e635",
            "--color-info": "#81a1c1"
        }
    },
    catppuccin: {
        name: "Catppuccin",
        colors: {
            "--bg-primary": "#1e1e2e",
            "--bg-surface": "#181825",
            "--bg-sidebar": "#11111b",
            "--text-primary": "#cdd6f4",
            "--text-secondary": "#a6adc8",
            "--accent-primary": "#cba6f7",
            "--accent-hover": "#b4befe",
            "--accent-shadow": "rgba(203, 166, 247, 0.2)",
            "--border-color": "#313244",
            "--text-on-accent": "#1e1e2e",
            "--text-on-sidebar": "#cdd6f4",
            "--color-error": "#f38ba8",
            "--color-warning": "#f9e2af",
            "--color-success": "#a6e3a1",
            "--color-info": "#89b4fa"
        }
    },
    dracula: {
        name: "Dracula",
        colors: {
            "--bg-primary": "#282a36",
            "--bg-surface": "#44475a",
            "--bg-sidebar": "#282a36",
            "--text-primary": "#f8f8f2",
            "--text-secondary": "#6272a4",
            "--accent-primary": "#bd93f9",
            "--accent-hover": "#ff79c6",
            "--accent-shadow": "rgba(189, 147, 249, 0.2)",
            "--border-color": "#6272a4",
            "--text-on-accent": "#282a36",
            "--text-on-sidebar": "#f8f8f2",
            "--color-error": "#ff5555",
            "--color-warning": "#ffb86c",
            "--color-success": "#50fa7b",
            "--color-info": "#8be9fd"
        }
    },
    onedark: {
        name: "One Dark",
        colors: {
            "--bg-primary": "#282c34",
            "--bg-surface": "#21252b",
            "--bg-sidebar": "#282c34",
            "--text-primary": "#abb2bf",
            "--text-secondary": "#5c6370",
            "--accent-primary": "#61afef",
            "--accent-hover": "#56b6c2",
            "--accent-shadow": "rgba(97, 175, 239, 0.2)",
            "--border-color": "#3e4451",
            "--text-on-accent": "#282c34",
            "--text-on-sidebar": "#abb2bf",
            "--color-error": "#e06c75",
            "--color-warning": "#e5c07b",
            "--color-success": "#98c379",
            "--color-info": "#61afef"
        }
    },
    rosepine: {
        name: "Rosé Pine",
        colors: {
            "--bg-primary": "#191724",
            "--bg-surface": "#1f1d2e",
            "--bg-sidebar": "#191724",
            "--text-primary": "#e0def4",
            "--text-secondary": "#908caa",
            "--accent-primary": "#ebbcba",
            "--accent-hover": "#f6c177",
            "--accent-shadow": "rgba(235, 188, 186, 0.2)",
            "--border-color": "#26233a",
            "--text-on-accent": "#191724",
            "--text-on-sidebar": "#e0def4",
            "--color-error": "#eb6f92",
            "--color-warning": "#f6c177",
            "--color-success": "#31748f",
            "--color-info": "#9ccfd8"
        }
    },
    midnight: {
        name: "Midnight",
        colors: {
            "--bg-primary": "#0f172a",
            "--bg-surface": "#1e293b",
            "--bg-sidebar": "#0f172a",
            "--text-primary": "#f1f5f9",
            "--text-secondary": "#94a3b8",
            "--accent-primary": "#38bdf8",
            "--accent-hover": "#0ea5e9",
            "--accent-shadow": "rgba(56, 189, 248, 0.2)",
            "--border-color": "#334155",
            "--text-on-accent": "#0f172a",
            "--text-on-sidebar": "#f1f5f9",
            "--color-error": "#f43f5e",
            "--color-warning": "#fbbf24",
            "--color-success": "#10b981",
            "--color-info": "#60a5fa"
        }
    },
    tokyo: {
        name: "Tokyo Night",
        colors: {
            "--bg-primary": "#1a1b26",
            "--bg-surface": "#24283b",
            "--bg-sidebar": "#1a1b26",
            "--text-primary": "#a9b1d6",
            "--text-secondary": "#787c99",
            "--accent-primary": "#bb9af7",
            "--accent-hover": "#9d7cd8",
            "--accent-shadow": "rgba(187, 154, 247, 0.2)",
            "--border-color": "#414868",
            "--text-on-accent": "#1a1b26",
            "--text-on-sidebar": "#a9b1d6",
            "--color-error": "#f7768e",
            "--color-warning": "#e0af68",
            "--color-success": "#9ece6a",
            "--color-info": "#7aa2f7"
        }
    },
    dark: {
        name: "Dark Slate",
        colors: {
            "--bg-primary": "#121212",
            "--bg-surface": "#1e1e1e",
            "--bg-sidebar": "#181818",
            "--text-primary": "#e0e0e0",
            "--text-secondary": "#b0b0b0",
            "--accent-primary": "#bb86fc",
            "--accent-hover": "#9965f4",
            "--accent-shadow": "rgba(187, 134, 252, 0.2)",
            "--border-color": "#333333",
            "--text-on-accent": "#ffffff",
            "--text-on-sidebar": "#e0e0e0",
            "--color-error": "#cf6679",
            "--color-warning": "#ffb74d",
            "--color-success": "#03dac6",
            "--color-info": "#bb86fc"
        }
    },
    lighter: {
        name: "Lighter",
        colors: {
            "--bg-primary": "#f8f9fa",
            "--bg-surface": "#ffffff",
            "--bg-sidebar": "#ffffff",
            "--text-primary": "#334155",
            "--text-secondary": "#64748b",
            "--accent-primary": "#0ea5e9",
            "--accent-hover": "#0284c7",
            "--accent-shadow": "rgba(14, 165, 233, 0.2)",
            "--border-color": "#e2e8f0",
            "--text-on-accent": "#ffffff",
            "--text-on-sidebar": "#334155",
            "--color-error": "#dc2626",
            "--color-warning": "#d97706",
            "--color-success": "#16a34a",
            "--color-info": "#2563eb"
        }
    },
    custom: {
        name: "Custom Color",
        isCustom: true,
        colors: {
            "--bg-primary": "#0f172a",
            "--bg-surface": "#1e293b",
            "--bg-sidebar": "#0f172a",
            "--text-primary": "#f1f5f9",
            "--text-secondary": "#94a3b8",
            "--accent-primary": "#3deedd",
            "--accent-hover": "#2bc4b6",
            "--accent-shadow": "rgba(61, 238, 221, 0.2)",
            "--border-color": "#334155",
            "--text-on-accent": "#0f172a",
            "--text-on-sidebar": "#f1f5f9",
            "--color-error": "#ef4444",
            "--color-warning": "#f59e0b",
            "--color-success": "#10b981",
            "--color-info": "#3b82f6"
        }
    }
};

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

    const [selectedTheme, setSelectedTheme] = useState(() => {
        return localStorage.getItem("appTheme") || "lighter";
    });
    const [activeTheme, setActiveTheme] = useState(selectedTheme);
    const [customColor, setCustomColor] = useState(() => {
        return localStorage.getItem("customThemeColor") || "#3deedd";
    });

    useEffect(() => {
        const savedTheme = localStorage.getItem("appTheme") || "lighter";
        if (savedTheme === 'custom') {
            const savedColor = localStorage.getItem("customThemeColor") || "#3deedd";
            applyCustomTheme(savedColor);
        } else {
            applyTheme(savedTheme);
        }
    }, []);

    const applyTheme = (themeKey) => {
        applyThemeUtil(themeKey);
        setActiveTheme(themeKey);
    };

    const applyCustomTheme = (color) => {
        applyCustomThemeUtil(color);
        setActiveTheme('custom');
    };

    const handleSaveTheme = () => {
        localStorage.setItem("appTheme", selectedTheme);
        if (selectedTheme === 'custom') {
            localStorage.setItem("customThemeColor", customColor);
            applyCustomTheme(customColor);
        } else {
            applyTheme(selectedTheme);
        }
    };

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
            <nav className="sticky top-0 z-50 w-full backdrop-blur-md border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between shadow-sm top-navbar" style={{ backgroundColor: 'var(--bg-surface)', opacity: 0.9 }}>

                {/* Left Side: Logo + Text */}
                <div className="flex items-center">
                    <div
                        className="cursor-pointer flex items-center"
                        onClick={() => navigate("/")}
                        title="Home"
                    >
                        <img
                            src={logo}
                            alt="SD Commercial"
                            className="h-12 w-auto object-contain"
                        />
                        <h2 className="text-xl font-semibold -ml-2" style={{ color: 'var(--text-primary)' }}>
                            Commercial
                        </h2>
                    </div>
                </div>

                {!isAuthPage && (
                    <div className="flex items-center gap-4">
                        {localUser ? (
                            <>
                                <button
                                    onClick={logout}
                                    className="px-4 py-2 rounded-xl border text-sm font-medium transition-colors shrink-0"
                                    style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        borderColor: 'var(--border-color)',
                                        color: 'var(--color-error)'
                                    }}
                                >
                                    Logout
                                </button>

                                <div className="relative" ref={ref}>
                                    <button
                                        onClick={() => setOpen((s) => !s)}
                                        className="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors"
                                        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                        title={localUser.name || localUser.email || "User"}
                                    >
                                        {initials}
                                    </button>

                                    {open && (
                                        <div className="absolute right-0 mt-3 w-64 rounded-xl shadow-xl border border-[var(--border-color)] ring-1 ring-black/5 overflow-hidden z-50" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                                            <div className="p-4 border-b border-[var(--border-color)]" style={{ backgroundColor: 'var(--bg-primary)', opacity: 0.5 }}>
                                                <div className="font-bold text-base">{localUser.name}</div>
                                                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{localUser.email}</div>
                                            </div>
                                            <div className="p-4 text-sm space-y-3">
                                                <div className="flex justify-between">
                                                    <span style={{ color: 'var(--text-secondary)' }}>Role:</span>
                                                    <span className="font-medium px-2 py-0.5 rounded-xl text-xs uppercase tracking-wide" style={{ backgroundColor: 'var(--bg-primary)' }}>{localUser.role}</span>
                                                </div>
                                                {localUser.branch && (
                                                    <div className="flex justify-between">
                                                        <span style={{ color: 'var(--text-secondary)' }}>Branch:</span>
                                                        <span className="font-medium">{localUser.branch}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 border-t border-[var(--border-color)] flex gap-3">
                                                <button
                                                    onClick={() => { setOpen(false); navigate("/"); }}
                                                    className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                                                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                >
                                                    Home
                                                </button>
                                                <button
                                                    onClick={() => { setOpen(false); logout(); }}
                                                    className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                                                    style={{
                                                        backgroundColor: 'var(--bg-surface)',
                                                        border: '1px solid var(--border-color)',
                                                        color: 'var(--color-error)'
                                                    }}
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
                                className="px-5 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
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