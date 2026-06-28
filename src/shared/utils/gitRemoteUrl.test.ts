import { parseGitRemoteUrl } from './gitRemoteUrl';

describe('parseGitRemoteUrl', () => {
  describe('HTTPS / HTTP / git:// URLs', () => {
    it('parses https with a .git suffix', () => {
      expect(parseGitRemoteUrl('https://github.com/acme/widget.git')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });

    it('parses https without a .git suffix', () => {
      expect(parseGitRemoteUrl('https://github.com/acme/widget')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });

    it('parses http', () => {
      expect(parseGitRemoteUrl('http://example.org/acme/widget')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'example.org',
      });
    });

    it('parses git://', () => {
      expect(parseGitRemoteUrl('git://github.com/acme/widget.git')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });

    it('tolerates a trailing slash', () => {
      expect(parseGitRemoteUrl('https://github.com/acme/widget/')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });
  });

  describe('ssh:// URLs', () => {
    it('parses ssh://git@host/owner/repo.git', () => {
      expect(
        parseGitRemoteUrl('ssh://git@github.com/acme/widget.git'),
      ).toEqual({ owner: 'acme', repo: 'widget', host: 'github.com' });
    });

    it('tolerates a port', () => {
      expect(
        parseGitRemoteUrl('ssh://git@github.com:22/acme/widget.git'),
      ).toEqual({ owner: 'acme', repo: 'widget', host: 'github.com' });
    });
  });

  describe('scp-style SSH remotes', () => {
    it('parses git@github.com:owner/repo.git', () => {
      expect(parseGitRemoteUrl('git@github.com:acme/widget.git')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });

    it('parses without a user@ prefix', () => {
      expect(parseGitRemoteUrl('github.com:acme/widget.git')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });
  });

  describe('host-general (non-GitHub)', () => {
    it('parses a gitlab https remote', () => {
      expect(parseGitRemoteUrl('https://gitlab.com/group/widget.git')).toEqual({
        owner: 'group',
        repo: 'widget',
        host: 'gitlab.com',
      });
    });

    it('parses a bitbucket scp remote', () => {
      expect(parseGitRemoteUrl('git@bitbucket.org:team/widget.git')).toEqual({
        owner: 'team',
        repo: 'widget',
        host: 'bitbucket.org',
      });
    });

    it('parses a self-hosted host', () => {
      expect(
        parseGitRemoteUrl('https://git.internal.example/eng/widget.git'),
      ).toEqual({ owner: 'eng', repo: 'widget', host: 'git.internal.example' });
    });

    it('keeps a nested subgroup path as the repo segment', () => {
      expect(
        parseGitRemoteUrl('https://gitlab.com/group/sub/widget.git'),
      ).toEqual({ owner: 'group', repo: 'sub/widget', host: 'gitlab.com' });
    });
  });

  describe('gh: shorthand', () => {
    it('parses gh:owner/repo with github.com as host', () => {
      expect(parseGitRemoteUrl('gh:acme/widget')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });

    it('strips a .git suffix from the shorthand', () => {
      expect(parseGitRemoteUrl('gh:acme/widget.git')).toEqual({
        owner: 'acme',
        repo: 'widget',
        host: 'github.com',
      });
    });
  });

  describe('non-matches return null', () => {
    it.each([
      ['empty string', ''],
      ['whitespace', '   '],
      ['null', null],
      ['undefined', undefined],
      ['bare owner/repo shorthand', 'acme/widget'],
      ['a host with no repo', 'https://github.com/acme'],
      ['junk', 'not a url'],
    ])('%s', (_label, input) => {
      expect(parseGitRemoteUrl(input as string)).toBeNull();
    });
  });
});
