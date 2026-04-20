import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { OnboardingWizard } from './OnboardingWizard';

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
    scanFoldersForRepos: async (_folderPaths: string[]): Promise<{ success: boolean; repos: Array<{ path: string; name: string; owner?: string }>; error?: string }> => {
      // Simulate scanning with progress
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            repos: mockRepos
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
    },
    selectDirectory: async (_options?: { title?: string; buttonLabel?: string; properties?: Array<'openDirectory' | 'createDirectory' | 'promptToCreate'> }) => {
      // Simulate folder selection dialog
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        filePaths: ['/Users/demo/Developer'],
        canceled: false
      };
    }
  };
};

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
        component: 'Experimental onboarding wizard for setting up repositories and GitHub connection. Focus on copy and flow before adding animations and polish.'
      }
    }
  },
  argTypes: {
    repoLocationMode: {
      control: 'select',
      options: ['single', 'multiple', 'add-list'],
      description: 'Different UX patterns for specifying repository locations'
    },
    onComplete: {
      action: 'onboarding-completed'
    }
  }
};

export default meta;
type Story = StoryObj<typeof OnboardingWizard>;

/**
 * Default onboarding flow with single folder selection and optional "I keep repos in different places" checkbox
 */
export const Default: Story = {
  args: {
    repoLocationMode: 'single',
    fileSystemService: createMockFileSystemService()
  }
};

/**
 * Allows users to add multiple repository paths with an "Add another folder" interface
 */
export const MultiplePathsList: Story = {
  args: {
    repoLocationMode: 'add-list',
    fileSystemService: createMockFileSystemService()
  },
  parameters: {
    docs: {
      description: {
        story: 'Users can add multiple repository folders one at a time, with the ability to remove them individually.'
      }
    }
  }
};

/**
 * Interactive variant where you can test the complete flow
 */
export const Interactive: Story = {
  args: {
    repoLocationMode: 'single',
    fileSystemService: createMockFileSystemService(),
    onComplete: (data) => {
      alert(`Onboarding complete!\n\nPaths: ${data.repoPaths.join(', ')}\nMultiple locations: ${data.hasMultipleLocations}\nGitHub connected: ${data.githubConnected}`);
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
 * Testing different copy variations for the repo location step
 */
export const CopyExperiments: Story = {
  args: {
    repoLocationMode: 'add-list',
    fileSystemService: createMockFileSystemService()
  },
  parameters: {
    docs: {
      description: {
        story: 'Use this to experiment with different copy variations. The current copy aims for a friendly, conversational tone.'
      }
    }
  }
};

/**
 * Test the scanning flow with simulated progress
 */
export const ScanningFlow: Story = {
  args: {
    repoLocationMode: 'single',
    fileSystemService: createMockFileSystemService()
  },
  parameters: {
    docs: {
      description: {
        story: 'Simulates the full scanning experience with progress updates and discovered repositories. Choose "Find for me" to test the scan flow.'
      }
    }
  }
};
