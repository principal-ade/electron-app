import { BrowserWindow, app } from 'electron';
import {
  RemoteAgentConfig,
  RemoteAgentWindow,
  RemoteAgentWindowOptions,
  RemoteAgentWindowState,
} from '../../shared/types/remoteAgent.types';
import { sendToAllWindows } from './modernWindowManager';

export const REMOTE_AGENT_WINDOW_CONFIG = {
  maxConcurrentWindows: 10,
  defaultWidth: 1200,
  defaultHeight: 800,
  minWidth: 600,
  minHeight: 400,
  allowedDomains: [
    'https://jules.google.com',
    'https://chatgpt.com',
    'https://auth.openai.com',
    'https://github.com',
    'https://remote-agent.example.com',
    'https://cloud-agent.service.com',
  ],
};

export class RemoteAgentWindowManager {
  private remoteAgentWindows: Map<string, RemoteAgentWindow> = new Map();

  constructor() {
    // No dependencies needed
  }

  /**
   * Open a remote agent in a new window
   */
  async openRemoteAgent(
    config: RemoteAgentConfig,
    options?: RemoteAgentWindowOptions
  ): Promise<string> {
    // Check if window already exists
    const existingWindow = this.remoteAgentWindows.get(config.id);
    if (existingWindow && !existingWindow.window.isDestroyed()) {
      existingWindow.window.focus();
      existingWindow.lastActiveAt = new Date();
      return config.id;
    }

    // Check concurrent window limit
    if (this.remoteAgentWindows.size >= REMOTE_AGENT_WINDOW_CONFIG.maxConcurrentWindows) {
      throw new Error(
        `Maximum number of remote agent windows (${REMOTE_AGENT_WINDOW_CONFIG.maxConcurrentWindows}) reached`
      );
    }

    // Validate URL
    this.validateUrl(config.url);

    // Create the window
    const window = this.createRemoteAgentWindow(config, options);

    // Create remote agent window object
    const remoteAgentWindow: RemoteAgentWindow = {
      id: config.id,
      windowId: window.id,
      window,
      config,
      state: RemoteAgentWindowState.LOADING,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Track the window
    this.remoteAgentWindows.set(config.id, remoteAgentWindow);

    // Setup event handlers
    this.setupWindowHandlers(remoteAgentWindow);

    // Load the URL
    try {
      await window.loadURL(config.url);
      this.updateRemoteAgentState(config.id, RemoteAgentWindowState.READY);
    } catch (error) {
      console.error(`Failed to load remote agent URL: ${config.url}`, error);
      this.updateRemoteAgentState(config.id, RemoteAgentWindowState.ERROR);
      throw error;
    }

    return config.id;
  }

  /**
   * Close a remote agent window
   */
  async closeRemoteAgent(agentId: string): Promise<void> {
    const remoteAgentWindow = this.remoteAgentWindows.get(agentId);
    if (!remoteAgentWindow) {
      return;
    }

    if (!remoteAgentWindow.window.isDestroyed()) {
      remoteAgentWindow.window.close();
    }

    this.remoteAgentWindows.delete(agentId);
  }

  /**
   * Close all remote agent windows
   */
  async closeAllRemoteAgents(): Promise<void> {
    const closePromises = Array.from(this.remoteAgentWindows.keys()).map((agentId) =>
      this.closeRemoteAgent(agentId)
    );
    await Promise.all(closePromises);
  }

  /**
   * Focus a remote agent window
   */
  focusRemoteAgent(agentId: string): void {
    const remoteAgentWindow = this.remoteAgentWindows.get(agentId);
    if (remoteAgentWindow && !remoteAgentWindow.window.isDestroyed()) {
      remoteAgentWindow.window.focus();
      remoteAgentWindow.lastActiveAt = new Date();
    }
  }

  /**
   * Get a remote agent window
   */
  getRemoteAgent(agentId: string): RemoteAgentWindow | undefined {
    return this.remoteAgentWindows.get(agentId);
  }

  /**
   * List all remote agents
   */
  listRemoteAgents(): RemoteAgentConfig[] {
    return Array.from(this.remoteAgentWindows.values()).map((window) => window.config);
  }

  /**
   * Get the state of a remote agent
   */
  getRemoteAgentState(agentId: string): RemoteAgentWindowState | undefined {
    const remoteAgentWindow = this.remoteAgentWindows.get(agentId);
    return remoteAgentWindow?.state;
  }

  /**
   * Update remote agent state
   */
  updateRemoteAgentState(agentId: string, state: RemoteAgentWindowState): void {
    const remoteAgentWindow = this.remoteAgentWindows.get(agentId);
    if (remoteAgentWindow) {
      remoteAgentWindow.state = state;
      // Emit state change event to all windows
      sendToAllWindows('remote-agent:state-changed', {
        agentId,
        state,
      });
    }
  }

  /**
   * Send a message to a remote agent
   */
  sendMessage(agentId: string, message: any): void {
    const remoteAgentWindow = this.remoteAgentWindows.get(agentId);
    if (remoteAgentWindow && !remoteAgentWindow.window.isDestroyed()) {
      remoteAgentWindow.window.webContents.send('remote-agent:message-from-host', message);
    }
  }

  /**
   * Handle message from remote agent
   */
  handleRemoteAgentMessage(agentId: string, message: any): void {
    // Emit message to all windows
    sendToAllWindows('remote-agent:message', {
      agentId,
      message,
    });
  }

  /**
   * Create a BrowserWindow for the remote agent
   */
  private createRemoteAgentWindow(
    config: RemoteAgentConfig,
    options?: RemoteAgentWindowOptions
  ): BrowserWindow {
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: options?.width ?? REMOTE_AGENT_WINDOW_CONFIG.defaultWidth,
      height: options?.height ?? REMOTE_AGENT_WINDOW_CONFIG.defaultHeight,
      minWidth: REMOTE_AGENT_WINDOW_CONFIG.minWidth,
      minHeight: REMOTE_AGENT_WINDOW_CONFIG.minHeight,
      alwaysOnTop: options?.alwaysOnTop ?? false,
      resizable: options?.resizable ?? true,
      title: config.name,
      webPreferences: {
        // For remote agent windows (like Jules), we need less restrictive settings
        // to allow the site to function properly as if it's a standalone browser
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false, // Disabled to allow Google sites to load properly
        allowRunningInsecureContent: false,
        // Set a standard Chrome user agent to avoid detection
        // This helps bypass some restrictions Google places on embedded views
      },
    };

    if (options?.position) {
      windowOptions.x = options.position.x;
      windowOptions.y = options.position.y;
    }

    if (options?.parentWindow) {
      windowOptions.parent = options.parentWindow;
    }

    const window = new BrowserWindow(windowOptions);

    // Set a standard browser user agent
    const userAgent = window.webContents.getUserAgent().replace(/Electron\/[^\s]+/, '').trim();
    window.webContents.setUserAgent(userAgent);

    // Disable CSP for remote agent windows to allow Google sites to load properly
    window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      // Remove CSP headers that would block Google's scripts, fonts, etc.
      if (details.responseHeaders) {
        delete details.responseHeaders['content-security-policy'];
        delete details.responseHeaders['content-security-policy-report-only'];
        delete details.responseHeaders['x-frame-options'];
      }
      callback({ responseHeaders: details.responseHeaders });
    });

    // Apply security policy
    this.applySecurityPolicy(window, config);

    return window;
  }

  /**
   * Setup event handlers for a remote agent window
   */
  private setupWindowHandlers(remoteAgentWindow: RemoteAgentWindow): void {
    const { window, id } = remoteAgentWindow;

    // Window closed
    window.on('closed', () => {
      this.remoteAgentWindows.delete(id);
    });

    // Window focused
    window.on('focus', () => {
      remoteAgentWindow.lastActiveAt = new Date();
    });

    // Page loaded
    window.webContents.on('did-finish-load', () => {
      this.updateRemoteAgentState(id, RemoteAgentWindowState.READY);
    });

    // Page failed to load
    window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Remote agent failed to load: ${errorDescription} (${errorCode})`);
      this.updateRemoteAgentState(id, RemoteAgentWindowState.ERROR);
    });

    // Handle messages from remote agent
    window.webContents.on('ipc-message', (event, channel, ...args) => {
      if (channel === 'remote-agent:message-to-host') {
        this.handleRemoteAgentMessage(id, args[0]);
      }
    });
  }

  /**
   * Apply security policy to window
   */
  private applySecurityPolicy(window: BrowserWindow, config: RemoteAgentConfig): void {
    // For remote agent windows, we allow more flexibility to support OAuth flows
    // and other authentication mechanisms

    // Allow navigation within the same domain and to auth providers
    window.webContents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);
      const allowedAuthDomains = [
        'accounts.google.com',
        'accounts.youtube.com',
        'myaccount.google.com',
      ];

      // Allow navigation to the main domain or auth domains
      const isAllowed = this.isUrlAllowed(url) ||
        allowedAuthDomains.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));

      if (!isAllowed) {
        event.preventDefault();
        console.warn(`Blocked navigation to untrusted URL: ${url}`);
      }
    });

    // Allow new windows to open in external browser (for OAuth, etc.)
    window.webContents.setWindowOpenHandler(({ url }) => {
      const parsedUrl = new URL(url);
      const allowedAuthDomains = [
        'accounts.google.com',
        'accounts.youtube.com',
        'myaccount.google.com',
      ];

      // Allow auth domains to open in the same window
      const isAuthDomain = allowedAuthDomains.some(
        domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
      );

      if (isAuthDomain) {
        // Load in the current window instead of blocking
        window.webContents.loadURL(url);
        return { action: 'deny' };
      }

      // For other URLs, open in external browser
      import('electron').then(({ shell }) => {
        shell.openExternal(url);
      });
      return { action: 'deny' };
    });

    // Allow more permissions for remote agent functionality
    window.webContents.session.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        const allowedPermissions = [
          'notifications',
          'clipboard-read',
          'clipboard-sanitized-write',
        ];

        if (allowedPermissions.includes(permission)) {
          callback(true);
        } else {
          callback(false);
        }
      }
    );
  }

  /**
   * Validate URL before loading
   */
  private validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);

      // Enforce HTTPS
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed for remote agents');
      }

      // Check against whitelist
      if (!this.isUrlAllowed(url)) {
        throw new Error(`URL not in allowed domains: ${url}`);
      }
    } catch (error) {
      throw new Error(`Invalid remote agent URL: ${url}`);
    }
  }

  /**
   * Check if URL is allowed
   */
  private isUrlAllowed(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return REMOTE_AGENT_WINDOW_CONFIG.allowedDomains.some((domain) => {
        const parsedDomain = new URL(domain);
        return parsedUrl.hostname === parsedDomain.hostname;
      });
    } catch {
      return false;
    }
  }
}