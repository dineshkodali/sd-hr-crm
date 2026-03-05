import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { Eye, EyeOff, ChevronDown, Filter, Columns, X, Home } from "lucide-react";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import { usePermissions } from "../hooks/usePermissions";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'meal-management-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes mealMgmtSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      tr.meal-deleting {
        animation: mealMgmtSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

export default function MealManagement({ user }) {
    const MODULE_KEY = 'meals';
    const {
        loading: permissionsLoading,
        canRead,
        canCreate,
        canUpdate,
        canDelete
    } = usePermissions(user);

    const canReadPage = canRead(MODULE_KEY);
    const canCreatePage = canCreate(MODULE_KEY);
    const canUpdatePage = canUpdate(MODULE_KEY);
    const canDeletePage = canDelete(MODULE_KEY);

    const [properties, setProperties] = useState(() => {
        try {
            const raw = localStorage.getItem(`mealManagementSnapshot.v1.${new Date().toISOString().slice(0, 10)}`);
            if (!raw) return [];
            const snap = JSON.parse(raw);
            if (!snap || typeof snap !== 'object' || !Array.isArray(snap.properties)) return [];
            return snap.properties;
        } catch { return []; }
    });
    const [serviceUsers, setServiceUsers] = useState(() => {
        try {
            const raw = localStorage.getItem(`mealManagementSnapshot.v1.${new Date().toISOString().slice(0, 10)}`);
            if (!raw) return [];
            const snap = JSON.parse(raw);
            if (!snap || typeof snap !== 'object' || !Array.isArray(snap.serviceUsers)) return [];
            return snap.serviceUsers;
        } catch { return []; }
    });
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedProperty, setSelectedProperty] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [meals, setMeals] = useState(() => {
        try {
            const raw = localStorage.getItem(`mealManagementSnapshot.v1.${new Date().toISOString().slice(0, 10)}`);
            if (!raw) return [];
            const snap = JSON.parse(raw);
            if (!snap || typeof snap !== 'object' || !Array.isArray(snap.meals)) return [];
            return snap.meals;
        } catch { return []; }
    });
    // Track rows currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingMeal, setEditingMeal] = useState(null);

    const [deleting, setDeleting] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    const [alertDialog, setAlertDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    // NEW STATE: For the View Modal
    const [viewingMeal, setViewingMeal] = useState(null);

    useEffect(() => {
        const shouldHide = Boolean(showScheduleModal || viewingMeal || confirmDialog.isOpen);
        try {
            document.body.classList.toggle("form-modal-open", shouldHide);
        } catch { }
        return () => {
            try {
                document.body.classList.remove("form-modal-open");
            } catch { }
        };
    }, [showScheduleModal, viewingMeal, confirmDialog.isOpen]);

    // Filter and Sort State (Litigation-style)
    const [filterMealType, setFilterMealType] = useState('All Meals');
    const [filterStatus, setFilterStatus] = useState('All Status');
    const [sortBy, setSortBy] = useState('');

    // View Menu State
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
    const viewRef = useRef(null);

    // Define all available columns
    const ALL_COLUMNS = [
        "serviceUser",
        "property",
        "mealType",
        "portion",
        "dietary",
        "status",
        "actions",
    ];

    // Column visibility state - all visible by default
    const [visibleColumns, setVisibleColumns] = useState(
        ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {})
    );

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    // Prevent infinite re-renders
    const api = useMemo(
        () =>
            axios.create({
                baseURL: import.meta.env.VITE_API_URL || "",
                withCredentials: true,
                timeout: 15000,
            }),
        []
    );


    // Load cached data when date changes
    useEffect(() => {
        try {
            const raw = localStorage.getItem(`mealManagementSnapshot.v1.${date}`);
            if (!raw) return;
            const snap = JSON.parse(raw);
            if (!snap || typeof snap !== 'object') return;
            if (Array.isArray(snap.properties)) setProperties(snap.properties);
            if (Array.isArray(snap.serviceUsers)) setServiceUsers(snap.serviceUsers);
            if (Array.isArray(snap.meals)) setMeals(snap.meals);
        } catch { }
    }, [date]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (viewRef.current && !viewRef.current.contains(e.target)) {
                setShowViewMenu(false);
                setShowPropertyVisibility(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Icons
    const IconEdit = ({ size = 18 }) => (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    );
    const IconTrash = ({ size = 18 }) => (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    );
    const IconEye = ({ size = 18 }) => (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    );

    // Fetch Data - always load fresh data in background without blocking UI
    useEffect(() => {
        let mounted = true;
        async function load() {
            // Only show loading if we don't have any cached data
            const hasCachedData = meals.length > 0 || properties.length > 0;
            if (!hasCachedData) setLoading(true);
            try {
                const pRes = await api
                    .get("/api/hotels", { params: { limit: 500 } })
                    .catch(() => ({ data: [] }));
                const suRes = await api
                    .get("/api/su", { params: { limit: 500 } })
                    .catch(() => ({ data: [] }));

                const mealEndpoints = [
                    "/api/meals",
                    "/api/su/meals",
                    "/api/meal-schedules",
                    "/api/meals/scheduled",
                ];
                let ms = [];

                // First try: request meals filtered by the currently selected date.
                for (let ep of mealEndpoints) {
                    try {
                        const r = await api.get(ep, { params: { date } });
                        const cand = (r?.data?.rows ?? r?.data?.data ?? r?.data) || [];
                        if (Array.isArray(cand) && cand.length > 0) {
                            ms = cand;
                            break;
                        }
                    } catch {
                        // try next
                    }
                }

                // If no meals found for the selected date, fall back to fetching without a date filter
                // so the UI can display existing rows in the DB (useful when no meals are scheduled today).
                if (!Array.isArray(ms) || ms.length === 0) {
                    for (let ep of mealEndpoints) {
                        try {
                            const r = await api.get(ep);
                            const cand = (r?.data?.rows ?? r?.data?.data ?? r?.data) || [];
                            if (Array.isArray(cand) && cand.length > 0) {
                                ms = cand;
                                break;
                            }
                        } catch {
                            // try next
                        }
                    }
                }

                if (!mounted) return;

                const ps = (pRes?.data?.hotels ?? pRes?.data?.data ?? pRes?.data) || [];
                const nextProperties = Array.isArray(ps)
                    ? ps.map((p) => ({
                        id: p.id,
                        name: p.name || p._displayName || `${p.id}`,
                    }))
                    : [];
                setProperties(nextProperties);

                const sus =
                    (suRes?.data?.data ??
                        suRes?.data?.rows ??
                        suRes?.data) ||
                    [];
                const nextServiceUsers = Array.isArray(sus)
                    ? sus.map((s) => ({
                        id: s.id,
                        name:
                            (s.first_name || s.last_name
                                ? `${s.first_name || ""} ${s.last_name || ""}`.trim()
                                : null) ??
                            s.name ??
                            s.full_name ??
                            `${s.id}`,
                        propertyId:
                            s.hotel_id ??
                            s.property_id ??
                            s.hotelId ??
                            s.propertyId ??
                            s.hotel ??
                            s.property ??
                            "",
                    }))
                    : [];
                setServiceUsers(nextServiceUsers);

                const serviceUserNameById = new Map(
                    nextServiceUsers.map((s) => [String(s.id), s.name])
                );
                const propertyNameById = new Map(
                    nextProperties.map((p) => [String(p.id), p.name])
                );

                let normalizedMeals = [];
                if (Array.isArray(ms) && ms.length > 0) {
                    const normalize = (m, idx) => {
                        const id = m.id ?? m.meal_id ?? idx;
                        const serviceUserIdRaw = m.service_user_id ?? m.serviceUserId;
                        const propertyIdRaw = m.property_id ?? m.propertyId;

                        const serviceUser =
                            m.service_user_name ??
                            m.serviceUserName ??
                            m.service_user ??
                            m.serviceUser ??
                            (serviceUserIdRaw !== undefined && serviceUserIdRaw !== null
                                ? serviceUserNameById.get(String(serviceUserIdRaw))
                                : null) ??
                            m.name ??
                            "Unknown";
                        const property =
                            m.property_name ??
                            m.propertyName ??
                            m.property ??
                            m.hotel_name ??
                            m.hotel ??
                            (propertyIdRaw !== undefined && propertyIdRaw !== null
                                ? propertyNameById.get(String(propertyIdRaw))
                                : null) ??
                            "Unknown";

                        const rawScheduled = m.scheduled_date ?? m.scheduledDate ?? date;
                        const scheduledDate = (() => {
                            try {
                                if (!rawScheduled) return date;
                                if (typeof rawScheduled === 'string') return rawScheduled.split('T')[0];
                                return String(rawScheduled);
                            } catch {
                                return date;
                            }
                        })();

                        return {
                            id,
                            serviceUserId:
                                serviceUserIdRaw !== undefined && serviceUserIdRaw !== null
                                    ? String(serviceUserIdRaw)
                                    : "",
                            propertyId:
                                propertyIdRaw !== undefined && propertyIdRaw !== null
                                    ? String(propertyIdRaw)
                                    : "",
                            serviceUser,
                            property,
                            mealType:
                                m.meal_type ?? m.mealType ?? m.type ?? m.meal ?? "Breakfast",
                            portion: m.portion ?? m.size ?? m.portion_size ?? "Standard",
                            dietary: m.dietary ?? m.diet ?? m.allergies ?? "-",
                            status:
                                m.status ??
                                m.state ??
                                (m.consumed
                                    ? "Consumed"
                                    : m.is_consumed
                                        ? "Consumed"
                                        : "Pending") ??
                                "Pending",
                            scheduledDate,
                            notes: m.notes || "",
                        };
                    };
                    normalizedMeals = ms.map((m, idx) => normalize(m, idx));
                    setMeals(normalizedMeals);
                } else {
                    normalizedMeals = [];
                    setMeals([]);
                }

                try {
                    localStorage.setItem(`mealManagementSnapshot.v1.${date}`, JSON.stringify({
                        properties: nextProperties,
                        serviceUsers: nextServiceUsers,
                        meals: normalizedMeals,
                    }));
                } catch {
                }
            } catch (err) {
                console.warn("Failed to load meal page data", err?.message || err);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, [api, date]);

    const counts = useMemo(() => {
        const total = meals.length;
        const consumed = meals.filter(
            (m) => String(m.status).toLowerCase() === "consumed"
        ).length;
        const pending = meals.filter(
            (m) => String(m.status).toLowerCase() !== "consumed"
        ).length;
        return { total, consumed, pending };
    }, [meals]);

    const tabs = useMemo(() => {
        const all = meals.length;
        const breakfast = meals.filter(
            (m) => m.mealType && String(m.mealType).toLowerCase() === "breakfast"
        ).length;
        const lunch = meals.filter(
            (m) => m.mealType && String(m.mealType).toLowerCase() === "lunch"
        ).length;
        const dinner = meals.filter(
            (m) => m.mealType && String(m.mealType).toLowerCase() === "dinner"
        ).length;
        return { all, breakfast, lunch, dinner };
    }, [meals]);

    function filteredMeals() {
        let list = meals.filter((m) => {
            if (selectedProperty && String(m.property) !== String(selectedProperty))
                return false;

            // Filter by meal type
            if (filterMealType !== 'All Meals') {
                const type = m.mealType ? String(m.mealType).toLowerCase() : "";
                if (type !== filterMealType.toLowerCase()) return false;
            }

            // Filter by status
            if (filterStatus !== 'All Status') {
                const status = String(m.status).toLowerCase();
                if (status !== filterStatus.toLowerCase()) return false;
            }

            const type = m.mealType ? String(m.mealType).toLowerCase() : "";
            if (activeTab === "breakfast") return type === "breakfast";
            if (activeTab === "lunch") return type === "lunch";
            if (activeTab === "dinner") return type === "dinner";
            return true;
        });

        // Apply sorting
        if (sortBy) {
            list = [...list].sort((a, b) => {
                if (sortBy === 'date') {
                    const dateA = new Date(a.scheduledDate || 0);
                    const dateB = new Date(b.scheduledDate || 0);
                    return dateB - dateA;
                }
                if (sortBy === 'mealType') {
                    return (a.mealType || '').localeCompare(b.mealType || '');
                }
                if (sortBy === 'status') {
                    return (a.status || '').localeCompare(b.status || '');
                }
                if (sortBy === 'serviceUser') {
                    return (a.serviceUser || '').localeCompare(b.serviceUser || '');
                }
                return 0;
            });
        }

        return list;
    }

    const exportColumns = useMemo(() => {
        return [
            { header: 'Service User', key: 'serviceUser' },
            { header: 'Property', key: 'property' },
            { header: 'Meal Type', key: 'mealType' },
            { header: 'Portion', key: 'portion' },
            { header: 'Dietary', key: 'dietary' },
            { header: 'Status', key: 'status' },
            { header: 'Scheduled Date', key: 'scheduledDate' },
            { header: 'Notes', key: 'notes' },
        ];
    }, []);

    useEffect(() => {
        const nextKeys = exportColumns.map((c) => c.key);
        setSelectedExportKeys((prev) => {
            const prevSet = new Set(prev);
            const merged = nextKeys.filter((k) => prevSet.has(k));
            if (merged.length === 0) return nextKeys;
            for (const k of nextKeys) {
                if (!prevSet.has(k)) merged.push(k);
            }
            return merged;
        });
    }, [exportColumns]);

    const normalizeMealExportRow = (m) => {
        return {
            serviceUser: m.serviceUser || m.service_user_name || 'N/A',
            property: m.property || m.property_name || 'N/A',
            mealType: m.mealType || m.meal_type || 'N/A',
            portion: m.portion || 'N/A',
            dietary: m.dietary || 'N/A',
            status: m.status || 'N/A',
            scheduledDate: m.scheduledDate || m.scheduled_date || date || '',
            notes: m.notes || '',
        };
    };

    const openExport = (format) => {
        setExportFormat(format);
        setShowExportModal(true);
        setSelectedExportKeys((prev) => (prev && prev.length ? prev : exportColumns.map((c) => c.key)));
    };

    const closeExport = () => {
        setShowExportModal(false);
        setExportFormat(null);
    };

    const runExport = () => {
        try {
            const keySet = new Set(selectedExportKeys || []);
            const columns = (exportColumns || []).filter((c) => keySet.has(c.key));
            if (!columns.length) {
                alert('Please select at least one column to download.');
                return;
            }

            const data = (filteredMeals() || []).map(normalizeMealExportRow);

            if (exportFormat === 'pdf') {
                generatePDF(data, columns, 'Meals Report', 'meals-report');
            } else if (exportFormat === 'csv') {
                generateCSV(data, columns, 'meals-report');
            }

            closeExport();
        } catch (error) {
            console.error('Error exporting meals:', error);
            alert('Failed to download: ' + error.message);
        }
    };

    async function markConsumed(id) {
        if (!canUpdatePage) {
            setAlertDialog({
                isOpen: true,
                title: 'Permission Denied',
                message: 'You do not have permission to update meals.',
                type: 'warning'
            });
            return;
        }
        setMeals((prev) =>
            prev.map((m) =>
                String(m.id) === String(id) ? { ...m, status: "Consumed" } : m
            )
        );
        try {
            await api
                .patch(`/api/meals/${encodeURIComponent(id)}`, { status: "Consumed" })
                .catch(() => null);
        } catch {
            /* swallow */
        }
    }

    async function markNotConsumed(id) {
        if (!canUpdatePage) {
            setAlertDialog({
                isOpen: true,
                title: 'Permission Denied',
                message: 'You do not have permission to update meals.',
                type: 'warning'
            });
            return;
        }
        setMeals((prev) =>
            prev.map((m) =>
                String(m.id) === String(id) ? { ...m, status: "Pending" } : m
            )
        );
        try {
            await api
                .patch(`/api/meals/${encodeURIComponent(id)}`, { status: "Pending" })
                .catch(() => null);
        } catch {
            /* swallow */
        }
    }

    async function createMeal(payload) {
        if (!canCreatePage) {
            setAlertDialog({
                isOpen: true,
                title: 'Permission Denied',
                message: 'You do not have permission to create meals.',
                type: 'warning'
            });
            return;
        }
        const tempId = `tmp-${Date.now()}`;
        const row = {
            id: tempId,
            serviceUserId: payload.service_user_id,
            propertyId: payload.property_id,
            serviceUser: payload.service_user_name || "Unknown",
            property: payload.property_name || "",
            mealType: payload.meal_type || "Breakfast",
            portion: payload.portion || "Standard",
            dietary: payload.dietary || "-",
            status: payload.status || "Pending",
            scheduledDate: payload.scheduled_date,
            notes: payload.notes || "",
        };

        setMeals((prev) => [row, ...prev]);

        try {
            const res = await api.post("/api/meals", payload);
            const saved = res?.data?.row ?? res?.data;
            if (saved) {
                const normalized = {
                    id: saved.id ?? saved.meal_id ?? tempId,
                    serviceUserId: saved.service_user_id ?? row.serviceUserId,
                    propertyId: saved.property_id ?? row.propertyId,
                    serviceUser: saved.service_user_name ?? row.serviceUser,
                    property: saved.property_name ?? row.property,
                    mealType: saved.meal_type ?? row.mealType,
                    portion: saved.portion ?? row.portion,
                    dietary: saved.dietary ?? row.dietary,
                    status: saved.status ?? row.status,
                    scheduledDate: saved.scheduled_date ?? row.scheduledDate,
                    notes: saved.notes ?? row.notes,
                };
                setMeals((prev) =>
                    prev.map((m) => (String(m.id) === String(tempId) ? normalized : m))
                );
            }
        } catch (err) {
            console.warn("Failed to create meal on server", err?.message || err);
            // revert optimistic row
            setMeals((prev) => prev.filter((m) => m.id !== tempId));
            setAlertDialog({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save meal. Please try again.',
                type: 'error'
            });
        }
    }

    function handleView(m) {
        setViewingMeal(m);
    }

    function handleEdit(m) {
        if (!canUpdatePage) {
            setAlertDialog({
                isOpen: true,
                title: 'Permission Denied',
                message: 'You do not have permission to update meals.',
                type: 'warning'
            });
            return;
        }
        setEditingMeal(m);
        setShowScheduleModal(true);
    }

    const handleDeleteMeal = async (meal) => {
        if (!canDeletePage) {
            setAlertDialog({
                isOpen: true,
                title: 'Permission Denied',
                message: 'You do not have permission to delete meals.',
                type: 'warning'
            });
            return;
        }
        if (!meal) return;

        setConfirmDialog({
            isOpen: true,
            title: 'Delete Meal',
            message: 'Delete this meal? This action cannot be undone.',
            type: 'danger',
            confirmText: 'Confirm',
            onConfirm: async () => {
                try {
                    setDeleting(true);

                    const id = meal.id;
                    setDeletingIds(prev => new Set(prev).add(id));

                    const ANIM_DURATION = 460;
                    setTimeout(() => {
                        setMeals(prev => (Array.isArray(prev) ? prev.filter(x => String(x.id) !== String(id)) : prev));
                        setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    }, ANIM_DURATION);

                    // Skip API for temporary items (same logic)
                    if (
                        meal.id &&
                        String(meal.id).startsWith("tmp-")
                    ) {
                        return;
                    }

                    await api
                        .delete(`/api/meals/${encodeURIComponent(meal.id)}`)
                        .catch(() => null);
                } catch (err) {
                    console.warn("Failed to delete meal", err?.message || err);
                    setDeletingIds(prev => { const next = new Set(prev); next.delete(meal?.id); return next; });
                    setAlertDialog({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete meal.',
                        type: 'error'
                    });
                } finally {
                    setDeleting(false);
                }
            },
        });
    };

    async function updateMeal(id, payload) {
        if (!canUpdatePage) {
            setAlertDialog({
                isOpen: true,
                title: 'Permission Denied',
                message: 'You do not have permission to update meals.',
                type: 'warning'
            });
            setEditingMeal(null);
            return;
        }
        // keep a copy so we can revert on failure
        const prevMeals = [...meals];
        setMeals((prev) =>
            prev.map((m) =>
                String(m.id) === String(id)
                    ? {
                        ...m,
                        serviceUser: payload.service_user_name ?? m.serviceUser,
                        property: payload.property_name ?? m.property,
                        mealType: payload.meal_type ?? m.mealType,
                        portion: payload.portion ?? m.portion,
                        dietary: payload.dietary ?? m.dietary,
                        status: payload.status ?? m.status,
                        serviceUserId: payload.service_user_id ?? m.serviceUserId,
                        propertyId: payload.property_id ?? m.propertyId,
                        notes: payload.notes ?? m.notes,
                    }
                    : m
            )
        );

        try {
            await api.patch(`/api/meals/${encodeURIComponent(id)}`, payload);
        } catch (err) {
            console.warn("Failed to update meal on server", err?.message || err);
            // revert optimistic update
            setMeals(prevMeals);
            setAlertDialog({
                isOpen: true,
                title: 'Error',
                message: 'Failed to update meal on server',
                type: 'error'
            });
        } finally {
            setEditingMeal(null);
        }
    }

    if (permissionsLoading) {
        return (
            <div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700">
                <div className="p-3 sm:p-4 md:p-6">
                    <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">Loading...</div>
                </div>
            </div>
        );
    }

    if (!canReadPage) {
        return (
            <div className="p-8 bg-gray-50 min-h-screen font-sans text-slate-700">
                <div className="p-3 sm:p-4 md:p-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-700">
                        You do not have permission to view Meals.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">
                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Breadcrumbs items={[{ label: 'Meals' }, { label: 'Meal Management' }]} />
                        <h1 className="text-3xl font-black text-slate-900 mt-1">Meal Management Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <DownloadDropdown
                            onDownloadPDF={() => openExport('pdf')}
                            onDownloadCSV={() => openExport('csv')}
                        />
                    </div>
                </div>

                {showExportModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Select the columns you want to include</div>
                                </div>
                                <button
                                    onClick={closeExport}
                                    className="p-2 rounded-xl text-gray-500"
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm font-medium text-gray-700">Columns</div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <button
                                            onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))}
                                            className="text-teal-600 font-medium rounded-xl"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            onClick={() => setSelectedExportKeys([])}
                                            className="text-gray-600 font-medium rounded-xl"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto pr-1">
                                    {exportColumns.map((col) => {
                                        const checked = (selectedExportKeys || []).includes(col.key);
                                        return (
                                            <label
                                                key={col.key}
                                                className="flex items-center gap-2 p-2 rounded-xl border border-gray-100"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setSelectedExportKeys((prev) => {
                                                            const set = new Set(prev || []);
                                                            if (isChecked) set.add(col.key);
                                                            else set.delete(col.key);
                                                            return Array.from(set);
                                                        });
                                                    }}
                                                    className="w-4 h-4 text-teal-600 rounded-xl"
                                                />
                                                <span className="text-sm text-gray-700">{col.header}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    onClick={closeExport}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={runExport}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl transition-colors"
                                >
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SCHEDULE MODAL --- */}
                {showScheduleModal && (
                    <ScheduleMealModal
                        serviceUsers={serviceUsers}
                        properties={properties}
                        initialDate={date}
                        initialData={editingMeal}
                        onClose={() => {
                            setShowScheduleModal(false);
                            setEditingMeal(null);
                        }}
                        onCreate={async (payload) => {
                            if (!canCreatePage) {
                                setAlertDialog({
                                    isOpen: true,
                                    title: 'Permission Denied',
                                    message: 'You do not have permission to create meals.',
                                    type: 'warning'
                                });
                                return;
                            }
                            await createMeal(payload);
                            setShowScheduleModal(false);
                        }}
                        onUpdate={async (id, payload) => {
                            if (!canUpdatePage) {
                                setAlertDialog({
                                    isOpen: true,
                                    title: 'Permission Denied',
                                    message: 'You do not have permission to update meals.',
                                    type: 'warning'
                                });
                                return;
                            }
                            await updateMeal(id, payload);
                            setShowScheduleModal(false);
                        }}
                        onError={(message) => {
                            setAlertDialog({
                                isOpen: true,
                                title: 'Error',
                                message: message,
                                type: 'error'
                            });
                        }}
                    />
                )}

                {/* --- VIEW DETAILS MODAL --- */}
                {viewingMeal && (
                    <ViewMealModal
                        meal={viewingMeal}
                        onClose={() => setViewingMeal(null)}
                    />
                )}

                {/* --- UPDATED STAT CARDS (Litigation-style) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Card 1: Total Meals */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all duration-200">
                        <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            {/* Fork and Knife Icon */}
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                                <path d="M7 2v20" />
                                <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Meals</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{counts.total}</div>
                        </div>
                    </div>

                    {/* Card 2: Consumed */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all duration-200">
                        <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            {/* Checkmark Circle Icon */}
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Consumed</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{counts.consumed}</div>
                        </div>
                    </div>

                    {/* Card 3: Pending */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all duration-200">
                        <div className="bg-yellow-100 text-yellow-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Pending</div>
                            <div className="text-2xl font-black text-slate-800 leading-none">{counts.pending}</div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area - Meal Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-200">
                    {/* Table Header Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-1">All Scheduled Meals</h2>
                                <p className="text-sm text-gray-500">{filteredMeals().length} total records</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* View Menu */}
                                <div className="relative" ref={viewRef}>
                                    <button
                                        onClick={() => setShowViewMenu(!showViewMenu)}
                                        className="bg-white border border-gray-300 text-gray-700 rounded-xl px-4 py-2 text-sm font-medium transition-all flex items-center gap-2"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span>View</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </button>

                                    {/* View Settings Dropdown */}
                                    {showViewMenu && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                                            <div className="p-4">
                                                <h3 className="text-sm font-semibold text-gray-900 mb-3">View settings</h3>
                                                <button
                                                    onClick={() => setShowPropertyVisibility(!showPropertyVisibility)}
                                                    className="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 rounded-xl transition-colors"
                                                >
                                                    <span className="font-medium">Column visibility</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500">
                                                            {Object.values(visibleColumns).filter(Boolean).length} shown
                                                        </span>
                                                        <ChevronDown className={`w-4 h-4 transition-transform ${showPropertyVisibility ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </button>

                                                {/* Column Visibility Panel */}
                                                {showPropertyVisibility && (
                                                    <div className="mt-2 border-t border-gray-200 pt-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Default columns</span>
                                                            <div className="text-xs font-medium">
                                                                <button
                                                                    onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}))}
                                                                    className="text-teal-600 rounded-xl"
                                                                    type="button"
                                                                >
                                                                    Show all
                                                                </button>
                                                                <span className="text-gray-300 mx-2">|</span>
                                                                <button
                                                                    onClick={() => setVisibleColumns(ALL_COLUMNS.reduce((a, c) => ({ ...a, [c]: false }), {}))}
                                                                    className="text-teal-600 rounded-xl"
                                                                    type="button"
                                                                >
                                                                    Hide all
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-gray-500 mb-3">Toggle column visibility by clicking</div>

                                                        <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                                                            {ALL_COLUMNS.map((col) => {
                                                                const isVisible = Boolean(visibleColumns[col]);
                                                                const label = col === 'serviceUser'
                                                                    ? 'Service User'
                                                                    : col === 'mealType'
                                                                        ? 'Meal Type'
                                                                        : col.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

                                                                return (
                                                                    <button
                                                                        key={col}
                                                                        type="button"
                                                                        onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !isVisible })}
                                                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white transition-colors"
                                                                    >
                                                                        <span className={`text-sm font-medium ${isVisible ? 'text-gray-800' : 'text-gray-400'}`}>
                                                                            {label}
                                                                        </span>
                                                                        {isVisible ? (
                                                                            <Eye className="w-4 h-4 text-teal-600" />
                                                                        ) : (
                                                                            <EyeOff className="w-4 h-4 text-gray-400" />
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {canCreatePage && (
                                    <button
                                        onClick={() => {
                                            setEditingMeal(null);
                                            setShowScheduleModal(true);
                                        }}
                                        className="bg-teal-500 text-white font-medium rounded-xl py-2.5 px-5 text-sm flex items-center gap-2 transition-all shadow-md "
                                    >
                                        <span className="text-lg leading-none">+</span>
                                        <span>Schedule Meal</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Row */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={filterMealType}
                                    onChange={e => setFilterMealType(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option>All Meals</option>
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="dinner">Dinner</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option>All Status</option>
                                    <option value="pending">Not Consumed</option>
                                    <option value="consumed">Consumed</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={selectedProperty}
                                    onChange={e => setSelectedProperty(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">All Properties</option>
                                    {properties.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <Columns className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="bg-white border border-gray-300 rounded-xl pl-10 pr-8 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">Sort By</option>
                                    <option value="date">Date (Newest)</option>
                                    <option value="mealType">Meal Type</option>
                                    <option value="status">Status</option>
                                    <option value="serviceUser">Service User</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            <input
                                type="date"
                                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />

                            {(filterMealType !== 'All Meals' || filterStatus !== 'All Status' || selectedProperty || sortBy) && (
                                <button
                                    onClick={() => {
                                        setFilterMealType('All Meals');
                                        setFilterStatus('All Status');
                                        setSelectedProperty('');
                                        setSortBy('');
                                    }}
                                    className="bg-gray-100 text-gray-700 rounded-xl px-4 py-2 text-sm font-medium transition-all flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Switcher - Bookings Style */}
                    <div className="mb-6 flex items-center gap-3 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "all"
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500'
                                }`}
                        >
                            All Meals
                        </button>
                        <button
                            onClick={() => setActiveTab("breakfast")}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "breakfast"
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500'
                                }`}
                        >
                            Breakfast
                        </button>
                        <button
                            onClick={() => setActiveTab("lunch")}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "lunch"
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500'
                                }`}
                        >
                            Lunch
                        </button>
                        <button
                            onClick={() => setActiveTab("dinner")}
                            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "dinner"
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500'
                                }`}
                        >
                            Dinner
                        </button>
                    </div>

                    {/* Data Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    {visibleColumns.serviceUser && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">SERVICE USER</th>}
                                    {visibleColumns.property && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PROPERTY</th>}
                                    {visibleColumns.mealType && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">MEAL TYPE</th>}
                                    {visibleColumns.portion && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PORTION</th>}
                                    {visibleColumns.dietary && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">DIETARY</th>}
                                    {visibleColumns.status && <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>}
                                    {visibleColumns.actions && <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTIONS</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={Object.values(visibleColumns).filter(Boolean).length}
                                            className="px-4 py-12 text-center text-slate-400"
                                        >
                                            Loading meals...
                                        </td>
                                    </tr>
                                ) : filteredMeals().length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={Object.values(visibleColumns).filter(Boolean).length}
                                            className="px-4 py-12 text-center text-slate-400"
                                        >
                                            No meals found for this selection.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMeals().map((m) => {
                                        const isDeleting = deletingIds.has(m.id);
                                        return (
                                            <tr
                                                key={m.id}
                                                className={`transition-colors ${isDeleting ? 'meal-deleting' : ''}`}
                                            >
                                                {visibleColumns.serviceUser && <td className="px-4 py-3 font-medium text-gray-900">{m.serviceUser}</td>}
                                                {visibleColumns.property && <td className="px-4 py-3 text-gray-700">{m.property}</td>}
                                                {visibleColumns.mealType && <td className="px-4 py-3 text-gray-700">{m.mealType}</td>}
                                                {visibleColumns.portion && <td className="px-4 py-3 text-gray-700">{m.portion}</td>}
                                                {visibleColumns.dietary && <td className="px-4 py-3 text-gray-700">{m.dietary}</td>}
                                                {visibleColumns.status && (
                                                    <td className="px-4 py-3">
                                                        {String(m.status).toLowerCase() === "consumed" ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                                Consumed
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                {visibleColumns.actions && (
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                title="View Details"
                                                                onClick={() => handleView(m)}
                                                                className="group relative p-2 text-gray-400 rounded-xl"
                                                            >
                                                                <IconEye />
                                                            </button>
                                                            {canUpdatePage && (
                                                                <button
                                                                    title="Edit"
                                                                    onClick={() => handleEdit(m)}
                                                                    className="group relative p-2 text-gray-400 rounded-xl"
                                                                >
                                                                    <IconEdit />
                                                                </button>
                                                            )}
                                                            {canDeletePage && (
                                                                <button
                                                                    title="Delete"
                                                                    onClick={() => handleDeleteMeal(m)}
                                                                    className="group relative p-2 text-gray-400 rounded-xl"
                                                                >
                                                                    <IconTrash />
                                                                </button>
                                                            )}

                                                            {canUpdatePage && (
                                                                String(m.status).toLowerCase() === "consumed" ? (
                                                                    <button
                                                                        onClick={() => markNotConsumed(m.id)}
                                                                        className="ml-1 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-medium border border-amber-200"
                                                                        title="Mark as Not Consumed"
                                                                    >
                                                                        Not Consumed
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => markConsumed(m.id)}
                                                                        className="ml-1 px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-700 text-xs font-medium border border-teal-200"
                                                                        title="Mark as Consumed"
                                                                    >
                                                                        Mark Consumed
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
                confirmText={confirmDialog.confirmText || 'Confirm'}
            />

            {/* Alert Dialog */}
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
                title={alertDialog.title}
                message={alertDialog.message}
                type={alertDialog.type}
            />
        </div>
    );
}

// --- VIEW DETAILS MODAL helper ---
const DetailField = ({ label, value, fullWidth = false }) => (
    <div className={fullWidth ? "md:col-span-2" : ""}>
        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{label}</div>
        <div className="text-slate-800 font-medium text-sm">{value || '-'}</div>
    </div>
);

// --- VIEW DETAILS MODAL ---
function ViewMealModal({ meal, onClose }) {
    if (!meal) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full h-[70vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Meal Details</h2>
                        <p className="text-xs text-gray-500 mt-1">View meal schedule information</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 transition-colors rounded-xl p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailField label="Service User" value={meal.serviceUser} />
                        <DetailField label="Property" value={meal.property} />
                        <DetailField
                            label="Scheduled Date"
                            value={new Date(meal.scheduledDate).toLocaleDateString(
                                undefined,
                                {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                }
                            )}
                        />
                        <DetailField label="Meal Type" value={meal.mealType} />
                        <DetailField label="Portion Size" value={meal.portion} />
                        <DetailField label="Dietary Needs" value={meal.dietary} />
                        <DetailField label="Status" value={meal.status} />
                        <DetailField label="Additional Notes" value={meal.notes} fullWidth={true} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function ScheduleMealModal({
    serviceUsers = [],
    properties = [],
    initialDate = null,
    initialData = null,
    onClose = () => { },
    onCreate = async () => { },
    onUpdate = async () => { },
    onError = () => { },
}) {
    const [form, setForm] = useState({
        serviceUserId: "",
        propertyId: "",
        mealType: "Breakfast",
        scheduledDate: initialDate || new Date().toISOString().slice(0, 10),
        portion: "Standard",
        dietary: "",
        notes: "",
    });

    // Effect to populate form when editing
    useEffect(() => {
        if (initialData) {
            setForm({
                serviceUserId: initialData.serviceUserId || "",
                propertyId: initialData.propertyId || "",
                mealType: initialData.mealType || "Breakfast",
                scheduledDate:
                    (initialData.scheduledDate || "").split('T')[0] || new Date().toISOString().slice(0, 10),
                portion: initialData.portion || "Standard",
                dietary: initialData.dietary || "",
                notes: initialData.notes || "",
            });
        } else {
            // Reset if creating new
            setForm({
                serviceUserId: "",
                propertyId: "",
                mealType: "Breakfast",
                scheduledDate: initialDate || new Date().toISOString().slice(0, 10),
                portion: "Standard",
                dietary: "",
                notes: "",
            });
        }
    }, [initialData, initialDate]);

    function handleChange(field, value) {
        if (field === "serviceUserId") {
            const su = (Array.isArray(serviceUsers) ? serviceUsers : []).find(
                (s) => String(s.id) === String(value)
            );
            const nextPropertyId = su?.propertyId ? String(su.propertyId) : "";
            setForm((f) => ({
                ...f,
                serviceUserId: value,
                propertyId: nextPropertyId,
            }));
            return;
        }
        setForm((f) => ({ ...f, [field]: value }));
    }

    async function handleSubmit(e) {
        e?.preventDefault?.();
        if (!form.serviceUserId) {
            onError("Please select a service user.");
            return;
        }
        if (!form.propertyId) {
            onError("Please select a property.");
            return;
        }
        if (!form.mealType) {
            onError("Please select a meal type.");
            return;
        }
        if (!form.scheduledDate) {
            onError("Please select a scheduled date.");
            return;
        }
        if (!form.portion) {
            onError("Please select a portion size.");
            return;
        }
        if (!String(form.dietary || "").trim()) {
            onError("Please enter dietary requirements.");
            return;
        }
        if (!String(form.notes || "").trim()) {
            onError("Please enter notes.");
            return;
        }
        const payload = {
            service_user_id: form.serviceUserId,
            service_user_name:
                (
                    serviceUsers.find(
                        (s) => String(s.id) === String(form.serviceUserId)
                    ) || {}
                ).name || null,
            property_id: form.propertyId,
            property_name:
                (properties.find((p) => String(p.id) === String(form.propertyId)) || {})
                    .name || null,
            meal_type: form.mealType,
            scheduled_date: form.scheduledDate,
            portion: form.portion,
            dietary: form.dietary,
            notes: form.notes,
            status: initialData ? initialData.status : "Pending",
        };

        try {
            if (initialData && initialData.id) {
                await onUpdate(initialData.id, payload);
            } else {
                await onCreate(payload);
            }
        } catch (err) {
            console.error("save meal failed", err);
            onError('Failed to save meal');
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-container h-[70vh]">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">
                            {initialData ? "Edit Meal" : "Schedule Meal"}
                        </h2>
                        <p className="modal-subtitle">
                            {initialData
                                ? "Update existing meal details"
                                : "Create a new meal plan for a service user"}
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-xl modal-close-btn">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="modal-content">
                    <form id="mealForm" onSubmit={handleSubmit} className="form-section">
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Service User <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    value={form.serviceUserId}
                                    onChange={(e) => handleChange("serviceUserId", e.target.value)}
                                >
                                    <option value="">Select a service user</option>
                                    {serviceUsers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Property <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    value={form.propertyId}
                                    onChange={(e) => handleChange("propertyId", e.target.value)}
                                >
                                    <option value="">Select a property</option>
                                    {properties.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-grid-2">
                            <div className="form-group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Meal Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    value={form.mealType}
                                    onChange={(e) => handleChange("mealType", e.target.value)}
                                >
                                    <option>Breakfast</option>
                                    <option>Lunch</option>
                                    <option>Dinner</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Scheduled Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="date"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    value={form.scheduledDate}
                                    onChange={(e) => handleChange("scheduledDate", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-grid-2">
                            <div className="form-group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Portion Size <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                    value={form.portion}
                                    onChange={(e) => handleChange("portion", e.target.value)}
                                >
                                    <option>Standard</option>
                                    <option>Small</option>
                                    <option>Large</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Dietary Requirements <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    value={form.dietary}
                                    onChange={(e) => handleChange("dietary", e.target.value)}
                                    placeholder="e.g., Vegetarian, Halal, Gluten-free"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Notes <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                required
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 h-auto resize-none"
                                rows={3}
                                value={form.notes}
                                onChange={(e) => handleChange("notes", e.target.value)}
                                placeholder="Additional notes about this meal"
                            />
                        </div>
                    </form>
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="rounded-xl btn-secondary">
                        Cancel
                    </button>
                    <button type="submit" form="mealForm" className="rounded-xl btn-primary">
                        {initialData ? "Save Changes" : "Create Meal Plan"}
                    </button>
                </div>
            </div>
        </div>
    );
}