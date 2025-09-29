import React, {
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Terminal as TerminalIcon,
  X,
  Plus,
  Play,
  Bug,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import TerminalPanel from './TerminalPanel';
import { TerminalService } from '../../main-process-api/TerminalService';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { TerminalDebugModal } from './TerminalDebugModal';
import { getAgentInfo, SupportedAgent } from '@principal-ai/agent-monitoring';

export interface TerminalTab {
  id: string;
  label: string;
  directory: string;
  agentSessionId?: string;
  command?: string;
  isActive: boolean;
}

interface TabbedTerminalPanelProps {
  directory: string;
  hideHeader?: boolean;
  isVisible?: boolean;
  onTabsChange?: (tabs: TerminalTab[]) => void;
  initialTabs?: TerminalTab[];
}

export interface TabbedTerminalPanelRef {
  addClaudeSession: (sessionId: string, sessionName?: string) => Promise<void>;
}

export const TabbedTerminalPanel = forwardRef<
  TabbedTerminalPanelRef,
  TabbedTerminalPanelProps
>(
  (
    {
      directory,
      hideHeader = false,
      isVisible = true,
      onTabsChange,
      initialTabs = [],
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const [tabs, setTabs] = useState<TerminalTab[]>(initialTabs);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [sessionIds, setSessionIds] = useState<Map<string, string>>(
      new Map(),
    );
    const [showDebugModal, setShowDebugModal] = useState(false);

    // Switch to a tab
    const switchTab = useCallback(
      (tabId: string) => {
        console.log(
          '[TabbedTerminal] Switching to tab:',
          tabId,
          'from:',
          activeTabId,
        );
        setTabs((prevTabs) => {
          const newTabs = prevTabs.map((t) => ({
            ...t,
            isActive: t.id === tabId,
          }));
          console.log('[TabbedTerminal] Updated tabs:', newTabs);
          return newTabs;
        });
        setActiveTabId(tabId);

        // Log session info for the tab
        const sessionId = sessionIds.get(tabId);
        console.log('[TabbedTerminal] Tab', tabId, 'has session:', sessionId);
      },
      [activeTabId, sessionIds],
    );

    // Create a new terminal tab
    const addNewTab = useCallback(
      (label?: string, command?: string, agentSessionId?: string) => {
        const newTab: TerminalTab = {
          id: `tab-${Date.now()}`,
          label: label || `Terminal ${tabs.length + 1}`,
          directory,
          agentSessionId,
          command,
          isActive: true,
        };

        setTabs((prevTabs) => {
          const updatedTabs = prevTabs.map((t) => ({ ...t, isActive: false }));
          const newTabs = [...updatedTabs, newTab];
          onTabsChange?.(newTabs);
          return newTabs;
        });

        setActiveTabId(newTab.id);
      },
      [tabs, directory, onTabsChange],
    );

    // Open terminal for Claude session
    const openClaudeSessionTerminal = useCallback(
      async (sessionId: string, sessionName?: string) => {
        // First check if we already have a tab for this agent session
        const existingTab = tabs.find((t) => t.agentSessionId === sessionId);
        if (existingTab) {
          console.log(
            '[TabbedTerminal] Found existing tab for agent session:',
            sessionId,
            'tab:',
            existingTab.id,
          );
          switchTab(existingTab.id);
          return;
        }

        // Check if the agent session has an active terminal session in the backend
        try {
          // Get the agent session to check for terminal sessions
          const agentSession = await AgentSessionService.getSession(
            sessionId,
            directory,
          );
          if (agentSession && agentSession.terminalSessions) {
            // Look for an active terminal session
            const activeTerminal = agentSession.terminalSessions.find(
              (t) => t.status === 'active',
            );

            if (activeTerminal) {
              console.log(
                '[TabbedTerminal] Found existing terminal session:',
                activeTerminal.terminalId,
                'for agent:',
                sessionId,
              );

              // Verify the terminal session still exists in backend
              const terminals = await TerminalService.list();
              const terminalExists = terminals.some(
                (t) => t.id === activeTerminal.terminalId,
              );

              if (terminalExists) {
                // Create a tab that reattaches to the existing terminal
                const label =
                  sessionName || `Claude: ${sessionId.substring(0, 8)}`;
                const newTab: TerminalTab = {
                  id: `tab-${Date.now()}`,
                  label,
                  directory,
                  agentSessionId: sessionId,
                  command: undefined, // Don't run command since terminal already exists
                  isActive: true,
                };

                setTabs((prevTabs) => {
                  const updatedTabs = prevTabs.map((t) => ({
                    ...t,
                    isActive: false,
                  }));
                  const newTabs = [...updatedTabs, newTab];
                  onTabsChange?.(newTabs);
                  return newTabs;
                });

                setActiveTabId(newTab.id);

                // Map the existing terminal session to this tab
                setSessionIds((prev) =>
                  new Map(prev).set(newTab.id, activeTerminal.terminalId),
                );

                console.log(
                  '[TabbedTerminal] Reattached to existing terminal:',
                  activeTerminal.terminalId,
                );
                return;
              }
            }
          }
        } catch (err) {
          console.error(
            '[TabbedTerminal] Error checking for existing terminal:',
            err,
          );
        }

        // Determine which agent was used for this session
        let agentBinary = 'claude'; // Default to claude for backwards compatibility
        let agentDisplayName = 'Claude';

        try {
          // Try to get session events to determine the agent type
          const events = await AgentSessionService.getSessionEvents(sessionId);
          if (events && events.length > 0) {
            // Get the provider from the first event (all events in a session should have the same provider)
            const provider = events[0].provider as SupportedAgent;
            if (provider) {
              const agentInfo = getAgentInfo(provider);
              agentBinary = agentInfo.installation?.binaryName || provider;
              agentDisplayName = agentInfo.displayName;
              console.log(
                `[TabbedTerminal] Detected agent: ${provider} with binary: ${agentBinary} for session ${sessionId}`,
              );
            }
          }
        } catch (err) {
          console.warn(
            '[TabbedTerminal] Could not determine agent type, using default:',
            err,
          );
        }

        // No existing tab or terminal session, create new
        const label =
          sessionName || `${agentDisplayName}: ${sessionId.substring(0, 8)}`;
        const command = `${agentBinary} -r ${sessionId}`;
        addNewTab(label, command, sessionId);
      },
      [addNewTab, tabs, switchTab, directory, onTabsChange],
    );

    // Initialize with a default tab if none exist and cleanup on unmount
    useEffect(() => {
      console.log(
        '[TabbedTerminal] Mounting with',
        initialTabs.length,
        'initial tabs, isVisible:',
        isVisible,
      );

      // Clean up orphaned sessions on mount
      const cleanupOrphans = async () => {
        try {
          const allSessions = await TerminalService.list();
          console.log(
            '[TabbedTerminal] Found',
            allSessions.length,
            'total sessions on mount',
          );

          // Check each session to see if it's orphaned
          for (const session of allSessions) {
            // Check if this session belongs to our directory
            if (session.directory === directory) {
              // Check against initial tabs (from props) since component just mounted
              const hasTab = initialTabs.some(
                (tab) => tab.agentSessionId === session.id,
              );

              if (!hasTab) {
                console.log(
                  '[TabbedTerminal] Found orphaned session on mount, destroying:',
                  session.id,
                );
                await TerminalService.destroy(session.id);
              }
            }
          }
        } catch (err) {
          console.error(
            '[TabbedTerminal] Failed to cleanup orphans on mount:',
            err,
          );
        }
      };

      cleanupOrphans();

      // Only create default tab if component is visible and no tabs exist
      if (tabs.length === 0 && isVisible) {
        console.log(
          '[TabbedTerminal] Creating default tab (component is visible)',
        );
        addNewTab();
      }

      return () => {
        console.log(
          '[TabbedTerminal] Unmounting with',
          tabs.length,
          'tabs and',
          sessionIds.size,
          'sessions',
        );
        // Clean up all sessions when the component unmounts
        sessionIds.forEach((sessionId, tabId) => {
          console.log(
            '[TabbedTerminal] Cleaning up session on unmount:',
            sessionId,
          );
          TerminalService.destroy(sessionId).catch((err) => {
            console.error(
              '[TabbedTerminal] Failed to cleanup session on unmount:',
              err,
            );
          });
        });
      };
    }, []);

    // Create default tab when component becomes visible for the first time
    useEffect(() => {
      if (isVisible && tabs.length === 0) {
        console.log(
          '[TabbedTerminal] Component became visible with no tabs, creating default tab',
        );
        addNewTab();
      }
    }, [isVisible, tabs.length, addNewTab]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        addClaudeSession: async (sessionId: string, sessionName?: string) => {
          await openClaudeSessionTerminal(sessionId, sessionName);
        },
      }),
      [openClaudeSessionTerminal],
    );

    // Close a tab
    const closeTab = useCallback(
      async (tabId: string) => {
        const sessionId = sessionIds.get(tabId);
        if (sessionId) {
          try {
            await TerminalService.destroy(sessionId);
          } catch (err) {
            console.error('Failed to destroy terminal session:', err);
          }
          setSessionIds((prev) => {
            const newMap = new Map(prev);
            newMap.delete(tabId);
            return newMap;
          });
        }

        setTabs((prevTabs) => {
          const newTabs = prevTabs.filter((t) => t.id !== tabId);

          // If we closed the active tab, activate another one
          if (activeTabId === tabId && newTabs.length > 0) {
            const newActiveTab = newTabs[newTabs.length - 1];
            newActiveTab.isActive = true;
            setActiveTabId(newActiveTab.id);
          } else if (newTabs.length === 0) {
            setActiveTabId(null);
          }

          onTabsChange?.(newTabs);
          return newTabs;
        });
      },
      [activeTabId, sessionIds, onTabsChange],
    );

    // Handle terminal session creation
    const handleSessionCreated = useCallback(
      (tabId: string, sessionId: string) => {
        console.log(
          '[TabbedTerminal] Session created:',
          sessionId,
          'for tab:',
          tabId,
        );
        setSessionIds((prev) => new Map(prev).set(tabId, sessionId));
      },
      [],
    );

    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Log render state
    useEffect(() => {
      console.log(
        '[TabbedTerminal] Render - Active tab:',
        activeTabId,
        'Total tabs:',
        tabs.length,
        'Sessions:',
        sessionIds.size,
      );
      if (activeTab) {
        console.log('[TabbedTerminal] Active tab details:', activeTab);
      }
    }, [activeTabId, tabs, sessionIds, activeTab]);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        {/* Tab bar */}
        {!hideHeader && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: theme.colors.backgroundSecondary,
              borderBottom: `1px solid ${theme.colors.border}`,
              minHeight: '36px',
              paddingLeft: '8px',
              gap: '4px',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={(e) => {
                  console.log(
                    '[TabbedTerminal] Tab clicked:',
                    tab.id,
                    tab.label,
                  );
                  e.stopPropagation();
                  switchTab(tab.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  backgroundColor: tab.isActive
                    ? theme.colors.background
                    : 'transparent',
                  borderTop: tab.isActive
                    ? `2px solid ${theme.colors.primary}`
                    : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: tab.isActive
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                <TerminalIcon size={12} />
                <span>{tab.label}</span>
                {tab.agentSessionId && (
                  <Play
                    size={10}
                    style={{ color: theme.colors.success }}
                    title="Claude session"
                  />
                )}
                {/* Pop-out button for active tab */}
                {tab.isActive && sessionIds.get(tab.id) && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const sessionId = sessionIds.get(tab.id);
                      if (sessionId) {
                        try {
                          await TerminalService.popOut(sessionId);
                          console.log(
                            '[TabbedTerminal] Popped out terminal:',
                            sessionId,
                          );
                          // Optionally close the tab after popping out
                          // closeTab(tab.id);
                        } catch (err) {
                          console.error(
                            '[TabbedTerminal] Failed to pop out terminal:',
                            err,
                          );
                        }
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '3px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: theme.colors.textSecondary,
                      padding: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                    title="Pop out to new window"
                  >
                    <ExternalLink size={11} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: theme.colors.textSecondary,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* Add new tab button */}
            <button
              onClick={() => addNewTab()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="New terminal"
            >
              <Plus size={14} />
            </button>

            {/* Debug button */}
            <button
              onClick={() => setShowDebugModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: theme.colors.warning,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Debug terminal sessions"
            >
              <Bug size={14} />
            </button>
          </div>
        )}

        {/* Terminal content */}
        <div style={{ flex: 1, position: 'relative' }}>
          {tabs.map((tab) => {
            const isActiveTab = tab.id === activeTabId;
            console.log(
              '[TabbedTerminal] Rendering terminal for tab:',
              tab.id,
              'Active:',
              isActiveTab,
            );
            return (
              <div
                key={tab.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: isActiveTab ? 'block' : 'none',
                  zIndex: isActiveTab ? 1 : 0,
                }}
              >
                <TerminalPanel
                  directory={tab.directory}
                  hideHeader={true}
                  isVisible={isVisible && isActiveTab}
                  autoFocus={isActiveTab}
                  terminalId={sessionIds.get(tab.id)}
                  initialCommand={tab.command}
                  onSessionCreated={(sessionId) => {
                    handleSessionCreated(tab.id, sessionId);
                  }}
                  agentSessionId={tab.agentSessionId}
                />
              </div>
            );
          })}

          {/* Empty state */}
          {tabs.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: theme.colors.textSecondary,
              }}
            >
              <TerminalIcon
                size={32}
                style={{ opacity: 0.5, marginBottom: '16px' }}
              />
              <p>No terminal sessions</p>
              <button
                onClick={() => addNewTab()}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                New Terminal
              </button>
            </div>
          )}
        </div>

        {/* Debug Modal */}
        <TerminalDebugModal
          isOpen={showDebugModal}
          onClose={() => setShowDebugModal(false)}
          currentSessionId={sessionIds.get(activeTabId || '')}
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            sessionId: sessionIds.get(tab.id),
            command: tab.command,
          }))}
        />
      </div>
    );
  },
);

TabbedTerminalPanel.displayName = 'TabbedTerminalPanel';

// Export a function that can be called from other components to open Claude sessions
export const openClaudeTerminal = (
  sessionId: string,
  directory: string,
  sessionName?: string,
): TerminalTab => {
  return {
    id: `claude-${sessionId}-${Date.now()}`,
    label: sessionName || `Claude: ${sessionId.substring(0, 8)}`,
    directory,
    agentSessionId: sessionId,
    command: `claude -r ${sessionId}`,
    isActive: true,
  };
};
