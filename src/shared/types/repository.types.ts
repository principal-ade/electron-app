import type { AlexandriaEntry } from '@a24z/core-library';

/**
 * Local clone information for a repository
 */
export interface LocalClone {
  path: string; // Local directory path
  addedAt: number; // When this local clone was added
  lastAccessed?: number; // Last time this specific clone was accessed
  currentBranch?: string; // Current branch (fetched dynamically when needed)
  lastCommit?: string; // Last commit hash (fetched dynamically when needed)
  customAvatarPath?: string; // Clone-specific custom avatar filename (stored in userData/repository-avatars/)
}

/**
 * Enhanced Alexandria repository entry with git status information
 */
export interface EnhancedAlexandriaEntry extends AlexandriaEntry {
  id?: string | number;
  repoId?: string | number;
  repositoryId?: string | number;
  alexandriaId?: string | number;
  gitBranch?: string;
  isDirty?: boolean;
  dirtyFileCount?: number;
  mostRecentChange?: string; // Most recent file modification time if dirty, otherwise last commit
  lastCommitMessage?: string;
  lastCommitAuthor?: string;
  lastCommitHash?: string;
  localClones?: LocalClone[]; // All local paths where this repo is cloned
}

/**
 * Git status information for a repository
 */
export interface GitStatus {
  staged: Array<{ path: string; lastModified?: string }>;
  unstaged: Array<{ path: string; lastModified?: string }>;
  untracked: Array<{ path: string; lastModified?: string }>;
  deleted: Array<{ path: string; lastModified?: string }>;
}

export type GitChangeSelectionStatus =
  | 'staged'
  | 'unstaged'
  | 'untracked'
  | 'deleted';

/**
 * Local git repository information
 * Represents a git repository on the local filesystem
 */
export interface LocalGitRepositoryInfo {
  root: string; // Git repository root path
  branch: string; // Current branch
  availableBranches?: string[]; // Available branches (when fetched)
}

/**
 * Remote repository information
 * Represents a properly configured remote repository
 */
export interface RemoteRepositoryInfo {
  url: string; // Remote URL
  defaultBranch: string; // Default branch as configured on the remote
  owner: string; // Repository owner
  repo: string; // Repository name
}

/**
 * Complete repository git information for notes
 * Combines local git info with optional remote info
 */
export interface RepositoryGitInfo {
  root: string; // Git repository root path
  branch: string; // Current branch
  availableBranches?: string[]; // Available branches (when fetched)
  remote?: RemoteRepositoryInfo; // Remote information (if properly configured and parseable)
}

export type VCSType = 'github' | 'gitlab' | 'bitbucket' | 'generic';

export interface Repository {
  // Remote repository identification
  remoteUrl: string; // Primary identifier - the remote URL (normalized)
  vcsType: VCSType; // Version control system type
  owner: string; // Repository owner/organization
  name: string; // Repository name

  // Local clones of this repository
  localClones: LocalClone[]; // All local paths where this repo is cloned

  // Metadata
  addedAt: number; // When first added to the system
  lastAccessed?: number; // Last time any clone was accessed
  description?: string; // Repository description
  avatarUrl?: string; // Owner's avatar URL
  customAvatarPath?: string; // Repository-level custom avatar filename (stored in userData/repository-avatars/)

  // Tags for filtering and organization
  tags?: string[]; // Both auto-generated and user-defined tags
  manualTags?: string[]; // Only user-defined tags (subset of tags)

  // Platform-specific metadata (optional, fetched from API)
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

  // Convenience getters for metadata (to avoid optional chaining everywhere)
  isPrivate?: boolean;
  isFork?: boolean;
  isArchived?: boolean;
}
