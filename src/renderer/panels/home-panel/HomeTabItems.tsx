/**
 * Home tab rail items — the small presentational pieces the Home left panel
 * uses for tab entries:
 *
 * - {@link HomeTabRow}: a full row for an open tab (child of a repo row, or a
 *   standalone entry).
 * - {@link PinnedTabIcon}: the compact icon a repo row shows for a pinned tab
 *   whose tab is closed.
 *
 * Both are pure: the panel owns activation + pin state.
 */

import React, { useState } from 'react';
import {
  ProgramStatusBadge,
  type ProgramStatusRecord,
} from '@industry-theme/xterm-terminal-panel';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Building2,
  FileCode2,
  FileText,
  FolderGit2,
  FolderSearch,
  Globe,
  IdCard,
  Image as ImageIcon,
  Network,
  PenTool,
  Pin,
  Send,
  Terminal,
  ToolCase,
} from 'lucide-react';
import { TopicsIcon } from '../../components/TopicsIcon';
import { agentContextDragText } from '../../utils/agentContextDragText';
import { tildifyPath } from '../../utils/tildifyPath';
import { isHomeTabPinnable, type HomeTabEntry } from './homeTabEntries';

/**
 * Label the tab's purpose in Home, where its repository is already shown. A
 * standalone terminal (no repo row above it) shows its cwd instead: that is
 * what distinguishes one terminal from another.
 */
function homeTabLabel(entry: HomeTabEntry): string {
  if (entry.kind === 'repo-tab') {
    if (entry.variant === 'project-info') return 'Clone profile';
    if (entry.variant === 'repo-explorer') return 'Clone explorer';
  }
  if (entry.kind === 'terminal' && !entry.repoPath && entry.path) {
    return tildifyPath(entry.path);
  }
  return entry.label;
}

function homeTabDragText(entry: HomeTabEntry): string | undefined {
  const title = entry.title || entry.label;
  if (entry.kind === 'topic' && entry.topicId) {
    return agentContextDragText('topic', entry.topicId, title);
  }
  if (entry.kind === 'subsystem-model' && entry.modelId) {
    return agentContextDragText('subsystem model', entry.modelId, title);
  }
  return undefined;
}

/** Icon for a tab entry in the Home rail. */
export function homeTabIcon(
  entry: HomeTabEntry,
  size = 14,
  color?: string,
): React.ReactNode {
  switch (entry.kind) {
    case 'http-request':
      return <Send size={size} color={color} />;
    case 'topic':
      return <TopicsIcon size={size} color={color} />;
    case 'markdown-doc':
      return <FileText size={size} color={color} />;
    case 'source-file':
      return <FileCode2 size={size} color={color} />;
    case 'media':
      return <ImageIcon size={size} color={color} />;
    case 'drawing':
      return <PenTool size={size} color={color} />;
    case 'subsystem-model':
      return <Network size={size} color={color} />;
    case 'skill':
      return <ToolCase size={size} color={color} />;
    case 'localhost-browser':
      return <Globe size={size} color={color} />;
    case 'terminal':
      return <Terminal size={size} color={color} />;
    case 'repo-tab':
      if (entry.variant === 'project-info') {
        return <IdCard size={size} color={color} />;
      }
      return entry.variant === 'repo-explorer' ? (
        <FolderSearch size={size} color={color} />
      ) : entry.variant === 'file-city-guide' ? (
        <Building2 size={size} color={color} />
      ) : (
        <FolderGit2 size={size} color={color} />
      );
    default:
      return <FileText size={size} color={color} />;
  }
}

export interface HomeTabRowProps {
  entry: HomeTabEntry;
  /** Whether the entry's tab is currently open (vs a pinned closed entry). */
  open: boolean;
  /** Current 1-based tab-bar position, never persisted with a pin. */
  tabNumber?: number;
  /** Live status for this terminal, independent of active-tab and pin state. */
  programStatus?: ProgramStatusRecord;
  pinned: boolean;
  /** Extra left padding for child rows nested under a repo row. */
  depth?: number;
  /** Optionally disable pinning for otherwise pinnable tab kinds. */
  pinnable?: boolean;
  /**
   * Wrap long labels instead of truncating them. Used for kinds whose titles
   * are user-authored and can be long (topics, subsystem models).
   */
  wrapLabel?: boolean;
  onActivate: () => void;
  onTogglePin: () => void;
}

