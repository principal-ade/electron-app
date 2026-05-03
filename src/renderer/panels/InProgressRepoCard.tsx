/**
 * InProgressRepoCard
 *
 * Rich "in progress" card for the feed view — a sibling of RepoActivityCard
 * that represents uncommitted working-tree changes instead of a commit range.
 * The explanation of what the changes are about loads asynchronously, since
 * there are no commit messages to summarize from.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Check,
  FolderGit2,
  GitBranch,
  GitCommit,
  Loader2,
  Sparkles,
  Upload,
  User,
} from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
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
  aheadCount?: number;
  behindCount?: number;
  githubOwner?: string;
  githubRepoName?: string;
  isOwnerOrg?: boolean;
  lastEditAt?: Date;
}

export interface ExplainInProgressInput {
  repoPath: string;
  repoName: string;
  branch?: string;
  files: InProgressChangedFile[];
  audienceLevel: 'maintainer' | 'non-technical';
}

export interface ExplainInProgressResponse {
  text: string;
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

export interface ExplainInProgressRequest {
  repoPath: string;
  repoName: string;
  branch?: string;
  files: InProgressChangedFile[];
}

export interface InProgressRepoCardActions {
  getFileTreeForLocalRepo: (repoPath: string) => Promise<FileTree | null>;
  getWorkingChanges: (repoPath: string) => Promise<InProgressChangedFile[]>;
  explainWorkingChanges: (input: ExplainInProgressInput) => Promise<ExplainInProgressResponse>;
  getAheadCommits: (repoPath: string) => Promise<InProgressAheadCommit[]>;
  pushBranch: (repoPath: string) => Promise<InProgressPushResult>;
}

interface InProgressRepoCardProps {
  summary: InProgressSummary;
  onOpen?: () => void;
  onDismiss?: (repoPath: string) => void;
  onExplainRequested?: (request: ExplainInProgressRequest) => void;
  explainLoading?: boolean;
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

export const InProgressRepoCard: React.FC<InProgressRepoCardProps> = ({
  summary,
  onOpen,
  onDismiss,
  onExplainRequested,
  explainLoading = false,
  dimmed = false,
  events,
  entry,
  actions,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [avatarLoaded, setAvatarLoaded] = useState(true);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(true);
  const [changedFiles, setChangedFiles] = useState<InProgressChangedFile[]>([]);

  const [aheadCommits, setAheadCommits] = useState<InProgressAheadCommit[]>([]);
  const [aheadCommitsLoaded, setAheadCommitsLoaded] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState(false);
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
    if (aheadCount === 0) {
      setAheadCommits([]);
      setAheadCommitsLoaded(false);
      return;
    }
    let cancelled = false;
    setAheadCommitsLoaded(false);
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
  }, [summary.repoPath, aheadCount, actions]);

  useEffect(() => {
    setPushError(null);
    setPushSuccess(false);
    setPushing(false);
    setCollapsing(false);
    setCollapseHeight(null);
  }, [summary.repoPath]);

  const handlePush = useCallback(async () => {
    if (pushing) return;
    setPushing(true);
    setPushError(null);
    setPushSuccess(false);
    try {
      const result = await actions.pushBranch(summary.repoPath);
      if (result.success) {
        setPushSuccess(true);
        // Brief "Pushed" beat, then collapse the card and dismiss it.
        window.setTimeout(() => {
          const measured = cardRef.current?.getBoundingClientRect().height ?? 0;
          setCollapseHeight(measured);
          // Force a frame so the browser paints the explicit height before we
          // transition it to 0 — otherwise the transition is skipped.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setCollapsing(true));
          });
        }, 600);
      } else {
        setPushError(result.message || 'Push failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Push failed';
      setPushError(message);
    } finally {
      setPushing(false);
    }
  }, [actions, summary.repoPath, pushing]);

  const handleCollapseEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (!collapsing) return;
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== 'max-height') return;
      onDismiss?.(summary.repoPath);
    },
    [collapsing, onDismiss, summary.repoPath],
  );

  const requestExplain = useCallback(() => {
    if (!onExplainRequested) return;
    if (changedFiles.length === 0) return;
    onExplainRequested({
      repoPath: summary.repoPath,
      repoName: summary.repoName,
      branch: summary.branch,
      files: changedFiles,
    });
  }, [
    onExplainRequested,
    changedFiles,
    summary.repoPath,
    summary.repoName,
    summary.branch,
  ]);

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
        type: 'feed:repository-selected',
        source: 'in-progress-repo-card',
        timestamp: Date.now(),
        payload: { repository: entry },
      });
    }
  }, [entry, events]);

  const handleOpenOwnerProfile = useCallback(() => {
    if (summary.githubOwner && events) {
      events.emit({
        type: 'feed:owner-selected',
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
        cursor: onOpen ? 'pointer' : 'default',
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
      <div style={{ display: 'flex', minHeight: 300 }}>
        <div
          style={{
            width: 300,
            height: 300,
            backgroundColor: theme.colors.background,
            borderRight: `1px solid ${theme.colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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
            <FolderGit2 size={64} color={theme.colors.textMuted} style={{ opacity: 0.3 }} />
          )}
        </div>

        <div
          style={{
            flex: 1,
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleOpenOwnerProfile();
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
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
              {avatarLoaded && summary.githubOwner ? (
                <img
                  src={`https://github.com/${summary.githubOwner}.png?size=80`}
                  alt={summary.githubOwner}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setAvatarLoaded(false)}
                />
              ) : (
                <User size={28} color={theme.colors.textMuted} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <h4
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenProfile();
                  }}
                  style={{
                    margin: 0,
                    fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights.semibold,
                    lineHeight: '28px',
                    color: theme.colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: entry && events ? 'pointer' : 'default',
                  }}
                >
                  {summary.repoName}
                </h4>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    fontSize: theme.fontSizes[0],
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.warning,
                    backgroundColor: `${theme.colors.warning}22`,
                    borderRadius: 999,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: theme.colors.warning,
                      animation: 'inProgressPulse 1.4s ease-in-out infinite',
                    }}
                  />
                  In progress
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.textMuted,
                  lineHeight: '22px',
                }}
              >
                {summary.branch && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <GitBranch size={12} />
                    {summary.branch}
                  </span>
                )}
                {totals.fileCount > 0 && (
                  <span>
                    · {totals.fileCount} file{totals.fileCount !== 1 ? 's' : ''} changed
                    {totals.staged > 0 && ` (${totals.staged} staged)`}
                  </span>
                )}
                {totals.fileCount > 0 && onExplainRequested && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestExplain();
                    }}
                    disabled={explainLoading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      fontWeight: theme.fontWeights.semibold,
                      color: theme.colors.primary,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.primary}`,
                      borderRadius: 4,
                      cursor: explainLoading ? 'default' : 'pointer',
                      opacity: explainLoading ? 0.7 : 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {explainLoading ? (
                      <>
                        <Loader2
                          size={10}
                          style={{ animation: 'inProgressSpin 1s linear infinite' }}
                        />
                        <span>Explaining…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={10} />
                        <span>Explain</span>
                      </>
                    )}
                  </button>
                )}
                {summary.aheadCount !== undefined && summary.aheadCount > 0 && (
                  <span>↑{summary.aheadCount}</span>
                )}
                {summary.behindCount !== undefined && summary.behindCount > 0 && (
                  <span>↓{summary.behindCount}</span>
                )}
                {totals.fileCount === 0 && aheadCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePush();
                    }}
                    disabled={pushing || pushSuccess}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      fontWeight: theme.fontWeights.semibold,
                      color: pushSuccess ? '#fff' : theme.colors.background,
                      backgroundColor: pushSuccess
                        ? '#2ea043'
                        : pushing
                          ? theme.colors.textSecondary
                          : theme.colors.primary,
                      border: 'none',
                      borderRadius: 4,
                      cursor: pushing || pushSuccess ? 'default' : 'pointer',
                      opacity: pushing ? 0.7 : 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {pushing ? (
                      <>
                        <Loader2
                          size={10}
                          style={{ animation: 'inProgressSpin 1s linear infinite' }}
                        />
                        <span>Pushing…</span>
                      </>
                    ) : pushSuccess ? (
                      <>
                        <Check size={10} />
                        <span>Pushed</span>
                      </>
                    ) : (
                      <>
                        <Upload size={10} />
                        <span>Push</span>
                      </>
                    )}
                  </button>
                )}
                {summary.lastEditAt && <span>{formatRelativeTime(summary.lastEditAt)}</span>}
              </div>
            </div>
          </div>

          {(totals.additions > 0 || totals.deletions > 0) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.xs,
                marginBottom: spacing.sm,
              }}
            >
              {totals.additions > 0 && (
                <div
                  style={{
                    height: 24,
                    width: `${addedWidth}%`,
                    minWidth: 50,
                    backgroundColor: DIFF_ADD_COLOR,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: spacing.sm,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: '#fff',
                      fontWeight: theme.fontWeights.semibold,
                      fontFamily: theme.fonts.monospace,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ display: 'inline-block', width: 10, textAlign: 'center' }}>+</span>
                    {totals.additions}
                  </span>
                </div>
              )}
              {totals.deletions > 0 && (
                <div
                  style={{
                    height: 24,
                    width: `${removedWidth}%`,
                    minWidth: 50,
                    backgroundColor: DIFF_REMOVE_COLOR,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: spacing.sm,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: '#fff',
                      fontWeight: theme.fontWeights.semibold,
                      fontFamily: theme.fonts.monospace,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ display: 'inline-block', width: 10, textAlign: 'center' }}>−</span>
                    {totals.deletions}
                  </span>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.xs,
              flex: 1,
            }}
          >
            {totals.fileCount === 0 && aheadCount > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    fontSize: theme.fontSizes[0],
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <GitCommit size={12} />
                  <span>
                    {aheadCount} commit{aheadCount !== 1 ? 's' : ''} to push
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    maxHeight: 180,
                    overflowY: 'auto',
                  }}
                >
                  {!aheadCommitsLoaded ? (
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textMuted,
                        fontStyle: 'italic',
                      }}
                    >
                      Loading commits…
                    </span>
                  ) : aheadCommits.length === 0 ? (
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textMuted,
                        fontStyle: 'italic',
                      }}
                    >
                      Couldn&apos;t list commits (no upstream tracking?).
                    </span>
                  ) : (
                    aheadCommits.map((commit) => (
                      <div
                        key={commit.hash}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: spacing.sm,
                          padding: `${spacing.xs}px 0`,
                          fontSize: theme.fontSizes[1],
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: theme.fonts.monospace,
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {commit.hash.slice(0, 7)}
                        </span>
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
                        <span
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {commit.author}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {pushError && (
                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.error,
                    }}
                  >
                    {pushError}
                  </div>
                )}
              </>
            ) : (
              <>
                {totals.fileCount === 0 ? (
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textMuted,
                      fontStyle: 'italic',
                    }}
                  >
                    No working-tree changes yet.
                  </span>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {changedFiles.map((file) => (
                      <div
                        key={`${file.path}:${file.staged ? 's' : 'u'}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          borderRadius: 4,
                          fontFamily: theme.fonts.monospace,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            textAlign: 'center',
                            color:
                              statusToHighlight[file.status] === 'added'
                                ? DIFF_ADD_COLOR
                                : statusToHighlight[file.status] === 'removed'
                                  ? DIFF_REMOVE_COLOR
                                  : theme.colors.warning,
                            fontWeight: theme.fontWeights.semibold,
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
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.textMuted,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: 3,
                              padding: '0 6px',
                            }}
                          >
                            staged
                          </span>
                        )}
                        <span style={{ display: 'flex', gap: spacing.xs, flexShrink: 0 }}>
                          {file.additions > 0 && (
                            <span style={{ color: DIFF_ADD_COLOR }}>+{file.additions}</span>
                          )}
                          {file.deletions > 0 && (
                            <span style={{ color: DIFF_REMOVE_COLOR }}>-{file.deletions}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes inProgressPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
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
