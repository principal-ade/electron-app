/**
 * InProgressRepoDetailModal
 *
 * Detail view that opens when clicking an InProgressRepoCard. Shows the full
 * file change list, ahead commits, File City visualization, and push controls.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Check,
  FolderGit2,
  GitBranch,
  GitCommit,
  Loader2,
  Upload,
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
import {
  type InProgressChangedFile,
  type InProgressFileStatus,
  type InProgressAheadCommit,
  type InProgressRepoCardActions,
  type InProgressSummary,
} from './InProgressRepoCard';

const DIFF_ADD_COLOR = '#2ea043';
const DIFF_REMOVE_COLOR = '#cf222e';

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

interface InProgressRepoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: InProgressSummary;
  actions: InProgressRepoCardActions;
  events?: PanelEventEmitter;
  entry?: AlexandriaEntry;
  onDismiss?: (repoPath: string) => void;
}

export const InProgressRepoDetailModal: React.FC<InProgressRepoDetailModalProps> = ({
  isOpen,
  onClose,
  summary,
  actions,
  events,
  entry,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(true);
  const [changedFiles, setChangedFiles] = useState<InProgressChangedFile[]>([]);
  const [detailView, setDetailView] = useState<'files' | 'commits'>('files');
  const [aheadCommits, setAheadCommits] = useState<InProgressAheadCommit[]>([]);
  const [aheadCommitsLoaded, setAheadCommitsLoaded] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState(false);

  const aheadCount = summary.aheadCount ?? 0;

  useEffect(() => {
    if (!isOpen) return;
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
        console.warn(`[InProgressRepoDetailModal] Failed to build city:`, err);
        setCityData(null);
      })
      .finally(() => {
        if (!cancelled) setCityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, summary.repoPath, summary.repoName, actions]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    actions
      .getWorkingChanges(summary.repoPath)
      .then((files) => {
        if (!cancelled) setChangedFiles(files);
      })
      .catch((err) => {
        console.warn(`[InProgressRepoDetailModal] Failed to fetch working changes:`, err);
        if (!cancelled) setChangedFiles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, summary.repoPath, actions]);

  useEffect(() => {
    if (!isOpen || aheadCount === 0) {
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
        console.warn(`[InProgressRepoDetailModal] Failed to fetch ahead commits:`, err);
        if (cancelled) return;
        setAheadCommits([]);
        setAheadCommitsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, summary.repoPath, aheadCount, actions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handlePush = useCallback(async () => {
    if (pushing) return;
    setPushing(true);
    setPushError(null);
    setPushSuccess(false);
    try {
      const result = await actions.pushBranch(summary.repoPath);
      if (result.success) {
        setPushSuccess(true);
        window.setTimeout(() => {
          onDismiss?.(summary.repoPath);
          onClose();
        }, 1200);
      } else {
        setPushError(result.message || 'Push failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Push failed';
      setPushError(message);
    } finally {
      setPushing(false);
    }
  }, [actions, summary.repoPath, pushing, onDismiss, onClose]);

  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    let staged = 0;
    for (const f of changedFiles) {
      additions += f.additions;
      deletions += f.deletions;
      if (f.staged) staged += 1;
    }
    return { additions, deletions, staged, fileCount: changedFiles.length };
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
        source: 'in-progress-repo-detail-modal',
        timestamp: Date.now(),
        payload: payloadFromLocalEntry(entry),
      });
    }
  }, [entry, events]);

  const handleOpenOwnerProfile = useCallback(() => {
    if (summary.githubOwner && events) {
      events.emit({
        type: 'owner:selected',
        source: 'in-progress-repo-detail-modal',
        timestamp: Date.now(),
        payload: {
          owner: summary.githubOwner,
          isOrg: summary.isOwnerOrg || false,
        },
      });
    }
  }, [summary.githubOwner, summary.isOwnerOrg, events]);

  if (!isOpen) return null;

  const totalLines = totals.additions + totals.deletions;
  const budget = totalLines > 0 ? (totalLines < 100 ? 25 : totalLines < 500 ? 50 : totalLines < 1000 ? 75 : 100) : 0;
  const addedWidth = totalLines > 0 ? (totals.additions / totalLines) * budget : 0;
  const removedWidth = totalLines > 0 ? (totals.deletions / totalLines) * budget : 0;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          border: `1px solid ${theme.colors.border}`,
          width: '90vw',
          maxWidth: 900,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            onClick={handleOpenOwnerProfile}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
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
                src={`https://github.com/${summary.githubOwner}.png?size=80`}
                alt={summary.githubOwner}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={20} color={theme.colors.textMuted} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <h3
                onClick={handleOpenProfile}
                style={{
                  margin: 0,
                  fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.text,
                  cursor: entry && events ? 'pointer' : 'default',
                }}
              >
                {summary.repoName}
              </h3>
              {summary.isDirty === false && aheadCount > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    fontSize: theme.fontSizes[0],
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.textOnAccent,
                    backgroundColor: theme.colors.accent,
                    borderRadius: 999,
                  }}
                >
                  <Upload size={11} />
                  Ahead
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.monospace,
                color: theme.colors.textMuted,
              }}
            >
              {summary.branch && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <GitBranch size={12} />
                  {summary.branch}
                </span>
              )}
              {totals.fileCount > 0 && (
                <span>{totals.fileCount} file{totals.fileCount !== 1 ? 's' : ''} changed</span>
              )}
              {aheadCount > 0 && (
                <span>{aheadCount} commit{aheadCount !== 1 ? 's' : ''} ahead</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: 'transparent',
              color: theme.colors.textMuted,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: 360,
              flexShrink: 0,
              backgroundColor: theme.colors.background,
              borderRight: `1px solid ${theme.colors.border}`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {(totals.additions > 0 || totals.deletions > 0) && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.xs,
                  padding: spacing.md,
                  borderBottom: `1px solid ${theme.colors.border}`,
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
                display: 'flex',
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              {totals.fileCount > 0 && (
                <button
                  type="button"
                  onClick={() => setDetailView('files')}
                  style={{
                    flex: 1,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    fontSize: theme.fontSizes[1],
                    fontWeight: detailView === 'files' ? theme.fontWeights.semibold : theme.fontWeights.body,
                    color: detailView === 'files' ? theme.colors.text : theme.colors.textMuted,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: detailView === 'files' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  Files ({totals.fileCount})
                </button>
              )}
              {aheadCount > 0 && (
                <button
                  type="button"
                  onClick={() => setDetailView('commits')}
                  style={{
                    flex: 1,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    fontSize: theme.fontSizes[1],
                    fontWeight: detailView === 'commits' ? theme.fontWeights.semibold : theme.fontWeights.body,
                    color: detailView === 'commits' ? theme.colors.text : theme.colors.textMuted,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: detailView === 'commits' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  Commits ({aheadCount})
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: spacing.sm }}>
              {detailView === 'files' && (
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

              {detailView === 'commits' && (
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
                      marginBottom: spacing.sm,
                    }}
                  >
                    <GitCommit size={12} />
                    <span>
                      {aheadCount} commit{aheadCount !== 1 ? 's' : ''} to push
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {!aheadCommitsLoaded ? (
                      <span
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textMuted,
                          fontStyle: 'italic',
                        }}
                      >
                        Loading commits...
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
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: spacing.sm,
                padding: spacing.md,
                borderTop: `1px solid ${theme.colors.border}`,
              }}
            >
              {pushError && (
                <span
                  style={{
                    flex: 1,
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.error,
                  }}
                >
                  {pushError}
                </span>
              )}
              {aheadCount > 0 && (
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={pushing || pushSuccess}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts.body,
                    fontWeight: theme.fontWeights.semibold,
                    color: pushSuccess ? '#fff' : theme.colors.background,
                    backgroundColor: pushSuccess
                      ? '#2ea043'
                      : pushing
                        ? theme.colors.textSecondary
                        : theme.colors.primary,
                    border: 'none',
                    borderRadius: 6,
                    cursor: pushing || pushSuccess ? 'default' : 'pointer',
                    opacity: pushing ? 0.7 : 1,
                  }}
                >
                  {pushing ? (
                    <>
                      <Loader2
                        size={14}
                        style={{ animation: 'inProgressSpin 1s linear infinite' }}
                      />
                      <span>Pushing...</span>
                    </>
                  ) : pushSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Pushed</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Push</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes inProgressSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default InProgressRepoDetailModal;
