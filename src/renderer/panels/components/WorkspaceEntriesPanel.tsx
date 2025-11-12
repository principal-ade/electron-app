import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Folder, Home, X } from 'lucide-react';
import type { Workspace, AlexandriaEntry } from '@a24z/core-library';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { LocalProjectCard } from './LocalProjectCard';

interface WorkspaceEntriesPanelProps {
  selectedWorkspace?: Workspace | null;
}

export const WorkspaceEntriesPanel: React.FC<WorkspaceEntriesPanelProps> = ({
  selectedWorkspace,
}) => {
  const { theme } = useTheme();
  const [workspaceRepositories, setWorkspaceRepositories] = useState<AlexandriaEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Local state to track the current workspace data (to handle updates)
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(selectedWorkspace || null);

  // Update local workspace when selectedWorkspace prop changes
  useEffect(() => {
    setCurrentWorkspace(selectedWorkspace || null);
  }, [selectedWorkspace]);

  // Listen for workspace updates and refresh the current workspace
  useEffect(() => {
    if (!currentWorkspace) return;

    const unsubscribe = WorkspaceService.onWorkspaceChange(async (event) => {
      if (event.type === 'updated' && event.workspace?.id === currentWorkspace.id) {
        // Refresh the workspace data
        const updated = await WorkspaceService.getWorkspace(currentWorkspace.id);
        if (updated) {
          setCurrentWorkspace(updated);
        }
      }
    });

    return unsubscribe;
  }, [currentWorkspace?.id]);

  // Load repositories in this workspace
  useEffect(() => {
    if (!selectedWorkspace) {
      setWorkspaceRepositories([]);
      return;
    }

    const loadWorkspaceRepos = async () => {
      try {
        setLoading(true);
        const repos = await WorkspaceService.getRepositoriesInWorkspace(selectedWorkspace.id);
        setWorkspaceRepositories(repos);
      } catch (error) {
        console.error('Failed to load workspace repositories:', error);
        setWorkspaceRepositories([]);
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

  // Home directory click handler - opens native picker and saves immediately
  const handleClickHomeDir = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentWorkspace) return;

    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Home Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result && !result.canceled && result.filePaths?.[0]) {
        const selectedPath = result.filePaths[0];
        await WorkspaceService.updateWorkspace(currentWorkspace.id, {
          suggestedClonePath: selectedPath
        });
      }
    } catch (error) {
      console.error('Failed to select or update directory:', error);
    }
  };

  // Remove home directory handler
  const handleRemoveHomeDir = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentWorkspace || !currentWorkspace.suggestedClonePath) return;

    if (!confirm(`Remove home directory from workspace "${currentWorkspace.name}"?\n\nThis will not delete any files, only remove the workspace's clone directory setting.`)) {
      return;
    }

    try {
      await WorkspaceService.updateWorkspace(currentWorkspace.id, {
        suggestedClonePath: null as any
      });
    } catch (error) {
      console.error('Failed to remove home directory:', error);
      alert(`Failed to remove home directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Convert repositories to display format
  const repositories = useMemo(() => {
    if (!selectedWorkspace || workspaceRepositories.length === 0) {
      return [];
    }

    // Convert workspace repositories to RepositoryCacheData format
    return workspaceRepositories.map(entry => ({
      repository: entry,
      status: null as any, // Status will be loaded by LocalProjectCard if needed
    }));
  }, [selectedWorkspace, workspaceRepositories]);

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
  if (!currentWorkspace) {
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
  if (loading) {
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '4px',
          }}
        >
          {/* Left: Workspace name */}
          <h3
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            {currentWorkspace.name}
          </h3>

          {/* Right: Home directory */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: 0,
            }}
          >
            <div
              onClick={handleClickHomeDir}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: 0,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Click to select home directory"
            >
              <Home
                size={14}
                style={{
                  color: theme.colors.textSecondary,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  color: currentWorkspace.suggestedClonePath
                    ? theme.colors.textSecondary
                    : theme.colors.textTertiary,
                  fontFamily: theme.fonts.mono,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontStyle: currentWorkspace.suggestedClonePath ? 'normal' : 'italic',
                }}
              >
                {currentWorkspace.suggestedClonePath || 'No home directory'}
              </span>
            </div>
            {currentWorkspace.suggestedClonePath && (
              <button
                onClick={handleRemoveHomeDir}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '3px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.error;
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
                title="Remove home directory"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {currentWorkspace.description && (
          <p
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
            }}
          >
            {currentWorkspace.description}
          </p>
        )}
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
        {repositories.map((repoData) => (
          <LocalProjectCard
            key={repoData.repository.path}
            repositoryData={repoData}
            workspace={currentWorkspace}
          />
        ))}

        {/* No results message */}
        {repositories.length === 0 && !loading && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <p style={{ margin: 0 }}>No repositories in this workspace.</p>
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
