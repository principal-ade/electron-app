import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { PushToRemoteModal } from './PushToRemoteModal';

const meta: Meta<typeof PushToRemoteModal> = {
  title: 'Panels/PushToRemoteModal',
  component: PushToRemoteModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        {/* The modal portals to document.body; this wrapper just gives
            Storybook a layout root. */}
        <div style={{ minHeight: '100vh' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PushToRemoteModal>;

/** The default confirm state for a branch a few commits ahead. */
export const Confirm: Story = {
  render: () => (
    <PushToRemoteModal
      isOpen
      repoName="electron-app"
      aheadCount={3}
      branch="main"
      onPush={() => {}}
      onClose={() => {}}
    />
  ),
};

/** A single commit ahead — pluralization reads "1 commit". */
export const SingleCommit: Story = {
  render: () => (
    <PushToRemoteModal
      isOpen
      repoName="widget"
      aheadCount={1}
      branch="feature/push-modal"
      onPush={() => {}}
      onClose={() => {}}
    />
  ),
};

/** No upstream yet — the branch label is omitted. */
export const NoBranch: Story = {
  render: () => (
    <PushToRemoteModal
      isOpen
      repoName="scratch"
      aheadCount={2}
      onPush={() => {}}
      onClose={() => {}}
    />
  ),
};
