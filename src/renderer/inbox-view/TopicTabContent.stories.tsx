import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { PublishedTopic } from '@principal-ai/subsystems-core/node';
import type { FetchSharedTopicResult } from '../../shared/main-process-api-interfaces/TopicAPI';
import { TopicService } from '../main-process-api/TopicService';
import { TopicTabContent } from './TopicTabContent';

let sharedTopic: FetchSharedTopicResult | null = null;

(
  TopicService as unknown as {
    fetchSharedById: typeof TopicService.fetchSharedById;
  }
).fetchSharedById = async () => {
  if (!sharedTopic) throw new Error('Could not load this topic.');
  return sharedTopic;
};

const topic: PublishedTopic = {
  id: 'topic-1',
  title: 'Understanding the React reconciler',
  description:
    'A guide to how React schedules and commits work.\n\n' +
    '- Start with the scheduler.\n' +
    '- Follow the reconciler and commit phases.',
  repos: ['pkg:github/facebook/react', 'pkg:github/reactwg/react-18'],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
  createdBy: { githubId: 2, githubLogin: 'dan' },
  visibility: 'public',
};

const meta: Meta<typeof TopicTabContent> = {
  title: 'Inbox/TopicTabContent',
  component: TopicTabContent,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    sharedTopic = { topic, bookmarked: false };
    return <TopicTabContent topicId={topic.id} />;
  },
};

export const NoProjectsOrDescription: Story = {
  render: () => {
    sharedTopic = {
      topic: { ...topic, repos: [], description: '' },
      bookmarked: false,
    };
    return <TopicTabContent topicId={topic.id} />;
  },
};

export const LoadError: Story = {
  render: () => {
    sharedTopic = null;
    return <TopicTabContent topicId={topic.id} />;
  },
};
