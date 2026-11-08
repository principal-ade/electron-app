import { randomUUID } from 'crypto';
import { HttpAgent, type Message } from '@ag-ui/client';
import type {
  OpenBotChatChannel,
  OpenBotChatMessage,
  OpenBotChatRunEvent,
  OpenBotConversation,
} from '../../shared/main-process-api-interfaces/OpenBotChatAPI';

const OPENBOT_BASE_URL = 'http://127.0.0.1:3010';
const MAX_CHANNEL_PAGES = 100;

type OpenBotChannelResponse = {
  channel?: unknown;
};

type OpenBotChannelPage = {
  channels?: unknown;
  nextCursor?: unknown;
};

type StoredMessagesResponse = {
  messages?: unknown;
};

export type OpenBotRunEventHandler = (event: OpenBotChatRunEvent) => void;

/**
 * Local OpenBot adapter. Network requests stay in Electron's main process so
 * OpenBot sees a loopback client, not a cross-origin browser page.
 */
export class OpenBotChatService {
  async listChannels(): Promise<OpenBotChatChannel[]> {
    const channels: OpenBotChatChannel[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_CHANNEL_PAGES; page += 1) {
      const path = cursor
        ? `/api/channels?cursor=${encodeURIComponent(cursor)}`
        : '/api/channels';
      const result = await requestJson<OpenBotChannelPage>(path);
      const pageChannels = Array.isArray(result.channels)
        ? result.channels
            .map(toChannel)
            .filter(
              (channel): channel is OpenBotChatChannel =>
                channel !== null && channel.agentIds.length === 1,
            )
        : [];
      channels.push(...pageChannels);

      cursor =
        typeof result.nextCursor === 'string' ? result.nextCursor : undefined;
      if (!cursor) return channels;
    }

    throw new Error('OpenBot returned too many conversation pages.');
  }

  async getConversation(channelId: string): Promise<OpenBotConversation> {
    const channel = await this.getChannel(channelId);
    const runtimeAgentId = channel.agentIds[0];
    if (!runtimeAgentId) {
      return { channel, messages: [] };
    }

    const storedMessages = await this.getStoredMessages(
      channel.threadId,
      runtimeAgentId,
    );
    await this.markRead(channel.id);
    return { channel, messages: toChatMessages(storedMessages) };
  }

  async sendMessage(
    channelId: string,
    text: string,
    requestId: string,
    emit: OpenBotRunEventHandler,
  ): Promise<OpenBotConversation> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Write a message before sending.');

    const channel = await this.getChannel(channelId);
    const runtimeAgentId = channel.agentIds[0];
    if (!channel.active)
      throw new Error('This OpenBot conversation is inactive.');
    if (!runtimeAgentId || channel.agentIds.length !== 1) {
      throw new Error(
        'The native chat currently supports one Bot per conversation.',
      );
    }

    const messages = await this.getStoredMessages(
      channel.threadId,
      runtimeAgentId,
    );
    const userMessage: Message = {
      id: randomUUID(),
      role: 'user',
      content: trimmed,
    };
    const agent = new HttpAgent({
      agentId: `channel:${channel.id}`,
      initialMessages: messages,
      threadId: channel.threadId,
      url: `${OPENBOT_BASE_URL}/api/copilotkit/agent/${encodeURIComponent(runtimeAgentId)}/run`,
      fetch: fetchOpenBotAgui,
    });

