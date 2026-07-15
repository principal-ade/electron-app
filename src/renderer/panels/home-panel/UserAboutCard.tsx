/**
 * UserAboutCard
 *
 * Profile card at the top of the Home left panel.
 * - source: 'github' — full GitHub profile (avatar, @login, bio, stats…)
 * - source: 'git'    — local git identity (user.name / user.email) when the
 *                      user is not signed in via the GitHub CLI / API
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  Users,
} from 'lucide-react';

export type UserAboutSource = 'github' | 'git';

export interface UserAboutInfo {
  /** github = remote profile; git = global git config identity */
  source?: UserAboutSource;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
  html_url?: string;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  followers?: number | null;
  following?: number | null;
  public_repos?: number | null;
  created_at?: string | null;
}

export interface UserAboutCardProps {
  info: UserAboutInfo | null;
  loading?: boolean;
}

function joinedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function Avatar({
  displayName,
  avatarUrl,
  size = 48,
}: {
  displayName: string;
  avatarUrl?: string;
  size?: number;
}) {
  const { theme } = useTheme();
  if (avatarUrl) {
    return (
      <img
        src={`${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}s=${size * 2}`}
        alt={displayName}
        width={size}
        height={size}
        style={{
          borderRadius: '50%',
          display: 'block',
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: theme.colors.backgroundSecondary,
        color: theme.colors.textSecondary,
        fontSize: theme.fontSizes[3],
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

const cardShell = (borderColor: string): React.CSSProperties => ({
  padding: '20px 20px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  borderBottom: `1px solid ${borderColor}`,
});

export const UserAboutCard: React.FC<UserAboutCardProps> = ({
  info,
  loading = false,
}) => {
  const { theme } = useTheme();

  if (!info) return loading ? <UserAboutCardSkeleton /> : null;

  const source = info.source ?? 'github';
  const isGit = source === 'git';

  const sourceBadgeStyle: React.CSSProperties = {
    flexShrink: 0,
    fontSize: theme.fontSizes[0],
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.backgroundSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 999,
    padding: '2px 8px',
  };

  // --- Local git identity (no GitHub session) ---
  if (isGit) {
    const displayName = info.name || info.email || 'Git';
    return (
      <div style={cardShell(theme.colors.border)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ flexShrink: 0 }}>
            <Avatar displayName={displayName} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[4],
                fontWeight: 700,
                color: theme.colors.primary,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            {info.name && info.email && (
              <div
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes[1],
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {info.email}
              </div>
            )}
          </div>
          <span
            title="From global git config (user.name / user.email)"
            style={sourceBadgeStyle}
          >
            Git
          </span>
        </div>

        {info.email && !info.name && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[1],
            }}
          >
            <Mail size={14} style={{ flexShrink: 0 }} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {info.email}
            </span>
          </div>
        )}

        <p
          style={{
            margin: 0,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[1],
            lineHeight: 1.4,
          }}
        >
          Local git identity. Sign in with the GitHub CLI for your full profile.
        </p>
      </div>
    );
  }

  // --- GitHub profile ---
  const profileUrl = info.html_url ?? `https://github.com/${info.login}`;
  const displayName = info.name || info.login;
  const joined = info.created_at ? joinedLabel(info.created_at) : null;

  return (
    <div style={cardShell(theme.colors.border)}>
      {/* Identity: avatar + name + @login + source badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open @${info.login} on GitHub`}
          style={{ flexShrink: 0, opacity: 1, transition: 'opacity 0.15s' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
        >
          <Avatar displayName={displayName} avatarUrl={info.avatar_url} />
        </a>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            minWidth: 0,
            flex: 1,
            opacity: 1,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[4],
              fontWeight: 700,
              color: theme.colors.primary,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[1],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            @{info.login}
          </div>
        </a>
        <span
          title="Profile from the GitHub CLI (gh auth / gh api)"
          style={sourceBadgeStyle}
        >
          GitHub CLI
        </span>
      </div>

      {/* Bio */}
      <p
        style={{
          margin: 0,
          color: info.bio ? theme.colors.text : theme.colors.textMuted,
          fontSize: theme.fontSizes[2],
          lineHeight: 1.4,
          fontStyle: info.bio ? undefined : 'italic',
        }}
      >
        {info.bio || 'No bio yet.'}
      </p>

      {/* Facts row: joined date */}
      {joined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[1],
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={14} />
            Joined {joined}
          </span>
        </div>
      )}

      {/* Company / location */}
      {(info.company || info.location) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 16,
            rowGap: 4,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[1],
          }}
        >
          {info.company && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
              }}
            >
              <Building2 size={14} style={{ flexShrink: 0 }} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {info.company}
              </span>
            </span>
          )}
          {info.location && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
              }}
            >
              <MapPin size={14} style={{ flexShrink: 0 }} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {info.location}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Followers / following */}
      {(info.followers != null || info.following != null) && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[1],
          }}
        >
          <Users size={14} style={{ flexShrink: 0 }} />
          <span>
            {info.followers != null && (
              <>
                <span style={{ color: theme.colors.text, fontWeight: 600 }}>
                  {info.followers.toLocaleString()}
                </span>{' '}
                followers
              </>
            )}
            {info.followers != null && info.following != null && ' · '}
            {info.following != null && (
              <>
                <span style={{ color: theme.colors.text, fontWeight: 600 }}>
                  {info.following.toLocaleString()}
                </span>{' '}
                following
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

function UserAboutCardSkeleton() {
  const { theme } = useTheme();
  const bar = (w: string | number, h: number, radius = 4): React.CSSProperties => ({
    width: w,
    height: h,
    borderRadius: radius,
    backgroundColor: theme.colors.border,
    animation: 'homeCardPulse 1.5s ease-in-out infinite',
  });

  return (
    <div
      style={{
        padding: '20px 20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
      aria-busy="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: theme.colors.border,
            animation: 'homeCardPulse 1.5s ease-in-out infinite',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={bar(140, 18, 6)} />
          <div style={bar(90, 12)} />
        </div>
      </div>
      <div style={bar('100%', 14)} />
      <div style={bar('60%', 14)} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={bar(96, 12)} />
        <div style={bar(64, 12)} />
      </div>
      <style>{`
        @keyframes homeCardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
