// src/components/StaffDetailPanel.jsx
import React from "react";

/**
 * StaffDetailPanel
 * Props:
 *  - open (bool)
 *  - onClose (fn)
 *  - user (object) : full user record from GET /api/admin/users/:id
 *
 * Renders a right-side panel with profile summary and tabs (Profile / Notes / Hiring - simple).
 */
export default function StaffDetailPanel({ open, onClose, user }) {
  if (!open) return null;

  // Defensive getters
  const name = user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Unknown";
  const avatar = user?.avatar || user?.photo || user?.image || null;
  const email = user?.email || "—";
  const phone = user?.phone || "—";
  const role = user?.role || "—";
  const joiningDate = user?.joining_date ? new Date(user.joining_date).toLocaleDateString() : (user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—");
  const gender = user?.gender || "—";
  const dob = user?.dob ? new Date(user.dob).toLocaleDateString() : "—";
  const nationality = user?.nationality || "—";
  const religion = user?.religion || "—";
  const marital_status = user?.marital_status || "—";

  const address = user?.address || "—";
  const city = user?.city || "—";
  const state = user?.state || "—";
  const country = user?.country || "—";

  const resumeUrl = user?.resume_url || user?.resume || null; // backend may use resume_url or resume

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* panel */}
      <aside className="relative ml-auto w-full max-w-2xl bg-white shadow-xl overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-2xl font-bold">
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                (name || "U").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">{name}</div>
              <div className="text-sm text-slate-500">{role}</div>
              <div className="text-xs text-slate-400 mt-1">Joined: {joiningDate}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a href={resumeUrl || "#"} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-3 py-1 rounded ${resumeUrl ? "bg-slate-50 text-slate-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {resumeUrl ? "Resume" : "No resume"}
            </a>

            <button onClick={onClose} className="p-2 rounded bg-gray-100">
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border p-3">
              <div className="text-xs text-slate-400">Email</div>
              <div className="font-medium break-words">{email}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-400">Phone</div>
              <div className="font-medium">{phone}</div>
            </div>
          </div>

          {/* Tabs: Profile */}
          <div className="bg-white border rounded">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Personal Information</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">Full name</div>
                <div className="font-medium">{name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Date of birth</div>
                <div className="font-medium">{dob}</div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Gender</div>
                <div className="font-medium">{gender}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Nationality</div>
                <div className="font-medium">{nationality}</div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Religion</div>
                <div className="font-medium">{religion}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Marital status</div>
                <div className="font-medium">{marital_status}</div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white border rounded">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Address Information</h4>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-400">Address</div>
                  <div className="font-medium">{address}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">City</div>
                  <div className="font-medium">{city}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">State</div>
                  <div className="font-medium">{state}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Country</div>
                  <div className="font-medium">{country}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Resume */}
          <div className="bg-white border rounded">
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold">Resume</h4>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                {resumeUrl ? (
                  <>
                    <div className="text-sm font-medium">Resume</div>
                    <div className="text-xs text-slate-400">Uploaded file</div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">No resume uploaded</div>
                )}
              </div>

              {resumeUrl ? (
                <a href={resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white">
                  Download
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
