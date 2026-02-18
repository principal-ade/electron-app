/**
 * OTEL Collector API Interface
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

export interface RegisterPortResponse {
  success: boolean;
  error?: string;
}

export interface StoredTrace {
  timestamp: number;
  traceId: string;
  data: OTLPTraceRequest;
}

export interface GetTracesResponse {
  success: boolean;
  traces: StoredTrace[];
  error?: string;
}

export interface OtelCollectorAPI {
  start(): Promise<OtelCollectorResponse>;
  stop(): Promise<OtelCollectorResponse>;
  getStatus(): Promise<OtelCollectorStatus>;

  /**
   * Register a MessagePort to receive traces for a specific service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Service identifier (e.g., "web-ade", repository path, or "*" for all traces)
   */
  registerPort(windowId: string, serviceIdentifier: string): Promise<RegisterPortResponse>;

  /**
   * Unregister a trace port for a specific service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Service identifier to unregister
   */
  unregisterPort(windowId: string, serviceIdentifier: string): Promise<OtelCollectorResponse>;

  unregisterWindow(windowId: string): Promise<OtelCollectorResponse>;

  /**
   * Send a test trace to the collector
   * @param serviceIdentifier - Service identifier to include in test trace
   */
  sendTestTrace(serviceIdentifier: string): Promise<OtelCollectorResponse>;

  getTraces(limit?: number): Promise<GetTracesResponse>;
  clearTraces(): Promise<OtelCollectorResponse>;

  // MessagePort helpers (managed in preload for security)
  /**
   * Subscribe to OTEL messages for a specific service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Service identifier to receive traces from
   * @param callback - Function to call when trace data arrives
   * @returns Unsubscribe function
   */
  onOtelMessage(windowId: string, serviceIdentifier: string, callback: (data: unknown) => void): () => void;

  /**
   * Send a message to the OTEL collector for a specific service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Target service identifier
   * @param data - Message data to send
   */
  sendOtelMessage(windowId: string, serviceIdentifier: string, data: unknown): boolean;

  /**
   * Remove and cleanup OTEL port for a specific service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Service identifier to remove
   */
  removeOtelPort(windowId: string, serviceIdentifier: string): void;
}
