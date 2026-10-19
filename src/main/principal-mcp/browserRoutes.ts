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

/** Renderer entry point, independent of the optional HTTP bridge. */
export function registerBrowserIpcHandlers(registry: ProcessRegistry): void {
  ipcMain.removeHandler(BrowserEvent.OPEN_LOCALHOST_URL);
  ipcMain.handle(
    BrowserEvent.OPEN_LOCALHOST_URL,
    async (event, url: unknown) => {
      const sender = [...applicationWindows.values()].find(
        (entry) => entry.window.webContents === event.sender,
      );
      if (
        !sender ||
        sender.window.isDestroyed() ||
        event.senderFrame !== event.sender.mainFrame ||
        ![
          PrimaryWindowType.MAIN,
          PrimaryWindowType.DEV_WORKSPACE,
          PrimaryWindowType.REPOSITORY,
        ].includes(sender.metadata.primaryType)
      ) {
        return { opened: false };
      }
      try {
        const target = resolveBrowserTarget({ url }, registry.list());
        const host =
          sender.metadata.primaryType === PrimaryWindowType.MAIN
            ? sender
            : [...applicationWindows.values()].find(
                (entry) =>
                  entry.metadata.primaryType === PrimaryWindowType.MAIN &&
                  !entry.window.isDestroyed(),
              );
        if (!host) return { opened: false };
        const tabId = await dispatchBrowserOpen(
          host.window.webContents,
          target,
        );
        if (!tabId) return { opened: false };
        if (!host.window.isDestroyed()) {
          if (host.window.isMinimized()) host.window.restore();
          host.window.show();
          host.window.focus();
        }
        return { opened: true };
      } catch {
        return { opened: false };
      }
    },
  );
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
