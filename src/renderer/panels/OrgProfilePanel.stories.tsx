import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type {
  PanelEventEmitter,
  PanelEvent,
} from '@principal-ade/panel-framework-core';
import {
  OrgProfilePanel,
  type OrgProfileData,
  type OrgProfilePanelContext,
  type OrgProfilePanelActions,
} from './OrgProfilePanel';
import type { RepoCardData, Contributor } from './RepoCard';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import type { GitHubOrgMember } from '../../shared/main-process-api-interfaces/GitHubAPI';

const mockMembers: GitHubOrgMember[] = [
  { id: 1, login: 'alice',   avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',   type: 'User', site_admin: false },
  { id: 2, login: 'bob',     avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',   type: 'User', site_admin: false },
  { id: 3, login: 'carol',   avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4',   type: 'User', site_admin: false },
  { id: 4, login: 'dave',    avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4',   type: 'User', site_admin: false },
  { id: 5, login: 'eve',     avatar_url: 'https://avatars.githubusercontent.com/u/5?v=4',   type: 'User', site_admin: false },
  { id: 6, login: 'frank',   avatar_url: 'https://avatars.githubusercontent.com/u/6?v=4',   type: 'User', site_admin: false },
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

  const maxCommits = intensity === 'low' ? 20 : intensity === 'medium' ? 50 : 100;

  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    // Random activity with some patterns
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseChance = isWeekend ? 0.4 : 0.8;

    // Add some seasonal variation
    const monthOfYear = date.getMonth();
    const isHolidaySeason = monthOfYear === 11 || monthOfYear === 0; // December or January
    const seasonalMultiplier = isHolidaySeason ? 0.6 : 1.0;

    if (Math.random() < baseChance * seasonalMultiplier) {
      const commits = Math.floor(Math.random() * maxCommits) + 1;
      activityMap.set(dateKey, commits);
    }
  }

  return activityMap;
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

// Generate mock repositories for organization
const createMockOrgRepositories = (orgName: string, count: number = 9): RepoCardData[] => {
  const repoData = [
    {
      name: 'core-framework',
      description: 'The core framework powering all our services',
      language: 'TypeScript',
      stars: 15234,
      yearsAgo: 5,
    },
    {
      name: 'cli-tools',
      description: 'Command-line tools for developers',
      language: 'Rust',
      stars: 8967,
      yearsAgo: 3,
    },
    {
      name: 'web-platform',
      description: 'Modern web platform for building scalable applications',
      language: 'JavaScript',
      stars: 22890,
      yearsAgo: 6,
    },
    {
      name: 'data-analytics',
      description: 'Analytics and data processing pipeline',
      language: 'Python',
      stars: 5423,
      yearsAgo: 2,
    },
    {
      name: 'microservices',
      description: 'Microservices architecture and deployment',
      language: 'Go',
      stars: 12789,
      yearsAgo: 4,
    },
    {
      name: 'design-system',
      description: 'Comprehensive design system and UI components',
      language: 'TypeScript',
      stars: 18567,
      yearsAgo: 3,
    },
    {
      name: 'mobile-sdk',
      description: 'Cross-platform mobile SDK',
      language: 'Kotlin',
      stars: 7345,
      yearsAgo: 2,
    },
    {
      name: 'ml-platform',
      description: 'Machine learning platform and tools',
      language: 'Python',
      stars: 24345,
      yearsAgo: 5,
    },
    {
      name: 'infrastructure',
      description: 'Infrastructure as code and DevOps tools',
      language: 'Go',
      stars: 9123,
      yearsAgo: 3,
    },
  ];

  return repoData.slice(0, count).map((repo) => {
    const createdDate = new Date();
    createdDate.setFullYear(createdDate.getFullYear() - Math.floor(repo.yearsAgo));
    createdDate.setMonth(createdDate.getMonth() - Math.floor((repo.yearsAgo % 1) * 12));

    return {
      repoName: repo.name,
      githubOwner: orgName,
      githubRepoName: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      createdAt: createdDate.toISOString(),
      topContributors: createMockContributors(5), // Organizations typically have full teams
      isOwnerOrg: true,
    };
  });
};

// Generate mock organization profile data
const createMockOrgProfile = (
  overrides: Partial<OrgProfileData> = {}
): OrgProfileData => {
  const defaultProfile: OrgProfileData = {
    orgName: 'github',
    name: 'GitHub',
    email: 'support@github.com',
    avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
    description: 'How people build software. Millions of developers use GitHub to build personal projects, support their businesses, and work together on open source.',
    location: 'San Francisco, CA',
    twitterHandle: 'github',
    websiteUrl: 'https://github.com',
    activityData: generateMockActivityData('high'),
    totalCommits: 54321,
    publicRepos: 342,
    members: 1247,
    createdDate: '2008-04-10T18:44:36Z',
  };

  return { ...defaultProfile, ...overrides };
};

// Mock panel wrapper component
const MockOrgProfilePanel: React.FC<{
  orgData?: OrgProfileData;
  orgName?: string;
}> = ({ orgData, orgName = 'github' }) => {
  // Track watched orgs in component state for interactive demo
  const [watchedOrgs, setWatchedOrgs] = React.useState<Set<string>>(new Set());

  const mockContext: OrgProfilePanelContext = {
    currentScope: {
      type: 'workspace' as const,
      org: orgName ? { orgName } : undefined,
    },
    refresh: async () => {},
  };

  const mockActions: OrgProfilePanelActions = {
    getOrgProfile: async (org: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!orgData) {
        throw new globalThis.Error('Organization not found');
      }

      return {
        ...orgData,
        orgName: org,
      };
    },
    getOrgActivity: async () => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 150));
      return orgData?.activityData || new Map<string, number>();
    },
    getOrgRepositories: async (org: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      return createMockOrgRepositories(org, 9);
    },
    getRepositoryFileTree: async (owner: string, repoName: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      return createMockFileTree(repoName);
    },
    isOrgWatched: async (org: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return watchedOrgs.has(org);
    },
    watchOrg: async (org: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.info('[Mock] Watching org:', org);
      setWatchedOrgs((prev) => new Set([...prev, org]));
    },
    unwatchOrg: async (org: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.info('[Mock] Unwatching org:', org);
      setWatchedOrgs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(org);
        return newSet;
      });
    },
    getOrgMembers: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return mockMembers;
    },
    openFile: async () => {},
  };

  const mockEvents = new MockEventEmitter();

  return (
    <OrgProfilePanel
      context={mockContext}
      actions={mockActions}
      events={mockEvents}
    />
  );
};

