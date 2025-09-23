/**
 * Types for communication between event processing server and main process
 */

import type { SupportedAgent } from '@principal-ai/agent-monitoring';

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

/**
 * Messages sent from server to main process
 */
export type ServerToMainMessage =
  | ReadyMessage
  | ProcessedEventMessage
  | StorageRequestMessage
  | WindowBroadcastMessage
  | RepositoryInfoRequestMessage
  | ServerErrorMessage
  | ServerStatsMessage;

export interface ReadyMessage {
  type: 'ready';
  id?: string;
  timestamp: number;
  port: number;
}

export interface ProcessedEventMessage {
  type: 'PROCESSED_EVENT';
  id: string;
  timestamp: number;
  event: any; // The normalized event from the pipeline
  provider: SupportedAgent;
}

export interface StorageRequestMessage {
  type: 'STORAGE_REQUEST';
  id: string;
  timestamp: number;
  operation: 'GET' | 'SET' | 'DELETE';
  namespace: string;
  key: string;
  data?: any;
}

export interface WindowBroadcastMessage {
  type: 'WINDOW_BROADCAST';
  id: string;
  timestamp: number;
  channel: string;
  data: any;
}

export interface RepositoryInfoRequestMessage {
  type: 'REPOSITORY_INFO_REQUEST';
  id: string;
  timestamp: number;
  absolutePath: string;
}

export interface ServerErrorMessage {
  type: 'SERVER_ERROR';
  id: string;
  timestamp: number;
  error: string;
  context?: any;
}

export interface ServerStatsMessage {
  type: 'SERVER_STATS';
  id: string;
  timestamp: number;
  stats: any;
}

/**
 * Messages sent from main to server process
 */
export type MainToServerMessage =
  | StorageResponseMessage
  | RepositoryInfoResponseMessage
  | ShutdownMessage
  | PingMessage
  | GetStatsMessage;

export interface ShutdownMessage {
  type: 'SHUTDOWN';
  id: string;
  timestamp: number;
}

export interface PingMessage {
  type: 'PING';
  id: string;
  timestamp: number;
}

export interface GetStatsMessage {
  type: 'GET_STATS';
  id: string;
  timestamp: number;
}

export interface StorageResponseMessage {
  type: 'STORAGE_RESPONSE';
  id: string;
  timestamp: number;
  success: boolean;
  data?: any;
  error?: string;
}

export interface RepositoryInfoResponseMessage {
  type: 'REPOSITORY_INFO_RESPONSE';
  id: string;
  timestamp: number;
  repositoryInfo: any;
  error?: string;
}

/**
 * Type guards
 */
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

/**
 * Helper functions
 */
export function createStorageRequestMessage(
  operation: 'GET' | 'SET' | 'DELETE',
  namespace: string,
  key: string,
  data?: any
): StorageRequestMessage {
  return {
    type: 'STORAGE_REQUEST',
    id: `storage-${Date.now()}`,
    timestamp: Date.now(),
    operation,
    namespace,
    key,
    data
  };
}

export function createWindowBroadcastMessage(
  channel: string,
  data: any
): WindowBroadcastMessage {
  return {
    type: 'WINDOW_BROADCAST',
    id: `broadcast-${Date.now()}`,
    timestamp: Date.now(),
    channel,
    data
  };
}