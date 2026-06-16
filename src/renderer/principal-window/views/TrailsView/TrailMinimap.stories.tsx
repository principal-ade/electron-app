import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';
import {
  buildCityDataFromFileTree,
  estimateLineCounts,
  type CityData,
} from '@industry-theme/repository-composition-panels';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { TrailMinimap } from './TrailMinimap';

/**
 * Build a CityData from a flat list of repo-relative file paths. Mirrors what
 * `buildCityDataFromContext` does in the app (empty rootPath → repo-relative
 * building paths) but stays in the web bundle: no main-process line counts, so
 * we fall back to `estimateLineCounts` like the real helper does offline.
 */
const buildCity = (repoName: string, files: string[]): CityData => {
  const tree = new PathsFileTreeBuilder().build({
    files: files.map((f) => `${repoName}/${f}`),
    rootPath: repoName,
  });
  return estimateLineCounts(buildCityDataFromFileTree(tree, ''));
};

// A medium-sized TypeScript-ish repo. Paths are repo-relative, matching the
// trail marker `sourcePath` format the real minimap consumes.
const REPO_FILES = [
  'src/index.ts',
  'src/app.ts',
  'src/auth/login.ts',
  'src/auth/session.ts',
  'src/auth/tokens.ts',
  'src/components/Button.tsx',
  'src/components/Input.tsx',
  'src/components/Modal.tsx',
  'src/components/Sidebar.tsx',
  'src/components/Header.tsx',
  'src/hooks/useData.ts',
  'src/hooks/useAuth.ts',
  'src/hooks/useTheme.ts',
  'src/store/userSlice.ts',
  'src/store/sessionSlice.ts',
  'src/store/index.ts',
  'src/utils/format.ts',
  'src/utils/validation.ts',
  'src/utils/http.ts',
  'src/api/routes.ts',
  'src/api/middleware.ts',
  'src/api/handlers.ts',
  'tests/auth.test.ts',
  'tests/components/Button.test.tsx',
  'tests/utils/format.test.ts',
  'docs/README.md',
  'docs/ARCHITECTURE.md',
  'package.json',
  'tsconfig.json',
  'README.md',
];

const CITY = buildCity('demo-app', REPO_FILES);

// A larger repo so we can see coverage read against a denser city.
const BIG_REPO_FILES = Array.from({ length: 11 }, (_, d) =>
  Array.from({ length: 9 }, (_, f) => `src/module${d}/file${f}.ts`),
).flat();
const BIG_CITY = buildCity('big-app', [
  ...BIG_REPO_FILES,
  'package.json',
  'README.md',
]);

/**
 * Renders the minimap on a card-like surface with a title underneath, so the
 * story reads like a real trail card (the eventual integration target).
 */
const MinimapCard: React.FC<{
  title: string;
  cityData: CityData;
  coveredPaths?: string[];
  coverageByPath?: ReadonlyMap<string, number>;
  height?: number;
  width?: number;
}> = ({ title, cityData, coveredPaths, coverageByPath, height, width = 320 }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width,
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      <TrailMinimap
        cityData={cityData}
        coveredPaths={coveredPaths}
        coverageByPath={coverageByPath}
        height={height}
      />
      <div
        style={{
          padding: 12,
          borderTop: `1px solid ${theme.colors.border}`,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        {title}
      </div>
    </div>
  );
};

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <div
      style={{
        padding: 24,
        background: '#1a1a1a',
        minHeight: '100vh',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'flex-start',
      }}
    >
      {children}
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof TrailMinimap> = {
  title: 'Trails/TrailMinimap',
  component: TrailMinimap,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Build an aggregate touch-count map from several trails' path lists — the
 * same shape the all-trails heat map consumes (`trailCountByPath`).
 */
const countTrails = (trails: string[][]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const paths of trails) {
    for (const p of paths) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
};

/**
 * Aggregate "all trails" view — the non-interactive equivalent of the File
 * City panel's heat map. Files touched by 2+ trails are brighter than
 * single-trail files.
 */
export const AllTrailsHeatMap: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="All trails · demo-app"
        cityData={CITY}
        width={420}
        height={260}
        coverageByPath={countTrails([
          ['src/auth/login.ts', 'src/auth/session.ts', 'src/hooks/useAuth.ts'],
          ['src/auth/login.ts', 'src/auth/tokens.ts', 'src/store/sessionSlice.ts'],
          ['src/api/routes.ts', 'src/api/handlers.ts', 'src/auth/session.ts'],
          ['src/components/Header.tsx', 'src/components/Sidebar.tsx'],
          ['src/utils/http.ts', 'src/api/middleware.ts', 'src/api/routes.ts'],
        ])}
      />
    </Frame>
  ),
};

