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
        border: '#333333',
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
        info: '#0000ff',
      },
      fonts: { heading: 'sans-serif', monospace: 'monospace' },
    },
  }),
}));
jest.mock('../../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getDaemonDiagnostics: jest.fn().mockResolvedValue({
      state: 'starting',
      socketPath: '/test/repo-monitor.sock',
    }),
  },
}));
jest.mock('../../../main-process-api/ShellService', () => ({
  ShellService: {},
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
