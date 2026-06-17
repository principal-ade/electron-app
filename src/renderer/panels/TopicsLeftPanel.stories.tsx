import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { TopicsLeftPanel } from './TopicsLeftPanel';
import { TopicService } from '../main-process-api/TopicService';
import { TopicsTabsProvider } from '../principal-window/contexts/TopicsTabsContext';
import type { Topic } from '@principal-ai/alexandria-core-library/types';

// ---------- mock plumbing ----------
//
// TopicsLeftPanel loads via TopicService.getTopics() and subscribes to
// onTopicChange. We swap getTopics to read from a mutable `activeMock` cell
// (set per-story) and stub onTopicChange to a no-op unsubscribe.

let activeMock: Topic[] | 'reject' | 'pending' = [];

const withTopics = (state: Topic[] | 'reject' | 'pending'): void => {
  activeMock = state;
};

(
  TopicService as unknown as { getTopics: typeof TopicService.getTopics }
).getTopics = async () => {
  if (activeMock === 'pending') return new Promise<Topic[]>(() => {});
  if (activeMock === 'reject') return Promise.reject(new Error('boom'));
  return Promise.resolve(activeMock);
};
(
  TopicService as unknown as {
    onTopicChange: typeof TopicService.onTopicChange;
  }
).onTopicChange = () => () => {};

// ---------- fixtures ----------

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const topic = (over: Partial<Topic> & Pick<Topic, 'id' | 'title'>): Topic => ({
  description: '',
  trailIds: [],
  createdAt: daysAgo(10),
  updatedAt: hoursAgo(1),
  ...over,
});

const topicFixtures: Topic[] = [
  topic({
    id: 't-1',
    title: 'How the reconciler schedules work',
    trailIds: ['a', 'b', 'c'],
    updatedAt: minutesAgo(8),
    status: { state: 'working' },
  }),
  topic({
    id: 't-2',
    title: 'App Router request lifecycle',
    trailIds: ['d'],
    updatedAt: hoursAgo(3),
    status: { state: 'paused', label: 'revisit after launch' },
  }),
  topic({
    id: 't-3',
    title: 'Control-flow narrowing, end to end',
    trailIds: ['e', 'f'],
    updatedAt: daysAgo(2),
    status: { state: 'done-for-now' },
  }),
  topic({
    id: 't-4',
    title: 'Untriaged idea with no status',
    trailIds: [],
    updatedAt: daysAgo(5),
  }),
];

// ---------- meta ----------

const meta: Meta<typeof TopicsLeftPanel> = {
  title: 'Panels/TopicsLeftPanel',
  component: TopicsLeftPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <TopicsTabsProvider>
          <div style={{ width: '100vw', height: '100vh' }}>
            <Story />
          </div>
        </TopicsTabsProvider>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A handful of topics across the status axis, most-recent first. */
export const Default: Story = {
  render: () => {
    withTopics(topicFixtures);
    return <TopicsLeftPanel />;
  },
};

/** No topics — the empty prompt. */
export const Empty: Story = {
  render: () => {
    withTopics([]);
    return <TopicsLeftPanel />;
  },
};

/** Fetch never resolves — the "Loading…" state. */
export const Loading: Story = {
  render: () => {
    withTopics('pending');
    return <TopicsLeftPanel />;
  },
};

/** Fetch rejects — the error message. */
export const LoadError: Story = {
  render: () => {
    withTopics('reject');
    return <TopicsLeftPanel />;
  },
};
