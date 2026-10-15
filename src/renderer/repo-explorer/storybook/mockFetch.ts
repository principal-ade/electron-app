/**
 * Fetch mock for the ported owner/repo page in Storybook.
 *
 * The ported page (web-ade's `RepoExplorerPage`) talks to Next route handlers
 * under `/api/**`. There is no server in Storybook, so this intercepts
 * `window.fetch` and answers each endpoint with a minimal, correctly-shaped
 * fixture. Unknown endpoints fall through to the real fetch (or `{}`).
 *
 * This is the seam to replace when wiring the real data layer: either back each
 * endpoint with the main-process hosted-API proxy, or keep this for visual
 * stories and add per-story overrides.
 */

import { MOCK_TREE } from '../lib/trpc/client';

const USER = {
  login: 'octocat',
  name: 'Octo Cat',
  email: 'octo@example.com',
  id: 583231,
  avatar_url: 'https://github.com/octocat.png',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

export function installRepoExplorerFetchMock(): void {
  if (typeof window === 'undefined') return;
  const realFetch = window.fetch?.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const raw = urlOf(input);
    const url = new URL(raw, 'http://localhost');
    const p = url.pathname;

    // tRPC tree payload (the page fetches the presigned URL from getTreeUrl).
    if (raw.startsWith('mock://repo-explorer/tree')) return json(MOCK_TREE);

    // ---- auth ----
    if (p === '/api/auth/me')
      return json({ isAuthenticated: true, user: USER });
    if (p === '/api/auth/bootstrap') return json({ ok: true });
    if (p === '/api/auth/refresh') return json({ ok: true });
    if (p === '/api/auth/logout') return json({ ok: true });
    if (p === '/api/auth/token-status')
      return json({
        authenticated: true,
        expiresAt: null,
        expiresIn: null,
        shouldRefresh: false,
      });

    // ---- repo analysis ----
    if (p.startsWith('/api/repo-analysis/'))
      return json({
        cached: false,
        hasWarmVm: false,
        sha: null,
        currentSha: null,
        stale: false,
        lastError: null,
      });

    // ---- trails / tours ----
    if (p.startsWith('/api/trails'))
      return json({ entries: [], viewerIsRepoAdmin: false });
    if (p.startsWith('/api/tours')) return json({ tours: [] });

    // ---- star ----
    if (p.startsWith('/api/github/star/')) return json({ starred: false });

    // ---- github repo sub-resources (most specific first) ----
    if (/\/api\/github\/repo\/[^/]+\/[^/]+\/commits/.test(p))
      return json({ commits: [] });
    if (/\/api\/github\/repo\/[^/]+\/[^/]+\/issues/.test(p))
      return json({ issues: [] });
    if (/\/api\/github\/repo\/[^/]+\/[^/]+\/pull-requests/.test(p))
      return json({ pullRequests: [] });
    if (p.startsWith('/api/github/repo/'))
      return json({ content: '# Mock README\n\nRendered from the Storybook fetch mock.' });

    // ---- github user/org/search ----
    if (p.startsWith('/api/github/user-profile/'))
      return json({ ...USER, bio: 'Mock contributor', public_repos: 12 });
    if (p.startsWith('/api/github/user/orgs')) return json({ orgs: [] });
    if (p.startsWith('/api/github/search')) return json({ repos: [] });
    if (p.startsWith('/api/github/code-search'))
      return json({ items: [], total_count: 0 });
    if (p.startsWith('/api/github/user/'))
      return json({
        user: {
          login: 'octocat',
          name: 'Octo Cat',
          avatarUrl: 'https://github.com/octocat.png',
          bio: null,
          company: null,
          location: null,
          websiteUrl: null,
          twitterUsername: null,
          htmlUrl: 'https://github.com/octocat',
          followersCount: 0,
          followingCount: 0,
        },
        activity: [],
        contributions: [],
        contributedRepos: [],
      });

    // ---- bookmarks / collections / telemetry ----
    if (p.startsWith('/api/starred-collections'))
      return json({ collections: [] });
    if (p.startsWith('/api/repos/community-visits')) return json({ ok: true });

    if (realFetch) return realFetch(input, init);
    return json({});
  };
}
