/**
 * RepoActivityCard
 *
 * Rich repository activity card with commit visualization,
 * File City integration, animations, and AI explanations.
 * Based on web-ade RepoActivityCard design.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FolderGit2,
  ChevronDown,
  ChevronRight,
  User,
  Play,
  Square,
  Sparkles,
  FileCode,
} from 'lucide-react';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { GitService } from '../main-process-api/GitService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';

/**
 * Repository activity summary for the card
 */
export interface RepoActivitySummary {
  repoPath: string;
  repoName: string;
  commits: ActivityCommit[];
  latestCommitAt: Date;
  commitCount: number;
  githubOwner?: string;
  githubRepo?: string;
}

interface RepoActivityCardProps {
  summary: RepoActivitySummary;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
  dimmed?: boolean;
  events?: PanelEventEmitter;
}

/**
 * Format relative time from date
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}


export const RepoActivityCard: React.FC<RepoActivityCardProps> = ({
  summary,
  isExpanded,
  onToggleExpand,
  onOpen,
  dimmed = false,
  events,
}) => {
  const { theme } = useTheme();
  const hasMoreCommits = summary.commits.length > 1;

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  // Selection state for commit dots
  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(null);

  // Avatar load state
  const [avatarLoaded, setAvatarLoaded] = useState(true);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationCommitIndex, setAnimationCommitIndex] = useState<number | null>(null);
  const [typewriterText, setTypewriterText] = useState<string>('');
  const animationRef = useRef<{ cancel: boolean }>({ cancel: false });

  // File City state
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(true);

  // Changed files for highlight layers
  const [changedFiles, setChangedFiles] = useState<Map<string, 'added' | 'modified' | 'removed'>>(
    new Map()
  );

  // Line count stats per commit (hash -> stats)
  const [commitStats, setCommitStats] = useState<
    Map<string, { additions: number; deletions: number; filesChanged: number }>
  >(new Map());

  // Files changed per commit
  const [commitFiles, setCommitFiles] = useState<
    Map<string, Array<{ filename: string; status: string; additions: number; deletions: number }>>
  >(new Map());

  // Inline explanation state (placeholder for future AI integration)
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  // Get the commit to display (animation > selected > none)
  const displayedCommitIndex = animationCommitIndex ?? selectedCommitIndex;
  const displayedCommit =
    displayedCommitIndex !== null ? summary.commits[displayedCommitIndex] : undefined;
  const displayedTime = new Date(displayedCommit?.date ?? summary.latestCommitAt);
  const displayedMessage =
    isAnimating && typewriterText !== null ? typewriterText : displayedCommit?.message ?? '';

  // Build File City data from repository
  useEffect(() => {
    let cancelled = false;

    const buildCity = async () => {
      setCityLoading(true);
      try {
        // Get the file tree from RepositoryMonitoringService
        const fileTree = await RepositoryMonitoringService.getFileTree(summary.repoPath);

        if (cancelled) return;

        if (fileTree) {
          const versionMap = new Map([['main', fileTree]]);
          const { unionCity } = MultiVersionCityBuilder.build(versionMap);
          setCityData(unionCity);
        }
      } catch (err) {
        console.warn(`[RepoActivityCard] Failed to build city for ${summary.repoName}:`, err);
      } finally {
        if (!cancelled) {
          setCityLoading(false);
        }
      }
    };

    buildCity();

    return () => {
      cancelled = true;
    };
  }, [summary.repoPath, summary.repoName]);

  // Fetch stats for all commits
  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      const statsMap = new Map<
        string,
        { additions: number; deletions: number; filesChanged: number }
      >();
      const filesMap = new Map<
        string,
        Array<{ filename: string; status: string; additions: number; deletions: number }>
      >();

      // Fetch changed files for each commit
      await Promise.all(
        summary.commits.map(async (commit) => {
          if (cancelled) return;

          try {
            const changedFiles = await GitService.getChangedFilesForCommit(
              summary.repoPath,
              commit.hash
            );

            let totalAdditions = 0;
            let totalDeletions = 0;
            const filesArray: Array<{
              filename: string;
              status: string;
              additions: number;
              deletions: number;
            }> = [];

            changedFiles.forEach((fileInfo, filename) => {
              totalAdditions += fileInfo.additions;
              totalDeletions += fileInfo.deletions;
              filesArray.push({
                filename,
                status: fileInfo.status,
                additions: fileInfo.additions,
                deletions: fileInfo.deletions,
              });
            });

            statsMap.set(commit.hash, {
              additions: totalAdditions,
              deletions: totalDeletions,
              filesChanged: changedFiles.size,
            });

            filesMap.set(commit.hash, filesArray);
          } catch (err) {
            console.warn(`[RepoActivityCard] Failed to fetch stats for ${commit.hash}:`, err);
          }
        })
      );

      if (!cancelled) {
        setCommitStats(statsMap);
        setCommitFiles(filesMap);
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [summary.commits, summary.repoPath]);

  // Build changed files for highlight layers
  useEffect(() => {
    if (!displayedCommit) {
      // Aggregate all files from all commits
      if (commitFiles.size === 0) {
        setChangedFiles(new Map());
        return;
      }

      const fileMap = new Map<string, 'added' | 'modified' | 'removed'>();
      commitFiles.forEach((files) => {
        for (const file of files) {
          const status =
            file.status === 'added'
              ? 'added'
              : file.status === 'deleted'
                ? 'removed'
                : 'modified';
          // If file already exists, prefer showing it as modified (touched multiple times)
          if (!fileMap.has(file.filename)) {
            fileMap.set(file.filename, status);
          } else if (fileMap.get(file.filename) !== status) {
            fileMap.set(file.filename, 'modified');
          }
        }
      });
      setChangedFiles(fileMap);
      return;
    }

    // Get changed files for the displayed commit
    const files = commitFiles.get(displayedCommit.hash);
    if (!files) {
      setChangedFiles(new Map());
      return;
    }

    const fileMap = new Map<string, 'added' | 'modified' | 'removed'>();
    for (const file of files) {
      const status =
        file.status === 'added'
          ? 'added'
          : file.status === 'deleted'
            ? 'removed'
            : 'modified';
      fileMap.set(file.filename, status);
    }
    setChangedFiles(fileMap);
  }, [displayedCommit, commitFiles]);

  // Create highlight layers for changed files
  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    if (changedFiles.size === 0) return [];

    const addedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const removedFiles: string[] = [];

    changedFiles.forEach((status, path) => {
      if (status === 'added') addedFiles.push(path);
      else if (status === 'modified') modifiedFiles.push(path);
      else if (status === 'removed') removedFiles.push(path);
    });

    const layers: HighlightLayer[] = [];

    if (addedFiles.length > 0) {
      layers.push({
        id: 'added',
        name: 'Added',
        enabled: true,
        color: '#22c55e', // green
        priority: 10,
        items: addedFiles.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'glow' as const,
        })),
      });
    }

    if (modifiedFiles.length > 0) {
      layers.push({
        id: 'modified',
        name: 'Modified',
        enabled: true,
        color: '#f59e0b', // amber
        priority: 9,
        items: modifiedFiles.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'glow' as const,
        })),
      });
    }

    if (removedFiles.length > 0) {
      layers.push({
        id: 'removed',
        name: 'Removed',
        enabled: true,
        color: '#ef4444', // red
        priority: 8,
        items: removedFiles.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'border' as const,
        })),
      });
    }

    return layers;
  }, [changedFiles]);

  // Animation logic
  const startAnimation = useCallback(async () => {
    if (isAnimating) {
      // Stop animation
      animationRef.current.cancel = true;
      setIsAnimating(false);
      setAnimationCommitIndex(null);
      setTypewriterText('');
      return;
    }

    setIsAnimating(true);
    animationRef.current.cancel = false;

    // Animate through commits
    const commits = summary.commits;

    for (let i = 0; i < commits.length; i++) {
      if (animationRef.current.cancel) break;

      const commit = commits[i];
      if (!commit) continue;

      setAnimationCommitIndex(i);
      setTypewriterText('');

      // Typewriter effect for commit message
      const message = commit.message;
      for (let j = 0; j <= message.length; j++) {
        if (animationRef.current.cancel) break;
        setTypewriterText(message.slice(0, j));
        await new Promise((resolve) => setTimeout(resolve, 30)); // 30ms per character
      }

      if (animationRef.current.cancel) break;

      // Pause at each commit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Animation complete
    if (!animationRef.current.cancel) {
      setIsAnimating(false);
      setAnimationCommitIndex(null);
      setTypewriterText('');
    }
  }, [isAnimating, summary.commits]);

  // Cleanup animation on unmount
  useEffect(() => {
    const ref = animationRef.current;
    return () => {
      ref.cancel = true;
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        opacity: dimmed ? 0.7 : 1,
        transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Horizontal layout: image left, content right */}
      <div
        style={{
          display: 'flex',
          minHeight: 300,
        }}
      >
        {/* File City image - left side */}
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
            cursor: 'pointer',
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

        {/* Summary info - right side */}
        <div
          style={{
            flex: 1,
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
          }}
          onClick={onToggleExpand}
        >
          {/* Header with avatar, name, and time */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            {/* Avatar */}
            <div
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
              }}
            >
              {avatarLoaded && summary.githubOwner ? (
                <img
                  src={`https://github.com/${summary.githubOwner}.png?size=80`}
                  alt={summary.githubOwner}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={() => setAvatarLoaded(false)}
                />
              ) : (
                <User size={28} color={theme.colors.textMuted} />
              )}
            </div>

            {/* Name and time */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                style={{
                  margin: 0,
                  marginBottom: spacing.xs,
                  fontSize: theme.fontSizes[3],
                  fontWeight: 600,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {summary.repoName}
              </h4>
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textMuted,
                }}
              >
                {formatRelativeTime(displayedTime)}
              </span>
            </div>
          </div>

          {/* Commit avatars - grouped in rows of 10 with connecting line */}
          {summary.commits.length > 0 && (
            <div style={{ marginBottom: spacing.md }}>
              {Array.from({ length: Math.ceil(summary.commits.length / 10) }).map((_, rowIndex) => {
                const rowCommits = summary.commits.slice(rowIndex * 10, (rowIndex + 1) * 10);
                return (
                  <div
                    key={rowIndex}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom:
                        rowIndex < Math.ceil(summary.commits.length / 10) - 1 ? spacing.sm : 0,
                      height: 44,
                      paddingLeft: 8,
                    }}
                  >
                    {/* Connecting line */}
                    <div
                      style={{
                        position: 'absolute',
                        left: -spacing.md,
                        right: `${50 / rowCommits.length}%`,
                        top: '50%',
                        height: 1,
                        backgroundColor: theme.colors.primary,
                        transform: 'translateY(-50%)',
                        zIndex: 0,
                      }}
                    />
                    {/* Author avatars */}
                    {rowCommits.map((commit, index) => {
                      const globalIndex = rowIndex * 10 + index;
                      const activeIndex = isAnimating ? animationCommitIndex : selectedCommitIndex;
                      const isDisplayed = globalIndex === activeIndex;

                      return (
                        <div
                          key={commit.hash}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCommitIndex(globalIndex);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                            height: '100%',
                            cursor: 'pointer',
                            zIndex: 1,
                          }}
                        >
                          {commit.authorEmail ? (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                border: isDisplayed
                                  ? `2px solid ${theme.colors.primary}`
                                  : `2px solid ${theme.colors.surface}`,
                                backgroundColor: theme.colors.textMuted,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 600,
                                color: theme.colors.background,
                                transition: 'border-color 0.15s ease',
                                boxSizing: 'content-box',
                              }}
                            >
                              {commit.author.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                backgroundColor: isDisplayed
                                  ? theme.colors.primary
                                  : theme.colors.textMuted,
                                border: `2px solid ${theme.colors.surface}`,
                                transition: 'background-color 0.15s ease',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Author + per-commit stats OR aggregate stats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.xs,
            }}
          >
            {displayedCommit ? (
              <>
                {/* Clickable author name */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSizes[2],
                      color: theme.colors.text,
                      fontWeight: 500,
                    }}
                  >
                    {displayedCommit.author}
                  </span>
                </div>
                {/* Per-commit stats */}
                {(() => {
                  const stats = commitStats.get(displayedCommit.hash);
                  if (!stats) return null;
                  const parts: React.ReactNode[] = [];
                  if (stats.additions > 0) {
                    parts.push(
                      <span key="add" style={{ color: theme.colors.success }}>
                        +{stats.additions}
                      </span>
                    );
                  }
                  if (stats.deletions > 0) {
                    parts.push(
                      <span key="del" style={{ color: theme.colors.error }}>
                        -{stats.deletions}
                      </span>
                    );
                  }
                  if (stats.filesChanged > 0) {
                    parts.push(
                      <span key="files" style={{ color: theme.colors.textMuted }}>
                        {stats.filesChanged} file{stats.filesChanged !== 1 ? 's' : ''}
                      </span>
                    );
                  }
                  if (parts.length === 0) return null;
                  return (
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        marginLeft: spacing.xs,
                        display: 'flex',
                        gap: spacing.sm,
                      }}
                    >
                      {parts}
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Aggregate stats when no commit selected */
              (() => {
                let totalAdditions = 0;
                let totalDeletions = 0;
                const allFiles = new Set<string>();
                commitStats.forEach((stats) => {
                  totalAdditions += stats.additions;
                  totalDeletions += stats.deletions;
                });
                commitFiles.forEach((files) => {
                  files.forEach((f) => allFiles.add(f.filename));
                });
                const totalFiles = allFiles.size;
                if (totalAdditions === 0 && totalDeletions === 0 && totalFiles === 0) return null;
                const totalLines = totalAdditions + totalDeletions || 1;
                const addedWidth = (totalAdditions / totalLines) * 100;
                const removedWidth = (totalDeletions / totalLines) * 100;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, flex: 1 }}>
                    {/* Files changed */}
                    {totalFiles > 0 && (
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textMuted,
                          marginBottom: spacing.xs,
                        }}
                      >
                        {totalFiles} file{totalFiles !== 1 ? 's' : ''} changed
                      </div>
                    )}
                    {/* Visual bars with numbers inside */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                      {totalAdditions > 0 && (
                        <div
                          style={{
                            height: 24,
                            width: `${addedWidth}%`,
                            minWidth: 50,
                            backgroundColor: theme.colors.success,
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
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span style={{ display: 'inline-block', width: 10, textAlign: 'center' }}>
                              +
                            </span>
                            {totalAdditions}
                          </span>
                        </div>
                      )}
                      {totalDeletions > 0 && (
                        <div
                          style={{
                            height: 24,
                            width: `${removedWidth}%`,
                            minWidth: 50,
                            backgroundColor: theme.colors.error,
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
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span style={{ display: 'inline-block', width: 10, textAlign: 'center' }}>
                              −
                            </span>
                            {totalDeletions}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* Commit message */}
          <div
            style={{
              fontSize: theme.fontSizes[2],
              color: isAnimating ? theme.colors.primary : theme.colors.text,
              marginBottom: spacing.sm,
              transition: 'color 0.15s ease',
              minHeight: '1.5em',
            }}
          >
            {displayedMessage}
            {isAnimating && <span style={{ opacity: 0.5 }}>|</span>}
          </div>

          {/* Spacer to push controls to bottom */}
          <div style={{ flex: 1 }} />

          {/* Controls row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            {/* Animate button */}
            {hasMoreCommits && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAnimation();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: theme.fontSizes[1],
                  color: isAnimating ? theme.colors.error : theme.colors.primary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${isAnimating ? theme.colors.error : theme.colors.primary}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isAnimating ? <Square size={12} /> : <Play size={12} />}
                <span>{isAnimating ? 'Stop' : 'Animate'}</span>
              </button>
            )}

            {/* Review Diff button */}
            {displayedCommitIndex !== null && events && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const commit = summary.commits[displayedCommitIndex];
                  events.emit({
                    type: 'commit:review-selected',
                    source: 'repo-activity-card',
                    timestamp: Date.now(),
                    payload: {
                      repoPath: summary.repoPath,
                      repoName: summary.repoName,
                      commit,
                    },
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.primary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileCode size={12} />
                <span>Review</span>
              </button>
            )}

            {/* Explain button (placeholder) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExplainOpen(!isExplainOpen);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                fontSize: theme.fontSizes[1],
                color: isExplainOpen ? theme.colors.text : theme.colors.primary,
                backgroundColor: 'transparent',
                border: `1px solid ${isExplainOpen ? theme.colors.border : theme.colors.primary}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={12} />
              <span>{isExplainOpen ? 'Hide' : 'Explain'}</span>
            </button>

            {/* Show details button */}
            {hasMoreCommits && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textMuted,
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{isExpanded ? 'Hide' : 'Details'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded commits list */}
      <div
        style={{
          borderTop: isExpanded ? `1px solid ${theme.colors.border}` : 'none',
          backgroundColor: theme.colors.background,
          maxHeight: isExpanded ? 250 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s ease-in-out',
        }}
      >
        <div
          style={{
            padding: spacing.md,
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {summary.commits.map((commit, index) => {
              const stats = commitStats.get(commit.hash);
              const isSelected = selectedCommitIndex === index;
              return (
                <div
                  key={commit.hash}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCommitIndex(index);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    borderRadius: 6,
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}15`
                      : 'transparent',
                    border: isSelected
                      ? `1px solid ${theme.colors.primary}`
                      : `1px solid transparent`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Author initial */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: theme.colors.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      color: theme.colors.background,
                      flexShrink: 0,
                    }}
                  >
                    {commit.author.charAt(0).toUpperCase()}
                  </div>
                  {/* Message */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: theme.fontSizes[2],
                      color: theme.colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {commit.message}
                  </div>
                  {/* Line counts */}
                  {stats && (
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        display: 'flex',
                        gap: spacing.xs,
                        flexShrink: 0,
                      }}
                    >
                      {stats.additions > 0 && (
                        <span style={{ color: theme.colors.success }}>+{stats.additions}</span>
                      )}
                      {stats.deletions > 0 && (
                        <span style={{ color: theme.colors.error }}>-{stats.deletions}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inline explanation (placeholder) */}
      {isExplainOpen && (
        <div
          style={{
            borderTop: `1px solid ${theme.colors.border}`,
            padding: spacing.md,
            backgroundColor: theme.colors.background,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: theme.fontSizes[2],
              color: theme.colors.textMuted,
              fontStyle: 'italic',
            }}
          >
            AI explanations coming soon...
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoActivityCard;
