/**
 * CollectionsList
 *
 * Component for displaying user's starred collections from web-ade API.
 * Shows collections as clickable cards with metadata.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, Loader2, AlertCircle, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';
import { CollectionCard } from './cards/CollectionCard';

export interface CollectionsListProps {
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
}

export const CollectionsList: React.FC<CollectionsListProps> = ({ events }) => {
  const { theme } = useTheme();

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  // State
  const [collections, setCollections] = useState<StarredCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load collections on mount
  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const collectionsData = await WebAdeService.getStarredCollections(true);
      setCollections(collectionsData);
    } catch (err) {
      console.error('[CollectionsList] Failed to load collections:', err);
      setError('Failed to load collections. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    events.on('collections:updated', loadCollections);
    return () => {
      events.off('collections:updated', loadCollections);
    };
  }, [events, loadCollections]);

  // Handle collection click - emit event to open collection view
  const handleCollectionClick = useCallback(
    (collection: StarredCollection) => {
      events.emit({
        type: 'collection:selected',
        source: 'collections-list',
        timestamp: Date.now(),
        payload: { collection },
      });
    },
    [events]
  );

  // Get icon component from lucide-react
  const getIconComponent = (iconName?: string): React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }> => {
    if (!iconName) return FolderGit2;

    // Convert kebab-case or snake_case to PascalCase for Lucide icon names
    const pascalCase = iconName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IconComponent = (LucideIcons as any)[pascalCase];
    return IconComponent || FolderGit2;
  };

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[0] }}>
          Loading collections...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <AlertCircle size={32} color={theme.colors.error} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[0], textAlign: 'center' }}>
          {error}
        </div>
        <button
          onClick={loadCollections}
          style={{
            marginTop: spacing.md,
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: theme.radii?.[1] || 4,
            fontSize: theme.fontSizes[0],
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (collections.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <FolderGit2 size={48} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[1], fontWeight: 600 }}>
          No collections yet
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: theme.fontSizes[0], textAlign: 'center' }}>
          Create your first collection on app.principal-ade.com
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with count */}
      <div
        style={{
          padding: spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
        </div>

        {/* Future: Create Collection button */}
        <button
          onClick={() => {
            // Future enhancement: Open create collection modal
          }}
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            backgroundColor: theme.colors.backgroundTertiary,
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii?.[1] || 4,
            fontSize: theme.fontSizes[0],
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          <Plus size={14} />
          <span>Create</span>
        </button>
      </div>

      {/* Collections grid */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
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
      </div>

      {/* Add spin animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default CollectionsList;
