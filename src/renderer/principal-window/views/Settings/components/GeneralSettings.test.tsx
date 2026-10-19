import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { AppVersionManagerService } from '../../../../main-process-api/AppVersionManagerService';
import { GeneralSettings } from './GeneralSettings';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({ theme: { colors: {} } }),
}));
jest.mock('@principal-ai/logo-component', () => ({
  FileCityLogo: () => null,
}));
jest.mock('../../../../main-process-api/UserPreferencesService');
jest.mock('../../../../main-process-api/AppVersionManagerService');
jest.mock('../../../../main-process-api/AlexandriaService', () => ({
  AlexandriaService: { clearAllData: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (AppVersionManagerService.getVersion as jest.Mock).mockResolvedValue('1.2.3');
  (AppVersionManagerService.isDevMode as jest.Mock).mockResolvedValue(false);
  (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({});
  (UserPreferencesService.updatePreferences as jest.Mock).mockResolvedValue(
    undefined,
  );
});

async function settings() {
  render(<GeneralSettings />);
  await screen.findByText('Version 1.2.3');
  return screen.getByRole('checkbox', {
    name: 'Open localhost terminal links in an app tab',
  }) as HTMLInputElement;
}

test('localhost terminal links are opt-in and the checkbox persists the preference', async () => {
  const checkbox = await settings();
  expect(checkbox.checked).toBe(false);
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  expect(UserPreferencesService.updatePreferences).toHaveBeenCalledWith({
    openLocalhostTerminalLinksInApp: true,
  });
});

test('loads the saved setting and lets the user turn it off', async () => {
  (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({
    openLocalhostTerminalLinksInApp: true,
  });
  const checkbox = await settings();
  expect(checkbox.checked).toBe(true);
  fireEvent.click(checkbox);
  expect(UserPreferencesService.updatePreferences).toHaveBeenCalledWith({
    openLocalhostTerminalLinksInApp: false,
  });
});

test('reflects preference updates from another window', async () => {
  const checkbox = await settings();
  act(() =>
    window.dispatchEvent(
      new CustomEvent('user-preferences-updated', {
        detail: { openLocalhostTerminalLinksInApp: true },
      }),
    ),
  );
  expect(checkbox.checked).toBe(true);
});
