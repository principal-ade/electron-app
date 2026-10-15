/**
 * Fixture implementation of `repoExplorerService` for Storybook.
 *
 * Storybook has no Electron main process, so the real (IPC-backed) service can't
 * reach GitHub. The story installs this via `setRepoExplorerServiceImpl(...)`.
 */

import type { RepoExplorerServiceImpl } from '../data/repoExplorerService';

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
  created_at: '2021-03-15T10:30:00Z',
  updated_at: '2026-01-04T10:30:00Z',
  pushed_at: '2026-01-04T09:00:00Z',
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

export const mockRepoExplorerService: RepoExplorerServiceImpl = {
  async getRepoInfo() {
    return MOCK_REPO_INFO;
  },
  async getContributors() {
    return {
      contributors: [
        { login: 'alice', avatar_url: 'https://github.com/alice.png', contributions: 342 },
        { login: 'bob', avatar_url: 'https://github.com/bob.png', contributions: 278 },
        { login: 'carol', avatar_url: 'https://github.com/carol.png', contributions: 201 },
        { login: 'dave', avatar_url: 'https://github.com/dave.png', contributions: 155 },
        { login: 'eve', avatar_url: 'https://github.com/eve.png', contributions: 98 },
      ],
      truncated: false,
    };
  },
  async getPackages() {
    return {
      packages: [],
      summary: { packageCount: 0, totalPackages: 0, packageManagers: [] },
    };
  },
  async getTree() {
    return MOCK_TREE;
  },
  async readFile(_owner, _repo, path) {
    return { content: `# Mock README\n\nMock content for ${path}.\n` };
  },
  async getCommits() {
    return { commits: [] };
  },
  async getCommitDetail() {
    return null;
  },
  async getChangedFiles() {
    return new Map();
  },
  async getCommitAuthorsByEmail() {
    return {};
  },
  async isStarred() {
    return false;
  },
  async star() {},
  async unstar() {},
  async searchRepos() {
    return { repos: [], totalCount: 0 };
  },
  async getUserOrganizations() {
    return [];
  },
  async getUserProfile() {
    return null;
  },
  async getIssues() {
    return { issues: [] };
  },
  async getIssue() {
    return null;
  },
  async getPullRequests() {
    return { pullRequests: [] };
  },
  async getPullRequest() {
    return null;
  },
  async getPullRequestFiles() {
    return [];
  },
  async getTours() {
    return { tours: [] };
  },
  async beginTourGeneration(): Promise<never> {
    throw new Error('Tour audio generation is not available yet.');
  },
  async generateTourStep() {},
  async finishTourGeneration() {
    return null;
  },
  async batchGenerate() {
    return { steps: [] };
  },
  async getUserActivity() {
    return null;
  },
};