// Wrapper with theme provider
const OrgProfilePanelStory: React.FC<{
  orgData?: OrgProfileData;
  orgName?: string;
}> = (props) => {
  return (
    <ThemeProvider>
      <MockOrgProfilePanel {...props} />
    </ThemeProvider>
  );
};

const meta: Meta<typeof OrgProfilePanel> = {
  title: 'Panels/OrgProfilePanel',
  component: OrgProfilePanel,
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
  render: () => <OrgProfilePanelStory orgData={createMockOrgProfile()} />,
} as unknown as Story;

// Very active organization
export const HighActivity = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        orgName: 'vercel',
        name: 'Vercel',
        description: 'Develop. Preview. Ship. The best frontend teams use Vercel to build and deploy their web applications.',
        location: 'San Francisco, CA',
        twitterHandle: 'vercel',
        websiteUrl: 'https://vercel.com',
        activityData: generateMockActivityData('high'),
        totalCommits: 123456,
        publicRepos: 567,
        members: 234,
        createdDate: '2015-07-20T10:30:00Z',
      })}
    />
  ),
} as unknown as Story;

// Minimal profile (no optional fields)
export const MinimalProfile = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        orgName: 'smallorg',
        name: undefined,
        email: undefined,
        location: undefined,
        twitterHandle: undefined,
        websiteUrl: undefined,
        description: undefined,
        activityData: generateMockActivityData('low'),
        totalCommits: 234,
        publicRepos: 12,
        members: 5,
        createdDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
      })}
    />
  ),
} as unknown as Story;

// New organization with low activity
export const NewOrg = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        orgName: 'newstartup',
        name: 'New Startup Inc.',
        description: 'Building the next generation of developer tools.',
        location: 'Remote',
        activityData: generateMockActivityData('low'),
        totalCommits: 89,
        publicRepos: 3,
        members: 8,
        createdDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
      })}
    />
  ),
} as unknown as Story;

