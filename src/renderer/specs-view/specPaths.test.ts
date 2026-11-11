import { isSpecFilePath, parseSpecPath, specTabLabel } from './specPaths';

const STABLE = '/Users/dev/OpenSpec/openspec/specs/cli-list/spec.md';
const DELTA =
  '/Users/dev/OpenSpec/openspec/changes/add-global-install-scope/specs/cli-config/spec.md';

describe('parseSpecPath', () => {
  test('parses a stable capability spec', () => {
    expect(parseSpecPath(STABLE)).toEqual({
      kind: 'capability',
      capability: 'cli-list',
      repositoryRoot: '/Users/dev/OpenSpec',
    });
  });

  test('parses a change delta', () => {
    expect(parseSpecPath(DELTA)).toEqual({
      kind: 'change',
      change: 'add-global-install-scope',
      capability: 'cli-config',
      repositoryRoot: '/Users/dev/OpenSpec',
    });
  });

  test('normalizes Windows separators', () => {
    expect(
      parseSpecPath('C:\\dev\\OpenSpec\\openspec\\specs\\cli-list\\spec.md'),
    ).toEqual({
      kind: 'capability',
      capability: 'cli-list',
      repositoryRoot: 'C:/dev/OpenSpec',
    });
  });

  test('rejects non-spec files', () => {
    expect(
      parseSpecPath('/repo/openspec/specs/cli-list/proposal.md'),
    ).toBeNull();
    expect(parseSpecPath('/repo/README.md')).toBeNull();
    expect(parseSpecPath('/repo/spec.md')).toBeNull();
  });

  test('rejects lookalike trees that are not under openspec/', () => {
    // A `specs/` directory that is not inside `openspec/` is not an OpenSpec
    // spec — the full segment sequence has to match.
    expect(parseSpecPath('/repo/docs/specs/cli-list/spec.md')).toBeNull();
  });
});

describe('isSpecFilePath', () => {
  test('accepts both layouts', () => {
    expect(isSpecFilePath(STABLE)).toBe(true);
    expect(isSpecFilePath(DELTA)).toBe(true);
  });

  test('rejects ordinary markdown', () => {
    expect(isSpecFilePath('/repo/docs/getting-started.md')).toBe(false);
  });
});

describe('specTabLabel', () => {
  test('capability spec labels with the capability id', () => {
    expect(specTabLabel(STABLE)).toBe('cli-list');
  });

  test('change delta labels include the change so same-capability deltas stay distinct', () => {
    expect(specTabLabel(DELTA)).toBe('cli-config ∆ add-global-install-scope');
  });

  test('falls back to the file name for non-spec paths', () => {
    expect(specTabLabel('/repo/docs/release-notes.md')).toBe(
      'release-notes.md',
    );
  });
});
