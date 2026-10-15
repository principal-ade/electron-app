'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X, BookmarkPlus, GripVertical, Check } from 'lucide-react';
import { REPO_DND_MIME, REPO_JSON_DND_MIME } from './types';
import { PassportStamp } from './PassportStamp';
import { useBookmarks } from './useBookmarks';
// The bookmarks "passport", rendered as a single vertical column of stamp
// slots. The current repo can be dragged into any empty slot; placed stamps can
// be reordered by dragging, removed with their × button, or opened by clicking.
// Fills its container (the page wraps it in the sliding drawer shell).
export function BookmarksPanel({ currentRepo, onNavigate, onClose, }) {
    const { theme } = useTheme();
    const ink = theme.colors.primary;
    const { slots, place, move, remove, setNote, has } = useBookmarks();
    const [dragOver, setDragOver] = React.useState(null);
    const [editingSlot, setEditingSlot] = React.useState(null);
    const currentSaved = currentRepo ? has(currentRepo.full_name) : false;
    const handleDrop = (targetIndex, e) => {
        e.preventDefault();
        setDragOver(null);
        const fromSlotRaw = e.dataTransfer.getData('text/x-from-slot');
        if (fromSlotRaw !== '') {
            move(Number(fromSlotRaw), targetIndex);
            return;
        }
        const json = e.dataTransfer.getData(REPO_JSON_DND_MIME);
        if (json) {
            try {
                place(targetIndex, JSON.parse(json));
            }
            catch {
                // ignore malformed payloads
            }
        }
    };
    // Drop the current repo into the first empty slot (the one-click affordance
    // next to drag-to-place).
    const addCurrentToFirstEmpty = () => {
        if (!currentRepo)
            return;
        const empty = slots.findIndex((s) => s === null);
        place(empty === -1 ? slots.length - 1 : empty, currentRepo);
    };
    return (_jsxs("div", { className: "flex h-full w-full flex-col", style: {
            background: theme.colors.background,
            borderLeft: `1px solid ${theme.colors.border}`,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
        }, children: [_jsxs("div", { className: "flex items-center justify-between", style: {
                    padding: '14px 16px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                }, children: [_jsxs("div", { children: [_jsx("div", { style: {
                                    fontSize: theme.fontSizes[3],
                                    fontWeight: theme.fontWeights.bold,
                                    letterSpacing: '0.4px',
                                }, children: "Bookmarks" }), _jsx("div", { style: {
                                    fontSize: theme.fontSizes[0],
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase',
                                    color: theme.colors.accent,
                                    fontWeight: theme.fontWeights.bold,
                                }, children: "\u2726 Repo Passport \u2726" })] }), _jsx("button", { type: "button", "aria-label": "Close bookmarks", onClick: onClose, className: "flex items-center justify-center transition-opacity hover:opacity-70", style: {
                            width: 30,
                            height: 30,
                            borderRadius: theme.radii[1] ?? 6,
                            color: theme.colors.textMuted,
                        }, children: _jsx(X, { size: 18 }) })] }), currentRepo && (_jsxs("div", { style: { padding: '12px 16px' }, children: [_jsx("div", { style: {
                            fontSize: theme.fontSizes[0],
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            color: theme.colors.textMuted,
                            marginBottom: 6,
                        }, children: currentSaved ? 'Currently viewing — already saved' : 'Currently viewing' }), _jsxs("div", { draggable: !currentSaved, onDragStart: (e) => {
                            e.dataTransfer.setData(REPO_DND_MIME, currentRepo.full_name);
                            e.dataTransfer.setData(REPO_JSON_DND_MIME, JSON.stringify(currentRepo));
                            e.dataTransfer.effectAllowed = 'copy';
                        }, className: "flex items-center gap-2", style: {
                            padding: '8px 10px',
                            borderRadius: theme.radii[2] ?? 10,
                            background: theme.colors.surface,
                            border: `1px solid ${theme.colors.border}`,
                            cursor: currentSaved ? 'default' : 'grab',
                            opacity: currentSaved ? 0.5 : 1,
                        }, children: [!currentSaved && (_jsx(GripVertical, { size: 14, style: { color: theme.colors.textMuted, flexShrink: 0 } })), _jsx("img", { src: `${currentRepo.owner.avatar_url}${currentRepo.owner.avatar_url.includes('?') ? '&' : '?'}s=48`, alt: "", width: 24, height: 24, style: { borderRadius: theme.radii[1] ?? 5, flexShrink: 0 } }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate", style: {
                                            fontSize: theme.fontSizes[2],
                                            fontWeight: theme.fontWeights.semibold,
                                        }, children: currentRepo.name }), _jsx("div", { className: "truncate", style: { fontSize: theme.fontSizes[1], color: theme.colors.textMuted }, children: currentRepo.owner.login })] }), currentSaved ? (_jsx(Check, { size: 16, style: { color: theme.colors.success, flexShrink: 0 } })) : (_jsx("button", { type: "button", "aria-label": "Add current repo to bookmarks", title: "Add to first empty slot", onClick: addCurrentToFirstEmpty, className: "flex items-center justify-center transition-opacity hover:opacity-70", style: {
                                    width: 26,
                                    height: 26,
                                    borderRadius: theme.radii[1] ?? 6,
                                    color: ink,
                                    flexShrink: 0,
                                }, children: _jsx(BookmarkPlus, { size: 16 }) }))] })] })), _jsx("div", { className: "flex-1 overflow-y-auto", style: { padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }, children: slots.map((repo, slotIndex) => {
                    const isOver = dragOver === slotIndex;
                    return (_jsx("div", { onDragOver: (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOver !== slotIndex)
                                setDragOver(slotIndex);
                        }, onDragLeave: () => setDragOver((d) => (d === slotIndex ? null : d)), onDrop: (e) => handleDrop(slotIndex, e), style: {
                            position: 'relative',
                            flexShrink: 0,
                            minHeight: 84,
                            borderRadius: theme.radii[2] ?? 10,
                            ...(repo
                                ? { display: 'flex', flexDirection: 'column' }
                                : {
                                    border: `2px dashed ${isOver ? ink : `color-mix(in srgb, ${ink} 26%, transparent)`}`,
                                    background: isOver
                                        ? `color-mix(in srgb, ${ink} 8%, transparent)`
                                        : 'transparent',
                                    display: 'grid',
                                    placeItems: 'center',
                                    transition: 'background 120ms, border-color 120ms',
                                }),
                        }, children: repo ? (_jsxs(_Fragment, { children: [_jsx(PassportStamp, { repo: repo, note: repo.note, draggableFromSlot: slotIndex, onOpen: () => onNavigate(repo.full_name), onRemove: () => remove(slotIndex), onEditNote: () => setEditingSlot(slotIndex) }), editingSlot === slotIndex && (_jsx(NoteEditor, { initial: repo.note ?? '', onSave: (value) => {
                                        setNote(slotIndex, value);
                                        setEditingSlot(null);
                                    }, onCancel: () => setEditingSlot(null) }))] })) : (_jsxs("div", { style: {
                                textAlign: 'center',
                                color: isOver ? ink : theme.colors.textMuted,
                                fontSize: theme.fontSizes[1],
                                fontWeight: theme.fontWeights.semibold,
                                pointerEvents: 'none',
                            }, children: [_jsx("div", { style: { fontSize: 18, opacity: 0.5 }, children: "\u25CD" }), isOver ? 'Drop to stamp' : `Slot ${slotIndex + 1}`] })) }, slotIndex));
                }) })] }));
}
// Inline note editor shown beneath a stamp while editing. Autofocuses, saves on
// ⌘/Ctrl+Enter, cancels on Escape.
function NoteEditor({ initial, onSave, onCancel, }) {
    const { theme } = useTheme();
    const [value, setValue] = React.useState(initial);
    const ref = React.useRef(null);
    React.useEffect(() => {
        ref.current?.focus();
        ref.current?.select();
    }, []);
    return (_jsxs("div", { style: { marginTop: 8 }, children: [_jsx("textarea", { ref: ref, value: value, onChange: (e) => setValue(e.target.value), onKeyDown: (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                    }
                    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onSave(value);
                    }
                }, rows: 3, placeholder: "Add a note\u2026", className: "w-full bg-transparent outline-none resize-none", style: {
                    padding: '8px 10px',
                    borderRadius: theme.radii[1] ?? 6,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts.body,
                } }), _jsxs("div", { className: "flex items-center justify-end gap-2", style: { marginTop: 6 }, children: [_jsx("button", { type: "button", onClick: onCancel, className: "transition-opacity hover:opacity-70", style: {
                            fontSize: theme.fontSizes[1],
                            color: theme.colors.textMuted,
                            padding: '4px 8px',
                        }, children: "Cancel" }), _jsx("button", { type: "button", onClick: () => onSave(value), className: "transition-opacity hover:opacity-80", style: {
                            fontSize: theme.fontSizes[1],
                            fontWeight: theme.fontWeights.semibold,
                            color: theme.colors.textOnPrimary,
                            background: theme.colors.primary,
                            padding: '4px 12px',
                            borderRadius: theme.radii[1] ?? 6,
                        }, children: "Save" })] })] }));
}
