import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type {
  DraftTopic as Topic,
  TopicStatus,
} from '@principal-ai/subsystems-core/node';
import { TopicsPanel } from './TopicsPanel';
import { TopicService } from '../../main-process-api/TopicService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';

/**
 * `TopicsPanel` reads topics through `TopicService.getTopics` and the current
 * repo through `AlexandriaService`. Each story installs an in-memory
 * dataset on those statics before render so the panel
 * exercises the This repo / All toggle, search, status filter, and badges
 * without a running main process.
 */

const REPO = '/Users/me/dev/electron-app';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const status = (state: TopicStatus['state']): TopicStatus => ({ state });

const topic = (partial: Partial<Topic> & { id: string; title: string }): Topic => ({
  description: '',
  createdAt: ago(7 * DAY),
  updatedAt: ago(2 * HOUR),
  ...partial,
});

const REPO_PURL = 'pkg:github/me/electron-app';

const TOPICS: Topic[] = [
  // Entirely within this repo.
  topic({
    id: 'topic-auth',
    title: 'Auth flow end-to-end',
    repos: [REPO_PURL],
    status: status('working'),
    updatedAt: ago(20 * MIN),
  }),
  // Spans this repo + another → Multi-repo badge.
  topic({
    id: 'topic-city',
    title: 'File City rendering pipeline',
    repos: [REPO_PURL, 'pkg:github/me/web-ade'],
    status: status('paused'),
    updatedAt: ago(3 * HOUR),
  }),
  // No overlap with this repo → only under "All".
  topic({
    id: 'topic-web',
    title: 'Workspace integration work',
    repos: ['pkg:github/me/web-ade'],
    status: status('done-for-now'),
    updatedAt: ago(2 * DAY),
  }),
  topic({
    id: 'topic-idea',
    title: 'Idea: cross-repo topic search',
    repos: ['pkg:github/me/other'],
    status: status('new-thought'),
    updatedAt: ago(5 * DAY),
  }),
];

function install(
  topics: Topic[],
  repoPurl: string | null = REPO_PURL,
) {
  (
    TopicService as unknown as { getTopics: () => Promise<Topic[]> }
  ).getTopics = async () => topics;
  (
    TopicService as unknown as { onTopicChange: () => () => void }
  ).onTopicChange = () => () => {};
  (
    AlexandriaService as unknown as {
      getRepositoryByPath: typeof AlexandriaService.getRepositoryByPath;
    }
  ).getRepositoryByPath = async () =>
    repoPurl
      ? ({ purl: repoPurl } as Awaited<
          ReturnType<typeof AlexandriaService.getRepositoryByPath>
        >)
      : null;
}

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={slateNeonTheme}>
    <div
      style={{
        width: 340,
        height: 560,
        border: '1px solid #2a2f3a',
        borderRadius: 8,
        overflow: 'hidden',
        background: slateNeonTheme.colors.background,
      }}
    >
      {children}
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof TopicsPanel> = {
  title: 'Dev Workspace/TopicsPanel',
  component: TopicsPanel,
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof TopicsPanel>;

export const Populated: Story = {
  render: () => {
    install(TOPICS);
    return (
      <Frame>
        <TopicsPanel repositoryPath={REPO} />
      </Frame>
    );
  },
};

export const NoRepoOpen: Story = {
  render: () => {
    install(TOPICS, null);
    return (
      <Frame>
        <TopicsPanel />
      </Frame>
    );
  },
};

export const NoTopicsForRepo: Story = {
  render: () => {
    // No topic declares this repository.
    install(TOPICS, 'pkg:github/me/unrelated');
    return (
      <Frame>
        <TopicsPanel repositoryPath={REPO} />
      </Frame>
    );
  },
};

export const Empty: Story = {
  render: () => {
    install([], null);
    return (
      <Frame>
        <TopicsPanel repositoryPath={REPO} />
      </Frame>
    );
  },
};
