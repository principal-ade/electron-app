/** @jest-environment node */

import { ipcMain } from 'electron';
import { setupQuickOpenHandlers } from './quickOpen';
import { focusOrCreateMainWindow } from './modernWindowManager';
import { openDevWorkspaceWindow } from './devWorkspaceWindowHandlers';
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

describe('Quick Open selection', () => {
  const send = jest.fn();
  const once = jest.fn();
  const isLoading = jest.fn();
  const isDestroyed = jest.fn();
  let select: (
    event: unknown,
    item: unknown,
    action?: 'acp',
  ) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    isLoading.mockReturnValue(false);
    isDestroyed.mockReturnValue(false);
    jest.mocked(focusOrCreateMainWindow).mockResolvedValue({
      window: { isDestroyed, webContents: { send, once, isLoading } },
    } as unknown as NonNullable<
      Awaited<ReturnType<typeof focusOrCreateMainWindow>>
    >);
    setupQuickOpenHandlers();
    const registration = jest
      .mocked(ipcMain.on)
      .mock.calls.find(([channel]) => channel === 'quick-open:select');
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

  it('opens GitHub results in Explorer', async () => {
    await select({}, githubItem);

    expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_REPOSITORY_EXPLORER, {
      owner: 'acme',
      name: 'widgets',
      description: 'Widgets',
      stars: 42,
    });
    expect(openDevWorkspaceWindow).not.toHaveBeenCalled();
    expect(
      jest.mocked(ipcMain.handle).mock.calls.map(([channel]) => channel),
    ).not.toContain('quick-open:clone-github');
  });

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

  it('opens owner directories in a terminal tab', async () => {
    await select(
      {},
      {
        type: 'ownerDirectory',
        name: 'acme',
        localPath: '/work/acme',
        isOpen: false,
      },
    );
    expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_TERMINAL_TAB, {
      directory: '/work/acme',
      label: 'acme',
    });
  });

  it.each([false, true])(
    'opens local repositories in a terminal tab (workspace already open: %s)',
    async (isOpen) => {
      const alexandriaEntry = { name: 'widgets', path: '/work/widgets' };
      await select(
        {},
        {
          type: 'repository',
          name: 'widgets',
          localPath: '/work/widgets',
          alexandriaEntry,
          isOpen,
          openWindowId: isOpen ? 123 : undefined,
        },
      );
      expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_TERMINAL_TAB, {
        directory: '/work/widgets',
        label: 'widgets',
      });
      expect(openDevWorkspaceWindow).not.toHaveBeenCalled();
    },
  );

  it('opens local repositories in an ACP tab on the acp action', async () => {
    const alexandriaEntry = {
      name: 'widgets',
      github: { owner: 'acme', name: 'widgets' },
    };
    await select(
      {},
      {
        type: 'repository',
        name: 'widgets',
        localPath: '/work/widgets',
        avatarUrl: 'https://github.com/acme.png',
        alexandriaEntry,
        isOpen: false,
      },
      'acp',
    );

    expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_ACP_TAB, {
      directory: '/work/widgets',
      label: 'widgets',
      repository: {
        owner: 'acme',
        name: 'widgets',
        avatarUrl: 'https://github.com/acme.png',
      },
    });
    expect(send).not.toHaveBeenCalledWith(
      WindowEvent.OPEN_TERMINAL_TAB,
      expect.anything(),
    );
    expect(openDevWorkspaceWindow).not.toHaveBeenCalled();
  });

  it('opens owner directories in an ACP tab on the acp action', async () => {
    await select(
      {},
      {
        type: 'ownerDirectory',
        name: 'acme',
        localPath: '/work/acme',
        isOpen: false,
      },
      'acp',
    );

    expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_ACP_TAB, {
      directory: '/work/acme',
      label: 'acme',
      repository: undefined,
    });
    expect(send).not.toHaveBeenCalledWith(
      WindowEvent.OPEN_TERMINAL_TAB,
      expect.anything(),
    );
  });

  it('waits for a new principal window before opening a repository tab', async () => {    isLoading.mockReturnValue(true);
    await select(
      {},
      {
        type: 'repository',
        name: 'widgets',
        localPath: '/work/widgets',
        isOpen: false,
      },
    );
    expect(send).not.toHaveBeenCalled();
    expect(once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));

    once.mock.calls[0][1]();
    expect(send).toHaveBeenCalledWith(WindowEvent.OPEN_TERMINAL_TAB, {
      directory: '/work/widgets',
      label: 'widgets',
    });
    expect(openDevWorkspaceWindow).not.toHaveBeenCalled();
  });

  it('does not open a repository tab in a window destroyed while loading', async () => {
    isLoading.mockReturnValue(true);
    await select(
      {},
      {
        type: 'repository',
        name: 'widgets',
        localPath: '/work/widgets',
        isOpen: false,
      },
    );
    isDestroyed.mockReturnValue(true);
    once.mock.calls[0][1]();
    expect(send).not.toHaveBeenCalled();
    expect(openDevWorkspaceWindow).not.toHaveBeenCalled();
  });
});
