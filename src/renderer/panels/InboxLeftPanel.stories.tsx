import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { InboxLeftPanel } from './InboxLeftPanel';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { InboxTabsProvider } from '../principal-window/contexts/InboxTabsContext';
import type {
  InboxIndexEntry,
  ListInboxResponse,
  ListRecentlyVisitedTrailsResponse,
  ListSentResponse,
  ListTopicInboxResponse,
  TrailRecentlyVisitedEntry,
} from '../../shared/tipc/webAdeRouterTypes';

// ---------- mock plumbing ----------
//
// InboxLeftPanel's load() fans out to four WebAdeService calls and awaits all
// of them, so every one must resolve or the panel is stuck on "Loading…". We
// rewire getInbox / getRecentlyVisitedTrails to read from a mutable
// `activeMocks` cell (swapped per-story), and stub getTopicInbox / getSent to
// empty — this story only exercises the inbox + recent lists.

// A bus for the stories — InboxLeftPanel emits open intents on it; nothing
// listens here, which is fine for a visual story.
const storyEvents = new PanelEventBus();

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

(
  WebAdeService as unknown as { getInbox: typeof WebAdeService.getInbox }
).getInbox = async () => resolveMock(activeMocks.inbox);
(
  WebAdeService as unknown as {
    getRecentlyVisitedTrails: typeof WebAdeService.getRecentlyVisitedTrails;
  }
).getRecentlyVisitedTrails = async () => resolveMock(activeMocks.recent);
// The Topics and Sent tabs aren't exercised here, but load() still awaits
// them — stub to empty so the panel finishes loading.
(
  WebAdeService as unknown as {
    getTopicInbox: typeof WebAdeService.getTopicInbox;
  }
).getTopicInbox = async (): Promise<ListTopicInboxResponse> => ({
  entries: [],
  unreadCount: 0,
});
(
  WebAdeService as unknown as { getSent: typeof WebAdeService.getSent }
).getSent = async (): Promise<ListSentResponse> => ({ entries: [] });

// ---------- fixtures ----------

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const inboxEntry = (
  over: Partial<InboxIndexEntry> &
    Pick<InboxIndexEntry, 'trailId' | 'owner' | 'repo'>,
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

// The four notification states from the design, each with the server-derived
// `notification` block the panel renders.
const notificationFixtures: InboxIndexEntry[] = [
  // 1 — never opened, no notes: dot, no note count.
  inboxEntry({
    trailId: 'n-1',
    owner: 'principal-ade',
    repo: 'logo-component',
    readAt: null,
    sentAt: daysAgo(3),
    sender: { githubId: 9, githubLogin: 'fernando' },
    snapshot: {
      id: 'n-1',
      title: 'How the File City logo animation works',
      owner: 'principal-ade',
      repo: 'logo-component',
      updatedAt: daysAgo(3),
      noteCount: 0,
    },
    notification: { dot: true, unread: true, noteCount: 0, newNoteCount: 0 },
  }),
  // 2 — never opened, has notes: dot + whole "N notes" orange.
  inboxEntry({
    trailId: 'n-2',
    owner: 'principal-ade',
    repo: 'codetrails',
    readAt: null,
    sentAt: minutesAgo(4),
    sender: { githubId: 10, githubLogin: 'squall' },
    snapshot: {
      id: 'n-2',
      title: 'Why does /blog return a 404?',
      owner: 'principal-ade',
      repo: 'codetrails',
      updatedAt: minutesAgo(4),
      noteCount: 2,
    },
    notification: { dot: true, unread: true, noteCount: 2, newNoteCount: 2 },
  }),
  // 3 — opened, all seen: no dot, notes shown muted.
  inboxEntry({
    trailId: 'n-3',
    owner: 'principal-ade',
    repo: 'logo-component',
    readAt: daysAgo(1),
    notesSeenCount: 3,
    sentAt: daysAgo(2),
    sender: { githubId: 9, githubLogin: 'fernando' },
    snapshot: {
      id: 'n-3',
      title: 'How the File City logo animation works',
      owner: 'principal-ade',
      repo: 'logo-component',
      updatedAt: daysAgo(1),
      noteCount: 3,
    },
    notification: { dot: false, unread: false, noteCount: 3, newNoteCount: 0 },
  }),
  // 4 — opened, new notes since: dot + "(N new)" orange, total stays muted.
  inboxEntry({
    trailId: 'n-4',
    owner: 'principal-ade',
    repo: 'logo-component',
    readAt: hoursAgo(6),
    notesSeenCount: 3,
    sentAt: minutesAgo(12),
    sender: { githubId: 9, githubLogin: 'fernando' },
    snapshot: {
      id: 'n-4',
      title: 'How the File City logo animation works',
      owner: 'principal-ade',
      repo: 'logo-component',
      updatedAt: minutesAgo(12),
      noteCount: 5,
    },
    notification: { dot: true, unread: false, noteCount: 5, newNoteCount: 2 },
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
    return <InboxLeftPanel events={storyEvents} />;
  },
};

/**
 * The four notification states, top to bottom: never-opened/no-notes (dot),
 * never-opened/with-notes (dot + whole "2 notes" accented), opened/all-seen
 * (no dot), and opened/new-notes-since (dot + "(2 new)" accented while the
 * total stays muted). Three of the four carry a dot, so the header badge
 * reads 3.
 */
export const NotificationStates: Story = {
  render: () => {
    withMocks({
      inbox: { entries: notificationFixtures, unreadCount: 3 },
      recent: { entries: recentFixtures },
    });
    return <InboxLeftPanel events={storyEvents} />;
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
    return <InboxLeftPanel events={storyEvents} />;
  },
};

/** Empty inbox — the "no shared trails yet" prompt. */
export const EmptyInbox: Story = {
  render: () => {
    withMocks({
      inbox: { entries: [], unreadCount: 0 },
      recent: { entries: recentFixtures },
    });
    return <InboxLeftPanel events={storyEvents} />;
  },
};

/** Fetch never resolves — the "Loading…" state. */
export const Loading: Story = {
  render: () => {
    withMocks({ inbox: 'pending', recent: 'pending' });
    return <InboxLeftPanel events={storyEvents} />;
  },
};

/**
 * Both calls reject (the signed-out case) — the panel shows the sign-in
 * prompt instead of an error.
 */
export const SignedOut: Story = {
  render: () => {
    withMocks({ inbox: 'reject', recent: 'reject' });
    return <InboxLeftPanel events={storyEvents} />;
  },
};
