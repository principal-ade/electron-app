'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '@principal-ade/industry-theme';
import { Star, X, GripVertical, StickyNote } from 'lucide-react';
import { REPO_DND_MIME } from './types';
// A placed repo, styled as an inked passport stamp: a squarish card sitting
// square in its slot, with the double "ink" border that reads as a stamp.
export function PassportStamp({ repo, onRemove, onOpen, note, onEditNote, draggableFromSlot, }) {
    const { theme } = useTheme();
    const ink = theme.colors.primary;
    return (_jsxs("div", { draggable: draggableFromSlot !== undefined, onDragStart: (e) => {
            if (draggableFromSlot === undefined)
                return;
            e.dataTransfer.setData(REPO_DND_MIME, repo.full_name);
            e.dataTransfer.setData('text/x-from-slot', String(draggableFromSlot));
            e.dataTransfer.effectAllowed = 'move';
        }, onClick: onOpen, role: onOpen ? 'button' : undefined, title: onOpen ? `Open ${repo.full_name}` : undefined, className: "group relative flex h-full w-full flex-col", style: {
            padding: '12px',
            borderRadius: theme.radii[2] ?? 8,
            background: `color-mix(in srgb, ${theme.colors.surface} 88%, ${ink})`,
            border: `2px solid ${ink}`,
            outline: `2px solid ${ink}`,
            outlineOffset: '3px',
            boxShadow: theme.shadows[1] ?? '0 4px 10px rgba(0,0,0,0.18)',
            color: theme.colors.text,
            cursor: draggableFromSlot !== undefined
                ? 'grab'
                : onOpen
                    ? 'pointer'
                    : 'default',
        }, children: [onRemove && (_jsx("button", { type: "button", "aria-label": `Remove ${repo.name}`, onClick: (e) => {
                    e.stopPropagation();
                    onRemove?.();
                }, className: "absolute opacity-0 transition-opacity group-hover:opacity-100", style: {
                    top: '4px',
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    border: `1px solid ${ink}`,
                    background: theme.colors.surface,
                    color: ink,
                    cursor: 'pointer',
                    zIndex: 2,
                }, children: _jsx(X, { size: 12 }) })), onEditNote && (_jsx("button", { type: "button", "aria-label": note ? `Edit note for ${repo.name}` : `Add a note to ${repo.name}`, title: note ? 'Edit note' : 'Add a note', onClick: (e) => {
                    e.stopPropagation();
                    onEditNote();
                }, className: `absolute transition-opacity ${note ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'}`, style: {
                    top: '4px',
                    right: onRemove ? '30px' : '4px',
                    width: '20px',
                    height: '20px',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    border: `1px solid ${ink}`,
                    background: note ? ink : theme.colors.surface,
                    color: note ? theme.colors.textOnPrimary : ink,
                    cursor: 'pointer',
                    zIndex: 2,
                }, children: _jsx(StickyNote, { size: 11 }) })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("img", { src: `${repo.owner.avatar_url}${repo.owner.avatar_url.includes('?') ? '&' : '?'}s=64`, alt: "", width: 28, height: 28, style: { borderRadius: theme.radii[1] ?? 6, flexShrink: 0 } }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate", style: {
                                    fontSize: theme.fontSizes[2],
                                    fontWeight: theme.fontWeights.bold,
                                    lineHeight: 1.15,
                                }, title: repo.name, children: repo.name }), _jsx("div", { className: "truncate", style: { fontSize: theme.fontSizes[1], color: theme.colors.textMuted }, title: repo.owner.login, children: repo.owner.login })] })] }), note && (_jsxs("div", { style: {
                    marginTop: '8px',
                    fontSize: theme.fontSizes[1],
                    fontStyle: 'italic',
                    color: theme.colors.textSecondary,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }, title: note, children: ["\u201C", note, "\u201D"] })), _jsxs("div", { className: "mt-auto flex items-center justify-between", style: { paddingTop: '8px', color: theme.colors.textSecondary }, children: [repo.language ? (_jsx("span", { style: {
                            fontSize: theme.fontSizes[0],
                            fontWeight: theme.fontWeights.semibold,
                            letterSpacing: '0.3px',
                        }, children: repo.language })) : (_jsx("span", { style: { fontSize: theme.fontSizes[0], color: theme.colors.accent, letterSpacing: '1px' }, children: "\u2726 ENTRY \u2726" })), typeof repo.stargazers_count === 'number' && (_jsxs("span", { className: "flex items-center gap-1", style: { fontSize: theme.fontSizes[1] }, children: [_jsx(Star, { size: 11 }), repo.stargazers_count.toLocaleString()] }))] }), draggableFromSlot !== undefined && (_jsx(GripVertical, { size: 12, "aria-hidden": true, className: "absolute opacity-0 transition-opacity group-hover:opacity-60", style: { bottom: '4px', left: '2px', color: ink } }))] }));
}
