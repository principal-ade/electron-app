import React from 'react';
import type {
  RepositoryPanelActions,
  RepositoryPanelContextValue,
} from './RepositoryPanelProvider';
import {
  repositoryPanelCatalog,
  type RepositoryPanelDefinitionBase,
  type RepositoryPanelId,
  type RepositoryPanelSurface,
  type RepositoryPanelVisibility,
} from '../../shared/panels/repositoryPanelCatalog';
import { GitChangesPanel } from './components/GitChangesPanel';
import { GitIssuesPanel } from './components/GitIssuesPanel';
import { GitPullRequestsPanel } from './components/GitPullRequestsPanel';
import { ExcalidrawPanel } from './components/ExcalidrawPanel';
import { DrawingsListPanel } from './components/DrawingsListPanel';
import { ToolsPanel } from './components/ToolsPanel';
import { AgentContextTreePanel } from './components/AgentContextTreePanel';
import { GitCommitHistoryPanel } from './components/GitCommitHistoryPanel';

export interface RepositoryPanelRenderProps {
  context: RepositoryPanelContextValue;
  actions: RepositoryPanelActions;
}

type RepositoryPanelRenderer = (
  props: RepositoryPanelRenderProps,
) => React.ReactNode;

export type RepositoryPanelDefinition = RepositoryPanelDefinitionBase & {
  render?: RepositoryPanelRenderer;
};

const panelRenderers: Partial<Record<RepositoryPanelId, RepositoryPanelRenderer>> = {
  gitChanges: ({ actions }) => <GitChangesPanel onFileClick={actions.openFile} />,
  gitIssues: ({ context }) => (
    <GitIssuesPanel repository={context.repository ?? undefined} />
  ),
  gitPullRequests: ({ context }) => (
    <GitPullRequestsPanel repository={context.repository ?? undefined} />
  ),
  gitHistory: ({ context }) => (
    <GitCommitHistoryPanel repositoryPath={context.repositoryPath} />
  ),
  tools: ({ context }) => (
    <ToolsPanel
      packageLayers={context.packages}
      repositoryPath={context.repositoryPath || ''}
    />
  ),
  excalidrawEditor: () => <ExcalidrawPanel />,
  drawingsList: () => <DrawingsListPanel />,
  agentContext: ({ context, actions }) => (
    <AgentContextTreePanel
      repositoryPath={context.repositoryPath}
      onFileSelect={actions.openFile}
    />
  ),
};

export const repositoryPanelDefinitions = repositoryPanelCatalog.map(
  (definition) => ({
    ...definition,
    render: panelRenderers[definition.id],
  }),
) as const satisfies readonly RepositoryPanelDefinition[];
export type {
  RepositoryPanelVisibility,
  RepositoryPanelId,
} from '../../shared/panels/repositoryPanelCatalog';

const repositoryPanelDefinitionMap = new Map<
  RepositoryPanelId,
  RepositoryPanelDefinition
>(repositoryPanelDefinitions.map((definition) => [definition.id, definition]));

export function getRepositoryPanelsForSurface(
  surface: RepositoryPanelSurface | RepositoryPanelSurface[],
): RepositoryPanelDefinition[] {
  const surfaces = Array.isArray(surface) ? surface : [surface];
  return repositoryPanelDefinitions.filter((definition) =>
    definition.surfaces.some((panelSurface) => surfaces.includes(panelSurface)),
  );
}

export function getRepositoryPanelDefinition(
  id: RepositoryPanelId,
): RepositoryPanelDefinition {
  const definition = repositoryPanelDefinitionMap.get(id);
  if (!definition) {
    throw new Error(`Unknown repository panel definition: ${id}`);
  }
  return definition;
}

export function createDefaultPanelVisibility({
  surfaces,
}: {
  surfaces?: RepositoryPanelSurface[];
} = {}): RepositoryPanelVisibility {
  const surfaceSet = surfaces ? new Set(surfaces) : null;
  return repositoryPanelDefinitions.reduce((visibility, definition) => {
    const shouldShow =
      surfaceSet === null
        ? true
        : definition.surfaces.some((surface) => surfaceSet.has(surface));
    visibility[definition.id] = shouldShow;
    return visibility;
  }, {} as RepositoryPanelVisibility);
}
