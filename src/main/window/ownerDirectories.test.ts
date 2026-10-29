import os from 'node:os';
import { collectOwnerDirectories } from './ownerDirectories';

describe('collectOwnerDirectories', () => {
  it('groups checkouts by their owner folder', () => {
    const result = collectOwnerDirectories([
      { path: '/dev/acme/widgets', github: { owner: 'acme' } },
      { path: '/dev/acme/gadgets', github: { owner: 'Acme' } },
      {
        path: '/dev/principal-ade/electron-app',
        github: { owner: 'principal-ade' },
      },
    ]);

    expect(result).toEqual([
      {
        directory: '/dev/acme',
        label: 'acme',
        ownerLogin: 'acme',
        cloneCount: 2,
      },
      {
        directory: '/dev/principal-ade',
        label: 'principal-ade',
        ownerLogin: 'principal-ade',
        cloneCount: 1,
      },
    ]);
  });

  it('orders by clone count, then label', () => {
    const result = collectOwnerDirectories([
      { path: '/dev/a/one', github: { owner: 'a' } },
      { path: '/dev/b/one', github: { owner: 'b' } },
      { path: '/dev/b/two', github: { owner: 'b' } },
      { path: '/dev/c/one', github: { owner: 'c' } },
    ]);

    expect(result.map((d) => d.label)).toEqual(['b', 'a', 'c']);
  });

  it('ignores folders that are not named after an owner they hold', () => {
    const result = collectOwnerDirectories([
      // Flat clone root: two owners in one folder.
      { path: '/dev/work/one', github: { owner: 'acme' } },
      { path: '/dev/work/two', github: { owner: 'other' } },
      // No GitHub remote — nothing to name the folder after.
      { path: '/dev/local/three' },
      // Stray checkout directly in the root folder.
      { path: '/dev/stray', github: { owner: 'acme' } },
    ]);

    expect(result).toEqual([]);
  });

  it('skips temp and hidden scratch folders', () => {
    const result = collectOwnerDirectories([
      {
        path: `${os.tmpdir()}/c4-proposal-x/repo`,
        github: { owner: 'c4-proposal-x' },
      },
      { path: '/Users/dev/.codex/.tmp/repo', github: { owner: '.tmp' } },
      {
        path: '/Users/dev/.local/share/opencode/repos/github.com/acme/repo',
        github: { owner: 'acme' },
      },
      { path: '/Users/dev/Developer/acme/widgets', github: { owner: 'acme' } },
    ]);

    expect(result).toEqual([
      {
        directory: '/Users/dev/Developer/acme',
        label: 'acme',
        ownerLogin: 'acme',
        cloneCount: 1,
      },
    ]);
  });

  it('ignores entries without a path, and root-level checkouts', () => {
    expect(
      collectOwnerDirectories([
        { path: null, github: { owner: 'acme' } },
        {},
        { path: '/acme', github: { owner: 'acme' } },
      ]),
    ).toEqual([]);
  });

  it('keeps the folder casing for the label, the login for the avatar', () => {
    const result = collectOwnerDirectories([
      { path: '/dev/CopilotKit/app', github: { owner: 'copilotkit' } },
    ]);
    expect(result[0]).toMatchObject({
      label: 'CopilotKit',
      ownerLogin: 'copilotkit',
    });
  });
});
