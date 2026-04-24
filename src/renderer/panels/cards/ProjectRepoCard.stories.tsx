import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { ProjectRepoCard, type ProjectRepoCardData } from './ProjectRepoCard';

const createMockRepo = (overrides: Partial<ProjectRepoCardData> = {}): ProjectRepoCardData => ({
  repoName: 'my-awesome-project',
  ownerLogin: 'octocat',
  ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
  timeLabel: '3h ago',
  isDirty: false,
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

const meta: Meta<typeof ProjectRepoCard> = {
  title: 'Panels/Cards/ProjectRepoCard',
  component: ProjectRepoCard,
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
      <ProjectRepoCard repo={createMockRepo()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const Dirty: Story = {
  render: () => (
    <Wrapper>
      <ProjectRepoCard
        repo={createMockRepo({ isDirty: true, timeLabel: '2m ago' })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoOwner: Story = {
  render: () => (
    <Wrapper>
      <ProjectRepoCard
        repo={createMockRepo({
          ownerLogin: undefined,
          ownerAvatarUrl: undefined,
          timeLabel: '1d ago',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoTime: Story = {
  render: () => (
    <Wrapper>
      <ProjectRepoCard
        repo={createMockRepo({ timeLabel: undefined })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const JustNow: Story = {
  render: () => (
    <Wrapper>
      <ProjectRepoCard
        repo={createMockRepo({ timeLabel: 'just now', isDirty: true })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongRepoName: Story = {
  render: () => (
    <Wrapper width={320}>
      <ProjectRepoCard
        repo={createMockRepo({
          repoName: 'an-extraordinarily-long-repository-name-that-should-truncate',
          timeLabel: '5mo ago',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <ProjectRepoCard repo={createMockRepo()} />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const repos: ProjectRepoCardData[] = [
      createMockRepo({
        repoName: 'frontend-app',
        ownerLogin: 'acme',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
        timeLabel: 'just now',
        isDirty: true,
      }),
      createMockRepo({
        repoName: 'backend-api',
        ownerLogin: 'acme',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
        timeLabel: '15m ago',
      }),
      createMockRepo({
        repoName: 'data-pipeline',
        ownerLogin: 'acme-labs',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
        timeLabel: '2h ago',
        isDirty: true,
      }),
      createMockRepo({
        repoName: 'standalone-tool',
        ownerLogin: undefined,
        ownerAvatarUrl: undefined,
        timeLabel: '3d ago',
      }),
      createMockRepo({
        repoName: 'legacy-system',
        ownerLogin: 'old-corp',
        ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
        timeLabel: '1y ago',
      }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {repos.map((r) => (
            <ProjectRepoCard
              key={r.repoName}
              repo={r}
              onClick={() => console.info('clicked', r.repoName)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
