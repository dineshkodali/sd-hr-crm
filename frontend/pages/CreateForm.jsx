import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
// Importing icons for better UX
import { 
 Plus, 
 Trash2, 
 Save, 
 FileText, 
 Settings, 
 CheckCircle, 
 AlertCircle,
 GripVertical 
} from "lucide-react";

export default function CreateForm(props) {
 // eslint-disable-next-line no-unused-vars
 const user = props?.user || {};
 
 // --- STATE (Unchanged) ---
 const [formId, setFormId] = useState("");
 const [formName, setFormName] = useState("");
 const [fields, setFields] = useState([
 { name: "full_name", type: "text", required: true }
 ]);
 const inputRefs = useRef([]);
 const [status, setStatus] = useState(null);

 // --- LOGIC (Unchanged) ---
 const addField = () => {
 setFields(prev => {
 const newFields = [...prev, { name: "", type: "text", required: false }];
 setTimeout(() => {
 if (inputRefs.current[newFields.length - 1]) {
 inputRefs.current[newFields.length - 1].focus();
 }
 }, 0);
 return newFields;
 });
 };
 
 const updateField = (idx, key, value) => {
 const copy = [...fields];
 copy[idx][key] = value;
 setFields(copy);
 };

 const removeField = (idx) => setFields(fields.filter((_, i) => i !== idx));

 const handleSave = async () => {
 if (!formId || !formName) {
 setStatus({ type: 'error', message: 'Please provide both Form ID and Form Name.' });
 return;
 }

 const payload = {
 formId,
 formName,
 fields
 };

 try {
 const res = await axios.post('/api/forms', payload);
 setStatus({ type: 'success', message: res?.data?.message || 'Form saved successfully!' });
 // Clear status after 3 seconds
 setTimeout(() => setStatus(null), 3000);
 } catch (err) {
 setStatus({ type: 'error', message: err?.response?.data?.error || err.message });
 }
 };

 // --- RENDER ---
 return (
 <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
 <div className="p-3 sm:p-4 md:p-6">
 
 {/* Header Section */}
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
 <FileText className="text-orange-500 w-8 h-8" />
 Form Builder
 </h1>
 <p className="text-gray-500 mt-1">Design your form structure and settings below.</p>
 </div>
 <button 
 onClick={handleSave} 
 className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md transition-all font-medium active:scale-95"
 >
 <Save className="w-4 h-4" /> Save Form
 </button>
 </div>

 {/* Status Notification */}
 {status && (
 <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 shadow-sm border ${
 status.type === 'error' 
 ? 'bg-red-50 text-red-800 border-red-200' 
 : 'bg-green-50 text-green-800 border-green-200'
 }`}>
 {status.type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
 <span className="font-medium">{status.message}</span>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 
 {/* LEFT COLUMN: Global Settings */}
 <div className="lg:col-span-1 space-y-6">
 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
 <div className="flex items-center gap-2 mb-4 text-gray-800 font-semibold border-b pb-2">
 <Settings className="w-4 h-4 text-gray-500" />
 <h2>Configuration</h2>
 </div>
 
 <div className="space-y-4">
 <div>
 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Form ID</label>
 <input 
 value={formId} 
 onChange={(e) => setFormId(e.target.value)} 
 className="w-full border-gray-300 border p-2.5 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-sm font-mono bg-gray-50" 
 placeholder="e.g. employee_onboarding" 
 />
 <p className="text-xs text-gray-400 mt-1">Used for database indexing.</p>
 </div>

 <div>
 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Form Name</label>
 <input 
 value={formName} 
 onChange={(e) => setFormName(e.target.value)} 
 className="w-full border-gray-300 border p-2.5 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-sm" 
 placeholder="e.g. Employee Onboarding" 
 />
 </div>
 </div>
 </div>
 </div>

 {/* RIGHT COLUMN: Field Builder */}
 <div className="lg:col-span-2">
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
 <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
 <h2 className="font-semibold text-gray-700">Form Fields ({fields.length})</h2>
 <span className="text-xs text-gray-400">Manage your inputs</span>
 </div>

 <div className="p-6 space-y-4">
 {fields.map((f, idx) => (
 <div key={idx} className="group relative bg-white border border-gray-200 hover:border-orange-300 rounded-xl p-4 transition-all shadow-sm ">
 
 {/* Drag Handle Visual (Non-functional, purely aesthetic) */}
 <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 cursor-move">
 <GripVertical className="w-4 h-4" />
 </div>

 <div className="pl-6 grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
 
 {/* Field Name */}
 <div className="sm:col-span-5">
 <label className="block text-xs text-gray-400 mb-1">Field Name (Key)</label>
 <input
 ref={el => (inputRefs.current[idx] = el)}
 value={f.name}
 onChange={e => updateField(idx, 'name', e.target.value)}
 placeholder="e.g. user_email"
 className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-orange-500 outline-none"
 autoComplete="off"
 />
 </div>

 {/* Field Type */}
 <div className="sm:col-span-3">
 <label className="block text-xs text-gray-400 mb-1">Input Type</label>
 <select 
 value={f.type} 
 onChange={(e) => updateField(idx, 'type', e.target.value)} 
 className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:border-orange-500 outline-none"
 >
 <option value="text">Text</option>
 <option value="email">Email</option>
 <option value="date">Date</option>
 <option value="select">Select</option>
 <option value="number">Number</option>
 </select>
 </div>

 {/* Requirements & Actions */}
 <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-4 mt-1 h-full pt-4">
 <label className="flex items-center gap-2 cursor-pointer select-none">
 <input 
 type="checkbox" 
 checked={!!f.required} 
 onChange={(e) => updateField(idx, 'required', e.target.checked)} 
 className="w-4 h-4 text-orange-600 rounded-xl focus:ring-orange-500"
 />
 <span className="text-sm text-gray-600">Required</span>
 </label>

 <button 
 onClick={() => removeField(idx)} 
 className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
 title="Remove Field"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 ))}

 {/* Add Field Button */}
 <button 
 onClick={addField} 
 className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 mt-4"
 >
 <Plus className="w-5 h-5" /> Add New Field
 </button>
 </div>
 </div>

 {/* Mobile Save Button */}
 <div className="mt-6 md:hidden">
 <button 
 onClick={handleSave} 
 className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl shadow-lg font-bold"
 >
 <Save className="w-4 h-4" /> Save Form
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}