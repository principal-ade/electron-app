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
  ChevronDown,
  ChevronRight,
  FolderGit2,
  GitBranch,
  Loader2,
  Sparkles,
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

export interface InProgressRepoCardActions {
  getFileTreeForLocalRepo: (repoPath: string) => Promise<FileTree | null>;
  getWorkingChanges: (repoPath: string) => Promise<InProgressChangedFile[]>;
  explainWorkingChanges: (input: ExplainInProgressInput) => Promise<ExplainInProgressResponse>;
}

interface InProgressRepoCardProps {
  summary: InProgressSummary;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpen?: () => void;
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
  isExpanded,
  onToggleExpand,
  onOpen,
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

  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainAudience, setExplainAudience] =
    useState<'maintainer' | 'non-technical'>('maintainer');
  const explainRunRef = useRef<{ cancel: () => void } | null>(null);

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

  const runExplain = useCallback(
    (audience: 'maintainer' | 'non-technical') => {
      if (changedFiles.length === 0) return;

      explainRunRef.current?.cancel();
      let cancelled = false;
      explainRunRef.current = {
        cancel: () => {
          cancelled = true;
        },
      };

      setExplainLoading(true);
      setExplainError(null);

      actions
        .explainWorkingChanges({
          repoPath: summary.repoPath,
          repoName: summary.repoName,
          branch: summary.branch,
          files: changedFiles,
          audienceLevel: audience,
        })
        .then((result) => {
          if (cancelled) return;
          setExplainText(result.text);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : 'Failed to generate explanation';
          setExplainError(message);
          setExplainText(null);
        })
        .finally(() => {
          if (!cancelled) setExplainLoading(false);
        });
    },
    [changedFiles, summary.repoPath, summary.repoName, summary.branch, actions],
  );

  // Reset explanation state when the repo changes so we don't show stale text
  // from a previous instance, and cancel any in-flight request on unmount.
  useEffect(() => {
    explainRunRef.current?.cancel();
    explainRunRef.current = null;
    setExplainText(null);
    setExplainError(null);
    setExplainLoading(false);
    return () => {
      explainRunRef.current?.cancel();
    };
  }, [summary.repoPath]);

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
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        opacity: dimmed ? 0.7 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
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
            cursor: onOpen ? 'pointer' : 'default',
          }}
          onDoubleClick={onOpen}
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
              maxCanvasSize={4096}
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'inherit';
                    }}
                  >
                    <span style={{ marginRight: 2 }}>·</span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {totals.fileCount} file{totals.fileCount !== 1 ? 's' : ''} changed
                    {totals.staged > 0 && ` (${totals.staged} staged)`}
                  </button>
                )}
                {summary.aheadCount !== undefined && summary.aheadCount > 0 && (
                  <span>↑{summary.aheadCount}</span>
                )}
                {summary.behindCount !== undefined && summary.behindCount > 0 && (
                  <span>↓{summary.behindCount}</span>
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.sm,
              }}
            >
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
                <Sparkles size={12} />
                <span>What&apos;s changing</span>
              </div>
              {(explainText || explainError || explainLoading) && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {(['maintainer', 'non-technical'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (explainAudience === level) return;
                        setExplainAudience(level);
                        runExplain(level);
                      }}
                      style={{
                        padding: `2px ${spacing.sm}px`,
                        fontSize: theme.fontSizes[0],
                        color:
                          explainAudience === level
                            ? theme.colors.text
                            : theme.colors.textSecondary,
                        backgroundColor:
                          explainAudience === level
                            ? theme.colors.backgroundSecondary
                            : 'transparent',
                        border: `1px solid ${
                          explainAudience === level ? theme.colors.border : 'transparent'
                        }`,
                        borderRadius: 4,
                        cursor: explainAudience === level ? 'default' : 'pointer',
                      }}
                    >
                      {level === 'maintainer' ? 'Technical' : 'Simple'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: theme.fontSizes[1],
                lineHeight: 1.6,
                color: explainError ? theme.colors.error : theme.colors.text,
                whiteSpace: 'pre-wrap',
                minHeight: 48,
              }}
            >
              {explainLoading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    color: theme.colors.textSecondary,
                    fontStyle: 'italic',
                  }}
                >
                  <Loader2
                    size={12}
                    style={{ animation: 'inProgressSpin 1s linear infinite' }}
                  />
                  <span>Analyzing working-tree changes…</span>
                </div>
              ) : explainError ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <span>Couldn&apos;t summarize changes: {explainError}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      runExplain(explainAudience);
                    }}
                    style={{
                      padding: `2px ${spacing.sm}px`,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.text,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : explainText ? (
                explainText
              ) : totals.fileCount === 0 ? (
                <span style={{ color: theme.colors.textMuted, fontStyle: 'italic' }}>
                  No working-tree changes yet.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    runExplain(explainAudience);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.primary,
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={12} />
                  <span>Explain changes</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      <div
        style={{
          borderTop: isExpanded ? `1px solid ${theme.colors.border}` : 'none',
          backgroundColor: theme.colors.background,
          maxHeight: isExpanded ? 260 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s ease-in-out',
        }}
      >
        <div
          style={{
            padding: spacing.md,
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 228,
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
      `}</style>
    </div>
  );
};

export default InProgressRepoCard;
