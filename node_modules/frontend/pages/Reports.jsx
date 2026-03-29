/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
 FileText,
 Users,
 Briefcase,
 Calendar,
 Layers,
 Wrench,
 AlertTriangle,
 Gavel,
 CheckCircle,
 Clock,
 Download,
 Filter,
 Plus,
 X,
 Search,
 ChevronRight,
 Database,
 Shield,
 GraduationCap,
 ClipboardCheck,
 Network,
 AlertCircle,
 Building2
} from 'lucide-react';
import { generateCSV } from "../utils/csvGenerator";
import { generatePDF } from "../utils/pdfGenerator";

// API Base configuration
const API_BASE = import.meta.env.VITE_API_URL || axios.defaults.baseURL || '';
const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 30000 });

// --- MOCK DATA FOR CARDS ---
const REPORTS_CONFIG = [
 {
 id: "service_users",
 title: "Service Users",
 description: "Service users list export with selectable columns.",
 category: "OPERATIONS",
 icon: <UsersIcon />,
 color: "bg-purple-50 text-purple-600",
 endpoint: "/api/su/users",
 tableName: null,
 dataKey: "users",
 defaultColumns: ["first_name", "last_name", "email", "phone", "status", "property_name", "room_number"],
 },
 {
 id: "users",
 title: "Users",
 description: "Staff/users export (same dataset used by Users page).",
 category: "OPERATIONS",
 icon: <UsersIcon />,
 color: "bg-teal-50 text-teal-600",
 endpoint: "/api/admin/users",
 tableName: null,
 dataKey: "users",
 defaultColumns: ["name", "email", "phone", "role", "branch", "status", "hotel_name", "hotel_id"],
 },
 {
 id: "bookings",
 title: "Bookings",
 description: "Bookings export (same dataset used by Bookings page).",
 category: "OPERATIONS",
 icon: <CalendarIcon />,
 color: "bg-blue-50 text-blue-600",
 endpoint: "/api/su/users",
 tableName: null,
 dataKey: "users",
 defaultColumns: ["full_name", "order_no", "property_name", "room_number", "check_in", "guests", "status"],
 },
 {
 id: "move_in_out",
 title: "Move In / Out",
 description: "Move-in / move-out activity export.",
 category: "OPERATIONS",
 icon: <LayersIcon />,
 color: "bg-emerald-50 text-emerald-600",
 endpoint: "/api/move-ins",
 tableName: null,
 dataKey: "rows",
 defaultColumns: ["service_user_name", "property_name", "room_name", "bedspace_name", "move_in_date", "status"],
 },
 {
 id: "meal_management",
 title: "Meal Management",
 description: "Meals export (scheduled meals and status).",
 category: "OPERATIONS",
 icon: <BriefcaseIcon />,
 color: "bg-orange-50 text-orange-600",
 endpoint: "/api/meals",
 tableName: null,
 dataKey: "rows",
 defaultColumns: ["service_user_name", "property_name", "meal_type", "portion", "dietary", "scheduled_date", "status"],
 },
 {
 id: "inspections",
 title: "Inspections Report",
 description: "Complete log of property inspections, statuses, and auditor remarks.",
 category: "OPERATIONS",
 icon: <ClipboardTextIcon />,
 color: "bg-blue-50 text-blue-600",
 endpoint: "/api/inspections",
 tableName: "inspections", // Used for fetching dynamic columns
 dataKey: "inspections", // key in response
 defaultColumns: ["reference", "property_name", "auditor", "status", "date"]
 },
 {
 id: "incidents",
 title: "Incident Logs",
 description: "Detailed records of workplace incidents, severity levels, and resolution actions.",
 category: "HSE",
 icon: <AlertTriangleIcon />,
 color: "bg-red-50 text-red-600",
 endpoint: "/api/hse/hse-incidents",
 tableName: "hse_incidents",
 dataKey: "rows",
 defaultColumns: ["reference", "incident_type", "severity", "status", "incident_date"]
 },
 {
 id: "hse_audits",
 title: "HSE Audits",
 description: "Safety audits, compliance checks, and scheduled inspections.",
 category: "HSE",
 icon: <ClipboardCheckIcon />,
 color: "bg-green-50 text-green-600",
 endpoint: "/api/hse/audits",
 tableName: "hse_audits",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "category", "priority", "status", "scheduled_date"]
 },
 {
 id: "hse_risk",
 title: "Risk Management",
 description: "Risk assessments, hazard identification, and mitigation strategies.",
 category: "HSE",
 icon: <ShieldIcon />,
 color: "bg-orange-50 text-orange-600",
 endpoint: "/api/hse/risk-management",
 tableName: "hse_risk_management",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "category", "priority", "status", "property"]
 },
 {
 id: "hse_training",
 title: "HSE Training",
 description: "Staff training records, certifications, and compliance tracking.",
 category: "HSE",
 icon: <GraduationCapIcon />,
 color: "bg-blue-50 text-blue-600",
 endpoint: "/api/hse/training",
 tableName: "hse_training",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "category", "priority", "status", "scheduled_date"]
 },
 {
 id: "complaints",
 title: "Complaints Register",
 description: "Tenant and staff complaints tracking with resolution timelines.",
 category: "OPERATIONS",
 icon: <MessageSquareIcon />,
 color: "bg-[#4dc8c3]/10 text-[#4dc8c3]",
 endpoint: "/api/complaints",
 tableName: "complaints",
 dataKey: "data", // typically paginated response has data array
 defaultColumns: ["reference", "category", "priority", "status", "reported_date"]
 },
 {
 id: "compliance",
 title: "Compliance Status",
 description: "Regulatory compliance checks, overdue items, and certification expiries.",
 category: "LEGAL",
 icon: <ShieldCheckIcon />,
 color: "bg-emerald-50 text-emerald-600",
 endpoint: "/api/compliance",
 tableName: "certificates",
 dataKey: "records",
 defaultColumns: ["title", "type", "status", "due_date", "property"]
 },
 {
 id: "maintenance",
 title: "Maintenance Overview",
 description: "Scheduled and reactive maintenance tasks, costs, and contractor details.",
 category: "FACILITIES",
 icon: <WrenchIcon />,
 color: "bg-purple-50 text-purple-600",
 endpoint: "/api/maintenance",
 tableName: "maintenance_tasks",
 dataKey: "tasks",
 defaultColumns: ["title", "priority", "status", "assigned_to", "due_date"]
 },
 {
 id: "litigation",
 title: "Litigation Cases",
 description: "Legal case files, hearing dates, and case status updates.",
 category: "LEGAL",
 icon: <GavelIcon />,
 color: "bg-slate-50 text-slate-600",
 endpoint: "/api/litigation",
 tableName: "litigation_tasks",
 dataKey: "cases",
 defaultColumns: ["case_number", "case_type", "status", "court_date"]
 },
 {
 id: "aire_tasks",
 title: "AIRE Tasks",
 description: "AIRE project tasks, progress tracking, and team assignments.",
 category: "PROJECTS",
 icon: <LayersIcon />,
 color: "bg-indigo-50 text-indigo-600",
 endpoint: "/api/aire-tasks",
 tableName: "aire_tasks",
 dataKey: "tasks",
 defaultColumns: ["title", "status", "priority", "due_date"]
 },
 {
 id: "safeguarding_referrals",
 title: "Safeguarding Referrals",
 description: "Referrals for safeguarding concerns, priority tracking and status updates.",
 category: "SAFEGUARDING",
 icon: <AlertCircleIcon />,
 color: "bg-teal-50 text-teal-600",
 endpoint: "/api/safeguarding/referrals",
 tableName: "safeguarding_referrals",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "priority", "status", "scheduled_date", "property_name"]
 },
 {
 id: "risk_assessments",
 title: "Risk Assessments",
 description: "Detailed risk assessments, risk levels, and mitigation strategies.",
 category: "SAFEGUARDING",
 icon: <ShieldIcon />,
 color: "bg-orange-50 text-orange-600",
 endpoint: "/api/safeguarding/risk-assessments",
 tableName: "risk_assessments",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "risk_level", "status", "assessment_date", "property_name"]
 },
 {
 id: "multi_agency",
 title: "Multi-Agency",
 description: "Collaborative records involving multiple agencies and external partners.",
 category: "SAFEGUARDING",
 icon: <NetworkIcon />,
 color: "bg-blue-50 text-blue-600",
 endpoint: "/api/safeguarding/multi-agency",
 tableName: "multi_agency",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "priority", "status", "scheduled_date", "property_name"]
 },
 {
 id: "vulnerable_users",
 title: "Vulnerable Users",
 description: "Registry of vulnerable service users and specific support requirements.",
 category: "SAFEGUARDING",
 icon: <UsersIcon />,
 color: "bg-purple-50 text-purple-600",
 endpoint: "/api/safeguarding/vulnerable-users",
 tableName: "vulnerable_users",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "priority", "status", "scheduled_date", "property_name"]
 },
 {
 id: "vcs_organisations",
 title: "VCS Organisations",
 description: "Directory of Voluntary and Community Sector organisations and partnerships.",
 category: "PARTNERSHIPS",
 icon: <Building2Icon />,
 color: "bg-orange-50 text-orange-600",
 endpoint: "/api/vcs-organisations",
 tableName: "vcs_organisations",
 dataKey: "rows",
 defaultColumns: ["reference", "name", "category", "priority", "status", "property_name"]
 },
 {
 id: "emergency_protocols",
 title: "Emergency Protocols",
 description: "Emergency response protocols, escalation paths, and status tracking.",
 category: "ESCALATIONS",
 icon: <AlertCircleIcon />,
 color: "bg-red-50 text-red-600",
 endpoint: "/api/emergency-protocols",
 tableName: "emergency_protocols",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "priority", "status", "assigned_to_name", "property_name"]
 },
 {
 id: "case_management",
 title: "Case Management",
 description: "Tracking of complex cases, interventions, and multi-disciplinary reviews.",
 category: "ESCALATIONS",
 icon: <BriefcaseIcon />,
 color: "bg-blue-50 text-blue-600",
 endpoint: "/api/case-management",
 tableName: "case_management",
 dataKey: "rows",
 defaultColumns: ["reference", "title", "priority", "status", "assigned_to", "property_name"]
 },
];

