/**
 * RepoAboutCard
 *
 * A lightweight about card for a selected repository, shown in the Home left
 * panel when the user picks a repo from any sub-view. Matches the structure
 * of web-ade's RepoAboutCard: repo name + stars, description, facts row,
 * contributor faces (when available), and a README button.
 *
 * When the repo is cloned, a clone row shows branch status + Open / Terminal
 * buttons — the same surface the full RepositoryProfilePanel renders.
 *
 * This is the electron-app counterpart of web-ade's RepoAboutCard / RepoOverview
 * left-rail extract. For the full profile hub, see RepositoryProfilePanel (tab).
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  FolderOpen,
  FolderTree,
  GitBranch,
  GitFork,
  Loader2,
  RefreshCw,
  Star,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { parsePurl } from '@principal-ai/alexandria-core-library';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { RepositorySelectedPayload } from '../../events/repositorySelected';
import { payloadFromGithub } from '../../events/repositorySelected';
import { emitTerminalOpen } from '../../events/portalIntents';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService, type GitBranchStatus } from '../../main-process-api/GitService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WindowService } from '../../main-process-api/WindowService';
import { GitCloneModal, type CloneProgressState } from '../../components/GitCloneModal';
import { ForkModal } from '../components/ForkModal';
import { RelocateToConventionModal } from '../components/RelocateToConventionModal';
import { getOffConventionTarget } from '../../../shared/utils/clonePath';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';

function getRepositoryAge(createdAt: string): string {
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''}`;
}

export interface RepoAboutCardProps {
  /** The selected repo payload. */
  repo: RepositorySelectedPayload;
  /** Dismiss the card and return to the previous sub-view. */
  onDismiss: () => void;
  /** Portal event emitter for terminal open intents etc. */
  events: PanelEventEmitter;
  /** README file path in the repo (e.g. "README.md") — null if unknown. */
  readmePath?: string | null;
  /** Called when the README toggle button is clicked. */
  onOpenReadme?: () => void;
  /** Whether README is currently active in the guide tab. */
  readmeActive?: boolean;
  /** The user's base clone directory (e.g. ~/Developer). */
  baseDefaultDirectory?: string | null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr}y ago`;
}

export const RepoAboutCard: React.FC<RepoAboutCardProps> = ({
  repo,
  onDismiss,
  events,
  readmePath,
  onOpenReadme,
  readmeActive = false,
  baseDefaultDirectory,
}) => {
  const { theme } = useTheme();
  const gh = repo.github;
  const parsed = parsePurl(repo.purl);
  const owner = gh?.owner ?? parsed?.namespace ?? 'unknown';
  const name = gh?.name ?? parsed?.name ?? 'unknown';

  const [ownerAvatar, setOwnerAvatar] = useState<string | null>(null);
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    GithubService.getUser(owner).then((u) => {
      if (cancelled) return;
      if (u?.avatar_url) setOwnerAvatar(u.avatar_url);
      if (u?.name) setOwnerDisplayName(u.name);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [owner]);

  // Branch status for cloned repos (one per clone)
  const [branchStatusMap, setBranchStatusMap] = useState<Map<string, GitBranchStatus>>(new Map());
  const [branchLoading, setBranchLoading] = useState(false);
  const clones = repo.localClones;
  useEffect(() => {
    if (!clones || clones.length === 0) { setBranchStatusMap(new Map()); return; }
    let cancelled = false;
    setBranchLoading(true);
    Promise.all(
      clones.map(async (clone) => {
        try {
          const status = await GitService.getBranchStatus(clone.path);
          if (!cancelled) return [clone.path, status] as const;
          return null;
        } catch { return null; }
      }),
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<string, GitBranchStatus>();
      for (const r of results) {
        if (r) map.set(r[0], r[1]);
      }
      setBranchStatusMap(map);
      setBranchLoading(false);
    });
    return () => { cancelled = true; };
  }, [clones]);

  // Copy-path feedback
  const [copiedClonePath, setCopiedClonePath] = useState<string | null>(null);

  // Expanded clone path (show path row under branch status)
  const [expandedClonePath, setExpandedClonePath] = useState<string | null>(null);

  // Refresh-branch feedback
  const [refreshingClonePath, setRefreshingClonePath] = useState<string | null>(null);

  // Fix-registration feedback
  const [fixingClonePath, setFixingClonePath] = useState<string | null>(null);

  // Relocate modal state
  const [relocateClone, setRelocateClone] = useState<{
    currentPath: string;
    expectedPath: string;
    owner: string;
  } | null>(null);

  // Clone / Fork modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<CloneProgressState | null>(null);
  const [showForkModal, setShowForkModal] = useState(false);
  const [isForked, setIsForked] = useState(false);
  const [forkedRepoOwner, setForkedRepoOwner] = useState<string | null>(null);

  // Auto-clear clone progress on completion
  useEffect(() => {
    if (cloneProgress?.phase !== 'complete') return;
    const timer = setTimeout(() => setCloneProgress(null), 3000);
    return () => clearTimeout(timer);
  }, [cloneProgress?.phase]);

  // Check if the current user has already forked this repo
  useEffect(() => {
    if (!gh) { setIsForked(false); return; }
    let cancelled = false;
    const checkForkStatus = async () => {
      try {
        const user = await GithubService.getCurrentUser();
        if (!user || cancelled) return;
        const userRepo = await GithubService.getRepository(user.login, name);
        const forked =
          !!userRepo &&
          userRepo.fork === true &&
          userRepo.parent?.full_name === `${owner}/${name}`;
        if (!cancelled) {
          setIsForked(forked);
          setForkedRepoOwner(forked ? user.login : null);
        }
      } catch {
        if (!cancelled) { setIsForked(false); setForkedRepoOwner(null); }
      }
    };
    checkForkStatus();
    return () => { cancelled = true; };
  }, [owner, name, gh]);

  const description = gh?.description;
  const stars = gh?.stars ?? 0;
  const repoUrl = `https://github.com/${owner}/${name}`;
  const lastUpdated = gh?.lastUpdated;
  const hasClones = clones && clones.length > 0;

  const registerRepository = async (path: string, remoteUrl?: string) =>
    AlexandriaService.registerRepository(path, remoteUrl);

  const handleOpen = async (clonePath: string) => {
    const entry = await AlexandriaService.getRepositoryByPath(clonePath)
      ?? await AlexandriaService.registerRepository(clonePath, repoUrl);
    await WindowService.openDevWorkspace({ alexandriaEntry: entry });
  };

  const handleTerminal = (clonePath: string) => {
    emitTerminalOpen(events, 'repo-about-card', {
      directory: clonePath,
      label: name,
    });
  };

  const handleDeleteClone = (clonePath: string) => {
    events.emit({
      type: 'repository-profile:delete-clone-requested',
      source: 'repo-about-card',
      timestamp: Date.now(),
      payload: {
        repository: {
          name,
          owner,
          description,
          url: repoUrl,
          purl: repo.purl,
          localClones: clones,
          github: gh,
        },
        clonePath,
      },
    });
  };

  const handleCopyClonePath = async (clonePath: string) => {
    try {
      await navigator.clipboard.writeText(clonePath);
      setCopiedClonePath(clonePath);
      setTimeout(
        () => setCopiedClonePath((prev) => (prev === clonePath ? null : prev)),
        1500,
      );
    } catch (error) {
      console.error('Failed to copy clone path:', error);
    }
  };

  const handleRelocate = async (clonePath: string, newOwner: string): Promise<string> => {
    const entry = await AlexandriaService.getRepositoryByPath(clonePath);
    if (!entry) throw new Error('Repository not found in registry');
    return WorkspaceService.moveRepositoryToConventionalPath(entry, newOwner);
  };

  const handleFixRegistration = async (clonePath: string) => {
    try {
      setFixingClonePath(clonePath);
      await AlexandriaService.refreshRepository(clonePath);
    } catch (error) {
      console.error('Failed to fix registration:', error);
    } finally {
      setFixingClonePath(null);
    }
  };

  const handleRefreshBranchStatus = async (clonePath: string) => {
    try {
      setRefreshingClonePath(clonePath);
      const status = await GitService.getBranchStatus(clonePath);
      setBranchStatusMap((prev) => {
        const next = new Map(prev);
        next.set(clonePath, status);
        return next;
      });
    } catch (error) {
      console.error('Failed to refresh branch status:', error);
    } finally {
      setRefreshingClonePath(null);
    }
  };

  return (
    <div
      style={{
        padding: '20px 20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Header: owner avatar + owner name + dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {ownerAvatar ? (
          <img
            src={`${ownerAvatar}${ownerAvatar.includes('?') ? '&' : '?'}s=${56}`}
            alt={owner}
            width={28}
            height={28}
            style={{
              borderRadius: `${Math.min(12, 28 / 4)}px`,
              display: 'block',
              background: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: `${Math.min(12, 28 / 4)}px`,
              background: theme.colors.backgroundSecondary,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          >
            {owner.charAt(0).toUpperCase()}
          </div>
        )}
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {ownerDisplayName || owner}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          title="Close"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: theme.colors.textMuted,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.7';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Repo name (links to GitHub) + star count right-aligned */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${owner}/${name} on GitHub`}
          style={{ textDecoration: 'none', minWidth: 0, opacity: 1, transition: 'opacity 0.15s' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[4],
              fontWeight: theme.fontWeights.bold,
              color: theme.colors.primary,
              lineHeight: 1.2,
              wordBreak: 'break-word',
              minWidth: 0,
            }}
          >
            {name}
          </h1>
        </a>
        {stars > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: theme.fonts.body,
              color: theme.colors.warning,
              fontSize: theme.fontSizes[2],
              flexShrink: 0,
            }}
          >
            <Star size={16} style={{ color: theme.colors.warning }} fill={theme.colors.warning} />
            {stars.toLocaleString()}
          </span>
        )}
      </div>

      {/* Description */}
      {description ? (
        <p
          style={{
            margin: 0,
            fontFamily: theme.fonts.body,
            color: theme.colors.text,
            fontSize: theme.fontSizes[2],
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      ) : (
        <>
          <p
            style={{
              margin: 0,
              fontFamily: theme.fonts.body,
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[1],
              lineHeight: 1.4,
              fontStyle: 'italic',
            }}
          >
            No description for {owner}/{name}.
          </p>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: theme.fonts.body, color: theme.colors.primary, fontSize: theme.fontSizes[1] }}
          >
            Update on GitHub
          </a>
        </>
      )}

      {/* Facts row: last updated (left) + age (right) */}
      {(lastUpdated || gh?.createdAt) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontFamily: theme.fonts.body,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[1],
          }}
        >
          {lastUpdated && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Updated {relativeTime(lastUpdated)}
            </span>
          )}
          {gh?.createdAt && (() => {
            const age = getRepositoryAge(gh.createdAt);
            if (!age) return null;
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={14} />
                {age} old
              </span>
            );
          })()}
        </div>
      )}

      {/* Clone rows: one per local clone */}
      {clones && clones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {clones.map((clone) => {
            const branchStatus = branchStatusMap.get(clone.path);
            const offConvention = getOffConventionTarget(
              { path: clone.path, github: gh, purl: repo.purl, remoteUrl: undefined },
              baseDefaultDirectory,
            );
            const purlParsed = repo.purl ? parsePurl(repo.purl) : null;
            const isLocalPurl = purlParsed?.type === 'generic' && purlParsed.namespace === 'local';
            return (
              <div
                key={clone.path}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                {/* Branch + status — clickable to show path */}
                {branchStatus && (
                  <button
                    type="button"
                    onClick={() => setExpandedClonePath(
                      expandedClonePath === clone.path ? null : clone.path,
                    )}
                    title={expandedClonePath === clone.path ? 'Hide path' : `Show path for ${branchStatus.branch}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 6,
                      backgroundColor: expandedClonePath === clone.path
                        ? `${theme.colors.primary}15`
                        : theme.colors.backgroundSecondary,
                      border: `1px solid ${expandedClonePath === clone.path ? theme.colors.primary : theme.colors.border}`,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.medium ?? 500,
                      color: expandedClonePath === clone.path ? theme.colors.primary : theme.colors.text,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (expandedClonePath === clone.path) return;
                      (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
                      (e.currentTarget as HTMLElement).style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      if (expandedClonePath === clone.path) return;
                      (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
                      (e.currentTarget as HTMLElement).style.color = theme.colors.text;
                    }}
                  >
                    <GitBranch size={12} />
                    {branchStatus.branch}
                    {branchStatus.ahead === 0 && branchStatus.behind === 0 && branchStatus.hasUpstream ? (
                      <>
                        <span style={{ color: theme.colors.textSecondary }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: theme.colors.success }}>
                          <CheckCircle2 size={11} />
                          in sync
                        </span>
                      </>
                    ) : !branchStatus.hasUpstream ? (
                      <>
                        <span style={{ color: theme.colors.textSecondary }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: theme.colors.warning }}>
                          <AlertCircle size={11} />
                          no remote
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: theme.colors.textSecondary }}>·</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            color: branchStatus.ahead > 0 && branchStatus.behind > 0
                              ? theme.colors.error
                              : branchStatus.behind > 0
                                ? theme.colors.warning
                                : theme.colors.info,
                          }}
                        >
                          <Circle size={8} fill="currentColor" />
                          {branchStatus.ahead > 0 && branchStatus.behind === 0
                            ? `${branchStatus.ahead} ahead`
                            : branchStatus.ahead === 0 && branchStatus.behind > 0
                              ? `${branchStatus.behind} behind`
                              : `${branchStatus.ahead}↑ ${branchStatus.behind}↓`}
                        </span>
                      </>
                    )}
                  </button>
                )}

                {/* Refresh branch status button */}
                {branchStatus && (
                  <button
                    type="button"
                    onClick={() => void handleRefreshBranchStatus(clone.path)}
                    disabled={refreshingClonePath === clone.path}
                    title="Check for upstream changes"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      padding: 0,
                      borderRadius: 6,
                      border: `1px solid ${theme.colors.border}`,
                      background: theme.colors.backgroundSecondary,
                      color: theme.colors.textMuted,
                      cursor: refreshingClonePath === clone.path ? 'not-allowed' : 'pointer',
                      opacity: refreshingClonePath === clone.path ? 0.6 : 1,
                      transition: 'border-color 0.15s, color 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (refreshingClonePath === clone.path) return;
                      (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
                      (e.currentTarget as HTMLElement).style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      if (refreshingClonePath === clone.path) return;
                      (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
                      (e.currentTarget as HTMLElement).style.color = theme.colors.textMuted;
                    }}
                  >
                    <Loader2
                      size={14}
                      style={refreshingClonePath === clone.path ? { animation: 'spin 1s linear infinite' } : { display: 'none' }}
                    />
                    <RefreshCw
                      size={14}
                      style={refreshingClonePath === clone.path ? { display: 'none' } : undefined}
                    />
                  </button>
                )}

                {/* Loading state while branch status is fetched */}
                {branchLoading && !branchStatus && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 6,
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.medium ?? 500,
                      color: theme.colors.textMuted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Loading…
                  </span>
                )}

                {/* Open button */}
                <button
                  type="button"
                  onClick={() => handleOpen(clone.path)}
                  title="Open in workspace"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
                    color: theme.colors.background,
                    cursor: 'pointer',
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    fontWeight: theme.fontWeights.medium ?? 500,
                    whiteSpace: 'nowrap',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  <FolderOpen size={12} />
                  Open
                </button>

                {/* Terminal button */}
                <button
                  type="button"
                  onClick={() => handleTerminal(clone.path)}
                  title="Open a terminal here"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    fontWeight: theme.fontWeights.medium ?? 500,
                    whiteSpace: 'nowrap',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
                    (e.currentTarget as HTMLElement).style.color = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
                    (e.currentTarget as HTMLElement).style.color = theme.colors.text;
                  }}
                >
                  <Terminal size={12} />
                  Terminal
                </button>
                </div>

                {/* Expandable path row */}
                {expandedClonePath === clone.path && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      width: '100%',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void handleCopyClonePath(clone.path)}
                      title={copiedClonePath === clone.path ? 'Copied!' : 'Click to copy path'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flex: 1,
                        minWidth: 0,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${copiedClonePath === clone.path ? theme.colors.success : theme.colors.border}`,
                        background: copiedClonePath === clone.path ? `${theme.colors.success}15` : theme.colors.backgroundSecondary,
                        color: copiedClonePath === clone.path ? theme.colors.success : theme.colors.text,
                        cursor: 'pointer',
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        fontWeight: theme.fontWeights.medium ?? 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (copiedClonePath === clone.path) return;
                        (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        if (copiedClonePath === clone.path) return;
                        (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clone.path}
                      </span>
                    </button>

                    {offConvention && (
                      <button
                        type="button"
                        onClick={() => setRelocateClone({
                          currentPath: clone.path,
                          expectedPath: offConvention.expectedPath,
                          owner: offConvention.owner,
                        })}
                        title="Move to standard location"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1px solid ${theme.colors.warning}50`,
                          background: `${theme.colors.warning}08`,
                          color: theme.colors.warning,
                          cursor: 'pointer',
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                          fontWeight: theme.fontWeights.medium ?? 500,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = theme.colors.warning;
                          (e.currentTarget as HTMLElement).style.color = theme.colors.background;
                          (e.currentTarget as HTMLElement).style.borderColor = theme.colors.warning;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = `${theme.colors.warning}08`;
                          (e.currentTarget as HTMLElement).style.color = theme.colors.warning;
                          (e.currentTarget as HTMLElement).style.borderColor = `${theme.colors.warning}50`;
                        }}
                      >
                        <FolderTree size={12} />
                        Relocate
                      </button>
                    )}

                    {isLocalPurl && (
                      <button
                        type="button"
                        onClick={() => void handleFixRegistration(clone.path)}
                        disabled={fixingClonePath === clone.path}
                        title="Re-read git remote and fix registration"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1px solid ${theme.colors.warning}50`,
                          background: `${theme.colors.warning}08`,
                          color: theme.colors.warning,
                          cursor: fixingClonePath === clone.path ? 'not-allowed' : 'pointer',
                          opacity: fixingClonePath === clone.path ? 0.6 : 1,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                          fontWeight: theme.fontWeights.medium ?? 500,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          if (fixingClonePath === clone.path) return;
                          (e.currentTarget as HTMLElement).style.background = theme.colors.warning;
                          (e.currentTarget as HTMLElement).style.color = theme.colors.background;
                          (e.currentTarget as HTMLElement).style.borderColor = theme.colors.warning;
                        }}
                        onMouseLeave={(e) => {
                          if (fixingClonePath === clone.path) return;
                          (e.currentTarget as HTMLElement).style.background = `${theme.colors.warning}08`;
                          (e.currentTarget as HTMLElement).style.color = theme.colors.warning;
                          (e.currentTarget as HTMLElement).style.borderColor = `${theme.colors.warning}50`;
                        }}
                      >
                        {fixingClonePath === clone.path ? (
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {fixingClonePath === clone.path ? 'Fixing…' : 'Fix'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteClone(clone.path)}
                      title="Delete this clone"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${theme.colors.error}50`,
                        background: `${theme.colors.error}08`,
                        color: theme.colors.error,
                        cursor: 'pointer',
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        fontWeight: theme.fontWeights.medium ?? 500,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = theme.colors.error;
                        (e.currentTarget as HTMLElement).style.color = theme.colors.background;
                        (e.currentTarget as HTMLElement).style.borderColor = theme.colors.error;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = `${theme.colors.error}08`;
                        (e.currentTarget as HTMLElement).style.color = theme.colors.error;
                        (e.currentTarget as HTMLElement).style.borderColor = `${theme.colors.error}50`;
                      }}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Clone + Fork buttons (shown when no local clones exist) */}
      {!hasClones && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setShowCloneModal(true)}
            disabled={cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
              color: theme.colors.background,
              cursor: cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering' ? 'not-allowed' : 'pointer',
              opacity: cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering' ? 0.7 : 1,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium ?? 500,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              if (cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering') return;
              (e.currentTarget as HTMLElement).style.opacity = '0.85';
            }}
            onMouseLeave={(e) => {
              if (cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering') return;
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
          >
            {cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering' ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={12} />
            )}
            {cloneProgress?.phase === 'cloning' || cloneProgress?.phase === 'registering' ? 'Cloning…' : 'Clone'}
          </button>
          {isForked && forkedRepoOwner ? (
            <button
              type="button"
              onClick={() => {
                events.emit({
                  type: 'repository:selected',
                  source: 'repo-about-card',
                  timestamp: Date.now(),
                  payload: payloadFromGithub({ owner: forkedRepoOwner, name }),
                });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${theme.colors.primary}`,
                background: `${theme.colors.primary}18`,
                color: theme.colors.primary,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium ?? 500,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${theme.colors.primary}28`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${theme.colors.primary}18`; }}
            >
              <GitFork size={12} />
              forked: {forkedRepoOwner}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowForkModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${theme.colors.border}`,
                background: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium ?? 500,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = theme.colors.primary;
                (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = theme.colors.textSecondary;
                (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
              }}
            >
              <GitFork size={12} />
              Fork
            </button>
          )}
        </div>
      )}

      {/* README toggle button */}
      {readmePath && onOpenReadme && (
        <button
          type="button"
          onClick={onOpenReadme}
          aria-pressed={readmeActive}
          title={readmeActive ? `Close ${readmePath} and show the city` : `Open ${readmePath}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${readmeActive ? theme.colors.primary : theme.colors.border}`,
            background: readmeActive
              ? `color-mix(in srgb, ${theme.colors.primary} 14%, transparent)`
              : theme.colors.backgroundSecondary,
            color: readmeActive ? theme.colors.primary : theme.colors.text,
            cursor: 'pointer',
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!readmeActive) {
              (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
              (e.currentTarget as HTMLElement).style.color = theme.colors.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (!readmeActive) {
              (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
              (e.currentTarget as HTMLElement).style.color = theme.colors.text;
            }
          }}
        >
          {readmeActive ? <Building2 size={15} /> : <FileText size={15} />}
          {readmeActive ? 'City' : 'README'}
        </button>
      )}

      {/* Clone + Fork modals */}
      <GitCloneModal
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        initialUrl={repoUrl}
        registerRepository={registerRepository}
        onCloneProgress={setCloneProgress}
        onRepositoryAdded={() => setShowCloneModal(false)}
      />
      <ForkModal
        isOpen={showForkModal}
        onClose={() => setShowForkModal(false)}
        repoOwner={owner}
        repoName={name}
        registerRepository={registerRepository}
      />
      <RelocateToConventionModal
        isOpen={!!relocateClone}
        onClose={() => setRelocateClone(null)}
        repoName={name}
        owner={relocateClone?.owner ?? owner}
        currentPath={relocateClone?.currentPath ?? ''}
        expectedPath={relocateClone?.expectedPath ?? ''}
        onRelocate={() => {
          const rc = relocateClone;
          if (!rc) return Promise.reject(new Error('No clone selected'));
          return handleRelocate(rc.currentPath, rc.owner);
        }}
      />
    </div>
  );
};
