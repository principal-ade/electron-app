/**
 * InProgressRepoCard
 *
 * Square card for the in-progress grid view — shows a repo with uncommitted
 * working-tree changes. The body shows the File City map; the header has the
 * owner avatar, the repo name (hover tints it primary; click opens the repo
 * profile), and a "Changes" button. "Changes" and the ahead/behind indicators
 * swap the map for an inline list (changed files / ahead commits / behind
 * commits) rather than opening a modal.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArrowDown,
  ArrowUp,
  Check,
  FolderGit2,
  GitBranch,
  User,
  X,
} from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { payloadFromLocalEntry } from '../events/repositorySelected';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';
import type { FileTree } from '@principal-ai/repository-abstraction';

const DIFF_ADD_COLOR = '#2ea043';
const DIFF_REMOVE_COLOR = '#cf222e';

function diffBarWidthPct(lines: number): number {
  if (lines <= 0) return 0;
  if (lines < 100) return 25;
  if (lines < 500) return 50;
  if (lines < 1000) return 75;
  return 100;
}

export type InProgressFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked';

export interface InProgressChangedFile {
  path: string;
  status: InProgressFileStatus;
  additions: number;
  deletions: number;
  staged: boolean;
}

export interface InProgressSummary {
  repoPath: string;
  repoName: string;
  branch?: string;
  isDirty?: boolean;
  aheadCount?: number;
  behindCount?: number;
  githubOwner?: string;
  githubRepoName?: string;
  isOwnerOrg?: boolean;
  lastEditAt?: Date;
}

export interface InProgressAheadCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  /** Author email (ahead) or remote author login (behind). */
  email?: string;
  /** Resolved GitHub login, when known. */
  login?: string;
  /** Resolved avatar image URL, when known. */
  avatarUrl?: string;
}

export interface InProgressPushResult {
  success: boolean;
  message: string;
}

export interface InProgressRepoCardActions {
  getFileTreeForLocalRepo: (repoPath: string) => Promise<FileTree | null>;
  getWorkingChanges: (repoPath: string) => Promise<InProgressChangedFile[]>;
  getAheadCommits: (repoPath: string) => Promise<InProgressAheadCommit[]>;
  getBehindCommits: (repoPath: string) => Promise<InProgressAheadCommit[]>;
  pushBranch: (repoPath: string) => Promise<InProgressPushResult>;
}

