import React from 'react';
import { FileTree } from "@principal-ai/repository-abstraction";
import { HighlightLayer } from "@principal-ai/code-city-react";
import { GitDetailedChanges } from '../main-process-api/GitService';
import { FileTreeSource } from '../types/file-tree-source';
/**
 * Git-specific state for a repository source
 */
export interface GitSourceState {
    sourceId: string;
    sourcePath: string;
    hasChanges: boolean;
    gitStatus?: GitDetailedChanges;
    lastStatusCheck: number;
    headTree?: FileTree;
    headCommitSha?: string;
    headLoadedAt?: number;
    hasNoCommits?: boolean;
    enabled: boolean;
    loading: boolean;
    error?: string;
}
/**
 * Git changes context value
 */
export interface GitChangesContextValue {
    gitStates: Map<string, GitSourceState>;
    checkGitStatus: (source: FileTreeSource) => Promise<GitDetailedChanges | null>;
    toggleGitChanges: (source: FileTreeSource, enabled: boolean) => Promise<void>;
    getGitState: (sourceId: string) => GitSourceState | undefined;
    getGitHighlightLayers: (sourceId: string, workingTree?: FileTree) => HighlightLayer[];
    refreshGitStatus: (sourceId: string) => Promise<void>;
    clearGitCache: (sourceId: string) => void;
    initializeLocalSource: (source: FileTreeSource) => Promise<void>;
    setGitChangesVisible: (sourceId: string, visible: boolean) => void;
}
export declare const useGitChanges: () => GitChangesContextValue;
interface GitChangesProviderProps {
    children: React.ReactNode;
}
export declare const GitChangesProvider: React.FC<GitChangesProviderProps>;
export {};
//# sourceMappingURL=GitChangesContext.d.ts.map