// --- ICONS (Local wrapper to avoid missing icon errors if lucide updates) ---
function ClipboardCheckIcon() { return <ClipboardCheck className="w-6 h-6" />; }
function ClipboardTextIcon() { return <FileText className="w-6 h-6" />; }
function AlertTriangleIcon() { return <AlertTriangle className="w-6 h-6" />; }
function MessageSquareIcon() { return <Users className="w-6 h-6" />; } // Placeholder
function ShieldCheckIcon() { return <CheckCircle className="w-6 h-6" />; }
function ShieldIcon() { return <Shield className="w-6 h-6" />; }
function GraduationCapIcon() { return <GraduationCap className="w-6 h-6" />; }
function WrenchIcon() { return <Wrench className="w-6 h-6" />; }
function GavelIcon() { return <Gavel className="w-6 h-6" />; }
function LayersIcon() { return <Layers className="w-6 h-6" />; }
function NetworkIcon() { return <Network className="w-6 h-6" />; }
function AlertCircleIcon() { return <AlertCircle className="w-6 h-6" />; }
function UsersIcon() { return <Users className="w-6 h-6" />; }
function Building2Icon() { return <Building2 className="w-6 h-6" />; }
function BriefcaseIcon() { return <Briefcase className="w-6 h-6" />; }
function CalendarIcon() { return <Calendar className="w-6 h-6" />; }


