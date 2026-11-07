import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import {
  DEFAULT_SIDEBAR_NAVIGATION_ORDER,
  resolveSidebarNavigationOrder,
} from '../../../components/IntegratedShell/sidebarNavigation';
import { SidebarNavigationSettings } from './SidebarNavigationSettings';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({ theme: { colors: {} } }),
}));
jest.mock('../../../../main-process-api/UserPreferencesService');

beforeEach(() => {
  jest.clearAllMocks();
  (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({});
  (UserPreferencesService.updatePreferences as jest.Mock).mockResolvedValue(
    undefined,
  );
  (UserPreferencesService.onPreferencesUpdated as jest.Mock).mockReturnValue(
    () => {},
  );
});

test('sidebar navigation order appends new entries and ignores invalid ids', () => {
  expect(
    resolveSidebarNavigationOrder(['topics', 'not-a-view', 'topics']),
  ).toEqual([
    'topics',
    ...DEFAULT_SIDEBAR_NAVIGATION_ORDER.filter((id) => id !== 'topics'),
  ]);
});

test('monitor and settings are fixed destinations, not configurable entries', () => {
  expect(
    resolveSidebarNavigationOrder(['settings', 'monitoring', 'topics']),
  ).toEqual([
    'topics',
    ...DEFAULT_SIDEBAR_NAVIGATION_ORDER.filter((id) => id !== 'topics'),
  ]);
});

test('changing item order persists the updated order', async () => {
  render(<SidebarNavigationSettings />);
  const moveProjectsDown = await screen.findByRole('button', {
    name: 'Move Projects down',
  });

  fireEvent.click(moveProjectsDown);

  expect(UserPreferencesService.updatePreferences).toHaveBeenCalledWith({
    sidebarNavigation: {
      order: [
        'home-panel',
        'topics',
        'projects',
        ...DEFAULT_SIDEBAR_NAVIGATION_ORDER.slice(3),
      ],
      visibility: {},
    },
  });
});

test('changing item visibility persists without hiding other default items', async () => {
  render(<SidebarNavigationSettings />);
  expect(
    screen.queryByRole('checkbox', { name: 'Show Monitor in sidebar' }),
  ).toBeNull();
  expect(
    screen.queryByRole('checkbox', { name: 'Show Settings in sidebar' }),
  ).toBeNull();
  const tutorialsVisibility = (await screen.findByRole('checkbox', {
    name: 'Show Tutorials in sidebar',
  })) as HTMLInputElement;

  expect(tutorialsVisibility.checked).toBe(false);
  fireEvent.click(tutorialsVisibility);

  expect(UserPreferencesService.updatePreferences).toHaveBeenCalledWith({
    sidebarNavigation: {
      order: DEFAULT_SIDEBAR_NAVIGATION_ORDER,
      visibility: { onboarding: true },
    },
  });
});
