import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { WatchedRepoCard, type WatchedRepoCardData } from './WatchedRepoCard';

const createMockRepo = (overrides: Partial<WatchedRepoCardData> = {}): WatchedRepoCardData => ({
  owner: 'facebook',
  repo: 'react',
  ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
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

const meta: Meta<typeof WatchedRepoCard> = {
  title: 'Panels/Cards/WatchedRepoCard',
  component: WatchedRepoCard,
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
      <WatchedRepoCard repo={createMockRepo()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <WatchedRepoCard repo={createMockRepo()} />
    </Wrapper>
  ),
};

export const LongName: Story = {
  render: () => (
    <Wrapper width={340}>
      <WatchedRepoCard
        repo={createMockRepo({
          owner: 'really-long-owner-name',
          repo: 'an-extraordinarily-long-repository-name-that-must-truncate',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const repos: WatchedRepoCardData[] = [
      createMockRepo({
        owner: 'facebook',
        repo: 'react',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
      }),
      createMockRepo({
        owner: 'microsoft',
        repo: 'vscode',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/6154722?v=4',
      }),
      createMockRepo({
        owner: 'rust-lang',
        repo: 'rust',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/5430905?v=4',
      }),
      createMockRepo({
        owner: 'django',
        repo: 'django',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/27804?v=4',
      }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {repos.map((r) => (
            <WatchedRepoCard
              key={`${r.owner}/${r.repo}`}
              repo={r}
              onClick={() => console.info('clicked', r.repo)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
