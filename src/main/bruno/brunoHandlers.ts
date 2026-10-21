import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import type { BrunoRequest } from '@principal-ade/bruno-panels';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import { sendBrunoRequest, loadEnvironments } from './bruno-actions';
import { BrunoLangParserAdapter } from './adapters/BrunoLangParserAdapter';
import { RequestStore } from './RequestStore';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { notifyRequestCatalogChanged } from './requestCatalogEvents';

const parserAdapter = new BrunoLangParserAdapter();

/**
 * Register Bruno Panel IPC handlers
 */
export function registerBrunoHandlers(): void {
  const store = new RequestStore();
  const requireHost = (
    event: Electron.IpcMainInvokeEvent,
    mainOnly = false,
  ) => {
    const host = [...applicationWindows.values()].find(
      (entry) => entry.window.webContents === event.sender,
    );
    if (
      !host ||
      host.window.isDestroyed() ||
      event.senderFrame !== event.sender.mainFrame ||
      (mainOnly && host.metadata.primaryType !== PrimaryWindowType.MAIN)
    ) {
      throw new Error('Request action requires an app window.');
    }
  };
  ipcMain.handle(BrunoAPIEvent.LIST_SAVED, (event) => {
    requireHost(event, true);
    return store.load();
  });
  ipcMain.handle(BrunoAPIEvent.PIN, (event, request: unknown) => {
    requireHost(event, true);
    const saved = store.pin(request);
    notifyRequestCatalogChanged();
    return saved;
  });
  ipcMain.handle(BrunoAPIEvent.UNPIN, (event, id: unknown) => {
    requireHost(event, true);
    if (typeof id !== 'string') throw new Error('Invalid saved request id.');
    const saved = store.unpin(id);
    notifyRequestCatalogChanged();
    return saved;
  });
  ipcMain.handle(BrunoAPIEvent.LIST_ROUTES, (event) => {
    requireHost(event, true);
    return store.loadRoutes();
  });
  ipcMain.handle(BrunoAPIEvent.UPDATE_ROUTE, (event, request: unknown) => {
    requireHost(event, true);
    const routes = store.update(request);
    notifyRequestCatalogChanged();
    return routes;
  });
  ipcMain.handle(BrunoAPIEvent.FORGET_ROUTE, (event, id: unknown) => {
    requireHost(event, true);
    if (typeof id !== 'string') throw new Error('Invalid saved request id.');
    const routes = store.forget(id);
    notifyRequestCatalogChanged();
    return routes;
  });
  ipcMain.handle(
    BrunoAPIEvent.SEND_REQUEST,
    async (
      event,
      request: BrunoRequest,
      environment?: Record<string, string>,
    ) => {
      requireHost(event);
      return sendBrunoRequest(request, environment);
    },
  );

  ipcMain.handle(
    BrunoAPIEvent.LOAD_BRU_REQUEST,
    async (_event, path: string): Promise<BrunoRequest> => {
      const content = await fs.readFile(path, 'utf-8');
      const result = await parserAdapter.parseBruFile(content);

      if (!result.success || !result.request) {
        const errorMsg =
          result.errors?.[0]?.message || 'Failed to parse .bru file';
        throw new Error(`Failed to parse ${path}: ${errorMsg}`);
      }

      return result.request;
    },
  );

  ipcMain.handle(
    BrunoAPIEvent.LOAD_ENVIRONMENTS,
    async (_event, collectionPath: string) => {
      return loadEnvironments(collectionPath);
    },
  );

  console.log('[Bruno] IPC handlers registered');
}
