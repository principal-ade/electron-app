import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
} from '@principal-ade/panel-framework-core';
import { RepositoryProfilePanel } from './RepositoryProfilePanel';
import type { RepositoryProfileData } from './RepositoryProfilePanel';

// Mock event emitter for stories
type EventHandler = (event: PanelEvent<unknown>) => void;

class MockEventEmitter implements PanelEventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  emit<T>(event: PanelEvent<T>): void {
    console.info('[Mock Event]:', event);
    const eventListeners = this.listeners.get(event.type) || [];
    eventListeners.forEach((listener) => listener(event as PanelEvent<unknown>));
  }

  on<T>(eventType: string, handler: (event: PanelEvent<T>) => void): () => void {
    const listeners = this.listeners.get(eventType) || [];
    const wrappedHandler = handler as EventHandler;
    listeners.push(wrappedHandler);
    this.listeners.set(eventType, listeners);

    return () => {
      const currentListeners = this.listeners.get(eventType) || [];
      const index = currentListeners.indexOf(wrappedHandler);
      if (index > -1) {
        currentListeners.splice(index, 1);
      }
    };
  }

  off<T>(eventType: string, handler: (event: PanelEvent<T>) => void): void {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(handler as EventHandler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}

// Generate mock activity data for heatmap (full year - 365 days)
const generateMockActivityData = (intensity: 'low' | 'medium' | 'high' = 'medium'): Map<string, number> => {
  const activityMap = new Map<string, number>();
  const today = new Date();
  const daysToGenerate = 365; // Full year

  const maxCommits = intensity === 'low' ? 5 : intensity === 'medium' ? 15 : 30;

  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    // Random activity with some patterns
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseChance = isWeekend ? 0.3 : 0.7;

    // Add some seasonal variation
    const monthOfYear = date.getMonth();
    const isHolidaySeason = monthOfYear === 11 || monthOfYear === 0; // December or January
    const seasonalMultiplier = isHolidaySeason ? 0.5 : 1.0;

    if (Math.random() < baseChance * seasonalMultiplier) {
      const commits = Math.floor(Math.random() * maxCommits) + 1;
      activityMap.set(dateKey, commits);
    }
  }

  return activityMap;
};

// Generate mock repository profile data
const createMockRepositoryProfile = (
  overrides: Partial<RepositoryProfileData> = {}
): RepositoryProfileData => {
  const defaultProfile: RepositoryProfileData = {
    name: 'awesome-project',
    fullName: 'octocat/awesome-project',
    owner: 'octocat',
    ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
    description: 'A really awesome project that does amazing things. Built with TypeScript, React, and love.',
    language: 'TypeScript',
    stars: 1247,
    forks: 234,
    watchers: 87,
    openIssues: 42,
    size: 5432, // KB
    activityData: generateMockActivityData('medium'),
    totalCommits: 892,
    defaultBranch: 'main',
    createdAt: '2021-03-15T10:30:00Z',
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    htmlUrl: 'https://github.com/octocat/awesome-project',
    isPrivate: false,
    fileCityImageUrl: 'https://placehold.co/800x600/1a1a1a/3b82f6?text=File+City+Visualization',
  };

  return { ...defaultProfile, ...overrides };
};

// Mock panel wrapper component
const MockRepositoryProfilePanel: React.FC<{
  repositoryData?: RepositoryProfileData;
  loading?: boolean;
  error?: string;
  onOpenRepository?: () => void;
  onDeleteRepository?: () => void;
}> = ({ repositoryData, loading = false, error, onOpenRepository, onDeleteRepository }) => {
  const mockContext: PanelContextValue = {
    currentScope: {
      type: 'global',
    },
    isSliceLoading: () => loading,
    refresh: async () => {},
    clearSlice: () => {},
  } as unknown as PanelContextValue;

  const mockActions: PanelActions = {
    openFile: async () => {},
    openRepository: async () => {},
  } as unknown as PanelActions;

  const mockEvents = new MockEventEmitter();

  return (
    <RepositoryProfilePanel
      context={mockContext}
      actions={mockActions}
      events={mockEvents}
      repositoryData={repositoryData}
      loading={loading}
      error={error}
      onOpenRepository={onOpenRepository}
      onDeleteRepository={onDeleteRepository}
    />
  );
};

// Wrapper with theme provider
const RepositoryProfilePanelStory: React.FC<{
  repositoryData?: RepositoryProfileData;
  loading?: boolean;
  error?: string;
  onOpenRepository?: () => void;
  onDeleteRepository?: () => void;
}> = (props) => {
  return (
    <ThemeProvider>
      <MockRepositoryProfilePanel {...props} />
    </ThemeProvider>
  );
};

const meta: Meta<typeof RepositoryProfilePanel> = {
  title: 'Panels/RepositoryProfilePanel',
  component: RepositoryProfilePanel,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a1a' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '100vw', height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', height: '100%' }}>
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with complete profile
export const Default = {
  render: () => <RepositoryProfilePanelStory repositoryData={createMockRepositoryProfile()} />,
} as unknown as Story;

// Local repository with Open and Delete buttons
export const LocalRepository = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'my-local-project',
        fullName: 'johndoe/my-local-project',
        owner: 'johndoe',
        description: 'A local development project on my machine. Synced with GitHub.',
        language: 'TypeScript',
        isLocal: true,
        localPath: '/Users/johndoe/projects/my-local-project',
        activityData: generateMockActivityData('high'),
        stars: 23,
        forks: 4,
        totalCommits: 342,
      })}
      onOpenRepository={() => console.info('[Story] Open repository clicked')}
      onDeleteRepository={() => console.info('[Story] Delete repository clicked')}
    />
  ),
} as unknown as Story;

