import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  OpenBotDeploymentOverview,
  type OpenBotDeploymentSnapshot,
} from './OpenBotDeploymentOverview';

const healthySnapshot: OpenBotDeploymentSnapshot = {
  state: 'healthy',
  endpoint: 'http://localhost:3010',
  source: 'principal-ai/OpenBot',
  branch: 'main',
  revision: '6d1919a',
  deploymentMode: 'Local development',
  checkedAt: '14:32 UTC',
  components: [
    {
      id: 'api',
      label: 'OpenBot API',
      detail: 'HTTP health endpoint responding',
      state: 'healthy',
      metric: '42 ms',
    },
    {
      id: 'worker',
      label: 'Background worker',
      detail: 'Worker is processing jobs',
      state: 'healthy',
      metric: '1 active · 0 queued',
    },
    {
      id: 'database',
      label: 'PostgreSQL',
      detail: 'Database connection is ready',
      state: 'healthy',
      metric: 'Connected',
    },
    {
      id: 'inference',
      label: 'Model inference',
      detail: 'OpenCode Go · last probe succeeded',
      state: 'healthy',
      metric: '860 ms',
    },
  ],
  events: [
    {
      id: 'inference-check',
      title: 'Inference check succeeded',
      detail: 'OpenCode Go · 860 ms · 14:32 UTC',
      state: 'healthy',
    },
    {
      id: 'worker-start',
      title: 'Worker started',
      detail: 'Local development · 14:26 UTC',
      state: 'healthy',
    },
    {
      id: 'deployment',
      title: 'Deployment connected',
      detail: 'principal-ai/OpenBot · main · 14:25 UTC',
      state: 'healthy',
    },
  ],
};

const meta: Meta<typeof OpenBotDeploymentOverview> = {
  title: 'System Monitor/OpenBot Deployment',
  component: OpenBotDeploymentOverview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Exploratory, fixture-only view of OpenBot deployment health. Values are illustrative; this story is not connected to a live deployment.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div
          style={{
            minHeight: '100vh',
            background: slateNeonTheme.colors.background,
          }}
        >
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  args: { snapshot: healthySnapshot },
};

export default meta;
type Story = StoryObj<typeof OpenBotDeploymentOverview>;

export const Healthy: Story = {};

export const LimitedVisibility: Story = {
  args: {
    snapshot: {
      state: 'unknown',
      endpoint: 'http://localhost:3010',
      source: 'Not identified by Principal',
      deploymentMode: 'Server-owned SSE · temporary history',
      checkedAt: '2:32 AM',
      components: [
        {
          id: 'api',
          label: 'OpenBot API',
          detail: 'The public capabilities endpoint is responding.',
          state: 'healthy',
        },
        {
          id: 'worker',
          label: 'Background worker',
          detail: 'Separate worker health is not exposed by the OpenBot API.',
          state: 'unknown',
        },
        {
          id: 'database',
          label: 'Database',
          detail: 'Database health is not exposed by the OpenBot API.',
          state: 'unknown',
        },
        {
          id: 'inference',
          label: 'Model inference',
          detail:
            'The model is configured, but OpenBot cannot verify this custom endpoint.',
          state: 'unknown',
        },
      ],
      events: [],
      eventsMessage:
        'Deployment events are not exposed by the OpenBot API yet.',
      coverageNote:
        'Principal can reach OpenBot but does not identify the process source. Inference status is read from OpenBot’s setup checklist; no test prompt is sent.',
    },
  },
};

export const NeedsAttention: Story = {
  args: {
    snapshot: {
      ...healthySnapshot,
      state: 'degraded',
      checkedAt: '14:32 UTC',
      components: healthySnapshot.components.map((component) =>
        component.id === 'inference'
          ? {
              ...component,
              state: 'degraded',
              detail: 'OpenCode Go probe timed out; last success 12 min ago',
              metric: 'Timed out',
            }
          : component.id === 'worker'
            ? {
                ...component,
                detail: 'Jobs are waiting longer than expected',
                state: 'degraded',
                metric: '3 queued · oldest 8 min',
              }
            : component,
      ),
      events: [
        {
          id: 'inference-timeout',
          title: 'Inference check timed out',
          detail: 'OpenCode Go · 14:30 UTC',
          state: 'degraded',
        },
        ...healthySnapshot.events.slice(1),
      ],
    },
  },
};

export const Offline: Story = {
  args: {
    snapshot: {
      ...healthySnapshot,
      state: 'offline',
      checkedAt: '14:32 UTC',
      components: healthySnapshot.components.map((component) => ({
        ...component,
        state: component.id === 'api' ? 'offline' : 'unknown',
        detail:
          component.id === 'api'
            ? 'No response from the configured endpoint'
            : 'Not checked because the API is unreachable',
        metric: undefined,
      })),
      events: [
        {
          id: 'api-unreachable',
          title: 'OpenBot API is unreachable',
          detail: 'http://localhost:3010 · connection refused · 14:32 UTC',
          state: 'offline',
        },
        {
          id: 'last-inference',
          title: 'Last successful inference check',
          detail: 'OpenCode Go · 12 min ago',
          state: 'unknown',
        },
      ],
    },
  },
};
