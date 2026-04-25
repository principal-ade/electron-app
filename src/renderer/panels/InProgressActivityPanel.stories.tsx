import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEvent,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type {
  AlexandriaEntry,
  ValidatedRepositoryPath,
} from '@principal-ai/alexandria-core-library/types';
import { InProgressActivityPanel } from './InProgressActivityPanel';
import type {
  InProgressChangedFile,
  InProgressRepoCardActions,
} from './InProgressRepoCard';

type EventHandler = (event: PanelEvent<unknown>) => void;

class MockEventEmitter implements PanelEventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  emit<T>(event: PanelEvent<T>): void {
    console.info('[Mock Event]:', event);
    (this.listeners.get(event.type) || []).forEach((l) => l(event as PanelEvent<unknown>));
  }

  on<T>(eventType: string, handler: (event: PanelEvent<T>) => void): () => void {
    const listeners = this.listeners.get(eventType) || [];
    const wrapped = handler as EventHandler;
    listeners.push(wrapped);
    this.listeners.set(eventType, listeners);
    return () => {
      const current = this.listeners.get(eventType) || [];
      const i = current.indexOf(wrapped);
      if (i > -1) current.splice(i, 1);
    };
  }

  off<T>(eventType: string, handler: (event: PanelEvent<T>) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const i = listeners.indexOf(handler as EventHandler);
    if (i > -1) listeners.splice(i, 1);
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const filesByRepo: Record<string, InProgressChangedFile[]> = {
  'my-awesome-project': [
    { path: 'src/components/Button.tsx', status: 'modified', additions: 24, deletions: 8, staged: true },
    { path: 'src/components/Button.test.tsx', status: 'modified', additions: 12, deletions: 3, staged: true },
    { path: 'src/hooks/useAuth.ts', status: 'modified', additions: 5, deletions: 5, staged: false },
    { path: 'src/utils/format.ts', status: 'added', additions: 42, deletions: 0, staged: false },
    { path: '.env.local', status: 'untracked', additions: 4, deletions: 0, staged: false },
  ],
  scheduler: [
    { path: 'src/scheduler/perf.ts', status: 'modified', additions: 18, deletions: 4, staged: false },
  ],
  'docs-site': [
    { path: 'docs/getting-started.md', status: 'modified', additions: 6, deletions: 2, staged: true },
    { path: 'docs/api/overview.md', status: 'modified', additions: 2, deletions: 2, staged: true },
  ],
};

const mockActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async (repoPath) => {
    await delay(250);
    const name = repoPath.split('/').pop() ?? '';
    return filesByRepo[name] ?? [];
  },
  getAheadCommits: async () => [],
  pushBranch: async () => ({ success: true, message: 'pushed' }),
  explainWorkingChanges: async (input) => {
    await delay(900);
    if (input.repoName === 'scheduler') {
      return { text: 'Batches low-priority updates in the scheduler commit phase; not yet staged.' };
    }
    if (input.repoName === 'docs-site') {
      return { text: 'Fixes typos in the getting-started and API overview docs, staged and ready to commit.' };
    }
    return {
      text: 'Tightens Button styling, adds a shared text formatter, and drops an environment file locally. Mixed staged/unstaged — review before committing.',
    };
  },
};

const emptyActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async () => [],
  getAheadCommits: async () => [],
  pushBranch: async () => ({ success: true, message: 'pushed' }),
  explainWorkingChanges: async () => ({ text: '' }),
};

const createMockEntry = (name: string): AlexandriaEntry => ({
  path: `/Users/developer/projects/${name}` as ValidatedRepositoryPath,
  name,
  remoteUrl: `https://github.com/octocat/${name}.git`,
  registeredAt: new Date().toISOString(),
  hasViews: false,
  viewCount: 0,
  views: [],
  github: {
    id: `octocat/${name}`,
    owner: 'octocat',
    name,
    stars: 42,
    lastUpdated: new Date().toISOString(),
  },
});

const Wrapper: React.FC<{ children: React.ReactNode; width?: number; height?: number }> = ({
  children,
  width = 900,
  height = 900,
}) => (
  <ThemeProvider>
    <div style={{ padding: 0, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ maxWidth: width, height, margin: '0 auto' }}>{children}</div>
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof InProgressActivityPanel> = {
  title: 'Panels/InProgressActivityPanel',
  component: InProgressActivityPanel,
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

// NOTE: The real panel pulls git status via RepositoryMonitoringService, which
// is not available in Storybook. These stories render with empty repositories
// and rely on InProgressRepoCard stories for card-level coverage; the panel
// stories here exercise the empty-state and layout scaffolding.

export const EmptyState: Story = {
  render: () => (
    <Wrapper>
      <InProgressActivityPanel
        repositories={[]}
        events={new MockEventEmitter()}
        actions={emptyActions}
      />
    </Wrapper>
  ),
};

export const WithRepositoriesButNoStatus: Story = {
  render: () => (
    <Wrapper>
      <InProgressActivityPanel
        repositories={[
          createMockEntry('my-awesome-project'),
          createMockEntry('scheduler'),
          createMockEntry('docs-site'),
        ]}
        events={new MockEventEmitter()}
        actions={mockActions}
      />
    </Wrapper>
  ),
};
