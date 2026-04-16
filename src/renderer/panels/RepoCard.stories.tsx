import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import { RepoCard, type RepoCardData, type Contributor } from './RepoCard';

// Generate mock file tree using PathsFileTreeBuilder
const createMockFileTree = (repoName: string, projectType: 'typescript' | 'python' | 'rust' | 'go' = 'typescript'): FileTree => {
  let files: string[] = [];

  switch (projectType) {
    case 'typescript':
      files = [
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
      break;

    case 'python':
      files = [
        `${repoName}/src/__init__.py`,
        `${repoName}/src/main.py`,
        `${repoName}/src/models/user.py`,
        `${repoName}/src/models/post.py`,
        `${repoName}/src/utils/helpers.py`,
        `${repoName}/src/utils/validators.py`,
        `${repoName}/src/api/routes.py`,
        `${repoName}/src/api/middleware.py`,
        `${repoName}/tests/test_main.py`,
        `${repoName}/tests/test_models.py`,
        `${repoName}/tests/test_api.py`,
        `${repoName}/requirements.txt`,
        `${repoName}/setup.py`,
        `${repoName}/README.md`,
        `${repoName}/.gitignore`,
      ];
      break;

    case 'rust':
      files = [
        `${repoName}/src/main.rs`,
        `${repoName}/src/lib.rs`,
        `${repoName}/src/models/mod.rs`,
        `${repoName}/src/models/user.rs`,
        `${repoName}/src/utils/mod.rs`,
        `${repoName}/src/utils/helpers.rs`,
        `${repoName}/tests/integration_test.rs`,
        `${repoName}/benches/benchmarks.rs`,
        `${repoName}/Cargo.toml`,
        `${repoName}/Cargo.lock`,
        `${repoName}/README.md`,
        `${repoName}/.gitignore`,
      ];
      break;

    case 'go':
      files = [
        `${repoName}/main.go`,
        `${repoName}/cmd/server/main.go`,
        `${repoName}/pkg/models/user.go`,
        `${repoName}/pkg/models/post.go`,
        `${repoName}/pkg/utils/helpers.go`,
        `${repoName}/pkg/api/routes.go`,
        `${repoName}/pkg/api/handlers.go`,
        `${repoName}/internal/database/db.go`,
        `${repoName}/internal/config/config.go`,
        `${repoName}/tests/main_test.go`,
        `${repoName}/tests/api_test.go`,
        `${repoName}/go.mod`,
        `${repoName}/go.sum`,
        `${repoName}/README.md`,
        `${repoName}/.gitignore`,
      ];
      break;
  }

  const builder = new PathsFileTreeBuilder();
  const fileTree = builder.build({
    files,
    rootPath: repoName,
  });

  return fileTree;
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

// Create mock repository data
const createMockRepo = (overrides: Partial<RepoCardData> = {}): RepoCardData => {
  // Default to 2 years ago
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  return {
    repoName: 'my-awesome-project',
    githubOwner: 'octocat',
    githubRepoName: 'my-awesome-project',
    description: 'A fantastic open source project built with React and TypeScript',
    language: 'TypeScript',
    stars: 1234,
    isOwnerOrg: false,
    createdAt: twoYearsAgo.toISOString(),
    topContributors: createMockContributors(5),
    ...overrides,
  };
};

// Wrapper component with theme
const RepoCardStory: React.FC<{
  repo: RepoCardData;
  projectType?: 'typescript' | 'python' | 'rust' | 'go';
}> = ({ repo, projectType = 'typescript' }) => {
  const fileTree = createMockFileTree(repo.repoName, projectType);

  return (
    <ThemeProvider>
      <div style={{ padding: '24px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
        <div style={{ maxWidth: '600px' }}>
          <RepoCard
            repo={repo}
            onClick={() => console.info('Card clicked:', repo.repoName)}
            onDoubleClick={() => console.info('Card double-clicked:', repo.repoName)}
            fileTree={fileTree}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

const meta: Meta<typeof RepoCard> = {
  title: 'Panels/RepoCard',
  component: RepoCard,
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
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  render: () => <RepoCardStory repo={createMockRepo()} />,
};

// Minimal info - just name
export const MinimalInfo: Story = {
  render: () => (
    <RepoCardStory
      repo={createMockRepo({
        description: undefined,
        language: undefined,
        stars: undefined,
      })}
    />
  ),
};

// No description
export const NoDescription: Story = {
  render: () => (
    <RepoCardStory
      repo={createMockRepo({
        description: undefined,
      })}
    />
  ),
};

// Long description
export const LongDescription: Story = {
  render: () => (
    <RepoCardStory
      repo={createMockRepo({
        description:
          'This is a very long description that should be truncated after two lines. It contains a lot of text to demonstrate how the component handles overflow. This project is built with React, TypeScript, and includes many advanced features like real-time updates, authentication, and more.',
      })}
    />
  ),
};

// Organization repository
export const OrganizationRepo: Story = {
  render: () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'react',
          githubOwner: 'facebook',
          githubRepoName: 'react',
          description: 'The library for web and native user interfaces',
          language: 'JavaScript',
          stars: 225000,
          isOwnerOrg: true,
          createdAt: tenYearsAgo.toISOString(),
          topContributors: createMockContributors(5),
        })}
      />
    );
  },
};

// Popular repository with high stars
export const PopularRepo: Story = {
  render: () => {
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'vscode',
          githubOwner: 'microsoft',
          githubRepoName: 'vscode',
          description: 'Visual Studio Code - Code editing redefined',
          language: 'TypeScript',
          stars: 158000,
          isOwnerOrg: true,
          createdAt: sevenYearsAgo.toISOString(),
        })}
      />
    );
  },
};

