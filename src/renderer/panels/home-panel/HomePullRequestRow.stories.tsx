import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type { WatchedPullRequest } from '../../../shared/main-process-api-interfaces/PullRequestWatchAPI';
import { HomePullRequestRow } from './HomePullRequestRow';
import { PullRequestWatchService } from '../../main-process-api/PullRequestWatchService';
import { ShellService } from '../../main-process-api/ShellService';

// Storybook has no main process: log the actions the row would dispatch.
PullRequestWatchService.unwatch = async (id: string) => {
  console.info('[Mock] unwatch', id);
  return { success: true };
};
ShellService.openExternal = async (url: string) => {
  console.info('[Mock] openExternal', url);
  return { success: true };
};

const now = Date.now();

const base: WatchedPullRequest = {
  id: 'principal-ade/electron-app#412',
  owner: 'principal-ade',
  repo: 'electron-app',
  number: 412,
  url: 'https://github.com/principal-ade/electron-app/pull/412',
  title: 'feat(pr-watch): poll watched pull requests and surface them on Home',
  author: 'griever',
  state: 'open',
  draft: false,
  headSha: 'abc1234',
  headRef: 'feat/pr-watch',
  baseRef: 'main',
  mergeable: true,
  checks: { status: 'pending', total: 6, passed: 3, failed: 0, pending: 3 },
  review: 'pending',
  addedAt: now - 20 * 60_000,
  updatedAt: now - 2 * 60_000,
  lastPolledAt: now - 30_000,
};

const pr = (overrides: Partial<WatchedPullRequest>): WatchedPullRequest => ({
  ...base,
  ...overrides,
  checks: { ...base.checks, ...overrides.checks },
});

const meta: Meta<typeof HomePullRequestRow> = {
  title: 'Panels/HomePullRequestRow',
  component: HomePullRequestRow,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ width: 320 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HomePullRequestRow>;

export const ChecksRunning: Story = { args: { pullRequest: base } };

export const ChecksPassedAwaitingReview: Story = {
  args: {
    pullRequest: pr({
      checks: { status: 'success', total: 6, passed: 6, failed: 0, pending: 0 },
    }),
  },
};

export const ChecksFailed: Story = {
  args: {
    pullRequest: pr({
      checks: { status: 'failure', total: 6, passed: 4, failed: 2, pending: 0 },
      review: 'none',
    }),
  },
};

export const Approved: Story = {
  args: {
    pullRequest: pr({
      checks: { status: 'success', total: 6, passed: 6, failed: 0, pending: 0 },
      review: 'approved',
    }),
  },
};

export const ChangesRequested: Story = {
  args: {
    pullRequest: pr({
      checks: { status: 'success', total: 6, passed: 6, failed: 0, pending: 0 },
      review: 'changes_requested',
    }),
  },
};

export const Draft: Story = {
  args: {
    pullRequest: pr({
      draft: true,
      title: 'WIP: rethink terminal daemon reconnects',
      checks: { status: 'none', total: 0, passed: 0, failed: 0, pending: 0 },
      review: 'none',
    }),
  },
};

export const Conflicts: Story = {
  args: {
    pullRequest: pr({
      mergeable: false,
      checks: { status: 'success', total: 6, passed: 6, failed: 0, pending: 0 },
      review: 'approved',
    }),
  },
};

export const PollError: Story = {
  args: {
    pullRequest: pr({
      pollError: 'Could not reach GitHub for this pull request.',
    }),
  },
};

export const Merged: Story = {
  args: {
    pullRequest: pr({
      state: 'merged',
      closedAt: now - 60 * 60_000,
      checks: { status: 'success', total: 6, passed: 6, failed: 0, pending: 0 },
      review: 'approved',
    }),
  },
};

export const Closed: Story = {
  args: {
    pullRequest: pr({
      state: 'closed',
      title: 'Experiment: replace chokidar with parcel watcher',
      closedAt: now - 3 * 60 * 60_000,
    }),
  },
};

/** The Home rail section as a user would see it, mixed states sorted open-first. */
export const Section: Story = {
  render: () => (
    <div>
      {[
        base,
        pr({
          number: 409,
          id: 'principal-ade/electron-app#409',
          title:
            'fix(topics): highlight the contents button only on title hover',
          checks: {
            status: 'failure',
            total: 5,
            passed: 4,
            failed: 1,
            pending: 0,
          },
          review: 'approved',
        }),
        pr({
          number: 401,
          id: 'principal-ade/electron-app#401',
          title:
            'feat(bridge): fall back to the principal window for document open',
          state: 'merged',
          checks: {
            status: 'success',
            total: 5,
            passed: 5,
            failed: 0,
            pending: 0,
          },
          review: 'approved',
        }),
      ].map((entry) => (
        <HomePullRequestRow key={entry.id} pullRequest={entry} />
      ))}
    </div>
  ),
};
