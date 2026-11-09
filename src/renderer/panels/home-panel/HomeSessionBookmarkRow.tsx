import React, { useState } from 'react';
import { BookmarkCheck } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { AgentSessionBookmark } from '../../../shared/types/userPreferences.types';
import { AgentSessionIcon } from '../../sessions-view/AgentSessionIcon';

interface HomeSessionBookmarkRowProps {
  bookmark: AgentSessionBookmark;
  depth?: number;
  onResume: (bookmark: AgentSessionBookmark) => Promise<void>;
  onUnpin: (bookmark: AgentSessionBookmark) => void;
}

function projectName(directory: string): string {
  return directory.split(/[\\/]/).filter(Boolean).at(-1) || directory;
}

export const HomeSessionBookmarkRow: React.FC<HomeSessionBookmarkRowProps> = ({
  bookmark,
  depth = 0,
  onResume,
  onUnpin,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spacing = theme.space?.[2] ?? 8;

  const resume = async () => {
    if (opening) return;
    setOpening(true);
    setError(null);
    try {
      await onResume(bookmark);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing,
          padding: `7px ${spacing}px 7px ${14 + depth * 18}px`,
          backgroundColor: hovered
            ? theme.colors.backgroundSecondary
            : 'transparent',
        }}
      >
        <div
          role="button"
          tabIndex={opening ? -1 : 0}
          aria-label={`Resume ${bookmark.agent} session: ${bookmark.title}`}
          aria-busy={opening}
          onClick={() => void resume()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void resume();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing,
            flex: 1,
            minWidth: 0,
            color: theme.colors.text,
            cursor: opening ? 'wait' : 'pointer',
          }}
        >
          <AgentSessionIcon
            agent={bookmark.agent}
            size={14}
            color={theme.colors.textSecondary}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: theme.fontSizes[1],
              }}
            >
              {opening ? 'Opening…' : bookmark.title}
            </span>
            {depth === 0 && (
              <span
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes[0],
                }}
              >
                {projectName(bookmark.directory)}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          aria-label={`Unpin ${bookmark.title}`}
          onClick={() => onUnpin(bookmark)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: theme.colors.primary,
            cursor: 'pointer',
            opacity: 1,
            transition: 'opacity 120ms',
          }}
        >
          <BookmarkCheck size={12} />
        </button>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            padding: `0 ${spacing}px ${spacing}px ${spacing * 4}px`,
            color: theme.colors.error,
            fontSize: theme.fontSizes[0],
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
