export enum OpenBotChatAPIEvent {
  LIST_BOTS = 'openbot-chat:list-bots',
  LIST_CHANNELS = 'openbot-chat:list-channels',
  GET_CONVERSATION = 'openbot-chat:get-conversation',
  GET_DEPLOYMENT_SNAPSHOT = 'openbot-chat:get-deployment-snapshot',
  SEND_MESSAGE = 'openbot-chat:send-message',
  RUN_EVENT = 'openbot-chat:run-event',
}

/** A Bot (OpenBot agent) that conversations can be opened with. */
export interface OpenBotAgent {
  id: string;
  name: string;
  summary: string | null;
  hidden: boolean;
  builtIn: boolean;
  pinned: boolean;
  visibility: string | null;
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

export type OpenBotHealthState = 'healthy' | 'degraded' | 'offline' | 'unknown';

export interface OpenBotDeploymentComponent {
  id: 'api' | 'worker' | 'database' | 'inference';
  label: string;
  detail: string;
  state: OpenBotHealthState;
  metric?: string;
}

export interface OpenBotDeploymentEvent {
  id: string;
  title: string;
  detail: string;
  state: OpenBotHealthState;
}

export interface OpenBotDeploymentSnapshot {
  state: OpenBotHealthState;
  endpoint: string;
  source: string;
  branch?: string;
  revision?: string;
  deploymentMode: string;
  checkedAt: string;
  components: OpenBotDeploymentComponent[];
  events: OpenBotDeploymentEvent[];
  eventsMessage?: string;
  coverageNote?: string;
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
  listBots(): Promise<OpenBotAgent[]>;
  listChannels(): Promise<OpenBotChatChannel[]>;
  getConversation(channelId: string): Promise<OpenBotConversation>;
  getDeploymentSnapshot(): Promise<OpenBotDeploymentSnapshot>;
  sendMessage(
    channelId: string,
    text: string,
    requestId: string,
  ): Promise<OpenBotConversation>;
  onRunEvent(callback: (event: OpenBotChatRunEvent) => void): () => void;
}
