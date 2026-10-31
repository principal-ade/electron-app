/** @jest-environment node */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import chokidar from 'chokidar';
import { ElectronFileSystemAdapter } from './fileSystemHandlers';

jest.mock('electron', () => ({
  app: { getPath: jest.fn() },
  dialog: { showOpenDialog: jest.fn() },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  BrowserWindow: { fromWebContents: jest.fn() },
}));
jest.mock('chokidar', () => ({
  __esModule: true,
  default: { watch: jest.fn() },
}));
jest.mock('../version-control-providers/githubHandlers', () => ({
  GitHubAdapter: jest.fn(),
}));
jest.mock('../services/SkillsConfigService', () => ({
  SkillsConfigService: jest.fn(),
}));
jest.mock('../services/SkillsGitService', () => ({
  SkillsGitService: jest.fn(),
}));
jest.mock('../services/SkillsSyncService', () => ({
  SkillsSyncService: jest.fn(),
}));
jest.mock('../services/SkillsDetectionService', () => ({
  SkillsDetectionService: jest.fn(),
}));
jest.mock('../skills/skillLockFile', () => ({
  getSkillLockFileService: jest.fn(),
}));
jest.mock('../skills/symlinkUtils', () => ({
  isSymlink: jest.fn(),
  removeSkillSymlink: jest.fn(),
}));
jest.mock('../services/RecentReposService', () => ({
  RecentReposService: jest.fn(),
}));
jest.mock('../utils/gitClientFactory', () => ({ gitClientFactory: {} }));
jest.mock('../file-system-service', () => ({ FileSystemService: {} }));
jest.mock('./gitRepositoryScannerService', () => ({
  GitRepositoryScannerService: { getInstance: jest.fn() },
}));
jest.mock('../stores/AlexandriaRegistryService', () => ({
  AlexandriaRegistryService: { getInstance: jest.fn() },
}));
jest.mock('./localFileStats', () => ({ getLocalFileStats: jest.fn() }));

type FakeWatcher = {
  on: jest.Mock;
  close: jest.Mock;
  handlers: Record<string, (...args: unknown[]) => void>;
};

function makeFakeWatcher(): FakeWatcher {
  const watcher: FakeWatcher = {
    handlers: {},
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  watcher.on.mockImplementation((event: string, handler) => {
    watcher.handlers[event] = handler;
    return watcher;
  });
  return watcher;
}

describe('ElectronFileSystemAdapter file watching', () => {
  let dir: string;
  let fileA: string;
  let fileB: string;
  let watchers: FakeWatcher[];
  const send = jest.fn();
  const mainWindow = {
    id: 1,
    isDestroyed: () => false,
    webContents: { send },
  } as unknown as import('electron').BrowserWindow;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-adapter-'));
    fileA = path.join(dir, 'a.ts');
    fileB = path.join(dir, 'b.md');
    fs.writeFileSync(fileA, 'a');
    fs.writeFileSync(fileB, 'b');
    watchers = [];
    (chokidar.watch as jest.Mock).mockReset();
    (chokidar.watch as jest.Mock).mockImplementation(() => {
      const w = makeFakeWatcher();
      watchers.push(w);
      return w;
    });
    send.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function adapter() {
    const a = new ElectronFileSystemAdapter();
    a.setMainWindow(mainWindow);
    return a;
  }

  it('keeps earlier watchers alive when a second file is watched', async () => {
    const a = adapter();
    expect(await a.watchFile(fileA)).toBe(true);
    expect(await a.watchFile(fileB)).toBe(true);

    expect(chokidar.watch).toHaveBeenCalledTimes(2);
    expect(watchers[0].close).not.toHaveBeenCalled();

    watchers[0].handlers.change(fileA, { size: 1, mtime: new Date() });
    expect(send).toHaveBeenCalledWith(
      'file-change',
      expect.objectContaining({ type: 'change', path: fileA }),
    );
  });

  it('stops only the requested path', async () => {
    const a = adapter();
    await a.watchFile(fileA);
    await a.watchFile(fileB);

    expect(await a.stopWatchingFile(fileB)).toBe(true);
    expect(watchers[1].close).toHaveBeenCalledTimes(1);
    expect(watchers[0].close).not.toHaveBeenCalled();

    expect(await a.stopWatchingFile(fileA)).toBe(true);
    expect(watchers[0].close).toHaveBeenCalledTimes(1);
  });

  it('shares one watcher between subscribers of the same path', async () => {
    const a = adapter();
    await a.watchFile(fileA);
    await a.watchFile(fileA);
    expect(chokidar.watch).toHaveBeenCalledTimes(1);

    expect(await a.stopWatchingFile(fileA)).toBe(true);
    expect(watchers[0].close).not.toHaveBeenCalled();

    expect(await a.stopWatchingFile(fileA)).toBe(true);
    expect(watchers[0].close).toHaveBeenCalledTimes(1);

    expect(await a.stopWatchingFile(fileA)).toBe(false);
  });

  it('refuses to watch a missing file without touching existing watchers', async () => {
    const a = adapter();
    await a.watchFile(fileA);
    expect(await a.watchFile(path.join(dir, 'missing.ts'))).toBe(false);
    expect(chokidar.watch).toHaveBeenCalledTimes(1);
    expect(watchers[0].close).not.toHaveBeenCalled();
  });

  it('closes every file watcher on stopWatching', async () => {
    const a = adapter();
    await a.watchFile(fileA);
    await a.watchFile(fileB);
    expect(await a.stopWatching()).toBe(true);
    expect(watchers[0].close).toHaveBeenCalledTimes(1);
    expect(watchers[1].close).toHaveBeenCalledTimes(1);
    expect(await a.stopWatchingFile(fileA)).toBe(false);
  });
});
