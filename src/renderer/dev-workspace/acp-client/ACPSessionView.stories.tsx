import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { ACPSessionView, type AcpChatMessage } from './ACPSessionView';
import { getAcpAgent } from '../../../shared/main-process-api-interfaces/AcpAPI';

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
