import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { BookOpen, ChevronDown } from 'lucide-react';
import { findAvailablePort, waitForPortReady } from '../../utils/portDetection';
import { StorybookService, type StorybookPackage } from '../../services/StorybookService';
import { TerminalService } from '../../main-process-api/TerminalService';

/**
 * Props for StorybookSidebarButton
 */
export interface StorybookSidebarButtonProps {
  /** Theme for styling */
  theme: Theme;
  /** Packages data from codebase-composition */
  packages?: PackageLayer[];
  /** Repository root path */
  repositoryPath?: string;
  /** Repository owner (for terminal context) */
  repositoryOwner?: string;
  /** Repository name (for terminal context) */
  repositoryName?: string;
  /** Current panel layout */
  currentLayout?: { left: string; middle: string; right: string };
  /** Callback to change panel layout */
  onLayoutChange?: (layout: { left: string; middle: string; right: string }) => void;
  /** Current collapsed state */
  collapsed?: { left: boolean; right: boolean };
  /** Callback to change collapsed state */
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  /** Callback to change panel sizes */
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  /** Panel event emitter for inter-panel communication */
  events?: {
    emit: (event: {
      type: string;
      source: string;
      payload: unknown;
      timestamp: number;
    }) => void;
  };
}

/**
 * StorybookSidebarButton Component
 *
 * A sidebar button that manages Storybook lifecycle (start/stop).
 * Styled to match other sidebar icons with status-based coloring.
 */
