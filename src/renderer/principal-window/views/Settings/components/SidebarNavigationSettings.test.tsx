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
  const monitorVisibility = (await screen.findByRole('checkbox', {
    name: 'Show Monitor in sidebar',
  })) as HTMLInputElement;

  expect(monitorVisibility.checked).toBe(false);
  fireEvent.click(monitorVisibility);

  expect(UserPreferencesService.updatePreferences).toHaveBeenCalledWith({
    sidebarNavigation: {
      order: DEFAULT_SIDEBAR_NAVIGATION_ORDER,
      visibility: { monitoring: true },
    },
  });
});
