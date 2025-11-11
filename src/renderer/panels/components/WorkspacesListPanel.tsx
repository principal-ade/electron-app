import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Folder, Layers, Plus, Edit2, Check, X } from 'lucide-react';
import type { Workspace } from '@a24z/core-library';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { CreateWorkspaceModal } from '../../components/CreateWorkspaceModal';

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
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      } catch (error) {
        console.error('Failed to load workspaces:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaces();

    // Subscribe to workspace changes
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      // Reload workspaces when they change
      loadWorkspaces();
    });

    return unsubscribe;
  }, []);

  // Sort workspaces
  const sortedWorkspaces = useMemo(() => {
    // Sort: default workspace first, then by name alphabetically
    return [...workspaces].sort((a, b) => {
      // Default workspace always first
      if (a.id === defaultWorkspaceId) return -1;
      if (b.id === defaultWorkspaceId) return 1;

      // Then sort alphabetically by name (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [workspaces, defaultWorkspaceId]);

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

  return (
    <div style={contentContainerStyle}>
      {/* Header with create button */}
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
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Create new workspace"
        >
          <Plus size={16} />
        </button>
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
        {/* Workspace list */}
        {sortedWorkspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.id}
            workspace={workspace}
            isSelected={workspace.id === selectedWorkspaceId}
            isDefault={workspace.id === defaultWorkspaceId}
            onClick={() => onWorkspaceSelect?.(workspace)}
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
            <p style={{ margin: 0 }}>No workspaces found.</p>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};

interface WorkspaceCardProps {
  workspace: Workspace;
  isSelected: boolean;
  isDefault: boolean;
  onClick: () => void;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  isSelected,
  isDefault,
  onClick,
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
      await WorkspaceService.updateWorkspace(workspace.id, { name: trimmedName });
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
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: isSelected
      ? theme.colors.backgroundTertiary
      : isHovered
      ? theme.colors.backgroundSecondary
      : 'transparent',
    border: `1px solid ${
      isSelected
        ? theme.colors.primary || theme.colors.border
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
    fontSize: `${theme.fontSizes[1]}px`,
    fontWeight: theme.fontWeights.semibold,
    fontFamily: theme.fonts.body,
  };

  const iconColor = workspace.color || theme.colors.primary || '#3b82f6';

  return (
    <div
      style={cardStyle}
      onClick={isEditing ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={headerStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            backgroundColor: `${iconColor}20`,
            color: iconColor,
          }}
        >
          {workspace.icon ? (
            <span style={{ fontSize: '12px' }}>{workspace.icon}</span>
          ) : (
            <Layers size={12} />
          )}
        </div>

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
                fontSize: `${theme.fontSizes[1]}px`,
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
                backgroundColor: theme.colors.success || '#10b981',
                color: 'white',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              <Check size={14} />
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
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1 }}>{workspace.name}</span>
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
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Edit2 size={14} />
            </button>
            {isDefault && (
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
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

      {(workspace.suggestedClonePath || workspace.description) && (
        <div
          style={{
            fontSize: `${theme.fontSizes[0]}px`,
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
            marginLeft: '28px',
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
                fontSize: `${theme.fontSizes[0] - 1}px`,
              }}
            >
              {workspace.suggestedClonePath}
            </div>
          )}
          {workspace.description && <div>{workspace.description}</div>}
        </div>
      )}
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
            backgroundColor: `${theme.colors.primary || '#3b82f6'}40`,
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
