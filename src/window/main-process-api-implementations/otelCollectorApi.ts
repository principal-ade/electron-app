/**
 * Preload API implementation for OTEL Collector Service
 */

import { ipcRenderer } from 'electron';
import type {
  OtelCollectorAPI,
  OtelCollectorResponse,
  OtelCollectorStatus,
  RegisterPortResponse,
  GetTracesResponse,
} from '../../shared/main-process-api-interfaces/OtelCollectorAPI';

// NOTE: MessagePort handling is done in preload-dev-workspace.ts
// Ports are kept in preload and messages are routed via onOtelMessage/sendOtelMessage helpers

export const otelCollectorApi: OtelCollectorAPI = {
  /**
   * Start the OTEL collector
   */
  async start(): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:start');
  },

  /**
   * Stop the OTEL collector
   */
  async stop(): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:stop');
  },

  /**
   * Get collector status
   */
  async getStatus(): Promise<OtelCollectorStatus> {
    return await ipcRenderer.invoke('otel-collector:getStatus');
  },

  /**
   * Register a MessagePort to receive traces for a specific source URL
   * Port is handled in preload; messages are delivered via window.electron.onOtelMessage()
   */
  async registerPort(windowId: string, sourceUrl: string): Promise<RegisterPortResponse> {
    const key = `${windowId}:${sourceUrl}`;

    try {
      // Trigger the IPC call to register the port (main will send it via postMessage to preload)
      const response = await ipcRenderer.invoke('otel-collector:registerPort', windowId, sourceUrl);

      return response;
    } catch (error) {
      console.error(`[otelCollectorApi] ❌ Failed to register port for ${key}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  /**
   * Unregister a trace port
   */
  async unregisterPort(windowId: string, sourceUrl: string): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:unregisterPort', windowId, sourceUrl);
  },

  /**
   * Unregister all ports for a window
   */
  async unregisterWindow(windowId: string): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:unregisterWindow', windowId);
  },

  /**
   * Send a test trace to the collector
   */
  async sendTestTrace(sourceUrl: string): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:sendTestTrace', sourceUrl);
  },

  /**
   * Get stored traces
   */
  async getTraces(limit?: number): Promise<GetTracesResponse> {
    return await ipcRenderer.invoke('otel-collector:getTraces', limit);
  },

  /**
   * Clear stored traces
   */
  async clearTraces(): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:clearTraces');
  },
};
