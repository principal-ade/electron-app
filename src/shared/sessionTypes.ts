/**
 * Centralized types for session visualization
 */

// Removed import from main. Define AgentSessionRecord locally to avoid cross-process dependency
// import type { AgentSessionRecord } from '../main/agent-session-events/types/session.types';
import {
  SessionEventType,
  ToolType,
  FileOperation,
  ToolName,
  getToolType,
  getToolColor,
  getToolIcon,
  // Added enums used by AgentSessionRecord
  LastEventType,
  EventActivityType,
  StopTrigger,
  AutoCommitStatus,
} from './sessionEnums';

// Define AgentSessionRecord here for shared use across main and renderer
export interface AgentSessionRecord {
  sessionId: string;
  workingDirectory: string;
  firstAccess: number;
  lastActivity: number;
  eventCount?: number; // Total number of events processed in this session
  lastEventType?: LastEventType;
  lastStopTime?: number;
  reviewedLastStop: boolean;
  autoCommitEnabled?: boolean;
  metadata?: Record<string, unknown>;
  // Added optional fields referenced in renderer
  commitMessage?: string;
  workspaceBoundaries?: Array<{
    rootPath: string;
    [key: string]: unknown;
  }>;
  fileAccesses: Record<
    string,
    Array<{
      timestamp: number;
      normalizedPath?: string; // Path normalized to git root
      metadata?: Record<string, unknown>;
    }>
  >;
  fileWrites: Record<
    string,
    Array<{
      timestamp: number;
      operation: FileOperation | string;
      normalizedPath?: string; // Path normalized to git root
      metadata?: Record<string, unknown>;
    }>
  >;
  webAccesses?: Array<{
    url: string;
    operation: string;
    prompt?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }>;
  terminalSessions?: Array<{
    terminalId: string;
    createdAt: number;
    lastActivity: number;
    status: 'active' | 'closed';
  }>;
  // DEPRECATED: analysis field removed - replaced by validation system
  validationSettings?: {
    runOnStop: boolean;
    enabledLayerIds?: string[];
  };
  validationResults?: Array<{
    timestamp: number;
    trigger: 'stop' | 'manual';
    results: Array<{
      layerId: string;
      layerName: string;
      success: boolean;
      error?: string;
      duration?: number;
      commandResults?: Array<{
        command: string;
        exitCode: number;
        output?: string;
        error?: string;
      }>;
    }>;
  }>;
  toolCalls?: Array<{
    toolName: string;
    timestamp: number;
    parameters: Record<string, unknown>;
    toolInput?: unknown; // Complete tool input from hook
    toolResponse?: unknown; // Complete tool response from hook
    normalizedPath?: string; // Path normalized to git root (if tool operates on a file)
    duration?: number;
    resultSize?: number;
    error?: string;
    metadata?: {
      hookEventName?: string;
      agentType?: string;
    };
  }>;
  bashCommands?: Array<{
    command: string;
    timestamp: number;
    filesAccessed?: string[];
    filesModified?: string[];
  }>;
  stopEvents?: Array<{
    timestamp: number;
    trigger?: StopTrigger;
    reason?: string;
    metadata?: Record<string, unknown>;
    autoCommit?: {
      commitHash?: string;
      commitMessage?: string;
      filesCommitted?: string[];
      error?: string;
      status: AutoCommitStatus;
    };
  }>;
  // Simple git info for consistent display
  basicGitInfo?: {
    gitRoot: string;
    relativePath: string;
    githubOwner?: string;
    githubRepo?: string;
    remoteUrl?: string;
  };
  // NEW: Consolidated last event information (replaces lastEventType + lastToolActivity)
  lastEvent?: {
    type: EventActivityType;
    fileName?: string; // For file operations
    filePath?: string; // Full path for file operations
    toolName?: string; // For tool operations
    timestamp: number;
    metadata?: Record<string, unknown>; // Additional context
  };
  // DEPRECATED: Use lastEvent instead - will be removed after migration
  lastToolActivity?: {
    type: 'read' | 'write' | 'edit';
    fileName: string;
    filePath?: string; // Added to match actual implementation
    timestamp: number;
  };
  // DEPRECATED: Complex repository analysis - use basicGitInfo instead
  repositories?: Array<{
    root: string;
    rootDisplay?: string; // Normalized display name
    fileCount: number;
    packages: Array<{
      path: string;
      pathDisplay?: string; // Normalized display path
      name: string;
      version?: string;
      type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
    }>;
    remotes?: Array<{
      name: string;
      url: string;
      owner?: string;
      repo?: string;
    }>;
    debug?: {
      originalPaths: string[];
      gitRoot: string;
      analysisTimestamp: number;
    };
  }>;
  filesystemTree?: {
    allFiles: Array<{
      path: string;
      name: string;
      size?: number;
      extension?: string;
      relativePath?: string;
    }>;
    allDirectories: Array<{
      path: string;
      name: string;
      relativePath?: string;
      children?: unknown[];
    }>;
    stats?: {
      totalFiles: number;
      totalDirectories: number;
      totalSize: number;
    };
  };
}

