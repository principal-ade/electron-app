/**
 * HomeClonedSubView
 *
 * List of local Alexandria repositories rendered with StarredRepoCard
 * (owner avatar + stacked repo name / owner). Used for "Other Clones"
 * (local checkouts the user doesn't own). Sorted A–Z by repo name.
 */

import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { HardDrive, Search } from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  StarredRepoCard,
  type StarredRepoCardData,
} from '../../cards/StarredRepoCard';
import { SubViewHeader } from './SubViewHeader';

export interface HomeClonedSubViewProps {
  repositories: AlexandriaEntry[];
  onBack: () => void;
  onSelectEntry?: (entry: AlexandriaEntry) => void;
  /** Header label — defaults to "Other Clones". */
  label?: string;
  /** Empty-state copy. */
  emptyMessage?: string;
}

/** Primary display name used for alphabetical sort. */
function entryName(entry: AlexandriaEntry): string {
  return entry.github?.name || entry.name || basename(entry.path) || 'Unknown';
}

function basename(path: string | undefined | null): string | null {
  if (!path) return null;
  const parts = String(path).replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || null;
}

function entryLabel(entry: AlexandriaEntry): string {
  if (entry.github?.owner && entry.github?.name) {
    return `${entry.github.owner}/${entry.github.name}`;
  }
  return entryName(entry);
}

/**
 * Map an Alexandria entry into the StarredRepoCard shape. Avatar is derived
 * from the GitHub owner login (same trick as titlebar local-clone results).
 * Description / language / stars come from stored GitHub metadata when present.
 */
function toCardData(entry: AlexandriaEntry): StarredRepoCardData {
  const owner = entry.github?.owner || 'Local';
  const name = entryName(entry);
  const ownerAvatarUrl = entry.github?.owner
    ? `https://github.com/${entry.github.owner}.png?size=64`
    : undefined;
  return {
    owner,
    name,
    ownerAvatarUrl,
    description: entry.github?.description ?? null,
    language: entry.github?.primaryLanguage ?? null,
    // Only pass stars when GitHub metadata exists so untracked local clones
    // stay identity-only (StarredRepoCard hides the meta row when undefined).
    stargazersCount: entry.github ? entry.github.stars : undefined,
  };
}

export const HomeClonedSubView: React.FC<HomeClonedSubViewProps> = ({
  repositories,
  onBack,
  onSelectEntry,
  label = 'Other Clones',
  emptyMessage = "No other clones yet. Local checkouts that aren't yours will show up here.",
}) => {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const items = [...repositories].sort((a, b) =>
      entryName(a).localeCompare(entryName(b), undefined, {
        sensitivity: 'base',
      }),
    );
    if (!q) return items;
    return items.filter((entry) => {
      const l = entryLabel(entry).toLowerCase();
      const path = (entry.path || '').toLowerCase();
      return l.includes(q) || path.includes(q);
    });
  }, [repositories, filter]);

  return (
    <>
      <SubViewHeader
        icon={<HardDrive size={14} />}
        label={label}
        count={repositories.length || undefined}
        onBack={onBack}
      />

      {repositories.length >= 8 && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Search size={14} style={{ color: theme.colors.textMuted }} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter clones"
            style={{
              flex: 1,
              background: 'transparent',
              outline: 'none',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              border: 'none',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 6px' }}>
        {repositories.length === 0 ? (
          <ListMessage>{emptyMessage}</ListMessage>
        ) : filtered.length === 0 ? (
          <ListMessage>No projects match &quot;{filter}&quot;.</ListMessage>
        ) : (
          filtered.map((entry) => (
            <StarredRepoCard
              key={entry.path || entryLabel(entry)}
              repo={toCardData(entry)}
              onClick={() => onSelectEntry?.(entry)}
            />
          ))
        )}
      </div>
    </>
  );
};

function ListMessage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '24px 16px',
        color: theme.colors.textMuted,
        fontSize: theme.fontSizes[1],
        lineHeight: 1.5,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}
