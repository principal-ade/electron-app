/**
 * Main-process owner of the pull request watch list.
 *
 * Watches are persistent and independent of any window or agent: an agent
 * adds a PR over the bridge and may be long gone when CI finishes, so nothing
 * here is reference-counted. One timer polls every open PR, diffs the new
 * snapshot against the stored one, broadcasts `pr-watch:changed` to every
 * window, and raises a native notification on the transitions a user cares
 * about. Merged and closed PRs stay visible for a day, then expire.
 */

import { EventEmitter } from 'events';
import { Notification, shell } from 'electron';
import {
  PullRequestWatchEvents,
  type PullRequestChecksSummary,
  type PullRequestReviewState,
  type PullRequestWatchResult,
  type WatchedPullRequest,
  type WatchedPullRequestState,
} from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
import { applicationWindows } from '../window/modernWindowManager';
import {
  MAX_WATCHED_PULL_REQUESTS,
  PullRequestWatchStore,
} from './PullRequestWatchStore';
import {
  parsePullRequestTarget,
  type PullRequestTarget,
} from './pullRequestTarget';

export const POLL_INTERVAL_MS = 60_000;
/** How long a merged or closed PR stays in the list before it expires. */
export const TERMINAL_RETENTION_MS = 24 * 60 * 60 * 1000;

/** The subset of the GitHub pull request payload this watcher reads. */
interface GitHubPullRequestLike {
  title?: unknown;
  state?: unknown;
  merged?: unknown;
  merged_at?: unknown;
  closed_at?: unknown;
  draft?: unknown;
  mergeable?: unknown;
  html_url?: unknown;
  user?: { login?: unknown } | null;
  head?: { sha?: unknown; ref?: unknown } | null;
  base?: { ref?: unknown } | null;
  requested_reviewers?: unknown;
  requested_teams?: unknown;
}

