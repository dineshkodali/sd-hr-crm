/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import AuthenticatorSetup from "../components/AuthenticatorSetup";
import DeviceManagement from "../components/DeviceManagement";
import SessionsManagement from "../components/SessionsManagement";
import ActivityLogs from "../components/ActivityLogs";

export default function Profile({ user: userProp }) {
  // Fallback: Get user from context if not passed as prop
  const context = useOutletContext(); 
  const initialUser = userProp || context?.user || {};

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  // load profile from server (preferred) or fallback to userProp/localStorage
  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/profile", { withCredentials: true });
      const data = res.data.profile || res.data.user || null;
      setProfile(data);
      setForm(data || {});
    } catch (err) {
      // fallback: use initialUser/localStorage
      let fallback = initialUser.id ? initialUser : null;
      try {
        if (!fallback) {
          const raw = localStorage.getItem("user");
          if (raw) fallback = JSON.parse(raw);
        }
      } catch {}
      setProfile(fallback || null);
      setForm(fallback || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const saveProfile = async (e) => {
    e?.preventDefault();
    setMsg("");
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        dob: form.dob,
        nationality: form.nationality,
        religion: form.religion,
        marital_status: form.marital_status,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        zipcode: form.zipcode,
      };
      const res = await axios.put("/api/profile", payload, { withCredentials: true });
      setProfile(res.data.profile || res.data);
      setEditing(false);
      setMsg("Profile saved successfully");
      
      // Clear message after 3 seconds
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      console.error("save profile error:", err);
      const m = err?.response?.data?.message || err?.message || "Failed to save";
      setMsg(m);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await axios.post("/api/profile/resume", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      // update profile
      setProfile((p) => ({ ...(p || {}), resume_url: res.data.resume_url }));
      setMsg("Resume uploaded successfully");
    } catch (err) {
      console.error("upload resume error:", err);
      const m = err?.response?.data?.message || err?.message || "Upload failed";
      setMsg(m);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-full flex items-center justify-center text-gray-500">Loading profile...</div>;

  const fullName = profile?.name || "Unnamed User";
  const email = profile?.email || "—";
  const phone = profile?.phone || "—";
  const gender = profile?.gender || "—";
  const dob = profile?.dob ? new Date(profile.dob).toLocaleDateString() : "—";
  const nationality = profile?.nationality || "—";
  const religion = profile?.religion || "—";
  const marital = profile?.marital_status || "—";

  const address = {
    line: profile?.address || "—",
    city: profile?.city || "—",
    state: profile?.state || "—",
    country: profile?.country || "—",
    zipcode: profile?.zipcode || "—",
  };

  const resumeUrl = profile?.resume_url || null;

  const initials = (fullName || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">
        
        {/* Header */}
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile</h1>
            <div className="text-sm text-gray-500">Manage your personal information</div>
        </div>

        {/* Top Card: Avatar & Basic Info */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-6 transition-all duration-200 hover:shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-teal-500 text-white flex items-center justify-center text-3xl font-semibold shrink-0 shadow-lg">
              {profile?.avatar ? (
                 <img src={profile.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
              ) : initials}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              <div className="text-sm text-gray-500 mt-1">{email}</div>
              <div className="text-sm text-gray-500 mt-1">
                Role: <span className="font-medium text-gray-700 capitalize">{profile?.role || "—"}</span>
              </div>
            </div>

            <div className="text-right hidden md:block">
              <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Joined</div>
              <div className="font-medium text-gray-700">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {profile?.branch ? `Branch: ${profile.branch}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          
          {/* Tabs */}
          <div className="border-b border-gray-200 px-8">
            <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab("profile")}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "profile" ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Profile
              </button>
              <button 
                onClick={() => setActiveTab("security")}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "security" ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Security
              </button>
              <button 
                onClick={() => setActiveTab("logs")}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "logs" ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Logs
              </button>
              <button 
                onClick={() => setActiveTab("pipeline")}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "pipeline" ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Hiring Pipeline
              </button>
              <button 
                onClick={() => setActiveTab("notes")}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "notes" ? "border-teal-500 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Notes
              </button>
            </div>
          </div>

          <div className="p-8">
            {msg && <div className={`mb-6 text-sm p-3 rounded ${msg.includes("failed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg}</div>}

            {/* PROFILE TAB CONTENT */}
            {activeTab === "profile" && (
                <>
                {!editing ? (
                    // --- VIEW MODE ---
                    <div className="space-y-8">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                            <button onClick={() => setEditing(true)} className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors">Edit</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Candidate Name</div><div className="text-sm font-medium text-gray-700">{fullName}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Phone</div><div className="text-sm font-medium text-gray-700">{phone}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Gender</div><div className="text-sm font-medium text-gray-700">{gender}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Date of Birth</div><div className="text-sm font-medium text-gray-700">{dob}</div></div>
                        
                        <div className="md:col-span-2"><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Email</div><div className="text-sm font-medium text-gray-700">{email}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Nationality</div><div className="text-sm font-medium text-gray-700">{nationality}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Religion</div><div className="text-sm font-medium text-gray-700">{religion}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Marital Status</div><div className="text-sm font-medium text-gray-700">{marital}</div></div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="md:col-span-2"><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Address</div><div className="text-sm font-medium text-gray-700">{address.line}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">City</div><div className="text-sm font-medium text-gray-700">{address.city}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">State</div><div className="text-sm font-medium text-gray-700">{address.state}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Zipcode</div><div className="text-sm font-medium text-gray-700">{address.zipcode}</div></div>
                        <div><div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Country</div><div className="text-sm font-medium text-gray-700">{address.country}</div></div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                        <div>
                            <div className="font-medium text-gray-700">Resume</div>
                            <div className="text-xs text-gray-500 mt-1">{resumeUrl ? "File uploaded" : "No resume attached"}</div>
                        </div>
                        <div className="flex gap-2">
                            {resumeUrl ? (
                            <a href={resumeUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm">Download</a>
                            ) : (
                            <button disabled className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-400 text-xs font-medium rounded-lg cursor-not-allowed">Download</button>
                            )}
                            <label className="px-4 py-2 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 cursor-pointer transition-colors shadow-sm">
                                {uploading ? "Uploading..." : "Upload"}
                                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e)=> { if (e.target.files?.[0]) handleResumeUpload(e.target.files[0]); }} />
                            </label>
                        </div>
                        </div>
                    </div>
                    </div>
                ) : (
                    // --- EDIT MODE ---
                    <form onSubmit={saveProfile} className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                <label className="text-sm font-medium text-gray-700">Full Name</label>
                                <input value={form.name || ""} onChange={(e) => handleChange("name", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Email (Read-only)</label>
                                <input value={form.email || ""} readOnly className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-500 cursor-not-allowed" />
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Phone</label>
                                <input value={form.phone || ""} onChange={(e) => handleChange("phone", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Gender</label>
                                <select value={form.gender || ""} onChange={(e) => handleChange("gender", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none">
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                                <input type="date" value={form.dob ? form.dob.split("T")[0] : ""} onChange={(e) => handleChange("dob", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Nationality</label>
                                <input value={form.nationality || ""} onChange={(e) => handleChange("nationality", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Religion</label>
                                <input value={form.religion || ""} onChange={(e) => handleChange("religion", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                </div>
                                <div>
                                <label className="text-sm font-medium text-gray-700">Marital Status</label>
                                <select value={form.marital_status || ""} onChange={(e) => handleChange("marital_status", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none">
                                    <option value="">Select</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Divorced">Divorced</option>
                                </select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Address</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Address Line</label>
                                    <input value={form.address || ""} onChange={(e) => handleChange("address", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">City</label>
                                        <input value={form.city || ""} onChange={(e) => handleChange("city", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">State</label>
                                        <input value={form.state || ""} onChange={(e) => handleChange("state", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Zipcode</label>
                                        <input value={form.zipcode || ""} onChange={(e) => handleChange("zipcode", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Country</label>
                                        <input value={form.country || ""} onChange={(e) => handleChange("country", e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 justify-end border-t border-gray-200">
                            <button type="button" onClick={() => { setEditing(false); setForm(profile || {}); }} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                            <button type="submit" className="px-5 py-2.5 bg-teal-500 text-white font-medium rounded-lg hover:bg-teal-600 shadow-md hover:shadow-lg transition-all">Save Changes</button>
                        </div>
                    </form>
                )}
                </>
            )}

            {/* OTHER TABS */}
            {activeTab === "pipeline" && (
                <div className="py-12 text-center">
                    <div className="text-gray-400 mb-2 text-4xl">📭</div>
                    <h3 className="text-gray-900 font-medium">No pipeline data</h3>
                    <p className="text-gray-500 text-sm">Hiring pipeline information will appear here.</p>
                </div>
            )}

            {activeTab === "notes" && (
                <div className="py-12 text-center">
                    <div className="text-gray-400 mb-2 text-4xl">📝</div>
                    <h3 className="text-gray-900 font-medium">No notes added</h3>
                    <p className="text-gray-500 text-sm">There are no notes for this profile yet.</p>
                </div>
            )}

            {activeTab === "security" && (
                <div className="space-y-6">
                    {/* Security Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
                            <div className="flex items-center gap-4">
                                <div className="bg-teal-100 text-teal-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-gray-500 text-sm mb-1">2FA Status</div>
                                    <div className="text-lg font-bold text-gray-900">{profile?.authenticator_enabled ? 'Enabled' : 'Disabled'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-gray-500 text-sm mb-1">Trusted Devices</div>
                                    <div className="text-lg font-bold text-gray-900">View Devices</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
                            <div className="flex items-center gap-4">
                                <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-gray-500 text-sm mb-1">Active Sessions</div>
                                    <div className="text-lg font-bold text-gray-900">Manage</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Google Authenticator Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-teal-100 text-teal-600 h-10 w-10 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Google Authenticator</h3>
                                <p className="text-sm text-gray-500">Set up two-factor authentication</p>
                            </div>
                        </div>
                        <AuthenticatorSetup />
                    </div>
                    
                    {/* Manage Devices Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-blue-100 text-blue-600 h-10 w-10 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Trusted Devices</h3>
                                <p className="text-sm text-gray-500">Manage your authenticator devices</p>
                            </div>
                        </div>
                        <DeviceManagement />
                    </div>

                    {/* Active Sessions Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-purple-100 text-purple-600 h-10 w-10 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Active Sessions</h3>
                                <p className="text-sm text-gray-500">View and manage your login sessions</p>
                            </div>
                        </div>
                        <SessionsManagement />
                    </div>
                </div>
            )}

            {/* LOGS TAB */}
            {activeTab === "logs" && (
                <div className="space-y-6">
                    {/* Logs Overview Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-100 text-indigo-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-gray-500 text-sm mb-1">Activity Logs</div>
                                    <div className="text-lg font-bold text-gray-900">Your Actions</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
                            <div className="flex items-center gap-4">
                                <div className="bg-green-100 text-green-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-gray-500 text-sm mb-1">Recent Activity</div>
                                    <div className="text-lg font-bold text-gray-900">Last 30 Days</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Logs Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-indigo-100 text-indigo-600 h-10 w-10 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Activity Logs</h3>
                                <p className="text-sm text-gray-500">Track all your account activities</p>
                            </div>
                        </div>
                        <ActivityLogs />
                    </div>
                </div>
            )}

          </div>
        </div>

        <div className="mt-8 text-xs text-gray-400 text-center">© {new Date().getFullYear()} SD Commercial</div>
      </div>
    </div>
  );
}