// Different programming languages
export const PythonRepo: Story = {
  render: () => {
    const fifteenYearsAgo = new Date();
    fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'django',
          githubOwner: 'django',
          githubRepoName: 'django',
          description: 'The Web framework for perfectionists with deadlines',
          language: 'Python',
          stars: 76000,
          isOwnerOrg: true,
          createdAt: fifteenYearsAgo.toISOString(),
          topContributors: createMockContributors(5),
        })}
        projectType="python"
      />
    );
  },
};

export const RustRepo: Story = {
  render: () => {
    const nineYearsAgo = new Date();
    nineYearsAgo.setFullYear(nineYearsAgo.getFullYear() - 9);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'rust',
          githubOwner: 'rust-lang',
          githubRepoName: 'rust',
          description: 'Empowering everyone to build reliable and efficient software',
          language: 'Rust',
          stars: 92000,
          isOwnerOrg: true,
          createdAt: nineYearsAgo.toISOString(),
          topContributors: createMockContributors(5),
        })}
        projectType="rust"
      />
    );
  },
};

export const GoRepo: Story = {
  render: () => {
    const twelveYearsAgo = new Date();
    twelveYearsAgo.setFullYear(twelveYearsAgo.getFullYear() - 12);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'go',
          githubOwner: 'golang',
          githubRepoName: 'go',
          description: 'The Go programming language',
          language: 'Go',
          stars: 120000,
          isOwnerOrg: true,
          createdAt: twelveYearsAgo.toISOString(),
          topContributors: createMockContributors(5),
        })}
        projectType="go"
      />
    );
  },
};

// Local repository (with path, no GitHub info)
export const LocalRepo: Story = {
  render: () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return (
      <RepoCardStory
        repo={{
          repoName: 'my-local-project',
          repoPath: '/Users/developer/projects/my-local-project',
          description: 'A local project not yet pushed to GitHub',
          language: 'TypeScript',
          createdAt: threeMonthsAgo.toISOString(),
        }}
      />
    );
  },
};

// Brand new repository
export const BrandNewRepo: Story = {
  render: () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'fresh-project',
          description: 'Just started this project!',
          language: 'JavaScript',
          stars: 5,
          createdAt: twoDaysAgo.toISOString(),
        })}
      />
    );
  },
};

// Very old repository
export const VeryOldRepo: Story = {
  render: () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    return (
      <RepoCardStory
        repo={createMockRepo({
          repoName: 'legacy-system',
          description: 'A decade of battle-tested code',
          language: 'Java',
          stars: 2500,
          createdAt: tenYearsAgo.toISOString(),
        })}
      />
    );
  },
};

