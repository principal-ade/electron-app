import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { CoworkerCard, type CoworkerCardData } from './CoworkerCard';

const createMockCoworker = (overrides: Partial<CoworkerCardData> = {}): CoworkerCardData => ({
  login: 'octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
  organizations: ['github'],
  hasActivity: false,
  ...overrides,
});

const Wrapper: React.FC<{ children: React.ReactNode; width?: number }> = ({
  children,
  width = 320,
}) => (
  <ThemeProvider>
    <div style={{ padding: 24, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ maxWidth: width }}>{children}</div>
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof CoworkerCard> = {
  title: 'Panels/Cards/CoworkerCard',
  component: CoworkerCard,
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
      <CoworkerCard coworker={createMockCoworker()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const WithActivity: Story = {
  render: () => (
    <Wrapper>
      <CoworkerCard
        coworker={createMockCoworker({ hasActivity: true })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoOrganizations: Story = {
  render: () => (
    <Wrapper>
      <CoworkerCard
        coworker={createMockCoworker({ organizations: [] })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const MultipleOrganizations: Story = {
  render: () => (
    <Wrapper>
      <CoworkerCard
        coworker={createMockCoworker({
          login: 'alice',
          avatarUrl: 'https://i.pravatar.cc/80?img=1',
          organizations: ['acme', 'acme-labs', 'acme-research', 'open-source-foundation'],
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongUsername: Story = {
  render: () => (
    <Wrapper width={260}>
      <CoworkerCard
        coworker={createMockCoworker({
          login: 'this-is-a-very-long-github-username-that-should-truncate',
          organizations: ['some-organization-with-a-long-name'],
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const MissingAvatar: Story = {
  render: () => (
    <Wrapper>
      <CoworkerCard
        coworker={createMockCoworker({ avatarUrl: 'https://invalid.example/nope.png' })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <CoworkerCard coworker={createMockCoworker()} />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const coworkers: CoworkerCardData[] = [
      createMockCoworker({
        login: 'alice',
        avatarUrl: 'https://i.pravatar.cc/80?img=1',
        organizations: ['acme'],
        hasActivity: true,
      }),
      createMockCoworker({
        login: 'bob',
        avatarUrl: 'https://i.pravatar.cc/80?img=2',
        organizations: ['acme', 'acme-labs'],
      }),
      createMockCoworker({
        login: 'charlie',
        avatarUrl: 'https://i.pravatar.cc/80?img=3',
        organizations: ['acme-labs'],
        hasActivity: true,
      }),
      createMockCoworker({
        login: 'diana',
        avatarUrl: 'https://i.pravatar.cc/80?img=4',
        organizations: [],
      }),
      createMockCoworker({
        login: 'eve',
        avatarUrl: 'https://i.pravatar.cc/80?img=5',
        organizations: ['open-source-foundation'],
      }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {coworkers.map((c) => (
            <CoworkerCard
              key={c.login}
              coworker={c}
              onClick={() => console.info('clicked', c.login)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
