/**
 * repoExplorerService — the explorer's data layer.
 *
 * The ported owner/repo page (web-ade) originally called its own Next server
 * (`fetch('/api/...')` + a tRPC client). In the desktop app we don't talk HTTP
 * to a backend — data comes over IPC. This module is the single seam: every
 * explorer data call goes through here, backed by the app's IPC services
 * (`GithubService`, and later `GitService` / `RepositoryMonitoringService`).
 *
 * Response shapes mirror what the ported components expect, so their code stays
 * close to the original. Endpoints without a native source yet are stubbed
 * (empty) and marked TODO — see the plan for issues / pull requests / packages /
 * commit detail / tours.
 */

import { GithubService } from '../../main-process-api/GithubService';

export interface RepoExplorerTreeEntry {
  path: string;
  type: string;
  size?: number;
}

export interface RepoExplorerTree {
  sha: string;
  tree: RepoExplorerTreeEntry[];
}

export interface RepoExplorerContributor {
  login: string;
  avatar_url: string;
  contributions: number;
}

export interface RepoExplorerContributors {
  contributors: RepoExplorerContributor[];
  truncated: boolean;
}

export interface RepoExplorerFileContent {
  content: string;
  encoding?: string;
}

export interface CommitAuthorIdentity {
  login: string;
  id: number;
  avatarUrl: string;
  htmlUrl: string;
  name?: string;
}

function decodeFileContent(data: {
  content?: string;
  encoding?: string;
} | null): string {
  if (!data) return '';
  if (data.content && data.encoding === 'base64') {
    try {
      const binary = atob(String(data.content).replace(/\n/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return '';
    }
  }
  return typeof data.content === 'string' ? data.content : '';
}

export const repoExplorerService = {
  /** Repository metadata (stars, license, language, topics, dates, fork-of). */
  async getRepoInfo(owner: string, repo: string) {
    return GithubService.getRepository(owner, repo);
  },

  /** Contributor list (login, avatar, commit count). */
  async getContributors(
    owner: string,
    repo: string,
  ): Promise<RepoExplorerContributors> {
    const list = await GithubService.getRepositoryContributors(owner, repo);
    return {
      contributors: list.map((c) => ({
        login: c.login,
        avatar_url: c.avatar_url,
        contributions: c.contributions,
      })),
      truncated: false,
    };
  },

  /**
   * Detected packages (Structure view / Architecture graph).
   * TODO: local repos → `RepositoryMonitoringService.getPackages(path)`; remote
   * repos → walk the tree + read manifests. Stubbed empty for now.
   */
  async getPackages(_owner: string, _repo: string) {
    return {
      packages: [] as unknown[],
      summary: { packageCount: 0, totalPackages: 0, packageManagers: [] },
    };
  },

  /** Default-branch (or `ref`) file tree for the city. */
  async getTree(owner: string, repo: string, ref = 'HEAD'): Promise<RepoExplorerTree> {
    const res = await GithubService.getTree(owner, repo, ref);
    const data = res?.data;
    return {
      sha: data?.sha ?? '',
      tree: (data?.tree ?? []).map((t) => ({
        path: t.path,
        type: t.type,
        size: t.size,
      })),
    };
  },

  /** Read a single file's text at HEAD (or `ref`). */
  async readFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<RepoExplorerFileContent> {
    const res = await GithubService.getFileContent(owner, repo, path, ref);
    return {
      content: decodeFileContent(res),
      encoding: (res as { encoding?: string } | null)?.encoding,
    };
  },

  /** Default-branch commit history, newest first. */
  async getCommits(
    owner: string,
    repo: string,
    opts?: { perPage?: number; page?: number },
  ) {
    const commits = await GithubService.getRepositoryCommits(owner, repo, opts);
    return { commits };
  },

  /**
   * Commit detail (message, author, parents, stats, changed files).
   * TODO: no native IPC for commit-by-sha yet — returns null so the commit view
   * stays idle. Add a `getCommit` IPC handler to fill this in.
   */
  async getCommitDetail(
    _owner: string,
    _repo: string,
    _sha: string,
  ): Promise<unknown | null> {
    return null;
  },

  /** Changed files for a commit (sha → status/additions/deletions). */
  async getChangedFiles(owner: string, repo: string, sha: string) {
    return GithubService.getChangedFilesForCommit(owner, repo, sha);
  },

  /** Overlay GitHub identity onto blame emails (contributor avatars). */
  async getCommitAuthorsByEmail(
    owner: string,
    repo: string,
    emails: string[],
  ): Promise<Record<string, CommitAuthorIdentity | null>> {
    const map = await GithubService.resolveAuthorProfiles(owner, repo, emails);
    const out: Record<string, CommitAuthorIdentity | null> = {};
    for (const [email, profile] of map.entries()) {
      out[email.toLowerCase()] = {
        login: profile.login,
        id: 0,
        avatarUrl: profile.avatarUrl,
        htmlUrl: `https://github.com/${profile.login}`,
      };
    }
    return out;
  },

  async isStarred(owner: string, repo: string): Promise<boolean> {
    return GithubService.isRepositoryStarred(owner, repo);
  },

  async star(owner: string, repo: string): Promise<void> {
    return GithubService.starRepository(owner, repo);
  },

  async unstar(owner: string, repo: string): Promise<void> {
    return GithubService.unstarRepository(owner, repo);
  },

  async searchRepos(query: string, opts?: { perPage?: number }) {
    return GithubService.searchRepos(query, opts);
  },

  async getUserOrganizations() {
    return GithubService.getUserOrganizations();
  },

  async getUserProfile(login: string) {
    return GithubService.getUser(login);
  },

  // ---------------------------------------------------------------------------
  // Not yet native — stubbed so the ported components render empty.
  // ---------------------------------------------------------------------------

  /** TODO: GitHub issues IPC. */
  async getIssues(_owner: string, _repo: string) {
    return { issues: [] as unknown[] };
  },

  /** TODO: GitHub issues IPC (single). */
  async getIssue(_owner: string, _repo: string, _n: number): Promise<unknown | null> {
    return null;
  },

  /** TODO: GitHub pull-requests IPC. */
  async getPullRequests(_owner: string, _repo: string) {
    return { pullRequests: [] as unknown[] };
  },

  /** TODO: GitHub pull-requests IPC (single + files). */
  async getPullRequest(
    _owner: string,
    _repo: string,
    _n: number,
  ): Promise<unknown | null> {
    return null;
  },

  /** TODO: tours store (`*.tour.json`). */
  async getTours(_owner: string, _repo: string) {
    return { tours: [] as unknown[] };
  },

  /**
   * TODO: tour audio generation (TTS) was hosted-only. No native source yet —
   * `beginTourGeneration` throws so the UI surfaces the error state rather than
   * silently doing nothing.
   */
  async beginTourGeneration(): Promise<never> {
    throw new Error('Tour audio generation is not available yet.');
  },
  async generateTourStep(): Promise<void> {},
  async finishTourGeneration(): Promise<unknown> {
    return null;
  },
  async batchGenerate(): Promise<{
    steps: Array<{ stepId: string; status: string; audioUrl: string }>;
  }> {
    return { steps: [] };
  },

  /** TODO: per-user activity (contributor profile heatmap). */
  async getUserActivity(_login: string): Promise<unknown | null> {
    return null;
  },
};