    await this.recordActivity(channel.id, trimmed, null);
    await this.setBusy(channel.id, true);
    let runError: string | null = null;
    try {
      // OpenBot's own chat joins the channel thread before each turn. The handshake
      // establishes thread ownership and replays the latest runtime snapshot.
      await agent.connectAgent(
        {},
        {
          onRunErrorEvent: ({ event }) => {
            runError =
              event.message || 'Could not connect to the OpenBot conversation.';
          },
          onRunFailed: ({ error }) => {
            runError =
              error.message || 'Could not connect to the OpenBot conversation.';
          },
        },
      );
      if (runError) throw new Error(runError);

      // Connect can replace the local messages with the server's thread snapshot,
      // so append the new turn only after the handshake has completed.
      const existingMessageIds = new Set(agent.messages.map(({ id }) => id));
      agent.addMessage(userMessage);

      await agent.runAgent(
        {},
        {
          onTextMessageStartEvent: ({ event }) =>
            emit({
              channelId,
              requestId,
              type: 'assistant-start',
              messageId: event.messageId,
            }),
          onTextMessageContentEvent: ({ event, textMessageBuffer }) =>
            emit({
              channelId,
              requestId,
              type: 'assistant-text',
              messageId: event.messageId,
              text: textMessageBuffer,
            }),
          onTextMessageEndEvent: ({ event, textMessageBuffer }) =>
            emit({
              channelId,
              requestId,
              type: 'assistant-text',
              messageId: event.messageId,
              text: textMessageBuffer,
            }),
          onMessagesSnapshotEvent: ({ event }) => {
            const latestReply = [...event.messages]
              .reverse()
              .find(
                (message) =>
                  message.role === 'assistant' &&
                  !existingMessageIds.has(message.id) &&
                  contentText(message.content).trim().length > 0,
              );
            if (latestReply) {
              emit({
                channelId,
                requestId,
                type: 'assistant-text',
                messageId: latestReply.id,
                text: contentText(latestReply.content),
              });
            }
          },
          onToolCallStartEvent: ({ event }) =>
            emit({
              channelId,
              requestId,
              type: 'activity',
              messageId: `tool-${event.toolCallId}`,
              text: `Using ${event.toolCallName}`,
            }),
          onRunErrorEvent: ({ event }) => {
            runError = event.message || 'OpenBot could not finish this turn.';
            emit({
              channelId,
              requestId,
              type: 'error',
              message: runError,
            });
          },
          onRunFailed: ({ error }) => {
            runError = error.message || 'OpenBot could not finish this turn.';
            emit({ channelId, requestId, type: 'error', message: runError });
          },
          onRunFinishedEvent: (finished) => {
            if (finished.outcome === 'interrupt') {
              runError =
                'OpenBot requested an interactive tool action that this native chat does not support yet.';
            } else if (
              finished.outcome === 'success' &&
              finished.pendingToolCallIds.length > 0
            ) {
              runError =
                'OpenBot requested an interactive tool action that this native chat does not support yet.';
            }
          },
        },
      );
      if (runError) throw new Error(runError);

      // The runtime can persist its final assistant message just after the HTTP
      // stream updates the local agent. Merge the durable tail before resolving
      // IPC so the native transcript does not stop at its thinking indicator.
      let finalMessages = mergeMessages(
        agent.messages,
        await this.getStoredMessages(channel.threadId, runtimeAgentId).catch(
          () => [],
        ),
      );
      let latestReply = newestAssistantReply(finalMessages, existingMessageIds);
      // OpenBot's durable thread write can trail RUN_FINISHED briefly. Give it a
      // short bounded window to appear before returning the transcript to IPC.
      for (let attempt = 0; !latestReply && attempt < 4; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        finalMessages = mergeMessages(
          agent.messages,
          await this.getStoredMessages(channel.threadId, runtimeAgentId).catch(
            () => [],
          ),
        );
        latestReply = newestAssistantReply(finalMessages, existingMessageIds);
      }
      const conversation = {
        channel,
        messages: toChatMessages(finalMessages),
      };
      const latestReplyText = latestReply
        ? contentText(latestReply.content)
        : '';
      if (!latestReplyText) {
        throw new Error('OpenBot finished this turn without a text reply.');
      }
      await this.recordActivity(channel.id, latestReplyText, runtimeAgentId);
      return conversation;
    } catch (error) {
      const message = friendlyOpenBotError(error);
      emit({ channelId, requestId, type: 'error', message });
      throw new Error(message);
    } finally {
      await this.setBusy(channel.id, false);
    }
  }

  private async getChannel(channelId: string): Promise<OpenBotChatChannel> {
    if (!channelId || channelId.length > 300) {
      throw new Error('Invalid OpenBot conversation id.');
    }
    const result = await requestJson<OpenBotChannelResponse>(
      `/api/channels/${encodeURIComponent(channelId)}`,
    );
    const channel = toChannel(result.channel);
    if (!channel) throw new Error('OpenBot returned an invalid conversation.');
    return channel;
  }

  private async getStoredMessages(
    threadId: string,
    agentId: string,
  ): Promise<Message[]> {
    const query = new URLSearchParams({ agentId });
    const result = await requestJson<StoredMessagesResponse>(
      `/api/copilotkit/threads/${encodeURIComponent(threadId)}/messages?${query}`,
    );
    return Array.isArray(result.messages)
      ? result.messages
          .map(normalizeStoredMessage)
          .filter((message): message is Message => message !== null)
      : [];
  }

  private async markRead(channelId: string): Promise<void> {
    await request(`/api/channels/${encodeURIComponent(channelId)}/read`, {
      method: 'PUT',
    });
  }

  private async setBusy(channelId: string, busy: boolean): Promise<void> {
    await request(`/api/channels/${encodeURIComponent(channelId)}/busy`, {
      method: 'POST',
      body: JSON.stringify({ busy }),
      headers: { 'content-type': 'application/json' },
    }).catch(() => undefined);
  }

  private async recordActivity(
    channelId: string,
    text: string,
    agentId: string | null,
  ): Promise<void> {
    await request(`/api/channels/${encodeURIComponent(channelId)}/activity`, {
      method: 'POST',
      body: JSON.stringify({ agentId, at: new Date().toISOString(), text }),
      headers: { 'content-type': 'application/json' },
    }).catch(() => undefined);
  }
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(path, OPENBOT_BASE_URL);
  if (url.origin !== OPENBOT_BASE_URL) {
    throw new Error('OpenBot request escaped the local service origin.');
  }

  try {
    return await fetch(url, { ...init, redirect: 'error' });
  } catch {
    throw new Error('OpenBot is not reachable at http://localhost:3010.');
  }
}

