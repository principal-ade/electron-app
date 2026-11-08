import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { StudioTelemetryOverview } from './StudioTelemetryOverview';

const meta: Meta<typeof StudioTelemetryOverview> = {
  title: 'Dev Workspace/Subsystems Studio/Telemetry',
  component: StudioTelemetryOverview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A UI-only exploration of Studio freeze diagnostics. All values are Storybook fixtures: the view does not query Maple or imply that these Studio signals are already instrumented.',
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
type Story = StoryObj<typeof StudioTelemetryOverview>;

/** A renderer stall with comparatively quick host work, plus a worker timeout. */
export const FreezeInvestigation: Story = {
  args: { scenario: 'freeze' },
};

/** A healthy window for comparing the same dashboard without spikes. */
export const QuietWindow: Story = {
  args: { scenario: 'quiet' },
};

/** A Maple-unavailable state; the sample UI remains explorable offline. */
export const MapleUnavailable: Story = {
  args: { scenario: 'disconnected' },
};
