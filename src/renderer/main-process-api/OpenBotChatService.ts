import type {
  OpenBotChatAPI,
  OpenBotChatChannel,
  OpenBotConversation,
  OpenBotChatRunEvent,
} from '../../shared/main-process-api-interfaces/OpenBotChatAPI';

const api: OpenBotChatAPI = window.mainProcess.openbotChat;

export class OpenBotChatService {
  static listChannels(): Promise<OpenBotChatChannel[]> {
    return api.listChannels();
  }

  static getConversation(channelId: string): Promise<OpenBotConversation> {
    return api.getConversation(channelId);
  }

  static sendMessage(
    channelId: string,
    text: string,
    requestId: string,
  ): Promise<OpenBotConversation> {
    return api.sendMessage(channelId, text, requestId);
  }

  static onRunEvent(
    callback: (event: OpenBotChatRunEvent) => void,
  ): () => void {
    return api.onRunEvent(callback);
  }
}
