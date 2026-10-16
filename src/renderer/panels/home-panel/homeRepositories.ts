import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import {
  payloadFromLocalEntry,
  payloadFromPurl,
  type RepositorySelectedPayload,
} from '../../events/repositorySelected';
import type { InProgressRepo } from './useInProgressRepos';

export interface HomeRepository {
  key: string;
  payload: RepositorySelectedPayload;
  status?: GitStatusWithFiles;
}

/** Include open repositories even when their working trees are clean. */
export function getHomeRepositories(
  repositories: AlexandriaEntry[],
  inProgress: InProgressRepo[],
  tabs: WorkspaceTab[],
): HomeRepository[] {
  const rows = new Map<string, HomeRepository>();
  const add = (
    payload: RepositorySelectedPayload,
    status?: GitStatusWithFiles,
  ) => {
    const key = String(payload.localEntry?.path ?? payload.purl);
    if (!rows.has(key)) rows.set(key, { key, payload, status });
  };

  for (const { entry, status } of inProgress) {
    add(payloadFromLocalEntry(entry), status);
  }

  for (const tab of tabs) {
    switch (tab.contentType) {
      case 'project-info':
      case 'repo-explorer':
      case 'file-city-guide': {
        const entry =
          repositories.find(
            (repo) => tab.localEntry?.path && repo.path === tab.localEntry.path,
          ) ??
          repositories.find(
            (repo) => (repo.purl ?? repo.github?.purl) === tab.purl,
          ) ??
          tab.localEntry;
        const payload = entry
          ? payloadFromLocalEntry(entry)
          : payloadFromPurl(tab.purl);
        add({ ...payload, github: tab.github ?? payload.github });
        break;
      }
      case 'terminal':
      case 'commit-review':
      case 'markdown-doc':
      case 'source-file':
      case 'media': {
        const path =
          tab.contentType === 'terminal'
            ? tab.directory
            : tab.contentType === 'commit-review'
              ? tab.repoPath
              : tab.contentType === 'markdown-doc'
                ? (tab.repositoryPath ?? tab.filePath)
                : tab.filePath;
        // Prefer a nested registered repository over its parent, and require a
        // path boundary so /work/app does not match /work/app-other.
        const entry = repositories
          .filter(
            (repo) =>
              repo.path &&
              (path === String(repo.path) ||
                path.startsWith(String(repo.path).replace(/\/+$/, '') + '/')),
          )
          .sort((a, b) => String(b.path).length - String(a.path).length)[0];
        if (entry) add(payloadFromLocalEntry(entry));
        break;
      }
    }
  }

  return [...rows.values()].sort((a, b) => {
    const name = ({ payload }: HomeRepository) =>
      payload.github?.name ?? payload.localEntry?.name ?? payload.purl;
    return name(a).localeCompare(name(b), undefined, { sensitivity: 'base' });
  });
}
