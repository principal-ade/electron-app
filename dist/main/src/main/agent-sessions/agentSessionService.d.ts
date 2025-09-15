import { DirectorySessionsResult, SessionSummary } from '../services/store/types';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import type { TypedMultiStoreWrapper } from '../storage-providers';
import { AutoCommitStatus, StopTrigger } from '../../shared/sessionEnums';
export declare class AgentSessionService {
    private static instance;
    private storageManager;
    private gitService;
    private constructor();
    static getInstance(): AgentSessionService;
    getStorageManager(): Promise<TypedMultiStoreWrapper>;
    getGlobalSessions(): Promise<{
        sessions: Record<string, AgentSessionRecord>;
        activeSessionsByDirectory: Record<string, string>;
    }>;
    saveGlobalSessions(globalSessions: {
        sessions: Record<string, AgentSessionRecord>;
        activeSessionsByDirectory: Record<string, string>;
    }): Promise<void>;
    getUserPreferences(): Promise<{
        autoCommitOnStop: boolean;
    }>;
    updateUserPreferences(preferences: {
        autoCommitOnStop?: boolean;
    }): Promise<void>;
    private extractFilePathFromTool;
    private resolveAndNormalizePath;
    getSessionsForDirectory(directory: string): Promise<DirectorySessionsResult>;
    getSession(directory: string, sessionId: string): Promise<AgentSessionRecord | null>;
    upsertSession(directory: string, session: AgentSessionRecord): Promise<void>;
    setActiveSession(directory: string, sessionId: string | null): Promise<void>;
    addFileAccess(directory: string, sessionId: string, filePath: string, metadata?: any): Promise<void>;
    addFileWrite(directory: string, sessionId: string, filePath: string, operation: string, metadata?: any): Promise<void>;
    deleteSession(directory: string, sessionId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    clearSessionsForDirectory(directory: string): Promise<void>;
    getAllDirectories(): Promise<string[]>;
    getAllSessions(): Promise<{
        directory: string;
        sessions: AgentSessionRecord[];
    }[]>;
    getSessionSummaries(): Promise<{
        directory: string;
        summaries: SessionSummary[];
    }[]>;
    private checkAndSaveGitInfoIfMissing;
    addToolCall(directory: string, sessionId: string, toolName: string, parameters: any, toolInput?: any, toolResponse?: any, metadata?: any): Promise<void>;
    addStopEvent(directory: string, sessionId: string, trigger?: StopTrigger, reason?: string, metadata?: any): Promise<void>;
    watchStoreChanges(callback: (newValue: any, oldValue: any) => void): () => void;
    getBasicGitInfo(directory: string): Promise<{
        gitRoot: string;
        relativePath: string;
        githubOwner?: string;
        githubRepo?: string;
        remoteUrl?: string;
    } | null>;
    updateBasicGitInfo(directory: string, sessionId: string): Promise<void>;
    updateAutoCommitEnabled(directory: string, sessionId: string, enabled: boolean): Promise<void>;
    populateGitInfoForExistingSessions(): Promise<{
        updated: number;
        failed: number;
        total: number;
    }>;
    private notifyWindows;
    getSessionById(sessionId: string): Promise<AgentSessionRecord | null>;
    getSessionCommits(sessionId: string): Promise<Array<{
        timestamp: number;
        commitHash?: string;
        commitMessage?: string;
        filesCommitted?: string[];
        status: AutoCommitStatus;
        error?: string;
    }>>;
    getStopEventCommit(sessionId: string, stopTimestamp: number): Promise<{
        commitHash?: string;
        commitMessage?: string;
        filesCommitted?: string[];
        status: AutoCommitStatus;
        error?: string;
    } | null>;
    private performAutoCommit;
    private generateCommitMessage;
    clearGitRepositoryCache(): void;
    cleanupExpiredGitCache(): void;
    getGitRepositoryCacheInfo(): {
        size: number;
        entries: string[];
    };
    testGitRepositoryDetectionFresh(directory: string): Promise<{
        success: boolean;
        error?: string;
        gitRoot?: string;
        relativePath?: string;
        remotes?: any[];
        cacheInfo?: {
            size: number;
            entries: string[];
        };
    }>;
    testGitRepositoryDetection(directory: string): Promise<{
        success: boolean;
        error?: string;
        gitRoot?: string;
        relativePath?: string;
        remotes?: any[];
        cacheInfo?: {
            size: number;
            entries: string[];
        };
    }>;
    getUncommittedChangesForSegments(sessionId: string): Promise<{
        segments: Array<{
            timestamp: number;
            hasCommit: boolean;
        }>;
        changes: {
            created: string[];
            modified: string[];
            deleted: string[];
            renamed: Array<{
                from: string;
                to: string;
            }>;
            stats: {
                additions: number;
                deletions: number;
            };
        } | null;
        filesFromSegments: string[];
    }>;
    performManualCommit(sessionId: string, message: string, segmentTimestamps?: number[]): Promise<{
        success: boolean;
        commitHash?: string;
        error?: string;
        updatedSegments?: number[];
    }>;
    destroy(): void;
}
export declare const agentSessionService: AgentSessionService;
//# sourceMappingURL=agentSessionService.d.ts.map