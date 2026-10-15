'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * RepoPullRequestsPane
 *
 * Left-rail view listing the repo's GitHub pull requests (newest-updated
 * first), filterable by open / closed / all. Selecting a PR opens it in the
 * File City panel's native PR mode (header + description + Files/Details tabs,
 * changed buildings lit on the city). Mirrors RepoIssuesPane; PRs are loaded a
 * page at a time via `useRepoPullRequests`.
 */
import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitPullRequest, GitPullRequestClosed, GitMerge, ChevronLeft, } from 'lucide-react';
import { useRepoPullRequests, } from '@repo-explorer/hooks/useRepoPullRequests';
import { InlineTrailLoader } from '@repo-explorer/components/trail/InlineTrailLoader';
const OPEN_COLOR = '#22c55e';
const MERGED_COLOR = '#8957e5';
const CLOSED_COLOR = '#cf222e';
function relativeTime(iso) {
    if (!iso)
        return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then))
        return '';
    const secs = Math.max(0, (Date.now() - then) / 1000);
    const DAY = 86400;
    if (secs < DAY)
        return 'today';
    const days = Math.floor(secs / DAY);
    if (days < 7)
        return `${days}d ago`;
    if (days < 30)
        return `${Math.floor(days / 7)}w ago`;
    if (days < 365)
        return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}
