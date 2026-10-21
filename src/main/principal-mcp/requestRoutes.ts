import { randomUUID } from 'crypto';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import type { Application } from 'express';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import {
  parsePreparedRequest,
  type SavedRequest,
} from '../../shared/requests/preparedRequest';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { RequestStore } from '../bruno/RequestStore';
import { notifyRequestCatalogChanged } from '../bruno/requestCatalogEvents';

export function dispatchRequestOpen(
  contents: WebContents,
  request: SavedRequest,
): Promise<string | undefined> {
  const requestId = randomUUID();
  return new Promise((resolve) => {
    const finish = (tabId?: string) => {
      clearTimeout(timer);
      ipcMain.removeListener(BrunoAPIEvent.OPENED, onOpened);
      contents.removeListener('destroyed', onDestroyed);
      resolve(tabId);
    };
    const onOpened = (
      event: Electron.IpcMainEvent,
      response?: { requestId?: unknown; tabId?: unknown },
    ) => {
      if (
        event.sender === contents &&
        event.senderFrame === contents.mainFrame &&
        response?.requestId === requestId &&
        response.tabId === `http-request-${request.id}`
      ) {
        finish(response.tabId);
      }
    };
    const onDestroyed = () => finish();
    const timer = setTimeout(() => finish(), 3000);
    ipcMain.on(BrunoAPIEvent.OPENED, onOpened);
    contents.once('destroyed', onDestroyed);
    try {
      contents.send(BrunoAPIEvent.OPEN, { ...request, requestId });
    } catch {
      finish();
    }
  });
}

export function registerRequestRoutes(
  app: Application,
  store = new RequestStore(),
): void {
  app.post('/api/requests/open', async (req, res) => {
    if (
      req.headers.origin !== undefined ||
      req.headers['sec-fetch-site'] !== undefined
    ) {
      res.status(403).json({
        success: false,
        error: 'browser-origin requests are not allowed',
      });
      return;
    }
    let request: SavedRequest;
    try {
      request = { ...parsePreparedRequest(req.body), id: randomUUID() };
    } catch (error) {
      res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Invalid request definition.',
      });
      return;
    }
    try {
      request = store.remember(request);
      notifyRequestCatalogChanged();
    } catch {
      res.status(503).json({
        success: false,
        error:
          'Could not remember the route securely. Check secure storage and catalog capacity.',
      });
      return;
    }
    const focused = BrowserWindow.getFocusedWindow();
    const host =
      focused && !focused.isDestroyed()
        ? applicationWindows.get(focused.id)
        : undefined;
    if (!host || host.metadata.primaryType !== PrimaryWindowType.MAIN) {
      res.json({
        success: true,
        opened: false,
        reason: 'no-focused-request-host',
      });
      return;
    }
    const tabId = await dispatchRequestOpen(host.window.webContents, request);
    res.json({
      success: true,
      opened: !!tabId,
      tabId,
      reason: tabId ? undefined : 'request-host-unavailable',
    });
  });
}
