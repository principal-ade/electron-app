/**
 * PlanningAPI preload implementation
 * Provides type-safe access to planning event listeners
 */

import { ipcRenderer } from 'electron';
import type {
  PlanningAPI,
  SlideUpdatedEvent,
  SlideNavigatedEvent,
  DocumentLoadedEvent,
  AgentDocumentRequest,
  AgentDocumentResponse
} from '../../shared/main-process-api-interfaces/PlanningAPI';
import { PlanningEvent } from '../../shared/ipc-events/PlanningEvents';

/**
 * Planning API implementation for preload script
 */
export const planningAPI: PlanningAPI = {
  /**
   * Listen for slide update events
   */
  onSlideUpdated: (callback: (data: SlideUpdatedEvent) => void) => {
    const subscription = (_event: any, data: SlideUpdatedEvent) => callback(data);
    ipcRenderer.on(PlanningEvent.SLIDE_UPDATED, subscription);
    return () => ipcRenderer.removeListener(PlanningEvent.SLIDE_UPDATED, subscription);
  },

  /**
   * Listen for slide navigation events
   */
  onSlideNavigated: (callback: (data: SlideNavigatedEvent) => void) => {
    const subscription = (_event: any, data: SlideNavigatedEvent) => callback(data);
    ipcRenderer.on(PlanningEvent.SLIDE_NAVIGATED, subscription);
    return () => ipcRenderer.removeListener(PlanningEvent.SLIDE_NAVIGATED, subscription);
  },

  /**
   * Listen for document load events
   */
  onDocumentLoaded: (callback: (data: DocumentLoadedEvent) => void) => {
    const subscription = (_event: any, data: DocumentLoadedEvent) => callback(data);
    ipcRenderer.on(PlanningEvent.DOCUMENT_LOADED, subscription);
    return () => ipcRenderer.removeListener(PlanningEvent.DOCUMENT_LOADED, subscription);
  },

  /**
   * Listen for agent document requests
   */
  onAgentDocumentRequest: (callback: (data: AgentDocumentRequest) => void) => {
    const subscription = (_event: any, data: AgentDocumentRequest) => callback(data);
    ipcRenderer.on(PlanningEvent.AGENT_DOCUMENT_REQUEST, subscription);
    return () => ipcRenderer.removeListener(PlanningEvent.AGENT_DOCUMENT_REQUEST, subscription);
  },

  /**
   * Send response to agent document request
   */
  sendAgentDocumentResponse: async (requestId: string, response: AgentDocumentResponse) => {
    await ipcRenderer.invoke(PlanningEvent.AGENT_DOCUMENT_RESPONSE, requestId, response);
  },
};