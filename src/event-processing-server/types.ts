/**
 * Types for communication between event processing server and main process
 */

import type { RepositoryInfo, SupportedAgent } from '@principal-ai/agent-monitoring';

/**
 * Configuration for the event processing server
 */
export interface EventProcessingServerConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableObservability?: boolean;
  maxConcurrentEvents?: number;
  requestTimeoutMs?: number;
  statsReportingIntervalMs?: number;
}

export const DEFAULT_CONFIG: Required<EventProcessingServerConfig> = {
  logLevel: 'info',
  enableObservability: true,
  maxConcurrentEvents: 10,
  requestTimeoutMs: 30_000,
  statsReportingIntervalMs: 60_000,
};

export interface PendingRequest {
  id: string;
  timestamp: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

export interface ServerStats {
  processedEvents: number;
  errors: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  pendingRequests: number;
  averageProcessingTime: number;
  lastProcessedEvent?: number;
}

interface BaseMessage {
  type: string;
  id: string;
  timestamp: number;
}

interface BaseServerMessage extends BaseMessage {}

interface BaseClientMessage extends BaseMessage {}

/**
 * Messages sent from server to main process
 */
export interface ReadyMessage extends BaseServerMessage {
  type: 'ready';
  port: number;
}

export interface ProcessedEventMessage extends BaseServerMessage {
  type: 'PROCESSED_EVENT';
  event: unknown;
  provider: SupportedAgent;
}

export interface StorageRequestMessage extends BaseServerMessage {
  type: 'STORAGE_REQUEST';
  operation: 'GET' | 'SET' | 'DELETE';
  namespace: string;
  key: string;
  data?: unknown;
}

export interface RepositoryInfoRequestMessage extends BaseServerMessage {
  type: 'REPOSITORY_INFO_REQUEST';
  absolutePath: string;
}

export interface WindowBroadcastMessage extends BaseServerMessage {
  type: 'WINDOW_BROADCAST';
  channel: string;
  data: unknown;
}

export interface ProcessingCompleteMessage extends BaseServerMessage {
  type: 'PROCESSING_COMPLETE';
  success: boolean;
  eventData?: unknown;
  error?: string;
}

export interface ServerStatsMessage extends BaseServerMessage {
  type: 'SERVER_STATS';
  stats: ServerStats;
}

export interface ServerErrorMessage extends BaseServerMessage {
  type: 'SERVER_ERROR';
  error: string;
  context?: unknown;
}

export type ServerToMainMessage =
  | ReadyMessage
  | ProcessedEventMessage
  | StorageRequestMessage
  | RepositoryInfoRequestMessage
  | WindowBroadcastMessage
  | ProcessingCompleteMessage
  | ServerStatsMessage
  | ServerErrorMessage;

/**
 * Messages sent from main to server process
 */
export interface ProcessEventMessage extends BaseClientMessage {
  type: 'PROCESS_EVENT';
  provider: SupportedAgent;
  rawData: unknown;
}

export interface StorageResponseMessage extends BaseClientMessage {
  type: 'STORAGE_RESPONSE';
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface RepositoryInfoResponseMessage extends BaseClientMessage {
  type: 'REPOSITORY_INFO_RESPONSE';
  repositoryInfo: RepositoryInfo | null;
  error?: string;
}

export interface ShutdownMessage extends BaseClientMessage {
  type: 'SHUTDOWN';
}

export interface PingMessage extends BaseClientMessage {
  type: 'PING';
}

export interface GetStatsMessage extends BaseClientMessage {
  type: 'GET_STATS';
}

export type MainToServerMessage =
  | ProcessEventMessage
  | StorageResponseMessage
  | RepositoryInfoResponseMessage
  | ShutdownMessage
  | PingMessage
  | GetStatsMessage;

/**
 * Helper functions
 */
const randomSuffix = () => Math.random().toString(36).slice(2, 8);

const generateMessageId = (prefix: string): string => `${prefix}-${Date.now()}-${randomSuffix()}`;

export function createStorageRequestMessage(
  operation: 'GET' | 'SET' | 'DELETE',
  namespace: string,
  key: string,
  data?: unknown
): StorageRequestMessage {
  return {
    type: 'STORAGE_REQUEST',
    id: generateMessageId('storage'),
    timestamp: Date.now(),
    operation,
    namespace,
    key,
    data,
  };
}

export function createRepositoryInfoRequestMessage(absolutePath: string): RepositoryInfoRequestMessage {
  return {
    type: 'REPOSITORY_INFO_REQUEST',
    id: generateMessageId('repo-info'),
    timestamp: Date.now(),
    absolutePath,
  };
}

export function createWindowBroadcastMessage(channel: string, data: unknown): WindowBroadcastMessage {
  return {
    type: 'WINDOW_BROADCAST',
    id: generateMessageId('broadcast'),
    timestamp: Date.now(),
    channel,
    data,
  };
}

export function createProcessingCompleteMessage(
  requestId: string,
  success: boolean,
  eventData?: unknown,
  error?: string
): ProcessingCompleteMessage {
  return {
    type: 'PROCESSING_COMPLETE',
    id: requestId,
    timestamp: Date.now(),
    success,
    eventData,
    error,
  };
}

/**
 * Type guards
 */
export function isProcessEventMessage(msg: MainToServerMessage): msg is ProcessEventMessage {
  return msg.type === 'PROCESS_EVENT';
}

export function isStorageRequestMessage(msg: ServerToMainMessage): msg is StorageRequestMessage {
  return msg.type === 'STORAGE_REQUEST';
}

export function isWindowBroadcastMessage(msg: ServerToMainMessage): msg is WindowBroadcastMessage {
  return msg.type === 'WINDOW_BROADCAST';
}

export function isRepositoryInfoRequestMessage(msg: ServerToMainMessage): msg is RepositoryInfoRequestMessage {
  return msg.type === 'REPOSITORY_INFO_REQUEST';
}

export function isProcessedEventMessage(msg: ServerToMainMessage): msg is ProcessedEventMessage {
  return msg.type === 'PROCESSED_EVENT';
}