import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEventEmitter,
  PanelEvent,
} from '@principal-ade/panel-framework-core';
import {
  UserProfilePanel,
  type UserProfileData,
  type UserProfilePanelContext,
  type UserProfilePanelActions,
  type RecentCommitActivity,
  type ContributedRepository,
} from './UserProfilePanel';
import type { RepoCardData, Contributor } from './RepoCard';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import type { GitHubOrganization } from '../../shared/main-process-api-interfaces/GitHubAPI';

const mockUserOrgs: GitHubOrganization[] = [
  { id: 1, login: 'vercel',     avatar_url: 'https://avatars.githubusercontent.com/u/14985020?v=4', description: 'Vercel' },
  { id: 2, login: 'facebook',   avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',    description: 'Facebook' },
  { id: 3, login: 'microsoft',  avatar_url: 'https://avatars.githubusercontent.com/u/6154722?v=4',  description: 'Microsoft' },
  { id: 4, login: 'google',     avatar_url: 'https://avatars.githubusercontent.com/u/1342004?v=4',  description: 'Google' },
];

// Create mock file tree using PathsFileTreeBuilder
const createMockFileTree = (repoName: string): FileTree => {
  const files = [
    `${repoName}/src/index.ts`,
    `${repoName}/src/app.ts`,
    `${repoName}/src/components/Button.tsx`,
    `${repoName}/src/components/Input.tsx`,
    `${repoName}/src/utils/helpers.ts`,
    `${repoName}/src/hooks/useData.ts`,
    `${repoName}/src/styles/globals.css`,
    `${repoName}/tests/app.test.ts`,
    `${repoName}/package.json`,
    `${repoName}/tsconfig.json`,
    `${repoName}/README.md`,
  ];

  const builder = new PathsFileTreeBuilder();
  return builder.build({ files, rootPath: repoName });
};

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

// Generate mock recent commits (last 24 hours)
const generateMockRecentCommits = (username: string, count: number = 3): RecentCommitActivity[] => {
  const repos = [
    { name: 'awesome-project', owner: username },
    { name: 'cli-tool', owner: username },
    { name: 'web-framework', owner: username },
    { name: 'data-pipeline', owner: username },
    { name: 'api-server', owner: 'some-org' },
  ];

  const now = Date.now();
  const commits: RecentCommitActivity[] = [];

  for (let i = 0; i < count; i++) {
    const repo = repos[Math.floor(Math.random() * repos.length)];
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(now - hoursAgo * 60 * 60 * 1000);
    const commitCount = Math.floor(Math.random() * 5) + 1;
    const additions = Math.floor(Math.random() * 500) + 10;
    const deletions = Math.floor(Math.random() * 200) + 5;

    commits.push({
      id: `commit-${i}-${timestamp.getTime()}`,
      timestamp: timestamp.toISOString(),
      repository: `${repo.owner}/${repo.name}`,
      repositoryUrl: `https://github.com/${repo.owner}/${repo.name}`,
      ownerType: repo.owner === username ? 'User' : 'Organization',
      isPrivate: Math.random() < 0.3,
      commitCount,
      additions,
      deletions,
    });
  }

  // Sort by timestamp descending (most recent first)
  return commits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Generate mock contributed repositories (past ~5 months)
const generateMockContributedRepos = (username: string, count: number = 5): ContributedRepository[] => {
  const repos = [
    { name: 'awesome-project', owner: username, ownerType: 'User' as const },
    { name: 'cli-tool', owner: username, ownerType: 'User' as const },
    { name: 'web-framework', owner: 'facebook', ownerType: 'Organization' as const },
    { name: 'react', owner: 'facebook', ownerType: 'Organization' as const },
    { name: 'typescript', owner: 'microsoft', ownerType: 'Organization' as const },
    { name: 'vscode', owner: 'microsoft', ownerType: 'Organization' as const },
    { name: 'next.js', owner: 'vercel', ownerType: 'Organization' as const },
    { name: 'tensorflow', owner: 'tensorflow', ownerType: 'Organization' as const },
  ];

  const now = Date.now();
  const contributedRepos: ContributedRepository[] = [];

  for (let i = 0; i < count; i++) {
    const repo = repos[i % repos.length];
    const monthsAgo = Math.floor(Math.random() * 5);
    const daysAgo = monthsAgo * 30 + Math.floor(Math.random() * 30);
    const lastContributedAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const commitCount = Math.floor(Math.random() * 50) + 5;

    contributedRepos.push({
      nameWithOwner: `${repo.owner}/${repo.name}`,
      owner: repo.owner,
      name: repo.name,
      url: `https://github.com/${repo.owner}/${repo.name}`,
      commitCount,
      lastContributedAt: lastContributedAt.toISOString(),
      isPrivate: repo.owner === username && Math.random() < 0.2,
      ownerType: repo.ownerType,
    });
  }

  // Sort by lastContributedAt descending (most recent first)
  return contributedRepos.sort((a, b) =>
    new Date(b.lastContributedAt).getTime() - new Date(a.lastContributedAt).getTime()
  );
};

// Generate mock contributors
const createMockContributors = (count: number = 5): Contributor[] => {
  const contributors: Contributor[] = [
    {
      username: 'alice',
      avatarUrl: 'https://i.pravatar.cc/80?img=1',
      contributions: 342,
    },
    {
      username: 'bob',
      avatarUrl: 'https://i.pravatar.cc/80?img=2',
      contributions: 234,
    },
    {
      username: 'charlie',
      avatarUrl: 'https://i.pravatar.cc/80?img=3',
      contributions: 189,
    },
    {
      username: 'diana',
      avatarUrl: 'https://i.pravatar.cc/80?img=4',
      contributions: 156,
    },
    {
      username: 'eve',
      avatarUrl: 'https://i.pravatar.cc/80?img=5',
      contributions: 98,
    },
  ];

  return contributors.slice(0, count);
};

// Generate mock repositories
const createMockRepositories = (username: string, count: number = 6): RepoCardData[] => {
  const repoData = [
    {
      name: 'awesome-project',
      description: 'A fantastic open source project built with React and TypeScript',
      language: 'TypeScript',
      stars: 1234,
      yearsAgo: 2,
    },
    {
      name: 'cli-tool',
      description: 'Blazingly fast command-line tool written in Rust',
      language: 'Rust',
      stars: 567,
      yearsAgo: 1,
    },
    {
      name: 'web-framework',
      description: 'Modern web framework for building scalable applications',
      language: 'JavaScript',
      stars: 2890,
      yearsAgo: 3,
    },
    {
      name: 'data-pipeline',
      description: 'ETL pipeline for processing large datasets',
      language: 'Python',
      stars: 423,
      yearsAgo: 1,
    },
    {
      name: 'api-server',
      description: 'RESTful API server with authentication and rate limiting',
      language: 'Go',
      stars: 789,
      yearsAgo: 2,
    },
    {
      name: 'ui-components',
      description: 'Reusable UI component library for React',
      language: 'TypeScript',
      stars: 1567,
      yearsAgo: 1,
    },
    {
      name: 'mobile-app',
      description: 'Cross-platform mobile app built with React Native',
      language: 'TypeScript',
      stars: 345,
      yearsAgo: 0.5,
    },
    {
      name: 'ml-toolkit',
      description: 'Machine learning toolkit for data scientists',
      language: 'Python',
      stars: 2345,
      yearsAgo: 4,
    },
    {
      name: 'devops-scripts',
      description: 'Collection of DevOps automation scripts',
      language: 'Shell',
      stars: 123,
      yearsAgo: 2,
    },
  ];

  return repoData.slice(0, count).map((repo) => {
    const createdDate = new Date();
    createdDate.setFullYear(createdDate.getFullYear() - Math.floor(repo.yearsAgo));
    createdDate.setMonth(createdDate.getMonth() - Math.floor((repo.yearsAgo % 1) * 12));

    return {
      repoName: repo.name,
      githubOwner: username,
      githubRepoName: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      createdAt: createdDate.toISOString(),
      topContributors: createMockContributors(Math.floor(Math.random() * 3) + 2), // 2-5 contributors
    };
  });
};

// Generate mock user profile data
const createMockUserProfile = (
  overrides: Partial<UserProfileData> = {}
): UserProfileData => {
  const username = overrides.username || 'octocat';
  const defaultProfile: UserProfileData = {
    username,
    name: 'The Octocat',
    email: 'octocat@github.com',
    avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
    bio: 'Open source enthusiast and cat lover. Building the future, one commit at a time.',
    location: 'San Francisco, CA',
    company: 'GitHub',
    twitterHandle: 'github',
    websiteUrl: 'https://github.com/octocat',
    activityData: generateMockActivityData('medium'),
    recentCommits: generateMockRecentCommits(username, 4),
    contributedRepos: generateMockContributedRepos(username, 6),
    totalCommits: 1247,
    totalRepos: 42,
    followers: 3542,
    following: 127,
    joinedDate: '2011-01-25T18:44:36Z',
  };

  return { ...defaultProfile, ...overrides };
};

// Mock panel wrapper component
const MockUserProfilePanel: React.FC<{
  userData?: UserProfileData;
  username?: string;
}> = ({ userData, username = 'octocat' }) => {
  // Track watched users in component state for interactive demo
  const [watchedUsers, setWatchedUsers] = React.useState<Set<string>>(new Set());

  const mockContext: UserProfilePanelContext = {
    currentScope: {
      type: 'workspace' as const,
      user: username ? { username } : undefined,
    },
    refresh: async () => {},
  };

  const mockActions: UserProfilePanelActions = {
    getUserProfile: async (user: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!userData) {
        throw new globalThis.Error('User not found');
      }

      return {
        ...userData,
        username: user,
      };
    },
    getUserActivity: async () => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Convert Map to array for API response format
      const contributions: Array<{ date: string; count: number }> = [];
      userData?.activityData.forEach((count, date) => {
        contributions.push({ date, count });
      });

      return {
        recentCommits: userData?.recentCommits || [],
        contributions,
        contributedRepos: userData?.contributedRepos || [],
      };
    },
    getUserRepositories: async (user: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      return createMockRepositories(user, 6);
    },
    getRepositoryFileTree: async (owner: string, repoName: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      return createMockFileTree(repoName);
    },
    isUserWatched: async (user: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return watchedUsers.has(user);
    },
    watchUser: async (user: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.info('[Mock] Watching user:', user);
      setWatchedUsers((prev) => new Set([...prev, user]));
    },
    unwatchUser: async (user: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.info('[Mock] Unwatching user:', user);
      setWatchedUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(user);
        return newSet;
      });
    },
    getUserOrgs: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return mockUserOrgs;
    },
    openFile: async () => {},
  };

  const mockEvents = new MockEventEmitter();

  return (
    <UserProfilePanel
      context={mockContext}
      actions={mockActions}
      events={mockEvents}
    />
  );
};

