/**
 * UserAboutCard
 *
 * The user's GitHub profile card shown at the top of the Home left panel.
 * Ported from the web app's UserAboutCard, adapted to inline styles.
 * Shows avatar, name, @login, bio, repo count, join date, company,
 * location, followers/following.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Building2,
  CalendarDays,
  FolderGit2,
  MapPin,
  Users,
} from 'lucide-react';

export interface UserAboutInfo {
  login: string;
  name?: string | null;
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

export const UserAboutCard: React.FC<UserAboutCardProps> = ({
  info,
  loading = false,
}) => {
  const { theme } = useTheme();

  if (!info) return loading ? <UserAboutCardSkeleton /> : null;

  const profileUrl = info.html_url ?? `https://github.com/${info.login}`;
  const displayName = info.name || info.login;
  const joined = info.created_at ? joinedLabel(info.created_at) : null;

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
      {/* Identity: avatar + name + @login */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open @${info.login} on GitHub`}
          style={{ flexShrink: 0, opacity: 1, transition: 'opacity 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          {info.avatar_url ? (
            <img
              src={`${info.avatar_url}${info.avatar_url.includes('?') ? '&' : '?'}s=96`}
              alt={displayName}
              width={48}
              height={48}
              style={{
                borderRadius: '50%',
                display: 'block',
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
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
          )}
        </a>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', minWidth: 0, opacity: 1, transition: 'opacity 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
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

      {/* Facts row: public repo count + joined date */}
      {(joined || info.public_repos != null) && (
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
          {info.public_repos != null ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FolderGit2 size={14} />
              {info.public_repos.toLocaleString()} repos
            </span>
          ) : (
            <span />
          )}
          {joined && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={14} />
              Joined {joined}
            </span>
          )}
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Building2 size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.company}</span>
            </span>
          )}
          {info.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <MapPin size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.location}</span>
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
