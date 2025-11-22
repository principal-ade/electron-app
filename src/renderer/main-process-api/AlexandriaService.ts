/**
 * Renderer-side service for Alexandria repository management
 * Communicates with main process via IPC using window.mainProcess
 */

import type { AlexandriaEntry, CodebaseView } from '@principal-ai/alexandria-core-library/types';
import type { AlexandriaChangeEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';

export class AlexandriaService {
  static onRepositoryChange(
    callback: (event: AlexandriaChangeEvent) => void,
  ): () => void {
    return window.mainProcess.alexandria.onRepositoryChange(callback);
  }

  static async getRepositories(skipGitInfo?: boolean): Promise<AlexandriaEntry[]> {
    return window.mainProcess.alexandria.getRepositories(skipGitInfo);
  }

  static async getRepository(name: string): Promise<AlexandriaEntry | null> {
    return window.mainProcess.alexandria.getRepository(name);
  }

  static async getRepositoryByPath(
    path: string,
  ): Promise<AlexandriaEntry | null> {
    return window.mainProcess.alexandria.getRepositoryByPath(path);
  }

  static async registerRepository(
    name: string,
    path: string,
  ): Promise<AlexandriaEntry> {
    return window.mainProcess.alexandria.registerRepository(name, path);
  }

  static async removeRepository(
    name: string,
    deleteLocal?: boolean,
  ): Promise<boolean> {
    return window.mainProcess.alexandria.removeRepository(name, deleteLocal);
  }

  static async searchRepositories(query: string): Promise<AlexandriaEntry[]> {
    return window.mainProcess.alexandria.searchRepositories(query);
  }

  static async getRepositoriesWithViews(): Promise<AlexandriaEntry[]> {
    return window.mainProcess.alexandria.getRepositoriesWithViews();
  }

  static async refreshRepository(
    name: string,
  ): Promise<AlexandriaEntry | null> {
    return window.mainProcess.alexandria.refreshRepository(name);
  }

  static async getRepositoryCount(): Promise<number> {
    return window.mainProcess.alexandria.getRepositoryCount();
  }

  /**
   * Get all CodebaseViews for a repository
   * @param repositoryPath - Local path to the repository
   */
  static async getCodebaseViews(
    repositoryPath: string,
  ): Promise<CodebaseView[]> {
    return window.mainProcess.alexandria.getCodebaseViews(repositoryPath);
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
    return window.mainProcess.alexandria.getCodebaseView(repositoryPath, viewId);
  }
}
