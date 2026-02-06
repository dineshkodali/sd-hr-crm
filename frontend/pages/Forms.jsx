
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Database,
  Table as TableIcon,
  Plus,
  Trash2,
  Edit,
  Search,
  Save,
  X,
  Columns,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function Forms({ user }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);

  // Status state for notifications
  const [status, setStatus] = useState(null);

  // New Column State
  const [newColumn, setNewColumn] = useState({
    column_name: '',
    data_type: 'VARCHAR',
    max_length: '255',
    nullable: true,
    default_value: '',
    input_type: 'text',
    input_options: ['']
  });

  // Edit Column State
  const [editingColumn, setEditingColumn] = useState(null);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchColumns(selectedTable);
    } else {
      setColumns([]);
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/forms-builder/available-tables', { withCredentials: true });
      if (res.data?.tables) {
        setTables(res.data.tables);
      }
    } catch (err) {
      console.error("Error fetching tables:", err);
      showStatus('error', 'Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async (tableName) => {
    try {
      setColumnsLoading(true);
      const res = await axios.get(`/api/forms-builder/tables/${tableName}/columns`, { withCredentials: true });
      if (res.data?.columns) {
        setColumns(res.data.columns);
      }
    } catch (err) {
      console.error("Error fetching columns:", err);
      showStatus('error', 'Failed to fetch columns');
      setColumns([]);
    } finally {
      setColumnsLoading(false);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumn.column_name) {
      showStatus('error', 'Column name is required');
      return;
    }

    try {
      const sanitizedColumnName = newColumn.column_name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

      await axios.post(`/api/forms-builder/tables/${selectedTable}/columns`, {
        tableName: selectedTable,
        ...newColumn,
        column_name: sanitizedColumnName,
        input_options: newColumn.input_type === 'dropdown' ? newColumn.input_options.filter(opt => opt && opt.trim() !== '') : null
      }, { withCredentials: true });

      showStatus('success', 'Column added successfully');
      setShowAddColumn(false);
      setNewColumn({
        column_name: '',
        data_type: 'VARCHAR',
        max_length: '255',
        nullable: true,
        default_value: '',
        input_type: 'text',
        input_options: ['']
      });
      fetchColumns(selectedTable);
    } catch (err) {
      console.error("Error adding column:", err);
      showStatus('error', err.response?.data?.error || 'Failed to add column');
    }
  };

  const handleEdit = (col) => {
    setEditingColumn({
      original_name: col.column_name,
      column_name: col.column_name,
      data_type: col.data_type,
      max_length: col.character_maximum_length || '255',
      nullable: col.is_nullable === 'YES' || col.is_nullable === true,
      default_value: col.column_default || '',
      input_type: col.input_type || 'text',
      input_options: Array.isArray(col.input_options) ? col.input_options : ['']
    });
  };

  const handleUpdateColumn = async () => {
    if (!editingColumn.column_name) {
      showStatus('error', 'Column name is required');
      return;
    }

    try {
      const sanitizedColumnName = editingColumn.column_name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

      await axios.put(`/api/forms-builder/tables/${selectedTable}/columns/${editingColumn.original_name}`, {
        tableName: selectedTable,
        ...editingColumn,
        column_name: sanitizedColumnName,
        input_options: editingColumn.input_type === 'dropdown' ? editingColumn.input_options.filter(opt => opt && opt.trim() !== '') : null
      }, { withCredentials: true });

      showStatus('success', 'Column updated successfully');
      setEditingColumn(null);
      fetchColumns(selectedTable);
    } catch (err) {
      console.error("Error updating column:", err);
      showStatus('error', err.response?.data?.error || 'Failed to update column');
    }
  };

  const handleDeleteColumn = async (columnName) => {
    if (!window.confirm(`Are you sure you want to delete column "${columnName}"? This action cannot be undone.`)) return;

    try {
      await axios.delete(`/api/forms-builder/tables/${selectedTable}/columns/${columnName}`, { withCredentials: true });
      showStatus('success', 'Column deleted successfully');
      fetchColumns(selectedTable);
    } catch (err) {
      console.error("Error deleting column:", err);
      showStatus('error', err.response?.data?.error || 'Failed to delete column');
    }
  };

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const filteredTables = tables.filter(t =>
    t.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar: Table List */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-6 h-6 text-[#2de8c8]" />
            <h2 className="text-lg font-bold text-gray-800">Database Table Manager</h2>
          </div>
          <p className="text-xs text-gray-500">Manage your database tables and columns in real-time</p>
        </div>

        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/30 focus:border-[#2de8c8] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <TableIcon className="w-3 h-3" /> Tables ({tables.length})
            </h3>
            <button
              onClick={fetchTables}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh Tables"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg"></div>)}
            </div>
          ) : (
            filteredTables.map(table => (
              <button
                key={`${table.table_schema}-${table.table_name}`}
                onClick={() => setSelectedTable(table.table_name)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex flex-col gap-0.5 group ${selectedTable === table.table_name
                  ? 'bg-[#2de8c8]/10 text-[#1da890] border border-[#2de8c8]/30 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-100'
                  }`}
              >
                <span className="font-semibold truncate">{table.table_name}</span>
                <span className={`text-[10px] ${selectedTable === table.table_name ? 'text-[#2de8c8]' : 'text-gray-400 group-hover:text-gray-500'}`}>
                  {table.column_count} columns {table.table_schema !== 'public' ? `• ${table.table_schema}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Column Manager */}
      <div className="flex-1 bg-gray-50 h-full overflow-hidden flex flex-col relative">
        {/* Status Notification */}
        {status && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${status.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
            {status.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {status.message}
          </div>
        )}

        {selectedTable ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2de8c8]/10 rounded-lg flex items-center justify-center text-[#2de8c8]">
                      <TableIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-800">{selectedTable}</h1>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        Database Table • {columns.length} Columns
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddColumn(true)}
                  className="bg-[#2de8c8] hover:bg-[#25c2a7] text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Add Column
                </button>
              </div>
            </div>

            {/* Columns Table */}
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
              {columnsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white rounded shadow-sm border border-gray-100 animate-pulse"></div>)}
                </div>
              ) : columns.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                  <Columns className="w-12 h-12 mb-3 opacity-20" />
                  <p>No columns found in this table.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Column Name</th>
                        <th className="px-6 py-4">Data Type</th>
                        <th className="px-6 py-4">Nullable</th>
                        <th className="px-6 py-4">Default</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {columns.map((col) => (
                        <tr key={col.column_name} className="hover:bg-gray-50/80 transition-colors group">
                          <td className="px-6 py-4 text-sm font-bold text-gray-800">
                            {col.column_name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                              {col.data_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {col.is_nullable === 'YES' || col.is_nullable === true ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                YES
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                NO
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                            {col.column_default || <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(col)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteColumn(col.column_name)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 p-8">
            <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
              <Columns className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">Select a table</h2>
            <p className="text-gray-500 max-w-sm text-center">Choose a table from the sidebar to view and manage its structure and columns.</p>
          </div>
        )}

        {/* Add Column Modal - Full Screen Overlay to hide Navbars */}
        {showAddColumn && createPortal(
          <div className="fixed inset-0 z-[99999] bg-gray-600/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[70vh] animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Add New Column</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Add a new column to the table</p>
                </div>
                <button onClick={() => setShowAddColumn(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content - Fixed Height Area */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-5">
                  {/* Column Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Column Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newColumn.column_name}
                      onChange={(e) => setNewColumn({ ...newColumn, column_name: e.target.value })}
                      placeholder="e.g., employee_name"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 placeholder-gray-400 transition-all"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Use lowercase and underscores only</p>
                  </div>

                  {/* Data Type */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Data Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newColumn.data_type}
                      onChange={(e) => setNewColumn({ ...newColumn, data_type: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 bg-white transition-all"
                    >
                      <option value="VARCHAR">VARCHAR</option>
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="DATE">DATE</option>
                      <option value="TIMESTAMP">TIMESTAMP</option>
                      <option value="NUMERIC">NUMERIC</option>
                    </select>
                  </div>

                  {/* Input Type */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Input Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newColumn.input_type}
                      onChange={(e) => setNewColumn({ ...newColumn, input_type: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 bg-white transition-all hover:bg-blue-50/50"
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="textarea">textarea</option>
                      <option value="date">date</option>
                      <option value="checkbox">checkbox</option>
                      <option value="dropdown">dropdown</option>
                    </select>
                  </div>

                  {/* Options for Select/Dropdown */}
                  {(newColumn.input_type === 'select' || newColumn.input_type === 'dropdown') && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700">Dropdown Options</label>
                        <button
                          onClick={() => setNewColumn({ ...newColumn, input_options: [...newColumn.input_options, ''] })}
                          className="text-xs font-medium text-[#2de8c8] hover:text-[#25c2a7] bg-[#2de8c8]/10 hover:bg-[#2de8c8]/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {newColumn.input_options.map((option, index) => (
                          <div key={index} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...newColumn.input_options];
                                newOptions[index] = e.target.value;
                                setNewColumn({ ...newColumn, input_options: newOptions });
                              }}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 transition-all"
                            />
                            {newColumn.input_options.length > 1 && (
                              <button
                                onClick={() => {
                                  const newOptions = newColumn.input_options.filter((_, i) => i !== index);
                                  setNewColumn({ ...newColumn, input_options: newOptions });
                                }}
                                className="p-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Max Length - Conditional */}
                  {(newColumn.data_type === 'VARCHAR' || newColumn.data_type === 'CHAR') && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={newColumn.max_length}
                        onChange={(e) => setNewColumn({ ...newColumn, max_length: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 transition-all"
                      />
                    </div>
                  )}

                  {/* Default Value */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Default Value
                    </label>
                    <input
                      type="text"
                      value={newColumn.default_value}
                      onChange={(e) => setNewColumn({ ...newColumn, default_value: e.target.value })}
                      placeholder="Optional default value"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 placeholder-gray-400 transition-all"
                    />
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${!newColumn.nullable ? 'bg-[#2de8c8] border-[#2de8c8]' : 'bg-white border-gray-300 group-hover:border-[#2de8c8]'}`}>
                        {!newColumn.nullable && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={!newColumn.nullable}
                        onChange={(e) => setNewColumn({ ...newColumn, nullable: !e.target.checked })}
                      />
                      <span className="text-sm text-gray-700 font-medium">Required (Not Null)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newColumn.unique ? 'bg-[#2de8c8] border-[#2de8c8]' : 'bg-white border-gray-300 group-hover:border-[#2de8c8]'}`}>
                        {newColumn.unique && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={newColumn.unique || false}
                        onChange={(e) => setNewColumn({ ...newColumn, unique: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700 font-medium">Unique constraint</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-xl flex-shrink-0">
                <button
                  onClick={() => setShowAddColumn(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddColumn}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#2de8c8] hover:bg-[#25c2a7] rounded-lg shadow-lg shadow-[#2de8c8]/30 transition-all active:scale-95"
                >
                  Add Column
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Column Modal */}
        {editingColumn && createPortal(
          <div className="fixed inset-0 z-[99999] bg-gray-600/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[70vh] animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Edit Column: {editingColumn.original_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Modify column properties</p>
                </div>
                <button onClick={() => setEditingColumn(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-5">
                  {/* Column Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Column Name
                    </label>
                    <input
                      type="text"
                      value={editingColumn.column_name}
                      onChange={(e) => setEditingColumn({ ...editingColumn, column_name: e.target.value })}
                      placeholder="e.g., employee_name"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 placeholder-gray-400 transition-all"
                    />
                  </div>

                  {/* Data Type (Disabled for Edit usually to avoid data loss, but allowed here if backend supports it) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Data Type
                    </label>
                    <select
                      value={editingColumn.data_type}
                      onChange={(e) => setEditingColumn({ ...editingColumn, data_type: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 bg-white transition-all"
                    >
                      <option value="VARCHAR">VARCHAR</option>
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="DATE">DATE</option>
                      <option value="TIMESTAMP">TIMESTAMP</option>
                      <option value="NUMERIC">NUMERIC</option>
                    </select>
                    <p className="text-[10px] text-amber-500 mt-1">Warning: Changing data type may result in data loss or casting errors.</p>
                  </div>

                  {/* Input Type */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Input Type
                    </label>
                    <select
                      value={editingColumn.input_type || 'text'}
                      onChange={(e) => setEditingColumn({ ...editingColumn, input_type: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 bg-white transition-all hover:bg-blue-50/50"
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="textarea">textarea</option>
                      <option value="date">date</option>
                      <option value="checkbox">checkbox</option>
                      <option value="dropdown">dropdown</option>
                    </select>
                  </div>

                  {/* Options for Select/Dropdown */}
                  {(editingColumn.input_type === 'select' || editingColumn.input_type === 'dropdown') && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700">Dropdown Options</label>
                        <button
                          onClick={() => setEditingColumn({ ...editingColumn, input_options: [...(editingColumn.input_options || []), ''] })}
                          className="text-xs font-medium text-[#2de8c8] hover:text-[#25c2a7] bg-[#2de8c8]/10 hover:bg-[#2de8c8]/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {(editingColumn.input_options || []).map((option, index) => (
                          <div key={index} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...editingColumn.input_options];
                                newOptions[index] = e.target.value;
                                setEditingColumn({ ...editingColumn, input_options: newOptions });
                              }}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 transition-all"
                            />
                            <button
                              onClick={() => {
                                const newOptions = editingColumn.input_options.filter((_, i) => i !== index);
                                setEditingColumn({ ...editingColumn, input_options: newOptions });
                              }}
                              className="p-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Max Length */}
                  {(editingColumn.data_type === 'VARCHAR' || editingColumn.data_type === 'CHAR') && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={editingColumn.max_length}
                        onChange={(e) => setEditingColumn({ ...editingColumn, max_length: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-gray-700 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-xl flex-shrink-0">
                <button
                  onClick={() => setEditingColumn(null)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateColumn}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                >
                  Update Column
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
