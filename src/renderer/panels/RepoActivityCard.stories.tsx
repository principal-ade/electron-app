import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEventEmitter,
  PanelEvent,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry, ValidatedRepositoryPath } from '@principal-ai/alexandria-core-library/types';
import {
  RepoActivityCard,
  type RepoActivitySummary,
  type RepoActivityCardActions,
  type RepoActivityChangedFiles,
} from './RepoActivityCard';
import type { ActivityCommit } from '../hooks/useActivityFeed';

// Mock actions — no real services wired in so Storybook can render the card
// without pulling renderer → main-process code into the web bundle.
const mockActions: RepoActivityCardActions = {
  getFileTreeForLocalRepo: async () => null,
  getGithubTree: async () => ({
    sha: 'mock-sha',
    url: 'https://api.github.com/repos/octocat/mock/git/trees/mock-sha',
    tree: [],
    truncated: false,
  }),
  getAlexandriaRepositories: async () => [],
  getChangedFilesForLocalCommit: async () => new Map(),
  getChangedFilesForGithubCommit: async () => new Map(),
  explainCommits: async () => ({
    text: 'Mock explanation for Storybook — the card is wired to mock actions so no real AI call is made.',
  }),
};

// Deterministic changed-files per commit hash so line-count stats render
// consistently across reloads.
const mockChangedFilesCache = new Map<string, RepoActivityChangedFiles>();

type DiffScale = 'small' | 'medium' | 'large' | 'xlarge';

// Per-scale ceilings roughly align with diffBarWidthPct buckets (25/50/75/100).
const diffScaleBuckets: Record<
  DiffScale,
  { maxAdd: number; maxDel: number; files: number }
> = {
  small: { maxAdd: 30, maxDel: 15, files: 2 },
  medium: { maxAdd: 120, maxDel: 50, files: 3 },
  large: { maxAdd: 350, maxDel: 150, files: 5 },
  xlarge: { maxAdd: 800, maxDel: 400, files: 8 },
};

// Per-story-repo scale lookup. Repos not listed fall back to 'small'.
const repoScaleByName: Record<string, DiffScale> = {};

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
  { name: 'src/pages/Dashboard.tsx', status: 'modified' },
  { name: 'src/store/slices/userSlice.ts', status: 'modified' },
];

const buildMockChangedFiles = (
  hash: string,
  scale: DiffScale = 'small',
): RepoActivityChangedFiles => {
  const cacheKey = `${scale}:${hash}`;
  const cached = mockChangedFilesCache.get(cacheKey);
  if (cached) return cached;

  const bucket = diffScaleBuckets[scale];
  const seed = Array.from(hash).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rand = (n: number) => (seed * (n + 3) * 31) % 97;
  const fileCount = (seed % bucket.files) + 1;
  const files: RepoActivityChangedFiles = new Map();

  for (let i = 0; i < fileCount; i++) {
    const sample = sampleFiles[(seed + i) % sampleFiles.length];
    if (!sample) continue;
    const additions =
      sample.status === 'deleted' ? 0 : (rand(i) % bucket.maxAdd) + 1;
    const deletions =
      sample.status === 'added' ? 0 : rand(i + 1) % bucket.maxDel;
    files.set(sample.name, {
      status: sample.status,
      additions,
      deletions,
    });
  }

  mockChangedFilesCache.set(cacheKey, files);
  return files;
};

// Pull a repo name out of a local filesystem path (last segment).
const repoNameFromPath = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
};

const mockActionsWithStats: RepoActivityCardActions = {
  ...mockActions,
  getChangedFilesForLocalCommit: async (repoPath, commitHash) => {
    const scale = repoScaleByName[repoNameFromPath(repoPath)] ?? 'small';
    return buildMockChangedFiles(commitHash, scale);
  },
  getChangedFilesForGithubCommit: async (_owner, repo, sha) => {
    const scale = repoScaleByName[repo] ?? 'small';
    return buildMockChangedFiles(sha, scale);
  },
};

