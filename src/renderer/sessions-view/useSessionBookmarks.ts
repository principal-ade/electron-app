import { useCallback, useEffect, useMemo, useState } from 'react';
import { agentSessionBookmarkKey } from '../../shared/agentSessionBookmark';
import type { AgentSessionBookmark } from '../../shared/types/userPreferences.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export { agentSessionBookmarkKey as sessionBookmarkKey } from '../../shared/agentSessionBookmark';

export function useSessionBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkDetails, setBookmarkDetails] = useState<
    AgentSessionBookmark[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const apply = (
      preferences: Awaited<
        ReturnType<typeof UserPreferencesService.getPreferences>
      >,
    ) => {
      if (!cancelled) {
        setBookmarks(preferences.interactiveShell?.sessionBookmarks ?? []);
        setBookmarkDetails(
          preferences.interactiveShell?.sessionBookmarkDetails ?? [],
        );
      }
    };

    void UserPreferencesService.getPreferences()
      .then(apply)
      .catch((error) => {
        console.error('[useSessionBookmarks] Failed to load bookmarks:', error);
      });
    const off = UserPreferencesService.onPreferencesUpdated(apply);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);
  const isBookmarked = useCallback(
    (key: string) => bookmarkSet.has(key),
    [bookmarkSet],
  );
  const toggleSessionBookmark = useCallback((session: AgentSessionBookmark) => {
    const key = agentSessionBookmarkKey(session);
    const details: AgentSessionBookmark = {
      id: session.id,
      title: session.title,
      directory: session.directory,
      agent: session.agent,
    };
    setBookmarks((current) => {
      const next = current.includes(key)
        ? current.filter((bookmark) => bookmark !== key)
        : [...current, key];
      setBookmarkDetails((currentDetails) => {
        const nextDetails = current.includes(key)
          ? currentDetails.filter(
              (bookmark) => agentSessionBookmarkKey(bookmark) !== key,
            )
          : [
              ...currentDetails.filter(
                (bookmark) => agentSessionBookmarkKey(bookmark) !== key,
              ),
              details,
            ];
        void UserPreferencesService.updatePreferences({
          interactiveShell: {
            sessionBookmarks: next,
            sessionBookmarkDetails: nextDetails,
          },
        });
        return nextDetails;
      });
      return next;
    });
  }, []);

  const syncBookmarkDetails = useCallback(
    (sessions: AgentSessionBookmark[]) => {
      const keys = new Set(bookmarks);
      setBookmarkDetails((current) => {
        const known = new Set(current.map(agentSessionBookmarkKey));
        const additions = sessions
          .filter((session) => {
            const key = agentSessionBookmarkKey(session);
            if (!keys.has(key) || known.has(key)) return false;
            known.add(key);
            return true;
          })
          .map(({ id, title, directory, agent }) => ({
            id,
            title,
            directory,
            agent,
          }));
        if (additions.length === 0) return current;
        const next = [...current, ...additions];
        void UserPreferencesService.updatePreferences({
          interactiveShell: { sessionBookmarkDetails: next },
        });
        return next;
      });
    },
    [bookmarks],
  );

  return {
    bookmarks: bookmarkDetails,
    isBookmarked,
    toggleSessionBookmark,
    syncBookmarkDetails,
  };
}
