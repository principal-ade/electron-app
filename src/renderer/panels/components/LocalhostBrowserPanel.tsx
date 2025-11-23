import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Home,
  ExternalLink,
  PlayCircle,
} from 'lucide-react';
import { ShellService } from '../../main-process-api/ShellService';

interface LocalhostBrowserPanelProps {
  port?: number;
  path?: string;
}

// Electron webview element interface
interface WebviewElement extends HTMLElement {
  src: string;
  loadURL: (url: string) => void;
  getURL: () => string;
  reload: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  addEventListener: (
    event: string,
    listener: (event: Event) => void,
  ) => void;
  removeEventListener: (
    event: string,
    listener: (event: Event) => void,
  ) => void;
}

/**
 * LocalhostBrowserPanel - Displays a localhost URL in an embedded webview
 *
 * @param port - The localhost port number (optional - will prompt if not provided)
 * @param path - Optional path to append to the URL (default: '/')
 */
export const LocalhostBrowserPanel: React.FC<LocalhostBrowserPanelProps> = ({
  port: initialPort,
  path: initialPath = '/',
}) => {
  const { theme } = useTheme();
  const webviewRef = useRef<WebviewElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // State for port/path input
  const [port, setPort] = useState<number | null>(initialPort ?? null);
  const [path, setPath] = useState(initialPath);
  const [portInput, setPortInput] = useState(initialPort?.toString() ?? '3000');
  const [pathInput, setPathInput] = useState(initialPath);

  const localhostUrl = port ? `http://localhost:${port}${path}` : '';

  // Log when URL changes
  useEffect(() => {
    if (port && localhostUrl) {
      console.log('[LocalhostBrowser] URL updated:', localhostUrl);
    }
  }, [port, path, localhostUrl]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidStartLoading = () => {
      console.log('[LocalhostBrowser] Started loading:', localhostUrl);
      setIsLoading(true);
    };

    const handleDidStopLoading = () => {
      const url = webview.getURL();
      console.log('[LocalhostBrowser] Successfully loaded:', url);
      setIsLoading(false);
      setCurrentUrl(url);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    const handleDidNavigate = () => {
      const url = webview.getURL();
      console.log('[LocalhostBrowser] Navigated to:', url);
      setCurrentUrl(url);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    const handleDidFailLoad = (event: any) => {
      console.error('[LocalhostBrowser] Failed to load:', {
        url: localhostUrl,
        errorCode: event.errorCode,
        errorDescription: event.errorDescription,
        validatedURL: event.validatedURL,
        isMainFrame: event.isMainFrame,
      });
      setIsLoading(false);
    };

    // Capture console messages from inside the webview
    const handleConsoleMessage = (event: any) => {
      const prefix = '[LocalhostBrowser:Webview]';
      const level = event.level || 0; // 0=log, 1=warn, 2=error
      const message = event.message || '';

      if (level === 2) {
        console.error(`${prefix} [ERROR]`, message, event);
      } else if (level === 1) {
        console.warn(`${prefix} [WARN]`, message, event);
      } else {
        console.log(`${prefix}`, message);
      }
    };

    // Catch any crashes
    const handleCrashed = (event: any) => {
      console.error('[LocalhostBrowser] Webview CRASHED:', event);
    };

    // Catch unresponsive
    const handleUnresponsive = (event: any) => {
      console.warn('[LocalhostBrowser] Webview became unresponsive:', event);
    };

    const handleResponsive = (event: any) => {
      console.log('[LocalhostBrowser] Webview became responsive again:', event);
    };

    // Catch plugin crashes
    const handlePluginCrashed = (event: any) => {
      console.error('[LocalhostBrowser] Plugin crashed:', event);
    };

    // Catch destroyed
    const handleDestroyed = (event: any) => {
      console.warn('[LocalhostBrowser] Webview destroyed:', event);
    };

    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('did-fail-load', handleDidFailLoad);
    webview.addEventListener('console-message', handleConsoleMessage);
    webview.addEventListener('crashed', handleCrashed);
    webview.addEventListener('unresponsive', handleUnresponsive);
    webview.addEventListener('responsive', handleResponsive);
    webview.addEventListener('plugin-crashed', handlePluginCrashed);
    webview.addEventListener('destroyed', handleDestroyed);

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
      webview.removeEventListener('console-message', handleConsoleMessage);
      webview.removeEventListener('crashed', handleCrashed);
      webview.removeEventListener('unresponsive', handleUnresponsive);
      webview.removeEventListener('responsive', handleResponsive);
      webview.removeEventListener('plugin-crashed', handlePluginCrashed);
      webview.removeEventListener('destroyed', handleDestroyed);
    };
  }, []);

  const handleReload = () => {
    webviewRef.current?.reload();
  };

  const handleGoBack = () => {
    if (webviewRef.current?.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current?.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const handleGoHome = () => {
    webviewRef.current?.loadURL(localhostUrl);
  };

  const handleOpenExternal = async () => {
    await ShellService.openExternal(currentUrl || localhostUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPort = parseInt(portInput, 10);
    if (parsedPort > 0 && parsedPort <= 65535) {
      const url = `http://localhost:${parsedPort}${pathInput}`;
      console.log('[LocalhostBrowser] Setting port and path:', {
        port: parsedPort,
        path: pathInput,
        url,
      });
      setPort(parsedPort);
      setPath(pathInput);
    } else {
      console.warn('[LocalhostBrowser] Invalid port number:', portInput);
    }
  };

  const handleReset = () => {
    setPort(null);
    setPortInput('3000');
    setPathInput('/');
  };

  // Show port input form if no port is set
  if (!port) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          backgroundColor: theme.colors.background,
          padding: '32px',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            padding: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <PlayCircle size={32} color={theme.colors.primary} />
            <h2
              style={{
                fontSize: theme.fontSizes[4],
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Localhost Browser
            </h2>
          </div>

          <p
            style={{
              fontSize: theme.fontSizes[2],
              color: theme.colors.textSecondary,
              marginBottom: '24px',
              lineHeight: '1.5',
            }}
          >
            Enter a localhost port to view your development server in an
            embedded browser.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Port Number
              </label>
              <input
                type="number"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                placeholder="3000"
                min="1"
                max="65535"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: theme.fontSizes[2],
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.monospace,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.colors.primary;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = theme.colors.border;
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Path (optional)
              </label>
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="/"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: theme.fontSizes[2],
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.monospace,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.colors.primary;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = theme.colors.border;
                }}
              />
            </div>

            <div
              style={{
                padding: '12px',
                backgroundColor: theme.colors.background,
                borderRadius: '6px',
                marginBottom: '24px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textTertiary,
                  marginBottom: '4px',
                }}
              >
                Preview URL:
              </div>
              <div
                style={{
                  fontSize: theme.fontSizes[2],
                  color: theme.colors.text,
                  fontFamily: theme.fonts.monospace,
                  wordBreak: 'break-all',
                }}
              >
                http://localhost:{portInput || '3000'}
                {pathInput}
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <PlayCircle size={20} />
              Load Localhost Server
            </button>
          </form>

          <div
            style={{
              marginTop: '16px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.textTertiary,
              textAlign: 'center',
            }}
          >
            Common ports: 3000 (React), 8080 (Webpack), 6006 (Storybook)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Navigation buttons */}
        <button
          onClick={handleGoBack}
          disabled={!canGoBack}
          style={{
            padding: '6px',
            backgroundColor: canGoBack
              ? theme.colors.background
              : theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: canGoBack ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            color: canGoBack ? theme.colors.text : theme.colors.textTertiary,
          }}
          title="Go back"
        >
          <ArrowLeft size={16} />
        </button>

        <button
          onClick={handleGoForward}
          disabled={!canGoForward}
          style={{
            padding: '6px',
            backgroundColor: canGoForward
              ? theme.colors.background
              : theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: canGoForward ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            color: canGoForward
              ? theme.colors.text
              : theme.colors.textTertiary,
          }}
          title="Go forward"
        >
          <ArrowRight size={16} />
        </button>

        <button
          onClick={handleReload}
          style={{
            padding: '6px',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: theme.colors.text,
          }}
          title="Reload"
        >
          <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
        </button>

        <button
          onClick={handleGoHome}
          style={{
            padding: '6px',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: theme.colors.text,
          }}
          title="Go to home"
        >
          <Home size={16} />
        </button>

        {/* URL display */}
        <div
          style={{
            flex: 1,
            padding: '6px 12px',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentUrl || localhostUrl}
        </div>

        {/* Open in external browser */}
        <button
          onClick={handleOpenExternal}
          style={{
            padding: '6px',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: theme.colors.text,
          }}
          title="Open in external browser"
        >
          <ExternalLink size={16} />
        </button>

        {/* Change port button */}
        <button
          onClick={handleReset}
          style={{
            padding: '6px 12px',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: theme.colors.text,
            fontSize: theme.fontSizes[1],
            fontWeight: 500,
          }}
          title="Change port"
        >
          Change Port
        </button>
      </div>

      {/* Webview container */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <webview
          ref={webviewRef}
          src={localhostUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          // @ts-ignore - webview attributes not in types
          allowpopups
          useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export const LocalhostBrowserPanelPreview: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <ExternalLink size={14} />
        <span style={{ fontWeight: 500 }}>Localhost Browser</span>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
        }}
      >
        http://localhost:3000
      </div>
    </div>
  );
};
