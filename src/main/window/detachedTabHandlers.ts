/**
 * Detached-tab window handlers.
 *
 * Owns the transfer protocol that moves a workspace tab into a standalone
 * window and back:
 *
 * 1. The source renderer asks for a new window (`OPEN_DETACHED_TAB`) with a
 *    serializable {@link DetachableTabDescriptor}.
 * 2. Main mints an opaque token, stores the descriptor in-process, creates the
 *    window, and loads `detached-tab.html#transfer/<token>`. The descriptor is
 *    never put in the URL.
 * 3. The destination claims the token (`DETACHED_TAB_CLAIM`), renders, and
 *    accepts (`DETACHED_TAB_ACCEPT`) or rejects. Only an accept removes the
 *    source tab; failure, rejection, timeout, or window close leaves it intact.
 * 4. Moving back (`RETURN_DETACHED_TAB`) uses the same token/handshake, with
 *    main delivering a *notification* to the main window repeatedly until it
 *    claims, so a freshly created main window cannot miss the event.
 *
 * Both directions validate the IPC sender's window id against the transfer
 * record before returning the descriptor or settling it.
 */

import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';
import { randomUUID } from 'crypto';
import { resolveHtmlPath } from '../util';
import {
  createSpecialWindow,
  focusExistingSpecialWindow,
  focusOrCreateMainWindow,
  getApplicationWindows,
} from './modernWindowManager';
import {
  getMainWindowId,
  PrimaryWindowType,
  type WindowMetadata,
} from './types';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import {
  isDetachableTabDescriptor,
  type DetachableTabDescriptor,
  type DetachedTabOpenResult,
  type DetachedTabReturnResult,
} from '../../shared/detachedTab';

const DETACHED_PURPOSE_PREFIX = 'detached-tab:';
const TRANSFER_TIMEOUT_MS = 20_000;
const INCOMING_NOTIFY_INTERVAL_MS = 500;

type TransferDirection = 'detach' | 'return';

interface TransferOutcome {
  accepted: boolean;
  reason?: string;
}

interface TransferRecord {
  token: string;
  tab: DetachableTabDescriptor;
  direction: TransferDirection;
  sourceWindowId: number;
  targetWindowId: number;
  claimed: boolean;
  settled: boolean;
  accepted: boolean;
  settle: (outcome: TransferOutcome) => void;
  timeout: ReturnType<typeof setTimeout>;
  /** Repeating notification timer for return transfers (until claimed). */
  notifyTimer?: ReturnType<typeof setInterval>;
}

const transfers = new Map<string, TransferRecord>();

function getDetachedTabPreloadPath(): string {
  return app.isPackaged
    ? path.join(__dirname, 'preload-detached-tab.js')
    : path.join(__dirname, '../../.erb/dll/preload-detached-tab.js');
}

function getWindow(windowId: number): BrowserWindow | null {
  const window = BrowserWindow.fromId(windowId);
  return window && !window.isDestroyed() ? window : null;
}

function senderWindowId(event: Electron.IpcMainInvokeEvent): number | null {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window && !window.isDestroyed() ? window.id : null;
}

function isDetachedWindow(windowId: number): boolean {
  const appWindow = getApplicationWindows().get(windowId);
  return (
    appWindow?.metadata?.primaryType === PrimaryWindowType.DETACHED_TAB &&
    !appWindow.window.isDestroyed()
  );
}

function clearRecord(record: TransferRecord): void {
  if (record.notifyTimer) {
    clearInterval(record.notifyTimer);
    record.notifyTimer = undefined;
  }
  if (transfers.get(record.token) === record) {
    transfers.delete(record.token);
  }
}

function settleTransfer(
  record: TransferRecord,
  accepted: boolean,
  reason?: string,
): void {
  if (record.settled) return;
  record.settled = true;
  record.accepted = accepted;
  clearTimeout(record.timeout);
  if (record.notifyTimer) {
    clearInterval(record.notifyTimer);
    record.notifyTimer = undefined;
  }
  // An accepted detach keeps its record until the destination window closes:
  // a renderer reload must be able to re-claim the tab it is already hosting.
  // Return transfers close the source immediately, so they clean up right away.
  if (!accepted || record.direction === 'return') {
    clearRecord(record);
  }
  record.settle({ accepted, reason });
}

