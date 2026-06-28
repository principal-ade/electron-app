import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { BookOpen, Folder, FolderTree, Plus, Search, TerminalSquare, X } from 'lucide-react';
import { PANEL_FOCUS_SEARCH_EVENT } from '../../components/Sidebar/PanelIconSidebar';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import { useTerminalProvider } from '../../contexts/TerminalContext';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { shellQuote } from '../../utils/shellQuote';

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

/**
 * Repository card component
 */
interface RepositoryCardProps {
  repository: AlexandriaEntry;
  /** True when this repo has any live terminal session. Drives the icon. */
  hasActiveTerminal: boolean;
  /**
   * True when this repo's terminal is the one currently visible/focused in the
   * terminal panel. Drives the highlighted border — only the active terminal's
   * project gets it, not every project that merely has a session open.
   */
  isActiveTerminal: boolean;
  isMember: boolean;
  /**
   * True when the keyboard cursor (arrow-key navigation from the search input)
   * is on this card. Renders a highlight and scrolls the card into view.
   */
  isSelected: boolean;
  homePath: string | null;
  onSelect: (repo: AlexandriaEntry) => void;
  onOpen: (repo: AlexandriaEntry) => void;
  onRemove?: (repo: AlexandriaEntry) => void;
  onAdd?: (repo: AlexandriaEntry) => void;
  onOpenDocs?: (repo: AlexandriaEntry) => void;
  onOpenFiles?: (repo: AlexandriaEntry) => void;
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  hasActiveTerminal,
  isActiveTerminal,
  isMember,
  isSelected,
  homePath,
  onSelect,
  onOpen,
  onRemove,
  onAdd,
  onOpenDocs,
  onOpenFiles,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Keep the keyboard-highlighted card visible as the cursor moves through a
  // list that overflows the scroll area.
  useEffect(() => {
    if (isSelected) cardRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isSelected]);

  // The arrow-key cursor and the hover state share the same emphasis so the
  // highlight reads the same however the card was reached.
  const emphasized = isHovered || isSelected;

  const owner = repository.github?.owner;
  const avatarUrl = owner
    ? `https://github.com/${encodeURIComponent(owner)}.png?size=48`
    : null;

