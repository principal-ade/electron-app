import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailCard } from './TrailCard';

export interface TrailsRecentListGroup {
  /** Stable React key for the section. */
  key: string;
  /** Primary header text (e.g. "Today", "Yesterday", a weekday name). */
  label: string;
  /** Secondary header text (e.g. "May 14"). */
  subLabel: string;
  /** Trails in the section, already sorted in the order they should render. */
  trails: TrailIndexEntry[];
}

export interface TrailsRecentListRepoInfo {
  repoLabel: string;
  ownerLogin?: string;
  owned: boolean;
}

export interface TrailsRecentListProps {
  groups: TrailsRecentListGroup[];
  /**
   * Resolve a trail to its host-side repo metadata. Kept as a callback so the
   * list stays decoupled from the AlexandriaEntry registry and works in
   * Storybook without main-process services.
   */
  resolveRepo: (trail: TrailIndexEntry) => TrailsRecentListRepoInfo;
  /** Trail id currently selected for preview, or null. */
  selectedTrailId: string | null;
  /**
   * Fired on card click. Receives the full trail; parent decides whether to
   * select, toggle off, or open.
   */
  onSelectTrail: (trail: TrailIndexEntry) => void;
  /** Copy shown when `groups` is empty. */
  emptyLabel?: string;
}

export const TrailsRecentList: React.FC<TrailsRecentListProps> = ({
  groups,
  resolveRepo,
  selectedTrailId,
  onSelectTrail,
  emptyLabel = 'No matching trails.',
}) => {
  const { theme } = useTheme();

  if (groups.length === 0) {
    return (
      <div
        style={{
          padding: '32px 8px',
          textAlign: 'center',
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          opacity: 0.5,
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div
          key={group.key}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '0 4px',
              fontFamily: theme.fonts.body,
            }}
          >
            <span
              style={{
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
              }}
            >
              {group.label}
            </span>
            <span
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              {group.subLabel}
            </span>
          </div>
          {group.trails.map((trail) => {
            const { repoLabel, ownerLogin, owned } = resolveRepo(trail);
            const isSelected = selectedTrailId === trail.id;
            return (
              <TrailCard
                key={trail.id}
                trail={trail}
                metaMode="date"
                selected={isSelected}
                onSelect={() => onSelectTrail(trail)}
                repoLabel={repoLabel}
                ownerLogin={ownerLogin}
                owned={owned}
              />
            );
          })}
        </div>
      ))}
    </>
  );
};
