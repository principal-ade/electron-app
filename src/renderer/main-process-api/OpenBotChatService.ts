import type {
  OpenBotChatAPI,
  OpenBotChatChannel,
  OpenBotConversation,
  OpenBotChatRunEvent,
} from '../../shared/main-process-api-interfaces/OpenBotChatAPI';

const getApi = (): OpenBotChatAPI => {
  const api = window.mainProcess?.openbotChat;
  if (!api) throw new Error('OpenBot chat is unavailable in this window.');
  return api;
};

export class OpenBotChatService {
  static listChannels(): Promise<OpenBotChatChannel[]> {
    return getApi().listChannels();
  }

  static getConversation(channelId: string): Promise<OpenBotConversation> {
    return getApi().getConversation(channelId);
  }

  static sendMessage(
    channelId: string,
    text: string,
    requestId: string,
  ): Promise<OpenBotConversation> {
    return getApi().sendMessage(channelId, text, requestId);
  }

  static onRunEvent(
    callback: (event: OpenBotChatRunEvent) => void,
  ): () => void {
    return getApi().onRunEvent(callback);
  }
}
