/**
 * Bruno Service - Renderer process wrapper for Bruno API
 *
 * Provides .bru file parsing and HTTP request execution for Bruno panels.
 */

import type { BrunoRequest, BrunoResponse } from '@principal-ade/bruno-panels';

export class BrunoService {
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
    console.info(
      `[BrunoService] Sending request: ${request.http?.method} ${request.http?.url}`,
    );
    return window.mainProcess.bruno.sendRequest(request, environment);
  }
}
