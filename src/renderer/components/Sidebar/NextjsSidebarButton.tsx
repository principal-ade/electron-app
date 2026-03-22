import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { Triangle, ChevronDown } from 'lucide-react';
import { findAvailablePort, waitForPortReady } from '../../utils/portDetection';
import { NextjsService, type NextjsPackage } from '../../services/NextjsService';
import { TerminalService } from '../../main-process-api/TerminalService';

/**
 * Props for NextjsSidebarButton
 */
export interface NextjsSidebarButtonProps {
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
 * NextjsSidebarButton Component
 *
 * A sidebar button that manages Next.js dev server lifecycle (start/stop).
 * Styled to match other sidebar icons with status-based coloring.
 */
export const NextjsSidebarButton: React.FC<NextjsSidebarButtonProps> = ({
  theme,
  packages,
  repositoryPath,
  repositoryOwner,
  repositoryName,
  currentLayout,
  onLayoutChange,
  onPanelSizesChange,
  events,
}) => {
  // Next.js state
  const [nextjsStatus, setNextjsStatus] = useState<
    'idle' | 'starting' | 'running' | 'error'
  >('idle');
  const [nextjsSessionId, setNextjsSessionId] = useState<string | null>(null);
  const [nextjsPort, setNextjsPort] = useState<number | null>(null);
  const [nextjsPackages, setNextjsPackages] = useState<NextjsPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<NextjsPackage | null>(null);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Build the expected nextjs context for this repository
  const nextjsContext = repositoryOwner && repositoryName
    ? `terminal:${repositoryOwner}/${repositoryName}:nextjs`
    : null;

  // Check for existing Next.js session on mount and when context changes
  useEffect(() => {
    if (!nextjsContext) return;

    const checkExistingSession = async () => {
      try {
        const sessions = await TerminalService.list();
        const existingSession = sessions.find(
          (s) => s.context === nextjsContext && s.status === 'active'
        );

        if (existingSession) {
          console.info('[NextjsSidebarButton] Found existing Next.js session:', existingSession.id);
          setNextjsSessionId(existingSession.id);
          setNextjsStatus('running');
          // Restore port from session metadata
          if (existingSession.metadata?.port) {
            setNextjsPort(existingSession.metadata.port);
            console.info('[NextjsSidebarButton] Restored port from metadata:', existingSession.metadata.port);
          }
        }
      } catch (error) {
        console.error('[NextjsSidebarButton] Error checking for existing session:', error);
      }
    };

    checkExistingSession();
  }, [nextjsContext]);

  // Listen for terminal exit events to reset state when Next.js session ends
  useEffect(() => {
    if (!nextjsSessionId) return;

    let unsubscribe: (() => void) | null = null;

    const setupExitListener = async () => {
      unsubscribe = await TerminalService.onExit((exitEvent) => {
        console.info('[NextjsSidebarButton] Terminal exit event received:', exitEvent);
        if (exitEvent.sessionId === nextjsSessionId) {
          console.info('[NextjsSidebarButton] Next.js session exited:', exitEvent.sessionId);
          setNextjsStatus('idle');
          setNextjsSessionId(null);
          setNextjsPort(null);
        }
      });
    };

    setupExitListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [nextjsSessionId]);

  // Detect Next.js packages from codebase-composition data
  useEffect(() => {
    if (repositoryPath && packages) {
      const foundPackages = NextjsService.findNextjsPackages(
        packages,
        repositoryPath,
      );
      console.info('[NextjsSidebarButton] Found Next.js packages:', foundPackages);
      setNextjsPackages(foundPackages);

      // Auto-select first package if only one exists
      if (foundPackages.length === 1) {
        setSelectedPackage(foundPackages[0]);
      } else if (foundPackages.length > 1) {
        setSelectedPackage(foundPackages[0]);
      } else {
        setSelectedPackage(null);
      }
    } else {
      setNextjsPackages([]);
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

  // Handler for Next.js button click
  const handleNextjsClick = async (packageToStart?: NextjsPackage) => {
    const targetPackage = packageToStart || selectedPackage;

    console.info('[NextjsSidebarButton] handleNextjsClick called', {
      targetPackage: targetPackage?.name,
      nextjsStatus,
      nextjsSessionId,
    });

    if (!targetPackage) {
      console.error('[NextjsSidebarButton] No Next.js package selected');
      return;
    }

    if (nextjsStatus === 'running' && nextjsSessionId) {
      // Stop Next.js
      console.info('[NextjsSidebarButton] Stopping Next.js...');
      try {
        await window.mainProcess.terminal.destroy(nextjsSessionId);
        setNextjsStatus('idle');
        setNextjsSessionId(null);
        setNextjsPort(null);

        // Restore panel sizes and switch right panel back to file-city
        if (onPanelSizesChange) {
          onPanelSizesChange({ left: 25, middle: 50, right: 25 });
        }
        if (currentLayout && onLayoutChange) {
          onLayoutChange({ ...currentLayout, right: 'fileCity' });
        }
      } catch (error) {
        console.error('[NextjsSidebarButton] Failed to stop Next.js:', error);
      }
      return;
    }

    try {
      setNextjsStatus('starting');
      setSelectedPackage(targetPackage);

      console.info('[NextjsSidebarButton] Starting Next.js for package:', targetPackage.name);

      // Find available port (Next.js default range: 3000-3020)
      const port = await findAvailablePort(3000, 3020);
      setNextjsPort(port);

      // Get command for this specific package
      const command = NextjsService.getNextjsCommand(targetPackage, port);

      // Create terminal session with nextjs context and metadata
      const terminalContext = `terminal:${repositoryOwner}/${repositoryName}:nextjs`;

      const sessionId = await TerminalService.createWithCommand(
        targetPackage.path,
        command,
        terminalContext,
        {
          port,
          packageName: targetPackage.name,
          serverType: 'dev',
        },
      );
      setNextjsSessionId(sessionId || null);

      // Emit custom event to notify TerminalProvider to refresh
      window.dispatchEvent(
        new CustomEvent('terminal-session-created', {
          detail: { sessionId, context: terminalContext },
        }),
      );

      // Give the terminal panel a moment to detect the new session
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set panel sizes to 50/50 split between middle and right (left goes to 0)
      if (onPanelSizesChange) {
        onPanelSizesChange({ left: 0, middle: 50, right: 50 });
      }

      // Switch right panel to localhost browser
      if (currentLayout && onLayoutChange) {
        onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
      }

      // Give the panel time to mount
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Wait for port to become responsive
      await waitForPortReady(port, 30000, 1000);

      // Navigate browser panel to Next.js port
      if (events) {
        const navigatePayload = {
          type: 'principal-ade.localhost-browser:navigate' as const,
          source: 'nextjs-sidebar-button',
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

      setNextjsStatus('running');
      console.info('[NextjsSidebarButton] Next.js started successfully!');
    } catch (error) {
      console.error('[NextjsSidebarButton] Failed to start Next.js:', error);
      setNextjsStatus('error');
    }
  };

  // Derived state (must be before any conditional returns)
  const isRunning = nextjsStatus === 'running';
  const isStarting = nextjsStatus === 'starting';
  const isShowingNextjs = currentLayout?.right === 'localhostBrowser' && isRunning;
  const buttonColor = isRunning
    ? theme.colors.success
    : theme.colors.textSecondary;

  // Navigate to Next.js panel (when running but viewing another panel)
  // Must be defined before conditional return to maintain hook order
  const showNextjsPanel = useCallback(() => {
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
    }
    // Navigate browser to the stored port
    if (events && nextjsPort) {
      events.emit({
        type: 'principal-ade.localhost-browser:navigate',
        source: 'nextjs-sidebar-button',
        payload: { port: nextjsPort, path: '/' },
        timestamp: Date.now(),
      });
    }
  }, [currentLayout, onLayoutChange, events, nextjsPort]);

  // Don't render if no Next.js packages found
  if (nextjsPackages.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          console.info('[NextjsSidebarButton] Button clicked', {
            isRunning,
            isStarting,
            isShowingNextjs,
            packagesCount: nextjsPackages.length,
            showPackageDropdown,
            target: (e.target as HTMLElement).tagName,
          });

          // If running but not showing Next.js panel, bring it back into view
          if (isRunning && !isShowingNextjs) {
            showNextjsPanel();
            return;
          }

          // Single package: toggle start/stop directly
          if (nextjsPackages.length === 1) {
            handleNextjsClick();
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
            ? 'Stop Next.js'
            : nextjsPackages.length === 1
              ? `Start Next.js (${selectedPackage?.name})`
              : 'Start Next.js (select package)'
        }
        aria-label={isRunning ? 'Stop Next.js' : 'Start Next.js'}
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
          <Triangle size={20} strokeWidth={1.5} fill="currentColor" />
          {nextjsPackages.length > 1 && (
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
          {isStarting ? 'Starting' : isRunning ? 'Stop NJ' : 'NxtJs'}
        </span>
      </button>

      {/* Dropdown for multiple packages */}
      {showPackageDropdown && nextjsPackages.length > 1 && dropdownPosition && (
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
            fontFamily: theme.fonts.body,
          }}
        >
          {/* Show Stop option when running and viewing Next.js */}
          {isShowingNextjs && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPackageDropdown(false);
                handleNextjsClick();
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
              Stop Next.js
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
          {!isRunning && nextjsPackages.map((pkg) => (
            <button
              key={pkg.path}
              onClick={(e) => {
                e.stopPropagation();
                setShowPackageDropdown(false);
                handleNextjsClick(pkg);
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
                  nextjsPackages[nextjsPackages.length - 1] !== pkg
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
