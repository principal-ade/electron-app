import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider, slateNeonTheme, useTheme } from '@principal-ade/industry-theme';
import {
  TrailsRecentList,
  type TrailsRecentListGroup,
  type TrailsRecentListRepoInfo,
} from './TrailsRecentList';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const baseTrail: TrailIndexEntry = {
  id: 'trail-base',
  title: 'Auth handshake from login button to session cookie',
  summaryPreview: '',
  markerCount: 7,
  fileCount: 5,
  repoNames: ['electron-app'],
  hasDiffSnippets: false,
  createdAt: daysAgo(2),
  updatedAt: minutesAgo(12),
  sizeBytes: 4_821,
  repositoryPath: '/Users/fernando/Developer/desktop-app/electron-app',
};

/**
 * Per-trail repo metadata used by the fixtures. In production this is
 * resolved against the AlexandriaEntry registry inside TrailsView's
 * `resolveRepo` prop; here we hardcode it so the list renders standalone.
 */
const repoByPath: Record<string, TrailsRecentListRepoInfo> = {
  '/Users/fernando/Developer/desktop-app/electron-app': {
    repoLabel: 'electron-app',
    ownerLogin: 'anthropics',
    owned: true,
  },
  '/Users/fernando/Developer/principal-ai/file-city-panel': {
    repoLabel: 'file-city-panel',
    ownerLogin: 'principal-ai',
    owned: true,
  },
  '/Users/someone/Developer/other-repo': {
    repoLabel: 'other-repo',
    owned: false,
  },
};

const resolveRepoFromFixture = (
  trail: TrailIndexEntry,
): TrailsRecentListRepoInfo => {
  if (trail.repositoryPath && repoByPath[trail.repositoryPath]) {
    return repoByPath[trail.repositoryPath];
  }
  return { repoLabel: 'No repo', owned: false };
};

/**
 * Mirrors TrailsView's Recent-feed column: a bordered, rounded container
 * with `backgroundSecondary`, holding a scrolling inner panel with the
 * production padding (12) and section gap (16). Fills the story canvas
 * so cards stretch to match whatever width the layout gives the column.
 */
const FeedShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 16,
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 10,
          backgroundColor: theme.colors.backgroundSecondary,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

interface InteractiveProps {
  groups: TrailsRecentListGroup[];
  emptyLabel?: string;
}

const Interactive: React.FC<InteractiveProps> = ({ groups, emptyLabel }) => {
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  return (
    <TrailsRecentList
      groups={groups}
      resolveRepo={resolveRepoFromFixture}
      selectedTrailId={selectedTrailId}
      onSelectTrail={(trail) =>
        setSelectedTrailId(selectedTrailId === trail.id ? null : trail.id)
      }
      emptyLabel={emptyLabel}
    />
  );
};

const defaultGroups: TrailsRecentListGroup[] = [
  {
    key: 'today',
    label: 'Today',
    subLabel: 'May 14',
    trails: [
      {
        ...baseTrail,
        id: 't-today-1',
        title: 'Auth handshake from login button to session cookie',
        updatedAt: minutesAgo(12),
        markerCount: 7,
        fileCount: 5,
        purpose: 'informative',
        signOffCount: 2, // verified → green
      },
      {
        ...baseTrail,
        id: 't-today-2',
        title: 'Why does the renderer occasionally see a stale namespace?',
        updatedAt: hoursAgo(2),
        markerCount: 5,
        fileCount: 3,
        purpose: 'investigation',
        repositoryPath: '/Users/fernando/Developer/principal-ai/file-city-panel',
      },
    ],
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    subLabel: 'May 13',
    trails: [
      {
        ...baseTrail,
        id: 't-yest-1',
        title: 'How a trail payload becomes a 3D city marker',
        updatedAt: hoursAgo(28),
        markerCount: 12,
        fileCount: 8,
        purpose: 'informative',
        signOffCount: 0, // unverified → gray
      },
      {
        ...baseTrail,
        id: 't-yest-2',
        title: 'Trail authored in a repo that hasn’t been added here',
        updatedAt: hoursAgo(30),
        markerCount: 3,
        fileCount: 1,
        purpose: 'changelog',
        repositoryPath: '/Users/someone/Developer/other-repo',
      },
    ],
  },
  {
    key: 'older',
    label: 'Earlier',
    subLabel: 'May 7',
    trails: [
      {
        ...baseTrail,
        id: 't-old-1',
        title: 'Trail index entry shape (promoted from investigation)',
        updatedAt: daysAgo(7),
        markerCount: 3,
        fileCount: 2,
        purpose: 'investigation',
      },
    ],
  },
];

const meta: Meta<typeof TrailsRecentList> = {
  title: 'PrincipalWindow/TrailsView/TrailsRecentList',
  component: TrailsRecentList,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh' }}>
          <FeedShell>
            <Story />
          </FeedShell>
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrailsRecentList>;

/** The Recent feed end-to-end: three day-buckets with mixed owned states. */
export const DateGrouped: Story = {
  render: () => <Interactive groups={defaultGroups} />,
};

/** Empty state — default "No matching trails." copy. */
export const Empty: Story = {
  render: () => <Interactive groups={[]} />,
};

/** Empty state with a custom label, to confirm the prop wires through. */
export const EmptyCustomLabel: Story = {
  render: () => (
    <Interactive groups={[]} emptyLabel="No trails match this filter yet." />
  ),
};

/** Single section — useful for judging the gap between header and first card. */
export const SingleBucket: Story = {
  render: () => <Interactive groups={[defaultGroups[0]]} />,
};

/** Single section, many cards — for judging scroll density inside one bucket. */
export const DenseSingleBucket: Story = {
  render: () => (
    <Interactive
      groups={[
        {
          key: 'today',
          label: 'Today',
          subLabel: 'May 14',
          trails: Array.from({ length: 10 }, (_, i) => ({
            ...baseTrail,
            id: `bulk-${i}`,
            title: `Trail #${i + 1} — generated entry for density testing`,
            updatedAt: minutesAgo((i + 1) * 17),
            markerCount: ((i * 3) % 12) + 1,
            fileCount: ((i * 2) % 8) + 1,
            purpose: (['investigation', 'informative', 'changelog'] as const)[
              i % 3
            ],
            repositoryPath:
              i % 3 === 0
                ? '/Users/fernando/Developer/desktop-app/electron-app'
                : '/Users/fernando/Developer/principal-ai/file-city-panel',
          })),
        },
      ]}
    />
  ),
};

/** All cards belong to a repo that isn't in the registry — dimmed throughout. */
export const AllOrphanRepos: Story = {
  render: () => (
    <Interactive
      groups={[
        {
          key: 'today',
          label: 'Today',
          subLabel: 'May 14',
          trails: [
            {
              ...baseTrail,
              id: 'o-1',
              title: 'Trail from a repo not in your registry',
              repositoryPath: '/Users/someone/Developer/other-repo',
              updatedAt: minutesAgo(40),
              fileCount: 4,
            },
            {
              ...baseTrail,
              id: 'o-2',
              title: 'Another orphan trail',
              repositoryPath: '/Users/someone/Developer/other-repo',
              updatedAt: hoursAgo(3),
              markerCount: 4,
              fileCount: 2,
            },
          ],
        },
      ]}
    />
  ),
};
