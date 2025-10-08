import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Layout, ChevronDown, Check, Save, RefreshCw, RotateCcw } from 'lucide-react';
import type { WorkspaceLayout } from '../../../shared/types/userPreferences.types';

interface WorkspaceSelectorProps {
  availableWorkspaces: Record<string, WorkspaceLayout>;
  currentWorkspaceId: string | null;
  onWorkspaceSelect: (workspaceId: string) => void;
  onSaveWorkspace: () => void;
  hasStateDeviation: boolean;
  onUpdateWorkspaceDefaults?: () => void;
  onResetToWorkspaceDefaults?: () => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  availableWorkspaces,
  currentWorkspaceId,
  onWorkspaceSelect,
  onSaveWorkspace,
  hasStateDeviation,
  onUpdateWorkspaceDefaults,
  onResetToWorkspaceDefaults,
}) => {
  const { theme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);

  const currentWorkspace = currentWorkspaceId
    ? availableWorkspaces[currentWorkspaceId]
    : null;

  const displayName = currentWorkspace?.name || 'Custom';
  const isCustomLayout = !currentWorkspaceId;
  const canUpdateWorkspace = currentWorkspace && !currentWorkspace.isBuiltIn;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDropdown) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  // Sort workspaces: built-in first, then custom alphabetically
  const sortedWorkspaces = Object.values(availableWorkspaces).sort((a, b) => {
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        WebkitAppRegion: 'no-drag' as any,
        position: 'relative',
      }}
    >
      {/* Workspace Selector Dropdown */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s',
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
          title={
            currentWorkspace
              ? `Workspace: ${currentWorkspace.name}${currentWorkspace.description ? ` - ${currentWorkspace.description}` : ''}`
              : 'Custom workspace layout'
          }
        >
          <Layout size={14} />
          <span>{displayName}</span>
          <ChevronDown size={12} style={{ opacity: 0.7 }} />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '250px',
              maxWidth: '400px',
              overflow: 'hidden',
            }}
          >
            {sortedWorkspaces.map((workspace) => {
              const isCurrentWorkspace = currentWorkspaceId === workspace.id;

              return (
                <button
                  key={workspace.id}
                  onClick={() => {
                    if (!isCurrentWorkspace) {
                      onWorkspaceSelect(workspace.id);
                    }
                    setShowDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: isCurrentWorkspace
                      ? theme.colors.backgroundSecondary
                      : 'transparent',
                    border: 'none',
                    cursor: isCurrentWorkspace ? 'default' : 'pointer',
                    fontSize: '13px',
                    color: theme.colors.text,
                    transition: 'background-color 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentWorkspace) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentWorkspace) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      flex: 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 500 }}>{workspace.name}</span>
                      {workspace.isBuiltIn && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            borderRadius: '4px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          Built-in
                        </span>
                      )}
                    </div>
                    {workspace.description && (
                      <span
                        style={{
                          fontSize: '11px',
                          opacity: 0.7,
                          color: theme.colors.textTertiary,
                          marginTop: '2px',
                        }}
                      >
                        {workspace.description}
                      </span>
                    )}
                  </div>
                  {isCurrentWorkspace && (
                    <Check size={14} color={theme.colors.primary} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Workspace Button - only show when layout is custom */}
      {isCustomLayout && (
        <button
          onClick={onSaveWorkspace}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s',
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
          title="Save current layout as a new workspace"
        >
          <Save size={14} />
          <span>Save Workspace</span>
        </button>
      )}

      {/* Update Workspace Button - only show when workspace has deviations and can be updated */}
      {hasStateDeviation && canUpdateWorkspace && onUpdateWorkspaceDefaults && (
        <button
          onClick={onUpdateWorkspaceDefaults}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s',
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
          title="Update workspace defaults to match current state"
        >
          <RefreshCw size={14} />
          <span>Update Workspace</span>
        </button>
      )}

      {/* Reset Button - only show when workspace has deviations */}
      {hasStateDeviation && currentWorkspaceId && onResetToWorkspaceDefaults && (
        <button
          onClick={onResetToWorkspaceDefaults}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text,
            cursor: 'pointer',
            transition: 'all 0.2s',
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
          title="Reset to workspace defaults"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
};
