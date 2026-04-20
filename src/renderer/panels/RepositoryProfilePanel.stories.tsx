import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEventEmitter,
  PanelEvent,
} from '@principal-ade/panel-framework-core';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import { RepositoryProfilePanel } from './RepositoryProfilePanel';
import type {
  RepositoryProfileData,
  RepositoryProfilePanelActions,
  RepositoryProfilePanelContext,
} from './RepositoryProfilePanel';

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

// Generate mock file tree using PathsFileTreeBuilder
const createMockFileTree = (repoName: string): FileTree => {
  // Create a realistic TypeScript project structure
  const files = [
    `${repoName}/src/index.ts`,
    `${repoName}/src/app.ts`,
    `${repoName}/src/components/Button.tsx`,
    `${repoName}/src/components/Input.tsx`,
    `${repoName}/src/components/Modal.tsx`,
    `${repoName}/src/utils/helpers.ts`,
    `${repoName}/src/utils/validation.ts`,
    `${repoName}/src/hooks/useData.ts`,
    `${repoName}/src/hooks/useAuth.ts`,
    `${repoName}/src/styles/globals.css`,
    `${repoName}/src/styles/components.css`,
    `${repoName}/tests/app.test.ts`,
    `${repoName}/tests/components/Button.test.tsx`,
    `${repoName}/tests/utils/helpers.test.ts`,
    `${repoName}/docs/README.md`,
    `${repoName}/docs/CONTRIBUTING.md`,
    `${repoName}/package.json`,
    `${repoName}/tsconfig.json`,
    `${repoName}/README.md`,
    `${repoName}/.gitignore`,
  ];

  const builder = new PathsFileTreeBuilder();
  const fileTree = builder.build({
    files,
    rootPath: repoName,
  });

  // Return the FileTree object with all metadata
  return fileTree;
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
    ownerType: 'User',
    description: 'A really awesome project that does amazing things. Built with TypeScript, React, and love.',
    language: 'TypeScript',
    stars: 1247,
    forks: 234,
    watchers: 87,
    openIssues: 42,
    size: 5432, // KB
    activityData: generateMockActivityData('medium'),
    totalCommits: 892,
    contributors: 24,
    defaultBranch: 'main',
    createdAt: '2021-03-15T10:30:00Z',
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    htmlUrl: 'https://github.com/octocat/awesome-project',
    isPrivate: false,
    github: {
      owner: 'octocat',
      name: 'awesome-project',
    },
  };

  return { ...defaultProfile, ...overrides };
};

// Create mock actions
const createMockActions = (
  options: {
    localFileTree?: FileTree | null;
    remoteFileTree?: FileTree | null;
    lineCounts?: Record<string, number>;
    simulateDelay?: number;
    simulateError?: boolean;
    watchedReposRef?: React.MutableRefObject<Set<string>>;
  } = {}
): RepositoryProfilePanelActions => {
  const {
    localFileTree,
    remoteFileTree,
    lineCounts = {},
    simulateDelay = 500,
    simulateError = false,
    watchedReposRef,
  } = options;

  return {
    openFile: async () => {},
    openRepository: async () => {},
    getLocalFileTree: async (repoPath: string) => {
      console.info('[Mock Action] getLocalFileTree:', repoPath);
      if (simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, simulateDelay));
      }
      if (simulateError) {
        return Promise.reject({ message: 'Failed to load local file tree', name: 'Error' });
      }
      return localFileTree ?? createMockFileTree(repoPath.split('/').pop() || 'repo');
    },
    getRemoteFileTree: async (owner: string, name: string) => {
      console.info('[Mock Action] getRemoteFileTree:', owner, name);
      if (simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, simulateDelay));
      }
      return remoteFileTree ?? createMockFileTree(name);
    },
    getLineCounts: async (repoPath: string) => {
      console.info('[Mock Action] getLineCounts:', repoPath);
      if (simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, simulateDelay / 2));
      }
      return lineCounts;
    },
    isRepositoryWatched: async (owner: string, repo: string) => {
      console.info('[Mock Action] isRepositoryWatched:', owner, repo);
      if (simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const repoKey = `${owner}/${repo}`;
      return watchedReposRef?.current.has(repoKey) ?? false;
    },
    watchRepository: async (owner: string, repo: string) => {
      console.info('[Mock Action] watchRepository:', owner, repo);
      if (simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      const repoKey = `${owner}/${repo}`;
      if (watchedReposRef) {
        watchedReposRef.current.add(repoKey);
      }
    },
    unwatchRepository: async (owner: string, repo: string) => {
      console.info('[Mock Action] unwatchRepository:', owner, repo);
      if (simulateDelay) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      const repoKey = `${owner}/${repo}`;
      if (watchedReposRef) {
        watchedReposRef.current.delete(repoKey);
      }
    },
  };
};

