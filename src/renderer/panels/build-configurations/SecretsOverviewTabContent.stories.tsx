import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  SecretsOverviewTabContent,
  type SecretUsageEntry,
} from './SecretsOverviewTabContent';

const secrets: SecretUsageEntry[] = [
  {
    env: 'NODE_AUTH_TOKEN',
    label: 'npm token',
    configs: [
      { id: 'bc-web-build', name: 'web build', granted: false },
      { id: 'bc-api-release', name: 'api release', granted: true },
    ],
  },
  {
    env: 'GH_TOKEN',
    label: 'GitHub token',
    configs: [{ id: 'bc-web-build', name: 'web build', granted: true }],
  },
  {
    env: 'SENTRY_AUTH_TOKEN',
    label: 'sentry upload',
    configs: [{ id: 'bc-api-release', name: 'api release', granted: true }],
  },
];

const meta: Meta<typeof SecretsOverviewTabContent> = {
  title: 'Workspace/SecretsOverviewTabContent',
  component: SecretsOverviewTabContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Every secret used by build configurations, each expandable to the configurations using it. Names and grant state only — values never shown.',
      },
    },
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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { secrets },
};

export const Empty: Story = {
  args: { secrets: [] },
};
