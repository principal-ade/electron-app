/**
 * Message types for communication between main process and event processing server
 */

import { SupportedAgent } from '@principal-ai/agent-monitoring';

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
  data?: any;
  error?: string;
}

export interface RepositoryInfoResponseMessage extends BaseMessage {
  type: 'REPOSITORY_INFO_RESPONSE';
  repositoryInfo: any | null;
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
  data?: any;
  namespace: string;
}

export interface RepositoryInfoRequestMessage extends BaseMessage {
  type: 'REPOSITORY_INFO_REQUEST';
  absolutePath: string;
}

export interface WindowBroadcastMessage extends BaseMessage {
  type: 'WINDOW_BROADCAST';
  event: string;
  data: any;
}

export interface ProcessingCompleteMessage extends BaseMessage {
  type: 'PROCESSING_COMPLETE';
  success: boolean;
  eventData?: any;
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
  context?: any;
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
  rawData: unknown
): ProcessEventMessage {
  return {
    type: 'PROCESS_EVENT',
    id: generateMessageId(),
    timestamp: Date.now(),
    provider,
    rawData
  };
}

export function createStorageRequestMessage(
  operation: 'GET' | 'SET',
  key: string,
  namespace: string,
  data?: any
): StorageRequestMessage {
  return {
    type: 'STORAGE_REQUEST',
    id: generateMessageId(),
    timestamp: Date.now(),
    operation,
    key,
    namespace,
    data
  };
}

export function createWindowBroadcastMessage(
  event: string,
  data: any
): WindowBroadcastMessage {
  return {
    type: 'WINDOW_BROADCAST',
    id: generateMessageId(),
    timestamp: Date.now(),
    event,
    data
  };
}

export function createProcessingCompleteMessage(
  requestId: string,
  success: boolean,
  eventData?: any,
  error?: string
): ProcessingCompleteMessage {
  return {
    type: 'PROCESSING_COMPLETE',
    id: requestId, // Use the original request ID
    timestamp: Date.now(),
    success,
    eventData,
    error
  };
}

// Utility function to generate unique message IDs
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Type guards for message validation
export function isProcessEventMessage(msg: any): msg is ProcessEventMessage {
  return msg && msg.type === 'PROCESS_EVENT' && msg.provider && msg.rawData !== undefined;
}

export function isStorageRequestMessage(msg: any): msg is StorageRequestMessage {
  return msg && msg.type === 'STORAGE_REQUEST' && msg.operation && msg.key && msg.namespace;
}

export function isWindowBroadcastMessage(msg: any): msg is WindowBroadcastMessage {
  return msg && msg.type === 'WINDOW_BROADCAST' && msg.event && msg.data !== undefined;
}

export function isProcessingCompleteMessage(msg: any): msg is ProcessingCompleteMessage {
  return msg && msg.type === 'PROCESSING_COMPLETE' && typeof msg.success === 'boolean';
}