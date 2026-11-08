import { ipcRenderer } from 'electron';
import {
  OpenBotChatAPIEvent,
  type OpenBotChatAPI,
  type OpenBotChatChannel,
  type OpenBotConversation,
  type OpenBotChatRunEvent,
} from '../../shared/main-process-api-interfaces/OpenBotChatAPI';

export const openBotChatAPI: OpenBotChatAPI = {
  listChannels: listOpenBotChannels,
  getConversation: loadOpenBotConversation,
  sendMessage: sendOpenBotMessage,
  onRunEvent: onOpenBotRunEvent,
};

export function listOpenBotChannels(): Promise<OpenBotChatChannel[]> {
  return ipcRenderer.invoke(OpenBotChatAPIEvent.LIST_CHANNELS);
}

export function loadOpenBotConversation(
  channelId: string,
): Promise<OpenBotConversation> {
  return ipcRenderer.invoke(OpenBotChatAPIEvent.GET_CONVERSATION, channelId);
}

export function sendOpenBotMessage(
  channelId: string,
  text: string,
  requestId: string,
): Promise<OpenBotConversation> {
  return ipcRenderer.invoke(
    OpenBotChatAPIEvent.SEND_MESSAGE,
    channelId,
    text,
    requestId,
  );
}

export function onOpenBotRunEvent(
  callback: (event: OpenBotChatRunEvent) => void,
): () => void {
  const listener = (_ipcEvent: Electron.IpcRendererEvent, event: unknown) => {
    if (!isOpenBotChatRunEvent(event)) return;
    callback(event);
  };
  ipcRenderer.on(OpenBotChatAPIEvent.RUN_EVENT, listener);
  return () =>
    ipcRenderer.removeListener(OpenBotChatAPIEvent.RUN_EVENT, listener);
}

function isOpenBotChatRunEvent(value: unknown): value is OpenBotChatRunEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<OpenBotChatRunEvent>;
  return (
    typeof event.channelId === 'string' &&
    typeof event.requestId === 'string' &&
    ['assistant-start', 'assistant-text', 'activity', 'error'].includes(
      String(event.type),
    )
  );
}

export type { OpenBotChatChannel, OpenBotConversation };
