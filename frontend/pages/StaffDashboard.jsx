/* eslint-disable no-unused-vars */
// src/pages/StaffDashboard.jsx
// Staff Dashboard with Tasks + Notifications added (2 per row grid).
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useOutletContext } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StaffSidebar from "../components/StaffSidebar";

axios.defaults.withCredentials = true;

const DONUT_COLORS = ["#0f172a", "#ef6c37", "#f59e0b", "#10b981", "#ef4444"];

/* -------------------------
   Small helper components
   ------------------------- */

function LargeCircle({ valueStr, percent }) {
  const size = 160;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      <defs>
        <linearGradient id="g1" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={r} stroke="#f3f4f6" strokeWidth={stroke} fill="none" />
        <circle
          r={r}
          stroke="url(#g1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90)"
        />
        <text x="0" y="-6" textAnchor="middle" fontSize="12" fill="#6b7280">
          Total Hours
        </text>
        <text x="0" y="18" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
          {valueStr}
        </text>
      </g>
    </svg>
  );
}

function KPI({ color, title, value, note }) {
  return (
    <div className="bg-white rounded-md shadow p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center text-white" style={{ background: color }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 7h18M3 12h18M3 17h18" stroke="rgba(255,255,255,0.95)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="text-xs text-slate-400">{title}</div>
        </div>

        <div className="text-3xl font-semibold text-slate-900 leading-none">{value}</div>
      </div>

      <div className="mt-4 h-px bg-slate-100" />

      <div className="mt-4 text-sm text-slate-500">{note}</div>
    </div>
  );
}

function Timeline({ segments = [] }) {
  const hours = ["06", "07", "08", "09", "10", "11"];
  return (
    <div className="bg-white rounded-md shadow p-5 mt-4">
      <div className="grid grid-cols-4 gap-6 mb-4">
        <div>
          <div className="text-xs text-slate-400">Total Working hours</div>
          <div className="font-semibold text-lg">12h 36m</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Productive Hours</div>
          <div className="font-semibold text-lg">08h 36m</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Break hours</div>
          <div className="font-semibold text-lg">22m 15s</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Overtime</div>
          <div className="font-semibold text-lg">02h 15m</div>
        </div>
      </div>

      <div>
        <div className="relative h-6 bg-slate-100 rounded overflow-hidden">
          {segments.map((s, i) => (
            <div
              key={i}
              className="absolute top-0 h-6 rounded"
              style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.color }}
            />
          ))}
        </div>

        <div className="mt-3 flex justify-between text-xs text-slate-400">
          {hours.map((h) => (
            <div key={h}>{h}:00</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Profile, Donut, LeaveSummary */

function ProfileCard({ p }) {
  const initials = (p?.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="bg-white rounded-md shadow">
      <div className="bg-slate-900 text-white rounded-t-md px-5 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center font-semibold">
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{p?.name || "Stephan Peralt"}</div>
          <div className="text-sm text-slate-200">{p?.title || "Senior Product Designer"}</div>
        </div>
        <button className="bg-slate-800/60 rounded p-1 text-slate-200 text-sm">✎</button>
      </div>

      <div className="p-5 text-sm text-slate-700 space-y-4">
        <div>
          <div className="text-xs text-slate-400">Phone Number</div>
          <div className="font-medium">{p?.phone || "+1 324 3453 545"}</div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Email Address</div>
          <div className="font-medium">{p?.email || "steperde124@example.com"}</div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Report Office</div>
          <div className="font-medium">{p?.report_office || "Douglas Martini"}</div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Joined on</div>
          <div className="font-medium">{p?.joinedOn || "15 Jan 2024"}</div>
        </div>
      </div>
    </div>
  );
}

function LeaveDonut({ data = [] }) {
  return (
    <div className="bg-white rounded-md shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-800">Leave Details</div>
        </div>
        <div className="text-xs text-slate-400">2024</div>
      </div>

      <div className="flex gap-6">
        <div style={{ width: 180, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={4}>
                {data.map((d, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1">
          <ul className="space-y-2 text-sm">
            {data.map((d, i) => (
              <li key={d.name + i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-slate-700">{d.name}</span>
                </div>
                <div className="text-slate-500">{d.value}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-slate-400">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="rounded border-slate-300" /> Better than 85% of Employees
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaveSummary({ s = {} }) {
  return (
    <div className="bg-white rounded-md shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-slate-800">Leave Details</div>
        <div className="text-xs text-slate-400">2024</div>
      </div>

      <div className="text-sm text-slate-700 space-y-3">
        <div className="flex justify-between"><div>Total Leaves</div><div className="font-semibold">{s.total}</div></div>
        <div className="flex justify-between"><div>Taken</div><div className="font-semibold">{s.taken}</div></div>
        <div className="flex justify-between"><div>Absent</div><div className="font-semibold">{s.absent}</div></div>
        <div className="flex justify-between"><div>Request</div><div className="font-semibold">{s.request}</div></div>
        <div className="flex justify-between"><div>Worked Days</div><div className="font-semibold">{s.workedDays}</div></div>
        <div className="flex justify-between"><div>Loss of Pay</div><div className="font-semibold">{s.lossOfPay}</div></div>

        <div className="mt-3">
          <button className="w-full bg-slate-900 text-white py-2 rounded">Apply New Leave</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   Tasks and Notifications
   ------------------------- */

function TasksCard({ tasks = [] }) {
  return (
    <div className="bg-white rounded-md shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Tasks</h3>
        <div className="text-sm text-slate-400">All Projects ▾</div>
      </div>

      <div className="space-y-3">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between border rounded p-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded border flex items-center justify-center text-slate-400 cursor-grab">⋮</div>
              <input type="checkbox" className="form-checkbox h-4 w-4" checked={!!t.checked} readOnly />
              <div className="ml-2">
                <div className={`font-medium ${t.completed ? "line-through text-slate-400" : ""}`}>{t.title}</div>
                <div className="text-xs text-slate-400">{t.project}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`text-xs px-2 py-1 rounded-full ${t.status === "Onhold" ? "bg-pink-100 text-pink-600" : t.status === "Inprogress" ? "bg-violet-100 text-violet-600" : t.status === "Completed" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600"}`}>
                {t.status}
              </div>

              <div className="flex -space-x-2">
                {(t.assignees || []).map((a, i) => (
                  <img key={i} src={a.avatar} alt={a.name} className="w-7 h-7 rounded-full border-2 border-white" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsCard({ notifications = [] }) {
  return (
    <div className="bg-white rounded-md shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Notifications</h3>
        <button className="text-xs bg-slate-100 px-3 py-1 rounded">View All</button>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 p-2">
            <img src={n.avatar} alt={n.title} className="w-9 h-9 rounded-full" />
            <div className="flex-1">
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-slate-400">{n.time}</div>
              {n.file && <div className="text-xs text-slate-500 mt-2">{n.file}</div>}
              {n.actions && (
                <div className="mt-2 flex gap-2">
                  <button className="text-sm bg-orange-600 text-white px-3 py-1 rounded">Approve</button>
                  <button className="text-sm border border-slate-300 px-3 py-1 rounded">Decline</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------
   Main StaffDashboard
   ------------------------- */

export default function StaffDashboard() {
  const ctx = useOutletContext() || {};
  const userFromOutlet = ctx.user || null;

  const [profile, setProfile] = useState(null);
  const [donutData, setDonutData] = useState([]);
  const [summary, setSummary] = useState({});
  const [attendance, setAttendance] = useState({ total: "5:45:32", percent: 68, production: "3.45 hrs", punchIn: "10:00 AM", punched: true });
  const [kpis, setKpis] = useState([]);
  const [segments, setSegments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      try {
        const [pRes, lRes, aRes, tRes, nRes] = await Promise.allSettled([
          axios.get("/api/profile"),
          axios.get("/api/my/leaves"),
          axios.get("/api/my/attendance"),
          axios.get("/api/tasks"),
          axios.get("/api/notifications"),
        ]);

        if (!mounted) return;

        // profile
        if (pRes.status === "fulfilled") setProfile(pRes.value.data.profile || userFromOutlet);
        else setProfile(userFromOutlet || { name: "Stephan Peralt", title: "Senior Product Designer", phone: "+1 324 3453 545", email: "steperde124@example.com", report_office: "Douglas Martini", joinedOn: "15 Jan 2024" });

        // leaves
        if (lRes.status === "fulfilled") {
          const d = lRes.value.data || {};
          setDonutData(d.breakdown || [
            { name: "On time", value: 1254 },
            { name: "Late Attendance", value: 32 },
            { name: "Work From Home", value: 658 },
            { name: "Absent", value: 14 },
            { name: "Sick Leave", value: 68 },
          ]);
          setSummary(d.summary || { total: 16, taken: 10, absent: 2, request: 0, workedDays: 240, lossOfPay: 2 });
        } else {
          setDonutData([
            { name: "On time", value: 1254 },
            { name: "Late Attendance", value: 32 },
            { name: "Work From Home", value: 658 },
            { name: "Absent", value: 14 },
            { name: "Sick Leave", value: 68 },
          ]);
          setSummary({ total: 16, taken: 10, absent: 2, request: 0, workedDays: 240, lossOfPay: 2 });
        }

        // attendance & kpis & segments
        if (aRes.status === "fulfilled") {
          const b = aRes.value.data || {};
          setAttendance({
            total: b.totalHoursStr || "5:45:32",
            percent: b.percent || 68,
            production: b.productionHours || "3.45 hrs",
            punchIn: b.punchIn || "10:00 AM",
            punched: b.punched === undefined ? true : b.punched,
          });
          setKpis(b.kpis || [
            { title: "Total Hours Today", big: "8.36 / 9", meta: "5% This Week", color: "#fb923c" },
            { title: "Total Hours Week", big: "10 / 40", meta: "7% Last Week", color: "#111827" },
            { title: "Total Hours Month", big: "75 / 98", meta: "8% Last Month", color: "#60a5fa" },
            { title: "Overtime this Month", big: "16 / 28", meta: "6% Last Month", color: "#ec4899" },
          ]);
          setSegments(b.timelineSegments || [
            { left: 8, width: 18, color: "#10b981" },
            { left: 28, width: 5, color: "#f59e0b" },
            { left: 34, width: 32, color: "#10b981" },
            { left: 69, width: 8, color: "#f59e0b" },
            { left: 78, width: 18, color: "#10b981" },
            { left: 97, width: 3, color: "#60a5fa" },
          ]);
        } else {
          setKpis([
            { title: "Total Hours Today", big: "8.36 / 9", meta: "5% This Week", color: "#fb923c" },
            { title: "Total Hours Week", big: "10 / 40", meta: "7% Last Week", color: "#111827" },
            { title: "Total Hours Month", big: "75 / 98", meta: "8% Last Month", color: "#60a5fa" },
            { title: "Overtime this Month", big: "16 / 28", meta: "6% Last Month", color: "#ec4899" },
          ]);
          setSegments([
            { left: 8, width: 18, color: "#10b981" },
            { left: 28, width: 5, color: "#f59e0b" },
            { left: 34, width: 32, color: "#10b981" },
            { left: 69, width: 8, color: "#f59e0b" },
            { left: 78, width: 18, color: "#10b981" },
            { left: 97, width: 3, color: "#60a5fa" },
          ]);
        }

        // tasks
        if (tRes.status === "fulfilled") {
          setTasks(tRes.value.data.tasks || tRes.value.data || []);
        } else {
          // demo tasks fallback (matches screenshot structure)
          setTasks([
            { id: 1, title: "Patient appointment booking", project: "Booking", status: "Onhold", assignees: [{ avatar: "https://i.pravatar.cc/40?img=1" }, { avatar: "https://i.pravatar.cc/40?img=2" }], checked: false },
            { id: 2, title: "Appointment booking with payment", project: "Booking", status: "Inprogress", assignees: [{ avatar: "https://i.pravatar.cc/40?img=3" }], checked: false },
            { id: 3, title: "Patient and Doctor video conferencing", project: "Video", status: "Completed", assignees: [{ avatar: "https://i.pravatar.cc/40?img=4" }], checked: false },
            { id: 4, title: "Private chat module", project: "Chat", status: "Pending", assignees: [{ avatar: "https://i.pravatar.cc/40?img=5" }], checked: true, completed: true },
            { id: 5, title: "Go-Live and Post-Implementation Support", project: "Support", status: "Inprogress", assignees: [{ avatar: "https://i.pravatar.cc/40?img=6" }], checked: false },
          ]);
        }

        // notifications
        if (nRes.status === "fulfilled") {
          setNotifications(nRes.value.data.notifications || nRes.value.data || []);
        } else {
          setNotifications([
            { id: 1, avatar: "https://i.pravatar.cc/40?img=7", title: "Lex Murphy requested access to UNIX", time: "Today at 9:42 AM", file: "EY_review.pdf", actions: false },
            { id: 2, avatar: "https://i.pravatar.cc/40?img=8", title: "Lex Murphy requested access to UNIX", time: "Today at 10:00 AM", actions: false },
            { id: 3, avatar: "https://i.pravatar.cc/40?img=9", title: "Lex Murphy requested access to UNIX", time: "Today at 10:50 AM", actions: true },
            { id: 4, avatar: "https://i.pravatar.cc/40?img=10", title: "Lex Murphy requested access to UNIX", time: "Today at 12:00 PM", actions: false },
            { id: 5, avatar: "https://i.pravatar.cc/40?img=11", title: "Lex Murphy requested access to UNIX", time: "Today at 05:00 PM", actions: false },
          ]);
        }
      } catch (err) {
        /* ignore - fallbacks used */
      }
    }

    loadAll();
    return () => {
      mounted = false;
    };
  }, [userFromOutlet]);

  const [punchBusy, setPunchBusy] = useState(false);
  const togglePunch = async () => {
    setPunchBusy(true);
    try {
      // wire to real punch endpoint if available
      setTimeout(() => {
        setAttendance((a) => ({ ...a, punched: !a.punched }));
        setPunchBusy(false);
      }, 600);
    } catch {
      setPunchBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <StaffSidebar user={userFromOutlet} />

      <main className="flex-1 p-6">
        <div className="max-w-9xl mx-auto space-y-6">
          {/* Top row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ProfileCard p={profile || userFromOutlet} />
            <LeaveDonut data={donutData} />
            <LeaveSummary s={summary} />
          </div>

          {/* Main row: Attendance (left) / KPIs + timeline (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5">
              <div className="bg-white rounded-md shadow-sm border-2 border-orange-300 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-center mb-6">
                    <div className="text-xs text-slate-500">Attendance</div>
                    <div className="text-2xl font-bold mt-2">08:35 AM, {new Date().toLocaleDateString()}</div>
                  </div>

                  <div className="flex items-center gap-6">
                    <LargeCircle valueStr={attendance.total} percent={attendance.percent} />
                  </div>

                  <div className="mt-6 text-center">
                    <div className="inline-block bg-slate-900 text-white text-sm px-3 py-1 rounded">Production : {attendance.production}</div>
                  </div>

                  <div className="mt-3 text-center text-orange-600">🔔 Punch In at {attendance.punchIn}</div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={togglePunch}
                    disabled={punchBusy}
                    className="w-full px-6 py-3 rounded bg-orange-600 text-white text-lg font-medium"
                  >
                    {punchBusy ? "..." : attendance.punched ? "Punch Out" : "Punch In"}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-2 gap-4">
                <KPI color={kpis[0]?.color} title={kpis[0]?.title} value={kpis[0]?.big} note={kpis[0]?.meta} />
                <KPI color={kpis[1]?.color} title={kpis[1]?.title} value={kpis[1]?.big} note={kpis[1]?.meta} />
                <KPI color={kpis[2]?.color} title={kpis[2]?.title} value={kpis[2]?.big} note={kpis[2]?.meta} />
                <KPI color={kpis[3]?.color} title={kpis[3]?.title} value={kpis[3]?.big} note={kpis[3]?.meta} />
              </div>

              <Timeline segments={segments} />
            </div>
          </div>

          {/* NEW: Tasks and Notifications in 2-column grid (2 per row) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TasksCard tasks={tasks} />
            <NotificationsCard notifications={notifications} />
          </div>
        </div>
      </main>
    </div>
  );
}
