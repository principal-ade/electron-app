export type RepositoryPanelSurface =
  | 'explorer'
  | 'manager'
  | 'viewer'
  | 'excalidraw'
  | 'agent'
  | 'principal';

export type RepositoryPanelSlice =
  | 'git'
  | 'markdown'
  | 'fileTree'
  | 'packages'
  | 'quality'
  | 'graphs';

export interface RepositoryPanelDefinitionBase {
  id: string;
  label: string;
  description?: string;
  surfaces: readonly RepositoryPanelSurface[];
  slices?: readonly RepositoryPanelSlice[];
}

export const repositoryPanelCatalog = [
  {
    id: 'gitChanges',
    label: 'Git Changes',
    description:
      'Review staged, unstaged, and untracked changes for the repository.',
    slices: ['git'] as const,
    surfaces: ['manager', 'agent', 'principal'] as const,
  },
  {
    id: 'gitIssues',
    label: 'Git Issues',
    description:
      'Browse, triage, and manage GitHub issues for this repository.',
    surfaces: ['explorer'] as const,
  },
  {
    id: 'gitPullRequests',
    label: 'Git Pull Requests',
    description:
      'Review open, merged, and closed pull requests associated with this repository.',
    surfaces: ['explorer'] as const,
  },
  {
    id: 'githubProjects',
    label: 'GitHub Projects',
    description:
      'Browse your GitHub repositories alongside the projects you have starred.',
    surfaces: ['explorer'] as const,
  },
  {
    id: 'githubSocial',
    label: 'GitHub Network',
    description:
      'View coworkers from your organizations and people you follow on GitHub.',
    surfaces: ['explorer', 'principal'] as const,
  },
  {
    id: 'gitStatus',
    label: 'Git Status',
    description:
      'Branch details, upstream alignment, and the latest commit metadata.',
    slices: ['git'] as const,
    surfaces: ['explorer', 'principal'] as const,
  },
  {
    id: 'gitHistory',
    label: 'Commit History',
    description: 'Review recent commits from the current repository.',
    slices: ['git'] as const,
    surfaces: ['manager', 'agent', 'principal'] as const,
  },
  {
    id: 'gitDiff',
    label: 'Git Diff',
    description: 'View side-by-side diffs of file changes with Monaco editor.',
    slices: ['git'] as const,
    surfaces: ['manager', 'agent', 'principal'] as const,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Track repository TODOs, notes, and follow-up actions.',
    slices: ['markdown'] as const,
    surfaces: ['explorer', 'manager', 'agent'] as const,
  },
  {
    id: 'mcpTasks',
    label: 'MCP Tasks',
    description: 'Track tasks submitted through the MCP bridge to dependencies.',
    slices: [] as const,
    surfaces: ['explorer', 'manager', 'agent', 'principal'] as const,
  },
  {
    id: 'cityVisualization',
    label: 'City Visualization',
    description:
      'Interactive code-city visualization derived from the repository structure.',
    slices: ['fileTree'] as const,
    surfaces: ['explorer', 'manager', 'agent'] as const,
  },
  {
    id: 'actions',
    label: 'Repository Actions',
    description: 'Run project-specific automations and scripts.',
    slices: ['fileTree'] as const,
    surfaces: ['explorer'] as const,
  },
  {
    id: 'packageInfo',
    label: 'Package Information',
    description:
      'Package insights, quality metrics, and dependency layers detected in the codebase.',
    slices: ['packages'] as const,
    surfaces: ['explorer', 'manager'] as const,
  },
  {
    id: 'fileTree',
    label: 'Files',
    description: 'Browse the complete file tree structure of the repository.',
    slices: ['fileTree'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Search files by name and content with advanced filtering.',
    slices: ['fileTree'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    description: 'Explore package architecture and dependency relationships.',
    slices: ['packages', 'fileTree'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'Development tools and utilities for the repository.',
    slices: ['packages'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'docs',
    label: 'Docs',
    description: 'Documentation viewer for markdown and diagram files.',
    slices: ['markdown'] as const,
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'multiTerminal',
    label: 'Multi Terminal',
    description:
      'Flexible terminal panel that can switch between tabbed and carousel layouts.',
    slices: [] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'codeViewer',
    label: 'Code Viewer',
    description: 'View source code files with syntax highlighting.',
    slices: ['fileTree'] as const,
    surfaces: ['viewer', 'agent'] as const,
  },
  {
    id: 'markdownViewer',
    label: 'Markdown Viewer',
    description: 'View markdown files as documents or slides with toggle.',
    slices: ['markdown'] as const,
    surfaces: ['viewer', 'agent'] as const,
  },
  {
    id: 'excalidrawDiagram',
    label: 'Excalidraw Diagram',
    description: 'View and interact with excalidraw diagrams.',
    slices: [] as const,
    surfaces: ['viewer', 'excalidraw'] as const,
  },
  {
    id: 'excalidrawEditor',
    label: 'Excalidraw Editor',
    description: 'Create and edit excalidraw drawings saved to Memory Palace.',
    slices: [] as const,
    surfaces: ['excalidraw'] as const,
  },
  {
    id: 'drawings',
    label: 'Drawings',
    description:
      'Browse and manage Excalidraw diagrams saved in the repository.',
    slices: [] as const,
    surfaces: ['excalidraw', 'manager', 'agent'] as const,
  },
  {
    id: 'agentEvents',
    label: 'Agent Events',
    description: 'Live stream of agent actions with repository file context.',
    slices: [] as const,
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'agentSessions',
    label: 'Agent Sessions',
    description: 'Summaries of recent agent activity grouped by session.',
    slices: [] as const,
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'agentContext',
    label: 'Agent Context',
    description:
      'View files accessed by agent sessions organized in a multi-tree view.',
    slices: [] as const,
    surfaces: ['agent'] as const,
  },
  {
    id: 'mdxEditor',
    label: 'MDX Editor',
    description: 'Rich markdown editor with live preview and formatting tools.',
    slices: ['markdown', 'fileTree'] as const,
    surfaces: ['manager', 'viewer', 'agent'] as const,
  },
  {
    id: 'githubReadme',
    label: 'GitHub README',
    description: 'View README files from GitHub repositories in the Feed.',
    slices: ['markdown'] as const,
    surfaces: ['principal'] as const,
  },
  {
    id: 'graphDetail',
    label: 'Package Dependencies',
    description:
      'Visualize package dependencies within a repository or monorepo workspace.',
    slices: ['packages'] as const,
    surfaces: ['principal', 'manager', 'viewer'] as const,
  },
  {
    id: 'terminalReplay',
    label: 'Terminal Replay',
    description:
      'Load and replay terminal recording files with synchronized playback controls.',
    slices: [] as const,
    surfaces: ['manager', 'agent', 'principal'] as const,
  },
  {
    id: 'presence',
    label: 'Live Presence',
    description:
      'See who is online and what repositories they are working on in real-time.',
    slices: [] as const,
    surfaces: ['principal'] as const,
  },
  {
    id: 'localhostBrowser',
    label: 'Localhost Browser',
    description:
      'View localhost development servers in an embedded browser view.',
    slices: [] as const,
    surfaces: ['manager', 'viewer', 'agent', 'principal'] as const,
  },
  {
    id: 'workspacesList',
    label: 'Workspaces',
    description:
      'Browse and manage your workspaces for organizing repositories.',
    slices: [] as const,
    surfaces: ['principal'] as const,
  },
  {
    id: 'workspaceEntries',
    label: 'Workspace Repositories',
    description:
      'View and manage repositories in the selected workspace.',
    slices: [] as const,
    surfaces: ['principal'] as const,
  },
] as const satisfies readonly RepositoryPanelDefinitionBase[];

export type RepositoryPanelCatalogEntry =
  (typeof repositoryPanelCatalog)[number];

export type RepositoryPanelId = RepositoryPanelCatalogEntry['id'];

export type RepositoryPanelVisibility = {
  visibility: Record<RepositoryPanelId, boolean>;
  order: RepositoryPanelId[];
};
