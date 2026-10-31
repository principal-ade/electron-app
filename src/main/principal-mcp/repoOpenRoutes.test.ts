/** @jest-environment node */
import { BrowserWindow } from 'electron';
import type { Application, Request, Response } from 'express';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import {
  parseRepositoryOpenTarget,
  registerRepoOpenRoutes,
} from './repoOpenRoutes';

jest.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: jest.fn() },
}));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  applicationWindows.clear();
  jest.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null);
});

test.each([
  'TimBroddin/gitstatus',
  'pkg:github/TimBroddin/gitstatus',
  'https://github.com/TimBroddin/gitstatus',
  'https://github.com/TimBroddin/gitstatus.git/',
  ' TimBroddin/gitstatus/ ',
])('resolves repository identity from %s', (repo) => {
  expect(parseRepositoryOpenTarget(repo)).toEqual({
    owner: 'TimBroddin',
    name: 'gitstatus',
    purl: 'pkg:github/TimBroddin/gitstatus',
  });
});

test.each([
  undefined,
  null,
  42,
  {},
  '',
  'gitstatus',
  '/Users/me/gitstatus',
  'https://gitlab.com/acme/repo',
  'pkg:gitlab/acme/repo',
  'pkg:generic/local/repo',
  'http://github.com/acme/repo',
  'https://github.com.evil/acme/repo',
  'https://user:password@github.com/acme/repo',
  'https://github.com/acme/repo/issues',
  'https://github.com/acme/repo/tree/main',
  'https://github.com/acme/repo?q=x',
  'https://github.com/acme/repo#readme',
  'https://github.com/acme/../repo',
  'https://github.com/acme/%72epo',
  'acme/repo\n/other',
  'acme\\repo',
  'acme/..',
  'file:///tmp/repo',
  'javascript:alert(1)',
])('rejects unsupported repository target %p', (repo) => {
  expect(parseRepositoryOpenTarget(repo)).toBeUndefined();
});

function route() {
  const post = jest.fn();
  registerRepoOpenRoutes({ post } as unknown as Application);
  expect(post).toHaveBeenCalledWith('/api/repos/open', expect.any(Function));
  return post.mock.calls[0][1] as (req: Request, res: Response) => void;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function open(
  body: unknown = { repo: 'acme/repo' },
  headers: Record<string, string | undefined> = {},
) {
  const res = response();
  route()({ headers, body } as Request, res as unknown as Response);
  return res;
}

function host(primaryType = PrimaryWindowType.MAIN, destroyed = false) {
  const window = {
    id: 1,
    isDestroyed: () => destroyed,
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

test('dispatches the existing Quick Open explorer event to the focused MAIN host', () => {
  const window = host();
  const res = open();
  expect(window.webContents.send).toHaveBeenCalledWith(
    WindowEvent.OPEN_REPOSITORY_EXPLORER,
    { owner: 'acme', name: 'repo' },
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    delivered: true,
    purl: 'pkg:github/acme/repo',
  });
});

test.each([
  { origin: 'https://example.com' },
  { 'sec-fetch-site': 'cross-site' },
  { 'sec-fetch-site': 'none' },
])('rejects browser-page requests before dispatch: %p', (headers) => {
  const window = host();
  const res = open({ repo: 'acme/repo' }, headers);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(window.webContents.send).not.toHaveBeenCalled();
  expect(BrowserWindow.getFocusedWindow).not.toHaveBeenCalled();
});

test.each([
  undefined,
  null,
  [],
  {},
  { repo: 42 },
  { repo: 'acme/repo/issues' },
])('rejects malformed request body %p', (body) => {
  const window = host();
  const res = open(body === undefined ? {} : body);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(window.webContents.send).not.toHaveBeenCalled();
});

test('does not create or focus a window when no MAIN window is focused', () => {
  const res = open();
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    delivered: false,
    purl: 'pkg:github/acme/repo',
    reason: 'no-focused-repository-host',
  });
});

test.each([
  PrimaryWindowType.DEV_WORKSPACE,
  PrimaryWindowType.REPOSITORY,
  PrimaryWindowType.EXTENSION,
])('does not dispatch to a focused %s window', (type) => {
  const window = host(type);
  const res = open();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ delivered: false }),
  );
  expect(window.webContents.send).not.toHaveBeenCalled();
});

test('does not dispatch to a destroyed or unregistered focused window', () => {
  const window = host(PrimaryWindowType.MAIN, true);
  expect(open().json).toHaveBeenCalledWith(
    expect.objectContaining({ delivered: false }),
  );
  expect(window.webContents.send).not.toHaveBeenCalled();
  host();
  applicationWindows.clear();
  expect(open().json).toHaveBeenCalledWith(
    expect.objectContaining({ delivered: false }),
  );
});

test('reports dispatch failure instead of claiming delivery', () => {
  const window = host();
  window.webContents.send.mockImplementation(() => {
    throw new Error('destroyed during dispatch');
  });
  const res = open();
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    error: 'failed to dispatch repository open',
  });
});
