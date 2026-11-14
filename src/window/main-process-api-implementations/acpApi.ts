/**
 * Preload implementation of the ACP bridge.
 */
import { ipcRenderer } from 'electron';
import {
  AcpAPIEvent,
  type AcpAPI,
  type AcpConnectRequest,
  type AcpLoadSessionRequest,
  type AcpNewSessionRequest,
  type AcpPromptRequest,
  type AcpRespondPermissionRequest,
  type AcpSessionEventEnvelope,
} from '../../shared/main-process-api-interfaces/AcpAPI';

export const acpAPI: AcpAPI = {
  connect: (request: AcpConnectRequest) =>
    ipcRenderer.invoke(AcpAPIEvent.CONNECT, request),

  newSession: (request: AcpNewSessionRequest) =>
    ipcRenderer.invoke(AcpAPIEvent.NEW_SESSION, request),

  loadSession: (request: AcpLoadSessionRequest) =>
    ipcRenderer.invoke(AcpAPIEvent.LOAD_SESSION, request),

  prompt: (request: AcpPromptRequest) =>
    ipcRenderer.invoke(AcpAPIEvent.PROMPT, request),

  cancel: (request: { sessionKey: string }) =>
    ipcRenderer.invoke(AcpAPIEvent.CANCEL, request),

  respondPermission: (request: AcpRespondPermissionRequest) =>
    ipcRenderer.invoke(AcpAPIEvent.RESPOND_PERMISSION, request),

  disconnect: (request: { sessionKey: string }) =>
    ipcRenderer.invoke(AcpAPIEvent.DISCONNECT, request),

  onSessionEvent: (
    callback: (envelope: AcpSessionEventEnvelope) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      envelope: AcpSessionEventEnvelope,
    ) => callback(envelope);
    ipcRenderer.on(AcpAPIEvent.SESSION_EVENT, handler);
    return () => {
      ipcRenderer.removeListener(AcpAPIEvent.SESSION_EVENT, handler);
    };
  },
};
