import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import {
  buildCityDataFromFileTree,
  estimateLineCounts,
  type CityData,
} from '@industry-theme/repository-composition-panels';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { RepoTrailCoverageCard } from './RepoTrailCoverageCard';

const buildCity = (repoName: string, files: string[]): CityData => {
  const tree = new PathsFileTreeBuilder().build({
    files: files.map((f) => `${repoName}/${f}`),
    rootPath: repoName,
  });
  return estimateLineCounts(buildCityDataFromFileTree(tree, ''));
};

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

const CITY = buildCity('electron-app', REPO_FILES);

const BIG_CITY = buildCity('big-app', [
  ...Array.from({ length: 11 }, (_, d) =>
    Array.from({ length: 9 }, (_, f) => `src/module${d}/file${f}.ts`),
  ).flat(),
  'package.json',
  'README.md',
]);

const countTrails = (trails: string[][]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const paths of trails) {
    for (const p of paths) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
};

const DEMO_TRAILS = [
  ['src/auth/login.ts', 'src/auth/session.ts', 'src/hooks/useAuth.ts'],
  ['src/auth/login.ts', 'src/auth/tokens.ts', 'src/store/sessionSlice.ts'],
  ['src/api/routes.ts', 'src/api/handlers.ts', 'src/auth/session.ts'],
  ['src/components/Header.tsx', 'src/components/Sidebar.tsx'],
  ['src/utils/http.ts', 'src/api/middleware.ts', 'src/api/routes.ts'],
];

const BIG_TRAILS = [
  ['src/module0/file1.ts', 'src/module0/file2.ts', 'src/module3/file4.ts'],
  ['src/module3/file4.ts', 'src/module3/file5.ts', 'src/module7/file0.ts'],
  ['src/module7/file0.ts', 'src/module7/file8.ts', 'src/module0/file1.ts'],
  ['src/module5/file3.ts', 'src/module5/file6.ts'],
  ['src/module9/file2.ts', 'src/module3/file4.ts', 'src/module7/file0.ts'],
  ['src/module1/file0.ts', 'src/module1/file4.ts'],
];

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <div
      style={{
        padding: 24,
        background: '#1a1a1a',
        minHeight: '100vh',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 20,
        alignItems: 'flex-start',
      }}
    >
      {children}
    </div>
  </ThemeProvider>
);

const meta: Meta<typeof RepoTrailCoverageCard> = {
  title: 'Trails/RepoTrailCoverageCard',
  component: RepoTrailCoverageCard,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="electron-app"
        ownerLogin="microsoft"
        cityData={CITY}
        coverageByPath={countTrails(DEMO_TRAILS)}
        trailCount={DEMO_TRAILS.length}
        onClick={() => console.info('open electron-app')}
      />
    </Frame>
  ),
};

/** No owner login → folder-icon fallback in the header. */
export const NoOwnerAvatar: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="local-scratch-repo"
        cityData={CITY}
        coverageByPath={countTrails(DEMO_TRAILS.slice(0, 2))}
        trailCount={2}
      />
    </Frame>
  ),
};

/** Denser city, more trails. */
export const DenseRepo: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="big-app"
        ownerLogin="vercel"
        cityData={BIG_CITY}
        coverageByPath={countTrails(BIG_TRAILS)}
        trailCount={BIG_TRAILS.length}
      />
    </Frame>
  ),
};

/** A single trail touching one file — smallest coverage. */
export const SingleTrail: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="tiny-utility"
        ownerLogin="facebook"
        cityData={CITY}
        coverageByPath={countTrails([['src/utils/http.ts']])}
        trailCount={1}
      />
    </Frame>
  ),
};

/** Still resolving the repo's city + coverage. */
export const Loading: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="resolving-repo"
        ownerLogin="microsoft"
        cityData={null}
        trailCount={4}
        loading
      />
    </Frame>
  ),
};

/** Resolved, but the repo tree isn't cached (never opened in the app). */
export const NoCity: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="never-opened-repo"
        ownerLogin="vercel"
        cityData={null}
        trailCount={2}
      />
    </Frame>
  ),
};

/** The grid as it'd appear in the trails view — every card the same square. */
export const Grid: Story = {
  render: () => (
    <Frame>
      <RepoTrailCoverageCard
        repoLabel="electron-app"
        ownerLogin="microsoft"
        cityData={CITY}
        coverageByPath={countTrails(DEMO_TRAILS)}
        trailCount={DEMO_TRAILS.length}
      />
      <RepoTrailCoverageCard
        repoLabel="big-app"
        ownerLogin="vercel"
        cityData={BIG_CITY}
        coverageByPath={countTrails(BIG_TRAILS)}
        trailCount={BIG_TRAILS.length}
      />
      <RepoTrailCoverageCard
        repoLabel="tiny-utility"
        ownerLogin="facebook"
        cityData={CITY}
        coverageByPath={countTrails([['src/utils/http.ts']])}
        trailCount={1}
      />
      <RepoTrailCoverageCard
        repoLabel="local-scratch-repo"
        cityData={CITY}
        coverageByPath={countTrails(DEMO_TRAILS.slice(0, 3))}
        trailCount={3}
      />
    </Frame>
  ),
};
