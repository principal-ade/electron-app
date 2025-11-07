import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  GitBranch,
  ChevronDown,
  Plus,
  Check,
  X,
  FolderOpen,
} from 'lucide-react';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { MultiRepoWorkspace } from '../../../../shared/types/userPreferences.types';

interface FeedViewHeaderProps {
  selectedWorkspaceId: string | 'all';
  setSelectedWorkspaceId: (id: string | 'all') => void;
  workspaces: MultiRepoWorkspace[];
  setWorkspaces: (workspaces: MultiRepoWorkspace[]) => void;
}

export const FeedViewHeader: React.FC<FeedViewHeaderProps> = ({
  selectedWorkspaceId,
  setSelectedWorkspaceId,
  workspaces,
  setWorkspaces,
}) => {
  const { theme } = useTheme();
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspacePath, setNewWorkspacePath] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  // Handler for creating a new workspace
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !newWorkspacePath.trim()) {
      return;
    }

    const newWorkspace: MultiRepoWorkspace = {
      id: `workspace-${Date.now()}`,
      name: newWorkspaceName,
      path: newWorkspacePath,
      description: newWorkspaceDescription || undefined,
      isDefault: workspaces.length === 0, // First workspace becomes default
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedWorkspaces = [...workspaces, newWorkspace];
    setWorkspaces(updatedWorkspaces);

    await UserPreferencesService.updatePreferences({
      multiRepoWorkspaces: updatedWorkspaces,
      defaultMultiRepoWorkspaceId: newWorkspace.isDefault ? newWorkspace.id : undefined,
    });

    // Select the newly created workspace
    setSelectedWorkspaceId(newWorkspace.id);

    // Reset form
    setIsCreatingWorkspace(false);
    setNewWorkspaceName('');
    setNewWorkspacePath('');
    setNewWorkspaceDescription('');
  };

  // Handler for browsing workspace path
  const handleBrowseWorkspacePath = async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Workspace Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (!result || result.canceled || !result.filePaths?.[0]) {
        return;
      }

      setNewWorkspacePath(result.filePaths[0]);
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '20px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}
    >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GitBranch size={20} color={theme.colors.text} />
        <h2 style={{ fontSize: theme.fontSizes[4], fontWeight: theme.fontWeights.semibold, margin: 0 }}>
          {selectedWorkspaceId === 'all'
            ? 'All Projects'
            : workspaces.find((w) => w.id === selectedWorkspaceId)?.name || 'Projects'}
        </h2>
      </div>

      {/* Right: Workspace Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isCreatingWorkspace ? (
          <>
            {/* Workspace Dropdown - only show if workspaces exist */}
            {workspaces.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value as string | 'all')}
                  style={{
                    padding: '8px 32px 8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[1],
                    cursor: 'pointer',
                    appearance: 'none',
                    minWidth: '180px',
                  }}
                >
                  <option value="all">All Projects</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.colors.textSecondary,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            )}

            {/* Create Workspace Button */}
            <button
              onClick={() => setIsCreatingWorkspace(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: theme.colors.primary,
                border: 'none',
                borderRadius: '6px',
                color: theme.colors.background,
                cursor: 'pointer',
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              title="Create new workspace"
            >
              <Plus size={14} />
              {workspaces.length === 0 ? 'Create Workspace' : 'New Workspace'}
            </button>
          </>
        ) : (
          /* Create Workspace Form */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <input
              type="text"
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              autoFocus
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: theme.fontSizes[1],
                width: '140px',
              }}
            />
            <button
              onClick={handleBrowseWorkspacePath}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: theme.fontSizes[1],
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Browse directory"
            >
              <FolderOpen size={14} />
              {newWorkspacePath ? '✓' : 'Browse'}
            </button>
            <button
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim() || !newWorkspacePath.trim()}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: theme.colors.success,
                color: 'white',
                cursor: newWorkspaceName.trim() && newWorkspacePath.trim() ? 'pointer' : 'not-allowed',
                fontSize: theme.fontSizes[1],
                opacity: newWorkspaceName.trim() && newWorkspacePath.trim() ? 1 : 0.5,
              }}
              title="Create workspace"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setIsCreatingWorkspace(false);
                setNewWorkspaceName('');
                setNewWorkspacePath('');
                setNewWorkspaceDescription('');
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: theme.fontSizes[1],
              }}
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
