import React, { useState, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { Workspace } from '@a24z/core-library';
import { EditableConfigurablePanelLayout, PanelLayout } from '@principal-ade/panel-layouts';
import { PanelProvider, usePanelProvider } from '../contexts/PanelContext';
import { panels as terminalPanels } from '@principal-ade/industry-themed-terminal-panel';
import '@principal-ade/industry-themed-terminal-panel/dist/panels.bundle.css';
import { panels as workspacePanels } from '@a24z/alexandria-workspace-panel';

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
  const { context, actions, events } = usePanelProvider();

  // Panel layout configuration (left/middle/right)
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'workspace-repos',
    middle: 'terminal',
    right: 'details',
  });

  const [isEditMode, _setIsEditMode] = useState(false);

  // Get panel components
  const TerminalPanelComponent = terminalPanels[0]?.component;
  const WorkspacePanelComponent = workspacePanels[0]?.component;

  // Define panels
  const panels: PanelDefinition[] = useMemo(
    () => [
      {
        id: 'workspace-repos',
        label: 'Repositories',
        content: WorkspacePanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <WorkspacePanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Workspace panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: TerminalPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <TerminalPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Terminal panel not available
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
    ],
    [theme, context, actions, events, TerminalPanelComponent, WorkspacePanelComponent]
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
        id: workspace.id,
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