// Wrapper with theme provider
const UserProfilePanelStory: React.FC<{
  userData?: UserProfileData;
  username?: string;
}> = (props) => {
  return (
    <ThemeProvider>
      <MockUserProfilePanel {...props} />
    </ThemeProvider>
  );
};

const meta: Meta<typeof UserProfilePanel> = {
  title: 'Panels/UserProfilePanel',
  component: UserProfilePanel,
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
  render: () => <UserProfilePanelStory userData={createMockUserProfile()} />,
} as unknown as Story;

// Active developer with high activity
export const HighActivity = {
  render: () => (
    <UserProfilePanelStory
      userData={createMockUserProfile({
        username: 'superdev',
        name: 'Super Developer',
        bio: 'Coding 24/7. Coffee-driven development.',
        activityData: generateMockActivityData('high'),
        totalCommits: 5432,
        totalRepos: 127,
        followers: 8942,
        following: 234,
      })}
    />
  ),
} as unknown as Story;

// Minimal profile (no bio, location, etc.)
export const MinimalProfile = {
  render: () => (
    <UserProfilePanelStory
      userData={createMockUserProfile({
        name: undefined,
        bio: undefined,
        location: undefined,
        company: undefined,
        twitterHandle: undefined,
        websiteUrl: undefined,
        activityData: generateMockActivityData('low'),
        totalCommits: 42,
        totalRepos: 5,
        followers: 12,
        following: 8,
      })}
    />
  ),
} as unknown as Story;

