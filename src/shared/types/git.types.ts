export interface GitStatusMetadata {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
}

export interface FileChangeEvent {
  repoPath: string;
  type: 'add' | 'change' | 'unlink';
  path: string;
  isDirectory: boolean;
}

export interface GitInfo {
  root: string;
  remoteUrl?: string;
  branch?: string;
  defaultBranch?: string;
  availableBranches?: string[];
  owner?: string;
  repo?: string;
  headCommit?: string;
}

export interface BranchInfo {
  currentBranch?: string;
  defaultBranch?: string;
  availableBranches: string[];
  remotes: string[];
  currentCommit?: string;
  branchStatus?: {
    ahead: number;
    behind: number;
    upToDate: boolean;
  };
}

export interface GitStatus extends BranchInfo {
  path: string;
  lastUpdated: number;
  isStale: boolean;
  isRefreshing: boolean;
}
