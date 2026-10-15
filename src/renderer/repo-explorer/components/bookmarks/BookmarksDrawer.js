'use client';
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { BookmarksPanel } from './BookmarksPanel';
import { useAuth } from '@repo-explorer/contexts/AuthContext';
import { CollectionsBookmarkPanel } from './CollectionsBookmarkPanel';
// Right-docked slide-in shell for the bookmarks passport. Stays mounted and
// animates with a translateX transition driven by a RAF "entered" flag — the
// same approach as FileSourcePanel — plus a dismissable backdrop scrim.
export function BookmarksDrawer({ open, onClose, currentRepo, onNavigate, }) {
    const { theme } = useTheme();
    const { user } = useAuth();
    const [entered, setEntered] = React.useState(false);
    React.useEffect(() => {
        if (!open) {
            setEntered(false);
            return;
        }
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, [open]);
    // Close on Escape while open.
    React.useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { "aria-hidden": !open, onClick: onClose, style: {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 49,
                    background: 'rgba(0,0,0,0.4)',
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 360ms cubic-bezier(0.22, 1, 0.36, 1)',
                    pointerEvents: open ? 'auto' : 'none',
                } }), _jsx("div", { "aria-hidden": !open, role: "dialog", "aria-label": "Bookmarks", style: {
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 50,
                    width: 'min(360px, 95vw)',
                    transform: entered ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
                    boxShadow: entered ? '-12px 0 32px rgba(0,0,0,0.35)' : 'none',
                    pointerEvents: open ? 'auto' : 'none',
                    background: theme.colors.background,
                }, children: user ? (currentRepo ? (_jsx(CollectionsBookmarkPanel, { currentRepo: currentRepo, onClose: onClose })) : (_jsx("div", { className: "flex h-full w-full flex-col justify-center items-center gap-2 text-sm", style: { color: theme.colors.textMuted }, children: "Loading repository metadata..." }))) : (_jsx(BookmarksPanel, { currentRepo: currentRepo, onNavigate: onNavigate, onClose: onClose })) })] }));
}
