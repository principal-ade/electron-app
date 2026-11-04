import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  BuildConfigurationTabContent,
  type BuildConfigurationView,
} from './BuildConfigurationTabContent';

const draftMissing: BuildConfigurationView = {
  id: 'bc-web-build',
  name: 'web build',
  repo: 'pkg:github/owner/repo',
  checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
  command: { line: 'npm run build', cwd: '.', timeoutMs: 900_000 },
  secrets: [
    {
      env: 'NODE_AUTH_TOKEN',
      label: 'npm token',
      required: true,
      granted: false,
    },
    { env: 'GH_TOKEN', label: 'GitHub token', required: true, granted: true },
  ],
  confirmed: false,
};

const approvedReady: BuildConfigurationView = {
  ...draftMissing,
  id: 'bc-api-release',
  name: 'api release',
  confirmed: true,
  checkout: { path: null, ref: 'v2.4.0', depth: 1, reset: 'clean' },
  command: {
    line: 'npm run build:release',
    cwd: 'packages/api',
    timeoutMs: 1_200_000,
  },
  secrets: [
    {
      env: 'NODE_AUTH_TOKEN',
      label: 'npm token',
      required: true,
      granted: true,
    },
    {
      env: 'SENTRY_AUTH_TOKEN',
      label: 'sentry upload',
      required: false,
      granted: true,
    },
  ],
};

const noSecrets: BuildConfigurationView = {
  ...draftMissing,
  id: 'bc-docs-lint',
  name: 'docs lint',
  command: { line: 'npm run lint:docs', cwd: 'docs', timeoutMs: 300_000 },
  secrets: [],
};

/** In-memory store: stands in for SecretsService + tab wiring. */
function InteractiveConfig({ initial }: { initial: BuildConfigurationView }) {
  const [config, setConfig] = useState(initial);
  const flip = (env: string, granted: boolean) =>
    setConfig((current) => ({
      ...current,
      secrets: current.secrets.map((secret) =>
        secret.env === env ? { ...secret, granted } : secret,
      ),
    }));
  return (
    <BuildConfigurationTabContent
      config={config}
      onSaveSecret={(env) => flip(env, true)}
      onClearSecret={(env) => flip(env, false)}
      onAddSecret={(decl) =>
        setConfig((current) => ({
          ...current,
          secrets: [...current.secrets, { ...decl, granted: false }],
        }))
      }
      onRemoveSecret={(env) =>
        setConfig((current) => ({
          ...current,
          secrets: current.secrets.filter((secret) => secret.env !== env),
        }))
      }
      onEditSecret={(oldEnv, decl) =>
        setConfig((current) => ({
          ...current,
          secrets: current.secrets.map((secret) =>
            secret.env === oldEnv
              ? {
                  ...decl,
                  granted: decl.env === oldEnv ? secret.granted : false,
                }
              : secret,
          ),
        }))
      }
      onReorderSecrets={(from, to) =>
        setConfig((current) => {
          const secrets = [...current.secrets];
          const [moved] = secrets.splice(from, 1);
          secrets.splice(to, 0, moved);
          return { ...current, secrets };
        })
      }
    />
  );
}

const meta: Meta<typeof BuildConfigurationTabContent> = {
  title: 'Workspace/BuildConfigurationTabContent',
  component: BuildConfigurationTabContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Read-only view of a build configuration with inline token set/update/clear. Saved values clear from the form immediately and are never shown back.',
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

export const DraftMissingSecrets: Story = {
  render: () => <InteractiveConfig initial={draftMissing} />,
};

export const ApprovedReady: Story = {
  render: () => <InteractiveConfig initial={approvedReady} />,
};

export const NoSecrets: Story = {
  render: () => <InteractiveConfig initial={noSecrets} />,
};
