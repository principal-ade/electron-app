import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { OnboardingWizard } from './OnboardingWizard';

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
    repoLocationMode: 'single'
  }
};

/**
 * Allows users to add multiple repository paths with an "Add another folder" interface
 */
export const MultiplePathsList: Story = {
  args: {
    repoLocationMode: 'add-list'
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
    repoLocationMode: 'add-list'
  },
  parameters: {
    docs: {
      description: {
        story: 'Use this to experiment with different copy variations. The current copy aims for a friendly, conversational tone.'
      }
    }
  }
};
