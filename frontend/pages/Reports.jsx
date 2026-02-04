/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
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


export default function Reports() {
  const [activeTab, setActiveTab] = useState("library"); // library, templates
  const [selectedReport, setSelectedReport] = useState(null); // The report object currently in modal
  const [modalStep, setModalStep] = useState(1); // 1 = Selection, 2 = Filtered Analysis
  const [loading, setLoading] = useState(false);

  // Filter State
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  // In a real filtered analysis, we would fetch columns dynamically. 
  // For now, we'll assume "All" or let the user export what is fetched.
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);

  // Fetch columns helper
  const fetchColumns = async (report) => {
    if (!report.tableName) {
      setAvailableColumns(report.defaultColumns);
      setSelectedColumns(report.defaultColumns);
      return;
    }

    try {
      const res = await api.get(`/api/forms-builder/tables/${report.tableName}/columns`);
      const cols = res?.data?.columns || res?.data || [];
      // Extract column names
      const columnNames = cols.map(c => typeof c === 'string' ? c : c.column_name || c.name || c);

      if (columnNames.length > 0) {
        setAvailableColumns(columnNames);
        setSelectedColumns(columnNames); // Default to all selected
      } else {
        setAvailableColumns(report.defaultColumns);
        setSelectedColumns(report.defaultColumns);
      }
    } catch (err) {
      console.warn("Failed to fetch columns:", err);
      setAvailableColumns(report.defaultColumns);
      setSelectedColumns(report.defaultColumns);
    }
  };

  const handleOpenModal = (report) => {
    setSelectedReport(report);
    setModalStep(1);
    setDateRange({ start: "", end: "" });
    setSelectedColumns([]);
    // Fetch available columns immediately when opening modal or when switching to step 2? 
    // Let's do it now to be ready
    fetchColumns(report);
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
    setModalStep(1);
  };

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

  const handleFilteredDownload = async () => {
    // This would ideally apply server-side filtering params
    // For MVP, we can fetch all and filter client-side OR assume the backend supports start_date/end_date params
    if (!selectedReport) return;
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
      const columnsToExport = selectedColumns.length > 0 ? selectedColumns : selectedReport.defaultColumns;

      generateCSV(data, columnsToExport, `${selectedReport.id}_filtered_report_${new Date().toISOString().slice(0, 10)}`);
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

      // Derive columns from first record or defaults
      const keys = data.length > 0 ? Object.keys(data[0]) : report.defaultColumns;

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
    <div className="min-h-screen bg-[#f8f9fa] p-6 font-sans">
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Intelligence & Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Cross-module collation and strategic insight generation.</p>
        </div>
        <button className="bg-[#4dc8c3] hover:bg-[#2ddad6] text-white px-5 py-2.5 rounded-lg shadow-lg shadow-[#4dc8c3]/20 font-medium flex items-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          <span>New Custom Report</span>
        </button>
      </div>

      {/* --- TABS & FILTERS --- */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex gap-1">
          <button
            onClick={() => setActiveTab("library")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'library' ? "bg-[#4dc8c3] text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
          >
            Standard Library
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'templates' ? "bg-[#4dc8c3] text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
          >
            Saved Templates
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          <span className="text-xs font-bold text-gray-400 tracking-wider">TIMEFRAME:</span>
          {['ALL', '7D', '30D', '365D'].map(tf => (
            <button key={tf} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${tf === 'ALL' ? "bg-[#4dc8c3] text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* --- REPORTS GRID --- */}
      {activeTab === 'library' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {REPORTS_CONFIG.map(report => (
            <div key={report.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-shadow border border-gray-100 flex flex-col h-full group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${report.color} mb-4 group-hover:scale-110 transition-transform`}>
                  {report.icon}
                </div>
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase">
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
                  className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                  title="Download PDF"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <FileText className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleQuickDownload(report, 'csv')}
                  disabled={loading}
                  className="p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors"
                  title="Download CSV"
                >
                  {loading ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleOpenModal(report)}
                  className="ml-auto bg-[#4dc8c3] hover:bg-[#2ddad6] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-[#4dc8c3]/20 flex items-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Generate Report
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Saved Templates</h3>
          <p className="text-gray-500 max-w-md">You haven't saved any custom report configurations yet. Create a filtered analysis and save it as a template.</p>
        </div>
      )}

      {/* --- MODAL --- */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedReport.color}`}>
                  {selectedReport.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Collation Parameters</h2>
                  <p className="text-[#4dc8c3] text-xs font-bold tracking-wider uppercase mt-1">{selectedReport.title}</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 bg-slate-50/50 flex-1 overflow-y-auto">
              {modalStep === 1 ? (
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
                    className="w-full bg-white hover:border-[#35eae6]/50 border border-transparent p-6 rounded-xl shadow-sm hover:shadow-md transition-all group flex items-center gap-5 text-left"
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
                    className="w-full bg-white hover:border-[#35eae6]/50 border border-transparent p-6 rounded-xl shadow-sm hover:shadow-md transition-all group flex items-center gap-5 text-left"
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
                          className="w-full text-sm font-medium text-slate-800 outline-none"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">End</label>
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                          className="w-full text-sm font-medium text-slate-800 outline-none"
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
                          className="text-[10px] font-bold text-[#4dc8c3] hover:text-[#2ddad6]"
                        >
                          SELECT ALL
                        </button>
                        <button
                          onClick={() => setSelectedColumns([])}
                          className="text-[10px] font-bold text-gray-400 hover:text-gray-600"
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

                  <button
                    onClick={handleFilteredDownload}
                    disabled={loading}
                    className="w-full bg-[#4dc8c3] hover:bg-[#2ddad6] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#4dc8c3]/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Generating Insight...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        <span>Generate Insight</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Back Button for Step 2 */}
            {modalStep === 2 && (
              <div className="px-8 py-4 bg-white border-t border-gray-100 flex justify-start">
                <button
                  onClick={() => setModalStep(1)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-2"
                >
                  ← Back to Parameters
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
