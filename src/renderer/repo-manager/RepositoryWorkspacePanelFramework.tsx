import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
} from '@principal-ade/panels';
import '@principal-ade/panels/panels.css';
import { RepositoryPanelProvider, useRepositoryPanelProvider } from '../contexts/RepositoryPanelContext';
import { panels as terminalPanels } from '@industry-theme/terminal-panel';
import { panels as visualValidationPanels } from '@industry-theme/visual-validation-panel';
import type { Repository } from '../../shared/types/repository.types';

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

  // Get panel components from the panel framework packages
  const TerminalPanelComponent = terminalPanels[0]?.component;
  const VisualValidationPanelComponent = visualValidationPanels[0]?.component;

  // Define all panels using panel framework components
  const allPanels: PanelDefinitionWithContent[] = useMemo(
    () => [
      {
        id: 'terminal',
        label: 'Terminal',
        content: TerminalPanelComponent ? (
          <TerminalPanelComponent
            context={context}
            actions={actions}
            events={events}
          />
        ) : (
          <div>Terminal panel not available</div>
        ),
      },
      {
        id: 'visualValidation',
        label: 'Visual Validation',
        content: VisualValidationPanelComponent ? (
          <VisualValidationPanelComponent
            context={context}
            actions={actions}
            events={events}
          />
        ) : (
          <div>Visual Validation panel not available</div>
        ),
      },
    ],
    [TerminalPanelComponent, VisualValidationPanelComponent, context, actions, events],
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
