import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  EditableConfigurablePanelLayout,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
// CSS is bundled inline in visual-validation-panel, no separate import needed
// Note: code-city-panel CSS is bundled inline, no separate import needed
import { RepositoryPanelProvider, useRepositoryPanelProvider } from '../contexts/RepositoryPanelContext';
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { TabbedGhosttyTerminal } from '@industry-theme/ghostty-terminal-panel';
import { panels as visualValidationPanels, ConfigLibraryBrowserPanel } from '@industry-theme/visual-validation-panel';
import { panels as codeCityPanels } from '@industry-theme/code-city-panel';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { panels as alexandriaPanels } from '@industry-theme/alexandria-panels';
import { panels as localhostPanels } from '@industry-theme/localhost-panels';
import { panels as agentDrivenPanels } from '@industry-theme/agent-driven-ui-panels';
import { panels as repositoryCompositionPanels } from '@industry-theme/repository-composition-panels';
import type { Repository } from '../../shared/types/repository.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface DevWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
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
  const DocsPanelComponent = docsPanels[0]?.component;
  const DependenciesPanelComponent = alexandriaPanels.find(p => p.metadata?.name === 'Dependencies')?.component;
  const LocalhostPanelComponent = localhostPanels[0]?.component;
  const EventBusPanelComponent = agentDrivenPanels.find(p => p.metadata?.id === 'industry-theme.event-bus-panel')?.component;
  const AgentToolsPanelComponent = agentDrivenPanels.find(p => p.metadata?.id === 'industry-theme.agent-tools-panel')?.component;
  const GitChangesPanelComponent = repositoryCompositionPanels.find(p => p.metadata?.id === 'industry-theme.git-changes')?.component;

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
      {
        id: 'docs',
        label: 'Documentation',
        content: DocsPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <DocsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Documentation panel not available</div>
        ),
      },
      {
        id: 'dependencies',
        label: 'Dependencies',
        content: DependenciesPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <DependenciesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Dependencies panel not available</div>
        ),
      },
      {
        id: 'gitChanges',
        label: 'Git Changes',
        content: GitChangesPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <GitChangesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Git Changes panel not available</div>
        ),
      },
      {
        id: 'localhostBrowser',
        label: 'Localhost Browser',
        content: LocalhostPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <LocalhostPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Localhost Browser panel not available</div>
        ),
      },
      {
        id: 'localhostBrowserAlt',
        label: 'Localhost Browser (Alt)',
        content: LocalhostPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <LocalhostPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Localhost Browser panel not available</div>
        ),
      },
      {
        id: 'configLibrary',
        label: 'Config Library',
        content: (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <ConfigLibraryBrowserPanel
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ),
      },
      {
        id: 'eventBus',
        label: 'Event Bus',
        content: EventBusPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <EventBusPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Event Bus panel not available</div>
        ),
      },
      {
        id: 'agentTools',
        label: 'Agent Tools',
        content: AgentToolsPanelComponent ? (
          <div style={{
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <AgentToolsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Agent Tools panel not available</div>
        ),
      },
    ],
    [VisualValidationPanelComponent, CodeCityPanelComponent, DocsPanelComponent, DependenciesPanelComponent, GitChangesPanelComponent, LocalhostPanelComponent, EventBusPanelComponent, AgentToolsPanelComponent, context, actions, events, terminalImplementation, terminalContext, terminalDirectory],
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
        defaultSizes={{ left: 25, middle: 50, right: 25 }}
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
export const DevWorkspacePanelFramework: React.FC<
  DevWorkspacePanelFrameworkProps
> = ({
  repositoryPath,
  repository,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
}) => {

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
