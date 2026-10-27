/** @jest-environment node */
import { parseCloneTarget } from './cloneTarget';

function target(input: string) {
  const result = parseCloneTarget(input);
  if (!result.ok) throw new Error(`expected ok for ${input}: ${result.error}`);
  return result.target;
}

function error(input: string) {
  const result = parseCloneTarget(input);
  if (result.ok) throw new Error(`expected failure for ${input}`);
  return result.error;
}

test.each([
  ['pkg:github/principal-ai/skills', 'github.com', 'principal-ai', 'skills'],
  ['pkg:github/principal-ai/skills@v1.2.3', 'github.com', 'principal-ai', 'skills'],
  ['pkg:gitlab/acme/web', 'gitlab.com', 'acme', 'web'],
  ['pkg:bitbucket/acme/api', 'bitbucket.org', 'acme', 'api'],
  ['acme/web', 'github.com', 'acme', 'web'],
  ['acme/web.git', 'github.com', 'acme', 'web'],
  ['https://github.com/acme/web', 'github.com', 'acme', 'web'],
  ['https://github.com/acme/web.git', 'github.com', 'acme', 'web'],
  ['https://github.com/acme/web/tree/main', 'github.com', 'acme', 'web'],
  ['ssh://git@gitlab.com/acme/web.git', 'gitlab.com', 'acme', 'web'],
  ['git@github.com:acme/web.git', 'github.com', 'acme', 'web'],
])('%s resolves to %s/%s/%s', (input, host, owner, repo) => {
  expect(target(input)).toMatchObject({ host, owner, repo });
});

test('builds an https clone URL for purls and slugs', () => {
  expect(target('pkg:github/acme/web').cloneUrl).toBe(
    'https://github.com/acme/web.git',
  );
  expect(target('acme/web').cloneUrl).toBe('https://github.com/acme/web.git');
  // Browser URL extras are dropped.
  expect(target('https://github.com/acme/web/tree/main').cloneUrl).toBe(
    'https://github.com/acme/web.git',
  );
});

test('preserves ssh for scp-style remotes', () => {
  expect(target('git@github.com:acme/web.git').cloneUrl).toBe(
    'git@github.com:acme/web.git',
  );
});

test.each([
  '',
  '   ',
  'pkg:generic/local/Users-me-code-app',
  'pkg:npm/@scope/pkg',
  '/Users/me/code/app',
  '~/code/app',
  './app',
  'acme',
  'acme/web/extra',
  'pkg:github/../etc',
  'https://github.com/acme',
])('%p is rejected with an actionable error', (input) => {
  expect(error(input).length).toBeGreaterThan(10);
});

test('rejects path traversal in slugs and purls', () => {
  expect(error('acme/..')).toContain('invalid owner or repo name');
  expect(error('pkg:github/acme/..')).toContain('invalid owner or repo name');
  expect(error('../acme')).toContain('invalid owner or repo name');
  // Nothing traversal-shaped survives: the destination is derived from these.
  for (const input of ['../acme', 'acme/..', '/etc/passwd', 'pkg:github/../../x']) {
    expect(parseCloneTarget(input).ok).toBe(false);
  }
});