// Mock event emitter for stories
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
      const currentListeners = this.listeners.get(eventType) || [];
      const index = currentListeners.indexOf(wrappedHandler);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  off<T>(eventType: string, handler: (event: PanelEvent<T>) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(handler as EventHandler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

// Generate mock commits
const generateMockCommits = (count: number, repoPath: string, repoName: string): ActivityCommit[] => {
  const commits: ActivityCommit[] = [];
  const now = new Date();

  const messages = [
    'Fix authentication bug in login flow',
    'Add new user profile component',
    'Update documentation',
    'Refactor API endpoints',
    'Improve error handling',
    'Add unit tests for util functions',
    'Update dependencies',
    'Fix TypeScript errors',
    'Improve performance',
    'Add dark mode support',
    'Fix responsive layout issues',
    'Update README',
    'Add new feature flag',
    'Fix memory leak',
    'Improve accessibility',
  ];

  const authors = [
    { name: 'Alice Johnson', email: 'alice@example.com', avatar: 'https://i.pravatar.cc/80?img=1' },
    { name: 'Bob Smith', email: 'bob@example.com', avatar: 'https://i.pravatar.cc/80?img=2' },
    { name: 'Charlie Davis', email: 'charlie@example.com', avatar: 'https://i.pravatar.cc/80?img=3' },
    { name: 'Diana Wilson', email: 'diana@example.com', avatar: 'https://i.pravatar.cc/80?img=4' },
  ];

  for (let i = 0; i < count; i++) {
    const hoursAgo = Math.floor(Math.random() * 6) + (i * 0.5); // Spread across last 6 hours
    const commitDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    const author = authors[Math.floor(Math.random() * authors.length)];

    commits.push({
      hash: `abc${i.toString().padStart(4, '0')}def`,
      message: messages[i % messages.length] || 'Update code',
      author: author?.name ?? 'Unknown',
      authorEmail: author?.email,
      authorAvatarUrl: author?.avatar,
      date: commitDate.toISOString(),
      repoPath,
      repoName,
    });
  }

  return commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Create mock repository entry
const createMockEntry = (repoName: string): AlexandriaEntry => ({
  path: `/Users/developer/projects/${repoName}` as ValidatedRepositoryPath,
  name: repoName,
  remoteUrl: `https://github.com/octocat/${repoName}.git`,
  registeredAt: new Date().toISOString(),
  hasViews: false,
  viewCount: 0,
  views: [],
  github: {
    id: `octocat/${repoName}`,
    owner: 'octocat',
    name: repoName,
    stars: 42,
    lastUpdated: new Date().toISOString(),
  },
});

// Create mock activity summary
const createMockSummary = (
  overrides: Partial<RepoActivitySummary> = {}
): RepoActivitySummary => {
  const repoName = overrides.repoName || 'my-awesome-project';
  const repoPath = overrides.repoPath || `/Users/developer/projects/${repoName}`;
  const commitCount = overrides.commitCount || 5;
  const commits = overrides.commits || generateMockCommits(commitCount, repoPath, repoName);

  return {
    repoPath,
    repoName,
    commits,
    latestCommitAt: new Date(commits[0]?.date || Date.now()),
    commitCount: commits.length,
    githubOwner: 'octocat',
    githubRepoName: repoName,
    isOwnerOrg: false,
    ...overrides,
  };
};

// Interactive wrapper component
const RepoActivityCardStory: React.FC<{
  summary: RepoActivitySummary;
  dimmed?: boolean;
  hideRepoHeader?: boolean;
  actions?: RepoActivityCardActions;
}> = ({ summary, dimmed, hideRepoHeader, actions = mockActions }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const mockEvents = new MockEventEmitter();
  const mockEntry = createMockEntry(summary.repoName);

  return (
    <ThemeProvider>
      <div style={{ padding: '24px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
        <RepoActivityCard
          summary={summary}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onOpen={() => console.info('Open repository:', summary.repoName)}
          dimmed={dimmed}
          hideRepoHeader={hideRepoHeader}
          events={mockEvents}
          entry={mockEntry}
          actions={actions}
        />
      </div>
    </ThemeProvider>
  );
};

const meta: Meta<typeof RepoActivityCard> = {
  title: 'Panels/RepoActivityCard',
  component: RepoActivityCard,
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

// Single commit - the simplest case
export const SingleCommit: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoName: 'single-commit-repo',
        commitCount: 1,
      })}
      actions={mockActionsWithStats}
    />
  ),
};

// Default story with 5 commits
export const Default: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoName: 'my-awesome-project',
        commitCount: 5,
      })}
      actions={mockActionsWithStats}
    />
  ),
};

// Multiple commits (10 commits - fills one row)
export const TenCommits: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoName: 'busy-project',
        commitCount: 10,
      })}
    />
  ),
};

// Many commits (25 commits - multiple rows)
export const ManyCommits: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoName: 'very-active-repo',
        commitCount: 25,
      })}
    />
  ),
};

// Organization owned repository
export const OrganizationRepo: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoName: 'enterprise-app',
        githubOwner: 'acme-corp',
        isOwnerOrg: true,
        commitCount: 8,
      })}
    />
  ),
};

// Header hidden (used inside CommitActivityPanel where owner/repo is shown above)
export const HiddenRepoHeader: Story = {
  render: () => {
    const repos = [
      createMockSummary({ repoName: 'single-commit-no-header', commitCount: 1 }),
      createMockSummary({ repoName: 'nested-in-watched-panel', commitCount: 5 }),
    ];

    return (
      <ThemeProvider>
        <div style={{ padding: '24px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '1200px' }}>
            {repos.map((summary) => {
              const [isExpanded, setIsExpanded] = React.useState(false);
              const mockEvents = new MockEventEmitter();
              const mockEntry = createMockEntry(summary.repoName);

              return (
                <RepoActivityCard
                  key={summary.repoPath}
                  summary={summary}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setIsExpanded(!isExpanded)}
                  onOpen={() => console.info('Open repository:', summary.repoName)}
                  hideRepoHeader
                  events={mockEvents}
                  entry={mockEntry}
                  actions={mockActionsWithStats}
                />
              );
            })}
          </div>
        </div>
      </ThemeProvider>
    );
  },
};

// Dimmed state (for filtering/highlighting)
export const DimmedState: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoName: 'filtered-out-repo',
        commitCount: 5,
      })}
      dimmed={true}
    />
  ),
};

