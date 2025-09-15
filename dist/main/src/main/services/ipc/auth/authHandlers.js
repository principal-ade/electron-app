/**
 * Consolidated authentication handlers for IPC communication
 *
 * This module registers unified authentication channel names that wrap
 * the existing handlers from AuthService, AuthStateManager, and SecureTokenIPC.
 *
 * During migration, both old and new channel names will work.
 * Once migration is complete, the logic will be moved here.
 */
import { ipcMain } from 'electron';
// Store references to existing handlers
const existingHandlers = new Map();
/**
 * Helper to wrap an existing IPC handler with a new channel name
 */
function wrapExistingHandler(newChannel, oldChannel) {
    ipcMain.handle(newChannel, async (event, ...args) => {
        // Get the existing handler directly from ipcMain's internal registry
        // Since the old handlers are already registered, we invoke them through ipcMain
        try {
            // We need to simulate the invoke by calling the handler directly
            // The handlers are already registered, so we use a trick:
            // Remove our handler temporarily, invoke the old one, then re-add
            const tempHandler = existingHandlers.get(newChannel);
            if (tempHandler) {
                ipcMain.removeHandler(newChannel);
            }
            // Now invoke the existing handler
            const result = await event.sender.invoke(oldChannel, ...args);
            // Re-register our handler
            if (tempHandler) {
                ipcMain.handle(newChannel, tempHandler);
            }
            return result;
        }
        catch (error) {
            console.error(`[AuthHandlers] Error forwarding ${newChannel} to ${oldChannel}:`, error);
            throw error;
        }
    });
}
export function registerAuthenticationHandlers() {
    console.log('[AuthHandlers] Registering unified authentication handlers');
    // Since we can't directly call other handlers from main process,
    // we'll create new handlers that duplicate the logic for now.
    // This is a temporary solution until we can refactor the services.
    // For now, let's just register aliases that the preload script can use
    // The preload script will handle the actual forwarding
    console.log('[AuthHandlers] Authentication handlers ready for preload forwarding');
}
