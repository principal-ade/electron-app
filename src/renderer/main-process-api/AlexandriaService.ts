/**
 * Renderer-side service for Alexandria repository management
 * Uses TIPC client for type-safe RPC with main process
 */

import type {
  AlexandriaEntry,
  CodebaseView,
} from '@principal-ai/alexandria-core-library/types';
import type { AlexandriaChangeEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { alexandriaClient } from '../tipc/alexandriaClient';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

export class AlexandriaService {
  /**
   * Subscribe to repository change events
   * Note: This still uses the legacy IPC event system since TIPC doesn't support events
   */
  static onRepositoryChange(
    callback: (event: AlexandriaChangeEvent) => void,
  ): () => void {
    return window.mainProcess.alexandria.onRepositoryChange(callback);
  }

  static async getRepositories(): Promise<AlexandriaEntry[]> {
    return alexandriaClient.getRepositories();
  }

  static async getRepositoryByPath(
    path: string,
  ): Promise<AlexandriaEntry | null> {
    return alexandriaClient.getRepositoryByPath({ path });
  }

  static async registerRepository(
    path: string,
    remoteUrl?: string,
  ): Promise<AlexandriaEntry> {
    return alexandriaClient.registerRepository({ path, remoteUrl });
  }

  static async removeRepository(
    path: string,
    deleteLocal?: boolean,
  ): Promise<boolean> {
    return alexandriaClient.removeRepository({ path, deleteLocal });
  }

  static async clearAllData(): Promise<{
    repositoriesRemoved: number;
    workspacesRemoved: number;
  }> {
    return alexandriaClient.clearAllData();
  }

  static async searchRepositories(query: string): Promise<AlexandriaEntry[]> {
    return alexandriaClient.searchRepositories({ query });
  }

  static async getRepositoriesWithViews(): Promise<AlexandriaEntry[]> {
    return alexandriaClient.getRepositoriesWithViews();
  }

  static async refreshRepository(
    path: string,
  ): Promise<AlexandriaEntry | null> {
    return alexandriaClient.refreshRepository({ path });
  }

  static async updateLastOpened(path: string): Promise<void> {
    const tracer = getTracer('principal-ade-alexandria');
    const span = tracer.startSpan('alexandria.service.update_last_opened_called');
    span.setAttribute('repository_path', path);

    try {
      span.addEvent('alexandria.ipc.update_last_opened_sent', {
        channel: 'alexandria:update-last-opened',
        repository_path: path,
      });
      await alexandriaClient.updateLastOpened({ path });
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
  }

  static async getRepositoryCount(): Promise<number> {
    return alexandriaClient.getRepositoryCount();
  }

  /**
   * Get all CodebaseViews for a repository
   * @param repositoryPath - Local path to the repository
   */
  static async getCodebaseViews(
    repositoryPath: string,
  ): Promise<CodebaseView[]> {
    return alexandriaClient.getCodebaseViews({ repositoryPath });
  }

  /**
   * Get a specific CodebaseView by ID
   * @param repositoryPath - Local path to the repository
   * @param viewId - ID of the view to retrieve
   */
  static async getCodebaseView(
    repositoryPath: string,
    viewId: string,
  ): Promise<CodebaseView | null> {
    return alexandriaClient.getCodebaseView({ repositoryPath, viewId });
  }
}
