import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { OrgRepoItemCard, type OrgRepoItemCardData } from './OrgRepoItemCard';

const createMockRepo = (overrides: Partial<OrgRepoItemCardData> = {}): OrgRepoItemCardData => ({
  name: 'my-library',
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

const meta: Meta<typeof OrgRepoItemCard> = {
  title: 'Panels/Cards/OrgRepoItemCard',
  component: OrgRepoItemCard,
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
      <OrgRepoItemCard repo={createMockRepo()} onClick={() => console.info('clicked')} />
    </Wrapper>
  ),
};

export const LongName: Story = {
  render: () => (
    <Wrapper width={280}>
      <OrgRepoItemCard
        repo={createMockRepo({
          name: 'an-extraordinarily-long-repository-name-that-should-truncate',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <OrgRepoItemCard repo={createMockRepo()} />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const repos: OrgRepoItemCardData[] = [
      createMockRepo({ name: 'frontend-app' }),
      createMockRepo({ name: 'backend-api' }),
      createMockRepo({ name: 'infrastructure' }),
      createMockRepo({ name: 'docs' }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {repos.map((r) => (
            <OrgRepoItemCard
              key={r.name}
              repo={r}
              onClick={() => console.info('clicked', r.name)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
