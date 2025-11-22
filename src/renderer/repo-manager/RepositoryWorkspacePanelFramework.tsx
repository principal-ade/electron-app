import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import { PanelProvider, usePanelProvider } from '../contexts/PanelContext';
import { panels as terminalPanels } from '@industry-theme/terminal-panel';
import '@industry-theme/terminal-panel/dist/panels.bundle.css';
import type { Repository } from '../../shared/types/repository.types';

export interface RepositoryWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
}

/**
 * Inner component that uses PanelProvider context
 */
const RepositoryWorkspacePanelFrameworkInner: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = usePanelProvider();

  // Get terminal panel component from the panel framework package
  const TerminalPanelComponent = terminalPanels[0]?.component;

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
    ],
    [TerminalPanelComponent, context, actions, events],
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
            panels: [], // Empty - will be collapsed
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
        defaultSizes={{ left: 20, middle: 60, right: 20 }}
        minSizes={{ left: 15, middle: 30, right: 15 }}
        collapsed={{
          left: true,  // Start collapsed
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
> = ({ repositoryPath, repository: _repository }) => {
  return (
    <PanelProvider repositoryPath={repositoryPath}>
      <RepositoryWorkspacePanelFrameworkInner />
    </PanelProvider>
  );
};
