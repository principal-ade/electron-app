/**
 * Graph data builder - Analyzes cross-repository dependencies and clusters
 */

import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { RepositoryCacheData } from '../../../services/RepositoryDataCache';

/**
 * Graph node representing a repository or external dependency
 */
export interface GraphNode {
  id: string;
  name: string;
  type: 'repository' | 'external';
  repositoryPath?: string; // For repository nodes
  version?: string; // For external dependencies
  packageNames: string[]; // All package names from this repo
}

/**
 * Graph edge representing a dependency relationship
 */
export interface GraphEdge {
  source: string; // node id (repository)
  target: string; // node id (repository or external)
  dependencies: {
    packageName: string; // Which package in source depends on target
    versionRange: string;
    type: 'dependency' | 'devDependency' | 'peerDependency';
  }[];
}

/**
 * Complete dependency graph for a cluster of repositories
 */
export interface DependencyGraph {
  id: string; // cluster id based on top-level repos
  name: string; // human-readable name based on top-level repos
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    topLevelRepositories: string[]; // Repos with no incoming edges from cluster
    totalRepositories: number;
    totalExternalDependencies: number;
    isMonorepo: boolean; // True if any repo in cluster is a monorepo
    lastUpdated: number;
  };
}

/**
 * Repository node in the dependency analysis
 */
interface RepositoryNode {
  repoPath: string;
  repoName: string;
  packageNames: string[]; // All packages exported by this repo
  dependencies: Map<string, string[]>; // depName -> list of packages that depend on it
  isMonorepo: boolean;
}

/**
 * Build dependency graphs from all repositories
 * Returns one graph per cluster of connected repositories
 */
export function buildDependencyGraphs(
  allRepos: RepositoryCacheData[],
): DependencyGraph[] {
  // Step 1: Build repository nodes with their package names
  const repoNodes = buildRepositoryNodes(allRepos);

  // Step 2: Create repository lookup by package name
  const packageToRepo = buildPackageToRepoMap(repoNodes);

  // Step 3: Analyze cross-repository dependencies
  const repoDependencies = analyzeCrossRepoDependencies(
    allRepos,
    repoNodes,
    packageToRepo,
  );

  // Step 4: Find clusters (connected components)
  const clusters = findConnectedClusters(repoNodes, repoDependencies);

  // Step 5: Build a graph for each cluster
  const graphs = clusters.map((cluster) =>
    buildGraphForCluster(cluster, repoNodes, repoDependencies, packageToRepo),
  );

  return graphs;
}

/**
 * Build repository nodes with package information
 */
function buildRepositoryNodes(
  allRepos: RepositoryCacheData[],
): Map<string, RepositoryNode> {
  const nodes = new Map<string, RepositoryNode>();

  allRepos.forEach((repo) => {
    if (!repo.packages || repo.packages.length === 0) {
      return; // Skip repos without packages
    }

    const packageNames = repo.packages
      .map((pkg) => pkg.packageData.name)
      .filter((name) => name); // Filter out empty names

    nodes.set(repo.repository.path as string, {
      repoPath: repo.repository.path as string,
      repoName: repo.repository.name,
      packageNames,
      dependencies: new Map(),
      isMonorepo: repo.packageSummary?.isMonorepo || false,
    });
  });

  return nodes;
}

/**
 * Build a map from package name to repository path
 */
function buildPackageToRepoMap(
  repoNodes: Map<string, RepositoryNode>,
): Map<string, string> {
  const map = new Map<string, string>();

  repoNodes.forEach((node, repoPath) => {
    node.packageNames.forEach((pkgName) => {
      map.set(pkgName, repoPath);
    });
  });

  return map;
}

/**
 * Analyze dependencies between repositories
 * Returns Map<sourceRepo, Set<targetRepo>>
 */
function analyzeCrossRepoDependencies(
  allRepos: RepositoryCacheData[],
  repoNodes: Map<string, RepositoryNode>,
  packageToRepo: Map<string, string>,
): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();

  allRepos.forEach((repo) => {
    const repoPath = repo.repository.path as string;

    if (!repo.packages || repo.packages.length === 0) {
      return;
    }

    const deps = new Set<string>();

    // Check all packages in this repo
    repo.packages.forEach((pkg) => {
      // Check all dependency types
      const allDeps = [
        ...Object.keys(pkg.packageData.dependencies || {}),
        ...Object.keys(pkg.packageData.devDependencies || {}),
        ...Object.keys(pkg.packageData.peerDependencies || {}),
      ];

      allDeps.forEach((depName) => {
        const targetRepo = packageToRepo.get(depName);
        if (targetRepo && targetRepo !== repoPath) {
          // This is a cross-repo dependency!
          deps.add(targetRepo);
        }
      });
    });

    if (deps.size > 0) {
      dependencies.set(repoPath, deps);
    }
  });

  return dependencies;
}

/**
 * Find connected clusters using Union-Find algorithm
 */
