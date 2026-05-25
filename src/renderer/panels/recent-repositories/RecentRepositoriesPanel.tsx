import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Folder, Search, TerminalSquare, X } from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import { useTerminalProvider } from '../../contexts/TerminalContext';
import { FileSystemService } from '../../main-process-api/FileSystemService';

function displayPath(path: string, home: string | null): string {
  if (!home) return path;
  if (path === home) return '~';
  if (path.startsWith(home + '/')) return '~' + path.slice(home.length);
  return path;
}

// Panel event prefix
const PANEL_ID = 'electron-app.recent-repositories';

// Helper to create panel events
const createPanelEvent = <T,>(type: string, payload: T) => ({
  type,
  source: PANEL_ID,
  timestamp: Date.now(),
  payload,
});

// Matches the files-panel convention so dropping onto an xterm pastes a
// safely-quoted path.
function shellQuote(s: string): string {
  if (/^[\w@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Repository card component
 */
interface RepositoryCardProps {
  repository: AlexandriaEntry;
  hasActiveTerminal: boolean;
  homePath: string | null;
  onSelect: (repo: AlexandriaEntry) => void;
  onOpen: (repo: AlexandriaEntry) => void;
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  hasActiveTerminal,
  homePath,
  onSelect,
  onOpen,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const owner = repository.github?.owner;
  const avatarUrl = owner
    ? `https://github.com/${encodeURIComponent(owner)}.png?size=48`
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', shellQuote(repository.path));
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(repository)}
      onDoubleClick={() => onOpen(repository)}
      style={{
        padding: '12px',
        borderRadius: '6px',
        border: `1px solid ${
          hasActiveTerminal ? theme.colors.primary : theme.colors.border
        }`,
        backgroundColor: isHovered
          ? theme.colors.background
          : theme.colors.backgroundSecondary,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        {avatarUrl && !avatarFailed ? (
          <img
            src={avatarUrl}
            alt={owner ?? ''}
            width={20}
            height={20}
            onError={() => setAvatarFailed(true)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <Folder size={20} color={theme.colors.primary} />
        )}
        <span
          style={{
            flex: 1,
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {repository.name}
        </span>
        {hasActiveTerminal && (
          <TerminalSquare
            size={14}
            color={theme.colors.primary}
            aria-label="Terminal open"
          />
        )}
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[1]}px`,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayPath(repository.path, homePath)}
      </div>
      {'description' in repository && typeof (repository as { description?: string }).description === 'string' && (
        <div
          style={{
            marginTop: '4px',
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {(repository as { description: string }).description}
        </div>
      )}
    </div>
  );
};

interface RecentRepositoriesPanelContext extends PanelContextValue {
  recentRepositories?: DataSlice<{ repositories: AlexandriaEntry[] }>;
  workspaceRepositories?: DataSlice<{ repositories: AlexandriaEntry[] }>;
  alexandriaRepositories?: DataSlice<{ repositories: AlexandriaEntry[] }>;
}

interface RecentRepositoriesPanelProps {
  context: RecentRepositoriesPanelContext;
  actions?: PanelActions;
  events: PanelEventEmitter;
}

/**
 * RecentRepositoriesPanel - Recent repositories panel with search
 *
 * Features:
 * - List recently accessed repositories
 * - Search/filter repositories by name, path, or description
 * - Simple, clean layout focused on quick access
 */
export const RecentRepositoriesPanel: React.FC<RecentRepositoriesPanelProps> = ({
  context,
  events,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [homePath, setHomePath] = useState<string | null>(null);
  const { context: terminalCtx } = useTerminalProvider();

  useEffect(() => {
    let cancelled = false;
    FileSystemService.getHomePath()
      .then((home) => {
        if (!cancelled) setHomePath(home);
      })
      .catch(() => {
        // Leave homePath null — paths will render unchanged.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Repos that currently have a `repo:<path>`-keyed terminal session
  // within this workspace. Sessions outside this context (other workspaces,
  // foreign tabs) are ignored.
  const activeRepoPaths = useMemo(() => {
    const prefix = `${terminalCtx.terminalContext}:repo:`;
    const paths = new Set<string>();
    for (const session of terminalCtx.terminalSessions ?? []) {
      if (session.context?.startsWith(prefix)) {
        paths.add(session.context.slice(prefix.length));
      }
    }
    return paths;
  }, [terminalCtx.terminalContext, terminalCtx.terminalSessions]);

  // Get repositories from context
  // Try multiple possible slice names for flexibility
  const repositories = useMemo(() => {
    // Try recentRepositories slice first
    const recentRepos = context.recentRepositories?.data?.repositories;
    if (recentRepos && recentRepos.length > 0) return recentRepos;

    // Try workspaceRepositories (only if not empty)
    const workspaceRepos = context.workspaceRepositories?.data?.repositories;
    if (workspaceRepos && workspaceRepos.length > 0) return workspaceRepos;

    // Fallback to all alexandriaRepositories
    const allRepos = context.alexandriaRepositories?.data?.repositories;
    if (allRepos && allRepos.length > 0) return allRepos;

    return [];
  }, [context]);

  const isLoading = useMemo(() => {
    return (
      context.recentRepositories?.loading ||
      context.workspaceRepositories?.loading ||
      context.alexandriaRepositories?.loading ||
      false
    );
  }, [context]);

  // Filter and sort repositories based on search query
  const filteredRepositories = useMemo(() => {
    let filtered = repositories;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = repositories.filter((repo: AlexandriaEntry) => {
        const name = repo.name.toLowerCase();
        const path = repo.path.toLowerCase();
        // Description may exist on some entries but not in the type definition
        const description = ('description' in repo && typeof (repo as { description?: string }).description === 'string')
          ? (repo as { description: string }).description.toLowerCase()
          : '';
        return (
          name.includes(query) || path.includes(query) || description.includes(query)
        );
      });
    }

    // Active terminals first, then alphabetical within each group.
    return [...filtered].sort((a: AlexandriaEntry, b: AlexandriaEntry) => {
      const aActive = activeRepoPaths.has(a.path);
      const bActive = activeRepoPaths.has(b.path);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [repositories, searchQuery, activeRepoPaths]);

  // Event handlers
  const handleSelectRepository = useCallback(
    (repository: AlexandriaEntry) => {
      events.emit(
        createPanelEvent('repository:selected', {
          repositoryId: repository.name,
          repository,
          repositoryPath: repository.path,
        })
      );
    },
    [events]
  );

  const handleOpenRepository = useCallback(
    (repository: AlexandriaEntry) => {
      events.emit(
        createPanelEvent('repository:opened', {
          repositoryId: repository.name,
          repository,
        })
      );
    },
    [events]
  );

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={baseContainerStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              maxWidth: '360px',
            }}
          >
            <h3
              style={{
                margin: 0,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              Loading repositories...
            </h3>
          </div>
        </div>
      </div>
    );
  }

  const searchPlaceholder =
    repositories.length > 0
      ? `Search ${repositories.length} project${repositories.length === 1 ? '' : 's'}…`
      : 'Search projects…';

  return (
    <div style={baseContainerStyle}>
      {/* Search bar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.backgroundSecondary,
          }}
        >
          <Search size={14} color={theme.colors.textSecondary} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{
                display: 'inline-flex',
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px 16px',
        }}
      >
        {/* Empty state */}
        {repositories.length === 0 && !isLoading && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <p style={{ margin: 0, fontSize: `${theme.fontSizes[1]}px` }}>
              No repositories found.
            </p>
          </div>
        )}

        {/* No search results */}
        {repositories.length > 0 &&
          filteredRepositories.length === 0 &&
          searchQuery && (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
              }}
            >
              <p style={{ margin: 0, fontSize: `${theme.fontSizes[1]}px` }}>
                No repositories match "{searchQuery}"
              </p>
            </div>
          )}

        {/* Repositories list */}
        {filteredRepositories.map((repository: AlexandriaEntry) => (
          <RepositoryCard
            key={repository.path}
            repository={repository}
            hasActiveTerminal={activeRepoPaths.has(repository.path)}
            homePath={homePath}
            onSelect={handleSelectRepository}
            onOpen={handleOpenRepository}
          />
        ))}
      </div>
    </div>
  );
};
