'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * "Line Counts" — left-panel status block for the File City dataset (building
 * heights + contributor ownership). Sits under the nav cards in ToursPane and
 * reports, from `useRepoAnalysis().meta`:
 *   - whether a warm VM is held for this repo,
 *   - the commit the data was last built at (the cached `sha`),
 *   - whether HEAD has moved past it (a rebuild is due),
 * and offers a single action: Get Line Count Data (never built) or Rebuild.
 */
import { useTheme } from '@principal-ade/industry-theme';
import { Boxes, Check, ChevronDown, GitCommitHorizontal, Play, RefreshCw, Server, Users, } from 'lucide-react';
import { useState } from 'react';
import { REPO_ANALYSIS_ENABLED, useRepoAnalysis } from './RepoAnalysisContext';
const FRESH_GREEN = '#3fb950';
/**
 * On-theme progress loader: a little bar-chart "equalizer" whose bars rise and
 * fall in a staggered wave, evoking the line-count / 3D-city building heights
 * being (re)built. Reads better here than a generic spinner.
 */
function BarsLoader({ color, height = 14 }) {
    return (_jsxs("span", { "aria-hidden": true, className: "inline-flex items-end", style: { gap: 2, height }, children: [[0, 1, 2, 3].map((i) => (_jsx("span", { style: {
                    width: 2.5,
                    borderRadius: 1,
                    background: color,
                    animation: 'lc-bars 1000ms ease-in-out infinite',
                    // Negative offsets start each bar mid-wave so the set is desynced
                    // from the first frame (no flat "all bars equal" pop-in).
                    animationDelay: `${i * -150}ms`,
                } }, i))), _jsx("style", { children: '@keyframes lc-bars { 0%, 100% { height: 25%; opacity: 0.55 } 50% { height: 100%; opacity: 1 } }' })] }));
}
export function RepoAnalysisStatus() {
    const { meta, state, analysis, run } = useRepoAnalysis();
    const { theme } = useTheme();
    // Collapsed by default: only the header row shows; the detail card slides open
    // below it on click. The header is identical in both states so toggling
    // animates rather than swapping layouts.
    const [expanded, setExpanded] = useState(false);
    // Feature disabled for now (see REPO_ANALYSIS_ENABLED). Render a muted, inert
    // header so the surface stays visible but is clearly off.
    if (!REPO_ANALYSIS_ENABLED) {
        return (_jsxs("div", { className: "flex items-center gap-1.5 px-4 py-3", children: [_jsx(Boxes, { size: 14, style: { color: theme.colors.textMuted } }), _jsx("span", { style: {
                        fontSize: theme.fontSizes[0],
                        fontWeight: theme.fontWeights.semibold,
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }, children: "Line Counts" }), _jsx("span", { style: { fontSize: theme.fontSizes[0], color: theme.colors.textMuted }, children: "Not available yet" })] }));
    }
    const running = state.kind === 'running';
    const analyzed = Boolean(meta?.sha) || Boolean(analysis);
    const hasVm = Boolean(meta?.hasWarmVm);
    const stale = Boolean(meta?.stale);
    const shortSha = meta?.sha ? meta.sha.slice(0, 7) : null;
    // Don't paint anything until the mount GET has resolved freshness.
    if (!meta && !analysis)
        return null;
    const rowLabel = {
        fontSize: theme.fontSizes[1],
        color: theme.colors.textSecondary,
        lineHeight: 1.4,
    };
    const rowValue = {
        fontSize: theme.fontSizes[1],
        color: theme.colors.text,
        lineHeight: 1.4,
    };
    const actionLabel = running
        ? analyzed
            ? 'Rebuilding…'
            : 'Getting data…'
        : analyzed
            ? 'Rebuild'
            : 'Get Line Count Data';
    return (_jsxs("div", { className: "relative flex flex-col px-4 py-3", children: [_jsx("div", { role: "button", tabIndex: 0, "aria-expanded": expanded, onClick: () => setExpanded((e) => !e), onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpanded((x) => !x);
                    }
                }, className: "flex items-center justify-between gap-2 rounded-md -mx-1 px-1 py-0.5 transition-opacity hover:opacity-70", style: { cursor: 'pointer' }, children: _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Boxes, { size: 14, style: { color: theme.colors.primary } }), _jsx("span", { style: {
                                fontSize: theme.fontSizes[0],
                                fontWeight: theme.fontWeights.semibold,
                                color: theme.colors.textSecondary,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }, children: "Line Counts" }), running ? (_jsx(BarsLoader, { color: theme.colors.primary, height: 12 })) : (analyzed && (_jsx("span", { title: stale ? 'Update available' : 'Up to date', style: {
                                width: 7,
                                height: 7,
                                borderRadius: 9999,
                                background: stale ? theme.colors.accent : FRESH_GREEN,
                                boxShadow: stale
                                    ? 'none'
                                    : `0 0 0 3px color-mix(in srgb, ${FRESH_GREEN} 22%, transparent)`,
                            } }))), _jsx(ChevronDown, { size: 14, style: {
                                color: theme.colors.textMuted,
                                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 220ms ease',
                            } })] }) }), _jsx("div", { style: {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '100%',
                    display: 'grid',
                    gridTemplateRows: expanded ? '1fr' : '0fr',
                    transition: 'grid-template-rows 240ms ease',
                    pointerEvents: expanded ? 'auto' : 'none',
                }, children: _jsx("div", { style: { overflow: 'hidden', minHeight: 0 }, children: _jsx("div", { className: "px-4 pt-3 pb-2", style: {
                            background: theme.colors.background,
                            borderTop: `1px solid ${theme.colors.border}`,
                            boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.28)',
                        }, children: _jsxs("div", { className: "flex flex-col gap-3 rounded-lg border p-3", style: {
                                borderColor: theme.colors.border,
                                background: `color-mix(in srgb, ${theme.colors.text} 4%, transparent)`,
                                color: theme.colors.text,
                            }, children: [analyzed && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col gap-2.5", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("span", { className: "flex items-center gap-2", style: rowLabel, children: [_jsx(Server, { size: 14, style: { color: theme.colors.textMuted } }), "Warm VM"] }), _jsxs("span", { className: "inline-flex items-center gap-1.5", style: rowValue, children: [_jsx("span", { style: {
                                                                        width: 7,
                                                                        height: 7,
                                                                        borderRadius: 9999,
                                                                        background: hasVm ? FRESH_GREEN : theme.colors.textMuted,
                                                                        boxShadow: hasVm
                                                                            ? `0 0 0 3px color-mix(in srgb, ${FRESH_GREEN} 22%, transparent)`
                                                                            : 'none',
                                                                    } }), hasVm ? 'Ready' : 'Cold start'] })] }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("span", { className: "flex items-center gap-2", style: rowLabel, children: [_jsx(GitCommitHorizontal, { size: 14, style: { color: theme.colors.textMuted } }), "Last built"] }), _jsx("code", { style: {
                                                                fontSize: theme.fontSizes[0],
                                                                color: theme.colors.text,
                                                                background: `color-mix(in srgb, ${theme.colors.text} 7%, transparent)`,
                                                                padding: '1px 6px',
                                                                borderRadius: 4,
                                                            }, children: shortSha ?? '—' })] }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { style: rowLabel, children: "Status" }), _jsxs("span", { className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5", style: {
                                                                fontSize: theme.fontSizes[0],
                                                                fontWeight: theme.fontWeights.semibold,
                                                                color: stale ? theme.colors.accent : FRESH_GREEN,
                                                                background: stale
                                                                    ? `color-mix(in srgb, ${theme.colors.accent} 15%, transparent)`
                                                                    : `color-mix(in srgb, ${FRESH_GREEN} 15%, transparent)`,
                                                            }, children: [stale ? _jsx(RefreshCw, { size: 11 }) : _jsx(Check, { size: 11 }), stale ? 'Update available' : 'Up to date'] })] })] }), _jsx("div", { className: "h-px w-full", style: { background: theme.colors.border } })] })), state.kind === 'error' && (_jsx("div", { style: { fontSize: theme.fontSizes[0], color: '#f0a0a0', lineHeight: 1.4 }, children: state.message })), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("span", { style: {
                                                fontSize: theme.fontSizes[0],
                                                color: theme.colors.textMuted,
                                                lineHeight: 1.4,
                                            }, children: "Line count data powers" }), _jsx("div", { className: "flex gap-1.5", children: [
                                                { icon: _jsx(Users, { size: 13 }), label: 'Contributor coverage' },
                                                { icon: _jsx(Boxes, { size: 13 }), label: '3D visualization' },
                                            ].map((f) => (_jsxs("span", { className: "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-center", style: {
                                                    fontSize: theme.fontSizes[0],
                                                    color: theme.colors.textSecondary,
                                                    background: `color-mix(in srgb, ${theme.colors.text} 5%, transparent)`,
                                                    border: `1px solid ${theme.colors.border}`,
                                                }, children: [_jsx("span", { style: { color: theme.colors.primary, display: 'inline-flex' }, children: f.icon }), f.label] }, f.label))) })] }), _jsxs("button", { type: "button", onClick: run, disabled: running, className: "flex items-center justify-center gap-2 rounded-md px-3 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-60", style: {
                                        background: theme.colors.primary,
                                        color: '#fff',
                                        fontSize: theme.fontSizes[1],
                                        fontWeight: theme.fontWeights.semibold,
                                        cursor: running ? 'wait' : 'pointer',
                                        boxShadow: `0 1px 2px color-mix(in srgb, ${theme.colors.primary} 40%, transparent)`,
                                    }, children: [running ? (_jsx(BarsLoader, { color: "#ffffff", height: 14 })) : analyzed ? (_jsx(RefreshCw, { size: 14 })) : (_jsx(Play, { size: 14 })), actionLabel] })] }) }) }) })] }));
}
