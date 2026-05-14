import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { RecentTrailsCard } from './RecentTrailsCard';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const baseEntries: TrailIndexEntry[] = [
  {
    id: 'trail-auth-flow',
    title: 'Auth handshake from login button to session cookie',
    summaryPreview:
      'Walkthrough of the renderer login click, the main-process OAuth exchange, and where the session cookie lands.',
    markerCount: 7,
    repoNames: ['electron-app'],
    hasDiffSnippets: false,
    createdAt: daysAgo(2),
    updatedAt: minutesAgo(12),
    sizeBytes: 4821,
    repositoryPath: '/Users/fernando/Developer/desktop-app/electron-app',
  },
  {
    id: 'trail-trail-render',
    title: 'How a trail payload becomes a 3D city marker',
    summaryPreview:
      'POST hits the Principal MCP Bridge, the index event fires, the panel reducer claims it, the marker renders.',
    markerCount: 12,
    repoNames: ['electron-app', 'file-city-panel'],
    hasDiffSnippets: true,
    createdAt: daysAgo(4),
    updatedAt: hoursAgo(3),
    sizeBytes: 9_204,
  },
  {
    id: 'trail-investigation-ipc',
    title: 'Investigation: why does the renderer occasionally see a stale namespace?',
    summaryPreview:
      'Reproduces the bug, narrows it to a race between scope-manager rebuilds and the namespace event flush.',
    markerCount: 5,
    repoNames: ['electron-app'],
    hasDiffSnippets: false,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
    sizeBytes: 3_310,
  },
  {
    id: 'trail-promoted-shape',
    title: 'Trail index entry shape (promoted from investigation)',
    summaryPreview:
      'Canonical reference for what a TrailIndexEntry carries — covers the host-private fields the portable payload omits.',
    markerCount: 3,
    repoNames: ['electron-app'],
    hasDiffSnippets: false,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(6),
    sizeBytes: 1_842,
    derivedFrom: 'trail-investigation-ipc',
  },
];

const longSummary = `## Auth handshake

1. The login button in the **renderer** dispatches \`auth:login-requested\`.
2. The main process opens a system browser, runs the OAuth exchange, and writes the resulting session cookie into the partition that the dev-workspace BrowserView shares.
3. The renderer's \`AuthService\` polls the cookie store on visibility-change and resolves the in-flight promise once the cookie is present.

Failure mode worth flagging: if the OAuth window is closed before the redirect completes, the main process never resolves the IPC, and the renderer hangs forever. There's a 60s timeout in \`AuthService\` but the UX is poor — a future trail should cover the cleanup path.`;

const CityBackdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: '100vw',
      height: '100vh',
      background:
        'radial-gradient(circle at 30% 30%, #2a3550 0%, #0f1320 60%, #05070d 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '55%',
        background:
          'repeating-linear-gradient(90deg, #1a2238 0 24px, #232c46 24px 56px, #1a2238 56px 96px)',
        opacity: 0.85,
      }}
    />
    {children}
  </div>
);

interface InteractiveProps {
  entries: TrailIndexEntry[];
  summaryByTrail?: Map<string, string>;
  onOpenTrail?: (id: string) => void;
  initialSelectedTrailId?: string | null;
}

const Interactive: React.FC<InteractiveProps> = ({
  entries,
  summaryByTrail,
  onOpenTrail,
  initialSelectedTrailId = null,
}) => {
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(
    initialSelectedTrailId,
  );
  return (
    <RecentTrailsCard
      entries={entries}
      selectedTrailId={selectedTrailId}
      onSelectTrail={setSelectedTrailId}
      summaryByTrail={summaryByTrail}
      onOpenTrail={onOpenTrail}
    />
  );
};

const meta: Meta<typeof RecentTrailsCard> = {
  title: 'DevWorkspace/FileCityPanel/RecentTrailsCard',
  component: RecentTrailsCard,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <CityBackdrop>
          {/* Right-anchored with extra left room so the summary popup
              (which sits to the left of the card) is fully visible. */}
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <Story />
          </div>
        </CityBackdrop>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RecentTrailsCard>;

export const Default: Story = {
  render: () => <Interactive entries={baseEntries} />,
};

export const Empty: Story = {
  render: () => <Interactive entries={[]} />,
};

export const SingleEntry: Story = {
  render: () => <Interactive entries={[baseEntries[0]]} />,
};

export const SelectedWithSummary: Story = {
  render: () => (
    <Interactive
      entries={baseEntries}
      initialSelectedTrailId="trail-auth-flow"
      summaryByTrail={new Map([['trail-auth-flow', longSummary]])}
    />
  ),
};

export const SelectedWithOpenButton: Story = {
  render: () => (
    <Interactive
      entries={baseEntries}
      initialSelectedTrailId="trail-trail-render"
      summaryByTrail={
        new Map([
          [
            'trail-trail-render',
            'POST /trails hits the Principal MCP Bridge. The bridge writes the payload to disk, emits a LIBRARY_CHANGED IPC, and the renderer reducer reconciles the new entry into the panel.',
          ],
        ])
      }
      onOpenTrail={(id) => console.info('[RecentTrailsCard] open', id)}
    />
  ),
};

export const LongTitles: Story = {
  render: () => (
    <Interactive
      entries={[
        {
          ...baseEntries[0],
          title:
            'A deliberately long trail title that should wrap onto multiple lines without breaking the card layout or pushing the relative-time stamp out of alignment',
        },
        ...baseEntries.slice(1),
      ]}
    />
  ),
};

export const ManyEntries: Story = {
  render: () => {
    const many: TrailIndexEntry[] = Array.from({ length: 18 }, (_, i) => ({
      id: `trail-bulk-${i}`,
      title: `Trail #${i + 1} — generated entry for scrollbar testing`,
      summaryPreview: `Summary for bulk trail ${i + 1}.`,
      markerCount: ((i * 3) % 9) + 1,
      repoNames: ['electron-app'],
      hasDiffSnippets: i % 4 === 0,
      createdAt: daysAgo(i + 1),
      updatedAt: hoursAgo(i + 1),
      sizeBytes: 1_000 + i * 250,
    }));
    return <Interactive entries={many} />;
  },
};
