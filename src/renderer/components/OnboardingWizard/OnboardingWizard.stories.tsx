import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { OnboardingWizard } from './OnboardingWizard';
import type { UserPreferences } from '../../../shared/types/userPreferences.types';

// Mock FileSystemService for Storybook
const createMockFileSystemService = () => {
  const mockFolders = [
    { name: 'Developer', path: '/Users/demo/Developer', category: 'dev' as const, selected: true },
    { name: 'Code', path: '/Users/demo/Code', category: 'dev' as const, selected: true },
    { name: 'Projects', path: '/Users/demo/Projects', category: 'dev' as const, selected: true },
    { name: 'Documents', path: '/Users/demo/Documents', category: 'common' as const, selected: false },
    { name: 'Desktop', path: '/Users/demo/Desktop', category: 'common' as const, selected: false },
    { name: 'Downloads', path: '/Users/demo/Downloads', category: 'system' as const, selected: false },
    { name: 'Music', path: '/Users/demo/Music', category: 'system' as const, selected: false },
    { name: 'Pictures', path: '/Users/demo/Pictures', category: 'system' as const, selected: false },
  ];

  const mockRepos = [
    { path: '/Users/demo/Developer/my-app', name: 'my-app', owner: 'johndoe' },
    { path: '/Users/demo/Developer/react-project', name: 'react-project', owner: 'acme' },
    { path: '/Users/demo/Code/electron-app', name: 'electron-app', owner: 'company' },
    { path: '/Users/demo/Code/api-server', name: 'api-server', owner: 'backend-team' },
    { path: '/Users/demo/Projects/mobile-app', name: 'mobile-app', owner: 'mobile' },
  ];

  return {
    getTopLevelFolders: async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockFolders;
    },
    scanFoldersForRepos: async (_folderPaths: string[]): Promise<{ success: boolean; repos: Array<{ path: string; name: string; owner?: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>; error?: string }> => {
      // Simulate scanning with progress
      return new Promise((resolve) => {
        setTimeout(() => {
          // Simulate different registration states
          const reposWithStatus = mockRepos.map((repo, idx) => {
            if (idx === 0) {
              // First repo: already registered
              return {
                ...repo,
                registered: true,
                alreadyRegistered: true
              };
            } else if (idx === 2) {
              // Third repo: registration failed
              return {
                ...repo,
                registered: false,
                registrationError: 'Failed to access repository directory'
              };
            } else {
              // Others: newly registered
              return {
                ...repo,
                registered: true,
                alreadyRegistered: false
              };
            }
          });
          resolve({
            success: true,
            repos: reposWithStatus
          });
        }, 3000); // 3 second simulated scan
      });
    },
    onRepoScanProgress: (callback: (progress: { current: number; total: number; currentFolder: string; foundRepos: number }) => void) => {
      // Simulate progress updates
      let current = 0;
      const folders = ['Developer', 'Code', 'Projects'];

      const interval = setInterval(() => {
        if (current < folders.length) {
          callback({
            current: current + 1,
            total: folders.length,
            currentFolder: folders[current],
            foundRepos: Math.min(current + 2, mockRepos.length)
          });
          current++;
        } else {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  };
};

// Mock GitHub CLI check for Storybook (mirrors AuthService.check())
const createMockGitHubCliService = ({
  configured,
  source = 'gh-cli',
}: {
  configured: boolean;
  source?: 'gh-cli' | 'stored-token';
}) => ({
  check: async () => {
    // Small delay so the loading state is visible
    await new Promise(resolve => setTimeout(resolve, 600));
    if (!configured) {
      return { authenticated: false, user: null };
    }
    return {
      authenticated: true,
      source,
      user: {
        login: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
      },
    };
  },
});

// Mock user preferences for Storybook (mirrors UserPreferencesService)
const createMockPreferencesService = (baseDefaultDirectory?: string) => ({
  getPreferences: async (): Promise<UserPreferences> =>
    baseDefaultDirectory ? { baseDefaultDirectory } : {},
  updatePreferences: async (
    _updates: Partial<UserPreferences>,
  ): Promise<void> => undefined,
});

// Mock skill installer for Storybook (mirrors the shared skill catalog)
const createMockSkillInstaller = ({
  alreadyInstalled = [] as string[],
}: {
  alreadyInstalled?: string[];
} = {}) => ({
  getInstalledSkillNames: async (): Promise<Set<string>> =>
    new Set(alreadyInstalled),
  installSkills: async (
    skills: ReadonlyArray<{ name: string }>,
  ): Promise<{ installed: string[]; failures: string[] }> => {
    await new Promise(resolve => setTimeout(resolve, 900));
    return { installed: skills.map(skill => skill.name), failures: [] };
  },
});

const meta: Meta<typeof OnboardingWizard> = {
  title: 'Experimental/OnboardingWizard',
  component: OnboardingWizard,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    )
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Experimental onboarding wizard for setting up git, repositories, and checking the GitHub CLI session. Focus on copy and flow before adding animations and polish.'
      }
    }
  },
  argTypes: {
    initialStep: {
      control: 'select',
      options: ['welcome', 'git-config', 'home-directory', 'choose-method', 'folder-selection', 'scanning', 'github-cli', 'skills', 'ready'],
      description: 'Jump straight to a step (story/debug aid)'
    },
    onComplete: {
      action: 'onboarding-completed'
    }
  }
};

