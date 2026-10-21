import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NavigationSidebar } from '../principal-window/components/IntegratedShell/NavigationSidebar';
import {
  PrincipalPortal,
  isWorkspaceView,
  WORKSPACE_VIEWS,
} from '../principal-window/components/PrincipalPortal';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    mode: 'dark',
    theme: {
      colors: {},
      fonts: { body: 'sans-serif' },
      fontSizes: [10, 12, 14],
      fontWeights: { semibold: 600, body: 400 },
      lineHeights: { tight: 1 },
    },
  }),
}));
jest.mock('../hooks/useProcessRegistry', () => ({
  useProcessRegistry: () => ({ entries: [] }),
}));
jest.mock('../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: { getPreferences: jest.fn(async () => ({})) },
}));
jest.mock('../main-process-api/GithubService', () => ({
  GithubService: { getUser: jest.fn() },
}));
jest.mock('../main-process-api/ShellService', () => ({
  ShellService: { openExternal: jest.fn() },
}));
jest.mock('../workspace-shell/WorkspaceShell', () => ({
  WorkspaceShell: ({ activeView }: { activeView: string }) => (
    <div data-testid="workspace-shell">{activeView}</div>
  ),
}));

test('Requests is always available in navigation and uses workspace navigation', async () => {
  const onViewChange = jest.fn();
  const onToggleLeftPanel = jest.fn();
  const { rerender } = render(
    <NavigationSidebar
      activeView="home-panel"
      onViewChange={onViewChange}
      leftPanelCollapsed={false}
      onToggleLeftPanel={onToggleLeftPanel}
    />,
  );
  await waitFor(() =>
    expect(UserPreferencesService.getPreferences).toHaveBeenCalled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Requests' }));
  expect(onViewChange).toHaveBeenCalledWith('requests');
  expect(onToggleLeftPanel).not.toHaveBeenCalled();
  rerender(
    <NavigationSidebar
      activeView="requests"
      onViewChange={onViewChange}
      leftPanelCollapsed={false}
      onToggleLeftPanel={onToggleLeftPanel}
    />,
  );
  const selected = screen.getByRole('button', { name: 'Requests' });
  expect(selected.className).toContain('active');
  fireEvent.click(selected);
  expect(onToggleLeftPanel).toHaveBeenCalledTimes(1);
});

test('entering Requests from a collapsed sidebar expands the left panel', async () => {
  const onViewChange = jest.fn();
  const onToggleLeftPanel = jest.fn();
  render(
    <NavigationSidebar
      activeView="projects"
      onViewChange={onViewChange}
      leftPanelCollapsed
      onToggleLeftPanel={onToggleLeftPanel}
    />,
  );
  await waitFor(() =>
    expect(UserPreferencesService.getPreferences).toHaveBeenCalled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Requests' }));
  expect(onToggleLeftPanel).toHaveBeenCalledTimes(1);
  expect(onViewChange).toHaveBeenCalledWith('requests');
});

test('Requests is a persistent portal surface, not a standalone overlay', () => {
  expect(isWorkspaceView('requests')).toBe(true);
  expect(WORKSPACE_VIEWS).toContain('requests');
  const props = {
    leftSidebarCollapsed: false,
    onLeftSidebarCollapsedChange: jest.fn(),
    selectedRepository: null,
    isRepositoryPanelActive: false,
    onOpenRepository: jest.fn(),
    onCloseRepository: jest.fn(),
  };
  const { rerender } = render(
    <PrincipalPortal {...props} workspaceView="home-panel" />,
  );
  const shell = screen.getByTestId('workspace-shell');
  rerender(<PrincipalPortal {...props} workspaceView="requests" />);
  expect(screen.getByTestId('workspace-shell')).toBe(shell);
  expect(shell.textContent).toBe('requests');
  rerender(<PrincipalPortal {...props} workspaceView="projects" />);
  expect(screen.getByTestId('workspace-shell')).toBe(shell);
});
