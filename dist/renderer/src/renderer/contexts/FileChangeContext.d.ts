import React from 'react';
import { GitDetailedChanges } from '../main-process-api/GitService';
import { HighlightLayer } from "@principal-ai/code-city-react";
export interface FileChangeSource {
    id: string;
    path: string;
    type: 'git' | 'directory';
    name?: string;
}
export interface SourceFileChanges {
    source: FileChangeSource;
    gitChanges?: GitDetailedChanges;
    lastUpdated: number;
    watcherStatus: 'idle' | 'active' | 'paused' | 'error';
    error?: string;
}
export interface SessionFileActivity {
    sessionId: string;
    agentType: string;
    agentName?: string;
    filePath: string;
    absolutePath?: string;
    operations: Array<{
        type: 'read' | 'write' | 'edit';
        timestamp: number;
        tool?: string;
    }>;
    lastModified: number;
    isActive?: boolean;
}
export interface FileCollision {
    filePath: string;
    sourcePath: string;
    type: 'multi-agent' | 'git-conflict' | 'both';
    severity: 'low' | 'medium' | 'high';
    agents: Array<{
        sessionId: string;
        agentType: string;
        lastOperation: 'read' | 'write' | 'edit';
        timestamp: number;
    }>;
    gitStatus?: 'modified' | 'staged' | 'conflicted';
    description?: string;
}
export interface FileChangeContextValue {
    sources: Map<string, SourceFileChanges>;
    activeSourceId: string | null;
    registerSource: (source: FileChangeSource) => void;
    unregisterSource: (sourceId: string) => void;
    setActiveSource: (sourceId: string) => void;
    refreshSource: (sourceId: string) => Promise<void>;
    sessionFileActivities: Map<string, SessionFileActivity[]>;
    registerSessionActivity: (sourceId: string, activity: SessionFileActivity) => void;
    collisions: Map<string, FileCollision[]>;
    getHighlightLayers: (sourceId: string, options?: {
        showGitChanges?: boolean;
        showSessionChanges?: boolean;
        showUnattributed?: boolean;
        showCollisions?: boolean;
        activeSessionOnly?: boolean;
    }) => HighlightLayer[];
    pauseAllWatchers: () => void;
    resumeAllWatchers: () => void;
}
export declare const useFileChanges: () => FileChangeContextValue;
interface FileChangeProviderProps {
    children: React.ReactNode;
}
export declare const FileChangeProvider: React.FC<FileChangeProviderProps>;
export {};
//# sourceMappingURL=FileChangeContext.d.ts.map