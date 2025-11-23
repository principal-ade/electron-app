import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { DoorClosed, Plus, Edit2, Check, X, ExternalLink, Search, Trash2 } from 'lucide-react';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { WindowService } from '../../main-process-api/WindowService';
import { CreateWorkspaceModal } from '../../components/CreateWorkspaceModal';
import { DeleteWorkspaceConfirmationModal } from '../../components/DeleteWorkspaceConfirmationModal';
import { getWorkspaceThemeColor } from '../../themes/predefinedThemes';

interface WorkspacesListPanelProps {
  selectedWorkspaceId?: string | null;
  onWorkspaceSelect?: (workspace: Workspace) => void;
}

export const WorkspacesListPanel: React.FC<WorkspacesListPanelProps> = ({
  selectedWorkspaceId,
  onWorkspaceSelect,
}) => {
  const { theme } = useTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string | null>(
    null,
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceRepositories, setWorkspaceRepositories] = useState<Map<string, string[]>>(new Map());
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        setLoading(true);
        const [allWorkspaces, defaultWorkspace] = await Promise.all([
          WorkspaceService.getWorkspaces(),
          WorkspaceService.getDefaultWorkspace(),
        ]);
        setWorkspaces(allWorkspaces);
        setDefaultWorkspaceId(defaultWorkspace?.id || null);

        // Load repositories for each workspace for search functionality
        const repoMap = new Map<string, string[]>();
        await Promise.all(
          allWorkspaces.map(async (workspace) => {
            try {
              const repos = await WorkspaceService.getRepositoriesInWorkspace(workspace.id);
              repoMap.set(workspace.id, repos.map(r => r.name));
            } catch (error) {
              console.error(`Failed to load repos for workspace ${workspace.id}:`, error);
              repoMap.set(workspace.id, []);
            }
          })
        );
        setWorkspaceRepositories(repoMap);
      } catch (error) {
        console.error('Failed to load workspaces:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaces();

    // Subscribe to workspace changes
    const unsubscribe = WorkspaceService.onWorkspaceChange(() => {
      // Reload workspaces when they change
      loadWorkspaces();
    });

    return unsubscribe;
  }, []);

  // Filter and sort workspaces
  const sortedWorkspaces = useMemo(() => {
    let filtered = workspaces;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = workspaces.filter((workspace) => {
        // Search by workspace name
        if (workspace.name.toLowerCase().includes(query)) {
          return true;
        }

        // Search by repository names in this workspace
        const repos = workspaceRepositories.get(workspace.id) || [];
        return repos.some(repoName => repoName.toLowerCase().includes(query));
      });
    }

    // Sort: default workspace first, then by name alphabetically
    return [...filtered].sort((a, b) => {
      // Default workspace always first
      if (a.id === defaultWorkspaceId) return -1;
      if (b.id === defaultWorkspaceId) return 1;

      // Then sort alphabetically by name (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [workspaces, defaultWorkspaceId, searchQuery, workspaceRepositories]);

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
              Loading workspaces...
            </h3>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenWorkspaceManager = async (workspaceId: string) => {
    try {
      await WindowService.openAlexandriaWorkspace(workspaceId);
    } catch (error) {
      console.error('Failed to open Alexandria Workspace window:', error);
    }
  };

  return (
    <div style={contentContainerStyle}>
      {/* Header with search and create buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
          }}
        >
          Workspaces
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setShowSearchBox(!showSearchBox);
              if (showSearchBox) {
                setSearchQuery('');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: showSearchBox ? theme.colors.primary : theme.colors.backgroundTertiary,
              color: showSearchBox ? theme.colors.textInverse : theme.colors.text,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Search workspaces"
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.primary,
              color: theme.colors.textInverse,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Create new workspace"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Search box */}
      {showSearchBox && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by workspace or repository name..."
            autoFocus
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundTertiary,
                color: theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

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
        {/* Workspace list */}
        {sortedWorkspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.id}
            workspace={workspace}
            isSelected={workspace.id === selectedWorkspaceId}
            isDefault={workspace.id === defaultWorkspaceId}
            onClick={() => onWorkspaceSelect?.(workspace)}
            onOpenWorkspace={() => handleOpenWorkspaceManager(workspace.id)}
            onDeleteWorkspace={() => setWorkspaceToDelete(workspace)}
          />
        ))}

        {/* No results message */}
        {sortedWorkspaces.length === 0 && !loading && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <p style={{ margin: 0 }}>
              {searchQuery.trim()
                ? `No workspaces found matching "${searchQuery}"`
                : 'No workspaces found.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Delete Workspace Confirmation Modal */}
      <DeleteWorkspaceConfirmationModal
        isOpen={workspaceToDelete !== null}
        workspace={workspaceToDelete}
        onClose={() => setWorkspaceToDelete(null)}
      />
    </div>
  );
};

interface WorkspaceCardProps {
  workspace: Workspace;
  isSelected: boolean;
  isDefault: boolean;
  onClick: () => void;
  onOpenWorkspace: () => void;
  onDeleteWorkspace: () => void;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  isSelected,
  isDefault,
  onClick,
  onOpenWorkspace,
  onDeleteWorkspace,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(workspace.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedName(workspace.name);
  };

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === workspace.name) {
      setIsEditing(false);
      setEditedName(workspace.name);
      return;
    }

    try {
      setIsSaving(true);
      await WorkspaceService.updateWorkspace(workspace.id, {
        name: trimmedName,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      // Revert to original name on error
      setEditedName(workspace.name);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(false);
    setEditedName(workspace.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: isSelected
      ? theme.colors.backgroundTertiary
      : isHovered
        ? theme.colors.backgroundTertiary
        : 'transparent',
    border: `1px solid ${
      isSelected
        ? theme.colors.primary || theme.colors.border
        : isHovered
          ? theme.colors.border
          : 'transparent'
    }`,
    cursor: isEditing ? 'default' : 'pointer',
    transition: 'all 0.15s ease',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: theme.colors.text,
    fontSize: `${theme.fontSizes[2]}px`,
    fontWeight: theme.fontWeights.semibold,
    fontFamily: theme.fonts.body,
  };

  const iconColor = getWorkspaceThemeColor(workspace.theme, theme.colors.primary);

  return (
    <div
      style={cardStyle}
      onClick={isEditing ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          backgroundColor: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
          color: iconColor,
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        {workspace.icon ? (
          <span style={{ fontSize: `${theme.fontSizes[3]}px` }}>{workspace.icon}</span>
        ) : (
          <DoorClosed size={24} />
        )}
      </div>

      {/* Content column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: 0,
        }}
      >
        {/* Header row */}
        <div style={headerStyle}>
          {isEditing ? (
            <>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[2]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                title="Save (Enter)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: theme.colors.success,
                  color: theme.colors.background,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Check size={16} />
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                title="Cancel (Esc)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  color: theme.colors.text,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <span style={{ flex: 1 }}>{workspace.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWorkspace();
                }}
                title="Open workspace"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? 'auto' : 'none',
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
              >
                <ExternalLink size={16} />
              </button>
              <button
                onClick={handleStartEdit}
                title="Edit workspace name"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? 'auto' : 'none',
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
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWorkspace();
                }}
                title="Delete workspace"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? 'auto' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.error}15`;
                  e.currentTarget.style.color = theme.colors.error;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <Trash2 size={16} />
              </button>
              {isDefault && (
                <span
                  style={{
                    fontSize: `${theme.fontSizes[1]}px`,
                    color: theme.colors.textSecondary,
                    fontWeight: 400,
                  }}
                >
                  Default
                </span>
              )}
            </>
          )}
        </div>

        {/* Secondary text */}
        {(workspace.suggestedClonePath || workspace.description) && (
          <div
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              lineHeight: 1.4,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {workspace.suggestedClonePath && (
              <div
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: `${theme.fontSizes[1]}px`,
                }}
              >
                {workspace.suggestedClonePath}
              </div>
            )}
            {workspace.description && <div>{workspace.description}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export const WorkspacesListPanelPreview: React.FC = () => {
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
            backgroundColor: `color-mix(in srgb, ${theme.colors.primary} 25%, transparent)`,
          }}
        />
        <span>Workspaces</span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
          marginTop: '4px',
        }}
      >
        Browse and manage your workspaces
      </div>
    </div>
  );
};
