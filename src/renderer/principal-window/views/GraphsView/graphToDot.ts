/**
 * Convert DependencyGraph to GraphViz DOT format
 */

import type { DependencyGraph } from './graphDataBuilder';

export interface DotOptions {
  // Layout direction
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';

  // Node styling
  repositoryNodeColor?: string;
  externalNodeColor?: string;
  topLevelNodeColor?: string;

  // Edge styling
  edgeColor?: string;

  // Labels
  showPackageNames?: boolean;
  showVersionRanges?: boolean;
}

/**
 * Convert a DependencyGraph to DOT format string
 */
export function graphToDot(
  graph: DependencyGraph,
  options: DotOptions = {},
): string {
  const {
    rankdir = 'TB',
    repositoryNodeColor = '#3b82f6',
    externalNodeColor = '#8b5cf6',
    topLevelNodeColor = '#10b981',
    edgeColor = '#6b7280',
    showPackageNames = true,
    showVersionRanges = false,
  } = options;

  const lines: string[] = [];

  // Start digraph
  lines.push('digraph DependencyGraph {');
  lines.push(`  rankdir="${rankdir}";`);
  lines.push('  node [shape=box, style=filled, fontname="Arial"];');
  lines.push('  edge [fontname="Arial", fontsize=10];');
  lines.push('');

  // Track top-level repos
  const topLevelSet = new Set(graph.metadata.topLevelRepositories);

  // Add nodes
  graph.nodes.forEach((node) => {
    const isTopLevel = topLevelSet.has(node.name);
    const nodeColor =
      node.type === 'external'
        ? externalNodeColor
        : isTopLevel
          ? topLevelNodeColor
          : repositoryNodeColor;

    // Create label
    let label = node.name;
    if (showPackageNames && node.packageNames.length > 0) {
      const pkgList = node.packageNames.slice(0, 3).join('\\n');
      const more =
        node.packageNames.length > 3
          ? `\\n+${node.packageNames.length - 3} more`
          : '';
      label = `${node.name}\\n━━━━━━\\n${pkgList}${more}`;
    }

    // Escape quotes in label
    const escapedLabel = label.replace(/"/g, '\\"');

    // Add node definition
    const style = isTopLevel ? 'filled,bold' : 'filled';
    const shape = node.type === 'external' ? 'ellipse' : 'box';
    lines.push(
      `  "${node.id}" [label="${escapedLabel}", fillcolor="${nodeColor}", color="${nodeColor}", fontcolor="white", style="${style}", shape="${shape}"];`,
    );
  });

  lines.push('');

  // Add edges
  graph.edges.forEach((edge) => {
    // Create edge label if showing details
    let edgeLabel = '';
    if (showVersionRanges && edge.dependencies.length > 0) {
      const depLabels = edge.dependencies.map(
        (dep) => `${dep.packageName}@${dep.versionRange}`,
      );
      edgeLabel = ` [label="${depLabels.join('\\n')}", color="${edgeColor}"]`;
    } else {
      edgeLabel = ` [color="${edgeColor}"]`;
    }

    lines.push(`  "${edge.source}" -> "${edge.target}"${edgeLabel};`);
  });

  // End digraph
  lines.push('}');

  return lines.join('\n');
}

/**
 * Create a simple DOT graph for preview/testing
 */
export function createSampleDot(): string {
  return `digraph Sample {
  rankdir=LR;
  node [shape=box, style=filled, fontname="Arial"];

  "A" [label="Repository A", fillcolor="#10b981", fontcolor="white"];
  "B" [label="Repository B", fillcolor="#3b82f6", fontcolor="white"];
  "C" [label="Repository C", fillcolor="#3b82f6", fontcolor="white"];
  "D" [label="External Dep", fillcolor="#8b5cf6", fontcolor="white", shape=ellipse];

  "A" -> "B" [color="#6b7280"];
  "A" -> "C" [color="#6b7280"];
  "B" -> "D" [color="#6b7280"];
  "C" -> "D" [color="#6b7280"];
}`;
}
