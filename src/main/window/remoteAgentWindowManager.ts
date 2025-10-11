import { BrowserWindow, BrowserView, app, screen } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  RemoteAgentConfig,
  RemoteAgentWindow,
  RemoteAgentWindowOptions,
  RemoteAgentWindowState,
} from '../../shared/types/remoteAgent.types';
import { sendToAllWindows } from './modernWindowManager';

export const REMOTE_AGENT_WINDOW_CONFIG = {
  maxConcurrentAgents: 10,
  defaultWidth: 1200,
  defaultHeight: 800,
  minWidth: 600,
  minHeight: 400,
  titlebarHeight: 40,
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
  private hostWindow: BrowserWindow | null = null;
  private remoteAgents: Map<string, RemoteAgentWindow> = new Map();
  private activeAgentId: string | null = null;

  constructor() {
    // No dependencies needed
  }

  /**
   * Open a remote agent in the shared window
   */
  async openRemoteAgent(
    config: RemoteAgentConfig,
    options?: RemoteAgentWindowOptions,
  ): Promise<string> {
    // Check if agent already exists
    const existingAgent = this.remoteAgents.get(config.id);
    if (existingAgent) {
      this.switchToAgent(config.id);
      if (this.hostWindow && !this.hostWindow.isDestroyed()) {
        this.hostWindow.focus();
      }
      existingAgent.lastActiveAt = new Date();
      return config.id;
    }

    // Check concurrent agent limit
    if (
      this.remoteAgents.size >= REMOTE_AGENT_WINDOW_CONFIG.maxConcurrentAgents
    ) {
      throw new Error(
        `Maximum number of remote agents (${REMOTE_AGENT_WINDOW_CONFIG.maxConcurrentAgents}) reached`,
      );
    }

    // Validate URL
    this.validateUrl(config.url);

    // Create host window if it doesn't exist
    if (!this.hostWindow || this.hostWindow.isDestroyed()) {
      this.hostWindow = this.createHostWindow(options);
      this.setupHostWindowHandlers();
    }

    // Create a BrowserView for this agent
    const view = new BrowserView({
      webPreferences: {
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        allowRunningInsecureContent: false,
      },
    });

    // Add the view to the window
    this.hostWindow.addBrowserView(view);

    // Use the view's webContents for all operations
    const webContents = view.webContents;

    // Set a standard browser user agent
    const userAgent = webContents
      .getUserAgent()
      .replace(/Electron\/[^\s]+/, '')
      .trim();
    webContents.setUserAgent(userAgent);

    // Disable CSP/XFO to allow target sites to function
    this.configureResponseHeaderRelaxation(webContents);

    // Apply navigation/permissions policy
    this.applySecurityPolicy(webContents, config);

    // Create remote agent object
    const remoteAgentWindow: RemoteAgentWindow = {
      id: config.id,
      windowId: this.hostWindow.id,
      window: this.hostWindow,
      view,
      webContents,
      config,
      state: RemoteAgentWindowState.LOADING,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Track the agent
    this.remoteAgents.set(config.id, remoteAgentWindow);

    // Setup event handlers for this agent
    this.setupAgentHandlers(remoteAgentWindow);

    // Load the URL
    try {
      await webContents.loadURL(config.url);
      this.updateRemoteAgentState(config.id, RemoteAgentWindowState.READY);
    } catch (error) {
      console.error(`Failed to load remote agent URL: ${config.url}`, error);
      this.updateRemoteAgentState(config.id, RemoteAgentWindowState.ERROR);
      throw error;
    }

    // Switch to this agent
    this.switchToAgent(config.id);

    // Focus the host window
    if (this.hostWindow && !this.hostWindow.isDestroyed()) {
      this.hostWindow.focus();
    }

    // Notify that agent list changed
    this.notifyAgentListChanged();

    console.log('[RemoteAgent] BrowserView loaded for', config.name);

    return config.id;
  }

  /**
   * Switch to a different remote agent
   */
  switchToAgent(agentId: string): void {
    const agent = this.remoteAgents.get(agentId);
    if (!agent || !this.hostWindow || this.hostWindow.isDestroyed()) {
      return;
    }

    // Hide all views first
    for (const [id, otherAgent] of this.remoteAgents.entries()) {
      if (otherAgent.view) {
        otherAgent.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      }
    }

    // Show the selected view
    if (agent.view) {
      const bounds = this.hostWindow.getContentBounds();
      const titlebarHeight = REMOTE_AGENT_WINDOW_CONFIG.titlebarHeight;
      agent.view.setBounds({
        x: 0,
        y: titlebarHeight,
        width: bounds.width,
        height: bounds.height - titlebarHeight,
      });
    }

    this.activeAgentId = agentId;
    agent.lastActiveAt = new Date();

    // Notify active agent changed
    sendToAllWindows('remote-agent:active-changed', { agentId });

    // Also notify the host window which renders the titlebar controls
    if (this.hostWindow && !this.hostWindow.isDestroyed()) {
      this.hostWindow.webContents.send('remote-agent:active-changed', {
        agentId,
      });
    }
  }

  /**
   * Close a remote agent
   */
  async closeRemoteAgent(agentId: string): Promise<void> {
    const agent = this.remoteAgents.get(agentId);
    if (!agent) {
      return;
    }

    // Remove the view from the window
    if (agent.view && this.hostWindow && !this.hostWindow.isDestroyed()) {
      this.hostWindow.removeBrowserView(agent.view);
    }

    // Destroy the view's webContents
    if (agent.view && !agent.view.webContents.isDestroyed()) {
      agent.view.webContents.close();
    }

    this.remoteAgents.delete(agentId);

    // If this was the active agent, switch to another or close window
    if (this.activeAgentId === agentId) {
      const remainingAgents = Array.from(this.remoteAgents.keys());
      if (remainingAgents.length > 0) {
        this.switchToAgent(remainingAgents[0]);
      } else {
        this.activeAgentId = null;
        // Close the host window if no agents remain
        if (this.hostWindow && !this.hostWindow.isDestroyed()) {
          this.hostWindow.close();
        }
      }
    }

    this.notifyAgentListChanged();
  }

  /**
   * Close all remote agents
   */
  async closeAllRemoteAgents(): Promise<void> {
    const agentIds = Array.from(this.remoteAgents.keys());
    for (const agentId of agentIds) {
      await this.closeRemoteAgent(agentId);
    }
  }

  /**
   * Focus a remote agent (switch to it and focus the window)
   */
  focusRemoteAgent(agentId: string): void {
    const agent = this.remoteAgents.get(agentId);
    if (agent) {
      this.switchToAgent(agentId);
      if (this.hostWindow && !this.hostWindow.isDestroyed()) {
        this.hostWindow.focus();
      }
      agent.lastActiveAt = new Date();
    }
  }

  /**
   * Get a remote agent
   */
  getRemoteAgent(agentId: string): RemoteAgentWindow | undefined {
    return this.remoteAgents.get(agentId);
  }

  /**
   * Get the active agent ID
   */
  getActiveAgentId(): string | null {
    return this.activeAgentId;
  }

  /**
   * List all remote agents
   */
  listRemoteAgents(): RemoteAgentConfig[] {
    return Array.from(this.remoteAgents.values()).map((agent) => agent.config);
  }

  /**
   * Get the state of a remote agent
   */
  getRemoteAgentState(agentId: string): RemoteAgentWindowState | undefined {
    const agent = this.remoteAgents.get(agentId);
    return agent?.state;
  }

  /**
   * Update remote agent state
   */
  updateRemoteAgentState(agentId: string, state: RemoteAgentWindowState): void {
    const agent = this.remoteAgents.get(agentId);
    if (agent) {
      agent.state = state;
      // Emit state change event to all windows
      sendToAllWindows('remote-agent:state-changed', {
        agentId,
        state,
      });
      // Also notify the titlebar in the host window
      if (this.hostWindow && !this.hostWindow.isDestroyed()) {
        this.hostWindow.webContents.send('remote-agent:state-changed', {
          agentId,
          state,
        });
      }
    }
  }

  /**
   * Send a message to a remote agent
   */
  sendMessage(agentId: string, message: any): void {
    const agent = this.remoteAgents.get(agentId);
    if (agent && agent.webContents && !agent.webContents.isDestroyed()) {
      agent.webContents.send('remote-agent:message-from-host', message);
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
   * Notify all windows that the agent list has changed
   */
  private notifyAgentListChanged(): void {
    const agentList = this.listRemoteAgents();
    sendToAllWindows('remote-agent:list-changed', {
      agents: agentList,
      activeAgentId: this.activeAgentId,
    });
    // Also notify the titlebar
    if (this.hostWindow && !this.hostWindow.isDestroyed()) {
      this.hostWindow.webContents.send('remote-agent:list-changed', {
        agents: agentList,
        activeAgentId: this.activeAgentId,
      });
    }
  }

  /**
   * Create the host window for remote agents with custom titlebar
   */
  private createHostWindow(options?: RemoteAgentWindowOptions): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    // Calculate left half dimensions
    const windowWidth = options?.width ?? Math.floor(screenWidth / 2);
    const windowHeight = options?.height ?? screenHeight;

    // TODO: Consider creating a minimal preload script for titlebar that only exposes
    // remoteAgentWindow API instead of using the full preload with all APIs
    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload.js')
      : path.join(__dirname, '../../.erb/dll/preload.js');

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: windowWidth,
      height: windowHeight,
      x: 0, // Position at left edge
      y: 0,
      minWidth: REMOTE_AGENT_WINDOW_CONFIG.minWidth,
      minHeight: REMOTE_AGENT_WINDOW_CONFIG.minHeight,
      alwaysOnTop: options?.alwaysOnTop ?? false,
      resizable: options?.resizable ?? true,
      title: 'Remote Agents',
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 10, y: 10 },
      webPreferences: {
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        preload: preloadPath,
      },
    };

    // Allow custom position to override default left-half positioning
    if (options?.position) {
      windowOptions.x = options.position.x;
      windowOptions.y = options.position.y;
    }

    if (options?.parentWindow) {
      windowOptions.parent = options.parentWindow;
    }

    const window = new BrowserWindow(windowOptions);

    // Load the titlebar HTML
    const titlebarPath = app.isPackaged
      ? pathToFileURL(
          path.join(app.getAppPath(), 'dist', 'renderer', 'titlebar.html'),
        ).toString()
      : `http://localhost:${process.env.PORT || 1212}/titlebar.html`;

    window.loadURL(titlebarPath).catch((error) => {
      console.error('[RemoteAgent] Failed to load titlebar:', error);
      // Fallback to minimal HTML if titlebar fails to load
      window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: #1e1e1e; color: #fff; }
              #titlebar {
                height: ${REMOTE_AGENT_WINDOW_CONFIG.titlebarHeight}px;
                background: #2d2d2d;
                -webkit-app-region: drag;
                display: flex;
                align-items: center;
                padding: 0 10px 0 80px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              }
            </style>
          </head>
          <body>
            <div id="titlebar">Remote Agents</div>
          </body>
        </html>
      `)}`,
      );
    });

    return window;
  }

  /**
   * Setup event handlers for the host window
   */
  private setupHostWindowHandlers(): void {
    if (!this.hostWindow) return;

    // Window closed - clean up all agents
    this.hostWindow.on('closed', () => {
      this.remoteAgents.clear();
      this.activeAgentId = null;
      this.hostWindow = null;
    });

    // Handle window resize - update active view bounds
    this.hostWindow.on('resize', () => {
      if (!this.hostWindow || !this.activeAgentId) return;
      const agent = this.remoteAgents.get(this.activeAgentId);
      if (agent && agent.view) {
        const bounds = this.hostWindow.getContentBounds();
        const titlebarHeight = REMOTE_AGENT_WINDOW_CONFIG.titlebarHeight;
        agent.view.setBounds({
          x: 0,
          y: titlebarHeight,
          width: bounds.width,
          height: bounds.height - titlebarHeight,
        });
      }
    });
  }

  /**
   * Setup event handlers for a remote agent
   */
  private setupAgentHandlers(remoteAgent: RemoteAgentWindow): void {
    const { id, webContents } = remoteAgent;

    // Page loaded
    webContents.on('did-finish-load', () => {
      this.updateRemoteAgentState(id, RemoteAgentWindowState.READY);
    });

    // Page failed to load
    webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(
        `Remote agent failed to load: ${errorDescription} (${errorCode})`,
      );
      this.updateRemoteAgentState(id, RemoteAgentWindowState.ERROR);
    });

    // Handle messages from remote agent
    webContents.on('ipc-message', (event, channel, ...args) => {
      if (channel === 'remote-agent:message-to-host') {
        this.handleRemoteAgentMessage(id, args[0]);
      }
    });
  }

  /**
   * Apply security policy to window
   */
  private applySecurityPolicy(
    webContents: Electron.WebContents,
    config: RemoteAgentConfig,
  ): void {
    // For remote agent windows, we allow more flexibility to support OAuth flows
    // and other authentication mechanisms

    // Allow navigation within the same domain and to auth providers
    webContents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);
      const allowedAuthDomains = [
        'accounts.google.com',
        'accounts.youtube.com',
        'myaccount.google.com',
      ];

      // Allow navigation to the main domain or auth domains
      const isAllowed =
        this.isUrlAllowed(url) ||
        allowedAuthDomains.some(
          (domain) =>
            parsedUrl.hostname === domain ||
            parsedUrl.hostname.endsWith(`.${domain}`),
        );

      if (!isAllowed) {
        event.preventDefault();
        console.warn(`Blocked navigation to untrusted URL: ${url}`);
      }
    });

    // Allow new windows to open in external browser (for OAuth, etc.)
    webContents.setWindowOpenHandler(({ url }) => {
      const parsedUrl = new URL(url);
      const allowedAuthDomains = [
        'accounts.google.com',
        'accounts.youtube.com',
        'myaccount.google.com',
      ];

      // Allow auth domains to open in the same window
      const isAuthDomain = allowedAuthDomains.some(
        (domain) =>
          parsedUrl.hostname === domain ||
          parsedUrl.hostname.endsWith(`.${domain}`),
      );

      if (isAuthDomain) {
        // Load in the current webContents instead of blocking
        webContents.loadURL(url);
        return { action: 'deny' };
      }

      // For other URLs, open in external browser
      import('electron').then(({ shell }) => {
        shell.openExternal(url);
      });
      return { action: 'deny' };
    });

    // Allow more permissions for remote agent functionality
    webContents.session.setPermissionRequestHandler(
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
      },
    );
  }

  /**
   * Configure response header relaxation (CSP/XFO removal)
   */
  private configureResponseHeaderRelaxation(
    webContents: Electron.WebContents,
  ): void {
    webContents.session.webRequest.onHeadersReceived((details, callback) => {
      if (details.responseHeaders) {
        delete details.responseHeaders['content-security-policy'];
        delete details.responseHeaders['content-security-policy-report-only'];
        delete details.responseHeaders['x-frame-options'];
      }
      callback({ responseHeaders: details.responseHeaders });
    });
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
