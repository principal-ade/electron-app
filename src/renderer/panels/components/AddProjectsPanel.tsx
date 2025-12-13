import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Search, FolderOpen, ArrowLeft } from 'lucide-react';
import type {
  Workspace,
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library/types';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { LocalProjectCard } from './LocalProjectCard';

interface AddProjectsPanelProps {
  workspace: Workspace;
  /** Already-loaded workspace repositories from parent */
  initialWorkspaceRepositories: AlexandriaEntry[];
  onClose: () => void;
}

export const AddProjectsPanel: React.FC<AddProjectsPanelProps> = ({
  workspace,
  initialWorkspaceRepositories,
  onClose,
}) => {
  const { theme } = useTheme();
  const [availableRepositories, setAvailableRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [workspaceRepositories, setWorkspaceRepositories] = useState<
    AlexandriaEntry[]
  >(initialWorkspaceRepositories);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingRepo, setAddingRepo] = useState<string | null>(null);

  // Load available repositories (ones not in workspace)
  useEffect(() => {
    loadAvailableRepositories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAvailableRepositories = async () => {
    try {
      setLoadingAvailable(true);
      const allRepos = await AlexandriaService.getRepositories();

      // Get IDs of repos already in workspace
      const wsRepoIds = new Set(
        workspaceRepositories.map((r) => r.github?.id).filter(Boolean),
      );

      // Filter out repositories already in the workspace
      const available = allRepos.filter((r) => {
        const repoId = r.github?.id;
        return repoId && !wsRepoIds.has(repoId);
      });

      setAvailableRepositories(available);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      setAvailableRepositories([]);
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Filter and sort available repositories
  const filteredAvailable = useMemo(() => {
    let repos = availableRepositories;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      repos = repos.filter((repo) => {
        return (
          repo.name.toLowerCase().includes(query) ||
          (repo.github?.owner || '').toLowerCase().includes(query) ||
          (repo.github?.description || '').toLowerCase().includes(query)
        );
      });
    }
    return [...repos].sort((a, b) => a.name.localeCompare(b.name));
  }, [availableRepositories, searchQuery]);

  // Sort workspace repositories (no filtering)
  const sortedWorkspace = useMemo(() => {
    return [...workspaceRepositories].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [workspaceRepositories]);

  const handleAddRepository = async (entry: AlexandriaEntry) => {
    if (!entry.github?.id) {
      console.error('Repository missing GitHub ID');
      return;
    }

    try {
      setAddingRepo(entry.path);
      await WorkspaceService.addRepositoryToWorkspace(entry, workspace.id);

      // Update local state immediately for responsive UI
      setAvailableRepositories((prev) =>
        prev.filter((r) => r.path !== entry.path),
      );
      setWorkspaceRepositories((prev) => [...prev, entry]);
    } catch (error) {
      console.error('Failed to add repository to workspace:', error);
      alert(
        `Failed to add repository: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setAddingRepo(null);
    }
  };

  const handleRemovedFromWorkspace = (entry: AlexandriaEntry) => {
    // Update local state immediately for responsive UI
    setWorkspaceRepositories((prev) =>
      prev.filter((r) => r.path !== entry.path),
    );
    setAvailableRepositories((prev) => [...prev, entry]);
  };

  // Convert entries to RepositoryCacheData format for LocalProjectCard
  const toRepoData = (entry: AlexandriaEntry) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository: entry as any,
    gitStatus: null,
    gitBranch: '',
    branchStatus: { ahead: 0, behind: 0 },
    gitRemote: null,
    fileTree: null,
    markdownFiles: [],
    packages: [],
    qualityMetrics: null,
    packageSummary: null,
    lastFullRefresh: 0,
    partialUpdates: { git: 0, files: 0, packages: 0, quality: 0 },
    cacheSlices: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: null as any,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            padding: 0,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          title="Back to workspace"
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            Add Projects to {workspace.name}
          </h3>
        </div>
      </div>

      {/* Two Column Layout */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left Column - Workspace Projects */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${theme.colors.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundTertiary,
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.medium,
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
              }}
            >
              In Workspace ({sortedWorkspace.length})
            </h4>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px',
            }}
          >
            {sortedWorkspace.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                <FolderOpen
                  size={32}
                  style={{ opacity: 0.4, marginBottom: '8px' }}
                />
                <span style={{ fontSize: `${theme.fontSizes[1]}px` }}>
                  No projects in workspace yet
                </span>
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                {sortedWorkspace.map((entry) => (
                  <LocalProjectCard
                    key={entry.path}
                    repositoryData={toRepoData(entry)}
                    workspace={workspace}
                    actionMode="workspace"
                    onRemovedFromWorkspace={handleRemovedFromWorkspace}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Available Projects */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundTertiary,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.medium,
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                whiteSpace: 'nowrap',
              }}
            >
              Available ({filteredAvailable.length})
            </h4>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.colors.textSecondary,
                }}
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px',
            }}
          >
            {loadingAvailable ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100px',
                  color: theme.colors.textSecondary,
                  fontSize: `${theme.fontSizes[1]}px`,
                }}
              >
                Loading...
              </div>
            ) : filteredAvailable.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                <FolderOpen
                  size={32}
                  style={{ opacity: 0.4, marginBottom: '8px' }}
                />
                <span style={{ fontSize: `${theme.fontSizes[1]}px` }}>
                  {searchQuery
                    ? 'No projects match your search'
                    : 'No available projects to add'}
                </span>
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                {filteredAvailable.map((entry) => (
                  <LocalProjectCard
                    key={entry.path}
                    repositoryData={toRepoData(entry)}
                    actionMode="add-to-workspace"
                    onAddToWorkspace={() => handleAddRepository(entry)}
                    isAdding={addingRepo === entry.path}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
