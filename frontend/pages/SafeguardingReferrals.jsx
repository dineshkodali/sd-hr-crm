/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ImageGalleryModal, { useImageGallery } from '../components/ImageGalleryModal';
import axios from 'axios';
import { usePermissions } from '../hooks/usePermissions';
import {
    Home, AlertCircle, Search, ChevronDown, Filter,
    Columns, Download, X, Edit, Trash2, Eye, EyeOff, Check
} from "lucide-react";
import { generatePDF } from "../utils/pdfGenerator";
import { generateCSV } from "../utils/csvGenerator";
import { DownloadDropdown } from "../components/DownloadDropdown";
import Breadcrumbs from "../components/Breadcrumbs";

/* Inject delete animation CSS once */
const DELETE_STYLE_ID = 'safeguarding-referrals-delete-anim';
if (typeof document !== 'undefined' && !document.getElementById(DELETE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = DELETE_STYLE_ID;
    style.textContent = `
      @keyframes safeguardingSlideOut {
        0%   { opacity: 1; transform: translateX(0) scaleY(1); max-height: 80px; }
        40%  { opacity: 0.3; transform: translateX(40px) scaleY(0.85); background: #fee2e2; max-height: 80px; }
        100% { opacity: 0; transform: translateX(80px) scaleY(0); max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border: none; }
      }
      @keyframes safeguardingCardDelete {
        0%   { opacity: 1; transform: scale(1) rotate(0deg); }
        30%  { opacity: 0.6; transform: scale(1.04) rotate(-1.5deg); background: #fee2e2; }
        100% { opacity: 0; transform: scale(0.7) rotate(3deg); max-height: 0; margin: 0; padding: 0; overflow: hidden; }
      }
      tr.safeguarding-deleting {
        animation: safeguardingSlideOut 0.45s cubic-bezier(0.4,0,1,1) forwards;
        overflow: hidden;
        pointer-events: none;
      }
      .safeguarding-card-deleting {
        animation: safeguardingCardDelete 0.45s cubic-bezier(0.4,0,1,1) forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
}

function normalizeHotelsResponse(data) {
    if (!data) return [];
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data.rows)) items = data.rows;
    else if (Array.isArray(data.hotels)) items = data.hotels;
    else if (typeof data === 'object') {
        const vals = Object.values(data);
        const possibleObjects = vals.filter((v) => v && (v.id || v.name || v.hotel_name));
        if (possibleObjects.length && !Array.isArray(data)) {
            items = Array.isArray(possibleObjects[0]) ? possibleObjects[0] : possibleObjects;
        }
    }
    return items.map((h) => {
        const id = h?.id ?? h?.hotel_id ?? h?._id ?? null;
        const name = h?.name ?? h?.title ?? h?.hotel_name ?? `${id ?? ''}`;
        return { id, name };
    }).filter((x) => x.id && x.name);
}

function formatDate(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return value; }
}

function formatDateISO(value) {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toISOString().slice(0, 10);
    } catch { return value; }
}

function getPriorityColor(p) {
    const low = String(p).toLowerCase();
    if (low === "urgent" || low === "high" || low === "critical") return { dot: "bg-red-500", text: "text-red-600" };
    if (low === "medium") return { dot: "bg-orange-400", text: "text-orange-500" };
    return { dot: "bg-green-500", text: "text-green-600" };
}

function getStatusColor(s) {
    const low = String(s).toLowerCase();
    if (low === "completed" || low === "closed" || low === "resolved") return { dot: "bg-green-500", text: "text-green-700" };
    if (low === "pending" || low === "open" || low === "new") return { dot: "bg-orange-400", text: "text-orange-600" };
    if (low === "under review" || low === "in progress") return { dot: "bg-purple-500", text: "text-purple-700" };
    if (low === "escalated") return { dot: "bg-red-500", text: "text-red-700" };
    return { dot: "bg-gray-400", text: "text-gray-600" };
}

function getAvatarColor() { return "bg-teal-100 text-teal-700"; }

function getInitials(name) {
    if (!name || name === "Unassigned") return "UA";
    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().slice(0, 2);
}

const priorityColors = { 'Urgent': '#EF4444', 'High': '#F97316', 'Medium': '#EABF00', 'Low': '#10B981' };
const categoryOptions = ['Safety Concern', 'Workplace Harassment', 'Welfare Check', 'Domestic Risk', 'Behavioral Conflict', 'Resident Support'];
const CATEGORY_STORAGE_KEY = 'safeguardingReferralsCustomCategories';

export default function SafeguardingReferrals({ user }) {

    const currentUser = user || (() => {
        try { const raw = localStorage.getItem("user"); return raw ? JSON.parse(raw) : null; } catch { return null; }
    })();

    const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
    const hasCreate = canCreate("safeguarding_referrals");
    const hasUpdate = canUpdate("safeguarding_referrals");
    const hasDelete = canDelete("safeguarding_referrals");

    // Image gallery hook — opens in-page modal instead of new tab
    const { galleryOpen: _galleryOpen, galleryItems: _galleryItems, galleryTitle: _galleryTitle, galleryApi: _galleryApi, openGallery: _openGallery, closeGallery: _closeGallery } = useImageGallery();

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [deleting, setDeleting] = useState(false);
    // Track rows/cards currently being deleted for animation
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [error, setError] = useState(null);
    const [hotels, setHotels] = useState([]);
    const [setHotelsLoading] = useState(false);
    const [referrals, setReferrals] = useState([]);
    const [referralsLoading, setReferralsLoading] = useState(false);
    const [selectedReferral, setSelectedReferral] = useState(null);
    const [modalMode, setModalMode] = useState('create');
    const [staffUsers, setStaffUsers] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);

    const [query, setQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [propertyFilter, setPropertyFilter] = useState('');
    const [sortBy, setSortBy] = useState('');

    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showPropertyVisibility, setShowPropertyVisibility] = useState(false);
    const [viewMode, setViewMode] = useState('table');
    const viewRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '', description: '', property_id: '', property_name: '',
        category: '', priority: 'Medium', assigned_to: '', reported_by: '',
        scheduled_date: '', status: 'Open'
    });

    const [customCategories, setCustomCategories] = useState([]);
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

    const DEFAULT_COLUMNS = ["checkbox", "type", "reference", "description", "priority", "status", "assigned", "date", "attachments", "actions"];

    const [customColumns, setCustomColumns] = useState([]);
    const [availableColumns, setAvailableColumns] = useState([]);
    const [customColumnMetadata, setCustomColumnMetadata] = useState({});

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('safeguardingReferralsVisibleColumns');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {}), ...parsed };
            }
        } catch (e) { console.warn('Failed to load column visibility', e); }
        return DEFAULT_COLUMNS.reduce((a, c) => ({ ...a, [c]: true }), {});
    });

    useEffect(() => {
        try { localStorage.setItem('safeguardingReferralsVisibleColumns', JSON.stringify(visibleColumns)); }
        catch (e) { console.warn('Failed to save column visibility', e); }
    }, [visibleColumns]);

    const api = useMemo(() => axios.create({ baseURL: import.meta.env.VITE_API_URL || '', withCredentials: true, timeout: 15000 }), []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setCustomCategories(parsed.filter(Boolean).map(String));
        } catch { setCustomCategories([]); }
    }, []);

    useEffect(() => { if (!showCustomCategoryInput) setCustomCategoryValue(''); }, [showCustomCategoryInput]);

    const persistCustomCategories = (list) => {
        try { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(list)); } catch { }
    };

    const handleCategoryChange = (e) => {
        const value = e.target.value;
        if (value === '__add_new__') {
            setShowCustomCategoryInput(true); setCustomCategoryValue('');
            setFormData((p) => ({ ...p, category: '' })); return;
        }
        setShowCustomCategoryInput(false); setCustomCategoryValue('');
        setFormData((p) => ({ ...p, category: value }));
    };

    const saveCustomCategory = () => {
        const next = String(customCategoryValue || '').trim();
        if (!next) return;
        const builtinLower = new Set(categoryOptions.map((t) => String(t).toLowerCase()));
        const merged = [...customCategories];
        if (!builtinLower.has(next.toLowerCase()) && !merged.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
            merged.push(next); setCustomCategories(merged); persistCustomCategories(merged);
        }
        setFormData((p) => ({ ...p, category: next }));
        setShowCustomCategoryInput(false); setCustomCategoryValue('');
    };

    const normalizeStaffResponse = (data) => {
        const list = data?.staff ?? data?.users ?? data?.rows ?? data?.data ?? data ?? [];
        return (Array.isArray(list) ? list : [])
            .map((u) => ({ id: u?.id ?? u?.user_id ?? null, name: u?.name ?? u?.email ?? [u?.first_name, u?.last_name].filter(Boolean).join(' ') ?? '' }))
            .filter((u) => u?.id && u?.name);
    };

    const fetchStaffForHotel = async (hotelId) => {
        if (!hotelId) { setStaffUsers([]); return; }
        try {
            setStaffLoading(true);
            const paths = [`/api/staff/for-hotel/${encodeURIComponent(String(hotelId))}`, `/staff/for-hotel/${encodeURIComponent(String(hotelId))}`];
            let data = null, lastErr = null;
            for (const p of paths) { try { const r = await api.get(p); data = r?.data; if (data) break; } catch (e) { lastErr = e; } }
            if (!data) throw lastErr || new Error('Unable to load staff');
            setStaffUsers(normalizeStaffResponse(data));
        } catch (err) { console.error('fetchStaffForHotel error:', err); setStaffUsers([]); }
        finally { setStaffLoading(false); }
    };

    useEffect(() => {
        let mounted = true;
        const fetchAvailableColumns = async () => {
            try {
                const res = await api.get('/api/forms-builder/tables/safeguarding_referrals/columns');
                if (!mounted) return;
                const cols = res?.data?.columns || res?.data || [];
                const nextMetadata = {};
                (Array.isArray(cols) ? cols : []).forEach((col) => {
                    const name = col?.column_name || col?.name || (typeof col === 'string' ? col : null);
                    if (!name) return;
                    nextMetadata[name] = { input_type: col.input_type || 'text', input_options: col.input_options || [] };
                });
                const columnNames = cols.map(col => typeof col === 'string' ? col : col.column_name || col.name || String(col));
                setAvailableColumns(columnNames);
                const standardCols = ['id', 'reference', 'created_at', 'updated_at', 'created_by', 'updated_by', 'title', 'description', 'property_id', 'property_name', 'category', 'priority', 'assigned_to', 'reported_by', 'scheduled_date', 'status', 'attachments', 'deleted', 'deleted_at'];
                const customCols = columnNames.filter(col => !standardCols.includes(col));
                if (JSON.stringify(customCols) !== JSON.stringify(customColumns)) {
                    setCustomColumns(customCols);
                    setCustomColumnMetadata((prev) => ({ ...prev, ...nextMetadata }));
                    setVisibleColumns(prev => { const updated = { ...prev }; customCols.forEach(col => { if (prev[col] === undefined) updated[col] = true; }); return updated; });
                }
                setCustomColumnMetadata((prev) => ({ ...prev, ...nextMetadata }));
            } catch (err) { console.warn('Failed to fetch custom columns', err); }
        };
        fetchAvailableColumns();
        return () => { mounted = false; };
    }, [api, customColumns]);

    useEffect(() => {
        if (showModal || showDeleteModal) document.body.classList.add('form-modal-open');
        else document.body.classList.remove('form-modal-open');
        return () => document.body.classList.remove('form-modal-open');
    }, [showModal, showDeleteModal]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (viewRef.current && !viewRef.current.contains(e.target)) { setShowViewMenu(false); setShowPropertyVisibility(false); }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const res = await api.get('/api/hotels', { params: { limit: 1000 } }).catch(() => ({ data: [] }));
                if (mounted) setHotels(normalizeHotelsResponse(res?.data ?? {}));
            } catch (err) { console.warn('Failed to load hotels', err); }
        }
        load();
        async function loadReferrals() {
            try {
                setReferralsLoading(true);
                const r = await api.get('/api/safeguarding/referrals?limit=500').catch(() => ({ data: [] }));
                if (mounted) setReferrals(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? []));
            } catch (err) { console.warn('Failed to load referrals', err); }
            finally { if (mounted) setReferralsLoading(false); }
        }
        loadReferrals();
        return () => { mounted = false; };
    }, [api]);

    const refreshReferrals = async () => {
        try {
            setReferralsLoading(true);
            const r = await api.get('/api/safeguarding/referrals?limit=500').catch(() => ({ data: [] }));
            setReferrals(Array.isArray(r?.data) ? r.data : (r?.data?.rows ?? r?.data ?? []));
        } catch (err) { console.warn('refreshReferrals failed', err); }
        finally { setReferralsLoading(false); }
    };

    const handlePropertyChange = (propId) => {
        const prop = hotels.find(h => h.id == propId);
        setFormData(prev => ({ ...prev, property_id: propId, property_name: prop?.name || '', reported_by: currentUser?.name || '', assigned_to: '' }));
    };

    useEffect(() => {
        if (!showModal || modalMode === 'view') return;
        if (!formData?.property_id) { setStaffUsers([]); return; }
        fetchStaffForHotel(formData.property_id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal, modalMode, formData?.property_id]);

    const handleOpenModal = (mode = 'create', referral = null) => {
        setModalMode(mode);
        if (mode === 'create') {
            const baseData = { title: '', description: '', property_id: '', property_name: '', category: '', priority: 'Medium', assigned_to: '', reported_by: currentUser?.name || '', scheduled_date: '', status: 'Open' };

            const customData = {};
            customColumns.forEach(col => { customData[col] = ''; });
            setFormData({ ...baseData, ...customData });
            setSelectedPhotos([]);
            setExistingAttachments([]);
        } else {
            const safeReferral = { ...referral };
            Object.keys(safeReferral).forEach(key => { if (safeReferral[key] === null) safeReferral[key] = ''; });
            setFormData({ ...safeReferral, property_id: referral?.property_id || '', property_name: referral?.property_name || '' });
            setSelectedPhotos([]);
            let atts = safeReferral?.attachments ?? [];
            try {
                if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
            } catch {
                atts = [];
            }
            setExistingAttachments(Array.isArray(atts) ? atts : []);
        }
        setSelectedReferral(referral);
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setModalMode('create'); setSelectedReferral(null); setError(null); setSelectedPhotos([]); setExistingAttachments([]); };

        const openAttachmentsGallery = (items = []) => {
        if (!items.length) return;
        _openGallery(items, "Safeguarding Documents", "/api/safeguarding/attachments");
    };

    const removeAttachment = async (attachmentId) => {
        if (!attachmentId || submitting) return;
        try {
            setSubmitting(true);
            await api.delete(`/api/safeguarding/referrals/attachments/${encodeURIComponent(String(attachmentId))}`).catch(() => null);
            setExistingAttachments((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x) !== String(attachmentId)) : []));
            await refreshReferrals();
        } catch (err) {
            console.warn('removeAttachment failed', err);
        } finally {
            setSubmitting(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault(); setSubmitting(true); setError(null);
        try {

            const missing = [];
            if (!String(formData.title || '').trim()) missing.push('Title');
            if (!String(formData.description || '').trim()) missing.push('Description');
            if (!String(formData.property_id || '').trim()) missing.push('Property');
            if (!String(formData.property_name || '').trim()) missing.push('Property Name');
            if (!String(formData.category || '').trim()) missing.push('Category');
            if (!String(formData.priority || '').trim()) missing.push('Priority');
            if (!String(formData.reported_by || '').trim()) missing.push('Reported By');
            if (!String(formData.assigned_to || '').trim()) missing.push('Assigned To');
            if (!String(formData.scheduled_date || '').trim()) missing.push('Scheduled Date');
            for (const col of customColumns || []) {
                if (col === 'attachments' || col === 'deleted' || col === 'deleted_at') continue;
                const meta = customColumnMetadata[col] || {};
                const v = formData[col];
                if (meta.input_type === 'checkbox') { if (v !== 'true' && v !== 'false') missing.push(col.replace(/_/g, ' ')); }
                else if (v === undefined || v === null || String(v).trim() === '') missing.push(col.replace(/_/g, ' '));
            }
            if (missing.length) { setError(`Please fill required fields: ${missing.join(', ')}.`); setSubmitting(false); return; }
            const payload = { ...formData };
            delete payload.attachments; // Remove attachments from payload to prevent backend corruption

            for (const col of customColumns || []) {
                const meta = customColumnMetadata[col] || {};
                if (meta.input_type === 'checkbox') payload[col] = formData[col] === 'true' ? true : formData[col] === 'false' ? false : null;
                else payload[col] = formData[col];
            }
            const hasPhotos = Array.isArray(selectedPhotos) && selectedPhotos.length > 0;
            if (hasPhotos) {
                const fd = new FormData();
                Object.entries(payload).forEach(([k, v]) => {
                    if (v === undefined || v === null) return;
                    fd.append(k, String(v));
                });
                (selectedPhotos || []).forEach((f) => {
                    if (f) fd.append('photos', f);
                });
                if (modalMode === 'create') await api.post('/api/safeguarding/referrals', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                else await api.patch(`/api/safeguarding/referrals/${selectedReferral?.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                if (modalMode === 'create') await api.post('/api/safeguarding/referrals', payload);
                else await api.patch(`/api/safeguarding/referrals/${selectedReferral?.id}`, payload);
            }
            await refreshReferrals(); handleCloseModal();
        } catch (err) { setError(err?.response?.data?.message || err?.message || 'Submission failed'); }
        finally { setSubmitting(false); }
    };

    const handleDelete = (id) => { setDeleteId(id); setShowDeleteModal(true); };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            setDeleting(true);
            const id = deleteId;
            setDeletingIds(prev => new Set(prev).add(id));
            setShowDeleteModal(false);

            const ANIM_DURATION = 460;
            setTimeout(() => {
                setReferrals(prev => (Array.isArray(prev) ? prev.filter(r => String(r.id) !== String(id)) : prev));
                setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }, ANIM_DURATION);

            await api.delete(`/api/safeguarding/referrals/${id}`).catch(() => null);
            await refreshReferrals();
            setDeleteId(null);
        } catch (err) {
            setError('Delete failed: ' + (err?.response?.data?.message || err?.message));
            setShowDeleteModal(false); setDeleteId(null);
            setDeletingIds(prev => { const next = new Set(prev); next.delete(deleteId); return next; });
        } finally { setDeleting(false); }
    };

    const stats = {
        'New': referrals.filter(r => r.status === 'New').length,
        'Under Review': referrals.filter(r => r.status === 'Under Review').length,
        'Escalated': referrals.filter(r => r.status === 'Escalated').length,
        'Resolved': referrals.filter(r => r.status === 'Resolved').length,
    };

    const filteredReferrals = useMemo(() => {
        const q = (query || "").trim().toLowerCase();
        let filtered = referrals.filter(r => {
            const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.reference?.toLowerCase().includes(q);
            const matchPriority = !filterPriority || r.priority === filterPriority;
            const matchStatus = !filterStatus || r.status === filterStatus;
            const matchProperty = !propertyFilter || String(r.property_id) === String(propertyFilter) || String(r.hotel_id) === String(propertyFilter);
            return matchSearch && matchPriority && matchStatus && matchProperty;
        });
        if (sortBy === "date") filtered.sort((a, b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0));
        else if (sortBy === "priority") { const o = { "Urgent": 0, "High": 1, "Medium": 2, "Low": 3 }; filtered.sort((a, b) => (o[a.priority] || 4) - (o[b.priority] || 4)); }
        else if (sortBy === "status") filtered.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
        else if (sortBy === "title") filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        return filtered;
    }, [referrals, query, filterPriority, filterStatus, propertyFilter, sortBy]);

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [selectedExportKeys, setSelectedExportKeys] = useState([]);

    const BASE_EXPORT_COLUMNS = useMemo(() => [
        { header: 'Reference', key: 'reference' }, { header: 'Title', key: 'title' },
        { header: 'Priority', key: 'priority' }, { header: 'Status', key: 'status' },
        { header: 'Scheduled Date', key: 'scheduled_date' }, { header: 'Property', key: 'property' }
    ], []);

    const exportColumns = useMemo(() => {
        const custom = (customColumns || []).map((col) => ({ header: String(col).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), key: col }));
        return [...BASE_EXPORT_COLUMNS, ...custom];
    }, [BASE_EXPORT_COLUMNS, customColumns]);

    useEffect(() => {
        const nextKeys = exportColumns.map((c) => c.key);
        setSelectedExportKeys((prev) => {
            const prevSet = new Set(prev);
            const merged = nextKeys.filter((k) => prevSet.has(k));
            if (merged.length === 0) return nextKeys;
            for (const k of nextKeys) { if (!prevSet.has(k)) merged.push(k); }
            return merged;
        });
    }, [exportColumns]);

    const normalizeReferralExportRow = (referral) => {
        const base = { reference: referral.reference || 'N/A', title: referral.title || 'N/A', priority: referral.priority || 'N/A', status: referral.status || 'N/A', scheduled_date: referral.scheduled_date ? new Date(referral.scheduled_date).toLocaleDateString() : 'N/A', property: referral.property_name || referral.hotel_name || 'N/A' };
        for (const col of customColumns || []) base[col] = referral?.[col] ?? '';
        return base;
    };

    const openExport = (format) => { setExportFormat(format); setShowExportModal(true); };
    const closeExport = () => { setShowExportModal(false); setExportFormat(null); };

    const runExport = () => {
        const columnsToExport = exportColumns.filter((c) => selectedExportKeys.includes(c.key));
        const data = filteredReferrals.map(normalizeReferralExportRow).map((row) => {
            const filteredRow = {};
            columnsToExport.forEach((col) => { filteredRow[col.key] = row[col.key]; });
            return filteredRow;
        });
        if (exportFormat === 'pdf') generatePDF(data, columnsToExport, 'Safeguarding Referrals', 'safeguarding-referrals');
        else if (exportFormat === 'csv') generateCSV(data, columnsToExport, 'safeguarding-referrals');
        closeExport();
    };

    const statsData = useMemo(() => ({
        total: referrals.length, new: stats['New'], underReview: stats['Under Review'],
        escalated: stats['Escalated'], resolved: stats['Resolved'],
    }), [referrals, stats]);

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">

                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Breadcrumbs items={[{ label: 'Safeguarding', path: '/admin/safeguarding-referrals' }, { label: 'Referrals' }]} />
                        <h1 className="text-3xl font-black text-slate-900 mt-1">Safeguarding Referrals Dashboard</h1>
                    </div>
                    {hasCreate && (
                        <div className="flex items-center gap-3">
                            <DownloadDropdown onDownloadPDF={() => openExport('pdf')} onDownloadCSV={() => openExport('csv')} />
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                    {[
                        { label: 'New', value: statsData.new, bg: 'bg-blue-50', text: 'text-blue-500' },
                        { label: 'Under Review', value: statsData.underReview, bg: 'bg-orange-50', text: 'text-orange-500' },
                        { label: 'Escalated', value: statsData.escalated, bg: 'bg-purple-50', text: 'text-purple-500' },
                        { label: 'Resolved', value: statsData.resolved, bg: 'bg-emerald-50', text: 'text-emerald-500' },
                    ].map(({ label, value, bg, text }) => (
                        <div key={label} className="bg-white rounded-xl p-5 border border-gray-100 flex items-center gap-4 shadow-sm transition-all duration-200">
                            <div className={`${bg} ${text} h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <AlertCircle className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</div>
                                <div className="text-2xl font-black text-slate-800 leading-none">{value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Table Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200">

                    {/* Toolbar */}
                    <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">All Referrals</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{statsData.total} total records</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="text" value={query} onChange={e => setQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="border border-gray-200 rounded-lg w-52 py-[7px] !pl-14 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
                                    />
                                </div>

                                {/* View Dropdown */}
                                <div className="relative" ref={viewRef}>
                                    <button onClick={() => setShowViewMenu(!showViewMenu)} className="border border-gray-200 text-gray-600 rounded-lg px-3 py-[7px] text-sm font-medium transition-colors flex items-center gap-1.5 bg-white">
                                        <Eye className="w-4 h-4" />
                                        <span>{viewMode === 'table' ? 'Table' : 'Board'}</span>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                    {showViewMenu && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                                            <div className="p-4">
                                                <h3 className="text-sm font-semibold text-gray-900 mb-3">View settings</h3>
                                                <div className="mb-3 pb-3 border-b border-gray-200">
                                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Display Mode</div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setViewMode('table')} className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${viewMode === 'table' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                                            <Columns className="w-4 h-4" /><span>Table</span>
                                                        </button>
                                                        <button onClick={() => setViewMode('board')} className={`flex-1 px-3 py-2 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${viewMode === 'board' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                                            <AlertCircle className="w-4 h-4" /><span>Board</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                {viewMode === 'table' && (
                                                    <>
                                                        <button onClick={() => setShowPropertyVisibility(!showPropertyVisibility)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 rounded-xl transition-colors">
                                                            <span>Column visibility</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-400">{Object.values(visibleColumns).filter(Boolean).length} shown</span>
                                                                <ChevronDown className={`w-4 h-4 transition-transform ${showPropertyVisibility ? 'rotate-180' : ''}`} />
                                                            </div>
                                                        </button>
                                                        {showPropertyVisibility && (
                                                            <div className="mt-2 border-t border-gray-100 pt-3 max-h-96 overflow-y-auto space-y-4">
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Default Columns</span>
                                                                        <div className="flex gap-2 text-xs">
                                                                            <button onClick={() => { const u = {}; DEFAULT_COLUMNS.forEach(c => u[c] = true); setVisibleColumns(prev => ({ ...prev, ...u })); }} className="text-teal-600 font-medium">Show all</button>
                                                                            <span className="text-gray-300">|</span>
                                                                            <button onClick={() => { const u = {}; DEFAULT_COLUMNS.forEach(c => u[c] = false); setVisibleColumns(prev => ({ ...prev, ...u })); }} className="text-teal-600 font-medium">Hide all</button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {DEFAULT_COLUMNS.map(col => (
                                                                            <button key={col} onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })} className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-lg transition-colors border ${visibleColumns[col] ? 'text-gray-700 border-gray-200 bg-white' : 'text-gray-400 border-gray-100 bg-gray-50'}`}>
                                                                                <span className="capitalize">{col}</span>
                                                                                {visibleColumns[col] ? <Eye className="w-3.5 h-3.5 text-teal-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                {customColumns.length > 0 && (
                                                                    <div className="border-t border-gray-100 pt-3">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Custom Columns</span>
                                                                                <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">{customColumns.length}</span>
                                                                            </div>
                                                                            <div className="flex gap-2 text-xs">
                                                                                <button onClick={() => { const u = {}; customColumns.forEach(c => u[c] = true); setVisibleColumns(prev => ({ ...prev, ...u })); }} className="text-teal-600 font-medium">Show all</button>
                                                                                <span className="text-gray-300">|</span>
                                                                                <button onClick={() => { const u = {}; customColumns.forEach(c => u[c] = false); setVisibleColumns(prev => ({ ...prev, ...u })); }} className="text-teal-600 font-medium">Hide all</button>
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400 mb-2">From Forms Builder <span className="text-blue-500">(refreshes every 5s)</span></p>
                                                                        <div className="space-y-1">
                                                                            {customColumns.map(col => (
                                                                                <button key={col} onClick={() => setVisibleColumns({ ...visibleColumns, [col]: !visibleColumns[col] })} className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-lg transition-colors border ${visibleColumns[col] ? 'text-gray-700 border-gray-200 bg-white' : 'text-gray-400 border-gray-100 bg-gray-50'}`}>
                                                                                    <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                                                                                    {visibleColumns[col] ? <Eye className="w-3.5 h-3.5 text-teal-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {hasCreate && (
                                    <button onClick={() => handleOpenModal('create')} className="bg-teal-500 text-white font-semibold rounded-lg py-[7px] px-4 text-sm flex items-center gap-1.5 transition-colors shadow-sm">
                                        <span className="text-base leading-none">+</span><span>Add Task</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="h-10 border border-gray-200 rounded-lg !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none cursor-pointer bg-white">
                                    <option value="">All Priorities</option>
                                    <option>Urgent</option><option>High</option><option>Medium</option><option>Low</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative">
                                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 border border-gray-200 rounded-lg !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none cursor-pointer bg-white">
                                    <option value="">All Statuses</option>
                                    <option>New</option><option>Under Review</option><option>Escalated</option><option>Resolved</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative">
                                <Home className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="h-10 border border-gray-200 rounded-lg !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none cursor-pointer bg-white">
                                    <option value="">All Properties</option>
                                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative">
                                <Columns className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 border border-gray-200 rounded-lg !pl-14 pr-10 py-0 leading-none text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none cursor-pointer bg-white">
                                    <option value="">Sort By</option>
                                    <option value="date">Date (Newest)</option><option value="priority">Priority</option>
                                    <option value="status">Status</option><option value="title">Title</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            </div>
                            {(filterPriority || filterStatus || propertyFilter || sortBy) && (
                                <button onClick={() => { setFilterPriority(""); setFilterStatus(""); setPropertyFilter(""); setSortBy(""); }} className="h-10 text-sm text-teal-600 font-semibold px-3 py-0 rounded-lg transition-colors">
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    {viewMode === 'table' ? (
                        <div className="overflow-x-auto scrollbar-hide relative">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                                        {visibleColumns.checkbox && (
                                            <th className="py-3 px-4 w-10 text-left">
                                                <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-400 w-[15px] h-[15px]" />
                                            </th>
                                        )}
                                        {visibleColumns.type && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                Category
                                            </th>
                                        )}
                                        {visibleColumns.reference && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                Reference
                                            </th>
                                        )}
                                        {visibleColumns.description && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                Description
                                            </th>
                                        )}
                                        {visibleColumns.priority && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                Priority
                                            </th>
                                        )}
                                        {visibleColumns.status && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                Status
                                            </th>
                                        )}
                                        {visibleColumns.assigned && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                Assigned To
                                            </th>
                                        )}
                                        {visibleColumns.date && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                                                Date
                                            </th>
                                        )}
                                        {visibleColumns.attachments && (
                                            <th className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                                                Attachments
                                            </th>
                                        )}
                                        {customColumns.map((col) =>
                                            visibleColumns[col] && (
                                                <th
                                                    key={col}
                                                    className="text-left py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap"
                                                >
                                                    {col.replace(/_/g, ' ')}
                                                </th>
                                            )
                                        )}
                                        {visibleColumns.actions && (
                                            <th
                                                className="text-center py-3 px-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider sticky right-0 z-10 bg-[var(--bg-primary)]"
                                                style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}
                                            >
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {referralsLoading ? (
                                        <tr><td colSpan="99" className="py-10 text-center text-sm text-gray-400">Loading...</td></tr>
                                    ) : filteredReferrals.length > 0 ? filteredReferrals.map((ref, idx) => {
                                        const priorityStyle = getPriorityColor(ref.priority || "Medium");
                                        const statusStyle = getStatusColor(ref.status || "New");
                                        const isDeleting = deletingIds.has(ref.id);
                                        return (
                                            <tr key={ref.id} className={`transition-colors ${isDeleting ? 'safeguarding-deleting' : ''}`}>
                                                {visibleColumns.checkbox && (
                                                    <td className="py-3 px-4">
                                                        <input type="checkbox" className="rounded border-gray-300 text-teal-500 focus:ring-teal-400 w-[15px] h-[15px]" />
                                                    </td>
                                                )}
                                                {visibleColumns.type && (
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 whitespace-nowrap">
                                                            {ref.category || "Safeguarding"}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.reference && (
                                                    <td className="py-3 px-4">
                                                        <span className="text-gray-800 font-semibold text-sm whitespace-nowrap">{ref.reference || `REF-${ref.id || idx}`}</span>
                                                    </td>
                                                )}
                                                {visibleColumns.description && (
                                                    <td className="py-3 px-4">
                                                        <div className={`flex items-center gap-1.5 ${hasUpdate ? 'cursor-pointer' : ''} transition-colors`} onClick={hasUpdate ? () => handleOpenModal('edit', ref) : undefined}>
                                                            <Home className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                                            <span className="text-gray-800 font-medium text-sm whitespace-nowrap">{ref.property_name || 'Unknown Property'}</span>
                                                        </div>
                                                        <div className="text-gray-400 text-xs mt-0.5 truncate max-w-[180px] pl-5">{ref.title || "Referral Title"}</div>
                                                    </td>
                                                )}
                                                {visibleColumns.priority && (
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityStyle.dot}`}></span>
                                                            <span className={`text-sm font-semibold ${priorityStyle.text} whitespace-nowrap`}>{ref.priority || "Medium"}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.status && (
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`}></span>
                                                            <span className={`text-sm font-semibold ${statusStyle.text} whitespace-nowrap`}>{ref.status || "New"}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.assigned && (
                                                    <td className="py-3 px-4">
                                                        {!ref.assigned_to ? (
                                                            <span className="text-gray-400 text-sm">Unassigned</span>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-7 h-7 rounded-full ${getAvatarColor(ref.assigned_to)} flex items-center justify-center text-[11px] font-bold flex-shrink-0`}>
                                                                    {getInitials(ref.assigned_to)}
                                                                </div>
                                                                <span className="text-gray-800 text-sm font-medium whitespace-nowrap">{ref.assigned_to}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                {visibleColumns.date && (
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className="text-gray-600 text-sm">{formatDate(ref.scheduled_date)}</span>
                                                    </td>
                                                )}
                                                {visibleColumns.attachments && (
                                                    <td className="py-3 px-4">
                                                        {(() => {
                                                            let atts = ref?.attachments ?? [];
                                                            try {
                                                                if (typeof atts === 'string' && atts) atts = JSON.parse(atts);
                                                            } catch {
                                                                atts = [];
                                                            }
                                                            const list = Array.isArray(atts) ? atts.filter(Boolean) : [];
                                                            if (list.length === 0) return <span className="text-gray-400 text-sm font-medium">—</span>;
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openAttachmentsGallery(list)}
                                                                    className="inline-flex items-center gap-2 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-2xl transition-all hover:bg-teal-100 shadow-sm uppercase tracking-wider"
                                                                >
                                                                    <span>{list.length}</span>
                                                                    <span>Photos</span>
                                                                </button>
                                                            );
                                                        })()}
                                                    </td>
                                                )}
                                                {customColumns.map(col => visibleColumns[col] && (
                                                    <td key={col} className="py-3 px-4">
                                                        <span className="text-gray-700 text-sm">{ref[col] || '-'}</span>
                                                    </td>
                                                ))}
                                                {visibleColumns.actions && (
                                                    <td className="py-3 px-4 sticky right-0 z-10 bg-white" style={{ boxShadow: '-2px 0 5px -2px rgba(0,0,0,0.08)' }}>
                                                        <div className="flex items-center justify-center gap-0.5">
                                                            <button onClick={() => handleOpenModal('view', ref)} className="p-1.5 text-gray-400 rounded-lg transition-all" title="View"><Eye className="w-4 h-4" /></button>
                                                            {hasUpdate && <button onClick={() => handleOpenModal('edit', ref)} className="p-1.5 text-gray-400 rounded-lg transition-all" title="Edit"><Edit className="w-4 h-4" /></button>}
                                                            {hasDelete && <button onClick={() => handleDelete(ref.id)} className="p-1.5 text-gray-400 rounded-lg transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan="99" className="py-10 text-center text-sm text-gray-400">No referrals found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto scrollbar-hide p-5">
                            <div className="flex gap-4 min-w-max">
                                {['New', 'Under Review', 'Resolved'].map((status) => {
                                    const statusItems = filteredReferrals.filter((ref) => (ref.status || 'New').toLowerCase() === status.toLowerCase());
                                    const getStatusStyle = (s) => {
                                        const low = String(s || '').toLowerCase();
                                        const isCompleted = low === 'resolved' || low === 'completed' || low === 'closed';
                                        const isError = low === 'action required' || low === 'overdue' || low === 'failed' || low === 'escalated';
                                        const isWarning = !isCompleted && !isError;

                                        return {
                                            bg: 'bg-[var(--bg-primary)]',
                                            border: 'border-[var(--border-color)]',
                                            header: 'bg-[var(--bg-surface)]',
                                            text: isCompleted
                                                ? 'text-[var(--color-success)]'
                                                : isError
                                                    ? 'text-[var(--color-error)]'
                                                    : 'text-[var(--color-warning)]',
                                            dot: isCompleted
                                                ? 'bg-emerald-500'
                                                : isError
                                                    ? 'bg-red-500'
                                                    : 'bg-orange-500',
                                        };
                                    };
                                    const style = getStatusStyle(status);
                                    return (
                                        <div key={status} className="flex-shrink-0 w-80">
                                            <div className={`rounded-xl border ${style.border} ${style.bg}`}>
                                                <div className={`${style.header} px-4 py-3 border-b ${style.border} flex items-center justify-between`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
                                                        <h3 className={`font-semibold ${style.text} text-sm uppercase tracking-wide`}>{status}</h3>
                                                    </div>
                                                    <span className="bg-[var(--bg-surface)] px-2 py-0.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)]">{statusItems.length}</span>
                                                </div>
                                                <div className="p-3 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                                                    {statusItems.length === 0 ? (
                                                        <div className="text-center py-8 px-4">
                                                            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-[var(--text-secondary)]" />
                                                            <p className="text-[var(--text-secondary)] text-sm">No referrals</p>
                                                        </div>
                                                    ) : statusItems.map((referral) => {
                                                        const priorityColor = getPriorityColor(referral.priority || "Medium");
                                                        const isDeleting = deletingIds.has(referral.id);
                                                        return (
                                                            <div key={referral.id} className={`bg-[var(--bg-surface)] rounded-xl p-4 shadow-sm border border-[var(--border-color)] transition-all cursor-pointer ${isDeleting ? 'safeguarding-card-deleting' : ''}`} onClick={() => handleOpenModal('view', referral)}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-mono text-[var(--text-secondary)]">{referral.reference || `SG-${referral.id}`}</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className={`w-2 h-2 rounded-full ${priorityColor.dot}`}></span>
                                                                        <span className={`text-xs font-medium ${priorityColor.text}`}>{referral.priority || "Medium"}</span>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-2 line-clamp-2">{referral.concern || referral.title || "Safeguarding Concern"}</h4>
                                                                {referral.description && <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{referral.description}</p>}
                                                                {referral.category && <div className="mb-3"><span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">{referral.category}</span></div>}
                                                                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {referral.assigned_to && referral.assigned_to !== 'Unassigned' ? (
                                                                            <>
                                                                                <div className={`w-6 h-6 rounded-full ${getAvatarColor(referral.assigned_to)} flex items-center justify-center text-xs font-semibold`}>{getInitials(referral.assigned_to)}</div>
                                                                                <span className="text-xs text-[var(--text-primary)] truncate max-w-[100px]">{referral.assigned_to}</span>
                                                                            </>
                                                                        ) : <span className="text-xs text-[var(--text-secondary)]">Unassigned</span>}
                                                                    </div>
                                                                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(referral.scheduled_date)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal('view', referral); }} className="flex-1 py-1.5 px-2 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-colors text-xs font-medium flex items-center justify-center gap-1"><Eye className="w-3.5 h-3.5" />View</button>
                                                                    {hasUpdate && <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', referral); }} className="p-1.5 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-colors"><Edit className="w-3.5 h-3.5" /></button>}
                                                                    {hasDelete && <button onClick={(e) => { e.stopPropagation(); handleDelete(referral.id); }} className="p-1.5 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div>
                                <div className="text-lg font-semibold text-gray-900">Download {exportFormat === 'pdf' ? 'PDF' : 'CSV'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Select columns you want to include</div>
                            </div>
                            <button onClick={closeExport} className="p-2 rounded-xl text-gray-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-medium text-gray-700">Columns</div>
                                <div className="flex items-center gap-3 text-xs">
                                    <button onClick={() => setSelectedExportKeys(exportColumns.map((c) => c.key))} className="text-teal-600 font-medium">Select all</button>
                                    <button onClick={() => setSelectedExportKeys([])} className="text-gray-600 font-medium">Clear</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] overflow-auto pr-1">
                                {exportColumns.map((col) => {
                                    const checked = (selectedExportKeys || []).includes(col.key);
                                    return (
                                        <label key={col.key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
                                            <input type="checkbox" checked={checked} onChange={(e) => { const isChecked = e.target.checked; setSelectedExportKeys((prev) => { const set = new Set(prev || []); if (isChecked) set.add(col.key); else set.delete(col.key); return Array.from(set); }); }} className="h-4 w-4 accent-teal-600 rounded" />
                                            <span className="text-sm text-gray-800">{col.header}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
                            <button onClick={closeExport} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200">Cancel</button>
                            <button onClick={runExport} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-teal-600">Download</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit / View Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container h-[70vh]">
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title">{modalMode === 'create' ? "New Safeguarding Referral" : modalMode === 'edit' ? "Edit Referral" : "Referral Details"}</h2>
                                <p className="modal-subtitle">{modalMode === 'view' ? 'View referral information' : 'Enter referral details'}</p>
                            </div>
                            <button onClick={handleCloseModal} className="rounded-xl modal-close-btn"><X className="w-5 h-5" /></button>
                        </div>

                        {modalMode === 'view' ? (
                            <>
                                <div className="modal-content space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label><p className="text-gray-900 font-medium">{formData.title || 'N/A'}</p></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{formData.status || 'N/A'}</span></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Property</label><p className="text-gray-900">{formData.property_name || 'N/A'}</p></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label><p className="text-gray-900">{formData.category || 'N/A'}</p></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Priority</label><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{formData.priority || 'N/A'}</span></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Scheduled Date</label><p className="text-gray-900">{formatDate(formData.scheduled_date) || 'N/A'}</p></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Reported By</label><p className="text-gray-900">{formData.reported_by || 'N/A'}</p></div>
                                        <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Assigned To</label><p className="text-gray-900">{formData.assigned_to || 'N/A'}</p></div>
                                        {(customColumns || []).map((col) => {
                                            const meta = customColumnMetadata?.[col] || {};
                                            const label = String(meta.label || col).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
                                            const rawVal = formData?.[col];
                                            const inputType = String(meta.input_type || meta.inputType || '').toLowerCase();
                                            const isBoolType = inputType === 'checkbox' || inputType === 'boolean';
                                            const isDateType = inputType === 'date';
                                            let valueText = rawVal;
                                            if (valueText === null || valueText === undefined || valueText === '') valueText = 'N/A';
                                            if (isDateType && rawVal) { const d = new Date(rawVal); if (!Number.isNaN(d.getTime())) valueText = d.toISOString().slice(0, 10); }
                                            if (isBoolType) {
                                                const boolVal = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1' || rawVal === 'yes';
                                                return (<div key={col}><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{boolVal ? 'Yes' : 'No'}</span></div>);
                                            }
                                            return (<div key={col}><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label><p className="text-gray-900 font-medium">{String(valueText)}</p></div>);
                                        })}
                                    </div>
                                    <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description</label><p className="text-gray-700">{formData.description || 'No description provided.'}</p></div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" onClick={handleCloseModal} className="rounded-xl btn-secondary">Close</button>
                                    <button type="button" onClick={() => setModalMode('edit')} className="btn-primary rounded-xl flex items-center gap-1"><Edit className="w-4 h-4" />Edit</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <form id="safeguarding-referral-form" onSubmit={submit} className="modal-content form-section">
                                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
                                    <div className="form-grid-2">
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                                            <input required value={formData.title || ''} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Brief description of task" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Description <span className="text-red-500">*</span></label>
                                            <textarea required value={formData.description || ''} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Detailed description of the safeguarding issue..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Property <span className="text-red-500">*</span></label>
                                            <select required value={formData.property_id || ''} onChange={(e) => handlePropertyChange(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                <option value="">Select property</option>
                                                {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Category <span className="text-red-500">*</span></label>
                                            <select required value={formData.category || ''} onChange={handleCategoryChange} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                <option value="">Select category</option>
                                                {[...categoryOptions, ...customCategories].map((c) => <option key={c} value={c}>{c}</option>)}
                                                {!!formData.category && ![...categoryOptions, ...customCategories].some((c) => String(c) === String(formData.category)) && <option value={formData.category}>{formData.category}</option>}
                                                <option value="__add_new__">+ Add new...</option>
                                            </select>
                                            {showCustomCategoryInput && (
                                                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                                                    <input type="text" value={customCategoryValue} onChange={(e) => setCustomCategoryValue(e.target.value)} placeholder="Enter new category" className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                                                    <div className="flex items-center gap-2 sm:shrink-0">
                                                        <button type="button" onClick={saveCustomCategory} className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap">Add</button>
                                                        <button type="button" onClick={() => { setShowCustomCategoryInput(false); setCustomCategoryValue(''); }} className="px-3 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium transition-colors whitespace-nowrap">Cancel</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Priority <span className="text-red-500">*</span></label>
                                            <select required value={formData.priority || 'Medium'} onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                {Object.keys(priorityColors).map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Reported By <span className="text-red-500">*</span></label>
                                            <input type="text" required value={formData.reported_by} readOnly className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-gray-100 cursor-not-allowed focus:outline-none" />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Assigned To <span className="text-red-500">*</span></label>
                                            <select required value={formData.assigned_to || ''} onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))} disabled={!formData.property_id || staffLoading} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed">
                                                <option value="">{!formData.property_id ? "Select property first" : staffLoading ? "Loading staff..." : "Select staff"}</option>
                                                {!!formData.assigned_to && !staffUsers.some((u) => String(u.name) === String(formData.assigned_to)) && <option value={formData.assigned_to}>{formData.assigned_to}</option>}
                                                {staffUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Date <span className="text-red-500">*</span></label>
                                            <input type="date" required value={formatDateISO(formData.scheduled_date) || ''} onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                                        </div>
                                        {customColumns.map(col => {
                                            const meta = customColumnMetadata[col] || {};
                                            const inputType = meta.input_type || 'text';
                                            let parsedOptions = Array.isArray(meta.input_options) ? meta.input_options : [];
                                            if (typeof parsedOptions === 'string' && parsedOptions) { try { parsedOptions = JSON.parse(parsedOptions); } catch { parsedOptions = []; } }
                                            if (Array.isArray(parsedOptions) && parsedOptions.length === 1 && typeof parsedOptions[0] === 'string' && parsedOptions[0].startsWith('[')) { try { parsedOptions = JSON.parse(parsedOptions[0]); } catch { } }
                                            return (
                                                <div key={col} className="col-span-1">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{col.replace(/_/g, ' ').toUpperCase()} <span className="text-red-500">*</span></label>
                                                    {inputType === 'checkbox' ? (
                                                        <select required value={formData[col] === 'true' || formData[col] === 'false' ? formData[col] : formData[col] === true ? 'true' : formData[col] === false ? 'false' : ''} onChange={(e) => setFormData(prev => ({ ...prev, [col]: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                            <option value="">Select...</option><option value="true">Yes</option><option value="false">No</option>
                                                        </select>
                                                    ) : inputType === 'dropdown' || inputType === 'select' ? (
                                                        <select required value={formData[col] || ''} onChange={(e) => setFormData(prev => ({ ...prev, [col]: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                            <option value="">Select {col.replace(/_/g, ' ')}</option>
                                                            {parsedOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                                        </select>
                                                    ) : inputType === 'textarea' ? (
                                                        <textarea required value={formData[col] || ''} onChange={(e) => setFormData(prev => ({ ...prev, [col]: e.target.value }))} rows={3} placeholder={`Enter ${col.replace(/_/g, ' ')}`} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y" />
                                                    ) : (
                                                        <input type={inputType === 'number' ? 'number' : inputType === 'date' ? 'date' : 'text'} required value={formData[col] || ''} onChange={(e) => setFormData(prev => ({ ...prev, [col]: e.target.value }))} placeholder={`Enter ${col.replace(/_/g, ' ')}`} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {modalMode !== 'create' && (
                                            <div className="col-span-1">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                                <select value={formData.status || 'New'} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                                                    <option>New</option><option>Under Review</option><option>Escalated</option><option>Resolved</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Attachments</label>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => { const files = Array.from(e.target.files || []).filter(Boolean); setSelectedPhotos(files); }}
                                                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all"
                                            />
                                            {modalMode !== 'create' && Array.isArray(existingAttachments) && existingAttachments.length > 0 && (
                                                <div className="mt-8 space-y-4">
                                                    <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 ml-1">Existing Attachments</h3>
                                                    {existingAttachments.filter(Boolean).map((id, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white border border-gray-100/80 rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] transition-all duration-300">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                                                                    <Eye size={18} className="text-slate-400" />
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-700">Attachment #{idx + 1}</span>
                                                            </div>
                                                            <div className="flex gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openAttachmentsGallery([id])}
                                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[11px] font-bold text-teal-700 shadow-sm hover:bg-gray-50 hover:border-teal-200 transition-all uppercase tracking-wider"
                                                                >
                                                                    <Eye size={14} />
                                                                    View
                                                                </button>
                                                                {hasUpdate && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeAttachment(id)}
                                                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-100 rounded-xl text-[11px] font-bold text-red-600 shadow-sm hover:bg-red-50 hover:border-red-200 transition-all uppercase tracking-wider"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        Remove
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </form>
                                <div className="modal-footer">
                                    <button type="button" onClick={handleCloseModal} className="rounded-xl btn-secondary">Cancel</button>
                                    <button type="submit" form="safeguarding-referral-form" disabled={submitting} className="rounded-xl btn-primary">{submitting ? "Saving..." : (modalMode === 'create' ? "Create" : "Save Changes")}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-[360px] rounded-[20px] p-5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4 mb-5">
                            <div className="bg-rose-50 text-rose-500 rounded-full p-2.5 shrink-0">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div className="pt-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Record</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">Delete this record?</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2.5">
                            <button type="button" disabled={deleting} onClick={() => { if (deleting) return; setShowDeleteModal(false); setDeleteId(null); }} className="px-5 py-2 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 text-sm">Cancel</button>
                            <button type="button" disabled={deleting} onClick={confirmDelete} className="px-5 py-2 rounded-full font-medium shadow-sm hover:shadow bg-[#f43f5e] hover:bg-rose-600 text-white disabled:opacity-60 text-sm transition-colors">{deleting ? 'Deleting...' : 'Confirm'}</button>
                        </div>
                    </div>
                </div>
            )}

            <ImageGalleryModal open={_galleryOpen} onClose={_closeGallery} items={_galleryItems} title={_galleryTitle} apiBase={_galleryApi} />

        </div>
    );
}