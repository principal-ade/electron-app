'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
/**
 * Small themed confirmation modal. The app has no shared confirm dialog — every
 * other destructive action used `window.confirm` — so this is the reusable one.
 * Mirrors the structure of the bespoke modals (portal to body, themed surface,
 * backdrop click + Escape to cancel).
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, busy = false, onConfirm, onCancel, }) {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !busy)
                onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, busy]);
    if (!mounted)
        return null;
    const confirmBg = destructive
        ? (theme.colors.error ?? '#dc2626')
        : theme.colors.primary;
    return createPortal(_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": title, onClick: () => {
            if (!busy)
                onCancel();
        }, className: "fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4", style: {
            background: 'rgba(0,0,0,0.55)',
            paddingTop: 'var(--safe-top)',
            zIndex: 2147483000,
        }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden", style: {
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
            }, children: [_jsx("div", { className: "px-5 pt-5 pb-2", children: _jsx("h2", { className: "text-base font-semibold", style: { color: theme.colors.text }, children: title }) }), _jsx("div", { className: "px-5 pb-5 text-sm leading-relaxed", style: { color: theme.colors.textMuted }, children: message }), _jsxs("div", { className: "px-5 py-3 border-t flex items-center justify-end gap-2", style: { borderColor: theme.colors.border }, children: [_jsx("button", { type: "button", onClick: onCancel, disabled: busy, className: "px-3 h-9 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50", style: {
                                background: 'transparent',
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                cursor: busy ? 'default' : 'pointer',
                            }, children: cancelLabel }), _jsx("button", { type: "button", onClick: onConfirm, disabled: busy, className: "px-3 h-9 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60", style: {
                                background: confirmBg,
                                color: theme.colors.background,
                                border: `1px solid ${confirmBg}`,
                                cursor: busy ? 'default' : 'pointer',
                            }, children: busy ? 'Working…' : confirmLabel })] })] }) }), document.body);
}
