import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type { DraftTopic } from '@principal-ai/subsystems-core/node';
import {
  TopicEventType,
  type TopicChangeEvent,
} from '../../../shared/main-process-api-interfaces/TopicAPI';
import { TopicService } from '../../main-process-api/TopicService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { DevWorkspaceTopicTab } from './DevWorkspaceTopicTab';

const DESCRIPTION = `# Topic navigation

Scroll down in these notes, then open **Table of contents** from the list icon in the header. The outline should cover the notes at any scroll position without moving the document.

## Expected behavior

- The header and project rail stay visible.
- The contents panel has its own scrollbar.
- Selecting a heading closes the outline and smoothly scrolls the notes.
- Closing and reopening the outline preserves the document's scroll position.

${Array.from(
  { length: 12 },
  (
    _,
    index,
  ) => `## Section ${index + 1}: ${['Planning', 'Implementation', 'Validation'][index % 3]}

This section gives the topic enough content to exercise independent scrolling. Open the contents panel here to check that it stays anchored to the visible notes area, rather than the top of the document.

### Details for section ${index + 1}

The topic tab shares its Markdown body with the Topics view. Changes to the contents overlay should work in both places, while keeping the projects and models rail separate.

- [ ] Review this section
- [x] Keep the navigation visible
`,
).join('\n')}

## Final checks

Jump back to **Topic navigation** using the contents panel, then try a section near the end of the document.
`;

// Keep every service override scoped to this story and restore it on teardown.
function override<T extends object>(target: T, values: Partial<T>) {
  const original = Object.fromEntries(
    Object.keys(values).map((key) => [key, target[key as keyof T]]),
  );
  Object.assign(target, values);
  return () => Object.assign(target, original);
}

function installMocks() {
  let topic: DraftTopic = {
    id: 'storybook-topic-navigation',
    title: 'Topic navigation and contents',
    description: DESCRIPTION,
    createdAt: '2026-10-25T12:00:00.000Z',
    updatedAt: '2026-10-25T12:00:00.000Z',
    repos: ['pkg:github/example/desktop-app'],
    subsystemModels: [
      {
        modelId: 'topic-navigation',
        trailIds: ['open-topic', 'jump-to-heading'],
      },
    ],
  };
  const listeners = new Set<(event: TopicChangeEvent) => void>();
  const notify = () =>
    listeners.forEach((listener) =>
      listener({ type: TopicEventType.UPDATED, topic }),
    );
  const restore = [
    override(TopicService, {
      getTopic: async () => topic,
      onTopicChange: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      updateTopic: async (_id, updates) => {
        topic = { ...topic, ...updates };
        notify();
        return topic;
      },
      appendToDescription: async (_id, text) => {
        topic = { ...topic, description: `${topic.description}\n\n${text}` };
        notify();
        return topic;
      },
      attachImageAsset: async (_id, asset) => {
        topic = {
          ...topic,
          assets: [...(topic.assets ?? []), asset],
          description: `${topic.description}\n\n![Dropped image](asset://${asset.id})`,
        };
        notify();
        return topic;
      },
      getFilePath: async () => '/storybook/topics/topic-navigation.json',
      deleteTopic: async () => false,
    }),
    override(AlexandriaService, {
      getRepositories: async () => [],
      onRepositoryChange: () => () => {},
    }),
    override(SubsystemModelService, {
      list: async () => [
        {
          id: 'topic-navigation',
          title: 'Topic navigation',
          updatedAt: topic.updatedAt,
          componentCount: 3,
          edgeCount: 2,
        },
      ],
    }),
    override(UserPreferencesService, {
      getPreferences: async () => ({}),
      updatePreferences: async () => {},
      onPreferencesUpdated: () => () => {},
    }),
  ];
  return () => restore.reverse().forEach((reset) => reset());
}

const meta: Meta<typeof DevWorkspaceTopicTab> = {
  title: 'Dev Workspace/DevWorkspaceTopicTab',
  component: DevWorkspaceTopicTab,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A topic tab with long notes for testing scrolling and the contents overlay. All edits stay in memory; no desktop app is required.',
      },
    },
  },
  beforeEach: installMocks,
  args: {
    topicId: 'storybook-topic-navigation',
    title: 'Topic navigation and contents',
    isActive: true,
    events: new PanelEventBus(),
    onOpenModel: () => {},
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ height: '100vh', width: '100%', overflow: 'hidden' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof DevWorkspaceTopicTab>;

export const LongDescription: Story = {};