// Profile without avatar (fallback to initials)
export const NoAvatar = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        avatarUrl: undefined,
        orgName: 'acme-corp',
        name: 'ACME Corporation',
      })}
    />
  ),
} as unknown as Story;

// Loading state - panel will show loading while fetching
export const Loading: Story = {
  render: () => {
    const mockContext: OrgProfilePanelContext = {
      currentScope: {
        type: 'workspace' as const,
        org: { orgName: 'github' },
      },
      refresh: async () => {},
    };

    const mockActions: OrgProfilePanelActions = {
      getOrgProfile: async () => {
        // Simulate slow loading
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return createMockOrgProfile();
      },
      getOrgActivity: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return new Map<string, number>();
      },
      openFile: async () => {},
    };

    const mockEvents = new MockEventEmitter();

    return (
      <ThemeProvider>
        <OrgProfilePanel context={mockContext} actions={mockActions} events={mockEvents} />
      </ThemeProvider>
    );
  },
};

// Error state
export const Error: Story = {
  render: () => {
    const mockContext: OrgProfilePanelContext = {
      currentScope: {
        type: 'workspace' as const,
        org: { orgName: 'nonexistentorg' },
      },
      refresh: async () => {},
    };

    const mockActions: OrgProfilePanelActions = {
      getOrgProfile: async () => {
        // Simulate error
        await new Promise((resolve) => setTimeout(resolve, 500));
        throw new globalThis.Error('Failed to load organization profile. Please try again.');
      },
      getOrgActivity: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return new Map<string, number>();
      },
      openFile: async () => {},
    };

    const mockEvents = new MockEventEmitter();

    return (
      <ThemeProvider>
        <OrgProfilePanel context={mockContext} actions={mockActions} events={mockEvents} />
      </ThemeProvider>
    );
  },
};

// Empty state - no org selected
export const Empty: Story = {
  render: () => {
    const mockContext: OrgProfilePanelContext = {
      currentScope: {
        type: 'workspace' as const,
        org: undefined, // No org selected
      },
      refresh: async () => {},
    };

    const mockActions: OrgProfilePanelActions = {
      getOrgProfile: async () => {
        return createMockOrgProfile();
      },
      getOrgActivity: async () => {
        return new Map<string, number>();
      },
      openFile: async () => {},
    };

    const mockEvents = new MockEventEmitter();

    return (
      <ThemeProvider>
        <OrgProfilePanel context={mockContext} actions={mockActions} events={mockEvents} />
      </ThemeProvider>
    );
  },
};

// Profile with all optional fields filled
export const CompleteProfile = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        orgName: 'microsoft',
        name: 'Microsoft',
        email: 'opensource@microsoft.com',
        avatarUrl: 'https://avatars.githubusercontent.com/u/6154722?v=4',
        description: 'Open source projects and samples from Microsoft. We are working to build community through open source technology.',
        location: 'Redmond, WA',
        twitterHandle: 'Microsoft',
        websiteUrl: 'https://opensource.microsoft.com',
        activityData: generateMockActivityData('high'),
        totalCommits: 234567,
        publicRepos: 2847,
        members: 4234,
        createdDate: '2014-08-12T15:30:00Z',
      })}
    />
  ),
} as unknown as Story;

// Profile with very long description
export const LongDescription = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        description: 'We are a global organization dedicated to building innovative open source software that empowers developers around the world. Our mission is to create tools, frameworks, and platforms that enable developers to build amazing applications. We believe in the power of community and collaboration, and we are committed to making our software accessible to everyone. Join us in building the future of technology.',
        activityData: generateMockActivityData('medium'),
      })}
    />
  ),
} as unknown as Story;

// Large enterprise organization
export const Enterprise = {
  render: () => (
    <OrgProfilePanelStory
      orgData={createMockOrgProfile({
        orgName: 'google',
        name: 'Google',
        email: 'opensource@google.com',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1342004?v=4',
        description: 'Google Open Source. We love open source.',
        location: 'Mountain View, CA',
        twitterHandle: 'Google',
        websiteUrl: 'https://opensource.google',
        activityData: generateMockActivityData('high'),
        totalCommits: 567890,
        publicRepos: 1234,
        members: 8942,
        createdDate: '2012-01-18T08:30:00Z',
      })}
    />
  ),
} as unknown as Story;
