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
import TerminalPanel from '../TerminalPanel';
import { TerminalService } from '../../main-process-api/TerminalService';
import { TerminalDebugModal } from './TerminalDebugModal';

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
        setTabs((prevTabs) => {
          const newTabs = prevTabs.map((t) => ({
            ...t,
            isActive: t.id === tabId,
          }));
          return newTabs;
        });
        setActiveTabId(tabId);
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

    // Initialize - restore existing sessions or cleanup orphaned ones
    useEffect(() => {
      // Restore existing sessions or use initialTabs
      const restoreOrCleanup = async () => {
        try {
          const allSessions = await TerminalService.list();

          // Find sessions that belong to this tabbed terminal instance
          const ourSessions = allSessions.filter(
            (session) =>
              session.context?.startsWith(terminalContext) &&
              session.directory === directory,
          );

          // Only restore sessions if we don't have initialTabs
          if (ourSessions.length > 0 && initialTabs.length === 0) {
            // Restore tabs from existing sessions
            const restoredTabs: TerminalTab[] = [];
            const restoredSessionIds = new Map<string, string>();

            ourSessions.forEach((session, index) => {
              // Extract tab ID from context (format: "tabbed-terminal:repoKey:tab-12345")
              const contextParts = session.context?.split(':') || [];
              const tabId = contextParts[contextParts.length - 1] || `tab-${Date.now()}-${index}`;

              const tab: TerminalTab = {
                id: tabId,
                label: directory.split('/').pop() || directory,
                directory: session.directory,
                isActive: index === 0, // Make first tab active
              };

              restoredTabs.push(tab);
              restoredSessionIds.set(tabId, session.id);
            });

            setTabs(restoredTabs);
            setSessionIds(restoredSessionIds);
            setActiveTabId(restoredTabs[0]?.id || null);
            onTabsChange?.(restoredTabs);
          } else if (initialTabs.length > 0) {
            // If initialTabs were provided, use those (parent is managing state)
            setActiveTabId(initialTabs.find(t => t.isActive)?.id || initialTabs[0]?.id || null);
          }
        } catch (err) {
          console.error(
            '[TabbedTerminal] Failed to restore sessions on mount:',
            err,
          );
        }
      };

      restoreOrCleanup();

      return () => {
        // DON'T destroy sessions on unmount - they should persist when panel is swapped
        // Sessions are only destroyed when user explicitly closes a tab
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
        setSessionIds((prev) => new Map(prev).set(tabId, sessionId));
      },
      [],
    );

    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Keyboard shortcuts for tab navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Command/Ctrl + W to close active tab
        if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
          if (activeTabId && tabs.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            closeTab(activeTabId);
          }
          return;
        }

        // Command/Ctrl + number (1-9) to switch tabs
        if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const keyNum = parseInt(e.key, 10);

          // Command + 9 always goes to last tab
          const tabIndex = keyNum === 9 ? tabs.length - 1 : keyNum - 1;

          if (tabIndex >= 0 && tabIndex < tabs.length) {
            const targetTab = tabs[tabIndex];
            if (targetTab) {
              switchTab(targetTab.id);
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tabs, switchTab, activeTabId, closeTab]);

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
                  key={tab.id}
                  directory={tab.directory}
                  context={`${terminalContext}:${tab.id}`}
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
