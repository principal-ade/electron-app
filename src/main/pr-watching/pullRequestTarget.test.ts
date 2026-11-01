import { parsePullRequestTarget, pullRequestId } from './pullRequestTarget';

describe('parsePullRequestTarget', () => {
  it.each([
    'https://github.com/Owner/Repo/pull/42',
    'https://github.com/Owner/Repo/pull/42/files?diff=split#top',
    'http://www.github.com/Owner/Repo/pull/42/',
    'Owner/Repo#42',
    'Owner/Repo/pull/42',
    '  Owner/Repo#42  ',
  ])('parses %s', (value) => {
    expect(parsePullRequestTarget(value)).toEqual({
      owner: 'Owner',
      repo: 'Repo',
      number: 42,
      id: 'owner/repo#42',
      url: 'https://github.com/Owner/Repo/pull/42',
    });
  });

  it('strips a .git suffix from the repository name', () => {
    expect(parsePullRequestTarget('Owner/Repo.git#7')?.repo).toBe('Repo');
  });

  it.each([
    undefined,
    42,
    '',
    'https://github.com/Owner/Repo',
    'https://github.com/Owner/Repo/issues/42',
    'https://gitlab.com/Owner/Repo/pull/42',
    'Owner/Repo#0',
    'Owner/Repo#abc',
    'Owner#42',
    '../etc#42',
    'Owner/Repo#12345678901',
  ])('rejects %p', (value) => {
    expect(parsePullRequestTarget(value)).toBeUndefined();
  });

  it('lowercases ids so case variants map to one watch', () => {
    expect(pullRequestId('Owner', 'Repo', 3)).toBe('owner/repo#3');
  });
});
