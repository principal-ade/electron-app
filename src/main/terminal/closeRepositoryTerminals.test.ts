import { closeRepositoryTerminals } from './closeRepositoryTerminals';
import type { TerminalSession } from './types';

function setup() {
  const sessions = [
    { id: 'root', directory: '/clones/repo' },
    { id: 'nested', directory: '/clones/repo/packages/app' },
    { id: 'moved', directory: '/tmp', repoPath: '/clones/repo' },
    { id: 'other-clone', directory: '/elsewhere/repo' },
    { id: 'prefix', directory: '/clones/repo-other' },
    { id: 'owner', directory: '/clones', watchedRepoPaths: ['/clones/repo'] },
  ] as TerminalSession[];
  return {
    getAllSessions: () =>
      new Map(sessions.map((session) => [session.id, session])),
    destroySessionAndWaitForExit: jest.fn().mockResolvedValue(undefined),
  };
}

describe('closeRepositoryTerminals', () => {
  it('closes matching checkout terminals without closing siblings or owner terminals', async () => {
    const manager = setup();
    await closeRepositoryTerminals(manager, '/clones/repo/');
    expect(manager.destroySessionAndWaitForExit.mock.calls).toEqual([
      ['root'],
      ['nested'],
      ['moved'],
    ]);
  });

  it('waits for terminals to finish closing', async () => {
    const manager = setup();
    let finish!: () => void;
    manager.destroySessionAndWaitForExit.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let closed = false;
    const closing = closeRepositoryTerminals(manager, '/clones/repo').then(
      () => {
        closed = true;
      },
    );
    await Promise.resolve();
    expect(closed).toBe(false);
    finish();
    await closing;
    expect(closed).toBe(true);
  });

  it('propagates shutdown failures so deletion can abort', async () => {
    const manager = setup();
    manager.destroySessionAndWaitForExit.mockRejectedValue(
      new Error('shutdown failed'),
    );
    await expect(
      closeRepositoryTerminals(manager, '/clones/repo'),
    ).rejects.toThrow('shutdown failed');
  });
});
