import React from 'react';
import {
  Activity,
  AlertCircle,
  Edit,
  FileCode,
  FileEdit,
  FileText,
  GitCompare,
  GitPullRequest,
  History,
  Image,
  Layers,
  Network,
  Package,
  Pencil,
  Play,
  Search,
  Users,
  Wrench,
} from 'lucide-react';
import { RepositorySearchTabPreview } from '../components/repository-maps/RepositorySearchTab';
import { GitCommitHistoryPanelPreview } from './components/GitCommitHistoryPanel';
import { GitIssuesPanelPreview } from './components/GitIssuesPanel';
import { GitPullRequestsPanelPreview } from './components/GitPullRequestsPanel';
import { RepositoryActionsPanelPreview } from './components/RepositoryActionsPanel';
import { ToolsPanelPreview } from './components/ToolsPanel';
import { DrawingsListPanelPreview } from './components/DrawingsListPanel';
import { AgentEventsPanelPreview } from './components/AgentEventsPanel';
import { AgentSessionsPanelPreview } from './components/AgentSessionsPanel';
import { FilePreviewPanelPreview } from './components/FilePreviewPanel';
import { MarkdownRenderingPanelPreview } from './components/MarkdownRenderingPanel';
import { AlexandriaDrawingPanelPreview } from './components/AlexandriaDrawingPanel';
import { QualityHexagonPanelPreview } from './components/QualityHexagonPanel';
import { GitDiffPanelPreview } from './components/GitDiffPanel';
import { MDXEditorPanelPreview } from './components/MDXEditorPanel';

export interface PanelPreviewMetadata {
  icon: React.ReactNode;
  preview: React.ReactNode;
  label?: string;
  description?: string;
}

export const panelPreviewRegistry: Record<string, PanelPreviewMetadata> = {
  search: {
    icon: <Search size={16} />,
    preview: <RepositorySearchTabPreview />,
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
  graphsList: {
    icon: <Network size={16} />,
    preview: (
      <div style={{ padding: '16px', textAlign: 'center' }}>Graphs List</div>
    ),
    label: 'Dependency Graphs',
    description:
      'Browse dependency clusters discovered across your repositories.',
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
