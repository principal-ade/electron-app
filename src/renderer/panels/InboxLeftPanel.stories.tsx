import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { InboxLeftPanel } from './InboxLeftPanel';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { InboxTabsProvider } from '../principal-window/contexts/InboxTabsContext';
import type {
  InboxIndexEntry,
  ListInboxResponse,
  ListRecentlyVisitedTrailsResponse,
  TrailRecentlyVisitedEntry,
} from '../../shared/tipc/webAdeRouterTypes';

// ---------- mock plumbing ----------
//
// InboxLeftPanel calls the static `WebAdeService.getInbox` /
// `getRecentlyVisitedTrails` directly (no prop injection), so — mirroring the
// TrailsView story — we rewire those methods once to read from a mutable
// `activeMocks` cell and swap the cell per-story before returning the element.

type MockState = {
  inbox: ListInboxResponse | 'reject' | 'pending';
  recent: ListRecentlyVisitedTrailsResponse | 'reject' | 'pending';
};

let activeMocks: MockState = {
  inbox: { entries: [], unreadCount: 0 },
  recent: { entries: [] },
};

/** Set per-story before returning the rendered element. */
const withMocks = (state: MockState): void => {
  activeMocks = state;
};

const resolveMock = <T,>(value: T | 'reject' | 'pending'): Promise<T> => {
  if (value === 'pending') return new Promise<T>(() => {});
  if (value === 'reject') return Promise.reject(new Error('signed out'));
  return Promise.resolve(value);
};

(WebAdeService as unknown as { getInbox: typeof WebAdeService.getInbox }).getInbox =
  async () => resolveMock(activeMocks.inbox);
(
  WebAdeService as unknown as {
    getRecentlyVisitedTrails: typeof WebAdeService.getRecentlyVisitedTrails;
  }
).getRecentlyVisitedTrails = async () => resolveMock(activeMocks.recent);

// ---------- fixtures ----------

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const inboxEntry = (
  over: Partial<InboxIndexEntry> & Pick<InboxIndexEntry, 'trailId' | 'owner' | 'repo'>,
): InboxIndexEntry => ({
  sender: { githubId: 1, githubLogin: 'octocat' },
  sentAt: hoursAgo(3),
  readAt: hoursAgo(1),
  snapshot: {
    id: over.trailId,
    title: `${over.owner}/${over.repo} trail`,
    owner: over.owner,
    repo: over.repo,
    updatedAt: hoursAgo(4),
  },
  ...over,
});

const inboxFixtures: InboxIndexEntry[] = [
  inboxEntry({
    trailId: 't-1',
    owner: 'facebook',
    repo: 'react',
    readAt: null,
    sentAt: minutesAgo(8),
    sender: { githubId: 2, githubLogin: 'dan' },
    comment: 'Start here — this is the reconciler walkthrough I mentioned.',
    snapshot: {
      id: 't-1',
      title: 'How the reconciler schedules work',
      owner: 'facebook',
      repo: 'react',
      updatedAt: minutesAgo(20),
    },
  }),
  inboxEntry({
    trailId: 't-2',
    owner: 'vercel',
    repo: 'next.js',
    readAt: null,
    sentAt: hoursAgo(2),
    sender: { githubId: 3, githubLogin: 'rauchg' },
    snapshot: {
      id: 't-2',
      title: 'App Router request lifecycle',
      owner: 'vercel',
      repo: 'next.js',
      updatedAt: hoursAgo(3),
    },
  }),
  inboxEntry({
    trailId: 't-3',
    owner: 'microsoft',
    repo: 'typescript',
    readAt: hoursAgo(5),
    sentAt: daysAgo(2),
    sender: { githubId: 4, githubLogin: 'ahejlsberg' },
    comment: 'The narrowing pass, annotated.',
    snapshot: {
      id: 't-3',
      title: 'Control-flow narrowing, end to end',
      owner: 'microsoft',
      repo: 'typescript',
      updatedAt: daysAgo(2),
    },
  }),
];

const recentFixtures: TrailRecentlyVisitedEntry[] = [
  {
    id: 'r-1',
    title: 'Auth handshake from login button to session cookie',
    owner: 'principal-ade',
    repo: 'desktop-app',
    updatedAt: hoursAgo(6),
    lastVisitedAt: minutesAgo(4),
    visitCount: 5,
    createdByLogin: 'fernando',
  },
  {
    id: 'r-2',
    title: 'How a trail payload becomes a 3D city marker',
    owner: 'principal-ade',
    repo: 'desktop-app',
    updatedAt: daysAgo(1),
    lastVisitedAt: hoursAgo(20),
    visitCount: 2,
  },
  {
    id: 'r-3',
    title: 'Inbox index fetch and unread bookkeeping',
    owner: 'principal-ade',
    repo: 'web-ade',
    updatedAt: daysAgo(4),
    lastVisitedAt: daysAgo(3),
    visitCount: 1,
    createdByLogin: 'fernando',
  },
];

// ---------- meta ----------

const meta: Meta<typeof InboxLeftPanel> = {
  title: 'Panels/InboxLeftPanel',
  component: InboxLeftPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <InboxTabsProvider>
          <div style={{ width: '100vw', height: '100vh' }}>
            <Story />
          </div>
        </InboxTabsProvider>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inbox tab with shared trails — two unread (bold, dotted) and one read, plus
 * the unread badge in the header. Toggle to "Recently Visited" to see the
 * second list.
 */
export const Inbox: Story = {
  render: () => {
    withMocks({
      inbox: { entries: inboxFixtures, unreadCount: 2 },
      recent: { entries: recentFixtures },
    });
    return <InboxLeftPanel />;
  },
};

/** Everything read — no unread markers and no header badge. */
export const AllRead: Story = {
  render: () => {
    withMocks({
      inbox: {
        entries: inboxFixtures.map((e) => ({ ...e, readAt: hoursAgo(1) })),
        unreadCount: 0,
      },
      recent: { entries: recentFixtures },
    });
    return <InboxLeftPanel />;
  },
};

/** Empty inbox — the "no shared trails yet" prompt. */
export const EmptyInbox: Story = {
  render: () => {
    withMocks({
      inbox: { entries: [], unreadCount: 0 },
      recent: { entries: recentFixtures },
    });
    return <InboxLeftPanel />;
  },
};

/** Fetch never resolves — the "Loading…" state. */
export const Loading: Story = {
  render: () => {
    withMocks({ inbox: 'pending', recent: 'pending' });
    return <InboxLeftPanel />;
  },
};

/**
 * Both calls reject (the signed-out case) — the panel shows the sign-in
 * prompt instead of an error.
 */
export const SignedOut: Story = {
  render: () => {
    withMocks({ inbox: 'reject', recent: 'reject' });
    return <InboxLeftPanel />;
  },
};
