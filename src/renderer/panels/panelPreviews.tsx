import React from 'react';
import {
  Activity,
  AlertCircle,
  BrainCircuit,
  CheckSquare,
  Edit,
  FileCode,
  FileEdit,
  FileText,
  FolderGit2,
  FolderTree,
  GitBranch,
  GitCompare,
  GitPullRequest,
  History,
  Image,
  Info,
  Layers,
  DoorClosed,
  Mailbox,
  Network,
  Package,
  Pencil,
  Play,
  Search,
  Users,
  Wrench,
} from 'lucide-react';
import { FileTreePanelPreview } from './components/FileTreePanelContent';
import { RepositorySearchTabPreview } from '../components/repository-maps/RepositorySearchTab';
import { GitChangesPanelPreview } from './components/GitChangesPanel';
import { GitCommitHistoryPanelPreview } from './components/GitCommitHistoryPanel';
import { GitIssuesPanelPreview } from './components/GitIssuesPanel';
import { GitPullRequestsPanelPreview } from './components/GitPullRequestsPanel';
import { GitHubProjectsPanelPreview } from './components/GitHubProjectsPanel';
import { GitHubSocialPanelPreview } from './components/GitHubSocialPanel';
import { GitStatusPanelPreview } from './components/GitStatusPanel';
import { RepositoryActionsPanelPreview } from './components/RepositoryActionsPanel';
import { ToolsPanelPreview } from './components/ToolsPanel';
import { DrawingsListPanelPreview } from './components/DrawingsListPanel';
import { AgentEventsPanelPreview } from './components/AgentEventsPanel';
import { AgentSessionsPanelPreview } from './components/AgentSessionsPanel';
import { AgentContextTreePanelPreview } from './components/AgentContextTreePanel';
import { TasksPanelPreview } from './components/TasksPanel';
import { MCPTasksPanelPreview } from './components/MCPTasksPanel';
import { FilePreviewPanelPreview } from './components/FilePreviewPanel';
import { MarkdownRenderingPanelPreview } from './components/MarkdownRenderingPanel';
import { AlexandriaDrawingPanelPreview } from './components/AlexandriaDrawingPanel';
import { QualityHexagonPanelPreview } from './components/QualityHexagonPanel';
import { GitDiffPanelPreview } from './components/GitDiffPanel';
import { MDXEditorPanelPreview } from './components/MDXEditorPanel';
import { GitHubReadmePanel } from './components/GitHubReadmePanel';
import { PresencePanelPreview } from './components/PresencePanel';
import { WorkspacesListPanelPreview } from './components/WorkspacesListPanel';
import { WorkspaceEntriesPanelPreview } from './components/WorkspaceEntriesPanel';

export interface PanelPreviewMetadata {
  icon: React.ReactNode;
  preview: React.ReactNode;
  label?: string;
  description?: string;
}

