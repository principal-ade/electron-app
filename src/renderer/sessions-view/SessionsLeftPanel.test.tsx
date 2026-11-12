import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { ClaudeSessionHistoryAPI } from '../../shared/main-process-api-interfaces/ClaudeSessionHistoryAPI';
import type { CursorSessionHistoryAPI } from '../../shared/main-process-api-interfaces/CursorSessionHistoryAPI';
import type { OpenCodeSessionHistoryAPI } from '../../shared/main-process-api-interfaces/OpenCodeSessionHistoryAPI';
import { agentSessionBookmarkTabId } from '../../shared/agentSessionBookmark';
import { SessionsLeftPanel } from './SessionsLeftPanel';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

jest.mock('../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: {
    getPreferences: jest.fn().mockResolvedValue({
      interactiveShell: { sessionBookmarks: [] },
    }),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
    onPreferencesUpdated: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111',
        textSecondary: '#666',
        textMuted: '#999',
        background: '#fff',
        backgroundSecondary: '#eee',
        border: '#ddd',
        primary: '#08f',
      },
      fonts: { body: 'sans-serif' },
      fontSizes: ['12px', '14px', '16px'],
    },
  }),
}));

const RECENT_SESSION_TIME = Date.now();

describe('SessionsLeftPanel', () => {
  let history: jest.Mocked<OpenCodeSessionHistoryAPI>;
  let claudeHistory: jest.Mocked<ClaudeSessionHistoryAPI>;
  let cursorHistory: jest.Mocked<CursorSessionHistoryAPI>;

  beforeEach(() => {
    jest.clearAllMocks();
    (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({
      interactiveShell: { sessionBookmarks: [] },
    });
    history = {
      list: jest.fn(),
      listProjects: jest.fn(),
      search: jest.fn(),
      searchProjects: jest.fn(),
      getResumeTarget: jest.fn(),
      resume: jest.fn().mockResolvedValue(undefined),
    };
    history.listProjects.mockResolvedValue([]);
    history.searchProjects.mockResolvedValue([]);
    claudeHistory = {
      list: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockResolvedValue([]),
      resume: jest.fn().mockResolvedValue(undefined),
    };
    cursorHistory = {
      list: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockResolvedValue([]),
      resume: jest.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(window, 'mainProcess', {
      configurable: true,
      value: {
        openCodeSessionHistory: history,
        claudeSessionHistory: claudeHistory,
        cursorSessionHistory: cursorHistory,
      },
    });
  });

  it('lists OpenCode sessions from registered local repositories and resumes one', async () => {
    history.listProjects.mockResolvedValue([
      {
        id: 'ses_history1',
        title: 'Fix the session picker',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    expect(await screen.findByText('Fix the session picker')).toBeTruthy();
    expect(history.listProjects).toHaveBeenCalledWith(['/work/example']);
    expect(
      document.querySelector('[data-agent-icon="opencode"]'),
    ).not.toBeNull();
    const bookmark = screen.getByRole('button', {
      name: 'Bookmark OpenCode session: Fix the session picker',
    });
    expect(
      bookmark.nextElementSibling?.querySelector(
        '[data-agent-icon="opencode"]',
      ),
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open OpenCode session: Fix the session picker',
      }),
    );
    await waitFor(() => {
      expect(history.resume).toHaveBeenCalledWith(
        '/work/example',
        'ses_history1',
      );
    });
  });

  it('shows a provider result without waiting for the other histories', async () => {
    let resolveClaude!: (
      sessions: Awaited<ReturnType<typeof claudeHistory.list>>,
    ) => void;
    let resolveCursor!: (
      sessions: Awaited<ReturnType<typeof cursorHistory.list>>,
    ) => void;
    claudeHistory.list.mockReturnValue(
      new Promise((resolve) => {
        resolveClaude = resolve;
      }),
    );
    cursorHistory.list.mockReturnValue(
      new Promise((resolve) => {
        resolveCursor = resolve;
      }),
    );
    history.listProjects.mockResolvedValue([
      {
        id: 'ses_early01',
        title: 'Available before the other providers',
        directory: '/work/example',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    expect(
      await screen.findByText('Available before the other providers'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Loading more sessions…')).toBeTruthy();
    expect(claudeHistory.list).toHaveBeenCalled();
    expect(cursorHistory.list).toHaveBeenCalled();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    await act(async () => {
      resolveClaude([
        {
          id: '11111111-aaaa-bbbb-cccc-000000000002',
          title: 'A session from yesterday',
          directory: '/work/example',
          createdAt: yesterday.getTime(),
          updatedAt: yesterday.getTime(),
        },
      ]);
      resolveCursor([]);
      await Promise.resolve();
    });
    expect(await screen.findByText('A session from yesterday')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText('Loading more sessions…')).toBeNull();
    });
  });

  it('hides sessions outside the last seven calendar days', async () => {
    const oldDate = new Date();
    oldDate.setHours(12, 0, 0, 0);
    oldDate.setDate(oldDate.getDate() - 7);
    history.listProjects.mockResolvedValue([
      {
        id: 'ses_recent01',
        title: 'A recent session',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
      },
      {
        id: 'ses_old0001',
        title: 'An older session',
        directory: '/work/example',
        createdAt: oldDate.getTime(),
        updatedAt: oldDate.getTime(),
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    expect(await screen.findByText('A recent session')).toBeTruthy();
    expect(screen.queryByText('An older session')).toBeNull();
  });

  it('bookmarks a session in user preferences and exposes its pinned state', async () => {
    history.listProjects.mockResolvedValue([
      {
        id: 'ses_history1',
        title: 'Fix the session picker',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    await screen.findByRole('button', {
      name: 'Bookmark OpenCode session: Fix the session picker',
    });
    let bookmark = screen.getByRole('button', {
      name: 'Bookmark OpenCode session: Fix the session picker',
    });
    fireEvent.click(bookmark);

    bookmark = await screen.findByRole('button', {
      name: 'Remove bookmark from OpenCode session: Fix the session picker',
    });
    expect(bookmark.getAttribute('aria-pressed')).toBe('true');
    expect(UserPreferencesService.updatePreferences).toHaveBeenCalledWith({
      interactiveShell: {
        sessionBookmarks: [
          JSON.stringify(['OpenCode', '/work/example', 'ses_history1']),
        ],
        sessionBookmarkDetails: [
          {
            id: 'ses_history1',
            title: 'Fix the session picker',
            directory: '/work/example',
            agent: 'OpenCode',
          },
        ],
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open OpenCode session: Fix the session picker',
      }),
    );
    await waitFor(() => {
      expect(history.resume).toHaveBeenCalledWith(
        '/work/example',
        'ses_history1',
        agentSessionBookmarkTabId({
          agent: 'OpenCode',
          directory: '/work/example',
          id: 'ses_history1',
        }),
      );
    });

    fireEvent.click(bookmark);
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', {
            name: 'Bookmark OpenCode session: Fix the session picker',
          })
          .getAttribute('aria-pressed'),
      ).toBe('false');
    });
    expect(UserPreferencesService.updatePreferences).toHaveBeenLastCalledWith({
      interactiveShell: {
        sessionBookmarks: [],
        sessionBookmarkDetails: [],
      },
    });
  });

  it('searches transcripts across registered project directories', async () => {
    history.listProjects.mockResolvedValue([]);
    history.searchProjects.mockResolvedValue([
      {
        id: 'ses_match01',
        title: 'Found in the transcript',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search agent sessions' }),
      {
        target: { value: 'transcript term' },
      },
    );

    expect(await screen.findByText('Found in the transcript')).toBeTruthy();
    expect(history.searchProjects).toHaveBeenCalledWith(
      ['/work/example'],
      'transcript term',
    );
  });

  it('includes Claude Code sessions and resumes them through Claude', async () => {
    claudeHistory.list.mockResolvedValue([
      {
        id: '11111111-aaaa-bbbb-cccc-000000000001',
        title: 'Fix the login flow',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    const claudeSession = await screen.findByRole('button', {
      name: 'Open Claude Code session: Fix the login flow',
    });
    expect(document.querySelector('[data-agent-icon="claude"]')).not.toBeNull();
    fireEvent.click(claudeSession);
    await waitFor(() => {
      expect(claudeHistory.resume).toHaveBeenCalledWith(
        '/work/example',
        '11111111-aaaa-bbbb-cccc-000000000001',
      );
    });
  });

  it('includes resumable Cursor sessions and routes resume to Cursor Agent', async () => {
    cursorHistory.list.mockResolvedValue([
      {
        id: 'cursor-session-1234',
        title: 'Update package scripts',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
        resumable: true,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    const cursorSession = await screen.findByRole('button', {
      name: 'Open Cursor session: Update package scripts',
    });
    expect(document.querySelector('[data-agent-icon="cursor"]')).not.toBeNull();
    fireEvent.click(cursorSession);
    await waitFor(() => {
      expect(cursorHistory.resume).toHaveBeenCalledWith(
        '/work/example',
        'cursor-session-1234',
      );
    });
  });

  it('hides non-resumable Cursor IDE sessions', async () => {
    cursorHistory.list.mockResolvedValue([
      {
        id: 'cursor-composer-1234',
        title: 'Old Composer conversation',
        directory: '/work/example',
        createdAt: RECENT_SESSION_TIME - 60_000,
        updatedAt: RECENT_SESSION_TIME,
        resumable: false,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    expect(
      await screen.findByText(
        'No Claude Code, Cursor, or OpenCode sessions found.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Old Composer conversation')).toBeNull();
  });
});
