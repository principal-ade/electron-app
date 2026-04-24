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
import {
  InProgressRepoCard,
  type InProgressChangedFile,
  type InProgressRepoCardActions,
  type InProgressSummary,
} from './InProgressRepoCard';

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

const singleFileWorking: InProgressChangedFile[] = [
  { path: 'src/scheduler/perf.ts', status: 'modified', additions: 18, deletions: 4, staged: false },
];

const baseActions = (files: InProgressChangedFile[]): InProgressRepoCardActions => ({
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async () => {
    await delay(200);
    return files;
  },
  explainWorkingChanges: async (input) => {
    await delay(900);
    const audience = input.audienceLevel;
    if (audience === 'non-technical') {
      return {
        text: 'You\'re tidying up how a button looks and behaves, writing a new helper to format text, and throwing out some old code that isn\'t used anymore. Part of it is ready to share with the team; the rest is still being tested locally.',
      };
    }
    return {
      text: 'Tightens Button styling and pulls shared formatter logic into src/utils/format.ts. Staged changes remove the now-unused legacy helper and update the Button test for the new prop shape; unstaged changes still include an in-flight useAuth refactor that should land in a follow-up commit.',
    };
  },
});

const noChangesActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async () => [],
  explainWorkingChanges: async () => ({ text: '' }),
};

const erroringActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async () => sampleFiles,
  explainWorkingChanges: async () => {
    await delay(400);
    throw new Error('LLM request timed out after 30s');
  },
};

const slowActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: async () => null,
  getWorkingChanges: async () => sampleFiles,
  explainWorkingChanges: async () => {
    await delay(20_000);
    return { text: 'This would eventually load.' };
  },
};

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
  dimmed?: boolean;
  entry?: AlexandriaEntry;
  events?: PanelEventEmitter;
}

const InProgressRepoCardStory: React.FC<StoryWrapperProps> = ({
  summary,
  actions,
  dimmed,
  entry,
  events,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  return (
    <InProgressRepoCard
      summary={summary}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded((prev) => !prev)}
      onOpen={() => console.info('[Story] onOpen')}
      dimmed={dimmed}
      entry={entry}
      events={events}
      actions={actions}
    />
  );
};

const Wrapper: React.FC<{ children: React.ReactNode; width?: number }> = ({
  children,
  width = 820,
}) => (
  <ThemeProvider>
    <div style={{ padding: 24, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ maxWidth: width }}>{children}</div>
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof InProgressRepoCard> = {
  title: 'Panels/InProgressRepoCard',
  component: InProgressRepoCard,
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
      <InProgressRepoCardStory
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
      <InProgressRepoCardStory
        summary={createMockSummary({
          repoName: 'scheduler',
          branch: 'perf/batch-low-priority',
          aheadCount: 0,
        })}
        actions={baseActions(singleFileWorking)}
      />
    </Wrapper>
  ),
};

export const LoadingExplanation: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoCardStory summary={createMockSummary()} actions={slowActions} />
    </Wrapper>
  ),
};

export const ExplanationError: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoCardStory summary={createMockSummary()} actions={erroringActions} />
    </Wrapper>
  ),
};

export const NoChanges: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoCardStory
        summary={createMockSummary({
          repoName: 'clean-repo',
          branch: 'main',
          aheadCount: 0,
        })}
        actions={noChangesActions}
      />
    </Wrapper>
  ),
};

export const Dimmed: Story = {
  render: () => (
    <Wrapper>
      <InProgressRepoCardStory
        summary={createMockSummary()}
        actions={baseActions(sampleFiles)}
        dimmed
      />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const summaries = [
      createMockSummary({
        repoName: 'my-awesome-project',
        branch: 'feature/button-polish',
        aheadCount: 2,
      }),
      createMockSummary({
        repoName: 'scheduler',
        repoPath: '/Users/developer/projects/scheduler',
        branch: 'perf/batch-low-priority',
        aheadCount: 0,
        lastEditAt: new Date(Date.now() - 3 * 60_000),
      }),
      createMockSummary({
        repoName: 'docs-site',
        repoPath: '/Users/developer/projects/docs-site',
        branch: 'chore/typo-pass',
        aheadCount: 5,
        lastEditAt: new Date(Date.now() - 2 * 3_600_000),
      }),
    ];
    const filesPerRepo: Record<string, InProgressChangedFile[]> = {
      'my-awesome-project': sampleFiles,
      scheduler: singleFileWorking,
      'docs-site': [
        { path: 'docs/getting-started.md', status: 'modified', additions: 6, deletions: 2, staged: true },
        { path: 'docs/api/overview.md', status: 'modified', additions: 2, deletions: 2, staged: true },
      ],
    };
    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {summaries.map((s) => (
            <InProgressRepoCardStory
              key={s.repoName}
              summary={s}
              actions={baseActions(filesPerRepo[s.repoName] ?? [])}
              events={new MockEventEmitter()}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