export const panelPreviewRegistry: Record<string, PanelPreviewMetadata> = {
  fileTree: {
    icon: <FolderTree size={16} />,
    preview: <FileTreePanelPreview />,
  },
  search: {
    icon: <Search size={16} />,
    preview: <RepositorySearchTabPreview />,
  },
  gitChanges: {
    icon: <GitBranch size={16} />,
    preview: <GitChangesPanelPreview />,
  },
  gitHistory: {
    icon: <History size={16} />,
    preview: <GitCommitHistoryPanelPreview />,
  },
  gitIssues: {
    icon: <AlertCircle size={16} />,
    preview: <GitIssuesPanelPreview />,
  },
  gitPullRequests: {
    icon: <GitPullRequest size={16} />,
    preview: <GitPullRequestsPanelPreview />,
  },
  githubProjects: {
    icon: <FolderGit2 size={16} />,
    preview: <GitHubProjectsPanelPreview />,
  },
  githubSocial: {
    icon: <Users size={16} />,
    preview: <GitHubSocialPanelPreview />,
    label: 'GitHub Network',
    description:
      'View coworkers from your organizations and people you follow.',
  },
  gitStatus: {
    icon: <Info size={16} />,
    preview: <GitStatusPanelPreview />,
    label: 'Git Status',
    description:
      'Branch details, upstream alignment, and the latest commit metadata.',
  },
  actions: {
    icon: <Play size={16} />,
    preview: <RepositoryActionsPanelPreview />,
    label: 'Repository Actions',
    description: 'Run project-specific automations and scripts.',
  },
  tools: {
    icon: <Wrench size={16} />,
    preview: <ToolsPanelPreview />,
  },
  drawings: {
    icon: <Pencil size={16} />,
    preview: <DrawingsListPanelPreview />,
    label: 'Drawings',
    description:
      'Browse and manage Excalidraw diagrams saved in the repository.',
  },
  agentEvents: {
    icon: <Activity size={16} />,
    preview: <AgentEventsPanelPreview />,
    label: 'Agent Events',
    description: 'Live stream of agent actions with repository file context.',
  },
  agentSessions: {
    icon: <Layers size={16} />,
    preview: <AgentSessionsPanelPreview />,
    label: 'Agent Sessions',
    description: 'Summaries of recent agent activity grouped by session.',
  },
  agentContext: {
    icon: <BrainCircuit size={16} />,
    preview: <AgentContextTreePanelPreview />,
  },
  tasks: {
    icon: <CheckSquare size={16} />,
    preview: <TasksPanelPreview />,
    label: 'Tasks',
    description: 'Track repository TODOs, notes, and follow-up actions.',
  },
  mcpTasks: {
    icon: <Mailbox size={16} />,
    preview: <MCPTasksPanelPreview />,
    label: 'MCP Tasks',
    description: 'Track tasks submitted through the MCP bridge to dependencies.',
  },
  codeViewer: {
    icon: <FileCode size={16} />,
    preview: <FilePreviewPanelPreview />,
  },
  markdownViewer: {
    icon: <FileText size={16} />,
    preview: <MarkdownRenderingPanelPreview />,
  },
  excalidrawDiagram: {
    icon: <Image size={16} />,
    preview: <AlexandriaDrawingPanelPreview />,
  },
  excalidrawEditor: {
    icon: <Edit size={16} />,
    preview: <AlexandriaDrawingPanelPreview />,
    label: 'Excalidraw Editor',
    description: 'Create and edit excalidraw drawings saved to Memory Palace.',
  },
  packageInfo: {
    icon: <Package size={16} />,
    preview: <QualityHexagonPanelPreview />,
  },
  gitDiff: {
    icon: <GitCompare size={16} />,
    preview: <GitDiffPanelPreview />,
  },
  mdxEditor: {
    icon: <FileEdit size={16} />,
    preview: <MDXEditorPanelPreview />,
    label: 'MDX Editor',
    description: 'Rich markdown editor with live preview and formatting tools.',
  },
  githubReadme: {
    icon: <FileText size={16} />,
    preview: (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#888',
        }}
      >
        GitHub README Viewer
      </div>
    ),
    label: 'GitHub README',
    description: 'View README files from GitHub repositories in the Feed.',
  },
  graphsList: {
    icon: <Network size={16} />,
    preview: (
      <div style={{ padding: '16px', textAlign: 'center' }}>Graphs List</div>
    ),
    label: 'Dependency Graphs',
    description:
      'Browse dependency clusters discovered across your repositories.',
  },
  graphDetail: {
    icon: <Network size={16} />,
    preview: (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        Graph Visualization
      </div>
    ),
    label: 'Graph Visualization',
    description:
      'Interactive graph visualization with filtering and cluster analysis.',
  },
  presence: {
    icon: <Users size={16} />,
    preview: <PresencePanelPreview />,
    label: 'Live Presence',
    description:
      'See who is online and what repositories they are working on in real-time.',
  },
  workspacesList: {
    icon: <DoorClosed size={16} />,
    preview: <WorkspacesListPanelPreview />,
    label: 'Workspaces',
    description: 'Browse and manage your workspaces for organizing repositories.',
  },
  workspaceEntries: {
    icon: <FolderGit2 size={16} />,
    preview: <WorkspaceEntriesPanelPreview />,
    label: 'Workspace Repositories',
    description: 'View and manage repositories in the selected workspace.',
  },
};

export type PanelPreviewId = keyof typeof panelPreviewRegistry;

export function getPanelPreviewMetadata(
  id: string,
): PanelPreviewMetadata | null {
  return panelPreviewRegistry[id] ?? null;
}

export function getAllPanelPreviewIds(): PanelPreviewId[] {
  return Object.keys(panelPreviewRegistry) as PanelPreviewId[];
}
