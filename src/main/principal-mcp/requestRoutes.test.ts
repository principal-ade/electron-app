/** @jest-environment node */
import { EventEmitter } from 'events';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import type { Application, Request, Response } from 'express';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { dispatchRequestOpen, registerRequestRoutes } from './requestRoutes';
import type { RequestStore } from '../bruno/RequestStore';
import { notifyRequestCatalogChanged } from '../bruno/requestCatalogEvents';

jest.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: jest.fn() },
  ipcMain: { on: jest.fn(), removeListener: jest.fn() },
}));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));
jest.mock('../bruno/requestCatalogEvents', () => ({
  notifyRequestCatalogChanged: jest.fn(),
}));
const store = { remember: jest.fn((request) => request) };
const prepared = {
  id: 'saved-1',
  title: 'Test',
  request: { http: { method: 'GET', url: 'https://example.test' } },
  environment: {},
};
function contents() {
  const value = new EventEmitter() as EventEmitter & {
    send: jest.Mock;
    mainFrame: object;
  };
  value.send = jest.fn();
  value.mainFrame = {};
  return value as unknown as WebContents;
}
function route() {
  const post = jest.fn();
  registerRequestRoutes(
    { post } as unknown as Application,
    store as unknown as RequestStore,
  );
  expect(post).toHaveBeenCalledWith('/api/requests/open', expect.any(Function));
  return post.mock.calls[0][1] as (
    request: Request,
    response: Response,
  ) => Promise<void>;
}
function response() {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  applicationWindows.clear();
  store.remember.mockImplementation((request) => request);
});
afterEach(() => jest.useRealTimers());

test('acknowledges only the target tab from the matching main frame', async () => {
  const host = contents();
  const pending = dispatchRequestOpen(host, prepared);
  const [, envelope] = (host.send as jest.Mock).mock.calls[0];
  const [, acknowledge] = (ipcMain.on as jest.Mock).mock.calls[0];
  const goodEvent = { sender: host, senderFrame: host.mainFrame };
  const goodResponse = {
    requestId: envelope.requestId,
    tabId: 'http-request-saved-1',
  };
  acknowledge({ ...goodEvent, sender: {} }, goodResponse);
  acknowledge({ ...goodEvent, senderFrame: {} }, goodResponse);
  acknowledge(goodEvent, { ...goodResponse, requestId: 'wrong' });
  acknowledge(goodEvent, { ...goodResponse, tabId: 'wrong' });
  expect(ipcMain.removeListener).not.toHaveBeenCalled();
  acknowledge(goodEvent, goodResponse);
  await expect(pending).resolves.toBe('http-request-saved-1');
  expect(ipcMain.removeListener).toHaveBeenCalledWith(
    BrunoAPIEvent.OPENED,
    acknowledge,
  );
  expect(host.listenerCount('destroyed')).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  expect(host.send).toHaveBeenCalledWith(BrunoAPIEvent.OPEN, {
    ...prepared,
    requestId: expect.any(String),
  });
});

test('cleans up on timeout, destruction, and send failure', async () => {
  const first = dispatchRequestOpen(contents(), prepared);
  jest.advanceTimersByTime(3000);
  await expect(first).resolves.toBeUndefined();
  const host = contents();
  const second = dispatchRequestOpen(host, prepared);
  host.emit('destroyed');
  await expect(second).resolves.toBeUndefined();
  (host.send as jest.Mock).mockImplementation(() => {
    throw new Error('destroyed');
  });
  await expect(dispatchRequestOpen(host, prepared)).resolves.toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});

