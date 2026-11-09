import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { IntegrationsView } from './IntegrationsView';

const meta: Meta<typeof IntegrationsView> = {
  title: 'System Monitor/Integrations',
  component: IntegrationsView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'UI-only exploration for managing Maple and Subsystems Studio as local integrations. All statuses and paths are fixtures; controls do not install, update, or launch software.',
      },
    },
  },
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
type Story = StoryObj<typeof IntegrationsView>;

export const HealthySetup: Story = {
  args: { scenario: 'healthy', studioCloneRegistered: true },
};

export const UpdateAvailable: Story = {
  args: { scenario: 'update-available' },
};

export const MapleNotInstalled: Story = {
  args: { scenario: 'not-installed' },
};

/** Shows Studio Dev when a Subsystems Studio source clone is registered. */
export const StudioDevEnabled: Story = {
  args: {
    scenario: 'healthy',
    studioCloneRegistered: true,
    initialIntegration: 'studio-dev',
  },
};

export const StudioDevHidden: Story = {
  args: { scenario: 'healthy', studioCloneRegistered: false },
};

export const OpenBotSettings: Story = {
  args: { scenario: 'healthy', initialIntegration: 'openbot' },
};
