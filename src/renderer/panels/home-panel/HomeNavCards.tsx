/**
 * HomeNavCards
 *
 * Clickable navigation cards on the Home panel's default view.
 * Order: Your Projects → Other Clones → Starred → (Principal) Collections / Recent.
 * "Cloned only" lives as a switch inside Your Projects, not a separate card.
 */

import React from 'react';
import {
  ChevronRight,
  FolderGit2,
  HardDrive,
  History,
  Layers,
  Star,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

export type HomeNavKey =
  | 'projects'
  | 'other-clones'
  | 'starred'
  | 'collections'
  | 'recent';

export interface HomeNavCardCounts {
  projects?: number | null;
  'other-clones'?: number | null;
  starred?: number | null;
  collections?: number | null;
  recent?: number | null;
}

export interface HomeNavCardMeta {
  key: HomeNavKey;
  icon: React.ReactNode;
  label: string;
  description: string;
  /** When true, only shown if the user is signed in with Principal. */
  requiresPrincipal?: boolean;
}

export const HOME_NAV_CARDS: HomeNavCardMeta[] = [
  {
    key: 'projects',
    icon: <FolderGit2 size={18} />,
    label: 'Your Projects',
    description: "Your repos and your orgs' repos",
  },
  {
    key: 'other-clones',
    icon: <HardDrive size={18} />,
    label: 'Other Clones',
    description: "Local clones you don't own",
  },
  {
    key: 'starred',
    icon: <Star size={18} />,
    label: 'Starred Projects',
    description: "Repositories you've starred",
  },
  {
    key: 'collections',
    icon: <Layers size={18} />,
    label: 'Collections',
    description: 'Your curated collections of repos',
    requiresPrincipal: true,
  },
  {
    key: 'recent',
    icon: <History size={18} />,
    label: 'Recently Visited',
    description: "Trails, topics, and projects you've opened",
    requiresPrincipal: true,
  },
];

export interface HomeNavCardsProps {
  counts?: HomeNavCardCounts;
  activeView?: HomeNavKey | null;
  onOpenView: (key: HomeNavKey) => void;
  /** Principal (app OAuth) sign-in — gates collections / recently visited. */
  isPrincipalSignedIn?: boolean;
}

export const HomeNavCards: React.FC<HomeNavCardsProps> = ({
  counts,
  activeView = null,
  onOpenView,
  isPrincipalSignedIn = false,
}) => {
  const { theme } = useTheme();

  const cards = HOME_NAV_CARDS.filter(
    (card) => !card.requiresPrincipal || isPrincipalSignedIn,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
      {cards.map((card) => {
        const count = counts?.[card.key];
        const active = activeView === card.key;
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={active}
            onClick={() => onOpenView(card.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: 6,
              padding: '10px 12px',
              border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
              background: active
                ? `color-mix(in srgb, ${theme.colors.primary} 12%, ${theme.colors.backgroundSecondary})`
                : theme.colors.backgroundSecondary,
              color: theme.colors.text,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.borderColor = theme.colors.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border;
              }
            }}
            title={`Open ${card.label.toLowerCase()}`}
          >
            <span
              style={{
                flexShrink: 0,
                color: active ? theme.colors.primary : theme.colors.textSecondary,
              }}
            >
              {card.icon}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                  }}
                >
                  {card.label}
                </span>
                {count != null && (
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textMuted,
                    }}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textMuted,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {card.description}
              </div>
            </div>
            <ChevronRight
              size={16}
              style={{ flexShrink: 0, color: theme.colors.textMuted }}
            />
          </button>
        );
      })}
    </div>
  );
};
