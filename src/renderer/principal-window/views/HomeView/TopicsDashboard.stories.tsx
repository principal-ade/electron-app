import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  TopicsDashboard,
  type TopicsDashboardTopicEntry,
} from './TopicsDashboard';

const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const topics: TopicsDashboardTopicEntry[] = [
  {
    key: 'topic-open',
    title: 'Auth & sessions',
    updatedAt: hoursAgo(6),
    isOpen: true,
    status: { state: 'working' },
    projectRepos: [{ name: 'electron-app', ownerLogin: 'anthropics' }],
  },
  {
    key: 'topic-working',
    title: 'Trails subsystem',
    updatedAt: daysAgo(1),
    status: { state: 'working' },
  },
  {
    key: 'topic-paused',
    title: 'Renderer ↔ main IPC',
    updatedAt: daysAgo(3),
    status: { state: 'paused' },
  },
  {
    key: 'topic-new',
    title: 'Industry theme',
    updatedAt: daysAgo(8),
    status: { state: 'new-thought' },
  },
];

const meta: Meta<typeof TopicsDashboard> = {
  title: 'PrincipalWindow/HomeView/TopicsDashboard',
  component: TopicsDashboard,
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
type Story = StoryObj<typeof TopicsDashboard>;

const noop = () => undefined;
const logSelect = (label: string) => (x: unknown) =>
  // eslint-disable-next-line no-console
  console.log(`[TopicsDashboard story] ${label}`, x);

/**
 * A mix of statuses. Open topics lead, then the working topic; the paused/new
 * ones only surface once nothing is working (see Paused).
 */
export const Populated: Story = {
  render: () => (
    <TopicsDashboard
      topicEntries={topics}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
      onDeleteTopic={logSelect('onDeleteTopic')}
    />
  ),
};

/** No working topics → the paused tier fills the list below the open ones. */
export const Paused: Story = {
  render: () => (
    <TopicsDashboard
      topicEntries={topics.filter((t) => t.status?.state !== 'working')}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
    />
  ),
};

/** Nothing open, working, or paused → the recent fallback (capped) is shown. */
export const RecentFallback: Story = {
  render: () => (
    <TopicsDashboard
      topicEntries={topics
        .filter((t) => t.status?.state === 'new-thought')
        .map((t) => ({ ...t, isOpen: false }))}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
    />
  ),
};

/** No topics at all — exercises the topic empty state. */
export const Empty: Story = {
  render: () => (
    <TopicsDashboard
      topicEntries={[]}
      onSelectTopic={logSelect('onSelectTopic')}
      onCreateTopic={noop}
    />
  ),
};
