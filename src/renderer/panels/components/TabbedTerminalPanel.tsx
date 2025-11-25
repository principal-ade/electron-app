import React, {
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useRef,
} from 'react';
import {
  Terminal as TerminalIcon,
  X,
  Plus,
  Bug,
  Monitor,
  Grid3x3,
} from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { useTheme } from '@principal-ade/industry-theme';
import TerminalPanelPackaged, {
  TerminalPanelPackagedRef,
} from '../TerminalPanelPackaged';
import { TerminalService } from '../../main-process-api/TerminalService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
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
  showAllTerminals?: boolean;
  onShowAllTerminalsChange?: (showAll: boolean) => void;
  onToggleView?: () => void;
}

export interface TabbedTerminalPanelRef {
  // Future methods can be added here
}

// Memoized wrapper to prevent unnecessary re-renders
interface TerminalTabWrapperProps {
  tab: TerminalTab;
  terminalContext: string;
  isVisible: boolean;
  isActiveTab: boolean;
  sessionId: string | undefined;
  terminalRef: (el: TerminalPanelPackagedRef | null) => void;
  onSessionCreated: (tabId: string, sessionId: string) => void;
}

const TerminalTabWrapper = React.memo<TerminalTabWrapperProps>(
  ({
    tab,
    terminalContext,
    isVisible,
    isActiveTab,
    sessionId,
    terminalRef,
    onSessionCreated,
  }) => {
    const handleSessionCreated = useCallback(
      (newSessionId: string) => {
        onSessionCreated(tab.id, newSessionId);
      },
      [tab.id, onSessionCreated],
    );

    return (
      <div
        style={{
          display: isActiveTab ? 'flex' : 'none',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        <TerminalPanelPackaged
          ref={terminalRef}
          key={tab.id}
          directory={tab.directory}
          context={`${terminalContext}:${tab.id}`}
          hideHeader={true}
          isVisible={isVisible && isActiveTab}
          autoFocus={isActiveTab}
          terminalId={sessionId}
          initialCommand={tab.command}
          onSessionCreated={handleSessionCreated}
        />
      </div>
    );
  },
);

TerminalTabWrapper.displayName = 'TerminalTabWrapper';

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
      showAllTerminals = false,
      onShowAllTerminalsChange,
      onToggleView,
    },
    _ref,
  ) => {
    const { theme } = useTheme();
    const [tabs, setTabs] = useState<TerminalTab[]>(initialTabs);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [sessionIds, setSessionIds] = useState<Map<string, string>>(
      new Map(),
    );
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
    const [showDebugButton, setShowDebugButton] = useState(false);
    const [showShowAllButton, setShowShowAllButton] = useState(true);

    // Store refs to terminal panels for each tab
    const terminalRefs = useRef<Map<string, TerminalPanelPackagedRef>>(
      new Map(),
    );

    // Store refs to callbacks to avoid recreating event listeners
    const addNewTabRef = useRef<typeof addNewTab | null>(null);
    const closeTabRef = useRef<typeof closeTab | null>(null);
    const switchTabRef = useRef<typeof switchTab | null>(null);

    // Track if we're currently creating a tab to prevent duplicates
    const isCreatingTabRef = useRef(false);

    // Track if we've already initialized to prevent re-initialization
    const hasInitializedRef = useRef(false);

    // Create unique context for this terminal instance
    // Use shared 'terminal:' prefix so sessions persist when switching between carousel/tabbed panels
    const terminalContext = React.useMemo(
      () => `terminal:${repositoryKey}`,
      [repositoryKey],
    );

    // Stable callback for restoring sessions - prevents duplicate session restoration
    const restoreSessions = useCallback(async () => {
      try {
        const allSessions = await TerminalService.list();

        // Find sessions that belong to this terminal instance
        const ourSessions = allSessions.filter(
          (session) =>
            session.context?.startsWith('terminal:') &&
            (showAllTerminals || session.directory === directory),
        );

        // Only restore sessions if we have any and no initialTabs
        if (ourSessions.length > 0 && initialTabs.length === 0) {
          // Restore tabs from existing sessions
          const restoredTabs: TerminalTab[] = [];
          const restoredSessionIds = new Map<string, string>();

          ourSessions.forEach((session, index) => {
            // Extract tab ID from context (format: "terminal:repoKey:tab-12345")
            const contextParts = session.context?.split(':') || [];
            const tabId =
              contextParts[contextParts.length - 1] ||
              `tab-${Date.now()}-${index}`;

            const tab: TerminalTab = {
              id: tabId,
              label: showAllTerminals
                ? `${session.directory.split('/').pop() || session.directory}`
                : directory.split('/').pop() || directory,
              directory: session.directory,
              isActive: index === 0,
            };

            restoredTabs.push(tab);
            restoredSessionIds.set(tabId, session.id);
          });

          setTabs(restoredTabs);
          setSessionIds(restoredSessionIds);
          setActiveTabId(restoredTabs[0]?.id || null);
          onTabsChange?.(restoredTabs);

          console.log(
            `[TabbedTerminal] Restored ${restoredTabs.length} tabs from existing sessions`,
          );
        } else if (initialTabs.length > 0) {
          setTabs(initialTabs);
          setActiveTabId(
            initialTabs.find((t) => t.isActive)?.id ||
              initialTabs[0]?.id ||
              null,
          );
        }
      } catch (err) {
        console.error('[TabbedTerminal] Failed to restore sessions:', err);
      }
    }, [showAllTerminals, directory, initialTabs, onTabsChange]);

    // Switch to a tab
    const switchTab = useCallback((tabId: string) => {
      setTabs((prevTabs) => {
        const newTabs = prevTabs.map((t) => ({
          ...t,
          isActive: t.id === tabId,
        }));
        return newTabs;
      });
      setActiveTabId(tabId);

      // Focus the newly active terminal immediately
      // Use a longer delay to ensure DOM visibility has updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          const terminalRef = terminalRefs.current.get(tabId);
          if (terminalRef) {
            // Focus the terminal so keyboard input goes to the right tab
            terminalRef.focus();
            // Don't auto-scroll - respect user's current scroll position
          }
        }, 150); // Longer delay to ensure visibility effect has completed
      });
    }, []);

    // Create a new terminal tab
    const addNewTab = useCallback(
      (label?: string, command?: string, targetDirectory?: string) => {
        const targetDir = targetDirectory || directory;
        const directoryName = targetDir.split('/').pop() || targetDir;
        const newTab: TerminalTab = {
          id: `tab-${Date.now()}`,
          label: label || (showAllTerminals ? directoryName : directoryName),
          directory: targetDir,
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
      [directory, showAllTerminals, onTabsChange],
    );

    // Load button visibility preferences
    useEffect(() => {
      UserPreferencesService.getPreferences().then((prefs) => {
        setShowDebugButton(prefs.showTerminalDebugButton ?? false);
        setShowShowAllButton(prefs.showTerminalShowAllButton ?? true);
      });

      const handlePreferencesUpdated = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail) {
          if ('showTerminalDebugButton' in detail) {
            setShowDebugButton(detail.showTerminalDebugButton ?? false);
          }
          if ('showTerminalShowAllButton' in detail) {
            setShowShowAllButton(detail.showTerminalShowAllButton ?? true);
          }
        }
      };

      window.addEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );

      return () => {
        window.removeEventListener(
          'user-preferences-updated',
          handlePreferencesUpdated as EventListener,
        );
      };
    }, []);

    // Initialize - restore existing sessions on mount only
    useEffect(() => {
      // Only initialize once to prevent infinite loops
      if (hasInitializedRef.current) {
        return;
      }

      hasInitializedRef.current = true;
      console.log('[TabbedTerminal] Initializing and restoring sessions...');
      restoreSessions();

      return () => {
        // DON'T destroy sessions on unmount - they should persist when panel is swapped
        // Sessions are only destroyed when user explicitly closes a tab
        console.log(
          '[TabbedTerminal] Component unmounting, sessions will persist',
        );
      };
      // Only run on mount - restoreSessions is intentionally NOT in deps to prevent re-runs
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-filter sessions when showAllTerminals or directory changes (after initial mount)
    useEffect(() => {
      // Skip if we haven't initialized yet
      if (!hasInitializedRef.current) {
        return;
      }

      console.log(
        '[TabbedTerminal] showAllTerminals or directory changed, re-filtering sessions',
      );
      restoreSessions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAllTerminals, directory]);

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

    // Keep callback refs up to date
    useEffect(() => {
      addNewTabRef.current = addNewTab;
      closeTabRef.current = closeTab;
      switchTabRef.current = switchTab;
    }, [addNewTab, closeTab, switchTab]);

    // Store tabs and activeTabId in refs for event handler
    const tabsRef = useRef(tabs);
    const activeTabIdRef = useRef(activeTabId);

    useEffect(() => {
      tabsRef.current = tabs;
      activeTabIdRef.current = activeTabId;
    }, [tabs, activeTabId]);

    // Keyboard shortcuts for tab navigation
    useEffect(() => {
      const handleKeyDown = async (e: KeyboardEvent) => {
        // Command/Ctrl + T to open new tab
        if ((e.metaKey || e.ctrlKey) && e.key === 't') {
          e.preventDefault();
          e.stopPropagation();

          // Prevent multiple rapid tab creations
          if (isCreatingTabRef.current) {
            console.info(
              '[TabbedTerminalPanel] Ignoring duplicate tab creation',
            );
            return;
          }

          isCreatingTabRef.current = true;
          addNewTabRef.current?.();

          // Reset the flag after a short delay
          setTimeout(() => {
            isCreatingTabRef.current = false;
          }, 500);
          return;
        }

        // Command/Ctrl + W to close active tab
        if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
          const currentActiveTabId = activeTabIdRef.current;
          const currentTabs = tabsRef.current;
          if (currentActiveTabId && currentTabs.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            closeTabRef.current?.(currentActiveTabId);
          }
          return;
        }

        // Command/Ctrl + B to scroll to bottom
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          const currentActiveTabId = activeTabIdRef.current;
          if (currentActiveTabId) {
            e.preventDefault();
            e.stopPropagation();
            const terminalRef = terminalRefs.current.get(currentActiveTabId);
            if (terminalRef) {
              terminalRef.scrollToBottom();
            }
          }
          return;
        }

        // Command/Ctrl + O to open repository for the active tab
        if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
          const currentTabs = tabsRef.current;
          const currentActiveTabId = activeTabIdRef.current;
          const currentActiveTab = currentTabs.find(
            (t) => t.id === currentActiveTabId,
          );
          if (currentActiveTab && currentActiveTab.directory !== directory) {
            e.preventDefault();
            e.stopPropagation();

            // Import services dynamically to avoid circular dependencies
            const { RepositoryService } = await import(
              '../../main-process-api/RepositoryService'
            );
            const { WindowService } = await import(
              '../../main-process-api/WindowService'
            );

            try {
              // Find the repository that contains this directory
              const repo = await RepositoryService.getRepositoryByLocalPath(
                currentActiveTab.directory,
              );

              if (repo) {
                // Open the repository dashboard
                await WindowService.openRepositoryDashboard(
                  repo as unknown as AlexandriaEntry,
                );
              }
            } catch (error) {
              console.error(
                '[TabbedTerminalPanel] Failed to open repository:',
                error,
              );
            }
          }
          return;
        }

        // Command/Ctrl + number (1-9) to switch tabs
        if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const currentTabs = tabsRef.current;
          const keyNum = parseInt(e.key, 10);

          // Command + 9 always goes to last tab
          const tabIndex = keyNum === 9 ? currentTabs.length - 1 : keyNum - 1;

          if (tabIndex >= 0 && tabIndex < currentTabs.length) {
            const targetTab = currentTabs[tabIndex];
            if (targetTab) {
              switchTabRef.current?.(targetTab.id);
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [directory]); // Only re-create handler when directory changes

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
              height: '41px',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            {/* Tabs container - takes up remaining space */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                overflow: 'hidden',
                borderBottom: `1px solid ${theme.colors.border}`,
                boxSizing: 'border-box',
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
                    fontSize: theme.fontSizes[1],
                    fontWeight: tab.isActive
                      ? theme.fontWeights.semibold
                      : theme.fontWeights.body,
                    fontFamily: theme.fonts.body,
                    color: tab.isActive
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    position: 'relative',
                    boxSizing: 'border-box',
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
                  <span title={showAllTerminals ? tab.directory : undefined}>
                    {tab.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Action buttons - fixed on the right */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderLeft: `1px solid ${theme.colors.border}`,
                borderBottom: `1px solid ${theme.colors.border}`,
                boxSizing: 'border-box',
              }}
            >
              {/* Toggle view button - only show in multi-terminal mode */}
              {onToggleView && (
                <button
                  onClick={onToggleView}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
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
                  title="Switch to carousel view"
                >
                  <Grid3x3 size={14} />
                </button>
              )}

              {/* Show all terminals toggle */}
              {showShowAllButton && (
                <button
                  onClick={() => onShowAllTerminalsChange?.(!showAllTerminals)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '100%',
                    border: 'none',
                    backgroundColor: showAllTerminals
                      ? theme.colors.primary
                      : 'transparent',
                    cursor: 'pointer',
                    color: showAllTerminals
                      ? theme.colors.background
                      : theme.colors.textSecondary,
                  }}
                  onMouseEnter={(e) => {
                    if (!showAllTerminals) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showAllTerminals) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  title={
                    showAllTerminals
                      ? 'Show current repo terminals only'
                      : 'Show all terminals'
                  }
                >
                  <Monitor size={14} />
                </button>
              )}

              {/* Add new tab button */}
              <button
                onClick={() => addNewTab()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
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
              {showDebugButton && (
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
              )}
            </div>
          </div>
        )}

        {/* Terminal content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: '100%',
            minHeight: 0,
          }}
        >
          {tabs.map((tab) => {
            const isActiveTab = tab.id === activeTabId;
            return (
              <TerminalTabWrapper
                key={tab.id}
                tab={tab}
                terminalContext={terminalContext}
                isVisible={isVisible}
                isActiveTab={isActiveTab}
                sessionId={sessionIds.get(tab.id)}
                terminalRef={(el) => {
                  if (el) {
                    terminalRefs.current.set(tab.id, el);
                  } else {
                    terminalRefs.current.delete(tab.id);
                  }
                }}
                onSessionCreated={handleSessionCreated}
              />
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
                  color: theme.colors.background,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
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

export const TabbedTerminalPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: theme.fontSizes[0],
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: `1px solid ${theme.colors.border}`,
          paddingBottom: '4px',
        }}
      >
        <span
          style={{
            padding: '4px 8px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            borderRadius: '4px 4px 0 0',
          }}
        >
          bash
        </span>
        <span
          style={{
            padding: '4px 8px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '4px 4px 0 0',
          }}
        >
          npm
        </span>
      </div>
      <div
        style={{
          fontFamily: theme.fonts.mono,
          color: theme.colors.textSecondary,
        }}
      >
        $ npm run dev
      </div>
    </div>
  );
};

TabbedTerminalPanel.displayName = 'TabbedTerminalPanel';
