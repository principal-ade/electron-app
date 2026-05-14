import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { TrailCard } from './TrailCard';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const baseTrail: TrailIndexEntry = {
  id: 'trail-auth-flow',
  title: 'Auth handshake from login button to session cookie',
  summaryPreview:
    'Walkthrough of the renderer login click, the main-process OAuth exchange, and where the session cookie lands.',
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
 * Recent view bucket: a single column at a realistic width so the title
 * truncation, marker dots, and meta row sit the way they do in production.
 */
const Bucket: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: 280,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    {children}
  </div>
);

const Interactive: React.FC<{
  trail: TrailIndexEntry;
  metaMode: 'repo' | 'date';
  repoLabel: string;
  ownerLogin?: string;
  owned: boolean;
}> = ({ trail, metaMode, repoLabel, ownerLogin, owned }) => {
  const [selected, setSelected] = useState(false);
  return (
    <TrailCard
      trail={trail}
      metaMode={metaMode}
      selected={selected}
      onSelect={() => setSelected((s) => !s)}
      repoLabel={repoLabel}
      ownerLogin={ownerLogin}
      owned={owned}
    />
  );
};

const meta: Meta<typeof TrailCard> = {
  title: 'PrincipalWindow/TrailsView/TrailCard',
  component: TrailCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <Bucket>
          <Story />
        </Bucket>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrailCard>;

/** Date-grouping bucket: the meta line shows owner avatar + repo label. */
export const DateGroupedRepoMeta: Story = {
  render: () => (
    <Interactive
      trail={baseTrail}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Investigation purpose — purple border (matches the trail drawer eyebrow). */
export const PurposeInvestigation: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, purpose: 'investigation' }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Informative purpose, verified (stamped) — green border. */
export const PurposeInformativeVerified: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, purpose: 'informative', signOffCount: 2 }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Informative purpose, unverified (no stamps) — gray border. */
export const PurposeInformativeUnverified: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, purpose: 'informative', signOffCount: 0 }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Changelog purpose — orange border (pinned to a diff; matches the drawer eyebrow). */
export const PurposeChangelog: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, purpose: 'changelog' }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Purpose unset on the entry — schema default is investigation. */
export const PurposeUnset: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, purpose: undefined }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Project-grouping bucket: the meta line shows relative time. */
export const ProjectGroupedDateMeta: Story = {
  render: () => (
    <Interactive
      trail={baseTrail}
      metaMode="date"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

export const Selected: Story = {
  render: () => (
    <TrailCard
      trail={baseTrail}
      metaMode="repo"
      selected
      onSelect={() => {}}
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/** Trail whose repo isn't in the Alexandria registry: dimmed + different tooltip. */
export const OrphanRepo: Story = {
  render: () => (
    <Interactive
      trail={{
        ...baseTrail,
        title: 'Trail authored in a repo that hasn’t been added here',
        repositoryPath: '/Users/someone/Developer/other-repo',
      }}
      metaMode="repo"
      repoLabel="other-repo"
      ownerLogin={undefined}
      owned={false}
    />
  ),
};

export const NoOwnerAvatar: Story = {
  render: () => (
    <Interactive
      trail={baseTrail}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin={undefined}
      owned
    />
  ),
};

export const NoFiles: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, markerCount: 0, fileCount: 0 }}
      metaMode="date"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

export const SingleFile: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, markerCount: 3, fileCount: 1 }}
      metaMode="date"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

export const ManyFiles: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, markerCount: 24, fileCount: 17 }}
      metaMode="date"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

export const UntitledTrail: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, title: '' }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

export const LongTitle: Story = {
  render: () => (
    <Interactive
      trail={{
        ...baseTrail,
        title:
          'A deliberately long title that should be truncated with an ellipsis rather than wrapping or overflowing the card width',
      }}
      metaMode="repo"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

export const OldTrail: Story = {
  render: () => (
    <Interactive
      trail={{ ...baseTrail, updatedAt: daysAgo(42) }}
      metaMode="date"
      repoLabel="electron-app"
      ownerLogin="anthropics"
      owned
    />
  ),
};

/**
 * The two meta modes side-by-side at the production card width so visual
 * regressions in either branch jump out without flipping between stories.
 *
 * For list-shaped stories (date-bucketed feed, empty state, density), see
 * `TrailsRecentList.stories.tsx`.
 */
export const BothMetaModesSideBySide: Story = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      <Bucket>
        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          metaMode = "repo"
        </div>
        <Interactive
          trail={baseTrail}
          metaMode="repo"
          repoLabel="electron-app"
          ownerLogin="anthropics"
          owned
        />
        <Interactive
          trail={{ ...baseTrail, id: 'b', title: 'A second trail', markerCount: 3, fileCount: 2 }}
          metaMode="repo"
          repoLabel="electron-app"
          ownerLogin="anthropics"
          owned
        />
      </Bucket>
      <Bucket>
        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          metaMode = "date"
        </div>
        <Interactive
          trail={baseTrail}
          metaMode="date"
          repoLabel="electron-app"
          ownerLogin="anthropics"
          owned
        />
        <Interactive
          trail={{ ...baseTrail, id: 'b', updatedAt: hoursAgo(5), title: 'A second trail', markerCount: 3, fileCount: 2 }}
          metaMode="date"
          repoLabel="electron-app"
          ownerLogin="anthropics"
          owned
        />
      </Bucket>
    </div>
  ),
};
