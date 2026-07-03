/**
 * LocalTrailTabContent
 *
 * Renders a trail from the LOCAL library — one freshly authored by an agent /
 * skill that landed in a window without a warm dev-workspace for its repo. When
 * the user is sitting on the Projects (feed) or Inbox view, we open the trail as
 * a tab here instead of yanking them over to TrailsView (see IntegratedShell's
 * SHOW_IN_PRINCIPAL handler).
 *
 * Sibling to `SharedTrailTabContent`, but for trails that live on disk rather
 * than on web-ade: it self-fetches the payload + host-private repositoryPath via
 * `TrailLibraryService.activate`, then hands them to `FileCityTrailTabContent`
 * (the same standalone explorer mount Alexandria uses — no RepositoryPanelProvider
 * required). Re-fetches on LIBRARY_CHANGED so edits to the trail land in the
 * open tab.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { FileCityTrailTabContent } from '../alexandria-workspace/file-city-trail-tab/FileCityTrailTabContent';
import { TrailLibraryService } from '../services/TrailLibraryService';

export const LocalTrailTabContent: React.FC<{
  trailId: string;
  events: PanelEventEmitter;
}> = ({ trailId, events }) => {
  const { theme } = useTheme();
  const [result, setResult] = React.useState<{
    payload: TrailPayload;
    repositoryPath?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Monotonic fetch sequence: a resolution only lands if no newer fetch
  // (or unmount/trailId change, which bump the counter) started after it.
  const fetchSeqRef = React.useRef(0);
  const invalidateFetches = React.useCallback(() => {
    fetchSeqRef.current++;
  }, []);

  const loadTrail = React.useCallback(
    async (mode: 'initial' | 'refresh') => {
      const seq = ++fetchSeqRef.current;
      if (mode === 'initial') {
        setLoading(true);
        setError(null);
      }
      try {
        const activated = await TrailLibraryService.activate(trailId);
        if (seq !== fetchSeqRef.current) return;
        if (activated) {
          setResult({
            payload: activated.payload,
            repositoryPath: activated.repositoryPath,
          });
        } else if (mode === 'initial') {
          // On refresh, a missing trail (e.g. just deleted) keeps the last
          // good payload; the DELETE flow closes the tab separately.
          setError('Could not load this trail.');
        }
      } catch {
        if (seq !== fetchSeqRef.current) return;
        if (mode === 'initial') setError('Could not load this trail.');
      } finally {
        if (seq === fetchSeqRef.current && mode === 'initial') {
          setLoading(false);
        }
      }
    },
    [trailId],
  );

  React.useEffect(() => {
    void loadTrail('initial');
    return invalidateFetches;
  }, [loadTrail, invalidateFetches]);

  // Tabs stay mounted-hidden for their whole life, so the mount fetch above
  // runs exactly once — without this subscription the tab renders its
  // open-time snapshot forever. LIBRARY_CHANGED fires on every trail write
  // (bridge re-POSTs, forks, note mutations) and carries no trail id, so
  // re-read unconditionally; the ACTIVATE IPC read is side-effect-free.
  React.useEffect(() => {
    const off = TrailLibraryService.onLibraryChanged(() => {
      void loadTrail('refresh');
    });
    return () => off();
  }, [loadTrail]);

  if (error || !result) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
        }}
      >
        {error ?? (loading ? 'Loading trail…' : null)}
      </div>
    );
  }

  return (
    <FileCityTrailTabContent
      key={`local-trail:${trailId}`}
      trailPayload={result.payload}
      repositoryPath={result.repositoryPath}
      events={events}
    />
  );
};

export default LocalTrailTabContent;
