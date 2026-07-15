import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEvent,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type {
  AlexandriaEntry,
  ValidatedRepositoryPath,
} from '@principal-ai/alexandria-core-library/types';
import {
  InProgressRepoDetailModal,
  type InProgressChangedFile,
  type InProgressRepoCardActions,
  type InProgressSummary,
} from './InProgressRepoDetailModal';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sampleFiles: InProgressChangedFile[] = [
  { path: 'src/components/Button.tsx', status: 'modified', additions: 24, deletions: 8, staged: true },
  { path: 'src/components/Button.test.tsx', status: 'modified', additions: 12, deletions: 3, staged: true },
  { path: 'src/hooks/useAuth.ts', status: 'modified', additions: 5, deletions: 5, staged: false },
  { path: 'src/utils/format.ts', status: 'added', additions: 42, deletions: 0, staged: false },
  { path: 'src/legacy/old-helper.ts', status: 'deleted', additions: 0, deletions: 37, staged: true },
  { path: 'README.md', status: 'modified', additions: 3, deletions: 1, staged: false },
  { path: '.env.local', status: 'untracked', additions: 4, deletions: 0, staged: false },
];

const sampleCommits = [
  { hash: 'abc1234567890', message: 'feat: add button polish and styling updates', author: 'Alice', date: '2024-01-15' },
  { hash: 'def4567890123', message: 'fix: resolve button hover state issue', author: 'Bob', date: '2024-01-15' },
];

const baseActions = (files: InProgressChangedFile[], commits = sampleCommits): InProgressRepoCardActions => ({
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async () => {
    await delay(200);
    return files;
  },
  getAheadCommits: async () => {
    await delay(200);
    return commits;
  },
  pushBranch: async () => ({ success: true, message: 'pushed' }),
});

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

const createMockSummary = (overrides: Partial<InProgressSummary> = {}): InProgressSummary => {
  const repoName = overrides.repoName || 'my-awesome-project';
  return {
    repoPath: overrides.repoPath || `/Users/developer/projects/${repoName}`,
    repoName,
    branch: 'feature/button-polish',
    aheadCount: 2,
    behindCount: 0,
    githubOwner: 'octocat',
    githubRepoName: repoName,
    isOwnerOrg: false,
    lastEditAt: new Date(Date.now() - 12 * 60_000),
    ...overrides,
  };
};

interface StoryWrapperProps {
  summary: InProgressSummary;
  actions: InProgressRepoCardActions;
  entry?: AlexandriaEntry;
  events?: PanelEventEmitter;
}

const InProgressRepoDetailModalStory: React.FC<StoryWrapperProps> = ({
  summary,
  actions,
  entry,
  events,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Open Detail Modal
      </button>
      <InProgressRepoDetailModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        summary={summary}
        actions={actions}
        events={events}
        entry={entry}
      />
    </>
  );
};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <div style={{ padding: 24, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {children}
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof InProgressRepoDetailModal> = {
  title: 'Panels/InProgressRepoDetailModal',
  component: InProgressRepoDetailModal,
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

export const Default: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoDetailModalStory
        summary={createMockSummary()}
        actions={baseActions(sampleFiles)}
        entry={createMockEntry('my-awesome-project')}
        events={new MockEventEmitter()}
      />
    </Wrapper>
  ),
};

export const SingleFile: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoDetailModalStory
        summary={createMockSummary({
          repoName: 'scheduler',
          branch: 'perf/batch-low-priority',
          aheadCount: 0,
        })}
        actions={baseActions([
          { path: 'src/scheduler/perf.ts', status: 'modified', additions: 18, deletions: 4, staged: false },
        ])}
      />
    </Wrapper>
  ),
};

export const CommitsOnly: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoDetailModalStory
        summary={createMockSummary({
          repoName: 'ready-to-push',
          branch: 'main',
          aheadCount: 3,
          isDirty: false,
        })}
        actions={baseActions([], [
          { hash: 'abc1234567890', message: 'feat: add new feature', author: 'Alice', date: '2024-01-15' },
          { hash: 'def4567890123', message: 'fix: resolve bug', author: 'Bob', date: '2024-01-15' },
          { hash: 'ghi7890123456', message: 'chore: update dependencies', author: 'Charlie', date: '2024-01-14' },
        ])}
      />
    </Wrapper>
  ),
};

export const NoChanges: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoDetailModalStory
        summary={createMockSummary({
          repoName: 'clean-repo',
          branch: 'main',
          aheadCount: 0,
        })}
        actions={baseActions([])}
      />
    </Wrapper>
  ),
};
