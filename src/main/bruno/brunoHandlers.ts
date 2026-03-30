import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import type { BrunoRequest } from '@principal-ade/bruno-panels';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import { sendBrunoRequest } from './bruno-actions';
import { BrunoLangParserAdapter } from './adapters/BrunoLangParserAdapter';

const parserAdapter = new BrunoLangParserAdapter();

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

  ipcMain.handle(
    BrunoAPIEvent.LOAD_BRU_REQUEST,
    async (_event, path: string): Promise<BrunoRequest> => {
      const content = await fs.readFile(path, 'utf-8');
      const result = await parserAdapter.parseBruFile(content);

      if (!result.success || !result.request) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to parse .bru file';
        throw new Error(`Failed to parse ${path}: ${errorMsg}`);
      }

      return result.request;
    },
  );

  console.log('[Bruno] IPC handlers registered');
}
