'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
// ---------------------------------------------------------------------------
// RailPaneHeader — the sticky header a rail's destination pane leads with. It
// carries an eyebrow title (icon + label + optional count) and a dismiss
// control: a trailing X by default, or a leading back chevron (`closeAsBack`)
// for panes that slide in over an overview. Extracted from the owner/repo
// explorer so the signed-in home rail reuses the same back-to-overview mechanic.
// ---------------------------------------------------------------------------
export const RailPaneHeader = ({ icon, label, count, onClose, onBack, backContent, closeAsBack, crumb }) => {
    const { theme } = useTheme();
    if (closeAsBack) {
        // Back goes up one level: a nested `onBack` (e.g. the selected contributor)
        // returns to this pane's list, otherwise `onClose` returns to the overview.
        const goBack = onBack ?? onClose;
        const backLabel = onBack ? `Back to ${label.toLowerCase()}` : 'Back to overview';
        return (_jsxs("div", { className: "px-3 py-2 border-b sticky top-0 z-10 shrink-0 flex items-center gap-1.5", style: {
                borderColor: theme.colors.border,
                background: theme.colors.background,
            }, children: [_jsxs("button", { type: "button", onClick: goBack, className: "flex items-center gap-2 -ml-1 px-1.5 py-1 rounded transition-opacity hover:opacity-70 shrink-0", style: { color: theme.colors.textSecondary, cursor: 'pointer' }, title: backLabel, "aria-label": backLabel, children: [_jsx(ChevronLeft, { size: 16 }), _jsx("span", { style: {
                                fontSize: theme.fontSizes[0],
                                fontWeight: theme.fontWeights.semibold,
                                color: theme.colors.textSecondary,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }, children: label }), count !== undefined && crumb === undefined && (_jsx("span", { style: { fontSize: theme.fontSizes[0], color: theme.colors.textMuted }, children: count }))] }), crumb !== undefined && (_jsxs(_Fragment, { children: [_jsx(ChevronRight, { size: 14, style: { color: theme.colors.textMuted, flexShrink: 0 } }), _jsx("span", { className: "truncate", style: {
                                fontSize: theme.fontSizes[1],
                                fontWeight: theme.fontWeights.semibold,
                                color: theme.colors.text,
                            }, children: crumb })] }))] }));
    }
    return (_jsxs("div", { className: `px-4 border-b sticky top-0 z-10 shrink-0 flex items-center gap-2 ${onBack ? 'py-3' : 'py-2'}`, style: {
            borderColor: theme.colors.border,
            background: theme.colors.background,
        }, children: [onBack ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: onBack, className: "flex items-center justify-center w-6 h-6 -ml-1 rounded transition-opacity hover:opacity-70", style: { color: theme.colors.textSecondary, cursor: 'pointer' }, title: `Back to ${label.toLowerCase()}`, "aria-label": `Back to ${label.toLowerCase()}`, children: _jsx(ChevronLeft, { size: 16 }) }), backContent] })) : (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: icon }), _jsx("span", { style: {
                            fontSize: theme.fontSizes[0],
                            fontWeight: theme.fontWeights.semibold,
                            color: theme.colors.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }, children: label }), count !== undefined && (_jsx("span", { style: { fontSize: theme.fontSizes[0], color: theme.colors.textMuted }, children: count }))] })), _jsx("button", { type: "button", onClick: onClose, className: "ml-auto flex items-center justify-center w-6 h-6 rounded transition-opacity hover:opacity-70", style: { color: theme.colors.textMuted, cursor: 'pointer' }, title: "Close", "aria-label": "Close", children: _jsx(X, { size: 14 }) })] }));
};
