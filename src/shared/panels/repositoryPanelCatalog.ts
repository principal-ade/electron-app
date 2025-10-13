export type RepositoryPanelSurface =
  | 'explorer'
  | 'manager'
  | 'viewer'
  | 'excalidraw'
  | 'agent';

export type RepositoryPanelSlice =
  | 'git'
  | 'markdown'
  | 'fileTree'
  | 'packages'
  | 'quality';

export interface RepositoryPanelDefinitionBase {
  id: string;
  label: string;
  description?: string;
  defaultLocation: 'left' | 'right';
  surfaces: readonly RepositoryPanelSurface[];
  slices?: readonly RepositoryPanelSlice[];
}

export const repositoryPanelCatalog = [
  {
    id: 'gitChanges',
    label: 'Git Changes',
    description:
      'Review staged, unstaged, and untracked changes for the repository.',
    defaultLocation: 'left',
    slices: ['git'] as const,
    surfaces: ['explorer', 'manager', 'agent'] as const,
  },
  {
    id: 'gitIssues',
    label: 'Git Issues',
    description: 'Browse, triage, and manage GitHub issues for this repository.',
    defaultLocation: 'left',
    surfaces: ['explorer'] as const,
  },
  {
    id: 'gitPullRequests',
    label: 'Git Pull Requests',
    description:
      'Review open, merged, and closed pull requests associated with this repository.',
    defaultLocation: 'left',
    surfaces: ['explorer'] as const,
  },
  {
    id: 'files',
    label: 'Markdown Documents',
    description:
      'Recently updated markdown documentation discovered in the repository.',
    defaultLocation: 'left',
    slices: ['markdown'] as const,
    surfaces: ['explorer'] as const,
  },
  {
    id: 'gitStatus',
    label: 'Git Status',
    description:
      'Branch details, upstream alignment, and the latest commit metadata.',
    defaultLocation: 'left',
    slices: ['git'] as const,
    surfaces: ['explorer'] as const,
  },
  {
    id: 'gitHistory',
    label: 'Commit History',
    description: 'Review recent commits from the current repository.',
    defaultLocation: 'left',
    slices: ['git'] as const,
    surfaces: ['explorer'] as const,
  },
  {
    id: 'gitDiff',
    label: 'Git Diff',
    description: 'View side-by-side diffs of file changes with Monaco editor.',
    defaultLocation: 'right',
    slices: ['git'] as const,
    surfaces: ['explorer', 'manager', 'agent'] as const,
  },
  {
    id: 'tasksAndNotes',
    label: 'Tasks & Notes',
    description: 'Project notes and TODOs captured across the repository.',
    defaultLocation: 'left',
    slices: ['markdown'] as const,
    surfaces: ['explorer'] as const,
  },
  {
    id: 'cityVisualization',
    label: 'City Visualization',
    description:
      'Interactive code-city visualization derived from the repository structure.',
    defaultLocation: 'right',
    slices: ['fileTree'] as const,
    surfaces: ['explorer', 'manager', 'agent'] as const,
  },
  {
    id: 'actions',
    label: 'Repository Actions',
    description: 'Run project-specific automations and scripts.',
    defaultLocation: 'right',
    slices: ['fileTree'] as const,
    surfaces: ['explorer'] as const,
  },
  {
    id: 'packageInfo',
    label: 'Package Information',
    description:
      'Package insights, quality metrics, and dependency layers detected in the codebase.',
    defaultLocation: 'right',
    slices: ['packages'] as const,
    surfaces: ['explorer', 'manager'] as const,
  },
  {
    id: 'fileTree',
    label: 'Files',
    description: 'Browse the complete file tree structure of the repository.',
    defaultLocation: 'left',
    slices: ['fileTree'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Search files by name and content with advanced filtering.',
    defaultLocation: 'left',
    slices: ['fileTree'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'dependencies',
    label: 'Dependencies',
    description: 'Explore package architecture and dependency relationships.',
    defaultLocation: 'left',
    slices: ['packages', 'fileTree'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'Development tools and utilities for the repository.',
    defaultLocation: 'left',
    slices: ['packages'] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'docs',
    label: 'Docs',
    description: 'Documentation viewer for markdown and diagram files.',
    defaultLocation: 'left',
    slices: ['markdown'] as const,
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Integrated terminal for repository commands.',
    defaultLocation: 'right',
    slices: [] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'carouselTerminal',
    label: 'Carousel Terminal',
    description: 'Horizontally scrolling terminal carousel with snap navigation.',
    defaultLocation: 'right',
    slices: [] as const,
    surfaces: ['manager'] as const,
  },
  {
    id: 'codeViewer',
    label: 'Code Viewer',
    description: 'View source code files with syntax highlighting.',
    defaultLocation: 'right',
    slices: ['fileTree'] as const,
    surfaces: ['viewer', 'agent'] as const,
  },
  {
    id: 'markdownViewer',
    label: 'Markdown Viewer',
    description: 'View markdown files as documents or slides with toggle.',
    defaultLocation: 'right',
    slices: ['markdown'] as const,
    surfaces: ['viewer', 'agent'] as const,
  },
  {
    id: 'excalidrawDiagram',
    label: 'Excalidraw Diagram',
    description: 'View and interact with excalidraw diagrams.',
    defaultLocation: 'right',
    slices: [] as const,
    surfaces: ['viewer', 'excalidraw'] as const,
  },
  {
    id: 'excalidrawEditor',
    label: 'Excalidraw Editor',
    description: 'Create and edit excalidraw drawings saved to Memory Palace.',
    defaultLocation: 'right',
    slices: [] as const,
    surfaces: ['excalidraw'] as const,
  },
  {
    id: 'drawingsList',
    label: 'Drawings',
    description: 'Browse and manage excalidraw drawings in the repository.',
    defaultLocation: 'left',
    slices: [] as const,
    surfaces: ['excalidraw'] as const,
  },
  {
    id: 'agentContext',
    label: 'Agent Context',
    description:
      'View files accessed by agent sessions organized in a multi-tree view.',
    defaultLocation: 'left',
    slices: [] as const,
    surfaces: ['agent'] as const,
  },
] as const satisfies readonly RepositoryPanelDefinitionBase[];

export type RepositoryPanelCatalogEntry =
  (typeof repositoryPanelCatalog)[number];

export type RepositoryPanelId = RepositoryPanelCatalogEntry['id'];

export type RepositoryPanelVisibility = Record<RepositoryPanelId, boolean>;
