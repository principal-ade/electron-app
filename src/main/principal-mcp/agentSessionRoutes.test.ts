/** @jest-environment node */
import { EventEmitter } from 'events';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import type { Application, Request, Response } from 'express';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import {
  dispatchAgentSessionTabOpen,
  registerAgentSessionRoutes,
  type AgentSessionProvider,
  type CodingAgent,
} from './agentSessionRoutes';

jest.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: jest.fn() },
  ipcMain: { on: jest.fn(), removeListener: jest.fn() },
}));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));

const target = {
  directory: '/repos/acme/app',
  label: 'Fix login',
  customLabel: 'Fix login',
  agent: 'opencode' as const,
  startupNotice: {
    message: 'Resuming OpenCode Session',
    subtitle: 'Fix login',
  },
  command: 'opencode --session ses_12345678',
};
const provider: AgentSessionProvider = {
  list: jest.fn().mockResolvedValue([
    {
      agent: 'opencode',
      id: 'ses_12345678',
      title: 'Fix login',
      directory: '/repos/acme/app',
      createdAt: 1,
      updatedAt: 2,
      resumable: true,
    },
  ]),
  prepareResume: jest.fn().mockResolvedValue(target),
};
const providers = {
  opencode: provider,
  claude: provider,
  cursor: provider,
} satisfies Record<CodingAgent, AgentSessionProvider>;

function routes(dispatch = jest.fn().mockResolvedValue(true)) {
  const get = jest.fn();
  const post = jest.fn();
  registerAgentSessionRoutes({ get, post } as unknown as Application, {
    getRepositoryDirectories: async () => ['/repos/acme'],
    providers,
    dispatch,
  });
  return {
    get: get.mock.calls[0][1] as (req: Request, res: Response) => Promise<void>,
    post: post.mock.calls[0][1] as (
      req: Request,
      res: Response,
    ) => Promise<void>,
    dispatch,
  };
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function host(primaryType = PrimaryWindowType.MAIN) {
  const window = {
    id: 1,
    isDestroyed: () => false,
    webContents: { send: jest.fn() },
  };
  jest
    .mocked(BrowserWindow.getFocusedWindow)
    .mockReturnValue(window as unknown as BrowserWindow);
  applicationWindows.set(1, {
    window,
    metadata: { primaryType },
  } as never);
  return window;
}

beforeEach(() => {
  jest.clearAllMocks();
  applicationWindows.clear();
  jest.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null);
  jest.mocked(provider.list).mockResolvedValue([
    {
      agent: 'opencode',
      id: 'ses_12345678',
      title: 'Fix login',
      directory: '/repos/acme/app',
      createdAt: 1,
      updatedAt: 2,
      resumable: true,
    },
  ]);
  jest.mocked(provider.prepareResume).mockResolvedValue(target);
});

test('lists provider session summaries scoped to registered repository directories', async () => {
  const handler = routes().get;
  const res = response();
  await handler(
    {
      headers: {},
      query: { agent: 'opencode', q: 'login' },
    } as unknown as Request,
    res,
  );
  expect(provider.list).toHaveBeenCalledWith(
    ['/repos/acme'],
    'login',
    undefined,
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    agent: 'opencode',
    sessions: [
      expect.objectContaining({ id: 'ses_12345678', resumable: true }),
    ],
  });
});

test('rejects browser-origin session-history reads', async () => {
  const res = response();
  await routes().get(
    {
      headers: { origin: 'https://example.test' },
      query: { agent: 'claude' },
    } as unknown as Request,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(403);
  expect(provider.list).not.toHaveBeenCalled();
});

test('resumes a verified session by dispatching a terminal tab and awaiting acknowledgement', async () => {
  const window = host();
  const { post, dispatch } = routes();
  const res = response();
  await post(
    {
      headers: {},
      body: {
        agent: 'opencode',
        sessionId: 'ses_12345678',
        directory: '/repos/acme/app',
      },
    } as unknown as Request,
    res,
  );
  expect(provider.prepareResume).toHaveBeenCalledWith(
    '/repos/acme/app',
    'ses_12345678',
  );
  expect(dispatch).toHaveBeenCalledWith(window.webContents, target);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    opened: true,
    sessionId: 'ses_12345678',
  });
});

test('rejects unregistered directories and browser-origin resume requests', async () => {
  const window = host();
  const { post, dispatch } = routes();
  let res = response();
  await post(
    {
      headers: {},
      body: {
        agent: 'opencode',
        sessionId: 'ses_12345678',
        directory: '/private',
      },
    } as unknown as Request,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(400);
  expect(provider.prepareResume).not.toHaveBeenCalled();
  res = response();
  await post(
    {
      headers: { 'sec-fetch-site': 'cross-site' },
      body: {
        agent: 'opencode',
        sessionId: 'ses_12345678',
        directory: '/repos/acme/app',
      },
    } as unknown as Request,
    res,
  );
  expect(res.status).toHaveBeenCalledWith(403);
  expect(dispatch).not.toHaveBeenCalled();
  expect(window.webContents.send).not.toHaveBeenCalled();
});

test('reports no focused MAIN host without claiming that the tab opened', async () => {
  const { post, dispatch } = routes();
  const res = response();
  await post(
    {
      headers: {},
      body: {
        agent: 'opencode',
        sessionId: 'ses_12345678',
        directory: '/repos/acme/app',
      },
    } as unknown as Request,
    res,
  );
  expect(dispatch).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    opened: false,
    sessionId: 'ses_12345678',
    reason: 'no-focused-agent-session-host',
  });
});

test('waits for an acknowledgement from the matching renderer and cleans up', async () => {
  jest.useFakeTimers();
  const contents = new EventEmitter() as EventEmitter & {
    send: jest.Mock;
    mainFrame: object;
  };
  contents.send = jest.fn();
  contents.mainFrame = {};
  const pending = dispatchAgentSessionTabOpen(
    contents as unknown as WebContents,
    target,
  );
  const [, envelope] = contents.send.mock.calls[0];
  const [, acknowledge] = (ipcMain.on as jest.Mock).mock.calls[0];
  const event = {
    sender: contents,
    senderFrame: contents.mainFrame,
  };
  acknowledge(
    { ...event, sender: {} },
    {
      requestId: envelope.requestId,
      opened: true,
    },
  );
  acknowledge(event, { requestId: 'wrong', opened: true });
  acknowledge(event, { requestId: envelope.requestId, opened: true });
  await expect(pending).resolves.toBe(true);
  expect(contents.send).toHaveBeenCalledWith(WindowEvent.OPEN_TERMINAL_TAB, {
    ...target,
    requestId: expect.any(String),
  });
  expect(ipcMain.removeListener).toHaveBeenCalledWith(
    WindowEvent.OPEN_TERMINAL_TAB_ACK,
    acknowledge,
  );
  expect(contents.listenerCount('destroyed')).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