/**
 * A quiet tab row: icon + label, with the pin toggle revealed on hover (and
 * always shown while pinned). The label dims for a pinned entry whose tab is
 * closed, so "open now" and "closed, pinnable" read differently.
 */
export const HomeTabRow: React.FC<HomeTabRowProps> = ({
  entry,
  open,
  tabNumber,
  programStatus,
  pinned,
  depth = 0,
  pinnable = true,
  wrapLabel = false,
  onActivate,
  onTogglePin,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const label = homeTabLabel(entry);
  const dragText = homeTabDragText(entry);
  const accessibleLabel =
    entry.kind === 'terminal' && !entry.repoPath && entry.path
      ? `Open terminal in ${entry.path}`
      : `Open ${label}`;

  return (
    <div
      onClick={onActivate}
      draggable={dragText !== undefined}
      onDragStart={(event) => {
        if (!dragText || !event.dataTransfer) return;
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', dragText);
      }}
      role="button"
      aria-label={accessibleLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: wrapLabel ? 'flex-start' : 'center',
        gap: 8,
        padding: `8px 10px 8px ${14 + depth * 18}px`,
        borderRadius: 0,
        cursor: 'pointer',
        backgroundColor: hovered
          ? theme.colors.backgroundSecondary
          : 'transparent',
        transition: 'background-color 0.15s ease',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          // Center the 14px glyph on the first wrapped line (line-height is
          // 1.35 × 16px = 21.6px, plus the label's 1px top padding).
          marginTop: wrapLabel ? 5 : 0,
          color: theme.colors.textSecondary,
        }}
      >
        {homeTabIcon(entry, depth > 0 ? 13 : 14, theme.colors.textSecondary)}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: theme.fonts?.body,
          fontSize: depth > 0 ? theme.fontSizes[1] : theme.fontSizes[2],
          color: open ? theme.colors.text : theme.colors.textSecondary,
          // A pinned-but-closed entry reads as dormant next to an open tab.
          opacity: open ? 1 : 0.75,
          ...(wrapLabel
            ? {
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                lineHeight: 1.35,
                paddingTop: 1,
              }
            : {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }),
        }}
      >
        {label}
      </span>
      {open &&
        entry.kind === 'terminal' &&
        programStatus &&
        programStatus.state !== 'idle' &&
        programStatus.state !== 'clear' && (
          <span
            role="status"
            aria-label={`Terminal ${programStatus.state}${programStatus.kind ? `: ${programStatus.kind}` : ''}`}
            style={{
              display: 'inline-flex',
              flexShrink: 0,
              alignItems: 'center',
            }}
          >
            <ProgramStatusBadge record={programStatus} />
          </span>
        )}
      {open &&
        tabNumber != null &&
        entry.kind === 'repo-tab' &&
        (entry.variant === 'project-info' ||
          entry.variant === 'repo-explorer') && (
          <span
            style={{
              flexShrink: 0,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            Tab {tabNumber}
          </span>
        )}
      {pinnable && isHomeTabPinnable(entry) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: pinned ? theme.colors.primary : theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: pinned || hovered ? 1 : 0,
            transition: 'opacity 120ms, color 120ms',
          }}
        >
          <Pin size={12} fill={pinned ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
};

export interface PinnedTabIconProps {
  entry: HomeTabEntry;
  active: boolean;
  onActivate: () => void;
  /** Ctrl/Cmd-click or context action could unpin; clicking reopens. */
  onUnpin: () => void;
}

/**
 * Compact icon for a pinned repo-rooted tab whose tab is closed. Rendered at
 * the right of the repo-name row. Clicking reopens the tab; the little dot on
 * hover indicates it can be unpinned with a right-click.
 */
export const PinnedTabIcon: React.FC<PinnedTabIconProps> = ({
  entry,
  active,
  onActivate,
  onUnpin,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const label = homeTabLabel(entry);

  return (
    <button
      type="button"
      onClick={onActivate}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUnpin();
      }}
      aria-label={`Reopen pinned tab ${label}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        padding: 0,
        border: 'none',
        borderRadius: 4,
        background: hovered ? theme.colors.backgroundSecondary : 'transparent',
        color: active ? theme.colors.primary : theme.colors.textSecondary,
        cursor: 'pointer',
        opacity: 0.9,
        transition: 'background-color 120ms, color 120ms',
      }}
    >
      {homeTabIcon(entry, 13, hovered ? theme.colors.primary : undefined)}
    </button>
  );
};
