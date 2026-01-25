import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// --- Icons Components ---
const Icons = {
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Edit: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  Trash: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  Table: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  Database: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  ),
  Columns: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
  ),
  Refresh: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  X: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  AlertCircle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  )
};

export default function Forms() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [showEditColumnModal, setShowEditColumnModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editingColumn, setEditingColumn] = useState(null);

  // Column form data
  const [columnForm, setColumnForm] = useState({
    column_name: '',
    data_type: 'VARCHAR',
    input_type: 'text',
    input_options: [],
    max_length: '255',
    nullable: true,
    default_value: '',
    unique: false
  });

  const inputTypes = ['text', 'dropdown', 'checkbox', 'switch'];

  const dataTypes = [
    'VARCHAR', 'TEXT', 'INTEGER', 'BIGINT', 'DECIMAL', 'NUMERIC',
    'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIME', 'JSON', 'JSONB', 'UUID'
  ];

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    const shouldHide = !!(showAddColumnModal || showEditColumnModal);
    document.body.classList.toggle("form-modal-open", shouldHide);
    return () => {
      document.body.classList.remove("form-modal-open");
    };
  }, [showAddColumnModal, showEditColumnModal]);

  useEffect(() => {
    if (selectedTable) {
      fetchColumns(selectedTable);
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/forms-builder/tables', { withCredentials: true });
      setTables(res.data.tables || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch tables');
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async (tableName) => {
    try {
      const res = await axios.get(`/api/forms-builder/tables/${tableName}/columns`, {
        withCredentials: true
      });
      setColumns(res.data.columns || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch columns');
      setColumns([]);
    }
  };

  const handleAddColumn = async () => {
    try {
      const cleanedOptions = (columnForm.input_options || [])
        .map(v => String(v ?? '').trim())
        .filter(Boolean);
      const payload = {
        ...columnForm,
        input_options: columnForm.input_type === 'dropdown' ? cleanedOptions : null,
      };

      await axios.post(`/api/forms-builder/tables/${selectedTable}/columns`, payload, {
        withCredentials: true
      });

      setSuccess(`Column "${columnForm.column_name}" added successfully!`);
      setShowAddColumnModal(false);
      resetColumnForm();
      fetchColumns(selectedTable);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add column');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleEditColumn = async () => {
    try {
      const cleanedOptions = (columnForm.input_options || [])
        .map(v => String(v ?? '').trim())
        .filter(Boolean);
      const payload = {
        new_column_name: columnForm.column_name !== editingColumn.column_name ? columnForm.column_name : undefined,
        data_type: columnForm.data_type,
        input_type: columnForm.input_type,
        input_options: columnForm.input_type === 'dropdown' ? cleanedOptions : null,
        max_length: columnForm.max_length,
        nullable: columnForm.nullable,
        default_value: columnForm.default_value
      };

      await axios.put(
        `/api/forms-builder/tables/${selectedTable}/columns/${editingColumn.column_name}`,
        payload,
        { withCredentials: true }
      );

      const displayName = columnForm.column_name !== editingColumn.column_name
        ? `"${editingColumn.column_name}" renamed to "${columnForm.column_name}"`
        : `"${editingColumn.column_name}"`;

      setSuccess(`Column ${displayName} updated successfully!`);
      setShowEditColumnModal(false);
      setEditingColumn(null);
      resetColumnForm();
      fetchColumns(selectedTable);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update column');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteColumn = async (columnName) => {
    try {
      await axios.delete(
        `/api/forms-builder/tables/${selectedTable}/columns/${columnName}`,
        { withCredentials: true }
      );

      setSuccess(`Column "${columnName}" deleted successfully!`);
      setShowDeleteConfirm(null);
      fetchColumns(selectedTable);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete column');
      setTimeout(() => setError(null), 5000);
    }
  };

  const openEditModal = (column) => {
    setEditingColumn(column);
    setColumnForm({
      column_name: column.column_name,
      data_type: column.data_type,
      input_type: column.input_type || 'text',
      input_options: Array.isArray(column.input_options) ? column.input_options : [],
      max_length: column.character_maximum_length || '',
      nullable: column.is_nullable === 'YES',
      default_value: column.column_default || '',
      unique: false
    });
    setShowEditColumnModal(true);
  };

  const resetColumnForm = () => {
    setColumnForm({
      column_name: '',
      data_type: 'VARCHAR',
      input_type: 'text',
      input_options: [],
      max_length: '255',
      nullable: true,
      default_value: '',
      unique: false
    });
  };

  const addDropdownOption = () => {
    setColumnForm((prev) => ({
      ...prev,
      input_options: [...(prev.input_options || []), ""]
    }));
  };

  const updateDropdownOption = (idx, value) => {
    setColumnForm((prev) => {
      const next = [...(prev.input_options || [])];
      next[idx] = value;
      return { ...prev, input_options: next };
    });
  };

  const removeDropdownOption = (idx) => {
    setColumnForm((prev) => ({
      ...prev,
      input_options: (prev.input_options || []).filter((_, i) => i !== idx)
    }));
  };

  const filteredTables = tables.filter(t =>
    t.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ColumnModal = ({ show, onClose, onSave, title, isEdit = false }) => {
    if (!show) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-cyan-50">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {isEdit ? 'Modify column properties' : 'Add a new column to the table'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <Icons.X />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Column Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Column Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={columnForm.column_name}
                onChange={(e) => setColumnForm({ ...columnForm, column_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-mono text-sm"
                placeholder="e.g., employee_name"
              />
              <p className="text-xs text-slate-500 mt-1">Use lowercase and underscores only</p>
            </div>

            {/* Data Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Data Type <span className="text-red-500">*</span>
              </label>
              <select
                value={columnForm.data_type}
                onChange={(e) => setColumnForm({ ...columnForm, data_type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              >
                {dataTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Input Type <span className="text-red-500">*</span>
              </label>
              <select
                value={columnForm.input_type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setColumnForm((prev) => ({
                    ...prev,
                    input_type: nextType,
                    input_options: nextType === 'dropdown'
                      ? (Array.isArray(prev.input_options) ? prev.input_options : [])
                      : []
                  }));
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              >
                {inputTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {columnForm.input_type === 'dropdown' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Dropdown Options
                  </label>
                  <button
                    type="button"
                    onClick={addDropdownOption}
                    className="px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-lg text-sm font-semibold hover:bg-teal-100 transition-colors"
                  >
                    Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {(Array.isArray(columnForm.input_options) ? columnForm.input_options : []).map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateDropdownOption(idx, e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                        placeholder={`Option ${idx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeDropdownOption(idx)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        title="Remove option"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  ))}
                  {(!columnForm.input_options || columnForm.input_options.length === 0) && (
                    <div className="text-sm text-slate-500">No options added yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* Max Length (for VARCHAR) */}
            {(columnForm.data_type === 'VARCHAR' || columnForm.data_type === 'CHAR') && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Max Length
                </label>
                <input
                  type="number"
                  value={columnForm.max_length}
                  onChange={(e) => setColumnForm({ ...columnForm, max_length: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  placeholder="255"
                />
              </div>
            )}

            {/* Default Value */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Default Value
              </label>
              {columnForm.data_type === 'BOOLEAN' ? (
                <select
                  value={columnForm.default_value}
                  onChange={(e) => setColumnForm({ ...columnForm, default_value: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                >
                  <option value="">No Default</option>
                  <option value="TRUE">True</option>
                  <option value="FALSE">False</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={columnForm.default_value}
                  onChange={(e) => setColumnForm({ ...columnForm, default_value: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  placeholder="Optional default value"
                />
              )}
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="nullable"
                  checked={columnForm.nullable}
                  onChange={(e) => setColumnForm({ ...columnForm, nullable: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <label htmlFor="nullable" className="text-sm font-medium text-slate-700">
                  Allow NULL values
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="unique"
                  checked={columnForm.unique}
                  onChange={(e) => setColumnForm({ ...columnForm, unique: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <label htmlFor="unique" className="text-sm font-medium text-slate-700">
                  Unique constraint
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!columnForm.column_name || !columnForm.data_type}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-lg hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit ? 'Update Column' : 'Add Column'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl text-white shadow-lg">
                <Icons.Database />
              </div>
              Database Table Manager
            </h1>
            <p className="text-slate-600 mt-2">
              Manage your database tables and columns in real-time
            </p>
          </div>

          <button
            onClick={fetchTables}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 shadow-sm transition-all"
          >
            <Icons.Refresh />
            Refresh Tables
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <Icons.Check />
            <span className="font-medium">{success}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <Icons.AlertCircle />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Tables List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Icons.Table />
                  Tables ({filteredTables.length})
                </h2>

                {/* Search */}
                <div className="relative mt-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Icons.Search />
                  </div>
                  <input
                    type="text"
                    placeholder="Search tables..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">
                    <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    Loading tables...
                  </div>
                ) : filteredTables.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Icons.Table />
                    <p className="mt-2">No tables found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredTables.map((table) => (
                      <button
                        key={table.table_name}
                        onClick={() => setSelectedTable(table.table_name)}
                        className={`w-full px-5 py-3.5 text-left hover:bg-slate-50 transition-colors ${selectedTable === table.table_name
                            ? 'bg-teal-50 border-l-4 border-teal-500'
                            : ''
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 text-sm">
                              {table.table_name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {table.column_count} columns
                            </p>
                          </div>
                          {selectedTable === table.table_name && (
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columns List */}
          <div className="lg:col-span-2">
            {selectedTable ? (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-cyan-50 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Icons.Columns />
                      Columns in <code className="px-2 py-1 bg-white rounded text-teal-600 font-mono text-sm">{selectedTable}</code>
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">{columns.length} columns total</p>
                  </div>
                  <button
                    onClick={() => {
                      resetColumnForm();
                      setShowAddColumnModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-200 transition-all"
                  >
                    <Icons.Plus />
                    Add Column
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Column Name
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Data Type
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Nullable
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Default
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {columns.map((col, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <code className="text-sm font-semibold text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded">
                              {col.column_name}
                            </code>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {col.data_type}
                              {col.character_maximum_length && `(${col.character_maximum_length})`}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${col.is_nullable === 'YES'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                              {col.is_nullable === 'YES' ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-slate-600 font-mono">
                              {col.column_default || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(col)}
                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="Edit column"
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(col.column_name)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                title="Delete column"
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {columns.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Icons.Columns />
                      <p className="mt-3">No columns found in this table</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center">
                <div className="inline-flex p-4 bg-slate-100 rounded-full mb-4">
                  <Icons.Table />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Select a table
                </h3>
                <p className="text-slate-600">
                  Choose a table from the left to view and manage its columns
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Add Column Modal */}
        <ColumnModal
          show={showAddColumnModal}
          onClose={() => {
            setShowAddColumnModal(false);
            resetColumnForm();
          }}
          onSave={handleAddColumn}
          title="Add New Column"
        />

        {/* Edit Column Modal */}
        <ColumnModal
          show={showEditColumnModal}
          onClose={() => {
            setShowEditColumnModal(false);
            setEditingColumn(null);
            resetColumnForm();
          }}
          onSave={handleEditColumn}
          title="Edit Column"
          isEdit={true}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <Icons.AlertCircle />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Delete Column?
                </h3>
                <p className="text-slate-600 mb-6">
                  Are you sure you want to delete column <strong>{showDeleteConfirm}</strong>?
                  This action cannot be undone and all data in this column will be lost.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteColumn(showDeleteConfirm)}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
