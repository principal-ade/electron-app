/**
 * Production container for the bots left panel.
 *
 * Reads bots from OpenBot's `/api/agents` and conversations from
 * `/api/channels`, joins them by runtime agent id (`channel.agentIds[0]`), and
 * opens a chat tab scoped to the selected bot.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';
import type { OpenBotChatTab } from '../../events/portalTabs';
import type {
  OpenBotAgent,
  OpenBotChatChannel,
} from '../../../shared/main-process-api-interfaces/OpenBotChatAPI';
import { OpenBotChatService } from '../../main-process-api/OpenBotChatService';
import { OpenBotBotsLeftPanel, type OpenBotBot } from './OpenBotBotsLeftPanel';

export function OpenBotBotsPanel() {
  const { activeTabId, openOpenBotChat, tabs } = useWorkspaceTabs();
  const [agents, setAgents] = useState<OpenBotAgent[]>([]);
  const [channels, setChannels] = useState<OpenBotChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextAgents, nextChannels] = await Promise.all([
        OpenBotChatService.listBots(),
        OpenBotChatService.listChannels(),
      ]);
      setAgents(nextAgents);
      setChannels(nextChannels);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // OpenBot is a separate local service; recheck when the app regains focus.
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const bots = useMemo<OpenBotBot[]>(() => {
    const channelsByAgent = new Map<string, OpenBotChatChannel[]>();
    for (const channel of channels) {
      const agentId = channel.agentIds[0];
      if (!agentId) continue;
      const agentChannels = channelsByAgent.get(agentId);
      if (agentChannels) agentChannels.push(channel);
      else channelsByAgent.set(agentId, [channel]);
    }

    return agents.map((agent) => {
      const agentChannels = channelsByAgent.get(agent.id) ?? [];
      const updatedAt = agentChannels.reduce<string | undefined>(
        (latest, channel) => {
          if (!channel.lastMessageAt) return latest;
          return !latest || channel.lastMessageAt > latest
            ? channel.lastMessageAt
            : latest;
        },
        undefined,
      );
      return {
        id: agent.id,
        agentId: agent.id,
        name: agent.name,
        summary: agent.summary,
        status: 'ready',
        conversations: agentChannels.length,
        updatedAt,
      };
    });
  }, [agents, channels]);

  const activeOpenBotTab = tabs.find(
    (tab) => tab.id === activeTabId && tab.contentType === 'openbot-chat',
  ) as OpenBotChatTab | undefined;

  const selectBot = useCallback(
    (botId: string) => {
      const bot = bots.find((candidate) => candidate.id === botId);
      if (!bot?.agentId) return;
      openOpenBotChat({ agentId: bot.agentId, name: bot.name });
    },
    [bots, openOpenBotChat],
  );

  return (
    <OpenBotBotsLeftPanel
      activeBotId={activeOpenBotTab?.agentId}
      bots={bots}
      error={error}
      loading={loading}
      onRefresh={() => void load()}
      onSelectBot={selectBot}
    />
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Could not load bots.';
}

export default OpenBotBotsPanel;
