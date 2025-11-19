import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { ArrowRight, Lock, Unlock, Maximize2, ArrowDown } from 'lucide-react';
import {
  ThemedTerminalWithProvider,
  type ThemedTerminalRef,
  type TerminalScrollPosition,
} from '@principal-ade/industry-themed-terminal';
import { useTheme } from '@principal-ade/industry-theme';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import '@principal-ade/industry-themed-terminal/styles.css';

import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { TerminalService } from '../main-process-api/TerminalService';
import { ShellService } from '../main-process-api/ShellService';
import { DevSidecarService } from '../main-process-api/DevSidecarService';
import { terminalRecorder } from '../utils/terminalRecorder';

/* eslint-disable no-console */

/**
 * TerminalPanelPackagedProps
 * Strongly typed props for the packaged terminal component.
 */
interface TerminalPanelPackagedProps {
  /** Absolute working directory for the terminal session */
  directory: string;
  /** Optional context to differentiate terminals (e.g., 'principal', 'dashboard') */
  context?: string;
  /** Optional handler when user requests to hide the terminal (does not kill the session) */
  onClose?: () => void;
  /** Optional handler when user requests to destroy the terminal session */
  onDestroy?: () => void;
  /** Optional class name for container styling */
  className?: string;
  /** Optional associated AI session ID */
  agentSessionId?: string;
  /** Optional existing terminal session ID to connect to (re-attach) */
  terminalId?: string;
  /** Whether to focus the terminal when it's created */
  autoFocus?: boolean;
  /** When true, suppresses the built-in header so the parent can provide its own */
  hideHeader?: boolean;
  /** Whether the terminal is currently visible - triggers resize when becomes visible */
  isVisible?: boolean;
  /** Callback when a new terminal session is created */
  onSessionCreated?: (sessionId: string) => void;
  /** Optional command to run when the terminal is created */
  initialCommand?: string;
  /** Callback when the terminal scroll position changes */
  onScrollPositionChange?: (position: TerminalScrollPosition) => void;
  /** Whether to show the control bar with fit/scroll buttons */
  showControlBar?: boolean;
}

export interface TerminalPanelPackagedRef {
  scrollToBottom: () => void;
  focus: () => void;
  getTerminal: () => Terminal | null;
  fit: () => void;
}

const TerminalPanelPackaged = forwardRef<
  TerminalPanelPackagedRef,
  TerminalPanelPackagedProps
