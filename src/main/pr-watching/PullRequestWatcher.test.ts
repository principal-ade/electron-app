/** @jest-environment node */
import {
  PullRequestWatcher,
  summarizeChecks,
  summarizeReviews,
  TERMINAL_RETENTION_MS,
  type PullRequestFetcher,
} from './PullRequestWatcher';
import type { PullRequestWatchStore } from './PullRequestWatchStore';
import type { WatchedPullRequest } from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';

jest.mock('electron', () => ({
  Notification: { isSupported: () => false },
  shell: { openExternal: jest.fn() },
  app: { getPath: () => '/tmp' },
}));
const mockSend = jest.fn();
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map([
    [
      1,
      {
        window: {
          isDestroyed: () => false,
          webContents: {
            send: (...args: unknown[]) => mockSend(...args),
          },
        },
      },
    ],
  ]),
}));
jest.mock('../version-control-providers/githubHandlers', () => ({
  GitHubAdapter: jest.fn(),
}));

function memoryStore(initial: WatchedPullRequest[] = []) {
  let saved = initial;
  const store = {
    load: jest.fn(() => saved),
    save: jest.fn((next: WatchedPullRequest[]) => {
      saved = next;
    }),
  };
  return store as unknown as PullRequestWatchStore & typeof store;
}

type MockFetcher = { [K in keyof PullRequestFetcher]: jest.Mock };

function fetcher(overrides: Partial<MockFetcher> = {}) {
  const pr = {
    title: 'Add watcher',
    state: 'open',
    merged: false,
    draft: false,
    mergeable: true,
    html_url: 'https://github.com/acme/app/pull/7',
    user: { login: 'author' },
    head: { sha: 'abc', ref: 'feature' },
    base: { ref: 'main' },
    requested_reviewers: [{ login: 'reviewer' }],
  };
  return {
    pr,
    fetcher: {
      getPullRequest: jest.fn(async () => pr),
      getPullRequestReviews: jest.fn(async () => []),
      getCommitCheckRuns: jest.fn(async () => [
        { status: 'in_progress', conclusion: null },
      ]),
      getCommitStatus: jest.fn(async () => null),
      ...overrides,
    } as MockFetcher,
  };
}

describe('summarizeChecks', () => {
  it('reports none without any checks', () => {
    expect(summarizeChecks([], null)).toEqual({
      status: 'none',
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
    });
  });

  it('treats neutral and skipped conclusions as passing and failures as failing', () => {
    expect(
      summarizeChecks(
        [
          { status: 'completed', conclusion: 'success' },
          { status: 'completed', conclusion: 'skipped' },
          { status: 'completed', conclusion: 'neutral' },
          { status: 'completed', conclusion: 'timed_out' },
        ],
        null,
      ),
    ).toEqual({
      status: 'failure',
      total: 4,
      passed: 3,
      failed: 1,
      pending: 0,
    });
  });

  it('counts legacy commit statuses and stays pending while anything runs', () => {
    expect(
      summarizeChecks([{ status: 'completed', conclusion: 'success' }], {
        state: 'pending',
        statuses: [{ state: 'pending' }, { state: 'success' }],
      }),
    ).toEqual({
      status: 'pending',
      total: 3,
      passed: 2,
      failed: 0,
      pending: 1,
    });
  });
});

describe('summarizeReviews', () => {
  const reviews = (
    ...entries: Array<[login: string, state: string]>
  ): unknown[] => entries.map(([login, state]) => ({ user: { login }, state }));

  it('uses each reviewer’s latest decision and ignores comments and the author', () => {
    expect(
      summarizeReviews(
        reviews(
          ['a', 'CHANGES_REQUESTED'],
          ['a', 'COMMENTED'],
          ['a', 'APPROVED'],
          ['author', 'CHANGES_REQUESTED'],
        ),
        {},
        'author',
      ),
    ).toBe('approved');
  });

  it('lets any outstanding request for changes win', () => {
    expect(
      summarizeReviews(
        reviews(['a', 'APPROVED'], ['b', 'CHANGES_REQUESTED']),
        {},
      ),
    ).toBe('changes_requested');
  });

  it('drops a dismissed review and reports pending when reviewers are requested', () => {
    expect(
      summarizeReviews(reviews(['a', 'APPROVED'], ['a', 'DISMISSED']), {
        requested_reviewers: [{ login: 'b' }],
      }),
    ).toBe('pending');
    expect(summarizeReviews([], {})).toBe('none');
  });
});

