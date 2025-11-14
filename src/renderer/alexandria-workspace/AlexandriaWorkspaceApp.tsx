import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { Workspace } from '@a24z/core-library';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { AlexandriaWorkspaceTitlebar } from '../components/Titlebar';

/**
 * Alexandria Workspace Window
 *
 * This window provides a dedicated interface for managing a single workspace
 * and its repository members.
 */
export const AlexandriaWorkspaceApp: React.FC = () => {
  const { theme } = useTheme();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const unsubscribe = WorkspaceService.onWorkspaceChange(() => {
      loadWorkspace();
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
      <AlexandriaWorkspaceTitlebar workspace={workspace} />

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
          }}
        >
          <div
            style={{
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              padding: '24px',
            }}
          >
            <h2
              style={{
                marginBottom: '16px',
                fontSize: `${theme.fontSizes[4]}px`,
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
              }}
            >
              Workspace Details
            </h2>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div
                style={{
                  borderRadius: '6px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  padding: '16px',
                }}
              >
                <h3
                  style={{
                    marginBottom: '8px',
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.primary,
                    fontSize: `${theme.fontSizes[2]}px`,
                  }}
                >
                  Workspace Information:
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: `${theme.fontSizes[1]}px`,
                  }}
                >
                  <div style={{ color: theme.colors.text }}>
                    <span style={{ color: theme.colors.textSecondary }}>
                      ID:
                    </span>{' '}
                    <span style={{ fontFamily: theme.fonts.monospace }}>
                      {workspace.id}
                    </span>
                  </div>
                  {workspace.suggestedClonePath && (
                    <div style={{ color: theme.colors.text }}>
                      <span style={{ color: theme.colors.textSecondary }}>
                        Suggested Clone Path:
                      </span>{' '}
                      <span style={{ fontFamily: theme.fonts.monospace }}>
                        {workspace.suggestedClonePath}
                      </span>
                    </div>
                  )}
                  <div style={{ color: theme.colors.text }}>
                    <span style={{ color: theme.colors.textSecondary }}>
                      Created:
                    </span>{' '}
                    {new Date(workspace.createdAt).toLocaleString()}
                  </div>
                  <div style={{ color: theme.colors.text }}>
                    <span style={{ color: theme.colors.textSecondary }}>
                      Updated:
                    </span>{' '}
                    {new Date(workspace.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.warning}`,
                  backgroundColor: `${theme.colors.warning}20`,
                  padding: '16px',
                }}
              >
                <h3
                  style={{
                    marginBottom: '8px',
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.warning,
                    fontSize: `${theme.fontSizes[2]}px`,
                  }}
                >
                  Implementation Status:
                </h3>
                <p
                  style={{
                    fontSize: `${theme.fontSizes[1]}px`,
                    color: theme.colors.text,
                  }}
                >
                  This window is now tied to a single workspace. Next steps:
                </p>
                <ol
                  style={{
                    marginTop: '8px',
                    paddingLeft: '20px',
                    fontSize: `${theme.fontSizes[1]}px`,
                    lineHeight: 1.6,
                    color: theme.colors.text,
                  }}
                >
                  <li>Display repository members of this workspace</li>
                  <li>Add UI to add/remove repositories from workspace</li>
                  <li>Add workspace editing capabilities</li>
                  <li>Add repository filtering and search</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
