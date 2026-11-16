/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ServerDiagnostics } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringDiagnostics } from './RepositoryMonitoringDiagnostics';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#123456',
        text: '#ffffff',
        textSecondary: '#aaaaaa',
        background: '#000000',
        backgroundSecondary: '#111111',
        backgroundTertiary: '#222222',
        border: '#333333',
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
        info: '#0000ff',
      },
      fonts: {
        heading: 'sans-serif',
        monospace: 'monospace',
        body: 'sans-serif',
      },
    },
  }),
}));
jest.mock('../../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getDaemonDiagnostics: jest.fn().mockResolvedValue({
      state: 'starting',
      socketPath: '/test/repo-monitor.sock',
    }),
    getDaemonProcessInfo: jest.fn(),
    killDaemonProcess: jest.fn(),
    restartDaemon: jest.fn(),
    setWatcherImpl: jest.fn(),
    getLogTail: jest.fn(),
  },
}));
jest.mock('../../../main-process-api/ShellService', () => ({
  ShellService: { openPath: jest.fn() },
}));
jest.mock('./remoteDriftStatus', () => ({
  getRemoteDriftStatus: jest.fn(() => null),
}));

const diagnostics: ServerDiagnostics = {
  phase: 'idle',
  connected: false,
  daemonPid: null,
  startedAt: null,
  lastConnectedAt: null,
  phaseEnteredAt: 1000,
  reconnectAttempts: 0,
  disconnectRequested: false,
  lastError: null,
  lastDisconnect: null,
  watcherImpl: null,
  requestedWatcherImpl: 'parcel',
  watcherImplFallbackReason: null,
  lifecycleHistory: [
    { ts: 1000, phase: 'connecting', note: 'Startup recorded' },
  ],
  daemon: null,
};

beforeEach(() => jest.clearAllMocks());

it('places repositories above lifecycle history and collapses both initially', () => {
  render(
    <RepositoryMonitoringDiagnostics
      diagnostics={diagnostics}
      nowTick={2000}
      lastDaemonPid={null}
    />,
  );

  const repos = screen.getByRole('button', {
    name: 'Repositories in the daemon',
  });
  const history = screen.getByRole('button', { name: 'Lifecycle history (1)' });
  expect(
    repos.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(repos.getAttribute('aria-expanded')).toBe('false');
  expect(history.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('Startup recorded')).toBeNull();
  expect(
    RepositoryMonitoringService.getDaemonDiagnostics,
  ).not.toHaveBeenCalled();
});

it('lets each section expand and collapse independently', async () => {
  render(
    <RepositoryMonitoringDiagnostics
      diagnostics={diagnostics}
      nowTick={2000}
      lastDaemonPid={null}
    />,
  );

  const repos = screen.getByRole('button', {
    name: 'Repositories in the daemon',
  });
  const history = screen.getByRole('button', { name: 'Lifecycle history (1)' });
  fireEvent.click(history);
  expect(screen.getByText('Startup recorded')).toBeTruthy();
  expect(repos.getAttribute('aria-expanded')).toBe('false');

  fireEvent.click(repos);
  expect(await screen.findByText('Daemon is starting…')).toBeTruthy();
  expect(repos.getAttribute('aria-expanded')).toBe('true');
  expect(history.getAttribute('aria-expanded')).toBe('true');

  fireEvent.click(history);
  expect(screen.queryByText('Startup recorded')).toBeNull();
  expect(repos.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(repos);
  expect(screen.queryByText('Daemon is starting…')).toBeNull();
  expect(repos.getAttribute('aria-expanded')).toBe('false');
});

const unreachableDiagnostics: ServerDiagnostics = {
  ...diagnostics,
  phase: 'unreachable',
  phaseEnteredAt: Date.now() - 5000,
  startedAt: Date.now() - 60000,
  lastConnectedAt: Date.now() - 30000,
  reconnectAttempts: 3,
  lastError: { message: 'Request timeout: getDaemonStatus' },
  lastDisconnect: { at: Date.now() - 10000, reason: 'connection lost' },
  lifecycleHistory: [],
};

describe('DaemonProcessPanel', () => {
  it('identifies a hung daemon by last-known PID even when disconnected', async () => {
    (RepositoryMonitoringService.getDaemonProcessInfo as jest.Mock).mockResolvedValue(
      {
        pid: 4242,
        alive: true,
        command: '/usr/local/bin/node /path/to/daemon.js --serve',
        ppid: 100,
      },
    );

    render(
      <RepositoryMonitoringDiagnostics
        diagnostics={unreachableDiagnostics}
        nowTick={Date.now()}
        lastDaemonPid={4242}
      />,
    );

    expect(await screen.findByText('Daemon process')).toBeTruthy();
    expect(screen.getByText('4242')).toBeTruthy();
    expect(await screen.findByText('Running')).toBeTruthy();
    expect(
      screen.getByTitle('/usr/local/bin/node /path/to/daemon.js --serve'),
    ).toBeTruthy();
    expect(screen.getByText('Copy kill command')).toBeTruthy();
    expect(screen.getByText('Kill process')).toBeTruthy();
  });

  it('kills the hung process after inline confirmation', async () => {
    (RepositoryMonitoringService.getDaemonProcessInfo as jest.Mock).mockResolvedValue(
      { pid: 4242, alive: true, command: 'node daemon.js', ppid: 100 },
    );
    (RepositoryMonitoringService.killDaemonProcess as jest.Mock).mockResolvedValue(
      { success: true, pid: 4242, signal: 'SIGTERM' },
    );

    render(
      <RepositoryMonitoringDiagnostics
        diagnostics={unreachableDiagnostics}
        nowTick={Date.now()}
        lastDaemonPid={4242}
      />,
    );

    fireEvent.click(await screen.findByText('Kill process'));
    // Second click confirms.
    fireEvent.click(await screen.findByText('Confirm kill 4242?'));

    expect(
      await screen.findByText(/PID 4242 exited \(SIGTERM\)/),
    ).toBeTruthy();
    expect(
      RepositoryMonitoringService.killDaemonProcess,
    ).toHaveBeenCalledTimes(1);
  });

  it('reports kill failures with the error', async () => {
    (RepositoryMonitoringService.getDaemonProcessInfo as jest.Mock).mockResolvedValue(
      { pid: 4242, alive: true, command: 'node daemon.js', ppid: 100 },
    );
    (RepositoryMonitoringService.killDaemonProcess as jest.Mock).mockResolvedValue(
      {
        success: false,
        pid: 4242,
        signal: null,
        error: 'Process 4242 is still alive after SIGKILL.',
      },
    );

    render(
      <RepositoryMonitoringDiagnostics
        diagnostics={unreachableDiagnostics}
        nowTick={Date.now()}
        lastDaemonPid={4242}
      />,
    );

    fireEvent.click(await screen.findByText('Kill process'));
    fireEvent.click(await screen.findByText('Confirm kill 4242?'));

    expect(await screen.findByText(/still alive after SIGKILL/)).toBeTruthy();
  });

  it('shows a nothing-to-kill state when no PID was ever seen', async () => {
    render(
      <RepositoryMonitoringDiagnostics
        diagnostics={unreachableDiagnostics}
        nowTick={Date.now()}
        lastDaemonPid={null}
      />,
    );

    expect(await screen.findByText('Daemon process')).toBeTruthy();
    expect(
      screen.getByText(/No daemon PID seen yet this session/),
    ).toBeTruthy();
    expect(screen.queryByText('Kill process')).toBeNull();
  });
});
