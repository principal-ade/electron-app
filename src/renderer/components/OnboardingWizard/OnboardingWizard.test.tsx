import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UserPreferences } from '../../../shared/types/userPreferences.types';
import { OnboardingWizard } from './OnboardingWizard';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: {},
      fontSizes: [12, 14, 16, 18, 20, 24, 32, 48, 64, 96],
    },
  }),
}));
jest.mock('@principal-ai/logo-component', () => ({
  FileCityLogo: () => null,
  FileCityLogoAnimated: () => null,
}));
jest.mock('../../main-process-api/GitService', () => ({
  GitService: { execCommand: jest.fn().mockResolvedValue({ stdout: '' }) },
}));

const HOME = '/Users/dev';

const fileSystemService = {
  getTopLevelFolders: jest.fn().mockResolvedValue([]),
  scanFoldersForRepos: jest.fn().mockResolvedValue({ success: true, repos: [] }),
  onRepoScanProgress: jest.fn().mockReturnValue(() => {}),
};

const githubCliService = {
  check: jest.fn().mockResolvedValue({ authenticated: false, user: null }),
};

const preferencesService = {
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
};

const skillInstaller = {
  getInstalledSkillNames: jest.fn(),
  installSkills: jest.fn(),
};

function renderWizard(initialStep: 'home-directory' | 'skills' = 'home-directory') {
  return render(
    <OnboardingWizard
      initialStep={initialStep}
      fileSystemService={fileSystemService}
      githubCliService={githubCliService}
      preferencesService={preferencesService}
      skillInstaller={skillInstaller}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.HOME = HOME;
  preferencesService.getPreferences.mockResolvedValue({} as UserPreferences);
  preferencesService.updatePreferences.mockResolvedValue(undefined);
  skillInstaller.getInstalledSkillNames.mockResolvedValue(new Set<string>());
  skillInstaller.installSkills.mockResolvedValue({
    installed: [],
    failures: [],
  });
});

test('prefills the clone directory from the saved base directory', async () => {
  preferencesService.getPreferences.mockResolvedValue({
    baseDefaultDirectory: `${HOME}/Code`,
  } as UserPreferences);

  renderWizard();

  await waitFor(() =>
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      'Code',
    ),
  );
});

test('continuing persists the base directory as an absolute path', async () => {
  renderWizard();

  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Projects' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() =>
    expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
      baseDefaultDirectory: `${HOME}/Projects`,
    }),
  );
});

test('falls back to the last path segment for directories outside home', async () => {
  preferencesService.getPreferences.mockResolvedValue({
    baseDefaultDirectory: '/Volumes/Work/Code',
  } as UserPreferences);

  renderWizard();

  await waitFor(() =>
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
      'Code',
    ),
  );
});

test('skills step selects every skill by default and installs them', async () => {
  const allNames = [
    'create-c4-sketch',
    'create-subsystem-model',
    'create-topic',
    'excalidraw-drawings',
    'file-city-tours',
    'principal-ai-desktop-app-tools',
    'topic-context',
  ];
  skillInstaller.installSkills.mockResolvedValue({
    installed: allNames,
    failures: [],
  });

  renderWizard('skills');

  const installButton = (await screen.findByRole('button', {
    name: /install 7 skills/i,
  })) as HTMLButtonElement;
  expect(installButton.disabled).toBe(false);

  fireEvent.click(installButton);

  await waitFor(() =>
    expect(skillInstaller.installSkills).toHaveBeenCalledTimes(1),
  );
  const installed = skillInstaller.installSkills.mock.calls[0][0] as Array<{
    name: string;
  }>;
  expect(installed.map(skill => skill.name).sort()).toEqual(allNames);

  // Installed rows lock in: nothing left to install.
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: /install 0 skills/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
});

test('skills step lists skills in catalog order', async () => {
  renderWizard('skills');

  const checkboxes = await screen.findAllByRole('checkbox');
  const rowText = (index: number) =>
    checkboxes[index].closest('label')?.textContent ?? '';

  expect(rowText(0)).toContain('Principal Desktop App Tools');
  expect(rowText(1)).toContain('Create Topic');
  expect(rowText(2)).toContain('C4 Sketches');
  expect(rowText(3)).toContain('Subsystem Models');
  expect(rowText(4)).toContain('Topic Context');
});

test('skills step locks rows that are already installed', async () => {
  skillInstaller.getInstalledSkillNames.mockResolvedValue(
    new Set(['create-topic', 'topic-context']),
  );

  renderWizard('skills');

  // The not-yet-installed skills stay selected.
  const installButton = (await screen.findByRole('button', {
    name: /install 5 skills/i,
  })) as HTMLButtonElement;
  expect(installButton.disabled).toBe(false);

  const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
  expect(checkboxes.every(box => (box as HTMLInputElement).checked)).toBe(true);
  const disabledBoxes = checkboxes.filter(box => (box as HTMLInputElement).disabled);
  expect(disabledBoxes).toHaveLength(2);
});

test('skills step reports a failed install without blocking the flow', async () => {
  skillInstaller.installSkills.mockResolvedValue({
    installed: [],
    failures: ['create-topic: rate limited'],
  });

  renderWizard('skills');

  fireEvent.click(
    await screen.findByRole('button', { name: /install 7 skills/i }),
  );

  expect(await screen.findByText('create-topic: rate limited')).toBeTruthy();
  // Continue is still available — installing is optional.
  expect(
    (screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
