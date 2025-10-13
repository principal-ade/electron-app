import React, {
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useRef,
} from 'react';
import { X, Plus, Bug, Monitor, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { SnapCarousel, SnapCarouselRef } from '@a24z/panels';
import TerminalPanel, { TerminalPanelRef } from '../TerminalPanel';
import { TerminalService } from '../../main-process-api/TerminalService';
import { TerminalDebugModal } from './TerminalDebugModal';

export interface TerminalTab {
  id: string;
  label: string;
  directory: string;
  command?: string;
  isActive: boolean;
}

interface CarouselTerminalPanelProps {
  directory: string;
  repositoryKey: string;
  hideHeader?: boolean;
  isVisible?: boolean;
  onTabsChange?: (tabs: TerminalTab[]) => void;
  initialTabs?: TerminalTab[];
  showAllTerminals?: boolean;
  onShowAllTerminalsChange?: (showAll: boolean) => void;
  minPanelWidth?: number;
  idealPanelWidth?: number;
}

export interface CarouselTerminalPanelRef {
  scrollToPanel: (index: number) => void;
  getCurrentPanel: () => number;
}

export const CarouselTerminalPanel = forwardRef<
  CarouselTerminalPanelRef,
  CarouselTerminalPanelProps
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
      minPanelWidth = 500,
      idealPanelWidth = 0.333,
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const [tabs, setTabs] = useState<TerminalTab[]>(initialTabs);
    const [currentPanelIndex, setCurrentPanelIndex] = useState<number>(0);
    const [sessionIds, setSessionIds] = useState<Map<string, string>>(
      new Map(),
    );
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

    // Store refs to terminal panels for each tab
    const terminalRefs = useRef<Map<string, TerminalPanelRef>>(new Map());
    const carouselRef = useRef<SnapCarouselRef>(null);

    // Store refs to callbacks to avoid recreating event listeners
    const addNewTabRef = useRef<typeof addNewTab | null>(null);
    const closeTabRef = useRef<typeof closeTab | null>(null);
    const switchPanelRef = useRef<typeof switchPanel | null>(null);

    // Track if we're currently creating a tab to prevent duplicates
    const isCreatingTabRef = useRef(false);

    // Store state used by keyboard handlers
    const tabsRef = useRef<TerminalTab[]>(tabs);
    const currentPanelIndexRef = useRef<number>(currentPanelIndex);

    // Expose carousel methods via ref
    React.useImperativeHandle(ref, () => ({
      scrollToPanel: (index: number) => {
        carouselRef.current?.scrollToPanel(index);
      },
      getCurrentPanel: () => {
        return carouselRef.current?.getCurrentPanel() ?? 0;
      },
    }));

    // Create unique context for this carousel terminal instance
    const terminalContext = React.useMemo(
      () => `carousel-terminal:${repositoryKey}`,
      [repositoryKey],
    );

    // Switch to a panel
    const switchPanel = useCallback(
      (index: number) => {
        if (index >= 0 && index < tabs.length) {
          carouselRef.current?.scrollToPanel(index);
          setCurrentPanelIndex(index);

          // Update active tab
          setTabs((prevTabs) => {
            const newTabs = prevTabs.map((t, i) => ({
              ...t,
              isActive: i === index,
            }));
            return newTabs;
          });

          // Trigger resize for the newly active terminal after DOM updates
          requestAnimationFrame(() => {
            setTimeout(() => {
              const tab = tabs[index];
              if (tab) {
                const terminalRef = terminalRefs.current.get(tab.id);
                if (terminalRef) {
                  terminalRef.scrollToBottom();
                }
              }
            }, 50);
          });
        }
      },
      [tabs],
    );

    // Handle carousel panel change
    const handlePanelChange = useCallback(
      (index: number) => {
        setCurrentPanelIndex(index);
        setTabs((prevTabs) => {
          const newTabs = prevTabs.map((t, i) => ({
            ...t,
            isActive: i === index,
          }));
          onTabsChange?.(newTabs);
          return newTabs;
        });
      },
      [onTabsChange],
    );

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

        // Scroll to the new tab
        setTimeout(() => {
          carouselRef.current?.scrollToPanel(tabs.length);
        }, 100);
      },
      [directory, showAllTerminals, onTabsChange, tabs.length],
    );

    // Initialize - restore existing sessions or cleanup orphaned ones
    useEffect(() => {
      // Restore existing sessions or use initialTabs
      const restoreOrCleanup = async () => {
        try {
          const allSessions = await TerminalService.list();

          // Find sessions that belong to this carousel terminal instance
          const ourSessions = allSessions.filter(
            (session) =>
              session.context?.startsWith('carousel-terminal:') &&
              (showAllTerminals || session.directory === directory),
          );

          // Only restore sessions if we don't have initialTabs
          if (ourSessions.length > 0 && initialTabs.length === 0) {
            // Restore tabs from existing sessions
            const restoredTabs: TerminalTab[] = [];
            const restoredSessionIds = new Map<string, string>();

            ourSessions.forEach((session, index) => {
              // Extract tab ID from context (format: "carousel-terminal:repoKey:tab-12345")
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
            setCurrentPanelIndex(0);
            onTabsChange?.(restoredTabs);
          } else if (initialTabs.length > 0) {
            // If initialTabs were provided, use those (parent is managing state)
            const activeIndex = initialTabs.findIndex((t) => t.isActive);
            setCurrentPanelIndex(activeIndex >= 0 ? activeIndex : 0);
          }
        } catch (err) {
          console.error(
            '[CarouselTerminal] Failed to restore sessions on mount:',
            err,
          );
        }
      };

      restoreOrCleanup();

      return () => {
        // DON'T destroy sessions on unmount - they should persist when panel is swapped
        // Sessions are only destroyed when user explicitly closes a tab
      };
    }, [
      showAllTerminals,
      directory,
      terminalContext,
      initialTabs.length,
      onTabsChange,
    ]);

    // Close a tab
    const closeTab = useCallback(
      async (tabId: string) => {
        const tabIndex = tabs.findIndex((t) => t.id === tabId);
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

          // If we closed the current panel, navigate appropriately
          if (tabIndex === currentPanelIndex && newTabs.length > 0) {
            // Navigate to the previous panel or stay at the same index
            const newIndex = Math.max(0, Math.min(tabIndex, newTabs.length - 1));
            setCurrentPanelIndex(newIndex);
            setTimeout(() => {
              carouselRef.current?.scrollToPanel(newIndex);
            }, 50);

            newTabs.forEach((t, i) => {
              t.isActive = i === newIndex;
            });
          } else if (newTabs.length === 0) {
            setCurrentPanelIndex(0);
          }

          onTabsChange?.(newTabs);
          return newTabs;
        });
      },
      [tabs, currentPanelIndex, sessionIds, onTabsChange],
    );

    // Handle terminal session creation
    const handleSessionCreated = useCallback(
      (tabId: string, sessionId: string) => {
        setSessionIds((prev) => new Map(prev).set(tabId, sessionId));
      },
      [],
    );

    const activeTab = tabs[currentPanelIndex];

    // Keep callback refs up to date
    useEffect(() => {
      addNewTabRef.current = addNewTab;
      closeTabRef.current = closeTab;
      switchPanelRef.current = switchPanel;
    }, [addNewTab, closeTab, switchPanel]);

    useEffect(() => {
      tabsRef.current = tabs;
      currentPanelIndexRef.current = currentPanelIndex;
    }, [tabs, currentPanelIndex]);

    // Keyboard shortcuts for carousel navigation
    useEffect(() => {
      const handleKeyDown = async (e: KeyboardEvent) => {
        // Command/Ctrl + T to open new tab
        if ((e.metaKey || e.ctrlKey) && e.key === 't') {
          if (e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          if (isCreatingTabRef.current) {
            return;
          }

          isCreatingTabRef.current = true;
          addNewTabRef.current?.();

          setTimeout(() => {
            isCreatingTabRef.current = false;
          }, 500);
          return;
        }

        // Command/Ctrl + W to close active tab
        if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
          const currentTabs = tabsRef.current;
          const currentIndex = currentPanelIndexRef.current;
          const currentActiveTab = currentTabs[currentIndex];
          if (currentActiveTab && currentTabs.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            closeTabRef.current?.(currentActiveTab.id);
          }
          return;
        }

        // Command/Ctrl + B to scroll to bottom
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          const currentTabs = tabsRef.current;
          const currentIndex = currentPanelIndexRef.current;
          const currentActiveTab = currentTabs[currentIndex];
          if (currentActiveTab) {
            e.preventDefault();
            e.stopPropagation();
            const terminalRef = terminalRefs.current.get(currentActiveTab.id);
            if (terminalRef) {
              terminalRef.scrollToBottom();
            }
          }
          return;
        }

        // Command/Ctrl + O to open repository for the active tab
        if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
          const currentTabs = tabsRef.current;
          const currentIndex = currentPanelIndexRef.current;
          const currentActiveTab = currentTabs[currentIndex];
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
                await WindowService.openRepositoryDashboard(repo as any);
              }
            } catch (error) {
              console.error(
                '[CarouselTerminalPanel] Failed to open repository:',
                error,
              );
            }
          }
          return;
        }

        // Command/Ctrl + Left Arrow to go to previous panel
        if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
          e.preventDefault();
          const currentIndex = currentPanelIndexRef.current;
          const prevIndex = Math.max(0, currentIndex - 1);
          switchPanelRef.current?.(prevIndex);
          return;
        }

        // Command/Ctrl + Right Arrow to go to next panel
        if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
          e.preventDefault();
          const currentTabs = tabsRef.current;
          const currentIndex = currentPanelIndexRef.current;
          const nextIndex = Math.min(
            currentTabs.length - 1,
            currentIndex + 1,
          );
          switchPanelRef.current?.(nextIndex);
          return;
        }

        // Command/Ctrl + number (1-9) to switch panels
        if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const currentTabs = tabsRef.current;
          const keyNum = parseInt(e.key, 10);

          // Command + 9 always goes to last panel
          const panelIndex = keyNum === 9 ? currentTabs.length - 1 : keyNum - 1;

          if (panelIndex >= 0 && panelIndex < currentTabs.length) {
            switchPanelRef.current?.(panelIndex);
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [directory]);

    // Create carousel panels
    const carouselPanels = tabs.map((tab, index) => {
      const isActivePanel = index === currentPanelIndex;
      return (
        <div
          key={tab.id}
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.colors.background,
            borderRight: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Panel header with tab info and close button */}
          {!hideHeader && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '41px',
                padding: '0 12px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderBottom: `1px solid ${theme.colors.border}`,
                flexShrink: 0,
              }}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
                title={showAllTerminals ? tab.directory : undefined}
              >
                {tab.label}
              </span>
              {hoveredTabId === tab.id && tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
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
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Terminal */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <TerminalPanel
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
              isVisible={isVisible && isActivePanel}
              autoFocus={isActivePanel}
              terminalId={sessionIds.get(tab.id)}
              initialCommand={tab.command}
              onSessionCreated={(sessionId) => {
                handleSessionCreated(tab.id, sessionId);
              }}
            />
          </div>
        </div>
      );
    });

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        {/* Control bar */}
        {!hideHeader && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '41px',
              flexShrink: 0,
              backgroundColor: theme.colors.backgroundSecondary,
              borderBottom: `1px solid ${theme.colors.border}`,
              padding: '0 8px',
            }}
          >
            {/* Navigation buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => switchPanel(Math.max(0, currentPanelIndex - 1))}
                disabled={currentPanelIndex === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: currentPanelIndex === 0 ? 'not-allowed' : 'pointer',
                  color:
                    currentPanelIndex === 0
                      ? theme.colors.textTertiary
                      : theme.colors.textSecondary,
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => {
                  if (currentPanelIndex !== 0) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Previous terminal (Cmd+Left)"
              >
                <ChevronLeft size={16} />
              </button>

              <span
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  minWidth: '60px',
                  textAlign: 'center',
                }}
              >
                {tabs.length > 0 ? `${currentPanelIndex + 1} / ${tabs.length}` : '0 / 0'}
              </span>

              <button
                onClick={() =>
                  switchPanel(Math.min(tabs.length - 1, currentPanelIndex + 1))
                }
                disabled={currentPanelIndex === tabs.length - 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor:
                    currentPanelIndex === tabs.length - 1
                      ? 'not-allowed'
                      : 'pointer',
                  color:
                    currentPanelIndex === tabs.length - 1
                      ? theme.colors.textTertiary
                      : theme.colors.textSecondary,
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => {
                  if (currentPanelIndex !== tabs.length - 1) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Next terminal (Cmd+Right)"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Show all terminals toggle */}
              <button
                onClick={() => onShowAllTerminalsChange?.(!showAllTerminals)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  backgroundColor: showAllTerminals
                    ? theme.colors.primary
                    : 'transparent',
                  cursor: 'pointer',
                  color: showAllTerminals ? '#fff' : theme.colors.textSecondary,
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => {
                  if (!showAllTerminals) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showAllTerminals) {
                    e.currentTarget.style.backgroundColor = showAllTerminals
                      ? theme.colors.primary
                      : 'transparent';
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

              {/* Add new terminal button */}
              <button
                onClick={() => addNewTab()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: theme.colors.textSecondary,
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="New terminal (Cmd+T)"
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
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: theme.colors.warning,
                  borderRadius: '4px',
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

        {/* Carousel content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {tabs.length > 0 ? (
            <SnapCarousel
              ref={carouselRef}
              panels={carouselPanels}
              theme={theme}
              minPanelWidth={minPanelWidth}
              idealPanelWidth={idealPanelWidth}
              gap={1}
              onPanelChange={handlePanelChange}
              style={{ height: '100%' }}
            />
          ) : (
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.backgroundSecondary,
                  marginBottom: '16px',
                }}
              >
                <Plus size={32} style={{ opacity: 0.5 }} />
              </div>
              <p style={{ marginBottom: '16px' }}>No terminal sessions</p>
              <button
                onClick={() => addNewTab()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
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
          currentSessionId={sessionIds.get(activeTab?.id || '')}
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

CarouselTerminalPanel.displayName = 'CarouselTerminalPanel';