function findConnectedClusters(
  repoNodes: Map<string, RepositoryNode>,
  dependencies: Map<string, Set<string>>,
): string[][] {
  const parent = new Map<string, string>();

  // Initialize: each repo is its own parent
  repoNodes.forEach((_, repoPath) => {
    parent.set(repoPath, repoPath);
  });

  // Find with path compression
  function find(repo: string): string {
    if (parent.get(repo) !== repo) {
      parent.set(repo, find(parent.get(repo)!));
    }
    return parent.get(repo)!;
  }

  // Union two repos
  function union(repo1: string, repo2: string): void {
    const root1 = find(repo1);
    const root2 = find(repo2);
    if (root1 !== root2) {
      parent.set(root2, root1);
    }
  }

  // Unite all connected repos (bidirectional connection = same cluster)
  dependencies.forEach((targets, source) => {
    targets.forEach((target) => {
      union(source, target);
    });
  });

  // Group repos by their root
  const clusters = new Map<string, string[]>();
  repoNodes.forEach((_, repoPath) => {
    const root = find(repoPath);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)!.push(repoPath);
  });

  return Array.from(clusters.values());
}

/**
 * Build a dependency graph for a cluster
 */
function buildGraphForCluster(
  cluster: string[],
  repoNodes: Map<string, RepositoryNode>,
  repoDependencies: Map<string, Set<string>>,
  packageToRepo: Map<string, string>,
): DependencyGraph {
  const clusterSet = new Set(cluster);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const externalDeps = new Map<string, GraphNode>(); // Track unique external deps

  // Track incoming edges to identify top-level repos
  const incomingEdges = new Set<string>();

  // Build nodes for repositories in cluster
  cluster.forEach((repoPath) => {
    const repoNode = repoNodes.get(repoPath)!;
    nodes.push({
      id: repoPath,
      name: repoNode.repoName,
      type: 'repository',
      repositoryPath: repoPath,
      packageNames: repoNode.packageNames,
    });
  });

  // Build edges and collect external dependencies
  cluster.forEach((sourceRepo) => {
    const sourceNode = repoNodes.get(sourceRepo)!;
    const deps = repoDependencies.get(sourceRepo);

    if (!deps) return;

    // Group dependencies by target repo
    const depsToRepo = new Map<string, { packageName: string; versionRange: string; type: string }[]>();

    // Get all packages and their dependencies
    deps.forEach((targetRepo) => {
      if (clusterSet.has(targetRepo)) {
        // Internal cluster dependency
        incomingEdges.add(targetRepo);

        // Find which packages depend on this repo
        // (We'd need the actual package data here - simplified for now)
        if (!depsToRepo.has(targetRepo)) {
          depsToRepo.set(targetRepo, []);
        }
      }
    });

    // Create edges for internal dependencies
    depsToRepo.forEach((depList, targetRepo) => {
      edges.push({
        source: sourceRepo,
        target: targetRepo,
        dependencies: depList.map(d => ({
          packageName: d.packageName,
          versionRange: d.versionRange,
          type: d.type as 'dependency' | 'devDependency' | 'peerDependency',
        })),
      });
    });
  });

  // Add external dependency nodes (dependencies outside the cluster)
  // This requires iterating through actual package dependencies
  // For now, we'll skip external deps and focus on cluster structure

  // Identify top-level repositories (no incoming edges from cluster)
  const topLevelRepos = cluster.filter((repo) => !incomingEdges.has(repo));

  // Generate graph ID and name from top-level repos
  const topLevelNames = topLevelRepos
    .map((repo) => repoNodes.get(repo)!.repoName)
    .sort();

  const graphId = topLevelRepos.sort().join('::');
  const graphName =
    topLevelNames.length === 1
      ? topLevelNames[0]
      : topLevelNames.length === 2
      ? `${topLevelNames[0]} & ${topLevelNames[1]}`
      : `${topLevelNames[0]} & ${topLevelNames.length - 1} others`;

  // Check if any repo in cluster is a monorepo
  const isMonorepo = cluster.some((repo) => repoNodes.get(repo)!.isMonorepo);

  return {
    id: graphId,
    name: graphName,
    nodes: [...nodes, ...Array.from(externalDeps.values())],
    edges,
    metadata: {
      topLevelRepositories: topLevelNames,
      totalRepositories: cluster.length,
      totalExternalDependencies: externalDeps.size,
      isMonorepo,
      lastUpdated: Date.now(),
    },
  };
}

/**
 * Get statistics for a dependency graph
 */
export function getGraphStatistics(graph: DependencyGraph) {
  const stats = {
    totalNodes: graph.nodes.length,
    repositoryNodes: graph.nodes.filter((n) => n.type === 'repository').length,
    externalDependencies: graph.nodes.filter((n) => n.type === 'external').length,
    totalEdges: graph.edges.length,
    topLevelRepositories: graph.metadata.topLevelRepositories,
    avgDependenciesPerRepo: graph.edges.length / graph.metadata.totalRepositories,
  };

  return stats;
}

// Legacy export for backwards compatibility
export function buildDependencyGraph(
  repoData: RepositoryCacheData,
): DependencyGraph | null {
  // This is deprecated - use buildDependencyGraphs instead
  console.warn('buildDependencyGraph is deprecated, use buildDependencyGraphs');
  return null;
}
