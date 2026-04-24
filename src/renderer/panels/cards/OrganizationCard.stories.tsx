import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { OrganizationCard, type OrganizationCardData } from './OrganizationCard';

const createMockOrg = (overrides: Partial<OrganizationCardData> = {}): OrganizationCardData => ({
  login: 'github',
  avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
  description: 'How people build software.',
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

const meta: Meta<typeof OrganizationCard> = {
  title: 'Panels/Cards/OrganizationCard',
  component: OrganizationCard,
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
      <OrganizationCard organization={createMockOrg()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const WithActivity: Story = {
  render: () => (
    <Wrapper>
      <OrganizationCard
        organization={createMockOrg({ hasActivity: true })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoDescription: Story = {
  render: () => (
    <Wrapper>
      <OrganizationCard
        organization={createMockOrg({ description: null })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <Wrapper>
      <OrganizationCard
        organization={createMockOrg({
          login: 'facebook',
          avatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
          description:
            'We are working to build community through open source technology. NB: members must have two-factor auth.',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongName: Story = {
  render: () => (
    <Wrapper width={260}>
      <OrganizationCard
        organization={createMockOrg({
          login: 'very-long-organization-name-that-truncates',
          description: 'Short description',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const MissingAvatar: Story = {
  render: () => (
    <Wrapper>
      <OrganizationCard
        organization={createMockOrg({ avatarUrl: 'https://invalid.example/nope.png' })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <OrganizationCard organization={createMockOrg()} />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const orgs: OrganizationCardData[] = [
      createMockOrg({
        login: 'github',
        avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
        description: 'How people build software.',
        hasActivity: true,
      }),
      createMockOrg({
        login: 'facebook',
        avatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
        description: 'We are working to build community through open source technology.',
      }),
      createMockOrg({
        login: 'microsoft',
        avatarUrl: 'https://avatars.githubusercontent.com/u/6154722?v=4',
        description: 'Open source projects and samples from Microsoft.',
        hasActivity: true,
      }),
      createMockOrg({
        login: 'rust-lang',
        avatarUrl: 'https://avatars.githubusercontent.com/u/5430905?v=4',
        description: 'The Rust Programming Language',
      }),
      createMockOrg({
        login: 'vercel',
        avatarUrl: 'https://avatars.githubusercontent.com/u/14985020?v=4',
        description: null,
      }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {orgs.map((o) => (
            <OrganizationCard
              key={o.login}
              organization={o}
              onClick={() => console.info('clicked', o.login)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
