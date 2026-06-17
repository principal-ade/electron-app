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
 * required).
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

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const activated = await TrailLibraryService.activate(trailId);
        if (cancelled) return;
        if (!activated) {
          setError('Could not load this trail.');
          return;
        }
        setResult({
          payload: activated.payload,
          repositoryPath: activated.repositoryPath,
        });
      } catch {
        if (cancelled) return;
        setError('Could not load this trail.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trailId]);

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
