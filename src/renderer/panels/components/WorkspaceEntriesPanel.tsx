import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Search, Folder } from 'lucide-react';
import type { Workspace, AlexandriaEntry } from '@a24z/core-library';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { LocalProjectCard } from './LocalProjectCard';
import { useAllRepositories } from '../../hooks/useRepositoryData';

interface WorkspaceEntriesPanelProps {
  selectedWorkspace?: Workspace | null;
}

export const WorkspaceEntriesPanel: React.FC<WorkspaceEntriesPanelProps> = ({
  selectedWorkspace,
}) => {
  const { theme } = useTheme();
  const [workspaceRepoIds, setWorkspaceRepoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const { repositories: allRepositories, loading: allReposLoading } = useAllRepositories();

  // Load repository IDs in this workspace
  useEffect(() => {
    if (!selectedWorkspace) {
      setWorkspaceRepoIds([]);
      return;
    }

    const loadWorkspaceRepos = async () => {
      try {
        setLoading(true);
        const repos = await WorkspaceService.getRepositoriesInWorkspace(selectedWorkspace.id);
        // Extract repository identifiers (github.id or name)
        const ids = repos.map(repo => {
          if (repo.github?.id) {
            return `${repo.github.owner}/${repo.github.name}`;
          }
          return repo.name;
        });
        setWorkspaceRepoIds(ids);
      } catch (error) {
        console.error('Failed to load workspace repositories:', error);
        setWorkspaceRepoIds([]);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceRepos();

    // Subscribe to workspace changes
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      if (event.type === 'membership-changed' && event.workspaceId === selectedWorkspace.id) {
        loadWorkspaceRepos();
      }
    });

    return unsubscribe;
  }, [selectedWorkspace]);

  const normalizedFilter = filter.trim().toLowerCase();

  // Filter repositories that belong to this workspace
  const filteredRepositories = useMemo(() => {
    if (!selectedWorkspace || workspaceRepoIds.length === 0) {
      return [];
    }

    // Get repositories that are in this workspace
    const workspaceRepos = allRepositories.filter((repoData) => {
      const entry = repoData.repository;
      const repoId = entry.github?.id
        ? `${entry.github.owner}/${entry.github.name}`
        : entry.name;

      return workspaceRepoIds.includes(repoId);
    });

    // Apply search filter
    if (!normalizedFilter) {
      return workspaceRepos;
    }

    return workspaceRepos.filter((repoData) => {
      const entry = repoData.repository;
      const haystack = [
        entry.name,
        entry.github?.name ?? '',
        entry.github?.owner ?? '',
        entry.github?.description ?? '',
        entry.remoteUrl ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedFilter);
    });
  }, [selectedWorkspace, workspaceRepoIds, allRepositories, normalizedFilter]);

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
  };

  const contentContainerStyle: React.CSSProperties = {
    ...baseContainerStyle,
    padding: '16px',
    gap: '12px',
  };

  // No workspace selected
  if (!selectedWorkspace) {
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
            <Folder
              size={48}
              style={{
                color: theme.colors.textSecondary,
                opacity: 0.5,
              }}
            />
            <div>
              <h3
                style={{
                  margin: '0 0 8px 0',
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[3]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                }}
              >
                No Workspace Selected
              </h3>
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.body,
                }}
              >
                Select a workspace from the Workspaces panel to see its repositories.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || allReposLoading) {
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
    <div style={contentContainerStyle}>
      {/* Workspace header */}
      <div>
        <h3
          style={{
            margin: '0 0 4px 0',
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
          }}
        >
          {selectedWorkspace.name}
        </h3>
        {selectedWorkspace.description && (
          <p
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
            }}
          >
            {selectedWorkspace.description}
          </p>
        )}
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            top: '50%',
            left: '12px',
            transform: 'translateY(-50%)',
            color: theme.colors.textSecondary,
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={filter}
          placeholder="Filter repositories..."
          onChange={(event) => setFilter(event.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
            outline: 'none',
          }}
        />
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {/* Repository list */}
        {filteredRepositories.map((repoData) => (
          <LocalProjectCard
            key={repoData.repository.path}
            repositoryData={repoData}
          />
        ))}

        {/* No results message */}
        {filteredRepositories.length === 0 && !loading && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <p style={{ margin: 0 }}>
              {normalizedFilter
                ? 'No repositories match your filter.'
                : 'No repositories in this workspace.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const WorkspaceEntriesPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: `${theme.fontSizes[0]}px`,
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '2px',
            backgroundColor: `${theme.colors.primary || '#3b82f6'}40`,
          }}
        />
        <span>Workspace Repositories</span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
          marginTop: '4px',
        }}
      >
        View repositories in the selected workspace
      </div>
    </div>
  );
};