interface InProgressRepoCardProps {
  summary: InProgressSummary;
  onDismiss?: (repoPath: string) => void;
  dimmed?: boolean;
  events?: PanelEventEmitter;
  entry?: AlexandriaEntry;
  actions: InProgressRepoCardActions;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const statusToHighlight: Record<InProgressFileStatus, 'added' | 'modified' | 'removed'> = {
  added: 'added',
  untracked: 'added',
  modified: 'modified',
  renamed: 'modified',
  deleted: 'removed',
};

const statusLabel: Record<InProgressFileStatus, string> = {
  added: 'A',
  untracked: '?',
  modified: 'M',
  renamed: 'R',
  deleted: 'D',
};

/** Small right-aligned action button used in the card header. */
function CardActionButton({
  children,
  onClick,
  title,
  variant = 'secondary',
  tall = false,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  variant?: 'primary' | 'secondary';
  tall?: boolean;
  active?: boolean;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        height: tall ? 42 : undefined,
        padding: tall ? '0 12px' : '2px 10px',
        borderRadius: 6,
        border: primary
          ? 'none'
          : `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
        background: primary
          ? theme.colors.primary
          : active
            ? `color-mix(in srgb, ${theme.colors.primary} 14%, transparent)`
            : hovered
              ? theme.colors.backgroundSecondary
              : 'transparent',
        color: primary
          ? theme.colors.textOnAccent
          : active
            ? theme.colors.primary
            : theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: 'pointer',
        opacity: primary && hovered ? 0.9 : 1,
      }}
    >
      {children}
    </button>
  );
}

export const InProgressRepoCard: React.FC<InProgressRepoCardProps> = ({
  summary,
  onDismiss,
  dimmed = false,
  events,
  entry,
  actions,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(true);
  const [changedFiles, setChangedFiles] = useState<InProgressChangedFile[]>([]);
  const [collapsing, setCollapsing] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [collapseHeight, setCollapseHeight] = useState<number | null>(null);
  const [nameHovered, setNameHovered] = useState(false);
  // The repo name opens the repo profile tab when we have an entry + event bus.
  const nameClickable = Boolean(entry && events);

  // Body overlay (over the File City map): changed files, or ahead/behind commits.
  const [overlay, setOverlay] = useState<null | 'changes' | 'ahead' | 'behind'>(
    null,
  );
  const [aheadCommits, setAheadCommits] = useState<InProgressAheadCommit[]>([]);
  const [aheadCommitsLoaded, setAheadCommitsLoaded] = useState(false);
  const [behindCommits, setBehindCommits] = useState<InProgressAheadCommit[]>([]);
  const [behindCommitsLoaded, setBehindCommitsLoaded] = useState(false);
  // Which ahead/behind indicator is hovered (they only tint on hover/selected).
  const [metaHovered, setMetaHovered] = useState<
    null | 'ahead' | 'behind' | 'branch'
  >(null);

  const aheadCount = summary.aheadCount ?? 0;
  const behindCount = summary.behindCount ?? 0;
  // Branch name is tinted to match the sync state (blue ahead / yellow behind / green synced).
  const syncColor =
    aheadCount > 0
      ? theme.colors.info
      : behindCount > 0
        ? theme.colors.warning
        : theme.colors.success;
  // Clicking the branch shows the relevant commit overlay (ahead wins if diverged).
  const branchTarget: 'ahead' | 'behind' | null =
    aheadCount > 0 ? 'ahead' : behindCount > 0 ? 'behind' : null;

  useEffect(() => {
    let cancelled = false;
    setCityLoading(true);

    actions
      .getFileTreeForLocalRepo(summary.repoPath)
      .then((fileTree) => {
        if (cancelled) return;
        if (fileTree) {
          const versionMap = new Map([['working', fileTree]]);
          const { unionCity } = MultiVersionCityBuilder.build(versionMap);
          setCityData(unionCity);
        } else {
          setCityData(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(`[InProgressRepoCard] Failed to build city for ${summary.repoName}:`, err);
        setCityData(null);
      })
      .finally(() => {
        if (!cancelled) setCityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [summary.repoPath, summary.repoName, actions]);

  useEffect(() => {
    let cancelled = false;

    actions
      .getWorkingChanges(summary.repoPath)
      .then((files) => {
        if (!cancelled) setChangedFiles(files);
      })
      .catch((err) => {
        console.warn(`[InProgressRepoCard] Failed to fetch working changes:`, err);
        if (!cancelled) setChangedFiles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [summary.repoPath, actions]);

  // Fetch ahead/behind commits lazily the first time each overlay is opened.
  useEffect(() => {
    if (overlay !== 'ahead' || aheadCommitsLoaded) return;
    let cancelled = false;
    actions
      .getAheadCommits(summary.repoPath)
      .then((commits) => {
        if (cancelled) return;
        setAheadCommits(commits);
        setAheadCommitsLoaded(true);
      })
      .catch((err) => {
        console.warn(`[InProgressRepoCard] Failed to fetch ahead commits:`, err);
        if (cancelled) return;
        setAheadCommits([]);
        setAheadCommitsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [overlay, aheadCommitsLoaded, actions, summary.repoPath]);

  useEffect(() => {
    if (overlay !== 'behind' || behindCommitsLoaded) return;
    let cancelled = false;
    actions
      .getBehindCommits(summary.repoPath)
      .then((commits) => {
        if (cancelled) return;
        setBehindCommits(commits);
        setBehindCommitsLoaded(true);
      })
      .catch((err) => {
        console.warn(`[InProgressRepoCard] Failed to fetch behind commits:`, err);
        if (cancelled) return;
        setBehindCommits([]);
        setBehindCommitsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [overlay, behindCommitsLoaded, actions, summary.repoPath]);

  useEffect(() => {
    setCollapsing(false);
    setCollapseHeight(null);
  }, [summary.repoPath]);

  const handleCollapseEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (!collapsing) return;
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== 'max-height') return;
      onDismiss?.(summary.repoPath);
    },
    [collapsing, onDismiss, summary.repoPath],
  );

  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let staged = 0;
    for (const f of changedFiles) {
      additions += f.additions;
      deletions += f.deletions;
      if (f.staged) staged += 1;
    }
    return {
      additions,
      deletions,
      staged,
      fileCount: changedFiles.length,
    };
  }, [changedFiles]);

  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    if (changedFiles.length === 0) return [];

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    for (const f of changedFiles) {
      const bucket = statusToHighlight[f.status];
      if (bucket === 'added') added.push(f.path);
      else if (bucket === 'modified') modified.push(f.path);
      else removed.push(f.path);
    }

    const layers: HighlightLayer[] = [];
    if (added.length > 0) {
      layers.push({
        id: 'added',
        name: 'Added',
        enabled: true,
        color: '#22c55e',
        priority: 10,
        items: added.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'glow' as const,
        })),
      });
    }
    if (modified.length > 0) {
      layers.push({
        id: 'modified',
        name: 'Modified',
        enabled: true,
        color: '#f59e0b',
        priority: 9,
        items: modified.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'glow' as const,
        })),
      });
    }
    if (removed.length > 0) {
      layers.push({
        id: 'removed',
        name: 'Removed',
        enabled: true,
        color: '#ef4444',
        priority: 8,
        items: removed.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'border' as const,
        })),
      });
    }
    return layers;
  }, [changedFiles]);

  const handleOpenProfile = useCallback(() => {
    if (!events) return;
    if (entry) {
      events.emit({
        type: 'repository:selected',
        source: 'in-progress-repo-card',
        timestamp: Date.now(),
        payload: payloadFromLocalEntry(entry),
      });
    }
  }, [entry, events]);

  const handleOpenOwnerProfile = useCallback(() => {
    if (summary.githubOwner && events) {
      events.emit({
        type: 'owner:selected',
        source: 'in-progress-repo-card',
        timestamp: Date.now(),
        payload: {
          owner: summary.githubOwner,
          isOrg: summary.isOwnerOrg || false,
        },
      });
    }
  }, [summary.githubOwner, summary.isOwnerOrg, events]);

  const totalLines = totals.additions + totals.deletions;
  const budget = diffBarWidthPct(totalLines);
  const addedWidth = totalLines > 0 ? (totals.additions / totalLines) * budget : 0;
  const removedWidth = totalLines > 0 ? (totals.deletions / totalLines) * budget : 0;

  return (
    <div
      ref={cardRef}
      onTransitionEnd={handleCollapseEnd}
      style={{
        position: 'relative',
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        opacity: collapsing ? 0 : dimmed ? 0.7 : 1,
        maxHeight: collapsing
          ? 0
          : collapseHeight !== null
            ? collapseHeight
            : undefined,
        transform: collapsing ? 'scale(0.96)' : 'scale(1)',
        transformOrigin: 'top center',
        pointerEvents: collapsing ? 'none' : 'auto',
        transition:
          'max-height 0.35s ease, opacity 0.3s ease, transform 0.3s ease',
        cursor: 'default',
        width: '100%',
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.surface,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleOpenOwnerProfile();
            }}
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: summary.githubOwner && events ? 'pointer' : 'default',
            }}
          >
            {summary.githubOwner ? (
              <img
                src={`https://github.com/${summary.githubOwner}.png?size=96`}
                alt={summary.githubOwner}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => {}}
              />
            ) : (
              <User size={20} color={theme.colors.textMuted} />
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 0,
            }}
          >
              <h4
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenProfile();
                }}
                onMouseEnter={() => setNameHovered(true)}
                onMouseLeave={() => setNameHovered(false)}
                style={{
                  margin: 0,
                  minWidth: 0,
                  fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.semibold,
                  lineHeight: '20px',
                  color:
                    nameClickable && nameHovered
                      ? theme.colors.primary
                      : theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: nameClickable ? 'pointer' : 'default',
                  transition: 'color 0.15s ease',
                }}
              >
                {summary.repoName}
              </h4>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[2],
                fontFamily: theme.fonts.monospace,
                color: theme.colors.textMuted,
                lineHeight: '20px',
                flexWrap: 'wrap',
              }}
            >
              {summary.branch && (
                <button
                  type="button"
                  onClick={() =>
                    branchTarget &&
                    setOverlay((o) => (o === branchTarget ? null : branchTarget))
                  }
                  onMouseEnter={() => setMetaHovered('branch')}
                  onMouseLeave={() => setMetaHovered(null)}
                  disabled={!branchTarget}
                  title={branchTarget ? 'Show commits' : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: syncColor,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    cursor: branchTarget ? 'pointer' : 'default',
                    textDecoration:
                      branchTarget &&
                      (metaHovered === 'branch' || overlay === branchTarget)
                        ? 'underline'
                        : 'none',
                  }}
                >
                  <GitBranch size={12} />
                  {summary.branch}
                </button>
              )}
              {aheadCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setOverlay((o) => (o === 'ahead' ? null : 'ahead'))
                  }
                  onMouseEnter={() => setMetaHovered('ahead')}
                  onMouseLeave={() => setMetaHovered(null)}
                  title="Show unpushed commits"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color:
                      overlay === 'ahead' || metaHovered === 'ahead'
                        ? theme.colors.info
                        : 'inherit',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowUp size={12} />
                  {aheadCount} ahead of remote
                </button>
              )}
              {behindCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setOverlay((o) => (o === 'behind' ? null : 'behind'))
                  }
                  onMouseEnter={() => setMetaHovered('behind')}
                  onMouseLeave={() => setMetaHovered(null)}
                  title="Show commits you're behind on"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color:
                      overlay === 'behind' || metaHovered === 'behind'
                        ? theme.colors.warning
                        : 'inherit',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowDown size={12} />
                  {behindCount} behind remote
                </button>
              )}
              {aheadCount === 0 && behindCount === 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: theme.colors.success,
                  }}
                >
                  <Check size={12} />
                  synced with remote
                </span>
              )}
              {summary.lastEditAt && <span>{formatRelativeTime(summary.lastEditAt)}</span>}
            </div>
          </div>

          <CardActionButton
            tall
            active={overlay === 'changes'}
            onClick={() =>
              setOverlay((o) => (o === 'changes' ? null : 'changes'))
            }
            title="Show changed files"
          >
            Changes
          </CardActionButton>
        </div>

        {(totals.additions > 0 || totals.deletions > 0) && (
          <div
            style={{
              display: 'flex',
              gap: spacing.xs,
              alignItems: 'center',
              height: 16,
              marginTop: spacing.xs,
            }}
          >
            {totals.additions > 0 && (
              <div
                style={{
                  height: 12,
                  width: `${addedWidth}%`,
                  minWidth: 24,
                  backgroundColor: DIFF_ADD_COLOR,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: '#fff',
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.monospace,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{totals.additions}
                </span>
              </div>
            )}
            {totals.deletions > 0 && (
              <div
                style={{
                  height: 12,
                  width: `${removedWidth}%`,
                  minWidth: 24,
                  backgroundColor: DIFF_REMOVE_COLOR,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: '#fff',
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.monospace,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  −{totals.deletions}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        {cityLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.sm,
              color: theme.colors.textMuted,
            }}
          >
            <FolderGit2 size={32} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: theme.fontSizes[0] }}>Loading...</span>
          </div>
        ) : cityData ? (
          <ArchitectureMapHighlightLayers
            cityData={cityData}
            highlightLayers={highlightLayers}
            fullSize
            showFileNames={false}
            canvasBackgroundColor={theme.colors.background}
            maxCanvasSize={1024}
          />
        ) : (
          <FolderGit2 size={48} color={theme.colors.textMuted} style={{ opacity: 0.3 }} />
        )}

        {overlay === 'changes' && (
          <CardOverlay
            title={`${totals.fileCount} changed file${totals.fileCount !== 1 ? 's' : ''}`}
          >
            <ChangedFilesList files={changedFiles} />
          </CardOverlay>
        )}
        {overlay === 'ahead' && (
          <CardOverlay
            title={`${aheadCount} commit${aheadCount !== 1 ? 's' : ''} to push`}
            onClose={() => setOverlay(null)}
          >
            <CommitList
              commits={aheadCommits}
              loaded={aheadCommitsLoaded}
              emptyText="Couldn't list commits (no upstream tracking?)."
            />
          </CardOverlay>
        )}
        {overlay === 'behind' && (
          <CardOverlay
            title={`${behindCount} commit${behindCount !== 1 ? 's' : ''} behind remote`}
            onClose={() => setOverlay(null)}
          >
            <CommitList
              commits={behindCommits}
              loaded={behindCommitsLoaded}
              emptyText="Couldn't list commits (no upstream tracking?)."
            />
          </CardOverlay>
        )}
      </div>
    </div>
  );
};

export default InProgressRepoCard;

/** Full-bleed panel that covers the map area with a titled, scrollable list. */
function CardOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: `color-mix(in srgb, ${theme.colors.background} 95%, transparent)`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: theme.fontSizes[0],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
              border: 'none',
              background: 'transparent',
              color: theme.colors.textMuted,
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>{children}</div>
    </div>
  );
}

