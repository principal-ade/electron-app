import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  TrailsDashboard,
  type TrailsDashboardRepoEntry,
  type TrailsDashboardTopicEntry,
} from './TrailsDashboard';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const trail = (
  id: string,
  overrides: Partial<TrailIndexEntry> = {},
): TrailIndexEntry => ({
  id,
  title: `Trail ${id}`,
  summaryPreview: '',
  markerCount: 5,
  fileCount: 3,
  repoNames: ['electron-app'],
  hasDiffSnippets: false,
  createdAt: daysAgo(3),
  updatedAt: hoursAgo(2),
  sizeBytes: 2048,
  repositoryPath: '/Users/fernando/Developer/desktop-app/electron-app',
  purpose: 'investigation',
  ...overrides,
});

const repos: TrailsDashboardRepoEntry[] = [
  {
    key: '/Users/fernando/Developer/desktop-app/electron-app',
    label: 'electron-app',
    ownerLogin: 'anthropics',
    trailCount: 14,
    latestTrail: trail('e-latest', {
      title: 'Auth handshake from login button to session cookie',
      updatedAt: minutesAgo(8),
      purpose: 'investigation',
    }),
  },
  {
    key: '/Users/fernando/Developer/web-ade/web-ade',
    label: 'web-ade',
    ownerLogin: 'principal-ade',
    trailCount: 6,
    latestTrail: trail('w-latest', {
      title: 'Topic CRUD: editor → API → DynamoDB',
      updatedAt: hoursAgo(5),
      purpose: 'informative',
      signOffCount: 2,
    }),
  },
  {
    key: '/Users/fernando/Developer/principal-ade/principal-ade',
    label: 'principal-ade',
    ownerLogin: 'principal-ade',
    trailCount: 3,
    latestTrail: trail('p-latest', {
      title: 'Industry theme tokens → component styling pipeline',
      updatedAt: daysAgo(4),
      purpose: 'informative',
      signOffCount: 3,
    }),
  },
  {
    key: '/Users/fernando/Developer/file-city-panel',
    label: 'file-city-panel',
    ownerLogin: 'principal-ade',
    trailCount: 2,
    latestTrail: trail('f-latest', {
      title: 'PR #214: extract TrailsRecentList from TrailsView',
      updatedAt: daysAgo(1),
      purpose: 'changelog',
    }),
  },
];

const topics: TrailsDashboardTopicEntry[] = [
  {
    key: 'topic-auth',
    title: 'Auth & sessions',
    descriptionPreview:
      'Every trail covering the login handshake, session cookie wiring, and refresh logic across our apps.',
    trailCount: 7,
    updatedAt: hoursAgo(6),
  },
  {
    key: 'topic-trails',
    title: 'Trails subsystem',
    descriptionPreview:
      'How trails get authored, indexed, persisted, and surfaced in the renderer + File City panel.',
    trailCount: 5,
    updatedAt: daysAgo(2),
  },
  {
    key: 'topic-ipc',
    title: 'Renderer ↔ main IPC',
    descriptionPreview:
      'Cross-process boundaries, the preload bridge, and event payload contracts.',
    trailCount: 4,
    updatedAt: daysAgo(8),
  },
  {
    key: 'topic-theme',
    title: 'Industry theme',
    trailCount: 2,
    updatedAt: daysAgo(14),
  },
];

const meta: Meta<typeof TrailsDashboard> = {
  title: 'PrincipalWindow/TrailsView/TrailsDashboard',
  component: TrailsDashboard,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div
          style={{
            minHeight: '100vh',
            background: slateNeonTheme.colors.background,
          }}
        >
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrailsDashboard>;

const noop = () => undefined;
const logSelect = (label: string) => (x: unknown) =>
  // eslint-disable-next-line no-console
  console.log(`[TrailsDashboard story] ${label}`, x);

/** A user with several repos and a handful of topics. */
export const Populated: Story = {
  render: () => (
    <TrailsDashboard
      repoEntries={repos}
      topicEntries={topics}
      onSelectRepo={logSelect('onSelectRepo')}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
      onViewAllTrails={noop}
    />
  ),
};

/** Repos exist but no topics yet — exercises the topic empty state. */
export const ReposNoTopics: Story = {
  render: () => (
    <TrailsDashboard
      repoEntries={repos}
      topicEntries={[]}
      onSelectRepo={logSelect('onSelectRepo')}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
      onViewAllTrails={noop}
    />
  ),
};

/** Single repo, single topic — sanity-check the singular pluralizations. */
export const Minimal: Story = {
  render: () => (
    <TrailsDashboard
      repoEntries={repos.slice(0, 1)}
      topicEntries={topics.slice(0, 1)}
      onSelectRepo={logSelect('onSelectRepo')}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
      onViewAllTrails={noop}
    />
  ),
};

/**
 * Empty state. The real trails view will keep the prompt-idea cards in this
 * state — this dashboard is only meant to appear once the user has trails.
 * Rendered here so we can see how it degrades.
 */
export const Empty: Story = {
  render: () => (
    <TrailsDashboard
      repoEntries={[]}
      topicEntries={[]}
      onSelectRepo={logSelect('onSelectRepo')}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
      onViewAllTrails={noop}
    />
  ),
};

/** Many repos — exercises the grid wrap and the "view all" affordance. */
export const ManyRepos: Story = {
  render: () => {
    const many: TrailsDashboardRepoEntry[] = Array.from(
      { length: 9 },
      (_, i) => {
        const base = repos[i % repos.length]!;
        return {
          ...base,
          key: `${base.key}-${i}`,
          label: `${base.label}-${i + 1}`,
          trailCount: ((i * 5) % 18) + 1,
          latestTrail: {
            ...base.latestTrail,
            id: `${base.latestTrail.id}-${i}`,
            updatedAt: minutesAgo(i * 73 + 10),
          },
        };
      },
    );
    return (
      <TrailsDashboard
        repoEntries={many}
        topicEntries={topics}
        onSelectRepo={logSelect('onSelectRepo')}
        onSelectTopic={logSelect('onSelectTopic')}
        onCreateTopic={noop}
        onViewAllTrails={noop}
        repoLimit={9}
      />
    );
  },
};
