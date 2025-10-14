import React from 'react';
import {
  Activity,
  AlertCircle,
  Book,
  Building2,
  FileCode,
  FileText,
  FolderTree,
  GitBranch,
  GitPullRequest,
  History,
  Layers,
  ListTodo,
  Package,
  Pencil,
  Search,
  Terminal as TerminalIcon,
  Wrench,
} from 'lucide-react';
import { FileTreePanelPreview } from './components/FileTreePanelContent';
import { RepositorySearchTabPreview } from '../components/repository-maps/RepositorySearchTab';
import { GitChangesPanelPreview } from './components/GitChangesPanel';
import { GitCommitHistoryPanelPreview } from './components/GitCommitHistoryPanel';
import { GitIssuesPanelPreview } from './components/GitIssuesPanel';
import { GitPullRequestsPanelPreview } from './components/GitPullRequestsPanel';
import { RepoSourceArchitecturePanelPreview } from '../repo-manager/shared/RepoSourceArchitecturePanelSimple';
import { ToolsPanelPreview } from './components/ToolsPanel';
import { AlexandriaDocsPanelPreview } from '../repo-manager/shared/AlexandriaDocsPanel';
import { DrawingsListPanelPreview } from './components/DrawingsListPanel';
import { AgentEventsPanelPreview } from './components/AgentEventsPanel';
import { AgentSessionsPanelPreview } from './components/AgentSessionsPanel';
import { AgentContextTreePanelPreview } from './components/AgentContextTreePanel';
import { TasksPanelPreview } from './components/TasksPanel';
import { CityVisualizationPanelPreview } from './components/CityVisualizationPanel';
import { TabbedTerminalPanelPreview } from './components/TabbedTerminalPanel';
import { CarouselTerminalPanelPreview } from './components/CarouselTerminalPanel';
import { FilePreviewPanelPreview } from './components/FilePreviewPanel';
import { MarkdownRenderingPanelPreview } from './components/MarkdownRenderingPanel';
import { AlexandriaDrawingPanelPreview } from './components/AlexandriaDrawingPanel';
import { QualityHexagonPanelPreview } from './components/QualityHexagonPanel';
import { GitDiffPanelPreview } from './components/GitDiffPanel';

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
  dependencies: {
    icon: <Layers size={16} />,
    preview: <RepoSourceArchitecturePanelPreview />,
  },
  tools: {
    icon: <Wrench size={16} />,
    preview: <ToolsPanelPreview />,
  },
  docs: {
    icon: <Book size={16} />,
    preview: <AlexandriaDocsPanelPreview />,
  },
  drawings: {
    icon: <Pencil size={16} />,
    preview: <DrawingsListPanelPreview />,
    label: 'Drawings',
    description: 'Browse and manage Excalidraw diagrams saved in the repository.',
  },
  agentEvents: {
    icon: <Activity size={16} />,
    preview: <AgentEventsPanelPreview />,
    label: 'Agent Events',
    description: 'Live stream of agent actions with repository file context.',
  },
  agentSessions: {
    icon: <Activity size={16} />,
    preview: <AgentSessionsPanelPreview />,
    label: 'Agent Sessions',
    description: 'Summaries of recent agent activity grouped by session.',
  },
  agentContext: {
    icon: <Activity size={16} />,
    preview: <AgentContextTreePanelPreview />,
  },
  tasks: {
    icon: <ListTodo size={16} />,
    preview: <TasksPanelPreview />,
    label: 'Tasks',
    description: 'Track repository TODOs, notes, and follow-up actions.',
  },
  cityVisualization: {
    icon: <Building2 size={16} />,
    preview: <CityVisualizationPanelPreview />,
  },
  tabbedTerminal: {
    icon: <TerminalIcon size={16} />,
    preview: <TabbedTerminalPanelPreview />,
    label: 'Tabbed Terminal',
    description: 'Manage multiple terminals in a traditional tabbed layout.',
  },
  carouselTerminal: {
    icon: <TerminalIcon size={16} />,
    preview: <CarouselTerminalPanelPreview />,
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
    icon: <Pencil size={16} />,
    preview: <AlexandriaDrawingPanelPreview />,
  },
  packageInfo: {
    icon: <Package size={16} />,
    preview: <QualityHexagonPanelPreview />,
  },
  gitDiff: {
    icon: <GitBranch size={16} />,
    preview: <GitDiffPanelPreview />,
  },
};

export type PanelPreviewId = keyof typeof panelPreviewRegistry;

export function getPanelPreviewMetadata(id: string): PanelPreviewMetadata | null {
  return panelPreviewRegistry[id] ?? null;
}

export function getAllPanelPreviewIds(): PanelPreviewId[] {
  return Object.keys(panelPreviewRegistry) as PanelPreviewId[];
}
