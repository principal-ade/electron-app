import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { StoredBuildConfiguration } from '../../../shared/build-configurations/types';
import type { BuildSecretsRequestedEvent } from '../../../shared/build-configurations/events';
import { BuildConfigurationService } from '../../main-process-api/BuildConfigurationService';
import { SecretsService } from '../../main-process-api/SecretsService';
import { BuildConfigurationTab } from './BuildConfigurationTab';

const stored: StoredBuildConfiguration = {
  id: 'bc-web-build',
  name: 'web build',
  repo: 'pkg:github/owner/repo',
  checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
  command: { line: 'npm run build', cwd: '.', timeoutMs: 900_000 },
  secrets: [
    { env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true },
    { env: 'GH_TOKEN', label: 'GitHub token', required: true },
  ],
  secretConfirmation: null,
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
};

type SecretsListener = (event: BuildSecretsRequestedEvent) => void;

function LiveContainer() {
  const [emitRequest, setEmitRequest] = useState<SecretsListener | null>(null);
  const [, setTick] = useState(0);
  // Mutable story state; the mocked services read/write it and the
  // container re-reads through get() after every mutation.
  const stateRef = React.useRef<{
    granted: string[];
    secrets: StoredBuildConfiguration['secrets'];
    confirmation: StoredBuildConfiguration['secretConfirmation'];
  }>({
    granted: ['GH_TOKEN'],
    secrets: stored.secrets,
    confirmation: null,
  });
  const rerender = () => setTick((tick) => tick + 1);

  React.useEffect(() => {
    const originalConfig = { ...BuildConfigurationService };
    const originalSecrets = { ...SecretsService };
    Object.assign(BuildConfigurationService, {
      get: async () => ({
        ...stored,
        secrets: [...stateRef.current.secrets],
        secretConfirmation: stateRef.current.confirmation,
      }),
      updateSecrets: async (_id: string, secrets: unknown) => {
        stateRef.current.secrets = [
          ...(secrets as StoredBuildConfiguration['secrets']),
        ];
        stateRef.current.confirmation = null;
        rerender();
        return {
          ...stored,
          secrets: [...stateRef.current.secrets],
          secretConfirmation: null,
        };
      },
      run: async () => ({
        ok: true,
        runId: 'run-1',
        configId: 'bc-web-build',
        terminalSessionId: 'session-1',
        status: 'running',
      }),
      getRun: async () => ({
        runId: 'run-1',
        configId: 'bc-web-build',
        terminalSessionId: 'session-1',
        status: 'succeeded',
        exitCode: 0,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      }),
      onSecretsRequested: (listener: SecretsListener) => {
        setEmitRequest(() => listener);
        return () => setEmitRequest(null);
      },
      confirmSecrets: async () => {
        const confirmation = {
          fingerprint: 'story-fingerprint',
          envNames: [...stateRef.current.granted],
        };
        stateRef.current.confirmation = confirmation;
        rerender();
        return { ...stored, secretConfirmation: confirmation };
      },
    });
    Object.assign(SecretsService, {
      getMetadata: async () => ({
        keys: [...stateRef.current.granted],
        count: stateRef.current.granted.length,
        updatedAt: new Date().toISOString(),
        repoId: 'build:bc-web-build',
      }),
      update: async (_request: unknown) => {
        const env = Object.keys(
          (_request as { secrets: Record<string, string> }).secrets,
        )[0] as string;
        if (!stateRef.current.granted.includes(env)) {
          stateRef.current.granted.push(env);
          rerender();
        }
        return { success: true };
      },
      removeKeys: async (_repoId: string, keys: string[]) => {
        stateRef.current.granted = stateRef.current.granted.filter(
          (env) => !keys.includes(env),
        );
        rerender();
        return { success: true };
      },
    });
    return () => {
      Object.assign(BuildConfigurationService, originalConfig);
      Object.assign(SecretsService, originalSecrets);
    };
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() =>
            emitRequest?.({
              configId: 'bc-web-build',
              configName: 'web build',
              missing: ['NODE_AUTH_TOKEN'],
            })
          }
        >
          Simulate agent secret request
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BuildConfigurationTab configId="bc-web-build" />
      </div>
    </div>
  );
}

const meta: Meta = {
  title: 'Workspace/BuildConfigurationTab',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Live tab container: loads the config, grants via SecretsService, clears via removeKeys, and banners agent secret requests. Services are mocked in-memory.',
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
  render: () => <LiveContainer />,
};
