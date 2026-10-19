import {
  extractPurlFromRemoteUrl,
  parsePurl,
} from '@principal-ai/alexandria-core-library';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  resolveOwnerIdentity,
  type OwnerDirectory,
} from '../../../panels/ownerIdentity';

export interface SkyRepositoryGroup {
  key: string;
  label: string;
  owner?: string;
  avatarUrl?: string;
  isSelf: boolean;
  repositories: AlexandriaEntry[];
}

export function skyRepositoryOwner(entry: AlexandriaEntry): string | undefined {
  if (entry.github?.owner) return entry.github.owner;
  const purl =
    entry.purl ??
    entry.github?.purl ??
    (entry.remoteUrl ? extractPurlFromRemoteUrl(entry.remoteUrl) : null);
  const parsed = purl ? parsePurl(purl) : null;
  return parsed?.type === 'github' ? parsed.namespace : undefined;
}

/** Match Projects: personal and member-org sections, then other local clones. */
export function groupSkyRepositories(
  repositories: AlexandriaEntry[],
  directory: OwnerDirectory,
): SkyRepositoryGroup[] {
  const owners = new Map<string, SkyRepositoryGroup>();
  const otherCloned: SkyRepositoryGroup = {
    key: 'other-cloned',
    label: 'Other cloned',
    isSelf: false,
    repositories: [],
  };
  const otherRemote: SkyRepositoryGroup = {
    key: 'other-remote',
    label: 'Other repositories',
    isSelf: false,
    repositories: [],
  };
  const sorted = [...repositories].sort((a, b) =>
    (a.github?.name ?? a.name).localeCompare(b.github?.name ?? b.name),
  );
  for (const entry of sorted) {
    const owner = skyRepositoryOwner(entry);
    const identity = owner ? resolveOwnerIdentity(owner, directory) : undefined;
    if (
      owner &&
      directory.selfLogin &&
      (identity?.isSelf || identity?.isMemberOrg)
    ) {
      const key = `owner:${owner.toLowerCase()}`;
      let group = owners.get(key);
      if (!group) {
        group = {
          key,
          owner,
          label: identity.label,
          avatarUrl: identity.avatarUrl,
          isSelf: identity.isSelf,
          repositories: [],
        };
        owners.set(key, group);
      }
      group.repositories.push(entry);
    } else {
      (entry.path ? otherCloned : otherRemote).repositories.push(entry);
    }
  }
  return [
    ...[...owners.values()].sort(
      (a, b) =>
        Number(b.isSelf) - Number(a.isSelf) || a.label.localeCompare(b.label),
    ),
    ...[otherCloned, otherRemote].filter(
      (group) => group.repositories.length > 0,
    ),
  ];
}
