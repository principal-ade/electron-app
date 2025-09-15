/**
 * Local git repository information
 * Represents a git repository on the local filesystem
 */
export interface LocalGitRepositoryInfo {
    root: string;
    branch: string;
    availableBranches?: string[];
}
/**
 * Remote repository information
 * Represents a properly configured remote repository
 */
export interface RemoteRepositoryInfo {
    url: string;
    defaultBranch: string;
    owner: string;
    repo: string;
}
/**
 * Complete repository git information for notes
 * Combines local git info with optional remote info
 */
export interface RepositoryGitInfo {
    root: string;
    branch: string;
    availableBranches?: string[];
    remote?: RemoteRepositoryInfo;
}
export interface LocalClone {
    path: string;
    addedAt: number;
    lastAccessed?: number;
    currentBranch?: string;
    lastCommit?: string;
    customAvatarPath?: string;
}
export type VCSType = 'github' | 'gitlab' | 'bitbucket' | 'generic';
export interface Repository {
    remoteUrl: string;
    vcsType: VCSType;
    owner: string;
    name: string;
    localClones: LocalClone[];
    addedAt: number;
    lastAccessed?: number;
    description?: string;
    avatarUrl?: string;
    customAvatarPath?: string;
    tags?: string[];
    manualTags?: string[];
    metadata?: {
        stars?: number;
        language?: string;
        topics?: string[];
        defaultBranch?: string;
        isPrivate?: boolean;
        isLocalOnly?: boolean;
        isFork?: boolean;
        license?: {
            key: string;
            name: string;
            spdxId: string;
            url?: string;
        };
        parentRepo?: {
            owner: string;
            name: string;
            url: string;
        };
    };
    isPrivate?: boolean;
    isFork?: boolean;
    isArchived?: boolean;
}
//# sourceMappingURL=repository.types.d.ts.map