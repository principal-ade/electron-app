import React, {
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useRef,
} from 'react';
import {
  X,
  Plus,
  Bug,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
} from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { useTheme } from '@principal-ade/industry-theme';
import { SnapCarousel, SnapCarouselRef } from '@principal-ade/panels';
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

interface CarouselTerminalPanelProps {
  directory: string;
  repositoryKey: string;
  hideHeader?: boolean;
  isVisible?: boolean;
  onTabsChange?: (tabs: TerminalTab[]) => void;
  initialTabs?: TerminalTab[];
  showAllTerminals?: boolean;
  onShowAllTerminalsChange?: (showAll: boolean) => void;
  onToggleView?: () => void;
  minPanelWidth?: number;
  idealPanelWidth?: number;
}

export interface CarouselTerminalPanelRef {
  scrollToPanel: (index: number) => void;
  getCurrentPanel: () => number;
}

// Memoized wrapper to prevent unnecessary re-renders
interface CarouselTerminalWrapperProps {
  tab: TerminalTab;
  terminalContext: string;
  isVisible: boolean;
  isActivePanel: boolean;
  sessionId: string | undefined;
  terminalRef: (el: TerminalPanelPackagedRef | null) => void;
  onSessionCreated: (tabId: string, sessionId: string) => void;
}

const CarouselTerminalWrapper = React.memo<CarouselTerminalWrapperProps>(
  ({
    tab,
    terminalContext,
    isVisible,
    isActivePanel,
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
      <TerminalPanelPackaged
        ref={terminalRef}
        key={tab.id}
        directory={tab.directory}
        context={`${terminalContext}:${tab.id}`}
        hideHeader={true}
        isVisible={isVisible && isActivePanel}
        autoFocus={isActivePanel}
        terminalId={sessionId}
        initialCommand={tab.command}
        onSessionCreated={handleSessionCreated}
      />
    );
  },
);