// Unified event type for timeline and visualization
export interface SessionEvent {
  id: string;
  type: SessionEventType;
  timestamp: number;

  // File information
  filePath?: string; // Original file path
  normalizedPath?: string; // Path normalized to git root
  fileName?: string; // Just the filename

  // Tool information
  toolName?: string;
  toolType?: ToolType;

  // Operation details
  operation?: FileOperation | string; // For writes: create, update, delete, or custom
  metadata?: Record<string, unknown>; // Additional context

  // UI hints
  color?: string; // Color for this event
  icon?: string; // Icon name or type
  description?: string; // Human-readable description
}

// GroupedEvent type for grouped events
export interface GroupedSessionEvent extends SessionEvent {
  type: SessionEventType.GROUPED;
  metadata: {
    events: SessionEvent[];
    operations: string[];
  };
}

// Processed event for map visualization
export interface ProcessedSessionEvent {
  event: SessionEvent;
  filePath: string;
  normalizedPath: string;
  tool: string;
}

// Session visualization state
export interface SessionVisualizationState {
  events: ProcessedSessionEvent[];
  currentEventIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Cumulative state
  readPaths: Set<string>;
  writePaths: Set<string>;

  // Current action for display
  currentAction: {
    action: string;
    filename: string;
    tool: string;
    count?: number;
  } | null;
}

// Highlight layer for map visualization
export interface SessionHighlightLayer {
  id: string;
  label: string;
  color: string;
  opacity?: number;
  files: Array<{
    path: string;
    metadata?: Record<string, unknown>;
  }>;
}

