import {
  repoDisplayLabel,
  repoDisplayNameFromPurl,
  repoPurlFromEntry,
} from './repoPurl';
import {
  createLocalRepoPurl,
  type AlexandriaEntry,
  type Purl,
} from '@principal-ai/alexandria-core-library';

/**
 * The contract that makes the Topics-panel "This repo" filter work: the PURL
 * derived here must equal the membership `repositoryId` the sync mirrors into a
 * topic's `repos`. Both go through this function, so we pin its precedence:
 * explicit purl → github.purl → local-path fallback.
 */
const entry = (over: Partial<AlexandriaEntry>): AlexandriaEntry =>
  ({
    name: 'repo',
    registeredAt: '2026-01-01T00:00:00.000Z',
    hasViews: false,
    viewCount: 0,
    views: [],
    ...over,
  }) as AlexandriaEntry;

describe('repoPurlFromEntry', () => {
  it('passes through an already-minted Purl string', () => {
    const purl = 'pkg:github/acme/web' as Purl;
    expect(repoPurlFromEntry(purl)).toBe(purl);
  });

  it('prefers the entry purl', () => {
    expect(
      repoPurlFromEntry(entry({ purl: 'pkg:github/acme/web' as Purl })),
    ).toBe('pkg:github/acme/web');
  });

  it('falls back to github.purl when the entry has no top-level purl', () => {
    expect(
      repoPurlFromEntry(
        entry({ github: { purl: 'pkg:github/acme/api' as Purl } as never }),
      ),
    ).toBe('pkg:github/acme/api');
  });

  it('falls back to a local-path purl for a registry entry with a path only', () => {
    const path = '/Users/me/dev/local-repo';
    expect(
      repoPurlFromEntry(entry({ path: path as AlexandriaEntry['path'] })),
    ).toBe(createLocalRepoPurl(path));
  });

  it('returns null when nothing identifies the repo', () => {
    expect(repoPurlFromEntry(entry({}))).toBeNull();
  });
});

describe('repoDisplayNameFromPurl', () => {
  it('names a provider repo by its last path segment', () => {
    expect(repoDisplayNameFromPurl('pkg:github/acme/web')).toBe('web');
    expect(repoDisplayNameFromPurl('pkg:gitlab/acme/platform/api')).toBe('api');
  });

  it('names a local repo by the final path segment of the encoded path', () => {
    expect(
      repoDisplayNameFromPurl(createLocalRepoPurl('/Users/me/dev/widgets')),
    ).toBe('widgets');
  });

  it('takes the last segment when the local path itself contains hyphens', () => {
    // `encodePathForPurl` flattens `/` and `-` to the same character, so a
    // hyphenated folder name is not recoverable from the PURL — this pins the
    // heuristic (last dash-delimited segment) that the projects rail shares.
    expect(
      repoDisplayNameFromPurl(createLocalRepoPurl('/Users/me/dev/my-app')),
    ).toBe('app');
  });

  it('falls back to the raw string when the purl is unparseable', () => {
    expect(repoDisplayNameFromPurl('not-a-purl')).toBe('not-a-purl');
  });
});

describe('repoDisplayLabel', () => {
  it('returns null when a topic declares no repos', () => {
    expect(repoDisplayLabel(undefined)).toBeNull();
    expect(repoDisplayLabel([])).toBeNull();
  });

  it('joins repo names in declaration order', () => {
    expect(
      repoDisplayLabel(['pkg:github/acme/web', 'pkg:github/acme/api']),
    ).toBe('web, api');
  });

  it('collapses to a `+N more` tail past the max', () => {
    expect(
      repoDisplayLabel(
        [
          'pkg:github/acme/a',
          'pkg:github/acme/b',
          'pkg:github/acme/c',
          'pkg:github/acme/d',
        ],
        2,
      ),
    ).toBe('a, b, +2 more');
  });
});
