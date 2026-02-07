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
    // Mock git status --porcelain output
    mockExecSync.mockReturnValueOnce(
      [' D deleted-file.txt', '?? untracked-file.txt'].join('\n') + '\n',
    );
    // Mock git rev-parse --abbrev-ref HEAD (for branch)
    mockExecSync.mockReturnValueOnce('main');
    // Mock git rev-list --count @{u}..HEAD (for ahead)
    mockExecSync.mockReturnValueOnce('0');
    // Mock git rev-list --count HEAD..@{u} (for behind)
    mockExecSync.mockReturnValueOnce('0');

    const status = await GitCore.getStatus('/fake/path');

    expect(status.deletedFiles).toEqual(['deleted-file.txt']);
    expect(status.stagedFiles).toEqual([]);
    expect(status.modifiedFiles).toEqual([]);
    expect(status.untrackedFiles).toEqual(['untracked-file.txt']);
  });
});
