import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { DeleteAlexandriaEntryModal } from './DeleteAlexandriaEntryModal';
import { ShellService } from '../../main-process-api/ShellService';
import { GitService } from '../../main-process-api/GitService';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: {},
      fontSizes: [],
      fontWeights: {},
    },
  }),
}));
jest.mock('../../main-process-api/ShellService', () => ({
  ShellService: { openPath: jest.fn() },
}));
jest.mock('../../main-process-api/GitService', () => ({
  GitService: {
    getBranchStatus: jest.fn(),
    execCommand: jest.fn(),
  },
}));
jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getGitStatusWithFiles: jest.fn(),
    refreshGitStatus: jest.fn(),
    onGitStatusChanged: jest.fn(),
  },
}));

const service = jest.mocked(RepositoryMonitoringService);
const status = (
  overrides: Partial<GitStatusWithFiles> = {},
): GitStatusWithFiles => ({
  repoPath: '/selected-clone',
  branch: 'main',
  isDirty: false,
  ahead: 0,
  behind: 0,
  hasStaged: false,
  hasUntracked: false,
  watchingEnabled: false,
  stagedFiles: [],
  modifiedFiles: [],
  createdFiles: [],
  deletedFiles: [],
  untrackedFiles: [],
  hash: 'status',
  ...overrides,
});
const props = () => ({
  isOpen: true,
  entry: { name: 'repo', path: '/other-clone' } as AlexandriaEntry,
  clonePath: '/selected-clone',
  onClose: jest.fn(),
  onConfirm: jest.fn().mockResolvedValue(undefined),
});
const deleteButton = () =>
  screen.getByRole('button', {
    name: 'Delete Project Folder',
  }) as HTMLButtonElement;
