/**
 * Terminal WebSocket Bridge Initializer
 *
 * Sets up the TerminalWebSocketBridge for remote terminal access.
 * Should be called once during app initialization.
 */

import { getSessionManagerInstance } from './sessionManagerSingleton';
import { ownershipManager } from './TerminalOwnershipManager';
import { TerminalWebSocketBridge } from './TerminalWebSocketBridge';
import { ipcMain } from 'electron';
import { getRemoteTerminalWindow } from '../window/RemoteTerminalWindow';

let bridgeInstance: TerminalWebSocketBridge | null = null;

/**
 * Initialize the terminal WebSocket bridge
 * Called once during app startup
 */
export async function initializeTerminalBridge(): Promise<void> {
  console.log('[BridgeInitializer] Initializing terminal WebSocket bridge...');

  const sessionManager = getSessionManagerInstance();

  // Create bridge instance
  bridgeInstance = new TerminalWebSocketBridge(
    sessionManager,
    ownershipManager,
  );

  // Set bridge on session manager
  sessionManager.setWebSocketBridge(bridgeInstance);

  // Register IPC handler to open remote terminal viewer window
  ipcMain.handle('terminal:openRemoteViewer', async () => {
    console.log('[BridgeInitializer] Opening remote terminal viewer window');
    const window = getRemoteTerminalWindow();
    window.create();
    return { success: true };
  });

  console.log('[BridgeInitializer] Terminal WebSocket bridge initialized');
}

/**
 * Get the bridge instance (for manual connection testing)
 */
export function getBridgeInstance(): TerminalWebSocketBridge | null {
  return bridgeInstance;
}

/**
 * Connect to a terminal room for a specific repository
 * This would typically be called when a repository is opened
 */
export async function connectToTerminalRoom(
  repoId: string,
  token: string,
  userId: string,
  githubHandle: string,
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  if (!bridgeInstance) {
    return {
      success: false,
      error: 'Bridge not initialized',
    };
  }

  return bridgeInstance.connectToTerminalRoom(repoId, token, userId, githubHandle);
}
