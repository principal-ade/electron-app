/**
 * Shared types for event processing server
 */

export * from './messages';

// Server configuration
export interface EventProcessingServerConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableObservability: boolean;
  maxConcurrentEvents: number;
  requestTimeoutMs: number;
  statsReportingIntervalMs: number;
}

// Default configuration
export const DEFAULT_CONFIG: EventProcessingServerConfig = {
  logLevel: 'info',
  enableObservability: true,
  maxConcurrentEvents: 10,
  requestTimeoutMs: 30000,
  statsReportingIntervalMs: 60000
};

// Pending request tracking
export interface PendingRequest {
  id: string;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeoutHandle?: NodeJS.Timeout;
}

// Server statistics
export interface ServerStats {
  processedEvents: number;
  errors: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  pendingRequests: number;
  averageProcessingTime: number;
  lastProcessedEvent?: number;
}