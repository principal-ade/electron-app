import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { OwnerDirectory } from '../../../panels/ownerIdentity';
import {
  groupSkyRepositories,
  skyRepositoryOwner,
} from './skyRepositoryGroups';

function repo(name: string, owner: string, local = true): AlexandriaEntry {
  return {
    name,
    path: local ? `/work/${owner}/${name}` : undefined,
    remoteUrl: `https://github.com/${owner}/${name}.git`,
  } as AlexandriaEntry;
}
const directory: OwnerDirectory = {
  selfLogin: 'me',
  selfName: 'My Account',
  orgs: [{ login: 'acme', name: 'Acme Inc' }] as OwnerDirectory['orgs'],
};

test('orders personal and org sections before other clones, preserving every clone', () => {
  const repos = [
    repo('library', 'third-party'),
    repo('z', 'acme'),
    repo('mine', 'ME'),
    repo('a', 'ACME'),
    repo('another', 'third-party'),
    repo('not-cloned', 'someone', false),
  ];
  const groups = groupSkyRepositories(repos, directory);
  expect(groups.map((group) => group.label)).toEqual([
    'My Account',
    'Acme Inc',
    'Other cloned',
    'Other repositories',
  ]);
  expect(groups[1].repositories.map((entry) => entry.name)).toEqual(['a', 'z']);
  expect(groups.flatMap((group) => group.repositories)).toHaveLength(
    repos.length,
  );
  expect(repos[0].name).toBe('library');
});

test('does not treat cached organizations as owned when signed out', () => {
  const groups = groupSkyRepositories(
    [repo('app', 'acme'), repo('mine', 'me')],
    {
      ...directory,
      selfLogin: null,
    },
  );
  expect(groups.map((group) => group.label)).toEqual(['Other cloned']);
});

test('resolves owner avatars from metadata, a purl, or an SSH remote', () => {
  expect(
    skyRepositoryOwner({
      ...repo('app', 'remote-owner'),
      github: { owner: 'metadata-owner' },
    } as AlexandriaEntry),
  ).toBe('metadata-owner');
  expect(
    skyRepositoryOwner({
      ...repo('app', 'remote-owner'),
      purl: 'pkg:github/purl-owner/app',
    } as AlexandriaEntry),
  ).toBe('purl-owner');
  expect(
    skyRepositoryOwner({
      ...repo('app', 'remote-owner'),
      remoteUrl: 'git@github.com:ssh-owner/app.git',
    }),
  ).toBe('ssh-owner');
});

test('keeps local-only and non-GitHub clones without inventing GitHub avatars', () => {
  const local = { name: 'local', path: '/work/local' } as AlexandriaEntry;
  expect(skyRepositoryOwner(local)).toBeUndefined();
  expect(
    skyRepositoryOwner({
      ...local,
      remoteUrl: 'https://gitlab.com/team/app.git',
    }),
  ).toBeUndefined();
  expect(groupSkyRepositories([local], directory)[0].label).toBe(
    'Other cloned',
  );
});
