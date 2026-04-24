import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { WatchedUserCard, type WatchedUserCardData } from './WatchedUserCard';

const createMockUser = (overrides: Partial<WatchedUserCardData> = {}): WatchedUserCardData => ({
  login: 'octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
  isOrganization: false,
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

const meta: Meta<typeof WatchedUserCard> = {
  title: 'Panels/Cards/WatchedUserCard',
  component: WatchedUserCard,
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
      <WatchedUserCard user={createMockUser()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const Organization: Story = {
  render: () => (
    <Wrapper>
      <WatchedUserCard
        user={createMockUser({
          login: 'facebook',
          avatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
          isOrganization: true,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <WatchedUserCard user={createMockUser()} />
    </Wrapper>
  ),
};

export const LongUsername: Story = {
  render: () => (
    <Wrapper width={320}>
      <WatchedUserCard
        user={createMockUser({
          login: 'this-is-a-very-long-github-username-that-should-truncate',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const users: WatchedUserCardData[] = [
      createMockUser({
        login: 'alice',
        avatarUrl: 'https://i.pravatar.cc/80?img=1',
      }),
      createMockUser({
        login: 'facebook',
        avatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
        isOrganization: true,
      }),
      createMockUser({
        login: 'charlie',
        avatarUrl: 'https://i.pravatar.cc/80?img=3',
      }),
      createMockUser({
        login: 'rust-lang',
        avatarUrl: 'https://avatars.githubusercontent.com/u/5430905?v=4',
        isOrganization: true,
      }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u) => (
            <WatchedUserCard
              key={u.login}
              user={u}
              onClick={() => console.info('clicked', u.login)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
