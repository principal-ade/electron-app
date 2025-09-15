/**
 * Centralized Event Processing System
 *
 * This module defines how events update session state.
 * Used by both backend (for storage) and frontend (for real-time updates).
 */
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
import { EventActivityType } from '../sessionEnums';
/**
 * Metadata types for different contexts
 */
export interface BashCommandMetadata {
    source: 'bash';
    command: string;
}
export interface FileOperationMetadata {
    command?: string;
    source?: string;
}
export interface TodoMetadata {
    lastTodos?: Array<{
        status: 'completed' | 'in_progress' | 'pending';
        content: string;
    }>;
    [key: string]: unknown;
}
export interface ToolCallMetadata {
    hookEventName?: string;
    agentType?: string;
}
/**
 * Session state that can be incrementally updated by events
 */
export interface SessionState {
    sessionId: string;
    workingDirectory: string;
    firstAccess: number;
    lastActivity: number;
    eventCount: number;
    isActive: boolean;
    fileAccessCount: number;
    fileWriteCount: number;
    fileAccesses: Record<string, Array<{
        timestamp: number;
        normalizedPath?: string;
        metadata?: BashCommandMetadata | FileOperationMetadata;
    }>>;
    fileWrites: Record<string, Array<{
        timestamp: number;
        operation: string;
        normalizedPath?: string;
        metadata?: BashCommandMetadata | FileOperationMetadata;
    }>>;
    filesRead: string[];
    filesWritten: string[];
    toolCallCount: number;
    toolCalls?: Array<{
        toolName: string;
        timestamp: number;
        parameters?: Record<string, unknown>;
        metadata?: ToolCallMetadata;
    }>;
    webAccessCount: number;
    webAccesses?: Array<{
        url: string;
        timestamp: number;
        metadata?: Record<string, unknown>;
    }>;
    bashCommands?: Array<{
        command: string;
        timestamp: number;
        filesAccessed?: string[];
        filesModified?: string[];
    }>;
    lastEvent?: {
        type: EventActivityType;
        fileName?: string;
        timestamp: number;
    };
    metadata?: TodoMetadata;
    customName?: string;
}
/**
 * Event processing result
 */
export interface ProcessingResult {
    session: Partial<SessionState>;
    sideEffects?: {
        checkGitStatus?: string[];
        analyzeBashCommand?: string;
        notify?: {
            type: string;
            message: string;
        };
    };
}
/**
 * Event processor interface - can be extended with plugins
 */
export interface IEventProcessor {
    canProcess(event: NormalizedAgentSessionEvent): boolean;
    process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult;
}
/**
 * Default processors for standard tool events
 */
export declare class FileReadProcessor implements IEventProcessor {
    canProcess(event: NormalizedAgentSessionEvent): boolean;
    process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult;
}
export declare class FileWriteProcessor implements IEventProcessor {
    canProcess(event: NormalizedAgentSessionEvent): boolean;
    process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult;
}
export declare class BashProcessor implements IEventProcessor {
    canProcess(event: NormalizedAgentSessionEvent): boolean;
    process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult;
}
export declare class TodoWriteProcessor implements IEventProcessor {
    canProcess(event: NormalizedAgentSessionEvent): boolean;
    process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult;
}
/**
 * Main session event processor
 */
export declare class SessionEventProcessor {
    private processors;
    /**
     * Register a custom processor
     */
    registerProcessor(processor: IEventProcessor): void;
    /**
     * Process an event and return session updates
     */
    processEvent(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult;
    /**
     * Initialize a new session state
     */
    initializeSession(sessionId: string, workingDirectory: string): SessionState;
    /**
     * Merge partial updates into current state
     */
    mergeState(current: SessionState, updates: Partial<SessionState>): SessionState;
}
export declare const sessionEventProcessor: SessionEventProcessor;
//# sourceMappingURL=SessionEventProcessor.d.ts.map