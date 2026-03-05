import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function FormSubmissions(props) {
 const { formId } = useParams();
 const navigate = useNavigate();
 const user = props?.user || {};
 const prefix = user?.role === 'manager' ? '/manager' : '/admin';

 const [submissions, setSubmissions] = useState([]);
 const [form, setForm] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 useEffect(() => {
 const fetchData = async () => {
 try {
 const formRes = await axios.get(`/api/forms/${formId}`);
 setForm(formRes?.data?.form);

 const subRes = await axios.get(`/api/forms/${formId}/submissions`);
 setSubmissions(subRes?.data?.submissions || []);
 setError(null);
 } catch (err) {
 setError(err?.response?.data?.error || err.message);
 } finally {
 setLoading(false);
 }
 };

 fetchData();
 }, [formId]);

 const schema = form?.schema || { fields: [] };

 if (loading) {
 return <div className="p-6">Loading submissions...</div>;
 }

 return (
 <div className="p-6">
 <div className="flex justify-between items-center mb-6">
 <div>
 <h1 className="text-2xl font-semibold">Form Submissions</h1>
 <p className="text-sm text-gray-600 mt-1">{schema.formName}</p>
 </div>
 <button 
 onClick={() => navigate(`${prefix}/forms`)}
 className="px-4 py-2 bg-gray-200 rounded-xl"
 >
 Back
 </button>
 </div>

 {error && (
 <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-xl">
 {error}
 </div>
 )}

 {submissions.length === 0 ? (
 <div className="text-center py-12 bg-gray-50 rounded-xl">
 <p className="text-gray-600">No submissions yet.</p>
 </div>
 ) : (
 <div className="overflow-x-auto border rounded-xl">
 <table className="w-full text-sm">
 <thead className="bg-gray-50 border-b">
 <tr>
 {schema.fields?.map((field) => (
 <th key={field.name} className="px-6 py-3 text-left font-medium">
 {field.name}
 </th>
 ))}
 <th className="px-6 py-3 text-left font-medium">Submitted</th>
 </tr>
 </thead>
 <tbody>
 {submissions.map((sub, idx) => (
 <tr key={idx} className="border-b hover:bg-gray-50">
 {schema.fields?.map((field) => (
 <td key={field.name} className="px-6 py-3">
 {sub[field.name] !== null && sub[field.name] !== undefined
 ? String(sub[field.name])
 : "-"}
 </td>
 ))}
 <td className="px-6 py-3 text-xs text-gray-600">
 {new Date(sub.created_at).toLocaleDateString()}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}
