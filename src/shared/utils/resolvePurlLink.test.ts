import { resolvePurlLink, type PurlResolverRepo } from './resolvePurlLink';

const repos: PurlResolverRepo[] = [
  {
    purl: 'pkg:github/acme/widgets',
    path: '/Users/me/dev/widgets',
    name: 'widgets',
  },
  {
    // Registered but no local clone on disk.
    purl: 'pkg:github/acme/no-clone',
    path: undefined,
    name: 'no-clone',
  },
];

describe('resolvePurlLink', () => {
  it('resolves a purl with a local clone to an absolute file path', () => {
    const r = resolvePurlLink('pkg:github/acme/widgets#docs/foo.md', repos);
    expect(r).toEqual({
      status: 'local',
      repoPurl: 'pkg:github/acme/widgets',
      subpath: 'docs/foo.md',
      filePath: '/Users/me/dev/widgets/docs/foo.md',
      repositoryPath: '/Users/me/dev/widgets',
    });
  });

  it('matches owner/repo case-insensitively', () => {
    const r = resolvePurlLink('pkg:github/ACME/Widgets#README.md', repos);
    expect(r.status).toBe('local');
    if (r.status === 'local') {
      expect(r.filePath).toBe('/Users/me/dev/widgets/README.md');
    }
  });

  it('returns needs-clone when no registered repo matches', () => {
    const r = resolvePurlLink('pkg:github/other/repo#docs/x.md', repos);
    expect(r).toEqual({
      status: 'needs-clone',
      repoPurl: 'pkg:github/other/repo',
      subpath: 'docs/x.md',
    });
  });

  it('returns needs-clone when the repo is registered without a local clone', () => {
    const r = resolvePurlLink('pkg:github/acme/no-clone#docs/x.md', repos);
    expect(r.status).toBe('needs-clone');
  });

  it('rejects a malformed purl', () => {
    const r = resolvePurlLink('pkg:::::not-a-purl', repos);
    expect(r.status).toBe('unresolvable');
    if (r.status === 'unresolvable') expect(r.reason).toBe('malformed-purl');
  });

  it('rejects a bare repo purl with no file subpath', () => {
    const r = resolvePurlLink('pkg:github/acme/widgets', repos);
    expect(r.status).toBe('unresolvable');
    if (r.status === 'unresolvable') expect(r.reason).toBe('no-subpath');
  });

  it('rejects a subpath that escapes the repo root', () => {
    const r = resolvePurlLink(
      'pkg:github/acme/widgets#../../etc/passwd',
      repos,
    );
    expect(r.status).toBe('unresolvable');
    if (r.status === 'unresolvable') expect(r.reason).toBe('unsafe-path');
  });

  it('normalizes . segments in the subpath', () => {
    const r = resolvePurlLink('pkg:github/acme/widgets#./docs/./foo.md', repos);
    expect(r.status).toBe('local');
    if (r.status === 'local') expect(r.subpath).toBe('docs/foo.md');
  });
});
