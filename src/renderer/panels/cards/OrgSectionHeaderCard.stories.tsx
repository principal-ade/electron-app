import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import {
  OrgSectionHeaderCard,
  type OrgSectionHeaderCardData,
} from './OrgSectionHeaderCard';

const createMockHeader = (
  overrides: Partial<OrgSectionHeaderCardData> = {}
): OrgSectionHeaderCardData => ({
  orgName: 'acme',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
  repoCount: 7,
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

const meta: Meta<typeof OrgSectionHeaderCard> = {
  title: 'Panels/Cards/OrgSectionHeaderCard',
  component: OrgSectionHeaderCard,
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

export const Expanded: Story = {
  render: () => (
    <Wrapper>
      <OrgSectionHeaderCard
        header={createMockHeader()}
        isCollapsed={false}
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <Wrapper>
      <OrgSectionHeaderCard
        header={createMockHeader()}
        isCollapsed
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const BadgeYou: Story = {
  render: () => (
    <Wrapper>
      <OrgSectionHeaderCard
        header={createMockHeader({ orgName: 'octocat', badge: 'you', repoCount: 3 })}
        isCollapsed={false}
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const BadgeMember: Story = {
  render: () => (
    <Wrapper>
      <OrgSectionHeaderCard
        header={createMockHeader({ badge: 'member' })}
        isCollapsed={false}
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const SingleRepo: Story = {
  render: () => (
    <Wrapper>
      <OrgSectionHeaderCard
        header={createMockHeader({ repoCount: 1 })}
        isCollapsed={false}
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const Untracked: Story = {
  render: () => (
    <Wrapper>
      <OrgSectionHeaderCard
        header={createMockHeader({
          orgName: 'Untracked',
          avatarUrl: undefined,
          isUntracked: true,
          repoCount: 2,
        })}
        isCollapsed={false}
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const LongName: Story = {
  render: () => (
    <Wrapper width={300}>
      <OrgSectionHeaderCard
        header={createMockHeader({
          orgName: 'a-very-long-organization-name-that-should-truncate',
          badge: 'member',
          repoCount: 42,
        })}
        isCollapsed={false}
        onToggle={() => console.info('toggle')}
      />
    </Wrapper>
  ),
};

export const Interactive: Story = {
  render: () => {
    const InteractiveDemo = () => {
      const [collapsed, setCollapsed] = useState(false);
      return (
        <OrgSectionHeaderCard
          header={createMockHeader()}
          isCollapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      );
    };
    return (
      <Wrapper>
        <InteractiveDemo />
      </Wrapper>
    );
  },
};
