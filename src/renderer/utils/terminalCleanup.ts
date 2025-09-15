import { TerminalService } from '../main-process-api/TerminalService';

/**
 * Clean up orphaned terminal sessions that may have been left over from previous sessions
 * This helps prevent hitting the terminal session limit
 */
export async function cleanupOrphanedTerminals(keepSessionIds: string[] = []): Promise<void> {
  try {
    console.log('[TerminalCleanup] Checking for orphaned terminal sessions...');
    
    // Get all active terminal sessions
    const sessions = await TerminalService.list();
    
    if (!sessions || sessions.length === 0) {
      console.log('[TerminalCleanup] No terminal sessions found');
      return;
    }
    
    console.log(`[TerminalCleanup] Found ${sessions.length} terminal sessions`);
    
    // Destroy sessions that aren't in the keep list
    for (const session of sessions) {
      if (!keepSessionIds.includes(session.id)) {
        console.log(`[TerminalCleanup] Destroying orphaned session: ${session.id}`);
        try {
          await TerminalService.destroy(session.id);
        } catch (err) {
          console.error(`[TerminalCleanup] Failed to destroy session ${session.id}:`, err);
        }
      } else {
        console.log(`[TerminalCleanup] Keeping active session: ${session.id}`);
      }
    }
    
    console.log('[TerminalCleanup] Cleanup complete');
  } catch (err) {
    console.error('[TerminalCleanup] Failed to list terminal sessions:', err);
  }
}

/**
 * Get the count of active terminal sessions
 */
export async function getTerminalSessionCount(): Promise<number> {
  try {
    const sessions = await TerminalService.list();
    return sessions?.length || 0;
  } catch (err) {
    console.error('[TerminalCleanup] Failed to get session count:', err);
    return 0;
  }
}