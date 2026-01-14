import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function FormView(props) {
  const { formId } = useParams();
  const navigate = useNavigate();
  const user = props?.user || {};
  const prefix = user?.role === 'manager' ? '/manager' : '/admin';

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await axios.get(`/api/forms/${formId}`);
        setForm(res?.data?.form);
        setError(null);
      } catch (err) {
        setError(err?.response?.data?.error || err.message);
        setForm(null);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  if (loading) {
    return <div className="p-6">Loading form...</div>;
  }

  if (error || !form) {
    return (
      <div className="p-6">
        <div className="text-red-600 mb-4">{error || "Form not found"}</div>
        <button onClick={() => navigate(`${prefix}/forms`)} className="px-4 py-2 bg-gray-200 rounded">
          Back to Forms
        </button>
      </div>
    );
  }

  const schema = form.schema || { fields: [] };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{schema.formName}</h1>
          <p className="text-sm text-gray-600 mt-1">ID: <code>{schema.formId}</code></p>
        </div>
        <button 
          onClick={() => navigate(`${prefix}/forms`)}
          className="px-4 py-2 bg-gray-200 rounded"
        >
          Back
        </button>
      </div>

      <div className="bg-white border rounded-lg p-6 max-w-2xl">
        <h2 className="font-semibold mb-4">Form Schema</h2>
        <div className="space-y-3">
          {schema.fields?.map((field, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <p className="font-medium">{field.name}</p>
                <p className="text-sm text-gray-600">{field.type}</p>
              </div>
              {field.required && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                  Required
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button 
            onClick={() => navigate(`${prefix}/forms/${formId}/submissions`)}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            View Submissions
          </button>
          <button 
            onClick={() => navigate(`${prefix}/forms`)}
            className="px-4 py-2 border border-gray-300 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
