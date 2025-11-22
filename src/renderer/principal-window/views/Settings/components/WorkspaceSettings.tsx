import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderOpen, Trash2, Star, Edit2, Check, X } from 'lucide-react';
import { WorkspaceService } from '../../../../main-process-api/WorkspaceService';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { predefinedThemes, getWorkspaceThemeColor } from '../../../../themes/predefinedThemes';

export const WorkspaceSettings: React.FC = () => {
  const { theme } = useTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [defaultWorkspace, setDefaultWorkspace] = useState<Workspace | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPath, setFormPath] = useState('');
  const [formTheme, setFormTheme] = useState('principalAI');

  // Load workspaces
  useEffect(() => {
    loadWorkspaces();

    // Subscribe to workspace changes
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      console.log('[WorkspaceSettings] Workspace change event:', event);
      loadWorkspaces();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadWorkspaces = async () => {
    try {
      const [allWorkspaces, defaultWs] = await Promise.all([
        WorkspaceService.getWorkspaces(),
        WorkspaceService.getDefaultWorkspace(),
      ]);
      setWorkspaces(allWorkspaces);
      setDefaultWorkspace(defaultWs);
    } catch (error) {
      console.error('[WorkspaceSettings] Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseDirectory = async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Workspace Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result && !result.canceled && result.filePaths?.[0]) {
        setFormPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('[WorkspaceSettings] Error selecting directory:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formName.trim()) {
      alert('Please enter a workspace name');
      return;
    }

    try {
      await WorkspaceService.updateWorkspace(id, {
        name: formName,
        description: formDescription || undefined,
        theme: formTheme,
        suggestedClonePath: formPath || undefined,
      });

      setEditingId(null);
      setFormName('');
      setFormDescription('');
      setFormPath('');
      setFormTheme('principalAI');
    } catch (error) {
      console.error('[WorkspaceSettings] Error updating workspace:', error);
      alert('Failed to update workspace');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workspace? Repository memberships will be removed.')) {
      return;
    }

    try {
      await WorkspaceService.deleteWorkspace(id);
    } catch (error) {
      console.error('[WorkspaceSettings] Error deleting workspace:', error);
      alert('Failed to delete workspace');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await WorkspaceService.setDefaultWorkspace(id);
    } catch (error) {
      console.error('[WorkspaceSettings] Error setting default workspace:', error);
      alert('Failed to set default workspace');
    }
  };

  const startEditing = (workspace: Workspace) => {
    setEditingId(workspace.id);
    setFormName(workspace.name);
    setFormDescription(workspace.description || '');
    setFormPath(workspace.suggestedClonePath || '');
    setFormTheme(workspace.theme || 'principalAI');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormPath('');
    setFormTheme('principalAI');
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', color: theme.colors.text }}>
        Loading workspaces...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: theme.colors.text }}>
          Workspaces
        </h3>
        <p style={{ fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }}>
          Manage your workspaces. Create new workspaces from the Workspaces panel in the FeedView.
        </p>
      </div>

      {/* Edit Form */}
      {editingId && (
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            marginBottom: '20px',
          }}
        >
          <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: theme.colors.text }}>
            Edit Workspace
          </h4>

          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: theme.colors.text }}>
              Name *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Work Projects"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: theme.colors.text }}>
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Theme */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: theme.colors.text }}>
              Theme
            </label>
            <select
              value={formTheme}
              onChange={(e) => setFormTheme(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {Object.entries(predefinedThemes).map(([key, themeInfo]) => (
                <option key={key} value={key}>
                  {themeInfo.name}
                </option>
              ))}
            </select>
            <div style={{ marginTop: '6px', fontSize: '12px', color: theme.colors.textSecondary }}>
              {predefinedThemes[formTheme]?.description}
            </div>
          </div>

          {/* Suggested Clone Path */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: theme.colors.text }}>
              Suggested Clone Path
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={formPath}
                onChange={(e) => setFormPath(e.target.value)}
                placeholder="/path/to/workspace"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: '14px',
                }}
              />
              <button
                onClick={handleBrowseDirectory}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundTertiary,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                }}
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={cancelEditing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={() => handleUpdate(editingId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: theme.colors.primary,
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <Check size={16} />
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Workspaces List */}
      {workspaces.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            borderRadius: '12px',
            border: `1px dashed ${theme.colors.border}`,
            color: theme.colors.textSecondary,
          }}
        >
          <FolderOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p style={{ fontSize: '14px', margin: 0 }}>
            No workspaces yet. Create your first workspace to get started!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                display: 'flex',
                alignItems: 'start',
                gap: '16px',
              }}
            >
              {/* Color indicator */}
              <div
                style={{
                  width: '4px',
                  height: '100%',
                  borderRadius: '2px',
                  backgroundColor: getWorkspaceThemeColor(workspace.theme, theme.colors.primary),
                  flexShrink: 0,
                }}
              />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: theme.colors.text }}>
                    {workspace.name}
                  </h4>
                  {defaultWorkspace?.id === workspace.id && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: theme.colors.warning + '20',
                        color: theme.colors.warning,
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      <Star size={12} />
                      DEFAULT
                    </div>
                  )}
                </div>

                {workspace.description && (
                  <p style={{ fontSize: '13px', color: theme.colors.textSecondary, margin: '0 0 8px 0' }}>
                    {workspace.description}
                  </p>
                )}

                {workspace.suggestedClonePath && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      margin: 0,
                      fontFamily: 'monospace',
                      opacity: 0.7,
                    }}
                  >
                    {workspace.suggestedClonePath}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {defaultWorkspace?.id !== workspace.id && (
                  <button
                    onClick={() => handleSetDefault(workspace.id)}
                    title="Set as default"
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Star size={16} />
                  </button>
                )}
                <button
                  onClick={() => startEditing(workspace)}
                  title="Edit workspace"
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(workspace.id)}
                  title="Delete workspace"
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.error,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
