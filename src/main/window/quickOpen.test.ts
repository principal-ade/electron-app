/** @jest-environment node */

import { ipcMain } from 'electron';
import { setupQuickOpenHandlers } from './quickOpen';
import { focusOrCreateMainWindow } from './modernWindowManager';
import { openDevWorkspaceWindow } from './devWorkspaceWindowHandlers';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

jest.mock('electron', () => ({
  ipcMain: { on: jest.fn(), handle: jest.fn() },
}));
jest.mock('electron-log', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../util', () => ({ resolveHtmlPath: jest.fn() }));
jest.mock('./types', () => ({
  PrimaryWindowType: { REPOSITORY: 'repository' },
}));
jest.mock('./devWorkspaceWindowHandlers', () => ({
  openDevWorkspaceWindow: jest.fn(),
}));
jest.mock('./modernWindowManager', () => ({
  focusOrCreateMainWindow: jest.fn(),
}));
jest.mock('../version-control-providers/github/apiCore', () => ({
  gitHubAPICore: {},
}));
jest.mock('../services/AuthService', () => ({ authService: {} }));
jest.mock('../stores/userPreferencesHandler', () => ({
  UserPreferencesHandler: { getInstance: jest.fn() },
}));

describe('Quick Open selection', () => {
  const send = jest.fn();
  const once = jest.fn();
  const isLoading = jest.fn();
  const isDestroyed = jest.fn();
  const getUserPreferences = jest.fn();
  let select: (event: unknown, item: unknown) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    isLoading.mockReturnValue(false);
    isDestroyed.mockReturnValue(false);
    jest.mocked(focusOrCreateMainWindow).mockResolvedValue({
      window: { isDestroyed, webContents: { send, once, isLoading } },
    } as unknown as NonNullable<
      Awaited<ReturnType<typeof focusOrCreateMainWindow>>
    >);
    jest.mocked(UserPreferencesHandler.getInstance).mockReturnValue({
      getUserPreferences,
    } as unknown as UserPreferencesHandler);
    setupQuickOpenHandlers();
    const registration = jest.mocked(ipcMain.on).mock.calls.find(
      ([channel]) => channel === 'quick-open:select',
    );
    if (!registration) throw new Error('Quick Open selection handler missing');
    select = registration[1] as typeof select;
  });

  const githubItem = {
    type: 'github',
    name: 'acme/widgets',
    fullName: 'acme/widgets',
    description: 'Widgets',
    stars: 42,
    cloneUrl: 'https://github.com/acme/widgets.git',
    isOpen: false,
  };

  it.each(['window', 'terminal'])(
    'opens GitHub results in Explorer regardless of the %s preference',
    async (quickOpenTarget) => {
      getUserPreferences.mockResolvedValue({ quickOpenTarget });
      await select({}, githubItem);

      expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_REPOSITORY_EXPLORER, {
        owner: 'acme',
        name: 'widgets',
        description: 'Widgets',
        stars: 42,
      });
      expect(getUserPreferences).not.toHaveBeenCalled();
      expect(openDevWorkspaceWindow).not.toHaveBeenCalled();
      expect(jest.mocked(ipcMain.handle).mock.calls.map(([channel]) => channel))
        .not.toContain('quick-open:clone-github');
    },
  );

  it('waits for a newly created principal window to load', async () => {
    isLoading.mockReturnValue(true);
    await select({}, githubItem);
    expect(send).not.toHaveBeenCalled();
    expect(once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    once.mock.calls[0][1]();
    expect(send).toHaveBeenCalledWith(
      WindowEvent.OPEN_REPOSITORY_EXPLORER,
      expect.objectContaining({ owner: 'acme', name: 'widgets' }),
    );
  });

  it('does not send to a window destroyed while loading', async () => {
    isLoading.mockReturnValue(true);
    await select({}, githubItem);
    isDestroyed.mockReturnValue(true);
    once.mock.calls[0][1]();
    expect(send).not.toHaveBeenCalled();
  });

  it('still opens local repositories in a terminal when configured', async () => {
    getUserPreferences.mockResolvedValue({ quickOpenTarget: 'terminal' });
    await select({}, {
      type: 'repository',
      name: 'widgets',
      localPath: '/work/widgets',
      isOpen: false,
    });
    expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_TERMINAL_TAB, {
      directory: '/work/widgets',
      label: 'widgets',
    });
  });

  it('still opens local repositories in a workspace by default', async () => {
    getUserPreferences.mockResolvedValue({});
    const alexandriaEntry = { name: 'widgets', path: '/work/widgets' };
    await select({}, {
      type: 'repository',
      name: 'widgets',
      alexandriaEntry,
      isOpen: false,
    });
    expect(openDevWorkspaceWindow).toHaveBeenCalledWith({ alexandriaEntry });
    expect(send).not.toHaveBeenCalled();
  });
});
