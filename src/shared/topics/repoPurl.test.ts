import { repoPurlFromEntry } from './repoPurl';
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
