import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ArrowDown, ArrowUp, Eye, Circle, Cloud, Download, Eraser, FolderGit2, FolderTree, Lock, Terminal } from 'lucide-react';

export interface OrgRepoItemCardData {
  name: string;
}

export interface OrgRepoItemCardProps {
  repo: OrgRepoItemCardData;
  onClick?: () => void;
  /** Whether this project has a local clone on disk. */
  isCloned?: boolean;
  /** Whether the local clone has uncommitted changes. */
  isDirty?: boolean;
  /**
   * Repository visibility. `true` = private, `false` = public, `undefined` =
   * unknown (no GitHub metadata available, e.g. an untracked local clone).
   */
  isPrivate?: boolean;
  /** Hover-revealed action to clone a not-yet-cloned project. */
  onClone?: () => void;
  /** Hover-revealed action to remove a cloned project from the local registry. */
  onRemove?: () => void;
  /** Hover-revealed action to open a terminal tab rooted at the clone's path. */
  onOpenTerminal?: () => void;
  /**
   * Whether this clone is off the `{baseDir}/{owner}/{repo}` convention. When
   * true, a clickable folder-tree glyph appears next to the name.
   */
  offConvention?: boolean;
  /** Opens the relocate modal for an off-convention clone. */
  onRelocate?: () => void;
  /**
   * Text put on the drag payload (`text/plain`) when the row is dragged onto a
   * terminal, which xterm pastes verbatim. Cloned projects pass their
   * shell-quoted on-disk path; not-yet-cloned projects pass their GitHub URL.
   * When omitted the row is not draggable.
   */
  dragText?: string;
  /**
   * Sync state vs the upstream remote. When provided, a right-aligned indicator
   * renders showing the commit counts for whichever of `ahead` / `behind` is
   * greater than zero. Omitted (or both zero) → no indicator.
   */
  sync?: { ahead?: number; behind?: number };
  /**
   * Whether the repository monitoring worker is watching this clone. A watched
   * repo has live git status (push/dirty updates arrive as events); an unwatched
   * one is only queried on demand, so its `sync` counts can be stale. When true,
   * a small "live" glyph renders next to the name.
   */
  watching?: boolean;
}

export const OrgRepoItemCard: React.FC<OrgRepoItemCardProps> = ({
  repo,
  onClick,
  isCloned = false,
  isDirty = false,
  isPrivate,
  onClone,
  onRemove,
  onOpenTerminal,
  offConvention = false,
  onRelocate,
  dragText,
  sync,
  watching = false,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };

  const [hovered, setHovered] = useState(false);

  const ahead = sync?.ahead ?? 0;
  const behind = sync?.behind ?? 0;
  const showSync = ahead > 0 || behind > 0;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      // Projects can be dragged onto a terminal: cloned ones paste their path,
      // not-yet-cloned ones paste their GitHub URL.
      draggable={dragText ? true : undefined}
      onDragStart={
        dragText
          ? (e) => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', dragText);
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm + 2,
        // "Quiet list" row: no border. A subtle background tint on hover is the
        // only chrome; hierarchy is carried by the section header above.
        padding: '6px 10px 6px 14px',
        backgroundColor: hovered ? theme.colors.backgroundSecondary : 'transparent',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
        // Not-yet-cloned projects read as lighter than the ones on disk.
        opacity: isCloned ? 1 : 0.7,
      }}
    >
      {/* On-disk clones get the repo icon; not-yet-cloned repos get a cloud. */}
      <div style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}>
        {isCloned ? (
          <FolderGit2 size={15} color={theme.colors.text} />
        ) : (
          <Cloud size={15} color={theme.colors.textSecondary} />
        )}
        {/* Dirty badge: an "in progress" dot tucked over the icon's corner. */}
        {isDirty && (
          <span
            title="In Progress — has uncommitted changes"
            style={{
              position: 'absolute',
              bottom: 0,
              left: -1,
              display: 'inline-flex',
              // Ring the dot in the row's background so it reads as a badge,
              // not part of the icon's own linework.
              borderRadius: '50%',
              boxShadow: `0 0 0 1.5px ${
                hovered ? theme.colors.backgroundSecondary : theme.colors.background
              }`,
            }}
          >
            <Circle size={7} fill={theme.colors.warning} color={theme.colors.warning} />
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: theme.fonts?.body,
              fontSize: theme.fontSizes[2],
              color: theme.colors.text,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.name}
          </span>
          {/* Private repos get a lock; public repos are unmarked (the default). */}
          {isPrivate === true && (
            <span
              title="Private repository"
              style={{ flexShrink: 0, display: 'inline-flex', position: 'relative', top: 1 }}
            >
              <Lock size={11} color={theme.colors.textSecondary} />
            </span>
          )}
        </div>
      </div>

      {/* Clone action for projects that aren't on disk yet. */}
      {!isCloned && onClone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClone();
          }}
          title="Clone to disk"
          aria-label={`Clone ${repo.name}`}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <Download size={14} />
        </button>
      )}

      {/* Relocate action for off-convention clones — move into the
          {base}/{owner}/{repo} layout. Sits next to the remove action. */}
      {isCloned && offConvention && onRelocate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRelocate();
          }}
          title="Not in {owner}/{repo} layout — move to standard location"
          aria-label={`Move ${repo.name} to standard location`}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.warning;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <FolderTree size={14} />
        </button>
      )}

      {/* Open-a-terminal-here action for cloned projects. */}
      {isCloned && onOpenTerminal && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTerminal();
          }}
          title="Open a terminal here"
          aria-label={`Open a terminal in ${repo.name}`}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <Terminal size={14} />
        </button>
      )}

      {/* Remove-from-registry action for cloned projects. */}
      {isCloned && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from list (does not delete the folder)"
          aria-label={`Remove ${repo.name} from list`}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.error ?? theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <Eraser size={14} />
        </button>
      )}

      {/* Sync indicator, far right (after the row actions): ↑ahead / ↓behind
          vs the upstream remote. Only renders when there's something to show. */}
      {showSync && (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          {ahead > 0 && (
            <span
              title={`${ahead} commit${ahead === 1 ? '' : 's'} ahead of remote`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: theme.colors.info,
              }}
            >
              <ArrowUp size={12} />
              {ahead}
            </span>
          )}
          {behind > 0 && (
            <span
              title={`${behind} commit${behind === 1 ? '' : 's'} behind remote`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: theme.colors.warning,
              }}
            >
              <ArrowDown size={12} />
              {behind}
            </span>
          )}
        </span>
      )}

      {/* Live-watch indicator — the right-most element in the row. A watched
          clone's git status updates on push/dirty changes instead of only when
          something re-queries it. Pulses while watching (see .animate-watchPulse
          in index.css). */}
      {watching && (
        <span
          className="animate-watchPulse"
          title="Watching — live git status (push and dirty changes update automatically)"
          aria-label="Watching for live changes"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
        >
          <Eye size={13} color={theme.colors.primary} />
        </span>
      )}
    </div>
  );
};

export default OrgRepoItemCard;
