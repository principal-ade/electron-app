import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { ClaudeSessionHistoryAPI } from '../../shared/main-process-api-interfaces/ClaudeSessionHistoryAPI';
import type { CursorSessionHistoryAPI } from '../../shared/main-process-api-interfaces/CursorSessionHistoryAPI';
import type { OpenCodeSessionHistoryAPI } from '../../shared/main-process-api-interfaces/OpenCodeSessionHistoryAPI';
import { SessionsLeftPanel } from './SessionsLeftPanel';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111',
        textSecondary: '#666',
        background: '#fff',
        border: '#ddd',
      },
      fonts: { body: 'sans-serif' },
      fontSizes: ['12px', '14px'],
    },
  }),
}));

describe('SessionsLeftPanel', () => {
  let history: jest.Mocked<OpenCodeSessionHistoryAPI>;
  let claudeHistory: jest.Mocked<ClaudeSessionHistoryAPI>;
  let cursorHistory: jest.Mocked<CursorSessionHistoryAPI>;

  beforeEach(() => {
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
        createdAt: 100,
        updatedAt: 200,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    expect(await screen.findByText('Fix the session picker')).toBeTruthy();
    expect(history.listProjects).toHaveBeenCalledWith(['/work/example']);

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

  it('searches transcripts across registered project directories', async () => {
    history.listProjects.mockResolvedValue([]);
    history.searchProjects.mockResolvedValue([
      {
        id: 'ses_match01',
        title: 'Found in the transcript',
        directory: '/work/example',
        createdAt: 100,
        updatedAt: 200,
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
        createdAt: 100,
        updatedAt: 200,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open Claude Code session: Fix the login flow',
      }),
    );
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
        createdAt: 100,
        updatedAt: 200,
        resumable: true,
      },
    ]);

    render(
      <SessionsLeftPanel
        repositories={[{ path: '/work/example' } as AlexandriaEntry]}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open Cursor session: Update package scripts',
      }),
    );
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
        createdAt: 100,
        updatedAt: 200,
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
