import { ipcMain } from 'electron';
import { applicationWindows } from '../window/modernWindowManager';
import { OpenBotChatAPIEvent } from '../../shared/main-process-api-interfaces/OpenBotChatAPI';
import { OpenBotChatService } from './openBotChatService';

const service = new OpenBotChatService();

function requireAppMainFrame(event: Electron.IpcMainInvokeEvent): void {
  const host = [...applicationWindows.values()].find(
    (entry) => entry.window.webContents === event.sender,
  );
  if (
    !host ||
    host.window.isDestroyed() ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error(
      'OpenBot chat is only available to a Principal app window.',
    );
  }
}

export function registerOpenBotChatHandlers(): void {
  ipcMain.handle(OpenBotChatAPIEvent.LIST_BOTS, (event) => {
    requireAppMainFrame(event);
    return service.listBots();
  });

  ipcMain.handle(OpenBotChatAPIEvent.LIST_CHANNELS, (event) => {
    requireAppMainFrame(event);
    return service.listChannels();
  });

  ipcMain.handle(
    OpenBotChatAPIEvent.GET_CONVERSATION,
    (event, channelId: unknown) => {
      requireAppMainFrame(event);
      if (typeof channelId !== 'string') {
        throw new Error('Invalid OpenBot conversation id.');
      }
      return service.getConversation(channelId);
    },
  );

  ipcMain.handle(
    OpenBotChatAPIEvent.SEND_MESSAGE,
    (event, channelId: unknown, text: unknown, requestId: unknown) => {
      requireAppMainFrame(event);
      if (
        typeof channelId !== 'string' ||
        typeof text !== 'string' ||
        typeof requestId !== 'string' ||
        requestId.length > 100
      ) {
        throw new Error('Invalid OpenBot message request.');
      }
      const sender = event.sender;
      return service.sendMessage(channelId, text, requestId, (runEvent) => {
        if (!sender.isDestroyed()) {
          sender.send(OpenBotChatAPIEvent.RUN_EVENT, runEvent);
        }
      });
    },
  );
}
