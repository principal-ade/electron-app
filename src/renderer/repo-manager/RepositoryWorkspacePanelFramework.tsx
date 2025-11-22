import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelDefinitionWithContent,
} from '@a24z/panels';
import '@a24z/panels/panels.css';
import { MultiTerminalPanel } from '../panels/components/MultiTerminalPanel';
import type { Repository } from '../../shared/types/repository.types';

export interface RepositoryWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
}

/**
 * Panel Framework version of the Repository Workspace
 *
 * This is a simplified, modern panel system that uses:
 * - Registry-based panel definitions
 * - RepositoryPanelProvider for shared data/state
 * - ConfigurablePanelLayout for visual layout management
 */
export const RepositoryWorkspacePanelFramework: React.FC<
  RepositoryWorkspacePanelFrameworkProps
> = ({ repositoryPath, repository }) => {
  const { theme } = useTheme();

  // Terminal panel - the only panel we're showing initially
  const terminalPanel = useMemo(
    () => (
      <MultiTerminalPanel
        directory={repositoryPath}
        repositoryKey={repository.full_name}
        hideHeader={false}
        isVisible={true}
      />
    ),
    [repositoryPath, repository.full_name],
  );

  // Define all panels (for now just terminal in middle, empty left/right)
  const allPanels: PanelDefinitionWithContent[] = useMemo(
    () => [
      {
        id: 'terminal',
        label: 'Terminal',
        content: terminalPanel,
      },
    ],
    [terminalPanel],
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
