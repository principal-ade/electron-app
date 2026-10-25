/** @jest-environment node */
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { BrowserWindow } from 'electron';
import type { Application, Request, Response } from 'express';
import { DocumentEvent } from '../../shared/main-process-api-interfaces/DocumentAPI';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { registerDocumentRoutes } from './documentRoutes';

jest.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: jest.fn() },
}));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));
jest.mock('../stores/AlexandriaRegistryService', () => ({
  AlexandriaRegistryService: {
    getInstance: () => ({ getRepositoryByPath: jest.fn() }),
  },
}));

type Handler = (request: Request, response: Response) => Promise<void>;

const getFocusedWindow = BrowserWindow.getFocusedWindow as jest.Mock;

function route(): Handler {
  const post = jest.fn();
  registerDocumentRoutes({ post } as unknown as Application);
  expect(post).toHaveBeenCalledWith('/api/document/open', expect.any(Function));
  return post.mock.calls[0][1] as Handler;
}

function response() {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function jsonBody(res: Response) {
  return (res.json as unknown as jest.Mock).mock.calls[0][0];
}

function open(body: Record<string, unknown>) {
  const res = response();
  return route()({ body } as unknown as Request, res).then(() => res);
}

function focusWindow(primaryType = PrimaryWindowType.DEV_WORKSPACE) {
  const send = jest.fn();
  const window = { id: 1, isDestroyed: () => false, webContents: { send } };
  getFocusedWindow.mockReturnValue(window);
  applicationWindows.set(1, {
    window,
    metadata: { primaryType },
  } as never);
  return send;
}

let root: string;

beforeEach(async () => {
  jest.clearAllMocks();
  applicationWindows.clear();
  getFocusedWindow.mockReturnValue(null);
  root = await fs.mkdtemp(path.join(tmpdir(), 'document-routes-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('requires repositoryPath to resolve a relative filePath', async () => {
  const res = await open({ filePath: '.env' });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(jsonBody(res).error).toMatch(/repositoryPath is required/);
});

test('dispatches the requested span to a focused window', async () => {
  const send = focusWindow();
  const range = {
    startLineNumber: 302,
    startColumn: 1,
    endLineNumber: 304,
    endColumn: 2,
  };
  await open({ filePath: 'src/code.ts', repositoryPath: root, range });
  expect(send).toHaveBeenCalledWith(DocumentEvent.OPEN_DOCUMENT, {
    filePath: path.join(root, 'src/code.ts'),
    repositoryPath: root,
    range,
  });
});

test.each([
  null,
  [],
  '10:20',
  {},
  { startLineNumber: 1 },
  { startLineNumber: 0, startColumn: 1, endLineNumber: 2, endColumn: 1 },
  { startLineNumber: 1, startColumn: 1.5, endLineNumber: 2, endColumn: 1 },
  { startLineNumber: '1', startColumn: 1, endLineNumber: 2, endColumn: 1 },
  { startLineNumber: 4, startColumn: 1, endLineNumber: 3, endColumn: 1 },
  { startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 3 },
])(
  'rejects malformed ranges before creation or dispatch: %j',
  async (range) => {
    const send = focusWindow();
    const filePath = path.join(root, 'new.ts');
    const res = await open({ filePath, range, createIfMissing: true });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(send).not.toHaveBeenCalled();
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

test('accepts a collapsed caret range', async () => {
  const send = focusWindow();
  const range = {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
  };
  await open({ filePath: path.join(root, 'code.ts'), range });
  expect(send).toHaveBeenCalledWith(
    DocumentEvent.OPEN_DOCUMENT,
    expect.objectContaining({ range }),
  );
});

test('rejects a non-boolean createIfMissing', async () => {
  const res = await open({
    filePath: path.join(root, '.env'),
    createIfMissing: 'yes',
  });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(jsonBody(res).error).toMatch(/must be a boolean/);
});

test('does not create a missing file without createIfMissing', async () => {
  const filePath = path.join(root, '.env');
  const res = await open({ filePath });

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    windowOpened: false,
    created: false,
  });
  await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('creates a missing file and its parent directories when opted in', async () => {
  const filePath = path.join(root, 'config', 'nested', '.env');
  const res = await open({ filePath, createIfMissing: true });

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    windowOpened: false,
    created: true,
  });
  await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('');
});

test('never overwrites an existing file', async () => {
  const filePath = path.join(root, '.env');
  await fs.writeFile(filePath, 'API_KEY=keep-me\n');

  const res = await open({ filePath, createIfMissing: true });

  expect(jsonBody(res).created).toBe(false);
  await expect(fs.readFile(filePath, 'utf8')).resolves.toBe(
    'API_KEY=keep-me\n',
  );
});

test('rejects a path that resolves to a directory', async () => {
  const directory = path.join(root, 'config');
  await fs.mkdir(directory);

  const res = await open({ filePath: directory, createIfMissing: true });

  expect(res.status).toHaveBeenCalledWith(400);
  expect(jsonBody(res).error).toMatch(/points to a directory/);
});

test('dispatch is unchanged: a focused doc-capable window receives the path', async () => {
  const send = focusWindow();
  const filePath = path.join(root, '.env');

  const res = await open({ filePath, createIfMissing: true });

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    windowOpened: true,
    created: true,
  });
  expect(send).toHaveBeenCalledWith(DocumentEvent.OPEN_DOCUMENT, {
    filePath,
    repositoryPath: undefined,
  });
});

test('a missing file without createIfMissing still dispatches, so the tab can report it', async () => {
  const send = focusWindow(PrimaryWindowType.MAIN);
  const filePath = path.join(root, 'missing.env');

  const res = await open({ filePath });

  expect(jsonBody(res)).toMatchObject({
    windowOpened: true,
    created: false,
  });
  expect(send).toHaveBeenCalledWith(DocumentEvent.OPEN_DOCUMENT, {
    filePath,
    repositoryPath: undefined,
  });
});
