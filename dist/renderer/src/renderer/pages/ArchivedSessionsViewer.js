import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useCallback } from 'react';
import { AnimatedResizableLayout } from "@a24z/panels";
import "@a24z/panels/style.css";
import { useTheme } from 'themed-markdown';
import { Sparkles, X } from 'lucide-react';
import { ArchivedAgentSessionsPanel } from '../components/repository-maps/ArchivedAgentSessionsPanel';
import { SessionDetailsPanel } from '../components/agent-overview/SessionDetailsPanel';
export const ArchivedSessionsViewer = ({ initialSessionId, initialDirectory, }) => {
    const { theme } = useTheme();
    const [selectedSession, setSelectedSession] = useState(null);
    const [viewMode, setViewMode] = useState('files');
    const [knipAnalysis, setKnipAnalysis] = useState(null);
    const [runningKnip, setRunningKnip] = useState(false);
    const [analyzingRepos, setAnalyzingRepos] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [visibleSession, setVisibleSession] = useState(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false); // Collapsed if opened with initial session
    const [currentRepositoryPath, setCurrentRepositoryPath] = useState(initialDirectory || '');
    // Load initial session if provided
    React.useEffect(() => {
        if (initialSessionId && initialDirectory) {
            setSelectedSession({
                sessionId: initialSessionId,
                directory: initialDirectory,
            });
            setVisibleSession({
                sessionId: initialSessionId,
                directory: initialDirectory,
            });
        }
    }, [initialSessionId, initialDirectory]);
    // Add CSS animation for loading shimmer
    React.useEffect(() => {
        const styleId = 'agent-overview-animations';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `;
            document.head.appendChild(style);
        }
    }, []);
    // Memoize the session select handler to prevent unnecessary re-renders
    const handleSessionSelect = useCallback((session, directory) => {
        // If we're switching sessions, trigger fade out first
        if (visibleSession &&
            (visibleSession.sessionId !== session.sessionId ||
                visibleSession.directory !== directory)) {
            setIsFadingOut(true);
            setTimeout(() => {
                setSelectedSession({
                    sessionId: session.sessionId,
                    directory,
                    session,
                });
                setVisibleSession({ sessionId: session.sessionId, directory });
                setIsFadingOut(false);
            }, 500); // Match the transition duration
        }
        else {
            // First selection, no fade out needed
            setSelectedSession({
                sessionId: session.sessionId,
                directory,
                session,
            });
            setVisibleSession({ sessionId: session.sessionId, directory });
        }
    }, [visibleSession]);
    // Always show SessionDetailsPanel when we have a session selected
    // It will handle its own loading states internally
    const rightPanel = visibleSession ? (_jsx("div", { style: {
            height: '100%',
            opacity: isFadingOut ? 0 : 1,
            transition: 'opacity 0.5s ease-in-out',
        }, children: _jsx(SessionDetailsPanel, { sessionId: visibleSession.sessionId, directory: visibleSession.directory, initialSession: selectedSession?.session, viewMode: viewMode, setViewMode: setViewMode, knipAnalysis: knipAnalysis, setKnipAnalysis: setKnipAnalysis, runningKnip: runningKnip, setRunningKnip: setRunningKnip, analyzingRepos: analyzingRepos, setAnalyzingRepos: setAnalyzingRepos, onSessionDeleted: () => {
                setIsFadingOut(true);
                setTimeout(() => {
                    setSelectedSession(null);
                    setVisibleSession(null);
                    setIsFadingOut(false);
                }, 500);
            } }) })) : (_jsx("div", { style: {
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.background,
            color: theme.colors.textSecondary,
        }, children: _jsx("p", { children: "Select a session to view details" }) }));
    return (_jsxs("div", { style: {
            height: '100vh',
            backgroundColor: theme.colors.background,
            display: 'flex',
            flexDirection: 'column',
        }, children: [_jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    padding: '0 16px',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { children: [_jsx("h1", { style: {
                                    margin: 0,
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                    marginBottom: '4px',
                                }, children: "Archived Sessions" }), _jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    fontFamily: 'monospace',
                                }, children: currentRepositoryPath || initialDirectory || 'All Repositories' })] }), _jsx("div", { style: {
                            fontSize: '13px',
                            color: theme.colors.textTertiary,
                        }, children: "Viewing archived agent sessions" })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(AnimatedResizableLayout, { leftPanel: _jsx(ArchivedAgentSessionsPanel, { repositoryPath: currentRepositoryPath || selectedSession?.directory || '', repositoryName: currentRepositoryPath ? currentRepositoryPath.split('/').pop() || 'Repository' : 'All Archives', onSessionSelect: (session, directory) => {
                            handleSessionSelect(session, directory);
                            // Update repository path when a session is selected
                            if (directory && directory !== currentRepositoryPath) {
                                setCurrentRepositoryPath(directory);
                            }
                        }, onSessionUnselect: () => {
                            setSelectedSession(null);
                            setVisibleSession(null);
                        }, selectedSessionId: selectedSession?.sessionId || undefined, sessionLayerFilters: new Map(), onSessionLayerFilterChange: () => { }, onLayersGenerated: () => { }, selectedSessionIds: new Set() }), rightPanel: rightPanel, defaultSize: 25, minSize: 25, collapsibleSide: "left", showCollapseButton: true, collapsed: isPanelCollapsed }) }), knipAnalysis && (_jsx("div", { style: {
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    padding: '16px',
                }, children: _jsxs("div", { style: {
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '8px',
                        padding: '24px',
                        maxWidth: '1024px',
                        width: '100%',
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '16px',
                            }, children: [_jsx("h3", { style: {
                                        margin: 0,
                                        fontSize: '18px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                    }, children: "Tech Debt Analysis" }), _jsx("button", { onClick: () => setKnipAnalysis(null), style: {
                                        padding: '4px',
                                        borderRadius: '4px',
                                        backgroundColor: 'transparent',
                                        color: theme.colors.textSecondary,
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor =
                                            theme.colors.backgroundHover;
                                        e.currentTarget.style.color = theme.colors.text;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = theme.colors.textSecondary;
                                    }, children: _jsx(X, { size: 20 }) })] }), knipAnalysis.error ? (_jsxs("div", { style: {
                                color: theme.colors.error,
                                backgroundColor: `${theme.colors.error}20`,
                                borderRadius: '4px',
                                padding: '16px',
                            }, children: [_jsx("p", { style: { fontWeight: 500, marginBottom: '8px' }, children: "Analysis Failed" }), _jsx("pre", { style: { fontSize: '14px', whiteSpace: 'pre-wrap' }, children: knipAnalysis.error })] })) : (_jsxs("div", { className: "flex-1 overflow-y-auto space-y-4", children: [_jsxs("div", { className: "grid grid-cols-4 gap-4", children: [_jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("div", { className: "text-3xl font-bold text-white", children: knipAnalysis.unusedFiles?.length || 0 }), _jsx("div", { className: "text-sm mt-1", style: { color: theme.colors.textSecondary }, children: "Unused Files" })] }), _jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("div", { className: "text-3xl font-bold text-white", children: knipAnalysis.unusedExports?.length || 0 }), _jsx("div", { className: "text-sm mt-1", style: { color: theme.colors.textSecondary }, children: "Unused Exports" })] }), _jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("div", { className: "text-3xl font-bold text-white", children: knipAnalysis.unusedDependencies?.length || 0 }), _jsx("div", { className: "text-sm mt-1", style: { color: theme.colors.textSecondary }, children: "Unused Dependencies" })] }), _jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("div", { className: "text-3xl font-bold text-white", children: knipAnalysis.unresolvedImports?.length || 0 }), _jsx("div", { className: "text-sm mt-1", style: { color: theme.colors.textSecondary }, children: "Unresolved Imports" })] })] }), knipAnalysis.unusedFiles?.length > 0 && (_jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("h4", { className: "font-medium text-white mb-3", children: "Unused Files" }), _jsx("div", { className: "space-y-2 max-h-48 overflow-y-auto", children: knipAnalysis.unusedFiles.map((file, idx) => (_jsx("div", { className: "text-sm font-mono rounded px-3 py-1 truncate", style: {
                                                    color: theme.colors.textTertiary,
                                                    backgroundColor: theme.colors.surface
                                                }, title: file, children: file }, idx))) })] })), knipAnalysis.unusedExports?.length > 0 && (_jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("h4", { className: "font-medium text-white mb-3", children: "Unused Exports" }), _jsx("div", { className: "space-y-2 max-h-48 overflow-y-auto", children: knipAnalysis.unusedExports.map((item, idx) => (_jsxs("div", { className: "rounded p-2", style: { backgroundColor: theme.colors.surface }, children: [_jsx("p", { className: "text-sm font-mono", style: { color: theme.colors.textTertiary }, children: item.file }), _jsxs("p", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: ["Export: ", item.export] })] }, idx))) })] })), knipAnalysis.unusedDependencies?.length > 0 && (_jsxs("div", { className: "rounded-lg p-4", style: { backgroundColor: theme.colors.background }, children: [_jsx("h4", { className: "font-medium text-white mb-3", children: "Unused Dependencies" }), _jsx("div", { className: "space-y-1", children: knipAnalysis.unusedDependencies.map((dep, idx) => (_jsx("div", { className: "text-sm font-mono", style: { color: theme.colors.textTertiary }, children: dep }, idx))) })] })), !knipAnalysis.unusedFiles?.length &&
                                    !knipAnalysis.unusedExports?.length &&
                                    !knipAnalysis.unusedDependencies?.length &&
                                    !knipAnalysis.unresolvedImports?.length && (_jsxs("div", { className: "text-center py-8", style: { color: theme.colors.textSecondary }, children: [_jsxs("p", { className: "text-lg mb-2 flex items-center justify-center gap-2", children: [_jsx(Sparkles, { size: 16 }), " No tech debt found!"] }), _jsx("p", { className: "text-sm", children: "This project directory appears to be clean." })] }))] })), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { onClick: () => setKnipAnalysis(null), className: "px-4 py-2 text-white rounded-md transition-colors", style: { backgroundColor: theme.colors.backgroundHover }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                    }, children: "Close" }), knipAnalysis.hasIssues && (_jsx("button", { onClick: () => {
                                        // TODO: Implement selective fix functionality
                                        console.log('Fix selected issues');
                                    }, className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors", children: "Fix Selected Issues" }))] })] }) }))] }));
};
