import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Map as MapIcon, HelpCircle, FileText, Layers } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { RepositoryToolbar } from '../../pages/RepoManager/shared/RepositoryToolbar';
import { ArchitectureMapHighlightLayers } from "@principal-ai/code-city-react";
// Notes panel removed - will be integrated into AgentSessionDetailView
import { EmptyState } from './EmptyState';
import { LoadingAnimation } from './LoadingAnimation';
import { AgentSessionDetailView } from './AgentSessionDetailView';
import { GitChangesHelpModal } from './GitChangesHelpModal';
export const RightPaneContainer = ({ activeView, onViewChange, cityData, highlightLayers, loading = false, treeStats, onFileClick, activeSource, sessions, sessionFileActivities, selectedSessionId, repository, onNoteCreated, onHelpClick, headerExtra, sourceBadges, loadingMessage = 'Building your city', emptyMessage = 'No city data available', showViewSwitcher = true, selectedSessionCardData, sessionColor = '#3b82f6', repositoryPath = '', sources = new Map(), onOpenInEditor, onOpenAllInEditor, onOpenTerminal, hasTerminalWindow = false, onShowContext, onViewEvents, onArchive, onOpenPackageCommands, getTimeAgo = (ts) => 'recently', toolbarItems = [], toolbarExpanded = false, onToolbarExpandedChange, documentContent, }) => {
    const { theme } = useTheme();
    const [recentNotes, setRecentNotes] = useState([]);
    const [showingNotification, setShowingNotification] = useState(false);
    const [showGitChangesHelp, setShowGitChangesHelp] = useState(false);
    const internalTerminalRef = useRef(null);
    // Listen for note creation events (placeholder for future implementation)
    useEffect(() => {
        if (onNoteCreated) {
            // This will be connected to IPC events in the future
            // For now, it's just a placeholder
        }
    }, [onNoteCreated]);
    // Handle notification display
    useEffect(() => {
        if (recentNotes.length > 0) {
            setShowingNotification(true);
            const timer = setTimeout(() => {
                setShowingNotification(false);
                // Remove oldest notification after animation
                setTimeout(() => {
                    setRecentNotes(prev => prev.slice(1));
                }, 300);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [recentNotes]);
    return (_jsxs("div", { style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '0', // No border radius - handled by parent
            overflow: 'hidden',
            position: 'relative',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight,
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }, children: [activeView === 'city' && _jsx(MapIcon, { size: 18, color: theme.colors.primary }), activeView === 'session-detail' && _jsx(FileText, { size: 18, color: theme.colors.primary }), activeView === 'document' && _jsx(FileText, { size: 18, color: theme.colors.primary }), _jsxs("h3", { style: { fontSize: '16px', fontWeight: 600, color: theme.colors.text, margin: 0 }, children: [activeView === 'city' && 'Project Structure', activeView === 'document' && 'Documentation', activeView === 'session-detail' && (selectedSessionCardData?.session?.customName ||
                                                selectedSessionCardData?.session?.sessionId?.substring(0, 8) || 'Session Details')] }), activeView === 'city' && treeStats && (_jsxs("span", { style: { fontSize: '13px', color: theme.colors.textSecondary }, children: [treeStats.fileCount.toLocaleString(), " files \u2022 ", treeStats.directoryCount.toLocaleString(), " directories"] })), headerExtra] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [showViewSwitcher && (selectedSessionCardData || activeView === 'document') && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [selectedSessionCardData && (_jsx("button", { onClick: () => onViewChange('session-detail'), style: {
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    backgroundColor: activeView === 'session-detail' ? theme.colors.primary : 'transparent',
                                                    color: activeView === 'session-detail' ? '#fff' : theme.colors.textSecondary,
                                                }, children: "Session" })), activeView === 'document' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => onViewChange('document'), style: {
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            background: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            backgroundColor: theme.colors.primary,
                                                            color: '#fff',
                                                        }, children: "Document" }), _jsx("button", { onClick: () => onViewChange('city'), style: {
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            background: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            backgroundColor: 'transparent',
                                                            color: theme.colors.textSecondary,
                                                        }, children: "Map" })] })), activeView === 'city' && (_jsx("button", { onClick: () => onViewChange('city'), style: {
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    backgroundColor: theme.colors.primary,
                                                    color: '#fff',
                                                }, children: "Map" }))] })), onHelpClick && (_jsx("button", { onClick: onHelpClick, style: {
                                            padding: '4px',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            color: theme.colors.textSecondary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '4px',
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }, title: "Help", children: _jsx(HelpCircle, { size: 16 }) }))] })] }), activeView === 'city' && (sourceBadges || (activeSource && activeSource.type === 'local')) && (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 16px',
                            borderTop: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.background,
                        }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center' }, children: sourceBadges }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [activeSource && activeSource.type === 'local' && (_jsx("button", { onClick: () => setShowGitChangesHelp(true), style: {
                                            padding: '6px',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            color: theme.colors.textSecondary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '4px',
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                            e.currentTarget.style.color = theme.colors.text;
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = theme.colors.textSecondary;
                                        }, title: "Learn about git changes visualization", children: _jsx(HelpCircle, { size: 14 }) })), toolbarItems.length > 0 && (_jsxs("button", { onClick: () => onToolbarExpandedChange?.(!toolbarExpanded), style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            border: `1px solid ${theme.colors.border}`,
                                            backgroundColor: toolbarExpanded ? theme.colors.primary + '15' : theme.colors.background,
                                            color: toolbarExpanded ? theme.colors.primary : theme.colors.textSecondary,
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }, onMouseEnter: (e) => {
                                            if (!toolbarExpanded) {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                                e.currentTarget.style.color = theme.colors.text;
                                            }
                                        }, onMouseLeave: (e) => {
                                            if (!toolbarExpanded) {
                                                e.currentTarget.style.backgroundColor = theme.colors.background;
                                                e.currentTarget.style.color = theme.colors.textSecondary;
                                            }
                                        }, title: toolbarExpanded ? 'Hide repository tools' : 'Show repository tools', children: [_jsx(Layers, { size: 12 }), _jsx("span", { children: "Tools" }), toolbarItems.filter(item => item.active).length > 0 && (_jsx("span", { style: {
                                                    padding: '1px 4px',
                                                    borderRadius: '3px',
                                                    backgroundColor: theme.colors.primary + '22',
                                                    color: theme.colors.primary,
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                }, children: toolbarItems.filter(item => item.active).length }))] }))] })] }))] }), toolbarItems.length > 0 && (_jsx(RepositoryToolbar, { items: toolbarItems, position: "top", expanded: toolbarExpanded })), _jsxs("div", { style: {
                    flex: '1 1 0',
                    minHeight: 0, // Important for flexbox to allow shrinking
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                }, children: [_jsxs("div", { style: {
                            flex: 1,
                            visibility: activeView === 'city' ? 'visible' : 'hidden',
                            zIndex: activeView === 'city' ? 2 : 1,
                            backgroundColor: theme.colors.backgroundSecondary,
                            pointerEvents: activeView === 'city' ? 'auto' : 'none',
                            position: 'relative'
                        }, children: [cityData ? (_jsx(ArchitectureMapHighlightLayers, { cityData: cityData, highlightLayers: highlightLayers, showLayerControls: false, onLayerToggle: () => { }, defaultDirectoryColor: "#111827", onFileClick: onFileClick || (() => { }), showFileTypeIcons: true, className: "w-full h-full", showLegend: false, showDirectoryLabels: true })) : loading ? (_jsx(LoadingAnimation, { message: loadingMessage, fileCount: treeStats?.fileCount })) : (_jsx(EmptyState, { message: emptyMessage })), showingNotification && recentNotes.length > 0 && (_jsxs("div", { style: {
                                    position: 'absolute',
                                    top: '20px',
                                    right: '20px',
                                    backgroundColor: theme.colors.backgroundLight,
                                    border: `2px solid ${theme.colors.primary}`,
                                    borderRadius: '8px',
                                    padding: '12px',
                                    maxWidth: '300px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    animation: 'slideIn 0.3s ease-out',
                                    zIndex: 10,
                                }, children: [_jsx("div", { style: {
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: theme.colors.primary,
                                            marginBottom: '8px',
                                        }, children: "New Tribal Knowledge" }), _jsxs("div", { style: {
                                            fontSize: '13px',
                                            color: theme.colors.text,
                                            lineHeight: 1.4,
                                        }, children: [recentNotes[0].note.note.substring(0, 100), "..."] }), _jsx("div", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                            marginTop: '6px',
                                        }, children: recentNotes[0].note.relativePath || '/' })] }))] }), _jsx("div", { style: {
                            position: 'absolute',
                            inset: 0,
                            visibility: activeView === 'session-detail' ? 'visible' : 'hidden',
                            zIndex: activeView === 'session-detail' ? 2 : 1,
                            backgroundColor: theme.colors.backgroundSecondary,
                            pointerEvents: activeView === 'session-detail' ? 'auto' : 'none',
                            padding: '16px'
                        }, children: _jsx(AgentSessionDetailView, { cardData: selectedSessionCardData, sessionColor: sessionColor, sources: sources, repositoryPath: repositoryPath, onOpenInEditor: onOpenInEditor, onOpenAllInEditor: onOpenAllInEditor, onOpenTerminal: onOpenTerminal, hasTerminalWindow: hasTerminalWindow, onShowContext: onShowContext, onViewEvents: onViewEvents, onArchive: onArchive, onOpenPackageCommands: onOpenPackageCommands, getTimeAgo: getTimeAgo }) }), _jsx("div", { style: {
                            position: 'absolute',
                            inset: 0,
                            visibility: activeView === 'document' ? 'visible' : 'hidden',
                            zIndex: activeView === 'document' ? 2 : 1,
                            backgroundColor: theme.colors.background,
                            pointerEvents: activeView === 'document' ? 'auto' : 'none',
                            overflow: 'hidden'
                        }, children: documentContent })] }), _jsx("style", { children: `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      ` }), _jsx(GitChangesHelpModal, { isOpen: showGitChangesHelp, onClose: () => setShowGitChangesHelp(false) })] }));
};
