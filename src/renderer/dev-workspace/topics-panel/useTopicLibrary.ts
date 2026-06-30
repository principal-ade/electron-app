import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { repoPurlFromEntry } from '../../../shared/topics/repoPurl';
import type { LocalTopicRecord } from '../../../shared/main-process-api-interfaces/TopicAPI';

export interface UseTopicLibraryResult {
  records: LocalTopicRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Ids of trails saved against the current repo (empty when no repo open).
   * Drives the "multi-repo" badge (a topic with some-but-not-all trails here),
   * which is a display hint distinct from the "This repo" membership filter.
   */
  repoTrailIds: Set<string>;
  /**
   * True when the topic's `repos` include the current window's repository PURL —
   * a direct membership check now that {@link Topic.repos} exists (no trail-walk
   * heuristic). Always false when no repo is open or the repo has no PURL.
   */
  isInThisRepo: (record: LocalTopicRecord) => boolean;
}

/**
 * Backs the dev-workspace "Topics" sidebar panel. Lists every local topic
 * record (records, not bare topics, so callers see `sync.remoteId` for the
 * published badge) and, alongside it, the set of trail ids saved against the
 * current repository — so the panel can offer a "This repo" filter without a
 * repo-scoped topic listing existing on the backend.
 *
 * Re-lists on topic changes ({@link TopicService.onTopicChange}) and on
 * saved-trail library changes ({@link TrailLibraryService.onLibraryChanged}),
 * since either feeds the listing or the multi-repo badge. A `seqRef` guard
 * drops stale responses when `repositoryPath` changes mid-flight.
 *
 * Resolves the current `repositoryPath` to its canonical PURL via the
 * Alexandria registry ({@link repoPurlFromEntry}) — the same value the
 * workspace↔topic sync writes into a topic's `repos`, so {@link isInThisRepo}
 * is a direct membership check.
 */
export function useTopicLibrary(
  repositoryPath: string | null,
): UseTopicLibraryResult {
  const [records, setRecords] = useState<LocalTopicRecord[]>([]);
  const [repoTrailIds, setRepoTrailIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [repoPurl, setRepoPurl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const [nextRecords, trailListing, repoEntry] = await Promise.all([
        TopicService.getRecords(),
        repositoryPath
          ? TrailLibraryService.list(repositoryPath)
          : Promise.resolve({ entries: [] }),
        repositoryPath
          ? AlexandriaService.getRepositoryByPath(repositoryPath)
          : Promise.resolve(null),
      ]);
      if (seq !== seqRef.current) return;
      setRecords(nextRecords);
      setRepoTrailIds(new Set(trailListing.entries.map((e) => e.id)));
      setRepoPurl(repoEntry ? repoPurlFromEntry(repoEntry) : null);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    void refresh();
    const offTopics = TopicService.onTopicChange(() => {
      void refresh();
    });
    const offTrails = TrailLibraryService.onLibraryChanged((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      void refresh();
    });
    return () => {
      offTopics();
      offTrails();
    };
  }, [refresh, repositoryPath]);

  const isInThisRepo = useCallback(
    (record: LocalTopicRecord): boolean => {
      if (!repoPurl) return false;
      return (record.topic.repos ?? []).includes(repoPurl);
    },
    [repoPurl],
  );

  // Stable identity so consumers' memos/effects keyed on the result don't
  // recompute every render (only when an actual input changes).
  return useMemo(
    () => ({ records, loading, refresh, repoTrailIds, isInThisRepo }),
    [records, loading, refresh, repoTrailIds, isInThisRepo],
  );
}
