import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { AcpTab } from '../../events/portalTabs';
import { ACPStartupView } from './ACPTabContent';

const meta: Meta<typeof ACPStartupView> = {
  title: 'Dev Workspace/ACP Tab Startup',
  component: ACPStartupView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The pre-session ACP tab states: connecting to OpenCode, disconnected, connection failure, and ready to start a session. All actions are local no-ops; no ACP messages are exchanged.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ACPStartupView>;

const tab: AcpTab = {
  id: 'acp-story',
  label: 'electron-app',
  contentType: 'acp',
  closable: true,
  directory: '~/Developer/principal-ade/electron-app',
  repository: { owner: 'principal-ade', name: 'electron-app' },
};

const savedSessionTab: AcpTab = {
  ...tab,
  id: 'acp-story-saved',
  sessionId: 'ses_story_saved',
  sessionTitle: 'Trace the ACP session update handler',
};

const noop = () => {};

const baseArgs = {
  tab,
  hasAttemptedConnection: true,
  isStartingSession: false,
  onInitialize: noop,
  onStartSession: noop,
  onStartFreshSession: noop,
  onRetry: noop,
};

/** Connecting during automatic startup: `autoStart` before the first attempt. */
export const ConnectingOnAutoStart: Story = {
  args: {
    ...baseArgs,
    tab: { ...tab, autoStart: true },
    state: 'setup',
    hasAttemptedConnection: false,
  },
};

/** Connecting to OpenCode after the connection was initiated. */
export const Connecting: Story = {
  args: {
    ...baseArgs,
    state: 'initializing',
  },
};

/** Session creation is still in flight even though OpenCode is connected. */
export const StartingSession: Story = {
  args: {
    ...baseArgs,
    state: 'ready',
    isStartingSession: true,
  },
};

/** The connection attempt ended and the tab offers a reconnect. */
export const Disconnected: Story = {
  args: {
    ...baseArgs,
    state: 'setup',
  },
};

/** A failed connection with a saved session, so both recovery actions show. */
export const ConnectionError: Story = {
  args: {
    ...baseArgs,
    tab: savedSessionTab,
    state: 'error',
    error:
      'OpenCode could not be found. Check that it is installed and available on PATH.',
  },
};

/** Connected and ready to start a fresh session in this workspace. */
export const ReadyToStart: Story = {
  args: {
    ...baseArgs,
    state: 'ready',
  },
};

/** Never attempted: the first-run state with a Connect OpenCode action. */
export const NotConnected: Story = {
  args: {
    ...baseArgs,
    state: 'setup',
    hasAttemptedConnection: false,
  },
};