let emit: (value: GitStatusWithFiles) => void;
let off: jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  off = jest.fn();
  service.getGitStatusWithFiles.mockResolvedValue(status());
  service.refreshGitStatus.mockResolvedValue(status());
  service.onGitStatusChanged.mockImplementation((callback) => {
    emit = callback;
    return off;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it('warns about closing terminals and shows the selected clone path', async () => {
  render(<DeleteAlexandriaEntryModal {...props()} />);
  await act(async () => {});
  await screen.findByText(
    /Any open terminals for this clone will be closed first, stopping their running commands/,
  );
  expect(screen.getByText('/selected-clone')).toBeTruthy();
  fireEvent.click(screen.getByText('Open in Finder'));
  expect(ShellService.openPath).toHaveBeenCalledWith('/selected-clone');
  expect(service.getGitStatusWithFiles).toHaveBeenCalledWith('/selected-clone');
  expect(GitService.getBranchStatus).not.toHaveBeenCalled();
  expect(GitService.execCommand).not.toHaveBeenCalled();
});

it('deduplicates all changed-file categories and warns about monitored unpushed commits', async () => {
  service.getGitStatusWithFiles.mockResolvedValue(
    status({
      isDirty: true,
      stagedFiles: ['shared.ts', 'staged.ts'],
      modifiedFiles: ['shared.ts'],
      createdFiles: ['new.ts'],
      untrackedFiles: ['new.ts', 'untracked.ts'],
      deletedFiles: ['deleted.ts'],
      ahead: 2,
      branch: 'feature',
    }),
  );
  render(<DeleteAlexandriaEntryModal {...props()} />);
  await screen.findByText('Warning: You will lose uncommitted work!');
  expect(screen.getByText('5')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('feature')).toBeTruthy();
  expect(deleteButton().disabled).toBe(false);
});

it('falls back to the entry path and accepts clean status without an upstream', async () => {
  const input = { ...props(), clonePath: undefined };
  service.getGitStatusWithFiles.mockResolvedValue(
    status({ repoPath: '/other-clone' }),
  );
  render(<DeleteAlexandriaEntryModal {...input} />);
  await act(async () => {});
  expect(service.getGitStatusWithFiles).toHaveBeenCalledWith('/other-clone');
  expect(deleteButton().disabled).toBe(false);
  expect(screen.queryByText(/unpushed .* will be lost/)).toBeNull();
  fireEvent.click(deleteButton());
  await act(async () => {});
  expect(input.onConfirm).toHaveBeenCalledWith(true);
});

it('blocks deletion while loading but still allows cancellation', () => {
  service.getGitStatusWithFiles.mockReturnValue(new Promise(() => {}));
  const input = props();
  render(<DeleteAlexandriaEntryModal {...input} />);
  expect(screen.getByText('Checking for uncommitted work…')).toBeTruthy();
  expect(deleteButton().disabled).toBe(true);
  fireEvent.click(deleteButton());
  expect(input.onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(input.onClose).toHaveBeenCalled();
});

it.each(['missing', 'error', 'wrong-clone'])(
  'shows an unavailable warning for %s status but still allows deletion',
  async (failure) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    if (failure === 'error') {
      service.getGitStatusWithFiles.mockRejectedValueOnce(
        new Error('monitor offline'),
      );
    } else {
      service.getGitStatusWithFiles.mockResolvedValueOnce(
        failure === 'missing' ? null : status({ repoPath: '/unrelated' }),
      );
    }
    render(<DeleteAlexandriaEntryModal {...props()} />);
    await screen.findByRole('alert');
    expect(screen.getByText(/Status unavailable/)).toBeTruthy();
    expect(screen.queryByText('Checking for uncommitted work…')).toBeNull();
    expect(deleteButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Retry status check' }));
    await act(async () => {});
    expect(service.refreshGitStatus).toHaveBeenCalledWith('/selected-clone');
    expect(deleteButton().disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(off).toHaveBeenCalled();
    warn.mockRestore();
  },
);

it('allows deleting when repository status cannot be checked', async () => {
  service.getGitStatusWithFiles.mockRejectedValueOnce(
    new Error('monitor offline'),
  );
  const input = props();
  render(<DeleteAlexandriaEntryModal {...input} />);
  await screen.findByRole('alert');

  fireEvent.click(deleteButton());
  await act(async () => {});

  expect(input.onConfirm).toHaveBeenCalledWith(true);
  expect(input.onClose).toHaveBeenCalled();
});

it('bounds loading to five seconds and ignores a late snapshot after timeout', async () => {
  jest.useFakeTimers();
  let resolve!: (value: GitStatusWithFiles) => void;
  service.getGitStatusWithFiles.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { unmount } = render(<DeleteAlexandriaEntryModal {...props()} />);
  act(() => {
    jest.advanceTimersByTime(5_000);
  });
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Checking for uncommitted work…')).toBeNull();
  expect(deleteButton().disabled).toBe(false);
  await act(async () => resolve(status()));
  expect(deleteButton().disabled).toBe(false);
  expect(screen.getByRole('alert')).toBeTruthy();
  unmount();
});

it('uses live updates without letting an older snapshot overwrite them', async () => {
  let resolve!: (value: GitStatusWithFiles) => void;
  service.getGitStatusWithFiles.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<DeleteAlexandriaEntryModal {...props()} />);
  act(() =>
    emit(status({ isDirty: true, modifiedFiles: ['live.ts'], ahead: 3 })),
  );
  await act(async () => resolve(status()));
  expect(screen.getByText('3')).toBeTruthy();
  expect(
    screen.getByText('Warning: You will lose uncommitted work!'),
  ).toBeTruthy();
  act(() => emit(status({ repoPath: '/unrelated', ahead: 9 })));
  expect(screen.queryByText('9')).toBeNull();
  expect(screen.getByText('3')).toBeTruthy();
  act(() => emit(status()));
  expect(
    screen.queryByText('Warning: You will lose uncommitted work!'),
  ).toBeNull();
});

it('ignores results and events from a previously selected clone', async () => {
  let resolveOld!: (value: GitStatusWithFiles) => void;
  service.getGitStatusWithFiles.mockReturnValueOnce(
    new Promise((done) => {
      resolveOld = done;
    }),
  );
  const input = props();
  const { rerender } = render(<DeleteAlexandriaEntryModal {...input} />);
  const emitOld = emit;
  service.getGitStatusWithFiles.mockResolvedValueOnce(
    status({ repoPath: '/next', ahead: 4 }),
  );
  rerender(<DeleteAlexandriaEntryModal {...input} clonePath="/next" />);
  await act(async () => {});
  expect(screen.getByText('4')).toBeTruthy();
  await act(async () => resolveOld(status({ ahead: 8 })));
  act(() => emitOld(status({ ahead: 7 })));
  expect(screen.queryByText('8')).toBeNull();
  expect(screen.queryByText('7')).toBeNull();
  expect(screen.getByText('4')).toBeTruthy();
  expect(off).toHaveBeenCalled();
});

it('cleans up the subscription and pending timeout when closed', async () => {
  jest.useFakeTimers();
  service.getGitStatusWithFiles.mockReturnValue(new Promise(() => {}));
  const input = props();
  const { rerender } = render(<DeleteAlexandriaEntryModal {...input} />);
  rerender(<DeleteAlexandriaEntryModal {...input} isOpen={false} />);
  expect(off).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  act(() => emit(status({ ahead: 6 })));
  expect(screen.queryByText('6')).toBeNull();
});
