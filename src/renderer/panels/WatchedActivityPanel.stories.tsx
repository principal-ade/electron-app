import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEventEmitter,
  PanelEvent,
} from '@principal-ade/panel-framework-core';
import {
  WatchedActivityPanel,
  type WatchedActivityPanelActions,
  type WatchedActivitySource,
} from './WatchedActivityPanel';
import type {
  CommitActivityCard,
  CommitInfo,
} from '../../shared/tipc/webAdeRouterTypes';
import type { RepoActivityChangedFiles } from './RepoActivityCard';

// ---- Mock event emitter ----------------------------------------------------

type EventHandler = (event: PanelEvent<unknown>) => void;

class MockEventEmitter implements PanelEventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  emit<T>(event: PanelEvent<T>): void {
    console.info('[Mock Event]:', event);
    const eventListeners = this.listeners.get(event.type) || [];
    eventListeners.forEach((listener) => listener(event as PanelEvent<unknown>));
  }

  on<T>(eventType: string, handler: (event: PanelEvent<T>) => void): () => void {
    const listeners = this.listeners.get(eventType) || [];
    const wrappedHandler = handler as EventHandler;
    listeners.push(wrappedHandler);
    this.listeners.set(eventType, listeners);
    return () => {
      const current = this.listeners.get(eventType) || [];
      const index = current.indexOf(wrappedHandler);
      if (index > -1) current.splice(index, 1);
    };
  }

  off<T>(eventType: string, handler: (event: PanelEvent<T>) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(handler as EventHandler);
    if (index > -1) listeners.splice(index, 1);
  }
}

// ---- Mock changed-files (for the expanded-card diff stats) -----------------

const mockChangedFilesCache = new Map<string, RepoActivityChangedFiles>();

const sampleFiles: Array<{
  name: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}> = [
  { name: 'src/components/Button.tsx', status: 'modified' },
  { name: 'src/hooks/useAuth.ts', status: 'modified' },
  { name: 'src/utils/format.ts', status: 'added' },
  { name: 'tests/Button.test.tsx', status: 'added' },
  { name: 'README.md', status: 'modified' },
  { name: 'src/legacy/old-helper.ts', status: 'deleted' },
];

const buildMockChangedFiles = (hash: string): RepoActivityChangedFiles => {
  const cached = mockChangedFilesCache.get(hash);
  if (cached) return cached;

  const seed = Array.from(hash).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (n: number) => (seed * (n + 3) * 31) % 97;
  const fileCount = (seed % 3) + 1;
  const files: RepoActivityChangedFiles = new Map();

  for (let i = 0; i < fileCount; i++) {
    const sample = sampleFiles[(seed + i) % sampleFiles.length];
    if (!sample) continue;
    files.set(sample.name, {
      status: sample.status,
      additions: sample.status === 'deleted' ? 0 : (rand(i) % 80) + 1,
      deletions: sample.status === 'added' ? 0 : rand(i + 1) % 40,
    });
  }

  mockChangedFilesCache.set(hash, files);
  return files;
};

// ---- Mock activity cards ---------------------------------------------------

const AUTHORS = [
  { login: 'alice', avatarUrl: 'https://i.pravatar.cc/80?img=1' },
  { login: 'bob', avatarUrl: 'https://i.pravatar.cc/80?img=2' },
  { login: 'charlie', avatarUrl: 'https://i.pravatar.cc/80?img=3' },
  { login: 'diana', avatarUrl: 'https://i.pravatar.cc/80?img=4' },
];

const MESSAGES = [
  'Fix authentication bug in login flow',
  'Add new user profile component',
  'Update documentation',
  'Refactor API endpoints',
  'Improve error handling',
  'Add unit tests for util functions',
  'Update dependencies',
  'Fix TypeScript errors',
  'Add dark mode support',
  'Fix responsive layout issues',
];

const hourBucketIso = (hoursAgo: number): string => {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
};

const makeCommits = (count: number, hoursAgo: number, idPrefix: string): CommitInfo[] => {
  const commits: CommitInfo[] = [];
  const base = Date.now() - hoursAgo * 60 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const author = AUTHORS[i % AUTHORS.length];
    if (!author) continue;
    const committedAt = new Date(base + i * 5 * 60 * 1000).toISOString();
    commits.push({
      sha: `${idPrefix}${i.toString().padStart(4, '0')}`,
      message: MESSAGES[(i + idPrefix.charCodeAt(0)) % MESSAGES.length] ?? 'Update code',
      author,
      committedAt,
      url: `https://github.com/example/example/commit/${idPrefix}${i}`,
    });
  }
  return commits;
};

