import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AppWindow, FolderGit2, Route, Share2, Trash2 } from 'lucide-react';
import type { TrailsDashboardTopicEntry } from './TrailsDashboard';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

/**
 * Replace the platform home prefix with `~` so paths render compactly.
 * Matches macOS (`/Users/<name>`) and Linux (`/home/<name>`); other paths
 * pass through untouched.
 */
const tildifyPath = (path: string): string => {
  const mac = path.match(/^\/Users\/[^/]+/);
  if (mac) return path.replace(mac[0], '~');
  const linux = path.match(/^\/home\/[^/]+/);
  if (linux) return path.replace(linux[0], '~');
  return path;
};

export interface TopicCardProps {
  topic: TrailsDashboardTopicEntry;
  theme: ThemeShape;
  onSelect: (entry: TrailsDashboardTopicEntry) => void;
  /** Renders the hover-reveal delete button when provided. */
  onDelete?: (entry: TrailsDashboardTopicEntry) => void;
}

/**
 * A single topic card for the dashboard's Topics grid: title, an optional
 * "Shared" badge, and either a repo-chip row (owner avatars + names) or a
 * tildified folder path. The trash icon fades in on hover when `onDelete`
 * is supplied.
 */
export function TopicCard({
  topic,
  theme,
  onSelect,
  onDelete,
}: TopicCardProps) {
  const [hovered, setHovered] = React.useState(false);
  // The trash button shares the card's top-right corner with the status
  // indicators, so fade the indicators out while it's revealed to avoid an
  // overlap (deletion is hidden for shared topics, matching the trash guard).
  const trashVisible = hovered && !!onDelete && !topic.shared;
  return (
    <li
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => onSelect(topic)}
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
            gap: 8,
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
              minWidth: 0,
            }}
          >
            {topic.title}
          </div>
          {(topic.isOpen || topic.shared) && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flex: '0 0 auto',
                marginLeft: 'auto',
                color: theme.colors.primary,
                // Crossfade with the hover trash button so they never collide
                // in the corner.
                opacity: trashVisible ? 0 : 1,
                transition: 'opacity 120ms ease',
              }}
            >
              {topic.isOpen && (
                <span
                  title="Window open"
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <AppWindow size={14} />
                </span>
              )}
              {topic.shared &&
                // When a topic is open we already show an indicator, so the
                // "Shared" badge collapses to just its icon to keep the row
                // from getting crowded.
                (topic.isOpen ? (
                  <span
                    title="Shared to web-ade"
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    <Share2 size={14} />
                  </span>
                ) : (
                  <span
                    title="Shared to web-ade"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '1px 6px',
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      border: `1px solid ${theme.colors.primary}`,
                      borderRadius: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Share2 size={10} />
                    Shared
                  </span>
                ))}
            </span>
          )}
        </div>
        {topic.projectRepos?.length || topic.folderPath || topic.trailCount ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            {topic.projectRepos && topic.projectRepos.length > 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  gap: 8,
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  minWidth: 0,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  whiteSpace: 'nowrap',
                }}
                onWheel={(e) => {
                  if (e.deltaY !== 0 && e.deltaX === 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                title={topic.projectRepos
                  .map((r) =>
                    r.ownerLogin ? `${r.ownerLogin}/${r.name}` : r.name,
                  )
                  .join(', ')}
              >
                {topic.projectRepos.map((r, i) => (
                  <span
                    key={`${r.ownerLogin ?? ''}/${r.name}/${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      minWidth: 0,
                      flex: '0 0 auto',
                    }}
                  >
                    {r.ownerLogin ? (
                      <img
                        src={`https://github.com/${r.ownerLogin}.png?size=40`}
                        alt={r.ownerLogin}
                        width={14}
                        height={14}
                        style={{
                          borderRadius: '50%',
                          flex: '0 0 auto',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      />
                    ) : (
                      <FolderGit2 size={12} />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {r.name}
                    </span>
                  </span>
                ))}
              </div>
            ) : topic.folderPath ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  minWidth: 0,
                }}
                title={tildifyPath(topic.folderPath)}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {tildifyPath(topic.folderPath)}
                </span>
              </div>
            ) : null}
            {topic.trailCount ? (
              <div
                style={{
                  marginLeft: 'auto',
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                }}
                title={`${topic.trailCount} ${
                  topic.trailCount === 1 ? 'trail' : 'trails'
                }`}
              >
                <Route size={12} />
                {topic.trailCount}
              </div>
            ) : null}
          </div>
        ) : null}
      </button>
      {onDelete && !topic.shared && (
        <button
          type="button"
          aria-label={`Delete topic ${topic.title}`}
          title="Delete topic"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(topic);
          }}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: theme.colors.textTertiary,
            cursor: 'pointer',
            padding: 0,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              theme.colors.backgroundTertiary ?? theme.colors.background;
            e.currentTarget.style.color = theme.colors.error ?? '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = theme.colors.textTertiary;
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}
