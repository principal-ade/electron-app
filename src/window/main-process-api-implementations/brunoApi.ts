/**
 * Bruno API - Preload implementation for renderer process
 *
 * Exposes Bruno HTTP request functionality to React components via IPC.
 */

import { ipcRenderer } from 'electron';
import type {
  BrunoRequest,
  BrunoResponse,
  BrunoEnvironment,
} from '@principal-ade/bruno-panels';
import {
  BrunoAPIEvent,
  type BrunoAPI,
} from '../../shared/main-process-api-interfaces/BrunoAPI';

export const brunoAPI: BrunoAPI = {
  onOpenRequest: (callback) => {
    const listener: Parameters<typeof ipcRenderer.on>[1] = (_event, envelope) =>
      callback(envelope);
    ipcRenderer.on(BrunoAPIEvent.OPEN, listener);
    return () => {
      ipcRenderer.removeListener(BrunoAPIEvent.OPEN, listener);
    };
  },
  acknowledgeOpen: (requestId, tabId) =>
    ipcRenderer.send(BrunoAPIEvent.OPENED, { requestId, tabId }),
  listSaved: () => ipcRenderer.invoke(BrunoAPIEvent.LIST_SAVED),
  pin: (request) => ipcRenderer.invoke(BrunoAPIEvent.PIN, request),
  unpin: (id) => ipcRenderer.invoke(BrunoAPIEvent.UNPIN, id),
  listRoutes: () => ipcRenderer.invoke(BrunoAPIEvent.LIST_ROUTES),
  updateRoute: (request) =>
    ipcRenderer.invoke(BrunoAPIEvent.UPDATE_ROUTE, request),
  forgetRoute: (id) => ipcRenderer.invoke(BrunoAPIEvent.FORGET_ROUTE, id),
  onCatalogChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on(BrunoAPIEvent.CATALOG_CHANGED, listener);
    return () => {
      ipcRenderer.removeListener(BrunoAPIEvent.CATALOG_CHANGED, listener);
    };
  },
  sendRequest: (
    request: BrunoRequest,
    environment?: Record<string, string>,
  ): Promise<BrunoResponse> => {
    return ipcRenderer.invoke(BrunoAPIEvent.SEND_REQUEST, request, environment);
  },

  loadBruRequest: (path: string): Promise<BrunoRequest> => {
    return ipcRenderer.invoke(BrunoAPIEvent.LOAD_BRU_REQUEST, path);
  },

  loadEnvironments: (collectionPath: string): Promise<BrunoEnvironment[]> => {
    return ipcRenderer.invoke(BrunoAPIEvent.LOAD_ENVIRONMENTS, collectionPath);
  },
};
