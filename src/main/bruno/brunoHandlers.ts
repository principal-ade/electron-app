import { ipcMain } from 'electron';
import type { BrunoRequest } from '@principal-ade/bruno-panels';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import { sendBrunoRequest } from './bruno-actions';

/**
 * Register Bruno Panel IPC handlers
 */
export function registerBrunoHandlers(): void {
  ipcMain.handle(
    BrunoAPIEvent.SEND_REQUEST,
    async (
      _event,
      request: BrunoRequest,
      environment?: Record<string, string>,
    ) => {
      return sendBrunoRequest(request, environment);
    },
  );

  console.log('[Bruno] IPC handlers registered');
}
