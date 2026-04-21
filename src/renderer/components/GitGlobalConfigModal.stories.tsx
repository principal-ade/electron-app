import type { Meta, StoryObj } from '@storybook/react';
import { GitGlobalConfigModal } from './GitGlobalConfigModal';
import { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';

// Mock GitService for Storybook
const mockGitService = {
  execCommand: async (_directory: string, args: string[]) => {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (args[0] === '--version') {
      return {
        stdout: 'git version 2.42.0',
        stderr: '',
      };
    }

    if (args[0] === 'config' && args[1] === '--global' && args[2] === '--list') {
      // Return different configs based on story
      const scenario = (window as any).__STORYBOOK_GIT_SCENARIO__ || 'complete';

      if (scenario === 'error') {
        throw new Error('Git is not installed or not found in PATH');
      }

      if (scenario === 'incomplete') {
        return {
          stdout: `user.name=John Doe
core.editor=vim`,
          stderr: '',
        };
      }

      if (scenario === 'minimal') {
        return {
          stdout: '',
          stderr: '',
        };
      }

      // Complete configuration (use saved values if available)
      const savedName = (window as any).__STORYBOOK_GIT_USER_NAME__ || 'Jane Developer';
      const savedEmail = (window as any).__STORYBOOK_GIT_USER_EMAIL__ || 'jane.developer@example.com';

      return {
        stdout: `user.name=${savedName}
user.email=${savedEmail}
core.editor=code --wait
init.defaultBranch=main
credential.helper=osxkeychain
core.excludesfile=/Users/jane/.gitignore_global`,
        stderr: '',
      };
    }

    // Handle config set commands (for saving edits)
    if (args[0] === 'config' && args[1] === '--global' && args[2] === 'user.name') {
      (window as any).__STORYBOOK_GIT_USER_NAME__ = args[3];
      console.log('[Storybook Mock] Saved user.name:', args[3]);
      return { stdout: '', stderr: '' };
    }

    if (args[0] === 'config' && args[1] === '--global' && args[2] === 'user.email') {
      (window as any).__STORYBOOK_GIT_USER_EMAIL__ = args[3];
      console.log('[Storybook Mock] Saved user.email:', args[3]);
      return { stdout: '', stderr: '' };
    }

    return { stdout: '', stderr: '' };
  },
};

// Override GitService in window.mainProcess for Storybook
if (typeof window !== 'undefined') {
  (window as any).mainProcess = {
    ...(window as any).mainProcess,
    git: {
      execCommand: mockGitService.execCommand,
    },
  };
}

const meta = {
  title: 'Components/GitGlobalConfigModal',
  component: GitGlobalConfigModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A modal that displays global git configuration including user identity, default branch, editor, and credential settings.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GitGlobalConfigModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to handle modal state
const ModalWrapper = ({ scenario }: { scenario: string }) => {
  const [isOpen, setIsOpen] = useState(true);

  // Set scenario for mock
  if (typeof window !== 'undefined') {
    (window as any).__STORYBOOK_GIT_SCENARIO__ = scenario;
  }

  return (
    <ThemeProvider>
      <div>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Open Git Config Modal
        </button>
        <GitGlobalConfigModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </ThemeProvider>
  );
};

/**
 * Complete configuration with all fields populated.
 * This shows a healthy git setup with user identity, default branch, editor, and credentials configured.
 */
export const Complete: Story = {
  render: () => <ModalWrapper scenario="complete" />,
};

/**
 * Incomplete configuration missing required user.email.
 * Shows warning message with instructions on how to configure missing fields.
 */
export const Incomplete: Story = {
  render: () => <ModalWrapper scenario="incomplete" />,
  parameters: {
    docs: {
      description: {
        story: 'Missing user.email - shows alert and configuration instructions.',
      },
    },
  },
};

/**
 * Minimal configuration with no settings configured.
 * Shows what a fresh git installation looks like before any configuration.
 */
export const Minimal: Story = {
  render: () => <ModalWrapper scenario="minimal" />,
  parameters: {
    docs: {
      description: {
        story: 'No git configuration found - shows all fields as "Not configured".',
      },
    },
  },
};

/**
 * Error state when git is not available or commands fail.
 * Shows error message with helpful debugging information.
 */
export const Error: Story = {
  render: () => <ModalWrapper scenario="error" />,
  parameters: {
    docs: {
      description: {
        story: 'Git command failed - displays error message.',
      },
    },
  },
};

/**
 * Editable - demonstrates the edit functionality for user identity.
 * Click "Edit User Identity" to modify name and email, then save.
 */
export const Editable: Story = {
  render: () => <ModalWrapper scenario="complete" />,
  parameters: {
    docs: {
      description: {
        story: 'Click "Edit User Identity" button to modify name and email. Changes are saved with git config --global.',
      },
    },
  },
};

/**
 * Initially open state for testing the modal appearance.
 */
export const InitiallyOpen: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    if (typeof window !== 'undefined') {
      (window as any).__STORYBOOK_GIT_SCENARIO__ = 'complete';
    }

    return (
      <ThemeProvider>
        <GitGlobalConfigModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            // Reopen after 1 second for demo purposes
            setTimeout(() => setIsOpen(true), 1000);
          }}
        />
      </ThemeProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal that stays open for easier inspection. Automatically reopens when closed.',
      },
    },
  },
};
