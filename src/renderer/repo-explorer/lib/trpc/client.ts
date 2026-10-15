/**
 * Storybook stub for the web-ade tRPC client.
 *
 * The real client (web-ade `src/lib/trpc/client.ts`) talks to `/api/trpc` on the
 * Next server via `@trpc/client`. The desktop port has no Next server, so this
 * module stands in with fixtures, letting the ported `RepoExplorerPage` render
 * in Storybook. When wiring real data, replace this with a main-process
 * hosted-API proxy (see the WebAdeService plan) exposing the same call shape:
 *   trpc.<router>.<proc>.query(input) / .mutate(input)
 */

const MOCK_REPO_INFO = {
  id: 1,
  name: 'principal-view',
  full_name: 'principal-ade/principal-view',
  private: false,
  owner: {
    login: 'principal-ade',
    id: 1,
    avatar_url: 'https://github.com/principal-ade.png',
    type: 'Organization',
  },
  html_url: 'https://github.com/principal-ade/principal-view',
  description:
    'A mock repository used to render the ported owner/repo page in Storybook.',
  fork: false,
  url: 'https://api.github.com/repos/principal-ade/principal-view',
  clone_url: 'https://github.com/principal-ade/principal-view.git',
  created_at: '2021-03-15T10:30:00Z',
  updated_at: '2026-01-04T10:30:00Z',
  pushed_at: '2026-01-04T09:00:00Z',
  homepage: null,
  size: 5432,
  stargazers_count: 1247,
  watchers_count: 87,
  language: 'TypeScript',
  forks_count: 234,
  open_issues_count: 42,
  default_branch: 'main',
  topics: ['typescript', 'react', 'electron'],
  visibility: 'public',
  license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
};

const MOCK_CONTRIBUTORS = {
  contributors: [
    { login: 'alice', id: 1, avatar_url: 'https://github.com/alice.png', html_url: 'https://github.com/alice', contributions: 342 },
    { login: 'bob', id: 2, avatar_url: 'https://github.com/bob.png', html_url: 'https://github.com/bob', contributions: 278 },
    { login: 'carol', id: 3, avatar_url: 'https://github.com/carol.png', html_url: 'https://github.com/carol', contributions: 201 },
    { login: 'dave', id: 4, avatar_url: 'https://github.com/dave.png', html_url: 'https://github.com/dave', contributions: 155 },
    { login: 'eve', id: 5, avatar_url: 'https://github.com/eve.png', html_url: 'https://github.com/eve', contributions: 98 },
  ],
  truncated: false,
};

const MOCK_PACKAGES = {
  packages: [],
  summary: { packageCount: 0, totalPackages: 0, packageManagers: [] },
};

const MOCK_TREE = {
  sha: 'mock-sha',
  tree: [
    { path: 'README.md', type: 'blob', size: 1200 },
    { path: 'package.json', type: 'blob', size: 420 },
    { path: 'tsconfig.json', type: 'blob', size: 320 },
    { path: 'src/index.ts', type: 'blob', size: 300 },
    { path: 'src/app.ts', type: 'blob', size: 800 },
    { path: 'src/components/Button.tsx', type: 'blob', size: 640 },
    { path: 'src/components/Input.tsx', type: 'blob', size: 512 },
    { path: 'src/utils/helpers.ts', type: 'blob', size: 220 },
    { path: 'src/hooks/useData.ts', type: 'blob', size: 410 },
    { path: 'tests/app.test.ts', type: 'blob', size: 900 },
  ],
};

// The page fetches this URL after `getTreeUrl` resolves; the fetch mock in
// `storybook/mockFetch.ts` recognises the scheme and returns MOCK_TREE.
export const MOCK_TREE_URL = 'mock://repo-explorer/tree';
export { MOCK_REPO_INFO, MOCK_CONTRIBUTORS, MOCK_PACKAGES, MOCK_TREE };

const ok = <T>(value: T) => async (_input?: unknown): Promise<T> => value;

export const trpc: any = {
  github: {
    getRepoInfo: { query: ok(MOCK_REPO_INFO) },
    getRepoPackages: { query: ok(MOCK_PACKAGES) },
    getRepoContributors: { query: ok(MOCK_CONTRIBUTORS) },
    getTreeUrl: { query: ok({ url: MOCK_TREE_URL, sha: MOCK_TREE.sha }) },
    readFile: {
      query: async ({ path }: { path: string }) => ({
        content: `// mock content for ${path}\n`,
      }),
    },
    getCommitAuthorsByEmail: { query: ok({}) },
  },
  tts: {
    beginTourGeneration: { mutate: ok({ runId: 'mock-run' }) },
    generateTourStep: { mutate: ok({}) },
    finishTourGeneration: { mutate: ok({}) },
    batchGenerate: { mutate: ok({ audio: {} }) },
  },
};
