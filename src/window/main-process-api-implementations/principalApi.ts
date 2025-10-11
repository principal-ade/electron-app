/**
 * PrincipalAPI preload implementation
 * Provides type-safe access to principal MCP event listeners
 */

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  PrincipalAPI,
  SlideUpdatedEvent,
  SlideNavigatedEvent,
  DocumentLoadedEvent,
  AgentDocumentRequest,
  AgentDocumentResponse,
} from '../../shared/main-process-api-interfaces/PrincipalAPI';
import { PrincipalEvent } from '../../shared/ipc-events/PrincipalEvents';

/**
 * Principal API implementation for preload script
 */
export const principalAPI: PrincipalAPI = {
  /**
   * Listen for slide update events
   */
  onSlideUpdated: (callback: (data: SlideUpdatedEvent) => void) => {
    const subscription = (_event: IpcRendererEvent, data: SlideUpdatedEvent) =>
      callback(data);
    ipcRenderer.on(PrincipalEvent.SLIDE_UPDATED, subscription);
    return () =>
      ipcRenderer.removeListener(PrincipalEvent.SLIDE_UPDATED, subscription);
  },

  /**
   * Listen for slide navigation events
   */
  onSlideNavigated: (callback: (data: SlideNavigatedEvent) => void) => {
    const subscription = (
      _event: IpcRendererEvent,
      data: SlideNavigatedEvent,
    ) => callback(data);
    ipcRenderer.on(PrincipalEvent.SLIDE_NAVIGATED, subscription);
    return () =>
      ipcRenderer.removeListener(PrincipalEvent.SLIDE_NAVIGATED, subscription);
  },

  /**
   * Listen for document load events
   */
  onDocumentLoaded: (callback: (data: DocumentLoadedEvent) => void) => {
    const subscription = (
      _event: IpcRendererEvent,
      data: DocumentLoadedEvent,
    ) => callback(data);
    ipcRenderer.on(PrincipalEvent.DOCUMENT_LOADED, subscription);
    return () =>
      ipcRenderer.removeListener(PrincipalEvent.DOCUMENT_LOADED, subscription);
  },

  /**
   * Listen for agent document requests
   */
  onAgentDocumentRequest: (callback: (data: AgentDocumentRequest) => void) => {
    const subscription = (
      _event: IpcRendererEvent,
      data: AgentDocumentRequest,
    ) => callback(data);
    ipcRenderer.on(PrincipalEvent.AGENT_DOCUMENT_REQUEST, subscription);
    return () =>
      ipcRenderer.removeListener(
        PrincipalEvent.AGENT_DOCUMENT_REQUEST,
        subscription,
      );
  },

  /**
   * Send response to agent document request
   */
  sendAgentDocumentResponse: async (
    requestId: string,
    response: AgentDocumentResponse,
  ) => {
    await ipcRenderer.invoke(
      PrincipalEvent.AGENT_DOCUMENT_RESPONSE,
      requestId,
      response,
    );
  },
};