/** GitHub stores label colors as `d73a4a` (no `#`); normalize for CSS. */
function labelColor(color) {
    const c = color?.trim();
    if (!c)
        return null;
    return c.startsWith('#') ? c : `#${c}`;
}
const PrRow = ({ pr, selected, onSelect, onHover }) => {
    const { theme } = useTheme();
    // GitHub encodes a merged PR as state:'closed' + a set merged_at.
    const isMerged = Boolean(pr.merged_at);
    const isClosed = pr.state === 'closed' && !isMerged;
    const StateIcon = isMerged
        ? GitMerge
        : isClosed
            ? GitPullRequestClosed
            : GitPullRequest;
    const stateColor = isMerged
        ? MERGED_COLOR
        : isClosed
            ? CLOSED_COLOR
            : OPEN_COLOR;
    // Unlike issue labels (a `string | object` union), `pull-request-simple`
    // labels are plain objects with a required `name`.
    const labels = (pr.labels ?? [])
        .map((l) => ({ name: l.name, color: l.color ?? undefined }))
        .filter((l) => Boolean(l.name));
    return (_jsxs("button", { type: "button", onClick: onSelect, className: "w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-b", style: {
            borderColor: theme.colors.border,
            background: selected ? theme.colors.backgroundSecondary : 'transparent',
            cursor: 'pointer',
        }, onMouseEnter: (e) => {
            if (!selected)
                e.currentTarget.style.background = theme.colors.backgroundSecondary;
            onHover?.(true);
        }, onMouseLeave: (e) => {
            if (!selected)
                e.currentTarget.style.background = 'transparent';
            onHover?.(false);
        }, children: [_jsx(StateIcon, { size: 16, style: { color: stateColor, flexShrink: 0, marginTop: 2 } }), _jsxs("div", { className: "min-w-0 flex-1 flex flex-col gap-1", children: [_jsx("span", { className: "line-clamp-2", style: {
                            color: theme.colors.text,
                            fontSize: theme.fontSizes[1],
                            fontWeight: 500,
                            lineHeight: 1.35,
                        }, children: pr.title }), labels.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1", children: labels.slice(0, 4).map((l) => {
                            const color = labelColor(l.color) ?? theme.colors.textMuted;
                            return (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full px-1.5", style: {
                                    border: `1px solid ${color}55`,
                                    background: `${color}22`,
                                    fontSize: theme.fontSizes[0],
                                    color: theme.colors.textSecondary,
                                }, children: [_jsx("span", { style: {
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: color,
                                        } }), l.name] }, l.name));
                        }) })), _jsxs("div", { className: "flex items-center gap-2", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[0] }, children: [_jsxs("span", { children: ["#", pr.number] }), _jsxs("span", { children: ["\u00B7 ", relativeTime(pr.updated_at)] }), pr.draft && _jsx("span", { children: "\u00B7 Draft" })] })] })] }));
};
export const RepoPullRequestsPane = ({ owner, repo, selectedPrNumber, onSelectPr, onClose, onVisiblePrsChange, onHoverPr, filteredPrNumbers, onClearFileFilter, }) => {
    const { theme } = useTheme();
    const [stateFilter, setStateFilter] = React.useState('open');
    const { pullRequests, loading, loadingMore, error, hasMore, loadMore, refresh } = useRepoPullRequests(owner, repo, { state: stateFilter });
    // File-driven filter: when a building is clicked in the city, narrow the list.
    const displayedPullRequests = React.useMemo(() => {
        if (!filteredPrNumbers)
            return pullRequests;
        const allowed = new Set(filteredPrNumbers);
        return pullRequests.filter((pr) => allowed.has(pr.number));
    }, [pullRequests, filteredPrNumbers]);
    React.useEffect(() => {
        onVisiblePrsChange?.(pullRequests.map((pr) => pr.number));
    }, [pullRequests, onVisiblePrsChange]);
    return (_jsxs("div", { className: "flex flex-col h-full min-h-0", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2.5 border-b shrink-0", style: { borderColor: theme.colors.border }, children: [onClose && (_jsx("button", { type: "button", onClick: onClose, className: "shrink-0 p-1 rounded transition-opacity hover:opacity-70", style: { color: theme.colors.textMuted, cursor: 'pointer' }, title: "Back", children: _jsx(ChevronLeft, { size: 18 }) })), _jsx("span", { className: "flex-1", style: {
                            color: theme.colors.text,
                            fontSize: theme.fontSizes[2],
                            fontWeight: theme.fontWeights.semibold,
                        }, children: "Pull requests" }), _jsx("div", { className: "flex items-center gap-1", children: ['open', 'closed', 'all'].map((s) => (_jsx("button", { type: "button", onClick: () => setStateFilter(s), className: "px-2 py-0.5 rounded transition-colors", style: {
                                fontSize: theme.fontSizes[0],
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                background: stateFilter === s
                                    ? theme.colors.backgroundSecondary
                                    : 'transparent',
                                color: stateFilter === s ? theme.colors.text : theme.colors.textMuted,
                                border: `1px solid ${stateFilter === s ? theme.colors.border : 'transparent'}`,
                            }, children: s }, s))) })] }), filteredPrNumbers && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-1.5 border-b shrink-0", style: {
                    borderColor: theme.colors.border,
                    background: theme.colors.backgroundSecondary,
                }, children: [_jsxs("span", { className: "flex-1 truncate", style: {
                            color: theme.colors.text,
                            fontSize: theme.fontSizes[0],
                        }, children: [filteredPrNumbers.length, " PR", filteredPrNumbers.length !== 1 ? 's' : '', " touch this file"] }), _jsx("button", { type: "button", onClick: onClearFileFilter, className: "shrink-0 px-1.5 py-0.5 rounded transition-opacity hover:opacity-70", style: {
                            color: theme.colors.textMuted,
                            fontSize: theme.fontSizes[0],
                            cursor: 'pointer',
                        }, children: "Clear" })] })), loading && pullRequests.length === 0 ? (_jsxs("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center py-12 gap-3", children: [_jsx(InlineTrailLoader, { size: 40 }), _jsx("span", { style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: "Loading pull requests\u2026" })] })) : error && pullRequests.length === 0 ? (_jsxs("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center py-12 gap-3 px-6 text-center", children: [_jsx("span", { style: { color: theme.colors.error, fontSize: theme.fontSizes[1] }, children: "Failed to load pull requests" }), _jsx("span", { style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[0] }, children: error }), _jsx("button", { type: "button", onClick: refresh, className: "px-3 py-1.5 rounded transition-opacity hover:opacity-80", style: {
                            background: theme.colors.backgroundSecondary,
                            color: theme.colors.text,
                            border: `1px solid ${theme.colors.border}`,
                            fontSize: theme.fontSizes[1],
                            cursor: 'pointer',
                        }, children: "Retry" })] })) : pullRequests.length === 0 ? (_jsx("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center py-12 px-6 text-center", children: _jsxs("span", { style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: ["No ", stateFilter === 'all' ? '' : `${stateFilter} `, "pull requests found"] }) })) : (_jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [displayedPullRequests.map((pr) => (_jsx(PrRow, { pr: pr, selected: pr.number === selectedPrNumber, onSelect: () => onSelectPr(pr.number === selectedPrNumber ? null : pr.number), onHover: (hovering) => onHoverPr?.(hovering ? pr.number : null) }, pr.id))), hasMore && (_jsx("div", { className: "p-3", children: _jsx("button", { type: "button", onClick: loadMore, disabled: loadingMore, className: "w-full py-2 rounded flex items-center justify-center gap-2 transition-opacity hover:opacity-80", style: {
                                background: theme.colors.backgroundSecondary,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                fontSize: theme.fontSizes[1],
                                cursor: loadingMore ? 'default' : 'pointer',
                            }, children: loadingMore ? (_jsxs(_Fragment, { children: [_jsx(InlineTrailLoader, { size: 14 }), " Loading\u2026"] })) : ('Load more') }) }))] }))] }));
};
