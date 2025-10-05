import React from 'react';
import type { RepositoryPanelId, RepositoryPanelVisibility } from '../../shared/types/repositoryPanel.types';
import type {
  RepositoryPanelActions,
  RepositoryPanelContextValue,
  RepositoryPanelSlice,
} from './RepositoryPanelProvider';
import { GitChangesPanel } from './components/GitChangesPanel';

export interface RepositoryPanelRenderProps {
  context: RepositoryPanelContextValue;
  actions: RepositoryPanelActions;
}

export interface RepositoryPanelDefinition {
  id: RepositoryPanelId;
  label: string;
  description?: string;
  defaultLocation: 'left' | 'right';
  slices?: RepositoryPanelSlice[];
  render?: (props: RepositoryPanelRenderProps) => React.ReactNode;
}

export const repositoryPanelDefinitions: RepositoryPanelDefinition[] = [
  {
    id: 'gitChanges',
    label: 'Git Changes',
    description: 'Review staged, unstaged, and untracked changes for the repository.',
    defaultLocation: 'left',
    slices: ['git'],
    render: ({ actions }) => <GitChangesPanel onFileClick={actions.openFile} />,
  },
  {
    id: 'files',
    label: 'Markdown Documents',
    description: 'Recently updated markdown documentation discovered in the repository.',
    defaultLocation: 'left',
    slices: ['markdown'],
  },
  {
    id: 'gitStatus',
    label: 'Git Status',
    description: 'Branch details, upstream alignment, and the latest commit metadata.',
    defaultLocation: 'left',
    slices: ['git'],
  },
  {
    id: 'tasksAndNotes',
    label: 'Tasks & Notes',
    description: 'Project notes and TODOs captured across the repository.',
    defaultLocation: 'left',
    slices: ['markdown'],
  },
  {
    id: 'cityVisualization',
    label: 'City Visualization',
    description: 'Interactive code-city visualization derived from the repository structure.',
    defaultLocation: 'right',
    slices: ['fileTree'],
  },
  {
    id: 'actions',
    label: 'Repository Actions',
    description: 'Run project-specific automations and scripts.',
    defaultLocation: 'right',
    slices: ['fileTree'],
  },
  {
    id: 'packageInfo',
    label: 'Package Information',
    description: 'Package insights and dependency layers detected in the codebase.',
    defaultLocation: 'right',
    slices: ['packages'],
  },
];

const repositoryPanelDefinitionMap = new Map<
  RepositoryPanelId,
  RepositoryPanelDefinition
>(repositoryPanelDefinitions.map((definition) => [definition.id, definition]));

export function getRepositoryPanelDefinition(
  id: RepositoryPanelId,
): RepositoryPanelDefinition {
  const definition = repositoryPanelDefinitionMap.get(id);
  if (!definition) {
    throw new Error(`Unknown repository panel definition: ${id}`);
  }
  return definition;
}

export function createDefaultPanelVisibility(): RepositoryPanelVisibility {
  return repositoryPanelDefinitions.reduce((visibility, definition) => {
    visibility[definition.id] = true;
    return visibility;
  }, {} as RepositoryPanelVisibility);
}
