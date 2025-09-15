import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Edit3, Activity, Clock, Edit2, Copy, Check, Circle, BookOpen, Map, PlayCircle, ChevronDown, ChevronUp, FolderOpen, X, Search, Sparkles } from 'lucide-react';
import { EventCarousel } from '../../../components/session-history/EventCarousel';
import { AgentSessionService } from '../../../main-process-api/AgentSessionService';
// Add shimmer animation CSS
const shimmerStyle = `
  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 200%;
    }
  }
`;
export const AgentSessionCard = ({ cardData, sessionColor, theme, sources, repositoryPath, isEditingName, editingName, editInputRef, isCopied, isArchiving, isShownOnMap, onStartEditName, onSaveEditName, onCancelEditName, onEditNameChange, onCopySessionId, onOpenTerminal, onShowContext, onArchive, onOpenPackageCommands, onOpenInEditor, onOpenAllInEditor, onToggleShowOnMap, onViewEvents, onHighlightFiles, onSessionDetailSelect, getTimeAgo }) => {
    // Event carousel state
    const [showCarousel, setShowCarousel] = useState(false);
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    // Current task expanded state
    const [isTaskExpanded, setIsTaskExpanded] = useState(false);
    // Details (header) visibility state
    const [showDetails, setShowDetails] = useState(false);
    // Terminal loading state
    const [isTerminalLoading, setIsTerminalLoading] = useState(false);
    // Load events when carousel is toggled
    useEffect(() => {
        if (showCarousel && events.length === 0 && !loadingEvents) {
            setLoadingEvents(true);
            AgentSessionService.getSessionEvents(cardData.session.sessionId)
                .then(sessionEvents => {
                if (sessionEvents) {
                    setEvents(sessionEvents);
                }
            })
                .catch(error => {
                console.error('Failed to load session events:', error);
            })
                .finally(() => {
                setLoadingEvents(false);
            });
        }
    }, [showCarousel, events.length, loadingEvents, cardData.session.sessionId]);
    // Handle event selection from carousel
    const handleEventSelect = useCallback((event, files) => {
        // Highlight files on the map
        if (onHighlightFiles) {
            onHighlightFiles(files, 'single');
        }
    }, [onHighlightFiles]);
    // Handle highlight mode change from carousel
    const handleHighlightModeChange = useCallback((mode) => {
        // Get current event's files if carousel is showing
        if (showCarousel && events.length > 0 && onHighlightFiles) {
            // The carousel will call handleEventSelect with the current event
            // We just need to update the mode here if needed
        }
    }, [showCarousel, events, onHighlightFiles]);
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: shimmerStyle }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    minHeight: 'auto'
                }, children: [(() => {
                        const hasTodos = cardData.lastTodos && cardData.lastTodos.length > 0;
                        // If we have todos, prepare the todo data
                        let todoToShow = null;
                        if (hasTodos && cardData.lastTodos) {
                            // Priority: in_progress > first pending > last completed
                            const inProgressTodo = cardData.lastTodos.find(t => t.status === 'in_progress');
                            const pendingTodos = cardData.lastTodos.filter(t => t.status === 'pending');
                            const completedTodos = cardData.lastTodos.filter(t => t.status === 'completed');
                            todoToShow = inProgressTodo ||
                                pendingTodos[0] ||
                                completedTodos[completedTodos.length - 1];
                        }
                        return (_jsxs("div", { style: {
                                padding: '16px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                borderBottom: `1px solid ${theme.colors.border}`
                            }, children: [_jsxs("div", { onClick: (e) => {
                                        e.stopPropagation();
                                        setIsTaskExpanded(!isTaskExpanded);
                                    }, style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }, children: [_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }, children: [_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        color: theme.colors.textSecondary,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px'
                                                    }, children: hasTodos ? 'Current Task' : 'Last Event' }), _jsxs("span", { style: {
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px',
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        backgroundColor: cardData.session.statusColor + '20',
                                                        color: cardData.session.statusColor,
                                                        fontSize: '10px',
                                                        fontWeight: 600
                                                    }, children: [_jsx("div", { style: {
                                                                width: '5px',
                                                                height: '5px',
                                                                borderRadius: '2px',
                                                                backgroundColor: cardData.session.statusColor
                                                            } }), cardData.session.statusText] })] }), _jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }, children: [onOpenTerminal && (_jsxs("button", { onClick: async (e) => {
                                                        e.stopPropagation();
                                                        console.log('[AgentSessionCard] Resume button clicked');
                                                        setIsTerminalLoading(true);
                                                        try {
                                                            await onOpenTerminal();
                                                        }
                                                        finally {
                                                            // Keep loading for a moment to show the window is opening
                                                            setTimeout(() => setIsTerminalLoading(false), 1500);
                                                        }
                                                    }, disabled: isTerminalLoading, style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '2px 6px',
                                                        backgroundColor: isTerminalLoading ? theme.colors.backgroundTertiary : theme.colors.primary,
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        color: isTerminalLoading ? theme.colors.textSecondary : '#fff',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        cursor: isTerminalLoading ? 'wait' : 'pointer',
                                                        transition: 'all 0.2s',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        minWidth: '55px'
                                                    }, title: isTerminalLoading ? "Opening terminal..." : "Resume session in terminal", children: [isTerminalLoading && (_jsx("div", { style: {
                                                                position: 'absolute',
                                                                top: 0,
                                                                left: '-100%',
                                                                width: '100%',
                                                                height: '100%',
                                                                background: `linear-gradient(90deg, 
                          transparent 0%, 
                          ${theme.colors.primary}40 50%, 
                          transparent 100%)`,
                                                                animation: 'shimmer 1.5s infinite'
                                                            } })), _jsx("span", { style: { position: 'relative', zIndex: 1 }, children: isTerminalLoading ? 'Opening...' : 'Resume' })] })), onSessionDetailSelect && (_jsx("button", { onClick: (e) => {
                                                        e.stopPropagation();
                                                        console.log('[AgentSessionCard] Details button clicked');
                                                        onSessionDetailSelect();
                                                    }, style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '2px 6px',
                                                        backgroundColor: 'transparent',
                                                        border: `1px solid ${theme.colors.border}`,
                                                        borderRadius: '4px',
                                                        color: theme.colors.textSecondary,
                                                        fontSize: '10px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }, title: "Open detail view", children: "Details" })), _jsx("button", { onClick: (e) => {
                                                        e.stopPropagation();
                                                        setShowDetails(!showDetails);
                                                    }, style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '2px 6px',
                                                        backgroundColor: showDetails ? theme.colors.primary + '20' : 'transparent',
                                                        border: `1px solid ${showDetails ? theme.colors.primary : theme.colors.border}`,
                                                        borderRadius: '4px',
                                                        color: showDetails ? theme.colors.primary : theme.colors.textSecondary,
                                                        fontSize: '10px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        fontWeight: showDetails ? 600 : 400
                                                    }, title: showDetails ? "Hide debug info" : "Show debug info", children: "Debug" }), _jsx("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        color: theme.colors.textSecondary
                                                    }, children: isTaskExpanded ? _jsx(ChevronUp, { size: 12 }) : _jsx(ChevronDown, { size: 12 }) })] })] }), _jsx("div", { style: {
                                        marginTop: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }, children: hasTodos && todoToShow ? (
                                    // Show todo information
                                    _jsxs(_Fragment, { children: [todoToShow.status === 'completed' ? (_jsx(Check, { size: 14, color: theme.colors.success })) : todoToShow.status === 'in_progress' ? (_jsx(Clock, { size: 14, color: theme.colors.primary })) : (_jsx(Circle, { size: 14, color: theme.colors.textSecondary })), _jsx("span", { style: {
                                                    flex: 1,
                                                    color: todoToShow.status === 'completed' ? theme.colors.textSecondary : theme.colors.text,
                                                    fontSize: '13px',
                                                    lineHeight: '1.5'
                                                }, children: todoToShow.content }), _jsx("span", { style: {
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.3px',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    backgroundColor: todoToShow.status === 'completed' ? theme.colors.success + '20' :
                                                        todoToShow.status === 'in_progress' ? theme.colors.primary + '20' :
                                                            theme.colors.textSecondary + '20'
                                                }, children: todoToShow.status })] })) : (
                                    // Show last event information
                                    _jsxs(_Fragment, { children: [_jsx(Sparkles, { size: 14, color: sessionColor }), _jsx("span", { style: {
                                                    flex: 1,
                                                    color: theme.colors.text,
                                                    fontSize: '13px',
                                                    lineHeight: '1.5',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }, children: cardData.latestEvent ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: sessionColor, fontWeight: 500 }, children: cardData.latestEvent.toolName }), cardData.latestEvent.fileName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "\u2192" }), _jsx("span", { style: { fontFamily: 'monospace', fontSize: '12px', color: theme.colors.textSecondary }, children: cardData.latestEvent.fileName })] }))] })) : (_jsx("span", { style: { color: theme.colors.textSecondary, fontStyle: 'italic' }, children: "No events yet" })) }), cardData.latestEvent && (_jsx("span", { style: {
                                                    fontSize: '10px',
                                                    color: theme.colors.textSecondary,
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    backgroundColor: theme.colors.backgroundTertiary
                                                }, children: new Date(cardData.latestEvent.timestamp).toLocaleTimeString() }))] })) }), isTaskExpanded && hasTodos && cardData.lastTodos && (() => {
                                    // Show all todos in order: in_progress first, then pending, then completed
                                    const orderedTodos = [
                                        ...cardData.lastTodos.filter(t => t.status === 'in_progress'),
                                        ...cardData.lastTodos.filter(t => t.status === 'pending'),
                                        ...cardData.lastTodos.filter(t => t.status === 'completed')
                                    ];
                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                                    marginTop: '12px',
                                                    fontSize: '11px',
                                                    color: theme.colors.textSecondary,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    marginBottom: '8px'
                                                }, children: ["All Tasks (", orderedTodos.length, ")"] }), _jsx("div", { style: {
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px'
                                                }, children: orderedTodos.map((todo, index) => (_jsxs("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '8px 12px',
                                                        backgroundColor: theme.colors.background,
                                                        borderRadius: '6px',
                                                        border: `1px solid ${theme.colors.border}`,
                                                        fontSize: '12px'
                                                    }, children: [todo.status === 'completed' ? (_jsx(Check, { size: 12, color: theme.colors.success })) : todo.status === 'in_progress' ? (_jsx(Clock, { size: 12, color: theme.colors.primary })) : (_jsx(Circle, { size: 12, color: theme.colors.textSecondary })), _jsx("span", { style: {
                                                                flex: 1,
                                                                color: todo.status === 'completed' ? theme.colors.textSecondary : theme.colors.text,
                                                                fontSize: '12px',
                                                                lineHeight: '1.4'
                                                            }, children: todo.content }), _jsx("span", { style: {
                                                                fontSize: '10px',
                                                                color: theme.colors.textSecondary,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.3px',
                                                                padding: '2px 6px',
                                                                borderRadius: '3px',
                                                                backgroundColor: todo.status === 'completed' ? theme.colors.success + '20' :
                                                                    todo.status === 'in_progress' ? theme.colors.primary + '20' :
                                                                        theme.colors.textSecondary + '20'
                                                            }, children: todo.status })] }, todo.id || index))) })] }));
                                })()] }));
                    })(), showDetails && (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            backgroundColor: theme.colors.background,
                            borderBottom: `1px solid ${theme.colors.border}`
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }, children: [_jsxs("div", { style: {
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            backgroundColor: sessionColor + '20',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative'
                                        }, children: [_jsx(Activity, { size: 18, color: sessionColor }), cardData.session.status !== 'stopped' && cardData.session.status !== 'inactive' && (_jsx("div", { className: cardData.activityType ? `activity-dot ${cardData.activityType}` : '', style: {
                                                    position: 'absolute',
                                                    top: '-2px',
                                                    right: '-2px',
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '3px',
                                                    backgroundColor: cardData.session.statusColor,
                                                    boxShadow: cardData.activityType ? `0 0 8px ${cardData.session.statusColor}80` : 'none',
                                                    animation: !cardData.activityType ? 'none' : undefined
                                                } }))] }), _jsxs("div", { children: [_jsx("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '2px'
                                                }, children: isEditingName ? (_jsxs(_Fragment, { children: [_jsx("input", { ref: editInputRef, type: "text", value: editingName, onChange: (e) => onEditNameChange(e.target.value), onKeyDown: (e) => {
                                                                if (e.key === 'Enter') {
                                                                    onSaveEditName();
                                                                }
                                                                else if (e.key === 'Escape') {
                                                                    onCancelEditName();
                                                                }
                                                            }, onBlur: onSaveEditName, style: {
                                                                fontSize: '14px',
                                                                fontWeight: 600,
                                                                color: theme.colors.text,
                                                                backgroundColor: theme.colors.backgroundSecondary,
                                                                border: `1px solid ${theme.colors.primary}`,
                                                                borderRadius: '4px',
                                                                padding: '4px 8px',
                                                                outline: 'none',
                                                                minWidth: '200px'
                                                            } }), _jsx("button", { onClick: onSaveEditName, style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '4px',
                                                                backgroundColor: 'transparent',
                                                                border: 'none',
                                                                color: '#10b981',
                                                                cursor: 'pointer'
                                                            }, title: "Save", children: _jsx(Check, { size: 16 }) }), _jsx("button", { onClick: onCancelEditName, style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '4px',
                                                                backgroundColor: 'transparent',
                                                                border: 'none',
                                                                color: theme.colors.textSecondary,
                                                                cursor: 'pointer'
                                                            }, title: "Cancel", children: _jsx(X, { size: 16 }) })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                                fontSize: '14px',
                                                                fontWeight: 600,
                                                                color: theme.colors.text
                                                            }, children: cardData.session.customName || `Session ${cardData.session.sessionId.substring(0, 8)}` }), _jsx("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                onStartEditName();
                                                            }, style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '2px',
                                                                backgroundColor: 'transparent',
                                                                border: 'none',
                                                                color: theme.colors.textSecondary,
                                                                cursor: 'pointer',
                                                                transition: 'color 0.2s'
                                                            }, title: "Edit name", children: _jsx(Edit2, { size: 14 }) })] })) }), _jsxs("div", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }, children: [_jsx(FolderOpen, { size: 12 }), cardData.session.workingDirectory?.split('/').pop() || 'Unknown', _jsx("span", { style: { opacity: 0.5 }, children: "\u2022" }), _jsx("span", { style: {
                                                            fontFamily: 'monospace',
                                                            fontSize: '11px',
                                                            color: theme.colors.textTertiary,
                                                            cursor: 'pointer',
                                                            transition: 'color 0.2s'
                                                        }, onClick: onCopySessionId, onMouseEnter: (e) => e.currentTarget.style.color = theme.colors.primary, onMouseLeave: (e) => e.currentTarget.style.color = theme.colors.textTertiary, title: "Click to copy session ID", children: cardData.session.sessionId.substring(0, 8) }), _jsx("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            onCopySessionId();
                                                        }, style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: '2px',
                                                            backgroundColor: 'transparent',
                                                            border: 'none',
                                                            color: isCopied ? '#10b981' : theme.colors.textTertiary,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }, title: isCopied ? 'Copied!' : 'Copy full ID', children: isCopied ? _jsx(Check, { size: 12 }) : _jsx(Copy, { size: 12 }) })] }), _jsxs("div", { style: {
                                                    fontSize: '11px',
                                                    color: theme.colors.textTertiary,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginTop: '2px'
                                                }, children: [_jsxs("span", { style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                            padding: '2px 6px',
                                                            borderRadius: '10px',
                                                            backgroundColor: cardData.session.statusColor + '20',
                                                            color: cardData.session.statusColor,
                                                            fontSize: '10px',
                                                            fontWeight: 600
                                                        }, children: [_jsx("div", { style: {
                                                                    width: '5px',
                                                                    height: '5px',
                                                                    borderRadius: '2px',
                                                                    backgroundColor: cardData.session.statusColor
                                                                } }), cardData.session.statusText] }), (() => {
                                                        const hasWriteOps = cardData.fileOperations && Array.from(cardData.fileOperations.values()).some(f => f.operations.some(op => op.type === 'write' || op.type === 'edit'));
                                                        const hasReadOps = cardData.fileOperations && Array.from(cardData.fileOperations.values()).some(f => f.operations.some(op => op.type === 'read'));
                                                        if (!hasWriteOps && hasReadOps) {
                                                            return (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.5 }, children: "\u2022" }), _jsxs("span", { style: {
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            padding: '2px 6px',
                                                                            borderRadius: '10px',
                                                                            backgroundColor: theme.colors.primary + '20',
                                                                            color: theme.colors.primary,
                                                                            fontSize: '10px',
                                                                            fontWeight: 600
                                                                        }, children: [_jsx(Search, { size: 8 }), "Research Only"] })] }));
                                                        }
                                                        return null;
                                                    })(), _jsx("span", { style: { opacity: 0.5 }, children: "\u2022" }), _jsxs("span", { title: "Last activity", children: [_jsx(Clock, { size: 10, style: { display: 'inline', marginRight: '2px' } }), getTimeAgo(cardData.session.lastActivity || Date.now())] }), _jsx("span", { style: { opacity: 0.5 }, children: "\u2022" }), _jsxs("span", { className: cardData.eventCountUpdated ? 'event-count-updated' : '', style: {
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            transition: 'all 0.3s'
                                                        }, title: "Total events", children: [cardData.session.eventCount || 0, " events"] })] }), cardData.latestEvent && (_jsxs("div", { style: {
                                                    fontSize: '11px',
                                                    color: theme.colors.textTertiary,
                                                    marginTop: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }, children: [_jsx(Sparkles, { size: 10, color: sessionColor }), _jsx("span", { style: { color: sessionColor, fontWeight: 500 }, children: cardData.latestEvent.toolName }), cardData.latestEvent.fileName && (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.5 }, children: "\u2192" }), _jsx("span", { style: { fontFamily: 'monospace', fontSize: '10px' }, children: cardData.latestEvent.fileName })] })), _jsx("span", { style: { opacity: 0.5 }, children: "\u2022" }), _jsx("span", { children: new Date(cardData.latestEvent.timestamp).toLocaleTimeString() })] }))] })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '4px'
                                }, children: [_jsxs("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            setShowCarousel(!showCarousel);
                                        }, style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            backgroundColor: showCarousel ? theme.colors.primary + '20' : 'transparent',
                                            border: `1px solid ${showCarousel ? theme.colors.primary : theme.colors.border}`,
                                            borderRadius: '4px',
                                            color: showCarousel ? theme.colors.primary : theme.colors.text,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: showCarousel ? 600 : 400
                                        }, title: showCarousel ? "Hide event playback" : "Show event playback", children: [_jsx(PlayCircle, { size: 12 }), "Playback"] }), onToggleShowOnMap && (_jsxs("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            onToggleShowOnMap();
                                        }, style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            backgroundColor: isShownOnMap ? theme.colors.primary + '20' : 'transparent',
                                            border: `1px solid ${isShownOnMap ? theme.colors.primary : theme.colors.border}`,
                                            borderRadius: '4px',
                                            color: isShownOnMap ? theme.colors.primary : theme.colors.text,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: isShownOnMap ? 600 : 400
                                        }, title: isShownOnMap ? "Hide from map" : "Show files on map", children: [_jsx(Map, { size: 12 }), "Map"] }))] })] })), ((cardData.fileOperations && cardData.fileOperations.size > 0) || showCarousel) && (_jsxs("div", { style: {
                            padding: '16px',
                            backgroundColor: theme.colors.backgroundSecondary
                        }, children: [cardData.fileOperations && cardData.fileOperations.size > 0 && (_jsx("div", { style: {
                                    marginBottom: showCarousel ? '16px' : 0
                                }, children: _jsxs("div", { style: {
                                        display: 'flex',
                                        gap: '12px',
                                        padding: '8px 12px',
                                        backgroundColor: theme.colors.background,
                                        borderRadius: '6px',
                                        border: `1px solid ${theme.colors.border}`
                                    }, children: [(cardData.session.fileAccessCount ?? 0) > 0 && (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary
                                            }, children: [_jsx(BookOpen, { size: 14 }), _jsxs("span", { children: [cardData.session.fileAccessCount ?? 0, " read"] })] })), (cardData.session.fileWriteCount ?? 0) > 0 && (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '12px',
                                                color: theme.colors.textSecondary
                                            }, children: [_jsx(Edit3, { size: 14 }), _jsxs("span", { children: [cardData.session.fileWriteCount ?? 0, " modified"] })] })), onSessionDetailSelect && (_jsx("div", { style: {
                                                marginLeft: 'auto',
                                                fontSize: '11px',
                                                color: theme.colors.textTertiary,
                                                fontStyle: 'italic',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }, children: "Click header for details \u2192" }))] }) })), showCarousel && (_jsx("div", { style: {
                                    borderTop: cardData.fileOperations && cardData.fileOperations.size > 0
                                        ? `1px solid ${theme.colors.border}` : 'none',
                                    paddingTop: cardData.fileOperations && cardData.fileOperations.size > 0
                                        ? '12px' : 0,
                                    paddingBottom: '12px',
                                    paddingLeft: '12px',
                                    paddingRight: '12px'
                                }, children: loadingEvents ? (_jsx("div", { style: {
                                        textAlign: 'center',
                                        padding: '20px',
                                        color: theme.colors.textSecondary,
                                        fontSize: '12px'
                                    }, children: "Loading events..." })) : events.length > 0 ? (_jsx(EventCarousel, { events: events, onEventSelect: handleEventSelect, onHighlightModeChange: handleHighlightModeChange })) : (_jsx("div", { style: {
                                        textAlign: 'center',
                                        padding: '20px',
                                        color: theme.colors.textSecondary,
                                        fontSize: '12px'
                                    }, children: "No events found for this session" })) }))] }))] })] }));
};
