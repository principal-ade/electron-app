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
import { GitIssuesPanel } from './components/GitIssuesPanel';
import { GitPullRequestsPanel } from './components/GitPullRequestsPanel';
import { GitDiffPanel } from './components/GitDiffPanel';
import { AlexandriaDrawingPanel } from './components/AlexandriaDrawingPanel';
import { DrawingsListPanel } from './components/DrawingsListPanel';
import { GitCommitHistoryPanel } from './components/GitCommitHistoryPanel';
import { MDXEditorPanel } from './components/MDXEditorPanel';

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

const panelRenderers: Partial<
  Record<RepositoryPanelId, RepositoryPanelRenderer>
> = {
  gitIssues: ({ context }) => (
    <GitIssuesPanel repository={context.repository ?? undefined} />
  ),
  gitPullRequests: ({ context }) => (
    <GitPullRequestsPanel repository={context.repository ?? undefined} />
  ),
  gitHistory: ({ context }) => (
    <GitCommitHistoryPanel repositoryPath={context.repositoryPath} />
  ),
  gitDiff: ({ context }) => (
    <GitDiffPanel relativeFilePath={null} repositoryPath={context.repositoryPath} />
  ),
  excalidrawEditor: () => <AlexandriaDrawingPanel />,
  drawings: () => <DrawingsListPanel />,
  mdxEditor: () => (
    <MDXEditorPanel
      filePath={null}
      onSave={(content) => {
        console.warn('Markdown saved:', content);
      }}
    />
  ),
};

export const repositoryPanelDefinitions = repositoryPanelCatalog.map(
  (definition) => ({
    ...definition,
    render: panelRenderers[definition.id],
  }),
) satisfies readonly RepositoryPanelDefinition[];
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
  const visibility = {} as Record<RepositoryPanelId, boolean>;
  const order: RepositoryPanelId[] = [];

  repositoryPanelDefinitions.forEach((definition) => {
    const shouldShow =
      surfaceSet === null
        ? true
        : definition.surfaces.some((surface) => surfaceSet.has(surface));
    visibility[definition.id] = shouldShow;
    if (shouldShow) {
      order.push(definition.id);
    }
  });

  return { visibility, order };
}