// Mock panel wrapper component
const MockRepositoryProfilePanel: React.FC<{
  repositoryData?: RepositoryProfileData;
  actions?: RepositoryProfilePanelActions;
}> = ({ repositoryData, actions: customActions }) => {
  // Track watched repos in ref for interactive demo
  const watchedReposRef = React.useRef<Set<string>>(new Set());

  const mockContext: RepositoryProfilePanelContext = {
    currentScope: repositoryData
      ? {
          type: 'repository',
          repository: repositoryData,
        }
      : {
          type: 'global',
        },
    isSliceLoading: () => false,
    refresh: async () => {},
    clearSlice: () => {},
  } as unknown as RepositoryProfilePanelContext;

  const mockActions = customActions || createMockActions({
    localFileTree: repositoryData?.localClones?.[0]?.path ? createMockFileTree(repositoryData.name) : null,
    remoteFileTree: repositoryData?.github ? createMockFileTree(repositoryData.name) : null,
    lineCounts: {
      [`${repositoryData?.name}/src/index.ts`]: 45,
      [`${repositoryData?.name}/src/app.ts`]: 128,
      [`${repositoryData?.name}/src/components/Button.tsx`]: 32,
      [`${repositoryData?.name}/src/components/Input.tsx`]: 56,
      [`${repositoryData?.name}/tests/app.test.ts`]: 89,
    },
    watchedReposRef,
  });

  const mockEvents = new MockEventEmitter();

  // Listen to events
  React.useEffect(() => {
    const unsubscribers = [
      mockEvents.on('repository-profile:open-requested', (event) => {
        console.info('[Mock Event Handler] Open repository requested:', event.payload);
      }),
      mockEvents.on('repository-profile:delete-requested', (event) => {
        console.info('[Mock Event Handler] Delete repository requested:', event.payload);
      }),
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [mockEvents]);

  return (
    <RepositoryProfilePanel
      context={mockContext}
      actions={mockActions}
      events={mockEvents}
    />
  );
};

// Wrapper with theme provider
const RepositoryProfilePanelStory: React.FC<{
  repositoryData?: RepositoryProfileData;
  actions?: RepositoryProfilePanelActions;
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
// @ts-ignore - Storybook typing quirk with complex component props
type Story = StoryObj<typeof meta>;

// Default story with complete profile
export const Default = {
  render: () => <RepositoryProfilePanelStory repositoryData={createMockRepositoryProfile()} />,
} as unknown as Story;

// Local repository (has local path and GitHub)
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
        localClones: [{ path: '/Users/johndoe/projects/my-local-project', addedAt: Date.now() }],
        activityData: generateMockActivityData('high'),
        stars: 23,
        forks: 4,
        totalCommits: 342,
        contributors: 3,
        github: {
          owner: 'johndoe',
          name: 'my-local-project',
        },
      })}
    />
  ),
} as unknown as Story;

