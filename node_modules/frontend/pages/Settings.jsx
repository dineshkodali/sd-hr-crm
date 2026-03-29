/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { ConfirmDialog, AlertDialog } from '../components/ConfirmDialog';
import {
    Home,
    Users,
    Shield,
    UserPlus,
    Edit,
    Trash2,
    X,
    Save,
    Plus,
    Search,
    ChevronDown,
    Eye,
    Lock,
    Unlock,
    Check,
    AlertCircle,
    Settings as SettingsIcon,
    Grid,
    Layout,
    Activity,
    ShieldAlert,
    AlertTriangle,
    EyeOff
} from "lucide-react";
import Reports from "./Reports";

// All available modules in the system
const ALL_MODULES = [
    { key: "dashboard", label: "Dashboard", category: "Core" },
    { key: "su_data", label: "SU Data", category: "Core" },
    { key: "move_in_out", label: "Move-In/Out", category: "Core" },
    { key: "meals", label: "Meals", category: "Core" },
    { key: "properties", label: "Properties", category: "Core" },
    { key: "employees", label: "Employees", category: "Core" },
    { key: "inspections", label: "Inspections", category: "Operations" },
    { key: "incidents", label: "Incidents", category: "Operations" },
    { key: "complaints", label: "Complaints", category: "Operations" },
    { key: "compliance", label: "Compliance", category: "Operations" },
    { key: "maintenance", label: "Maintenance", category: "Operations" },
    { key: "aire_tasks", label: "AIRE Tasks", category: "Operations" },
    { key: "litigation", label: "Litigation", category: "Operations" },
    { key: "hse_incidents", label: "HSE Incidents", category: "HSE" },
    { key: "hse_risk_management", label: "HSE Risk Management", category: "HSE" },
    { key: "hse_training", label: "HSE Training", category: "HSE" },
    { key: "hse_audits", label: "HSE Audits", category: "HSE" },
    { key: "safeguarding_referrals", label: "Safeguarding Referrals", category: "Safeguarding" },
    { key: "safeguarding_risk_assessments", label: "Risk Assessments", category: "Safeguarding" },
    { key: "vulnerable_users", label: "Vulnerable Users", category: "Safeguarding" },
    { key: "multi_agency", label: "Multi-Agency", category: "Safeguarding" },
    { key: "vcs_organisations", label: "VCS Organisations", category: "Safeguarding" },
    { key: "case_management", label: "Case Management", category: "Safeguarding" },
    { key: "emergency_protocols", label: "Emergency Protocols", category: "Escalations" },
    { key: "forms", label: "Forms", category: "Core" },
    { key: "reports", label: "Reports", category: "Core" },
];

const PERMISSION_LEVELS = [
    { key: "none", label: "No Access", color: "gray", permissions: {} },
    { key: "view", label: "View Only", color: "blue", permissions: { read: true } },
    { key: "create", label: "Create", color: "green", permissions: { read: true, create: true } },
    { key: "edit", label: "Edit", color: "yellow", permissions: { read: true, update: true } },
    { key: "full", label: "Full Access", color: "teal", permissions: { read: true, create: true, update: true, delete: true } },
    { key: "custom", label: "Custom", color: "purple", permissions: {} },
];

