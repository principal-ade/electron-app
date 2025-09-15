import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { FileText, Edit3, Activity, Clock, BookOpen, AlertCircle, ExternalLink, ChevronDown, ChevronUp, Package, Terminal, Database, Archive, EyeOff, Eye } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { SessionEventsView } from './SessionEventsView';
export const AgentSessionDetailView = ({ cardData, sessionColor, sources, repositoryPath, onOpenInEditor, onOpenAllInEditor, onOpenTerminal, hasTerminalWindow = false, onShowContext, onViewEvents, onArchive, onOpenPackageCommands, getTimeAgo }) => {
    const { theme } = useTheme();
    const [viewMode, setViewMode] = useState('files');
    const [fileViewMode, setFileViewMode] = useState('writes');
    const [showLiveActivity, setShowLiveActivity] = useState(false);
    const [showProjects, setShowProjects] = useState(false);
    if (!cardData) {
        return (_jsx("div", { style: {
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
                fontSize: '14px',
                height: '100%',
                textAlign: 'center'
            }, children: _jsxs("div", { children: [_jsx(Activity, { size: 32, color: theme.colors.textSecondary, style: { marginBottom: '12px' } }), _jsx("div", { children: "Select a session to view detailed information" })] }) }));
    }
    const session = cardData.session;
    const sessionName = session.customName || session.sessionId.substring(0, 8);
    // Get git changes for this repository
    const gitSource = Array.from(sources.values()).find(source => source.source.path === repositoryPath);
    const gitChanges = gitSource?.gitChanges;
    const filesWithGitChanges = new Set();
    if (gitChanges) {
        gitChanges.created?.forEach(f => filesWithGitChanges.add(f));
        gitChanges.modified?.forEach(f => filesWithGitChanges.add(f));
        gitChanges.deleted?.forEach(f => filesWithGitChanges.add(f));
    }
    // Separate files by operation type
    const readFiles = Array.from(cardData.fileOperations?.values() || [])
        .filter(fileOp => fileOp.operations.some(op => op.type === 'read'));
    const modifiedFiles = Array.from(cardData.fileOperations?.values() || [])
        .filter(fileOp => fileOp.operations.some(op => op.type === 'write' || op.type === 'edit'));
    const FileOperationsList = ({ files, operationType }) => {
        if (files.length === 0) {
            return (_jsxs("div", { style: {
                    color: theme.colors.textSecondary,
                    fontSize: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    fontStyle: 'italic'
                }, children: ["No ", operationType === 'read' ? 'files read' : 'files modified', " in this session"] }));
        }
        return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '4px' }, children: files.map((fileOp, index) => {
                const hasGitChanges = filesWithGitChanges.has(fileOp.relativePath || fileOp.path);
                const hasCollision = fileOp.hasCollision;
                const agentCount = fileOp.agentCount;
                const fileName = fileOp.path?.split('/').pop() || fileOp.path || 'Unknown';
                const relativePath = fileOp.relativePath || fileOp.path;
                return (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '6px',
                        border: `1px solid ${hasCollision ? theme.colors.error + '40' : hasGitChanges ? theme.colors.warning + '40' : theme.colors.border}`,
                        fontSize: '12px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                    }, onClick: () => {
                        const fullPath = fileOp.relativePath
                            ? `${repositoryPath}/${fileOp.relativePath}`
                            : fileOp.path;
                        onOpenInEditor?.(fullPath);
                    }, onMouseEnter: (e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.background;
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }, children: [hasCollision ? (_jsx(AlertCircle, { size: 14, color: theme.colors.error })) : operationType === 'read' ? (_jsx(BookOpen, { size: 14, color: theme.colors.primary })) : (_jsx(Edit3, { size: 14, color: hasGitChanges ? theme.colors.warning : theme.colors.success })), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: {
                                        fontFamily: 'monospace',
                                        color: hasCollision ? theme.colors.error : hasGitChanges ? theme.colors.text : theme.colors.textSecondary,
                                        fontWeight: 500,
                                        marginBottom: '2px'
                                    }, children: fileName }), _jsx("div", { style: {
                                        fontSize: '11px',
                                        color: theme.colors.textSecondary,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }, children: relativePath })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [hasCollision && (_jsxs("span", { style: {
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.error + '20',
                                        color: theme.colors.error,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }, children: [agentCount, " Agents"] })), hasGitChanges && !hasCollision && (_jsx("span", { style: {
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        borderRadius: '12px',
                                        backgroundColor: theme.colors.warning + '20',
                                        color: theme.colors.warning,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }, children: "Uncommitted" })), _jsx(ExternalLink, { size: 12, color: theme.colors.textTertiary })] })] }, index));
            }) }));
    };
    return (_jsxs("div", { style: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            overflow: 'hidden'
        }, children: [_jsxs("div", { style: {
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    flexShrink: 0
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px'
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: sessionColor,
                                            flexShrink: 0
                                        } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '4px' }, children: [_jsx("div", { style: {
                                                    fontSize: '16px',
                                                    fontWeight: 600,
                                                    color: theme.colors.text
                                                }, children: sessionName }), _jsxs("div", { style: {
                                                    display: 'flex',
                                                    gap: '16px',
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary
                                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(BookOpen, { size: 12 }), readFiles.length, " reads"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Edit3, { size: 12 }), modifiedFiles.length, " writes"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Clock, { size: 12 }), getTimeAgo(session.lastActivity || session.startTime)] })] })] })] }), _jsxs("div", { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [_jsxs("button", { onClick: () => setShowLiveActivity(!showLiveActivity), style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            backgroundColor: 'transparent',
                                            border: `1px solid ${theme.colors.border}`,
                                            borderRadius: '4px',
                                            color: theme.colors.textSecondary,
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }, title: showLiveActivity ? "Hide live activity" : "Show live activity", children: [showLiveActivity ? _jsx(EyeOff, { size: 12 }) : _jsx(Eye, { size: 12 }), showLiveActivity ? 'Hide Activity' : 'Show Activity'] }), onOpenTerminal && (_jsxs("button", { onClick: onOpenTerminal, style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            backgroundColor: hasTerminalWindow ? theme.colors.primary : theme.colors.success,
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: '#fff',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }, title: hasTerminalWindow ? "Focus existing terminal window" : "Open new terminal window", children: [_jsx(Terminal, { size: 12 }), hasTerminalWindow ? 'Focus Terminal' : 'Open Terminal'] }))] })] }), showLiveActivity && (_jsxs("div", { style: {
                            marginTop: '16px',
                            padding: '12px',
                            backgroundColor: theme.colors.background,
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`
                        }, children: [_jsxs("div", { style: {
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    fontWeight: 600,
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }, children: [_jsx(Activity, { size: 12, color: theme.colors.primary }), "Live Activity"] }), cardData.latestEvent ? (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px'
                                        }, children: [_jsx("span", { style: { color: sessionColor, fontWeight: 600 }, children: cardData.latestEvent.toolName }), cardData.latestEvent.fileName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "\u2192" }), _jsx("span", { style: {
                                                            fontFamily: 'monospace',
                                                            fontSize: '12px',
                                                            color: theme.colors.text
                                                        }, children: cardData.latestEvent.fileName })] }))] }), _jsx("span", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                            fontFamily: 'monospace'
                                        }, children: new Date(cardData.latestEvent.timestamp).toLocaleTimeString() })] })) : (_jsx("div", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    fontStyle: 'italic'
                                }, children: "No recent activity" }))] })), _jsxs("div", { style: {
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: '12px'
                        }, children: [_jsxs("button", { onClick: () => setViewMode('files'), style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 12px',
                                    backgroundColor: viewMode === 'files' ? theme.colors.primary : 'transparent',
                                    border: viewMode === 'files' ? 'none' : `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    color: viewMode === 'files' ? '#fff' : theme.colors.text,
                                    fontSize: '11px',
                                    fontWeight: viewMode === 'files' ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }, children: [_jsx(FileText, { size: 12 }), "Files"] }), _jsxs("button", { onClick: () => setViewMode('events'), style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 12px',
                                    backgroundColor: viewMode === 'events' ? theme.colors.primary : 'transparent',
                                    border: viewMode === 'events' ? 'none' : `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    color: viewMode === 'events' ? '#fff' : theme.colors.text,
                                    fontSize: '11px',
                                    fontWeight: viewMode === 'events' ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }, children: [_jsx(Database, { size: 12 }), "Events"] }), onArchive && !cardData.hasUncommittedChanges && (_jsxs("button", { onClick: () => {
                                    if (confirm(`Archive session "${cardData.session.customName || cardData.session.sessionId.substring(0, 8)}"?`)) {
                                        onArchive();
                                    }
                                }, style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 12px',
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    color: theme.colors.textSecondary,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }, title: "Archive this session (no uncommitted changes)", children: [_jsx(Archive, { size: 12 }), "Archive Session"] }))] })] }), viewMode === 'files' ? (_jsxs("div", { style: {
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px'
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '20px',
                            paddingBottom: '12px',
                            borderBottom: `1px solid ${theme.colors.border}`
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }, children: [_jsx("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: theme.colors.text
                                        }, children: fileViewMode === 'writes' ? (_jsxs(_Fragment, { children: [_jsx(Edit3, { size: 16, color: theme.colors.primary }), "Files Modified (", modifiedFiles.length, ")"] })) : (_jsxs(_Fragment, { children: [_jsx(BookOpen, { size: 16, color: theme.colors.primary }), "Files Read (", readFiles.length, ")"] })) }), onOpenAllInEditor && (_jsxs("button", { onClick: () => {
                                            const files = fileViewMode === 'writes' ? modifiedFiles : readFiles;
                                            const filePaths = files.map(fileOp => fileOp.relativePath
                                                ? `${repositoryPath}/${fileOp.relativePath}`
                                                : fileOp.path);
                                            onOpenAllInEditor(filePaths);
                                        }, style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            backgroundColor: fileViewMode === 'writes'
                                                ? theme.colors.primary + '20'
                                                : 'transparent',
                                            border: `1px solid ${fileViewMode === 'writes'
                                                ? theme.colors.primary
                                                : theme.colors.border}`,
                                            borderRadius: '4px',
                                            color: fileViewMode === 'writes'
                                                ? theme.colors.primary
                                                : theme.colors.textSecondary,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            fontWeight: fileViewMode === 'writes' ? 600 : 400,
                                            transition: 'all 0.2s'
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }, children: [_jsx(ExternalLink, { size: 10 }), "Open All"] }))] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '2px',
                                    backgroundColor: theme.colors.background,
                                    borderRadius: '6px',
                                    padding: '2px',
                                    border: `1px solid ${theme.colors.border}`
                                }, children: [_jsxs("button", { onClick: () => setFileViewMode('reads'), style: {
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            backgroundColor: fileViewMode === 'reads' ? theme.colors.primary : 'transparent',
                                            color: fileViewMode === 'reads' ? '#fff' : theme.colors.textSecondary,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }, children: [_jsx(BookOpen, { size: 12 }), "Read"] }), _jsxs("button", { onClick: () => setFileViewMode('writes'), style: {
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            backgroundColor: fileViewMode === 'writes' ? theme.colors.primary : 'transparent',
                                            color: fileViewMode === 'writes' ? '#fff' : theme.colors.textSecondary,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }, children: [_jsx(Edit3, { size: 12 }), "Modified"] })] })] }), _jsx("div", { style: { marginBottom: '20px' }, children: _jsx(FileOperationsList, { files: fileViewMode === 'writes' ? modifiedFiles : readFiles, operationType: fileViewMode === 'writes' ? 'write' : 'read' }) }), cardData.touchedProjects && cardData.touchedProjects.length > 0 && (_jsxs("div", { style: { marginBottom: '20px' }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '12px'
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: theme.colors.text
                                        }, children: [_jsx(Package, { size: 16, color: theme.colors.primary }), "Projects Touched (", cardData.touchedProjects.length, ")"] }), _jsxs("button", { onClick: () => setShowProjects(!showProjects), style: {
                                            padding: '4px 8px',
                                            backgroundColor: 'transparent',
                                            border: `1px solid ${theme.colors.border}`,
                                            borderRadius: '4px',
                                            color: theme.colors.textSecondary,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.2s'
                                        }, children: [showProjects ? 'Hide' : 'Show', showProjects ? _jsx(ChevronUp, { size: 12 }) : _jsx(ChevronDown, { size: 12 })] })] }), showProjects && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: cardData.touchedProjects.map((project, index) => (_jsxs("div", { onClick: () => onOpenPackageCommands?.(project), style: {
                                        padding: '12px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '6px',
                                        cursor: onOpenPackageCommands ? 'pointer' : 'default',
                                        transition: 'all 0.2s'
                                    }, onMouseEnter: (e) => {
                                        if (onOpenPackageCommands) {
                                            e.currentTarget.style.backgroundColor = theme.colors.background;
                                            e.currentTarget.style.borderColor = theme.colors.primary;
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (onOpenPackageCommands) {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            e.currentTarget.style.borderColor = theme.colors.border;
                                        }
                                    }, title: onOpenPackageCommands ? `Click to run commands for ${project.name}` : undefined, children: [_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '6px'
                                            }, children: [_jsx("div", { style: {
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        color: theme.colors.text
                                                    }, children: project.name }), _jsxs("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }, children: [_jsxs("div", { style: {
                                                                fontSize: '11px',
                                                                padding: '2px 6px',
                                                                borderRadius: '12px',
                                                                backgroundColor: project.hasWrites
                                                                    ? theme.colors.primary + '20'
                                                                    : theme.colors.backgroundTertiary,
                                                                color: project.hasWrites
                                                                    ? theme.colors.primary
                                                                    : theme.colors.textSecondary,
                                                                fontWeight: 600
                                                            }, children: [project.fileCount, " files"] }), onOpenPackageCommands && (_jsx(Terminal, { size: 14, color: theme.colors.textSecondary }))] })] }), _jsx("div", { style: {
                                                fontSize: '11px',
                                                color: theme.colors.textSecondary,
                                                fontFamily: 'monospace',
                                                marginBottom: project.availableCommands && project.availableCommands.length > 0 ? '8px' : 0
                                            }, children: project.path }), project.availableCommands && project.availableCommands.length > 0 && (_jsxs("div", { style: {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                marginTop: '8px',
                                                paddingTop: '8px',
                                                borderTop: `1px solid ${theme.colors.border}`
                                            }, children: [_jsx("div", { style: {
                                                        fontSize: '10px',
                                                        color: theme.colors.textSecondary,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        fontWeight: 600,
                                                        marginBottom: '4px'
                                                    }, children: "Available Commands" }), _jsx("div", { style: {
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        gap: '4px'
                                                    }, children: project.availableCommands.map((cmd, cmdIndex) => (_jsxs("div", { title: cmd.description || cmd.command, style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '2px 6px',
                                                            backgroundColor: cmd.type === 'script'
                                                                ? theme.colors.primary + '15'
                                                                : theme.colors.backgroundTertiary,
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace',
                                                            color: cmd.type === 'script'
                                                                ? theme.colors.primary
                                                                : theme.colors.textSecondary,
                                                            border: `1px solid ${cmd.type === 'script'
                                                                ? theme.colors.primary + '30'
                                                                : theme.colors.border}`,
                                                            cursor: 'default'
                                                        }, children: [_jsx(Terminal, { size: 10 }), _jsx("span", { children: cmd.name })] }, cmdIndex))) })] }))] }, index))) }))] }))] })) : (
            /* Events View */
            _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(SessionEventsView, { sessionId: cardData.session.sessionId, sessionName: cardData.session.customName || cardData.session.sessionId.substring(0, 8) }) }))] }));
};
