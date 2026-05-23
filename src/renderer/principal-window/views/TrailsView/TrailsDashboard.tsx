import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArrowRight,
  FolderGit2,
  Footprints,
  Library,
  Plus,
} from 'lucide-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { formatRelativeTime } from './TrailCard';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

export interface TrailsDashboardRepoEntry {
  /** Stable key — usually the repo path. */
  key: string;
  /** Last-segment label, e.g. "electron-app". */
  label: string;
  /** GitHub owner login if known; drives avatar fallback. */
  ownerLogin?: string;
  /** Total trails the user has in this repo. */
  trailCount: number;
  /** Most-recent trail in the repo, for the preview line + timestamp. */
  latestTrail: TrailIndexEntry;
}

export interface TrailsDashboardTopicEntry {
  /** Stable key — topic id. */
  key: string;
  /** Topic title, e.g. "Auth & sessions". */
  title: string;
  /** Optional short blurb. */
  descriptionPreview?: string;
  /** Trails curated into this topic. */
  trailCount: number;
  /** ISO 8601 — drives the "updated Xd ago" hint. */
  updatedAt: string;
}

export interface TrailsDashboardProps {
  /** Repos with at least one trail, in display order. */
  repoEntries: TrailsDashboardRepoEntry[];
  /**
   * Curated topic collections, in display order. Ignored when the user is
   * signed out — topics are a server-backed concept that requires auth.
   */
  topicEntries: TrailsDashboardTopicEntry[];
  /** Fired when the user clicks a repo card. */
  onSelectRepo: (entry: TrailsDashboardRepoEntry) => void;
  /** Fired when the user clicks a topic row. */
  onSelectTopic: (entry: TrailsDashboardTopicEntry) => void;
  /** Fired by the "New topic" button. Hide the button by omitting. */
  onCreateTopic?: () => void;
  /** "View all trails" → opens the full recent grid. */
  onViewAllTrails: () => void;
  /** Max repo cards to render before clipping. Default 6. */
  repoLimit?: number;
  /** Max topic rows to render before clipping. Default 6. */
  topicLimit?: number;
}

/**
 * Repo + topic dashboard. Shown on the trails landing once the user has
 * accumulated trails — replaces the prompt-idea cards for return users.
 * Purely presentational; caller supplies data + handlers.
 */
export const TrailsDashboard: React.FC<TrailsDashboardProps> = ({
  repoEntries,
  topicEntries,
  onSelectRepo,
  onSelectTopic,
  onCreateTopic,
  onViewAllTrails,
  repoLimit = 6,
  topicLimit = 6,
}) => {
  const { theme } = useTheme();
  const visibleRepos = repoEntries.slice(0, repoLimit);
  const visibleTopics = topicEntries.slice(0, topicLimit);

  return (
    <section
      style={{
        width: '100%',
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px 32px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 36,
      }}
    >
      <Section
        theme={theme}
        eyebrowIcon={<FolderGit2 size={12} color={theme.colors.primary} />}
        eyebrow="Repos"
        title="Repos with trails"
        subtitle={
          repoEntries.length === 0
            ? 'No repos have trails yet.'
            : `${repoEntries.length} ${repoEntries.length === 1 ? 'repo' : 'repos'}`
        }
        action={
          repoEntries.length > 0 ? (
            <PillButton
              theme={theme}
              onClick={onViewAllTrails}
              accent
              icon={<ArrowRight size={14} />}
              iconPosition="end"
            >
              View all trails
            </PillButton>
          ) : null
        }
      >
        {visibleRepos.length === 0 ? (
          <EmptyHint
            theme={theme}
            text="Publish a trail from the File City panel and its repo will land here."
          />
        ) : (
          <RepoGrid
            repos={visibleRepos}
            theme={theme}
            onSelectRepo={onSelectRepo}
          />
        )}
      </Section>

      <Section
        theme={theme}
        eyebrowIcon={<Library size={12} color={theme.colors.primary} />}
        eyebrow="Topics"
        title="Your topics"
        subtitle={
          topicEntries.length === 0
            ? 'Curated sets of trails on a shared subject.'
            : `${topicEntries.length} ${topicEntries.length === 1 ? 'topic' : 'topics'}`
        }
        action={
          onCreateTopic ? (
            <PillButton
              theme={theme}
              onClick={onCreateTopic}
              accent
              icon={<Plus size={14} />}
              iconPosition="start"
            >
              New topic
            </PillButton>
          ) : null
        }
      >
        {visibleTopics.length === 0 ? (
          <EmptyHint
            theme={theme}
            text="No topics yet. Bundle related trails together so they're easy to share."
          />
        ) : (
          <TopicList
            topics={visibleTopics}
            theme={theme}
            onSelectTopic={onSelectTopic}
          />
        )}
      </Section>
    </section>
  );
};