// Function to create events from session
export function createSessionEvents(
  session: AgentSessionRecord,
  options?: {
    includeStops?: boolean;
    limit?: number;
  },
): SessionEvent[] {
  const events: SessionEvent[] = [];

  // Add file accesses
  Object.entries(session.fileAccesses || {}).forEach(([file, accesses]) => {
    accesses.forEach((access, idx) => {
      events.push({
        id: `file-read-${file}-${access.timestamp}-${idx}`,
        type: SessionEventType.FILE_READ,
        timestamp: access.timestamp,
        filePath: file,
        normalizedPath: access.normalizedPath,
        fileName: file.split('/').pop(),
        toolName: ToolName.READ,
        toolType: ToolType.READ,
        metadata: access.metadata,
        color: '#4CAF50',
        icon: 'file-read',
        description: `Read ${file.split('/').pop()}`,
      });
    });
  });

  // Add file writes
  Object.entries(session.fileWrites || {}).forEach(([file, writes]) => {
    writes.forEach((write, idx) => {
      events.push({
        id: `file-write-${file}-${write.timestamp}-${idx}`,
        type: SessionEventType.FILE_WRITE,
        timestamp: write.timestamp,
        filePath: file,
        normalizedPath: write.normalizedPath,
        fileName: file.split('/').pop(),
        operation: write.operation,
        toolName:
          write.operation === FileOperation.CREATE
            ? ToolName.WRITE
            : ToolName.WRITE,
        toolType: ToolType.WRITE,
        metadata: write.metadata,
        color: write.operation === FileOperation.CREATE ? '#FF9800' : '#2196F3',
        icon:
          write.operation === FileOperation.CREATE ? 'file-plus' : 'file-edit',
        description: `${write.operation === FileOperation.CREATE ? 'Created' : 'Modified'} ${file.split('/').pop()}`,
      });
    });
  });

  // Add tool calls
  if (session.toolCalls) {
    session.toolCalls.forEach((toolCall, idx) => {
      const toolType = getToolType(toolCall.toolName);
      events.push({
        id: `tool-${toolCall.toolName}-${toolCall.timestamp}-${idx}`,
        type: SessionEventType.TOOL,
        timestamp: toolCall.timestamp,
        toolName: toolCall.toolName,
        toolType,
        filePath: (toolCall.parameters?.file_path || toolCall.parameters?.path) as string | undefined,
        normalizedPath: toolCall.normalizedPath,
        fileName: toolCall.normalizedPath?.split('/').pop(),
        metadata: {
          ...toolCall.metadata,
          parameters: toolCall.parameters,
          toolInput: toolCall.toolInput,
          toolResponse: toolCall.toolResponse,
          duration: toolCall.duration,
          resultSize: toolCall.resultSize,
          error: toolCall.error,
        },
        color: getToolColor(toolCall.toolName),
        icon: getToolIcon(toolCall.toolName),
        description: getToolDescription(toolCall),
      });
    });
  }

  // Add stop events if requested
  if (options?.includeStops && session.stopEvents) {
    session.stopEvents.forEach((stopEvent, idx) => {
      events.push({
        id: `stop-${stopEvent.timestamp}-${idx}`,
        type: SessionEventType.STOP,
        timestamp: stopEvent.timestamp,
        metadata: stopEvent,
        color: '#F44336',
        icon: 'stop',
        description: `Session stopped (${stopEvent.trigger || 'manual'})`,
      });
    });
  }

  // Sort by timestamp
  events.sort((a, b) => b.timestamp - a.timestamp);

  // Apply limit if specified
  if (options?.limit) {
    return events.slice(0, options.limit);
  }

  return events;
}