CarouselTerminalWrapper.displayName = 'CarouselTerminalWrapper';

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
      onToggleView,
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
    const [showDebugButton, setShowDebugButton] = useState(false);
    const [showShowAllButton, setShowShowAllButton] = useState(true);

    // Store refs to terminal panels for each tab
    const terminalRefs = useRef<Map<string, TerminalPanelPackagedRef>>(
      new Map(),
    );
    const carouselRef = useRef<SnapCarouselRef>(null);
    const carouselWrapperRef = useRef<HTMLDivElement>(null);
    const pendingPanelIndexRef = useRef<number | null>(null);

    // Store refs to callbacks to avoid recreating event listeners
    const addNewTabRef = useRef<typeof addNewTab | null>(null);
    const closeTabRef = useRef<typeof closeTab | null>(null);
    const switchPanelRef = useRef<typeof switchPanel | null>(null);

    // Track if we're currently creating a tab to prevent duplicates
    const isCreatingTabRef = useRef(false);

    // Track if we've already initialized to prevent re-initialization
    const hasInitializedRef = useRef(false);

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

    // Create unique context for this terminal instance
    // Use shared 'terminal:' prefix so sessions persist when switching between carousel/tabbed panels
    const terminalContext = React.useMemo(
      () => `terminal:${repositoryKey}`,
      [repositoryKey],
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
          setCurrentPanelIndex(0);
          onTabsChange?.(restoredTabs);
        } else if (initialTabs.length > 0) {
          const activeIndex = initialTabs.findIndex((t) => t.isActive);
          setCurrentPanelIndex(activeIndex >= 0 ? activeIndex : 0);
        }
      } catch (err) {
        console.error('[CarouselTerminal] Failed to restore sessions:', err);
      }
    }, [showAllTerminals, directory, initialTabs, onTabsChange]);

    // Switch to a panel
    const switchPanel = useCallback(
      (index: number) => {
        if (index >= 0 && index < tabs.length) {
          pendingPanelIndexRef.current = index;
          carouselRef.current?.scrollToPanel(index);
          if (!carouselRef.current) {
            pendingPanelIndexRef.current = null;
          }
          setCurrentPanelIndex(index);

          // Update active tab
          setTabs((prevTabs) => {
            const newTabs = prevTabs.map((t, i) => ({
              ...t,
              isActive: i === index,
            }));
            return newTabs;
          });

          // Scroll to bottom for the newly active terminal after DOM updates
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
        const pendingIndex = pendingPanelIndexRef.current;

        if (pendingIndex !== null) {
          if (pendingIndex !== index) {
            return;
          }

          pendingPanelIndexRef.current = null;
        }

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
        // Prevent duplicate creation
        if (isCreatingTabRef.current) {
          return;
        }
        isCreatingTabRef.current = true;

        const targetDir = targetDirectory || directory;
        const directoryName = targetDir.split('/').pop() || targetDir;
        const newTab: TerminalTab = {
          id: `tab-${Date.now()}`,
          label: label || directoryName,
          directory: targetDir,
          command,
          isActive: true,
        };

        setTabs((prevTabs) => {
          const updatedTabs = prevTabs.map((t) => ({ ...t, isActive: false }));
          const newTabs = [...updatedTabs, newTab];
          const newTabIndex = newTabs.length - 1;

          // Set pending index IMMEDIATELY before any carousel updates
          pendingPanelIndexRef.current = newTabIndex;
          setCurrentPanelIndex(newTabIndex);
          onTabsChange?.(newTabs);

          // Scroll to the new tab after DOM updates
          requestAnimationFrame(() => {
            setTimeout(() => {
              carouselRef.current?.scrollToPanel(newTabIndex);
              if (!carouselRef.current) {
                pendingPanelIndexRef.current = null;
              }
              // Reset the creation lock after scrolling completes
              setTimeout(() => {
                isCreatingTabRef.current = false;
              }, 100);
            }, 150);
          });

          return newTabs;
        });
      },
      [directory, onTabsChange],
    );

    // Initialize - restore existing sessions on mount only
    useEffect(() => {
      // Only initialize once to prevent infinite loops
      if (hasInitializedRef.current) {
        return;
      }

      hasInitializedRef.current = true;
      restoreSessions();

      return () => {
        // DON'T destroy sessions on unmount - they should persist when panel is swapped
        // Sessions are only destroyed when user explicitly closes a tab
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

      restoreSessions();
      // restoreSessions is intentionally NOT in deps to prevent infinite loop
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
          const tabIndex = prevTabs.findIndex((t) => t.id === tabId);
          const newTabs = prevTabs.filter((t) => t.id !== tabId);

          // If we closed the current panel, navigate appropriately
          if (tabIndex === currentPanelIndex && newTabs.length > 0) {
            // Navigate to the previous panel or stay at the same index
            const newIndex = Math.max(
              0,
              Math.min(tabIndex, newTabs.length - 1),
            );
            setCurrentPanelIndex(newIndex);
            setTimeout(() => {
              carouselRef.current?.scrollToPanel(newIndex);
            }, 50);

            newTabs.forEach((t, i) => {
              t.isActive = i === newIndex;
            });
          } else if (newTabs.length === 0) {
            setCurrentPanelIndex(0);
          } else if (tabIndex < currentPanelIndex) {
            // If we closed a tab before the current one, decrement currentPanelIndex
            setCurrentPanelIndex(currentPanelIndex - 1);
          }

          onTabsChange?.(newTabs);
          return newTabs;
        });
      },
      [currentPanelIndex, sessionIds, onTabsChange],
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
      switchPanelRef.current = switchPanel;
    }, [addNewTab, closeTab, switchPanel]);

    useEffect(() => {
      tabsRef.current = tabs;
      currentPanelIndexRef.current = currentPanelIndex;
    }, [tabs, currentPanelIndex]);

    // Prevent space key and paste from scrolling the carousel container
    useEffect(() => {
      const wrapper = carouselWrapperRef.current;
      if (!wrapper) return;

      let isTyping = false;
      let typingTimeout: NodeJS.Timeout;
      let savedScrollLeft = 0;

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isFromTerminal = target.closest('.xterm') !== null;

        if (isFromTerminal && e.key === ' ') {
          // Mark that we're typing
          isTyping = true;

          const scrollContainer = findScrollContainer();
          if (scrollContainer) {
            savedScrollLeft = scrollContainer.scrollLeft;
          }

          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            isTyping = false;
          }, 100);
        }
      };

      const handlePaste = (e: ClipboardEvent) => {
        const target = e.target as HTMLElement;
        const isFromTerminal = target.closest('.xterm') !== null;

        if (isFromTerminal) {
          // Mark that we're pasting - use longer timeout since paste can be slower
          isTyping = true;

          const scrollContainer = findScrollContainer();
          if (scrollContainer) {
            savedScrollLeft = scrollContainer.scrollLeft;
          }

          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            isTyping = false;
          }, 200);
        }
      };

      const handleScroll = (e: Event) => {
        // If we're typing/pasting in terminal, restore scroll position
        if (isTyping) {
          const scrollContainer = e.target as HTMLElement;
          // Restore the scroll position immediately
          scrollContainer.scrollLeft = savedScrollLeft;
        }
      };

      // Find the actual scroll container (snap-carousel-container)
      const findScrollContainer = () => {
        const scrollContainer = wrapper.querySelector(
          '.snap-carousel-container',
        );
        return scrollContainer as HTMLElement;
      };

      // Wait for SnapCarousel to render
      const timer = setTimeout(() => {
        const scrollContainer = findScrollContainer();
        if (scrollContainer) {
          // Make the scroll container non-focusable to prevent keyboard scroll
          scrollContainer.setAttribute('tabindex', '-1');

          // Listen for keydown to track typing
          scrollContainer.addEventListener('keydown', handleKeyDown, true);

          // Listen for paste events
          scrollContainer.addEventListener('paste', handlePaste, true);

          // Listen for scroll events to restore position during typing
          scrollContainer.addEventListener('scroll', handleScroll, {
            capture: true,
          });
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        clearTimeout(typingTimeout);
        const scrollContainer = findScrollContainer();
        if (scrollContainer) {
          scrollContainer.removeEventListener('keydown', handleKeyDown, true);
          scrollContainer.removeEventListener('paste', handlePaste, true);
          scrollContainer.removeEventListener('scroll', handleScroll);
        }
      };
    }, [tabs.length]);

    // Focus management: focus the active terminal when panel changes or becomes visible
    useEffect(() => {
      if (!isVisible || tabs.length === 0) {
        return;
      }

      const activeTab = tabs[currentPanelIndex];
      if (!activeTab) {
        return;
      }

      // Wait for the terminal to be ready and visible
      const focusTimer = setTimeout(() => {
        const terminalRef = terminalRefs.current.get(activeTab.id);
        if (terminalRef) {
          terminalRef.focus();
        }
      }, 250);

      return () => clearTimeout(focusTimer);
    }, [currentPanelIndex, isVisible]);

    // Keyboard shortcuts for carousel navigation
    useEffect(() => {
      const handleKeyDown = async (e: KeyboardEvent) => {
        // Ignore keyboard events when focus is on an input element or terminal
        // This prevents shortcuts from interfering with typing
        const target = e.target as HTMLElement;
        const isInputElement =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.xterm') !== null || // xterm terminal
          target.closest('[role="textbox"]') !== null;

        // For non-modifier shortcuts, ignore if focus is on input
        if (isInputElement && !e.metaKey && !e.ctrlKey) {
          return;
        }

        // Command/Ctrl + T to open new tab
        if ((e.metaKey || e.ctrlKey) && e.key === 't') {
          if (e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          addNewTabRef.current?.();
          return;
        }

        // Command/Ctrl + W to close active tab
        if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
          e.preventDefault();
          e.stopPropagation();

          const currentTabs = tabsRef.current;
          const currentIndex = currentPanelIndexRef.current;

          // Determine which terminal has focus by checking if the event target is within a terminal
          let focusedTabIndex = -1;
          const target = e.target as HTMLElement;

          // Check each terminal to see which one contains the focused element
          for (let i = 0; i < currentTabs.length; i++) {
            const terminalRef = terminalRefs.current.get(currentTabs[i].id);
            if (terminalRef) {
              const terminal = terminalRef.getTerminal();
              if (terminal && terminal.element && terminal.element.contains(target)) {
                focusedTabIndex = i;
                break;
              }
            }
          }

          // If no terminal has focus, fall back to the current carousel panel
          const actualCurrentIndex = focusedTabIndex >= 0
            ? focusedTabIndex
            : (carouselRef.current?.getCurrentPanel() ?? currentIndex);
          const currentActiveTab = currentTabs[actualCurrentIndex];

          if (currentActiveTab && currentTabs.length > 0) {
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
                await WindowService.openRepositoryDashboard(
                  repo as unknown as AlexandriaEntry,
                );
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
          const nextIndex = Math.min(currentTabs.length - 1, currentIndex + 1);
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
                justifyContent: 'center',
                height: '41px',
                padding: '0 12px',
                backgroundColor: isActivePanel
                  ? theme.colors.background
                  : theme.colors.backgroundSecondary,
                borderBottom: `1px solid ${theme.colors.border}`,
                flexShrink: 0,
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
            >
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  fontWeight: isActivePanel
                    ? theme.fontWeights.semibold
                    : theme.fontWeights.body,
                  color: isActivePanel
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
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
            <CarouselTerminalWrapper
              tab={tab}
              terminalContext={terminalContext}
              isVisible={isVisible}
              isActivePanel={isActivePanel}
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
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                  minWidth: '60px',
                  textAlign: 'center',
                }}
              >
                {tabs.length > 0
                  ? `${currentPanelIndex + 1} / ${tabs.length}`
                  : '0 / 0'}
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
              {/* Toggle view button - only show in multi-terminal mode */}
              {onToggleView && (
                <button
                  onClick={onToggleView}
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
                  title="Switch to tabbed view"
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
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    backgroundColor: showAllTerminals
                      ? theme.colors.primary
                      : 'transparent',
                    cursor: 'pointer',
                    color: showAllTerminals ? theme.colors.background : theme.colors.textSecondary,
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
              )}

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
              {showDebugButton && (
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
              )}
            </div>
          </div>
        )}

        {/* Carousel content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {tabs.length > 0 ? (
            <div
              ref={carouselWrapperRef}
              style={{ height: '100%', width: '100%' }}
            >
              <SnapCarousel
                ref={carouselRef}
                panels={carouselPanels}
                theme={theme}
                minPanelWidth={minPanelWidth}
                idealPanelWidth={idealPanelWidth}
                gap={1}
                onPanelChange={handlePanelChange}
                preventKeyboardScroll={false}
                style={{ height: '100%' }}
              />
            </div>
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
                  color: theme.colors.background,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
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
          currentSessionId={sessionIds.get(tabs[currentPanelIndex]?.id || '')}
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

export const CarouselTerminalPanelPreview: React.FC = () => {
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
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: theme.colors.primary,
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: theme.colors.backgroundTertiary,
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: theme.colors.backgroundTertiary,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: theme.fonts.mono,
          color: theme.colors.textSecondary,
        }}
      >
        $ npm run build
      </div>
    </div>
  );
};

CarouselTerminalPanel.displayName = 'CarouselTerminalPanel';