function Section({
  theme,
  eyebrowIcon,
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  theme: ThemeShape;
  eyebrowIcon?: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: theme.colors.textTertiary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {eyebrowIcon}
            {eyebrow}
          </div>
          <div
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.heading ?? theme.fonts.body,
              fontSize: theme.fontSizes[5],
              fontWeight: theme.fontWeights.bold,
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                color: theme.colors.textTertiary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function RepoGrid({
  repos,
  theme,
  onSelectRepo,
}: {
  repos: TrailsDashboardRepoEntry[];
  theme: ThemeShape;
  onSelectRepo: (entry: TrailsDashboardRepoEntry) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {repos.map((r) => {
        const accent = purposeAccent(r.latestTrail.purpose, theme);
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onSelectRepo(r)}
            style={{
              textAlign: 'left',
              background: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 12,
              padding: '18px 18px 16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              transition: 'border-color 120ms ease, transform 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minWidth: 0,
              }}
            >
              {r.ownerLogin ? (
                <img
                  src={`https://github.com/${r.ownerLogin}.png?size=80`}
                  alt={r.ownerLogin}
                  width={36}
                  height={36}
                  style={{
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                />
              ) : (
                <FolderGit2 size={28} color={theme.colors.primary} />
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[2],
                    fontWeight: theme.fontWeights.semibold,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.label}
                </div>
                {r.ownerLogin && (
                  <div
                    style={{
                      fontFamily: theme.fonts.monospace ?? theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textTertiary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.ownerLogin}
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                paddingTop: 12,
                borderTop: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                }}
              >
                <Footprints size={12} color={accent} />
                <span>
                  {r.trailCount} {r.trailCount === 1 ? 'trail' : 'trails'} ·
                  latest {formatRelativeTime(r.latestTrail.updatedAt)}
                </span>
              </div>
              <div
                style={{
                  color: accent,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {r.latestTrail.title || 'Untitled trail'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TopicList({
  topics,
  theme,
  onSelectTopic,
}: {
  topics: TrailsDashboardTopicEntry[];
  theme: ThemeShape;
  onSelectTopic: (entry: TrailsDashboardTopicEntry) => void;
}) {
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
      }}
    >
      {topics.map((t) => (
        <li key={t.key}>
          <button
            type="button"
            onClick={() => onSelectTopic(t)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 10,
              padding: '14px 16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              transition: 'border-color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
              }}
            >
              <Library size={16} color={theme.colors.primary} />
              <div
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.semibold,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {t.title}
              </div>
            </div>
            <div
              style={{
                color: theme.colors.textTertiary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
              }}
            >
              {t.trailCount} {t.trailCount === 1 ? 'trail' : 'trails'} ·
              updated {formatRelativeTime(t.updatedAt)}
            </div>
            {t.descriptionPreview && (
              <div
                style={{
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {t.descriptionPreview}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyHint({ theme, text }: { theme: ThemeShape; text: string }) {
  return (
    <div
      style={{
        padding: '28px 16px',
        textAlign: 'center',
        background: theme.colors.backgroundSecondary,
        border: `1px dashed ${theme.colors.border}`,
        borderRadius: 10,
        color: theme.colors.textTertiary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
      }}
    >
      {text}
    </div>
  );
}

function PillButton({
  theme,
  onClick,
  children,
  accent,
  icon,
  iconPosition = 'start',
}: {
  theme: ThemeShape;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 999,
        background: 'transparent',
        border: `1px solid ${accent ? theme.colors.primary : theme.colors.border}`,
        color: accent ? theme.colors.primary : theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.medium,
        cursor: 'pointer',
      }}
    >
      {iconPosition === 'start' && icon}
      {children}
      {iconPosition === 'end' && icon}
    </button>
  );
}

function purposeAccent(
  purpose: TrailIndexEntry['purpose'],
  theme: ThemeShape,
): string {
  const p = purpose ?? 'investigation';
  if (p === 'informative') return theme.colors.success ?? '#4ade80';
  if (p === 'changelog') return theme.colors.warning ?? '#fb923c';
  return theme.colors.primary;
}