export interface PullRequestFetcher {
  getPullRequest(owner: string, repo: string, number: number): Promise<unknown>;
  getPullRequestReviews(
    owner: string,
    repo: string,
    number: number,
  ): Promise<unknown[]>;
  getCommitCheckRuns(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<unknown[]>;
  getCommitStatus(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<{ state: string; statuses: unknown[] } | null>;
}

export interface PullRequestWatcherOptions {
  store?: PullRequestWatchStore;
  fetcher?: PullRequestFetcher;
  notify?: (notice: { title: string; body: string; url: string }) => void;
  now?: () => number;
}

export class PullRequestWatcher extends EventEmitter {
  private readonly store: PullRequestWatchStore;
  private readonly fetcher: PullRequestFetcher;
  private readonly notify: (notice: {
    title: string;
    body: string;
    url: string;
  }) => void;
  private readonly now: () => number;
  private pullRequests: WatchedPullRequest[];
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(options: PullRequestWatcherOptions = {}) {
    super();
    this.store = options.store ?? new PullRequestWatchStore();
    this.fetcher = options.fetcher ?? new GitHubAdapter();
    this.notify = options.notify ?? showNativeNotification;
    this.now = options.now ?? Date.now;
    this.pullRequests = this.store.load();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.pollAll(), POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.pollAll();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  list(): WatchedPullRequest[] {
    return this.pullRequests.map((entry) => ({ ...entry }));
  }

  async watch(target: unknown): Promise<PullRequestWatchResult> {
    const parsed =
      typeof target === 'object' && target !== null && 'id' in target
        ? (target as PullRequestTarget)
        : parsePullRequestTarget(target);
    if (!parsed) {
      return {
        success: false,
        error:
          'pr must be a GitHub pull request URL, owner/repo#number, or owner/repo/pull/number',
      };
    }
    const existing = this.pullRequests.find((entry) => entry.id === parsed.id);
    if (existing) {
      const refreshed = await this.poll(existing);
      return { success: true, pullRequest: refreshed };
    }
    if (this.pullRequests.length >= MAX_WATCHED_PULL_REQUESTS) {
      return {
        success: false,
        error: `Watch list is full (${MAX_WATCHED_PULL_REQUESTS}). Unwatch a pull request before adding another.`,
      };
    }
    const now = this.now();
    const placeholder: WatchedPullRequest = {
      id: parsed.id,
      owner: parsed.owner,
      repo: parsed.repo,
      number: parsed.number,
      url: parsed.url,
      title: `#${parsed.number}`,
      state: 'open',
      draft: false,
      checks: emptyChecks(),
      review: 'none',
      addedAt: now,
      updatedAt: now,
    };
    const snapshot = await this.fetchSnapshot(placeholder);
    if (!snapshot) {
      return {
        success: false,
        error: `Could not load ${parsed.owner}/${parsed.repo}#${parsed.number}. Check that it exists and that GitHub access is configured.`,
      };
    }
    const entry = { ...snapshot, lastPolledAt: now };
    this.pullRequests = [...this.pullRequests, entry];
    this.persist();
    return { success: true, pullRequest: { ...entry } };
  }

  unwatch(id: string): { success: boolean; error?: string } {
    if (!this.pullRequests.some((entry) => entry.id === id)) {
      return { success: false, error: 'Unknown watched pull request.' };
    }
    this.pullRequests = this.pullRequests.filter((entry) => entry.id !== id);
    this.persist();
    return { success: true };
  }

  async refresh(id?: string): Promise<WatchedPullRequest[]> {
    if (id === undefined) {
      await this.pollAll(true);
    } else {
      const entry = this.pullRequests.find((candidate) => candidate.id === id);
      if (entry) await this.poll(entry);
    }
    return this.list();
  }

  private async pollAll(includeTerminal = false): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      this.expireTerminal();
      // Sequential on purpose: the list shares one GitHub rate-limit budget
      // with everything else the app does.
      for (const entry of [...this.pullRequests]) {
        if (!includeTerminal && entry.state !== 'open') continue;
        if (!this.pullRequests.includes(entry)) continue;
        await this.poll(entry);
      }
    } finally {
      this.polling = false;
    }
  }

  private expireTerminal(): void {
    const cutoff = this.now() - TERMINAL_RETENTION_MS;
    const kept = this.pullRequests.filter(
      (entry) =>
        entry.state === 'open' ||
        entry.closedAt === undefined ||
        entry.closedAt > cutoff,
    );
    if (kept.length !== this.pullRequests.length) {
      this.pullRequests = kept;
      this.persist();
    }
  }

  private async poll(entry: WatchedPullRequest): Promise<WatchedPullRequest> {
    const polledAt = this.now();
    let next: WatchedPullRequest;
    const snapshot = await this.fetchSnapshot(entry);
    if (!snapshot) {
      next = {
        ...entry,
        lastPolledAt: polledAt,
        pollError: 'Could not reach GitHub for this pull request.',
      };
    } else {
      const changed = snapshotChanged(entry, snapshot);
      next = {
        ...snapshot,
        lastPolledAt: polledAt,
        updatedAt: changed ? polledAt : entry.updatedAt,
      };
      if (changed) this.announceTransitions(entry, next);
    }
    // The entry may have been unwatched while the fetch was in flight.
    const index = this.pullRequests.findIndex(
      (candidate) => candidate.id === entry.id,
    );
    if (index === -1) return next;
    this.pullRequests = this.pullRequests.map((candidate, position) =>
      position === index ? next : candidate,
    );
    this.persist();
    return { ...next };
  }

  private async fetchSnapshot(
    entry: WatchedPullRequest,
  ): Promise<WatchedPullRequest | null> {
    const { owner, repo, number } = entry;
    let raw: unknown;
    try {
      raw = await this.fetcher.getPullRequest(owner, repo, number);
    } catch (error) {
      console.warn('[PullRequestWatch] Pull request fetch failed:', error);
      return null;
    }
    if (!raw || typeof raw !== 'object') return null;
    const pr = raw as GitHubPullRequestLike;
    const headSha = typeof pr.head?.sha === 'string' ? pr.head.sha : undefined;
    const state = stateOf(pr);

    // Checks and reviews stop mattering once a PR is merged or closed; keep
    // the last known values rather than spend requests on them.
    let checks = entry.checks;
    let review = entry.review;
    if (state === 'open') {
      const [checkRuns, status, reviews] = await Promise.all([
        headSha
          ? this.fetcher
              .getCommitCheckRuns(owner, repo, headSha)
              .catch(() => [])
          : Promise.resolve([]),
        headSha
          ? this.fetcher.getCommitStatus(owner, repo, headSha).catch(() => null)
          : Promise.resolve(null),
        this.fetcher.getPullRequestReviews(owner, repo, number).catch(() => []),
      ]);
      checks = summarizeChecks(checkRuns, status);
      review = summarizeReviews(
        reviews,
        pr,
        typeof pr.user?.login === 'string' ? pr.user.login : undefined,
      );
    }

    const closedAt =
      state === 'open'
        ? undefined
        : (entry.closedAt ??
          timestampOf(pr.merged_at) ??
          timestampOf(pr.closed_at) ??
          this.now());

    return {
      id: entry.id,
      owner,
      repo,
      number,
      url: typeof pr.html_url === 'string' ? pr.html_url : entry.url,
      title: typeof pr.title === 'string' ? pr.title : entry.title,
      author: typeof pr.user?.login === 'string' ? pr.user.login : entry.author,
      state,
      draft: pr.draft === true,
      headSha,
      headRef: typeof pr.head?.ref === 'string' ? pr.head.ref : undefined,
      baseRef: typeof pr.base?.ref === 'string' ? pr.base.ref : undefined,
      mergeable:
        typeof pr.mergeable === 'boolean' || pr.mergeable === null
          ? pr.mergeable
          : undefined,
      checks,
      review,
      addedAt: entry.addedAt,
      updatedAt: entry.updatedAt,
      closedAt,
    };
  }

  private announceTransitions(
    before: WatchedPullRequest,
    after: WatchedPullRequest,
  ): void {
    const label = `${after.owner}/${after.repo}#${after.number}`;
    const send = (title: string) =>
      this.notify({ title, body: `${label}: ${after.title}`, url: after.url });

    if (before.state === 'open' && after.state === 'merged') {
      send('Pull request merged');
      return;
    }
    if (before.state === 'open' && after.state === 'closed') {
      send('Pull request closed');
      return;
    }
    if (after.state !== 'open') return;

    if (before.checks.status !== after.checks.status) {
      if (after.checks.status === 'success') send('Checks passed');
      else if (after.checks.status === 'failure') {
        send(
          `${after.checks.failed} check${after.checks.failed === 1 ? '' : 's'} failed`,
        );
      }
    }
    if (before.review !== after.review) {
      if (after.review === 'approved') send('Pull request approved');
      else if (after.review === 'changes_requested') send('Changes requested');
    }
  }

  private persist(): void {
    try {
      this.store.save(this.pullRequests);
    } catch (error) {
      console.warn('[PullRequestWatch] Could not save watch list:', error);
    }
    const snapshot = this.list();
    this.emit('changed', snapshot);
    for (const { window } of applicationWindows.values()) {
      if (window && !window.isDestroyed()) {
        try {
          window.webContents.send(PullRequestWatchEvents.CHANGED, snapshot);
        } catch {
          // A closing window reloads the list the next time it mounts.
        }
      }
    }
  }
}

function emptyChecks(): PullRequestChecksSummary {
  return { status: 'none', total: 0, passed: 0, failed: 0, pending: 0 };
}

function stateOf(pr: GitHubPullRequestLike): WatchedPullRequestState {
  if (pr.merged === true || typeof pr.merged_at === 'string') return 'merged';
  return pr.state === 'closed' ? 'closed' : 'open';
}

function timestampOf(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

const FAILED_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
  'startup_failure',
  'stale',
]);