// New user with low activity
export const NewUser = {
  render: () => (
    <UserProfilePanelStory
      userData={createMockUserProfile({
        username: 'newbie',
        name: 'New Developer',
        bio: 'Just getting started with open source!',
        activityData: generateMockActivityData('low'),
        totalCommits: 23,
        totalRepos: 3,
        followers: 5,
        following: 42,
        joinedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      })}
    />
  ),
} as unknown as Story;

// Profile without avatar (fallback to initials)
export const NoAvatar = {
  render: () => (
    <UserProfilePanelStory
      userData={createMockUserProfile({
        avatarUrl: undefined,
        username: 'johndoe',
        name: 'John Doe',
      })}
    />
  ),
} as unknown as Story;

// Loading state - panel will show loading while fetching
export const Loading: Story = {
  render: () => {
    const mockContext: UserProfilePanelContext = {
      currentScope: {
        type: 'workspace' as const,
        user: { username: 'octocat' },
      },
      refresh: async () => {},
    };

    const mockActions: UserProfilePanelActions = {
      getUserProfile: async () => {
        // Simulate slow loading
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return createMockUserProfile();
      },
      getUserActivity: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { recentCommits: [], contributions: [], contributedRepos: [] };
      },
      openFile: async () => {},
    };

    const mockEvents = new MockEventEmitter();

    return (
      <ThemeProvider>
        <UserProfilePanel context={mockContext} actions={mockActions} events={mockEvents} />
      </ThemeProvider>
    );
  },
};