async function fetchOpenBotAgui(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const url = new URL(input);
  if (url.origin !== OPENBOT_BASE_URL) {
    throw new Error('OpenBot request escaped the local service origin.');
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, redirect: 'error' });
  } catch {
    throw new Error('OpenBot is not reachable at http://localhost:3010.');
  }

  if (!response.ok) throw new Error(await responseError(response));
  return response;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await request(path, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    const message = await responseError(response);
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    return 'OpenBot did not authorize the native chat. Use its local single-user mode or add native sign-in support.';
  }
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return `OpenBot request failed (HTTP ${response.status}).`;
}

function toChannel(value: unknown): OpenBotChatChannel | null {
  if (!value || typeof value !== 'object') return null;
  const channel = value as Record<string, unknown>;
  if (
    typeof channel.id !== 'string' ||
    typeof channel.threadId !== 'string' ||
    !Array.isArray(channel.agentIds) ||
    !channel.agentIds.every((agentId) => typeof agentId === 'string')
  ) {
    return null;
  }
  return {
    id: channel.id,
    name:
      typeof channel.name === 'string' ? channel.name : 'OpenBot conversation',
    summary: typeof channel.summary === 'string' ? channel.summary : null,
    agentIds: channel.agentIds,
    threadId: channel.threadId,
    active: channel.active !== false,
    lastMessage:
      typeof channel.lastMessage === 'string' ? channel.lastMessage : null,
    lastMessageAt:
      typeof channel.lastMessageAt === 'string' ? channel.lastMessageAt : null,
  };
}

