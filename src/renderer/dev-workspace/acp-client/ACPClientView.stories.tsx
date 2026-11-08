import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import {
  ACPClientView,
  type ACPAgentId,
  type ACPClientViewState,
} from './ACPClientView';

const meta: Meta<typeof ACPClientView> = {
  title: 'Dev Workspace/ACP Client',
  component: ACPClientView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A UI-only agent connection and initialization flow for a future ACP client tab. The workspace directory comes from the tab; agent commands and connection states are illustrative, and no ACP messages are exchanged.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ACPClientView>;

const workspace = {
  workspacePath: '~/Developer/principal-ade/electron-app',
  repository: { owner: 'principal-ade', name: 'electron-app' },
};

export const FirstRun: Story = {
  args: workspace,
};

export const UnregisteredDirectory: Story = {
  args: { workspacePath: '~/Developer/scratch/acp-experiment' },
};

export const Initializing: Story = {
  args: { ...workspace, state: 'initializing' },
};

export const Connected: Story = {
  args: { ...workspace, state: 'ready' },
};

export const ConnectionError: Story = {
  args: {
    ...workspace,
    state: 'error',
    errorMessage:
      'OpenCode could not be found. Check that it is installed and available on PATH.',
  },
};

/** Click through the setup fields to explore the prototype; all transitions are local fixtures. */
export const InteractivePreview: Story = {
  render: () => <InteractiveACPPreview />,
};

function InteractiveACPPreview() {
  const [state, setState] = useState<ACPClientViewState>('setup');
  const [agent, setAgent] = useState<ACPAgentId>('opencode');

  React.useEffect(() => {
    if (state !== 'initializing') return;
    const timeout = window.setTimeout(() => setState('ready'), 1800);
    return () => window.clearTimeout(timeout);
  }, [state]);

  return (
    <ACPClientView
      {...workspace}
      initialAgent={agent}
      onAgentChange={setAgent}
      onInitialize={() => setState('initializing')}
      onRetry={() => setState('initializing')}
      state={state}
    />
  );
}
