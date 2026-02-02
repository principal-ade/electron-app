export type RepositoryPanelSurface =
  | 'explorer'
  | 'manager'
  | 'viewer'
  | 'agent'
  | 'principal';

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
    id: 'cityVisualization',
    label: 'City Visualization',
    description:
      'Interactive file-city visualization derived from the repository structure.',
    slices: ['fileTree'] as const,
    surfaces: ['explorer', 'manager', 'agent'] as const,
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
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'docs',
    label: 'Docs',
    description: 'Documentation viewer for markdown and diagram files.',
    slices: ['markdown'] as const,
    surfaces: ['manager', 'agent'] as const,
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
    description: 'View and manage repositories in the selected workspace.',
    slices: [] as const,
    surfaces: ['principal'] as const,
  },
  {
    id: 'agentsList',
    label: 'Agents',
    description: 'View AGENTS.md documentation and Claude Code subagents.',
    slices: ['fileTree'] as const,
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'agentDetail',
    label: 'Agent Detail',
    description: 'View detailed information about selected agent or subagent.',
    slices: ['fileTree'] as const,
    surfaces: ['viewer', 'agent'] as const,
  },
  {
    id: 'skillsList',
    label: 'Skills',
    description: 'View and manage Agent Skills from SKILL.md files.',
    slices: ['fileTree'] as const,
    surfaces: ['manager', 'agent'] as const,
  },
  {
    id: 'skillDetail',
    label: 'Skill Detail',
    description: 'View detailed information about a selected Agent Skill.',
    slices: ['fileTree'] as const,
    surfaces: ['viewer', 'agent'] as const,
  },
  {
    id: 'typeInformation',
    label: 'Type Information',
    description: 'Browse and search TypeScript types in your project.',
    slices: [] as const,
    surfaces: ['explorer', 'manager', 'principal'] as const,
  },
] as const satisfies readonly RepositoryPanelDefinitionBase[];

export type RepositoryPanelCatalogEntry =
  (typeof repositoryPanelCatalog)[number];

export type RepositoryPanelId = RepositoryPanelCatalogEntry['id'];

export type RepositoryPanelVisibility = {
  visibility: Record<RepositoryPanelId, boolean>;
  order: RepositoryPanelId[];
};
