import { ipcMain } from 'electron';
import { SessionViewService } from '../../SessionViewService';
import { getTypedStorageManager } from '../../../storage-providers';
import { StaticNamespaces } from '../../../../shared/types/namespaces.types';
import { SessionViewEvent } from '../../../../shared/ipc-events/SessionViewEvents';

/**
 * Register IPC handlers for session view operations
 */
export function registerSessionViewHandlers(): void {
  // Get session view with segments
  ipcMain.handle(SessionViewEvent.GET_VIEW, async (_, sessionId: string) => {
    try {
      const typedStore = await getTypedStorageManager();

      // Get from AGENT_SESSIONS namespace
      const result = await typedStore.get(
        sessionId,
        StaticNamespaces.AGENT_SESSIONS,
      );

      if (result.success && result.data) {
        // Generate view from normalized events
        const sessionView = SessionViewService.generateSessionView(result.data);
        return {
          success: true,
          data: sessionView,
        };
      }

      return {
        success: false,
        error: `Session ${sessionId} not found`,
      };
    } catch (error) {
      console.error('Error getting session view:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get session view',
      };
    }
  });

  // Get session segment details
  ipcMain.handle(
    SessionViewEvent.GET_SEGMENT,
    async (_, sessionId: string, segmentId: string) => {
      try {
        const typedStore = await getTypedStorageManager();

        const result = await typedStore.get(
          sessionId,
          StaticNamespaces.AGENT_SESSIONS,
        );

        if (result.success && result.data) {
          const sessionView = SessionViewService.generateSessionView(
            result.data,
          );
          const segment = sessionView.segments.find((s) => s.id === segmentId);

          if (segment) {
            return {
              success: true,
              data: segment,
            };
          }
        }

        return {
          success: false,
          error: `Segment ${segmentId} not found in session ${sessionId}`,
        };
      } catch (error) {
        console.error('Error getting segment:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get segment',
        };
      }
    },
  );

  // Get session statistics
  ipcMain.handle(
    SessionViewEvent.GET_STATISTICS,
    async (_, sessionId: string) => {
      try {
        const typedStore = await getTypedStorageManager();

        const result = await typedStore.get(
          sessionId,
          StaticNamespaces.AGENT_SESSIONS,
        );

        if (result.success && result.data) {
          const sessionView = SessionViewService.generateSessionView(
            result.data,
          );

          return {
            success: true,
            data: {
              totalEvents: sessionView.totalEvents,
              uniqueFilesAccessed: sessionView.uniqueFilesAccessed,
              uniqueFilesModified: sessionView.uniqueFilesModified,
              totalToolCalls: sessionView.totalToolCalls,
              totalWebAccesses: sessionView.totalWebAccesses,
              segmentCount: sessionView.segments.length,
              duration: sessionView.duration,
              repositoryCount: sessionView.repositoriesAccessed?.length || 0,
            },
          };
        }

        return {
          success: false,
          error: `Session ${sessionId} not found`,
        };
      } catch (error) {
        console.error('Error getting session statistics:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get statistics',
        };
      }
    },
  );
}
