import { monitoredDirtyFiles } from './monitoredDirtyFiles';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';

it('builds deduplicated dirty rows from monitored files and preserves special paths', () => {
  const status = {
    stagedFiles: ['shared.ts', 'staged.ts'],
    modifiedFiles: ['shared.ts', 'name with spaces.ts'],
    createdFiles: ['new.ts'],
    untrackedFiles: ['new.ts', 'untracked.ts'],
    deletedFiles: ['shared.ts', 'gone.ts'],
  } as GitStatusWithFiles;
  expect(monitoredDirtyFiles(status)).toEqual([
    { path: 'shared.ts', status: 'removed' },
    { path: 'staged.ts', status: 'modified' },
    { path: 'name with spaces.ts', status: 'modified' },
    { path: 'new.ts', status: 'added' },
    { path: 'untracked.ts', status: 'added' },
    { path: 'gone.ts', status: 'removed' },
  ]);
});