/** Aggregate view against a denser city. */
export const AllTrailsDense: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="All trails · big-app"
        cityData={BIG_CITY}
        width={520}
        height={320}
        coverageByPath={countTrails([
          ['src/module0/file1.ts', 'src/module0/file2.ts', 'src/module3/file4.ts'],
          ['src/module3/file4.ts', 'src/module3/file5.ts', 'src/module7/file0.ts'],
          ['src/module7/file0.ts', 'src/module7/file8.ts', 'src/module0/file1.ts'],
          ['src/module5/file3.ts', 'src/module5/file6.ts'],
          ['src/module9/file2.ts', 'src/module3/file4.ts', 'src/module7/file0.ts'],
        ])}
      />
    </Frame>
  ),
};

/** A handful of files across a couple of areas — the typical single trail. */
export const Default: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="How login refreshes a session"
        cityData={CITY}
        coveredPaths={[
          'src/auth/login.ts',
          'src/auth/session.ts',
          'src/auth/tokens.ts',
          'src/hooks/useAuth.ts',
          'src/store/sessionSlice.ts',
        ]}
      />
    </Frame>
  ),
};

/** A single-file trail — minimal coverage. */
export const SparseCoverage: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="Where the HTTP timeout lives"
        cityData={CITY}
        coveredPaths={['src/utils/http.ts']}
      />
    </Frame>
  ),
};

/** A wide trail that touches most of the repo. */
export const BroadCoverage: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="End-to-end request path"
        cityData={CITY}
        coveredPaths={[
          'src/index.ts',
          'src/app.ts',
          'src/api/routes.ts',
          'src/api/middleware.ts',
          'src/api/handlers.ts',
          'src/auth/login.ts',
          'src/auth/session.ts',
          'src/store/userSlice.ts',
          'src/store/sessionSlice.ts',
          'src/utils/http.ts',
          'src/utils/validation.ts',
          'src/components/Header.tsx',
          'src/components/Sidebar.tsx',
        ]}
      />
    </Frame>
  ),
};

/** No covered paths resolve — the map renders with no highlight. */
export const NoCoverage: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="Trail with no resolvable files"
        cityData={CITY}
        coveredPaths={[]}
      />
    </Frame>
  ),
};

/**
 * Some covered paths don't exist in the city (renamed/deleted). Only the
 * real ones light up — the stale paths are dropped silently.
 */
export const StalePathsDropped: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="Half the markers point at moved files"
        cityData={CITY}
        coveredPaths={[
          'src/auth/login.ts',
          'src/auth/OLD_session_manager.ts', // gone
          'src/legacy/deprecated.ts', // gone
          'src/hooks/useAuth.ts',
        ]}
      />
    </Frame>
  ),
};

/** Coverage read against a denser city. */
export const DenseRepo: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="Touches three modules"
        cityData={BIG_CITY}
        height={200}
        coveredPaths={[
          'src/module2/file1.ts',
          'src/module2/file4.ts',
          'src/module5/file0.ts',
          'src/module5/file3.ts',
          'src/module5/file7.ts',
          'src/module8/file2.ts',
        ]}
      />
    </Frame>
  ),
};

/** A row of cards, the way they'd appear in the trails list. */
export const CardGrid: Story = {
  render: () => (
    <Frame>
      <MinimapCard
        title="How login refreshes a session"
        cityData={CITY}
        height={140}
        coveredPaths={['src/auth/login.ts', 'src/auth/session.ts', 'src/hooks/useAuth.ts']}
      />
      <MinimapCard
        title="Where the HTTP timeout lives"
        cityData={CITY}
        height={140}
        coveredPaths={['src/utils/http.ts']}
      />
      <MinimapCard
        title="Store wiring"
        cityData={CITY}
        height={140}
        coveredPaths={['src/store/index.ts', 'src/store/userSlice.ts', 'src/store/sessionSlice.ts']}
      />
      <MinimapCard
        title="Component shell"
        cityData={CITY}
        height={140}
        coveredPaths={[
          'src/components/Header.tsx',
          'src/components/Sidebar.tsx',
          'src/components/Modal.tsx',
        ]}
      />
    </Frame>
  ),
};
