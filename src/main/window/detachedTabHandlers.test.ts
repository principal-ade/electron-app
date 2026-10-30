/** @jest-environment node */

import { BrowserWindow, ipcMain } from 'electron';
import { registerDetachedTabHandlers } from './detachedTabHandlers';
import {
  createSpecialWindow,
  focusExistingSpecialWindow,
  getApplicationWindows,
} from './modernWindowManager';
import { getMainWindowId } from './types';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { DetachableTabDescriptor } from '../../shared/detachedTab';

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  app: { isPackaged: false },
  BrowserWindow: { fromId: jest.fn(), fromWebContents: jest.fn() },
  screen: {
    getDisplayNearestPoint: jest.fn(() => ({
      workArea: { x: 0, y: 25, width: 1920, height: 1055 },
    })),
  },
}));
jest.mock('../util', () => ({
  resolveHtmlPath: (name: string) => `app://${name}`,
}));
jest.mock('./modernWindowManager', () => ({
  createSpecialWindow: jest.fn(),
  focusExistingSpecialWindow: jest.fn(),
  focusOrCreateMainWindow: jest.fn(),
  getApplicationWindows: jest.fn(() => new Map()),
}));
jest.mock('./types', () => ({
  getMainWindowId: jest.fn(),
  PrimaryWindowType: { DETACHED_TAB: 'detached-tab' },
}));

const topicTab: DetachableTabDescriptor = {
  kind: 'local-topic',
  tabId: 'local-topic-t1',
  label: 'Topic one',
  topicId: 't1',
  title: 'Topic one',
};

interface FakeWindow {
  id: number;
  isDestroyed: jest.Mock;
  loadURL: jest.Mock;
  once: jest.Mock;
  close: jest.Mock;
  webContents: { isDestroyed: jest.Mock; send: jest.Mock };
}

function makeWindow(id: number): FakeWindow {
  return {
    id,
    isDestroyed: jest.fn(() => false),
    loadURL: jest.fn(() => Promise.resolve()),
    once: jest.fn(),
    close: jest.fn(),
    webContents: { isDestroyed: jest.fn(() => false), send: jest.fn() },
  };
}

type Handler = (event: unknown, ...args: unknown[]) => unknown;

