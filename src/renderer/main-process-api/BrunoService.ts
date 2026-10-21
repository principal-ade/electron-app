/**
 * Bruno Service - Renderer process wrapper for Bruno API
 *
 * Provides .bru file parsing and HTTP request execution for Bruno panels.
 */

import type {
  BrunoRequest,
  BrunoResponse,
  BrunoEnvironment,
} from '@principal-ade/bruno-panels';
import type {
  OpenRequestEnvelope,
  SavedRequest,
  CatalogRequest,
} from '../../shared/requests/preparedRequest';

export class BrunoService {
  static onOpenRequest(callback: (request: OpenRequestEnvelope) => void) {
    return window.mainProcess?.bruno?.onOpenRequest?.(callback) ?? (() => {});
  }

  static acknowledgeOpen(requestId: string, tabId: string): void {
    window.mainProcess?.bruno?.acknowledgeOpen?.(requestId, tabId);
  }

  static listSaved(): Promise<SavedRequest[]> | undefined {
    return window.mainProcess?.bruno?.listSaved?.();
  }

  static listRoutes(): Promise<CatalogRequest[]> | undefined {
    return window.mainProcess?.bruno?.listRoutes?.();
  }

  static onCatalogChanged(callback: () => void): () => void {
    return (
      window.mainProcess?.bruno?.onCatalogChanged?.(callback) ?? (() => {})
    );
  }

  static updateRoute(request: SavedRequest): Promise<CatalogRequest[]> {
    return window.mainProcess.bruno.updateRoute(request);
  }

  static forgetRoute(id: string): Promise<CatalogRequest[]> {
    return window.mainProcess.bruno.forgetRoute(id);
  }

  static pin(request: SavedRequest): Promise<SavedRequest[]> {
    return window.mainProcess.bruno.pin(request);
  }

  static unpin(id: string): Promise<SavedRequest[]> {
    return window.mainProcess.bruno.unpin(id);
  }
  /**
   * Load and parse a .bru file, returning a BrunoRequest.
   * Parsing happens on the main process side using @usebruno/lang.
   * @param path - Absolute path to the .bru file
   */
  static async loadBruRequest(path: string): Promise<BrunoRequest> {
    console.info(`[BrunoService] Loading .bru file: ${path}`);
    return window.mainProcess.bruno.loadBruRequest(path);
  }

  /**
   * Send an HTTP request using Bruno request format.
   * @param request - The Bruno request to execute
   * @param environment - Optional environment variables for interpolation
   */
  static async sendRequest(
    request: BrunoRequest,
    environment?: Record<string, string>,
  ): Promise<BrunoResponse> {
    return window.mainProcess.bruno.sendRequest(request, environment);
  }

  /**
   * Load all environments from environments/*.json files in the collection.
   * @param collectionPath - Absolute path to the Bruno collection
   */
  static async loadEnvironments(
    collectionPath: string,
  ): Promise<BrunoEnvironment[]> {
    console.info(`[BrunoService] Loading environments from: ${collectionPath}`);
    return window.mainProcess.bruno.loadEnvironments(collectionPath);
  }
}
