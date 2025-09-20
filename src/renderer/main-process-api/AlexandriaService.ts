/**
 * Renderer-side service for Alexandria repository management
 * Communicates with main process via IPC using window.mainProcess
 */

import type { AlexandriaEntry } from '@a24z/core-library';
import type { AlexandriaChangeEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';

export class AlexandriaService {
  static onRepositoryChange(
    callback: (event: AlexandriaChangeEvent) => void,
  ): () => void {
    return window.mainProcess.alexandria.onRepositoryChange(callback);
  }

  static async getRepositories(): Promise<AlexandriaEntry[]> {
    return window.mainProcess.alexandria.getRepositories();
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

  static async removeRepository(name: string, deleteLocal?: boolean): Promise<boolean> {
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
}
