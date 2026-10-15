'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Layers, Globe, Lock, Plus, Check, Loader2, X, FolderPlus } from 'lucide-react';
export function CollectionsBookmarkPanel({ currentRepo, onClose, }) {
    const { theme } = useTheme();
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Create collection state
    const [isCreating, setIsCreating] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionDesc, setNewCollectionDesc] = useState('');
    const [newCollectionVis, setNewCollectionVis] = useState('private');
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState(null);
    // Toggle in-progress states keyed by collectionId
    const [togglingIds, setTogglingIds] = useState({});
    const fetchCollections = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/starred-collections');
            if (!res.ok) {
                throw new Error('Failed to fetch collections');
            }
            const data = await res.json();
            setCollections(data.collections || []);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load collections');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchCollections();
    }, [fetchCollections]);
    const handleToggleRepo = async (collection) => {
        const isSaved = collection.repos.some((r) => r.owner.toLowerCase() === currentRepo.owner.login.toLowerCase() &&
            r.repo.toLowerCase() === currentRepo.name.toLowerCase());
        setTogglingIds((prev) => ({ ...prev, [collection.id]: true }));
        try {
            if (isSaved) {
                // DELETE
                const res = await fetch(`/api/starred-collections/${collection.id}/repos/${currentRepo.owner.login}/${currentRepo.name}`, { method: 'DELETE' });
                if (!res.ok) {
                    throw new Error('Failed to remove repository');
                }
            }
            else {
                // POST
                const res = await fetch(`/api/starred-collections/${collection.id}/repos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        owner: currentRepo.owner.login,
                        repo: currentRepo.name,
                    }),
                });
                if (!res.ok) {
                    throw new Error('Failed to add repository');
                }
            }
            // Re-fetch to get updated collections state
            await fetchCollections();
        }
        catch (err) {
            alert(err instanceof Error ? err.message : 'Operation failed');
        }
        finally {
            setTogglingIds((prev) => ({ ...prev, [collection.id]: false }));
        }
    };
    const handleCreateCollection = async (e) => {
        e.preventDefault();
        if (!newCollectionName.trim()) {
            setCreateError('Name is required');
            return;
        }
        try {
            setCreateLoading(true);
            setCreateError(null);
            const res = await fetch('/api/starred-collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCollectionName.trim(),
                    description: newCollectionDesc.trim() || undefined,
                    visibility: newCollectionVis,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create collection');
            }
            const newCol = await res.json();
            // Auto-add current repo to the newly created collection
            await fetch(`/api/starred-collections/${newCol.id}/repos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: currentRepo.owner.login,
                    repo: currentRepo.name,
                }),
            });
            setNewCollectionName('');
            setNewCollectionDesc('');
            setNewCollectionVis('private');
            setIsCreating(false);
            await fetchCollections();
        }
        catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create collection');
        }
        finally {
            setCreateLoading(false);
        }
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
                                }, children: "Collections" }), _jsx("div", { style: {
                                    fontSize: theme.fontSizes[0],
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase',
                                    color: theme.colors.accent,
                                    fontWeight: theme.fontWeights.bold,
                                }, children: "\u2726 Starred Lists \u2726" })] }), _jsx("button", { type: "button", "aria-label": "Close collections", onClick: onClose, className: "flex items-center justify-center transition-opacity hover:opacity-70", style: {
                            width: 30,
                            height: 30,
                            borderRadius: theme.radii[1] ?? 6,
                            color: theme.colors.textMuted,
                        }, children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 flex flex-col gap-4", children: [_jsxs("div", { style: {
                            padding: '12px 14px',
                            borderRadius: theme.radii[2] ?? 10,
                            background: theme.colors.surface,
                            border: `1px solid ${theme.colors.border}`,
                        }, children: [_jsx("div", { style: {
                                    fontSize: theme.fontSizes[0],
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px',
                                    color: theme.colors.textMuted,
                                    marginBottom: 8,
                                }, children: "Add/Remove Repository" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("img", { src: `${currentRepo.owner.avatar_url}${currentRepo.owner.avatar_url.includes('?') ? '&' : '?'}s=48`, alt: "", width: 28, height: 28, style: { borderRadius: theme.radii[1] ?? 5, flexShrink: 0 } }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate font-semibold", style: { fontSize: theme.fontSizes[2], color: theme.colors.text }, children: currentRepo.name }), _jsx("div", { className: "truncate", style: { fontSize: theme.fontSizes[1], color: theme.colors.textMuted }, children: currentRepo.owner.login })] })] })] }), loading ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 gap-2 text-sm", style: { color: theme.colors.textMuted }, children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), "Loading collections..."] })) : error ? (_jsx("div", { className: "py-4 text-center text-sm", style: { color: theme.colors.error }, children: error })) : (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { style: { fontSize: theme.fontSizes[1], color: theme.colors.textSecondary, fontWeight: 500 }, children: "Select Collections" }), !isCreating && (_jsxs("button", { type: "button", onClick: () => setIsCreating(true), className: "flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity", style: { color: theme.colors.primary }, children: [_jsx(Plus, { size: 14 }), "New Collection"] }))] }), isCreating && (_jsxs("form", { onSubmit: handleCreateCollection, className: "flex flex-col gap-3 p-3.5 rounded-lg border mb-2", style: {
                                    background: theme.colors.surface,
                                    borderColor: theme.colors.border,
                                }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-bold uppercase tracking-wider", style: { color: theme.colors.textMuted }, children: "New Starred Collection" }), _jsx("button", { type: "button", onClick: () => {
                                                    setIsCreating(false);
                                                    setCreateError(null);
                                                }, style: { color: theme.colors.textMuted }, className: "hover:opacity-75 transition-opacity", children: _jsx(X, { size: 14 }) })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { htmlFor: "col-name", className: "text-xs font-medium", style: { color: theme.colors.textSecondary }, children: "Name *" }), _jsx("input", { id: "col-name", type: "text", required: true, disabled: createLoading, value: newCollectionName, onChange: (e) => setNewCollectionName(e.target.value), placeholder: "e.g. My Favorites", className: "w-full px-2.5 py-1.5 rounded text-sm border focus:outline-none focus:ring-1", style: {
                                                    background: theme.colors.background,
                                                    borderColor: theme.colors.border,
                                                    color: theme.colors.text,
                                                } })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { htmlFor: "col-desc", className: "text-xs font-medium", style: { color: theme.colors.textSecondary }, children: "Description" }), _jsx("textarea", { id: "col-desc", disabled: createLoading, value: newCollectionDesc, onChange: (e) => setNewCollectionDesc(e.target.value), placeholder: "Optional description", className: "w-full px-2.5 py-1.5 rounded text-sm border focus:outline-none focus:ring-1 resize-none", style: {
                                                    background: theme.colors.background,
                                                    borderColor: theme.colors.border,
                                                    color: theme.colors.text,
                                                    height: 50,
                                                } })] }), _jsxs("div", { className: "flex items-center gap-4 py-0.5", children: [_jsx("span", { className: "text-xs font-medium", style: { color: theme.colors.textSecondary }, children: "Visibility:" }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs cursor-pointer select-none", children: [_jsx("input", { type: "radio", disabled: createLoading, checked: newCollectionVis === 'private', onChange: () => setNewCollectionVis('private'), className: "cursor-pointer" }), _jsx(Lock, { size: 12, style: { color: theme.colors.textMuted } }), " Private"] }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs cursor-pointer select-none", children: [_jsx("input", { type: "radio", disabled: createLoading, checked: newCollectionVis === 'public', onChange: () => setNewCollectionVis('public'), className: "cursor-pointer" }), _jsx(Globe, { size: 12, style: { color: theme.colors.textMuted } }), " Public"] })] }), createError && (_jsx("div", { className: "text-xs", style: { color: theme.colors.error }, children: createError })), _jsxs("button", { type: "submit", disabled: createLoading, className: "w-full py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90", style: {
                                            background: theme.colors.primary,
                                            color: theme.colors.background,
                                        }, children: [createLoading ? (_jsx(Loader2, { size: 13, className: "animate-spin" })) : (_jsx(FolderPlus, { size: 13 })), "Create & Add Repo"] })] })), collections.length === 0 ? (_jsx("div", { className: "py-8 text-center text-sm", style: { color: theme.colors.textMuted }, children: "No starred collections yet. Create one above!" })) : (_jsx("div", { className: "flex flex-col gap-1.5", children: collections.map((col) => {
                                    const isSaved = col.repos.some((r) => r.owner.toLowerCase() === currentRepo.owner.login.toLowerCase() &&
                                        r.repo.toLowerCase() === currentRepo.name.toLowerCase());
                                    const isToggling = togglingIds[col.id];
                                    return (_jsxs("button", { type: "button", disabled: isToggling, onClick: () => handleToggleRepo(col), className: "w-full flex items-center justify-between p-3.5 rounded-lg border text-left hover:scale-[1.01] active:scale-[0.99] transition-all", style: {
                                            background: theme.colors.surface,
                                            borderColor: isSaved ? theme.colors.primary : theme.colors.border,
                                        }, children: [_jsxs("div", { className: "min-w-0 flex-1 flex items-start gap-2.5", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 rounded-md shrink-0", style: {
                                                            background: isSaved
                                                                ? `color-mix(in srgb, ${theme.colors.primary} 15%, transparent)`
                                                                : theme.colors.backgroundSecondary,
                                                            color: isSaved ? theme.colors.primary : theme.colors.textMuted,
                                                        }, children: _jsx(Layers, { size: 16 }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-semibold truncate text-sm", style: { color: theme.colors.text }, children: col.name }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5 text-xs", style: { color: theme.colors.textMuted }, children: [_jsxs("span", { className: "flex items-center gap-0.5", children: [col.visibility === 'public' ? _jsx(Globe, { size: 10 }) : _jsx(Lock, { size: 10 }), col.visibility] }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: [col.repos.length, " ", col.repos.length === 1 ? 'repo' : 'repos'] })] })] })] }), _jsx("div", { className: "flex items-center justify-center w-5 h-5 rounded-md border transition-all", style: {
                                                    borderColor: isSaved ? theme.colors.primary : theme.colors.border,
                                                    background: isSaved ? theme.colors.primary : 'transparent',
                                                    color: theme.colors.background,
                                                }, children: isToggling ? (_jsx(Loader2, { size: 12, className: "animate-spin", style: { color: isSaved ? theme.colors.background : theme.colors.textMuted } })) : isSaved ? (_jsx(Check, { size: 12, strokeWidth: 3 })) : null })] }, col.id));
                                }) }))] }))] })] }));
}
