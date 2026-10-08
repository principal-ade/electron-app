import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopicService } from '../../main-process-api/TopicService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { repoPurlFromEntry } from '../../../shared/topics/repoPurl';
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';

export interface UseTopicLibraryResult {
  topics: Topic[];
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * True when the topic's `repos` include the current window's repository PURL —
   * a direct membership check against the topic's declared repositories.
   * Always false when no repo is open or the repo has no PURL.
   */
  isInThisRepo: (topic: Topic) => boolean;
}

/**
 * Backs the dev-workspace "Topics" sidebar panel. Lists every local topic.
 *
 * Re-lists on topic changes ({@link TopicService.onTopicChange}). A `seqRef`
 * guard drops stale responses when `repositoryPath` changes mid-flight.
 *
 * Resolves the current `repositoryPath` to its canonical PURL via the
 * Alexandria registry ({@link repoPurlFromEntry}) — the same value the
 * workspace↔topic sync writes into a topic's `repos`, so {@link isInThisRepo}
 * is a direct membership check.
 */
export function useTopicLibrary(
  repositoryPath: string | null,
): UseTopicLibraryResult {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [repoPurl, setRepoPurl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const [nextTopics, repoEntry] = await Promise.all([
        TopicService.getTopics(),
        repositoryPath
          ? AlexandriaService.getRepositoryByPath(repositoryPath)
          : Promise.resolve(null),
      ]);
      if (seq !== seqRef.current) return;
      setTopics(nextTopics);
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
    return () => {
      offTopics();
    };
  }, [refresh, repositoryPath]);

  const isInThisRepo = useCallback(
    (topic: Topic): boolean => {
      if (!repoPurl) return false;
      return (topic.repos ?? []).includes(repoPurl);
    },
    [repoPurl],
  );

  // Stable identity so consumers' memos/effects keyed on the result don't
  // recompute every render (only when an actual input changes).
  return useMemo(
    () => ({ topics, loading, refresh, isInThisRepo }),
    [topics, loading, refresh, isInThisRepo],
  );
}
