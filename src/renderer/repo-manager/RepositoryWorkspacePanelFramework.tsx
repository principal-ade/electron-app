import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
} from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import '@industry-theme/visual-validation-panel/dist/panels.bundle.css';
import { RepositoryPanelProvider, useRepositoryPanelProvider } from '../contexts/RepositoryPanelContext';
import { TabbedTerminalPanel } from '@industry-theme/terminal-panel';
import { TabbedGhosttyTerminal } from '@industry-theme/ghostty-terminal-panel';
import { panels as visualValidationPanels } from '@industry-theme/visual-validation-panel';
import type { Repository } from '../../shared/types/repository.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface RepositoryWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
}

/**
 * Inner component that uses RepositoryPanelProvider context
 */
const RepositoryWorkspacePanelFrameworkInner: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useRepositoryPanelProvider();

  // Load terminal implementation preference (default to ghostty for testing)
  const [terminalImplementation, setTerminalImplementation] = useState<'industry-themed' | 'ghostty'>('ghostty');

  useEffect(() => {
    const loadPreference = async () => {
      const prefs = await UserPreferencesService.getPreferences();
      // Default to 'ghostty' if not set
      setTerminalImplementation(prefs.terminalImplementation ?? 'ghostty');
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

  // Define all panels using panel framework components
  const allPanels: PanelDefinitionWithContent[] = useMemo(
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
    ],
    [VisualValidationPanelComponent, context, actions, events, terminalImplementation, terminalContext, terminalDirectory],
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
      <ConfigurablePanelLayout
        panels={allPanels}
        layout={{
          left: {
            type: 'tabs',
            panels: ['visualValidation'],
            config: {
              defaultActiveTab: 0,
              tabPosition: 'top',
            },
          },
          middle: {
            type: 'tabs',
            panels: ['terminal'],
            config: {
              defaultActiveTab: 0,
              tabPosition: 'top',
            },
          },
          right: {
            type: 'tabs',
            panels: [], // Empty - will be collapsed
            config: {
              defaultActiveTab: 0,
              tabPosition: 'top',
            },
          },
        }}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={{ left: 30, middle: 50, right: 20 }}
        minSizes={{ left: 15, middle: 30, right: 15 }}
        collapsed={{
          left: false,  // Show visual validation panel
          right: true, // Start collapsed
        }}
        showCollapseButtons={true}
        theme={theme}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};

/**
 * Panel Framework version of the Repository Workspace
 *
 * This is a simplified, modern panel system that uses:
 * - Panel framework components from @industry-theme packages
 * - PanelProvider for shared context, actions, and events
 * - ConfigurablePanelLayout for visual layout management
 */
export const RepositoryWorkspacePanelFramework: React.FC<
  RepositoryWorkspacePanelFrameworkProps
> = ({ repositoryPath, repository }) => {
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
      <RepositoryWorkspacePanelFrameworkInner />
    </RepositoryPanelProvider>
  );
};
