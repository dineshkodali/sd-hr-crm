import React from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, ChevronDown } from 'lucide-react';

/**
 * Shared "Filters" trigger button used above data tables app-wide.
 * Shows an active-filter-count badge when any filter is set.
 */
export function FiltersButton({ activeCount = 0, onClick, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`h-9 relative border rounded-xl px-3 text-xs font-medium flex items-center gap-2 transition-colors ${activeCount > 0
                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                } ${className}`}
        >
            <Filter className="w-4 h-4" />
            <span className="font-semibold">Filters</span>
            {activeCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-bold">
                    {activeCount}
                </span>
            )}
        </button>
    );
}

/**
 * Consistent select control used inside FiltersDrawer fields.
 */
export function FilterSelect({ icon: Icon, value, onChange, children, ...rest }) {
    return (
        <div className="relative">
            {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40 pointer-events-none" />}
            <select
                value={value}
                onChange={onChange}
                className="w-full h-11 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl pl-10 pr-10 text-sm text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] cursor-pointer appearance-none"
                {...rest}
            >
                {children}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40 pointer-events-none" />
        </div>
    );
}

/**
 * A labelled filter field: label + FilterSelect, matching the app-wide drawer look.
 */
export function FilterField({ label, icon, value, onChange, children, ...rest }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)]/70 uppercase tracking-wider mb-2">{label}</label>
            <FilterSelect icon={icon} value={value} onChange={onChange} {...rest}>{children}</FilterSelect>
        </div>
    );
}

/**
 * Slide-out filters panel shared by every table page.
 *
 * Rendered via a portal to document.body so it always paints above the app's
 * top navbar (`.top-navbar`, z-50) and sidebar — those live in a sibling
 * stacking context to the routed page content, so no z-index inside a page
 * can ever paint over them without escaping the DOM tree via a portal.
 */
export function FiltersDrawer({ isOpen, onClose, onClear, onApply, title = 'Filters', children }) {
    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity"
                onClick={onClose}
            />
            <div className="relative w-full max-w-sm h-full bg-[var(--bg-surface)] shadow-2xl border-l border-[var(--border-color)] flex flex-col animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] shrink-0">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-[var(--accent-primary)]" />
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                    {children}
                </div>

                <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--border-color)] shrink-0">
                    <button
                        type="button"
                        onClick={onClear}
                        className="flex-1 h-11 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--bg-primary)]/70 transition-colors"
                    >
                        <X className="w-4 h-4" /><span>Clear all</span>
                    </button>
                    <button
                        type="button"
                        onClick={onApply || onClose}
                        className="flex-1 h-11 rounded-xl bg-[var(--accent-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/**
 * Filled-pill tab switcher shared by every table page.
 * tabs: [{ key, label, count? }]
 */
export function TabPills({ tabs, activeTab, onChange, className = '' }) {
    return (
        <div className={`flex items-center gap-1 flex-wrap bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-1.5 ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onChange(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isActive
                            ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                            }`}
                    >
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span
                                className={`text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]/70'
                                    }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
