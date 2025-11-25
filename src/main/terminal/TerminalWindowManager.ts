import { BrowserWindow, screen } from 'electron';
import { TerminalSession, TerminalWindowInfo } from './types';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
import { resolveHtmlPath } from '../util';
import { EnvironmentConfig } from '../utils/environmentConfig';
import { ModernApplicationWindow } from '../window/modernWindowManager';
import { WindowType } from '../window/windowTypes';

export class TerminalWindowManager {
  private terminalWindows: Map<string, BrowserWindow> = new Map();

  constructor(
    private broadcastCallback: (channel: string, payload: unknown) => void,
  ) {}

  // Create a new window for a terminal session
  async createTerminalWindow(
    sessionId: string,
    session: TerminalSession,
  ): Promise<{ windowId: number }> {
    const iconPath = EnvironmentConfig.getAssetsPath('icon.png');

    // Get screen dimensions for positioning
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    // Position on left half of screen
    const windowWidth = Math.floor(screenWidth / 2);
    const windowHeight = screenHeight;

    // Create terminal window using ApplicationWindow with TERMINAL type
    const terminalAppWindow = new ModernApplicationWindow(
      {
        // Window sizing and positioning
        width: windowWidth,
        height: windowHeight,
        x: 0,
        y: 0,
        title: `Terminal - ${session.directory.split('/').pop()}`,
        icon: iconPath,
      },
      WindowType.TERMINAL,
    );

    const terminalWindow = terminalAppWindow.window;

    // Track the window
    this.terminalWindows.set(sessionId, terminalWindow);
    // Add pop-out window to active viewers
    session.activeViewers.add(terminalWindow.id);

    // Terminal-specific: Notify all windows when the terminal window is shown
    terminalWindow.once('show', () => {
      this.broadcastCallback(TerminalAPIEvents.ON_WINDOW_READY, {
        terminalId: sessionId,
        agentSessionId: session.agentSessionId,
        windowId: terminalWindow.id,
      });

      if (!terminalWindow.isDestroyed()) {
        terminalWindow.webContents.send(TerminalAPIEvents.ON_WINDOW_READY, {
          terminalId: sessionId,
          agentSessionId: session.agentSessionId,
          windowId: terminalWindow.id,
        });
      }
      console.log(
        `[Terminal] Window ready event sent for terminal ${sessionId}, agent session ${session.agentSessionId}`,
      );
    });

    // Load the terminal route with session ID
    const htmlPath = resolveHtmlPath('index.html');
    const urlWithRoute = `${htmlPath}#/terminal/${sessionId}`;
    console.log(`[Terminal] Loading pop-out window with URL: ${urlWithRoute}`);
    await terminalWindow.loadURL(urlWithRoute);

    // Clean up when window is closed
    terminalWindow.on('closed', () => {
      console.log(`[Terminal] Pop-out window closed for session ${sessionId}`);
      this.terminalWindows.delete(sessionId);
      // Remove pop-out window from active viewers
      session.activeViewers.delete(terminalWindow.id);

      // Notify registered windows about the terminal window close
      this.broadcastCallback(TerminalAPIEvents.ON_WINDOW_CLOSE, {
        terminalId: sessionId,
        agentSessionId: session.agentSessionId,
        windowId: terminalWindow.id,
      });
    });

    return { windowId: terminalWindow.id };
  }

  // Get list of open terminal windows
  getOpenWindows(): TerminalWindowInfo[] {
    const openWindows: TerminalWindowInfo[] = [];

    this.terminalWindows.forEach((window, terminalId) => {
      if (!window.isDestroyed()) {
        openWindows.push({
          terminalId,
          windowId: window.id,
        });
      }
    });

    return openWindows;
  }

  // Focus a terminal window by window ID
  focusWindow(windowId: number): void {
    const window = BrowserWindow.fromId(windowId);
    if (window && !window.isDestroyed()) {
      window.focus();
      if (window.isMinimized()) {
        window.restore();
      }
      console.log(`[Terminal] Focused window ${windowId}`);
    } else {
      console.warn(
        `[Terminal] Window ${windowId} not found or destroyed`,
      );
    }
  }

  // Close all terminal windows
  closeAllWindows(): void {
    this.terminalWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.terminalWindows.clear();
  }
}
