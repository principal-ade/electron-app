/**
 * PlanningAPI preload implementation
 * Provides type-safe access to planning event listeners
 */
import { ipcRenderer } from 'electron';
import { PlanningEvent } from '../../shared/ipc-events/PlanningEvents';
/**
 * Planning API implementation for preload script
 */
export const planningAPI = {
    /**
     * Listen for slide update events
     */
    onSlideUpdated: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on(PlanningEvent.SLIDE_UPDATED, subscription);
        return () => ipcRenderer.removeListener(PlanningEvent.SLIDE_UPDATED, subscription);
    },
    /**
     * Listen for slide navigation events
     */
    onSlideNavigated: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on(PlanningEvent.SLIDE_NAVIGATED, subscription);
        return () => ipcRenderer.removeListener(PlanningEvent.SLIDE_NAVIGATED, subscription);
    },
    /**
     * Listen for document load events
     */
    onDocumentLoaded: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on(PlanningEvent.DOCUMENT_LOADED, subscription);
        return () => ipcRenderer.removeListener(PlanningEvent.DOCUMENT_LOADED, subscription);
    },
    /**
     * Listen for agent document requests
     */
    onAgentDocumentRequest: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on(PlanningEvent.AGENT_DOCUMENT_REQUEST, subscription);
        return () => ipcRenderer.removeListener(PlanningEvent.AGENT_DOCUMENT_REQUEST, subscription);
    },
    /**
     * Send response to agent document request
     */
    sendAgentDocumentResponse: async (requestId, response) => {
        await ipcRenderer.invoke(PlanningEvent.AGENT_DOCUMENT_RESPONSE, requestId, response);
    },
};
