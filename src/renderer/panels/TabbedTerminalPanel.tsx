import React, {
  useState,
  useCallback,
  useEffect,
  forwardRef,
} from 'react';
import {
  Terminal as TerminalIcon,
  X,
  Plus,
  Bug,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import TerminalPanel from './TerminalPanel';
import { TerminalService } from '../main-process-api/TerminalService';
import { TerminalDebugModal } from '../components/Terminal/TerminalDebugModal';

export interface TerminalTab {
  id: string;
  label: string;
  directory: string;
  command?: string;
  isActive: boolean;
}

interface TabbedTerminalPanelProps {
  directory: string;
  repositoryKey: string;
  hideHeader?: boolean;
  isVisible?: boolean;
  onTabsChange?: (tabs: TerminalTab[]) => void;
  initialTabs?: TerminalTab[];
}

export interface TabbedTerminalPanelRef {
  // Future methods can be added here
}

export const TabbedTerminalPanel = forwardRef<
  TabbedTerminalPanelRef,
  TabbedTerminalPanelProps
>(
  (
    {
      directory,
      repositoryKey,
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
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

    // Create unique context for this tabbed terminal instance
    const terminalContext = `tabbed-terminal:${repositoryKey}`;

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
      (label?: string, command?: string) => {
        const directoryName = directory.split('/').pop() || directory;
        const newTab: TerminalTab = {
          id: `tab-${Date.now()}`,
          label: label || directoryName,
          directory,
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
      [directory, onTabsChange],
    );

    // Initialize - cleanup orphaned sessions on mount
    useEffect(() => {
      console.log(
        '[TabbedTerminal] Mounting with',
        initialTabs.length,
        'initial tabs',
      );

      // Clean up orphaned sessions on mount - only for our context
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
            // Only clean up sessions with our specific context
            if (session.context === terminalContext && session.directory === directory) {
              console.log(
                '[TabbedTerminal] Found orphaned session with our context on mount, destroying:',
                session.id,
              );
              await TerminalService.destroy(session.id);
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
              alignItems: 'stretch',
              height: '36px',
              flexShrink: 0,
            }}
          >
            {/* Tabs container - takes up remaining space */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                overflow: 'hidden',
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
                onMouseEnter={() => setHoveredTabId(tab.id)}
                onMouseLeave={() => setHoveredTabId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  backgroundColor: tab.isActive
                    ? theme.colors.background
                    : theme.colors.backgroundSecondary,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: tab.isActive ? 600 : 400,
                  color: tab.isActive
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  position: 'relative',
                }}
              >
                {hoveredTabId === tab.id && (
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
                      position: 'absolute',
                      left: '8px',
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
                )}
                <span>{tab.label}</span>
              </div>
              ))}
            </div>

            {/* Action buttons - fixed on the right */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderLeft: `1px solid ${theme.colors.border}`,
                borderBottom: tabs.length > 0 ? `1px solid ${theme.colors.border}` : 'none',
              }}
            >
              {/* Add new tab button */}
              <button
              onClick={() => addNewTab()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '100%',
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
                width: '36px',
                height: '100%',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: theme.colors.warning,
                paddingLeft: '4px',
                paddingRight: '4px',
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
              <Bug size={16} />
            </button>
            </div>
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
                  context={terminalContext}
                  hideHeader={true}
                  isVisible={isVisible && isActiveTab}
                  autoFocus={isActiveTab}
                  terminalId={sessionIds.get(tab.id)}
                  initialCommand={tab.command}
                  onSessionCreated={(sessionId) => {
                    handleSessionCreated(tab.id, sessionId);
                  }}
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
                borderTop: `1px solid ${theme.colors.border}`,
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
