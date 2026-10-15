'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * "What an agent sees" preview.
 *
 * Every content-negotiated page (`/{owner}/{repo}`, `/trail/{id}`,
 * `/topic/{id}`) serves a browser the SPA but serves a programmatic caller a
 * structured Markdown/JSON manifest — see `src/middleware.ts`. This modal makes
 * that hidden representation visible from inside the app: it re-fetches the
 * current page's own path with a non-HTML `Accept` header, the same way curl or
 * an LLM would, so what renders here is byte-for-byte what an agent receives —
 * access gate, CLI-aware error bodies, and all. It is not a reconstruction, so
 * it can't drift from the real response.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Check, Copy, X } from 'lucide-react';
import { InlineTrailLoader } from '@repo-explorer/components/trail/InlineTrailLoader';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
const COPY_FEEDBACK_MS = 1500;
/**
 * Fetch a page's agent representation. A normal browser User-Agent plus a
 * non-`text/html` Accept header is exactly what the middleware treats as a
 * programmatic caller, so this returns the structured body. Non-OK responses
 * (private trail → 403, missing topic → 404) carry CLI-aware bodies an agent
 * would also see, so we surface them verbatim rather than throwing.
 */
async function fetchAgentView(path, accept) {
    const res = await fetch(path, { headers: { accept } });
    const text = await res.text();
    return text || `Request failed (${res.status})`;
}
export function AgentViewModal({ path, onClose }) {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState('pretty');
    const [markdown, setMarkdown] = useState(null);
    const [json, setJson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    useEffect(() => setMounted(true), []);
    // Fetch both representations once. Promise.all so the modal is usable the
    // moment either tab is opened; the format is negotiated purely by Accept.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void (async () => {
            try {
                const [md, js] = await Promise.all([
                    fetchAgentView(path, 'text/markdown'),
                    fetchAgentView(path, 'application/json'),
                ]);
                if (cancelled)
                    return;
                setMarkdown(md);
                // Pretty-print when the body parses as JSON; otherwise show it raw so
                // an error body (which may be JSON or plain text) is still legible.
                try {
                    setJson(JSON.stringify(JSON.parse(js), null, 2));
                }
                catch {
                    setJson(js);
                }
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load agent view');
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [path]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    // The copy button grabs the raw text of whatever the active tab shows — the
    // markdown source for Rendered/Raw Markdown, the JSON for Raw JSON.
    const activeRaw = mode === 'json' ? (json ?? '') : (markdown ?? '');
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(activeRaw);
            setCopied(true);
            setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
        }
        catch {
            // clipboard may be denied — fail quietly
        }
    }, [activeRaw]);
    if (!mounted)
        return null;
    const tabs = [
        { id: 'pretty', label: 'Rendered' },
        { id: 'markdown', label: 'Raw Markdown' },
        { id: 'json', label: 'Raw JSON' },
    ];
    return createPortal(_jsx("div", { role: "dialog", "aria-modal": "true", "aria-label": "What an agent sees", onClick: onClose, className: "fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4", style: {
            background: 'rgba(0,0,0,0.55)',
            paddingTop: 'var(--safe-top)',
            zIndex: 2147483000,
        }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden", style: {
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                height: '85vh',
                maxHeight: '85vh',
            }, children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 border-b", style: { borderColor: theme.colors.border }, children: [_jsx(Bot, { className: "w-5 h-5 flex-shrink-0", style: { color: theme.colors.primary } }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-base font-semibold truncate", children: "What an agent sees" }), _jsx("div", { className: "text-xs truncate font-mono", style: { color: theme.colors.textMuted }, children: path })] }), _jsxs("button", { type: "button", onClick: handleCopy, disabled: loading || !!error, className: "inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40", style: {
                                background: copied ? theme.colors.primary : 'transparent',
                                color: copied ? theme.colors.background : theme.colors.text,
                                border: `1px solid ${copied ? theme.colors.primary : theme.colors.border}`,
                                cursor: loading || error ? 'default' : 'pointer',
                            }, "aria-label": "Copy the active view", title: mode === 'json' ? 'Copy JSON' : 'Copy Markdown', children: [copied ? (_jsx(Check, { className: "w-4 h-4" })) : (_jsx(Copy, { className: "w-4 h-4" })), _jsx("span", { children: copied ? 'Copied' : 'Copy' })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close", className: "w-8 h-8 rounded-md flex items-center justify-center transition-opacity hover:opacity-80", style: {
                                background: 'transparent',
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                cursor: 'pointer',
                            }, children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "flex px-2 border-b flex-shrink-0", style: { borderColor: theme.colors.border }, children: tabs.map((tab) => {
                        const active = mode === tab.id;
                        return (_jsx("button", { type: "button", onClick: () => setMode(tab.id), className: "px-4 py-2.5 text-sm font-medium transition-colors", style: {
                                background: 'transparent',
                                color: active ? theme.colors.text : theme.colors.textMuted,
                                borderBottom: `2px solid ${active ? theme.colors.primary : 'transparent'}`,
                                cursor: 'pointer',
                            }, "aria-pressed": active, children: tab.label }, tab.id));
                    }) }), _jsx("div", { className: "flex-1 overflow-auto", children: loading ? (_jsxs("div", { className: "flex items-center justify-center gap-2 h-full text-sm", style: { color: theme.colors.textMuted }, children: [_jsx(InlineTrailLoader, { size: 16 }), "Loading agent view\u2026"] })) : error ? (_jsx("div", { className: "p-4 text-sm", style: { color: theme.colors.error ?? theme.colors.text }, children: error })) : mode === 'pretty' ? (_jsx("div", { className: "px-4 py-3", children: _jsx(IndustryMarkdownSlide, { content: markdown ?? '', theme: theme, slideIdPrefix: "agent-view", slideIndex: 0, transparentBackground: true, disableBasePadding: { horizontal: true } }) })) : (_jsx("pre", { className: "text-xs font-mono whitespace-pre-wrap break-words m-0 p-4", style: { color: theme.colors.text }, children: mode === 'json' ? json : markdown })) })] }) }), document.body);
}