// Error state
export const Error: Story = {
  render: () => {
    const mockContext: UserProfilePanelContext = {
      currentScope: {
        type: 'workspace' as const,
        user: { username: 'nonexistentuser' },
      },
      refresh: async () => {},
    };

    const mockActions: UserProfilePanelActions = {
      getUserProfile: async () => {
        // Simulate error
        await new Promise((resolve) => setTimeout(resolve, 500));
        throw new globalThis.Error('Failed to load user profile. Please try again.');
      },
      getUserActivity: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { recentCommits: [], contributions: [], contributedRepos: [] };
      },
      openFile: async () => {},
    };

    const mockEvents = new MockEventEmitter();

    return (
      <ThemeProvider>
        <UserProfilePanel context={mockContext} actions={mockActions} events={mockEvents} />
      </ThemeProvider>
    );
  },
};

// Empty state - no user selected
export const Empty: Story = {
  render: () => {
    const mockContext: UserProfilePanelContext = {
      currentScope: {
        type: 'workspace' as const,
        user: undefined, // No user selected
      },
      refresh: async () => {},
    };

    const mockActions: UserProfilePanelActions = {
      getUserProfile: async () => {
        return createMockUserProfile();
      },
      getUserActivity: async () => {
        return { recentCommits: [], contributions: [], contributedRepos: [] };
      },
      openFile: async () => {},
    };

    const mockEvents = new MockEventEmitter();

    return (
      <ThemeProvider>
        <UserProfilePanel context={mockContext} actions={mockActions} events={mockEvents} />
      </ThemeProvider>
    );
  },
};

// Profile with all optional fields filled
export const CompleteProfile = {
  render: () => (
    <UserProfilePanelStory
      userData={createMockUserProfile({
        username: 'fullstack_dev',
        name: 'Alex Johnson',
        email: 'alex.johnson@example.com',
        avatarUrl: 'https://i.pravatar.cc/160?img=33',
        bio: 'Full-stack developer passionate about React, TypeScript, and building great UIs. Open source contributor and tech blogger.',
        location: 'New York, NY',
        company: 'Tech Corp',
        twitterHandle: 'alexjdev',
        websiteUrl: 'https://alexjohnson.dev',
        activityData: generateMockActivityData('medium'),
        totalCommits: 2847,
        totalRepos: 67,
        followers: 1234,
        following: 189,
        joinedDate: '2018-03-15T10:30:00Z',
      })}
    />
  ),
} as unknown as Story;

// Profile with very long bio
export const LongBio = {
  render: () => (
    <UserProfilePanelStory
      userData={createMockUserProfile({
        bio: 'Passionate software engineer with 10+ years of experience in full-stack development. Specialized in React, TypeScript, Node.js, and cloud technologies. Open source maintainer of several popular packages. Love mentoring junior developers and contributing to the tech community. When not coding, you can find me hiking, reading sci-fi, or experimenting with new tech.',
        activityData: generateMockActivityData('medium'),
      })}
    />
  ),
} as unknown as Story;
