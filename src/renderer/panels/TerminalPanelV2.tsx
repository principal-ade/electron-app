import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { ArrowRight } from 'lucide-react';

import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { TerminalService } from '../main-process-api/TerminalService';
import { ShellService } from '../main-process-api/ShellService';
import { DevSidecarService } from '../main-process-api/DevSidecarService';

import { XTerminalPanel } from './components/xterminal';
import type { XTerminalPanelRef, TerminalOverlayState } from './components/xterminal';

/* eslint-disable no-console */

/**
 * TerminalPanelV2Props
 * Strongly typed props for the embedded terminal component.
 */
interface TerminalPanelV2Props {
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

export interface TerminalPanelV2Ref {
  scrollToBottom: () => void;
  focus: () => void;
}

const TerminalPanelV2 = forwardRef<TerminalPanelV2Ref, TerminalPanelV2Props>(
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
    const terminalRef = useRef<XTerminalPanelRef>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [aiSessionInfo, setAiSessionInfo] = useState<{
      sessionId: string;
      customName?: string;
    } | null>(null);
    const devSidecarSessionIdRef = useRef<string | null>(null);
    const [devSidecarSessionId, setDevSidecarSessionId] = useState<
      string | null
    >(null);

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
          // Check if we're hitting the session limit
          const sessions = await TerminalService.list();
          if (sessions && sessions.length >= 10) {
            console.warn(
              '[TerminalPanelV2] At terminal session limit, attempting cleanup...',
            );
            // Try to clean up orphaned sessions
            const orphanedSessions = sessions.filter(
              (s) =>
                s.status === 'disconnected' ||
                !s.lastActivity ||
                (s.lastActivity &&
                  Date.now() - new Date(s.lastActivity).getTime() > 300000),
            );

            for (const orphan of orphanedSessions) {
              try {
                await TerminalService.destroy(orphan.id);
              } catch (err) {
                console.error(
                  '[TerminalPanelV2] Failed to destroy orphaned session:',
                  err,
                );
              }
            }
          }

          // If there's an initial command, create a new terminal with that command
          if (initialCommand) {
            const id = await TerminalService.createWithCommand(
              dir,
              initialCommand,
              context,
            );
            return id || null;
          }
          // For agent sessions without command, always create new
          else if (agentSessionId) {
            const id = await TerminalService.create(dir, context);
            return id || null;
          }
          // For tabbed terminals (context includes tab ID), always create new sessions
          else if (context && context.includes(':tab-')) {
            const id = await TerminalService.create(dir, context);
            return id || null;
          } else {
            // Regular terminals can reuse existing sessions for the same directory+context
            const id = await TerminalService.getOrCreate(dir, context);
            return id || null;
          }
        } catch (error) {
          console.error('Failed to create terminal session:', error);
          return null;
        }
      },
      [initialCommand, agentSessionId, context],
    );

    const destroyTerminalSession = async (id: string) => {
      try {
        await TerminalService.destroy(id);
      } catch (error) {
        console.error('Failed to destroy terminal session:', error);
      }
    };

    // Fetch AI session info
    useEffect(() => {
      if (agentSessionId && directory) {
        AgentSessionService?.getSession(directory, agentSessionId)
          .then((session) => {
            if (session) {
              setAiSessionInfo({
                sessionId: session.sessionId,
                customName: session.metadata?.customName,
              });
            }
          })
          .catch((error) => {
            console.error('Failed to fetch AI session info:', error);
          });
      }
    }, [agentSessionId, directory]);

    // Keep ref in sync with state
    useEffect(() => {
      devSidecarSessionIdRef.current = devSidecarSessionId;
    }, [devSidecarSessionId]);

    // Listen for dev sidecar window events
    useEffect(() => {
      const unsubscribe = DevSidecarService.onWindowClosed(
        (closedSessionId) => {
          if (closedSessionId === devSidecarSessionId) {
            setDevSidecarSessionId(null);
          }
        },
      );
      return () => {
        unsubscribe();
      };
    }, [devSidecarSessionId]);

    // Create terminal session if needed or use provided one
    useEffect(() => {
      if (terminalId) {
        setSessionId(terminalId);
        return;
      }

      if (sessionId) {
        return;
      }

      let isMounted = true;

      createTerminalSession(directory).then((id) => {
        if (id && isMounted) {
          setSessionId(id);
          if (onSessionCreated) {
            onSessionCreated(id);
          }
        }
      });

      return () => {
        isMounted = false;
      };
    }, [
      directory,
      terminalId,
      sessionId,
      onSessionCreated,
      createTerminalSession,
    ]);

    // Check and claim ownership when we have a session ID
    useEffect(() => {
      if (!sessionId || !isVisible) {
        return;
      }

      let isMounted = true;

      const checkAndClaimOwnership = async () => {
        try {
          const status = await TerminalService.checkOwnership(sessionId);

          if (!isMounted) return;

          if (!status.exists) {
            console.error(
              `[TerminalPanelV2] Session ${sessionId} does not exist`,
            );
            setShouldRenderTerminal(false);
            return;
          }

          if (status.ownedByThisWindow || status.canClaim) {
            const result = await TerminalService.claimOwnership(sessionId, false);

            if (!isMounted) return;

            if (result.success) {
              console.log(
                `[TerminalPanelV2] Successfully claimed ownership of session ${sessionId}`,
              );
              setOwnershipStatus({
                isOwned: false,
                ownedByWindowId: null,
                canTakeControl: true,
              });
              setShouldRenderTerminal(true);
            } else {
              console.log(
                `[TerminalPanelV2] Session ${sessionId} is owned by window ${result.ownedByWindowId}`,
              );
              setOwnershipStatus({
                isOwned: true,
                ownedByWindowId: result.ownedByWindowId || null,
                canTakeControl: false,
              });
              setShouldRenderTerminal(false);
            }
          } else {
            console.log(
              `[TerminalPanelV2] Session ${sessionId} is owned by window ${status.ownedByWindowId}`,
            );
            setOwnershipStatus({
              isOwned: true,
              ownedByWindowId: status.ownedByWindowId,
              canTakeControl: true,
            });
            setShouldRenderTerminal(false);
          }
        } catch (error) {
          console.error('[TerminalPanelV2] Failed to check ownership:', error);
          if (isMounted) {
            setShouldRenderTerminal(true);
          }
        }
      };

      checkAndClaimOwnership();

      return () => {
        isMounted = false;
        if (sessionId) {
          TerminalService.releaseOwnership(sessionId).catch((err) => {
            console.error('[TerminalPanelV2] Failed to release ownership:', err);
          });
        }
      };
    }, [sessionId, isVisible]);

    // Listen for ownership lost events
    useEffect(() => {
      if (!sessionId) {
        return;
      }

      const unsubscribe = TerminalService.onOwnershipLost(
        (data: { sessionId: string; newOwnerWindowId: number }) => {
          if (data.sessionId === sessionId) {
            console.log(
              `[TerminalPanelV2] Lost ownership of session ${sessionId} to window ${data.newOwnerWindowId}`,
            );
            setOwnershipStatus({
              isOwned: true,
              ownedByWindowId: data.newOwnerWindowId,
              canTakeControl: true,
            });
            setShouldRenderTerminal(false);
          }
        },
      );

      return () => {
        unsubscribe();
      };
    }, [sessionId]);

    // Handle terminal data
    useEffect(() => {
      if (!terminalRef.current || !sessionId) {
        return;
      }

      // Listen for data from backend
      const unsubscribe = TerminalService.onData(
        async (data: { sessionId: string; data: string }) => {
          if (data.sessionId === sessionId && terminalRef.current) {
            terminalRef.current.write(data.data);
          }
        },
      );

      // Listen for terminal exit
      const unsubscribeExit = TerminalService.onExit(
        async (exitData: { sessionId: string; code: number }) => {
          if (exitData.sessionId === sessionId && terminalRef.current) {
            terminalRef.current.write(
              `\r\n[Process exited with code ${exitData.code}]\r\n`,
            );
          }
        },
      );

      return () => {
        void unsubscribe.then((fn) => fn()).catch(() => {});
        void unsubscribeExit.then((fn) => fn()).catch(() => {});
      };
    }, [sessionId]);

    // Handle connecting to existing session - trigger refresh and resize to show buffer
    useEffect(() => {
      if (!sessionId || !terminalId) {
        return;
      }

      // When reconnecting to an existing session, we need to:
      // 1. Refresh the backend PTY to send buffer contents
      // 2. Fit the terminal UI to ensure proper dimensions
      const refreshAndFit = async () => {
        try {
          // First, refresh the backend to force PTY to send buffer
          await TerminalService.refresh(sessionId);

          // Then fit the terminal UI after a short delay to ensure buffer is received
          setTimeout(() => {
            if (terminalRef.current) {
              terminalRef.current.fit();
            }
          }, 100);
        } catch (error) {
          console.error('[TerminalPanelV2] Failed to refresh terminal:', error);
          // Still try to fit even if refresh fails
          if (terminalRef.current) {
            terminalRef.current.fit();
          }
        }
      };

      // Wait a bit for terminal to be fully initialized
      setTimeout(refreshAndFit, 200);
    }, [sessionId, terminalId]);

    // Callbacks for XTerminalPanel
    const handleData = useCallback(
      (data: string) => {
        if (sessionId) {
          TerminalService.write(sessionId, data);
        }
      },
      [sessionId],
    );

    const handleResize = useCallback(
      (cols: number, rows: number) => {
        if (sessionId) {
          TerminalService.resize(sessionId, cols, rows);
        }
      },
      [sessionId],
    );

    const handleLinkClick = useCallback(
      async (url: string, isLocalhost: boolean) => {
        if (isLocalhost) {
          try {
            const currentSessionId = devSidecarSessionIdRef.current;
            if (currentSessionId) {
              await DevSidecarService.navigate(currentSessionId, url);
              await DevSidecarService.focusWindow(currentSessionId);
            } else {
              const info = await DevSidecarService.createWindow({
                devServerUrl: url,
              });
              setDevSidecarSessionId(info.sessionId);
            }
          } catch (err) {
            console.error(
              '[TerminalPanelV2] Failed to open link in dev sidecar:',
              url,
              err,
            );
            ShellService.openExternal(url).catch(console.error);
          }
        } else {
          ShellService.openExternal(url).catch((err) => {
            console.error('[TerminalPanelV2] Failed to open link:', url, err);
          });
        }
      },
      [devSidecarSessionId],
    );

    const handleDestroy = useCallback(() => {
      if (sessionId) {
        void destroyTerminalSession(sessionId);
        setSessionId(null);
        if (onDestroy) {
          onDestroy();
        }
      }
    }, [sessionId, onDestroy]);

    const handlePopOut = useCallback(async () => {
      if (sessionId) {
        try {
          const result = await TerminalService.popOut(sessionId);
          console.log('Terminal popped out to window:', result?.windowId);

          if (onClose) {
            onClose();
          }
        } catch (error) {
          console.error('Failed to pop out terminal:', error);
        }
      }
    }, [sessionId, onClose]);

    const handleSwitchToOwnerWindow = useCallback(async () => {
      if (ownershipStatus.ownedByWindowId) {
        try {
          await TerminalService.focusWindow(ownershipStatus.ownedByWindowId);
        } catch (error) {
          console.error('Failed to focus owner window:', error);
        }
      }
    }, [ownershipStatus.ownedByWindowId]);

    const handleTakeControl = useCallback(async () => {
      if (sessionId) {
        try {
          const result = await TerminalService.claimOwnership(sessionId, true);
          if (result.success) {
            console.log(
              `[TerminalPanelV2] Successfully took control of session ${sessionId}`,
            );
            setOwnershipStatus({
              isOwned: false,
              ownedByWindowId: null,
              canTakeControl: true,
            });
            setShouldRenderTerminal(true);
          } else {
            console.error('[TerminalPanelV2] Failed to take control:', result);
          }
        } catch (error) {
          console.error('[TerminalPanelV2] Failed to take control:', error);
        }
      }
    }, [sessionId]);

    // Build overlay state for ownership
    const overlayState: TerminalOverlayState | undefined = ownershipStatus.isOwned
      ? {
          type: 'owned',
          message: 'This terminal is active in another window',
          subtitle: `Window ID: ${ownershipStatus.ownedByWindowId}`,
          actions: [
            {
              label: 'Switch to Window',
              onClick: handleSwitchToOwnerWindow,
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

    // Build header badge for AI session
    const headerBadge = aiSessionInfo
      ? {
          label: `AI: ${aiSessionInfo.customName || aiSessionInfo.sessionId.slice(0, 8)}`,
          color: '#00D9FF',
        }
      : undefined;

    // Build header subtitle
    const headerSubtitle = directory.split('/').pop() || directory;

    return (
      <XTerminalPanel
        ref={terminalRef}
        className={className}
        hideHeader={hideHeader}
        headerTitle="Terminal"
        headerSubtitle={headerSubtitle}
        headerBadge={headerBadge}
        autoFocus={autoFocus}
        isVisible={isVisible && shouldRenderTerminal}
        onData={handleData}
        onResize={handleResize}
        onLinkClick={handleLinkClick}
        onClose={onClose}
        onDestroy={handleDestroy}
        onPopOut={sessionId ? handlePopOut : undefined}
        overlayState={overlayState}
      />
    );
  },
);

TerminalPanelV2.displayName = 'TerminalPanelV2';

export default TerminalPanelV2;