// Group related events that happen close together
export function groupRelatedEvents(
  events: SessionEvent[],
  options?: {
    timeWindow?: number; // Time window in ms (default 1000)
    groupFileOperations?: boolean; // Whether to group file operations (default true)
  },
): SessionEvent[] {
  const timeWindow = options?.timeWindow ?? 1000;
  const groupFileOps = options?.groupFileOperations ?? true;

  if (!groupFileOps) {
    return events;
  }

  const groupedEvents: SessionEvent[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    if (usedIds.has(events[i].id)) continue;

    const currentEvent = events[i];

    // Check if this is a tool event that works on files
    if (
      currentEvent.type === SessionEventType.TOOL &&
      currentEvent.toolType &&
      [ToolType.READ, ToolType.WRITE, ToolType.EDIT].includes(
        currentEvent.toolType,
      ) &&
      currentEvent.normalizedPath
    ) {
      const relatedEvents = [currentEvent];
      usedIds.add(currentEvent.id);

      // Look for file events within time window that match this file
      for (let j = 0; j < events.length; j++) {
        if (i === j || usedIds.has(events[j].id)) continue;

        const otherEvent = events[j];
        const timeDiff = Math.abs(
          currentEvent.timestamp - otherEvent.timestamp,
        );

        if (
          timeDiff <= timeWindow &&
          (otherEvent.type === SessionEventType.FILE_READ ||
            otherEvent.type === SessionEventType.FILE_WRITE) &&
          otherEvent.normalizedPath === currentEvent.normalizedPath
        ) {
          relatedEvents.push(otherEvent);
          usedIds.add(otherEvent.id);
        }
      }

      if (relatedEvents.length > 1) {
        // Create a grouped event
        groupedEvents.push({
          id: `grouped-${currentEvent.id}`,
          type: SessionEventType.GROUPED,
          timestamp: Math.max(...relatedEvents.map((e) => e.timestamp)),
          filePath: currentEvent.filePath,
          normalizedPath: currentEvent.normalizedPath,
          fileName: currentEvent.fileName,
          toolName: relatedEvents.find((e) => e.toolName)?.toolName,
          toolType: relatedEvents.find((e) => e.toolType)?.toolType,
          color: currentEvent.color,
          icon: 'folder-group',
          description: `Multiple operations on ${currentEvent.fileName}`,
          metadata: {
            events: relatedEvents,
            operations: relatedEvents
              .map((e) => e.operation || e.toolName)
              .filter(Boolean),
          },
        });
      } else {
        groupedEvents.push(currentEvent);
      }
    } else if (!usedIds.has(currentEvent.id)) {
      // Check if this is a file event that might have a related tool
      if (
        (currentEvent.type === SessionEventType.FILE_READ ||
          currentEvent.type === SessionEventType.FILE_WRITE) &&
        currentEvent.normalizedPath
      ) {
        const relatedEvents = [currentEvent];
        usedIds.add(currentEvent.id);

        // Look for tool events within time window that match this file
        for (let j = 0; j < events.length; j++) {
          if (i === j || usedIds.has(events[j].id)) continue;

          const otherEvent = events[j];
          const timeDiff = Math.abs(
            currentEvent.timestamp - otherEvent.timestamp,
          );

          if (
            timeDiff <= timeWindow &&
            otherEvent.type === SessionEventType.TOOL &&
            otherEvent.toolType &&
            [ToolType.READ, ToolType.WRITE, ToolType.EDIT].includes(
              otherEvent.toolType,
            ) &&
            otherEvent.normalizedPath === currentEvent.normalizedPath
          ) {
            relatedEvents.push(otherEvent);
            usedIds.add(otherEvent.id);
          }
        }

        if (relatedEvents.length > 1) {
          // Create a grouped event with the tool event's info taking precedence
          const toolEvent = relatedEvents.find(
            (e) => e.type === SessionEventType.TOOL,
          );
          groupedEvents.push({
            id: `grouped-${currentEvent.id}`,
            type: SessionEventType.GROUPED,
            timestamp: Math.max(...relatedEvents.map((e) => e.timestamp)),
            filePath: currentEvent.filePath,
            normalizedPath: currentEvent.normalizedPath,
            fileName: currentEvent.fileName,
            toolName: toolEvent?.toolName || currentEvent.toolName,
            toolType: toolEvent?.toolType || currentEvent.toolType,
            color: toolEvent?.color || currentEvent.color,
            icon: 'folder-group',
            description: `Multiple operations on ${currentEvent.fileName}`,
            metadata: {
              events: relatedEvents,
              operations: relatedEvents
                .map((e) => e.operation || e.toolName)
                .filter(Boolean),
            },
          });
        } else {
          groupedEvents.push(currentEvent);
        }
      } else {
        // Add non-file events as-is
        groupedEvents.push(currentEvent);
      }
    }
  }

  return groupedEvents;
}

// Helper function for tool descriptions
function getToolDescription(toolCall: { 
  toolName?: string; 
  normalizedPath?: string; 
  metadata?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}): string {
  const fileName = toolCall.normalizedPath?.split('/').pop() || 'file';
  switch (toolCall.toolName) {
    case ToolName.READ:
      return `Read ${fileName}`;
    case ToolName.WRITE:
      return `Wrote to ${fileName}`;
    case ToolName.EDIT:
    case ToolName.MULTI_EDIT:
      return `Edited ${fileName}`;
    case ToolName.GREP:
      return `Searched for "${toolCall.parameters?.pattern || 'pattern'}"`;
    case ToolName.GLOB:
      return `Found files matching "${toolCall.parameters?.pattern || 'pattern'}"`;
    case ToolName.BASH:
      return `Ran command: ${(toolCall.parameters?.command as string)?.substring(0, 50) || 'bash'}...`;
    default:
      return `Used ${toolCall.toolName}`;
  }
}
