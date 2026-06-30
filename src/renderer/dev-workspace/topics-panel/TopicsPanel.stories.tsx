import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { TopicStatus } from '@principal-ai/principal-view-core';
import { TopicsPanel } from './TopicsPanel';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import type { LocalTopicRecord } from '../../../shared/main-process-api-interfaces/TopicAPI';

/**
 * `TopicsPanel` reads topic records through `TopicService.getRecords` and the
 * current repo's saved trails through `TrailLibraryService.list`. Each story
 * installs an in-memory dataset on those statics before render so the panel
 * exercises the This repo / All toggle, search, status filter, and badges
 * without a running main process.
 */

const REPO = '/Users/me/dev/electron-app';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const status = (state: TopicStatus['state']): TopicStatus => ({ state });

const record = (
  partial: Partial<LocalTopicRecord['topic']> & { id: string; title: string },
  sync: Partial<LocalTopicRecord['sync']> = {},
): LocalTopicRecord => ({
  topic: {
    description: '',
    trailIds: [],
    createdAt: ago(7 * DAY),
    updatedAt: ago(2 * HOUR),
    ...partial,
  },
  sync: {
    origin: 'local',
    visibility: 'sharable',
    locallyModifiedAt: ago(2 * HOUR),
    ...sync,
  },
});

// Trails saved against the current repo. Only `id` is read by the hook.
const REPO_TRAIL_IDS = ['t-auth-1', 't-auth-2', 't-city-1'];

const RECORDS: LocalTopicRecord[] = [
  // Entirely within this repo.
  record(
    {
      id: 'topic-auth',
      title: 'Auth flow end-to-end',
      trailIds: ['t-auth-1', 't-auth-2'],
      status: status('working'),
      updatedAt: ago(20 * MIN),
    },
    { remoteId: 'remote-auth' }, // published → Shared badge
  ),
  // Spans this repo + another → Multi-repo badge, no remoteId.
  record({
    id: 'topic-city',
    title: 'File City rendering pipeline',
    trailIds: ['t-city-1', 't-web-1', 't-web-2'],
    status: status('paused'),
    updatedAt: ago(3 * HOUR),
  }),
  // No overlap with this repo → only under "All".
  record({
    id: 'topic-web',
    title: 'Web-ADE publish path',
    trailIds: ['t-web-1', 't-web-3'],
    status: status('done-for-now'),
    updatedAt: ago(2 * DAY),
  }),
  record({
    id: 'topic-idea',
    title: 'Idea: cross-repo trail search',
    trailIds: ['t-web-9'],
    status: status('new-thought'),
    updatedAt: ago(5 * DAY),
  }),
];

function install(
  records: LocalTopicRecord[],
  repoTrailIds: string[] = REPO_TRAIL_IDS,
) {
  (
    TopicService as unknown as { getRecords: () => Promise<LocalTopicRecord[]> }
  ).getRecords = async () => records;
  (
    TopicService as unknown as { onTopicChange: () => () => void }
  ).onTopicChange = () => () => {};
  (
    TrailLibraryService as unknown as {
      list: () => Promise<{ entries: Array<{ id: string }> }>;
    }
  ).list = async () => ({ entries: repoTrailIds.map((id) => ({ id })) });
  (
    TrailLibraryService as unknown as { onLibraryChanged: () => () => void }
  ).onLibraryChanged = () => () => {};
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
    install(RECORDS);
    return (
      <Frame>
        <TopicsPanel repositoryPath={REPO} />
      </Frame>
    );
  },
};

export const NoRepoOpen: Story = {
  render: () => {
    install(RECORDS, []);
    return (
      <Frame>
        <TopicsPanel />
      </Frame>
    );
  },
};

export const NoTopicsForRepo: Story = {
  render: () => {
    // Repo has saved trails, but no topic references them.
    install(RECORDS, ['t-unrelated']);
    return (
      <Frame>
        <TopicsPanel repositoryPath={REPO} />
      </Frame>
    );
  },
};

export const Empty: Story = {
  render: () => {
    install([], []);
    return (
      <Frame>
        <TopicsPanel repositoryPath={REPO} />
      </Frame>
    );
  },
};