interface CreatedTransfer {
  record: TransferRecord;
  promise: Promise<TransferOutcome>;
}

function createTransfer(
  tab: DetachableTabDescriptor,
  direction: TransferDirection,
  sourceWindowId: number,
  targetWindowId: number,
): CreatedTransfer {
  const token = randomUUID();
  let settle!: (outcome: TransferOutcome) => void;
  const promise = new Promise<TransferOutcome>((resolve) => {
    settle = resolve;
  });

  const record: TransferRecord = {
    token,
    tab,
    direction,
    sourceWindowId,
    targetWindowId,
    claimed: false,
    settled: false,
    accepted: false,
    settle,
    timeout: setTimeout(() => {
      settleTransfer(record, false, 'timeout');
    }, TRANSFER_TIMEOUT_MS),
  };

  transfers.set(token, record);
  return { record, promise };
}

function getTransferForTarget(
  token: unknown,
  windowId: number | null,
  direction: TransferDirection,
): TransferRecord | null {
  if (typeof token !== 'string' || !windowId) return null;
  const record = transfers.get(token);
  if (!record || record.direction !== direction) return null;
  if (record.targetWindowId !== windowId) return null;
  return record;
}

async function openDetachedTab(
  event: Electron.IpcMainInvokeEvent,
  tab: unknown,
): Promise<DetachedTabOpenResult> {
  const sourceWindowId = senderWindowId(event);
  if (!sourceWindowId) {
    return { ok: false, transferred: false, reason: 'no-source-window' };
  }
  if (!isDetachableTabDescriptor(tab)) {
    return { ok: false, transferred: false, reason: 'invalid-tab' };
  }

  const purpose = `${DETACHED_PURPOSE_PREFIX}${tab.tabId}`;
  const existing = focusExistingSpecialWindow(purpose);
  if (existing) {
    return {
      ok: true,
      transferred: false,
      alreadyOpen: true,
      windowId: existing.window.id,
    };
  }

  const metadata: WindowMetadata = {
    primaryType: PrimaryWindowType.DETACHED_TAB,
    displayName: tab.label,
    purpose,
  };

  const appWindow = createSpecialWindow(
    purpose,
    {
      width: 1100,
      height: 800,
      minWidth: 600,
      minHeight: 400,
      title: tab.label,
      webPreferences: {
        preload: getDetachedTabPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    },
    {
      menu: true,
      devTools: true,
      contentSecurityPolicy: true,
      externalLinkHandler: true,
      errorHandlers: true,
    },
    metadata,
  );

  if (!appWindow) {
    return { ok: false, transferred: false, reason: 'create-failed' };
  }

  const windowId = appWindow.window.id;
  const { record, promise } = createTransfer(
    tab,
    'detach',
    sourceWindowId,
    windowId,
  );

  appWindow.window.once('closed', () => {
    settleTransfer(record, false, 'window-closed');
    clearRecord(record);
  });

  const url = `${resolveHtmlPath('detached-tab.html')}#transfer/${record.token}`;
  appWindow.window.loadURL(url).catch((error) => {
    console.error('[DetachedTab] Failed to load destination window:', error);
    settleTransfer(record, false, 'load-failed');
  });

  const outcome = await promise;

  if (!outcome.accepted) {
    const target = getWindow(windowId);
    if (target) target.close();
    return {
      ok: false,
      transferred: false,
      windowId,
      reason: outcome.reason ?? 'rejected',
    };
  }

  return { ok: true, transferred: true, windowId };
}

function notifyIncoming(record: TransferRecord): void {
  const target = getWindow(record.targetWindowId);
  if (!target || target.webContents.isDestroyed()) return;
  target.webContents.send(WindowEvent.DETACHED_TAB_INCOMING, {
    token: record.token,
  });
}

async function returnDetachedTab(
  event: Electron.IpcMainInvokeEvent,
  tab: unknown,
): Promise<DetachedTabReturnResult> {
  const sourceWindowId = senderWindowId(event);
  if (!sourceWindowId || !isDetachedWindow(sourceWindowId)) {
    return { ok: false, reason: 'not-detached-window' };
  }
  if (!isDetachableTabDescriptor(tab)) {
    return { ok: false, reason: 'invalid-tab' };
  }

  const mainId = getMainWindowId();
  let mainWindow = mainId != null ? getWindow(mainId) : null;
  if (!mainWindow) {
    const created = await focusOrCreateMainWindow();
    mainWindow = created ? getWindow(created.window.id) : null;
  }
  if (!mainWindow) {
    return { ok: false, reason: 'no-main-window' };
  }

  const targetWindowId = mainWindow.id;
  const { record, promise } = createTransfer(
    tab,
    'return',
    sourceWindowId,
    targetWindowId,
  );

  const sourceWindow = getWindow(sourceWindowId);
  sourceWindow?.once('closed', () => {
    settleTransfer(record, false, 'source-closed');
    clearRecord(record);
  });
  mainWindow.once('closed', () => {
    settleTransfer(record, false, 'target-closed');
    clearRecord(record);
  });

  // A freshly created main window may not have mounted its listener yet, so
  // keep notifying until the receiver claims the token.
  notifyIncoming(record);
  record.notifyTimer = setInterval(() => {
    if (record.claimed) {
      if (record.notifyTimer) clearInterval(record.notifyTimer);
      record.notifyTimer = undefined;
      return;
    }
    notifyIncoming(record);
  }, INCOMING_NOTIFY_INTERVAL_MS);

  const outcome = await promise;

  if (!outcome.accepted) {
    return { ok: false, reason: outcome.reason ?? 'rejected' };
  }

  const source = getWindow(sourceWindowId);
  if (source) source.close();
  return { ok: true };
}

/**
 * Register the detached-tab IPC handlers. Call once at startup.
 */
export function registerDetachedTabHandlers(): void {
  ipcMain.handle(WindowEvent.OPEN_DETACHED_TAB, openDetachedTab);

  ipcMain.handle(
    WindowEvent.DETACHED_TAB_CLAIM,
    (event, token: unknown): DetachableTabDescriptor | null => {
      const record = getTransferForTarget(
        token,
        senderWindowId(event),
        'detach',
      );
      if (!record) return null;
      // Re-claiming is allowed only after acceptance (renderer reload); an
      // in-flight transfer stays single-claim.
      if (record.claimed && !(record.settled && record.accepted)) return null;
      record.claimed = true;
      return record.tab;
    },
  );

  ipcMain.handle(
    WindowEvent.DETACHED_TAB_ACCEPT,
    (event, token: unknown): boolean => {
      const record = getTransferForTarget(
        token,
        senderWindowId(event),
        'detach',
      );
      if (!record || !record.claimed) return false;
      if (record.settled) return record.accepted;
      settleTransfer(record, true);
      return true;
    },
  );

  ipcMain.handle(
    WindowEvent.DETACHED_TAB_REJECT,
    (event, token: unknown, reason?: unknown): void => {
      const record = getTransferForTarget(
        token,
        senderWindowId(event),
        'detach',
      );
      if (!record) return;
      settleTransfer(
        record,
        false,
        typeof reason === 'string' ? reason : 'rejected',
      );
    },
  );

  ipcMain.handle(WindowEvent.RETURN_DETACHED_TAB, returnDetachedTab);

  ipcMain.handle(
    WindowEvent.DETACHED_TAB_CLAIM_INCOMING,
    (event, token: unknown): DetachableTabDescriptor | null => {
      const record = getTransferForTarget(
        token,
        senderWindowId(event),
        'return',
      );
      if (!record || record.claimed) return null;
      record.claimed = true;
      if (record.notifyTimer) {
        clearInterval(record.notifyTimer);
        record.notifyTimer = undefined;
      }
      return record.tab;
    },
  );

  ipcMain.handle(
    WindowEvent.DETACHED_TAB_ACCEPT_INCOMING,
    (event, token: unknown): boolean => {
      const record = getTransferForTarget(
        token,
        senderWindowId(event),
        'return',
      );
      if (!record || !record.claimed) return false;
      settleTransfer(record, true);
      return true;
    },
  );

  ipcMain.handle(
    WindowEvent.DETACHED_TAB_REJECT_INCOMING,
    (event, token: unknown, reason?: unknown): void => {
      const record = getTransferForTarget(
        token,
        senderWindowId(event),
        'return',
      );
      if (!record) return;
      settleTransfer(
        record,
        false,
        typeof reason === 'string' ? reason : 'rejected',
      );
    },
  );

  console.log('[DetachedTab] IPC handlers registered');
}