describe('detached tab transfer protocol', () => {
  const handlers = new Map<string, Handler>();
  const windows = new Map<number, FakeWindow>();
  const senders = new Map<object, FakeWindow>();

  beforeEach(() => {
    handlers.clear();
    (ipcMain.handle as jest.Mock).mockClear();
    registerDetachedTabHandlers();
    for (const [channel, handler] of (ipcMain.handle as jest.Mock).mock.calls) {
      handlers.set(channel as string, handler as Handler);
    }
    windows.clear();
    senders.clear();
    (BrowserWindow.fromId as jest.Mock).mockImplementation(
      (id: number) => windows.get(id) ?? null,
    );
    (BrowserWindow.fromWebContents as jest.Mock).mockImplementation(
      (sender: object) => senders.get(sender) ?? null,
    );
    (getApplicationWindows as jest.Mock).mockReturnValue(new Map());
    (getMainWindowId as jest.Mock).mockReturnValue(null);
    (focusExistingSpecialWindow as jest.Mock).mockReturnValue(null);
    (createSpecialWindow as jest.Mock).mockClear();
  });

  function registerWindow(window: FakeWindow): object {
    windows.set(window.id, window);
    const sender = { windowId: window.id };
    senders.set(sender, window);
    return sender;
  }

  function handler(channel: string): Handler {
    const value = handlers.get(channel);
    if (!value) throw new Error(`No handler for ${channel}`);
    return value;
  }

  /** Finish an in-flight open so its 20s timeout does not outlive the test. */
  async function settle(
    open: unknown,
    target: FakeWindow,
    targetSender: object,
  ): Promise<void> {
    const token = /#transfer\/([0-9a-f-]+)$/.exec(
      target.loadURL.mock.calls[0][0],
    )?.[1];
    handler(WindowEvent.DETACHED_TAB_CLAIM)({ sender: targetSender }, token);
    handler(WindowEvent.DETACHED_TAB_ACCEPT)({ sender: targetSender }, token);
    await open;
  }

  it('transfers only after the destination claims and accepts', async () => {
    const source = makeWindow(1);
    const target = makeWindow(2);
    const sourceSender = registerWindow(source);
    const targetSender = registerWindow(target);
    (createSpecialWindow as jest.Mock).mockReturnValue({ window: target });

    const open = handler(WindowEvent.OPEN_DETACHED_TAB)(
      { sender: sourceSender },
      topicTab,
    );
    await Promise.resolve();
    expect(
      (createSpecialWindow as jest.Mock).mock.calls[0][1].webPreferences
        .preload,
    ).toContain('preload-detached-tab.js');
    // Nothing accepted yet: the token is in the URL, never the descriptor.
    expect(target.loadURL).toHaveBeenCalledWith(
      expect.stringMatching(/#transfer\/[0-9a-f-]+$/),
    );
    expect(target.loadURL.mock.calls[0][0]).not.toContain('Topic one');

    const token = /#transfer\/([0-9a-f-]+)$/.exec(
      target.loadURL.mock.calls[0][0],
    )?.[1];
    expect(token).toBeTruthy();

    // A non-owner window cannot claim the token.
    expect(
      handler(WindowEvent.DETACHED_TAB_CLAIM)({ sender: sourceSender }, token),
    ).toBeNull();

    expect(
      handler(WindowEvent.DETACHED_TAB_CLAIM)({ sender: targetSender }, token),
    ).toEqual(topicTab);
    expect(
      handler(WindowEvent.DETACHED_TAB_ACCEPT)({ sender: targetSender }, token),
    ).toBe(true);

    await expect(open).resolves.toEqual({
      ok: true,
      transferred: true,
      windowId: 2,
    });

    // A destination renderer reload can re-claim the accepted transfer so it
    // can re-render instead of losing the tab it already owns.
    expect(
      handler(WindowEvent.DETACHED_TAB_CLAIM)({ sender: targetSender }, token),
    ).toEqual(topicTab);
    expect(
      handler(WindowEvent.DETACHED_TAB_ACCEPT)({ sender: targetSender }, token),
    ).toBe(true);
  });

  it('opens a dragged-out tab where it was dropped, clamped to the display', async () => {
    const source = makeWindow(1);
    const target = makeWindow(2);
    const sourceSender = registerWindow(source);
    const targetSender = registerWindow(target);
    (createSpecialWindow as jest.Mock).mockReturnValue({ window: target });

    const open = handler(WindowEvent.OPEN_DETACHED_TAB)(
      { sender: sourceSender },
      topicTab,
      { dropPoint: { screenX: 1900, screenY: 10 } },
    );
    await Promise.resolve();

    expect((createSpecialWindow as jest.Mock).mock.calls[0][1]).toMatchObject({
      x: 820,
      y: 25,
      width: 1100,
      height: 800,
    });
    await settle(open, target, targetSender);
  });

  it('falls back to default placement without a valid drop point', async () => {
    const source = makeWindow(1);
    const target = makeWindow(2);
    const sourceSender = registerWindow(source);
    const targetSender = registerWindow(target);
    (createSpecialWindow as jest.Mock).mockReturnValue({ window: target });

    const open = handler(WindowEvent.OPEN_DETACHED_TAB)(
      { sender: sourceSender },
      topicTab,
      { dropPoint: { screenX: 'nope', screenY: NaN } },
    );
    await Promise.resolve();

    const options = (createSpecialWindow as jest.Mock).mock.calls[0][1];
    expect(options).toMatchObject({ width: 1100, height: 800 });
    expect(options.x).toBeUndefined();
    expect(options.y).toBeUndefined();
    await settle(open, target, targetSender);
  });

  it('keeps the source tab when the destination rejects', async () => {
    const source = makeWindow(1);
    const target = makeWindow(2);
    const sourceSender = registerWindow(source);
    const targetSender = registerWindow(target);
    (createSpecialWindow as jest.Mock).mockReturnValue({ window: target });

    const open = handler(WindowEvent.OPEN_DETACHED_TAB)(
      { sender: sourceSender },
      topicTab,
    );
    await Promise.resolve();
    const token = /#transfer\/([0-9a-f-]+)$/.exec(
      target.loadURL.mock.calls[0][0],
    )?.[1];
    handler(WindowEvent.DETACHED_TAB_CLAIM)({ sender: targetSender }, token);
    handler(WindowEvent.DETACHED_TAB_REJECT)(
      { sender: targetSender },
      token,
      'load-failed',
    );

    await expect(open).resolves.toMatchObject({
      ok: false,
      transferred: false,
      reason: 'load-failed',
    });
    expect(target.close).toHaveBeenCalled();
  });

  it('hands a detached tab back to the main window', async () => {
    const detached = makeWindow(10);
    const main = makeWindow(20);
    const detachedSender = registerWindow(detached);
    const mainSender = registerWindow(main);

    const applicationWindows = new Map<
      number,
      { window: FakeWindow; metadata: { primaryType: string } }
    >();
    applicationWindows.set(10, {
      window: detached,
      metadata: { primaryType: 'detached-tab' },
    });
    (getApplicationWindows as jest.Mock).mockReturnValue(applicationWindows);
    (getMainWindowId as jest.Mock).mockReturnValue(20);

    const returned = handler(WindowEvent.RETURN_DETACHED_TAB)(
      { sender: detachedSender },
      topicTab,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(main.webContents.send).toHaveBeenCalledWith(
      WindowEvent.DETACHED_TAB_INCOMING,
      expect.objectContaining({ token: expect.any(String) }),
    );
    const token = main.webContents.send.mock.calls[0][1].token as string;

    expect(
      handler(WindowEvent.DETACHED_TAB_CLAIM_INCOMING)(
        { sender: detachedSender },
        token,
      ),
    ).toBeNull(); // wrong window
    expect(
      handler(WindowEvent.DETACHED_TAB_CLAIM_INCOMING)(
        { sender: mainSender },
        token,
      ),
    ).toEqual(topicTab);
    expect(
      handler(WindowEvent.DETACHED_TAB_ACCEPT_INCOMING)(
        { sender: mainSender },
        token,
      ),
    ).toBe(true);

    await expect(returned).resolves.toEqual({ ok: true });
    expect(detached.close).toHaveBeenCalled();
  });
  it('lists accepted detached tabs and broadcasts changes', async () => {
    // Earlier tests leave accepted transfers in the module-level map, so use
    // window ids no other test reuses.
    const source = makeWindow(41);
    const target = makeWindow(42);
    const sourceSender = registerWindow(source);
    const targetSender = registerWindow(target);
    (createSpecialWindow as jest.Mock).mockReturnValue({ window: target });
    (getApplicationWindows as jest.Mock).mockReturnValue(
      new Map([
        [41, { window: source }],
        [42, { window: target }],
      ]),
    );

    const open = handler(WindowEvent.OPEN_DETACHED_TAB)(
      { sender: sourceSender },
      topicTab,
    );
    await Promise.resolve();
    // In flight: not detached yet.
    expect(handler(WindowEvent.GET_DETACHED_TABS)({})).toEqual([]);

    await settle(open, target, targetSender);
    const detached = [{ tab: topicTab, windowId: 42 }];
    expect(handler(WindowEvent.GET_DETACHED_TABS)({})).toEqual(detached);
    expect(source.webContents.send).toHaveBeenCalledWith(
      WindowEvent.DETACHED_TABS_CHANGED,
      detached,
    );

    // Closing the window drops it from the list and rebroadcasts.
    const onClosed = target.once.mock.calls.find(
      ([event]) => event === 'closed',
    )?.[1] as () => void;
    target.isDestroyed.mockReturnValue(true);
    source.webContents.send.mockClear();
    onClosed();
    expect(handler(WindowEvent.GET_DETACHED_TABS)({})).toEqual([]);
    expect(source.webContents.send).toHaveBeenCalledWith(
      WindowEvent.DETACHED_TABS_CHANGED,
      [],
    );
  });
});
