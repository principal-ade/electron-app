/** @jest-environment node */
import { ipcMain } from 'electron';
import { registerBrunoHandlers } from './brunoHandlers';
import { RequestStore } from './RequestStore';
import { sendBrunoRequest } from './bruno-actions';
import { BrunoAPIEvent } from '../../shared/main-process-api-interfaces/BrunoAPI';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));
jest.mock('./RequestStore', () => ({
  RequestStore: jest.fn().mockImplementation(() => ({
    load: jest.fn(() => []),
    loadRoutes: jest.fn(() => []),
    update: jest.fn(() => []),
    forget: jest.fn(() => []),
    pin: jest.fn(() => []),
    unpin: jest.fn(() => []),
  })),
}));
jest.mock('./bruno-actions', () => ({
  sendBrunoRequest: jest.fn(),
  loadEnvironments: jest.fn(),
}));
jest.mock('./adapters/BrunoLangParserAdapter', () => ({
  BrunoLangParserAdapter: class {},
}));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));

const definition = { http: { method: 'GET', url: 'https://example.test' } };
function setup() {
  const contents = { mainFrame: {} };
  const window = { webContents: contents, isDestroyed: () => false };
  applicationWindows.set(1, {
    window,
    metadata: { primaryType: PrimaryWindowType.MAIN },
  } as never);
  registerBrunoHandlers();
  const handlers = new Map<string, (...args: unknown[]) => unknown>(
    (ipcMain.handle as jest.Mock).mock.calls.map(
      ([channel, handler]) => [channel, handler] as const,
    ),
  );
  const handle = (channel: BrunoAPIEvent) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Missing handler for ${channel}.`);
    return handler;
  };
  return {
    handle,
    contents,
    event: { sender: contents, senderFrame: contents.mainFrame },
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  applicationWindows.clear();
});

test('saved-request IPC never sends and is limited to registered MAIN main frames', () => {
  const { handle, event, contents } = setup();
  handle(BrunoAPIEvent.LIST_SAVED)(event);
  handle(BrunoAPIEvent.PIN)(event, { id: 'one' });
  handle(BrunoAPIEvent.UNPIN)(event, 'one');
  handle(BrunoAPIEvent.LIST_ROUTES)(event);
  handle(BrunoAPIEvent.UPDATE_ROUTE)(event, { id: 'one' });
  handle(BrunoAPIEvent.FORGET_ROUTE)(event, 'one');
  expect(sendBrunoRequest).not.toHaveBeenCalled();
  expect(RequestStore).toHaveBeenCalledTimes(1);
  for (const method of [
    BrunoAPIEvent.LIST_SAVED,
    BrunoAPIEvent.PIN,
    BrunoAPIEvent.UNPIN,
    BrunoAPIEvent.LIST_ROUTES,
    BrunoAPIEvent.UPDATE_ROUTE,
    BrunoAPIEvent.FORGET_ROUTE,
  ]) {
    expect(() => handle(method)({ ...event, sender: {} })).toThrow(
      'app window',
    );
    expect(() => handle(method)({ ...event, senderFrame: {} })).toThrow(
      'app window',
    );
    applicationWindows.set(1, {
      window: { webContents: contents, isDestroyed: () => false },
      metadata: { primaryType: PrimaryWindowType.DEV_WORKSPACE },
    } as never);
    expect(() => handle(method)(event)).toThrow('app window');
  }
});

test('explicit send requires a registered app main frame', async () => {
  const { handle, event } = setup();
  const send = handle(BrunoAPIEvent.SEND_REQUEST);
  await send(event, definition, { key: 'value' });
  expect(sendBrunoRequest).toHaveBeenCalledWith(definition, { key: 'value' });
  await expect(send({ ...event, senderFrame: {} }, definition)).rejects.toThrow(
    'app window',
  );
  await expect(send({ ...event, sender: {} }, definition)).rejects.toThrow(
    'app window',
  );
  expect(sendBrunoRequest).toHaveBeenCalledTimes(1);
});
