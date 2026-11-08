import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { OpenBotChatView, type OpenBotChatMessage } from './OpenBotChatView';

const meta = {
  title: 'Dev Workspace/OpenBot Chat View',
  component: OpenBotChatView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A visual-only port of OpenBot’s conversation surface for exploring how a local OpenBot chat could look in a Principal tab. Messages and controls are fixtures; no OpenBot server or agent runtime is required.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OpenBotChatView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Conversation: Story = {};

export const MarkdownReply: Story = {
  args: {
    messages: [
      {
        id: 'markdown-user',
        role: 'user',
        text: 'Show me a formatted answer with a code sample.',
      },
      {
        id: 'markdown-assistant',
        role: 'assistant',
        text: [
          '### A formatted answer',
          '',
          'Streamdown renders **emphasis**, links, and lists:',
          '',
          '- First item',
          '- Second item',
          '',
          '```ts',
          'const answer = "rendered as Markdown";',
          '```',
        ].join('\n'),
      },
    ],
  },
};

const waitingMessages: OpenBotChatMessage[] = [
  {
    id: 'user-question',
    role: 'user',
    text: 'Can you summarize the changes in the current workspace?',
  },
  {
    id: 'activity-files',
    role: 'activity',
    text: 'Reading workspace files',
    detail: '6 files',
  },
];

export const Thinking: Story = {
  args: {
    busy: true,
    messages: waitingMessages,
  },
};
