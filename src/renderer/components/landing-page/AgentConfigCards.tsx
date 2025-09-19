import React, { useEffect, useState } from 'react';
import { Bot, Database } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { getAgentInfo, SupportedAgent } from '@principal-ai/agent-monitoring';
import { AgentInstallationStatus } from '../../main-process-api/AgentConfigurationService';
import { StoreService } from '../../main-process-api/StoreService';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { StorageStats } from '../../../shared/main-process-api-interfaces/StoreAPI';
import { WindowService } from '../../main-process-api/WindowService';

interface AgentConfigCardsProps {
  agentStatus: AgentInstallationStatus | null;
  onSelectAgent: (agent: SupportedAgent) => void;
  onSelectAgentDetailed?: (agent: SupportedAgent) => void;
  isClaudeTourActive?: boolean;
  claudeTourStepIndex?: number;
  handleClaudeTourButtonClick?: (
    stepIndex: number,
    buttonAction: () => void,
  ) => void;
  hideEvents?: boolean;
}

export const AgentConfigCards: React.FC<AgentConfigCardsProps> = ({
  agentStatus,
  onSelectAgent,
  onSelectAgentDetailed,
  isClaudeTourActive,
  claudeTourStepIndex,
  handleClaudeTourButtonClick,
  hideEvents = false,
}) => {
  const { theme } = useTheme();
  const [agentEventStats, setAgentEventStats] = useState<
    Record<string, StorageStats>
  >({});
  const [pulsingAgents, setPulsingAgents] = useState<Set<string>>(new Set());
  const [hoveringDbAgents, setHoveringDbAgents] = useState<Set<string>>(
    new Set(),
  );

  // Don't render if no agents are installed
  if (!agentStatus) {
    return null;
  }

  // Get all agents (installed or not) for checking event data
  const allAgents: SupportedAgent[] = Object.keys(
    agentStatus,
  ) as SupportedAgent[];

  // Early return if no agents at all
  if (allAgents.length === 0) {
    return null;
  }

  // Check for existing events only once on mount
  useEffect(() => {
    const checkInitialEventStats = async () => {
      try {
        const namespaces = await StoreService.listNamespaces();
        const statsMap: Record<string, StorageStats> = {};

        // Check ALL agents for event data, not just installed ones
        for (const agent of allAgents) {
          // Find namespaces for this agent's events
          const agentNamespaces = namespaces.filter(
            (ns) =>
              ns.category === 'agent-session-events' && ns.name.includes(agent),
          );

          if (agentNamespaces.length > 0) {
            // Get stats for the first matching namespace
            const stats = await StoreService.getStats(agentNamespaces[0].name);
            if (stats && stats.totalKeys > 0) {
              statsMap[agent] = stats;
            }
          }
        }

        setAgentEventStats(statsMap);
      } catch (error) {
        console.error('Failed to check initial event stats:', error);
      }
    };

    // Only fetch once on mount
    checkInitialEventStats();
  }, [allAgents.join(',')]);

  // Listen for real-time events
  useEffect(() => {
    const handleAgentEvent = (...args: any[]) => {
      // The event might be the first arg or passed directly
      const event = args[0] || args;
      console.log('Received agent event:', event, 'Args:', args);

      if (event?.provider) {
        // Add pulse animation for this agent
        setPulsingAgents((prev) => new Set(prev).add(event.provider));

        // Remove pulse after animation completes
        setTimeout(() => {
          setPulsingAgents((prev) => {
            const newSet = new Set(prev);
            newSet.delete(event.provider);
            return newSet;
          });
        }, 2000);

        // Immediately increment the count
        setAgentEventStats((prev) => {
          const currentStats = prev[event.provider];
          if (currentStats) {
            // Increment existing count
            const newCount = currentStats.totalKeys + 1;
            console.log(
              `Event received for ${event.provider}: incrementing from ${currentStats.totalKeys} to ${newCount}`,
            );
            return {
              ...prev,
              [event.provider]: {
                ...currentStats,
                totalKeys: newCount,
              },
            };
          } else {
            // First event for this agent (or agent with no initial stats)
            console.log(
              `First tracked event for ${event.provider}, count now 1`,
            );
            return {
              ...prev,
              [event.provider]: {
                totalKeys: 1,
                totalSize: 0,
                lastModified: Date.now(),
                metadata: {},
                sizeBytes: 0,
              } as StorageStats,
            };
          }
        });
      }
    };

    // Listen directly to IPC events
    const unsubscribeCLI =
      AgentSessionService.onCliProviderEvent(handleAgentEvent);
    const unsubscribeProcessed =
      AgentSessionService.onProcessedEvent(handleAgentEvent);

    return () => {
      if (unsubscribeCLI) unsubscribeCLI();
      if (unsubscribeProcessed) unsubscribeProcessed();
    };
  }, []);

  const baseSize = 80; // Base size for cards
  const gap = 8;
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [lastClickedAgent, setLastClickedAgent] =
    useState<SupportedAgent | null>(null);

  const handleCardClick = (agent: SupportedAgent) => {
    const now = Date.now();
    const timeDiff = now - lastClickTime;

    // If it's a quick successive click on the same agent (within 500ms), treat as double-click
    if (lastClickedAgent === agent && timeDiff < 500) {
      // This is effectively a double-click, open detailed view
      if (onSelectAgentDetailed) {
        onSelectAgentDetailed(agent);
      }
      // Reset to prevent triple-clicks from triggering again
      setLastClickTime(0);
      setLastClickedAgent(null);
    } else {
      // Regular single click - open simple view immediately
      if (
        handleClaudeTourButtonClick &&
        isClaudeTourActive &&
        claudeTourStepIndex === 3
      ) {
        handleClaudeTourButtonClick(3, () => onSelectAgent(agent));
      } else {
        onSelectAgent(agent);
      }
      setLastClickTime(now);
      setLastClickedAgent(agent);
    }
  };

  const handleEventsClick = async (agent: SupportedAgent) => {
    try {
      // Open store viewer with specific agent filter
      await WindowService.openStoreViewer({
        agent: agent,
        namespace: 'events',
      });
    } catch (error) {
      console.error('Failed to open store viewer:', error);
    }
  };

  return (
    <div
      data-tour="show-details"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: `${gap}px`,
      }}
    >
      {allAgents
        .filter((agent) => {
          // Show agent if it's installed OR has event data
          const status = agentStatus[agent as keyof typeof agentStatus];
          const hasEvents = !!agentEventStats[agent];
          return status?.isInstalled || hasEvents;
        })
        .map((agent) => {
          const agentInfo = getAgentInfo(agent);
          const status = agentStatus[agent as keyof typeof agentStatus];
          const isInstalled = status?.isInstalled || false;
          const hasHooks = status?.hasHooks || false;
          const isHoveringDb = hoveringDbAgents.has(agent);
          const hasEvents = !!agentEventStats[agent];
          const isPulsing = pulsingAgents.has(agent);

          return (
            <div
              key={agent}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              {/* Agent Card */}
              <button
                onClick={() => handleCardClick(agent)}
                style={{
                  width: `${baseSize}px`,
                  height: `${baseSize}px`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `2px solid ${hasHooks ? agentInfo.ui.color : theme.colors.border}`,
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = hasHooks
                    ? `0 0 20px ${agentInfo.ui.color}40`
                    : '0 4px 12px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Background pattern */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `radial-gradient(circle at center, ${agentInfo.ui.color}10 0%, transparent 70%)`,
                    opacity: hasHooks ? 1 : 0.3,
                    pointerEvents: 'none',
                  }}
                />

                {/* Icon */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: hasHooks
                      ? agentInfo.ui.color + '20'
                      : theme.colors.backgroundTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Bot
                    size={20}
                    color={
                      hasHooks ? agentInfo.ui.color : theme.colors.textSecondary
                    }
                  />
                </div>

                {/* Name */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: hasHooks
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {agentInfo.displayName.split(' ')[0]}
                </span>

                {/* Status indicator */}
                {hasHooks && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: theme.colors.success,
                      boxShadow: `0 0 8px ${theme.colors.success}80`,
                    }}
                  />
                )}
              </button>

              {/* Database icon for each agent - show if has events data */}
              {hasEvents && !hideEvents && (
                <button
                  onClick={() => handleEventsClick(agent)}
                  onMouseEnter={() =>
                    setHoveringDbAgents((prev) => new Set(prev).add(agent))
                  }
                  onMouseLeave={() =>
                    setHoveringDbAgents((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(agent);
                      return newSet;
                    })
                  }
                  style={{
                    width: `${baseSize}px`,
                    height: `${baseSize}px`,
                    backgroundColor:
                      isHoveringDb || hasEvents
                        ? `${agentInfo.ui.color}10`
                        : theme.colors.backgroundSecondary,
                    border: `2px solid ${isHoveringDb || hasEvents ? agentInfo.ui.color : theme.colors.border}`,
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: isPulsing ? 'pulse 2s ease-in-out' : 'none',
                  }}
                >
                  {/* Background pattern */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `radial-gradient(circle at center, ${agentInfo.ui.color}10 0%, transparent 70%)`,
                      opacity: isHoveringDb || hasEvents ? 1 : 0.3,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Pulse animation overlay */}
                  {isPulsing && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: '12px',
                        backgroundColor: agentInfo.ui.color,
                        opacity: 0,
                        animation: 'pulseOverlay 2s ease-in-out',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor:
                        isHoveringDb || hasEvents
                          ? agentInfo.ui.color + '20'
                          : theme.colors.backgroundTertiary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      zIndex: 1,
                      transform: isHoveringDb ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <Database
                      size={20}
                      color={
                        isHoveringDb || hasEvents
                          ? agentInfo.ui.color
                          : theme.colors.textSecondary
                      }
                    />
                  </div>

                  {/* Label with event count */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color:
                          isHoveringDb || hasEvents
                            ? theme.colors.text
                            : theme.colors.textSecondary,
                      }}
                    >
                      Events
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: hasEvents
                          ? theme.colors.text
                          : theme.colors.textSecondary,
                        opacity: 0.9,
                      }}
                    >
                      {agentEventStats[agent]?.totalKeys || 0}
                    </span>
                  </div>

                  {/* Add CSS for pulse animations */}
                  <style>{`
                  @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                  }
                  
                  @keyframes pulseOverlay {
                    0% { opacity: 0; }
                    50% { opacity: 0.3; }
                    100% { opacity: 0; }
                  }
                `}</style>
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
};
