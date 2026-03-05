import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    ClipboardCheck,
    Plus,
    Clock,
    AlertCircle,
    FileText,
    User,
    Calendar,
    ChevronDown,
    ChevronUp,
    Briefcase
} from "lucide-react";

const api = axios.create({
    baseURL: '',
    withCredentials: true,
});

export default function ShiftHandovers({ user }) {
    const [handovers, setHandovers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const [form, setForm] = useState({
        shift_date: new Date().toISOString().split("T")[0],
        shift_type: "Morning",
        tasks_completed: "",
        issues_reported: "",
        handover_notes: "",
    });

    const fetchHandovers = async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/shift-handovers");
            setHandovers(res.data.handovers || []);
        } catch (err) {
            setError("Failed to load shift handovers");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHandovers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const payload = {
                ...form,
                employee_name: user?.name || "Employee",
            };
            await api.post("/api/shift-handovers", payload);
            setShowForm(false);
            setForm({
                shift_date: new Date().toISOString().split("T")[0],
                shift_type: "Morning",
                tasks_completed: "",
                issues_reported: "",
                handover_notes: "",
            });
            fetchHandovers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit handover");
        } finally {
            setSubmitting(false);
        }
    };

    const getShiftColor = (type) => {
        switch (type) {
            case "Morning": return "bg-blue-100 text-blue-700 border-blue-200";
            case "Afternoon": return "bg-orange-100 text-orange-700 border-orange-200";
            case "Night": return "bg-indigo-100 text-indigo-700 border-indigo-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardCheck className="w-6 h-6 text-teal-600" />
                        Shift Handovers
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Log your daily work and hand over to the next shift
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${showForm
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : "bg-teal-500 text-white hover:bg-teal-600"
                        }`}
                >
                    {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> New Handover</>}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex justify-between items-center">
                    <span>{error}</span>
                    <button
                        onClick={fetchHandovers}
                        className="text-xs font-bold uppercase tracking-wider bg-red-100 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {showForm && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-teal-500" />
                        Submit Shift Handover
                    </h4>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Shift Date</label>
                            <input
                                type="date"
                                required
                                value={form.shift_date}
                                onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Shift Type</label>
                            <select
                                required
                                value={form.shift_type}
                                onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            >
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="Night">Night</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tasks Completed</label>
                            <textarea
                                required
                                rows={3}
                                placeholder="What did you work on today?"
                                value={form.tasks_completed}
                                onChange={(e) => setForm({ ...form, tasks_completed: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            ></textarea>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Issues Reported (Optional)</label>
                            <textarea
                                rows={2}
                                placeholder="Any problems encountered?"
                                value={form.issues_reported}
                                onChange={(e) => setForm({ ...form, issues_reported: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            ></textarea>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Handover Notes</label>
                            <textarea
                                required
                                rows={2}
                                placeholder="Notes for the next employee..."
                                value={form.handover_notes}
                                onChange={(e) => setForm({ ...form, handover_notes: e.target.value })}
                                className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            ></textarea>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-teal-600 shadow-md transition-all disabled:opacity-50"
                            >
                                {submitting ? "Submitting..." : "Submit Handover"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-gray-500">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading handovers...</p>
                </div>
            ) : handovers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No shift handovers logged yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {handovers.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                        >
                            <div
                                className="p-4 cursor-pointer flex items-center justify-between"
                                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${getShiftColor(item.shift_type)}`}>
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-gray-900">
                                            {new Date(item.shift_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </h5>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${getShiftColor(item.shift_type)}`}>
                                                {item.shift_type}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Submitted {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </div>

                            {expandedId === item.id && (
                                <div className="px-14 pb-6 pt-2 border-t border-gray-50 space-y-4">
                                    <div>
                                        <h6 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tasks Completed</h6>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.tasks_completed}</p>
                                    </div>
                                    {item.issues_reported && (
                                        <div>
                                            <h6 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Issues Reported
                                            </h6>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.issues_reported}</p>
                                        </div>
                                    )}
                                    <div>
                                        <h6 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-1">Handover Notes</h6>
                                        <p className="text-sm text-gray-700 border-l-4 border-teal-100 pl-3 italic">{item.handover_notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
