import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { StarredRepoCard, type StarredRepoCardData } from './StarredRepoCard';

const createMockRepo = (overrides: Partial<StarredRepoCardData> = {}): StarredRepoCardData => ({
  owner: 'facebook',
  name: 'react',
  ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
  description: 'The library for web and native user interfaces.',
  language: 'JavaScript',
  stargazersCount: 225000,
  ...overrides,
});

const Wrapper: React.FC<{ children: React.ReactNode; width?: number }> = ({
  children,
  width = 360,
}) => (
  <ThemeProvider>
    <div style={{ padding: 24, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ maxWidth: width }}>{children}</div>
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof StarredRepoCard> = {
  title: 'Panels/Cards/StarredRepoCard',
  component: StarredRepoCard,
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

export const Default: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard repo={createMockRepo()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const NoDescription: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({ description: null })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({
          description:
            'A very long description that should be clamped to two lines. It contains enough text to demonstrate overflow handling and the ellipsis behavior of the card when content exceeds the allotted space. Extra padding words to push it over.',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoLanguage: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({ language: null })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoStars: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({ stargazersCount: undefined })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LowStars: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({
          owner: 'someuser',
          name: 'my-side-project',
          ownerAvatarUrl: 'https://i.pravatar.cc/80?img=12',
          description: 'A small weekend experiment.',
          language: 'TypeScript',
          stargazersCount: 3,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const HugeStars: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({
          owner: 'freeCodeCamp',
          name: 'freeCodeCamp',
          ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/9892522?v=4',
          description:
            "freeCodeCamp.org's open-source codebase and curriculum. Learn to code for free.",
          language: 'TypeScript',
          stargazersCount: 405000,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const MissingAvatar: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard
        repo={createMockRepo({ ownerAvatarUrl: undefined })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <StarredRepoCard repo={createMockRepo()} />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const repos: StarredRepoCardData[] = [
      createMockRepo(),
      createMockRepo({
        owner: 'microsoft',
        name: 'vscode',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/6154722?v=4',
        description: 'Visual Studio Code',
        language: 'TypeScript',
        stargazersCount: 158000,
      }),
      createMockRepo({
        owner: 'rust-lang',
        name: 'rust',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/5430905?v=4',
        description: 'Empowering everyone to build reliable and efficient software.',
        language: 'Rust',
        stargazersCount: 92000,
      }),
      createMockRepo({
        owner: 'golang',
        name: 'go',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/4314092?v=4',
        description: 'The Go programming language',
        language: 'Go',
        stargazersCount: 120000,
      }),
      createMockRepo({
        owner: 'django',
        name: 'django',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/27804?v=4',
        description: 'The Web framework for perfectionists with deadlines.',
        language: 'Python',
        stargazersCount: 76000,
      }),
    ];

    return (
      <Wrapper width={360}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {repos.map((repo) => (
            <StarredRepoCard
              key={`${repo.owner}/${repo.name}`}
              repo={repo}
              onClick={() => console.info('clicked', repo.name)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
