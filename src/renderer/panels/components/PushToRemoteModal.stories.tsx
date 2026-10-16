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
      onPush={async () => ({ success: true, message: 'pushed' })}
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
      onPush={async () => ({ success: true, message: 'pushed' })}
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
      onPush={async () => ({ success: true, message: 'pushed' })}
      onClose={() => {}}
    />
  ),
};

/** Click "Push to remote" — the push never resolves, so the spinner stays. */
export const Pushing: Story = {
  render: () => (
    <PushToRemoteModal
      isOpen
      repoName="electron-app"
      aheadCount={2}
      branch="main"
      onPush={() => new Promise(() => {})}
      onClose={() => {}}
    />
  ),
};

/** Click "Push to remote" to land in the success state (auto-closes). */
export const Success: Story = {
  render: () => (
    <PushToRemoteModal
      isOpen
      repoName="electron-app"
      aheadCount={2}
      branch="main"
      onPush={async () => ({ success: true, message: 'pushed' })}
      onClose={() => {}}
    />
  ),
};

/** Click "Push to remote" to surface git's rejection message verbatim. */
export const RejectedError: Story = {
  render: () => (
    <PushToRemoteModal
      isOpen
      repoName="electron-app"
      aheadCount={2}
      branch="main"
      onPush={async () => ({
        success: false,
        message: 'Push rejected: Remote has changes. Pull first or force push.',
      })}
      onClose={() => {}}
    />
  ),
};
