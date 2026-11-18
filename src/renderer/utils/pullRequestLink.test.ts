import { parsePullRequestTarget, pullRequestLabel } from './pullRequestLink';

describe('parsePullRequestTarget', () => {
  it('parses a GitHub pull request URL', () => {
    expect(
      parsePullRequestTarget('https://github.com/acme/widgets/pull/42'),
    ).toEqual({
      owner: 'acme',
      repo: 'widgets',
      number: 42,
      url: 'https://github.com/acme/widgets/pull/42',
    });
  });

  it('accepts trailing path, query, and fragment segments', () => {
    expect(
      parsePullRequestTarget(
        'https://github.com/acme/widgets/pull/42/files?diff=split#review',
      ),
    ).toMatchObject({ number: 42 });
  });

  it('accepts a URL without a scheme and with a www host', () => {
    expect(
      parsePullRequestTarget('www.github.com/acme/widgets/pull/7/'),
    ).toMatchObject({ owner: 'acme', repo: 'widgets', number: 7 });
  });

  it('accepts owner/repo/pull/number', () => {
    expect(parsePullRequestTarget('acme/widgets/pull/9')).toMatchObject({
      owner: 'acme',
      repo: 'widgets',
      number: 9,
    });
  });

  it('accepts owner/repo#number and normalizes case', () => {
    expect(parsePullRequestTarget('Acme/Widgets#3')).toEqual({
      owner: 'acme',
      repo: 'widgets',
      number: 3,
      url: 'https://github.com/acme/widgets/pull/3',
    });
  });

  it.each([
    '',
    'not a pr',
    'https://github.com/acme/widgets/issues/42',
    'https://gitlab.com/acme/widgets/pull/42',
    'acme/widgets#0',
    'acme/widgets#-1',
  ])('rejects %p', (value) => {
    expect(parsePullRequestTarget(value)).toBeNull();
  });
});

describe('pullRequestLabel', () => {
  it('formats owner/repo#number', () => {
    expect(
      pullRequestLabel({
        owner: 'acme',
        repo: 'widgets',
        number: 42,
        url: 'https://github.com/acme/widgets/pull/42',
      }),
    ).toBe('acme/widgets#42');
  });
});
