/**
 * Workspace Dependency Graph Service
 * Builds cross-repository dependency graphs scoped to repositories within a Workspace
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  buildDependencyGraphs,
  type DependencyGraph,
} from './DependencyGraphService';
import type { RepositoryCacheData } from './RepositoryDataCache';

/**
 * Build dependency graph for repositories within a specific Workspace
 * @param workspaceRepositories - Repositories that belong to the workspace
 * @param allRepositoryData - All repository cache data (for looking up packages)
 * @returns A single DependencyGraph showing how repos in the workspace depend on each other
 */
export function buildWorkspaceDependencyGraph(
  workspaceRepositories: AlexandriaEntry[],
  allRepositoryData: Map<string, RepositoryCacheData>,
): DependencyGraph | null {
  if (workspaceRepositories.length === 0) {
    return null;
  }

  // Get repository paths in the workspace
  const workspaceRepoPaths = new Set(
    workspaceRepositories.map((repo) => repo.path),
  );

  // Filter repository data to only include workspace repos
  const workspaceRepoData: RepositoryCacheData[] = [];
  workspaceRepoPaths.forEach((path) => {
    const repoData = allRepositoryData.get(path);
    if (repoData) {
      workspaceRepoData.push(repoData);
    }
  });

  if (workspaceRepoData.length === 0) {
    return null;
  }

  // Use existing buildDependencyGraphs but only with workspace repos
  const graphs = buildDependencyGraphs(workspaceRepoData);

  // If there's only one graph, return it
  // If there are multiple disconnected clusters, merge them into one graph
  if (graphs.length === 0) {
    return null;
  }

  if (graphs.length === 1) {
    return graphs[0];
  }

  // Merge multiple graphs into one
  return mergeGraphs(graphs, workspaceRepositories);
}

/**
 * Merge multiple dependency graphs into a single graph
 */
function mergeGraphs(
  graphs: DependencyGraph[],
  workspaceRepositories: AlexandriaEntry[],
): DependencyGraph {
  const allNodes = graphs.flatMap((g) => g.nodes);
  const allEdges = graphs.flatMap((g) => g.edges);

  // Get all top-level repos across graphs
  const allTopLevelRepos = Array.from(
    new Set(graphs.flatMap((g) => g.metadata.topLevelRepositories)),
  );

  // Check if any repo is a monorepo
  const isMonorepo = graphs.some((g) => g.metadata.isMonorepo);

  // Count external dependencies
  const externalDeps = new Set(
    allNodes.filter((n) => n.type === 'external').map((n) => n.id),
  );

  // Generate workspace name from first few repos
  const repoNames = workspaceRepositories
    .slice(0, 3)
    .map((r) => r.name)
    .sort();
  const workspaceName =
    repoNames.length === 1
      ? repoNames[0]
      : repoNames.length === 2
        ? `${repoNames[0]} & ${repoNames[1]}`
        : `${repoNames[0]} & ${workspaceRepositories.length - 1} others`;

  return {
    id: workspaceRepositories.map((r) => r.path).sort().join('::'),
    name: workspaceName,
    nodes: allNodes,
    edges: allEdges,
    metadata: {
      topLevelRepositories: allTopLevelRepos,
      totalRepositories: workspaceRepositories.length,
      totalExternalDependencies: externalDeps.size,
      isMonorepo,
      lastUpdated: Date.now(),
    },
  };
}

/**
 * Build a simplified workspace graph showing only direct repository relationships
 * (excludes external dependencies for cleaner visualization)
 */
export function buildSimplifiedWorkspaceGraph(
  workspaceRepositories: AlexandriaEntry[],
  allRepositoryData: Map<string, RepositoryCacheData>,
): DependencyGraph | null {
  const fullGraph = buildWorkspaceDependencyGraph(
    workspaceRepositories,
    allRepositoryData,
  );

  if (!fullGraph) {
    return null;
  }

  // Filter out external nodes and their edges
  const internalNodes = fullGraph.nodes.filter((n) => n.type === 'repository');
  const internalNodeIds = new Set(internalNodes.map((n) => n.id));
  const internalEdges = fullGraph.edges.filter(
    (e) => internalNodeIds.has(e.source) && internalNodeIds.has(e.target),
  );

  return {
    ...fullGraph,
    nodes: internalNodes,
    edges: internalEdges,
    metadata: {
      ...fullGraph.metadata,
      totalExternalDependencies: 0,
    },
  };
}
