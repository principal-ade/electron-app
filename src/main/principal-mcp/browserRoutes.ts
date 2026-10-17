import { randomUUID } from 'crypto';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import type { Application } from 'express';
import {
  BrowserEvent,
  type LocalhostBrowserTarget,
} from '../../shared/main-process-api-interfaces/BrowserAPI';
import type { ProcessRegistry } from '../processes/ProcessRegistry';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { BrowserTargetError, resolveBrowserTarget } from './browserTarget';

/** Acknowledges a committed tab, not a successful webview page load. */
export function dispatchBrowserOpen(
  contents: WebContents,
  target: LocalhostBrowserTarget,
): Promise<string | undefined> {
  const requestId = randomUUID();
  return new Promise((resolve) => {
    const finish = (tabId?: string) => {
      clearTimeout(timer);
      ipcMain.removeListener(BrowserEvent.OPENED, onOpened);
      contents.removeListener('destroyed', onDestroyed);
      resolve(tabId);
    };
    const onOpened = (
      event: Electron.IpcMainEvent,
      response: { requestId?: unknown; tabId?: unknown } | undefined,
    ) => {
      if (
        event.sender === contents &&
        event.senderFrame === contents.mainFrame &&
        response?.requestId === requestId &&
        typeof response.tabId === 'string' &&
        response.tabId.length > 0
      ) {
        finish(response.tabId);
      }
    };
    const onDestroyed = () => finish();
    const timer = setTimeout(() => finish(), 3000);
    ipcMain.on(BrowserEvent.OPENED, onOpened);
    contents.once('destroyed', onDestroyed);
    try {
      contents.send(BrowserEvent.OPEN, { ...target, requestId });
    } catch {
      finish();
    }
  });
}

export function registerBrowserRoutes(
  app: Application,
  registry: ProcessRegistry,
): void {
  app.post('/api/browser/open', async (req, res) => {
    // This unauthenticated local agent endpoint must not accept browser pages.
    if (req.headers.origin || req.headers['sec-fetch-site']) {
      res.status(403).json({
        success: false,
        error: 'browser-origin requests are not allowed',
      });
      return;
    }
    try {
      const target = resolveBrowserTarget(req.body, registry.list());
      const focused = BrowserWindow.getFocusedWindow();
      const appWindow =
        focused && !focused.isDestroyed()
          ? applicationWindows.get(focused.id)
          : undefined;
      if (
        !appWindow ||
        appWindow.metadata.primaryType !== PrimaryWindowType.MAIN
      ) {
        res.json({
          success: true,
          opened: false,
          reason: 'no-focused-browser-host',
        });
        return;
      }
      const tabId = await dispatchBrowserOpen(
        appWindow.window.webContents,
        target,
      );
      res.json({
        success: true,
        opened: tabId !== undefined,
        tabId,
        processId: target.processId,
        reason: tabId ? undefined : 'browser-host-unavailable',
      });
    } catch (error) {
      if (error instanceof BrowserTargetError) {
        res.status(error.status).json({ success: false, error: error.message });
      } else {
        res
          .status(500)
          .json({ success: false, error: 'failed to open browser tab' });
      }
    }
  });
}
