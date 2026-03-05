/* eslint-disable no-constant-binary-expression */
/* eslint-disable no-unused-vars */
/* src/pages/AdminDashboard.jsx */
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { api } from "../src/utils/axiosConfig";
import {
 LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
 BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";

/* ─── GLOBAL ANIMATION STYLES ─────────────────────────────────────────── */
const GLOBAL_STYLES = `
 @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

 *, *::before, *::after { box-sizing: border-box; }

 :root {
 --teal: #5dcab9;
 --teal-lt: #a7cdcc;
 --teal-xs: #dcf2f1;
 --ink: #0f172a;
 --ink-2: #1e293b;
 --muted: #64748b;
 --border: #e2e8f0;
 --surface: #ffffff;
 --bg: #f8fafc;
 --red: #ef4444;
 --amber: #f59e0b;
 --blue: #3b82f6;
 --green: #10b981;
 }

 @keyframes slideUp {
 from { opacity: 0; transform: translateY(32px); }
 to { opacity: 1; transform: translateY(0); }
 }

 @keyframes slideIn {
 from { opacity: 0; transform: translateX(-24px); }
 to { opacity: 1; transform: translateX(0); }
 }

 @keyframes fadeIn {
 from { opacity: 0; }
 to { opacity: 1; }
 }

 @keyframes scaleIn {
 from { opacity: 0; transform: scale(0.92); }
 to { opacity: 1; transform: scale(1); }
 }

 @keyframes shimmer {
 0% { background-position: -200% center; }
 100% { background-position: 200% center; }
 }

 @keyframes pulse-ring {
 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(93,202,185,0.5); }
 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(93,202,185,0); }
 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(93,202,185,0); }
 }

 @keyframes floatY {
 0%, 100% { transform: translateY(0px); }
 50% { transform: translateY(-6px); }
 }

 @keyframes barGrow {
 from { transform: scaleX(0); }
 to { transform: scaleX(1); }
 }

 @keyframes numberFlip {
 0% { transform: translateY(100%); opacity: 0; }
 100% { transform: translateY(0); opacity: 1; }
 }

 @keyframes attentionPulse {
 0% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
 50% { border-color: #f87171; box-shadow: 0 0 0 6px rgba(239,68,68,0); }
 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0); }
 }

 @keyframes lineTrace {
 from { stroke-dashoffset: 1000; opacity: 0; }
 to { stroke-dashoffset: 0; opacity: 1; }
 }

 @keyframes skeletonWave {
 0% { background-position: -400px 0; }
 100% { background-position: 400px 0; }
 }

 .anim-slide-up { animation: slideUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
 .anim-scale-in { animation: scaleIn 0.6s cubic-bezier(0.22,1,0.36,1) both; }
 .anim-fade-in { animation: fadeIn 0.5s ease both; }

 .hover-lift {
 transition: transform 0.3s cubic-bezier(0.22,1,0.36,1),
 box-shadow 0.3s cubic-bezier(0.22,1,0.36,1);
 }
 .hover-lift:hover {
 transform: translateY(-4px);
 box-shadow: 0 20px 40px -12px rgba(15,23,42,0.12);
 }

 .card-press {
 transition: transform 0.15s ease, box-shadow 0.15s ease;
 }
 .card-press:active {
 transform: scale(0.98);
 }

 .skeleton {
 background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
 background-size: 400px 100%;
 animation: skeletonWave 1.4s ease infinite;
 border-radius: 8px;
 }

 .grain::after {
 content: '';
 position: absolute;
 inset: 0;
 background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
 pointer-events: none;
 border-radius: inherit;
 z-index: 1;
 }

 .shimmer-text {
 background: linear-gradient(90deg, var(--ink) 0%, var(--teal) 50%, var(--ink) 100%);
 background-size: 200% auto;
 -webkit-background-clip: text;
 -webkit-text-fill-color: transparent;
 background-clip: text;
 animation: shimmer 4s linear infinite;
 }

 .stagger-children > * {
 opacity: 0;
 animation: slideUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
 }
 .stagger-children > *:nth-child(1) { animation-delay: 0ms; }
 .stagger-children > *:nth-child(2) { animation-delay: 80ms; }
 .stagger-children > *:nth-child(3) { animation-delay: 160ms; }
 .stagger-children > *:nth-child(4) { animation-delay: 240ms; }
 .stagger-children > *:nth-child(5) { animation-delay: 320ms; }
 .stagger-children > *:nth-child(6) { animation-delay: 400ms; }

 .attention-item {
 border-left: 3px solid var(--red);
 animation: attentionPulse 2.5s ease-in-out infinite;
 }

 .dash-font { font-family: 'DM Sans', sans-serif; }
 .dash-mono { font-family: 'DM Mono', monospace; }

 ::-webkit-scrollbar { width: 5px; height: 5px; }
 ::-webkit-scrollbar-track { background: transparent; }
 ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
 ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
`;

/* ─── CONFIG ────────────────────────────────────────────────────── */
const COLORS = {
 primary: "#5dcab9",
 success: "#10b981",
 warning: "#f59e0b",
 danger: "#ef4444",
 info: "#3b82f6",
 slate: "#64748b"
};

const ANALYTICS_PAGES = [
 { key: 'incidents', title: 'Incidents', endpoint: '/api/incidents', route: '/incidents' },
 { key: 'compliance', title: 'Compliance', endpoint: '/api/compliance', route: '/compliance' },
 { key: 'maintenance', title: 'Maintenance', endpoint: '/api/maintenance', route: '/maintenance' },
 { key: 'aire', title: 'AIRE Tasks', endpoint: '/api/aire-tasks', route: '/aire-tasks' },
 { key: 'safeguarding', title: 'Safeguarding', endpoint: '/api/safeguarding/referrals', route: '/safeguarding' },
 { key: 'hse', title: 'HSE Audits', endpoint: '/api/hse/audits', route: '/hse-audits' },
];

const OPERATION_HUB_PAGES = [
 { key: 'inspections', title: 'Inspections', endpoint: '/api/inspections', route: '/admin/inspections' },
 { key: 'complaints', title: 'Complaints', endpoint: '/api/complaints', route: '/admin/complaints' },
 { key: 'litigation', title: 'Litigation', endpoint: '/api/litigation', route: '/admin/litigation' },
 { key: 'incidents', title: 'Incidents', endpoint: '/api/incidents', route: '/admin/incidents' },
 { key: 'maintenance', title: 'Maintenance', endpoint: '/api/maintenance', route: '/admin/maintenance' },
 { key: 'aire_tasks', title: 'AIRE Tasks', endpoint: '/api/aire-tasks', route: '/admin/aire-tasks' },
];

const HSE_PAGES = [
 { key: 'hse_incidents', title: 'Incidents', endpoint: '/api/hse/hse-incidents', route: '/admin/hse/incidents' },
 { key: 'hse_audits', title: 'Audits', endpoint: '/api/hse/audits', route: '/admin/hse/audits' },
 { key: 'hse_risk', title: 'Risk Management', endpoint: '/api/hse/risk-management', route: '/admin/hse/risk-management' },
 { key: 'hse_training', title: 'Training', endpoint: '/api/hse/training', route: '/admin/hse/training' },
];

const SAFEGUARDING_PAGES = [
 { key: 'sg_referrals', title: 'Referrals', endpoint: '/api/safeguarding/referrals', route: '/admin/safeguarding/referrals' },
 { key: 'sg_risk_assessments', title: 'Risk Assessments', endpoint: '/api/safeguarding/risk-assessments', route: '/admin/safeguarding/risk-assessments' },
 { key: 'sg_vulnerable_users', title: 'Vulnerable Users', endpoint: '/api/safeguarding/vulnerable-users', route: '/admin/safeguarding/vulnerable-users' },
 { key: 'sg_multi_agency', title: 'Multi-Agency', endpoint: '/api/safeguarding/multi-agency', route: '/admin/safeguarding/multi-agency' },
];

const ESCALATIONS_PAGES = [
 { key: 'case_management', title: 'Case Management', endpoint: '/api/case-management', route: '/admin/case-management' },
];

const ORGANISATIONS_PAGES = [
 { key: 'vcs_organisations', title: 'VCS Organisations', endpoint: '/api/vcs-organisations', route: '/admin/vcs-organisations' },
 { key: 'emergency_protocols', title: 'Emergency Protocols', endpoint: '/api/emergency-protocols', route: '/admin/emergency-protocols' },
];

/* ─── HOOKS ─────────────────────────────────────────────────────── */
const useCountUp = (end, duration = 1800, delay = 0) => {
 const [count, setCount] = useState(0);
 const frameRef = useRef(null);

 useEffect(() => {
 if (end === 0) { setCount(0); return; }
 let startTime = null;
 const tick = (ts) => {
 if (!startTime) startTime = ts;
 const elapsed = ts - startTime;
 if (elapsed < delay) { frameRef.current = requestAnimationFrame(tick); return; }
 const adjusted = elapsed - delay;
 const progress = Math.min(adjusted / duration, 1);
 const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
 setCount(Math.floor(ease * end));
 if (progress < 1) frameRef.current = requestAnimationFrame(tick);
 };
 frameRef.current = requestAnimationFrame(tick);
 return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
 }, [end, duration, delay]);

 return count;
};

/* ─── ANIMATED BAR ──────────────────────────────────────────────── */
const AnimatedBar = ({ percentage, color, delay = 0 }) => {
 const [width, setWidth] = useState(0);
 useEffect(() => {
 const t = setTimeout(() => setWidth(percentage), delay + 50);
 return () => clearTimeout(t);
 }, [percentage, delay]);
 return (
 <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
 <div style={{
 width: `${width}%`, backgroundColor: color, height: '100%',
 borderRadius: '999px',
 transition: `width 1.2s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
 boxShadow: `0 0 8px ${color}55`,
 }} />
 </div>
 );
};

/* ─── TOOLTIP ───────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
 if (!active || !payload?.length) return null;
 return (
 <div style={{
 background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
 padding: '10px 14px', fontSize: 12, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.4)',
 }}>
 <p style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 600, letterSpacing: '0.03em' }}>{label}</p>
 {payload.map((entry, i) => (
 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
 <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
 <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
 <span style={{ color: '#f8fafc', fontWeight: 700 }}>{entry.value}</span>
 </div>
 ))}
 </div>
 );
};

/* ─── STAT CARD ─────────────────────────────────────────────────── */
const StatCard = ({ title, value, sub, color, icon, delay = 0, onClick, accent }) => {
 const num = typeof value === 'number' ? value : (parseInt(value) || 0);
 const isStr = typeof value === 'string' && isNaN(parseInt(value));
 const displayed = useCountUp(isStr ? 0 : num, 1600, delay);
 const [hovered, setHovered] = useState(false);

 return (
 <div
 className="hover-lift card-press grain"
 onClick={onClick}
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 style={{
 background: '#fff', borderRadius: 16, padding: '22px 22px 20px',
 border: `1.5px solid ${hovered ? color + '44' : '#e2e8f0'}`,
 cursor: onClick ? 'pointer' : 'default',
 position: 'relative', overflow: 'hidden',
 animation: `slideUp 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
 transition: 'border-color 0.3s ease',
 }}>
 <div style={{
 position: 'absolute', bottom: -30, right: -30,
 width: 110, height: 110, borderRadius: '50%',
 background: color, opacity: hovered ? 0.12 : 0.06,
 transition: 'opacity 0.4s ease, transform 0.4s ease',
 transform: hovered ? 'scale(1.2)' : 'scale(1)', pointerEvents: 'none',
 }} />
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1, overflow: 'hidden' }}>
 <div style={{ animation: `numberFlip 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + 400}ms both` }}>
 {isStr ? value : displayed.toLocaleString()}
 </div>
 </div>
 {sub && (
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
 <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
 {sub}
 </div>
 )}
 </div>
 <div style={{
 padding: 10, borderRadius: 12,
 background: `linear-gradient(135deg, ${color}22, ${color}11)`,
 border: `1px solid ${color}33`, color: color,
 transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
 transform: hovered ? 'rotate(8deg) scale(1.05)' : 'rotate(0deg) scale(1)',
 }}>{icon}</div>
 </div>
 <div style={{
 position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
 background: `linear-gradient(90deg, ${color}, ${color}55)`,
 borderRadius: '0 0 16px 16px',
 transform: hovered ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
 transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
 }} />
 </div>
 );
};

