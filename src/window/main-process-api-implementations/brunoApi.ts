/**
 * Bruno API - Preload implementation for renderer process
 *
 * Exposes Bruno HTTP request functionality to React components via IPC.
 */

import { ipcRenderer } from 'electron';
import type { BrunoRequest, BrunoResponse } from '@principal-ade/bruno-panels';
import {
  BrunoAPIEvent,
  type BrunoAPI,
} from '../../shared/main-process-api-interfaces/BrunoAPI';

export const brunoAPI: BrunoAPI = {
  sendRequest: (
    request: BrunoRequest,
    environment?: Record<string, string>,
  ): Promise<BrunoResponse> => {
    return ipcRenderer.invoke(BrunoAPIEvent.SEND_REQUEST, request, environment);
  },
};
