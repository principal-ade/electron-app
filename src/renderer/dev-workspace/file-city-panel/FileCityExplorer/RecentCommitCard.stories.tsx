import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { RecentCommitCard, type RecentCommit } from './RecentCommitCard';

const baseCommit: RecentCommit = {
  sha: '4075aaf25b9c1e8d3a2f6b7e4c5d8a9f0b1c2d3e',
  subject: 'feat(file-city): add recent commit card overlay',
  author: 'Fernando',
  authoredAt: new Date(Date.now() - 1000 * 60 * 23),
  filesChanged: 3,
  additions: 124,
  deletions: 18,
  files: [
    { path: 'src/renderer/dev-workspace/RecentCommitCard.tsx', status: 'A' },
    { path: 'src/renderer/dev-workspace/FileCityExplorer.tsx', status: 'M' },
    { path: 'src/renderer/main-process-api/GitService.ts', status: 'M' },
  ],
};

const CityBackdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: '100vw',
      height: '100vh',
      background:
        'radial-gradient(circle at 30% 30%, #2a3550 0%, #0f1320 60%, #05070d 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Faux city silhouette so we can judge contrast against a busy scene. */}
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '55%',
        background:
          'repeating-linear-gradient(90deg, #1a2238 0 24px, #232c46 24px 56px, #1a2238 56px 96px)',
        opacity: 0.85,
      }}
    />
    {children}
  </div>
);

const meta: Meta<typeof RecentCommitCard> = {
  title: 'DevWorkspace/FileCityPanel/RecentCommitCard',
  component: RecentCommitCard,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <CityBackdrop>
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <Story />
          </div>
        </CityBackdrop>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RecentCommitCard>;

export const Default: Story = {
  args: { commit: baseCommit },
};

export const LongSubject: Story = {
  args: {
    commit: {
      ...baseCommit,
      subject:
        'refactor(scope-manager): collapse namespace + event resolution into a single pass so the city overlay does not have to re-walk the tree on every hover',
    },
  },
};

export const SmallChange: Story = {
  args: {
    commit: {
      ...baseCommit,
      sha: '8b3998e260fa4c1d2e3a4b5c6d7e8f9a0b1c2d3e',
      subject: 'fix(cli-bridge): stop forwarding worker stdout to debug log',
      filesChanged: 1,
      additions: 2,
      deletions: 14,
      authoredAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
      files: [
        { path: 'src/main/cli-bridge/worker.ts', status: 'M' },
      ],
    },
  },
};

export const Active: Story = {
  args: { commit: baseCommit, active: true },
};

export const OldCommit: Story = {
  args: {
    commit: {
      ...baseCommit,
      authoredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    },
  },
};

export const Clickable: Story = {
  args: {
    commit: baseCommit,
    onClick: () => console.info('[RecentCommitCard] clicked'),
  },
};
