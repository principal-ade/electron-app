/**
 * IPC registration for the ACP bridge. One child agent process per workspace
 * ACP tab, keyed by the tab id supplied by the renderer.
 */
import { app, ipcMain } from 'electron';
import {
  AcpAPIEvent,
  type AcpConnectRequest,
  type AcpDisconnectRequest,
  type AcpLoadSessionRequest,
  type AcpNewSessionRequest,
  type AcpPromptRequest,
  type AcpRespondPermissionRequest,
} from '../../shared/main-process-api-interfaces/AcpAPI';
import { getAcpService } from './AcpService';

function requireRendererFrame(
  event: Electron.IpcMainInvokeEvent,
): void {
  if (
    !event.sender ||
    event.sender.isDestroyed() ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('ACP is only available to a Principal app window.');
  }
}

export function registerAcpHandlers(): void {
  const service = getAcpService();

  ipcMain.handle(
    AcpAPIEvent.CONNECT,
    (event, request: AcpConnectRequest) => {
      requireRendererFrame(event);
      return service.connect(request, event.sender);
    },
  );

  ipcMain.handle(
    AcpAPIEvent.NEW_SESSION,
    (event, request: AcpNewSessionRequest) => {
      requireRendererFrame(event);
      return service.newSession(request);
    },
  );

  ipcMain.handle(
    AcpAPIEvent.LOAD_SESSION,
    (event, request: AcpLoadSessionRequest) => {
      requireRendererFrame(event);
      return service.loadSession(request);
    },
  );

  ipcMain.handle(AcpAPIEvent.PROMPT, (event, request: AcpPromptRequest) => {
    requireRendererFrame(event);
    return service.prompt(request);
  });

  ipcMain.handle(
    AcpAPIEvent.CANCEL,
    (event, request: { sessionKey: string }) => {
      requireRendererFrame(event);
      return service.cancel(request);
    },
  );

  ipcMain.handle(
    AcpAPIEvent.RESPOND_PERMISSION,
    (event, request: AcpRespondPermissionRequest) => {
      requireRendererFrame(event);
      return service.respondPermission(request);
    },
  );

  ipcMain.handle(
    AcpAPIEvent.DISCONNECT,
    (event, request: AcpDisconnectRequest) => {
      requireRendererFrame(event);
      return service.disconnect(request);
    },
  );

  app.on('will-quit', () => {
    service.disposeAll();
  });
}
