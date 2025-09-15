import { GitAdapter } from "@principal-ai/codebase-composition";

// Define the return type locally since it was imported from workspace
type GitRepositoryInfo = {
  isGitRepository: boolean;
  currentBranch?: string;
  owner?: string;
  repo?: string;
};

export class GitHubGitAdapter implements GitAdapter {
  constructor(
    private owner: string,
    private repo: string,
    private branch?: string,
  ) {}

  async detectRepository(_path: string): Promise<GitRepositoryInfo | null> {
    return {
      isGitRepository: true,
      currentBranch: this.branch,
      owner: this.owner,
      repo: this.repo,
    };
  }

  async watchGitRepository(_path: string): Promise<boolean> {
    return false;
  }

  async stopWatchingGit(): Promise<void> {
    // No-op for remote GitHub repos
  }

  onGitStatusChange(_callback: (data: {
    changedFiles: Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted' | 'renamed';
      lastModified?: Date;
    }>;
  }) => void): () => void {
    return () => {};
  }
} 