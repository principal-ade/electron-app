import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Terminal as TerminalIcon,
  ExternalLink,
  ChevronDown,
  X,
  Monitor,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import './XTerminalPanel.css';

import { useTheme } from '@a24z/industry-theme';

import type {
  XTerminalPanelProps,
  XTerminalPanelRef,
} from './types';
import type { ISearchOptions } from '@xterm/addon-search';

/**
 * XTerminalPanel - Pure UI component for rendering an xterm.js terminal
 *
 * This component is decoupled from IPC/services and can be tested in Storybook.
 * All business logic (session management, ownership, etc.) should be handled by parent components.
 *
 * @example
 * ```tsx
 * const terminalRef = useRef<XTerminalPanelRef>(null);
 *
 * <XTerminalPanel
 *   ref={terminalRef}
 *   headerTitle="Terminal"
 *   headerSubtitle="/home/user/project"
 *   onData={(data) => sendToBackend(data)}
 *   onResize={(cols, rows) => resizeBackend(cols, rows)}
 *   onLinkClick={(url) => handleLink(url)}
 * />
 * ```
 */
const XTerminalPanel = forwardRef<XTerminalPanelRef, XTerminalPanelProps>(
  (
    {
      onData,
      onResize,
      onLinkClick,
      className = '',
      hideHeader = false,
      headerTitle = 'Terminal',
      headerSubtitle,
      headerBadge,
      autoFocus = true,
      isVisible = true,
      scrollbarStyle = 'overlay',
      onClose,
      onDestroy,
      onPopOut,
      overlayState,
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const terminalRef = useRef<HTMLDivElement>(null);
    const [terminal, setTerminal] = useState<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const webglAddonRef = useRef<WebglAddon | null>(null);
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isVisibleRef = useRef(isVisible);

    // Keep isVisible ref in sync
    useEffect(() => {
      isVisibleRef.current = isVisible;
    }, [isVisible]);

    // Expose public methods via ref
    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => {
          if (terminal) {
            terminal.write(data);
          }
        },
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
        clear: () => {
          if (terminal) {
            terminal.clear();
          }
        },
        getTerminal: () => terminal,
        findNext: (searchTerm: string, searchOptions?: ISearchOptions) => {
          if (searchAddonRef.current) {
            return searchAddonRef.current.findNext(searchTerm, searchOptions);
          }
          return false;
        },
        findPrevious: (searchTerm: string, searchOptions?: ISearchOptions) => {
          if (searchAddonRef.current) {
            return searchAddonRef.current.findPrevious(searchTerm, searchOptions);
          }
          return false;
        },
        clearSearch: () => {
          if (searchAddonRef.current) {
            searchAddonRef.current.clearDecorations();
          }
        },
        fit: () => {
          if (fitAddonRef.current && terminalRef.current && terminal) {
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              fitAddonRef.current.fit();
            }
          }
        },
      }),
      [terminal],
    );

    // Initialize terminal UI
    useEffect(() => {
      if (!terminalRef.current || terminal) {
        return;
      }

      // Create terminal instance
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
        // Remove default padding to maximize space
        padding: 0,
        // Ensure terminal fills container properly
        allowProposedApi: true,
        // Force specific line height for consistent rendering
        lineHeight: 1.0,
        // Minimize letter spacing to reduce gaps
        letterSpacing: 0,
        // Allow the terminal to be slightly wider to reduce right padding
        rightClickSelectsWord: true,
        // Smooth scrolling
        smoothScrollDuration: 0,
        // Draw bold text in bright colors
        drawBoldTextInBrightColors: true,
        // Windows mode can help with character width calculations
        windowsMode: false,
        // Set specific character width/height ratios for better fitting
        fontWeight: 'normal',
        fontWeightBold: 'bold',
      });

      // Add FitAddon
      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);

      // Add SearchAddon
      const searchAddon = new SearchAddon();
      searchAddonRef.current = searchAddon;
      term.loadAddon(searchAddon);

      // Add Unicode11Addon for better Unicode/emoji support
      const unicode11Addon = new Unicode11Addon();
      term.loadAddon(unicode11Addon);
      // Activate Unicode 11 support
      term.unicode.activeVersion = '11';

      // Add WebLinksAddon with custom handler
      const webLinksAddon = new WebLinksAddon((event, uri) => {
        event.preventDefault();

        if (onLinkClick) {
          const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(
            uri,
          );
          onLinkClick(uri, isLocalhost);
        }
      });
      term.loadAddon(webLinksAddon);

      // Open terminal in the DOM
      term.open(terminalRef.current);

      // Try to use WebGL renderer for better performance
      // Note: WebGL addon must be loaded AFTER terminal is opened
      try {
        const webglAddon = new WebglAddon();
        webglAddonRef.current = webglAddon;

        // Check if WebGL is supported before loading
        webglAddon.onContextLoss(() => {
          // If WebGL context is lost, dispose the addon
          webglAddon.dispose();
          webglAddonRef.current = null;
          console.warn('[XTerminal] WebGL context lost, falling back to canvas renderer');
        });

        term.loadAddon(webglAddon);
      } catch (e) {
        console.warn('[XTerminal] WebGL renderer not supported, using canvas renderer', e);
        webglAddonRef.current = null;
      }

      setTerminal(term);

      // Simple fit function using only FitAddon
      const performFit = () => {
        if (!fitAddonRef.current || !terminalRef.current || !term) return;

        const rect = terminalRef.current.getBoundingClientRect();

        // Only fit if container has valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          fitAddonRef.current.fit();
        }
      };

      // Initial fit after terminal is ready
      requestAnimationFrame(() => {
        performFit();
      });

      // Handle resize with debouncing
      const handleResize = () => {
        if (!fitAddonRef.current || !isVisibleRef.current || !term) return;

        // Clear any pending resize timeout
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }

        // Debounce resize operations
        resizeTimeoutRef.current = setTimeout(() => {
          performFit();
        }, 100);
      };

      window.addEventListener('resize', handleResize);

      // ResizeObserver for container resize
      const resizeObserver = new ResizeObserver((entries) => {
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
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme, onLinkClick]);

    // Handle terminal data input (user typing)
    useEffect(() => {
      if (!terminal || !onData) {
        return;
      }

      const disposable = terminal.onData((data) => {
        onData(data);
      });

      return () => {
        disposable.dispose();
      };
    }, [terminal, onData]);

    // Handle terminal resize events
    useEffect(() => {
      if (!terminal || !onResize) return;

      const disposable = terminal.onResize((size) => {
        onResize(size.cols, size.rows);
      });

      return () => {
        disposable.dispose();
      };
    }, [terminal, onResize]);

    // Focus terminal when it becomes visible
    useEffect(() => {
      if (terminal && autoFocus && isVisible) {
        setTimeout(() => {
          terminal.focus();
        }, 50);
      }
    }, [terminal, autoFocus, isVisible]);

    // Handle visibility changes - resize when becoming visible
    useEffect(() => {
      if (terminal && fitAddonRef.current && isVisible) {
        // Give the layout a moment to settle, then fit
        setTimeout(() => {
          if (fitAddonRef.current && terminalRef.current) {
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              fitAddonRef.current.fit();
            }
          }
        }, 50);
      }
    }, [isVisible, terminal]);

    const handleDestroy = () => {
      if (onDestroy) {
        const confirmed = window.confirm(
          'Are you sure you want to close this terminal session? This will terminate any running processes.',
        );
        if (confirmed) {
          onDestroy();
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
          width: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        {/* Terminal Header */}
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
                {headerTitle}
              </span>
              {headerSubtitle && (
                <span
                  style={{ fontSize: '12px', color: theme.colors.textSecondary }}
                >
                  {headerSubtitle}
                </span>
              )}
              {headerBadge && (
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
                    style={{
                      fontSize: '12px',
                      color: headerBadge.color || theme.colors.primary,
                    }}
                  >
                    {headerBadge.label}
                  </span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Pop-out button */}
              {onPopOut && (
                <button
                  type="button"
                  aria-label="Pop out terminal to new window"
                  onClick={onPopOut}
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
              {onDestroy && (
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
              )}
            </div>
          </div>
        )}

        {/* Terminal Container */}
        <div
          ref={terminalRef}
          className={`terminal-container-fix ${
            scrollbarStyle === 'hidden' ? 'hide-scrollbar' :
            scrollbarStyle === 'thin' ? 'thin-scrollbar' :
            scrollbarStyle === 'auto-hide' ? 'auto-hide-scrollbar' : ''
          }`}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: 0,
          }}
        >
          {/* Overlay for messages (ownership, loading, etc.) */}
          {overlayState && (
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
                zIndex: 10,
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
                {overlayState.message}
              </div>
              {overlayState.subtitle && (
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    textAlign: 'center',
                    maxWidth: '400px',
                  }}
                >
                  {overlayState.subtitle}
                </div>
              )}
              {overlayState.actions && overlayState.actions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: '8px',
                  }}
                >
                  {overlayState.actions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: action.primary
                          ? theme.colors.primary
                          : 'transparent',
                        color: action.primary ? '#ffffff' : theme.colors.text,
                        border: action.primary
                          ? 'none'
                          : `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (action.primary) {
                          e.currentTarget.style.opacity = '0.8';
                        } else {
                          e.currentTarget.style.backgroundColor =
                            theme.colors.backgroundSecondary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (action.primary) {
                          e.currentTarget.style.opacity = '1';
                        } else {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

XTerminalPanel.displayName = 'XTerminalPanel';

export default XTerminalPanel;
