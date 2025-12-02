import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  EditableConfigurablePanelLayout,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
import '@industry-theme/visual-validation-panel/dist/panels.bundle.css';
// Note: code-city-panel CSS is bundled inline, no separate import needed
import { RepositoryPanelProvider, useRepositoryPanelProvider } from '../contexts/RepositoryPanelContext';
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { TabbedGhosttyTerminal } from '@industry-theme/ghostty-terminal-panel';
import { panels as visualValidationPanels } from '@industry-theme/visual-validation-panel';
import { panels as codeCityPanels } from '@industry-theme/code-city-panel';
import type { Repository } from '../../shared/types/repository.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface DevWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
  /**
   * External collapsed state (controlled from titlebar)
   */
  collapsed?: { left: boolean; right: boolean };
  /**
   * Callback when collapsed state changes
   */
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  /**
   * External layout state (controlled from titlebar for switch operations)
   */
  layout?: PanelLayout;
  /**
   * Callback when layout changes
   */
  onLayoutChange?: (layout: PanelLayout) => void;
}

interface DevWorkspacePanelFrameworkInnerProps {
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
}

/**
 * Inner component that uses RepositoryPanelProvider context
 */
const DevWorkspacePanelFrameworkInner: React.FC<DevWorkspacePanelFrameworkInnerProps> = ({
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
}) => {
  const { theme } = useTheme();
  const { context, actions, events } = useRepositoryPanelProvider();

  // Load terminal implementation preference (default to xterm)
  const [terminalImplementation, setTerminalImplementation] = useState<'xterm' | 'ghostty'>('xterm');

  useEffect(() => {
    const loadPreference = async () => {
      const prefs = await UserPreferencesService.getPreferences();
      // Default to 'xterm' if not set
      setTerminalImplementation(prefs.terminalImplementation ?? 'xterm');
    };
    loadPreference();

    // Subscribe to preference updates so terminal switches when toggle is clicked
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      if (prefs.terminalImplementation) {
        setTerminalImplementation(prefs.terminalImplementation);
      }
    });

    return unsubscribe;
  }, []);

  // Get required props for tabbed terminal panels
  const terminalContext = (context as { terminalContext?: string }).terminalContext || 'terminal:default';
  const terminalDirectory = (context as { repositoryPath?: string }).repositoryPath || '/';

  const VisualValidationPanelComponent = visualValidationPanels[0]?.component;
  const CodeCityPanelComponent = codeCityPanels[0]?.component;

  // Define all panels using panel framework components
  const allPanels = useMemo(
    () => [
      {
        id: 'terminal',
        label: 'Terminal',
        content: terminalImplementation === 'ghostty' ? (
          <TabbedGhosttyTerminal
            context={context}
            actions={actions}
            events={events}
            terminalContext={terminalContext}
            directory={terminalDirectory}
          />
        ) : (
          <TabbedTerminalPanel
            context={context}
            actions={actions}
            events={events}
            terminalContext={terminalContext}
            directory={terminalDirectory}
          />
        ),
      },
      {
        id: 'visualValidation',
        label: 'Visual Validation',
        content: VisualValidationPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <VisualValidationPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Visual Validation panel not available</div>
        ),
      },
      {
        id: 'codeCity',
        label: 'Code City',
        content: CodeCityPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <CodeCityPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Code City panel not available</div>
        ),
      },
    ],
    [VisualValidationPanelComponent, CodeCityPanelComponent, context, actions, events, terminalImplementation, terminalContext, terminalDirectory],
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
      }}
    >
      <EditableConfigurablePanelLayout
        panels={allPanels}
        layout={layout}
        onLayoutChange={onLayoutChange}
        isEditMode={false}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={{ left: 30, middle: 50, right: 20 }}
        minSizes={{ left: 15, middle: 30, right: 15 }}
        collapsed={collapsed}
        showCollapseButtons={false}
        theme={theme}
      />
    </div>
  );
};

/**
 * Panel Framework for Dev Workspace
 *
 * This is a simplified, modern panel system that uses:
 * - Panel framework components from @industry-theme packages
 * - PanelProvider for shared context, actions, and events
 * - ConfigurablePanelLayout for visual layout management
 */
// Default layout configuration
const DEFAULT_LAYOUT: PanelLayout = {
  left: 'visualValidation',
  middle: 'terminal',
  right: 'codeCity',
};

export const DevWorkspacePanelFramework: React.FC<
  DevWorkspacePanelFrameworkProps
> = ({
  repositoryPath,
  repository,
  collapsed: externalCollapsed,
  onCollapsedChange: externalOnCollapsedChange,
  layout: externalLayout,
  onLayoutChange: externalOnLayoutChange,
}) => {
  // Internal collapsed state (used when not controlled externally)
  const [internalCollapsed, setInternalCollapsed] = useState({
    left: false,  // Show visual validation panel
    right: false, // Show code city panel
  });

  // Internal layout state (used when not controlled externally)
  const [internalLayout, setInternalLayout] = useState<PanelLayout>(DEFAULT_LAYOUT);

  // Use external state if provided, otherwise use internal
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onCollapsedChange = useCallback(
    (newCollapsed: { left: boolean; right: boolean }) => {
      if (externalOnCollapsedChange) {
        externalOnCollapsedChange(newCollapsed);
      } else {
        setInternalCollapsed(newCollapsed);
      }
    },
    [externalOnCollapsedChange]
  );

  const layout = externalLayout ?? internalLayout;
  const onLayoutChange = useCallback(
    (newLayout: PanelLayout) => {
      if (externalOnLayoutChange) {
        externalOnLayoutChange(newLayout);
      } else {
        setInternalLayout(newLayout);
      }
    },
    [externalOnLayoutChange]
  );

  // Use the same terminal context format as legacy MultiTerminalPanel
  // Legacy uses: terminal:${owner}/${name}
  // This ensures terminal sessions are shared when switching between classic and panel framework modes
  const terminalContext = useMemo(
    () => `terminal:${repository.owner}/${repository.name}`,
    [repository.owner, repository.name],
  );

  // Convert Repository to RepositoryMetadata for panel framework
  const repositoryMetadata = useMemo(
    () => ({
      id: `${repository.owner}/${repository.name}`,
      name: repository.name,
      path: repositoryPath,
      owner: repository.owner,
    }),
    [repository.owner, repository.name, repositoryPath],
  );

  return (
    <RepositoryPanelProvider
      repositoryPath={repositoryPath}
      repository={repositoryMetadata}
      terminalContext={terminalContext}
    >
      <DevWorkspacePanelFrameworkInner
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        layout={layout}
        onLayoutChange={onLayoutChange}
      />
    </RepositoryPanelProvider>
  );
};
