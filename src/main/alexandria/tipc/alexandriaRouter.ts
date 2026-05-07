/**
 * TIPC Router for Alexandria Operations
 *
 * Type-safe RPC for Alexandria repository management.
 * Replaces the legacy ipcMain.handle pattern.
 *
 * Note: Method names are prefixed with 'alexandria_' to avoid collisions
 * with other routers (e.g., githubRouter also has getRepository).
 */

import { tipc } from '@egoist/tipc/main';
import { BrowserWindow } from 'electron';
import type {
  GetRepositoryByPathInput,
  RegisterRepositoryInput,
  RemoveRepositoryInput,
  SearchRepositoriesInput,
  RefreshRepositoryInput,
  UpdateLastOpenedInput,
  GetCodebaseViewsInput,
  GetCodebaseViewInput,
} from '../../../shared/tipc/alexandriaRouterTypes';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { AlexandriaRegistryService } from '../../stores/AlexandriaRegistryService';
import { RepositoryRegistrationManager } from '@principal-ai/repository-monitoring-server';
import { getManager as getRepositoryMonitoringManager } from '../../repository-monitoring/ipcHandlers';
import { AlexandriaAPIEvent } from '../../../shared/main-process-api-interfaces/AlexandriaAPI';
import { getTracer } from '../../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

// Get the singleton registry service
const registryService = AlexandriaRegistryService.getInstance();

const t = tipc.create();

/**
 * Broadcast Alexandria events to all windows
 */
function broadcastAlexandriaEvent(
  eventType:
    | AlexandriaAPIEvent.REPOSITORY_ADDED
    | AlexandriaAPIEvent.REPOSITORY_UPDATED
    | AlexandriaAPIEvent.REPOSITORY_REMOVED,
  data: AlexandriaEntry | { path: string },
): void {
  const windows = BrowserWindow.getAllWindows();
  const activeWindows = windows.filter((w) => !w.isDestroyed());

  // Track broadcast for recently-opened flow
  if (eventType === AlexandriaAPIEvent.REPOSITORY_UPDATED && 'name' in data) {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan(
      'alexandria.event.repository_updated_broadcast',
    );
    span.setAttributes({
      repository_name: data.name,
      window_count: activeWindows.length,
    });
    span.end();
  }

  activeWindows.forEach((window) => {
    window.webContents.send(eventType, data);
  });
}

/**
 * Register repository with monitoring system
 */
async function registerWithMonitoring(repo: AlexandriaEntry): Promise<void> {
  if (!repo?.path) {
    return;
  }

  try {
    const monitoringManager = getRepositoryMonitoringManager();
    const registrationManager = RepositoryRegistrationManager.getInstance({
      monitoringManager,
    });
    await registrationManager.handleRepositoryAdded(repo);
  } catch (error) {
    console.error(
      '[Alexandria] Failed to register repository with monitoring:',
      error,
    );
  }
}

/**
 * Unregister repository from monitoring system
 */
async function unregisterFromMonitoring(repoPath: string): Promise<void> {
  try {
    const monitoringManager = getRepositoryMonitoringManager();
    const registrationManager = RepositoryRegistrationManager.getInstance({
      monitoringManager,
    });
    await registrationManager.handleRepositoryRemoved(repoPath);
  } catch (error) {
    console.error(
      '[Alexandria] Failed to unregister repository from monitoring:',
      error,
    );
  }
}

export const alexandriaRouter = {
  // ===========================================================================
  // Repository Queries
  // ===========================================================================

  alexandria_getRepositories: t.procedure.action(async () => {
    return registryService.getRepositories();
  }),

  alexandria_getRepositoryByPath: t.procedure
    .input<GetRepositoryByPathInput>()
    .action(async ({ input }) => {
      return registryService.getRepositoryByPath(input.path);
    }),

  alexandria_searchRepositories: t.procedure
    .input<SearchRepositoriesInput>()
    .action(async ({ input }) => {
      return registryService.searchRepositories(input.query);
    }),

  alexandria_getRepositoriesWithViews: t.procedure.action(async () => {
    return registryService.getRepositoriesWithViews();
  }),

  alexandria_getRepositoryCount: t.procedure.action(async () => {
    return registryService.getRepositoryCount();
  }),

  // ===========================================================================
  // Repository Mutations
  // ===========================================================================

  alexandria_registerRepository: t.procedure
    .input<RegisterRepositoryInput>()
    .action(async ({ input }) => {
      const existing = await registryService.getRepositoryByPath(input.path);
      if (existing) {
        return existing;
      }
      const repo = await registryService.registerRepository(
        input.path,
        input.remoteUrl,
      );
      broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_ADDED, repo);
      await registerWithMonitoring(repo);
      return repo;
    }),

  alexandria_removeRepository: t.procedure
    .input<RemoveRepositoryInput>()
    .action(async ({ input }) => {
      const success = await registryService.removeRepository(
        input.path,
        input.deleteLocal,
      );
      if (success) {
        broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_REMOVED, {
          path: input.path,
        });
        await unregisterFromMonitoring(input.path);
      }
      return success;
    }),

  alexandria_clearAllData: t.procedure.action(async () => {
    const result = await registryService.clearAllData();
    return result;
  }),

  alexandria_refreshRepository: t.procedure
    .input<RefreshRepositoryInput>()
    .action(async ({ input }) => {
      const repo = await registryService.refreshRepository(input.path);
      if (repo) {
        broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_UPDATED, repo);
      }
      return repo;
    }),

  alexandria_updateLastOpened: t.procedure
    .input<UpdateLastOpenedInput>()
    .action(async ({ input }) => {
      const tracer = getTracer('principal-ade-main');
      const span = tracer.startSpan('alexandria.main.ipc_handler_invoked');
      span.setAttribute('repository_path', input.path);

      try {
        await registryService.updateLastOpened(input.path);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }),

  // ===========================================================================
  // Codebase Views
  // ===========================================================================

  alexandria_getCodebaseViews: t.procedure
    .input<GetCodebaseViewsInput>()
    .action(async ({ input }) => {
      return registryService.getCodebaseViews(input.repositoryPath);
    }),

  alexandria_getCodebaseView: t.procedure
    .input<GetCodebaseViewInput>()
    .action(async ({ input }) => {
      return registryService.getCodebaseView(input.repositoryPath, input.viewId);
    }),
};

export type AlexandriaRouter = typeof alexandriaRouter;