export default function Settings() {
    const [activeTab, setActiveTab] = useState("access-control");
    const [activeSubTab, setActiveSubTab] = useState("users");

    // Access Control States
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    const [localPermissions, setLocalPermissions] = useState({});
    const [groupPermissions, setGroupPermissions] = useState({});
    const [rolePermissions, setRolePermissions] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [accessDenied, setAccessDenied] = useState(false);

    // Modals
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
    const [assignRoleSearch, setAssignRoleSearch] = useState("");
    const [assignRoleFilter, setAssignRoleFilter] = useState("all");
    const [assignRoleSelectedUserIds, setAssignRoleSelectedUserIds] = useState(() => new Set());
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertMessage, setAlertMessage] = useState({ title: "", message: "", type: "info" });
    const [confirmAction, setConfirmAction] = useState(null);
    const [groupForm, setGroupForm] = useState({ name: "", description: "" });
    const [roleForm, setRoleForm] = useState({ name: "", description: "", level: "view" });
    const [editingGroup, setEditingGroup] = useState(null);
    const [editingRole, setEditingRole] = useState(null);

    const [sidebarSettings, setSidebarSettings] = useState(() => {
        const defaults = {
            dashboard: { admin: true, manager: true, staff: true },
            su_data: { admin: true, manager: true, staff: true },
            property: { admin: true, manager: true, staff: true },
            forms: { admin: true, manager: true, staff: true },
            access: { admin: true, manager: localStorage.getItem('showAccessMenu') === 'true', staff: false },
            operations: { admin: true, manager: true, staff: true },
            hse: { admin: true, manager: true, staff: true },
            safeguarding: { admin: true, manager: true, staff: true },
            escalations: { admin: true, manager: true, staff: true }
        };
        const saved = localStorage.getItem('sidebarSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...defaults, ...parsed };
            } catch (e) {
                console.error("Error parsing sidebarSettings", e);
            }
        }
        return defaults;
    });

    const handleToggleSidebarSetting = (category, role) => {
        const currentCategorySettings = sidebarSettings[category] || { admin: true, manager: true, staff: true };
        const newSettings = {
            ...sidebarSettings,
            [category]: {
                ...currentCategorySettings,
                [role]: !currentCategorySettings[role]
            }
        };
        setSidebarSettings(newSettings);
        localStorage.setItem('sidebarSettings', JSON.stringify(newSettings));
        // Also update legacy key
        if (category === 'access' && role === 'admin') {
            localStorage.setItem('showAccessMenu', newSettings.access.admin);
        }
        window.dispatchEvent(new Event('accessMenuChanged'));
        setSuccessMessage(`Sidebar visibility for ${category} updated`);
        setTimeout(() => setSuccessMessage(""), 3000);
    };

    const handleAssignRoleToUsersBulk = async () => {
        if (!selectedRole) return;
        const ids = Array.from(assignRoleSelectedUserIds || []);
        if (ids.length === 0) return;

        setSaving(true);
        try {
            await Promise.all(
                ids.map((userId) =>
                    axios.post(
                        `/api/access/roles/${selectedRole.id}/users`,
                        { user_id: userId },
                        { withCredentials: true }
                    )
                )
            );
            await loadRoleDetails(selectedRole.id);
            setShowAssignRoleModal(false);
            setAssignRoleSearch("");
            setAssignRoleFilter("all");
            setAssignRoleSelectedUserIds(new Set());
            setSuccessMessage("Role assigned to users successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error assigning role to users:", err);
            showAlert("Error", "Failed to assign role to selected users. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    /* Dialog State */
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    const [alertDialog, setAlertDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        if (activeTab === "access-control") {
            loadAccessData();
            if (activeSubTab === "groups") {
                loadGroups();
            } else if (activeSubTab === "roles") {
                loadRoles();
            }
        }
    }, [activeTab, activeSubTab]);

    const loadAccessData = async () => {
        setLoading(true);
        setAccessDenied(false);
        try {
            const res = await axios.get("/api/access", { withCredentials: true });
            if (res?.data) {
                setUsers(res.data.users || []);
                const perms = res.data.permissions || {};
                setPermissions(perms);
                setLocalPermissions(JSON.parse(JSON.stringify(perms)));
            }
        } catch (err) {
            if (err.response && err.response.status === 403) {
                setAccessDenied(true);
            } else {
                console.error("Error loading access data:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadGroups = async () => {
        setLoading(true);
        try {
            const res = await axios.get("/api/access/groups", { withCredentials: true });
            if (res?.data) {
                setGroups(res.data.groups || []);
            }
        } catch (err) {
            if (err.response && err.response.status !== 403) {
                console.error("Error loading groups:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        setLoading(true);
        try {
            const res = await axios.get("/api/access/roles", { withCredentials: true });
            if (res?.data) {
                setRoles(res.data.roles || []);
            }
        } catch (err) {
            if (err.response && err.response.status !== 403) {
                console.error("Error loading roles:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadGroupDetails = async (groupId) => {
        try {
            const res = await axios.get(`/api/access/groups/${groupId}`, { withCredentials: true });
            if (res?.data) {
                setSelectedGroup({
                    ...res.data.group,
                    members: res.data.members || []
                });
                setGroupPermissions(res.data.permissions || {});
            }
        } catch (err) {
            console.error("Error loading group details:", err);
        }
    };

    const loadRoleDetails = async (roleId) => {
        try {
            const res = await axios.get(`/api/access/roles/${roleId}`, { withCredentials: true });
            if (res?.data) {
                setSelectedRole({
                    ...res.data.role,
                    users: res.data.users || []
                });
                setRolePermissions(res.data.permissions || {});
            }
        } catch (err) {
            console.error("Error loading role details:", err);
        }
    };

    const handlePermissionChange = (userId, module, permissionType, value) => {
        const userPerms = localPermissions[userId] || {};
        const modulePerms = userPerms[module] || { read: false, create: false, update: false, delete: false };
        const newPerms = { ...modulePerms, [permissionType]: !!value };

        setLocalPermissions({
            ...localPermissions,
            [userId]: {
                ...userPerms,
                [module]: newPerms,
            },
        });
    };

    const handleBulkPermissionChange = (userId, module, level) => {
        const levelConfig = PERMISSION_LEVELS.find(l => l.key === level);
        if (!levelConfig) return;

        const userPerms = localPermissions[userId] || {};
        setLocalPermissions({
            ...localPermissions,
            [userId]: {
                ...userPerms,
                [module]: { ...levelConfig.permissions },
            },
        });
    };

    // Helper functions for modals
    const showAlert = (title, message, type = "info") => {
        setAlertDialog({
            isOpen: true,
            title,
            message,
            type
        });
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            type: 'warning',
            onConfirm
        });
    };

    const getPermissionLevel = (modulePerms) => {
        if (!modulePerms || !modulePerms.read) return "none";
        if (modulePerms.read && modulePerms.create && modulePerms.update && modulePerms.delete) return "full";
        if (modulePerms.read && !modulePerms.create && !modulePerms.update && !modulePerms.delete) return "view";
        if (modulePerms.read && modulePerms.create && !modulePerms.update && !modulePerms.delete) return "create";
        if (modulePerms.read && !modulePerms.create && modulePerms.update && !modulePerms.delete) return "edit";
        return "custom";
    };

    const handleSavePermissions = async () => {
        if (!selectedUser) return;

        setSaving(true);
        setSuccessMessage("");
        try {
            const userPerms = localPermissions[selectedUser.id] || {};
            const modules = Object.keys(userPerms).filter((module) => {
                const perms = userPerms[module] || {};
                return perms.read || perms.create || perms.update || perms.delete;
            });

            if (modules.length === 0) {
                showAlert("No Permissions", "No permissions to save for this user.", "warning");
                setSaving(false);
                return;
            }

            const promises = modules.map((module) => {
                const modulePerms = userPerms[module] || { read: false, create: false, update: false, delete: false };
                return axios.post(
                    "/api/access",
                    {
                        user_id: selectedUser.id,
                        module: module,
                        can_read: !!modulePerms.read,
                        can_create: !!modulePerms.create,
                        can_update: !!modulePerms.update,
                        can_delete: !!modulePerms.delete,
                    },
                    { withCredentials: true }
                );
            });

            await Promise.all(promises);
            setPermissions(JSON.parse(JSON.stringify(localPermissions)));
            setSuccessMessage("Permissions saved successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error saving permissions:", err);
            showAlert("Error", "Failed to save permissions. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupForm.name.trim()) {
            showAlert("Required Field", "Group name is required", "warning");
            return;
        }

        setSaving(true);
        try {
            await axios.post("/api/access/groups", groupForm, { withCredentials: true });
            setShowGroupModal(false);
            setGroupForm({ name: "", description: "" });
            loadGroups();
            setSuccessMessage("Group created successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error creating group:", err);
            showAlert("Error", "Failed to create group. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateGroup = async () => {
        if (!editingGroup || !groupForm.name.trim()) return;

        setSaving(true);
        try {
            await axios.put(`/api/access/groups/${editingGroup.id}`, groupForm, { withCredentials: true });
            setShowGroupModal(false);
            setEditingGroup(null);
            setGroupForm({ name: "", description: "" });
            loadGroups();
            setSuccessMessage("Group updated successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error updating group:", err);
            showAlert("Error", "Failed to update group. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        showConfirm(
            "Delete Group",
            "Are you sure you want to delete this group? This action cannot be undone.",
            async () => {
                await deleteGroupConfirmed(groupId);
            }
        );
    };

    const deleteGroupConfirmed = async (groupId) => {

        setSaving(true);
        try {
            await axios.delete(`/api/access/groups/${groupId}`, { withCredentials: true });
            loadGroups();
            if (selectedGroup?.id === groupId) {
                setSelectedGroup(null);
            }
            setSuccessMessage("Group deleted successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error deleting group:", err);
            showAlert("Error", "Failed to delete group. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleAddUserToGroup = async (userId) => {
        if (!selectedGroup) return;

        setSaving(true);
        try {
            await axios.post(`/api/access/groups/${selectedGroup.id}/members`, { user_id: userId }, { withCredentials: true });
            loadGroupDetails(selectedGroup.id);
            setShowAddMemberModal(false);
            setSuccessMessage("User added to group successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error adding user to group:", err);
            showAlert("Error", "Failed to add user to group. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveUserFromGroup = async (userId) => {
        if (!selectedGroup) return;
        showConfirm(
            "Remove User",
            "Are you sure you want to remove this user from the group?",
            async () => {
                await removeUserFromGroupConfirmed(userId);
            }
        );
    };

    const removeUserFromGroupConfirmed = async (userId) => {

        setSaving(true);
        try {
            await axios.delete(`/api/access/groups/${selectedGroup.id}/members/${userId}`, { withCredentials: true });
            loadGroupDetails(selectedGroup.id);
            setSuccessMessage("User removed from group successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error removing user from group:", err);
            showAlert("Error", "Failed to remove user from group. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGroupPermissions = async () => {
        if (!selectedGroup) return;

        setSaving(true);
        setSuccessMessage("");
        try {
            const modules = Object.keys(groupPermissions).filter((module) => {
                const perms = groupPermissions[module] || {};
                return perms.read || perms.create || perms.update || perms.delete;
            });

            const promises = modules.map((module) => {
                const modulePerms = groupPermissions[module] || { read: false, create: false, update: false, delete: false };
                return axios.post(
                    `/api/access/groups/${selectedGroup.id}/permissions`,
                    {
                        module: module,
                        can_read: !!modulePerms.read,
                        can_create: !!modulePerms.create,
                        can_update: !!modulePerms.update,
                        can_delete: !!modulePerms.delete,
                    },
                    { withCredentials: true }
                );
            });

            await Promise.all(promises);
            setSuccessMessage("Group permissions saved successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error saving group permissions:", err);
            showAlert("Error", "Failed to save group permissions. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRole = async () => {
        if (!roleForm.name.trim() || !roleForm.level) {
            showAlert("Required Fields", "Role name and level are required", "warning");
            return;
        }

        setSaving(true);
        try {
            await axios.post("/api/access/roles", roleForm, { withCredentials: true });
            setShowRoleModal(false);
            setRoleForm({ name: "", description: "", level: "view" });
            loadRoles();
            setSuccessMessage("Role created successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error creating role:", err);
            showAlert("Error", "Failed to create role. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!editingRole || !roleForm.name.trim()) return;

        setSaving(true);
        try {
            await axios.put(`/api/access/roles/${editingRole.id}`, roleForm, { withCredentials: true });
            setShowRoleModal(false);
            setEditingRole(null);
            setRoleForm({ name: "", description: "", level: "view" });
            loadRoles();
            setSuccessMessage("Role updated successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error updating role:", err);
            showAlert("Error", "Failed to update role. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (roleId) => {
        showConfirm(
            "Delete Role",
            "Are you sure you want to delete this role? This action cannot be undone.",
            async () => {
                await deleteRoleConfirmed(roleId);
            }
        );
    };

    const deleteRoleConfirmed = async (roleId) => {

        setSaving(true);
        try {
            await axios.delete(`/api/access/roles/${roleId}`, { withCredentials: true });
            loadRoles();
            if (selectedRole?.id === roleId) {
                setSelectedRole(null);
            }
            setSuccessMessage("Role deleted successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error deleting role:", err);
            showAlert("Error", "Failed to delete role. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleAssignRoleToUser = async (userId) => {
        if (!selectedRole) return;

        setSaving(true);
        try {
            await axios.post(`/api/access/roles/${selectedRole.id}/users`, { user_id: userId }, { withCredentials: true });
            loadRoleDetails(selectedRole.id);
            setShowAssignRoleModal(false);
            setSuccessMessage("Role assigned to user successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error assigning role to user:", err);
            showAlert("Error", "Failed to assign role to user. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveRoleFromUser = async (userId) => {
        if (!selectedRole) return;
        showConfirm(
            "Remove Role",
            "Are you sure you want to remove this role from the user?",
            async () => {
                await removeRoleFromUserConfirmed(userId);
            }
        );
    };

    const removeRoleFromUserConfirmed = async (userId) => {

        setSaving(true);
        try {
            await axios.delete(`/api/access/roles/${selectedRole.id}/users/${userId}`, { withCredentials: true });
            loadRoleDetails(selectedRole.id);
            setSuccessMessage("Role removed from user successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error removing role from user:", err);
            showAlert("Error", "Failed to remove role from user. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRolePermissions = async () => {
        if (!selectedRole) return;

        setSaving(true);
        setSuccessMessage("");
        try {
            const modules = Object.keys(rolePermissions).filter((module) => {
                const perms = rolePermissions[module] || {};
                return perms.read || perms.create || perms.update || perms.delete;
            });

            const promises = modules.map((module) => {
                const modulePerms = rolePermissions[module] || { read: false, create: false, update: false, delete: false };
                return axios.post(
                    `/api/access/roles/${selectedRole.id}/permissions`,
                    {
                        module: module,
                        can_read: !!modulePerms.read,
                        can_create: !!modulePerms.create,
                        can_update: !!modulePerms.update,
                        can_delete: !!modulePerms.delete,
                    },
                    { withCredentials: true }
                );
            });

            await Promise.all(promises);
            setSuccessMessage("Role permissions saved successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error saving role permissions:", err);
            showAlert("Error", "Failed to save role permissions. Please try again.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleGroupPermissionChange = (module, permissionType, value) => {
        const modulePerms = groupPermissions[module] || { read: false, create: false, update: false, delete: false };
        const newPerms = { ...modulePerms, [permissionType]: !!value };

        setGroupPermissions({
            ...groupPermissions,
            [module]: newPerms,
        });
    };

    const handleRolePermissionChange = (module, permissionType, value) => {
        const modulePerms = rolePermissions[module] || { read: false, create: false, update: false, delete: false };
        const newPerms = { ...modulePerms, [permissionType]: !!value };

        setRolePermissions({
            ...rolePermissions,
            [module]: newPerms,
        });
    };

    const handleBulkGroupPermissionChange = (module, level) => {
        const levelConfig = PERMISSION_LEVELS.find(l => l.key === level);
        if (!levelConfig) return;

        setGroupPermissions({
            ...groupPermissions,
            [module]: { ...levelConfig.permissions },
        });
    };

    const handleBulkRolePermissionChange = (module, level) => {
        const levelConfig = PERMISSION_LEVELS.find(l => l.key === level);
        if (!levelConfig) return;

        setRolePermissions({
            ...rolePermissions,
            [module]: { ...levelConfig.permissions },
        });
    };

    const categories = ["All", ...new Set(ALL_MODULES.map(m => m.category))];
    const filteredModules = ALL_MODULES.filter(module => {
        const matchesCategory = categoryFilter === "All" || module.category === categoryFilter;
        return matchesCategory;
    });

    const userPermissions = selectedUser ? (localPermissions[selectedUser.id] || {}) : {};

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="p-3 sm:p-4 md:p-6">

                {/* Page Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Home className="w-4 h-4" />
                            <span>&gt;</span>
                            <span>Settings</span>
                            <span>&gt;</span>
                            <span>Access Control</span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">

                    {/* Tabs */}
                    <div className="border-b border-gray-200 px-8">
                        <div className="flex gap-8">
                            <button
                                onClick={() => setActiveTab("access-control")}
                                className={`-mb-px px-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 rounded-t-xl ${activeTab === "access-control" ? "border-teal-500 text-teal-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                            >
                                <Shield className="w-4 h-4" />
                                <span>Access Control</span>
                            </button>
                            <button
                                onClick={() => setActiveTab("general")}
                                className={`-mb-px px-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 rounded-t-xl ${activeTab === "general" ? "border-teal-500 text-teal-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                            >
                                <SettingsIcon className="w-4 h-4" />
                                <span>General</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-8">
                        {activeTab === "access-control" && (
                            <div>
                                {/* Sub Tabs */}
                                <div className="mb-6 flex gap-4 border-b border-gray-100 pb-4">
                                    <button
                                        onClick={() => setActiveSubTab("users")}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${activeSubTab === "users" ? "bg-teal-50 text-teal-600" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                        <Users className="w-4 h-4 inline mr-2" />
                                        Users & Permissions
                                    </button>
                                    <button
                                        onClick={() => setActiveSubTab("reports")}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${activeSubTab === "reports" ? "bg-teal-50 text-teal-600" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                        <Grid className="w-4 h-4 inline mr-2" />
                                        Reports
                                    </button>
                                    <button
                                        onClick={() => setActiveSubTab("groups")}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${activeSubTab === "groups" ? "bg-teal-50 text-teal-600" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                        <Grid className="w-4 h-4 inline mr-2" />
                                        Groups
                                    </button>
                                    <button
                                        onClick={() => setActiveSubTab("roles")}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${activeSubTab === "roles" ? "bg-teal-50 text-teal-600" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                        <Shield className="w-4 h-4 inline mr-2" />
                                        Roles & Levels
                                    </button>
                                </div>

                                {/* Users & Permissions Tab */}
                                {activeSubTab === "reports" && (
                                    <div className="p-0 -m-8">
                                        <Reports />
                                    </div>
                                )}
                                {activeSubTab === "users" && (
                                    accessDenied ? (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                                            <Shield className="w-16 h-16 text-red-300 mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
                                            <p className="text-red-600">You do not have permission to view or manage access controls.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* User List */}
                                            <div className="lg:col-span-1">
                                                <div className="bg-gray-50 rounded-xl border border-gray-200">
                                                    <div className="p-4 border-b border-gray-200">
                                                        <h3 className="font-semibold text-gray-900 mb-3">Users</h3>
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search users..."
                                                                value={searchQuery}
                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="max-h-[600px] overflow-y-auto">
                                                        {loading ? (
                                                            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
                                                        ) : users.length === 0 ? (
                                                            <div className="p-4 text-center text-gray-500 text-sm">No users found</div>
                                                        ) : (
                                                            <div className="divide-y divide-gray-200">
                                                                {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map((user) => {
                                                                    const userPerms = permissions[user.id] || {};
                                                                    const moduleCount = Object.keys(userPerms).length;

                                                                    return (
                                                                        <button
                                                                            key={user.id}
                                                                            onClick={() => {
                                                                                setSelectedUser(user);
                                                                                setLocalPermissions({
                                                                                    ...localPermissions,
                                                                                    [user.id]: userPerms
                                                                                });
                                                                            }}
                                                                            className={`w-full text-left p-4 hover:bg-[var(--bg-primary)] transition-colors ${selectedUser?.id === user.id ? "bg-[var(--bg-primary)] border-l-4 border-teal-500" : ""
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-semibold">
                                                                                    {user.name.charAt(0).toUpperCase()}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="font-semibold text-gray-900 truncate">{user.name}</div>
                                                                                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                                                                    <div className="flex items-center gap-2 mt-1">
                                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{user.role}</span>
                                                                                        <span className="text-xs text-gray-400">{moduleCount} modules</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Permissions Panel */}
                                            <div className="lg:col-span-2">
                                                {selectedUser ? (
                                                    <div className="bg-gray-50 rounded-xl border border-gray-200">
                                                        {/* Header */}
                                                        <div className="p-6 border-b border-gray-200 bg-white rounded-t-xl">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div>
                                                                    <h3 className="text-xl font-bold text-gray-900">Module Permissions</h3>
                                                                    <p className="text-sm text-gray-600 mt-1">{selectedUser.name} ({selectedUser.email})</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => setSelectedUser(null)}
                                                                    className="text-gray-400 hover:text-gray-600 transition-colors rounded-xl"
                                                                >
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            </div>

                                                            {/* Category Filter */}
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm text-gray-600">Category:</span>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {categories.map(cat => (
                                                                        <button
                                                                            key={cat}
                                                                            onClick={() => setCategoryFilter(cat)}
                                                                            className={`px-3 py-1 text-xs font-medium rounded-xl transition-colors ${categoryFilter === cat
                                                                                ? "bg-teal-500 text-white"
                                                                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                                                                                }`}
                                                                        >
                                                                            {cat}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Module Permissions */}
                                                        <div className="p-6">
                                                            {successMessage && (
                                                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
                                                                    <Check className="w-4 h-4" />
                                                                    <span>{successMessage}</span>
                                                                </div>
                                                            )}

                                                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                                                {filteredModules.map((module) => {
                                                                    const modulePerms = userPermissions[module.key] || { read: false, create: false, update: false, delete: false };
                                                                    const currentLevel = getPermissionLevel(modulePerms);
                                                                    const levelConfig = PERMISSION_LEVELS.find(l => l.key === currentLevel);

                                                                    return (
                                                                        <div key={module.key} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-teal-300 transition-colors">
                                                                            <div className="flex items-center justify-between mb-3">
                                                                                <div className="flex-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-semibold text-gray-900">{module.label}</span>
                                                                                        <span className="text-xs px-2 py-0.5 rounded-xl bg-gray-100 text-gray-600">{module.category}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <select
                                                                                    value={currentLevel}
                                                                                    onChange={(e) => handleBulkPermissionChange(selectedUser.id, module.key, e.target.value)}
                                                                                    className={`text-xs font-medium px-3 py-1.5 rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-teal-500 ${levelConfig?.color === 'gray' ? 'border-gray-300 text-gray-600' :
                                                                                        levelConfig?.color === 'blue' ? 'border-blue-300 text-blue-600 bg-blue-50' :
                                                                                            levelConfig?.color === 'green' ? 'border-green-300 text-green-600 bg-green-50' :
                                                                                                levelConfig?.color === 'yellow' ? 'border-yellow-300 text-yellow-600 bg-yellow-50' :
                                                                                                    levelConfig?.color === 'teal' ? 'border-teal-300 text-teal-600 bg-teal-50' :
                                                                                                        'border-purple-300 text-purple-600 bg-purple-50'
                                                                                        }`}
                                                                                >
                                                                                    {PERMISSION_LEVELS.map(level => (
                                                                                        <option key={level.key} value={level.key}>{level.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {/* Individual Checkboxes */}
                                                                            <div className="flex flex-wrap gap-3">
                                                                                <label className="flex items-center cursor-pointer group">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={modulePerms.read}
                                                                                        onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'read', e.target.checked)}
                                                                                        className="w-4 h-4 text-teal-600 border-gray-300 rounded-xl focus:ring-teal-500"
                                                                                    />
                                                                                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Read</span>
                                                                                </label>
                                                                                <label className="flex items-center cursor-pointer group">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={modulePerms.create}
                                                                                        onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'create', e.target.checked)}
                                                                                        className="w-4 h-4 text-teal-600 border-gray-300 rounded-xl focus:ring-teal-500"
                                                                                    />
                                                                                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Create</span>
                                                                                </label>
                                                                                <label className="flex items-center cursor-pointer group">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={modulePerms.update}
                                                                                        onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'update', e.target.checked)}
                                                                                        className="w-4 h-4 text-teal-600 border-gray-300 rounded-xl focus:ring-teal-500"
                                                                                    />
                                                                                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Update</span>
                                                                                </label>
                                                                                <label className="flex items-center cursor-pointer group">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={modulePerms.delete}
                                                                                        onChange={(e) => handlePermissionChange(selectedUser.id, module.key, 'delete', e.target.checked)}
                                                                                        className="w-4 h-4 text-teal-600 border-gray-300 rounded-xl focus:ring-teal-500"
                                                                                    />
                                                                                    <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">Delete</span>
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="p-6 border-t border-gray-200 bg-white rounded-b-xl">
                                                            <div className="flex justify-end gap-4">
                                                                <button
                                                                    onClick={() => {
                                                                        setLocalPermissions(JSON.parse(JSON.stringify(permissions)));
                                                                        setSelectedUser(null);
                                                                    }}
                                                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    onClick={handleSavePermissions}
                                                                    disabled={saving}
                                                                    className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2 shadow-md ${saving ? "bg-teal-600 text-white cursor-not-allowed" : "bg-teal-500 text-white hover:bg-teal-600"
                                                                        }`}
                                                                >
                                                                    {saving ? (
                                                                        <>
                                                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                            <span>Saving...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Save className="w-4 h-4" />
                                                                            <span>Save Permissions</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 rounded-xl border border-gray-200 h-[600px] flex items-center justify-center">
                                                        <div className="text-center">
                                                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                                            <p className="text-gray-500 text-sm">Select a user to manage permissions</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}

                                {/* Groups Tab */}
                                {activeSubTab === "groups" && (
                                    <div>
                                        {successMessage && (
                                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
                                                <Check className="w-4 h-4" />
                                                <span>{successMessage}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-semibold text-gray-900">Permission Groups</h3>
                                            <button
                                                onClick={() => {
                                                    setEditingGroup(null);
                                                    setGroupForm({ name: "", description: "" });
                                                    setShowGroupModal(true);
                                                }}
                                                className="bg-teal-500 text-white px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors shadow-md flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Create Group</span>
                                            </button>
                                        </div>

                                        {loading ? (
                                            <div className="text-center py-12 text-gray-500">Loading...</div>
                                        ) : groups.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Grid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                                <p className="text-gray-500 text-sm">No groups yet. Create your first group to get started.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {groups.map((group) => (
                                                    <div key={group.id} className="bg-white rounded-xl border border-gray-200 p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-gray-900 mb-1">{group.name}</h4>
                                                                <p className="text-sm text-gray-600 line-clamp-2">{group.description || "No description"}</p>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingGroup(group);
                                                                        setGroupForm({ name: group.name, description: group.description || "" });
                                                                        setShowGroupModal(true);
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-teal-600 transition-colors rounded-xl"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteGroup(group.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-xl"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                                            <span className="flex items-center gap-1">
                                                                <Users className="w-4 h-4" />
                                                                {group.member_count || 0} members
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Shield className="w-4 h-4" />
                                                                {group.permission_count || 0} permissions
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                loadGroupDetails(group.id);
                                                                setActiveSubTab("group-details");
                                                            }}
                                                            className="w-full py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors"
                                                        >
                                                            Manage Group
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Roles Tab */}
                                {activeSubTab === "roles" && (
                                    <div>
                                        {successMessage && (
                                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
                                                <Check className="w-4 h-4" />
                                                <span>{successMessage}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-semibold text-gray-900">Permission Roles</h3>
                                            <button
                                                onClick={() => {
                                                    setEditingRole(null);
                                                    setRoleForm({ name: "", description: "", level: "view" });
                                                    setShowRoleModal(true);
                                                }}
                                                className="bg-teal-500 text-white px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors shadow-md flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Create Role</span>
                                            </button>
                                        </div>

                                        {loading ? (
                                            <div className="text-center py-12 text-gray-500">Loading...</div>
                                        ) : roles.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                                <p className="text-gray-500 text-sm">No roles yet. Create your first role to get started.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {roles.map((role) => {
                                                    const levelConfig = PERMISSION_LEVELS.find(l => l.key === role.level) || PERMISSION_LEVELS[0];
                                                    return (
                                                        <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h4 className="font-semibold text-gray-900">{role.name}</h4>
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${levelConfig.color === 'gray' ? 'bg-gray-100 text-gray-600' :
                                                                            levelConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                                                                levelConfig.color === 'green' ? 'bg-green-100 text-green-600' :
                                                                                    levelConfig.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                                                                                        levelConfig.color === 'teal' ? 'bg-teal-100 text-teal-600' :
                                                                                            'bg-purple-100 text-purple-600'
                                                                            }`}>
                                                                            {levelConfig.label}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-600 line-clamp-2">{role.description || "No description"}</p>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingRole(role);
                                                                            setRoleForm({ name: role.name, description: role.description || "", level: role.level });
                                                                            setShowRoleModal(true);
                                                                        }}
                                                                        className="p-1.5 text-gray-400 hover:text-teal-600 transition-colors rounded-xl"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRole(role.id)}
                                                                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-xl"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                                                <span className="flex items-center gap-1">
                                                                    <Users className="w-4 h-4" />
                                                                    {role.user_count || 0} users
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Shield className="w-4 h-4" />
                                                                    {role.permission_count || 0} permissions
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    loadRoleDetails(role.id);
                                                                    setActiveSubTab("role-details");
                                                                }}
                                                                className="w-full py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors"
                                                            >
                                                                Manage Role
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Group Details Tab */}
                                {activeSubTab === "group-details" && selectedGroup && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <button
                                                onClick={() => {
                                                    setActiveSubTab("groups");
                                                    setSelectedGroup(null);
                                                }}
                                                className="text-gray-600 hover:text-gray-900 rounded-xl"
                                            >
                                                ← Back to Groups
                                            </button>
                                            <h3 className="text-lg font-semibold text-gray-900">{selectedGroup.name}</h3>
                                        </div>

                                        {successMessage && (
                                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
                                                <Check className="w-4 h-4" />
                                                <span>{successMessage}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Members Section */}
                                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-semibold text-gray-900">Group Members</h4>
                                                    <button
                                                        onClick={() => setShowAddMemberModal(true)}
                                                        className="text-sm px-3 py-1.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 flex items-center gap-1"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                        Add Member
                                                    </button>
                                                </div>
                                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                                    {selectedGroup.members && selectedGroup.members.length > 0 ? (
                                                        selectedGroup.members.map(member => (
                                                            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-sm font-semibold">
                                                                        {member.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                                                                        <div className="text-xs text-gray-500">{member.email}</div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemoveUserFromGroup(member.id)}
                                                                    className="text-red-600 hover:text-red-700 p-1 rounded-xl"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-sm text-gray-500 text-center py-4">No members yet</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Group Permissions Section */}
                                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                                <h4 className="font-semibold text-gray-900 mb-4">Group Permissions</h4>
                                                <div className="mb-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {categories.map(cat => (
                                                            <button
                                                                key={cat}
                                                                onClick={() => setCategoryFilter(cat)}
                                                                className={`px-3 py-1 text-xs font-medium rounded-xl ${categoryFilter === cat
                                                                    ? "bg-teal-500 text-white"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                    }`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                                    {filteredModules.map((module) => {
                                                        const modulePerms = groupPermissions[module.key] || { read: false, create: false, update: false, delete: false };
                                                        const currentLevel = getPermissionLevel(modulePerms);
                                                        const levelConfig = PERMISSION_LEVELS.find(l => l.key === currentLevel);

                                                        return (
                                                            <div key={module.key} className="p-3 bg-gray-50 rounded-xl">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm font-medium text-gray-900">{module.label}</span>
                                                                    <select
                                                                        value={currentLevel}
                                                                        onChange={(e) => handleBulkGroupPermissionChange(module.key, e.target.value)}
                                                                        className={`text-xs px-2 py-1 rounded-xl border ${levelConfig?.color === 'gray' ? 'border-gray-300 text-gray-600' :
                                                                            levelConfig?.color === 'blue' ? 'border-blue-300 text-blue-600' :
                                                                                levelConfig?.color === 'green' ? 'border-green-300 text-green-600' :
                                                                                    levelConfig?.color === 'yellow' ? 'border-yellow-300 text-yellow-600' :
                                                                                        levelConfig?.color === 'teal' ? 'border-teal-300 text-teal-600' :
                                                                                            'border-purple-300 text-purple-600'
                                                                            }`}
                                                                    >
                                                                        {PERMISSION_LEVELS.map(level => (
                                                                            <option key={level.key} value={level.key}>{level.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="flex gap-3 text-xs">
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.read}
                                                                            onChange={(e) => handleGroupPermissionChange(module.key, 'read', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Read</span>
                                                                    </label>
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.create}
                                                                            onChange={(e) => handleGroupPermissionChange(module.key, 'create', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Create</span>
                                                                    </label>
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.update}
                                                                            onChange={(e) => handleGroupPermissionChange(module.key, 'update', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Update</span>
                                                                    </label>
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.delete}
                                                                            onChange={(e) => handleGroupPermissionChange(module.key, 'delete', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Delete</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={handleSaveGroupPermissions}
                                                    disabled={saving}
                                                    className="w-full mt-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 disabled:opacity-50"
                                                >
                                                    {saving ? "Saving..." : "Save Group Permissions"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Role Details Tab */}
                                {activeSubTab === "role-details" && selectedRole && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <button
                                                onClick={() => {
                                                    setActiveSubTab("roles");
                                                    setSelectedRole(null);
                                                }}
                                                className="text-gray-600 hover:text-gray-900 rounded-xl"
                                            >
                                                ← Back to Roles
                                            </button>
                                            <h3 className="text-lg font-semibold text-gray-900">{selectedRole.name}</h3>
                                        </div>

                                        {successMessage && (
                                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
                                                <Check className="w-4 h-4" />
                                                <span>{successMessage}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Assigned Users Section */}
                                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-semibold text-gray-900">Assigned Users</h4>
                                                    <button
                                                        onClick={() => setShowAssignRoleModal(true)}
                                                        className="text-sm px-3 py-1.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 flex items-center gap-1"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                        Assign User
                                                    </button>
                                                </div>
                                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                                    {selectedRole.users && selectedRole.users.length > 0 ? (
                                                        selectedRole.users.map(user => (
                                                            <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-sm font-semibold">
                                                                        {user.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemoveRoleFromUser(user.id)}
                                                                    className="text-red-600 hover:text-red-700 p-1 rounded-xl"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-sm text-gray-500 text-center py-4">No users assigned yet</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Role Permissions Section */}
                                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                                <h4 className="font-semibold text-gray-900 mb-4">Role Permissions</h4>
                                                <div className="mb-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {categories.map(cat => (
                                                            <button
                                                                key={cat}
                                                                onClick={() => setCategoryFilter(cat)}
                                                                className={`px-3 py-1 text-xs font-medium rounded-xl ${categoryFilter === cat
                                                                    ? "bg-teal-500 text-white"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                    }`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                                    {filteredModules.map((module) => {
                                                        const modulePerms = rolePermissions[module.key] || { read: false, create: false, update: false, delete: false };
                                                        const currentLevel = getPermissionLevel(modulePerms);
                                                        const levelConfig = PERMISSION_LEVELS.find(l => l.key === currentLevel);

                                                        return (
                                                            <div key={module.key} className="p-3 bg-gray-50 rounded-xl">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm font-medium text-gray-900">{module.label}</span>
                                                                    <select
                                                                        value={currentLevel}
                                                                        onChange={(e) => handleBulkRolePermissionChange(module.key, e.target.value)}
                                                                        className={`text-xs px-2 py-1 rounded-xl border ${levelConfig?.color === 'gray' ? 'border-gray-300 text-gray-600' :
                                                                            levelConfig?.color === 'blue' ? 'border-blue-300 text-blue-600' :
                                                                                levelConfig?.color === 'green' ? 'border-green-300 text-green-600' :
                                                                                    levelConfig?.color === 'yellow' ? 'border-yellow-300 text-yellow-600' :
                                                                                        levelConfig?.color === 'teal' ? 'border-teal-300 text-teal-600' :
                                                                                            'border-purple-300 text-purple-600'
                                                                            }`}
                                                                    >
                                                                        {PERMISSION_LEVELS.map(level => (
                                                                            <option key={level.key} value={level.key}>{level.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="flex gap-3 text-xs">
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.read}
                                                                            onChange={(e) => handleRolePermissionChange(module.key, 'read', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Read</span>
                                                                    </label>
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.create}
                                                                            onChange={(e) => handleRolePermissionChange(module.key, 'create', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Create</span>
                                                                    </label>
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.update}
                                                                            onChange={(e) => handleRolePermissionChange(module.key, 'update', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Update</span>
                                                                    </label>
                                                                    <label className="flex items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={modulePerms.delete}
                                                                            onChange={(e) => handleRolePermissionChange(module.key, 'delete', e.target.checked)}
                                                                            className="w-3 h-3 text-teal-600 rounded-xl"
                                                                        />
                                                                        <span className="ml-1 text-gray-600">Delete</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={handleSaveRolePermissions}
                                                    disabled={saving}
                                                    className="w-full mt-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 disabled:opacity-50"
                                                >
                                                    {saving ? "Saving..." : "Save Role Permissions"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "general" && (
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <SettingsIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">General Settings</h3>
                                    <p className="text-gray-500 text-sm">System configuration and preferences</p>
                                </div>

                                {successMessage && (
                                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
                                        <Check className="w-5 h-5" />
                                        <span>{successMessage}</span>
                                    </div>
                                )}

                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="p-6 border-b border-gray-100">
                                        <h4 className="font-semibold text-gray-900 mb-1">Sidebar Navigation</h4>
                                        <p className="text-sm text-gray-500">Configure visibility of sidebar menu items</p>
                                    </div>

                                    <div className="p-6 space-y-8">
                                        {[
                                            { id: 'dashboard', label: 'Dashboards', desc: 'Main and Widget Dashboards.', icon: <Grid className="w-6 h-6" />, color: 'slate' },
                                            { id: 'su_data', label: 'SU Data', desc: 'Service Users, Analytics, Accommodation, etc.', icon: <Users className="w-6 h-6" />, color: 'indigo' },
                                            { id: 'property', label: 'Property', desc: 'Properties, Bookings, Org Chart, Employee List.', icon: <Home className="w-6 h-6" />, color: 'blue' },
                                            { id: 'forms', label: 'Forms & Builder', desc: 'Form Builder and Submissions.', icon: <Layout className="w-6 h-6" />, color: 'purple' },
                                            { id: 'access', label: 'Access Control Menu', desc: 'Show "Access" (User Access Control & Reports) in the main sidebar.', icon: <Shield className="w-6 h-6" />, color: 'teal' },
                                            { id: 'operations', label: 'Operations Hub', desc: 'Show Inspections, Incidents, Complaints, Compliance, etc.', icon: <Layout className="w-6 h-6" />, color: 'blue' },
                                            { id: 'hse', label: 'HSE Menu', desc: 'Show HSE Incidents, Risk Management, Training, Audits.', icon: <Activity className="w-6 h-6" />, color: 'orange' },
                                            { id: 'safeguarding', label: 'Safeguarding Menu', desc: 'Show Referrals, Risk Assessments, Vulnerable Users.', icon: <ShieldAlert className="w-6 h-6" />, color: 'red' },
                                            { id: 'escalations', label: 'Escalations Menu', desc: 'Show VCS Organisations, Case Management, Emergency Protocols.', icon: <AlertTriangle className="w-6 h-6" />, color: 'amber' },
                                        ].map((menu) => (
                                            <div key={menu.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-2 bg-${menu.color}-50 rounded-xl text-${menu.color}-600`}>
                                                        {menu.icon}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{menu.label}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{menu.desc}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                                    {['Admin', 'Manager', 'Staff'].map((role) => {
                                                        const roleKey = role.toLowerCase();
                                                        const isChecked = sidebarSettings[menu.id]?.[roleKey];
                                                        return (
                                                            <button
                                                                key={role}
                                                                onClick={() => handleToggleSidebarSetting(menu.id, roleKey)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isChecked
                                                                    ? 'bg-teal-500 text-white shadow-sm ring-1 ring-teal-600/10'
                                                                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                                            >
                                                                {isChecked ? <Check className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-50" />}
                                                                {role}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Group Modal */}
                {showGroupModal && createPortal(
                    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                            <div className="p-6 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">{editingGroup ? "Edit Group" : "Create New Group"}</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                                    <input
                                        type="text"
                                        value={groupForm.name}
                                        onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        placeholder="e.g., Operations Team"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        value={groupForm.description}
                                        onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        rows="3"
                                        placeholder="Group description..."
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowGroupModal(false);
                                        setEditingGroup(null);
                                        setGroupForm({ name: "", description: "" });
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : editingGroup ? "Update" : "Create"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Role Modal */}
                {showRoleModal && createPortal(
                    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                            <div className="p-6 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">{editingRole ? "Edit Role" : "Create New Role"}</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Role Name *</label>
                                    <input
                                        type="text"
                                        value={roleForm.name}
                                        onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        placeholder="e.g., Manager"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Permission Level *</label>
                                    <select
                                        value={roleForm.level}
                                        onChange={(e) => setRoleForm({ ...roleForm, level: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        {PERMISSION_LEVELS.filter(l => l.key !== 'none' && l.key !== 'custom').map(level => (
                                            <option key={level.key} value={level.key}>{level.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        value={roleForm.description}
                                        onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        rows="3"
                                        placeholder="Role description..."
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowRoleModal(false);
                                        setEditingRole(null);
                                        setRoleForm({ name: "", description: "", level: "view" });
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={editingRole ? handleUpdateRole : handleCreateRole}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : editingRole ? "Update" : "Create"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Add Member Modal */}
                {showAddMemberModal && createPortal(
                    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[600px] flex flex-col">
                            <div className="p-6 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">Add Member to Group</h3>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    {users.filter(u => !selectedGroup?.members?.some(m => m.id === u.id)).map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleAddUserToGroup(user.id)}
                                            className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-semibold">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {users.filter(u => !selectedGroup?.members?.some(m => m.id === u.id)).length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-4">All users are already members</p>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 flex justify-end">
                                <button
                                    onClick={() => setShowAddMemberModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Assign Role Modal */}
                {showAssignRoleModal && createPortal(
                    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[600px] flex flex-col">
                            <div className="p-6 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">Assign Role to User</h3>
                            </div>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={assignRoleSearch}
                                        onChange={(e) => setAssignRoleSearch(e.target.value)}
                                        placeholder="Search name or email..."
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                    <select
                                        value={assignRoleFilter}
                                        onChange={(e) => setAssignRoleFilter(e.target.value)}
                                        className="px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="all">All</option>
                                        <option value="admin">Admin</option>
                                        <option value="manager">Manager</option>
                                        <option value="staff">Staff</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    {users
                                        .filter((u) => !selectedRole?.users?.some((ru) => ru.id === u.id))
                                        .filter((u) => {
                                            const q = String(assignRoleSearch || "").trim().toLowerCase();
                                            if (!q) return true;
                                            const name = String(u?.name || "").toLowerCase();
                                            const email = String(u?.email || "").toLowerCase();
                                            return name.includes(q) || email.includes(q);
                                        })
                                        .filter((u) => {
                                            if (assignRoleFilter === "all") return true;
                                            return String(u?.role || "").toLowerCase() === String(assignRoleFilter).toLowerCase();
                                        })
                                        .map((user) => {
                                            const checked = assignRoleSelectedUserIds?.has(user.id);
                                            return (
                                                <div
                                                    key={user.id}
                                                    onClick={() => {
                                                        setAssignRoleSelectedUserIds((prev) => {
                                                            const next = new Set(prev || []);
                                                            if (next.has(user.id)) next.delete(user.id);
                                                            else next.add(user.id);
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!!checked}
                                                        onChange={() => { }}
                                                        className="w-4 h-4 text-teal-600 rounded-xl"
                                                    />
                                                    <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-semibold">
                                                        {String(user.name || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                                                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    {users.filter((u) => !selectedRole?.users?.some((ru) => ru.id === u.id)).length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-4">All users already have this role</p>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowAssignRoleModal(false);
                                        setAssignRoleSearch("");
                                        setAssignRoleFilter("all");
                                        setAssignRoleSelectedUserIds(new Set());
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleAssignRoleToUsersBulk}
                                    disabled={saving || !assignRoleSelectedUserIds || assignRoleSelectedUserIds.size === 0}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                {/* Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={confirmDialog.isOpen}
                    onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={confirmDialog.onConfirm}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    type={confirmDialog.type}
                />

                {/* Alert Dialog */}
                <AlertDialog
                    isOpen={alertDialog.isOpen}
                    onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
                    title={alertDialog.title}
                    message={alertDialog.message}
                    type={alertDialog.type}
                />
            </div>
        </div>
    );
}

