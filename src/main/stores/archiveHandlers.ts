import { ipcMain } from 'electron';
import { archiveConfigService } from './ArchiveConfiguration';
import { agentSessionAutoArchivingService } from './AgentSessionAutoArchivingService';
import { agentSessionArchivingService } from '../agent-sessions/AgentSessionArchivingService';

export function registerArchiveHandlers(): void {
  // Get current configuration
  ipcMain.handle('archive:get-configuration', async () => {
    try {
      return await archiveConfigService.getConfiguration();
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to get configuration:', error);
      throw error;
    }
  });

  // Update configuration
  ipcMain.handle('archive:update-configuration', async (_, config) => {
    try {
      // Use auto-archiving service to update config so it can restart timers if needed
      await agentSessionAutoArchivingService.updateConfiguration(config);
      return { success: true };
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to update configuration:', error);
      throw error;
    }
  });

  // Reset configuration to defaults
  ipcMain.handle('archive:reset-configuration', async () => {
    try {
      // Import default config
      const { DEFAULT_ARCHIVE_CONFIG } = await import('./ArchiveConfiguration');
      // Update with default config to reset
      await agentSessionAutoArchivingService.updateConfiguration(DEFAULT_ARCHIVE_CONFIG);
      return await archiveConfigService.getConfiguration();
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to reset configuration:', error);
      throw error;
    }
  });

  // Get archive statistics
  ipcMain.handle('archive:get-statistics', async () => {
    try {
      return await agentSessionAutoArchivingService.getArchiveStatistics();
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to get statistics:', error);
      throw error;
    }
  });

  // Archive all inactive sessions
  ipcMain.handle('archive:archive-all-inactive', async () => {
    try {
      return await agentSessionAutoArchivingService.archiveAllInactiveSessions();
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to archive all sessions:', error);
      throw error;
    }
  });

  // Get recent session summaries
  ipcMain.handle('archive:get-summaries', async () => {
    try {
      return await agentSessionArchivingService.getRecentSummaries();
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to get summaries:', error);
      throw error;
    }
  });

  // Archive a single session
  ipcMain.handle('archive:archive-session', async (_, sessionId: string, options?: { skipCleanup?: boolean; skipProcessedDelete?: boolean }) => {
    try {
      await agentSessionArchivingService.archiveSession(sessionId, options);
      return { success: true };
    } catch (error) {
      console.error(`[ArchiveHandlers] Failed to archive session ${sessionId}:`, error);
      throw error;
    }
  });

  // Load archived session
  ipcMain.handle('archive:load-session', async (_, sessionId: string) => {
    console.log(`[ArchiveHandlers] Request to load archived session ${sessionId}`);
    try {
      const result = await agentSessionArchivingService.loadArchivedSession(sessionId);
      console.log(`[ArchiveHandlers] Archive load result for ${sessionId}:`, {
        found: !!result,
        hasSession: result ? !!result.session : false,
        hasMetadata: result ? !!result.metadata : false,
        hasRawEvents: result ? !!result.rawEvents : false,
        rawEventCount: result?.rawEvents?.length || 0,
        type: result ? typeof result : 'null'
      });
      return result; // Will be null if not found
    } catch (error) {
      console.error(`[ArchiveHandlers] Failed to load session ${sessionId}:`, error);
      return null; // Return null instead of throwing - let the renderer decide how to handle
    }
  });

  // Get storage metrics
  ipcMain.handle('archive:get-storage-metrics', async () => {
    try {
      return await agentSessionArchivingService.getStorageMetrics();
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to get storage metrics:', error);
      throw error;
    }
  });

  // List all archived sessions
  ipcMain.handle('archive:list-archived-sessions', async () => {
    try {
      const archivedSessions = await agentSessionArchivingService.listArchivedSessions();
      return archivedSessions;
    } catch (error) {
      console.error('[ArchiveHandlers] Failed to list archived sessions:', error);
      throw error;
    }
  });

  // Get a specific archived session
  ipcMain.handle('archive:get-archived-session', async (_, sessionId: string) => {
    try {
      const archivedSession = await agentSessionArchivingService.loadArchivedSession(sessionId);
      if (!archivedSession || !archivedSession.session) {
        console.log(`[ArchiveHandlers] Archived session ${sessionId} not found`);
        return null; // Return null instead of throwing error
      }
      return archivedSession.session;
    } catch (error) {
      console.error(`[ArchiveHandlers] Failed to get archived session ${sessionId}:`, error);
      return null; // Return null on error instead of throwing
    }
  });

  // Delete an archived session
  ipcMain.handle('archive:delete-archived-session', async (_, sessionId: string) => {
    try {
      await agentSessionArchivingService.deleteArchivedSession(sessionId);
      return { success: true };
    } catch (error) {
      console.error(`[ArchiveHandlers] Failed to delete archived session ${sessionId}:`, error);
      throw error;
    }
  });

  // Restore an archived session to active
  ipcMain.handle('archive:restore-archived-session', async (_, sessionId: string) => {
    try {
      await agentSessionArchivingService.restoreArchivedSession(sessionId);
      return { success: true };
    } catch (error) {
      console.error(`[ArchiveHandlers] Failed to restore archived session ${sessionId}:`, error);
      throw error;
    }
  });

  console.log('[ArchiveHandlers] Archive IPC handlers registered');
}