describe('PullRequestWatcher', () => {
  beforeEach(() => mockSend.mockClear());

  it('rejects unparseable targets', async () => {
    const watcher = new PullRequestWatcher({
      store: memoryStore(),
      fetcher: fetcher().fetcher,
    });
    const result = await watcher.watch('not a pr');
    expect(result.success).toBe(false);
    expect(watcher.list()).toEqual([]);
  });

  it('does not add a PR that GitHub cannot load', async () => {
    const store = memoryStore();
    const { fetcher: f } = fetcher({
      getPullRequest: jest.fn(async () => null),
    });
    const watcher = new PullRequestWatcher({ store, fetcher: f });
    const result = await watcher.watch('acme/app#7');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Could not load acme\/app#7/);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('adds a snapshot, persists it, and broadcasts to windows', async () => {
    const store = memoryStore();
    const { fetcher: f } = fetcher();
    const now = jest.fn(() => 1_000);
    const watcher = new PullRequestWatcher({ store, fetcher: f, now });

    const result = await watcher.watch(
      'https://github.com/acme/app/pull/7/files',
    );
    expect(result.success).toBe(true);
    expect(result.pullRequest).toMatchObject({
      id: 'acme/app#7',
      title: 'Add watcher',
      state: 'open',
      author: 'author',
      headSha: 'abc',
      checks: { status: 'pending', total: 1, pending: 1 },
      review: 'pending',
      addedAt: 1_000,
      lastPolledAt: 1_000,
    });
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      'pr-watch:changed',
      expect.arrayContaining([expect.objectContaining({ id: 'acme/app#7' })]),
    );
    expect(f.getCommitCheckRuns).toHaveBeenCalledWith('acme', 'app', 'abc');
  });

  it('refreshes rather than duplicates an already-watched PR', async () => {
    const store = memoryStore();
    const { fetcher: f } = fetcher();
    const watcher = new PullRequestWatcher({ store, fetcher: f });
    await watcher.watch('acme/app#7');
    await watcher.watch('ACME/App#7');
    expect(watcher.list()).toHaveLength(1);
    expect(f.getPullRequest).toHaveBeenCalledTimes(2);
  });

  it('notifies on check, review, and merge transitions only', async () => {
    const store = memoryStore();
    const { pr, fetcher: f } = fetcher();
    const notify = jest.fn();
    let time = 1_000;
    const watcher = new PullRequestWatcher({
      store,
      fetcher: f,
      notify,
      now: () => time,
    });
    await watcher.watch('acme/app#7');
    expect(notify).not.toHaveBeenCalled();

    // Same state again: no notification, updatedAt unchanged.
    time = 2_000;
    let [entry] = await watcher.refresh('acme/app#7');
    expect(notify).not.toHaveBeenCalled();
    expect(entry.updatedAt).toBe(1_000);
    expect(entry.lastPolledAt).toBe(2_000);

    f.getCommitCheckRuns.mockResolvedValue([
      { status: 'completed', conclusion: 'failure' },
    ]);
    time = 3_000;
    [entry] = await watcher.refresh('acme/app#7');
    expect(notify).toHaveBeenLastCalledWith({
      title: '1 check failed',
      body: 'acme/app#7: Add watcher',
      url: 'https://github.com/acme/app/pull/7',
    });
    expect(entry.updatedAt).toBe(3_000);

    f.getCommitCheckRuns.mockResolvedValue([
      { status: 'completed', conclusion: 'success' },
    ]);
    f.getPullRequestReviews.mockResolvedValue([
      { user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    await watcher.refresh('acme/app#7');
    expect(notify.mock.calls.slice(-2).map(([n]) => n.title)).toEqual([
      'Checks passed',
      'Pull request approved',
    ]);

    pr.merged = true;
    pr.state = 'closed';
    (pr as { merged_at?: string }).merged_at = '2026-01-01T00:00:00Z';
    [entry] = await watcher.refresh('acme/app#7');
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Pull request merged' }),
    );
    expect(entry.state).toBe('merged');
    expect(entry.closedAt).toBe(Date.parse('2026-01-01T00:00:00Z'));
    // Checks and reviews are no longer fetched for a terminal PR.
    const checkCalls = f.getCommitCheckRuns.mock.calls.length;
    await watcher.refresh('acme/app#7');
    expect(f.getCommitCheckRuns.mock.calls.length).toBe(checkCalls);
  });

  it('keeps the entry with a poll error when GitHub is unreachable', async () => {
    const store = memoryStore();
    const { fetcher: f } = fetcher();
    const watcher = new PullRequestWatcher({ store, fetcher: f });
    await watcher.watch('acme/app#7');
    f.getPullRequest.mockRejectedValueOnce(new Error('offline'));
    const [entry] = await watcher.refresh('acme/app#7');
    expect(entry.pollError).toMatch(/Could not reach GitHub/);
    expect(entry.title).toBe('Add watcher');
    const [recovered] = await watcher.refresh('acme/app#7');
    expect(recovered.pollError).toBeUndefined();
  });

  it('unwatches by id and reports unknown ids', async () => {
    const store = memoryStore();
    const watcher = new PullRequestWatcher({
      store,
      fetcher: fetcher().fetcher,
    });
    await watcher.watch('acme/app#7');
    expect(watcher.unwatch('acme/app#8')).toEqual({
      success: false,
      error: 'Unknown watched pull request.',
    });
    expect(watcher.unwatch('acme/app#7')).toEqual({ success: true });
    expect(watcher.list()).toEqual([]);
  });

  it('expires merged PRs after the retention window on the next poll', async () => {
    const closedAt = 10_000;
    const merged: WatchedPullRequest = {
      id: 'acme/app#1',
      owner: 'acme',
      repo: 'app',
      number: 1,
      url: 'https://github.com/acme/app/pull/1',
      title: 'Old',
      state: 'merged',
      draft: false,
      checks: { status: 'none', total: 0, passed: 0, failed: 0, pending: 0 },
      review: 'none',
      addedAt: 0,
      updatedAt: closedAt,
      closedAt,
    };
    const store = memoryStore([merged]);
    const { fetcher: f } = fetcher();
    const watcher = new PullRequestWatcher({
      store,
      fetcher: f,
      now: () => closedAt + TERMINAL_RETENTION_MS + 1,
    });
    expect(watcher.list()).toHaveLength(1);
    await watcher.refresh();
    expect(watcher.list()).toEqual([]);
    expect(f.getPullRequest).not.toHaveBeenCalled();
  });
});
