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

  // Register IPC handler for one-time bridge connection setup
  // After this initial setup, all communication happens via WebSocket
  ipcMain.handle('terminal:connectBridge', async (_event, args: {
    token: string;
    userId: string;
    githubHandle: string;
  }) => {
    console.log('[BridgeInitializer] Connecting bridge to user discovery room for:', args.githubHandle);
    if (!bridgeInstance) {
      return {
        success: false,
        error: 'Bridge not initialized',
      };
    }
    return bridgeInstance.connectToUserRoom(args.token, args.userId, args.githubHandle);
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
 * Connect to user's terminal discovery room
 * This allows discovering all terminal sessions across all repositories for this user
 */
export async function connectToUserRoom(
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

  return bridgeInstance.connectToUserRoom(token, userId, githubHandle);
}

/**
 * @deprecated Use connectToUserRoom instead
 * Connect to a terminal room for a specific repository
 */
export async function connectToTerminalRoom(
  repoId: string,
  token: string,
  userId: string,
  githubHandle: string,
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  // Forward to new method, ignoring repoId
  return connectToUserRoom(token, userId, githubHandle);
}
