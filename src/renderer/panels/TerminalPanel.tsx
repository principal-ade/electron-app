import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Terminal as TerminalIcon,
  ExternalLink,
  ChevronDown,
  X,
  Monitor,
  ArrowRight,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { useTheme } from '@a24z/industry-theme';

import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { TerminalService } from '../main-process-api/TerminalService';
import { ShellService } from '../main-process-api/ShellService';
import { DevSidecarService } from '../main-process-api/DevSidecarService';

/* eslint-disable no-console */

/**
 * TerminalPanelProps
 * Strongly typed props for the embedded terminal component.
 */
interface TerminalPanelProps {
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

export interface TerminalPanelRef {
  scrollToBottom: () => void;
  focus: () => void;
}

const TerminalPanel = forwardRef<TerminalPanelRef, TerminalPanelProps>(
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
    const { theme } = useTheme();
    const terminalRef = useRef<HTMLDivElement>(null);
    const [terminal, setTerminal] = useState<Terminal | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [aiSessionInfo, setAiSessionInfo] = useState<{
      sessionId: string;
      customName?: string;
    } | null>(null);
    const devSidecarSessionIdRef = useRef<string | null>(null);
    const [devSidecarSessionId, setDevSidecarSessionId] = useState<
      string | null
    >(null);
    const lastResizeTimeRef = useRef<number>(0);
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isVisibleRef = useRef(isVisible);
    const lastDataWriteTimeRef = useRef<number>(0);

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
    // Start with true for new terminals, will be set to false if ownership check fails
    const [shouldRenderTerminal, setShouldRenderTerminal] = useState(true);

    useEffect(() => {
      isVisibleRef.current = isVisible;
    }, [isVisible]);

    // Expose scrollToBottom and focus methods via ref
    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom: () => {
          if (terminal) {
            terminal.scrollToBottom();
          }
        },
        focus: () => {
          if (terminal) {
            terminal.focus();
          }
        },
      }),
      [terminal],
    );

    const createTerminalSession = useCallback(
      async (dir: string): Promise<string | null> => {
        try {
          // Check if we're hitting the session limit
          const sessions = await TerminalService.list();
          if (sessions && sessions.length >= 10) {
            console.warn(
              '[TerminalPanel] At terminal session limit, attempting cleanup...',
            );
            // Try to clean up orphaned sessions
            const orphanedSessions = sessions.filter(
              (s) =>
                // Consider a session orphaned if it's been idle or disconnected
                s.status === 'disconnected' ||
                !s.lastActivity ||
                (s.lastActivity &&
                  Date.now() - new Date(s.lastActivity).getTime() > 300000), // 5 minutes idle
            );

            for (const orphan of orphanedSessions) {
              try {
                await TerminalService.destroy(orphan.id);
              } catch (err) {
                console.error(
                  '[TerminalPanel] Failed to destroy orphaned session:',
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
            // Agent sessions should have their own terminal
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
        // Use provided terminal ID
        setSessionId(terminalId);
        return;
      }

      if (sessionId) {
        return; // Already have a session
      }

      let isMounted = true;

      createTerminalSession(directory).then((id) => {
        if (id && isMounted) {
          setSessionId(id);
          // Notify parent component of the new session
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
          // Check current ownership status
          const status = await TerminalService.checkOwnership(sessionId);

          if (!isMounted) return;

          // If the session doesn't exist, something went wrong
          if (!status.exists) {
            console.error(
              `[TerminalPanel] Session ${sessionId} does not exist`,
            );
            setShouldRenderTerminal(false);
            return;
          }

          // If this window already owns it or it's unowned, claim/reclaim it
          if (status.ownedByThisWindow || status.canClaim) {
            const result = await TerminalService.claimOwnership(sessionId, false);

            if (!isMounted) return;

            if (result.success) {
              console.log(
                `[TerminalPanel] Successfully claimed ownership of session ${sessionId}`,
              );
              setOwnershipStatus({
                isOwned: false,
                ownedByWindowId: null,
                canTakeControl: true,
              });
              setShouldRenderTerminal(true);
            } else {
              // Ownership claim failed - another window owns it
              console.log(
                `[TerminalPanel] Session ${sessionId} is owned by window ${result.ownedByWindowId}`,
              );
              setOwnershipStatus({
                isOwned: true,
                ownedByWindowId: result.ownedByWindowId || null,
                canTakeControl: false,
              });
              setShouldRenderTerminal(false);
            }
          } else {
            // Owned by another window
            console.log(
              `[TerminalPanel] Session ${sessionId} is owned by window ${status.ownedByWindowId}`,
            );
            setOwnershipStatus({
              isOwned: true,
              ownedByWindowId: status.ownedByWindowId,
              canTakeControl: true,
            });
            setShouldRenderTerminal(false);
          }
        } catch (error) {
          console.error('[TerminalPanel] Failed to check ownership:', error);
          // On error, allow rendering
          if (isMounted) {
            setShouldRenderTerminal(true);
          }
        }
      };

      checkAndClaimOwnership();

      return () => {
        isMounted = false;
        // Release ownership when component unmounts
        if (sessionId) {
          TerminalService.releaseOwnership(sessionId).catch((err) => {
            console.error('[TerminalPanel] Failed to release ownership:', err);
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
              `[TerminalPanel] Lost ownership of session ${sessionId} to window ${data.newOwnerWindowId}`,
            );
            setOwnershipStatus({
              isOwned: true,
              ownedByWindowId: data.newOwnerWindowId,
              canTakeControl: true,
            });
            setShouldRenderTerminal(false);
            // Dispose the terminal instance if it exists
            if (terminal) {
              terminal.dispose();
              setTerminal(null);
            }
          }
        },
      );

      return () => {
        unsubscribe();
      };
    }, [sessionId, terminal]);

    // Initialize terminal UI - only once per component mount AND only if we have ownership
    useEffect(() => {
      if (!terminalRef.current) {
        return;
      }

      // Check if we already have a terminal instance
      if (terminal) {
        return;
      }

      // Only create terminal if we should render it (have ownership)
      if (!shouldRenderTerminal) {
        return;
      }

      // Create terminal instance (only once per component lifecycle)
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: theme.colors.background,
          foreground: theme.colors.text,
          cursor: theme.colors.primary,
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#6272a4',
          magenta: '#bd93f9',
          cyan: '#8be9fd',
          white: '#bfbfbf',
          brightBlack: '#4d4d4d',
          brightRed: '#ff6e67',
          brightGreen: '#5af78e',
          brightYellow: '#f4f99d',
          brightBlue: '#6cadff',
          brightMagenta: '#ff92d0',
          brightCyan: '#9aedfe',
          brightWhite: '#e6e6e6',
        },
        scrollback: 10000,
        // Add padding inside the terminal for better readability
        padding: { top: 4, bottom: 12, left: 4, right: 4 },
      });

      // Add addons
      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);

      // Configure WebLinksAddon with custom handler
      const webLinksAddon = new WebLinksAddon(async (event, uri) => {
        event.preventDefault();

        // Check if it's a localhost URL
        const isLocalhost = uri.match(
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
        );

        if (isLocalhost) {
          // Open localhost links in dev sidecar window
          try {
            const currentSessionId = devSidecarSessionIdRef.current;
            if (currentSessionId) {
              // Navigate existing window to the URL
              await DevSidecarService.navigate(currentSessionId, uri);
              await DevSidecarService.focusWindow(currentSessionId);
            } else {
              // Create new dev sidecar window with this URL
              const info = await DevSidecarService.createWindow({
                devServerUrl: uri,
              });
              setDevSidecarSessionId(info.sessionId);
            }
          } catch (err) {
            console.error(
              '[TerminalPanel] Failed to open link in dev sidecar:',
              uri,
              err,
            );
            // Fallback to external browser
            ShellService.openExternal(uri).catch(console.error);
          }
        } else {
          // Open non-localhost links in external browser
          ShellService.openExternal(uri).catch((err) => {
            console.error('[TerminalPanel] Failed to open link:', uri, err);
          });
        }
      });
      term.loadAddon(webLinksAddon);

      // Open terminal in the DOM
      term.open(terminalRef.current);

      // Ensure container has dimensions before fitting
      setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current) {
          const rect = terminalRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            fitAddon.fit();
          }
        }
      }, 0);

      setTerminal(term);

      // Handle resize - both window resize and container resize
      const handleResize = () => {
        if (!fitAddonRef.current || !isVisibleRef.current || !term) return;

        const now = Date.now();
        // Debounce resize operations to prevent excessive calls
        if (now - lastResizeTimeRef.current < 100) {
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
          }
          resizeTimeoutRef.current = setTimeout(() => {
            if (fitAddonRef.current && term) {
              // Save scroll position before resize
              const scrollPosition = term.buffer.active.viewportY;
              const baseScrollback = term.buffer.active.baseY;
              const wasAtBottom =
                scrollPosition + term.rows >= baseScrollback + term.rows;

              fitAddonRef.current.fit();

              // Restore scroll position after resize
              requestAnimationFrame(() => {
                if (term) {
                  if (wasAtBottom) {
                    term.scrollToBottom();
                  } else {
                    term.scrollToLine(scrollPosition);
                  }
                }
              });

              lastResizeTimeRef.current = Date.now();
            }
          }, 100);
          return;
        }

        // Save scroll position before resize
        const scrollPosition = term.buffer.active.viewportY;
        const baseScrollback = term.buffer.active.baseY;
        const wasAtBottom =
          scrollPosition + term.rows >= baseScrollback + term.rows;

        fitAddonRef.current.fit();

        // Restore scroll position after resize
        requestAnimationFrame(() => {
          if (term) {
            if (wasAtBottom) {
              term.scrollToBottom();
            } else {
              term.scrollToLine(scrollPosition);
            }
          }
        });

        lastResizeTimeRef.current = now;
      };

      window.addEventListener('resize', handleResize);

      // Add ResizeObserver to handle container resize (e.g., when panel is resized)
      const resizeObserver = new ResizeObserver((entries) => {
        // Only resize if the terminal is visible and has dimensions
        const entry = entries[0];
        if (
          entry &&
          entry.contentRect.width > 0 &&
          entry.contentRect.height > 0 &&
          isVisibleRef.current
        ) {
          handleResize();
        }
      });

      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }

      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        term.dispose();
        // Don't destroy the session here - it should persist
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme, shouldRenderTerminal]); // Depend on shouldRenderTerminal to create terminal when ownership is gained

    // Handle connecting to existing session
    useEffect(() => {
      if (!terminal || !sessionId || !terminalId || !fitAddonRef.current) {
        return;
      }

      // We're reconnecting to an existing session
      // Trigger a refresh to force the PTY to send its buffer content
      // This is needed when connecting to an existing session to see the current content
      const refreshAndResize = async () => {
        try {
          if (!sessionId || !terminal || !fitAddonRef.current) {
            return;
          }

          // Save scroll position before refresh
          const scrollPosition = terminal.buffer.active.viewportY;
          const baseScrollback = terminal.buffer.active.baseY;
          const wasAtBottom =
            scrollPosition + terminal.rows >= baseScrollback + terminal.rows;

          // Refresh the backend PTY to send buffer contents
          await TerminalService.refresh(sessionId);

          // Then fit the terminal UI after a short delay to ensure buffer is received
          setTimeout(() => {
            if (fitAddonRef.current && terminal) {
              fitAddonRef.current.fit();

              // Restore scroll position after resize
              requestAnimationFrame(() => {
                if (terminal) {
                  if (wasAtBottom) {
                    terminal.scrollToBottom();
                  } else {
                    terminal.scrollToLine(scrollPosition);
                  }
                }
              });
            }
          }, 100);
        } catch (err) {
          console.error(
            '[TerminalPanel] Failed to refresh terminal:',
            err,
          );
          // Still try to fit even if refresh fails
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        }
      };

      // Give time for terminal to initialize
      setTimeout(refreshAndResize, 200);
    }, [terminal, sessionId, terminalId]);

    // Focus terminal when component becomes visible
    useEffect(() => {
      if (terminal && autoFocus && isVisible) {
        // Focus the terminal when it becomes visible and autoFocus is true
        setTimeout(() => {
          terminal.focus();
          // Removed refresh - it was clearing the screen with Ctrl+L
        }, 50); // Small delay to ensure visibility
      }
    }, [terminal, autoFocus, isVisible, sessionId, terminalId]);

    // Handle visibility changes - resize terminal when it becomes visible
    useEffect(() => {
      if (terminal && fitAddonRef.current && isVisible) {
        // Trigger a resize when terminal becomes visible
        // This ensures proper dimensions after being hidden
        const resizeTerminal = () => {
          if (!fitAddonRef.current || !terminal) return;

          // Save scroll position before resize
          const scrollPosition = terminal.buffer.active.viewportY;
          const baseScrollback = terminal.buffer.active.baseY;
          const wasAtBottom =
            scrollPosition + terminal.rows >= baseScrollback + terminal.rows;

          fitAddonRef.current.fit();

          // Check if data was recently written (within last 200ms)
          // If so, delay scroll restoration to avoid conflicts
          const timeSinceLastWrite = Date.now() - lastDataWriteTimeRef.current;
          const shouldDelayRestore = timeSinceLastWrite < 200;

          const restoreScroll = () => {
            if (terminal) {
              if (wasAtBottom) {
                // If user was at bottom, stay at bottom
                terminal.scrollToBottom();
              } else {
                // Otherwise, restore previous position
                terminal.scrollToLine(scrollPosition);
              }
            }
          };

          // Restore scroll position after resize
          if (shouldDelayRestore) {
            // Data was recently written, wait longer before restoring scroll
            setTimeout(restoreScroll, 150);
          } else {
            // No recent data writes, restore immediately
            requestAnimationFrame(restoreScroll);
          }

          // Also trigger resize on the terminal to update backend
          if (terminal && sessionId) {
            const dimensions = fitAddonRef.current?.proposeDimensions();
            if (dimensions) {
              TerminalService.resize(
                sessionId,
                dimensions.cols,
                dimensions.rows,
              );
            }
          }
        };

        // Use requestAnimationFrame for better timing
        requestAnimationFrame(resizeTerminal);
      }
    }, [isVisible, terminal, sessionId]);

    // Handle terminal data
    useEffect(() => {
      if (!terminal || !sessionId) {
        return;
      }

      // Send data to backend
      const disposable = terminal.onData((data) => {
        TerminalService.write(sessionId, data);
      });

      // Listen for data from backend
      const unsubscribe = TerminalService.onData(
        async (data: { sessionId: string; data: string }) => {
          if (data.sessionId === sessionId) {
            // Track when data is written to prevent scroll position conflicts
            lastDataWriteTimeRef.current = Date.now();
            terminal.write(data.data);
          }
        },
      );

      // Listen for terminal exit
      const unsubscribeExit = TerminalService.onExit(
        async (exitData: { sessionId: string; code: number }) => {
          if (exitData.sessionId === sessionId) {
            terminal.write(
              `\r\n[Process exited with code ${exitData.code}]\r\n`,
            );
          }
        },
      );

      return () => {
        disposable.dispose();
        void unsubscribe.then((fn) => fn()).catch(() => {});
        void unsubscribeExit.then((fn) => fn()).catch(() => {});
      };
    }, [terminal, sessionId]);

    // Handle terminal resize
    useEffect(() => {
      if (!terminal || !sessionId || !fitAddonRef.current) return;

      const disposable = terminal.onResize((size) => {
        TerminalService.resize(sessionId, size.cols, size.rows);
      });

      return () => {
        disposable.dispose();
      };
    }, [terminal, sessionId]);

    // Note: We intentionally don't destroy the session on unmount
    // The session should persist when the terminal is hidden
    // Only destroy when explicitly requested by the user

    const handleDestroy = () => {
      if (sessionId) {
        const confirmed = window.confirm(
          'Are you sure you want to close this terminal session? This will terminate any running processes.',
        );
        if (confirmed) {
          void destroyTerminalSession(sessionId);
          setSessionId(null);
          if (onDestroy) {
            onDestroy();
          }
        }
      }
    };

    // Debug layout information (only in development)
    const debugLayout = process.env.NODE_ENV === 'development' && (
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          backgroundColor: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '2px 4px',
          fontSize: '10px',
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        {terminalRef.current
          ? `${terminalRef.current.clientWidth}x${terminalRef.current.clientHeight}`
          : 'No ref'}
      </div>
    );

    const handlePopOut = async () => {
      if (sessionId) {
        try {
          const result = await TerminalService.popOut(sessionId);
          console.log('Terminal popped out to window:', result?.windowId);

          // Optionally hide the terminal in the main window after popping out
          if (onClose) {
            onClose();
          }
        } catch (error) {
          console.error('Failed to pop out terminal:', error);
          // You could show a user-friendly error message here
        }
      }
    };

    const handleSwitchToOwnerWindow = async () => {
      if (ownershipStatus.ownedByWindowId) {
        try {
          await TerminalService.focusWindow(ownershipStatus.ownedByWindowId);
        } catch (error) {
          console.error('Failed to focus owner window:', error);
        }
      }
    };

    const handleTakeControl = async () => {
      if (sessionId) {
        try {
          const result = await TerminalService.claimOwnership(sessionId, true);
          if (result.success) {
            console.log(
              `[TerminalPanel] Successfully took control of session ${sessionId}`,
            );
            setOwnershipStatus({
              isOwned: false,
              ownedByWindowId: null,
              canTakeControl: true,
            });
            setShouldRenderTerminal(true);

            // Trigger a fit/resize after a short delay to force the PTY to repaint
            // This ensures the terminal buffer is sent to the new owner window
            setTimeout(() => {
              if (fitAddonRef.current && terminal) {
                const scrollPosition = terminal.buffer.active.viewportY;
                const baseScrollback = terminal.buffer.active.baseY;
                const wasAtBottom =
                  scrollPosition + terminal.rows >= baseScrollback + terminal.rows;

                fitAddonRef.current.fit();

                // Restore scroll position after resize
                requestAnimationFrame(() => {
                  if (terminal) {
                    if (wasAtBottom) {
                      terminal.scrollToBottom();
                    } else {
                      terminal.scrollToLine(scrollPosition);
                    }
                  }
                });
              }
            }, 100);
          } else {
            console.error('[TerminalPanel] Failed to take control:', result);
          }
        } catch (error) {
          console.error('[TerminalPanel] Failed to take control:', error);
        }
      }
    };

    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        {/* Terminal Header (optional) */}
        {!hideHeader && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor:
                theme.colors.backgroundSecondary || theme.colors.background,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TerminalIcon size={16} color={theme.colors.text} />
              <span
                style={{
                  fontSize: '14px',
                  color: theme.colors.text,
                  fontWeight: '500',
                }}
              >
                Terminal
              </span>
              <span
                style={{ fontSize: '12px', color: theme.colors.textSecondary }}
              >
                {directory.split('/').pop() || directory}
              </span>
              {aiSessionInfo && (
                <>
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    •
                  </span>
                  <span
                    style={{ fontSize: '12px', color: theme.colors.primary }}
                  >
                    AI:{' '}
                    {aiSessionInfo.customName ||
                      aiSessionInfo.sessionId.slice(0, 8)}
                  </span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Pop-out button */}
              {sessionId && (
                <button
                  type="button"
                  aria-label="Pop out terminal to new window"
                  onClick={handlePopOut}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                  title="Open terminal in new window"
                >
                  <ExternalLink size={16} />
                </button>
              )}

              {/* Hide button */}
              {onClose && (
                <button
                  type="button"
                  aria-label="Hide terminal"
                  onClick={onClose}
                  style={{
                    padding: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.color = theme.colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                  title="Hide terminal (keeps session running)"
                >
                  <ChevronDown size={16} />
                </button>
              )}

              {/* Close/Destroy button */}
              <button
                type="button"
                aria-label="Close terminal session"
                onClick={handleDestroy}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff4444';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
                title="Close terminal session (terminate process)"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Terminal Container */}
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: 0, // Important for flex containers
          }}
        >
          {debugLayout}
          {/* Ownership placeholder when terminal is owned by another window */}
          {ownershipStatus.isOwned && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.background,
                gap: '16px',
                padding: '32px',
              }}
            >
              <Monitor size={48} color={theme.colors.textSecondary} />
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
              >
                This terminal is active in another window
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                  maxWidth: '400px',
                }}
              >
                Window ID: {ownershipStatus.ownedByWindowId}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={handleSwitchToOwnerWindow}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: theme.colors.primary,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <ArrowRight size={16} />
                  Switch to Window
                </button>
                <button
                  type="button"
                  onClick={handleTakeControl}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Take Control Here
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;
