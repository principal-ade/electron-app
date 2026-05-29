import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { TrailsView } from './TrailsView';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { GitService } from '../../../main-process-api/GitService';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { TrailPayload } from '@industry-theme/file-city-panel';

/**
 * TrailsView depends on many `window.mainProcess` IPC surfaces plus a set
 * of static service classes. The Storybook preview already stubs the IPC
 * surfaces with safe defaults; here we additionally rewire the static
 * service methods so per-story state (trail library populated or empty)
 * can drive the render branches.
 *
 * The patches are installed once at module load and read from a mutable
 * `activeMocks` cell each call, so per-story `withMocks(...)` swaps
 * state without re-patching the classes.
 */
interface MockState {
  /** Saved-trail entries returned by `TrailLibraryService.list`. */
  trails: TrailIndexEntry[];
  /** Optional id→payload map for `TrailLibraryService.load` (preview pane). */
  payloads?: Record<string, TrailPayload>;
}

let activeMocks: MockState = { trails: [] };

/** Set per-story before returning the rendered element. */
const withMocks = (state: MockState): void => {
  activeMocks = state;
};

// Rewire the static service methods exactly once. Each call reads from
// `activeMocks`, so swapping the cell before render is enough.
(TrailLibraryService as unknown as { list: typeof TrailLibraryService.list }).list =
  async () => ({ entries: activeMocks.trails });
(TrailLibraryService as unknown as { load: typeof TrailLibraryService.load }).load =
  async (id: string) => activeMocks.payloads?.[id] ?? null;
(TrailLibraryService as unknown as {
  onLibraryChanged: typeof TrailLibraryService.onLibraryChanged;
}).onLibraryChanged = () => () => {};

(AlexandriaService as unknown as {
  getRepositories: typeof AlexandriaService.getRepositories;
}).getRepositories = async () => [];

(RepositoryMonitoringService as unknown as {
  getFileTree: typeof RepositoryMonitoringService.getFileTree;
}).getFileTree = async () => null;

(GitService as unknown as { execCommand: typeof GitService.execCommand }).execCommand =
  async () => ({ stdout: '', stderr: '', code: 0, success: true });

// ---------- fixtures ----------

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const REPO_PATH = '/Users/fernando/Developer/desktop-app/electron-app';

const baseTrail: TrailIndexEntry = {
  id: 'trail-base',
  title: 'Auth handshake from login button to session cookie',
  summaryPreview:
    'Walkthrough of the renderer login click, the OAuth exchange, and where the session cookie lands.',
  markerCount: 7,
  fileCount: 5,
  repoNames: ['electron-app'],
  hasDiffSnippets: false,
  createdAt: daysAgo(2),
  updatedAt: minutesAgo(12),
  sizeBytes: 4_821,
  repositoryPath: REPO_PATH,
};

/**
 * Minimal payload — just enough that TrailsView's aggregate-load effect
 * accepts the value and stops refiring. Without this, `load` returning
 * `null` for every fixture id leaves `aggregatePayloads` empty forever,
 * the effect's `setAggregatePayloads(new Map(prev))` creates a new
 * reference each pass, and the effect re-runs in an infinite loop
 * (it depends on `aggregatePayloads`).
 */
const payloadFor = (entry: TrailIndexEntry): TrailPayload => ({
  id: entry.id,
  title: entry.title,
  purpose: entry.purpose ?? 'investigation',
  markers: [],
  views: [],
});

const fixtureTrails: TrailIndexEntry[] = [
  {
    ...baseTrail,
    id: 't-today-1',
    title: 'Auth handshake from login button to session cookie',
    updatedAt: minutesAgo(12),
    markerCount: 7,
    fileCount: 5,
    purpose: 'informative',
    signOffCount: 2,
  },
  {
    ...baseTrail,
    id: 't-today-2',
    title: 'Why does the renderer occasionally see a stale namespace?',
    updatedAt: hoursAgo(2),
    markerCount: 5,
    fileCount: 3,
    purpose: 'investigation',
  },
  {
    ...baseTrail,
    id: 't-yest-1',
    title: 'How a trail payload becomes a 3D city marker',
    updatedAt: hoursAgo(28),
    markerCount: 12,
    fileCount: 8,
    purpose: 'informative',
    signOffCount: 0,
  },
  {
    ...baseTrail,
    id: 't-old-1',
    title: 'Trail index entry shape (promoted from investigation)',
    updatedAt: daysAgo(7),
    markerCount: 3,
    fileCount: 2,
    purpose: 'investigation',
  },
];

// ---------- meta ----------

const meta: Meta<typeof TrailsView> = {
  title: 'PrincipalWindow/TrailsView/TrailsView',
  component: TrailsView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrailsView>;

/**
 * Empty-library landing: no saved trails, so `hasRecentTrails` is false and
 * the landing overlay renders the shared `TrailPromptIdeas` empty state —
 * the "Create a Trail" hero plus the Investigation / Informative prompt
 * cards (the same component HomeView shows on its welcome screen).
 */
export const Landing: Story = {
  render: () => {
    withMocks({ trails: [] });
    return <TrailsView />;
  },
};

/**
 * Landing screen when the user already has saved trails — `hasRecentTrails`
 * is true so the empty-state prompt cards give way to the "Explored
 * Projects" repo-card grid. No `bootstrapTrailId`, so `viewMode` stays on
 * `'landing'` and doesn't auto-flip into the Recent grid.
 */
export const LandingWithRecentAvailable: Story = {
  render: () => {
    const payloads = Object.fromEntries(
      fixtureTrails.map((t) => [t.id, payloadFor(t)]),
    );
    withMocks({ trails: fixtureTrails, payloads });
    return <TrailsView />;
  },
};

/**
 * Recent grid with fixture trails — exercises the day-bucket layout,
 * project filter auto-select, and the preview pane (which mounts the
 * FileCityTrailPanel with a null file tree, since
 * RepositoryMonitoringService.getFileTree is stubbed to null).
 */
export const RecentWithFixtures: Story = {
  render: () => {
    const payloads = Object.fromEntries(
      fixtureTrails.map((t) => [t.id, payloadFor(t)]),
    );
    withMocks({ trails: fixtureTrails, payloads });
    return <TrailsView bootstrapTrailId={fixtureTrails[0].id} />;
  },
};
