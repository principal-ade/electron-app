import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import { CollectionRepoCard, type CollectionRepoCardData } from './CollectionRepoCard';

const buildMockTree = (rootPath: string): FileTree => {
  const files = [
    'src/index.ts',
    'src/app.ts',
    'src/components/Button.tsx',
    'src/components/Card.tsx',
    'src/components/Modal.tsx',
    'src/utils/format.ts',
    'src/utils/parse.ts',
    'src/styles/main.css',
    'README.md',
    'package.json',
    'tests/app.test.ts',
    'tests/components/Button.test.tsx',
  ];
  return new PathsFileTreeBuilder().build({ files, rootPath });
};

const createMockRepo = (overrides: Partial<CollectionRepoCardData> = {}): CollectionRepoCardData => ({
  owner: 'facebook',
  repo: 'react',
  ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
  description: 'The library for web and native user interfaces.',
  language: 'JavaScript',
  stars: 230000,
  ...overrides,
});

const Wrapper: React.FC<{ children: React.ReactNode; width?: number }> = ({
  children,
  width = 420,
}) => (
  <ThemeProvider>
    <div style={{ padding: 24, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ maxWidth: width }}>{children}</div>
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof CollectionRepoCard> = {
  title: 'Panels/Cards/CollectionRepoCard',
  component: CollectionRepoCard,
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
      <CollectionRepoCard
        repo={createMockRepo()}
        fileTree={buildMockTree('react')}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const TreeLoading: Story = {
  render: () => (
    <Wrapper>
      <CollectionRepoCard repo={createMockRepo()} treeLoading onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const NoTree: Story = {
  render: () => (
    <Wrapper>
      <CollectionRepoCard repo={createMockRepo()} fileTree={null} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const NoMetadata: Story = {
  render: () => (
    <Wrapper>
      <CollectionRepoCard
        repo={createMockRepo({ description: undefined, language: undefined, stars: undefined })}
        fileTree={buildMockTree('react')}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <Wrapper>
      <CollectionRepoCard
        repo={createMockRepo({
          description:
            'A long description that should clamp to two lines so the cards in a grid all stay roughly the same height even when one repo has a wordy README summary attached to it.',
        })}
        fileTree={buildMockTree('react')}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const Grid: Story = {
  render: () => {
    const repos: CollectionRepoCardData[] = [
      createMockRepo({
        owner: 'facebook',
        repo: 'react',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
        description: 'The library for web and native user interfaces.',
        language: 'JavaScript',
        stars: 230000,
      }),
      createMockRepo({
        owner: 'microsoft',
        repo: 'vscode',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/6154722?v=4',
        description: 'Visual Studio Code',
        language: 'TypeScript',
        stars: 162000,
      }),
      createMockRepo({
        owner: 'rust-lang',
        repo: 'rust',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/5430905?v=4',
        description: 'Empowering everyone to build reliable and efficient software.',
        language: 'Rust',
        stars: 97000,
      }),
      createMockRepo({
        owner: 'django',
        repo: 'django',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/27804?v=4',
        description: 'The Web framework for perfectionists with deadlines.',
        language: 'Python',
        stars: 78000,
      }),
    ];

    return (
      <ThemeProvider>
        <div style={{ padding: 24, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
              gap: 16,
            }}
          >
            {repos.map((r) => (
              <CollectionRepoCard
                key={`${r.owner}/${r.repo}`}
                repo={r}
                fileTree={buildMockTree(r.repo)}
                onClick={() => console.info('clicked', r.repo)}
              />
            ))}
          </div>
        </div>
      </ThemeProvider>
    );
  },
};
