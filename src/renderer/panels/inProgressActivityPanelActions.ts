/**
 * Real `InProgressRepoCardActions` wiring backed by the renderer's
 * main-process-api services. Kept out of InProgressRepoCard.tsx so the card
 * stays importable in non-Electron environments (Storybook, tests).
 */

import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import type {
  InProgressAheadCommit,
  InProgressChangedFile,
  InProgressFileStatus,
  InProgressPushResult,
  InProgressRepoCardActions,
} from './InProgressRepoCard';

function pathsToFiles(
  paths: string[],
  status: InProgressFileStatus,
  staged: boolean,
): InProgressChangedFile[] {
  return paths.map((path) => ({
    path,
    status,
    additions: 0,
    deletions: 0,
    staged,
  }));
}

async function getWorkingChanges(repoPath: string): Promise<InProgressChangedFile[]> {
  const status = await RepositoryMonitoringService.getGitStatusWithFiles(repoPath);
  if (!status) return [];

  // Working tree modifications are in modifiedFiles; staged changes are in
  // stagedFiles. A file can appear in both (partially staged) — we surface
  // both rows so the card shows the full picture, distinguished by the
  // `staged` flag.
  const files: InProgressChangedFile[] = [];
  files.push(...pathsToFiles(status.stagedFiles, 'modified', true));
  files.push(...pathsToFiles(status.modifiedFiles, 'modified', false));
  files.push(...pathsToFiles(status.createdFiles, 'added', false));
  files.push(
    ...pathsToFiles(
      status.untrackedFiles.filter((p) => !status.createdFiles.includes(p)),
      'untracked',
      false,
    ),
  );
  files.push(...pathsToFiles(status.deletedFiles, 'deleted', false));
  return files;
}

/** Parse owner/repo from a git remote URL (SSH or HTTPS). */
function parseOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
  if (!remoteUrl) return null;
  let m = /git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  if (m) return { owner: m[1], repo: m[2] };
  m = /https?:\/\/[^/]+\/([^/]+)\/([^/.]+)(?:\.git)?/.exec(remoteUrl);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

/** `1234+user@users.noreply.github.com` (or `user@…`) → the GitHub login. */
function noreplyLogin(email: string | undefined | null): string | null {
  if (!email) return null;
  const m = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i.exec(email.trim());
  return m ? m[1] : null;
}

function avatarForLogin(login: string): string {
  return `https://github.com/${login}.png?size=64`;
}

let currentUserCache: { login: string; avatarUrl: string } | null | undefined;

/** The signed-in user's GitHub profile (login + avatar), cached for the session. */
async function getCurrentUserProfile(): Promise<{ login: string; avatarUrl: string } | null> {
  if (currentUserCache !== undefined) return currentUserCache;
  try {
    const u = await GithubService.getCurrentUser();
    currentUserCache = u?.avatar_url ? { login: u.login, avatarUrl: u.avatar_url } : null;
  } catch {
    currentUserCache = null;
  }
  return currentUserCache;
}

async function gitStdout(repoPath: string, args: string[]): Promise<string> {
  try {
    const res = await GitService.execCommand(repoPath, args);
    return res.stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Ahead = local, unpushed commits. Their author is usually the current user, so
 * match the commit email against the local git identity and use the signed-in
 * user's avatar; otherwise fall back to a GitHub noreply login, then initials.
 */
async function getAheadCommits(repoPath: string): Promise<InProgressAheadCommit[]> {
  const [commits, me, myEmail] = await Promise.all([
    GitService.getAheadCommits(repoPath),
    getCurrentUserProfile(),
    gitStdout(repoPath, ['config', 'user.email']),
  ]);
  const myEmailLower = myEmail.toLowerCase();

  return commits.map((c) => {
    let login: string | undefined;
    let avatarUrl: string | undefined;
    const email = c.email?.toLowerCase();
    if (me && myEmailLower && email === myEmailLower) {
      login = me.login;
      avatarUrl = me.avatarUrl;
    } else {
      const np = noreplyLogin(c.email);
      if (np) {
        login = np;
        avatarUrl = avatarForLogin(np);
      }
    }
    return {
      hash: c.hash,
      message: c.message,
      author: c.author,
      date: c.date,
      email: c.email,
      login,
      avatarUrl,
    };
  });
}

/**
 * Behind = commits the remote is ahead by. Prefer GitHub's own objects: compare
 * the merge-base against the upstream branch so authors + avatars come straight
 * from the remote. Falls back to the local `git log` list (noreply/initials)
 * when there's no GitHub remote, no token, or the compare call fails.
 */
async function getBehindCommits(repoPath: string): Promise<InProgressAheadCommit[]> {
  try {
    const [remoteUrl, upstream, mergeBase] = await Promise.all([
      gitStdout(repoPath, ['remote', 'get-url', 'origin']),
      gitStdout(repoPath, ['rev-parse', '--abbrev-ref', '@{u}']),
      gitStdout(repoPath, ['merge-base', 'HEAD', '@{u}']),
    ]);
    const ownerRepo = parseOwnerRepo(remoteUrl);
    if (ownerRepo && upstream && mergeBase) {
      const branch = upstream.includes('/')
        ? upstream.slice(upstream.indexOf('/') + 1)
        : upstream;
      const remoteCommits = await GithubService.compareCommits(
        ownerRepo.owner,
        ownerRepo.repo,
        mergeBase,
        branch,
      );
      if (remoteCommits.length > 0) {
        return remoteCommits.map((c) => ({
          hash: c.sha,
          message: c.message,
          author: c.authorLogin,
          date: c.committedAt,
          login:
            c.authorLogin && c.authorLogin !== 'unknown'
              ? c.authorLogin
              : undefined,
          avatarUrl: c.authorAvatarUrl,
        }));
      }
    }
  } catch (err) {
    console.warn(
      '[inProgressActivityPanelActions] Remote compare failed; using local behind commits:',
      err,
    );
  }

  const commits = await GitService.getBehindCommits(repoPath);
  return commits.map((c) => {
    const np = noreplyLogin(c.email);
    return {
      hash: c.hash,
      message: c.message,
      author: c.author,
      date: c.date,
      email: c.email,
      login: np ?? undefined,
      avatarUrl: np ? avatarForLogin(np) : undefined,
    };
  });
}

async function pushBranch(repoPath: string): Promise<InProgressPushResult> {
  const safety = await GitService.isPushSafe(repoPath);
  const result = await GitService.push(
    repoPath,
    safety.needsUpstream ? { setUpstream: true } : undefined,
  );
  return result;
}

export const inProgressActivityPanelActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: (repoPath) => RepositoryMonitoringService.getFileTree(repoPath),
  getWorkingChanges,
  getAheadCommits,
  getBehindCommits,
  pushBranch,
};