// Watched GitHub repository (no local path)
export const WatchedGitHubRepo: Story = {
  render: () => (
    <RepoActivityCardStory
      summary={createMockSummary({
        repoPath: '', // No local path for watched repos
        repoName: 'popular-oss-library',
        githubOwner: 'facebook',
        githubRepoName: 'react',
        isOwnerOrg: true,
        commitCount: 12,
      })}
    />
  ),
};

// Recent activity (commits within the last hour)
export const RecentActivity: Story = {
  render: () => {
    const now = new Date();
    const recentCommits: ActivityCommit[] = [
      {
        hash: 'abc001def',
        message: 'Fix critical production bug',
        author: 'Emergency Dev',
        authorEmail: 'emergency@example.com',
        authorAvatarUrl: 'https://i.pravatar.cc/80?img=5',
        date: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        repoPath: '/Users/developer/projects/urgent-fixes',
        repoName: 'urgent-fixes',
      },
      {
        hash: 'abc002def',
        message: 'Hotfix deployment script',
        author: 'Emergency Dev',
        authorEmail: 'emergency@example.com',
        authorAvatarUrl: 'https://i.pravatar.cc/80?img=5',
        date: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        repoPath: '/Users/developer/projects/urgent-fixes',
        repoName: 'urgent-fixes',
      },
    ];

    return (
      <RepoActivityCardStory
        summary={{
          repoPath: '/Users/developer/projects/urgent-fixes',
          repoName: 'urgent-fixes',
          commits: recentCommits,
          latestCommitAt: new Date(recentCommits[0]?.date || Date.now()),
          commitCount: recentCommits.length,
          githubOwner: 'urgent-team',
          githubRepoName: 'urgent-fixes',
          isOwnerOrg: false,
        }}
      />
    );
  },
};

// Long commit messages
export const LongCommitMessages: Story = {
  render: () => {
    const longMessageCommits = generateMockCommits(3, '/Users/dev/verbose-repo', 'verbose-repo');
    if (longMessageCommits[0]) {
      longMessageCommits[0].message = 'Refactor authentication system to use JWT tokens instead of session cookies, update middleware, add token refresh logic, and improve error handling for expired tokens';
    }
    if (longMessageCommits[1]) {
      longMessageCommits[1].message = 'Add comprehensive unit tests for the new authentication flow including edge cases and error scenarios';
    }
    if (longMessageCommits[2]) {
      longMessageCommits[2].message = 'Update documentation with new authentication setup instructions and API examples';
    }

    return (
      <RepoActivityCardStory
        summary={{
          repoPath: '/Users/dev/verbose-repo',
          repoName: 'verbose-repo',
          commits: longMessageCommits,
          latestCommitAt: new Date(longMessageCommits[0]?.date || Date.now()),
          commitCount: longMessageCommits.length,
          githubOwner: 'verbose-dev',
          githubRepoName: 'verbose-repo',
          isOwnerOrg: false,
        }}
      />
    );
  },
};

// Multiple cards in a feed layout
export const FeedLayout: Story = {
  render: () => {
    // Register a scale per repo so each card lands in a different bar-width bucket.
    repoScaleByName['tiny-utility'] = 'small';
    repoScaleByName['frontend-app'] = 'medium';
    repoScaleByName['backend-api'] = 'large';
    repoScaleByName['platform-rewrite'] = 'xlarge';

    const repos = [
      createMockSummary({ repoName: 'tiny-utility', commitCount: 1 }),
      createMockSummary({ repoName: 'frontend-app', commitCount: 3 }),
      createMockSummary({
        repoName: 'backend-api',
        commitCount: 7,
        githubOwner: 'api-team',
        isOwnerOrg: true,
      }),
      createMockSummary({
        repoName: 'platform-rewrite',
        commitCount: 12,
        githubOwner: 'platform-team',
        isOwnerOrg: true,
      }),
    ];

    return (
      <ThemeProvider>
        <div style={{ padding: '24px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
            {repos.map((summary) => {
              const [isExpanded, setIsExpanded] = React.useState(false);
              const mockEvents = new MockEventEmitter();
              const mockEntry = createMockEntry(summary.repoName);

              return (
                <RepoActivityCard
                  key={summary.repoPath}
                  summary={summary}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setIsExpanded(!isExpanded)}
                  onOpen={() => console.info('Open repository:', summary.repoName)}
                  events={mockEvents}
                  entry={mockEntry}
                  actions={mockActionsWithStats}
                />
              );
            })}
          </div>
        </div>
      </ThemeProvider>
    );
  },
};
