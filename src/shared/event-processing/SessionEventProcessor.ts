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
  [key: string]: unknown; // Allow extension
}

export interface ToolCallMetadata {
  hookEventName?: string;
  agentType?: string;
}

/**
 * Session state that can be incrementally updated by events
 */
export interface SessionState {
  // Core identification
  sessionId: string;
  workingDirectory: string;
  
  // Activity tracking
  firstAccess: number;
  lastActivity: number;
  eventCount: number;
  isActive: boolean;
  
  // File operations
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
  
  // File path lists for UI display and map visualization
  filesRead: string[];  // Array of unique file paths that have been read
  filesWritten: string[];  // Array of unique file paths that have been written
  
  // Tool usage
  toolCallCount: number;
  toolCalls?: Array<{
    toolName: string;
    timestamp: number;
    parameters?: Record<string, unknown>;
    metadata?: ToolCallMetadata;
  }>;
  
  // Web access
  webAccessCount: number;
  webAccesses?: Array<{
    url: string;
    timestamp: number;
    metadata?: Record<string, unknown>; // Web metadata is not well-defined yet
  }>;
  
  // Bash command analysis (future)
  bashCommands?: Array<{
    command: string;
    timestamp: number;
    filesAccessed?: string[];
    filesModified?: string[];
  }>;
  
  // Last event info
  lastEvent?: {
    type: EventActivityType;
    fileName?: string;
    timestamp: number;
  };
  
  // Metadata
  metadata?: TodoMetadata;
  customName?: string;
}

/**
 * Event processing result
 */
export interface ProcessingResult {
  // Updated session state
  session: Partial<SessionState>;
  
