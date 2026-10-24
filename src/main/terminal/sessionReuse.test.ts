import { findReusableSession } from './sessionReuse';

const session = (id: string, directory: string, context?: string) => ({
  id,
  directory,
  context,
});

describe('findReusableSession', () => {
  it('reuses the session with the same tab context', () => {
    const sessions = [
      session('a', '/repo', 'repo:tab:one'),
      session('b', '/repo', 'repo:tab:two'),
    ];

    expect(findReusableSession(sessions, '/repo', 'repo:tab:two')?.id).toBe('b');
  });

  it('reuses a session whose directory drifted (OSC 7 cwd updates)', () => {
    // A shell that cd'd into a subdirectory still owns its tab context.
    const sessions = [session('a', '/repo/packages/app', 'repo:tab:one')];

    expect(findReusableSession(sessions, '/repo', 'repo:tab:one')?.id).toBe('a');
  });

  it('does not reuse another tab in the same directory', () => {
    const sessions = [session('a', '/repo', 'repo:tab:one')];

    expect(findReusableSession(sessions, '/repo', 'repo:tab:two')).toBeUndefined();
  });

  it('matches on directory when the request has no context', () => {
    const sessions = [
      session('a', '/repo', 'repo:tab:one'),
      session('b', '/repo'),
      session('c', '/other'),
    ];

    expect(findReusableSession(sessions, '/repo')?.id).toBe('b');
  });

  it('ignores context-bearing sessions for contextless requests', () => {
    const sessions = [session('a', '/repo', 'repo:tab:one')];

    expect(findReusableSession(sessions, '/repo')).toBeUndefined();
  });

  it('reuses a restored session that carries its persisted context', () => {
    // Sessions restored from the PTY daemon arrive with the context they were
    // created with, which is what makes reattach-after-restart work.
    const restored = [session('survivor', '/repo', 'repo:tab:one')];

    expect(findReusableSession(restored, '/repo', 'repo:tab:one')?.id).toBe(
      'survivor',
    );
  });

  it('returns undefined when nothing matches', () => {
    expect(findReusableSession([], '/repo', 'repo:tab:one')).toBeUndefined();
  });
});