function OverlayEmpty({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <span
      style={{
        fontSize: theme.fontSizes[0],
        color: theme.colors.textMuted,
        fontStyle: 'italic',
      }}
    >
      {children}
    </span>
  );
}

function ChangedFilesList({ files }: { files: InProgressChangedFile[] }) {
  const { theme } = useTheme();
  if (files.length === 0) {
    return <OverlayEmpty>No working-tree changes.</OverlayEmpty>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {files.map((file) => (
        <div
          key={`${file.path}:${file.staged ? 's' : 'u'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '2px 4px',
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
          }}
        >
          <span
            style={{
              width: 12,
              textAlign: 'center',
              fontWeight: theme.fontWeights.semibold,
              color:
                statusToHighlight[file.status] === 'added'
                  ? DIFF_ADD_COLOR
                  : statusToHighlight[file.status] === 'removed'
                    ? DIFF_REMOVE_COLOR
                    : theme.colors.warning,
            }}
          >
            {statusLabel[file.status]}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: file.staged ? 1 : 0.75,
            }}
            title={file.path}
          >
            {file.path}
          </span>
          {file.staged && (
            <span
              style={{
                flexShrink: 0,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textMuted,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 3,
                padding: '0 4px',
              }}
            >
              staged
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CommitList({
  commits,
  loaded,
  emptyText,
}: {
  commits: InProgressAheadCommit[];
  loaded: boolean;
  emptyText: string;
}) {
  const { theme } = useTheme();
  if (!loaded) return <OverlayEmpty>Loading commits…</OverlayEmpty>;
  if (commits.length === 0) return <OverlayEmpty>{emptyText}</OverlayEmpty>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {commits.map((commit) => (
        <div
          key={commit.hash}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: theme.fontSizes[0],
            minWidth: 0,
          }}
        >
          <CommitAvatar name={commit.author} avatarUrl={commit.avatarUrl} />
          <span
            style={{
              flex: 1,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={commit.message}
          >
            {commit.message}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Commit author avatar — the resolved GitHub image, else a colored initials badge. */
function CommitAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;

  return (
    <span
      title={name}
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `hsl(${hue} 45% 45%)`,
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  );
}
