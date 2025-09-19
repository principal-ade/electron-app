import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  ExternalLink,
  ChevronDown,
  X,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { useTheme } from 'themed-markdown';

import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { TerminalService } from '../../main-process-api/TerminalService';

/* eslint-disable no-console */

/**
 * TerminalPanelProps
 * Strongly typed props for the embedded terminal component.
 */
interface TerminalPanelProps {
  /** Absolute working directory for the terminal session */
  directory: string;
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

function TerminalPanel({
  directory,
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
}: TerminalPanelProps) {
  const { theme } = useTheme();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [aiSessionInfo, setAiSessionInfo] = useState<{
    sessionId: string;
    customName?: string;
  } | null>(null);

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
              console.log(
                '[TerminalPanel] Destroying orphaned session:',
                orphan.id,
              );
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
          console.log(
            '[TerminalPanel] Creating terminal with command:',
            initialCommand,
          );
          const id = await TerminalService.createWithCommand(
            dir,
            initialCommand,
          );
          return id || null;
        }
        // For agent sessions without command, always create new
        else if (agentSessionId) {
          // Agent sessions should have their own terminal
          const id = await TerminalService.create(dir);
          return id || null;
        } else {
          // Regular terminals can reuse existing sessions for the same directory
          const id = await TerminalService.getOrCreate(dir);
          return id || null;
        }
      } catch (error) {
        console.error('Failed to create terminal session:', error);
        return null;
      }
    },
    [initialCommand, agentSessionId],
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

  // Create terminal session if needed or use provided one
  useEffect(() => {
    console.log(
      '[TerminalPanel] Session effect - terminalId:',
      terminalId,
      'sessionId:',
      sessionId,
      'directory:',
      directory,
    );

    if (terminalId) {
      // Use provided terminal ID
      console.log('[TerminalPanel] Using provided terminal ID:', terminalId);
      setSessionId(terminalId);
      return;
    }

    if (sessionId) {
      console.log('[TerminalPanel] Already have session:', sessionId);
      return; // Already have a session
    }

    let isMounted = true;
    console.log(
      '[TerminalPanel] Creating new terminal session for directory:',
      directory,
    );

    createTerminalSession(directory).then((id) => {
      if (id && isMounted) {
        console.log('[TerminalPanel] Created session:', id);
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

  // Initialize terminal UI - only once per component mount
  useEffect(() => {
    if (!terminalRef.current) {
      console.log('[TerminalPanel] Skipping terminal init - no ref');
      return;
    }

    // Check if we already have a terminal instance
    if (terminal) {
      console.log('[TerminalPanel] Terminal already initialized');
      return;
    }

    console.log('[TerminalPanel] Creating xterm.js Terminal instance');

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
    });

    // Add addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Open terminal in the DOM
    term.open(terminalRef.current);

    // Fit terminal to container
    fitAddon.fit();

    setTerminal(term);

    // Focus terminal if autoFocus is enabled
    if (autoFocus) {
      setTimeout(() => {
        term.focus();
      }, 100); // Small delay to ensure terminal is fully rendered
    }

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      // Don't destroy the session here - it should persist
    };
  }, [theme]); // Only depend on theme, not sessionId

  // Handle connecting to existing session
  useEffect(() => {
    if (terminal && sessionId && terminalId) {
      // We're reconnecting to an existing session
      console.log('[TerminalPanel] Connected to existing session:', sessionId);
      // Removed refresh - it was clearing the screen with Ctrl+L
    }
  }, [terminal, sessionId, terminalId]);

  // Focus terminal when component becomes visible
  useEffect(() => {
    if (terminal && autoFocus && isVisible) {
      // Focus the terminal when it becomes visible and autoFocus is true
      console.log('[TerminalPanel] Focusing terminal for session:', sessionId);
      setTimeout(() => {
        terminal.focus();
        // Removed refresh - it was clearing the screen with Ctrl+L
      }, 50); // Small delay to ensure visibility
    }
  }, [terminal, autoFocus, isVisible, sessionId, terminalId]);

  // Handle visibility changes - resize terminal when it becomes visible
  useEffect(() => {
    console.log(
      '[TerminalPanel] Visibility changed:',
      isVisible,
      'Session:',
      sessionId,
      'Has terminal:',
      !!terminal,
    );
    if (terminal && fitAddonRef.current && isVisible) {
      // Trigger a resize when terminal becomes visible
      // This ensures proper dimensions after being hidden
      setTimeout(() => {
        console.log(
          '[TerminalPanel] Resizing terminal for session:',
          sessionId,
        );
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
        // Also trigger resize on the terminal to update backend
        if (terminal && sessionId) {
          const dimensions = fitAddonRef.current?.proposeDimensions();
          if (dimensions) {
            console.log(
              '[TerminalPanel] Resizing to:',
              dimensions.cols,
              'x',
              dimensions.rows,
            );
            TerminalService.resize(sessionId, dimensions.cols, dimensions.rows);
          }
        }
      }, 100); // Small delay to ensure DOM has updated
    }
  }, [isVisible, terminal, sessionId]);

  // Handle terminal data
  useEffect(() => {
    if (!terminal || !sessionId) return;

    // Send data to backend
    const disposable = terminal.onData((data) => {
      TerminalService.write(sessionId, data);
    });

    // Listen for data from backend
    const unsubscribe = TerminalService.onData(
      async (data: { sessionId: string; data: string }) => {
        if (data.sessionId === sessionId) {
          terminal.write(data.data);
        }
      },
    );

    // Listen for terminal exit
    const unsubscribeExit = TerminalService.onExit(
      async (exitData: { sessionId: string; code: number }) => {
        if (exitData.sessionId === sessionId) {
          terminal.write(`\r\n[Process exited with code ${exitData.code}]\r\n`);
        }
      },
    );

    return () => {
      disposable.dispose();
      void unsubscribe.then((fn) => fn()).catch(() => {});
      void unsubscribeExit.then((fn) => fn()).catch(() => {});
    };
  }, [terminal, sessionId, isVisible]);

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

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
        borderTop: `1px solid ${theme.colors.border}`,
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
                <span style={{ fontSize: '12px', color: theme.colors.primary }}>
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
          padding: '8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

TerminalPanel.defaultProps = {
  onClose: undefined,
  onDestroy: undefined,
  className: '',
};

export default TerminalPanel;
