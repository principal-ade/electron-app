import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelLayout } from '@principal-ade/panel-layouts';
import type { Workspace, AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { AlexandriaWorkspaceTitlebar } from '../components/Titlebar';
import { AlexandriaWorkspaceLayout } from './AlexandriaWorkspaceLayout';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';

/**
 * Alexandria Workspace Window Content
 *
 * This component handles the workspace data loading and rendering.
 */
const AlexandriaWorkspaceContent: React.FC = () => {
  const { theme } = useTheme();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceRepositories, setWorkspaceRepositories] = useState<AlexandriaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(false);
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'workspace-repos',
    middle: 'terminal',
    right: 'alexandria-docs',
  });

  // Switch handlers for panel swapping
  const handleSwitchLeftMiddle = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      left: prev.middle,
      middle: prev.left,
    }));
  }, []);

  const handleSwitchRightMiddle = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      right: prev.middle,
      middle: prev.right,
    }));
  }, []);

  useEffect(() => {
    // Get workspace ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspaceId');

    if (!workspaceId) {
      setError('No workspace ID provided');
      setLoading(false);
      return;
    }

    // Load workspace data
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const workspaces = await WorkspaceService.getWorkspaces();
        const foundWorkspace = workspaces.find((w) => w.id === workspaceId);

        if (!foundWorkspace) {
          setError('Workspace not found');
        } else {
          setWorkspace(foundWorkspace);

          // Load workspace repositories
          try {
            const repos = await WorkspaceService.getRepositoriesInWorkspace(foundWorkspace.id);
            setWorkspaceRepositories(repos);
          } catch (repoErr) {
            console.error('[AlexandriaWorkspaceApp] Error loading repositories:', repoErr);
            setWorkspaceRepositories([]);
          }
        }
      } catch (err) {
        console.error('[AlexandriaWorkspaceApp] Error loading workspace:', err);
        setError('Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();

    // Subscribe to workspace changes
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      console.info('[AlexandriaWorkspaceApp] Workspace change event received:', event);

      // Only reload workspace metadata for 'updated' events
      // 'membership-changed' is handled by PanelContext
      // 'deleted' would close the window anyway
      // 'added' doesn't apply to this workspace
      if (event.type === 'updated' && event.workspaceId === workspaceId) {
        console.info('[AlexandriaWorkspaceApp] Workspace metadata updated, reloading');
        loadWorkspace();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              marginBottom: '16px',
              fontSize: `${theme.fontSizes[3]}px`,
            }}
          >
            Loading workspace...
          </div>
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        <div
          style={{
            borderRadius: '8px',
            border: `1px solid ${theme.colors.error}`,
            backgroundColor: `${theme.colors.error}20`,
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              marginBottom: '8px',
              fontSize: `${theme.fontSizes[4]}px`,
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.error,
            }}
          >
            Error
          </h2>
          <p style={{ color: theme.colors.text }}>
            {error || 'Workspace not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Custom Titlebar */}
      <AlexandriaWorkspaceTitlebar
        workspace={workspace}
        workspaceRepositoryIds={workspaceRepositories
          .map(entry => entry.github?.id)
          .filter((id): id is string => id != null)
        }
        enableKeyboardShortcuts={enableKeyboardShortcuts}
        onToggleKeyboardShortcuts={() => setEnableKeyboardShortcuts(!enableKeyboardShortcuts)}
        collapsed={collapsed}
        onToggleLeftSidebar={() => setCollapsed(prev => ({ ...prev, left: !prev.left }))}
        onToggleRightSidebar={() => setCollapsed(prev => ({ ...prev, right: !prev.right }))}
        onSwitchLeftMiddlePanels={handleSwitchLeftMiddle}
        onSwitchRightMiddlePanels={handleSwitchRightMiddle}
      />

      {/* Main Content - Panel Layout */}
      <AlexandriaWorkspaceLayout
        workspace={workspace}
        enableKeyboardShortcuts={enableKeyboardShortcuts}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        layout={layout}
        onLayoutChange={setLayout}
      />
    </div>
  );
};

/**
 * Alexandria Workspace Window
 *
 * This window provides a dedicated interface for managing a single workspace
 * and its repository members.
 */
export const AlexandriaWorkspaceApp: React.FC = () => {
  const [workspaceTheme, setWorkspaceTheme] = useState<string | undefined>(undefined);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);

  useEffect(() => {
    // Get workspace ID from URL and load its theme
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspaceId');

    if (!workspaceId) {
      setIsLoadingWorkspace(false);
      return;
    }

    const loadWorkspaceTheme = async () => {
      try {
        const workspaces = await WorkspaceService.getWorkspaces();
        const workspace = workspaces.find((w) => w.id === workspaceId);

        if (workspace?.theme) {
          setWorkspaceTheme(workspace.theme);
        }
      } catch (error) {
        console.error('[AlexandriaWorkspaceApp] Error loading workspace theme:', error);
      } finally {
        setIsLoadingWorkspace(false);
      }
    };

    loadWorkspaceTheme();

    // Subscribe to workspace changes to update theme if workspace is edited
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      // Check both event.workspaceId and event.workspace?.id since the event
      // structure varies depending on the event type
      const eventWorkspaceId = event.workspaceId || event.workspace?.id;
      if (event.type === 'updated' && eventWorkspaceId === workspaceId) {
        loadWorkspaceTheme();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Show minimal loading state while determining workspace theme
  if (isLoadingWorkspace) {
    return null; // Or a minimal loading spinner
  }

  return (
    <CustomThemeProvider workspaceThemeName={workspaceTheme}>
      <GlobalFeedbackProvider>
        <AlexandriaWorkspaceContent />
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};
