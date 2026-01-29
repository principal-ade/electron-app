/**
 * Preload API implementation for OTEL Collector Service
 */

import { ipcRenderer } from 'electron';
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

export interface RegisterPortResponse {
  success: boolean;
  port?: MessagePort;
  error?: string;
}

export interface StoredTrace {
  timestamp: number;
  traceId: string;
  data: any;
}

export interface GetTracesResponse {
  success: boolean;
  traces: StoredTrace[];
  error?: string;
}

export const otelCollectorApi = {
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
   */
  async registerPort(windowId: string, sourceUrl: string): Promise<RegisterPortResponse> {
    return await ipcRenderer.invoke('otel-collector:registerPort', windowId, sourceUrl);
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
