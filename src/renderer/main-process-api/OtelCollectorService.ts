/**
 * Renderer Service for OTEL Collector
 */

import type { ServerStats, OTLPTraceRequest } from '@principal-ai/otel-collector-server';

export interface OtelCollectorStatus {
  isRunning: boolean;
  stats: ServerStats | null;
  error?: string;
}

export interface OtelCollectorResponse {
  success: boolean;
  error?: string;
}

export interface StoredTrace {
  timestamp: number;
  traceId: string;
  data: OTLPTraceRequest; // OTLP trace data
}

export interface GetTracesResponse {
  success: boolean;
  traces: StoredTrace[];
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
   * The port will be delivered via window.electron.onOtelPortReady callback
   */
  static async registerPort(windowId: string, sourceUrl: string): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.registerPort(windowId, sourceUrl);
    } catch (err) {
      console.error('[OtelCollectorService] Failed to register port:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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

  /**
   * Get stored traces
   */
  static async getTraces(limit?: number): Promise<GetTracesResponse> {
    try {
      return await window.mainProcess.otelCollector.getTraces(limit);
    } catch (err) {
      console.error('[OtelCollectorService] Failed to get traces:', err);
      return { success: false, traces: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Clear stored traces
   */
  static async clearTraces(): Promise<OtelCollectorResponse> {
    try {
      return await window.mainProcess.otelCollector.clearTraces();
    } catch (err) {
      console.error('[OtelCollectorService] Failed to clear traces:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