  return (
    <div
      ref={cardRef}
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
          isActiveTerminal || isSelected
            ? theme.colors.primary
            : theme.colors.border
        }`,
        boxShadow: isSelected
          ? `inset 0 0 0 1px ${theme.colors.primary}`
          : undefined,
        backgroundColor: emphasized
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
            color: isMember ? theme.colors.primary : theme.colors.text,
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
        {emphasized && onOpenFiles && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFiles(repository);
            }}
            title="Open files"
            aria-label="Open files"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.text;
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FolderTree size={14} />
          </button>
        )}
        {emphasized && onOpenDocs && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDocs(repository);
            }}
            title="Open docs"
            aria-label="Open docs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.text;
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <BookOpen size={14} />
          </button>
        )}
        {isMember && emphasized && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(repository);
            }}
            title="Remove from workspace"
            aria-label="Remove from workspace"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.text;
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={14} />
          </button>
        )}
        {!isMember && emphasized && onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(repository);
            }}
            title="Add to workspace"
            aria-label="Add to workspace"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.text;
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[1]}px`,
          color: theme.colors.textMuted,
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
  /**
   * Path of the repo whose terminal is currently visible/focused in the
   * terminal panel. Only this project's card gets the highlighted border;
   * other projects with open sessions keep just the terminal icon. Carried on
   * context (not a sibling prop) to keep the panel's context/actions/events
   * contract intact.
   */
  activeTerminalRepoPath?: string | null;
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
  const activeTerminalRepoPath = context.activeTerminalRepoPath;
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [homePath, setHomePath] = useState<string | null>(null);
  const { context: terminalCtx } = useTerminalProvider();
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Keyboard navigation cursor, tracked by repository path rather than list
  // index. The Projects data slices refresh in the background (new array
  // identity, same contents), which would reset an index-based cursor on every
  // refresh — making the highlight vanish after ~a second. Tracking the path
  // and deriving the index each render keeps the selection stable across those
  // refreshes; it clears only when the repo actually leaves the list. null
  // means the search input itself is the active element (nothing highlighted).
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ panelId?: string }>).detail;
      if (detail?.panelId === 'workspace-repos') {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      }
    };
    window.addEventListener(PANEL_FOCUS_SEARCH_EVENT, onFocus);
    return () => window.removeEventListener(PANEL_FOCUS_SEARCH_EVENT, onFocus);
  }, []);

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

  // Paths of repos that are members of the current workspace. Drives the
  // hover-X affordance on the card.
  const memberPaths = useMemo(() => {
    const paths = new Set<string>();
    const repos = context.workspaceRepositories?.data?.repositories;
    if (repos) {
      for (const repo of repos) paths.add(repo.path);
    }
    return paths;
  }, [context.workspaceRepositories?.data?.repositories]);

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

  // Default list shown when no search query is active: prefer the recent
  // slice, then workspace, then the full alexandria set.
  const repositories = useMemo(() => {
    const recentRepos = context.recentRepositories?.data?.repositories;
    if (recentRepos && recentRepos.length > 0) return recentRepos;

    const workspaceRepos = context.workspaceRepositories?.data?.repositories;
    if (workspaceRepos && workspaceRepos.length > 0) return workspaceRepos;

    const allRepos = context.alexandriaRepositories?.data?.repositories;
    if (allRepos && allRepos.length > 0) return allRepos;

    return [];
  }, [context]);

  // When the user types in the search box, widen the search pool to every
  // known repo (alexandria + workspace + recent, de-duped by path) so a query
  // can surface projects that aren't yet in the default list.
  const searchPool = useMemo(() => {
    const seen = new Set<string>();
    const merged: AlexandriaEntry[] = [];
    const push = (repos?: AlexandriaEntry[]) => {
      if (!repos) return;
      for (const repo of repos) {
        if (seen.has(repo.path)) continue;
        seen.add(repo.path);
        merged.push(repo);
      }
    };
    push(context.alexandriaRepositories?.data?.repositories);
    push(context.workspaceRepositories?.data?.repositories);
    push(context.recentRepositories?.data?.repositories);
    return merged;
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
    const query = searchQuery.trim().toLowerCase();
    // With a query active, widen the source to every known repo; otherwise
    // stick to the default (recent/workspace) list.
    const source = query ? searchPool : repositories;
    const filtered = query
      ? source.filter((repo: AlexandriaEntry) => {
          const name = repo.name.toLowerCase();
          const path = repo.path.toLowerCase();
          const description = ('description' in repo && typeof (repo as { description?: string }).description === 'string')
            ? (repo as { description: string }).description.toLowerCase()
            : '';
          return (
            name.includes(query) || path.includes(query) || description.includes(query)
          );
        })
      : source;

    // Active terminals first; within each group, most-recently-opened first,
    // with never-opened repos falling to the bottom alphabetically.
    return [...filtered].sort((a: AlexandriaEntry, b: AlexandriaEntry) => {
      const aActive = activeRepoPaths.has(a.path);
      const bActive = activeRepoPaths.has(b.path);
      if (aActive !== bActive) return aActive ? -1 : 1;

      if (a.lastOpenedAt && !b.lastOpenedAt) return -1;
      if (!a.lastOpenedAt && b.lastOpenedAt) return 1;
      if (a.lastOpenedAt && b.lastOpenedAt) {
        const aTime = new Date(a.lastOpenedAt).getTime();
        const bTime = new Date(b.lastOpenedAt).getTime();
        if (aTime !== bTime) return bTime - aTime;
      }
      return a.name.localeCompare(b.name);
    });
  }, [repositories, searchPool, searchQuery, activeRepoPaths]);

  // The cursor's position in the *current* list, recomputed each render from
  // the tracked path. -1 when nothing is selected or the selected repo has
  // dropped out of the results (filtered away / removed), which transparently
  // clears the highlight without a reset effect fighting the data refresh.
  const selectedIndex = selectedPath
    ? filteredRepositories.findIndex((r) => r.path === selectedPath)
    : -1;

  // Typing a new query returns the cursor to the input so the next ArrowDown
  // starts from the top. Background data refreshes don't touch searchQuery, so
  // they no longer wipe an active selection.
  useEffect(() => {
    setSelectedPath(null);
  }, [searchQuery]);

  // Event handlers
  const handleSelectRepository = useCallback(
    (repository: AlexandriaEntry) => {
      setSearchQuery('');
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
      setSearchQuery('');
      events.emit(
        createPanelEvent('repository:opened', {
          repositoryId: repository.name,
          repository,
        })
      );
    },
    [events]
  );

  // X-button click — ask the layout to remove the repo from the workspace
  // and tear down its repo-pinned terminal tabs.
  const handleRemoveRepository = useCallback(
    (repository: AlexandriaEntry) => {
      events.emit(
        createPanelEvent('repository:removeFromWorkspace', {
          repositoryId: repository.name,
          repository,
          repositoryPath: repository.path,
        })
      );
    },
    [events]
  );

  // Plus-button click — ask the layout to add the repo to the workspace
  // without selecting it or opening a terminal tab.
  const handleAddRepository = useCallback(
    (repository: AlexandriaEntry) => {
      events.emit(
        createPanelEvent('repository:addToWorkspace', {
          repositoryId: repository.name,
          repository,
          repositoryPath: repository.path,
        })
      );
    },
    [events]
  );

  // Docs-button click — ask the layout to open the alexandria-docs panel
  // in the right slot, scoped to this repo.
  const handleOpenDocs = useCallback(
    (repository: AlexandriaEntry) => {
      events.emit(
        createPanelEvent('repository:openDocs', {
          repositoryId: repository.name,
          repository,
          repositoryPath: repository.path,
        })
      );
    },
    [events]
  );

  // Files-button click — ask the layout to open the slimmed-down file tree
  // panel in the right slot, scoped to this repo.
  const handleOpenFiles = useCallback(
    (repository: AlexandriaEntry) => {
      events.emit(
        createPanelEvent('repository:openFiles', {
          repositoryId: repository.name,
          repository,
          repositoryPath: repository.path,
        })
      );
    },
    [events]
  );

  // Arrow-key navigation while the search input holds focus. ArrowDown steps
  // the cursor into (and through) the results; ArrowUp steps back, returning
  // to the input (-1) past the first card. Enter selects the highlighted repo.
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const list = filteredRepositories;
      if (e.key === 'ArrowDown') {
        if (list.length === 0) return;
        e.preventDefault();
        // From -1 (input) this lands on index 0; clamps at the last row.
        const next = Math.min(selectedIndex + 1, list.length - 1);
        setSelectedPath(list[next]?.path ?? null);
      } else if (e.key === 'ArrowUp') {
        if (list.length === 0) return;
        e.preventDefault();
        // Stepping up past the first row returns focus-flow to the input.
        setSelectedPath(
          selectedIndex <= 0 ? null : list[selectedIndex - 1]?.path ?? null,
        );
      } else if (e.key === 'Enter') {
        if (selectedIndex < 0) return;
        const repo = list[selectedIndex];
        if (repo) {
          e.preventDefault();
          handleSelectRepository(repo);
        }
      } else if (e.key === 'Escape' && selectedIndex >= 0) {
        e.preventDefault();
        setSelectedPath(null);
      }
    },
    [filteredRepositories, selectedIndex, handleSelectRepository],
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
    searchPool.length > 0
      ? `Search ${searchPool.length} project${searchPool.length === 1 ? '' : 's'}…`
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
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
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
            isActiveTerminal={repository.path === activeTerminalRepoPath}
            isMember={memberPaths.has(repository.path)}
            isSelected={repository.path === selectedPath}
            homePath={homePath}
            onSelect={handleSelectRepository}
            onOpen={handleOpenRepository}
            onRemove={handleRemoveRepository}
            onAdd={handleAddRepository}
            onOpenDocs={handleOpenDocs}
            onOpenFiles={handleOpenFiles}
          />
        ))}
      </div>
    </div>
  );
};
