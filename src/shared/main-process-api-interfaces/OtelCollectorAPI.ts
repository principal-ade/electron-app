/**
 * OTEL Collector API Interface
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

export interface RegisterPortResponse {
  success: boolean;
  error?: string;
}

export interface StoredTrace {
  timestamp: number;
  traceId: string;
  data: unknown;
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
  registerPort(windowId: string, sourceUrl: string): Promise<RegisterPortResponse>;
  unregisterPort(windowId: string, sourceUrl: string): Promise<OtelCollectorResponse>;
  unregisterWindow(windowId: string): Promise<OtelCollectorResponse>;
  sendTestTrace(sourceUrl: string): Promise<OtelCollectorResponse>;
  getTraces(limit?: number): Promise<GetTracesResponse>;
  clearTraces(): Promise<OtelCollectorResponse>;
}