>(
  (
    {
      directory,
      context,
      onClose,
      onDestroy,
      className = '',
      agentSessionId,
      terminalId,
      autoFocus = true,
      hideHeader = false,
      isVisible = true,
      onSessionCreated,
      initialCommand,
      onScrollPositionChange,
      showControlBar = true,
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const terminalRef = useRef<ThemedTerminalRef>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [aiSessionInfo, setAiSessionInfo] = useState<{
      sessionId: string;
      customName?: string;
    } | null>(null);
    const [devSidecarSessionId, setDevSidecarSessionId] = useState<
      string | null
    >(null);
    const devSidecarSessionIdRef = useRef<string | null>(null);
    const hasInitializedRef = useRef(false);
    const [scrollPosition, setScrollPosition] = useState<TerminalScrollPosition>({
      isAtTop: false,
      isAtBottom: true,
      isScrollLocked: true,
    });

    // Ownership tracking state
    const [ownershipStatus, setOwnershipStatus] = useState<{
      isOwned: boolean;
      ownedByWindowId: number | null;
      canTakeControl: boolean;
    }>({
      isOwned: false,
      ownedByWindowId: null,
      canTakeControl: true,
    });
    const [shouldRenderTerminal, setShouldRenderTerminal] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Expose scrollToBottom, focus, fit, and getTerminal methods via ref
    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom: () => {
          terminalRef.current?.scrollToBottom();
        },
        focus: () => {
          terminalRef.current?.focus();
        },
        getTerminal: () => {
          return terminalRef.current?.getTerminal() ?? null;
        },
        fit: () => {
          terminalRef.current?.fit();
        },
      }),
      [],
    );

    const createTerminalSession = useCallback(
      async (dir: string): Promise<string | null> => {
        try {
          // Note: Session limit is now 20 (no auto cleanup)

          // Create or get existing session
          let newSessionId: string;
          if (terminalId) {
            // Re-attach to existing session
            newSessionId = terminalId;
            console.log(
              '[TerminalPanelPackaged] Re-attaching to session:',
              newSessionId,
            );
          } else if (initialCommand) {
            // Create session with initial command
            newSessionId = await TerminalService.createWithCommand(
              dir,
              initialCommand,
              context || 'default',
            );
            console.log(
              '[TerminalPanelPackaged] Created session with command:',
              newSessionId,
            );
          } else {
            // Create or reuse session
            newSessionId = await TerminalService.getOrCreate(
              dir,
              context || 'default',
            );
            console.log(
              '[TerminalPanelPackaged] Created/reused session:',
              newSessionId,
            );
          }

          setSessionId(newSessionId);
          if (onSessionCreated) {
            onSessionCreated(newSessionId);
          }

          return newSessionId;
        } catch (error) {
          console.error(
            '[TerminalPanelPackaged] Failed to create terminal session:',
            error,
          );
          return null;
        }
      },
      [context, terminalId, initialCommand, onSessionCreated],
    );

    // Create terminal session - only run once on mount
    useEffect(() => {
      // Only initialize once per component instance
      if (hasInitializedRef.current) {
        return;
      }
      hasInitializedRef.current = true;

      let mounted = true;

      const initialize = async () => {
        const newSessionId = await createTerminalSession(directory);
        if (!mounted || !newSessionId) return;

        // Check ownership
        try {
          const ownershipStatus =
            await TerminalService.checkOwnership(newSessionId);
          if (!mounted) return;

          if (
            ownershipStatus.ownedByWindowId &&
            !ownershipStatus.ownedByThisWindow
          ) {
            console.log(
              `[TerminalPanelPackaged] Terminal owned by window ${ownershipStatus.ownedByWindowId}, showing overlay`,
            );
            setOwnershipStatus({
              isOwned: true,
              ownedByWindowId: ownershipStatus.ownedByWindowId,
              canTakeControl: ownershipStatus.canClaim,
            });
            setShouldRenderTerminal(false);
          } else {
            // Claim ownership
            console.log(
              `[TerminalPanelPackaged] Claiming ownership of session ${newSessionId}`,
            );
            await TerminalService.claimOwnership(newSessionId);
            console.log(
              `[TerminalPanelPackaged] Successfully claimed ownership`,
            );
            setShouldRenderTerminal(true);
          }
        } catch (error) {
          console.error(
            '[TerminalPanelPackaged] Ownership check failed:',
            error,
          );
        }
      };

      initialize();

      return () => {
        mounted = false;
        // Note: We don't release ownership on unmount because this component
        // may unmount when switching between tabbed/carousel views, but we want
        // to maintain ownership. Ownership will be released when the session is
        // explicitly destroyed or when another window claims it.
      };
      // Only run on mount - intentionally minimal dependencies
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for ownership lost events
    useEffect(() => {
      if (!sessionId) return;

      console.log(
        `[TerminalPanelPackaged] Setting up ownership lost listener for session ${sessionId}`,
      );

      const unsubscribe = TerminalService.onOwnershipLost((data) => {
        console.log(
          `[TerminalPanelPackaged] Received ownership lost event:`,
          data,
        );
        if (data.sessionId === sessionId) {
          console.log(
            `[TerminalPanelPackaged] Ownership lost for session ${sessionId}, new owner: ${data.newOwnerWindowId}`,
          );
          console.log('[TerminalPanelPackaged] Setting shouldRenderTerminal to false to show overlay');
          setOwnershipStatus({
            isOwned: true,
            ownedByWindowId: data.newOwnerWindowId,
            canTakeControl: true, // User can always take control back
          });
          setShouldRenderTerminal(false);
        }
      });

      return () => {
        console.log(
          `[TerminalPanelPackaged] Cleaning up ownership lost listener for session ${sessionId}`,
        );
        unsubscribe();
      };
    }, [sessionId]);

    // Listen for terminal data from backend
    // Only subscribe when we own the terminal (shouldRenderTerminal is true)
    // Uses session-specific IPC channel for better performance (no client-side filtering)
    useEffect(() => {
      if (!sessionId || !shouldRenderTerminal) return;

      let mounted = true;

      // Subscribe to session-specific channel - more efficient than global channel with filtering
      const unsubscribe = TerminalService.onDataForSession(sessionId, (data) => {
        if (mounted && terminalRef.current) {
          // Write to terminal
          terminalRef.current.write(data);

          // Record data written to terminal (what the user actually sees)
          // Only if recording is enabled (early return inside if disabled)
          terminalRecorder.recordDataWritten(sessionId, data);
        }
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    }, [sessionId, shouldRenderTerminal]);

    // Handle connecting to existing session - trigger refresh to show buffer
    useEffect(() => {
      if (!sessionId || !terminalId || !shouldRenderTerminal) {
        return;
      }

      // When reconnecting to an existing session, refresh the backend PTY to send buffer contents
      const refreshSession = async () => {
        try {
          await TerminalService.refresh(sessionId);
        } catch (error) {
          console.error(
            '[TerminalPanelPackaged] Failed to refresh terminal:',
            error,
          );
        }
      };

      // Wait for terminal to be fully initialized before refreshing
      setTimeout(refreshSession, 200);
    }, [sessionId, terminalId, shouldRenderTerminal]);

    // Track AI session info
    useEffect(() => {
      if (!agentSessionId) {
        setAiSessionInfo(null);
        return;
      }

      let mounted = true;

      const fetchSessionInfo = async () => {
        try {
          const session = await AgentSessionService.getSession(
            agentSessionId,
            directory,
          );
          if (mounted && session) {
            setAiSessionInfo({
              sessionId: agentSessionId,
              customName: session.customName,
            });
          }
        } catch (error) {
          console.error(
            '[TerminalPanelPackaged] Failed to fetch AI session info:',
            error,
          );
        }
      };

      fetchSessionInfo();

      return () => {
        mounted = false;
      };
      // Only re-fetch when agentSessionId changes, not when directory changes
      // The directory is only used as context to find the session store
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentSessionId]);

    // Track dev sidecar session via DevSidecarService events
    useEffect(() => {
      if (!agentSessionId) {
        setDevSidecarSessionId(null);
        devSidecarSessionIdRef.current = null;
        return;
      }

      // Listen for dev sidecar window creation/closure events
      const unsubscribeCreated = DevSidecarService.onWindowCreated((info) => {
        setDevSidecarSessionId(info.sessionId);
        devSidecarSessionIdRef.current = info.sessionId;
      });

      const unsubscribeClosed = DevSidecarService.onWindowClosed((sessionId) => {
        if (sessionId === devSidecarSessionIdRef.current) {
          setDevSidecarSessionId(null);
          devSidecarSessionIdRef.current = null;
        }
      });

      return () => {
        unsubscribeCreated();
        unsubscribeClosed();
      };
    }, [agentSessionId]);

    // Handle user input
    const handleData = useCallback(
      (data: string) => {
        if (sessionId) {
          TerminalService.write(sessionId, data).catch((err) =>
            console.error(
              '[TerminalPanelPackaged] Failed to write to terminal:',
              err,
            ),
          );
        }
      },
      [sessionId],
    );

    // Handle terminal resize
    const handleResize = useCallback(
      (cols: number, rows: number) => {
        if (sessionId) {
          TerminalService.resize(sessionId, cols, rows).catch((err) =>
            console.error(
              '[TerminalPanelPackaged] Failed to resize terminal:',
              err,
            ),
          );
        }
      },
      [sessionId],
    );

    // Handle link clicks
    const handleLinkClick = useCallback((url: string, isLocalhost: boolean) => {
      if (isLocalhost) {
        ShellService.openExternal(url);
      } else {
        ShellService.openExternal(url);
      }
    }, []);

    // Handle scroll position change
    const handleScrollPositionChange = useCallback(
      (position: TerminalScrollPosition) => {
        setScrollPosition(position);
        onScrollPositionChange?.(position);
      },
      [onScrollPositionChange],
    );

    // Handlers for control bar buttons
    const handleFit = useCallback(() => {
      terminalRef.current?.fit();
    }, []);

    const handleScrollToBottom = useCallback(() => {
      terminalRef.current?.scrollToBottom();
    }, []);

    // Handle destroy
    const handleDestroyClick = useCallback(() => {
      if (sessionId) {
        TerminalService.destroy(sessionId)
          .then(() => {
            console.log(
              '[TerminalPanelPackaged] Terminal session destroyed:',
              sessionId,
            );
            if (onDestroy) {
              onDestroy();
            }
          })
          .catch((err) => {
            console.error(
              '[TerminalPanelPackaged] Failed to destroy terminal:',
              err,
            );
          });
      }
    }, [sessionId, onDestroy]);

    // Handle ownership actions
    const handleSwitchToWindow = useCallback(() => {
      if (ownershipStatus.ownedByWindowId) {
        // TODO: Implement window switching
        console.log(
          '[TerminalPanelPackaged] Switch to window:',
          ownershipStatus.ownedByWindowId,
        );
      }
    }, [ownershipStatus.ownedByWindowId]);

    const handleTakeControl = useCallback(async () => {
      if (!sessionId) return;

      try {
        console.log('[TerminalPanelPackaged] Taking control with force=true');
        setIsTransitioning(true); // Show overlay during transition

        await TerminalService.claimOwnership(sessionId, true); // force=true to take from other window
        setOwnershipStatus({
          isOwned: false,
          ownedByWindowId: null,
          canTakeControl: true,
        });
        setShouldRenderTerminal(true);

        // Trigger a resize to force the terminal to redraw and show the buffer
        // Change dimensions slightly then back to force a full redraw
        setTimeout(() => {
          if (terminalRef.current) {
            const terminal = terminalRef.current.getTerminal();
            if (terminal) {
              const currentCols = terminal.cols;
              const currentRows = terminal.rows;
              // Resize to different dimensions to trigger redraw
              terminal.resize(currentCols - 1, currentRows);
              // Resize back to original dimensions
              setTimeout(() => {
                terminal.resize(currentCols, currentRows);
                // Hide overlay after resize completes
                setTimeout(() => {
                  setIsTransitioning(false);
                }, 50);
              }, 50);
            } else {
              setIsTransitioning(false);
            }
          } else {
            setIsTransitioning(false);
          }
        }, 100);
      } catch (error) {
        console.error('[TerminalPanelPackaged] Failed to take control:', error);
        setIsTransitioning(false);
      }
    }, [sessionId]);

    // Build header title and subtitle
    const headerTitle = 'Terminal';
    const headerSubtitle = directory;
    const headerBadge = aiSessionInfo
      ? {
          label: aiSessionInfo.customName
            ? `AI: ${aiSessionInfo.customName}`
            : `AI: ${aiSessionInfo.sessionId.slice(0, 8)}`,
          color: devSidecarSessionId ? '#00D9FF' : '#888',
        }
      : undefined;

    // Build overlay state for ownership
    const overlayState = !shouldRenderTerminal
      ? {
          message: 'This terminal is active in another window',
          subtitle: ownershipStatus.ownedByWindowId
            ? `Window ID: ${ownershipStatus.ownedByWindowId}`
            : 'Another window owns this terminal session',
          actions: [
            {
              label: 'Switch to Window',
              onClick: handleSwitchToWindow,
              primary: true,
              icon: <ArrowRight size={16} />,
            },
            {
              label: 'Take Control Here',
              onClick: handleTakeControl,
              primary: false,
            },
          ],
          opacity: 1.0, // Full opacity
        }
      : isTransitioning
        ? {
            message: 'Loading terminal...',
            subtitle: 'Please wait',
            actions: [],
            opacity: 1.0, // Full opacity
          }
        : undefined;

    // Debug logging for overlay state
    useEffect(() => {
      console.log('[TerminalPanelPackaged] shouldRenderTerminal:', shouldRenderTerminal);
      console.log('[TerminalPanelPackaged] overlayState:', overlayState ? 'SHOWING OVERLAY' : 'NO OVERLAY');
    }, [shouldRenderTerminal, overlayState]);

    if (!shouldRenderTerminal && overlayState) {
      // Show overlay without mounting the terminal
      return (
        <div className={className} style={{ height: '100%', width: '100%' }}>
          <ThemedTerminalWithProvider
            ref={terminalRef}
            onData={handleData}
            onResize={handleResize}
            onLinkClick={handleLinkClick}
            onScrollPositionChange={handleScrollPositionChange}
            headerTitle={headerTitle}
            headerSubtitle={headerSubtitle}
            headerBadge={headerBadge}
            hideHeader={hideHeader}
            autoFocus={false}
            isVisible={isVisible}
            onClose={onClose}
            onDestroy={handleDestroyClick}
            overlayState={overlayState}
          />
        </div>
      );
    }

    return (
      <div className={className} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Terminal control bar */}
        {showControlBar && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderBottom: `1px solid ${theme.colors.border}`,
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              marginRight: 'auto',
              fontFamily: theme.fonts.monospace,
            }}>
              {directory}
            </span>

            {/* Scroll lock badge */}
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: scrollPosition.isScrollLocked
                ? `${theme.colors.success}22`
                : `${theme.colors.warning}22`,
              color: scrollPosition.isScrollLocked
                ? theme.colors.success
                : theme.colors.warning,
              border: `1px solid ${scrollPosition.isScrollLocked
                ? `${theme.colors.success}44`
                : `${theme.colors.warning}44`}`,
            }}>
              {scrollPosition.isScrollLocked ? (
                <Lock size={12} />
              ) : (
                <Unlock size={12} />
              )}
              <span>{scrollPosition.isScrollLocked ? 'Locked' : 'Unlocked'}</span>
            </span>

            {/* Fit button */}
            <button
              onClick={handleFit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.text,
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              title="Resize terminal to fit container"
            >
              <Maximize2 size={12} />
              <span>Fit</span>
            </button>

            {/* Scroll to bottom button */}
            <button
              onClick={handleScrollToBottom}
              disabled={scrollPosition.isAtBottom}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: scrollPosition.isAtBottom
                  ? theme.colors.backgroundHover
                  : theme.colors.accent,
                color: scrollPosition.isAtBottom
                  ? theme.colors.textTertiary
                  : theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                cursor: scrollPosition.isAtBottom ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: scrollPosition.isAtBottom ? 0.5 : 1,
              }}
              onMouseEnter={(e) => !scrollPosition.isAtBottom && (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => !scrollPosition.isAtBottom && (e.currentTarget.style.opacity = '1')}
              title="Scroll to bottom and lock"
            >
              <ArrowDown size={12} />
              <span>Bottom</span>
            </button>
          </div>
        )}

        {/* Terminal */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ThemedTerminalWithProvider
            ref={terminalRef}
            onData={handleData}
            onResize={handleResize}
            onLinkClick={handleLinkClick}
            onScrollPositionChange={handleScrollPositionChange}
            headerTitle={headerTitle}
            headerSubtitle={headerSubtitle}
            headerBadge={headerBadge}
            hideHeader={hideHeader}
            autoFocus={autoFocus}
            isVisible={isVisible}
            onClose={onClose}
            onDestroy={handleDestroyClick}
            overlayState={overlayState}
          />
        </div>
      </div>
    );
  },
);

TerminalPanelPackaged.displayName = 'TerminalPanelPackaged';

export default TerminalPanelPackaged;