export default meta;
type Story = StoryObj<typeof OnboardingWizard>;

/**
 * Default onboarding flow: git config, clone directory, then pick how to add local projects.
 */
export const Default: Story = {
  args: {
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  }
};

/**
 * Default clone directory step — chooses the folder future repos are cloned into.
 */
export const CloneDirectory: Story = {
  args: {
    initialStep: 'home-directory',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService('/Users/demo/Code'),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'The example line under the input previews the resulting path, e.g. ~/Development/octocat/hello-world, and follows the directory name you type.'
      }
    }
  }
};

/**
 * Pick how to add local projects — automatic scan or skip for now.
 */
export const ChooseMethod: Story = {
  args: {
    initialStep: 'choose-method',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Only two paths remain: scan folders for git projects, or skip and add them later.'
      }
    }
  }
};

/**
 * Interactive variant where you can test the complete flow
 */
export const Interactive: Story = {
  args: {
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
    onComplete: (data) => {
      alert(`Onboarding complete!\n\nMultiple locations: ${data.hasMultipleLocations}\nGitHub CLI configured: ${data.githubCliConfigured}\nGitHub login: ${data.githubLogin ?? 'none'}`);
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Full interactive version - go through the entire flow and see the completion data in the console.'
      }
    }
  }
};

/**
 * Test the scanning flow with simulated progress
 */
export const ScanningFlow: Story = {
  args: {
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Simulates the full scanning experience with progress updates and discovered repositories. Choose "Automatic" to test the scan flow.'
      }
    }
  }
};

/**
 * Install Skills step — topic skills preselected, everything optional.
 */
export const Skills: Story = {
  args: {
    initialStep: 'skills',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Installs catalog skills from GitHub. Every skill starts checked (uncheck any you do not want); the install button reports per-skill progress and failures, and Continue works whether or not anything is installed.'
      }
    }
  }
};

/**
 * Install Skills step where some skills already exist in the lock file.
 */
export const SkillsAlreadyInstalled: Story = {
  args: {
    initialStep: 'skills',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller({
      alreadyInstalled: ['create-topic', 'topic-context'],
    }),
  },
  parameters: {
    docs: {
      description: {
        story: 'Already-installed skills are checked, disabled, and marked with a check; the rest stay selected so one click installs what is missing.'
      }
    }
  }
};

/**
 * GitHub CLI step when gh is signed in — shows the detected account.
 */
export const GitHubCliConnected: Story = {
  args: {
    initialStep: 'github-cli',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'The step only checks the session: when gh is signed in it shows the GitHub account that Principal will use.'
      }
    }
  }
};

/**
 * GitHub CLI step when gh is missing — instructions plus a non-blocking skip.
 */
export const GitHubCliMissing: Story = {
  args: {
    initialStep: 'github-cli',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: false }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'When no CLI session is found the step explains `gh auth login` and the user can continue anyway.'
      }
    }
  }
};

/**
 * GitHub CLI step when the app only has a saved token (gh not signed in).
 */
export const GitHubCliSavedToken: Story = {
  args: {
    initialStep: 'github-cli',
    fileSystemService: createMockFileSystemService(),
    githubCliService: createMockGitHubCliService({ configured: true, source: 'stored-token' }),
    preferencesService: createMockPreferencesService(),
    skillInstaller: createMockSkillInstaller(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Account details still render, with a note that the token came from saved credentials rather than the CLI.'
      }
    }
  }
};
