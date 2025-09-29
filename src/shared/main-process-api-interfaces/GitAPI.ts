import type { GitStatus, Repository } from '../types/repository.types';

export enum GitEvents {
  GET_REPOSITORY_INFO = 'git:get-repository-info',
  CHECK_IF_PRIVATE_REPO = 'git:check-if-private-repo',
  GET_STATUS = 'git:get-status',
  GET_DETAILED_CHANGES = 'git:get-detailed-changes',
  GET_UNCOMMITTED_CHANGES = 'git:get-uncommitted-changes',
  EXECUTE_COMMAND = 'git:exec-command',
  CLONE_REPOSITORY = 'git:clone-repository',
  CHECK_AUTH_METHODS = 'git:check-auth-methods',
  DELETE_GIT_REPOSITORY = 'git:delete-git-repository',
  FORCE_DELETE_GIT_REPOSITORY = 'git:force-delete-git-repository',
}

export interface GitAPI {
  getRepositoryInfo: (filePath: string) => Promise<{
    root: string;
    relativePath: string;
    isRepository: boolean;
    remotes?: Array<{
      name: string;
      url: string;
      owner?: string;
      repo?: string;
    }>;
  } | null>;
  checkIfPrivateRepo: (remoteUrl: string) => Promise<boolean>;
  getStatus: (directory: string) => Promise<{
    staged: string[];
    unstaged: string[];
    untracked: string[];
  }>;
  getDetailedChanges: (
    directory: string,
    files?: string[],
  ) => Promise<{
    created: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
    stats: { additions: number; deletions: number };
    fileStats: Record<string, { additions: number; deletions: number }>;
  }>;
  getUncommittedChanges: (directory: string) => Promise<string[]>;
  execCommand: (
    directory: string,
    args: string[],
  ) => Promise<{
    stdout: string;
    stderr: string;
  }>;
  cloneRepository: (remoteUrl: string, targetPath: string) => Promise<boolean>;
  checkAuthMethods: (remoteUrl: string) => Promise<{
    ssh: { available: boolean; reason?: string };
    https: { available: boolean; reason?: string };
    suggestions: string[];
  }>;
  deleteGitRepository: (repoPath: string) => Promise<{
    success: boolean;
    error?: string;
    hasUncommittedChanges?: boolean;
    unpushedCommits?: number;
    currentBranch?: string;
    requiresConfirmation?: boolean;
  }>;
  forceDeleteGitRepository: (repoPath: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  onStatusUpdate?: (callback: (status: GitStatus) => void) => () => void;

  // Event listeners for repository changes
  onRepositoryUpdated: (
    callback: (updatedRepo: Repository) => void,
  ) => () => void;
  onRepositoryCloneAdded: (
    callback: (data: { repository: Repository; clonePath: string }) => void,
  ) => () => void;
  onRepositoryCloneRemoved: (
    callback: (data: { repository: Repository; clonePath: string }) => void,
  ) => () => void;
  onLocalCloneMissing: (
    callback: (data: { repoPath: string }) => void,
  ) => () => void;
}
