/**
 * Renderer Service for OTEL Collector
 */

import type { ServerStats } from '@principal-ai/otel-collector-server';

export interface OtelCollectorStatus {
  isRunning: boolean;
  stats: ServerStats | null;
  error?: string;
}

export interface OtelCollectorResponse {
  success: boolean;
  error?: string;
}

export class OtelCollectorService {
  /**
   * Start the OTEL collector
   */
  static async start(): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.start();
    } catch (err) {
      console.error('[OtelCollectorService] Failed to start:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Stop the OTEL collector
   */
  static async stop(): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.stop();
    } catch (err) {
      console.error('[OtelCollectorService] Failed to stop:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Get collector status
   */
  static async getStatus(): Promise<OtelCollectorStatus> {
    try {
      return await window.mainProcess.otelCollector.getStatus();
    } catch (err) {
      console.error('[OtelCollectorService] Failed to get status:', err);
      return {
        isRunning: false,
        stats: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Register a MessagePort to receive traces for a specific source URL
   */
  static async registerPort(windowId: string, sourceUrl: string): Promise<MessagePort | null> {
    try {
      const response = await window.mainProcess.otelCollector.registerPort(windowId, sourceUrl);
      if (response.success && response.port) {
        return response.port;
      }
      console.error('[OtelCollectorService] Failed to register port:', response.error);
      return null;
    } catch (err) {
      console.error('[OtelCollectorService] Failed to register port:', err);
      return null;
    }
  }

  /**
   * Unregister a trace port
   */
  static async unregisterPort(windowId: string, sourceUrl: string): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.unregisterPort(windowId, sourceUrl);
    } catch (err) {
      console.error('[OtelCollectorService] Failed to unregister port:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Unregister all ports for a window
   */
  static async unregisterWindow(windowId: string): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.unregisterWindow(windowId);
    } catch (err) {
      console.error('[OtelCollectorService] Failed to unregister window:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Send a test trace to the collector
   */
  static async sendTestTrace(sourceUrl: string): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.sendTestTrace(sourceUrl);
    } catch (err) {
      console.error('[OtelCollectorService] Failed to send test trace:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
