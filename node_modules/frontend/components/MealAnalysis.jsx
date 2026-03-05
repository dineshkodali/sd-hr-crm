import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const MealAnalysis = ({ delay = 100 }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        healthy: 0,
        standard: 0,
        vegetarian: 0,
        special: 0,
        total: 0
    });

    const [donutTooltip, setDonutTooltip] = useState({
        open: false,
        x: 0,
        y: 0,
        label: '',
        value: 0,
        color: '',
    });

    const api = useMemo(() => axios.create({
        baseURL: import.meta.env.VITE_API_URL || '',
        withCredentials: true,
        timeout: 10000
    }), []);

    useEffect(() => {
        let mounted = true;
        const fetchData = async () => {
            try {
                const endpoints = [
                    '/api/meals',
                    '/api/su/meals',
                    '/api/meal-schedules'
                ];

                let mealsData = [];
                for (const ep of endpoints) {
                    try {
                        const res = await api.get(ep);
                        const rows = res.data?.rows || res.data?.data || res.data;
                        if (Array.isArray(rows) && rows.length > 0) {
                            mealsData = rows;
                            break;
                        }
                    } catch (e) { }
                }

                if (!mounted) return;

                if (mealsData.length > 0) {
                    let healthy = 0;
                    let standard = 0;
                    let vegetarian = 0;
                    let special = 0;

                    mealsData.forEach(meal => {
                        const dietary = (meal.dietary || meal.diet || '').toLowerCase();
                        const notes = (meal.notes || '').toLowerCase();
                        const type = (meal.mealType || meal.type || '').toLowerCase();

                        if (dietary.includes('vegetarian') || dietary.includes('vegan')) {
                            vegetarian++;
                        } else if (dietary.includes('gluten') || dietary.includes('halal') || dietary.includes('kosher') || dietary.includes('allergy')) {
                            special++;
                        } else if (notes.includes('healthy') || type.includes('salad') || type.includes('fruit')) {
                            healthy++;
                        } else {
                            standard++;
                        }
                    });

                    setStats({
                        healthy,
                        standard,
                        vegetarian,
                        special,
                        total: healthy + standard + vegetarian + special
                    });
                }
            } catch (err) {
                console.error("Failed to fetch meal data:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [api]);

    if (loading) {
        return (
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-32 w-32 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded-xl"></div>
                </div>
            </div>
        );
    }

    const { healthy, standard, vegetarian, special, total } = stats;

    const COLORS = {
        healthy: '#10b981',    // Emerald
        standard: '#6366f1',   // Indigo
        vegetarian: '#f59e0b', // Amber
        special: '#ef4444'     // Red
    };

    // Calculate chart segments
    const radius = 78;
    const circumference = 2 * Math.PI * radius;

    // Percentages
    const pHe = total > 0 ? healthy / total : 0;
    const pSt = total > 0 ? standard / total : 0;
    const pVe = total > 0 ? vegetarian / total : 0;
    const pSp = total > 0 ? special / total : 0;

    // Offsets
    // Order: Healthy -> Standard -> Vegetarian -> Special
    const offHe = 0;
    const offSt = pHe * circumference;
    const offVe = (pHe + pSt) * circumference;
    const offSp = (pHe + pSt + pVe) * circumference;

    const renderSegment = (value, percent, offset, color, label, delayIndex) => {
        if (value <= 0) return null;
        return (
            <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={`${percent * circumference} ${circumference}`}
                strokeDashoffset={-(offset + circumference)}
                transform="rotate(-90 100 100)"
                className="transition-all duration-500 cursor-pointer hover:opacity-80"
                onMouseEnter={() => setDonutTooltip({ open: true, label, value, color })}
                onMouseMove={(e) => setDonutTooltip(prev => ({ ...prev, open: true, x: e.clientX, y: e.clientY }))}
                style={{ filter: `drop-shadow(0 4px 6px ${color}33)` }}
            >
                <animate
                    attributeName="stroke-dashoffset"
                    from={-(offset + circumference)}
                    to={-offset}
                    dur="1.5s"
                    begin={`${delayIndex * 0.1}s`}
                    fill="freeze"
                    calcMode="spline"
                    keySplines="0.22 1 0.36 1"
                />
            </circle>
        );
    };

    return (
        <div
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-500 relative overflow-hidden group h-full flex flex-col justify-between"
            style={{ animation: `fadeInUp 0.6s ease-out ${delay}ms forwards`, opacity: 0 }}
            onMouseLeave={() => setDonutTooltip(prev => ({ ...prev, open: false }))}
        >
            {/* Header */}
            <div className="flex items-center justify-between z-10 relative mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm border border-orange-100">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                            <line x1="6" y1="1" x2="6" y2="4"></line>
                            <line x1="10" y1="1" x2="10" y2="4"></line>
                            <line x1="14" y1="1" x2="14" y2="4"></line>
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight">Meal Analysis</h3>
                        <p className="text-xs text-gray-500 font-medium">Daily nutritional breakdown</p>
                    </div>
                </div>
                <button className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border border-gray-200">
                    Export
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 relative z-10">
                {/* SVG Donut Chart */}
                <div className="relative">
                    <svg className="w-48 h-48 mx-auto" viewBox="0 0 200 200">
                        {/* Background Circle */}
                        <circle cx="100" cy="100" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="18" />

                        {total > 0 && (
                            <>
                                {renderSegment(healthy, pHe, offHe, COLORS.healthy, 'Healthy', 0)}
                                {renderSegment(standard, pSt, offSt, COLORS.standard, 'Standard', 1)}
                                {renderSegment(vegetarian, pVe, offVe, COLORS.vegetarian, 'Vegetarian', 2)}
                                {renderSegment(special, pSp, offSp, COLORS.special, 'Special', 3)}
                            </>
                        )}
                    </svg>

                    {/* Centered Total */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-gray-900">{total}</span>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Meals</span>
                    </div>
                </div>

                {/* Legend List */}
                <div className="w-full sm:w-1/2 space-y-2">
                    {[
                        { label: 'Healthy', val: healthy, color: COLORS.healthy },
                        { label: 'Standard', val: standard, color: COLORS.standard },
                        { label: 'Vegetarian', val: vegetarian, color: COLORS.vegetarian },
                        { label: 'Special', val: special, color: COLORS.special }
                    ].map(item => (
                        <div
                            key={item.label}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group/item"
                            onMouseEnter={() => setDonutTooltip({ open: true, label: item.label, value: item.val, color: item.color })}
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <span className="text-sm text-gray-600 font-medium">{item.label}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{item.val}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tooltip */}
            {donutTooltip.open && (
                <div
                    className="fixed z-[80] px-3 py-2 rounded-xl shadow-lg border border-gray-100 bg-slate-900 text-white text-xs select-none pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]"
                    style={{
                        left: donutTooltip.x,
                        top: donutTooltip.y,
                        minWidth: 120,
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: donutTooltip.color }}></span>
                        <span className="font-semibold">{donutTooltip.label}</span>
                    </div>
                    <div className="text-white/90">Count: {donutTooltip.value}</div>
                </div>
            )}

            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-50/50 to-transparent rounded-bl-full pointer-events-none -z-0 opacity-40"></div>

            {/* Floating Food Icons Animation */}
            <div className="absolute bottom-4 right-4 text-4xl opacity-10 animate-float-slow pointer-events-none select-none" style={{ animationDelay: '0s' }}>🍎</div>
            <div className="absolute top-1/2 left-4 text-2xl opacity-10 animate-float-delayed pointer-events-none select-none" style={{ animationDelay: '1s' }}>🥦</div>
            <div className="absolute top-4 right-1/3 text-3xl opacity-10 animate-float-slow pointer-events-none select-none" style={{ animationDelay: '2s' }}>🥕</div>

            <style>{`
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-10px) rotate(5deg); }
                }
                @keyframes float-delayed {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(10px) rotate(-5deg); }
                }
                .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 5s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default MealAnalysis;
