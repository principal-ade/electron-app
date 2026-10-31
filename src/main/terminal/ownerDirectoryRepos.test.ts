import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findChildRepositories } from './ownerDirectoryRepos';

describe('findChildRepositories', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-dir-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function mkRepo(name: string): string {
    const repo = path.join(root, name);
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    return repo;
  }

  it('lists the git checkouts directly inside the folder, sorted', () => {
    const b = mkRepo('b-repo');
    const a = mkRepo('a-repo');
    fs.mkdirSync(path.join(root, 'notes'));
    fs.writeFileSync(path.join(root, 'README.md'), '');

    expect(findChildRepositories(root)).toEqual([a, b]);
  });

  it('skips hidden folders and does not recurse', () => {
    mkRepo('.cache');
    fs.mkdirSync(path.join(root, 'nested', 'deep', '.git'), {
      recursive: true,
    });

    expect(findChildRepositories(root)).toEqual([]);
  });

  it('treats a .git file (worktree/submodule) as a checkout', () => {
    const wt = path.join(root, 'worktree');
    fs.mkdirSync(wt);
    fs.writeFileSync(path.join(wt, '.git'), 'gitdir: elsewhere');

    expect(findChildRepositories(root)).toEqual([wt]);
  });

  it('returns [] for a missing directory', () => {
    expect(findChildRepositories(path.join(root, 'missing'))).toEqual([]);
  });
});
