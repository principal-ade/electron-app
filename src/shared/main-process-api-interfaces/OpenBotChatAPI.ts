export enum OpenBotChatAPIEvent {
  LIST_CHANNELS = 'openbot-chat:list-channels',
  GET_CONVERSATION = 'openbot-chat:get-conversation',
  SEND_MESSAGE = 'openbot-chat:send-message',
  RUN_EVENT = 'openbot-chat:run-event',
}

export interface OpenBotChatChannel {
  id: string;
  name: string;
  summary: string | null;
  agentIds: string[];
  threadId: string;
  active: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface OpenBotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'activity';
  text: string;
  detail?: string;
}

export interface OpenBotConversation {
  channel: OpenBotChatChannel;
  messages: OpenBotChatMessage[];
}

export type OpenBotChatRunEvent =
  | {
      channelId: string;
      requestId: string;
      type: 'assistant-start';
      messageId: string;
    }
  | {
      channelId: string;
      requestId: string;
      type: 'assistant-text';
      messageId: string;
      text: string;
    }
  | {
      channelId: string;
      requestId: string;
      type: 'activity';
      messageId: string;
      text: string;
      detail?: string;
    }
  | {
      channelId: string;
      requestId: string;
      type: 'error';
      message: string;
    };

export interface OpenBotChatAPI {
  listChannels(): Promise<OpenBotChatChannel[]>;
  getConversation(channelId: string): Promise<OpenBotConversation>;
  sendMessage(
    channelId: string,
    text: string,
    requestId: string,
  ): Promise<OpenBotConversation>;
  onRunEvent(callback: (event: OpenBotChatRunEvent) => void): () => void;
}