  // Side effects to perform
  sideEffects?: {
    // Files that need git status check
    checkGitStatus?: string[];
    // Bash commands to analyze
    analyzeBashCommand?: string;
    // Notifications to show
    notify?: { type: string; message: string };
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
export class FileReadProcessor implements IEventProcessor {
  canProcess(event: NormalizedAgentSessionEvent): boolean {
    return event.toolName === 'Read';
  }
  
  process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult {
    if (!event.files || event.files.length === 0) {
      return { session: {} };
    }
    
    // Initialize fileAccesses and filesRead if needed
    const fileAccesses = currentState.fileAccesses || {};
    const filesRead = currentState.filesRead || [];
    
    // Process all files in the array
    event.files.forEach(file => {
      const filePath = file.absolutePath;
      if (!filePath) return;
      
      if (!fileAccesses[filePath]) {
        fileAccesses[filePath] = [];
      }
      
      fileAccesses[filePath].push({
        timestamp: event.timestamp,
        normalizedPath: file.repository?.relativePath
      });
      
      // Add to filesRead array if not already present
      // Use relative path if available, otherwise use absolute path
      const pathToAdd = file.repository?.relativePath || filePath;
      if (!filesRead.includes(pathToAdd)) {
        filesRead.push(pathToAdd);
      }
    });
    
    const firstFile = event.files[0];
    return {
      session: {
        fileAccesses,
        filesRead,
        fileAccessCount: Object.keys(fileAccesses).length,
        lastActivity: event.timestamp,
        eventCount: (currentState.eventCount || 0) + 1,
        lastEvent: {
          type: EventActivityType.READ,
          fileName: firstFile?.displayPath?.split('/').pop(),
          timestamp: event.timestamp
        }
      }
    };
  }
}

export class FileWriteProcessor implements IEventProcessor {
  canProcess(event: NormalizedAgentSessionEvent): boolean {
    return ['Write', 'Edit', 'MultiEdit'].includes(event.toolName || '');
  }
  
  process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult {
    if (!event.files || event.files.length === 0) {
      return { session: {} };
    }
    
    // Initialize fileWrites and filesWritten if needed
    const fileWrites = currentState.fileWrites || {};
    const filesWritten = currentState.filesWritten || [];
    const affectedFiles: string[] = [];
    
    // Process all files in the array
    event.files.forEach(file => {
      const filePath = file.absolutePath;
      if (!filePath) return;
      
      if (!fileWrites[filePath]) {
        fileWrites[filePath] = [];
      }
      
      fileWrites[filePath].push({
        timestamp: event.timestamp,
        operation: event.toolName || 'write',
        normalizedPath: file.repository?.relativePath
      });
      
      affectedFiles.push(filePath);
      
      // Add to filesWritten array if not already present
      // Use relative path if available, otherwise use absolute path
      const pathToAdd = file.repository?.relativePath || filePath;
      if (!filesWritten.includes(pathToAdd)) {
        filesWritten.push(pathToAdd);
      }
    });
    
    const firstFile = event.files[0];
    return {
      session: {
        fileWrites,
        filesWritten,
        fileWriteCount: Object.keys(fileWrites).length,
        lastActivity: event.timestamp,
        eventCount: (currentState.eventCount || 0) + 1,
        lastEvent: {
          type: EventActivityType.WRITE,
          fileName: firstFile?.displayPath?.split('/').pop(),
          timestamp: event.timestamp
        }
      },
      sideEffects: {
        checkGitStatus: affectedFiles
      }
    };
  }
}

export class BashProcessor implements IEventProcessor {
  canProcess(event: NormalizedAgentSessionEvent): boolean {
    return event.toolName === 'Bash';
  }
  
  process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult {
    const command = (event.toolInput as any)?.command;
    if (!command) {
      return { session: {} };
    }
    
    // Basic command analysis (can be extended)
    const filesAccessed: string[] = [];
    const filesModified: string[] = [];
    
    // Simple heuristics - can be made more sophisticated
    if (command.includes('cat ') || command.includes('grep ') || command.includes('ls ')) {
      // Read operations
      const matches = command.match(/(?:cat|grep|ls)\s+([^\s;|&]+)/g);
      if (matches) {
        filesAccessed.push(...matches.map((m: string) => m.split(' ')[1]));
      }
    }
    
    if (command.includes('echo ') && command.includes('>')) {
      // Write operations
      const matches = command.match(/>\s*([^\s;|&]+)/g);
      if (matches) {
        filesModified.push(...matches.map((m: string) => m.replace('>', '').trim()));
      }
    }
    
    const bashCommands = currentState.bashCommands || [];
    bashCommands.push({
      command,
      timestamp: event.timestamp,
      filesAccessed: filesAccessed.length > 0 ? filesAccessed : undefined,
      filesModified: filesModified.length > 0 ? filesModified : undefined
    });
    
    // Update file counts if we detected file operations
    let fileAccesses = currentState.fileAccesses || {};
    let fileWrites = currentState.fileWrites || {};
    
    filesAccessed.forEach(file => {
      if (!fileAccesses[file]) fileAccesses[file] = [];
      fileAccesses[file].push({
        timestamp: event.timestamp,
        metadata: { source: 'bash', command }
      });
    });
    
    filesModified.forEach(file => {
      if (!fileWrites[file]) fileWrites[file] = [];
      fileWrites[file].push({
        timestamp: event.timestamp,
        operation: 'bash',
        metadata: { command }
      });
    });
    
    return {
      session: {
        bashCommands,
        fileAccesses: Object.keys(fileAccesses).length > 0 ? fileAccesses : currentState.fileAccesses,
        fileWrites: Object.keys(fileWrites).length > 0 ? fileWrites : currentState.fileWrites,
        fileAccessCount: Object.keys(fileAccesses).length,
        fileWriteCount: Object.keys(fileWrites).length,
        toolCallCount: (currentState.toolCallCount || 0) + 1,
        lastActivity: event.timestamp,
        eventCount: (currentState.eventCount || 0) + 1
      },
      sideEffects: {
        analyzeBashCommand: command,
        checkGitStatus: filesModified
      }
    };
  }
}

export class TodoWriteProcessor implements IEventProcessor {
  canProcess(event: NormalizedAgentSessionEvent): boolean {
    return event.toolName === 'TodoWrite';
  }
  
  process(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult {
    interface TodoItem {
      status: 'completed' | 'in_progress' | 'pending';
      content: string;
    }
    
    interface TodoInput {
      todos?: TodoItem[];
    }
    
    const todoData = event.toolInput as TodoInput;
    if (!todoData?.todos) {
      return { session: {} };
    }
    
    const todoStats = todoData.todos.reduce((acc: { completed: number; inProgress: number; pending: number }, todo: TodoItem) => {
      if (todo.status === 'completed') acc.completed++;
      else if (todo.status === 'in_progress') acc.inProgress++;
      else acc.pending++;
      return acc;
    }, { completed: 0, inProgress: 0, pending: 0 });
    
    return {
      session: {
        lastActivity: event.timestamp,
        eventCount: (currentState.eventCount || 0) + 1,
        toolCallCount: (currentState.toolCallCount || 0) + 1,
        lastEvent: {
          type: EventActivityType.TODO_WRITE,
          fileName: `Todos: ${todoStats.inProgress} active, ${todoStats.completed} done`,
          timestamp: event.timestamp
        },
        // Store the actual todos in metadata
        metadata: {
          ...currentState.metadata,
          lastTodos: todoData.todos
        }
      }
    };
  }
}

/**
 * Main session event processor
 */
export class SessionEventProcessor {
  private processors: IEventProcessor[] = [
    new FileReadProcessor(),
    new FileWriteProcessor(),
    new BashProcessor(),
    new TodoWriteProcessor()
  ];
  
  /**
   * Register a custom processor
   */
  registerProcessor(processor: IEventProcessor) {
    this.processors.push(processor);
  }
  
  /**
   * Process an event and return session updates
   */
  processEvent(event: NormalizedAgentSessionEvent, currentState: SessionState): ProcessingResult {
    // Find matching processor
    for (const processor of this.processors) {
      if (processor.canProcess(event)) {
        return processor.process(event, currentState);
      }
    }
    
    // Default processing for unknown events
    return {
      session: {
        lastActivity: event.timestamp,
        eventCount: (currentState.eventCount || 0) + 1,
        toolCallCount: event.toolName ? (currentState.toolCallCount || 0) + 1 : currentState.toolCallCount
      }
    };
  }
  
  /**
   * Initialize a new session state
   */
  initializeSession(sessionId: string, workingDirectory: string): SessionState {
    return {
      sessionId,
      workingDirectory,
      firstAccess: Date.now(),
      lastActivity: Date.now(),
      eventCount: 0,
      isActive: true,
      fileAccessCount: 0,
      fileWriteCount: 0,
      fileAccesses: {},
      fileWrites: {},
      filesRead: [],
      filesWritten: [],
      toolCallCount: 0,
      toolCalls: [],
      webAccessCount: 0,
      webAccesses: [],
      bashCommands: []
    };
  }
  
  /**
   * Merge partial updates into current state
   */
  mergeState(current: SessionState, updates: Partial<SessionState>): SessionState {
    return {
      ...current,
      ...updates,
      // Ensure objects are properly merged, not replaced
      fileAccesses: updates.fileAccesses || current.fileAccesses,
      fileWrites: updates.fileWrites || current.fileWrites,
      metadata: { ...current.metadata, ...updates.metadata }
    };
  }
}

// Export singleton instance
export const sessionEventProcessor = new SessionEventProcessor();