export function summarizeChecks(
  checkRuns: unknown[],
  status: { state: string; statuses: unknown[] } | null,
): PullRequestChecksSummary {
  const summary = emptyChecks();
  for (const run of checkRuns) {
    if (!run || typeof run !== 'object') continue;
    const { status: runStatus, conclusion } = run as {
      status?: unknown;
      conclusion?: unknown;
    };
    summary.total += 1;
    if (runStatus !== 'completed') summary.pending += 1;
    else if (
      typeof conclusion === 'string' &&
      FAILED_CONCLUSIONS.has(conclusion)
    )
      summary.failed += 1;
    else summary.passed += 1;
  }
  for (const legacy of status?.statuses ?? []) {
    if (!legacy || typeof legacy !== 'object') continue;
    const { state } = legacy as { state?: unknown };
    summary.total += 1;
    if (state === 'success') summary.passed += 1;
    else if (state === 'failure' || state === 'error') summary.failed += 1;
    else summary.pending += 1;
  }
  summary.status =
    summary.failed > 0
      ? 'failure'
      : summary.pending > 0
        ? 'pending'
        : summary.total > 0
          ? 'success'
          : 'none';
  return summary;
}

export function summarizeReviews(
  reviews: unknown[],
  pr: Pick<GitHubPullRequestLike, 'requested_reviewers' | 'requested_teams'>,
  authorLogin?: string,
): PullRequestReviewState {
  // GitHub's own rule: only each reviewer's latest approve/request-changes
  // counts, comments never do, and the author cannot review their own PR.
  const latestByUser = new Map<string, string>();
  for (const review of reviews) {
    if (!review || typeof review !== 'object') continue;
    const { state, user } = review as {
      state?: unknown;
      user?: { login?: unknown } | null;
    };
    const login = typeof user?.login === 'string' ? user.login : undefined;
    if (!login || login === authorLogin || typeof state !== 'string') continue;
    if (state === 'APPROVED' || state === 'CHANGES_REQUESTED') {
      latestByUser.set(login, state);
    } else if (state === 'DISMISSED') {
      latestByUser.delete(login);
    }
  }
  const states = [...latestByUser.values()];
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  const requested =
    (Array.isArray(pr.requested_reviewers)
      ? pr.requested_reviewers.length
      : 0) +
    (Array.isArray(pr.requested_teams) ? pr.requested_teams.length : 0);
  return requested > 0 ? 'pending' : 'none';
}

function snapshotChanged(
  before: WatchedPullRequest,
  after: WatchedPullRequest,
): boolean {
  return (
    before.title !== after.title ||
    before.state !== after.state ||
    before.draft !== after.draft ||
    before.headSha !== after.headSha ||
    before.mergeable !== after.mergeable ||
    before.review !== after.review ||
    before.checks.status !== after.checks.status ||
    before.checks.total !== after.checks.total ||
    before.checks.passed !== after.checks.passed ||
    before.checks.failed !== after.checks.failed ||
    before.checks.pending !== after.checks.pending ||
    before.pollError !== undefined
  );
}

function showNativeNotification(notice: {
  title: string;
  body: string;
  url: string;
}): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: notice.title,
    body: notice.body,
  });
  notification.on('click', () => {
    void shell.openExternal(notice.url);
  });
  notification.show();
}

let watcher: PullRequestWatcher | null = null;

export function getPullRequestWatcher(): PullRequestWatcher {
  if (!watcher) watcher = new PullRequestWatcher();
  return watcher;
}
