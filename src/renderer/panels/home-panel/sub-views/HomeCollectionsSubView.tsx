/**
 * HomeCollectionsSubView
 *
 * The "Collections" sub-view: list of starred collections with a create button.
 */

import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { WebAdeService } from '../../../main-process-api/WebAdeService';
import type { StarredCollection } from '../../../../shared/tipc/webAdeRouterTypes';
import { SubViewHeader } from './SubViewHeader';

export interface HomeCollectionsSubViewProps {
  onBack: () => void;
  onSelectCollection?: (collection: StarredCollection) => void;
}

export const HomeCollectionsSubView: React.FC<HomeCollectionsSubViewProps> = ({
  onBack,
  onSelectCollection,
}) => {
  const [collections, setCollections] = useState<StarredCollection[] | null>(null);

  const fetchCollections = async () => {
    try {
      const result = await WebAdeService.getStarredCollections(true);
      setCollections(result);
    } catch {
      setCollections([]);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <>
      <SubViewHeader
        icon={<Layers size={14} />}
        label="Collections"
        count={collections?.length || undefined}
        onBack={onBack}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {collections === null ? (
          <ListMessage>Loading collections…</ListMessage>
        ) : collections.length === 0 ? (
          <ListMessage>No collections yet. Create one to organize your repos.</ListMessage>
        ) : (
          collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              collection={collection}
              onSelect={() => onSelectCollection?.(collection)}
            />
          ))
        )}
      </div>
    </>
  );
};

function CollectionRow({
  collection,
  onSelect,
}: {
  collection: StarredCollection;
  onSelect: () => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ borderBottom: `1px solid ${theme.colors.border}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 16px',
          background: hovered
            ? `color-mix(in srgb, ${theme.colors.primary} 6%, ${theme.colors.background})`
            : 'transparent',
          color: theme.colors.text,
          cursor: 'pointer',
          border: 'none',
          display: 'block',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Layers size={14} style={{ flexShrink: 0, color: theme.colors.textSecondary }} />
          <span
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {collection.name}
          </span>
          {collection.repos && (
            <span style={{ fontSize: theme.fontSizes[0], color: theme.colors.textMuted, flexShrink: 0 }}>
              {collection.repos.length}
            </span>
          )}
        </div>
        {collection.description && (
          <div
            style={{
              marginTop: 4,
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[0],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {collection.description}
          </div>
        )}
      </button>
    </div>
  );
}

function ListMessage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '24px 16px',
        color: theme.colors.textMuted,
        fontSize: theme.fontSizes[1],
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