test.each([
  { origin: 'https://evil.test' },
  { 'sec-fetch-site': 'cross-site' },
  { origin: '' },
])('rejects browser origins before processing', async (headers) => {
  const res = response();
  await route()({ headers, body: {} } as Request, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(BrowserWindow.getFocusedWindow).not.toHaveBeenCalled();
  expect(store.remember).not.toHaveBeenCalled();
});

test('rejects auto-send flags and reports no focused MAIN host honestly', async () => {
  const handler = route();
  let res = response();
  await handler(
    { headers: {}, body: { request: prepared.request, send: true } } as Request,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(400);
  expect(store.remember).not.toHaveBeenCalled();
  (BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue(null);
  res = response();
  await handler(
    { headers: {}, body: { request: prepared.request } } as Request,
    res,
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    opened: false,
    reason: 'no-focused-request-host',
  });
  expect(store.remember).toHaveBeenCalledWith(
    expect.objectContaining({
      request: prepared.request,
    }),
  );
  expect(notifyRequestCatalogChanged).toHaveBeenCalledTimes(1);
});

test('does not dispatch or acknowledge success when secure retention fails', async () => {
  store.remember.mockImplementation(() => {
    throw new Error('private storage details');
  });
  const res = response();
  await route()(
    { headers: {}, body: { request: prepared.request } } as Request,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      error: expect.not.stringContaining('private storage details'),
    }),
  );
  expect(BrowserWindow.getFocusedWindow).not.toHaveBeenCalled();
  expect(notifyRequestCatalogChanged).not.toHaveBeenCalled();
});

test('only dispatches to focused MAIN and does not execute the prepared request', async () => {
  const handler = route();
  const host = contents();
  const window = { id: 1, isDestroyed: () => false, webContents: host };
  (BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue(window);
  applicationWindows.set(1, {
    window,
    metadata: { primaryType: PrimaryWindowType.DEV_WORKSPACE },
  } as never);
  const request = {
    headers: {},
    body: {
      request: prepared.request,
      environment: { KEY: 'value' },
      repositoryPath: '/work/frontend',
      target: {
        purl: 'pkg:github/unregistered/backend',
        identifier: 'component:api',
      },
    },
  } as Request;
  let res = response();
  await handler(request, res);
  expect(host.send).not.toHaveBeenCalled();
  applicationWindows.set(1, {
    window,
    metadata: { primaryType: PrimaryWindowType.MAIN },
  } as never);
  res = response();
  const pending = handler(request, res);
  expect(res.json).not.toHaveBeenCalled();
  const [, envelope] = (host.send as jest.Mock).mock.calls[0];
  expect(envelope).toMatchObject({
    request: prepared.request,
    repositoryPath: '/work/frontend',
    target: request.body.target,
  });
  const [, acknowledge] = (ipcMain.on as jest.Mock).mock.calls[0];
  acknowledge(
    { sender: host, senderFrame: host.mainFrame },
    { requestId: envelope.requestId, tabId: `http-request-${envelope.id}` },
  );
  await pending;
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      opened: true,
      tabId: `http-request-${envelope.id}`,
    }),
  );
  expect(host.send).toHaveBeenCalledTimes(1);
});

test('uses the catalog id on repeated preparations rather than the fresh transport id', async () => {
  store.remember.mockImplementation((request) => ({
    ...request,
    id: 'stable-route',
  }));
  const host = contents();
  const window = { id: 1, isDestroyed: () => false, webContents: host };
  applicationWindows.set(1, {
    window,
    metadata: { primaryType: PrimaryWindowType.MAIN },
  } as never);
  (BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue(window);
  const handler = route();
  for (const query of ['one', 'two']) {
    const res = response();
    const pending = handler(
      {
        headers: {},
        body: {
          request: {
            http: { method: 'GET', url: `https://example.test?query=${query}` },
          },
        },
      } as Request,
      res,
    );
    const [, envelope] = (host.send as jest.Mock).mock.calls.at(-1);
    expect(envelope.id).toBe('stable-route');
    const [, acknowledge] = (ipcMain.on as jest.Mock).mock.calls.at(-1);
    acknowledge(
      { sender: host, senderFrame: host.mainFrame },
      {
        requestId: envelope.requestId,
        tabId: 'http-request-stable-route',
      },
    );
    await pending;
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 'http-request-stable-route' }),
    );
  }
  expect(store.remember.mock.calls[0][0].id).not.toBe(
    store.remember.mock.calls[1][0].id,
  );
});