const makeCard = (
  owner: string,
  repo: string,
  hoursAgo: number,
  commitCount: number,
): CommitActivityCard => {
  const commits = makeCommits(commitCount, hoursAgo, `${repo.slice(0, 3)}${hoursAgo}`);
  const hourBucket = hourBucketIso(hoursAgo);
  const latestCommit = commits[commits.length - 1];
  if (!latestCommit) {
    throw new Error('makeCard requires at least one commit');
  }
  return {
    itemId: `${hourBucket.slice(0, 13)}:${owner}/${repo}`,
    repo: { owner, name: repo },
    hour: new Date(hourBucket).getUTCHours(),
    hourBucket,
    commits,
    commitCount,
    latestCommitAt: latestCommit.committedAt,
  };
};

// ---- Mock actions factory --------------------------------------------------

const makeMockActions = (cards: CommitActivityCard[]): WatchedActivityPanelActions => ({
  getFileTreeForLocalRepo: async () => null,
  getGithubTree: async () => ({
    sha: 'mock-sha',
    url: 'https://api.github.com/repos/octocat/mock/git/trees/mock-sha',
    tree: [],
    truncated: false,
  }),
  getAlexandriaRepositories: async () => [],
  getChangedFilesForLocalCommit: async (_path, sha) => buildMockChangedFiles(sha),
  getChangedFilesForGithubCommit: async (_owner, _repo, sha) => buildMockChangedFiles(sha),
  explainCommits: async () => ({
    text: 'Mock explanation for Storybook — no real AI call is made.',
  }),
  getOwnerActivity: async () => cards,
  getRepoActivity: async () => cards,
});

const makeNeverResolvingActions = (): WatchedActivityPanelActions => ({
  ...makeMockActions([]),
  getOwnerActivity: () => new Promise(() => {}),
  getRepoActivity: () => new Promise(() => {}),
});

// ---- Story wrapper ---------------------------------------------------------

const PanelStory: React.FC<{
  source: WatchedActivitySource;
  actions: WatchedActivityPanelActions;
  hideHeader?: boolean;
}> = ({ source, actions, hideHeader }) => {
  const events = React.useMemo(() => new MockEventEmitter(), []);
  return (
    <ThemeProvider>
      <div
        style={{
          height: '100vh',
          width: '100%',
          backgroundColor: '#1a1a1a',
          display: 'flex',
        }}
      >
        <div style={{ width: 480, borderRight: '1px solid #333', height: '100%' }}>
          <WatchedActivityPanel
            source={source}
            events={events}
            actions={actions}
            hideHeader={hideHeader}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

const meta: Meta<typeof WatchedActivityPanel> = {
  title: 'Panels/WatchedActivityPanel',
  component: WatchedActivityPanel,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1a' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Watched user with activity spread across several hourly groups
export const WatchedUser: Story = {
  render: () => (
    <PanelStory
      source={{ kind: 'owner', login: 'octocat', accountType: 'User' }}
      actions={makeMockActions([
        makeCard('octocat', 'hello-world', 0, 3),
        makeCard('octocat', 'spoon-knife', 2, 2),
        makeCard('octocat', 'hello-world', 5, 5),
        makeCard('octocat', 'dotfiles', 28, 1),
      ])}
    />
  ),
};

// Watched organization — multiple repos under one owner
export const WatchedOrganization: Story = {
  render: () => (
    <PanelStory
      source={{ kind: 'owner', login: 'acme-corp', accountType: 'Organization' }}
      actions={makeMockActions([
        makeCard('acme-corp', 'frontend-app', 0, 7),
        makeCard('acme-corp', 'backend-api', 0, 4),
        makeCard('acme-corp', 'shared-ui', 3, 2),
        makeCard('acme-corp', 'backend-api', 12, 9),
        makeCard('acme-corp', 'infra', 50, 1),
      ])}
    />
  ),
};

// Watched single repo
export const WatchedRepo: Story = {
  render: () => (
    <PanelStory
      source={{ kind: 'repo', owner: 'facebook', repo: 'react' }}
      actions={makeMockActions([
        makeCard('facebook', 'react', 0, 6),
        makeCard('facebook', 'react', 4, 3),
        makeCard('facebook', 'react', 20, 11),
      ])}
    />
  ),
};

// Empty state — no commits in the last 7 days
export const EmptyState: Story = {
  render: () => (
    <PanelStory
      source={{ kind: 'owner', login: 'quiet-dev', accountType: 'User' }}
      actions={makeMockActions([])}
    />
  ),
};

// Loading state — fetch never resolves
export const Loading: Story = {
  render: () => (
    <PanelStory
      source={{ kind: 'owner', login: 'slow-network', accountType: 'User' }}
      actions={makeNeverResolvingActions()}
    />
  ),
};

// Header hidden (embedded variant)
export const HideHeader: Story = {
  render: () => (
    <PanelStory
      hideHeader
      source={{ kind: 'repo', owner: 'vercel', repo: 'next.js' }}
      actions={makeMockActions([
        makeCard('vercel', 'next.js', 0, 4),
        makeCard('vercel', 'next.js', 6, 2),
      ])}
    />
  ),
};
