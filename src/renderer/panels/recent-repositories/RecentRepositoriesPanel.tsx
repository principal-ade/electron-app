import React, { useMemo, useCallback, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Folder, Search, X } from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';

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
  onSelect: (repo: AlexandriaEntry) => void;
  onOpen: (repo: AlexandriaEntry) => void;
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  onSelect,
  onOpen,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(repository)}
      onDoubleClick={() => onOpen(repository)}
      style={{
        padding: '12px',
        borderRadius: '6px',
        border: `1px solid ${theme.colors.border}`,
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
        <Folder size={16} color={theme.colors.primary} />
        <span
          style={{
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {repository.name}
        </span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {repository.path}
      </div>
      {'description' in repository && typeof (repository as { description?: string }).description === 'string' && (
        <div
          style={{
            marginTop: '4px',
            fontSize: `${theme.fontSizes[0]}px`,
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

  // Get repositories from context
  // Try multiple possible slice names for flexibility
  const repositories = useMemo(() => {
    // Try recentRepositories slice first
    const recentRepos = context.recentRepositories?.data?.repositories;
    if (recentRepos) return recentRepos;

    // Fallback to workspaceRepositories
    const workspaceRepos = context.workspaceRepositories?.data
      ?.repositories;
    if (workspaceRepos) return workspaceRepos;

    // Fallback to alexandriaRepositories
    const allRepos = context.alexandriaRepositories?.data?.repositories;
    if (allRepos) return allRepos;

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

    // Sort by name
    return [...filtered].sort((a: AlexandriaEntry, b: AlexandriaEntry) =>
      a.name.localeCompare(b.name)
    );
  }, [repositories, searchQuery]);

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
    backgroundColor: theme.colors.backgroundSecondary,
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

  return (
    <div style={baseContainerStyle}>
      {/* Header */}
      <div
        style={{
          height: '40px',
          minHeight: '40px',
          padding: '0 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Folder size={18} color={theme.colors.primary} />
        <span
          style={{
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.medium,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Repositories
        </span>
        {repositories.length > 0 && (
          <span
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: theme.colors.background,
              flexShrink: 0,
            }}
          >
            {filteredRepositories.length}
            {searchQuery ? ` / ${repositories.length}` : ''}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              color: theme.colors.textSecondary,
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 32px 8px 36px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                border: 'none',
                background: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
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
          gap: '4px',
          padding: '8px 16px',
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
            onSelect={handleSelectRepository}
            onOpen={handleOpenRepository}
          />
        ))}
      </div>
    </div>
  );
};
