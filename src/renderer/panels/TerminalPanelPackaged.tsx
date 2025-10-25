import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { ArrowRight } from 'lucide-react';
import {
  ThemedTerminalWithProvider,
  type ThemedTerminalRef,
} from '@principal-ade/industry-themed-terminal';
import '@xterm/xterm/css/xterm.css';
import '@principal-ade/industry-themed-terminal/styles.css';

import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { TerminalService } from '../main-process-api/TerminalService';
import { ShellService } from '../main-process-api/ShellService';
import { DevSidecarService } from '../main-process-api/DevSidecarService';

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
}

export interface TerminalPanelPackagedRef {
  scrollToBottom: () => void;
  focus: () => void;
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
    },
    ref,
  ) => {
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

    // Expose scrollToBottom and focus methods via ref
    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom: () => {
          terminalRef.current?.scrollToBottom();
        },
        focus: () => {
          terminalRef.current?.focus();
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
            setOwnershipStatus({
              isOwned: true,
              ownedByWindowId: ownershipStatus.ownedByWindowId,
              canTakeControl: ownershipStatus.canClaim,
            });
            setShouldRenderTerminal(false);
          } else {
            // Claim ownership
            await TerminalService.claimOwnership(newSessionId);
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
        if (sessionId) {
          // Release ownership when component unmounts
          TerminalService.releaseOwnership(sessionId).catch((err) =>
            console.error(
              '[TerminalPanelPackaged] Failed to release ownership:',
              err,
            ),
          );
        }
      };
      // Only run on mount - intentionally minimal dependencies
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for terminal data from backend
    useEffect(() => {
      if (!sessionId || !shouldRenderTerminal) return;

      let mounted = true;
      let unsubscribe: (() => void) | undefined;

      const subscribe = async () => {
        unsubscribe = await TerminalService.onData((data) => {
          if (mounted && data.sessionId === sessionId && terminalRef.current) {
            terminalRef.current.write(data.data);
          }
        });
      };

      subscribe();

      return () => {
        mounted = false;
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }, [sessionId, shouldRenderTerminal]);

    // Track AI session info
    useEffect(() => {
      if (!agentSessionId) {
        setAiSessionInfo(null);
        return;
      }

      let mounted = true;

      const fetchSessionInfo = async () => {
        try {
          const session = await AgentSessionService.getSession(agentSessionId);
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
    }, [agentSessionId]);

    // Track dev sidecar session
    useEffect(() => {
      if (!agentSessionId) {
        setDevSidecarSessionId(null);
        devSidecarSessionIdRef.current = null;
        return;
      }

      let mounted = true;

      const checkSidecar = async () => {
        try {
          const session = await AgentSessionService.getSession(agentSessionId);
          if (mounted && session?.devSidecarSessionId) {
            setDevSidecarSessionId(session.devSidecarSessionId);
            devSidecarSessionIdRef.current = session.devSidecarSessionId;
          }
        } catch (error) {
          console.error(
            '[TerminalPanelPackaged] Failed to check dev sidecar:',
            error,
          );
        }
      };

      checkSidecar();

      return () => {
        mounted = false;
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
        await TerminalService.claimOwnership(sessionId);
        setOwnershipStatus({
          isOwned: false,
          ownedByWindowId: null,
          canTakeControl: true,
        });
        setShouldRenderTerminal(true);

        // Refresh terminal
        await TerminalService.refresh(sessionId);
      } catch (error) {
        console.error('[TerminalPanelPackaged] Failed to take control:', error);
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
        }
      : undefined;

    return (
      <div className={className} style={{ height: '100%', width: '100%' }}>
        <ThemedTerminalWithProvider
          ref={terminalRef}
          onData={handleData}
          onResize={handleResize}
          onLinkClick={handleLinkClick}
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
    );
  },
);

TerminalPanelPackaged.displayName = 'TerminalPanelPackaged';

export default TerminalPanelPackaged;
