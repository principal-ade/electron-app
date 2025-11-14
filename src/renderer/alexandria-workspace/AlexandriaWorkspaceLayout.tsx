import React, { useState, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { Workspace } from '@a24z/core-library';
import { EditableConfigurablePanelLayout, PanelLayout } from '@principal-ade/panel-layouts';
import { PanelProvider, usePanelProvider } from '../contexts/PanelContext';

type PanelDefinition = {
  id: string;
  label: string;
  content: React.ReactNode;
};

interface AlexandriaWorkspaceLayoutProps {
  workspace: Workspace;
  repository?: {
    name: string;
    path: string;
    branch?: string;
  };
}

/**
 * Content component that uses panel context
 */
const AlexandriaWorkspaceLayoutContent: React.FC = () => {
  const { theme } = useTheme();
  const _context = usePanelProvider();

  // Panel layout configuration (left/middle/right)
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'workspace-repos',
    middle: 'content-viewer',
    right: 'details',
  });

  const [isEditMode, _setIsEditMode] = useState(false);

  // Define panels
  const panels: PanelDefinition[] = useMemo(
    () => [
      {
        id: 'workspace-repos',
        label: 'Repositories',
        content: (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
            }}
          >
            <h3
              style={{
                marginBottom: '12px',
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
              }}
            >
              Workspace Repositories
            </h3>
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Repository list panel will go here
            </p>
          </div>
        ),
      },
      {
        id: 'content-viewer',
        label: 'Content',
        content: (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
            }}
          >
            <h3
              style={{
                marginBottom: '12px',
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
              }}
            >
              Content Viewer
            </h3>
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Main content panel will go here
            </p>
          </div>
        ),
      },
      {
        id: 'details',
        label: 'Details',
        content: (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
            }}
          >
            <h3
              style={{
                marginBottom: '12px',
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
              }}
            >
              Details
            </h3>
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Details panel will go here
            </p>
          </div>
        ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
            }}
          >
            <h3
              style={{
                marginBottom: '12px',
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
              }}
            >
              Terminal
            </h3>
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Terminal panel will go here
            </p>
          </div>
        ),
      },
    ],
    [theme]
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        overflow: 'hidden',
      }}
    >
      <EditableConfigurablePanelLayout
        theme={theme}
        panels={panels}
        layout={layout}
        isEditMode={isEditMode}
        onLayoutChange={setLayout}
        defaultSizes={{ left: 25, middle: 50, right: 25 }}
        minSizes={{ left: 15, middle: 30, right: 20 }}
        collapsiblePanels={{ left: true, right: true }}
        showCollapseButtons={false}
      />
    </div>
  );
};

/**
 * Alexandria Workspace Layout Component
 * Similar to web-ade's EditorLayout but for workspace management
 */
export const AlexandriaWorkspaceLayout: React.FC<
  AlexandriaWorkspaceLayoutProps
> = ({ workspace, repository }) => {
  const { theme } = useTheme();

  return (
    <PanelProvider
      workspace={{
        name: workspace.name,
        path: workspace.suggestedClonePath || '/workspace',
      }}
      repository={repository}
      theme={theme}
    >
      <AlexandriaWorkspaceLayoutContent />
    </PanelProvider>
  );
};
