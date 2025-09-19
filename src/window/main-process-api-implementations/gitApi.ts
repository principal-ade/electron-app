import { ipcRenderer } from 'electron';
import { GitEvents } from '../../shared/main-process-api-interfaces/GitAPI';
import { Repository } from '../../shared/types/repository.types';

export interface GitRepositoryInfo {
  root: string;
  relativePath: string;
  isRepository: boolean;
  remotes?: Array<{
    name: string;
    url: string;
    owner?: string;
    repo?: string;
  }>;
}

export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitDetailedChanges {
  created: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  stats: { additions: number; deletions: number };
  fileStats: Record<string, { additions: number; deletions: number }>;
}

export interface GitCommand {
  stdout: string;
  stderr: string;
}

export const gitAPI = {
  getRepositoryInfo: async (
    filePath: string,
  ): Promise<GitRepositoryInfo | null> => {
    return ipcRenderer.invoke(GitEvents.GET_REPOSITORY_INFO, filePath);
  },

  checkIfPrivateRepo: async (remoteUrl: string): Promise<boolean> => {
    return ipcRenderer.invoke(GitEvents.CHECK_IF_PRIVATE_REPO, remoteUrl);
  },

  getStatus: async (directory: string): Promise<GitStatus> => {
    return ipcRenderer.invoke(GitEvents.GET_STATUS, directory);
  },

  getDetailedChanges: async (
    directory: string,
    files?: string[],
  ): Promise<GitDetailedChanges> => {
    return ipcRenderer.invoke(GitEvents.GET_DETAILED_CHANGES, directory, files);
  },

  getUncommittedChanges: async (directory: string): Promise<string[]> => {
    return ipcRenderer.invoke(GitEvents.GET_UNCOMMITTED_CHANGES, directory);
  },

  stageFiles: async (directory: string, files: string[]): Promise<boolean> => {
    return ipcRenderer.invoke(GitEvents.STAGE_FILES, directory, files);
  },

  createCommit: async (directory: string, message: string): Promise<string> => {
    return ipcRenderer.invoke(GitEvents.CREATE_COMMIT, directory, message);
  },

  execCommand: async (
    directory: string,
    args: string[],
  ): Promise<GitCommand> => {
    return ipcRenderer.invoke(GitEvents.EXECUTE_COMMAND, directory, args);
  },

  cloneRepository: async (
    remoteUrl: string,
    targetPath: string,
  ): Promise<boolean> => {
    return ipcRenderer.invoke(
      GitEvents.CLONE_REPOSITORY,
      remoteUrl,
      targetPath,
    );
  },

  checkAuthMethods: async (
    remoteUrl: string,
  ): Promise<{
    ssh: { available: boolean; reason?: string };
    https: { available: boolean; reason?: string };
    suggestions: string[];
  }> => {
    return ipcRenderer.invoke(GitEvents.CHECK_AUTH_METHODS, remoteUrl);
  },

  deleteGitRepository: async (
    repoPath: string,
  ): Promise<{
    success: boolean;
    error?: string;
    hasUncommittedChanges?: boolean;
    unpushedCommits?: number;
    currentBranch?: string;
    requiresConfirmation?: boolean;
  }> => {
    return ipcRenderer.invoke(GitEvents.DELETE_GIT_REPOSITORY, repoPath);
  },

  forceDeleteGitRepository: async (
    repoPath: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return ipcRenderer.invoke(GitEvents.FORCE_DELETE_GIT_REPOSITORY, repoPath);
  },

  // Add listener for git status updates from GitRepositoryWatcher
  onStatusUpdate: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('git:status-update', handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('git:status-update', handler);
    };
  },

  // Event listeners for repository changes
  onRepositoryUpdated: (callback: (updatedRepo: Repository) => void) => {
    const handler = (_event: any, updatedRepo: Repository) =>
      callback(updatedRepo);
    ipcRenderer.on('repository:updated', handler);

    return () => {
      ipcRenderer.removeListener('repository:updated', handler);
    };
  },

  onRepositoryCloneAdded: (
    callback: (data: { repository: Repository; clonePath: string }) => void,
  ) => {
    const handler = (
      _event: any,
      data: { repository: Repository; clonePath: string },
    ) => callback(data);
    ipcRenderer.on('repository:clone-added', handler);

    return () => {
      ipcRenderer.removeListener('repository:clone-added', handler);
    };
  },

  onRepositoryCloneRemoved: (
    callback: (data: { repository: Repository; clonePath: string }) => void,
  ) => {
    const handler = (
      _event: any,
      data: { repository: Repository; clonePath: string },
    ) => callback(data);
    ipcRenderer.on('repository:clone-removed', handler);

    return () => {
      ipcRenderer.removeListener('repository:clone-removed', handler);
    };
  },

  onLocalCloneMissing: (callback: (data: { repoPath: string }) => void) => {
    const handler = (_event: any, data: { repoPath: string }) => callback(data);
    ipcRenderer.on('git:local-clone-missing', handler);

    return () => {
      ipcRenderer.removeListener('git:local-clone-missing', handler);
    };
  },
};
