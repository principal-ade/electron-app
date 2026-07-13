/**
 * RepoAboutCard
 *
 * A lightweight about card for a selected repository, shown in the Home left
 * panel when the user picks a repo from any sub-view. Matches the structure
 * of web-ade's RepoAboutCard: repo name + stars, description, facts row,
 * contributor faces (when available), and a README button.
 *
 * This is the electron-app counterpart of web-ade's RepoAboutCard / RepoOverview
 * left-rail extract. For the full profile hub, see RepositoryProfilePanel (tab).
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  BookOpen,
  CalendarDays,
  Star,
  X,
} from 'lucide-react';
import { parsePurl } from '@principal-ai/alexandria-core-library';
import type { RepositorySelectedPayload } from '../../events/repositorySelected';
import { GithubService } from '../../main-process-api/GithubService';

export interface RepoAboutCardProps {
  /** The selected repo payload. */
  repo: RepositorySelectedPayload;
  /** Dismiss the card and return to the previous sub-view. */
  onDismiss: () => void;
  /** Open the full RepositoryProfilePanel as a tab. */
  onOpenProfile: () => void;
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

  const description = gh?.description;
  const stars = gh?.stars ?? 0;
  const repoUrl = `https://github.com/${owner}/${name}`;
  // Use lastUpdated as a proxy for activity (we don't have created_at in the payload)
  const lastUpdated = gh?.lastUpdated;

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

      {/* Facts row: last updated (left) */}
      {lastUpdated && (
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={14} />
            Updated {relativeTime(lastUpdated)}
          </span>
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
    </div>
  );
};