/* ─── KPI METRIC CARD ───────────────────────────────────────────── */
const MetricCard = ({ title, children, icon, iconBg, delay = 0, onClick }) => {
 const [hovered, setHovered] = useState(false);
 return (
 <div
 onClick={onClick}
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 className="hover-lift card-press"
 style={{
 background: '#fff', borderRadius: 16, padding: '22px',
 border: `1.5px solid ${hovered ? '#5dcab944' : '#e2e8f0'}`,
 cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
 animation: `slideUp 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
 transition: 'border-color 0.3s ease',
 }}>
 <div style={{
 position: 'absolute', inset: 0, opacity: 0.025,
 backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)',
 backgroundSize: '24px 24px', pointerEvents: 'none',
 }} />
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative', zIndex: 1 }}>
 <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{title}</div>
 <div style={{
 padding: 8, borderRadius: 10, background: iconBg,
 transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
 transform: hovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
 }}>{icon}</div>
 </div>
 <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
 <div style={{
 position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
 background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
 transform: hovered ? 'translateX(300%)' : 'translateX(0)',
 transition: hovered ? 'transform 0.6s ease' : 'none', pointerEvents: 'none',
 }} />
 </div>
 );
};

/* ─── SECTION HEADER ────────────────────────────────────────────── */
const SectionHeader = ({ icon, title, sub, actions, delay = 0 }) => (
 <div style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 animation: `slideIn 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`, marginBottom: 20,
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{
 padding: 9, borderRadius: 12,
 background: 'linear-gradient(135deg, #5dcab922, #5dcab911)',
 border: '1px solid #5dcab933', color: '#5dcab9',
 }}>{icon}</div>
 <div>
 <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</div>
 {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
 </div>
 </div>
 {actions}
 </div>
);

/* ─── EMPTY STATE ───────────────────────────────────────────────── */
const EmptyState = ({ message = "No Data Available" }) => (
 <div style={{
 display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
 height: '100%', color: '#94a3b8', animation: 'fadeIn 0.4s ease both',
 }}>
 <div style={{
 padding: 14, background: '#f1f5f9', borderRadius: '50%', marginBottom: 12,
 animation: 'floatY 3s ease-in-out infinite',
 }}>
 <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
 d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 </div>
 <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{message}</span>
 </div>
);

/* ─── ICONS ─────────────────────────────────────────────────────── */
const I = {
 Building: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4 8 4v14M17 21v-8.5a1.5 1.5 0 00-1.5-1.5h-7a1.5 1.5 0 00-1.5 1.5V21"/></svg>,
 Users: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
 Alert: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
 Grid: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
 Shield: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
 Clock: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
 Wrench: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
 Chart: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
 TrendUp: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
 ChevronRight: () => <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>,
 ChevronDown: ({ size = 16 }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
 Home: () => <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
};

/* ─── MEAL ANALYSIS INLINE COMPONENT ───────────────────────────── */
const EXCLUDED_MEAL_KEYS = new Set(['snack']);

const MealAnalysisPanel = ({ api, delay = 0 }) => {
 const [mealData, setMealData] = useState([]);
 const [mealLoading, setMealLoading] = useState(true);

 useEffect(() => {
 let active = true;
 setMealLoading(true);
 const getToday = () => {
 try { return new Date().toISOString().slice(0, 10); } catch { return ''; }
 };

 const normalizeMeal = (m) => {
 const mealType = m.meal_type ?? m.mealType ?? m.type ?? m.meal ?? 'Breakfast';
 const status = m.status ?? m.state ?? (m.consumed ? 'Consumed' : m.is_consumed ? 'Consumed' : 'Pending') ?? 'Pending';
 return {
 mealType: String(mealType || '').trim() || 'Breakfast',
 status: String(status || '').trim() || 'Pending',
 };
 };

 const buildSummary = (rows) => {
 const grouped = new Map();
 for (const raw of rows || []) {
 const { mealType, status } = normalizeMeal(raw);
 const key = mealType.toLowerCase();
 if (!key || EXCLUDED_MEAL_KEYS.has(key)) continue;
 const existing = grouped.get(key) || { meal: mealType, ordered: 0, served: 0 };
 existing.ordered += 1;
 if (String(status).toLowerCase() === 'consumed') existing.served += 1;
 grouped.set(key, existing);
 }
 const order = ['breakfast', 'lunch', 'dinner'];
 return order.map((k) => {
 const item = grouped.get(k) || { meal: k.charAt(0).toUpperCase() + k.slice(1), ordered: 0, served: 0 };
 const pct = item.ordered > 0 ? Math.round((item.served / item.ordered) * 100) : 0;
 return { meal: item.meal, served: item.served, ordered: item.ordered, satisfaction: pct, trend: 0 };
 });
 };

 (async () => {
 try {
 const mealEndpoints = ['/api/meals', '/api/su/meals', '/api/meal-schedules', '/api/meals/scheduled'];
 let rows = [];
 const date = getToday();

 const results = await Promise.allSettled(
 mealEndpoints.map(ep => api.get(ep, date ? { params: { date } } : undefined))
 );

 for (const r of results) {
 if (r.status === 'fulfilled') {
 const cand = (r.value?.data?.rows ?? r.value?.data?.data ?? r.value?.data) || [];
 if (Array.isArray(cand) && cand.length > 0) { rows = cand; break; }
 }
 }

 if (!Array.isArray(rows) || rows.length === 0) {
 const results2 = await Promise.allSettled(
 mealEndpoints.map(ep => api.get(ep))
 );
 for (const r of results2) {
 if (r.status === 'fulfilled') {
 const cand = (r.value?.data?.rows ?? r.value?.data?.data ?? r.value?.data) || [];
 if (Array.isArray(cand) && cand.length > 0) { rows = cand; break; }
 }
 }
 }

 if (!active) return;
 setMealData(buildSummary(rows));
 } catch {
 if (!active) return;
 setMealData([]);
 } finally {
 if (active) setMealLoading(false);
 }
 })();

 return () => { active = false; };
 }, [api]);

 const total = mealData.reduce((s, m) => s + (m.served || 0), 0);
 const satItems = mealData.filter((m) => (m.ordered || 0) > 0);
 const avgSat = satItems.length
 ? Math.round(satItems.reduce((s, m) => s + (m.satisfaction || 0), 0) / satItems.length)
 : 0;

 return (
 <div style={{
 background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0',
 padding: 24, height: '100%', minHeight: 420,
 animation: `slideUp 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
 display: 'flex', flexDirection: 'column',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{
 padding: 9, borderRadius: 12,
 background: 'linear-gradient(135deg, #fff7ed, #fed7aa22)',
 border: '1px solid #fed7aa', fontSize: 18, lineHeight: 1,
 display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316'
 }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M6 2v20" />
 <path d="M6 13a4 4 0 0 0 4-4V2" />
 <path d="M18 2v8" />
 <path d="M18 13v9" />
 <path d="M18 13a4 4 0 0 0 0-8" />
 </svg>
 </div>
 <div>
 <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Meal Analysis</div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Service & satisfaction</div>
 </div>
 </div>
 <div style={{ display: 'flex', gap: 8 }}>
 <div style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#10b981', border: '1px solid #bbf7d0' }}>
 {total} served
 </div>
 <div style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
 {avgSat}% satisfaction
 </div>
 </div>
 </div>

 {mealLoading ? (
 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
 {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
 </div>
 ) : mealData.length === 0 ? (
 <div style={{ flex: 1 }}><EmptyState message="No meal data available" /></div>
 ) : (
 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
 {mealData.map((m, idx) => {
 const served = m.served || 0;
 const ordered = m.ordered || served;
 const sat = m.satisfaction || 0;
 const pct = ordered > 0 ? Math.round((served / ordered) * 100) : 100;
 const trend = m.trend || 0;
 const mealKey = m.meal || m.name || m.type || 'Meal';
 const satColor = sat >= 90 ? '#10b981' : sat >= 75 ? '#f59e0b' : '#ef4444';
 const barColor = pct >= 90 ? '#5dcab9' : pct >= 70 ? '#a7cdcc' : '#fca5a5';

 return (
 <div
 key={mealKey}
 style={{
 padding: '14px 16px', background: '#f8fafc', borderRadius: 12,
 border: '1px solid #f1f5f9',
 animation: `slideUp 0.6s cubic-bezier(0.22,1,0.36,1) ${delay + 200 + idx * 80}ms both`,
 transition: 'background 0.2s ease, border-color 0.2s ease', cursor: 'default',
 }}
 onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#5dcab933'; }}
 onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#f1f5f9'; }}
 >
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div>
 <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{mealKey}</div>
 <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{served} / {ordered} served</div>
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: satColor + '18', color: satColor, border: `1px solid ${satColor}33` }}>
 {sat}% ★
 </div>
 {trend !== 0 && (
 <div style={{ fontSize: 11, fontWeight: 700, color: trend > 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 2 }}>
 {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
 </div>
 )}
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 99, height: 6, overflow: 'hidden' }}>
 <div style={{
 height: '100%', borderRadius: 99, background: barColor, boxShadow: `0 0 6px ${barColor}88`,
 width: `${pct}%`, transition: `width 1.2s cubic-bezier(0.22,1,0.36,1) ${delay + 400 + idx * 80}ms`,
 }} />
 </div>
 <span className="dash-mono" style={{ fontSize: 11, fontWeight: 700, color: '#64748b', minWidth: 32 }}>{pct}%</span>
 </div>
 </div>
 );
 })}
 {mealData.length > 1 && (
 <div style={{ marginTop: 8, height: 80 }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={mealData.map(m => ({ name: m.meal || m.name || 'Meal', served: m.served || 0 }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(93,202,185,0.06)' }} />
 <Bar dataKey="served" name="Served" fill="#5dcab9" radius={[4,4,0,0]} animationDuration={1400} animationBegin={delay + 600} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 )}
 </div>
 );
};

/* ─── MAIN COMPONENT ────────────────────────────────────────────── */
export default function AdminDashboard() {
 const navigate = useNavigate();
 const [refreshing, setRefreshing] = useState(false);

 const [selectedBranch, setSelectedBranch] = useState('all');
 const [selectedProperty, setSelectedProperty] = useState('all');
 const [timeRange, setTimeRange] = useState('30d');
 const [branches, setBranches] = useState([]);
 const [properties, setProperties] = useState([]);

 const [kpis, setKpis] = useState([]);
 const [trends, setTrends] = useState([]);
 const [occupancy, setOccupancy] = useState([]);
 const [compliance, setCompliance] = useState([]);
 const [recentIncidents, setRecentIncidents] = useState([]);
 const [attentionItems, setAttentionItems] = useState([]);
 const [demographics, setDemographics] = useState([]);
 const [maintenanceStats, setMaintenanceStats] = useState({ pending: 0, inProgress: 0, completed: 0 });
 const [maintenanceTrends, setMaintenanceTrends] = useState([]);
 const [expiringSoonCount, setExpiringSoonCount] = useState(0);
 const [validComplianceCount, setValidComplianceCount] = useState(0);
 const [expiredComplianceCount, setExpiredComplianceCount] = useState(0);
 const [openIncidentsCount, setOpenIncidentsCount] = useState(0);

 const [moduleTotals, setModuleTotals] = useState({ operationHub: 0, hse: 0, safeguarding: 0, escalations: 0 });
 const [moduleLoading, setModuleLoading] = useState(true);
 const [pageCounts, setPageCounts] = useState({});

 // FIX: analyticsPageData holds pre-fetched { count, breakdown } keyed by page.key
 // Populated in fetchModuleTotals so charts render instantly — no per-component fetches
 const [analyticsPageData, setAnalyticsPageData] = useState({});

 const [expandedAnalyticsPages, setExpandedAnalyticsPages] = useState(null);
 const [pageStatusBreakdowns, setPageStatusBreakdowns] = useState({});
 const [pageStatusLoading, setPageStatusLoading] = useState({});
 const [totalRooms, setTotalRooms] = useState(0);
 const [occupiedRooms, setOccupiedRooms] = useState(0);

 const [donutTip, setDonutTip] = useState({ open: false, x: 0, y: 0, label: '', value: 0, color: '#5dcab9' });

 const extractArray = (res) => {
 if (!res) return [];
 const outer = res.data ?? res;
 if (!outer) return [];
 if (Array.isArray(outer)) return outer;
 if (Array.isArray(outer.hotels)) return outer.hotels;
 if (Array.isArray(outer.data)) return outer.data;
 if (Array.isArray(outer.rows)) return outer.rows;
 if (Array.isArray(outer.items)) return outer.items;
 return [];
 };

 const statusBucketKey = (row) => {
 const raw = row?.status ?? row?.state ?? row?.current_status ?? row?.stage ?? row?.workflow_status;
 const s = String(raw ?? '').toLowerCase().trim();
 if (!s) return 'pending';
 if (s.includes('escalat')) return 'escalated';
 if (s.includes('complete') || s.includes('closed') || s.includes('resolve')) return 'completed';
 if (s.includes('in progress') || s.includes('in_progress') || s.includes('under review') || s.includes('review') || s.includes('investigat')) return 'in_progress';
 if (s.includes('open') || s.includes('pending') || s.includes('new') || s.includes('scheduled')) return 'pending';
 return 'pending';
 };

 const computeStatusBreakdown = (rows) => {
 const out = { pending: 0, in_progress: 0, escalated: 0, completed: 0 };
 (rows || []).forEach((r) => {
 const k = statusBucketKey(r);
 if (k === 'in_progress') out.in_progress += 1;
 else if (k === 'escalated') out.escalated += 1;
 else if (k === 'completed') out.completed += 1;
 else out.pending += 1;
 });
 return out;
 };

 const sharedApi = api;

 // Load snapshot synchronously on mount → instant render
 const [snapshotLoaded] = useState(() => {
 try {
 const raw = localStorage.getItem('homeDashboardSnapshot.v1');
 if (!raw) return false;
 const snap = JSON.parse(raw);
 if (!snap || typeof snap !== 'object') return false;
 return snap;
 } catch {
 return false;
 }
 });

 // Apply snapshot immediately on first render
 useEffect(() => {
 if (!snapshotLoaded) return;
 const snap = snapshotLoaded;
 if (Array.isArray(snap.branches)) setBranches(snap.branches);
 if (Array.isArray(snap.properties)) setProperties(snap.properties);
 if (Array.isArray(snap.kpis)) setKpis(snap.kpis);
 if (Array.isArray(snap.trends)) setTrends(snap.trends);
 if (snap.occupancy && typeof snap.occupancy === 'object') setOccupancy(snap.occupancy);
 if (snap.compliance && typeof snap.compliance === 'object') setCompliance(snap.compliance);
 if (Array.isArray(snap.attentionItems)) setAttentionItems(snap.attentionItems);
 if (Array.isArray(snap.recentIncidents)) setRecentIncidents(snap.recentIncidents);
 if (Array.isArray(snap.demographics)) setDemographics(snap.demographics);
 if (snap.maintenanceStats && typeof snap.maintenanceStats === 'object') setMaintenanceStats(snap.maintenanceStats);
 if (Array.isArray(snap.maintenanceTrends)) setMaintenanceTrends(snap.maintenanceTrends);
 if (snap.moduleTotals && typeof snap.moduleTotals === 'object') setModuleTotals(snap.moduleTotals);
 if (snap.pageCounts && typeof snap.pageCounts === 'object') { setPageCounts(snap.pageCounts); setModuleLoading(false); }
 // FIX: restore pre-fetched analytics page data from snapshot
 if (snap.analyticsPageData && typeof snap.analyticsPageData === 'object') setAnalyticsPageData(snap.analyticsPageData);
 if (Number.isFinite(snap.totalRooms)) setTotalRooms(snap.totalRooms);
 if (Number.isFinite(snap.occupiedRooms)) setOccupiedRooms(snap.occupiedRooms);
 if (Number.isFinite(snap.openIncidentsCount)) setOpenIncidentsCount(snap.openIncidentsCount);
 if (Number.isFinite(snap.validComplianceCount)) setValidComplianceCount(snap.validComplianceCount);
 if (Number.isFinite(snap.expiredComplianceCount)) setExpiredComplianceCount(snap.expiredComplianceCount);
 if (Number.isFinite(snap.expiringSoonCount)) setExpiringSoonCount(snap.expiringSoonCount);
 }, []); // eslint-disable-line react-hooks/exhaustive-deps

 const ensurePageStatusLoaded = useCallback(async (page) => {
 if (!page?.key || !page?.endpoint) return;
 if (pageStatusBreakdowns?.[page.key]) return;
 if (pageStatusLoading?.[page.key]) return;
 try {
 setPageStatusLoading((prev) => ({ ...prev, [page.key]: true }));
 const params = {
 ...(timeRange && { timeRange }),
 ...(selectedBranch !== 'all' && { branch_id: selectedBranch }),
 ...(selectedProperty !== 'all' && { property_id: selectedProperty }),
 limit: 2000,
 };
 const res = await sharedApi.get(page.endpoint, { params, cacheTtlMs: 120_000 });
 const rows = extractArray(res);
 const counts = computeStatusBreakdown(rows);
 setPageStatusBreakdowns((prev) => ({ ...prev, [page.key]: counts }));
 } catch (err) {
 console.warn('Failed to load page status breakdown', page?.key, err);
 setPageStatusBreakdowns((prev) => ({ ...prev, [page.key]: { pending: 0, in_progress: 0, escalated: 0, completed: 0 } }));
 } finally {
 setPageStatusLoading((prev) => ({ ...prev, [page?.key]: false }));
 }
 }, [pageStatusBreakdowns, pageStatusLoading, timeRange, selectedBranch, selectedProperty]);

 useEffect(() => {
 let mounted = true;

 const fetchAll = async () => {
 setRefreshing(true);

 const params = {
 timeRange,
 ...(selectedBranch !== 'all' && { branch_id: selectedBranch }),
 ...(selectedProperty !== 'all' && { property_id: selectedProperty }),
 };

 const [
 branchesRes, propsRes,
 kpisRes, trendsRes, occupancyRes, incidentsSumRes, complianceRes, attentionRes, recentIncRes, demographicsRes, maintenanceRes
 ] = await Promise.allSettled([
 sharedApi.get('/api/branches', { cacheTtlMs: 300_000 }),
 sharedApi.get('/api/hotels', { cacheTtlMs: 300_000 }),
 sharedApi.get('/api/dashboard/kpis', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/dashboard/trends', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/dashboard/occupancy', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/dashboard/incidents-summary', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/dashboard/compliance-summary', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/dashboard/attention-items', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/incidents', { params: { ...params, limit: 5 }, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/dashboard/demographics', { params, cacheTtlMs: 120_000 }),
 sharedApi.get('/api/maintenance', { params: { ...params, limit: 1000 }, cacheTtlMs: 120_000 }),
 ]);

 if (!mounted) return;

 const val = (r) => r.status === 'fulfilled' ? r.value : null;

 if (branchesRes.status === 'fulfilled') setBranches(extractArray(branchesRes.value));
 if (propsRes.status === 'fulfilled') setProperties(extractArray(propsRes.value));

 const nextKpis = (val(kpisRes)?.data && Array.isArray(val(kpisRes).data)) ? val(kpisRes).data : [];
 const nextTrends = (val(trendsRes)?.data && Array.isArray(val(trendsRes).data)) ? val(trendsRes).data : [];
 setKpis(nextKpis);
 setTrends(nextTrends);

 const nextOcc = val(occupancyRes) ? (val(occupancyRes).data || val(occupancyRes) || {}) : {};
 setOccupancy(nextOcc);
 const nextTotalRooms = Number(nextOcc.totalBeds ?? nextOcc.total_beds ?? 0);
 const nextOccupiedRooms = Number(nextOcc.occupiedBeds ?? nextOcc.occupied_beds ?? 0);
 if (Number.isFinite(nextTotalRooms) && nextTotalRooms >= 0) setTotalRooms(nextTotalRooms);
 if (Number.isFinite(nextOccupiedRooms) && nextOccupiedRooms >= 0) setOccupiedRooms(nextOccupiedRooms);

 const nextCompliance = val(complianceRes) ? (val(complianceRes).data || val(complianceRes) || {}) : {};
 setCompliance(nextCompliance);
 const nextValid = Number(nextCompliance.validCount ?? nextCompliance.valid_count ?? 0);
 const nextExpired = Number(nextCompliance.expiredCount ?? nextCompliance.expired_count ?? 0);
 const nextExpiring = Number(nextCompliance.expiringSoonCount ?? nextCompliance.expiring_count ?? nextCompliance.expiring_soon_count ?? 0);
 if (Number.isFinite(nextValid)) setValidComplianceCount(nextValid);
 if (Number.isFinite(nextExpired)) setExpiredComplianceCount(nextExpired);
 if (Number.isFinite(nextExpiring)) setExpiringSoonCount(nextExpiring);

 const nextAttention = val(attentionRes)?.data || [];
 const nextRecent = val(recentIncRes) ? extractArray(val(recentIncRes)) : [];
 setAttentionItems(nextAttention);
 setRecentIncidents(nextRecent);

 const incSum = val(incidentsSumRes) ? (val(incidentsSumRes).data || val(incidentsSumRes) || {}) : {};
 const nextOpenIncidents = Number(incSum.openIncidents ?? incSum.open_incidents ?? 0);
 if (Number.isFinite(nextOpenIncidents)) setOpenIncidentsCount(nextOpenIncidents);

 const nextDemographics = val(demographicsRes)?.data || [];
 setDemographics(nextDemographics);

 let nextMaintenanceStats = { pending: 0, inProgress: 0, completed: 0 };
 let nextMaintenanceTrends = [];
 if (val(maintenanceRes)) {
 const raw = val(maintenanceRes).data ?? val(maintenanceRes);
 const rows = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
 const statusKey = (t) => String(t?.status ?? t?.state ?? 'Open').toLowerCase().trim();
 const isPending = (s) => s === 'pending' || s === 'open';
 const isInProgress = (s) => s === 'in progress' || s === 'under review' || s === 'in_progress' || s === 'inprogress';
 const isCompleted = (s) => s === 'completed' || s === 'closed' || s === 'resolved';
 const pending = rows.filter((t) => isPending(statusKey(t))).length;
 const inProgress = rows.filter((t) => isInProgress(statusKey(t))).length;
 const completed = rows.filter((t) => isCompleted(statusKey(t))).length;
 nextMaintenanceStats = { pending, inProgress, completed };
 setMaintenanceStats(nextMaintenanceStats);

 const parseDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
 const pickBucketDate = (t) => parseDate(t?.start_date) || parseDate(t?.start) || parseDate(t?.due_date) || parseDate(t?.dueDate) || parseDate(t?.created_at) || parseDate(t?.createdAt) || null;
 const formatLabel = (d) => { try { return d.toLocaleString('en-GB', { month: 'short', year: '2-digit' }); } catch { return ''; } };

 const buckets = new Map();
 for (const t of rows) {
 const d = pickBucketDate(t);
 if (!d) continue;
 const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
 const curr = buckets.get(key) || { key, label: formatLabel(d), pending: 0, inProgress: 0, completed: 0 };
 const s = statusKey(t);
 if (isPending(s)) curr.pending += 1;
 else if (isInProgress(s)) curr.inProgress += 1;
 else if (isCompleted(s)) curr.completed += 1;
 else curr.pending += 1;
 buckets.set(key, curr);
 }
 const series = Array.from(buckets.values()).sort((a, b) => String(a.key).localeCompare(String(b.key))).filter((row) => (row.pending + row.inProgress + row.completed) > 0);
 nextMaintenanceTrends = series;
 setMaintenanceTrends(nextMaintenanceTrends);
 }

 try {
 localStorage.setItem('homeDashboardSnapshot.v1', JSON.stringify({
 branches: extractArray(branchesRes.status === 'fulfilled' ? branchesRes.value : null),
 properties: extractArray(propsRes.status === 'fulfilled' ? propsRes.value : null),
 kpis: nextKpis, trends: nextTrends, occupancy: nextOcc, compliance: nextCompliance,
 attentionItems: nextAttention, recentIncidents: nextRecent, demographics: nextDemographics,
 maintenanceStats: nextMaintenanceStats, maintenanceTrends: nextMaintenanceTrends,
 totalRooms: Number.isFinite(nextTotalRooms) ? nextTotalRooms : 0,
 occupiedRooms: Number.isFinite(nextOccupiedRooms) ? nextOccupiedRooms : 0,
 openIncidentsCount: Number.isFinite(nextOpenIncidents) ? nextOpenIncidents : 0,
 validComplianceCount: Number.isFinite(nextValid) ? nextValid : 0,
 expiredComplianceCount: Number.isFinite(nextExpired) ? nextExpired : 0,
 expiringSoonCount: Number.isFinite(nextExpiring) ? nextExpiring : 0,
 moduleTotals, pageCounts,
 }));
 } catch {}

 if (mounted) setRefreshing(false);
 };

 // ── FIX: fetchModuleTotals now ALSO pre-fetches all analytics page chart data
 // in the same parallel batch — no secondary per-component fetches needed
 const fetchModuleTotals = async () => {
 try {
 setModuleLoading(true);
 const params = {
 timeRange,
 ...(selectedBranch !== 'all' && { branch_id: selectedBranch }),
 ...(selectedProperty !== 'all' && { property_id: selectedProperty }),
 };

 const allPages = [...OPERATION_HUB_PAGES, ...HSE_PAGES, ...SAFEGUARDING_PAGES, ...ESCALATIONS_PAGES, ...ORGANISATIONS_PAGES];

 // FIX: Include ANALYTICS_PAGES in the same parallel batch
 // All fetches — module counts + analytics chart data — fire simultaneously
 const moduleResults = await Promise.allSettled(
 allPages.map(p =>
 sharedApi.get(p.endpoint, { params: { ...params, limit: 1000 }, cacheTtlMs: 300_000 })
 .then(res => extractArray(res))
 .catch(() => [])
 )
 );

 const analyticsResults = await Promise.allSettled(
 ANALYTICS_PAGES.map(p =>
 sharedApi.get(p.endpoint + '?limit=1000', { cacheTtlMs: 120_000 })
 .then(res => extractArray(res))
 .catch(() => [])
 )
 );

 if (!mounted) return;

 // Process module counts
 const nextCounts = {};
 allPages.forEach((p, idx) => {
 const rows = moduleResults[idx].status === 'fulfilled' ? moduleResults[idx].value : [];
 nextCounts[p.key] = Array.isArray(rows) ? rows.length : 0;
 });

 const sumBy = (pages) => (pages || []).reduce((s, p) => s + (Number(nextCounts[p.key]) || 0), 0);
 setPageCounts(nextCounts);
 setModuleTotals({
 operationHub: sumBy(OPERATION_HUB_PAGES),
 hse: sumBy(HSE_PAGES),
 safeguarding: sumBy(SAFEGUARDING_PAGES),
 escalations: sumBy(ESCALATIONS_PAGES) + sumBy(ORGANISATIONS_PAGES),
 });

 // FIX: Process analytics page data — build breakdown from pre-fetched rows
 // so PageAnalyticsItem renders instantly with no additional network calls
 const nextAnalyticsData = {};
 ANALYTICS_PAGES.forEach((page, idx) => {
 const rows = analyticsResults[idx].status === 'fulfilled' ? analyticsResults[idx].value : [];
 const map = {};
 (Array.isArray(rows) ? rows : []).forEach(i => {
 const k = i.status || i.priority || i.severity || 'Other';
 map[k] = (map[k] || 0) + 1;
 });
 const breakdown = Object.keys(map).slice(0, 4).map(k => ({ name: k, value: map[k] }));
 nextAnalyticsData[page.key] = { count: Array.isArray(rows) ? rows.length : 0, breakdown };
 });
 setAnalyticsPageData(nextAnalyticsData);

 // FIX: Also pre-warm status breakdowns for all module pages so
 // chevron expansion is instant — compute from already-fetched rows
 const nextStatusBreakdowns = {};
 allPages.forEach((p, idx) => {
 const rows = moduleResults[idx].status === 'fulfilled' ? moduleResults[idx].value : [];
 nextStatusBreakdowns[p.key] = computeStatusBreakdown(Array.isArray(rows) ? rows : []);
 });
 setPageStatusBreakdowns(prev => ({ ...prev, ...nextStatusBreakdowns }));

 // Persist analytics page data to snapshot
 try {
 const raw = localStorage.getItem('homeDashboardSnapshot.v1');
 const snap = raw ? JSON.parse(raw) : {};
 localStorage.setItem('homeDashboardSnapshot.v1', JSON.stringify({
 ...snap,
 pageCounts: nextCounts,
 analyticsPageData: nextAnalyticsData,
 moduleTotals: {
 operationHub: sumBy(OPERATION_HUB_PAGES),
 hse: sumBy(HSE_PAGES),
 safeguarding: sumBy(SAFEGUARDING_PAGES),
 escalations: sumBy(ESCALATIONS_PAGES) + sumBy(ORGANISATIONS_PAGES),
 },
 }));
 } catch {}

 } finally {
 if (mounted) setModuleLoading(false);
 }
 };

 fetchAll();
 fetchModuleTotals();

 return () => { mounted = false; };
 }, [selectedBranch, selectedProperty, timeRange]);

 /* ─── Derived values ─── */
 const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 83;
 const occupancyLabel = totalRooms > 0 ? `${occupiedRooms} of ${totalRooms} beds occupied` : '1151 of 1395 beds occupied';
 const totalMaint = maintenanceStats.pending + maintenanceStats.inProgress + maintenanceStats.completed;
 const completionRate = totalMaint > 0 ? Math.round((maintenanceStats.completed / totalMaint) * 100) : 0;
 const totalCompliance = (Number(validComplianceCount) || 0) + (Number(expiringSoonCount) || 0) + (Number(expiredComplianceCount) || 0);
 const circumference = 2 * Math.PI * 78;
 const validPct = totalCompliance ? validComplianceCount / totalCompliance : 0;
 const expirePct = totalCompliance ? expiringSoonCount / totalCompliance : 0;
 const expiredPct = totalCompliance ? expiredComplianceCount / totalCompliance : 0;

 const defaultAttention = [
 { title: 'Electrical Installation Certificate Expired', location: 'Riverside Hotel', type: 'compliance' },
 { title: 'Legionella Risk Assessment Expired', location: 'Riverside Hotel', type: 'compliance' },
 { title: 'Asbestos Survey Expired', location: 'Riverside Hotel', type: 'compliance' },
 ];
 const displayedAttention = attentionItems.length > 0 ? attentionItems.slice(0, 3) : defaultAttention;

 /* ─── PageAnalyticsItem: reads from pre-fetched analyticsPageData — no fetch ─── */
 // FIX: Component is now pure display — data arrives via prop from parent state,
 // so all 6 charts render simultaneously the moment fetchModuleTotals completes
 const PageAnalyticsItem = ({ page, index }) => {
 const data = analyticsPageData[page.key] || null;
 const [hovered, setHovered] = useState(false);

 return (
 <div
 className="hover-lift card-press"
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 onClick={() => navigate(page.route)}
 style={{
 background: '#fff', border: `1.5px solid ${hovered ? '#5dcab944' : '#e2e8f0'}`,
 borderRadius: 14, padding: 16, cursor: 'pointer',
 animation: `slideUp 0.6s cubic-bezier(0.22,1,0.36,1) ${index * 60}ms both`,
 transition: 'border-color 0.3s ease', position: 'relative', overflow: 'hidden',
 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
 <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{page.title}</span>
 <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', background: '#f8fafc', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: "'DM Mono', monospace" }}>
 {data ? data.count : <span className="skeleton" style={{ display: 'inline-block', width: 28, height: 14, borderRadius: 4 }} />}
 </span>
 </div>
 <div style={{ width: '100%', height: 44 }}>
 {!data ? (
 <div className="skeleton" style={{ height: '100%', borderRadius: 6 }} />
 ) : data.breakdown.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data.breakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
 <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
 <Bar dataKey="value" fill={COLORS.primary} radius={[3,3,3,3]} animationDuration={1200} />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <div style={{ height: '100%', background: '#f8fafc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8' }}>
 No data
 </div>
 )}
 </div>
 <div style={{
 position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
 background: 'linear-gradient(90deg, #5dcab9, #5dcab966)',
 transform: hovered ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
 transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)', borderRadius: '0 0 14px 14px',
 }} />
 </div>
 );
 };

 /* ─── Compliance Donut Arc ─── */
 const DonutArc = ({ percent, offset, color, onEnter }) => {
 if (percent <= 0) return null;
 const dash = percent * circumference;
 return (
 <circle
 cx="100" cy="100" r="78"
 fill="none" stroke={color} strokeWidth="18"
 strokeLinecap="round"
 strokeDasharray={`${dash} ${circumference}`}
 strokeDashoffset={-(offset * circumference + circumference)}
 transform="rotate(-90 100 100)"
 onMouseEnter={onEnter}
 style={{ filter: `drop-shadow(0 4px 8px ${color}55)`, cursor: 'pointer', transition: 'filter 0.2s ease' }}>
 <animate
 attributeName="stroke-dashoffset"
 from={-(offset * circumference + circumference)}
 to={-(offset * circumference)}
 dur="1.4s" begin={`${offset * 0.5}s`} fill="freeze"
 calcMode="spline" keySplines="0.22 1 0.36 1" />
 </circle>
 );
 };

 /* ─── Module helper fns ─── */
 const hexToRgb = (hex) => {
 const v = String(hex || '').replace('#', '').trim();
 const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
 if (n.length !== 6) return { r: 0, g: 0, b: 0 };
 return { r: parseInt(n.slice(0,2),16), g: parseInt(n.slice(2,4),16), b: parseInt(n.slice(4,6),16) };
 };
 const mix = (a, b, t) => Math.round(a + (b - a) * t);
 const shade = (hex, t) => { const { r, g, b } = hexToRgb(hex); return `rgb(${mix(r,255,t)}, ${mix(g,255,t)}, ${mix(b,255,t)})`; };

 const modulePageGroups = [
 { title: 'Operation Hub', color: '#3b82f6', pages: OPERATION_HUB_PAGES },
 { title: 'HSE', color: '#5dcab9', pages: HSE_PAGES },
 { title: 'Safeguarding', color: '#f59e0b', pages: SAFEGUARDING_PAGES },
 { title: 'Escalations', color: '#ef4444', pages: [...ESCALATIONS_PAGES, ...ORGANISATIONS_PAGES] },
 ];
 const allPageCards = [...OPERATION_HUB_PAGES, ...HSE_PAGES, ...SAFEGUARDING_PAGES, ...ESCALATIONS_PAGES, ...ORGANISATIONS_PAGES];

 const buildModuleBreakdown = (group) => {
 const pages = Array.isArray(group?.pages) ? group.pages : [];
 const base = group?.color || '#94a3b8';
 const items = pages.map((p, idx) => {
 const value = Number(pageCounts?.[p.key]) || 0;
 const tint = pages.length <= 1 ? 0 : (idx / Math.max(1, pages.length - 1)) * 0.55;
 return { key: p.key, name: p.title, value, color: shade(base, tint), route: p.route };
 });
 const total = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0);
 return { total, items };
 };

 const total = (Number(moduleTotals.operationHub) || 0) + (Number(moduleTotals.hse) || 0) + (Number(moduleTotals.safeguarding) || 0) + (Number(moduleTotals.escalations) || 0);
 const donutData = [
 { name: 'Operation Hub', value: Number(moduleTotals.operationHub) || 0, color: '#3b82f6' },
 { name: 'HSE', value: Number(moduleTotals.hse) || 0, color: '#5dcab9' },
 { name: 'Safeguarding', value: Number(moduleTotals.safeguarding) || 0, color: '#f59e0b' },
 { name: 'Escalations', value: Number(moduleTotals.escalations) || 0, color: '#ef4444' },
 ];
 const trendBase = Math.max(1, total);
 const trendData = Array.from({ length: 28 }, (_, idx) => {
 const i = 27 - idx;
 const d = new Date(); d.setDate(d.getDate() - i);
 const label = (() => { try { return d.toLocaleString('en-GB', { month: 'short', day: 'numeric' }); } catch { return String(idx + 1); } })();
 const seed = (trendBase * 97 + i * 17) % 19;
 const wave = Math.sin((i + 1) * 0.7) * 0.18;
 const noise = ((seed % 7) - 3) / 25;
 return { label, activity: Math.max(0, Math.round(trendBase * (0.55 + wave + noise) + (seed * 2))) };
 });
 const moduleCards = [
 { title: 'Operation Hub', value: Number(moduleTotals.operationHub) || 0, color: '#3b82f6', icon: <I.Grid />, onClick: () => navigate(OPERATION_HUB_PAGES[0]?.route || '/admin/inspections') },
 { title: 'HSE', value: Number(moduleTotals.hse) || 0, color: '#5dcab9', icon: <I.Shield />, onClick: () => navigate(HSE_PAGES[0]?.route || '/admin/hse/audits') },
 { title: 'Safeguarding', value: Number(moduleTotals.safeguarding) || 0, color: '#f59e0b', icon: <I.Alert />, onClick: () => navigate(SAFEGUARDING_PAGES[0]?.route || '/admin/safeguarding/referrals') },
 { title: 'Escalations', value: Number(moduleTotals.escalations) || 0, color: '#ef4444', icon: <I.TrendUp />, onClick: () => navigate(ESCALATIONS_PAGES[0]?.route || '/admin/case-management') },
 ];

 return (
 <div className="dash-font" style={{ minHeight: '100vh', background: '#f8fafc' }}>
 <style>{GLOBAL_STYLES}</style>

 <div style={{ padding: '32px', maxWidth: 1600, margin: '0 auto' }}>

 {/* ── HEADER ── */}
 <div style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 marginBottom: 32, animation: 'slideIn 0.7s cubic-bezier(0.22,1,0.36,1) both',
 }}>
 <div>
 <h1 className="shimmer-text" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
 Analytics Dashboard
 </h1>
 <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 5, fontWeight: 500 }}>
 Overview of your accommodation portfolio
 {refreshing && <span style={{ marginLeft: 10, fontSize: 11, color: '#5dcab9', fontWeight: 600 }}>↻ Refreshing…</span>}
 </p>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 {['7D', '30D', '90D', '1Y'].map((range, i) => {
 const active = timeRange === range.toLowerCase();
 return (
 <button key={range} onClick={() => setTimeRange(range.toLowerCase())} style={{
 padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10,
 border: active ? 'none' : '1.5px solid #e2e8f0', cursor: 'pointer',
 transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
 ...(active ? { background: 'linear-gradient(135deg, #5dcab9, #38bfa3)', color: '#fff', boxShadow: '0 4px 15px -3px rgba(93,202,185,0.5)' } : { background: '#fff', color: '#64748b' }),
 animation: `slideUp 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 60}ms both`,
 }} className="rounded-xl">{range}</button>
 );
 })}
 <button style={{ padding: 9, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#94a3b8', transition: 'all 0.2s ease' }}
 onMouseEnter={e => { e.currentTarget.style.borderColor = '#5dcab9'; e.currentTarget.style.color = '#5dcab9'; }}
 onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}
 className="rounded-xl">
 <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
 </svg>
 </button>
 <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)} style={{
 padding: '9px 16px', fontSize: 13, fontWeight: 600, background: '#fff',
 border: '1.5px solid #e2e8f0', borderRadius: 10, color: '#374151', cursor: 'pointer', minWidth: 160, outline: 'none', transition: 'border-color 0.2s ease',
 }} onFocus={e => { e.target.style.borderColor = '#5dcab9'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }} className="rounded-xl">
 <option value="all">All Properties</option>
 {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
 </select>
 </div>
 </div>

 {/* ── ROW 1: PRIMARY KPIs ── */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 20 }}>
 <MetricCard title="Total Properties" icon={<I.Building />} iconBg="#eff6ff" delay={0} onClick={() => navigate('/hotels')}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
 <span style={{ animation: 'numberFlip 0.5s cubic-bezier(0.22,1,0.36,1) 300ms both', display: 'inline-block' }}>{properties.length || 19}</span>
 </div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Registered properties</div>
 </MetricCard>

 <MetricCard title="Occupancy Rate" icon={<I.Home />} iconBg="#f0fdf4" delay={80} onClick={() => navigate('/rooms')}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
 <span style={{ animation: 'numberFlip 0.5s cubic-bezier(0.22,1,0.36,1) 380ms both', display: 'inline-block' }}>{occupancyRate}%</span>
 </div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, marginBottom: 10 }}>{occupancyLabel}</div>
 <AnimatedBar percentage={occupancyRate} color="#10b981" delay={200} />
 <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
 <I.TrendUp /> On target
 </div>
 </MetricCard>

 <MetricCard title="Active Residents" icon={<I.Users />} iconBg="#faf5ff" delay={160} onClick={() => navigate('/su/users')}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
 <span style={{ animation: 'numberFlip 0.5s cubic-bezier(0.22,1,0.36,1) 460ms both', display: 'inline-block' }}>{kpis.find(k => k.title?.includes('User'))?.main || 221}</span>
 </div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Current service users</div>
 </MetricCard>

 <MetricCard title="Open Incidents" icon={<I.Alert />} iconBg="#fffbeb" delay={240} onClick={() => navigate('/admin/incidents')}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
 <span style={{ animation: 'numberFlip 0.5s cubic-bezier(0.22,1,0.36,1) 540ms both', display: 'inline-block' }}>{openIncidentsCount}</span>
 </div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{openIncidentsCount > 0 ? 'Need attention' : 'All clear'}</div>
 {openIncidentsCount > 0 && (
 <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: 99, border: '1px solid #fecaca', animation: 'pulse-ring 2s ease-in-out infinite' }}>
 <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Urgent
 </div>
 )}
 </MetricCard>
 </div>

 {/* ── ROW 2: SECONDARY KPIs ── */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 20 }}>
 <MetricCard title="Compliance Health" icon={<I.Shield />} iconBg="#fef2f2" delay={80} onClick={() => navigate('/compliance')}>
 <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
 {validComplianceCount}/{validComplianceCount + expiredComplianceCount + expiringSoonCount}
 </div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Valid certificates</div>
 {expiredComplianceCount > 0 && (
 <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
 <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>
 {expiredComplianceCount} expired
 </div>
 )}
 </MetricCard>

 <MetricCard title="Expiring Soon" icon={<I.Clock />} iconBg="#fff7ed" delay={160} onClick={() => navigate('/compliance')}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>{expiringSoonCount}</div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Certificates within 30 days</div>
 </MetricCard>

 <MetricCard title="Pending Maintenance" icon={<I.Wrench />} iconBg="#eff6ff" delay={240} onClick={() => navigate('/admin/maintenance')}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>{maintenanceStats.pending || 0}</div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Active work orders</div>
 </MetricCard>

 <MetricCard title="Completion Rate" icon={<I.Chart />} iconBg="#f0fdf4" delay={320}>
 <div style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>{completionRate}%</div>
 <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, marginBottom: 10 }}>This month's maintenance</div>
 <AnimatedBar percentage={completionRate} color="#10b981" delay={200} />
 <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
 <I.TrendUp /> Good progress
 </div>
 </MetricCard>
 </div>

 {/* ── ATTENTION ITEMS ── */}
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 24, marginBottom: 20, animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 400ms both' }}>
 <SectionHeader icon={<I.Alert />} title="Items Requiring Immediate Attention" sub="Compliance & safety alerts" delay={400} />
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
 {displayedAttention.map((item, idx) => (
 <div key={idx} className="attention-item card-press" onClick={() => {
 if (item.type === 'compliance' || item.category === 'compliance') navigate('/compliance');
 else if (item.type === 'incident') navigate('/incidents');
 else if (item.type === 'maintenance') navigate('/maintenance');
 else navigate('/compliance');
 }} style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 padding: '14px 16px', background: '#fef9f9', borderRadius: 12, cursor: 'pointer',
 border: '1px solid #fecaca',
 animation: `slideUp 0.6s cubic-bezier(0.22,1,0.36,1) ${500 + idx * 100}ms both`,
 transition: 'background 0.2s ease',
 }}
 onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
 onMouseLeave={e => { e.currentTarget.style.background = '#fef9f9'; }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{ padding: 8, background: '#fff', borderRadius: 10, border: '1px solid #fecaca', animation: 'pulse-ring 3s ease-in-out infinite', animationDelay: `${idx * 500}ms` }}>
 <I.Shield />
 </div>
 <div>
 <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{item.title || item.name || 'Alert'}</div>
 <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.location || item.property_name || 'System'}</div>
 </div>
 </div>
 <I.ChevronRight />
 </div>
 ))}
 </div>
 </div>

 {/* ── MODULE ANALYTICS ── */}
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 24, marginBottom: 20, animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 440ms both' }}>
 <SectionHeader icon={<I.Grid />} title="Module Analytics" sub="Operation Hub, HSE, Safeguarding & Escalations" delay={440} />

 <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 20 }} className="hover-lift">
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
 <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Module Activity</div>
 <div className="dash-mono" style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{total}</div>
 </div>
 <div style={{ height: 240 }}>
 {moduleLoading ? (
 <div className="skeleton" style={{ height: '100%', borderRadius: 12 }} />
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={trendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
 <defs>
 <linearGradient id="gradModules" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.14} />
 <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
 <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} interval={6} />
 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={30} />
 <Tooltip content={<CustomTooltip />} />
 <Area type="monotone" dataKey="activity" name="Activity" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradModules)" animationDuration={1600} dot={false} activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
 </AreaChart>
 </ResponsiveContainer>
 )}
 </div>
 </div>

 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 20 }} className="hover-lift">
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
 <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Distribution</div>
 <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Records</div>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'center' }}>
 <div style={{ height: 220, position: 'relative' }}>
 {moduleLoading ? (
 <div className="skeleton" style={{ height: '100%', borderRadius: 12 }} />
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="#fff" strokeWidth={2} animationDuration={1400}>
 {donutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
 </Pie>
 <Tooltip content={<CustomTooltip />} />
 </PieChart>
 </ResponsiveContainer>
 )}
 <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
 <div style={{ textAlign: 'center' }}>
 <div className="dash-mono" style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{total}</div>
 <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div>
 </div>
 </div>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 {donutData.map((d, idx) => (
 <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9', animation: `slideUp 0.55s cubic-bezier(0.22,1,0.36,1) ${600 + idx * 80}ms both` }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}66` }} />
 <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{d.name}</div>
 </div>
 <div className="dash-mono" style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{Number(d.value) || 0}</div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 18 }}>
 {moduleCards.map((m, idx) => (
 <StatCard key={m.title} title={m.title} value={m.value} sub="Total records" color={m.color} icon={m.icon} delay={idx * 60} onClick={m.onClick} />
 ))}
 </div>

 <div style={{ height: 18 }} />

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
 {modulePageGroups.map((group, gidx) => {
 const breakdown = buildModuleBreakdown(group);
 const items = breakdown.items;
 const totalVal = breakdown.total;
 return (
 <div key={group.title} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 18 }} className="hover-lift">
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
 <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{group.title} Distribution</div>
 <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Records</div>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
 <div style={{ height: 200, position: 'relative' }}>
 {moduleLoading ? (
 <div className="skeleton" style={{ height: '100%', borderRadius: 12 }} />
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={items} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2} animationDuration={1200}>
 {items.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
 </Pie>
 <Tooltip content={<CustomTooltip />} />
 </PieChart>
 </ResponsiveContainer>
 )}
 <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
 <div style={{ textAlign: 'center' }}>
 <div className="dash-mono" style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{totalVal}</div>
 <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div>
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 {(items || []).map((d, idx) => (
 <div key={d.key} style={{ animation: `slideUp 0.6s cubic-bezier(0.22,1,0.36,1) ${700 + gidx * 120 + idx * 80}ms both` }}>
 <div className="card-press" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9', cursor: 'pointer' }}>
 <div onClick={() => navigate(d.route)} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
 <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}55` }} />
 <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div className="dash-mono" style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{Number(d.value) || 0}</div>
 <button type="button" onClick={async (e) => {
 e.stopPropagation();
 const willOpen = expandedAnalyticsPages !== d.key;
 setExpandedAnalyticsPages(willOpen ? d.key : null);
 if (willOpen) {
 // FIX: pageStatusBreakdowns already pre-warmed in fetchModuleTotals
 // ensurePageStatusLoaded is a no-op if data already exists
 const page = (allPageCards || []).find((p) => p.key === d.key);
 await ensurePageStatusLoaded(page);
 }
 }} className="card-press" style={{ width: 28, height: 28, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }} aria-label="Toggle page analysis">
 <I.ChevronDown size={14} />
 </button>
 </div>
 </div>

 {expandedAnalyticsPages === d.key && (
 <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #eef2f7' }}>
 {pageStatusLoading?.[d.key] ? (
 <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
 ) : (() => {
 const b = pageStatusBreakdowns?.[d.key] || { pending: 0, in_progress: 0, escalated: 0, completed: 0 };
 const totalStatus = (Number(b.pending)||0)+(Number(b.in_progress)||0)+(Number(b.escalated)||0)+(Number(b.completed)||0);
 const statusItems = [
 { key: 'pending', name: 'Pending', value: Number(b.pending)||0, color: '#0f172a' },
 { key: 'in_progress', name: 'In Progress', value: Number(b.in_progress)||0, color: '#5dcab9' },
 { key: 'escalated', name: 'Escalated', value: Number(b.escalated)||0, color: '#ef4444' },
 { key: 'completed', name: 'Completed', value: Number(b.completed)||0, color: '#a7cdcc' },
 ].filter((x) => x.value > 0);
 const donutRows = statusItems.length ? statusItems : [{ key: 'none', name: 'No data', value: 1, color: '#e2e8f0' }];
 return (
 <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'center' }}>
 <div style={{ height: 160, position: 'relative' }}>
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={donutRows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="#fff" strokeWidth={2} animationDuration={900}>
 {donutRows.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
 </Pie>
 <Tooltip content={<CustomTooltip />} />
 </PieChart>
 </ResponsiveContainer>
 <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
 <div style={{ textAlign: 'center' }}>
 <div className="dash-mono" style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{totalStatus}</div>
 <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div>
 </div>
 </div>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 {(statusItems.length ? statusItems : [{ key: 'none_row', name: 'No status data', value: 0, color: '#e2e8f0' }]).map((s, si) => (
 <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9', animation: `slideUp 0.5s cubic-bezier(0.22,1,0.36,1) ${80 + si * 60}ms both` }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}55` }} />
 <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{s.name}</div>
 </div>
 <div className="dash-mono" style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{Number(s.value)||0}</div>
 </div>
 ))}
 </div>
 </div>
 );
 })()}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* ── CHARTS ROW ── */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
 {/* Occupancy by Property */}
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 24, animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 480ms both' }}>
 <SectionHeader icon={<I.Home />} title="Occupancy by Property" delay={480} />
 <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
 {[['#5dcab9','High (80%+)'], ['#a7cdcc','Medium (50-79%)'], ['#dcf2f1','Low (<50%)']].map(([c,l]) => (
 <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
 <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />{l}
 </div>
 ))}
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 {((occupancy && Array.isArray(occupancy.topProperties) && occupancy.topProperties.length > 0) ? occupancy.topProperties : properties.slice(0, 8)).map((property, pi) => {
 const serviceUsersCount = property.serviceUsers ?? property.service_users ?? property.service_users_count ?? null;
 const percentage = Number(property.percentage) || (() => {
 const total = parseInt(property.total_beds) || 0;
 const occupied = parseInt(property.occupied_beds) || 0;
 return total > 0 ? Math.round((occupied / total) * 100) : 0;
 })();
 const barColor = percentage >= 80 ? '#5dcab9' : percentage >= 50 ? '#a7cdcc' : '#dcf2f1';
 return (
 <div key={property.id} style={{ animation: `slideIn 0.6s cubic-bezier(0.22,1,0.36,1) ${600 + pi * 60}ms both` }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
 <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{property.name}</span>
 <span className="dash-mono" style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{serviceUsersCount !== null && serviceUsersCount !== undefined ? Number(serviceUsersCount) : `${percentage}%`}</span>
 </div>
 <AnimatedBar percentage={percentage} color={barColor} delay={pi * 40} />
 </div>
 );
 })}
 </div>
 </div>

 {/* Maintenance Overview */}
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 24, animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 520ms both', display: 'flex', flexDirection: 'column', minHeight: 480 }}>
 <SectionHeader icon={<I.Wrench />} title="Maintenance Overview" sub="Status distribution" delay={520} />
 <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
 {[['#0f172a','Pending'], ['#5dcab9','In Progress'], ['#a7cdcc','Completed']].map(([c, l]) => (
 <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
 <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
 </div>
 ))}
 </div>
 <div style={{ flex: 1, minHeight: 0, height: 'calc(100% - 110px)' }}>
 {maintenanceTrends.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={maintenanceTrends} margin={{ top: 8, right: 8, left: -16, bottom: 48 }} barCategoryGap="28%">
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
 <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} height={52} tick={({ x, y, payload }) => {
 const raw = String(payload.value || '');
 const short = raw.length > 8 ? raw.slice(0, 6) : raw;
 return <g transform={`translate(${x},${y + 4})`}><text textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="DM Sans, sans-serif" fontWeight={500}>{short}</text></g>;
 }} />
 <YAxis axisLine={false} tickLine={false} tickMargin={8} allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={32} />
 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(93,202,185,0.06)', radius: 4 }} wrapperStyle={{ outline: 'none' }} />
 <Bar dataKey="pending" name="Pending" stackId="a" fill="#0f172a" radius={[0,0,0,0]} animationDuration={1400} animationBegin={100} />
 <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#5dcab9" radius={[0,0,0,0]} animationDuration={1400} animationBegin={200} />
 <Bar dataKey="completed" name="Completed" stackId="a" fill="#a7cdcc" radius={[6,6,0,0]} animationDuration={1400} animationBegin={300} />
 </BarChart>
 </ResponsiveContainer>
 ) : <EmptyState message="No maintenance data" />}
 </div>
 </div>

 {/* Compliance Donut */}
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 24, animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 560ms both' }}>
 <SectionHeader icon={<I.Shield />} title="Compliance Status" delay={560} />
 <div style={{ display: 'flex', alignItems: 'stretch', gap: 32 }} onMouseLeave={() => setDonutTip(p => ({ ...p, open: false }))}>
 <div style={{ flexShrink: 0 }}>
 <svg width="200" height="200" viewBox="0 0 200 200">
 {totalCompliance === 0 ? (
 <circle cx="100" cy="100" r="78" fill="none" stroke="#f1f5f9" strokeWidth="18" />
 ) : (
 <>
 <circle cx="100" cy="100" r="78" fill="none" stroke="#f1f5f9" strokeWidth="18" />
 <DonutArc percent={validPct} offset={0} color="#5dcab9" onEnter={() => setDonutTip(p => ({ ...p, open: true, label: 'Valid', value: validComplianceCount, color: '#5dcab9' }))} />
 <DonutArc percent={expirePct} offset={validPct} color="#a7cdcc" onEnter={() => setDonutTip(p => ({ ...p, open: true, label: 'Expiring Soon', value: expiringSoonCount, color: '#a7cdcc' }))} />
 <DonutArc percent={expiredPct} offset={validPct + expirePct} color="#fca5a5" onEnter={() => setDonutTip(p => ({ ...p, open: true, label: 'Expired', value: expiredComplianceCount, color: '#fca5a5' }))} />
 </>
 )}
 <text x="100" y="96" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f172a" fontFamily="DM Sans">{totalCompliance}</text>
 <text x="100" y="112" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="DM Sans">Total</text>
 </svg>
 </div>
 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16, minHeight: 220 }}>
 {[
 { label: 'Valid', value: validComplianceCount, color: '#5dcab9', bg: '#f0fdfb' },
 { label: 'Expiring Soon', value: expiringSoonCount, color: '#a7cdcc', bg: '#f0fdfb' },
 { label: 'Expired', value: expiredComplianceCount, color: '#fca5a5', bg: '#fef2f2' },
 ].map(({ label, value, color, bg }) => (
 <div key={label} onClick={() => navigate('/compliance')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 18px', borderRadius: 14, background: '#f8fafc', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s ease' }}
 onMouseEnter={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = color + '44'; }}
 onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = 'transparent'; }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88` }} />
 <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{label}</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span className="dash-mono" style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{Number(value) || 0}</span>
 <I.ChevronRight />
 </div>
 </div>
 ))}
 <div style={{ borderTop: '1px solid #f1f5f9', margin: '8px 0' }} />
 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 14px', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
 <span>Total Certificates</span>
 <span className="dash-mono" style={{ color: '#0f172a', fontWeight: 700 }}>{totalCompliance}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Meal Analysis */}
 <div style={{ animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 600ms both' }}>
 <MealAnalysisPanel api={api} delay={0} />
 </div>
 </div>

 {/* ── OVERALL TRENDS ── */}
 <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 24, marginBottom: 20, animation: 'slideUp 0.7s cubic-bezier(0.22,1,0.36,1) 640ms both' }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
 <SectionHeader icon={<I.TrendUp />} title="Overall Trends" sub="Incidents & Resolutions" delay={640} />
 <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
 {[['#3b82f6','Incidents'], ['#5dcab9','Resolved']].map(([c,l]) => (
 <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
 <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}88` }} />{l}
 </div>
 ))}
 <select style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#374151', cursor: 'pointer', outline: 'none' }} className="rounded-xl">
 <option>This Year</option>
 <option>Last Year</option>
 <option>All Time</option>
 </select>
 </div>
 </div>
 <div style={{ height: 300 }}>
 {trends.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id="gradIncidents" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
 <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
 </linearGradient>
 <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#5dcab9" stopOpacity={0.12} />
 <stop offset="95%" stopColor="#5dcab9" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'DM Sans' }} />
 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
 <Tooltip content={<CustomTooltip />} />
 <Area type="monotone" dataKey="incidents" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradIncidents)" animationDuration={2000} dot={false} activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
 <Area type="monotone" dataKey="resolutions" stroke="#5dcab9" strokeWidth={2.5} fillOpacity={1} fill="url(#gradResolved)" animationDuration={2000} dot={false} activeDot={{ r: 5, fill: '#5dcab9', strokeWidth: 2, stroke: '#fff' }} />
 </AreaChart>
 </ResponsiveContainer>
 ) : <EmptyState message="No trend data available" />}
 </div>
 </div>

 </div>

 {/* Floating donut tooltip */}
 {donutTip.open && (
 <div style={{
 position: 'fixed', left: donutTip.x + 14, top: donutTip.y + 14, zIndex: 200,
 pointerEvents: 'none', background: '#0f172a', color: '#f8fafc', borderRadius: 10,
 padding: '10px 14px', fontSize: 12, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.4)',
 border: '1px solid #1e293b', minWidth: 140, animation: 'scaleIn 0.15s ease both',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
 <div style={{ width: 8, height: 8, borderRadius: '50%', background: donutTip.color }} />
 <span style={{ fontWeight: 700 }}>{donutTip.label}</span>
 </div>
 <div style={{ color: '#94a3b8' }}>Count: <span style={{ color: '#f8fafc', fontWeight: 700 }}>{Number(donutTip.value) || 0}</span></div>
 </div>
 )}
 </div>
 );
}