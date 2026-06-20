import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { RelocateToConventionModal } from './RelocateToConventionModal';

const BASE = '/Users/fernando/Developer';

const meta: Meta<typeof RelocateToConventionModal> = {
  title: 'Panels/RelocateToConventionModal',
  component: RelocateToConventionModal,
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
type Story = StoryObj<typeof RelocateToConventionModal>;

/**
 * The default confirm state: a repo cloned directly under the base dir
 * (missing its owner folder) → target adds the `acme/` segment.
 */
export const Confirm: Story = {
  render: () => (
    <RelocateToConventionModal
      isOpen
      repoName="widget"
      owner="acme"
      currentPath={`${BASE}/widget`}
      expectedPath={`${BASE}/acme/widget`}
      onRelocate={async () => `${BASE}/acme/widget`}
      onClose={() => {}}
    />
  ),
};

/** Repo sitting under the wrong owner folder → moved to the right one. */
export const WrongOwnerFolder: Story = {
  render: () => (
    <RelocateToConventionModal
      isOpen
      repoName="widget"
      owner="acme"
      currentPath={`${BASE}/personal-stuff/widget`}
      expectedPath={`${BASE}/acme/widget`}
      onRelocate={async () => `${BASE}/acme/widget`}
      onClose={() => {}}
    />
  ),
};

/** Click "Move repository" — the move never resolves, so the spinner stays. */
export const Moving: Story = {
  render: () => (
    <RelocateToConventionModal
      isOpen
      repoName="widget"
      owner="acme"
      currentPath={`${BASE}/widget`}
      expectedPath={`${BASE}/acme/widget`}
      onRelocate={() => new Promise<string>(() => {})}
      onClose={() => {}}
    />
  ),
};

/** Click "Move repository" to land in the success state (auto-closes after ~2s). */
export const Success: Story = {
  render: () => (
    <RelocateToConventionModal
      isOpen
      repoName="widget"
      owner="acme"
      currentPath={`${BASE}/widget`}
      expectedPath={`${BASE}/acme/widget`}
      onRelocate={async () => `${BASE}/acme/widget`}
      onClose={() => {}}
    />
  ),
};

/**
 * Click "Move repository" to surface the main-process guard verbatim — the
 * repo can't move while it has an open window.
 */
export const OpenWindowError: Story = {
  render: () => (
    <RelocateToConventionModal
      isOpen
      repoName="widget"
      owner="acme"
      currentPath={`${BASE}/widget`}
      expectedPath={`${BASE}/acme/widget`}
      onRelocate={async () => {
        throw new Error(
          'Cannot move repository "widget" while it has an open window. ' +
            'Please close the repository window first.',
        );
      }}
      onClose={() => {}}
    />
  ),
};

/** Long, deeply-nested paths — checks wrapping in both path rows. */
export const LongPaths: Story = {
  render: () => (
    <RelocateToConventionModal
      isOpen
      repoName="internal-design-system-component-library"
      owner="principal-engineering-platform"
      currentPath={`${BASE}/archive/2024/q3/experiments/internal-design-system-component-library`}
      expectedPath={`${BASE}/principal-engineering-platform/internal-design-system-component-library`}
      onRelocate={async () =>
        `${BASE}/principal-engineering-platform/internal-design-system-component-library`
      }
      onClose={() => {}}
    />
  ),
};
