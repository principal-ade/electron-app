/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SystemMonitor } from './SystemMonitor';
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
      fonts: { heading: 'sans-serif', monospace: 'monospace' },
    },
  }),
}));
jest.mock('../../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getMonitoringStatus: jest.fn().mockResolvedValue({
      repositories: [{ path: '/work/repo', isWatching: true }],
      currentMemory: 0,
      currentCpu: 0,
      history: [],
      daemon: null,
    }),
    getServerStatus: jest.fn().mockResolvedValue({ connected: true }),
    getDiagnostics: jest.fn().mockResolvedValue(null),
    onLifecycleEvent: jest.fn(() => () => {}),
    onGitStatusChanged: jest.fn(),
    getFileTree: jest.fn(),
    getPackages: jest.fn(),
  },
}));
jest.mock('../../../main-process-api/CLIBridgeService', () => ({
  CLIBridgeService: {},
}));
jest.mock('../../../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: {
    getPreferences: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('../../../tipc/terminalClient', () => ({
  terminalClient: {
    getActivityState: jest.fn().mockResolvedValue([]),
    listTerminalSessions: jest.fn().mockResolvedValue([]),
  },
  onActivitySync: jest.fn(() => () => {}),
}));
jest.mock('./RepositoryMonitoringDiagnostics', () => ({
  RepositoryMonitoringDiagnostics: () =>
    require('react').createElement('div', null, 'Daemon repository table'),
  phaseLabel: () => 'Connected',
  phaseAccentColor: () => '#00ff00',
  phaseTooltip: () => 'Connected',
}));

it('keeps daemon diagnostics without duplicate registered-directory controls', async () => {
  render(<SystemMonitor />);

  expect(await screen.findByText('Daemon repository table')).toBeTruthy();
  expect(screen.queryByText(/REGISTERED DIRECTORIES/)).toBeNull();
  expect(screen.queryByText('Add Repository')).toBeNull();
  expect(screen.queryByText('Build Tree')).toBeNull();
  expect(screen.queryByText('Get Packages')).toBeNull();
  expect(RepositoryMonitoringService.onGitStatusChanged).not.toHaveBeenCalled();
  expect(RepositoryMonitoringService.getFileTree).not.toHaveBeenCalled();
  expect(RepositoryMonitoringService.getPackages).not.toHaveBeenCalled();
});
