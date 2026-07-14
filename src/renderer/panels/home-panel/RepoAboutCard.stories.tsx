import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEvent,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { RepoAboutCard } from './RepoAboutCard';
import type { RepositorySelectedPayload } from '../../events/repositorySelected';
import { payloadFromGithub } from '../../events/repositorySelected';
import { GitService } from '../../main-process-api/GitService';

// Mock getBranchStatus to return realistic data for storybook paths
GitService.getBranchStatus = async (_directory: string) => {
  return {
    branch: 'main',
    hasUpstream: true,
    ahead: 0,
    behind: 0,
  };
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

const createRepoPayload = (overrides: {
  owner?: string;
  name?: string;
  description?: string;
  stars?: number;
  language?: string;
  createdAt?: string;
  localClones?: RepositorySelectedPayload['localClones'];
} = {}): RepositorySelectedPayload => {
  const owner = overrides.owner ?? 'octocat';
  const name = overrides.name ?? 'my-awesome-project';
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const payload = payloadFromGithub({
    owner,
    name,
    description: overrides.description ?? 'A fantastic open source project built with React and TypeScript',
    stars: overrides.stars ?? 1234,
    primaryLanguage: overrides.language ?? 'TypeScript',
    createdAt: overrides.createdAt ?? twoYearsAgo.toISOString(),
    lastUpdated: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
  });

  if (overrides.localClones !== undefined) {
    payload.localClones = overrides.localClones;
  }

  return payload;
};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <div style={{ minHeight: '100vh', backgroundColor: '#1a1a1a' }}>
      {children}
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof RepoAboutCard> = {
  title: 'Panels/RepoAboutCard',
  component: RepoAboutCard,
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
  render: () => {
    const repo = createRepoPayload();
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
        />
      </Wrapper>
    );
  },
};

export const WithClones: Story = {
  render: () => {
    const repo = createRepoPayload({
      localClones: [
        { path: '/Users/developer/projects/my-awesome-project', addedAt: Date.now() - 86400_000 },
      ],
    });
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
        />
      </Wrapper>
    );
  },
};

export const MultipleClones: Story = {
  render: () => {
    const repo = createRepoPayload({
      localClones: [
        { path: '/Users/developer/projects/my-awesome-project', addedAt: Date.now() - 86400_000 * 30 },
        { path: '/Users/developer/backup/my-awesome-project', addedAt: Date.now() - 86400_000 },
      ],
    });
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
        />
      </Wrapper>
    );
  },
};

export const OffConventionClone: Story = {
  render: () => {
    const repo = createRepoPayload({
      localClones: [
        { path: '/Users/developer/bun', addedAt: Date.now() - 86400_000 },
      ],
    });
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
          baseDefaultDirectory="/Users/developer"
        />
      </Wrapper>
    );
  },
};

export const LocalPurlClone: Story = {
  render: () => {
    const repo = createRepoPayload({
      localClones: [
        { path: '/Users/developer/bun', addedAt: Date.now() - 86400_000 },
      ],
    });
    // Override the purl to simulate a local-only registration
    repo.purl = 'pkg:generic/local/Users-developer-bun' as never;
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
          baseDefaultDirectory="/Users/developer"
        />
      </Wrapper>
    );
  },
};

export const NoDescription: Story = {
  render: () => {
    const repo = createRepoPayload({ description: undefined });
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
        />
      </Wrapper>
    );
  },
};

export const NoClones: Story = {
  render: () => {
    const repo = createRepoPayload({ localClones: undefined });
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
        />
      </Wrapper>
    );
  },
};

export const WithReadme: Story = {
  render: () => {
    const repo = createRepoPayload();
    const [readmeActive, setReadmeActive] = React.useState(false);
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
          readmePath="README.md"
          onOpenReadme={() => setReadmeActive((prev) => !prev)}
          readmeActive={readmeActive}
        />
      </Wrapper>
    );
  },
};

export const PopularRepo: Story = {
  render: () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const repo = createRepoPayload({
      owner: 'facebook',
      name: 'react',
      description: 'The library for web and native user interfaces',
      stars: 225000,
      createdAt: tenYearsAgo.toISOString(),
      localClones: [
        { path: '/Users/developer/projects/react', addedAt: Date.now() - 86400_000 * 60 },
      ],
    });
    return (
      <Wrapper>
        <RepoAboutCard
          repo={repo}
          onDismiss={() => console.info('Dismissed')}
          events={new MockEventEmitter()}
        />
      </Wrapper>
    );
  },
};
