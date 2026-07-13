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
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Download,
  FolderOpen,
  GitBranch,
  GitFork,
  Loader2,
  Star,
  Terminal,
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
  /** Open the full RepositoryProfilePanel as a tab. */
  onOpenProfile: () => void;
  /** Portal event emitter for terminal open intents etc. */
  events: PanelEventEmitter;
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
  onOpenProfile,
  events,
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
  const clones = repo.localClones;
  useEffect(() => {
    if (!clones || clones.length === 0) { setBranchStatusMap(new Map()); return; }
    let cancelled = false;
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
    });
    return () => { cancelled = true; };
  }, [clones]);

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
            style={{ color: theme.colors.primary, fontSize: theme.fontSizes[1] }}
          >
            Update on GitHub
          </a>
        </>
      )}

      {/* Facts row: age (left) + last updated (right) */}
      {(lastUpdated || gh?.createdAt) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[1],
          }}
        >
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
          {lastUpdated && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Updated {relativeTime(lastUpdated)}
            </span>
          )}
        </div>
      )}

      {/* Clone rows: one per local clone */}
      {clones && clones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {clones.map((clone, index) => {
            const branchStatus = branchStatusMap.get(clone.path);
            return (
              <div
                key={clone.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                {/* Cloned badge */}
                <span
                  title={clone.path}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 6,
                    backgroundColor: `${theme.colors.success}15`,
                    border: `1px solid ${theme.colors.success}30`,
                    fontSize: theme.fontSizes[0],
                    fontWeight: theme.fontWeights.medium ?? 500,
                    color: theme.colors.success,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {clones.length === 1 ? 'cloned' : `clone ${index + 1}`}
                </span>

                {/* Branch + status */}
                {branchStatus && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      fontSize: theme.fontSizes[0],
                      fontWeight: theme.fontWeights.medium ?? 500,
                      color: theme.colors.text,
                      whiteSpace: 'nowrap',
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
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
                    color: theme.colors.background,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[0],
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
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[0],
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
            );
          })}
        </div>
      )}

      {/* Clone + Fork buttons (shown when no local clones exist) */}
      {!hasClones && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              fontSize: theme.fontSizes[0],
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
                fontSize: theme.fontSizes[0],
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
                fontSize: theme.fontSizes[0],
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

      {/* Full profile button */}
      <button
        type="button"
        onClick={onOpenProfile}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
          color: theme.colors.text,
          cursor: 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights.medium,
          transition: 'opacity 0.15s',
          marginTop: 4,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '0.85';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
        }}
      >
        <BookOpen size={15} />
        Full profile
      </button>

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
    </div>
  );
};
