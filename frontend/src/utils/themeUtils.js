/* src/utils/themeUtils.js */

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const hexToRgb = (hex) => {
    if (!hex) return null;
    const h = String(hex).trim();
    if (!h.startsWith("#")) return null;
    const raw = h.slice(1);
    const full = raw.length === 3
        ? raw.split("").map((c) => c + c).join("")
        : raw;
    if (full.length !== 6) return null;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return null;
    return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255
    };
};

const rgbToHex = ({ r, g, b }) => {
    const toHex = (v) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (a, b, t) => {
    const ra = hexToRgb(a);
    const rb = hexToRgb(b);
    if (!ra || !rb) return a || b;
    const tt = clamp01(t);
    return rgbToHex({
        r: Math.round(ra.r + (rb.r - ra.r) * tt),
        g: Math.round(ra.g + (rb.g - ra.g) * tt),
        b: Math.round(ra.b + (rb.b - ra.b) * tt)
    });
};

const relLuminance = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const contrastRatio = (a, b) => {
    const L1 = relLuminance(a);
    const L2 = relLuminance(b);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
};

const pickBlackOrWhite = (bgHex) => {
    const bg = hexToRgb(bgHex);
    if (!bg) return "#111827";
    return relLuminance(bgHex) > 0.5 ? "#111827" : "#f8fafc";
};

const safeGet = (root, name, fallback) => {
    const v = getComputedStyle(root).getPropertyValue(name)?.trim();
    return v || fallback;
};

const normalizeThemeContrast = (root) => {
    const bgPrimary = safeGet(root, "--bg-primary", "#ffffff");
    const bgSurface = safeGet(root, "--bg-surface", bgPrimary);
    const bgSidebar = safeGet(root, "--bg-sidebar", bgSurface);
    const accentPrimary = safeGet(root, "--accent-primary", "#0ea5e9");

    let textPrimary = safeGet(root, "--text-primary", pickBlackOrWhite(bgPrimary));
    if (contrastRatio(textPrimary, bgPrimary) < 4.5 || contrastRatio(textPrimary, bgSurface) < 4.5) {
        textPrimary = pickBlackOrWhite(bgSurface);
    }

    let textSecondary = safeGet(root, "--text-secondary", mixHex(textPrimary, bgSurface, 0.35));
    if (contrastRatio(textSecondary, bgSurface) < 3) {
        textSecondary = mixHex(textPrimary, bgSurface, 0.2);
    }

    let textOnSidebar = safeGet(root, "--text-on-sidebar", pickBlackOrWhite(bgSidebar));
    if (contrastRatio(textOnSidebar, bgSidebar) < 4.5) {
        textOnSidebar = pickBlackOrWhite(bgSidebar);
    }

    let textOnAccent = safeGet(root, "--text-on-accent", pickBlackOrWhite(accentPrimary));
    if (contrastRatio(textOnAccent, accentPrimary) < 4.5) {
        textOnAccent = pickBlackOrWhite(accentPrimary);
    }

    root.style.setProperty("--text-primary", textPrimary);
    root.style.setProperty("--text-secondary", textSecondary);
    root.style.setProperty("--text-on-sidebar", textOnSidebar);
    root.style.setProperty("--text-on-accent", textOnAccent);

    const primaryOk = contrastRatio(textPrimary, bgSurface) >= 4.5;
    const secondaryOk = contrastRatio(textSecondary, bgSurface) >= 3;
    if (!primaryOk || !secondaryOk) {
        root.style.setProperty("--base-font-weight", "500");
        root.style.setProperty("--base-font-size", "16.5px");
    } else {
        root.style.setProperty("--base-font-weight", "400");
        root.style.setProperty("--base-font-size", "16px");
    }
};

export const THEMES = {
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

export const applyTheme = (themeKey) => {
    const theme = THEMES[themeKey] || THEMES.classic;
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
    normalizeThemeContrast(root);
};

export const applyCustomTheme = (color) => {
    const root = document.documentElement;
    const base = THEMES.custom.colors;
    Object.entries(base).forEach(([prop, val]) => {
        root.style.setProperty(prop, val);
    });
    root.style.setProperty('--accent-primary', color);
    const hover = relLuminance(color) > 0.5 ? mixHex(color, "#000000", 0.15) : mixHex(color, "#ffffff", 0.15);
    root.style.setProperty('--accent-hover', hover);
    normalizeThemeContrast(root);
};
