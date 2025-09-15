import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { Activity, Plus, } from 'lucide-react';
export const AgentSessionHeaderBoxes = ({ repositoryPath, localClonePaths = [], onSessionSelect, selectedSessionIds = new Set(), maxVisible = 20, agentSessions = [], onStartNewSession, }) => {
    const { theme } = useTheme();
    const [hoveredSession, setHoveredSession] = useState(null);
    const containerRef = useRef(null);
    // Commented out complex sizing for now
    // const [containerHeight, setContainerHeight] = useState<number>(44);
    // const [useHalfHeight, setUseHalfHeight] = useState(false);
    // Helper to format time ago
    const getTimeAgo = (timestamp) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (days > 0)
            return `${days}d`;
        if (hours > 0)
            return `${hours}h`;
        if (minutes > 0)
            return `${minutes}m`;
        return 'now';
    };
    // Agent color palette
    const getAgentColor = (sessionId) => {
        const colors = [
            '#F02C03',
            '#FF950C',
            '#FEDC03',
            '#7CDA01',
            '#0D8DFF',
            '#B02FF7',
        ];
        const hash = sessionId.split('').reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    };
    // Filter sessions to only show ones from the selected repository path (all statuses)
    const cloneSessions = useMemo(() => {
        console.log('[AgentSessionHeaderBoxes] Filtering sessions for clone:', {
            repositoryPath,
            totalSessions: agentSessions.length,
            sessions: agentSessions.map(s => ({
                id: s.sessionId.substring(0, 8),
                workingDirectory: s.workingDirectory,
                status: s.status
            }))
        });
        const filtered = agentSessions.filter(session => {
            // Must be from the selected repository path (if specified)
            const isFromSelectedPath = !repositoryPath || session.workingDirectory === repositoryPath;
            return isFromSelectedPath;
        });
        console.log('[AgentSessionHeaderBoxes] Filtered sessions:', {
            filteredCount: filtered.length,
            filtered: filtered.map(s => ({
                id: s.sessionId.substring(0, 8),
                workingDirectory: s.workingDirectory,
                status: s.status
            }))
        });
        return filtered;
    }, [agentSessions, repositoryPath]);
    // Commented out complex sizing logic for now
    // useEffect(() => {
    //   if (!containerRef.current?.parentElement) return;
    //   
    //   const updateLayout = () => {
    //     const parent = containerRef.current?.parentElement;
    //     if (!parent) return;
    //     
    //     // Try multiple ways to get parent height
    //     const parentHeight = parent.clientHeight || parent.offsetHeight || 44;
    //     const parentWidth = parent.clientWidth || parent.offsetWidth || 400;
    //     
    //     // Only update if we have a valid height
    //     if (parentHeight > 0) {
    //       setContainerHeight(parentHeight);
    //     }
    //     
    //     // Calculate how many boxes can fit at full height
    //     const gap = 8;
    //     const fullHeight = parentHeight;
    //     const halfHeight = Math.floor(parentHeight / 2) - (gap / 2);
    //     const availableWidth = parentWidth - 32; // Account for padding/margins
    //     
    //     // At full height
    //     const boxesPerRowFull = Math.floor(availableWidth / (fullHeight + gap));
    //     const canFitFullHeight = sessions.length <= boxesPerRowFull;
    //     
    //     // At half height (2 rows)
    //     const boxesPerRowHalf = Math.floor(availableWidth / (halfHeight + gap));
    //     const canFitHalfHeight = sessions.length <= boxesPerRowHalf * 2;
    //     
    //     // Use full height if all fit, otherwise use half height for 2 rows
    //     setUseHalfHeight(!canFitFullHeight && canFitHalfHeight);
    //   };
    //   
    //   // Initial update with small delay to ensure parent is rendered
    //   setTimeout(updateLayout, 0);
    //   
    //   // Set up ResizeObserver to watch for parent size changes
    //   let resizeObserver: ResizeObserver | null = null;
    //   if (typeof ResizeObserver !== 'undefined') {
    //     resizeObserver = new ResizeObserver(() => {
    //       updateLayout();
    //     });
    //     resizeObserver.observe(containerRef.current.parentElement);
    //   } else {
    //     // Fallback for older browsers
    //     window.addEventListener('resize', updateLayout);
    //   }
    //   
    //   return () => {
    //     if (resizeObserver) {
    //       resizeObserver.disconnect();
    //     } else {
    //       window.removeEventListener('resize', updateLayout);
    //     }
    //   };
    // }, [sessions.length]);
    // Calculate box height as 75% of container
    const boxHeight = '36px'; // 75% of typical 48px container height
    return (_jsxs("div", { ref: containerRef, style: {
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            height: '100%',
        }, children: [cloneSessions.map((session) => {
                const isSelected = selectedSessionIds.has(session.sessionId);
                const isHovered = hoveredSession === session.sessionId;
                const sessionColor = getAgentColor(session.sessionId);
                const timeAgo = getTimeAgo(session.lastActivity || Date.now());
                return (_jsxs("button", { onClick: () => onSessionSelect?.(session), onMouseEnter: () => setHoveredSession(session.sessionId), onMouseLeave: () => setHoveredSession(null), style: {
                        width: boxHeight,
                        height: boxHeight,
                        backgroundColor: theme.colors.backgroundTertiary,
                        border: `1px solid ${isSelected || isHovered ? sessionColor : theme.colors.border}`,
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }, title: `${session.customName || 'Session'} - ${session.statusText} - ${session.fileAccessCount || 0} files accessed, ${timeAgo} ago`, children: [_jsx("div", { style: {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: `radial-gradient(circle at center, ${sessionColor}15 0%, transparent 70%)`,
                                opacity: isSelected || isHovered ? 1 : 0.5,
                                pointerEvents: 'none',
                            } }), _jsx("div", { style: {
                                position: 'relative',
                                zIndex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, children: _jsx(Activity, { size: 16, color: sessionColor }) }), _jsx("div", { style: {
                                position: 'absolute',
                                top: '2px',
                                left: '2px',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: session.statusColor,
                                boxShadow: `0 0 8px ${session.statusColor}80`,
                                animation: session.status === 'active' ? 'pulse 2s infinite' : 'none',
                            } })] }, session.sessionId));
            }), _jsx("button", { onClick: onStartNewSession, style: {
                    width: boxHeight,
                    height: boxHeight,
                    backgroundColor: theme.colors.backgroundTertiary,
                    border: `2px dashed ${theme.colors.border}`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                }, onMouseEnter: (e) => {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.backgroundColor = theme.colors.primary + '11';
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                }, title: "Start new agent session", children: _jsx(Plus, { size: 18, color: theme.colors.textSecondary }) }), _jsx("style", { children: `
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.5);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      ` })] }));
};
