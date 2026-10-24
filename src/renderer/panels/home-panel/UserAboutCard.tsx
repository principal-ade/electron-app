/**
 * UserAboutCard
 *
 * Profile card at the top of the Home left panel.
 * - source: 'github' — full GitHub profile (avatar, @login, stats…)
 * - source: 'git'    — local git identity (user.name / user.email) when the
 *                      user is not signed in via the GitHub CLI / API
 */

import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, Mail } from 'lucide-react';
import type { UserAboutInfo } from './useUserAboutInfo';

export interface UserAboutCardProps {
  info: UserAboutInfo | null;
  loading?: boolean;
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

/**
 * Height (border-box) shared by the loading skeleton and the rendered profile
 * card so the Home panel doesn't jump when the profile loads. Sized to the
 * compact GitHub card — a single identity row — since the company/location and
 * followers rows were removed.
 */
const CARD_MIN_HEIGHT = 84;

const cardShell = (background: string): React.CSSProperties => ({
  padding: '20px 20px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: CARD_MIN_HEIGHT,
  background,
});

export const UserAboutCard: React.FC<UserAboutCardProps> = ({
  info,
  loading = false,
}) => {
  const { theme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Show the skeleton immediately while loading (no debounce) so the card never
  // renders a blank frame first. Once loading finishes with no profile at all,
  // fall back to the empty state.
  if (!info) {
    return loading ? <UserAboutCardSkeleton /> : <UserAboutCardEmpty />;
  }

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
      <div style={cardShell(theme.colors.backgroundSecondary)}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
          }}
        >
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
            aria-label="From global git config (user.name / user.email)"
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
    <div style={cardShell(theme.colors.backgroundSecondary)}>
      {/* Identity: avatar + name + @login + source badge */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
      >
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open @${info.login} on GitHub`}
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
          aria-label="Authenticated with GitHub CLI"
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
    </div>
  );
};

function UserAboutCardSkeleton() {
  const { theme } = useTheme();
  const bar = (
    w: string | number,
    h: number,
    radius = 4,
  ): React.CSSProperties => ({
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
        minHeight: CARD_MIN_HEIGHT,
        background: theme.colors.backgroundSecondary,
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
      <style>{`
        @keyframes homeCardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/**
 * Shown once loading finishes with neither a GitHub profile nor a local git
 * identity (both `git config --global user.name` and `user.email` unset).
 */
function UserAboutCardEmpty() {
  const { theme } = useTheme();

  return (
    <div style={cardShell(theme.colors.backgroundSecondary)}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            color: theme.colors.textMuted,
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <Github size={22} />
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
            Not signed in
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
            Sign in with the GitHub CLI
          </div>
        </div>
      </div>
    </div>
  );
}
