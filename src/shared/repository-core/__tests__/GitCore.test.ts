import { GitCore } from '../GitCore';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as unknown as jest.Mock;

describe('GitCore.getStatus', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it('classifies unstaged deletions as deleted when porcelain output preserves leading spaces', async () => {
    mockExecSync.mockReturnValue(
      [' D deleted-file.txt', '?? untracked-file.txt'].join('\n') + '\n'
    );

    const status = await GitCore.getStatus('/fake/path');

    expect(status.deleted).toEqual([{ path: 'deleted-file.txt' }]);
    expect(status.staged).toEqual([]);
    expect(status.unstaged).toEqual([]);
    expect(status.untracked).toEqual([{ path: 'untracked-file.txt' }]);
  });
});
