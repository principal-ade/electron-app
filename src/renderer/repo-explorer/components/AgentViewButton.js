'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Title-bar button that opens the {@link AgentViewModal} for a given page.
 * Owns its own open/close state so a header can drop it in with just the
 * canonical `path` of the page being viewed.
 *
 * Two shapes: the default labelled pill (matches the "Share With Agent"
 * button) and `iconOnly` for headers that only have room for a 32px icon
 * slot (e.g. the repo overview header).
 */
import { useState } from 'react';
import { Bot } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { AgentViewModal } from '@repo-explorer/components/AgentViewModal';
export function AgentViewButton({ path, iconOnly = false, label = 'Agent View', }) {
    const { theme } = useTheme();
    const [open, setOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [iconOnly ? (_jsx("button", { type: "button", onClick: () => setOpen(true), className: "flex items-center justify-center w-8 h-8 rounded-md transition-all hover:opacity-80", style: { color: theme.colors.text, cursor: 'pointer' }, title: "See what an agent sees", "aria-label": "See what an agent sees", children: _jsx(Bot, { className: "w-5 h-5" }) })) : (_jsxs("button", { type: "button", onClick: () => setOpen(true), className: "flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-all hover:opacity-80", style: {
                    background: 'transparent',
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    fontFamily: theme.fonts.body,
                    cursor: 'pointer',
                }, title: "See what an agent sees", "aria-label": "See what an agent sees", children: [_jsx(Bot, { className: "w-4 h-4" }), _jsx("span", { children: label })] })), open && _jsx(AgentViewModal, { path: path, onClose: () => setOpen(false) })] }));
}
