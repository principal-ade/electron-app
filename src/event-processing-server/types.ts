/**
 * Types for communication between event processing server and main process
 */

import type { SupportedAgent } from '@principal-ai/agent-monitoring';

/**
 * Configuration for the event processing server
 */
export interface EventProcessingServerConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrentEvents?: number;
  requestTimeoutMs?: number;
  statsReportingIntervalMs?: number;
}

export const DEFAULT_CONFIG: Required<EventProcessingServerConfig> = {
  logLevel: 'info',
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
  gitCache?: {
    repoCacheSize: number;
    dirCacheSize: number;
  };
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

/**
 * Fire-and-forget request to link an agent session to a topic. Emitted when
 * the event server parses a `GET /api/topics/<id>` URL out of an agent's
 * Bash tool input — the fetch is the link signal.
 */
export interface LinkSessionToTopicMessage extends BaseServerMessage {
  type: 'LINK_SESSION_TO_TOPIC';
  sessionId: string;
  topicId: string;
}

export interface GetTracesRequestMessage extends BaseServerMessage {
  type: 'GET_TRACES_REQUEST';
  limit?: number;
  traceId?: string; // If provided, get specific trace
}

export interface GetRegistrationsRequestMessage extends BaseServerMessage {
  type: 'GET_REGISTRATIONS_REQUEST';
}

export type ServerToMainMessage =
  | ReadyMessage
  | ProcessedEventMessage
  | StorageRequestMessage
  | WindowBroadcastMessage
  | ProcessingCompleteMessage
  | ServerStatsMessage
  | ServerErrorMessage
  | GetTracesRequestMessage
  | GetRegistrationsRequestMessage
  | LinkSessionToTopicMessage;

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

export interface ShutdownMessage extends BaseClientMessage {
  type: 'SHUTDOWN';
}

export interface PingMessage extends BaseClientMessage {
  type: 'PING';
}

export interface GetStatsMessage extends BaseClientMessage {
  type: 'GET_STATS';
}

export interface GetTracesResponseMessage extends BaseClientMessage {
  type: 'GET_TRACES_RESPONSE';
  success: boolean;
  traces?: Array<{ traceId: string; data: unknown }>;
  error?: string;
}

export interface PortRegistration {
  windowId: string;
  serviceName: string;
  registeredAt: number;
}

export interface GetRegistrationsResponseMessage extends BaseClientMessage {
  type: 'GET_REGISTRATIONS_RESPONSE';
  success: boolean;
  registrations?: PortRegistration[];
  services?: string[];
  error?: string;
}

/**
 * Message to register a MessagePort for a specific repository
 * The port is transferred separately via postMessage transfer list
 */
export interface RegisterPortMessage extends BaseClientMessage {
  type: 'REGISTER_PORT';
  windowId: number;
  repository: string;
}

/**
 * Message to unregister a port when window closes or changes repo
 */
export interface UnregisterPortMessage extends BaseClientMessage {
  type: 'UNREGISTER_PORT';
  windowId: number;
  repository: string;
}

export type MainToServerMessage =
  | ProcessEventMessage
  | StorageResponseMessage
  | ShutdownMessage
  | PingMessage
  | GetStatsMessage
  | RegisterPortMessage
  | UnregisterPortMessage
  | GetTracesResponseMessage
  | GetRegistrationsResponseMessage;

/**
 * Helper functions
 */
const randomSuffix = () => Math.random().toString(36).slice(2, 8);

const generateMessageId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${randomSuffix()}`;

export function createStorageRequestMessage(
  operation: 'GET' | 'SET' | 'DELETE',
  namespace: string,
  key: string,
  data?: unknown,
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

export function createWindowBroadcastMessage(
  channel: string,
  data: unknown,
): WindowBroadcastMessage {
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
  error?: string,
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
export function isProcessEventMessage(
  msg: MainToServerMessage,
): msg is ProcessEventMessage {
  return msg.type === 'PROCESS_EVENT';
}

export function isStorageRequestMessage(
  msg: ServerToMainMessage,
): msg is StorageRequestMessage {
  return msg.type === 'STORAGE_REQUEST';
}

export function isWindowBroadcastMessage(
  msg: ServerToMainMessage,
): msg is WindowBroadcastMessage {
  return msg.type === 'WINDOW_BROADCAST';
}

export function isProcessedEventMessage(
  msg: ServerToMainMessage,
): msg is ProcessedEventMessage {
  return msg.type === 'PROCESSED_EVENT';
}

export function isRegisterPortMessage(
  msg: MainToServerMessage,
): msg is RegisterPortMessage {
  return msg.type === 'REGISTER_PORT';
}

export function isUnregisterPortMessage(
  msg: MainToServerMessage,
): msg is UnregisterPortMessage {
  return msg.type === 'UNREGISTER_PORT';
}

export function isGetTracesRequestMessage(
  msg: ServerToMainMessage,
): msg is GetTracesRequestMessage {
  return msg.type === 'GET_TRACES_REQUEST';
}

export function isGetTracesResponseMessage(
  msg: MainToServerMessage,
): msg is GetTracesResponseMessage {
  return msg.type === 'GET_TRACES_RESPONSE';
}

export function isGetRegistrationsRequestMessage(
  msg: ServerToMainMessage,
): msg is GetRegistrationsRequestMessage {
  return msg.type === 'GET_REGISTRATIONS_REQUEST';
}

export function isGetRegistrationsResponseMessage(
  msg: MainToServerMessage,
): msg is GetRegistrationsResponseMessage {
  return msg.type === 'GET_REGISTRATIONS_RESPONSE';
}

export function isLinkSessionToTopicMessage(
  msg: ServerToMainMessage,
): msg is LinkSessionToTopicMessage {
  return msg.type === 'LINK_SESSION_TO_TOPIC';
}
