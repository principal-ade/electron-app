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
 * (empty) and marked TODO.
 *
 * The implementation is swappable (`setRepoExplorerServiceImpl`) so Storybook —
 * which has no Electron main process — can render against fixtures.
 */

import { GithubService } from '../../main-process-api/GithubService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { findClonedGithubEntry } from '../../utils/alexandriaIdentity';

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
  id?: number;
  html_url?: string;
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

export interface RepoExplorerServiceImpl {
  getRepoInfo(owner: string, repo: string): Promise<any>;
  getContributors(
    owner: string,
    repo: string,
  ): Promise<RepoExplorerContributors>;
  getPackages(owner: string, repo: string): Promise<any>;
  getTree(owner: string, repo: string, ref?: string): Promise<RepoExplorerTree>;
  readFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<RepoExplorerFileContent>;
  getCommits(
    owner: string,
    repo: string,
    opts?: { perPage?: number; page?: number },
  ): Promise<{ commits: unknown[] }>;
  getCommitDetail(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<unknown | null>;
  getChangedFiles(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<Map<string, { status: string; additions: number; deletions: number }>>;
  getCommitAuthorsByEmail(
    owner: string,
    repo: string,
    emails: string[],
  ): Promise<Record<string, CommitAuthorIdentity | null>>;
  isStarred(owner: string, repo: string): Promise<boolean>;
  star(owner: string, repo: string): Promise<void>;
  unstar(owner: string, repo: string): Promise<void>;
  searchRepos(query: string, opts?: { perPage?: number }): Promise<any>;
  getUserOrganizations(): Promise<any>;
  getUserProfile(login: string): Promise<unknown | null>;
  getIssues(owner: string, repo: string): Promise<{ issues: unknown[] }>;
  getIssue(owner: string, repo: string, n: number): Promise<unknown | null>;
  getPullRequests(
    owner: string,
    repo: string,
  ): Promise<{ pullRequests: unknown[] }>;
  getPullRequest(
    owner: string,
    repo: string,
    n: number,
  ): Promise<unknown | null>;
  getPullRequestFiles(
    owner: string,
    repo: string,
    n: number,
  ): Promise<unknown[]>;
  getTours(owner: string, repo: string): Promise<{ tours: unknown[] }>;
  beginTourGeneration(): Promise<never>;
  generateTourStep(): Promise<void>;
  finishTourGeneration(): Promise<any>;
  batchGenerate(): Promise<{
    steps: Array<{ stepId: string; status: string; audioUrl: string }>;
  }>;
  getUserActivity(login: string): Promise<unknown | null>;
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

/** Default (desktop) implementation — backed by the app's GitHub IPC. */
const ipcImpl: RepoExplorerServiceImpl = {
  async getRepoInfo(owner, repo) {
    return GithubService.getRepository(owner, repo);
  },

  async getContributors(owner, repo) {
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

  // Local (cloned) repos: resolve owner/repo to its checkout via the Alexandria
  // registry and reuse the monitoring worker's package discovery — the same
  // path SystemMonitor uses. That runs PackageLayerModule (+ optional quality
  // enrichment) over the checkout and returns real PackageLayer[].
  //
  // Remote (un-cloned) repos still have no source here; they'd need a tree walk
  // + manifest read (PackageLayerModule.discoverPackages with the GitHub tree).
  async getPackages(owner, repo) {
    try {
      const entries = await AlexandriaService.getRepositories();
      const entry = findClonedGithubEntry(entries, owner, repo);
      const localPath =
        typeof entry?.path === 'string' && entry.path.length > 0
          ? entry.path
          : undefined;

      if (localPath) {
        const result = await RepositoryMonitoringService.getPackages(localPath);
        if (result) {
          return { packages: result.packages, summary: result.summary };
        }
      }
    } catch (err) {
      console.error(
        `[repoExplorerService] getPackages(${owner}/${repo}) local lookup failed:`,
        err,
      );
    }

    // TODO: remote repos → walk the tree + read manifests via
    // PackageLayerModule.discoverPackages(fileTree, fileReader).
    return {
      packages: [] as unknown[],
      summary: { packageCount: 0, totalPackages: 0, packageManagers: [] },
    };
  },

  async getTree(owner, repo, ref = 'HEAD') {
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

  async readFile(owner, repo, path, ref) {
    const res = await GithubService.getFileContent(owner, repo, path, ref);
    // The main-process handler returns the raw file text (a string). Be
    // defensive about a `{ content, encoding }` shape too (some paths/tests).
    if (typeof res === 'string') return { content: res };
    return {
      content: decodeFileContent(res),
      encoding: (res as { encoding?: string } | null)?.encoding,
    };
  },

  async getCommits(owner, repo, opts) {
    const commits = await GithubService.getRepositoryCommits(owner, repo, opts);
    return { commits };
  },

  async getCommitDetail(owner, repo, sha) {
    return GithubService.getCommit(owner, repo, sha);
  },

  async getChangedFiles(owner, repo, sha) {
    return GithubService.getChangedFilesForCommit(owner, repo, sha) as Promise<
      Map<string, { status: string; additions: number; deletions: number }>
    >;
  },

  async getCommitAuthorsByEmail(owner, repo, emails) {
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

  isStarred: (owner, repo) => GithubService.isRepositoryStarred(owner, repo),
  star: (owner, repo) => GithubService.starRepository(owner, repo),
  unstar: (owner, repo) => GithubService.unstarRepository(owner, repo),
  searchRepos: (query, opts) => GithubService.searchRepos(query, opts),
  getUserOrganizations: () => GithubService.getUserOrganizations(),
  getUserProfile: (login) => GithubService.getUser(login),

  // ---- not yet native — stubbed so the ported components render empty ----
  async getIssues(owner, repo) {
    const issues = await GithubService.getIssues(owner, repo, {
      state: 'open',
      perPage: 30,
      page: 1,
    });
    return { issues };
  },
  async getIssue(owner, repo, number) {
    return GithubService.getIssue(owner, repo, number);
  },
  async getPullRequests(owner, repo) {
    const pullRequests = await GithubService.getPullRequests(owner, repo, {
      state: 'open',
      perPage: 30,
      page: 1,
    });
    return { pullRequests };
  },
  async getPullRequest(owner, repo, number) {
    return GithubService.getPullRequest(owner, repo, number);
  },
  async getPullRequestFiles(owner, repo, number) {
    return GithubService.getPullRequestFiles(owner, repo, number);
  },
  async getTours(_owner, _repo) {
    return { tours: [] as unknown[] };
  },
  async beginTourGeneration(): Promise<never> {
    throw new Error('Tour audio generation is not available yet.');
  },
  async generateTourStep() {},
  async finishTourGeneration() {
    return null;
  },
  async batchGenerate() {
    return { steps: [] };
  },
  async getUserActivity(_login) {
    return null;
  },
};

let impl: RepoExplorerServiceImpl = ipcImpl;

/** Swap the implementation (Storybook / tests). */
export function setRepoExplorerServiceImpl(next: RepoExplorerServiceImpl): void {
  impl = next;
}

/**
 * Public API. Delegates to the current impl so the impl can be swapped without
 * re-importing call sites.
 */
export const repoExplorerService: RepoExplorerServiceImpl = new Proxy(
  {} as RepoExplorerServiceImpl,
  {
    get: (_target, prop: string) =>
      (impl as unknown as Record<string, unknown>)[prop],
  },
);
