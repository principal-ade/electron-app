'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@repo-explorer/shims/next-navigation';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, Star, ChevronRight } from 'lucide-react';
import { InlineTrailLoader } from '@repo-explorer/components/trail/InlineTrailLoader';
import { parseGithubRepoPath, readRecentRepos, } from '@repo-explorer/lib/recentRepos';
export function RepoSearchBar({ onOpenRepo, excludeFullName, inputWidthClass = 'w-56', autoFocus = false, }) {
    const { theme } = useTheme();
    const router = useRouter();
    const [openRepoActive, setOpenRepoActive] = useState(autoFocus);
    const [openRepoUrl, setOpenRepoUrl] = useState('');
    const [openRepoError, setOpenRepoError] = useState(false);
    const [openRepoResults, setOpenRepoResults] = useState([]);
    const [openRepoSearching, setOpenRepoSearching] = useState(false);
    const [recentRepos, setRecentRepos] = useState([]);
    const [shortcutHint, setShortcutHint] = useState('');
    const openRepoInputRef = useRef(null);
    // ⌘K / Ctrl+K focuses the input from anywhere on the page. The hint label is
    // resolved after mount to avoid an SSR platform mismatch.
    useEffect(() => {
        setShortcutHint(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K');
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                openRepoInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    // A pasted link / `owner/repo` path is opened directly; anything else is a
    // free-text search. Computed each render so the input and submit agree.
    const openRepoDirect = parseGithubRepoPath(openRepoUrl);
    const closeOpenRepo = useCallback(() => {
        setOpenRepoActive(false);
        setOpenRepoUrl('');
        setOpenRepoError(false);
        setOpenRepoResults([]);
        setOpenRepoSearching(false);
    }, []);
    const goToRepo = useCallback((fullName) => {
        closeOpenRepo();
        const parsed = parseGithubRepoPath(fullName);
        if (onOpenRepo && parsed) {
            onOpenRepo(parsed.owner, parsed.repo);
            return;
        }
        router.push(`/${fullName}`);
    }, [router, closeOpenRepo, onOpenRepo]);
    const submitOpenRepo = useCallback(() => {
        const parsed = parseGithubRepoPath(openRepoUrl);
        if (parsed) {
            goToRepo(`${parsed.owner}/${parsed.repo}`);
            return;
        }
        // No direct path — fall back to the top search result, if any.
        if (openRepoResults[0]) {
            goToRepo(openRepoResults[0].full_name);
            return;
        }
        setOpenRepoError(true);
    }, [openRepoUrl, openRepoResults, goToRepo]);
    // Load recent repos (minus the excluded one) to show before the user types.
    useEffect(() => {
        if (!openRepoActive)
            return;
        openRepoInputRef.current?.focus();
        const exclude = excludeFullName?.toLowerCase();
        setRecentRepos(readRecentRepos()
            .filter((r) => r.full_name.toLowerCase() !== exclude)
            .slice(0, 6));
    }, [openRepoActive, excludeFullName]);
    // Debounced GitHub repo search, skipped when the text is already a direct
    // link/path. Aborts in-flight requests so stale responses can't land.
    useEffect(() => {
        if (!openRepoActive)
            return;
        const q = openRepoUrl.trim();
        if (!q || parseGithubRepoPath(q)) {
            setOpenRepoResults([]);
            setOpenRepoSearching(false);
            return;
        }
        setOpenRepoSearching(true);
        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/github/search?q=${encodeURIComponent(q)}&per_page=8`, { signal: ctrl.signal });
                if (!res.ok)
                    throw new Error('search failed');
                const data = await res.json();
                setOpenRepoResults(Array.isArray(data.items)
                    ? data.items.slice(0, 8)
                    : []);
            }
            catch {
                if (!ctrl.signal.aborted)
                    setOpenRepoResults([]);
            }
            finally {
                if (!ctrl.signal.aborted)
                    setOpenRepoSearching(false);
            }
        }, 300);
        return () => {
            ctrl.abort();
            clearTimeout(timer);
        };
    }, [openRepoUrl, openRepoActive]);
    // One result row, shared by the search results and the recent-repos list.
    const renderRepoRow = (r) => (_jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => goToRepo(r.full_name), onMouseEnter: (e) => {
            e.currentTarget.style.background = `color-mix(in srgb, ${theme.colors.primary} 12%, transparent)`;
        }, onMouseLeave: (e) => {
            e.currentTarget.style.background = 'transparent';
        }, className: "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors", style: { color: theme.colors.text, background: 'transparent' }, children: [_jsx("img", { src: `${r.owner.avatar_url}${r.owner.avatar_url.includes('?') ? '&' : '?'}s=56`, alt: "", width: 28, height: 28, className: "rounded-md shrink-0", style: { background: theme.colors.backgroundSecondary } }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate", style: {
                            fontSize: theme.fontSizes[2],
                            fontWeight: theme.fontWeights.semibold,
                        }, children: r.name }), _jsx("div", { className: "truncate", style: {
                            fontSize: theme.fontSizes[1],
                            color: theme.colors.textMuted,
                        }, children: r.owner.login })] }), typeof r.stargazers_count === 'number' && (_jsxs("span", { className: "flex items-center gap-1 shrink-0", style: {
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes[1],
                }, children: [_jsx(Star, { className: "w-3.5 h-3.5" }), r.stargazers_count.toLocaleString()] }))] }, r.full_name));
    // Small uppercase section label inside the dropdown.
    const dropdownLabel = (text) => (_jsx("div", { className: "px-3.5 pt-2.5 pb-1", style: {
            fontSize: theme.fontSizes[0],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }, children: text }));
    const showOpener = openRepoUrl.trim().length > 0;
    const showRecents = !showOpener && recentRepos.length > 0;
    return (_jsxs("div", { className: "relative", children: [_jsxs("form", { onSubmit: (e) => {
                    e.preventDefault();
                    submitOpenRepo();
                }, className: "flex items-center gap-2 h-8 px-2.5 rounded-md", style: {
                    background: theme.colors.background,
                    border: `1px solid ${openRepoError
                        ? theme.colors.error ?? theme.colors.border
                        : theme.colors.border}`,
                }, children: [_jsx(Github, { className: "w-4 h-4 shrink-0", style: { color: theme.colors.textMuted } }), _jsx("input", { ref: openRepoInputRef, value: openRepoUrl, onChange: (e) => {
                            setOpenRepoUrl(e.target.value);
                            if (openRepoError)
                                setOpenRepoError(false);
                        }, onFocus: () => setOpenRepoActive(true), onBlur: () => setOpenRepoActive(false), onKeyDown: (e) => {
                            if (e.key === 'Escape') {
                                closeOpenRepo();
                                e.currentTarget.blur();
                            }
                        }, placeholder: "Search repos or paste a link\u2026", "aria-label": "Search repositories or paste a GitHub link", className: `bg-transparent outline-none ${inputWidthClass}`, style: {
                            color: theme.colors.text,
                            fontSize: theme.fontSizes[1],
                        } }), shortcutHint && !openRepoUrl && (_jsx("kbd", { "aria-hidden": true, className: "shrink-0 rounded px-1.5 py-0.5 leading-none pointer-events-none", style: {
                            fontFamily: theme.fonts.body,
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textMuted,
                            background: theme.colors.backgroundSecondary,
                            border: `1px solid ${theme.colors.border}`,
                        }, children: shortcutHint }))] }), openRepoActive && (showOpener || showRecents) && (_jsx("div", { className: "absolute top-full right-0 mt-1.5 w-96 max-w-[calc(100vw-2rem)] rounded-lg overflow-hidden z-[1000]", style: {
                    background: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                }, children: !showOpener ? (_jsxs(_Fragment, { children: [dropdownLabel('Recent'), _jsx("div", { className: "max-h-96 overflow-y-auto pb-1", children: recentRepos.map(renderRepoRow) })] })) : openRepoDirect ? (_jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => goToRepo(`${openRepoDirect.owner}/${openRepoDirect.repo}`), onMouseEnter: (e) => {
                        e.currentTarget.style.background = `color-mix(in srgb, ${theme.colors.primary} 12%, transparent)`;
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.background = 'transparent';
                    }, className: "flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors", style: { color: theme.colors.text, background: 'transparent' }, children: [_jsx(Github, { className: "w-5 h-5 shrink-0", style: { color: theme.colors.textMuted } }), _jsxs("span", { className: "truncate", style: { fontSize: theme.fontSizes[2] }, children: ["Open ", openRepoDirect.owner, "/", openRepoDirect.repo] }), _jsx(ChevronRight, { className: "w-5 h-5 ml-auto shrink-0", style: { color: theme.colors.textMuted } })] })) : openRepoSearching ? (_jsxs("div", { className: "flex items-center gap-2.5 px-3.5 py-3.5", style: {
                        color: theme.colors.textMuted,
                        fontSize: theme.fontSizes[2],
                    }, children: [_jsx(InlineTrailLoader, { size: 16 }), "Searching\u2026"] })) : openRepoResults.length > 0 ? (_jsx("div", { className: "max-h-96 overflow-y-auto", children: openRepoResults.map(renderRepoRow) })) : (_jsx("div", { className: "px-3.5 py-3.5", style: {
                        color: theme.colors.textMuted,
                        fontSize: theme.fontSizes[2],
                    }, children: "No repositories found" })) }))] }));
}
