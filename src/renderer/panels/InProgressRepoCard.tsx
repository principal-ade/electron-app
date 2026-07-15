/**
 * InProgressRepoCard
 *
 * Square card for the in-progress grid view — shows a repo with uncommitted
 * working-tree changes. Displays a compact summary with the File City
 * visualization. Clicking the card opens InProgressRepoDetailModal with the
 * full file/commit lists.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Upload,
  User,
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
}

export interface InProgressPushResult {
  success: boolean;
  message: string;
}

export interface InProgressRepoCardActions {
  getFileTreeForLocalRepo: (repoPath: string) => Promise<FileTree | null>;
  getWorkingChanges: (repoPath: string) => Promise<InProgressChangedFile[]>;
  getAheadCommits: (repoPath: string) => Promise<InProgressAheadCommit[]>;
  pushBranch: (repoPath: string) => Promise<InProgressPushResult>;
}

interface InProgressRepoCardProps {
  summary: InProgressSummary;
  onOpen?: () => void;
  onDismiss?: (repoPath: string) => void;
  dimmed?: boolean;
  events?: PanelEventEmitter;
  entry?: AlexandriaEntry;
  actions: InProgressRepoCardActions;
  onSelect?: (repoPath: string) => void;
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

export const InProgressRepoCard: React.FC<InProgressRepoCardProps> = ({
  summary,
  onOpen,
  onDismiss,
  dimmed = false,
  events,
  entry,
  actions,
  onSelect,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(true);
  const [changedFiles, setChangedFiles] = useState<InProgressChangedFile[]>([]);
  const [collapsing, setCollapsing] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [collapseHeight, setCollapseHeight] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const openingTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (openingTimerRef.current !== null) {
        window.clearTimeout(openingTimerRef.current);
      }
    },
    [],
  );

  const handleCardClick = useCallback(() => {
    if (onSelect) {
      onSelect(summary.repoPath);
    }
  }, [onSelect, summary.repoPath]);

  const handleCardDoubleClick = useCallback(() => {
    if (!onOpen) return;
    setOpening(true);
    onOpen();
    if (openingTimerRef.current !== null) {
      window.clearTimeout(openingTimerRef.current);
    }
    openingTimerRef.current = window.setTimeout(() => {
      setOpening(false);
      openingTimerRef.current = null;
    }, 3600);
  }, [onOpen]);

  const aheadCount = summary.aheadCount ?? 0;

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
      onClick={handleCardClick}
      onDoubleClick={handleCardDoubleClick}
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
        cursor: onSelect ? 'pointer' : 'default',
        width: '100%',
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column',
        animation:
          opening && !collapsing
            ? 'inProgressOpenPulse 3500ms ease-in-out'
            : undefined,
      }}
    >
      {opening && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            padding: 2,
            background: `conic-gradient(from var(--in-progress-trace-angle, 0deg), ${theme.colors.primary}00 0deg, ${theme.colors.primary} 60deg, ${theme.colors.primary}00 140deg, ${theme.colors.primary}00 360deg)`,
            WebkitMask:
              'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
            animation: 'inProgressTrace 3300ms linear',
            zIndex: 2,
          }}
        />
      )}

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
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              cursor: summary.githubOwner && events ? 'pointer' : 'default',
            }}
          >
            {summary.githubOwner ? (
              <img
                src={`https://github.com/${summary.githubOwner}.png?size=48`}
                alt={summary.githubOwner}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => {}}
              />
            ) : (
              <User size={14} color={theme.colors.textMuted} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h4
              onClick={(e) => {
                e.stopPropagation();
                handleOpenProfile();
              }}
              style={{
                margin: 0,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                lineHeight: '20px',
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: entry && events ? 'pointer' : 'default',
              }}
            >
              {summary.repoName}
            </h4>
          </div>

          {summary.isDirty === false && aheadCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                fontSize: theme.fontSizes[0],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.textOnAccent,
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
              <Upload size={10} />
              Ahead
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts.monospace,
            color: theme.colors.textMuted,
            lineHeight: '16px',
            flexWrap: 'wrap',
            marginTop: spacing.xs,
          }}
        >
          {summary.branch && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <GitBranch size={10} />
              {summary.branch}
            </span>
          )}
          {totals.fileCount > 0 && (
            <span>
              + {totals.fileCount} file{totals.fileCount !== 1 ? 's' : ''} changed
              {totals.staged > 0 && ` (${totals.staged} staged)`}
            </span>
          )}
          {aheadCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <GitCommit size={10} />
              {aheadCount} commit{aheadCount !== 1 ? 's' : ''} ahead
            </span>
          )}
          {summary.lastEditAt && <span>{formatRelativeTime(summary.lastEditAt)}</span>}
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
      </div>

      <style>{`
        @keyframes inProgressSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @property --in-progress-trace-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes inProgressTrace {
          from { --in-progress-trace-angle: 0deg; }
          to { --in-progress-trace-angle: 360deg; }
        }
        @keyframes inProgressOpenPulse {
          0% { transform: scale(1); }
          8% { transform: scale(1.02); }
          92% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default InProgressRepoCard;