// Remote-only repository (no local path)
export const RemoteOnly = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'remote-framework',
        fullName: 'bigtech/remote-framework',
        owner: 'bigtech',
        description: 'A framework I want to explore. Not cloned locally yet.',
        language: 'JavaScript',
        isLocal: false,
        localClones: undefined,
        activityData: generateMockActivityData('high'),
        stars: 12456,
        forks: 2134,
        totalCommits: 15234,
        github: {
          owner: 'bigtech',
          name: 'remote-framework',
        },
      })}
      actions={createMockActions({
        localFileTree: null, // No local file tree
        remoteFileTree: createMockFileTree('remote-framework'),
      })}
    />
  ),
} as unknown as Story;

// Local-only repository (no GitHub info)
export const LocalOnly = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'private-project',
        fullName: 'me/private-project',
        owner: 'me',
        description: 'A private local project, not on GitHub.',
        language: 'Python',
        isLocal: true,
        localClones: [{ path: '/Users/me/private-project', addedAt: Date.now() }],
        activityData: generateMockActivityData('medium'),
        stars: 0,
        forks: 0,
        totalCommits: 156,
        htmlUrl: undefined,
        github: undefined,
      })}
      actions={createMockActions({
        localFileTree: createMockFileTree('private-project'),
        remoteFileTree: null, // No remote file tree
      })}
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
        contributors: 487,
        size: 45678,
        github: {
          owner: 'framework-org',
          name: 'super-framework',
        },
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
        github: {
          owner: 'newdev',
          name: 'starter-kit',
        },
      })}
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
        github: {
          owner: 'acme-corp',
          name: 'company-secrets',
        },
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
        github: {
          owner: 'bigtech',
          name: 'monorepo',
        },
      })}
    />
  ),
} as unknown as Story;

// Loading state (slow file tree fetching)
export const SlowLoading = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile()}
      actions={createMockActions({
        simulateDelay: 3000, // 3 second delay
      })}
    />
  ),
} as unknown as Story;

// Error state (failed to load file trees)
export const Error = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile()}
      actions={createMockActions({
        simulateError: true,
      })}
    />
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
        ownerType: 'Organization',
        description: 'The official desktop application for Principal ADE. Built with Electron, React, and TypeScript. Provides a powerful development environment with AI assistance.',
        language: 'TypeScript',
        activityData: generateMockActivityData('high'),
        stars: 3421,
        forks: 456,
        watchers: 234,
        totalCommits: 5678,
        contributors: 12,
        size: 34567,
        openIssues: 89,
        htmlUrl: 'https://github.com/principal-ade/desktop-app',
        isLocal: true,
        localClones: [{ path: '/Users/dev/principal-ade/desktop-app', addedAt: Date.now() }],
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        github: {
          owner: 'principal-ade',
          name: 'desktop-app',
        },
      })}
    />
  ),
} as unknown as Story;

// Repository with multiple clones
export const MultipleClones = {
  render: () => (
    <RepositoryProfilePanelStory
      repositoryData={createMockRepositoryProfile({
        name: 'multi-clone-repo',
        fullName: 'dev/multi-clone-repo',
        owner: 'dev',
        description: 'A repository cloned to multiple locations on this machine.',
        language: 'TypeScript',
        isLocal: true,
        localClones: [
          { path: '/Users/dev/work/multi-clone-repo', addedAt: Date.now() - 1000000 },
          { path: '/Users/dev/personal/multi-clone-repo', addedAt: Date.now() - 500000 },
          { path: '/Users/dev/experiments/multi-clone-repo', addedAt: Date.now() },
        ],
        activityData: generateMockActivityData('high'),
        stars: 42,
        forks: 8,
        totalCommits: 287,
        contributors: 5,
        htmlUrl: 'https://github.com/dev/multi-clone-repo',
        github: {
          owner: 'dev',
          name: 'multi-clone-repo',
        },
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
        github: {
          owner: 'rustacean',
          name: 'blazing-fast-cli',
        },
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
        github: {
          owner: 'gopher-inc',
          name: 'cloud-orchestrator',
        },
      })}
    />
  ),
} as unknown as Story;
