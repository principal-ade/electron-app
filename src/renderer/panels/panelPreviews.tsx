import React from 'react';
import {
  Activity,
  AlertCircle,
  Edit,
  FileText,
  GitPullRequest,
  History,
  Image,
  Layers,
  Network,
  Pencil,
  Search,
} from 'lucide-react';
import { RepositorySearchTabPreview } from '../components/repository-maps/RepositorySearchTab';
import { GitCommitHistoryPanelPreview } from './components/GitCommitHistoryPanel';
import { GitIssuesPanelPreview } from './components/GitIssuesPanel';
import { GitPullRequestsPanelPreview } from './components/GitPullRequestsPanel';
import { DrawingsListPanelPreview } from './components/DrawingsListPanel';
import { AgentEventsPanelPreview } from './components/AgentEventsPanel';
import { AgentSessionsPanelPreview } from './components/AgentSessionsPanel';
import { MarkdownRenderingPanelPreview } from './components/MarkdownRenderingPanel';
import { AlexandriaDrawingPanelPreview } from './components/AlexandriaDrawingPanel';

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
