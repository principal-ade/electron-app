import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { OpenBotBotsLeftPanel, type OpenBotBot } from './OpenBotBotsLeftPanel';
import {
  OpenBotChatView,
  type OpenBotChatConversation,
} from './OpenBotChatView';

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const fixtureBots: OpenBotBot[] = [
  {
    id: 'openbot',
    agentId: 'agent-openbot',
    name: 'OpenBot',
    summary: 'General workspace copilot',
    status: 'ready',
    conversations: 3,
    updatedAt: minutesAgo(4),
  },
  {
    id: 'workspace-reviewer',
    agentId: 'agent-reviewer',
    name: 'Workspace Reviewer',
    summary: 'Reads local changes and flags risks',
    status: 'working',
    conversations: 1,
    updatedAt: minutesAgo(18),
  },
  {
    id: 'docs-bot',
    agentId: 'agent-docs',
    name: 'Docs Bot',
    summary: 'Drafts docs from repository sources',
    status: 'ready',
    conversations: 2,
    updatedAt: hoursAgo(6),
  },
  {
    id: 'release-bot',
    agentId: 'agent-release',
    name: 'Release Bot',
    summary: 'Packages and publishes builds',
    status: 'offline',
    conversations: 0,
    updatedAt: daysAgo(3),
  },
];

interface BotConversation extends OpenBotChatConversation {
  /** Matches `OpenBotBot.agentId` — the channel's `agentIds[0]`. */
  agentId: string;
}

const fixtureConversations: BotConversation[] = [
  {
    id: 'openbot-ui-integration',
    agentId: 'agent-openbot',
    name: 'OpenBot UI integration',
  },
  {
    id: 'bot-side-panel',
    agentId: 'agent-openbot',
    name: 'Bot side panel layout',
  },
  {
    id: 'workspace-copilot',
    agentId: 'agent-openbot',
    name: 'Workspace copilot notes',
  },
  {
    id: 'workspace-review',
    agentId: 'agent-reviewer',
    name: 'Workspace review',
  },
  {
    id: 'onboarding-docs',
    agentId: 'agent-docs',
    name: 'Onboarding docs',
  },
  {
    id: 'api-reference',
    agentId: 'agent-docs',
    name: 'API reference draft',
  },
];

interface DockedBotsStoryProps {
  bots?: OpenBotBot[];
  initialBotId?: string;
}

/**
 * The bots panel docked beside the OpenBot chat tab, mirroring the Projects /
 * Topics / Subsystem Models left-panel layout in the workspace shell.
 */
function DockedBotsStory({
  bots = fixtureBots,
  initialBotId = 'openbot',
}: DockedBotsStoryProps) {
  const [activeBotId, setActiveBotId] = React.useState(initialBotId);
  const [notice, setNotice] = React.useState<string | null>(null);
  const activeBot = bots.find((bot) => bot.id === activeBotId);

  // Bot selection scopes the conversation list by runtime agent id — the same
  // join the adapter would use (`channel.agentIds[0] === bot.agentId`).
  const botConversations = React.useMemo(
    () =>
      activeBot?.agentId
        ? fixtureConversations.filter(
            (conversation) => conversation.agentId === activeBot.agentId,
          )
        : [],
    [activeBot?.agentId],
  );

  const [activeChannelId, setActiveChannelId] = React.useState<
    string | undefined
  >(
    () =>
      fixtureConversations.find(
        (conversation) =>
          conversation.agentId ===
          bots.find((bot) => bot.id === initialBotId)?.agentId,
      )?.id,
  );

  const selectBot = (botId: string) => {
    setActiveBotId(botId);
    const nextBot = bots.find((bot) => bot.id === botId);
    setActiveChannelId(
      fixtureConversations.find(
        (conversation) => conversation.agentId === nextBot?.agentId,
      )?.id,
    );
  };

  return (
    <ThemeProvider theme={slateNeonTheme}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: slateNeonTheme.colors.background,
        }}
      >
        <aside
          style={{
            flex: '0 0 300px',
            minWidth: 0,
            height: '100%',
            borderRight: `1px solid ${slateNeonTheme.colors.border}`,
          }}
        >
          <OpenBotBotsLeftPanel
            activeBotId={activeBotId}
            bots={bots}
            onAddBot={() =>
              setNotice('Adding bots is not supported in this preview yet.')
            }
            onRefresh={() => setNotice('Refreshed the fixture bot list.')}
            onSelectBot={selectBot}
          />
        </aside>

        <main style={{ flex: '1 1 auto', minWidth: 0, height: '100%' }}>
          <OpenBotChatView
            activeChannelId={activeChannelId}
            botName={activeBot?.name ?? 'OpenBot'}
            channels={botConversations}
            connectionState="connected"
            defaultSidebarOpen
            messages={activeChannelId ? undefined : []}
            onSelectChannel={setActiveChannelId}
          />
        </main>

        {notice ? (
          <button
            onClick={() => setNotice(null)}
            role="status"
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 2,
              padding: '7px 11px',
              border: `1px solid ${slateNeonTheme.colors.border}`,
              borderRadius: 8,
              background: slateNeonTheme.colors.surface,
              color: slateNeonTheme.colors.text,
              cursor: 'pointer',
              fontFamily: slateNeonTheme.fonts.body,
              fontSize: slateNeonTheme.fontSizes[1],
            }}
            type="button"
          >
            {notice}
          </button>
        ) : null}
      </div>
    </ThemeProvider>
  );
}

function PanelOnlyStory() {
  return (
    <ThemeProvider theme={slateNeonTheme}>
      <div
        style={{
          width: 300,
          height: '100vh',
          borderRight: `1px solid ${slateNeonTheme.colors.border}`,
        }}
      >
        <OpenBotBotsLeftPanel
          activeBotId="openbot"
          bots={fixtureBots}
          onSelectBot={() => undefined}
        />
      </div>
    </ThemeProvider>
  );
}

const meta = {
  title: 'Panels/OpenBotBotsLeftPanel',
  component: DockedBotsStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bots as a docked left panel, following the same shell convention as the Projects, Topics, and Subsystem Models panels. Selecting a bot scopes the chat’s conversations by runtime agent id; Release Bot has none, so the conversation list is empty. Fixtures only — no OpenBot server or agent runtime is required.',
      },
    },
  },
} satisfies Meta<typeof DockedBotsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Docked beside the OpenBot chat tab — the intended placement. */
export const DockedWithChat: Story = {};

/** No bots found — the empty prompt. */
export const Empty: Story = {
  args: { bots: [] },
};

/** The panel by itself at its docked width. */
export const PanelOnly: Story = {
  render: () => <PanelOnlyStory />,
};
