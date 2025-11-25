/**
 * MessagePort Manager
 *
 * Manages MessageChannel creation and distribution of ports between
 * the PTY worker and renderer processes.
 */

import { MessageChannelMain, BrowserWindow } from 'electron';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';

export interface SessionPortInfo {
  sessionId: string;
  channel: MessageChannelMain;
  workerPort: MessagePort;
  rendererPort: MessagePort;
  rendererWindowId?: number;
  writable: boolean; // Whether this port has write permissions
  ownershipToken?: string;
}

export class MessagePortManager {
  private sessionPorts: Map<string, SessionPortInfo> = new Map();

  constructor() {}

  /**
   * Create a MessageChannel for a terminal session
   * Returns the ports that should be transferred to worker and renderer
   */
  createSessionChannel(sessionId: string): {
    workerPort: MessagePort;
    rendererPort: MessagePort;
  } {
    // Create a new MessageChannel
    const channel = new MessageChannelMain();

    const portInfo: SessionPortInfo = {
      sessionId,
      channel,
      workerPort: channel.port1,
      rendererPort: channel.port2,
      writable: true, // Initially writable for the creator
    };

    this.sessionPorts.set(sessionId, portInfo);

    console.log(`[MessagePortManager] Created channel for session ${sessionId}`);

    return {
      workerPort: channel.port1,
      rendererPort: channel.port2,
    };
  }

  /**
   * Transfer the renderer port to a specific window
   */
  transferRendererPort(
    sessionId: string,
    windowId: number,
    writable: boolean = true,
  ): void {
    const portInfo = this.sessionPorts.get(sessionId);
    if (!portInfo) {
      console.error(
        `[MessagePortManager] Cannot transfer port: session ${sessionId} not found`,
      );
      return;
    }

    const window = BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed()) {
      console.error(
        `[MessagePortManager] Cannot transfer port: window ${windowId} not found`,
      );
      return;
    }

    // Update port info
    portInfo.rendererWindowId = windowId;
    portInfo.writable = writable;

    // Generate ownership token if writable
    if (writable) {
      portInfo.ownershipToken = this.generateOwnershipToken(sessionId, windowId);
    }

    console.log(
      `[MessagePortManager] Transferring port for session ${sessionId} to window ${windowId} (writable: ${writable})`,
    );

    // Send the port to the renderer via IPC
    window.webContents.postMessage(
      TerminalAPIEvents.PORT_READY,
      {
        sessionId,
        writable,
        ownershipToken: portInfo.ownershipToken,
      },
      [portInfo.rendererPort],
    );
  }

  /**
   * Get port info for a session
   */
  getPortInfo(sessionId: string): SessionPortInfo | undefined {
    return this.sessionPorts.get(sessionId);
  }

  /**
   * Close and clean up ports for a session
   */
  closeSession(sessionId: string): void {
    const portInfo = this.sessionPorts.get(sessionId);
    if (!portInfo) {
      return;
    }

    console.log(`[MessagePortManager] Closing ports for session ${sessionId}`);

    try {
      portInfo.workerPort.close();
      portInfo.rendererPort.close();
    } catch (error) {
      console.error(
        `[MessagePortManager] Error closing ports for session ${sessionId}:`,
        error,
      );
    }

    this.sessionPorts.delete(sessionId);
  }

  /**
   * Close all ports
   */
  closeAllSessions(): void {
    console.log(
      `[MessagePortManager] Closing all ${this.sessionPorts.size} session ports`,
    );

    this.sessionPorts.forEach((portInfo, sessionId) => {
      this.closeSession(sessionId);
    });
  }

  /**
   * Generate an ownership token for a session/window combination
   */
  private generateOwnershipToken(sessionId: string, windowId: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${sessionId}-${windowId}-${timestamp}-${random}`;
  }

  /**
   * Validate an ownership token
   */
  validateOwnershipToken(sessionId: string, token: string): boolean {
    const portInfo = this.sessionPorts.get(sessionId);
    if (!portInfo) {
      return false;
    }

    return portInfo.ownershipToken === token;
  }

  /**
   * Update ownership token for a session (when ownership changes)
   */
  updateOwnership(sessionId: string, newWindowId: number): void {
    const portInfo = this.sessionPorts.get(sessionId);
    if (!portInfo) {
      return;
    }

    portInfo.rendererWindowId = newWindowId;
    portInfo.ownershipToken = this.generateOwnershipToken(sessionId, newWindowId);

    console.log(
      `[MessagePortManager] Updated ownership for session ${sessionId} to window ${newWindowId}`,
    );
  }
}
