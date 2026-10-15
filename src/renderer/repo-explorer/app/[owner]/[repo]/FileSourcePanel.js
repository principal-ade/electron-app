'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ThemedMonacoEditor } from '@principal-ade/industry-themed-monaco-editor';
import { DocumentView } from 'themed-markdown';
import { parseFrontmatter, stripRedundantTitleHeading, fmString, } from '@principal-ade/markdown-utils';
import { X } from 'lucide-react';
import { DocumentPreview } from '@repo-explorer/components/document/DocumentPreview';
import { MarkdownFrontmatterHeader } from './MarkdownFrontmatterHeader';
// Markdown files render through themed-markdown (mirroring the electron-app's
// MarkdownPanel) instead of the raw Monaco source view.
function isMarkdownPath(path) {
    const lower = (path.split('?')[0] ?? path).toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown');
}
// Binary document types that render through DocumentPreview instead of Monaco.
// Starting with DOCX (client-side, high fidelity via docx-preview); PDF/PPTX
// will follow once the pdf.js worker glue / LibreOffice converter land.
function inferDocKind(path) {
    const lower = (path.split('?')[0] ?? path).toLowerCase();
    if (lower.endsWith('.docx'))
        return 'docx';
    return null;
}
// Strips the leading slash / "GitHub/" / "owner/repo/" prefixes that file
// paths can arrive with, leaving a clean repo-relative path for the API.
// Mirrors the normalization in RepoExplorerPage's `readFile`.
function normalizeRepoPath(path, owner, repo) {
    let clean = path;
    if (clean.startsWith('/'))
        clean = clean.slice(1);
    if (clean.startsWith('GitHub/'))
        clean = clean.slice('GitHub/'.length);
    const repoPrefix = `${owner}/${repo}/`;
    if (clean.startsWith(repoPrefix))
        clean = clean.slice(repoPrefix.length);
    return clean;
}
async function fetchFileContent(owner, repo, path, gitRef) {
    const clean = normalizeRepoPath(path, owner, repo);
    const response = await fetch(`/api/github/repo/${owner}/${repo}?action=file&path=${encodeURIComponent(clean)}${gitRef ? `&ref=${encodeURIComponent(gitRef)}` : ''}`);
    if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.content && data.encoding === 'base64') {
        const binaryString = atob(String(data.content).replace(/\n/g, ''));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    }
    return typeof data.content === 'string' ? data.content : '';
}
// Drawer sizing. Default is comfortably wide for code/markdown; the user can
// drag the left edge to resize, and we remember the choice across sessions.
const MIN_PANEL_WIDTH = 360;
const DEFAULT_PANEL_WIDTH = 720;
const PANEL_WIDTH_KEY = 'fileSourcePanel:width';
// The centered bottom sheet reads better a bit wider, and keeps its own
// remembered width so resizing it doesn't move the side drawer.
const DEFAULT_BOTTOM_WIDTH = 1040;
const BOTTOM_WIDTH_KEY = 'fileSourcePanel:bottomWidth';
// A right-docked drawer that shows the source of a single file, read-only.
// Driven purely by `filePath`; intentionally independent of the trail overlay
// and trail selection — it just renders whatever file is handed to it.
export const FileSourcePanel = ({ owner, repo, filePath, gitRef, topOffset = 0, side = 'right', onClose, }) => {
    const dockLeft = side === 'left';
    const dockBottom = side === 'bottom';
    const { theme } = useTheme();
    const open = filePath !== null;
    // Hold the last opened path so the file stays rendered while the panel
    // slides back out (filePath clears before the transition finishes).
    const [shownPath, setShownPath] = useState(filePath);
    useEffect(() => {
        if (filePath)
            setShownPath(filePath);
    }, [filePath]);
    // Drive the slide via an `entered` flag rather than `open` directly: on mount
    // (and on open) we paint one frame off-screen on the docked edge, then flip to
    // translateX(0) so the panel always slides in from its own side — even when
    // the side just switched (which remounts this component via a `key`).
    const [entered, setEntered] = useState(false);
    useEffect(() => {
        if (!open) {
            setEntered(false);
            return;
        }
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, [open]);
    const [content, setContent] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    // Binary documents bypass the text read + Monaco entirely and stream their
    // raw bytes straight into DocumentPreview.
    const docKind = shownPath ? inferDocKind(shownPath) : null;
    const docSrc = shownPath && docKind
        ? `/api/github/repo/${owner}/${repo}?action=raw&path=${encodeURIComponent(normalizeRepoPath(shownPath, owner, repo))}${gitRef ? `&ref=${encodeURIComponent(gitRef)}` : ''}`
        : null;
    useEffect(() => {
        if (!shownPath || inferDocKind(shownPath))
            return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setContent(null);
        fetchFileContent(owner, repo, shownPath, gitRef)
            .then((text) => {
            if (!cancelled)
                setContent(text);
        })
            .catch((e) => {
            if (!cancelled) {
                setError(e instanceof Error ? e.message : 'Failed to load file.');
            }
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [owner, repo, shownPath, gitRef]);
    // Escape closes the drawer while it's open.
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    // Drag-to-resize: width in px, hydrated from localStorage after mount (kept
    // out of the initial state to avoid an SSR/client hydration mismatch).
    const widthKey = dockBottom ? BOTTOM_WIDTH_KEY : PANEL_WIDTH_KEY;
    const [width, setWidth] = useState(dockBottom ? DEFAULT_BOTTOM_WIDTH : DEFAULT_PANEL_WIDTH);
    const [dragging, setDragging] = useState(false);
    useEffect(() => {
        const saved = Number(window.localStorage.getItem(widthKey));
        if (Number.isFinite(saved) && saved >= MIN_PANEL_WIDTH)
            setWidth(saved);
    }, [widthKey]);
    useEffect(() => {
        if (!dragging)
            return;
        // Width is the distance from the pointer to the drawer's docked edge: the
        // pointer's x for a left dock, or the gap to the right viewport edge. For
        // the centered bottom sheet it's twice the gap from the viewport center, so
        // dragging either side edge widens it symmetrically.
        const onMove = (e) => {
            const next = dockBottom
                ? 2 * Math.abs(e.clientX - window.innerWidth / 2)
                : dockLeft
                    ? e.clientX
                    : window.innerWidth - e.clientX;
            const max = window.innerWidth * 0.95;
            setWidth(Math.max(MIN_PANEL_WIDTH, Math.min(next, max)));
        };
        const onUp = () => setDragging(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [dragging, dockLeft, dockBottom]);
    useEffect(() => {
        if (!dragging)
            window.localStorage.setItem(widthKey, String(width));
    }, [width, dragging, widthKey]);
    const basename = shownPath ? shownPath.split('/').pop() || shownPath : '';
    // Markdown files render rich (front matter header + DocumentView); everything
    // else stays in the read-only Monaco source view. Splitting the front matter
    // out keeps themed-markdown from treating the leading `---` block as a slide.
    const isMarkdown = shownPath ? isMarkdownPath(shownPath) : false;
    const parsedMarkdown = useMemo(() => {
        if (!isMarkdown || content === null)
            return null;
        const { data, body } = parseFrontmatter(content);
        return {
            data,
            body: stripRedundantTitleHeading(body, fmString(data.title)),
        };
    }, [isMarkdown, content]);
    // Repository context so DocumentView can rewrite relative image URLs (e.g.
    // `./docs/logo.png`) to GitHub raw URLs — without it, relative images in a
    // README render broken. `basePath` is the markdown file's own directory so
    // relative paths resolve against the file's location, and `branch` follows
    // the ref we read the file at (HEAD/`main` when omitted).
    const repositoryInfo = useMemo(() => {
        if (!shownPath)
            return undefined;
        const clean = normalizeRepoPath(shownPath, owner, repo);
        const basePath = clean.includes('/')
            ? clean.slice(0, clean.lastIndexOf('/'))
            : '';
        return { owner, repo, branch: gitRef, basePath };
    }, [shownPath, owner, repo, gitRef]);
    return (_jsxs("div", { "aria-hidden": !open, style: {
            position: 'fixed',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            background: theme.colors.backgroundSecondary,
            // Don't animate size while dragging — only the open/close slide.
            transition: dragging
                ? 'none'
                : 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: open ? 'auto' : 'none',
            ...(dockBottom
                ? {
                    // Centered sheet anchored to the bottom, with a gap above so it
                    // reads as rising from the middle. Width is the resizable column;
                    // it slides up via translateY and stays centered via translateX.
                    left: '50%',
                    bottom: 0,
                    height: `calc(100vh - ${topOffset}px - 48px)`,
                    width: `min(${width}px, 95vw)`,
                    borderTop: `1px solid ${theme.colors.border}`,
                    borderLeft: `1px solid ${theme.colors.border}`,
                    borderRight: `1px solid ${theme.colors.border}`,
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    boxShadow: entered ? '0 -12px 40px rgba(0,0,0,0.4)' : 'none',
                    transform: entered
                        ? 'translate(-50%, 0)'
                        : 'translate(-50%, 100%)',
                }
                : {
                    top: topOffset,
                    [dockLeft ? 'left' : 'right']: 0,
                    bottom: 0,
                    width: `min(${width}px, 95vw)`,
                    [dockLeft ? 'borderRight' : 'borderLeft']: `1px solid ${theme.colors.border}`,
                    boxShadow: entered
                        ? `${dockLeft ? '12px' : '-12px'} 0 32px rgba(0,0,0,0.35)`
                        : 'none',
                    transform: entered
                        ? 'translateX(0)'
                        : `translateX(${dockLeft ? '-100%' : '100%'})`,
                }),
        }, children: [_jsx("div", { onPointerDown: (e) => {
                    e.preventDefault();
                    setDragging(true);
                }, title: "Drag to resize", style: {
                    position: 'absolute',
                    // Bottom sheet resizes from its right edge; side drawers from the
                    // inner edge facing the viewport center.
                    [dockBottom || dockLeft ? 'right' : 'left']: -3,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: 'ew-resize',
                    touchAction: 'none',
                    zIndex: 1,
                } }), dragging && (_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 50, cursor: 'ew-resize' } })), _jsxs("div", { style: {
                    flex: '0 0 auto',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '12px 14px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { title: shownPath ?? undefined, style: {
                                    fontFamily: theme.fonts.monospace ?? theme.fonts.body,
                                    fontSize: theme.fontSizes[2],
                                    fontWeight: theme.fontWeights.semibold,
                                    color: theme.colors.text,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }, children: basename }), _jsx("div", { title: shownPath ?? undefined, style: {
                                    marginTop: 2,
                                    fontFamily: theme.fonts.monospace ?? theme.fonts.body,
                                    fontSize: theme.fontSizes[0],
                                    color: theme.colors.textSecondary,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    direction: 'rtl',
                                    textAlign: 'left',
                                }, children: shownPath })] }), _jsx("button", { type: "button", onClick: onClose, "aria-label": "Close", title: "Close", style: {
                            all: 'unset',
                            flex: '0 0 auto',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: theme.colors.textSecondary,
                        }, children: _jsx(X, { size: 16 }) })] }), _jsx("div", { style: { flex: 1, minHeight: 0, position: 'relative' }, children: docKind && docSrc ? (_jsx("div", { style: { position: 'absolute', inset: 0, overflow: 'auto' }, children: _jsx(DocumentPreview, { src: docSrc, kind: docKind }) })) : error ? (_jsx("div", { style: {
                        padding: 16,
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textMuted,
                    }, children: error })) : loading || content === null ? (_jsx("div", { style: {
                        padding: 16,
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textMuted,
                    }, children: "Loading file\u2026" })) : isMarkdown && parsedMarkdown ? (_jsxs("div", { style: {
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        background: theme.colors.background,
                    }, children: [_jsx(MarkdownFrontmatterHeader, { data: parsedMarkdown.data }), _jsx("div", { style: { flex: 1, minHeight: 0, position: 'relative' }, children: _jsx(DocumentView, { content: parsedMarkdown.body, theme: theme, slideIdPrefix: "repo-file-source", maxWidth: "100%", repositoryInfo: repositoryInfo, onCheckboxChange: () => { }, onLinkClick: (href) => {
                                    // External links open in a new tab; in-page anchors are left
                                    // to the renderer's own scroll handling.
                                    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href) || href.startsWith('mailto:')) {
                                        window.open(href, '_blank', 'noopener,noreferrer');
                                    }
                                } }) })] })) : (_jsx(ThemedMonacoEditor, { theme: theme, path: shownPath ?? undefined, value: content, height: "100%", hideStatusBar: true, options: {
                        readOnly: true,
                        domReadOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        fontSize: 13,
                        lineNumbersMinChars: 3,
                    } })) })] }));
};