export default function Reports() {
 const [activeTab, setActiveTab] = useState("library"); // library, templates
 const [selectedReport, setSelectedReport] = useState(null); // The report object currently in modal
 const [modalStep, setModalStep] = useState(1); // 0 = Report selector (custom), 1 = Selection, 2 = Filtered Analysis
 const [loading, setLoading] = useState(false);
 const [isCustomReportFlow, setIsCustomReportFlow] = useState(false);

 const [templatesLoading, setTemplatesLoading] = useState(false);
 const [templates, setTemplates] = useState([]);
 const [templateName, setTemplateName] = useState("");
 const [savingTemplate, setSavingTemplate] = useState(false);

 useEffect(() => {
  const isModalOpen = Boolean(selectedReport || isCustomReportFlow);
  try {
   if (isModalOpen) document.body.classList.add('form-modal-open');
   else document.body.classList.remove('form-modal-open');
  } catch (err) {
   console.warn('Failed to toggle focus mode', err);
  }
  return () => {
   try {
    document.body.classList.remove('form-modal-open');
   } catch (err) {
    console.warn('Failed to cleanup focus mode', err);
   }
  };
 }, [selectedReport, isCustomReportFlow]);

 // Filter State
 const [dateRange, setDateRange] = useState({ start: "", end: "" });
 // In a real filtered analysis, we would fetch columns dynamically. 
 // For now, we'll assume "All" or let the user export what is fetched.

 const [selectedColumns, setSelectedColumns] = useState([]);
 const [availableColumns, setAvailableColumns] = useState([]);

 // Fetch columns helper
 const fetchColumns = async (report, { preselect = true } = {}) => {
  if (!report.tableName) {
   setAvailableColumns(report.defaultColumns);
   if (preselect) {
    setSelectedColumns(report.defaultColumns);
   }
   return;
  }

  try {
   const res = await api.get(`/api/forms-builder/tables/${report.tableName}/columns`);
   const cols = res?.data?.columns || res?.data || [];
   // Extract column names
   const columnNames = cols.map(c => typeof c === 'string' ? c : c.column_name || c.name || c);

   if (columnNames.length > 0) {
    setAvailableColumns(columnNames);
    if (preselect) {
     setSelectedColumns(columnNames);
    }
   } else {
    setAvailableColumns(report.defaultColumns);
    if (preselect) {
     setSelectedColumns(report.defaultColumns);
    }
   }
  } catch (err) {
   console.warn("Failed to fetch columns:", err);
   setAvailableColumns(report.defaultColumns);
   if (preselect) {
    setSelectedColumns(report.defaultColumns);
   }
  }
 };

 const handleOpenModal = (report) => {
  setSelectedReport(report);
  setModalStep(1);
  setIsCustomReportFlow(false);
  setDateRange({ start: "", end: "" });
  setSelectedColumns([]);
  setTemplateName("");
  // Fetch available columns immediately so the UI can show options
  fetchColumns(report, { preselect: true });
 };

 const handleOpenCustomReportModal = () => {
  setIsCustomReportFlow(true);
  setSelectedReport(null);
  setModalStep(0);
  setDateRange({ start: "", end: "" });
  setAvailableColumns([]);
  setSelectedColumns([]);
  setTemplateName("");
 };

 const handleSelectCustomReport = (reportId) => {
  const report = REPORTS_CONFIG.find((r) => r.id === reportId) || null;
  setSelectedReport(report);
  setDateRange({ start: "", end: "" });
  setSelectedColumns([]);
  setTemplateName("");
  if (report) {
   fetchColumns(report, { preselect: false });
   setModalStep(2);
  }
 };

 const handleCloseModal = () => {
  setSelectedReport(null);
  setModalStep(1);
  setIsCustomReportFlow(false);
  setTemplateName("");
 };

 const fetchTemplates = async () => {
  setTemplatesLoading(true);
  try {
   const r = await api.get('/api/report-templates');
   setTemplates(Array.isArray(r?.data?.templates) ? r.data.templates : []);
  } catch (err) {
   console.error('Failed to load templates:', err);
   setTemplates([]);
  } finally {
   setTemplatesLoading(false);
  }
 };

 useEffect(() => {
  if (activeTab === 'templates') {
   fetchTemplates();
  }
 }, [activeTab]);

 const saveTemplate = async () => {
  if (!selectedReport) return;
  const name = String(templateName || '').trim();
  if (!name) {
   alert('Please enter a template name');
   return;
  }
  if (!Array.isArray(selectedColumns) || selectedColumns.length === 0) {
   alert('Please select at least one observation point');
   return;
  }

  setSavingTemplate(true);
  try {
   const payload = {
    template_name: name,
    report_id: selectedReport.id,
    config: {
     report_id: selectedReport.id,
     title: selectedReport.title,
     endpoint: selectedReport.endpoint,
     dataKey: selectedReport.dataKey,
     tableName: selectedReport.tableName,
     dateRange,
     selectedColumns,
    },
   };

   await api.post('/api/report-templates', payload);
   setTemplateName('');
   alert('Template saved');
   fetchTemplates();
  } catch (err) {
   console.error('Failed to save template:', err);
   alert('Failed to save template');
  } finally {
   setSavingTemplate(false);
  }
 };

 const deleteTemplate = async (id) => {
  if (!id) return;
  if (!window.confirm('Delete this template?')) return;
 try {
 await api.delete(`/api/report-templates/${id}`);
 fetchTemplates();
 } catch (err) {
 console.error('Failed to delete template:', err);
 alert('Failed to delete template');
 }
 };

 const openTemplate = async (tpl) => {
 try {
 const cfg = tpl?.config || {};
 const reportId = cfg.report_id || tpl?.report_id;
 const report = REPORTS_CONFIG.find((r) => r.id === reportId) || null;
 if (!report) {
 alert('Report not found for this template');
 return;
 }

 setActiveTab('library');
 setSelectedReport(report);
 setIsCustomReportFlow(false);
 setModalStep(2);
 setDateRange(cfg.dateRange || { start: '', end: '' });
 setSelectedColumns(Array.isArray(cfg.selectedColumns) ? cfg.selectedColumns : []);
 setTemplateName(String(tpl?.template_name || ''));
 await fetchColumns(report, { preselect: false });
 } catch (err) {
 console.error('Failed to open template:', err);
 alert('Failed to open template');
 }
 };

 const templatesByReport = useMemo(() => {
 const list = Array.isArray(templates) ? templates : [];
 const groups = {};
 for (const t of list) {
 const rid = t?.report_id || 'unknown';
 if (!groups[rid]) groups[rid] = [];
 groups[rid].push(t);
 }
 return groups;
 }, [templates]);

 const handleFullDatasetDownload = async () => {
 if (!selectedReport) return;
 setLoading(true);
 try {
 // 1. Fetch Data
 const res = await api.get(selectedReport.endpoint, { params: { limit: 10000 } }); // Fetch "all"
 let data = [];

 // Determine valid data array based on common API patterns or specific config
 const raw = res.data;
 if (Array.isArray(raw)) {
 data = raw;
 } else if (raw && Array.isArray(raw[selectedReport.dataKey])) {
 data = raw[selectedReport.dataKey];
 } else if (raw && Array.isArray(raw.data)) {
 data = raw.data; // fallback common structure
 }

 if (!data || data.length === 0) {
 alert("No data found for this module.");
 setLoading(false);
 return;
 }

 // 2. Generate CSV with ALL columns
 // Derive columns dynamically from the first record if available to ensure full dataset
 const allColumns = data.length > 0 ? Object.keys(data[0]) : selectedReport.defaultColumns;

 generateCSV(data, allColumns, `${selectedReport.id}_full_report_${new Date().toISOString().slice(0, 10)}`);

 handleCloseModal();
 } catch (err) {
 console.error("Download failed:", err);
 alert("Failed to download report. Please check your network or permissions.");
 } finally {
 setLoading(false);
 }
 };

 const handleFilteredDownload = async (type = 'csv') => {
 // This would ideally apply server-side filtering params
 // For MVP, we can fetch all and filter client-side OR assume the backend supports start_date/end_date params
 if (!selectedReport) return;
 if (!Array.isArray(selectedColumns) || selectedColumns.length === 0) {
 alert("Please select at least one observation point.");
 return;
 }
 setLoading(true);
 try {
 const params = { limit: 10000 };
 if (dateRange.start) params.start_date = dateRange.start;
 if (dateRange.end) params.end_date = dateRange.end;

 const res = await api.get(selectedReport.endpoint, { params });
 let data = [];
 const raw = res.data;
 if (Array.isArray(raw)) data = raw;
 else if (raw && Array.isArray(raw[selectedReport.dataKey])) data = raw[selectedReport.dataKey];
 else if (raw && Array.isArray(raw.data)) data = raw.data;

 // Client-side date filtering fallback if API ignores params (common safety net)
 if (dateRange.start || dateRange.end) {
 const start = dateRange.start ? new Date(dateRange.start) : null;
 const end = dateRange.end ? new Date(dateRange.end) : null;

 data = data.filter(item => {
 // Try common date fields
 const dateVal = item.created_at || item.reported_date || item.date || item.due_date;
 if (!dateVal) return true;
 const d = new Date(dateVal);
 if (start && d < start) return false;
 if (end && d > end) return false;
 return true;
 });
 }

 if (!data || data.length === 0) {
 alert("No data found matching your specific filters.");
 setLoading(false);
 return;
 }

 // Use selected columns if available, otherwise default
 const columnsToExport = selectedColumns;

 const filename = `${selectedReport.id}_filtered_report_${new Date().toISOString().slice(0, 10)}`;
 if (type === 'pdf') {
 const pdfColumns = columnsToExport.map((key) => ({
 header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
 key,
 }));
 generatePDF(data, pdfColumns, selectedReport.title, filename);
 } else {
 generateCSV(data, columnsToExport, filename);
 }
 handleCloseModal();
 } catch (err) {
 console.error("Filtered download failed:", err);
 alert("Failed to download filtered report.");
 } finally {
 setLoading(false);
 }
 };

 // Helper to fetch data for a report
 const fetchReportData = async (report) => {
 try {
 const res = await api.get(report.endpoint, { params: { limit: 10000 } });
 const raw = res.data;
 let data = [];
 if (Array.isArray(raw)) data = raw;
 else if (raw && Array.isArray(raw[report.dataKey])) data = raw[report.dataKey];
 else if (raw && Array.isArray(raw.data)) data = raw.data;
 return data;
 } catch (err) {
 console.error(`Failed to fetch data for ${report.title}:`, err);
 throw err;
 }
 };

 const handleQuickDownload = async (report, type) => {
 if (loading) return;
 setLoading(true);
 try {
 const data = await fetchReportData(report);

 if (!data || data.length === 0) {
 alert(`No data found for ${report.title}`);
 setLoading(false);
 return;
 }

 // Use configured columns by default to avoid exporting unexpected/unselected keys
 // (some endpoints return many extra fields).
 const keys = (report.defaultColumns && report.defaultColumns.length > 0)
 ? report.defaultColumns
 : (data.length > 0 ? Object.keys(data[0]) : []);

 const filename = `${report.id}_${type}_report_${new Date().toISOString().slice(0, 10)}`;

 if (type === 'pdf') {
 // Transform keys to required column objects for PDF generator
 const pdfColumns = keys.map(key => ({
 header: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
 key: key
 }));
 generatePDF(data, pdfColumns, report.title, filename);
 } else {
 generateCSV(data, keys, filename);
 }
 } catch (err) {
 alert(`Failed to download ${report.title}. Check console.`);
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-[var(--bg-primary)] p-6 font-sans">
 {/* --- HEADER --- */}
 <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
 <div>
 <h1 className="text-2xl font-bold text-slate-800">Intelligence & Reports</h1>
 <p className="text-gray-500 mt-1 text-sm">Cross-module collation and strategic insight generation.</p>
 </div>
 <button
 onClick={handleOpenCustomReportModal}
 className="bg-[#4dc8c3] hover:bg-[#2ddad6] text-white px-5 py-2.5 rounded-xl shadow-lg shadow-[#4dc8c3]/20 font-medium flex items-center gap-2 transition-all"
 >
 <Plus className="w-4 h-4" />
 <span>New Custom Report</span>
 </button>
 </div>

 {/* --- TABS & FILTERS --- */}
 <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
 <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex gap-1">
 <button
 onClick={() => setActiveTab("library")}
 className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'library' ? "bg-[#4dc8c3] text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
 >
 Standard Library
 </button>
 <button
 onClick={() => setActiveTab("templates")}
 className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'templates' ? "bg-[#4dc8c3] text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
 >
 Saved Templates
 </button>
 </div>

 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
 <span className="text-xs font-bold text-gray-400 tracking-wider">TIMEFRAME:</span>
 {['ALL', '7D', '30D', '365D'].map(tf => (
 <button key={tf} className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors ${tf === 'ALL' ? "bg-[#4dc8c3] text-white" : "text-gray-500 hover:bg-gray-100"}`}>
 {tf}
 </button>
 ))}
 </div>
 </div>

 {/* --- REPORTS GRID --- */}
 {activeTab === 'library' ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {REPORTS_CONFIG.map(report => (
 <div key={report.id} className="bg-white rounded-xl p-6 shadow-sm transition-shadow border border-gray-100 flex flex-col h-full group transition-all hover:shadow-md hover:-translate-y-0.5">
 <div className="flex items-start justify-between mb-4">
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${report.color} mb-4 group-hover:scale-110 transition-transform`}>
 {report.icon}
 </div>
 <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
 {report.category}
 </span>
 </div>

 <h3 className="text-lg font-bold text-slate-800 mb-2">{report.title}</h3>
 <p className="text-sm text-gray-500 mb-6 flex-1 leading-relaxed">
 {report.description}
 </p>

 <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
 <button
 onClick={() => handleQuickDownload(report, 'pdf')}
 disabled={loading}
 className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors"
 title="Download PDF"
 >
 {loading ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <FileText className="w-4 h-4" />}
 </button>
 <button
 onClick={() => handleQuickDownload(report, 'csv')}
 disabled={loading}
 className="p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 rounded-xl transition-colors"
 title="Download CSV"
 >
 {loading ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Download className="w-4 h-4" />}
 </button>
 <button
 onClick={() => handleOpenModal(report)}
 className="ml-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 transition-colors shadow-sm"
 >
 <Plus className="w-4 h-4" />
 Generate Report
 </button>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="space-y-6">
 {templatesLoading ? (
 <div className="flex items-center justify-center py-20 text-gray-500">Loading templates...</div>
 ) : templates.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
 <Filter className="w-8 h-8 text-gray-400" />
 </div>
 <h3 className="text-lg font-bold text-slate-800 mb-2">No Saved Templates</h3>
 <p className="text-gray-500 max-w-md">You haven't saved any custom report configurations yet. Create a filtered analysis and save it as a template.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {Object.entries(templatesByReport).map(([reportId, list]) => {
 const report = REPORTS_CONFIG.find((r) => r.id === reportId);
 return (
 <div key={reportId} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md hover:-translate-y-0.5">
 <div className="flex items-start justify-between mb-4">
 <div>
 <div className="text-xs font-bold text-gray-400 tracking-wider uppercase">Report</div>
 <div className="text-lg font-bold text-slate-800">{report?.title || reportId}</div>
 </div>
 </div>
 <div className="space-y-2">
 {list.map((t) => (
 <div key={t.id} className="flex items-center gap-2 border border-gray-100 rounded-xl px-3 py-2">
 <div className="min-w-0 flex-1">
 <div className="text-sm font-semibold text-slate-800 truncate">{t.template_name}</div>
 {t.saved_by_name ? (
 <div className="text-[11px] text-gray-400 truncate">Saved by: {t.saved_by_name}</div>
 ) : null}
 <div className="text-[11px] text-gray-400 truncate">Updated: {t.updated_at ? new Date(t.updated_at).toLocaleString() : '-'}</div>
 </div>
 <button
 onClick={() => openTemplate(t)}
 className="px-3 py-1.5 rounded-xl bg-[#4dc8c3] hover:bg-[#2ddad6] text-white text-xs font-bold"
 >
 Open
 </button>
 <button
 onClick={() => deleteTemplate(t.id)}
 className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600"
 >
 Delete
 </button>
 </div>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* --- MODAL --- */}
 {(selectedReport || isCustomReportFlow) && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
 <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
 {/* Modal Header */}
 <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
 <div className="flex items-center gap-4">
 {selectedReport ? (
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedReport.color}`}>
 {selectedReport.icon}
 </div>
 ) : (
 <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-100 text-slate-500">
 <Database className="w-6 h-6" />
 </div>
 )}
 <div>
 <h2 className="text-xl font-bold text-slate-900">Collation Parameters</h2>
 <p className="text-[#4dc8c3] text-xs font-bold tracking-wider uppercase mt-1">{selectedReport ? selectedReport.title : 'Custom Report'}</p>
 </div>
 </div>
 <button onClick={handleCloseModal} className="rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
 <X className="w-6 h-6" />
 </button>
 </div>

 {/* Modal Content */}
 <div className="p-8 bg-slate-50/50 flex-1 overflow-y-auto">
 {modalStep === 0 ? (
 <div className="space-y-6">
 <div>
 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Report</label>
 <select
 value={selectedReport?.id || ''}
 onChange={(e) => handleSelectCustomReport(e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#4dc8c3]/30"
 >
 <option value="" disabled>Select a report</option>
 {REPORTS_CONFIG.map((r) => (
 <option key={r.id} value={r.id}>{r.title}</option>
 ))}
 </select>
 </div>

 <div className="bg-white border border-gray-100 rounded-xl p-4 text-sm text-gray-500">
 Choose a report to configure columns and download as PDF or CSV.
 </div>
 </div>
 ) : modalStep === 1 ? (
 /* STEP 1: SELECTION */
 <div className="space-y-4">
 <div className="text-center mb-8 px-8">
 <p className="text-gray-500 italic text-sm">
 "Selective insights allow for more focused strategic analysis. Please choose the depth of extraction required."
 </p>
 </div>

 {/* Option 1: Full Dataset */}
 <button
 onClick={handleFullDatasetDownload}
 disabled={loading}
 className="w-full bg-white hover:border-[#35eae6]/50 border border-transparent p-6 rounded-xl -xl shadow-sm transition-all group flex items-center gap-5 text-left"
 >
 <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#35eae6]/10 transition-colors">
 <Database className="w-6 h-6 text-slate-400 group-hover:text-[#4dc8c3]" />
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-bold text-slate-800">Full Dataset</h3>
 <p className="text-sm text-gray-500">Collate all historically documented nodes</p>
 </div>
 {loading ? (
 <div className="animate-spin w-5 h-5 border-2 border-[#4dc8c3] border-t-transparent rounded-full" />
 ) : (
 <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#4dc8c3] transition-colors" />
 )}
 </button>

 {/* Option 2: Filtered Analysis */}
 <button
 onClick={() => setModalStep(2)}
 disabled={loading}
 className="w-full bg-white hover:border-[#35eae6]/50 border border-transparent p-6 rounded-xl shadow-sm transition-all group flex items-center gap-5 text-left"
 >
 <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#35eae6]/10 transition-colors">
 <Filter className="w-6 h-6 text-slate-400 group-hover:text-[#4dc8c3]" />
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-bold text-slate-800">Filtered Analysis</h3>
 <p className="text-sm text-gray-500">Define specific observation constraints</p>
 </div>
 <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#35eae6] transition-colors" />
 </button>
 </div>
 ) : (
 /* STEP 2: FILTERS */
 <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
 {/* Temporal Range */}
 <div>
 <div className="flex items-center gap-2 mb-4">
 <Calendar className="w-4 h-4 text-[#4dc8c3]" />
 <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Temporal Range</h4>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-white p-3 rounded-xl border border-gray-200">
 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Start</label>
 <input
 type="date"
 value={dateRange.start}
 onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
 className="w-full text-sm font-medium text-slate-800 outline-none rounded-xl"
 />
 </div>
 <div className="bg-white p-3 rounded-xl border border-gray-200">
 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">End</label>
 <input
 type="date"
 value={dateRange.end}
 onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
 className="w-full text-sm font-medium text-slate-800 outline-none rounded-xl"
 />
 </div>
 </div>
 </div>

 {/* Observation Points (Columns) - Visual Only for now as we export default columns */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <ListIcon className="w-4 h-4 text-[#4dc8c3]" />
 <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Observation Points</h4>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => setSelectedColumns(availableColumns)}
 className="text-[10px] font-bold text-[#4dc8c3] hover:text-[#2ddad6] rounded-xl"
 >
 SELECT ALL
 </button>
 <button
 onClick={() => setSelectedColumns([])}
 className="text-[10px] font-bold text-gray-400 hover:text-gray-600 rounded-xl"
 >
 CLEAR
 </button>
 </div>
 </div>
 <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
 {availableColumns.map(col => (
 <button
 key={col}
 onClick={() => {
 if (selectedColumns.includes(col)) {
 setSelectedColumns(prev => prev.filter(c => c !== col));
 } else {
 setSelectedColumns(prev => [...prev, col]);
 }
 }}
 className={`px-3 py-1.5 text-xs font-bold rounded-full capitalize shadow-sm transition-all border ${selectedColumns.includes(col)
 ? "bg-slate-800 text-white border-transparent"
 : "bg-white text-gray-500 border-gray-200 hover:border-slate-300"
 }`}
 >
 {col.replace(/_/g, ' ')}
 </button>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <button
 onClick={() => handleFilteredDownload('pdf')}
 disabled={loading || selectedColumns.length === 0}
 className="w-full bg-[#4dc8c3] hover:bg-[#2ddad6] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#4dc8c3]/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
 >
 {loading ? (
 <>
 <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
 <span>Generating PDF...</span>
 </>
 ) : (
 <>
 <FileText className="w-5 h-5" />
 <span>Download PDF</span>
 </>
 )}
 </button>

 <button
 onClick={() => handleFilteredDownload('csv')}
 disabled={loading || selectedColumns.length === 0}
 className="w-full bg-white hover:bg-gray-50 text-slate-800 py-4 rounded-xl font-bold shadow-lg border border-gray-200 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
 >
 {loading ? (
 <>
 <div className="animate-spin w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full" />
 <span>Generating CSV...</span>
 </>
 ) : (
 <>
 <Download className="w-5 h-5" />
 <span>Download CSV</span>
 </>
 )}
 </button>
 </div>

 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Save as template</div>
 <div className="flex flex-col sm:flex-row gap-2">
 <input
 value={templateName}
 onChange={(e) => setTemplateName(e.target.value)}
 placeholder="Template name"
 className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#4dc8c3]/30"
 />
 <button
 onClick={saveTemplate}
 disabled={savingTemplate}
 className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl -xl text-sm font-bold"
 >
 {savingTemplate ? 'Saving...' : 'Save Template'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Back Button for Step 2 */}
 {modalStep === 2 && !isCustomReportFlow && (
 <div className="px-8 py-4 bg-white border-t border-gray-100 flex justify-start">
 <button
 onClick={() => setModalStep(1)}
 className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-2 rounded-xl"
 >
 ← Back to Parameters
 </button>
 </div>
 )}

 {modalStep === 2 && isCustomReportFlow && (
 <div className="px-8 py-4 bg-white border-t border-gray-100 flex justify-start">
 <button
 onClick={() => {
 setSelectedReport(null);
 setAvailableColumns([]);
 setSelectedColumns([]);
 setModalStep(0);
 }}
 className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-2 rounded-xl"
 >
 ← Back to Report Selection
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 );
}

function ListIcon({ className }) {
 return (
 <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <line x1="8" y1="6" x2="21" y2="6" />
 <line x1="8" y1="12" x2="21" y2="12" />
 <line x1="8" y1="18" x2="21" y2="18" />
 <line x1="3" y1="6" x2="3.01" y2="6" />
 <line x1="3" y1="12" x2="3.01" y2="12" />
 <line x1="3" y1="18" x2="3.01" y2="18" />
 </svg>
 )
}
