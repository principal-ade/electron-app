'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useTheme } from '@principal-ade/industry-theme';
import { Code2, Loader2, CheckCircle, AlertTriangle, AlertOctagon, Scan, Activity, Zap, AlertCircle, X } from 'lucide-react';
const SEVERITY = {
    safe: { level: 'safe', label: 'Safe', color: '#22c55e', icon: CheckCircle },
    low: { level: 'low', label: 'Low', color: '#eab308', icon: AlertTriangle },
    moderate: { level: 'moderate', label: 'Moderate', color: '#f97316', icon: Activity },
    high: { level: 'high', label: 'High', color: '#ef4444', icon: Zap },
    critical: { level: 'critical', label: 'Critical', color: '#d946ef', icon: AlertOctagon },
};
function getSeverity(occurrences) {
    if (occurrences < 5)
        return SEVERITY.safe;
    if (occurrences < 10)
        return SEVERITY.low;
    if (occurrences < 50)
        return SEVERITY.moderate;
    if (occurrences < 100)
        return SEVERITY.high;
    return SEVERITY.critical;
}
export default function VibeCodingPane({ fileCount, occurrenceCount, files, terms, loading, error, scanActive, scanProgress, scanDirectory, totalRepoFiles, onClear, onRefresh, onClose, }) {
    const { theme } = useTheme();
    const severity = occurrenceCount !== null ? getSeverity(occurrenceCount) : null;
    const SeverityIcon = severity?.icon ?? Code2;
    const hasResults = fileCount !== null && occurrenceCount !== null;
    return (_jsxs("div", { className: "flex flex-col h-full", style: {
            background: theme.colors.background,
            color: theme.colors.text,
        }, children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b shrink-0", style: {
                    borderColor: theme.colors.border,
                    ...(severity ? { background: `color-mix(in srgb, ${severity.color} 8%, transparent)` } : {}),
                }, children: [_jsxs("div", { className: "flex items-center gap-2", children: [loading ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin", style: { color: theme.colors.textMuted } })) : severity ? (_jsx(SeverityIcon, { className: "w-4 h-4", style: { color: severity.color } })) : scanActive ? (_jsx(Scan, { className: "w-4 h-4 animate-pulse", style: { color: theme.colors.primary } })) : (_jsx(Code2, { className: "w-4 h-4", style: { color: theme.colors.textMuted } })), _jsx("span", { className: "text-sm font-semibold", children: "Vibe Coding Detector" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [hasResults && !loading && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: onRefresh, className: "text-xs px-2 py-1 rounded transition-opacity hover:opacity-80", style: {
                                            background: `color-mix(in srgb, ${theme.colors.primary} 15%, transparent)`,
                                            color: theme.colors.primary,
                                        }, children: "Refresh" }), _jsx("button", { type: "button", onClick: onClear, className: "text-xs px-2 py-1 rounded transition-opacity hover:opacity-80", style: {
                                            background: `color-mix(in srgb, ${theme.colors.textMuted} 15%, transparent)`,
                                            color: theme.colors.textMuted,
                                        }, children: "Clear" })] })), _jsx("button", { type: "button", onClick: onClose, className: "flex items-center justify-center w-6 h-6 rounded transition-opacity hover:opacity-80", style: { color: theme.colors.textMuted }, "aria-label": "Close vibe coding view", children: _jsx(X, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-4", style: { scrollbarWidth: 'thin' }, children: [loading && (_jsxs("div", { className: "flex flex-col items-center gap-4 py-8", children: [_jsxs("div", { className: "relative", children: [_jsx(Scan, { className: "w-10 h-10 animate-pulse", style: { color: theme.colors.primary } }), _jsx("div", { className: "absolute inset-0 rounded-full animate-ping opacity-20", style: { background: theme.colors.primary } })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-sm font-medium", style: { color: theme.colors.text }, children: "Scanning codebase..." }), _jsx("div", { className: "text-xs mt-1", style: { color: theme.colors.textMuted }, children: "Searching for isRecord, is_record, is_empty patterns" }), scanDirectory && (_jsx("div", { className: "text-xs mt-2 px-2 py-1 rounded inline-block", style: {
                                            background: `color-mix(in srgb, ${theme.colors.primary} 10%, transparent)`,
                                            color: theme.colors.primary,
                                            fontFamily: theme.fonts.monospace,
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-block',
                                        }, children: scanDirectory }))] }), _jsxs("div", { className: "w-full space-y-1.5", children: [_jsx("div", { className: "w-full h-2 rounded-full overflow-hidden", style: { background: `color-mix(in srgb, ${theme.colors.textMuted} 15%, transparent)` }, children: _jsx("div", { className: "h-full rounded-full transition-all duration-100 ease-linear", style: {
                                                background: theme.colors.primary,
                                                width: `${Math.max(2, scanProgress * 100)}%`,
                                            } }) }), _jsxs("div", { className: "flex items-center justify-between text-xs", style: { color: theme.colors.textMuted }, children: [_jsxs("span", { children: [Math.round(scanProgress * totalRepoFiles).toLocaleString(), " / ", totalRepoFiles.toLocaleString(), " files"] }), _jsxs("span", { children: [Math.round(scanProgress * 100), "%"] })] })] })] })), error && (_jsxs("div", { className: "flex items-center gap-2 text-sm py-2", style: { color: theme.colors.error ?? '#ef4444' }, children: [_jsx(AlertCircle, { className: "w-4 h-4 shrink-0" }), _jsx("span", { children: error })] })), hasResults && !loading && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-4 rounded-lg", style: {
                                    background: `color-mix(in srgb, ${severity.color} 10%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${severity.color} 25%, transparent)`,
                                }, children: [_jsx(SeverityIcon, { className: "w-10 h-10 shrink-0", style: { color: severity.color } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-xl font-bold tracking-tight", style: { color: severity.color }, children: severity.label }), _jsx("div", { className: "text-sm mt-0.5", style: { color: theme.colors.textMuted }, children: occurrenceCount > 0
                                                    ? `${occurrenceCount} pattern${occurrenceCount !== 1 ? 's' : ''} found across ${fileCount} file${fileCount !== 1 ? 's' : ''}`
                                                    : 'No vibe coding patterns detected' })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs", style: { color: theme.colors.textMuted }, children: [_jsx("span", { children: "0" }), _jsx("span", { children: "Severity Index" }), _jsx("span", { children: "100+" })] }), _jsx("div", { className: "w-full h-2 rounded-full overflow-hidden flex", style: { background: `color-mix(in srgb, ${theme.colors.textMuted} 12%, transparent)` }, children: ['safe', 'low', 'moderate', 'high', 'critical'].map((lvl) => {
                                            const cfg = SEVERITY[lvl];
                                            const isActive = occurrenceCount !== null && getSeverity(occurrenceCount).level === cfg.level;
                                            return (_jsx("div", { className: "flex-1 h-full transition-all duration-500", style: {
                                                    background: isActive ? cfg.color : `color-mix(in srgb, ${cfg.color} 20%, transparent)`,
                                                    opacity: isActive ? 1 : 0.5,
                                                } }, lvl));
                                        }) }), _jsx("div", { className: "text-[10px] uppercase tracking-wider font-semibold transition-all duration-500", style: { color: severity.color }, children: occurrenceCount > 0 ? (_jsxs("span", { children: [occurrenceCount, " occurrence", occurrenceCount !== 1 ? 's' : '', " \u2014", ' ', Math.round((occurrenceCount / Math.max(totalRepoFiles, 1)) * 100), "% of repo"] })) : (_jsx("span", { children: "Clean \u2014 no patterns found" })) })] }), terms.length > 0 && (_jsxs("div", { className: "px-3 py-2 rounded-lg text-xs flex items-center gap-2 flex-wrap", style: {
                                    background: `color-mix(in srgb, ${theme.colors.textMuted} 8%, transparent)`,
                                    color: theme.colors.textSecondary,
                                }, children: [_jsx("span", { style: { color: theme.colors.textMuted }, children: "Terms:" }), terms.map((t) => (_jsx("code", { className: "px-1.5 py-0.5 rounded text-xs", style: {
                                            background: `color-mix(in srgb, ${theme.colors.textMuted} 12%, transparent)`,
                                            fontFamily: theme.fonts.monospace,
                                            color: theme.colors.text,
                                        }, children: t }, t)))] })), files.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "text-xs font-medium", style: { color: theme.colors.textMuted }, children: ["Matching files (", fileCount, " total)"] }), (() => {
                                        const termOrder = terms.length > 0 ? terms : Array.from(new Set(files.flatMap((f) => f.matched_terms)));
                                        const grouped = new Map();
                                        const ungrouped = [];
                                        for (const f of files) {
                                            const fTerms = f.matched_terms.filter((t) => termOrder.includes(t));
                                            if (fTerms.length === 0) {
                                                ungrouped.push(f);
                                                continue;
                                            }
                                            for (const t of fTerms) {
                                                if (!grouped.has(t))
                                                    grouped.set(t, []);
                                                grouped.get(t).push(f);
                                            }
                                        }
                                        return (_jsxs(_Fragment, { children: [termOrder.map((term) => {
                                                    const termFiles = grouped.get(term);
                                                    if (!termFiles || termFiles.length === 0)
                                                        return null;
                                                    const maxShow = 20;
                                                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-1", style: {
                                                                    background: `color-mix(in srgb, ${theme.colors.primary} 10%, transparent)`,
                                                                    color: theme.colors.primary,
                                                                }, children: [_jsx("span", { className: "px-1.5 py-0.5 rounded font-mono", style: { background: `color-mix(in srgb, ${theme.colors.primary} 15%, transparent)` }, children: term }), _jsxs("span", { style: { color: theme.colors.textMuted }, children: [termFiles.length, " file", termFiles.length !== 1 ? 's' : ''] })] }), _jsxs("div", { className: "max-h-[240px] overflow-y-auto space-y-0.5 rounded-lg border ml-2", style: {
                                                                    borderColor: `color-mix(in srgb, ${theme.colors.textMuted} 12%, transparent)`,
                                                                    scrollbarWidth: 'thin',
                                                                }, children: [termFiles.slice(0, maxShow).map((f) => (_jsxs("a", { href: f.html_url, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:opacity-80 rounded", style: {
                                                                            color: theme.colors.textSecondary,
                                                                            fontFamily: theme.fonts.monospace,
                                                                        }, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full shrink-0", style: { background: severity.color, opacity: 0.6 } }), f.path] }, `${term}:${f.path}`))), termFiles.length > maxShow && (_jsxs("div", { className: "px-2.5 py-1.5 text-xs", style: { color: theme.colors.textMuted }, children: ["+", termFiles.length - maxShow, " more files"] }))] })] }, term));
                                                }), ungrouped.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "text-xs font-medium px-2 py-1 mb-1", style: { color: theme.colors.textMuted }, children: ["Other (", ungrouped.length, ")"] }), _jsxs("div", { className: "max-h-[240px] overflow-y-auto space-y-0.5 rounded-lg border ml-2", style: {
                                                                borderColor: `color-mix(in srgb, ${theme.colors.textMuted} 12%, transparent)`,
                                                                scrollbarWidth: 'thin',
                                                            }, children: [ungrouped.slice(0, 20).map((f) => (_jsxs("a", { href: f.html_url, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:opacity-80 rounded", style: {
                                                                        color: theme.colors.textSecondary,
                                                                        fontFamily: theme.fonts.monospace,
                                                                    }, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full shrink-0", style: { background: severity.color, opacity: 0.6 } }), f.path] }, f.path))), ungrouped.length > 20 && (_jsxs("div", { className: "px-2.5 py-1.5 text-xs", style: { color: theme.colors.textMuted }, children: ["+", ungrouped.length - 20, " more files"] }))] })] }))] }));
                                    })()] }))] })), !hasResults && !loading && !error && !scanActive && (_jsxs("div", { className: "flex flex-col items-center gap-3 py-8", children: [_jsx(Code2, { className: "w-8 h-8", style: { color: theme.colors.textMuted } }), _jsx("div", { className: "text-sm text-center", style: { color: theme.colors.textMuted }, children: "Click the vibe coding button in the header to scan this repo." })] }))] })] }));
}
