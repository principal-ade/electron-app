/**
 * UserAboutCard
 *
 * Profile card at the top of the Home left panel.
 * - source: 'github' — full GitHub profile (avatar, @login, bio, stats…)
 * - source: 'git'    — local git identity (user.name / user.email) when the
 *                      user is not signed in via the GitHub CLI / API
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Building2,
  FolderGit2,
  Github,
  Loader2,
  Mail,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import type { GitHubUser } from '../../../shared/main-process-api-interfaces/GitHubAPI';

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
  clonedCount?: number;
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
  clonedCount,
}) => {
  const { theme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [listModal, setListModal] = useState<{ type: 'followers' | 'following' } | null>(null);
  const [listUsers, setListUsers] = useState<GitHubUser[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const fetchList = useCallback(async (type: 'followers' | 'following') => {
    if (!info?.login) return;
    setListLoading(true);
    try {
      const users = type === 'followers'
        ? await GithubService.getUserFollowers(info.login)
        : await GithubService.getUserFollowing(info.login);
      setListUsers(users);
    } catch (err) {
      console.error('[UserAboutCard] Failed to fetch list:', err);
      setListUsers([]);
    } finally {
      setListLoading(false);
    }
  }, [info?.login]);

  useEffect(() => {
    if (listModal) {
      fetchList(listModal.type);
    } else {
      setListUsers([]);
    }
  }, [listModal, fetchList]);

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
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          title="Authenticated with GitHub CLI"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            padding: 0,
            backgroundColor: '#000',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '50%',
            cursor: 'pointer',
            color: '#fff',
          }}
        >
          <Github size={20} />
        </button>
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

      {/* Facts row: cloned count */}
      {clonedCount != null && clonedCount > 0 && (
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
            <FolderGit2 size={14} />
            {clonedCount} cloned
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
              <button
                type="button"
                onClick={() => setListModal({ type: 'followers' })}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <span style={{ color: theme.colors.text, fontWeight: 600 }}>
                  {info.followers.toLocaleString()}
                </span>{' '}
                followers
              </button>
            )}
            {info.followers != null && info.following != null && ' · '}
            {info.following != null && (
              <button
                type="button"
                onClick={() => setListModal({ type: 'following' })}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <span style={{ color: theme.colors.text, fontWeight: 600 }}>
                  {info.following.toLocaleString()}
                </span>{' '}
                following
              </button>
            )}
          </span>
        </div>
      )}

      {showAuthModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 8,
              border: `1px solid ${theme.colors.border}`,
              padding: 24,
              maxWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                color: '#fff',
              }}
            >
              <Github size={28} />
            </div>
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
              }}
            >
              Authenticated
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSizes[2],
                color: theme.colors.textSecondary,
              }}
            >
              Signed in via GitHub CLI
            </p>
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              style={{
                marginTop: 16,
                padding: '8px 24px',
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.textOnAccent,
                backgroundColor: theme.colors.primary,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {listModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onClick={() => setListModal(null)}
        >
          <div
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 8,
              border: `1px solid ${theme.colors.border}`,
              width: 320,
              maxHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.text,
                }}
              >
                {listModal.type === 'followers' ? 'Followers' : 'Following'}
              </h3>
              <button
                type="button"
                onClick={() => setListModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: theme.colors.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 0',
              }}
            >
              {listLoading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 32,
                    color: theme.colors.textMuted,
                  }}
                >
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : listUsers.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes[2],
                  }}
                >
                  No {listModal.type} found
                </div>
              ) : (
                listUsers.map((user) => (
                  <a
                    key={user.id}
                    href={`https://github.com/${user.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 16px',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      width={32}
                      height={32}
                      style={{ borderRadius: '50%' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: theme.fontWeights.semibold,
                          color: theme.colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.name || user.login}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        @{user.login}
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
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