function normalizeStoredMessage(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (
    typeof message.id !== 'string' ||
    !['user', 'assistant', 'system', 'developer', 'tool', 'activity'].includes(
      String(message.role),
    )
  ) {
    return null;
  }

  const normalized = withCurrentA2uiVersion({ ...message });
  if (normalized.role === 'assistant' && normalized.content === null) {
    delete normalized.content;
  }
  if (Array.isArray(normalized.toolCalls)) {
    const calls = normalized.toolCalls;
    if (
      calls.every(
        (call) =>
          !!call &&
          typeof call === 'object' &&
          'name' in call &&
          'args' in call &&
          !('function' in call),
      )
    ) {
      normalized.toolCalls = calls.map((call) => {
        const stored = call as { id?: unknown; name?: unknown; args?: unknown };
        return {
          id: typeof stored.id === 'string' ? stored.id : randomUUID(),
          type: 'function',
          function: {
            name: typeof stored.name === 'string' ? stored.name : 'tool',
            arguments: argumentsOf(stored.args),
          },
        };
      });
    }
  }
  return normalized as unknown as Message;
}

function mergeMessages(
  local: readonly Message[],
  stored: readonly Message[],
): Message[] {
  const merged = [...local];
  const indices = new Map(local.map((message, index) => [message.id, index]));
  for (const message of stored) {
    const index = indices.get(message.id);
    if (index === undefined) {
      indices.set(message.id, merged.length);
      merged.push(message);
    } else {
      const current = merged[index];
      if (
        message.role === 'assistant' &&
        contentText(message.content).length >
          contentText(current.content).length
      ) {
        merged[index] = message;
      }
    }
  }
  return merged;
}

function newestAssistantReply(
  messages: readonly Message[],
  existingMessageIds: ReadonlySet<string>,
): Message | undefined {
  return [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'assistant' &&
        !existingMessageIds.has(message.id) &&
        contentText(message.content).trim().length > 0,
    );
}

function withCurrentA2uiVersion(
  message: Record<string, unknown>,
): Record<string, unknown> {
  if (
    message.role !== 'activity' ||
    message.activityType !== 'generative-ui-surface' ||
    !message.content ||
    typeof message.content !== 'object'
  ) {
    return message;
  }
  const content = message.content as Record<string, unknown>;
  if (!Array.isArray(content.operations)) return message;
  const operations = content.operations as unknown[];
  if (
    !operations.some(
      (operation) =>
        !!operation &&
        typeof operation === 'object' &&
        (operation as { version?: unknown }).version === 'v1.0',
    )
  ) {
    return message;
  }
  return {
    ...message,
    content: {
      ...content,
      operations: operations.map((operation) =>
        !!operation &&
        typeof operation === 'object' &&
        (operation as { version?: unknown }).version === 'v1.0'
          ? { ...operation, version: '1.0' }
          : operation,
      ),
    },
  };
}

function argumentsOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '{}';
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

function toChatMessages(messages: readonly Message[]): OpenBotChatMessage[] {
  const visible: OpenBotChatMessage[] = [];
  for (const message of messages) {
    if (message.role === 'user' || message.role === 'assistant') {
      const text = contentText(message.content);
      if (text) visible.push({ id: message.id, role: message.role, text });
      if (message.role === 'assistant') {
        for (const [index, toolCall] of (message.toolCalls ?? []).entries()) {
          const name = toolCall.function?.name ?? 'OpenBot tool';
          visible.push({
            id: `${message.id}-tool-${index}`,
            role: 'activity',
            text: `Used ${name}`,
          });
        }
      }
    } else if (message.role === 'activity') {
      visible.push({
        id: message.id,
        role: 'activity',
        text: message.activityType || 'OpenBot activity',
      });
    } else if (message.role === 'tool') {
      const text = contentText(message.content);
      visible.push({
        id: message.id,
        role: 'activity',
        text: 'Tool result',
        ...(text ? { detail: text.slice(0, 240) } : {}),
      });
    }
  }
  return visible;
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .flatMap((part) => {
      if (!part || typeof part !== 'object') return [];
      const text = (part as { type?: unknown; text?: unknown }).text;
      return typeof text === 'string' ? [text] : [];
    })
    .join('');
}

function friendlyOpenBotError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'OpenBot could not finish this turn.';
}