// Popular repository with high activity
export const HighActivity = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'super-framework',
        fullName: 'framework-org/super-framework',
        owner: 'framework-org',
        description: 'The most powerful web framework in the universe. Used by millions of developers worldwide.',
        language: 'JavaScript',
        activityData: generateMockActivityData('high'),
        stars: 85432,
        forks: 12847,
        watchers: 3421,
        totalCommits: 15234,
        size: 45678,
      })}
    />
  ),
} as unknown as Story;

// Minimal repository (new project, low activity)
export const MinimalRepository = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'starter-kit',
        fullName: 'newdev/starter-kit',
        owner: 'newdev',
        ownerAvatarUrl: undefined,
        description: undefined,
        language: 'Python',
        activityData: generateMockActivityData('low'),
        stars: 12,
        forks: 3,
        watchers: 5,
        totalCommits: 42,
        size: 234,
        openIssues: 2,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      })}
    />
  ),
} as unknown as Story;

// Local repository without callbacks (buttons disabled)
export const LocalRepositoryNoCallbacks = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'test-project',
        fullName: 'dev/test-project',
        owner: 'dev',
        description: 'A test project with disabled actions.',
        language: 'JavaScript',
        isLocal: true,
        localPath: '/Users/dev/test-project',
        activityData: generateMockActivityData('medium'),
        stars: 0,
        forks: 0,
        totalCommits: 156,
      })}
      // No callbacks provided - buttons will be disabled
    />
  ),
} as unknown as Story;

// Private repository
export const PrivateRepository = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'company-secrets',
        fullName: 'acme-corp/company-secrets',
        owner: 'acme-corp',
        description: 'Internal tools and utilities for the ACME Corporation.',
        language: 'TypeScript',
        isPrivate: true,
        activityData: generateMockActivityData('medium'),
        stars: 0,
        watchers: 12,
        htmlUrl: undefined,
      })}
    />
  ),
} as unknown as Story;

// Large monorepo
export const LargeMonorepo = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'monorepo',
        fullName: 'bigtech/monorepo',
        owner: 'bigtech',
        description: 'Our entire codebase in one giant repository. Contains 500+ packages and services.',
        language: 'TypeScript',
        activityData: generateMockActivityData('high'),
        stars: 234,
        forks: 89,
        watchers: 156,
        totalCommits: 45678,
        size: 2048000, // 2GB
        openIssues: 567,
      })}
    />
  ),
} as unknown as Story;

// Repository with long description
export const LongDescription = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        description: 'This is a comprehensive library for building modern web applications. It includes support for React, Vue, Angular, and Svelte. Features include state management, routing, form validation, API integration, authentication, internationalization, and much more. Built with performance and developer experience in mind.',
        activityData: generateMockActivityData('medium'),
      })}
    />
  ),
} as unknown as Story;

// Repository without owner avatar
export const NoOwnerAvatar = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        ownerAvatarUrl: undefined,
        name: 'cool-library',
        fullName: 'johndoe/cool-library',
        owner: 'johndoe',
      })}
    />
  ),
} as unknown as Story;

// With File City Image and Latest Commit
export const WithFileCityImage = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'web-framework',
        fullName: 'acme/web-framework',
        owner: 'acme',
        description: 'A modern web framework with built-in File City visualization.',
        language: 'TypeScript',
        stars: 5432,
        totalCommits: 2847,
        openIssues: 67,
        fileCityImageUrl: 'https://placehold.co/800x600/1a1a1a/3b82f6?text=File+City+Visualization',
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      })}
    />
  ),
} as unknown as Story;

// Loading state
export const Loading = {
  render: () => <RepositoryProfilePanelStory loading={true} />,
} as unknown as Story;

// Error state
export const Error = {
  render: () => (
    <RepositoryProfilePanelStory error="Failed to load repository profile. Please try again." />
  ),
} as unknown as Story;

// Empty state - no repository selected
export const Empty = {
  render: () => <RepositoryProfilePanelStory />,
} as unknown as Story;

// Complete profile with all features
export const CompleteProfile = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'desktop-app',
        fullName: 'principal-ade/desktop-app',
        owner: 'principal-ade',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/12345?v=4',
        description: 'The official desktop application for Principal ADE. Built with Electron, React, and TypeScript. Provides a powerful development environment with AI assistance.',
        language: 'TypeScript',
        activityData: generateMockActivityData('high'),
        stars: 3421,
        forks: 456,
        watchers: 234,
        totalCommits: 5678,
        size: 34567,
        openIssues: 89,
        htmlUrl: 'https://github.com/principal-ade/desktop-app',
        fileCityImageUrl: 'https://placehold.co/800x600/1a1a1a/3b82f6?text=File+City+Visualization',
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      })}
    />
  ),
} as unknown as Story;

// Rust project
export const RustProject = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'blazing-fast-cli',
        fullName: 'rustacean/blazing-fast-cli',
        owner: 'rustacean',
        description: 'A blazingly fast command-line tool written in Rust. Zero dependencies, maximum performance.',
        language: 'Rust',
        activityData: generateMockActivityData('medium'),
        stars: 8765,
        forks: 543,
      })}
    />
  ),
} as unknown as Story;

// Go project
export const GoProject = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'cloud-orchestrator',
        fullName: 'gopher-inc/cloud-orchestrator',
        owner: 'gopher-inc',
        description: 'Orchestrate cloud infrastructure with ease. Built for scale and reliability.',
        language: 'Go',
        activityData: generateMockActivityData('high'),
        stars: 12456,
        forks: 2134,
      })}
    />
  ),
} as unknown as Story;
