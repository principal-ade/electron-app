/**
 * Message types for communication between main process and event processing server
 */

import type {
  RepositoryInfo,
  RepoNormalizedUniversalAgentSessionEvent,
  SupportedAgent,
} from '@principal-ai/agent-monitoring';

// Base message interface
export interface BaseMessage {
  type: string;
  id: string;
  timestamp: number;
}

// Main Process → Event Processing Server Messages
export interface ProcessEventMessage extends BaseMessage {
  type: 'PROCESS_EVENT';
  provider: SupportedAgent;
  rawData: unknown;
}

export interface StorageResponseMessage extends BaseMessage {
  type: 'STORAGE_RESPONSE';
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface RepositoryInfoResponseMessage extends BaseMessage {
  type: 'REPOSITORY_INFO_RESPONSE';
  repositoryInfo: RepositoryInfo | null;
  error?: string;
}

export interface ServerControlMessage extends BaseMessage {
  type: 'SHUTDOWN' | 'PING' | 'GET_STATS';
}

// Event Processing Server → Main Process Messages
export interface StorageRequestMessage extends BaseMessage {
  type: 'STORAGE_REQUEST';
  operation: 'GET' | 'SET';
  key: string;
  data?: unknown;
  namespace: string;
}

export interface RepositoryInfoRequestMessage extends BaseMessage {
  type: 'REPOSITORY_INFO_REQUEST';
  absolutePath: string;
}

export interface WindowBroadcastMessage extends BaseMessage {
  type: 'WINDOW_BROADCAST';
  event: string;
  data: unknown;
}

export interface ProcessingCompleteMessage extends BaseMessage {
  type: 'PROCESSING_COMPLETE';
  success: boolean;
  eventData?: RepoNormalizedUniversalAgentSessionEvent;
  error?: string;
}

export interface ServerStatsMessage extends BaseMessage {
  type: 'SERVER_STATS';
  stats: {
    processedEvents: number;
    errors: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    pendingRequests: number;
  };
}

export interface ServerErrorMessage extends BaseMessage {
  type: 'SERVER_ERROR';
  error: string;
  context?: Record<string, unknown>;
}

// Union types for type safety
export type MainToServerMessage =
  | ProcessEventMessage
  | StorageResponseMessage
  | RepositoryInfoResponseMessage
  | ServerControlMessage;

export type ServerToMainMessage =
  | StorageRequestMessage
  | RepositoryInfoRequestMessage
  | WindowBroadcastMessage
  | ProcessingCompleteMessage
  | ServerStatsMessage
  | ServerErrorMessage;

export type EventProcessingMessage = MainToServerMessage | ServerToMainMessage;

// Helper functions for creating messages
export function createProcessEventMessage(
  provider: SupportedAgent,
  rawData: unknown,
): ProcessEventMessage {
  return {
    type: 'PROCESS_EVENT',
    id: generateMessageId(),
    timestamp: Date.now(),
    provider,
    rawData,
  };
}

export function createStorageRequestMessage(
  operation: 'GET' | 'SET',
  key: string,
  namespace: string,
  data?: unknown,
): StorageRequestMessage {
  return {
    type: 'STORAGE_REQUEST',
    id: generateMessageId(),
    timestamp: Date.now(),
    operation,
    key,
    namespace,
    data,
  };
}

export function createWindowBroadcastMessage(
  event: string,
  data: unknown,
): WindowBroadcastMessage {
  return {
    type: 'WINDOW_BROADCAST',
    id: generateMessageId(),
    timestamp: Date.now(),
    event,
    data,
  };
}

export function createProcessingCompleteMessage(
  requestId: string,
  success: boolean,
  eventData?: RepoNormalizedUniversalAgentSessionEvent,
  error?: string,
): ProcessingCompleteMessage {
  return {
    type: 'PROCESSING_COMPLETE',
    id: requestId, // Use the original request ID
    timestamp: Date.now(),
    success,
    eventData,
    error,
  };
}

// Utility function to generate unique message IDs
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Type guards for message validation
export function isProcessEventMessage(
  msg: unknown,
): msg is ProcessEventMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const candidate = msg as Partial<ProcessEventMessage>;
  return (
    candidate.type === 'PROCESS_EVENT' &&
    candidate.provider !== undefined &&
    candidate.rawData !== undefined
  );
}

export function isStorageRequestMessage(
  msg: unknown,
): msg is StorageRequestMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const candidate = msg as Partial<StorageRequestMessage>;
  return (
    candidate.type === 'STORAGE_REQUEST' &&
    candidate.operation !== undefined &&
    candidate.key !== undefined &&
    candidate.namespace !== undefined
  );
}

export function isWindowBroadcastMessage(
  msg: unknown,
): msg is WindowBroadcastMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const candidate = msg as Partial<WindowBroadcastMessage>;
  return (
    candidate.type === 'WINDOW_BROADCAST' &&
    candidate.event !== undefined &&
    candidate.data !== undefined
  );
}

export function isProcessingCompleteMessage(
  msg: unknown,
): msg is ProcessingCompleteMessage {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const candidate = msg as Partial<ProcessingCompleteMessage>;
  return (
    candidate.type === 'PROCESSING_COMPLETE' &&
    typeof candidate.success === 'boolean'
  );
}
