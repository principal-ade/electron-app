import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { useTheme } from 'themed-markdown';
import { Sparkles, AlertTriangle, FileText, Trash2, BookOpen, Edit3, Copy, Check, ExternalLink, Bug, Archive, Clock, Activity, Pause, X, CheckCircle, } from 'lucide-react';
import { EventActivityType } from '../../../shared/sessionEnums';
// Configuration constants
const FILE_SIZE_THRESHOLDS = {
    WARNING: 650,
    LARGE: 800,
};
// Helper function to determine if session is active
const isSessionActive = (session) => {
    // A session is active if it doesn't have a lastStopTime
    // This is the most reliable indicator
    const isActive = !session.lastStopTime;
    return isActive;
};
// Helper function to get last activity info from lastEvent field
const getLastActivity = (session) => {
    if (session.lastEvent) {
        // Check for file operations (READ, WRITE, EDIT)
        if ((session.lastEvent.type === EventActivityType.READ ||
            session.lastEvent.type === EventActivityType.WRITE ||
            session.lastEvent.type === EventActivityType.EDIT) &&
            session.lastEvent.fileName) {
            return {
                type: session.lastEvent.type,
                fileName: session.lastEvent.fileName,
                filePath: session.lastEvent.filePath,
            };
        }
        // Check for TOOL type with file operations
        if (session.lastEvent.type === EventActivityType.TOOL &&
            session.lastEvent.toolName &&
            session.lastEvent.metadata?.fileName) {
            // Map tool names to activity types
            let activityType = EventActivityType.TOOL;
            if (session.lastEvent.toolName === 'Read') {
                activityType = EventActivityType.READ;
            }
            else if (session.lastEvent.toolName === 'Write' ||
                session.lastEvent.toolName === 'Edit' ||
                session.lastEvent.toolName === 'MultiEdit') {
                activityType = EventActivityType.EDIT;
            }
            return {
                type: activityType,
                fileName: session.lastEvent.metadata.fileName,
                filePath: session.lastEvent.metadata.filePath,
            };
        }
    }
    return null;
};
export const ArchivedAgentSessionCard = ({ session, isSelected, isActive, timeAgoStr, needsReview, largeFileCount, warningFileCount, maxLineCount, createdFiles, deletedFiles, fileAccessCount = 0, fileWriteCount = 0, toolCallCount = 0, webAccessCount = 0, showStatus = false, onClick, workingDirectory, agentColor, archiveStatus, isArchived = false, onArchive, onDismiss, layerFilter = 'all', onLayerFilterChange, onDebugClick, }) => {
    const { theme } = useTheme();
    const [copySuccess, setCopySuccess] = React.useState(false);
    // Function to copy resume command
    const copyResumeCommand = async (e) => {
        e.stopPropagation(); // Prevent triggering session selection
        try {
            const command = `claude --resume ${session.sessionId}`;
            await navigator.clipboard.writeText(command);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
        }
        catch (err) {
            console.error('Failed to copy resume command:', err);
        }
    };
    // Add CSS animation for pulse if not already defined
    React.useEffect(() => {
        const styleId = 'session-card-animations';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
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
    return (_jsxs("div", { onClick: onClick, style: {
            width: '100%',
            textAlign: 'left',
            padding: '12px',
            borderRadius: '8px',
            transition: 'all 0.2s',
            backgroundColor: isSelected
                ? theme.colors.backgroundHover
                : theme.colors.backgroundTertiary,
            border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
            color: isSelected ? theme.colors.text : theme.colors.textSecondary,
            cursor: 'pointer',
        }, onMouseEnter: (e) => {
            if (!isSelected) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                e.currentTarget.style.borderColor = theme.colors.backgroundHover;
            }
        }, onMouseLeave: (e) => {
            if (!isSelected) {
                e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                e.currentTarget.style.borderColor = theme.colors.border;
            }
        }, children: [isArchived && (_jsx("div", { style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: `${theme.colors.background}95`,
                    pointerEvents: 'none',
                    borderRadius: '8px',
                    zIndex: 1,
                } })), isArchived && (_jsxs("div", { style: {
                    position: 'relative',
                    zIndex: 2,
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    backgroundColor: `${theme.colors.success}20`,
                    border: `1px solid ${theme.colors.success}40`,
                    borderRadius: '6px',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: theme.colors.success,
                            fontSize: '12px',
                            fontWeight: 600,
                        }, children: [_jsx(CheckCircle, { size: 14 }), "Session Archived"] }), _jsxs("button", { onClick: (e) => {
                            e.stopPropagation();
                            onDismiss?.();
                        }, style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '4px',
                            color: theme.colors.textSecondary,
                            fontSize: '11px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                            e.currentTarget.style.color = theme.colors.text;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            e.currentTarget.style.color = theme.colors.textSecondary;
                        }, children: [_jsx(X, { size: 12 }), "Dismiss"] })] })), !isArchived && onArchive && (_jsx("div", { style: {
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 3,
                }, children: _jsx("button", { onClick: (e) => {
                        e.stopPropagation();
                        onArchive();
                    }, style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        color: theme.colors.textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }, onMouseEnter: (e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.primary;
                        e.currentTarget.style.borderColor = theme.colors.primary;
                        e.currentTarget.style.color = '#fff';
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        e.currentTarget.style.borderColor = theme.colors.border;
                        e.currentTarget.style.color = theme.colors.textSecondary;
                    }, title: "Archive this session", children: _jsx(Archive, { size: 14 }) }) })), _jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                    position: 'relative',
                    zIndex: isArchived ? 2 : 1,
                }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px',
                                }, children: [_jsx("p", { style: {
                                            margin: 0,
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            color: theme.colors.text,
                                        }, children: (workingDirectory || session.workingDirectory || 'Unknown')
                                            .split('/')
                                            .pop() || 'Unknown' }), (largeFileCount > 0 || warningFileCount > 0) && (_jsxs("span", { style: {
                                            fontSize: '12px',
                                            padding: '2px 8px',
                                            backgroundColor: `${theme.colors.warning}20`,
                                            color: theme.colors.warning,
                                            borderRadius: '999px',
                                        }, title: `${largeFileCount + warningFileCount} file(s) ${maxLineCount >= FILE_SIZE_THRESHOLDS.WARNING ? `up to ${maxLineCount.toLocaleString()} lines` : ''}`, children: [largeFileCount > 0 ? (_jsx(AlertTriangle, { size: 12, style: { display: 'inline-block', verticalAlign: 'middle' } })) : (_jsx(FileText, { size: 12, style: { display: 'inline-block', verticalAlign: 'middle' } })), ' ', largeFileCount + warningFileCount] }))] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsxs("p", { style: {
                                            margin: 0,
                                            fontSize: '14px',
                                            color: theme.colors.textSecondary,
                                            fontWeight: 400,
                                        }, children: [session.metadata?.agentType || 'Claude', " \u00B7", ' ', session.sessionId.slice(0, 8)] }), _jsxs("div", { style: { display: 'flex', gap: '4px' }, children: [_jsx("button", { onClick: copyResumeCommand, style: {
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: copySuccess
                                                        ? theme.colors.success
                                                        : theme.colors.textSecondary,
                                                    transition: 'all 0.2s ease',
                                                }, onMouseEnter: (e) => {
                                                    if (!copySuccess) {
                                                        e.currentTarget.style.backgroundColor =
                                                            theme.colors.backgroundHover;
                                                        e.currentTarget.style.color = theme.colors.text;
                                                    }
                                                }, onMouseLeave: (e) => {
                                                    if (!copySuccess) {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                        e.currentTarget.style.color = theme.colors.textSecondary;
                                                    }
                                                }, title: copySuccess
                                                    ? 'Copied!'
                                                    : 'Copy Command To Resume Session in a new terminal', children: copySuccess ? _jsx(Check, { size: 14 }) : _jsx(Copy, { size: 14 }) }), onDebugClick && (_jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    onDebugClick();
                                                }, style: {
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: theme.colors.textSecondary,
                                                    transition: 'all 0.2s ease',
                                                }, onMouseEnter: (e) => {
                                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
                                                    e.currentTarget.style.color = '#7c3aed';
                                                }, onMouseLeave: (e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                                }, title: "Debug Session", children: _jsx(Bug, { size: 14 }) })), _jsx("button", { onClick: (e) => {
                                                    e.stopPropagation(); // Prevent triggering session selection
                                                    window.electron.ipcRenderer.send('open-session-details-window', {
                                                        sessionId: session.sessionId,
                                                        directory: workingDirectory || session.workingDirectory,
                                                    });
                                                }, style: {
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: theme.colors.textSecondary,
                                                    transition: 'all 0.2s ease',
                                                }, onMouseEnter: (e) => {
                                                    e.currentTarget.style.backgroundColor =
                                                        theme.colors.backgroundHover;
                                                    e.currentTarget.style.color = theme.colors.text;
                                                }, onMouseLeave: (e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                                }, title: "Open session details in new window", children: _jsx(ExternalLink, { size: 14 }) })] })] }), session.metadata?.customName && (_jsx("p", { style: {
                                    margin: '4px 0 0 0',
                                    fontSize: '13px',
                                    color: theme.colors.textSecondary,
                                    fontStyle: 'italic',
                                }, children: session.metadata.customName }))] }), _jsxs("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '4px',
                            flexShrink: 0
                        }, children: [_jsx("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '3px 8px',
                                    backgroundColor: isActive
                                        ? `${theme.colors.success}15`
                                        : theme.colors.backgroundTertiary,
                                    border: `1px solid ${isActive
                                        ? `${theme.colors.success}40`
                                        : theme.colors.border}`,
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    color: isActive ? theme.colors.success : theme.colors.textSecondary,
                                    fontWeight: 600,
                                }, children: isActive ? (_jsxs(_Fragment, { children: [_jsx(Activity, { size: 12, style: {
                                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                            } }), "Active"] })) : (_jsxs(_Fragment, { children: [_jsx(Pause, { size: 12 }), "Inactive"] })) }), _jsxs("p", { style: {
                                    margin: 0,
                                    fontSize: '11px',
                                    color: theme.colors.textTertiary,
                                    textAlign: 'right',
                                }, children: ["Last: ", timeAgoStr] })] }), showStatus && (_jsxs("div", { style: { textAlign: 'right', flexShrink: 0 }, children: [_jsx("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                }, children: _jsx("span", { style: {
                                        fontSize: '11px',
                                        padding: '3px 8px',
                                        backgroundColor: 'transparent',
                                        color: !isSessionActive(session)
                                            ? agentColor || theme.colors.textSecondary
                                            : agentColor || theme.colors.success,
                                        border: `1px solid ${!isSessionActive(session)
                                            ? agentColor || theme.colors.textSecondary
                                            : agentColor || theme.colors.success}`,
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        animation: isSessionActive(session)
                                            ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                            : undefined,
                                    }, children: (() => {
                                        const active = isSessionActive(session);
                                        const text = active ? 'Working' : 'Finished';
                                        return text;
                                    })() }) }), _jsx("p", { style: {
                                    margin: 0,
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    marginTop: '4px',
                                    marginRight: '8px',
                                }, children: timeAgoStr })] }))] }), !isArchived && archiveStatus && archiveStatus.reason && (_jsx("div", { style: {
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }, children: archiveStatus.willArchive ? (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: `${theme.colors.warning}15`,
                        border: `1px solid ${theme.colors.warning}40`,
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: theme.colors.warning,
                        fontWeight: 500,
                    }, children: [_jsx(Archive, { size: 14 }), archiveStatus.reason] })) : archiveStatus.percentageToArchive > 50 ? (_jsx("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flex: 1,
                    }, children: _jsxs("div", { style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 10px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            position: 'relative',
                            overflow: 'hidden',
                        }, children: [_jsx("div", { style: {
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${archiveStatus.percentageToArchive}%`,
                                    backgroundColor: archiveStatus.percentageToArchive > 75
                                        ? `${theme.colors.warning}20`
                                        : `${theme.colors.primary}10`,
                                    transition: 'width 0.3s ease',
                                } }), _jsx(Clock, { size: 12, style: { position: 'relative', zIndex: 1 } }), _jsx("span", { style: { position: 'relative', zIndex: 1 }, children: archiveStatus.reason }), _jsxs("span", { style: {
                                    position: 'relative',
                                    zIndex: 1,
                                    marginLeft: 'auto',
                                    fontWeight: 600,
                                    color: archiveStatus.percentageToArchive > 75
                                        ? theme.colors.warning
                                        : theme.colors.textSecondary,
                                }, children: [Math.round(archiveStatus.percentageToArchive), "%"] })] }) })) : archiveStatus.reason.includes('Needs') ? (_jsx("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: theme.colors.textTertiary,
                        fontStyle: 'italic',
                    }, children: archiveStatus.reason })) : null })), (createdFiles > 0 || deletedFiles > 0) && (_jsxs("div", { style: { marginTop: '8px', display: 'flex', gap: '8px' }, children: [createdFiles > 0 && (_jsxs("span", { style: {
                            fontSize: '12px',
                            padding: '2px 8px',
                            backgroundColor: `${theme.colors.success}20`,
                            color: theme.colors.success,
                            borderRadius: '4px',
                        }, children: [_jsx(Sparkles, { size: 12, style: { display: 'inline-block', verticalAlign: 'middle' } }), ' ', createdFiles, " created"] })), deletedFiles > 0 && (_jsxs("span", { style: {
                            fontSize: '12px',
                            padding: '2px 8px',
                            backgroundColor: `${theme.colors.error}20`,
                            color: theme.colors.error,
                            borderRadius: '4px',
                        }, children: [_jsx(Trash2, { size: 12, style: { display: 'inline-block', verticalAlign: 'middle' } }), ' ', deletedFiles, " deleted"] }))] })), (() => {
                const lastActivity = getLastActivity(session);
                return lastActivity || fileAccessCount > 0 || fileWriteCount > 0 ? (_jsx("div", { style: {
                        marginTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }, children: lastActivity ? (_jsx("span", { style: {
                            fontSize: '12px',
                            color: agentColor || theme.colors.textTertiary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            animation: isSessionActive(session)
                                ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                : undefined,
                        }, children: getLastActivity(session).type === EventActivityType.READ ? (_jsxs(_Fragment, { children: [_jsx(BookOpen, { size: 12, style: {
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                    } }), ' ', isSessionActive(session) ? 'Reading' : 'Read', ' ', getLastActivity(session).fileName] })) : getLastActivity(session).type ===
                            EventActivityType.WRITE ? (_jsxs(_Fragment, { children: [_jsx(Edit3, { size: 12, style: {
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                    } }), ' ', isSessionActive(session) ? 'Creating' : 'Created', ' ', getLastActivity(session).fileName] })) : (_jsxs(_Fragment, { children: [_jsx(Edit3, { size: 12, style: {
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                    } }), ' ', isSessionActive(session) ? 'Updating' : 'Updated', ' ', getLastActivity(session).fileName] })) })) : (
                    // Fallback to file count display if no tool activity yet
                    _jsxs("div", { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' }, children: [fileAccessCount > 0 && (_jsxs("span", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textTertiary,
                                }, children: [_jsx(BookOpen, { size: 12, style: {
                                            display: 'inline-block',
                                            verticalAlign: 'middle',
                                        } }), ' ', fileAccessCount, " files read"] })), fileWriteCount > 0 && (_jsxs("span", { style: {
                                    fontSize: '12px',
                                    color: theme.colors.textTertiary,
                                }, children: [_jsx(Edit3, { size: 12, style: {
                                            display: 'inline-block',
                                            verticalAlign: 'middle',
                                        } }), ' ', fileWriteCount, " files written"] }))] })) })) : null;
            })()] }, session.sessionId));
};
