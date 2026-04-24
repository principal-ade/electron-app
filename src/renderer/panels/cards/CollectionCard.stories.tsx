import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { Bookmark, Flame, Rocket, Sparkles, Star, Wrench } from 'lucide-react';
import { CollectionCard, type CollectionCardData } from './CollectionCard';

const createMockCollection = (
  overrides: Partial<CollectionCardData> = {}
): CollectionCardData => ({
  name: 'Favorites',
  description: 'Repositories I want to keep close.',
  icon: Star,
  repoCount: 12,
  userCount: 0,
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

const meta: Meta<typeof CollectionCard> = {
  title: 'Panels/Cards/CollectionCard',
  component: CollectionCard,
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
      <CollectionCard
        collection={createMockCollection()}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const OrgOwned: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({
          name: 'Frontend Picks',
          description: 'Curated by the platform team.',
          ownerLogin: 'acme-labs',
          isOrgOwned: true,
          icon: Sparkles,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NoDescription: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({ description: null })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({
          description:
            'A long, meandering description that should wrap onto the second line and then be clamped with ellipsis once it runs out of room. Extra words to demonstrate overflow behavior in real-world use.',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const ReposAndUsers: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({
          name: 'My Team',
          description: 'The humans and repos I follow day-to-day.',
          icon: Flame,
          repoCount: 8,
          userCount: 5,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const OnlyUsers: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({
          name: 'Folks to watch',
          description: 'Active contributors I track.',
          icon: Bookmark,
          repoCount: 0,
          userCount: 9,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const SingleRepo: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({
          name: 'One-Off',
          description: null,
          repoCount: 1,
          userCount: 0,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const Empty: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({
          name: 'New Collection',
          description: 'Just created — nothing in it yet.',
          repoCount: 0,
          userCount: 0,
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const DefaultIcon: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard
        collection={createMockCollection({ icon: undefined })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const LongName: Story = {
  render: () => (
    <Wrapper width={260}>
      <CollectionCard
        collection={createMockCollection({
          name: 'An Unreasonably Long Collection Name That Must Truncate',
        })}
        onClick={() => console.info('clicked')}
      />
    </Wrapper>
  ),
};

export const NonInteractive: Story = {
  render: () => (
    <Wrapper>
      <CollectionCard collection={createMockCollection()} />
    </Wrapper>
  ),
};

export const List: Story = {
  render: () => {
    const collections: CollectionCardData[] = [
      createMockCollection({
        name: 'Favorites',
        description: 'Repositories I want to keep close.',
        icon: Star,
        repoCount: 12,
      }),
      createMockCollection({
        name: 'Frontend Picks',
        description: 'Curated by the platform team.',
        icon: Sparkles,
        ownerLogin: 'acme-labs',
        isOrgOwned: true,
        repoCount: 8,
        userCount: 5,
      }),
      createMockCollection({
        name: 'Launch Week',
        description: 'Things we are shipping this quarter.',
        icon: Rocket,
        repoCount: 3,
      }),
      createMockCollection({
        name: 'Tooling',
        description: null,
        icon: Wrench,
        repoCount: 22,
      }),
      createMockCollection({
        name: 'New Collection',
        description: 'Just created — nothing in it yet.',
        repoCount: 0,
        userCount: 0,
      }),
    ];

    return (
      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {collections.map((c) => (
            <CollectionCard
              key={c.name}
              collection={c}
              onClick={() => console.info('clicked', c.name)}
            />
          ))}
        </div>
      </Wrapper>
    );
  },
};
