import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import type { LocalTopicRecord } from '../../../shared/main-process-api-interfaces/TopicAPI';

export interface UseTopicLibraryResult {
  records: LocalTopicRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Ids of trails saved against the current repo (empty when no repo open). */
  repoTrailIds: Set<string>;
  /**
   * True when any of the topic's trails was authored in the current
   * repository. Topics are cross-repo bundles with no `repositoryPath` of
   * their own, so "this repo" is derived from the trail ids that overlap the
   * repo's saved-trail library. Always false when no repo is open.
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
 * since either can change which topics count as "this repo". A `seqRef` guard
 * drops stale responses when `repositoryPath` changes mid-flight.
 */
export function useTopicLibrary(
  repositoryPath: string | null,
): UseTopicLibraryResult {
  const [records, setRecords] = useState<LocalTopicRecord[]>([]);
  const [repoTrailIds, setRepoTrailIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const [nextRecords, trailListing] = await Promise.all([
        TopicService.getRecords(),
        repositoryPath
          ? TrailLibraryService.list(repositoryPath)
          : Promise.resolve({ entries: [] }),
      ]);
      if (seq !== seqRef.current) return;
      setRecords(nextRecords);
      setRepoTrailIds(new Set(trailListing.entries.map((e) => e.id)));
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
      if (repoTrailIds.size === 0) return false;
      return record.topic.trailIds.some((id) => repoTrailIds.has(id));
    },
    [repoTrailIds],
  );

  // Stable identity so consumers' memos/effects keyed on the result don't
  // recompute every render (only when an actual input changes).
  return useMemo(
    () => ({ records, loading, refresh, repoTrailIds, isInThisRepo }),
    [records, loading, refresh, repoTrailIds, isInThisRepo],
  );
}
