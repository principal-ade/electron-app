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
  Circle,
  Square,
} from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { useTheme } from '@a24z/industry-theme';
import TerminalPanelV2, { TerminalPanelV2Ref } from '../TerminalPanelV2';
import { TerminalService } from '../../main-process-api/TerminalService';
import { TerminalDebugModal } from './TerminalDebugModal';
import { terminalRecorder } from '../../utils/terminalRecorder';

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
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDirectory, setRecordingDirectory] = useState<string | null>(null);

    // Store refs to terminal panels for each tab
    const terminalRefs = useRef<Map<string, TerminalPanelV2Ref>>(new Map());

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

    // Initialize - restore existing sessions or cleanup orphaned ones
    useEffect(() => {
      // Only initialize once to prevent infinite loops
      if (hasInitializedRef.current) {
        return;
      }

      hasInitializedRef.current = true;

      // Restore existing sessions or use initialTabs
      const restoreOrCleanup = async () => {
        try {
          const allSessions = await TerminalService.list();

          // Find sessions that belong to this terminal instance
          // Use shared 'terminal:' prefix so sessions persist when switching between carousel/tabbed panels
          const ourSessions = allSessions.filter(
            (session) =>
              session.context?.startsWith('terminal:') &&
              (showAllTerminals || session.directory === directory),
          );

          // Only restore sessions if we don't have initialTabs
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
            setTabs(initialTabs);
            setActiveTabId(
              initialTabs.find((t) => t.isActive)?.id ||
                initialTabs[0]?.id ||
                null,
            );
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      showAllTerminals,
      directory,
      terminalContext,
      // NOTE: initialTabs and onTabsChange are intentionally in deps but we use
      // hasInitializedRef to prevent re-initialization loops
    ]);

    // Re-filter sessions when showAllTerminals changes (after initial mount)
    useEffect(() => {
      // Skip if we haven't initialized yet
      if (!hasInitializedRef.current) {
        return;
      }

      const updateSessionsForShowAllTerminals = async () => {
        try {
          const allSessions = await TerminalService.list();

          // Find sessions that belong to this terminal instance
          const ourSessions = allSessions.filter(
            (session) =>
              session.context?.startsWith('terminal:') &&
              (showAllTerminals || session.directory === directory),
          );

          // Restore tabs from the filtered sessions
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
              isActive: index === 0, // Make first tab active
            };

            restoredTabs.push(tab);
            restoredSessionIds.set(tabId, session.id);
          });

          if (restoredTabs.length > 0) {
            setTabs(restoredTabs);
            setSessionIds(restoredSessionIds);
            setActiveTabId(restoredTabs[0]?.id || null);
            onTabsChange?.(restoredTabs);
          }
        } catch (err) {
          console.error(
            '[TabbedTerminal] Failed to update sessions for showAllTerminals:',
            err,
          );
        }
      };

      updateSessionsForShowAllTerminals();
    }, [showAllTerminals, directory, terminalContext, onTabsChange]);

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

    // Handle recording toggle
    const handleToggleRecording = useCallback(async () => {
      if (isRecording) {
        // Stop recording
        const result = await terminalRecorder.stopRecording();
        if (result.success) {
          setIsRecording(false);
          setRecordingDirectory(null);
          console.log('[TabbedTerminalPanel] Recording stopped, saved files:', result.files);
        } else {
          console.error('[TabbedTerminalPanel] Failed to stop recording:', result.error);
        }
      } else {
        // Start recording
        const result = await terminalRecorder.startRecording();
        if (result.success) {
          setIsRecording(true);
          setRecordingDirectory(result.directory || null);
          console.log('[TabbedTerminalPanel] Recording started to:', result.directory);
        } else {
          console.error('[TabbedTerminalPanel] Failed to start recording:', result.error);
        }
      }
    }, [isRecording]);

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
                borderBottom:
                  tabs.length > 0 ? `1px solid ${theme.colors.border}` : 'none',
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
                  color: showAllTerminals ? '#fff' : theme.colors.textSecondary,
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

              {/* Recording button */}
              <button
                onClick={handleToggleRecording}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '100%',
                  border: 'none',
                  backgroundColor: isRecording
                    ? '#ff4444'
                    : 'transparent',
                  cursor: 'pointer',
                  color: isRecording ? '#fff' : theme.colors.textSecondary,
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
                onMouseEnter={(e) => {
                  if (!isRecording) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isRecording) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                title={
                  isRecording
                    ? `Recording to: ${recordingDirectory || 'unknown'}\nClick to stop`
                    : 'Start recording terminal data'
                }
              >
                {isRecording ? <Square size={14} /> : <Circle size={14} />}
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
              <div
                key={tab.id}
                style={{
                  display: isActiveTab ? 'flex' : 'none',
                  flexDirection: 'column',
                  height: '100%',
                  width: '100%',
                  minHeight: 0,
                  position: 'relative',
                }}
              >
                <TerminalPanelV2
                  ref={(el) => {
                    if (el) {
                      terminalRefs.current.set(tab.id, el);
                    } else {
                      terminalRefs.current.delete(tab.id);
                    }
                  }}
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

export const TabbedTerminalPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '11px',
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
          fontFamily: 'monospace',
          color: theme.colors.textSecondary,
        }}
      >
        $ npm run dev
      </div>
    </div>
  );
};

TabbedTerminalPanel.displayName = 'TabbedTerminalPanel';
