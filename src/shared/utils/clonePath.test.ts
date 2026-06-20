import {
  baseName,
  joinClonePath,
  deriveKnownOwner,
  getConventionStatus,
  getOffConventionTarget,
} from './clonePath';

const BASE = '/Users/dev/code';

describe('joinClonePath', () => {
  it('joins base + owner + repo', () => {
    expect(joinClonePath(BASE, 'acme', 'widget')).toBe(
      '/Users/dev/code/acme/widget',
    );
  });

  it('drops a null/empty owner segment', () => {
    expect(joinClonePath(BASE, null, 'widget')).toBe('/Users/dev/code/widget');
    expect(joinClonePath(BASE, '', 'widget')).toBe('/Users/dev/code/widget');
  });

  it('normalizes stray slashes without eating the leading slash', () => {
    expect(joinClonePath('/Users/dev/code/', 'acme/', '/widget')).toBe(
      '/Users/dev/code/acme/widget',
    );
  });
});

describe('baseName', () => {
  it('returns the last segment', () => {
    expect(baseName('/Users/dev/code/acme/widget')).toBe('widget');
  });
  it('tolerates trailing slashes and backslashes', () => {
    expect(baseName('/Users/dev/code/acme/widget/')).toBe('widget');
    expect(baseName('C:\\Users\\dev\\widget')).toBe('widget');
  });
});

describe('deriveKnownOwner', () => {
  it('prefers explicit github owner', () => {
    expect(
      deriveKnownOwner({
        github: { owner: 'acme' },
        purl: 'pkg:github/other/widget',
        remoteUrl: 'https://github.com/third/widget.git',
      }),
    ).toBe('acme');
  });

  it('falls back to the purl namespace', () => {
    expect(deriveKnownOwner({ purl: 'pkg:github/acme/widget' })).toBe('acme');
  });

  it('falls back to parsing the remote url', () => {
    expect(
      deriveKnownOwner({ remoteUrl: 'git@github.com:acme/widget.git' }),
    ).toBe('acme');
  });

  it('returns null when no owner can be derived', () => {
    expect(deriveKnownOwner({})).toBeNull();
    expect(deriveKnownOwner({ github: { owner: '' } })).toBeNull();
    expect(deriveKnownOwner({ remoteUrl: 'not-a-url' })).toBeNull();
  });
});

describe('getConventionStatus', () => {
  it('recognizes a canonical path', () => {
    const s = getConventionStatus(`${BASE}/acme/widget`, BASE, 'acme');
    expect(s).toEqual({
      isUnderBaseDir: true,
      isCanonical: true,
      expectedPath: `${BASE}/acme/widget`,
    });
  });

  it('flags a repo placed directly under base (missing owner segment)', () => {
    const s = getConventionStatus(`${BASE}/widget`, BASE, 'acme');
    expect(s.isUnderBaseDir).toBe(true);
    expect(s.isCanonical).toBe(false);
    expect(s.expectedPath).toBe(`${BASE}/acme/widget`);
  });

  it('flags a repo under the wrong owner folder', () => {
    const s = getConventionStatus(`${BASE}/wrong/widget`, BASE, 'acme');
    expect(s.isCanonical).toBe(false);
    expect(s.expectedPath).toBe(`${BASE}/acme/widget`);
  });

  it('treats owner-folder case differences as canonical (case-insensitive FS)', () => {
    const s = getConventionStatus(`${BASE}/Acme/widget`, BASE, 'acme');
    expect(s.isCanonical).toBe(true);
  });

  it('reports a repo outside the base dir as not under it', () => {
    const s = getConventionStatus('/elsewhere/widget', BASE, 'acme');
    expect(s.isUnderBaseDir).toBe(false);
  });
});

describe('getOffConventionTarget', () => {
  const repo = {
    path: `${BASE}/widget`,
    github: { owner: 'acme' },
  };

  it('returns the target when under base, wrong depth, owner known', () => {
    expect(getOffConventionTarget(repo, BASE)).toEqual({
      expectedPath: `${BASE}/acme/widget`,
      owner: 'acme',
    });
  });

  it('returns null when already canonical', () => {
    expect(
      getOffConventionTarget({ ...repo, path: `${BASE}/acme/widget` }, BASE),
    ).toBeNull();
  });

  it('returns null for repos outside the base dir', () => {
    expect(
      getOffConventionTarget({ ...repo, path: '/elsewhere/widget' }, BASE),
    ).toBeNull();
  });

  it('returns null when no owner can be derived', () => {
    expect(getOffConventionTarget({ path: `${BASE}/widget` }, BASE)).toBeNull();
  });

  it('returns null when no base dir is configured', () => {
    expect(getOffConventionTarget(repo, null)).toBeNull();
    expect(getOffConventionTarget(repo, '   ')).toBeNull();
  });
});