// Grid layout - multiple cards
export const GridLayout: Story = {
  render: () => {
    // Create varied creation dates
    const dates = [
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 3).toISOString(), // 3 years ago
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 * 6).toISOString(), // 6 months ago
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 * 2).toISOString(), // 2 months ago
      new Date(Date.now() - 24 * 60 * 60 * 1000 * 14).toISOString(), // 14 days ago
      new Date(Date.now() - 24 * 60 * 60 * 1000 * 3).toISOString(), // 3 days ago
    ];

    const repos: Array<{ repo: RepoCardData; type: 'typescript' | 'python' | 'rust' | 'go' }> = [
      {
        repo: createMockRepo({
          repoName: 'frontend-app',
          language: 'TypeScript',
          stars: 342,
          createdAt: dates[0],
          topContributors: createMockContributors(5),
        }),
        type: 'typescript',
      },
      {
        repo: createMockRepo({
          repoName: 'backend-api',
          language: 'Go',
          stars: 189,
          createdAt: dates[1],
          topContributors: createMockContributors(3),
        }),
        type: 'go',
      },
      {
        repo: createMockRepo({
          repoName: 'mobile-app',
          language: 'Dart',
          stars: 567,
          createdAt: dates[2],
          topContributors: createMockContributors(4),
        }),
        type: 'typescript',
      },
      {
        repo: createMockRepo({
          repoName: 'data-pipeline',
          language: 'Python',
          stars: 234,
          createdAt: dates[3],
          topContributors: createMockContributors(2),
        }),
        type: 'python',
      },
      {
        repo: createMockRepo({
          repoName: 'auth-service',
          language: 'Rust',
          stars: 421,
          createdAt: dates[4],
          topContributors: createMockContributors(1),
        }),
        type: 'rust',
      },
      {
        repo: createMockRepo({
          repoName: 'ui-components',
          language: 'TypeScript',
          stars: 891,
          createdAt: dates[5],
          topContributors: createMockContributors(5),
        }),
        type: 'typescript',
      },
    ];

    return (
      <ThemeProvider>
        <div style={{ padding: '24px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
              gap: '16px',
            }}
          >
            {repos.map(({ repo, type }) => {
              const fileTree = createMockFileTree(repo.repoName, type);
              return (
                <RepoCard
                  key={repo.repoName}
                  repo={repo}
                  onClick={() => console.info('Card clicked:', repo.repoName)}
                  onDoubleClick={() => console.info('Card double-clicked:', repo.repoName)}
                  fileTree={fileTree}
                />
              );
            })}
          </div>
        </div>
      </ThemeProvider>
    );
  },
};

// Without click handlers (not interactive)
export const NonInteractive: Story = {
  render: () => {
    const repo = createMockRepo();
    const fileTree = createMockFileTree(repo.repoName, 'typescript');
    return (
      <ThemeProvider>
        <div style={{ padding: '24px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
          <div style={{ maxWidth: '600px' }}>
            <RepoCard repo={repo} fileTree={fileTree} />
          </div>
        </div>
      </ThemeProvider>
    );
  },
};

// Solo developer (1 contributor)
export const SoloContributor: Story = {
  render: () => (
    <RepoCardStory
      repo={createMockRepo({
        repoName: 'solo-project',
        description: 'My personal side project',
        language: 'Python',
        stars: 42,
        topContributors: createMockContributors(1),
      })}
      projectType="python"
    />
  ),
};

// Small team (3 contributors)
export const SmallTeam: Story = {
  render: () => (
    <RepoCardStory
      repo={createMockRepo({
        repoName: 'team-project',
        description: 'Built by a small dedicated team',
        language: 'Rust',
        stars: 234,
        topContributors: createMockContributors(3),
      })}
      projectType="rust"
    />
  ),
};

// No contributors displayed
export const NoContributors: Story = {
  render: () => (
    <RepoCardStory
      repo={createMockRepo({
        repoName: 'private-repo',
        description: 'Private repository with hidden contributors',
        language: 'Go',
        stars: undefined,
        topContributors: undefined,
      })}
      projectType="go"
    />
  ),
};
