import React from 'react';
import type { OpenBotChatChannel } from '../../../shared/main-process-api-interfaces/OpenBotChatAPI';
import type { OpenBotChatMessage } from './OpenBotChatView';
import { OpenBotChatView } from './OpenBotChatView';
import { OpenBotChatService } from '../../main-process-api/OpenBotChatService';

export function OpenBotChatTabContent() {
  const [channels, setChannels] = React.useState<OpenBotChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = React.useState<
    string | undefined
  >();
  const [messages, setMessages] = React.useState<OpenBotChatMessage[]>([]);
  const [connectionState, setConnectionState] = React.useState<
    'connecting' | 'connected' | 'error'
  >('connecting');
  const [connectionError, setConnectionError] = React.useState<string | null>(
    null,
  );
  const [loadingConversation, setLoadingConversation] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const currentChannelId = React.useRef<string | undefined>(undefined);
  const historyRequest = React.useRef(0);

  currentChannelId.current = activeChannelId;

  const refreshChannels = React.useCallback(async () => {
    setConnectionState('connecting');
    setConnectionError(null);
    try {
      const result = await OpenBotChatService.listChannels();
      setChannels(result);
      setConnectionState('connected');
      setActiveChannelId((current) =>
        current && result.some((channel) => channel.id === current)
          ? current
          : result[0]?.id,
      );
    } catch (error) {
      setConnectionState('error');
      setConnectionError(errorMessage(error));
    }
  }, []);

  const loadConversation = React.useCallback(async (channelId: string) => {
    const request = ++historyRequest.current;
    setLoadingConversation(true);
    setConnectionError(null);
    try {
      const conversation = await OpenBotChatService.getConversation(channelId);
      if (historyRequest.current === request) {
        setMessages(conversation.messages);
        setChannels((previous) =>
          previous.map((channel) =>
            channel.id === conversation.channel.id
              ? conversation.channel
              : channel,
          ),
        );
      }
    } catch (error) {
      if (historyRequest.current === request) {
        setConnectionError(errorMessage(error));
      }
    } finally {
      if (historyRequest.current === request) setLoadingConversation(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshChannels();
  }, [refreshChannels]);

  React.useEffect(() => {
    if (!activeChannelId) {
      historyRequest.current += 1;
      setMessages([]);
      setLoadingConversation(false);
      return;
    }
    void loadConversation(activeChannelId);
  }, [activeChannelId, loadConversation]);

  React.useEffect(
    () =>
      OpenBotChatService.onRunEvent((event) => {
        if (event.channelId !== currentChannelId.current) return;
        if (event.type === 'error') {
          setConnectionError(event.message);
          return;
        }
        if (event.type === 'assistant-start') {
          setMessages((previous) =>
            previous.some((message) => message.id === event.messageId)
              ? previous
              : [
                  ...previous,
                  { id: event.messageId, role: 'assistant', text: '' },
                ],
          );
          return;
        }
        if (event.type === 'assistant-text') {
          setMessages((previous) => {
            const found = previous.some(
              (message) => message.id === event.messageId,
            );
            return found
              ? previous.map((message) =>
                  message.id === event.messageId
                    ? { ...message, role: 'assistant', text: event.text }
                    : message,
                )
              : [
                  ...previous,
                  { id: event.messageId, role: 'assistant', text: event.text },
                ];
          });
          return;
        }
        setMessages((previous) =>
          previous.some((message) => message.id === event.messageId)
            ? previous
            : [
                ...previous,
                {
                  id: event.messageId,
                  role: 'activity',
                  text: event.text,
                  ...(event.detail ? { detail: event.detail } : {}),
                },
              ],
        );
      }),
    [],
  );

  const sendMessage = React.useCallback(
    async (text: string) => {
      if (!activeChannelId || busy) return;
      const channelId = activeChannelId;
      const requestId = `openbot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setBusy(true);
      setConnectionError(null);
      setMessages((previous) => [
        ...previous,
        { id: `${requestId}-user`, role: 'user', text },
      ]);
      try {
        const conversation = await OpenBotChatService.sendMessage(
          channelId,
          text,
          requestId,
        );
        if (currentChannelId.current === channelId) {
          setMessages(conversation.messages);
          setChannels((previous) =>
            previous.map((channel) =>
              channel.id === channelId ? conversation.channel : channel,
            ),
          );
        }
      } catch (error) {
        setConnectionError(errorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [activeChannelId, busy],
  );

  const activeChannel = channels.find(
    (channel) => channel.id === activeChannelId,
  );
  const retry = () => {
    if (activeChannelId) void loadConversation(activeChannelId);
    else void refreshChannels();
  };

  return (
    <OpenBotChatView
      activeChannelId={activeChannelId}
      botName={activeChannel?.name ?? 'OpenBot'}
      busy={busy}
      channels={channels}
      connectionError={connectionError}
      connectionState={connectionState}
      loadingConversation={loadingConversation}
      messages={messages}
      onRetry={retry}
      onSelectChannel={setActiveChannelId}
      onSendMessage={
        activeChannel?.active &&
        connectionState === 'connected' &&
        !connectionError &&
        !loadingConversation
          ? sendMessage
          : undefined
      }
    />
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'OpenBot connection failed.';
}
