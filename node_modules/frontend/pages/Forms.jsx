
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteColumnName, setDeleteColumnName] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
            try {
                localStorage.setItem('formsBuilderColumnsUpdated', JSON.stringify({ table: selectedTable, ts: Date.now() }));
            } catch (e) {
                // ignore
            }
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
            input_options: Array.isArray(col.input_options) ? col.input_options : [''],
            unique: col.is_unique === true || col.unique === true
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
            try {
                localStorage.setItem('formsBuilderColumnsUpdated', JSON.stringify({ table: selectedTable, ts: Date.now() }));
            } catch (e) {
                // ignore
            }
            fetchColumns(selectedTable);
        } catch (err) {
            console.error("Error updating column:", err);
            showStatus('error', err.response?.data?.error || 'Failed to update column');
        }
    };

    const signalColumnsUpdated = () => {
        try {
            localStorage.setItem('formsBuilderColumnsUpdated', JSON.stringify({ table: selectedTable, ts: Date.now() }));
        } catch (e) {
            // ignore
        }
    };

    const handleDeleteColumn = (columnName) => {
        setDeleteColumnName(columnName);
        setShowDeleteModal(true);
    };

    const confirmDeleteColumn = async () => {
        if (!selectedTable || !deleteColumnName) return;
        try {
            setDeleting(true);
            await axios.delete(`/api/forms-builder/tables/${selectedTable}/columns/${deleteColumnName}`, { withCredentials: true });
            showStatus('success', 'Column deleted successfully');
            setShowDeleteModal(false);
            setDeleteColumnName(null);
            signalColumnsUpdated();
            fetchColumns(selectedTable);
        } catch (err) {
            console.error("Error deleting column:", err);
            showStatus('error', err.response?.data?.error || 'Failed to delete column');
            setShowDeleteModal(false);
            setDeleteColumnName(null);
        } finally {
            setDeleting(false);
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
        <div className="flex h-[calc(100vh-64px)] bg-[var(--bg-primary)] overflow-hidden font-sans text-[var(--text-primary)]">
            {/* Sidebar: Table List */}
            <div className="w-96 bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col h-full shadow-sm z-10">
                <div className="p-5 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2 mb-1">
                        <Database className="w-6 h-6 text-[var(--accent-primary)]" />
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Database Table Manager</h2>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">Manage your database tables and columns in real-time</p>
                </div>

                <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/50">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full !pl-14 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)] transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                            <TableIcon className="w-3 h-3" /> Tables ({tables.length})
                        </h3>
                        <button
                            onClick={fetchTables}
                            className="p-1 hover:bg-[var(--bg-primary)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            title="Refresh Tables"
                        >
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="space-y-2 animate-pulse">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-[var(--bg-primary)] rounded-xl"></div>)}
                        </div>
                    ) : (
                        filteredTables.map(table => (
                            <button
                                key={`${table.table_schema}-${table.table_name}`}
                                onClick={() => setSelectedTable(table.table_name)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex flex-col gap-0.5 group ${selectedTable === table.table_name
                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 shadow-sm'
                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)] border border-transparent hover:border-[var(--border-color)]'
                                    }`}
                            >
                                <span className="font-semibold truncate">{table.table_name}</span>
                                <span className={`text-[10px] ${selectedTable === table.table_name ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                    {table.column_count} columns {table.table_schema !== 'public' ? `• ${table.table_schema}` : ''}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content: Column Manager */}
            <div className="flex-1 bg-[var(--bg-primary)] h-full overflow-hidden flex flex-col relative">
                {/* Status Notification */}
                {status && (
                    <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${status.type === 'error' ? 'bg-red-100/10 text-red-500 border border-red-500/20' : 'bg-green-100/10 text-green-500 border border-green-500/20'
                        }`}>
                        {status.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        {status.message}
                    </div>
                )}

                {selectedTable ? (
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-8 py-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[var(--accent-primary)]/10 rounded-xl flex items-center justify-center text-[var(--accent-primary)]">
                                            <TableIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold text-[var(--text-primary)]">{selectedTable}</h1>
                                            <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-2">
                                                Database Table • {columns.length} Columns
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddColumn(true)}
                                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4" /> Add Column
                                </button>
                            </div>
                        </div>

                        {/* Columns Table */}
                        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                            {columnsLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] animate-pulse"></div>)}
                                </div>
                            ) : columns.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-xl border border-dashed border-[var(--border-color)]">
                                    <Columns className="w-12 h-12 mb-3 opacity-20" />
                                    <p>No columns found in this table.</p>
                                </div>
                            ) : (
                                <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                                <th className="px-6 py-4">Column Name</th>
                                                <th className="px-6 py-4">Data Type</th>
                                                <th className="px-6 py-4">Nullable</th>
                                                <th className="px-6 py-4">Default</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-color)]">
                                            {columns.map((col) => (
                                                <tr key={col.column_name} className="hover:bg-[var(--bg-primary)]/50 transition-colors group">
                                                    <td className="px-6 py-4 text-sm font-bold text-[var(--text-primary)]">
                                                        {col.column_name}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono">
                                                            {col.data_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {col.is_nullable === 'YES' || col.is_nullable === true ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                                YES
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                                NO
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)] font-mono">
                                                        {col.column_default || <span className="opacity-50">-</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(col)}
                                                                className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteColumn(col.column_name)}
                                                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
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
                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-primary)] p-8">
                        <div className="w-24 h-24 bg-[var(--bg-surface)] rounded-full shadow-sm flex items-center justify-center mb-6">
                            <Columns className="w-10 h-10 opacity-50" />
                        </div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Select a table</h2>
                        <p className="max-w-sm text-center">Choose a table from the sidebar to view and manage its structure and columns.</p>
                    </div>
                )}

                {/* Add Column Modal - Full Screen Overlay to hide Navbars */}
                {showAddColumn && createPortal(
                    <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[70vh] animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Add New Column</h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Add a new column to the table</p>
                                </div>
                                <button onClick={() => setShowAddColumn(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-primary)] transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content - Fixed Height Area */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="space-y-5">
                                    {/* Column Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Column Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newColumn.column_name}
                                            onChange={(e) => setNewColumn({ ...newColumn, column_name: e.target.value })}
                                            placeholder="e.g., employee_name"
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 transition-all"
                                        />
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">Use lowercase and underscores only</p>
                                    </div>

                                    {/* Data Type */}
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Data Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={newColumn.data_type}
                                            onChange={(e) => setNewColumn({ ...newColumn, data_type: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all"
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
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Input Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={newColumn.input_type}
                                            onChange={(e) => setNewColumn({ ...newColumn, input_type: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all hover:bg-[var(--bg-surface)]"
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
                                                <label className="text-xs font-bold text-[var(--text-secondary)]">Dropdown Options</label>
                                                <button
                                                    onClick={() => setNewColumn({ ...newColumn, input_options: [...newColumn.input_options, ''] })}
                                                    className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-hover)] bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 px-3 py-1.5 rounded-xl transition-colors"
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
                                                            className="flex-1 px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all"
                                                        />
                                                        {newColumn.input_options.length > 1 && (
                                                            <button
                                                                onClick={() => {
                                                                    const newOptions = newColumn.input_options.filter((_, i) => i !== index);
                                                                    setNewColumn({ ...newColumn, input_options: newOptions });
                                                                }}
                                                                className="p-2.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
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
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                                Max Length
                                            </label>
                                            <input
                                                type="number"
                                                value={newColumn.max_length}
                                                onChange={(e) => setNewColumn({ ...newColumn, max_length: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all"
                                            />
                                        </div>
                                    )}

                                    {/* Default Value */}
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Default Value
                                        </label>
                                        <input
                                            type="text"
                                            value={newColumn.default_value}
                                            onChange={(e) => setNewColumn({ ...newColumn, default_value: e.target.value })}
                                            placeholder="Optional default value"
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 transition-all"
                                        />
                                    </div>

                                    {/* Checkboxes */}
                                    <div className="space-y-3 pt-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-xl border flex items-center justify-center transition-colors ${!newColumn.nullable ? 'bg-[#2de8c8] border-[#2de8c8]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] group-hover:border-[#2de8c8]'}`}>
                                                {!newColumn.nullable && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="rounded-xl hidden"
                                                checked={!newColumn.nullable}
                                                onChange={(e) => setNewColumn({ ...newColumn, nullable: !e.target.checked })}
                                            />
                                            <span className="text-sm text-[var(--text-primary)] font-medium">Required (Not Null)</span>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-xl border flex items-center justify-center transition-colors ${newColumn.unique ? 'bg-[#2de8c8] border-[#2de8c8]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] group-hover:border-[#2de8c8]'}`}>
                                                {newColumn.unique && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="rounded-xl hidden"
                                                checked={newColumn.unique || false}
                                                onChange={(e) => setNewColumn({ ...newColumn, unique: e.target.checked })}
                                            />
                                            <span className="text-sm text-[var(--text-primary)] font-medium">Unique constraint</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-surface)] rounded-b-xl flex-shrink-0">
                                <button
                                    onClick={() => setShowAddColumn(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-xl transition-colors border border-[var(--border-color)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddColumn}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-xl shadow-lg shadow-[var(--accent-primary)]/30 transition-all active:scale-95"
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
                    <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[70vh] animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Edit Column</h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Modify column properties</p>
                                </div>
                                <button onClick={() => setEditingColumn(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-primary)] transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="space-y-5">
                                    {/* Column Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Column Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editingColumn.column_name}
                                            onChange={(e) => setEditingColumn({ ...editingColumn, column_name: e.target.value })}
                                            placeholder="e.g., employee_name"
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 transition-all"
                                        />
                                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">Use lowercase and underscores only</p>
                                    </div>

                                    {/* Data Type (Disabled for Edit usually to avoid data loss, but allowed here if backend supports it) */}
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Data Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editingColumn.data_type}
                                            onChange={(e) => setEditingColumn({ ...editingColumn, data_type: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all"
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
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Input Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editingColumn.input_type || 'text'}
                                            onChange={(e) => setEditingColumn({ ...editingColumn, input_type: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all hover:bg-[var(--bg-surface)]"
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
                                                <label className="text-xs font-bold text-[var(--text-secondary)]">Dropdown Options</label>
                                                <button
                                                    onClick={() => setEditingColumn({ ...editingColumn, input_options: [...(editingColumn.input_options || []), ''] })}
                                                    className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-hover)] bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 px-3 py-1.5 rounded-xl transition-colors"
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
                                                            className="flex-1 px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all"
                                                        />
                                                        {(editingColumn.input_options || []).length > 1 && (
                                                            <button
                                                                onClick={() => {
                                                                    const newOptions = editingColumn.input_options.filter((_, i) => i !== index);
                                                                    setEditingColumn({ ...editingColumn, input_options: newOptions });
                                                                }}
                                                                className="p-2.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Max Length */}
                                    {(editingColumn.data_type === 'VARCHAR' || editingColumn.data_type === 'CHAR') && (
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                                Max Length
                                            </label>
                                            <input
                                                type="number"
                                                value={editingColumn.max_length}
                                                onChange={(e) => setEditingColumn({ ...editingColumn, max_length: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] transition-all"
                                            />
                                        </div>
                                    )}

                                    {/* Default Value */}
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                                            Default Value
                                        </label>
                                        <input
                                            type="text"
                                            value={editingColumn.default_value}
                                            onChange={(e) => setEditingColumn({ ...editingColumn, default_value: e.target.value })}
                                            placeholder="Optional default value"
                                            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2de8c8]/20 focus:border-[#2de8c8] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 transition-all"
                                        />
                                    </div>

                                    {/* Checkboxes */}
                                    <div className="space-y-3 pt-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-xl border flex items-center justify-center transition-colors ${!editingColumn.nullable ? 'bg-[#2de8c8] border-[#2de8c8]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] group-hover:border-[#2de8c8]'}`}>
                                                {!editingColumn.nullable && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="rounded-xl hidden"
                                                checked={!editingColumn.nullable}
                                                onChange={(e) => setEditingColumn({ ...editingColumn, nullable: !e.target.checked })}
                                            />
                                            <span className="text-sm text-[var(--text-primary)] font-medium">Required (Not Null)</span>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-xl border flex items-center justify-center transition-colors ${editingColumn.unique ? 'bg-[#2de8c8] border-[#2de8c8]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] group-hover:border-[#2de8c8]'}`}>
                                                {editingColumn.unique && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="rounded-xl hidden"
                                                checked={editingColumn.unique || false}
                                                onChange={(e) => setEditingColumn({ ...editingColumn, unique: e.target.checked })}
                                            />
                                            <span className="text-sm text-[var(--text-primary)] font-medium">Unique constraint</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-surface)] rounded-b-xl flex-shrink-0">
                                <button
                                    onClick={() => setEditingColumn(null)}
                                    className="px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-xl transition-colors border border-[var(--border-color)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateColumn}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-xl shadow-lg shadow-[var(--accent-primary)]/30 transition-all active:scale-95"
                                >
                                    Update Column
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {showDeleteModal && createPortal(
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
                                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Delete Record</h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (deleting) return;
                                        setShowDeleteModal(false);
                                        setDeleteColumnName(null);
                                    }}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 hover:bg-[var(--bg-primary)] rounded-xl"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="bg-rose-500/10 p-3 rounded-full flex-shrink-0">
                                        <AlertCircle className="w-12 h-12 text-rose-500" />
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <p className="text-[var(--text-primary)] text-base leading-relaxed">Delete this record?</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-5 bg-[var(--bg-primary)]/50 border-t border-[var(--border-color)]">
                                <button
                                    type="button"
                                    disabled={deleting}
                                    onClick={() => {
                                        if (deleting) return;
                                        setShowDeleteModal(false);
                                        setDeleteColumnName(null);
                                    }}
                                    className="px-5 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={deleting}
                                    onClick={confirmDeleteColumn}
                                    className="px-5 py-2.5 rounded-xl font-medium shadow-sm hover:shadow bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-60 border border-transparent"
                                >
                                    {deleting ? 'Deleting...' : 'Confirm'}
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
