/**
 * CollectionRepositoriesPanel
 *
 * Displays repositories in the selected collection.
 * Similar to WorkspaceRepositoriesPanel but for collections.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelContextValue, PanelActions, PanelEventEmitter, DataSlice } from '@principal-ade/panel-framework-core';
import type { Collection } from '@principal-ai/alexandria-collections';
import { ExternalLink, Github } from 'lucide-react';

interface CollectionRepositoriesSlice {
  collection: Collection | null;
  repositoryIds: string[];
}

interface CollectionRepositoriesPanelContext extends PanelContextValue {
  collectionRepositories?: DataSlice<CollectionRepositoriesSlice>;
}

interface CollectionRepositoriesPanelProps {
  context: CollectionRepositoriesPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

export const CollectionRepositoriesPanel: React.FC<CollectionRepositoriesPanelProps> = ({
  context,
}) => {
  const { theme } = useTheme();

  // Get the collectionRepositories slice
  const slice = context.collectionRepositories;
  const collection = slice?.data?.collection;
  const repositoryIds = slice?.data?.repositoryIds || [];

  // Use theme space array or fallback values
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
    lg: theme.space?.[4] || 24,
  };

  const borderRadius = theme.radii?.[1] || 4;

  if (!collection) {
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
          textAlign: 'center',
        }}
      >
        <Github size={48} style={{ marginBottom: spacing.md, opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: '14px' }}>
          Select a collection to view its repositories
        </p>
      </div>
    );
  }

  if (repositoryIds.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: spacing.md,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.colors.text }}>
            {collection.name}
          </h3>
          {collection.description && (
            <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: '12px', color: theme.colors.textSecondary }}>
              {collection.description}
            </p>
          )}
        </div>

        {/* Empty state */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
            color: theme.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px' }}>
            No repositories in this collection
          </p>
          <p style={{ margin: `${spacing.sm}px 0 0`, fontSize: '12px' }}>
            Add repositories to this collection to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.colors.text }}>
          {collection.name}
        </h3>
        {collection.description && (
          <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: '12px', color: theme.colors.textSecondary }}>
            {collection.description}
          </p>
        )}
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: '11px', color: theme.colors.textSecondary }}>
          {repositoryIds.length} {repositoryIds.length === 1 ? 'repository' : 'repositories'}
        </p>
      </div>

      {/* Repository list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.sm,
        }}
      >
        {repositoryIds.map((repoId) => {
          const [owner, name] = repoId.split('/');
          return (
            <div
              key={repoId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                marginBottom: spacing.xs,
                borderRadius: borderRadius,
                backgroundColor: theme.colors.backgroundSecondary || theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                cursor: 'pointer',
              }}
              onClick={() => {
                window.open(`https://github.com/${repoId}`, '_blank');
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.highlight;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary || theme.colors.surface || '';
              }}
            >
              <Github size={16} style={{ color: theme.colors.textSecondary, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: theme.colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {owner}
                </div>
              </div>
              <ExternalLink size={14} style={{ color: theme.colors.textSecondary, flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
