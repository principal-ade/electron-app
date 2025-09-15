import { FileTree } from "@principal-ai/repository-abstraction";
/**
 * File Tree Source Model
 *
 * Simplified source model for managing multiple file trees from different sources.
 * Focuses on the primary use cases: local clones and remote branches (mainly GitHub).
 */
export type SourceType = 'local' | 'remote';
export type LocationType = 'path' | 'branch' | 'tag' | 'commit' | 'working';
export type ProviderType = 'github' | 'gitlab' | 'generic' | 'local';
/**
 * Core file tree source descriptor
 * Represents a source that can be resolved to a FileSystemTree
 */
export interface FileTreeSource {
    id: string;
    type: SourceType;
    owner: string;
    name: string;
    remoteUrl: string;
    location: string;
    locationType: LocationType;
    label: string;
    color?: string;
    icon?: string;
    isTemporary?: boolean;
    isDefault?: boolean;
    lastAccessed?: number;
    createdAt?: number;
    provider?: ProviderType;
    apiUrl?: string;
    metadata?: {
        currentBranch?: string;
        commitSha?: string;
        isDirty?: boolean;
        subdir?: string;
        [key: string]: any;
    };
}
export interface FileTreeStats {
    fileCount: number;
    directoryCount: number;
    loadedAt: number;
}
/**
 * Extended source with loaded tree data
 */
export interface LoadedFileTreeSource extends FileTreeSource {
    tree: FileTree;
    treeStats: FileTreeStats;
    filterLayers?: any[];
}
/**
 * Factory functions for creating sources
 */
export declare const createFileTreeSource: {
    /**
     * Create a local file tree source (working copy)
     */
    localWorkingCopy(path: string, owner: string, repo: string, remoteUrl: string, currentBranch?: string): FileTreeSource;
    /**
     * Create a remote branch source (GitHub, etc.)
     */
    remoteBranch(owner: string, repo: string, remoteUrl: string, branch: string, provider?: ProviderType): FileTreeSource;
    /**
     * Create a remote tag source
     */
    remoteTag(owner: string, repo: string, remoteUrl: string, tag: string, provider?: ProviderType): FileTreeSource;
    /**
     * Create a remote commit source
     */
    remoteCommit(owner: string, repo: string, remoteUrl: string, commitSha: string, provider?: ProviderType): FileTreeSource;
    /**
     * Create a temporary/experimental source
     */
    temporary(baseSource: FileTreeSource, location: string, locationType: LocationType): FileTreeSource;
};
/**
 * Type guards
 */
export declare const isLocalSource: (source: FileTreeSource) => boolean;
export declare const isRemoteSource: (source: FileTreeSource) => boolean;
export declare const isTemporarySource: (source: FileTreeSource) => boolean;
export declare const isGitHubSource: (source: FileTreeSource) => boolean;
/**
 * Utility functions
 */
export declare function getSourceDisplayName(source: FileTreeSource): string;
export declare function getSourceIdentifier(source: FileTreeSource): string;
export declare function shouldCacheSource(source: FileTreeSource): boolean;
export declare function getSourceCacheTTL(source: FileTreeSource): number;
/**
 * Source comparison for sorting
 */
export declare function compareFileTreeSources(a: FileTreeSource, b: FileTreeSource): number;
//# sourceMappingURL=file-tree-source.d.ts.map