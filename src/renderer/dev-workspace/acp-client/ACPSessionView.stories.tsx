import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { ACPSessionView, type AcpChatMessage } from './ACPSessionView';
import { getAcpAgent } from '../../../shared/main-process-api-interfaces/AcpAPI';
import './ACPClientView.css';

const meta: Meta<typeof ACPSessionView> = {
  title: 'Dev Workspace/ACP Session',
  component: ACPSessionView,
  parameters: {
    layout: 'fullscreen',
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
type Story = StoryObj<typeof ACPSessionView>;

const messages: AcpChatMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    text: 'Find the ACP event flow and summarize how tool calls reach the UI.',
  },
  {
    id: 'agent-1',
    role: 'agent',
    text: 'I’ll trace the ACP session update handler and the tab renderer.\n\nI’ll also check **how replies are rendered** and include a small code example:\n\n```ts\nconst streaming = isPrompting && isLatestMessage;\n```',
  },
  {
    id: 'tool-1',
    role: 'tool',
    toolCallId: 'call-1',
    title: 'Searching ACP session handlers',
    name: 'grep',
    kind: 'search',
    status: 'completed',
    processing: 'highlighted',
    detail: 'Found 6 matching files',
    locations: [
      {
        path: '/repo/src/main/acp/AcpService.ts',
        line: 466,
      },
    ],
    rawInput: { pattern: 'handleSessionUpdate', path: 'src/main/acp' },
  },
  {
    id: 'tool-2',
    role: 'tool',
    toolCallId: 'call-2',
    title: 'Reading the ACP event handler',
    name: 'read_file',
    kind: 'read',
    status: 'in_progress',
    locations: [{ path: '/repo/src/main/acp/AcpService.ts', line: 466 }],
    rawInput: { path: 'src/main/acp/AcpService.ts', offset: 466 },
  },
  {
    id: 'agent-2',
    role: 'agent',
    text: 'The main process forwards each session update to the renderer.\n\n- ACP chunks are accumulated in the tab\n- Streamdown renders the reply as Markdown',
  },
  {
    id: 'tool-3',
    role: 'tool',
    toolCallId: 'call-associate-model',
    title: 'Associating the ACP bridge model',
    name: 'shell',
    kind: 'execute',
    status: 'completed',
    rawInput: {
      command:
        'curl -s -X POST http://[::1]:3054/api/acp/sessions/ses_story/artifacts -d \'{"kind":"subsystem-model","id":"sm_123","title":"ACP bridge"}\'',
    },
  },
  {
    id: 'tool-4',
    role: 'tool',
    toolCallId: 'call-associate-topic',
    title: 'Associating the bridge topic',
    name: 'shell',
    kind: 'execute',
    status: 'completed',
    rawInput: {
      command:
        'curl -s -X POST http://[::1]:3054/api/acp/sessions/ses_story/artifacts -d \'{"kind":"topic","id":"topic-123"}\'',
    },
  },
  {
    id: 'tool-5',
    role: 'tool',
    toolCallId: 'call-read-drawing',
    title: 'Reading the launch plan drawing',
    name: 'shell',
    kind: 'execute',
    status: 'completed',
    rawInput: {
      command: 'cat ~/.alexandria/drawings/launch-plan.excalidraw',
    },
  },
];

export const ToolCallActivity: Story = {
  args: {
    agent: getAcpAgent('opencode'),
    workspacePath: '~/Developer/principal-ade/electron-app',
    repository: { owner: 'principal-ai', name: 'electron-app' },
    messages,
    permissions: [],
    isPrompting: true,
    onSend: () => {},
    onStop: () => {},
    onRespondPermission: () => {},
  },
};

/** A collapsed reasoning trail: thought text is hidden behind an activity summary. */
export const HiddenThinking: Story = {
  args: {
    agent: getAcpAgent('opencode'),
    workspacePath: '~/Developer/principal-ade/electron-app',
    repository: { owner: 'principal-ai', name: 'electron-app' },
    messages: [
      {
        id: 'user-hide-thinking',
        role: 'user',
        text: 'Trace how ACP tool calls reach the chat view.',
      },
      {
        id: 'thought-hide-1',
        role: 'thought',
        text: 'I should start with the session event subscription.',
      },
      {
        id: 'tool-hide-1',
        role: 'tool',
        toolCallId: 'call-hide-1',
        title: 'Searching ACP session handlers',
        name: 'grep',
        kind: 'search',
        status: 'completed',
      },
      {
        id: 'thought-hide-2',
        role: 'thought',
        text: 'The subscription forwards updates through applyUpdate.',
      },
      {
        id: 'tool-hide-2',
        role: 'tool',
        toolCallId: 'call-hide-2',
        title: 'Reading updated render logic',
        name: 'read_file',
        kind: 'read',
        status: 'in_progress',
      },
    ],
    permissions: [],
    isPrompting: true,
    hideThinking: true,
    onToggleHideThinking: () => {},
    onSend: () => {},
    onStop: () => {},
    onRespondPermission: () => {},
  },
};

/** A pull request attached to the tab, shown in the Artifacts panel. */
export const LinkedPullRequest: Story = {
  args: {
    agent: getAcpAgent('opencode'),
    workspacePath: '~/Developer/principal-ade/electron-app',
    repository: { owner: 'principal-ade', name: 'electron-app' },
    messages,
    permissions: [],
    isPrompting: false,
    pullRequest: {
      owner: 'principal-ade',
      repo: 'electron-app',
      number: 412,
      url: 'https://github.com/principal-ade/electron-app/pull/412',
    },
    onLinkPullRequest: () => {},
    onUnlinkPullRequest: () => {},
    onSend: () => {},
    onStop: () => {},
    onRespondPermission: () => {},
  },
};

/** Empty session with the searchable model picker shown before the first message. */
export const ModelPicker: Story = {
  args: {
    agent: getAcpAgent('opencode'),
    workspacePath: '~/Developer/principal-ade/electron-app',
    repository: { owner: 'principal-ai', name: 'electron-app' },
    messages: [],
    permissions: [],
    isPrompting: false,
    modelSelection: {
      currentValue: 'opencode-go/deepseek-v4.1-flash',
      options: [
        {
          value: 'opencode-go/deepseek-v4.1-flash',
          name: 'DeepSeek V4.1 Flash',
          provider: 'opencode-go',
        },
        {
          value: 'opencode-go/deepseek-v4-pro',
          name: 'DeepSeek V4 Pro',
          provider: 'opencode-go',
        },
        {
          value: 'opencode-go/claude-haiku-5-5',
          name: 'Claude Haiku 5.5',
          provider: 'opencode-go',
        },
        {
          value: 'openrouter/anthropic/claude-sonnet-4-5',
          name: 'Claude Sonnet 4.5',
          provider: 'openrouter',
        },
        {
          value: 'ollama/gemma3:4b',
          name: 'gemma3:4b',
          provider: 'ollama',
        },
      ],
    },
    onModelChange: () => {},
    onSend: () => {},
    onStop: () => {},
    onRespondPermission: () => {},
  },
};