export const StorybookSidebarButton: React.FC<StorybookSidebarButtonProps> = ({
  theme,
  packages,
  repositoryPath,
  repositoryOwner,
  repositoryName,
  currentLayout,
  onLayoutChange,
  collapsed,
  onCollapsedChange,
  onPanelSizesChange,
  events,
}) => {
  // Storybook state
  const [storybookStatus, setStorybookStatus] = useState<
    'idle' | 'starting' | 'running' | 'error'
  >('idle');
  const [storybookSessionId, setStorybookSessionId] = useState<string | null>(null);
  const [storybookPort, setStorybookPort] = useState<number | null>(null);
  const [storybookPackages, setStorybookPackages] = useState<StorybookPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<StorybookPackage | null>(null);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Build the expected storybook context for this repository
  const storybookContext = repositoryOwner && repositoryName
    ? `terminal:${repositoryOwner}/${repositoryName}:storybook`
    : null;

  // Check for existing Storybook session on mount and when context changes
  useEffect(() => {
    if (!storybookContext) return;

    const checkExistingSession = async () => {
      try {
        const sessions = await TerminalService.list();
        const existingSession = sessions.find(
          (s) => s.context === storybookContext && s.status === 'active'
        );

        if (existingSession) {
          console.info('[StorybookSidebarButton] Found existing Storybook session:', existingSession.id);
          setStorybookSessionId(existingSession.id);
          setStorybookStatus('running');
          // Restore port from session metadata
          if (existingSession.metadata?.port) {
            setStorybookPort(existingSession.metadata.port);
            console.info('[StorybookSidebarButton] Restored port from metadata:', existingSession.metadata.port);
          }
        }
      } catch (error) {
        console.error('[StorybookSidebarButton] Error checking for existing session:', error);
      }
    };

    checkExistingSession();
  }, [storybookContext]);

  // Listen for terminal exit events to reset state when Storybook session ends
  useEffect(() => {
    if (!storybookSessionId) return;

    let unsubscribe: (() => void) | null = null;

    const setupExitListener = async () => {
      unsubscribe = await TerminalService.onExit((exitEvent) => {
        console.info('[StorybookSidebarButton] Terminal exit event received:', exitEvent);
        if (exitEvent.sessionId === storybookSessionId) {
          console.info('[StorybookSidebarButton] Storybook session exited:', exitEvent.sessionId);
          setStorybookStatus('idle');
          setStorybookSessionId(null);
          setStorybookPort(null);
        }
      });
    };

    setupExitListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [storybookSessionId]);

  // Detect Storybook packages from codebase-composition data
  useEffect(() => {
    if (repositoryPath && packages) {
      const foundPackages = StorybookService.findStorybookPackages(
        packages,
        repositoryPath,
      );
      console.info('[StorybookSidebarButton] Found Storybook packages:', foundPackages);
      setStorybookPackages(foundPackages);

      // Auto-select first package if only one exists
      if (foundPackages.length === 1) {
        setSelectedPackage(foundPackages[0]);
      } else if (foundPackages.length > 1) {
        setSelectedPackage(foundPackages[0]);
      } else {
        setSelectedPackage(null);
      }
    } else {
      setStorybookPackages([]);
      setSelectedPackage(null);
    }
  }, [repositoryPath, packages]);

  // Calculate dropdown position based on button location
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top,
        right: window.innerWidth - rect.left + 4, // 4px gap
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPackageDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideContainer && isOutsideDropdown) {
        setShowPackageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPackageDropdown]);

  // Handler for Storybook button click
  const handleStorybookClick = async (packageToStart?: StorybookPackage) => {
    const targetPackage = packageToStart || selectedPackage;

    console.info('[StorybookSidebarButton] handleStorybookClick called', {
      targetPackage: targetPackage?.name,
      storybookStatus,
      storybookSessionId,
    });

    if (!targetPackage) {
      console.error('[StorybookSidebarButton] No Storybook package selected');
      return;
    }

    if (storybookStatus === 'running' && storybookSessionId) {
      // Stop Storybook
      console.info('[StorybookSidebarButton] Stopping Storybook...');
      try {
        await window.mainProcess.terminal.destroy(storybookSessionId);
        setStorybookStatus('idle');
        setStorybookSessionId(null);
        setStorybookPort(null);

        // Switch right panel back to file-city
        if (currentLayout && onLayoutChange) {
          onLayoutChange({ ...currentLayout, right: 'fileCity' });
        }

        // Expand left panel back
        if (collapsed?.left && onCollapsedChange) {
          onCollapsedChange({ left: false, right: collapsed?.right ?? false });
        }
      } catch (error) {
        console.error('[StorybookSidebarButton] Failed to stop Storybook:', error);
      }
      return;
    }

    try {
      setStorybookStatus('starting');
      setSelectedPackage(targetPackage);

      console.info('[StorybookSidebarButton] Starting Storybook for package:', targetPackage.name);

      // Find available port
      const port = await findAvailablePort(6006, 6020);
      setStorybookPort(port);

      // Get command for this specific package
      const command = StorybookService.getStorybookCommand(targetPackage, port);

      // Create terminal session with storybook context and metadata
      const terminalContext = `terminal:${repositoryOwner}/${repositoryName}:storybook`;

      const sessionId = await TerminalService.createWithCommand(
        targetPackage.path,
        command,
        terminalContext,
        {
          port,
          packageName: targetPackage.name,
          serverType: 'storybook',
        },
      );
      setStorybookSessionId(sessionId || null);

      // Emit custom event to notify TerminalProvider to refresh
      window.dispatchEvent(
        new CustomEvent('terminal-session-created', {
          detail: { sessionId, context: terminalContext },
        }),
      );

      // Give the terminal panel a moment to detect the new session
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set panel sizes to 50/50 split between middle and right
      if (onPanelSizesChange) {
        onPanelSizesChange({ left: 0, middle: 50, right: 50 });
      }

      // Collapse left panel
      if (!collapsed?.left && onCollapsedChange) {
        onCollapsedChange({ left: true, right: collapsed?.right ?? false });
      }

      // Switch right panel to localhost browser
      if (currentLayout && onLayoutChange) {
        onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
      }

      // Expand right panel if collapsed
      if (collapsed?.right && onCollapsedChange) {
        onCollapsedChange({ left: true, right: false });
      }

      // Give the panel time to mount
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Wait for port to become responsive
      await waitForPortReady(port, 30000, 1000);

      // Navigate browser panel to Storybook port
      if (events) {
        const navigatePayload = {
          type: 'principal-ade.localhost-browser:navigate' as const,
          source: 'storybook-sidebar-button',
          payload: { port, path: '/' },
          timestamp: Date.now(),
        };

        events.emit(navigatePayload);

        setTimeout(() => {
          events.emit({
            ...navigatePayload,
            timestamp: Date.now(),
          });
        }, 100);
      }

      setStorybookStatus('running');
      console.info('[StorybookSidebarButton] Storybook started successfully!');
    } catch (error) {
      console.error('[StorybookSidebarButton] Failed to start Storybook:', error);
      setStorybookStatus('error');
    }
  };

  // Derived state (must be before any conditional returns)
  const isRunning = storybookStatus === 'running';
  const isStarting = storybookStatus === 'starting';
  const isShowingStorybook = currentLayout?.right === 'localhostBrowser' && isRunning;
  const buttonColor = isRunning
    ? theme.colors.success
    : theme.colors.textSecondary;

  // Navigate to Storybook panel (when running but viewing another panel)
  // Must be defined before conditional return to maintain hook order
  const showStorybookPanel = useCallback(() => {
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
    }
    // Expand right panel if collapsed
    if (collapsed?.right && onCollapsedChange) {
      onCollapsedChange({ left: collapsed.left, right: false });
    }
    // Navigate browser to the stored port
    if (events && storybookPort) {
      events.emit({
        type: 'principal-ade.localhost-browser:navigate',
        source: 'storybook-sidebar-button',
        payload: { port: storybookPort, path: '/' },
        timestamp: Date.now(),
      });
    }
  }, [currentLayout, onLayoutChange, collapsed, onCollapsedChange, events, storybookPort]);

  // Don't render if no Storybook packages found
  if (storybookPackages.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          console.info('[StorybookSidebarButton] Button clicked', {
            isRunning,
            isStarting,
            isShowingStorybook,
            packagesCount: storybookPackages.length,
            showPackageDropdown,
            target: (e.target as HTMLElement).tagName,
          });

          // If running but not showing Storybook panel, bring it back into view
          if (isRunning && !isShowingStorybook) {
            showStorybookPanel();
            return;
          }

          // Single package: toggle start/stop directly
          if (storybookPackages.length === 1) {
            handleStorybookClick();
          } else {
            // Multiple packages: show dropdown
            if (!showPackageDropdown) {
              updateDropdownPosition();
            }
            setShowPackageDropdown(!showPackageDropdown);
          }
        }}
        disabled={isStarting}
        title={
          isRunning
            ? 'Stop Storybook'
            : storybookPackages.length === 1
              ? `Start Storybook (${selectedPackage?.name})`
              : 'Start Storybook (select package)'
        }
        aria-label={isRunning ? 'Stop Storybook' : 'Start Storybook'}
        style={{
          width: 'calc(100% - 20px)',
          height: '64px',
          margin: '4px 10px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          cursor: isStarting ? 'not-allowed' : 'pointer',
          color: buttonColor,
          transition: 'all 0.2s ease',
          position: 'relative',
          opacity: isStarting ? 0.6 : 1,
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            background: isRunning ? `${theme.colors.success}20` : 'transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isRunning && !isStarting) {
              e.currentTarget.style.background = theme.colors.border;
            }
          }}
          onMouseLeave={(e) => {
            if (!isRunning) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <BookOpen size={20} strokeWidth={1.5} />
          {storybookPackages.length > 1 && (
            <ChevronDown
              size={10}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
          )}
        </div>
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: isRunning ? theme.fontWeights.semibold : theme.fontWeights.body,
            lineHeight: theme.lineHeights.tight,
            textAlign: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isStarting ? 'Starting' : isRunning ? 'Stop SB' : 'Storybook'}
        </span>
      </button>

      {/* Dropdown for multiple packages */}
      {showPackageDropdown && storybookPackages.length > 1 && dropdownPosition && (
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            minWidth: '200px',
          }}
        >
          {/* Show Stop option when running and viewing Storybook */}
          {isShowingStorybook && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPackageDropdown(false);
                handleStorybookClick();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                color: theme.colors.error || '#ff6b6b',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: `${theme.fontSizes[1]}px`,
                borderBottom: `1px solid ${theme.colors.border}`,
                fontWeight: theme.fontWeights.medium,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Stop Storybook
              {selectedPackage && (
                <div
                  style={{
                    fontSize: `${theme.fontSizes[0]}px`,
                    color: theme.colors.textTertiary,
                    marginTop: '2px',
                  }}
                >
                  Running: {selectedPackage.name}
                </div>
              )}
            </button>
          )}
          {/* Show package options when not running */}
          {!isRunning && storybookPackages.map((pkg) => (
            <button
              key={pkg.path}
              onClick={(e) => {
                e.stopPropagation();
                setShowPackageDropdown(false);
                handleStorybookClick(pkg);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background:
                  selectedPackage?.path === pkg.path
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: `${theme.fontSizes[1]}px`,
                borderBottom:
                  storybookPackages[storybookPackages.length - 1] !== pkg
                    ? `1px solid ${theme.colors.border}`
                    : 'none',
              }}
              onMouseEnter={(e) => {
                if (selectedPackage?.path !== pkg.path) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPackage?.path !== pkg.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ fontWeight: theme.fontWeights.medium }}>
                {pkg.name}
              </div>
              <div
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  color: theme.colors.textTertiary,
                  marginTop: '2px',
                }}
              >
                {pkg.path.replace(repositoryPath || '', '').replace(/^\//, '') || '/'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
