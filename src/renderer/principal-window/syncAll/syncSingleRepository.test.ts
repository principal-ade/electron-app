import { syncSingleRepository } from './syncSingleRepository';

function makeExec(scenario: Record<string, string>, calls: string[][]) {
  return async (args: string[]): Promise<string> => {
    calls.push(args);
    const key = args.join(' ');
    if (key in scenario) return scenario[key];
    if (args[0] === 'merge') return 'Updating abc..def';
    throw new Error(`unexpected git call: ${key}`);
  };
}

describe('syncSingleRepository safety', () => {
  test('fast-forwards a clean strictly-behind clone', async () => {
    const calls: string[][] = [];
    const exec = makeExec(
      {
        'branch --show-current': 'main\n',
        'rev-parse HEAD': 'aaa\n',
        'status --porcelain=v1 --untracked-files=all': '\n',
        remote: 'origin\n',
        'fetch --all --prune': '',
        'rev-parse --abbrev-ref --symbolic-full-name @{upstream}':
          'origin/main\n',
        'rev-list --left-right --count HEAD...@{upstream}': '0\t3\n',
      },
      calls,
    );
    const result = await syncSingleRepository('/repo', exec);
    expect(result.status).toBe('fast-forwarded');
    expect(calls.some((c) => c[0] === 'merge')).toBe(true);
  });

  test('skips dirty trees without merging', async () => {
    const calls: string[][] = [];
    const exec = makeExec(
      {
        'branch --show-current': 'main\n',
        'rev-parse HEAD': 'aaa\n',
        'status --porcelain=v1 --untracked-files=all': ' M file.ts\n',
        remote: 'origin\n',
        'fetch --all --prune': '',
        'rev-parse --abbrev-ref --symbolic-full-name @{upstream}':
          'origin/main\n',
        'rev-list --left-right --count HEAD...@{upstream}': '0\t2\n',
      },
      calls,
    );
    const result = await syncSingleRepository('/repo', exec);
    expect(result.status).toBe('dirty');
    expect(calls.some((c) => c[0] === 'merge')).toBe(false);
  });

  test('skips diverged branches without merging', async () => {
    const calls: string[][] = [];
    const exec = makeExec(
      {
        'branch --show-current': 'main\n',
        'rev-parse HEAD': 'aaa\n',
        'status --porcelain=v1 --untracked-files=all': '\n',
        remote: 'origin\n',
        'fetch --all --prune': '',
        'rev-parse --abbrev-ref --symbolic-full-name @{upstream}':
          'origin/main\n',
        'rev-list --left-right --count HEAD...@{upstream}': '1\t2\n',
      },
      calls,
    );
    const result = await syncSingleRepository('/repo', exec);
    expect(result.status).toBe('diverged');
    expect(calls.some((c) => c[0] === 'merge')).toBe(false);
  });
});
