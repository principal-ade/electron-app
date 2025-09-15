/**
 * Centralized types for session visualization
 */
import { SessionEventType, ToolType, FileOperation, LastEventType, EventActivityType, StopTrigger, AutoCommitStatus } from './sessionEnums';
export interface AgentSessionRecord {
    sessionId: string;
    workingDirectory: string;
    firstAccess: number;
    lastActivity: number;
    eventCount?: number;
    lastEventType?: LastEventType;
    lastStopTime?: number;
    reviewedLastStop: boolean;
    autoCommitEnabled?: boolean;
    metadata?: Record<string, unknown>;
    commitMessage?: string;
    workspaceBoundaries?: Array<{
        rootPath: string;
        [key: string]: unknown;
    }>;
    fileAccesses: Record<string, Array<{
        timestamp: number;
        normalizedPath?: string;
        metadata?: Record<string, unknown>;
    }>>;
    fileWrites: Record<string, Array<{
        timestamp: number;
        operation: FileOperation | string;
        normalizedPath?: string;
        metadata?: Record<string, unknown>;
    }>>;
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
        toolInput?: unknown;
        toolResponse?: unknown;
        normalizedPath?: string;
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
    basicGitInfo?: {
        gitRoot: string;
        relativePath: string;
        githubOwner?: string;
        githubRepo?: string;
        remoteUrl?: string;
    };
    lastEvent?: {
        type: EventActivityType;
        fileName?: string;
        filePath?: string;
        toolName?: string;
        timestamp: number;
        metadata?: Record<string, unknown>;
    };
    lastToolActivity?: {
        type: 'read' | 'write' | 'edit';
        fileName: string;
        filePath?: string;
        timestamp: number;
    };
    repositories?: Array<{
        root: string;
        rootDisplay?: string;
        fileCount: number;
        packages: Array<{
            path: string;
            pathDisplay?: string;
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
export interface SessionEvent {
    id: string;
    type: SessionEventType;
    timestamp: number;
    filePath?: string;
    normalizedPath?: string;
    fileName?: string;
    toolName?: string;
    toolType?: ToolType;
    operation?: FileOperation | string;
    metadata?: Record<string, unknown>;
    color?: string;
    icon?: string;
    description?: string;
}
export interface GroupedSessionEvent extends SessionEvent {
    type: SessionEventType.GROUPED;
    metadata: {
        events: SessionEvent[];
        operations: string[];
    };
}
export interface ProcessedSessionEvent {
    event: SessionEvent;
    filePath: string;
    normalizedPath: string;
    tool: string;
}
export interface SessionVisualizationState {
    events: ProcessedSessionEvent[];
    currentEventIndex: number;
    isPlaying: boolean;
    playbackSpeed: number;
    readPaths: Set<string>;
    writePaths: Set<string>;
    currentAction: {
        action: string;
        filename: string;
        tool: string;
        count?: number;
    } | null;
}
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
export declare function createSessionEvents(session: AgentSessionRecord, options?: {
    includeStops?: boolean;
    limit?: number;
}): SessionEvent[];
export declare function groupRelatedEvents(events: SessionEvent[], options?: {
    timeWindow?: number;
    groupFileOperations?: boolean;
}): SessionEvent[];
//# sourceMappingURL=sessionTypes.d.ts.map