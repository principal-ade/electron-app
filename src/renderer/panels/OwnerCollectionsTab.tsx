/**
 * OwnerCollectionsTab
 *
 * Renders a GitHub user/org's public starred collections. Used inside
 * UserProfilePanel and OrgProfilePanel as a tab body. Clicking a card
 * emits feed:collection-selected so the FeedPanelFramework can open
 * the CollectionProfilePanel for that collection.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AlertCircle, FolderGit2, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';
import { CollectionCard } from './cards/CollectionCard';

export interface OwnerCollectionsTabProps {
  ownerLogin: string;
  events: PanelEventEmitter;
}

const getIconComponent = (
  iconName?: string,
): React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }> => {
  if (!iconName) return FolderGit2;
  const pascalCase = iconName
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[pascalCase];
  return IconComponent || FolderGit2;
};

export const OwnerCollectionsTab: React.FC<OwnerCollectionsTabProps> = ({ ownerLogin, events }) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [collections, setCollections] = useState<StarredCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await WebAdeService.getOwnerStarredCollections(ownerLogin, true);
        if (!cancelled) setCollections(response.collections);
      } catch (err) {
        if (cancelled) return;
        console.error(`[OwnerCollectionsTab] Failed to load collections for ${ownerLogin}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load collections');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerLogin]);

  const handleCollectionClick = useCallback(
    (collection: StarredCollection) => {
      events.emit({
        type: 'feed:collection-selected',
        source: 'owner-collections-tab',
        timestamp: Date.now(),
        payload: { collection },
      });
    },
    [events],
  );

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: spacing.sm, fontSize: theme.fontSizes[0] }}>Loading collections…</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          textAlign: 'center',
        }}
      >
        <AlertCircle size={28} color={theme.colors.error} />
        <div style={{ marginTop: spacing.sm, fontSize: theme.fontSizes[0] }}>{error}</div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          textAlign: 'center',
        }}
      >
        <FolderGit2 size={36} style={{ opacity: 0.5 }} />
        <div style={{ marginTop: spacing.sm, fontSize: theme.fontSizes[1], fontWeight: 600 }}>
          No public collections
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: theme.fontSizes[0] }}>
          {ownerLogin} hasn&apos;t shared any starred collections yet.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: spacing.md,
      }}
    >
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={{
            name: collection.name,
            description: collection.description,
            icon: getIconComponent(collection.icon),
            ownerLogin: collection.ownerLogin,
            isOrgOwned: collection.ownerType === 'org',
            repoCount: collection.repos?.length || 0,
            userCount: collection.users?.length || 0,
          }}
          onClick={() => handleCollectionClick(collection)}
        />
      ))}
    </div>
  );
};

export default OwnerCollectionsTab;
