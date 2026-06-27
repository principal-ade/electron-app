/**
 * Loads the Alexandria registry and exposes a `resolvePurl(href)` that maps a
 * purl-qualified doc link to a concrete local file (or a `needs-clone` verdict).
 *
 * This is the I/O half of purl resolution; the decision logic is the pure
 * `resolvePurlLink`. Crucially it is **registry-wide, not workspace-scoped**: a
 * purl is a canonical repo id, so the same link resolves identically in every
 * window regardless of which workspace (if any) is open. That's what lets every
 * markdown surface share one resolver — see
 * `docs/purl-aware-doc-link-clicking.md`.
 *
 * The registry is kept fresh via `onRepositoryChange`, so a repo cloned/added
 * after mount starts resolving without a reload.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import {
  resolvePurlLink,
  type PurlResolution,
  type PurlResolverRepo,
} from '../../shared/utils/resolvePurlLink';

export const useRepoPurlResolver = () => {
  const [repos, setRepos] = useState<PurlResolverRepo[]>([]);

  const load = useCallback(async () => {
    try {
      const entries = await AlexandriaService.getRepositories();
      setRepos(
        entries.map((e) => ({
          purl: e.purl,
          path: e.path as string | undefined,
          name: e.name,
        })),
      );
    } catch (err) {
      console.error('[useRepoPurlResolver] failed to load registry', err);
      setRepos([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the registry fresh: a repo cloned/registered after mount should start
  // resolving without a manual reload.
  useEffect(() => {
    const off = AlexandriaService.onRepositoryChange(() => {
      void load();
    });
    return off;
  }, [load]);

  const resolvePurl = useCallback(
    (href: string): PurlResolution => resolvePurlLink(href, repos),
    [repos],
  );

  return { resolvePurl, repoCount: repos.length };
};
