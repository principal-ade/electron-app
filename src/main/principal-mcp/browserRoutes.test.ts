/** @jest-environment node */
import { EventEmitter } from 'events';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import type { Application, Request, Response } from 'express';
import { BrowserEvent } from '../../shared/main-process-api-interfaces/BrowserAPI';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import type { ProcessRegistry } from '../processes/ProcessRegistry';
import { dispatchBrowserOpen, registerBrowserRoutes } from './browserRoutes';

jest.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: jest.fn() },
  ipcMain: { on: jest.fn(), removeListener: jest.fn() },
}));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));

function webContents() {
  const contents = new EventEmitter() as EventEmitter & {
    send: jest.Mock;
    mainFrame: object;
  };
  contents.send = jest.fn();
  contents.mainFrame = {};
  return contents as unknown as WebContents;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  applicationWindows.clear();
});
afterEach(() => {
  jest.useRealTimers();
});

test('waits for a matching main-frame acknowledgement and cleans listeners', async () => {
  const contents = webContents();
  const pending = dispatchBrowserOpen(contents, { port: 5173, path: '/' });
  const [, envelope] = (contents.send as jest.Mock).mock.calls[0];
  const [, listener] = (ipcMain.on as jest.Mock).mock.calls[0];
  listener(
    { sender: {}, senderFrame: contents.mainFrame },
    { ...envelope, tabId: 'wrong' },
  );
  listener(
    { sender: contents, senderFrame: {} },
    { ...envelope, tabId: 'wrong' },
  );
  listener(
    { sender: contents, senderFrame: contents.mainFrame },
    { requestId: 'wrong', tabId: 'wrong' },
  );
  listener(
    { sender: contents, senderFrame: contents.mainFrame },
    { requestId: envelope.requestId, tabId: 'tab-1' },
  );
  await expect(pending).resolves.toBe('tab-1');
  expect(ipcMain.removeListener).toHaveBeenCalledWith(
    BrowserEvent.OPENED,
    listener,
  );
  expect(contents.listenerCount('destroyed')).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

test('missing renderer times out rather than reporting an opened tab', async () => {
  const pending = dispatchBrowserOpen(webContents(), { port: 5173, path: '/' });
  jest.advanceTimersByTime(3000);
  await expect(pending).resolves.toBeUndefined();
  expect(ipcMain.removeListener).toHaveBeenCalled();
});

test('destroyed window releases the pending request', async () => {
  const contents = webContents();
  const pending = dispatchBrowserOpen(contents, { port: 5173, path: '/' });
  contents.emit('destroyed');
  await expect(pending).resolves.toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});

function route() {
  const post = jest.fn();
  const registry = { list: jest.fn(() => []) };
  registerBrowserRoutes(
    { post } as unknown as Application,
    registry as unknown as ProcessRegistry,
  );
  return post.mock.calls[0][1] as (
    req: Request,
    res: Response,
  ) => Promise<void>;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

test('rejects browser-origin requests before dispatch', async () => {
  const handler = route();
  const res = response();
  await handler(
    {
      headers: { origin: 'http://evil.example' },
      body: { url: 'http://localhost:5173/' },
    } as Request,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(403);
  expect(BrowserWindow.getFocusedWindow).not.toHaveBeenCalled();
});

test('does not create or focus a window when there is no capable focused host', async () => {
  const handler = route();
  const res = response();
  (BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue(null);
  await handler(
    { headers: {}, body: { url: 'http://localhost:5173/' } } as Request,
    res,
  );
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ opened: false }),
  );
});

test('reports success only after the focused MAIN host commits a tab', async () => {
  const handler = route();
  const res = response();
  const contents = webContents();
  const window = { id: 1, isDestroyed: () => false, webContents: contents };
  (BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue(window);
  applicationWindows.set(1, {
    window,
    metadata: { primaryType: PrimaryWindowType.MAIN },
  } as never);
  const pending = handler(
    { headers: {}, body: { url: 'http://localhost:5173/docs' } } as Request,
    res,
  );
  expect(res.json).not.toHaveBeenCalled();
  const [, envelope] = (contents.send as jest.Mock).mock.calls[0];
  const [, listener] = (ipcMain.on as jest.Mock).mock.calls[0];
  listener(
    { sender: contents, senderFrame: contents.mainFrame },
    { requestId: envelope.requestId, tabId: 'tab-1' },
  );
  await pending;
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ opened: true, tabId: 'tab-1' }),
  );
});
