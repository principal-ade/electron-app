import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Sparkles,
  FileText,
  LayoutDashboard,
  Workflow,
  Code,
  GitBranch,
  Terminal,
  Activity,
} from 'lucide-react';
import {
  EditableConfigurablePanelLayout,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
// CSS is bundled inline in principal-view-panels, no separate import needed
// Note: file-city-panel CSS is bundled inline, no separate import needed
// Note: file-editing-panels CSS is now inlined in JS, no separate import needed
import type { PanelEventEmitter, DataSlice } from '@principal-ade/panel-framework-core';
import {
  RepositoryPanelProvider,
  useRepositoryPanelProvider,
} from '../contexts/RepositoryPanelContext';
import {
  TerminalProvider,
  useTerminalProvider,
} from '../contexts/TerminalContext';
import {
  AgentHighlightProvider,
  useAgentHighlightProvider,
} from '../contexts/AgentHighlightContext';
import { TabbedTerminalPanel, type BaseTab, type TerminalTab } from '@industry-theme/xterm-terminal-panel';
import { TabbedGhosttyTerminal } from '@industry-theme/ghostty-terminal-panel';
import {
  panels as principalViewPanels,
  TraceDetailsPanel,
  CanvasEditorPanel,
  StoryboardListPanel,
  TraceListPanel,
  type CanvasEditorPanelProps,
  type WorkflowScenariosPanelProps,
} from '@industry-theme/principal-view-panels';
import type { RegisteredTrace } from '@principal-ai/principal-view-core';
import type { WorkflowTemplate } from '@principal-ai/principal-view-core';
import type { FileInfo } from '@principal-ai/repository-abstraction';
import { CodeCityPanel, type CodeCityPanelPropsTyped } from '@industry-theme/file-city-panel';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { LocalProjectsPanel } from '@industry-theme/alexandria-panels';
import { panels as localhostBrowserPanels } from '@industry-theme/localhost-panels';
import { EventBusPanel, AgentToolsPanel } from '@industry-theme/agent-driven-ui-panels';
import {
  DependencyGraphPanelContent,
  GitChangesPanel,
  PackageCompositionPanel,
  type PackageLayer,
} from '@industry-theme/repository-composition-panels';
import { panels as codeQualityPanels } from '@principal-ade/code-quality-panels';
import { MarkdownPanel, type MarkdownPanelProps } from '@industry-theme/markdown-panels';
import {
  FileEditorPanel,
  GitDiffPanel,
  MDXEditorPanel,
  type FileEditorPanelProps,
  type MDXEditorPanelProps,
  type GitDiffPanelProps,
} from '@industry-theme/file-editing-panels';
import { panels as backlogPanels } from '@industry-theme/backlogmd-kanban-panel';
import { panels as agentPanels, type Skill, type SkillDetailPanelProps } from '@industry-theme/agent-panels';
import { GitHubIssuesPanel, GitHubIssueDetailPanel } from '@industry-theme/github-panels';
import { panels as typeInformationPanels } from '../panels/TypeInformationPanel';
import type { Repository } from '../../shared/types/repository.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { PanelIconSidebar } from '../components/Sidebar/PanelIconSidebar';
import type {
  DocumentSelectedPayload,
  TaskSelectedPayload,
  SkillSelectedPayload,
  TraceSelectedPayload,
  AgentSelectedPayload,
  IssueSelectedPayload,
  FileOpenedPayload,
  MDXEditorPayload,
  CanvasOpenPayload,
  DependencyGraphPayload,
} from './DevWorkspaceEvents.types';

/**
 * Tab type for displaying skill detail panels
 */
interface SkillTab extends BaseTab {
  contentType: 'skill';
  skillId: string;
  skillName: string;
  skill?: Skill; // Full skill object for instant loading
}

/**
 * Tab type for displaying markdown files
 */
interface MarkdownTab extends BaseTab {
  contentType: 'markdown';
  filePath: string;
  fileName: string;
}

/**
 * Tab type for editing canvas files (regular .canvas)
 */
interface CanvasEditorTab extends BaseTab {
  contentType: 'canvas-editor';
  canvasId: string;
  canvasPath: string;
  canvasName: string;
  canvasFileInfo?: FileInfo | null;
}

/**
 * Tab type for viewing canvas detail panels (.otel.canvas with testtraces)
 */
interface CanvasTab extends BaseTab {
  contentType: 'canvas-detail';
  canvasId: string;
  canvasPath: string;
  canvasName: string;
  canvasFileInfo?: FileInfo | null;
  selectedNarrativeId?: string | null;
  narrativePath?: string | null;
  narrativeTemplate?: WorkflowTemplate | null;
  narrativeFileInfo?: FileInfo | null;
}

/**
 * Tab type for file editor
 */
interface FileEditorTab extends BaseTab {
  contentType: 'file-editor';
  filePath: string;
  fileName: string;
}

/**
 * Tab type for MDX editor (markdown files)
 */
interface MDXEditorTab extends BaseTab {
  contentType: 'mdx-editor';
  filePath: string;
  fileName: string;
}

/**
 * Tab type for git diff viewer
 */
interface GitDiffTab extends BaseTab {
  contentType: 'git-diff';
  filePath: string;
  fileName: string;
  gitStatus?: string;
}

/**
 * Tab type for dependency graph panel
 */
interface DependencyGraphTab extends BaseTab {
  contentType: 'dependency-graph';
  packages: PackageLayer[];
}

/**
 * Tab type for trace details panel
 */
interface TraceDetailsTab extends BaseTab {
  contentType: 'trace-details';
  traceId: string;
  traceData?: RegisteredTrace; // Processed trace object for instant loading
}

/**
 * Union type of all tab types used in DevWorkspace
 */
type DevWorkspaceTab = TerminalTab | SkillTab | MarkdownTab | CanvasEditorTab | CanvasTab | FileEditorTab | MDXEditorTab | GitDiffTab | DependencyGraphTab | TraceDetailsTab;

export interface DevWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  /** Panel sizes */
  panelSizes?: { left: number; middle: number; right: number };
  /** Callback when panel sizes change */
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Trace source service name for OTEL routing */
  traceSourceServiceName?: string;
  /** Callback when scope names are discovered from library.yaml */
  onScopeNamesDiscovered?: (scopeNames: string[]) => void;
}

interface DevWorkspacePanelFrameworkInnerProps {
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  onTabsChange?: (tabs: unknown[]) => void;
}

/**
 * Isolated wrapper for File City panel that consumes agent highlight context.
 *
 * This component is defined outside DevWorkspacePanelFrameworkInner to prevent
 * the parent from re-rendering when highlight layers change. Only this wrapper
 * and the File City panel will re-render on agent events.
 */
const FileCityWithHighlights: React.FC<{
  context: ReturnType<typeof useRepositoryPanelProvider>['context'];
  actions: ReturnType<typeof useRepositoryPanelProvider>['actions'];
  events: ReturnType<typeof useRepositoryPanelProvider>['events'];
  FileCityPanelComponent: React.ComponentType<CodeCityPanelPropsTyped>;
}> = ({ context, actions, events, FileCityPanelComponent }) => {
  const { context: agentHighlightCtx } = useAgentHighlightProvider();

  // Create merged context for File City panel (includes agent highlight layers)
  const fileCityPanelContext = useMemo(() => {
    // Create a new slices Map that includes agent highlight layers
    const mergedSlices = new Map([
      ...Array.from(context.slices?.entries() || []),
      [
        'agentHighlightLayers',
        {
          scope: 'repository' as const,
          name: 'agentHighlightLayers',
          data: agentHighlightCtx.highlightLayers,
          loading: false,
          error: null,
          refresh: async () => {
            // Agent highlight layers are updated reactively from events
          },
        },
      ],
    ]);

    return {
      ...context,
      slices: mergedSlices,
      // Override getSlice to use our merged slices Map
      getSlice: <T = unknown>(name: string) => {
        return mergedSlices.get(name) as DataSlice<T> | undefined;
      },
      // Explicit properties for typed panel contexts (CodeCityPanelContext)
      fileTree: context.fileTree,
      fileCityColorModes: context.fileCityColorModes,
      gitStatusWithFiles: context.gitStatusWithFiles,
      packages: context.packages,
    };
  }, [context, agentHighlightCtx.highlightLayers]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FileCityPanelComponent
        context={fileCityPanelContext}
        actions={actions}
        events={events}
      />
    </div>
  );
};


/**
 * Inner component that uses RepositoryPanelProvider and TerminalProvider contexts
 */
const DevWorkspacePanelFrameworkInner: React.FC<
  DevWorkspacePanelFrameworkInnerProps
> = ({ collapsed, onCollapsedChange, layout, onLayoutChange, panelSizes, onPanelSizesChange, onTabsChange }) => {
  const { theme } = useTheme();
  const { context, actions, events } = useRepositoryPanelProvider();
  const { context: terminalCtx, actions: terminalActions } =
    useTerminalProvider();

  // Load terminal implementation preference (default to xterm)
  const [terminalImplementation, setTerminalImplementation] = useState<
    'xterm' | 'ghostty'
  >('xterm');

  // Unified modal state for detail panels
  type DetailModal =
    | { panelId: 'githubIssueDetail'; data: unknown }
    | { panelId: 'mdxEditor'; data: { path: string } };

  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);

  useEffect(() => {
    const loadPreference = async () => {
      const prefs = await UserPreferencesService.getPreferences();
      // Default to 'xterm' if not set
      setTerminalImplementation(prefs.terminalImplementation ?? 'xterm');
    };
    loadPreference();

    // Subscribe to preference updates so terminal switches when toggle is clicked
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      if (prefs.terminalImplementation) {
        setTerminalImplementation(prefs.terminalImplementation);
      }
    });

    return unsubscribe;
  }, []);

  // Get required props for tabbed terminal panels from TerminalContext
  const terminalContext = terminalCtx.terminalContext || 'terminal:default';
  const terminalDirectory = terminalCtx.repositoryPath || '/';

  // Create merged context for terminal panels (includes terminal sessions)
  const terminalPanelContext = useMemo(
    () => ({
      ...context,
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
      terminal: context.terminal,
    }),
    [context, terminalCtx.terminalSessions, terminalCtx.terminalContext],
  );

  // Tab state for TabbedTerminalPanel (skills only - terminals are managed by the panel from context)
  const [tabs, setTabs] = useState<DevWorkspaceTab[]>([]);

  // Focus tab state - when set, TabbedTerminalPanel will activate the tab and call onFocusTabHandled
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const handleFocusTabHandled = useCallback(() => setFocusTabId(null), []);

  // Track markdown files currently being loaded to prevent duplicate tabs
  const loadingMarkdownFilesRef = React.useRef<Set<string>>(new Set());

  // Track terminal panel container width using ResizeObserver
  const [terminalPanelWidth, setTerminalPanelWidth] = useState<number>(0);
  const terminalPanelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalPanelRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTerminalPanelWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(terminalPanelRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Stable onTabsChange that prevents infinite loops
  const handleTabsChange = useCallback((newTabs: DevWorkspaceTab[]) => {
    console.info('[DEBUG] handleTabsChange called with:', newTabs.map(t => t.id));
    setTabs(prevTabs => {
      // Only keep custom tabs from the update (filter out terminal tabs)
      // Terminal tabs are managed by TabbedTerminalPanel, we only care about custom tabs
      const newCustomTabs = newTabs.filter(t => t.contentType !== 'terminal');
      const prevCustomTabs = prevTabs.filter(t => t.contentType !== 'terminal');

      console.info('[DEBUG] prevCustomTabs:', prevCustomTabs.map(t => t.id));
      console.info('[DEBUG] newCustomTabs:', newCustomTabs.map(t => t.id));

      // Check if custom tabs actually changed
      const customTabsChanged =
        newCustomTabs.length !== prevCustomTabs.length ||
        !newCustomTabs.every(tab => prevCustomTabs.some(prev => prev.id === tab.id));

      console.info('[DEBUG] customTabsChanged:', customTabsChanged);

      if (!customTabsChanged) {
        console.info('[DEBUG] No change, returning prevTabs');
        return prevTabs; // No change
      }

      console.info('[DEBUG] Updating to newCustomTabs');
      // Notify parent of tab changes for RepositoryPanelProvider
      onTabsChange?.(newCustomTabs);

      return newCustomTabs; // Only store custom tabs
    });
  }, [onTabsChange]);

  // Direct imports instead of array access to avoid type inference issues
  const CanvasEditorPanelComponent = CanvasEditorPanel as React.ComponentType<CanvasEditorPanelProps>;
  const TraceViewerPanelComponent = principalViewPanels.find(
    (p) => p.metadata?.id === 'principal-ai.trace-viewer',
  )?.component; // Cannot convert - component not exported
  const CanvasDetailPanelComponent = principalViewPanels.find(
    (p) => p.metadata?.id === 'principal-ai.workflow-scenarios',
  )?.component as React.ComponentType<WorkflowScenariosPanelProps> | undefined; // Cannot convert - component not exported
  const StoryboardListPanelComponent = StoryboardListPanel;
  const TraceListPanelComponent = TraceListPanel;
  const FileCityPanelComponent = CodeCityPanel;
  const DocsPanelComponent = docsPanels[0]?.component; // Cannot convert - component not exported
  // Direct import instead of array access to avoid type inference issues with mixed desktop/web panels
  const LocalProjectsPanelComponent = LocalProjectsPanel;
  const LocalhostBrowserPanelComponent = localhostBrowserPanels.find(
    (p) => p.metadata?.id === 'principal-ade.localhost-browser',
  )?.component; // Cannot convert - component not exported
  const EventBusPanelComponent = EventBusPanel;
  const AgentToolsPanelComponent = AgentToolsPanel;
  const GitChangesPanelComponent = GitChangesPanel;
  const PackageCompositionPanelComponent = PackageCompositionPanel;
  const CodeQualityPanelComponent = codeQualityPanels.find(
    (p) => p.metadata?.id === 'principal-ade.quality-hexagon-panel',
  )?.component; // Cannot convert - package may not be installed
  const MarkdownPanelComponent = MarkdownPanel as React.ComponentType<MarkdownPanelProps>;
  const FileEditorPanelComponent = FileEditorPanel as React.ComponentType<FileEditorPanelProps>;
  const GitDiffPanelComponent = GitDiffPanel as React.ComponentType<GitDiffPanelProps>;
  const MDXEditorPanelComponent = MDXEditorPanel as React.ComponentType<MDXEditorPanelProps>;

  // Backlog.md panels (Kanban, TaskDetail, Milestone)
  const KanbanPanelComponent = backlogPanels[0]?.component; // Cannot convert - component not exported
  const TaskDetailPanelComponent = backlogPanels[1]?.component; // Cannot convert - component not exported
  const MilestonePanelComponent = backlogPanels[2]?.component; // Cannot convert - component not exported

  // Agent Skills panels
  const SkillDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skill-detail',
  )?.component as React.ComponentType<SkillDetailPanelProps> | undefined; // Cannot convert - need metadata ID lookup
  const AgentDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agent-detail',
  )?.component; // Cannot convert - need metadata ID lookup

  // Unified Agentic Resources panel (Agents + Skills combined)
  const AgenticResourcesPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agentic-resources',
  )?.component; // Cannot convert - need metadata ID lookup

  // GitHub panels
  const GitHubIssuesPanelComponent = GitHubIssuesPanel;
  const GitHubIssueDetailPanelComponent = GitHubIssueDetailPanel;
  const TypeInformationPanelComponent = typeInformationPanels.find(
    (p) => p.metadata?.id === 'principal-ade.type-information',
  )?.component; // Cannot convert - local panel, component not exported

  // Listen for doc:openInRightPanel events (from Alexandria docs panel context menu)
  useEffect(() => {
    const unsubscribe = events.on('doc:openInRightPanel', async (event) => {
      const doc = event.payload as DocumentSelectedPayload;

      console.info(
        '[DevWorkspacePanelFramework] Open in right panel event received:',
        doc,
      );

      // Get the file path (prefer absolute path, fall back to relative)
      const filePath = doc.path || doc.relativePath;

      if (!filePath) {
        console.warn(
          '[DevWorkspacePanelFramework] No file path in doc:openInRightPanel event',
        );
        return;
      }

      try {
        // Set the active file (reads content and updates slice)
        await actions.setActiveFile?.(filePath);

        // Switch the right panel to markdown-viewer
        onLayoutChange({ ...layout, right: 'markdown-viewer' });

        // Expand the right panel if it's collapsed
        if (collapsed.right) {
          onCollapsedChange({ ...collapsed, right: false });
        }

        console.info(
          '[DevWorkspacePanelFramework] Switched right panel to markdown-viewer for:',
          filePath,
        );
      } catch (error) {
        console.error(
          '[DevWorkspacePanelFramework] Failed to open in right panel:',
          error,
        );
      }
    });

    return unsubscribe;
  }, [events, actions, layout, onLayoutChange, collapsed, onCollapsedChange]);

  // Listen for detail panel events to show modals
  useEffect(() => {
    console.info('[DevWorkspacePanelFramework] Registering event handlers, events object:', events);

    const unsubscribers = [
      // Task detail - open task markdown file in MDX editor tab
      events.on('task:selected', (event) => {
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        console.info('[DevWorkspacePanelFramework] Received task:selected event:', event);
        const payload = event.payload as TaskSelectedPayload;
        const task = payload.task;

        if (!task || !task.filePath) {
          console.warn('[DevWorkspacePanelFramework] No task data or filePath in payload:', payload);
          return;
        }

        const filePath = task.filePath;
        const fileName = task.title || filePath.split('/').pop() || 'Task';

        console.info('[DevWorkspacePanelFramework] Opening task file in MDX editor:', filePath);

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath
          );

          if (existingTab) {
            console.info('[DevWorkspacePanelFramework] Task MDX editor tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new MDX editor tab
          // Use file path for deterministic ID (sanitize for valid ID)
          const tabId = `task-${filePath.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
          const newTab: MDXEditorTab = {
            id: tabId,
            label: fileName,
            contentType: 'mdx-editor',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new task MDX editor tab:', newTab);
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Skill detail - create tab instead of modal
      events.on('skill:selected', (event) => {
        console.info('[DevWorkspacePanelFramework] ===== SKILL SELECTED EVENT FIRED =====');
        console.info('[DevWorkspacePanelFramework] Event source:', event.source);
        console.info('[DevWorkspacePanelFramework] Event payload:', event.payload);
        console.info('[DevWorkspacePanelFramework] Full event:', event);

        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          console.info('[DevWorkspacePanelFramework] Ignoring tab re-emission');
          return;
        }

        console.info('[DevWorkspacePanelFramework] Received skill:selected event:', event);
        const payload = event.payload as SkillSelectedPayload;

        // Extract skill data
        const skill = payload.skill;
        if (!skill) {
          console.warn('[DevWorkspacePanelFramework] No skill in payload:', payload);
          return;
        }

        setTabs((prevTabs) => {
          // Check if tab already exists for this skill
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'skill' && (t as SkillTab).skillId === skill.id
          );

          if (existingTab) {
            // Tab exists - focus it
            console.info('[DevWorkspacePanelFramework] Skill tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs; // No change to tabs array
          }

          // Create new skill tab with full skill object for instant loading
          const newTab: SkillTab = {
            id: `skill-${skill.id}`,
            label: skill.name || 'Skill',
            contentType: 'skill',
            skillId: skill.id,
            skillName: skill.name || '',
            skill: skill, // Pass full skill object for instant display
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new skill tab (skill pre-loaded):', newTab);
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Trace detail - create tab instead of modal
      events.on('trace:selected', (event) => {
        console.info('[DevWorkspacePanelFramework] ===== TRACE SELECTED EVENT FIRED =====');
        console.info('[DevWorkspacePanelFramework] Event source:', event.source);
        console.info('[DevWorkspacePanelFramework] Event payload:', event.payload);

        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          console.info('[DevWorkspacePanelFramework] Ignoring tab re-emission');
          return;
        }

        const payload = event.payload as TraceSelectedPayload;

        // Extract trace data
        const trace = payload.trace;
        if (!trace || !trace.traceId) {
          console.warn('[DevWorkspacePanelFramework] No trace data or traceId in payload:', payload);
          return;
        }

        setTabs((prevTabs) => {
          // Check if tab already exists for this trace
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'trace-details' && (t as TraceDetailsTab).traceId === trace.traceId
          );

          if (existingTab) {
            // Tab exists - focus it
            console.info('[DevWorkspacePanelFramework] Trace details tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs; // No change to tabs array
          }

          // The trace is already a fully processed RegisteredTrace from TraceOrchestrator
          // Just use it directly - no conversion needed
          const registeredTrace = trace as RegisteredTrace;
          const traceName = registeredTrace.name || registeredTrace.traceId.substring(0, 8);

          const newTab: TraceDetailsTab = {
            id: `trace-${registeredTrace.traceId}`,
            label: traceName,
            contentType: 'trace-details',
            traceId: registeredTrace.traceId,
            traceData: registeredTrace,
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new trace details tab:', {
            id: newTab.id,
            name: traceName,
            scenarioMatches: registeredTrace.scenarioMatches?.length || 0,
            storyboardMatches: registeredTrace.storyboardMatches?.length || 0,
            unmatchedSpans: registeredTrace.unmatchedSpans?.spans?.length || 0,
          });
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Agent detail - open AGENTS.md file in markdown tab
      events.on('agent:selected', async (event) => {
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        console.info('[DevWorkspacePanelFramework] Received agent:selected event:', event);
        const payload = event.payload as AgentSelectedPayload;
        const agent = payload.data;

        if (!agent || !agent.path) {
          console.warn('[DevWorkspacePanelFramework] No agent data or path in payload:', payload);
          return;
        }

        // Get repository path from context
        const repoPath = context.currentScope?.repository?.path;
        if (!repoPath) {
          console.warn('[DevWorkspacePanelFramework] No repository path in context');
          return;
        }

        // Construct full file path (agent.path is relative like "AGENTS.md" or "packages/foo/AGENTS.md")
        const filePath = `${repoPath}/${agent.path}`;
        const fileName = agent.name || agent.path.split('/').pop() || 'AGENTS.md';

        console.info('[DevWorkspacePanelFramework] Opening agent file in MDX editor:', filePath);

        setTabs((prevTabs) => {
          // Check if tab already exists (check both mdx-editor and markdown for backwards compat)
          const existingTab = prevTabs.find(
            (t) =>
              (t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath) ||
              (t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath)
          );

          if (existingTab) {
            console.info('[DevWorkspacePanelFramework] Agent MDX editor tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new MDX editor tab
          // Use file path for deterministic ID (sanitize for valid ID)
          const tabId = `agent-${filePath.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
          const newTab: MDXEditorTab = {
            id: tabId,
            label: fileName,
            contentType: 'mdx-editor',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new agent MDX editor tab:', newTab);
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // GitHub issue detail
      events.on('issue:selected', (event) => {
        // Ignore re-emitted events from modal to prevent loop
        if (event.source === 'modal') return;

        console.info('[DevWorkspacePanelFramework] Received issue:selected event:', event);
        const payload = event.payload as IssueSelectedPayload;
        setDetailModal({
          panelId: 'githubIssueDetail',
          data: payload.issue,
        });
      }),
      // File open from git changes panel
      events.on('file:open', (event) => {
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        console.info('[DevWorkspacePanelFramework] Received file:open event:', event);
        const payload = event.payload as FileOpenedPayload;
        const filePath = payload.path;
        const fileName = filePath.split('/').pop() || 'File';

        // Check if file is markdown
        const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.mdx');

        // Markdown files always open in MDX editor, regardless of git status
        // For other files: use git diff panel for modified files (staged or unstaged), file editor for new/untracked files
        let contentType: 'mdx-editor' | 'git-diff' | 'file-editor';
        if (isMarkdown) {
          contentType = 'mdx-editor';
        } else {
          const isModified = payload.gitStatus === 'unstaged' || payload.gitStatus === 'staged';
          contentType = isModified ? 'git-diff' : 'file-editor';
        }

        console.info('[DevWorkspacePanelFramework] Git status:', payload.gitStatus, '-> Opening tab:', contentType);

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              ((t.contentType === 'file-editor' && (t as FileEditorTab).filePath === filePath) ||
                (t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath) ||
                (t.contentType === 'git-diff' && (t as GitDiffTab).filePath === filePath))
          );

          if (existingTab) {
            console.info('[DevWorkspacePanelFramework] Tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new tab
          // Use file path for deterministic ID (sanitize for valid ID)
          const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');
          let newTab: FileEditorTab | MDXEditorTab | GitDiffTab;
          if (contentType === 'mdx-editor') {
            newTab = {
              id: `mdx-editor-${sanitizedPath}`,
              label: fileName,
              contentType: 'mdx-editor',
              filePath: filePath,
              fileName: fileName,
              closable: true,
            };
          } else if (contentType === 'git-diff') {
            newTab = {
              id: `git-diff-${sanitizedPath}`,
              label: fileName,
              contentType: 'git-diff',
              filePath: filePath,
              fileName: fileName,
              gitStatus: payload.gitStatus,
              closable: true,
            };
          } else {
            newTab = {
              id: `file-editor-${sanitizedPath}`,
              label: fileName,
              contentType: 'file-editor',
              filePath: filePath,
              fileName: fileName,
              closable: true,
            };
          }

          console.info('[DevWorkspacePanelFramework] Creating new tab:', newTab);
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Markdown file open in tab (from docs panel clicks)
      events.on('file:opened', async (event) => {
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          console.info('[DevWorkspacePanelFramework] Ignoring tab re-emission');
          return;
        }

        const payload = event.payload as MDXEditorPayload;
        const filePath = payload.filePath || payload.path;

        if (!filePath) {
          console.warn('[DevWorkspacePanelFramework] No file path in file:opened event:', payload);
          return;
        }

        // Only handle markdown files - open them in tabs
        if (!filePath.endsWith('.md')) {
          return; // Ignore non-markdown files
        }

        console.info('[DevWorkspacePanelFramework] Received file:opened event for markdown:', filePath);
        const fileName = filePath.split('/').pop() || 'Markdown';

        // Check if this file is already being loaded (prevents duplicate tabs on rapid clicks)
        if (loadingMarkdownFilesRef.current.has(filePath)) {
          console.info('[DevWorkspacePanelFramework] Markdown file already being loaded:', filePath);
          return;
        }

        // Mark this file as being loaded
        loadingMarkdownFilesRef.current.add(filePath);

        try {
          // Pre-load the file content
          console.info('[DevWorkspacePanelFramework] Pre-loading markdown file:', filePath);
          if (actions.setActiveFile) {
            await actions.setActiveFile(filePath);
          }

          // Check for existing tab first
          const tabId = `markdown-${filePath}`;

          setTabs((prevTabs) => {
            const existingTab = prevTabs.find(
              (t) => t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath
            );

            if (existingTab) {
              console.info('[DevWorkspacePanelFramework] Markdown tab already exists:', existingTab.id);
              return prevTabs; // Tab exists, don't create new one
            }

            // Create new tab with file already loaded
            const newTab: MarkdownTab = {
              id: tabId,
              label: fileName,
              contentType: 'markdown',
              filePath: filePath,
              fileName: fileName,
              closable: true,
            };

            console.info('[DevWorkspacePanelFramework] Creating new markdown tab:', newTab);
            return [...prevTabs, newTab];
          });

          // Focus the tab (existing or new) - do this outside setTabs to avoid batching issues
          console.info('[DevWorkspacePanelFramework] Focusing markdown tab:', tabId);
          setFocusTabId(tabId);
        } finally {
          // Always remove from loading set when done
          loadingMarkdownFilesRef.current.delete(filePath);
        }
      }),
      // Open file in MDX editor - create modal
      events.on('file:openInMdxEditor', async (event) => {
        // Ignore re-emitted events from modal to prevent loop
        if (event.source === 'modal') return;

        const payload = event.payload as MDXEditorPayload;
        const filePath = payload?.filePath;

        if (!filePath) {
          console.warn('[DevWorkspacePanelFramework] No file path in file:openInMdxEditor event');
          return;
        }

        console.info('[DevWorkspacePanelFramework] Opening file in MDX editor:', filePath);

        // Open MDX editor modal
        setDetailModal({
          panelId: 'mdxEditor',
          data: { path: filePath },
        });
      }),
      // Canvas open - create tab (from storyboard-list-panel, canvas-list-panel or canvas-detail-panel)
      events.on('custom', (event) => {
        // Type the canvas payload
        const payload = event.payload as CanvasOpenPayload;

        // Only handle openCanvas action from storyboard-list-panel, canvas-list-panel, canvas-detail-panel, or trace-list-panel
        if (payload.action !== 'openCanvas' ||
            (event.source !== 'storyboard-list-panel' && event.source !== 'canvas-list-panel' && event.source !== 'canvas-detail-panel' && event.source !== 'trace-list-panel')) {
          return;
        }

        console.info('[DevWorkspacePanelFramework] Received canvas open event:', event);
        const { canvasId, canvas, canvasFileInfo, workflowId, workflow, workflowFileInfo } = payload;

        if (!canvasId || !canvas) {
          console.warn('[DevWorkspacePanelFramework] No canvas data in event:', event.payload);
          return;
        }

        setTabs((prevTabs) => {
          // Determine content type based on whether workflow data is present
          // If workflow clicked → canvas-detail, if canvas clicked → canvas-editor
          const hasWorkflow = !!(workflowId && workflow);
          const contentType = hasWorkflow ? 'canvas-detail' : 'canvas-editor';

          // Check if tab already exists for this canvas
          const existingTabIndex = prevTabs.findIndex(
            (t) => {
              if (hasWorkflow) {
                return t.contentType === 'canvas-detail' && (t as CanvasTab).canvasId === canvasId;
              } else {
                return t.contentType === 'canvas-editor' && (t as CanvasEditorTab).canvasId === canvasId;
              }
            }
          );

          if (existingTabIndex !== -1 && hasWorkflow) {
            // Existing canvas-detail tab found - update it with new workflow information
            console.info('[DevWorkspacePanelFramework] Updating existing canvas tab with new workflow:', prevTabs[existingTabIndex].id);
            const updatedTabs = [...prevTabs];
            const existingTab = updatedTabs[existingTabIndex] as CanvasTab;

            updatedTabs[existingTabIndex] = {
              ...existingTab,
              selectedNarrativeId: workflowId || null,
              narrativePath: workflowFileInfo?.path || null,
              narrativeTemplate: workflow || null,
              narrativeFileInfo: workflowFileInfo || null,
            };

            setFocusTabId(prevTabs[existingTabIndex].id);
            return updatedTabs; // Tab updated, will be focused
          } else if (existingTabIndex !== -1) {
            // Existing tab found (canvas-editor) - focus it
            console.info('[DevWorkspacePanelFramework] Canvas tab already exists, focusing:', prevTabs[existingTabIndex].id);
            setFocusTabId(prevTabs[existingTabIndex].id);
            return prevTabs; // Tab exists, will be focused
          }

          // Create new canvas tab (editor or detail based on workflow presence)
          const newTab: CanvasEditorTab | CanvasTab = hasWorkflow
            ? {
                id: `canvas-detail-${canvasId}`,
                label: workflow?.name || workflowId || canvas.name || canvasId,
                contentType: 'canvas-detail',
                canvasId: canvasId,
                canvasPath: canvas.path,
                canvasName: canvas.name || canvasId,
                canvasFileInfo: canvasFileInfo || null,
                selectedNarrativeId: workflowId || null,
                narrativePath: workflowFileInfo?.path || null,
                narrativeTemplate: workflow || null,
                narrativeFileInfo: workflowFileInfo || null,
                closable: true,
              } as CanvasTab
            : {
                id: `canvas-editor-${canvasId}`,
                label: canvas.name || canvasId,
                contentType: 'canvas-editor',
                canvasId: canvasId,
                canvasPath: canvas.path,
                canvasName: canvas.name || canvasId,
                canvasFileInfo: canvasFileInfo || null,
                closable: true,
              } as CanvasEditorTab;

          console.info('[DevWorkspacePanelFramework] Creating new', contentType, 'tab:', newTab);
          // Also request focus for new tabs to ensure consistent activation
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actions and context intentionally omitted to avoid re-subscribing
  }, [events]);

  // Re-emit selection events when modal opens so detail panels can receive them
  useEffect(() => {
    if (detailModal) {
      console.info('[DevWorkspacePanelFramework] Modal opened with data:', detailModal);
      // Use setTimeout to ensure the detail panel component is mounted first
      setTimeout(() => {
        if (detailModal.panelId === 'githubIssueDetail') {
          console.info('[DevWorkspacePanelFramework] Re-emitting issue:selected with data:', detailModal.data);
          events.emit({
            type: 'issue:selected',
            source: 'modal',
            timestamp: Date.now(),
            payload: {
              issue: detailModal.data,
            },
          });
        } else if (detailModal.panelId === 'mdxEditor') {
          console.info('[DevWorkspacePanelFramework] Setting active file for MDX editor:', detailModal.data.path);
          // Set the active file via actions
          if (actions.setActiveFile) {
            actions.setActiveFile(detailModal.data.path);
          }
        }
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actions intentionally omitted to avoid re-running effect
  }, [detailModal, events]);

  // Listen for deselection events to close the modal (from panel's X button)
  useEffect(() => {
    const unsubscribers = [
      events.on('issue:deselected', () => {
        console.info('[DevWorkspacePanelFramework] Issue deselected, closing modal');
        setDetailModal(null);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events]);

  // Listen for dependency-graph:open events to create a new graph tab
  useEffect(() => {
    const unsubscribe = events.on('dependency-graph:open', (event) => {
      console.info('[DevWorkspacePanelFramework] Received dependency-graph:open event:', event);
      const payload = event.payload as DependencyGraphPayload | undefined;
      const packages = payload?.packages ?? [];

      if (packages.length === 0) {
        console.warn('[DevWorkspacePanelFramework] No packages in dependency-graph:open event');
        return;
      }

      setTabs((prevTabs) => {
        // Check if a dependency graph tab already exists
        const existingTab = prevTabs.find(
          (t) => t.contentType === 'dependency-graph'
        );

        if (existingTab) {
          // Update existing tab with new packages and focus it
          console.info('[DevWorkspacePanelFramework] Updating existing dependency graph tab:', existingTab.id);
          setFocusTabId(existingTab.id);
          return prevTabs.map((t) =>
            t.id === existingTab.id
              ? { ...t, packages } as DependencyGraphTab
              : t
          );
        }

        // Create new dependency graph tab
        const newTab: DependencyGraphTab = {
          id: 'dependency-graph',
          label: 'Dependency Graph',
          contentType: 'dependency-graph',
          packages,
          closable: true,
        };

        console.info('[DevWorkspacePanelFramework] Creating new dependency graph tab:', newTab);
        setFocusTabId(newTab.id);
        return [...prevTabs, newTab];
      });
    });

    return unsubscribe;
  }, [events]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailModal) {
        setDetailModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [detailModal]);

  // Use refs for provider values to avoid recreating renderTabContent callback
  const contextRef = React.useRef(context);
  const actionsRef = React.useRef(actions);
  const eventsRef = React.useRef(events);

  // Update refs on every render (refs don't trigger re-renders)
  React.useEffect(() => {
    contextRef.current = context;
    actionsRef.current = actions;
    eventsRef.current = events;
  });

  // Render custom icon for tabs based on content type
  const renderTabIcon = useCallback((tab: DevWorkspaceTab) => {
    switch (tab.contentType) {
      case 'terminal':
        return <Terminal size={14} />;
      case 'skill':
        return <Sparkles size={14} />;
      case 'markdown':
      case 'mdx-editor':
        return <FileText size={14} />;
      case 'canvas-editor':
        return <LayoutDashboard size={14} />;
      case 'canvas-detail':
        return <Workflow size={14} />;
      case 'file-editor':
        return <Code size={14} />;
      case 'git-diff':
        return <GitBranch size={14} />;
      case 'dependency-graph':
        return <GitBranch size={14} />;
      case 'trace-details':
        return <Activity size={14} />;
      default:
        return undefined; // Return undefined to fall back to tab.icon
    }
  }, []);

  // Render custom label for tabs - only override for canvas-detail to show workflow name
  const renderTabLabel = useCallback((tab: DevWorkspaceTab) => {
    if (tab.contentType === 'canvas-detail') {
      const canvasTab = tab as CanvasTab;
      // Use workflow name, falling back to workflow ID, then canvas name as last resort
      return canvasTab.narrativeTemplate?.name
        || canvasTab.selectedNarrativeId
        || canvasTab.canvasName
        || undefined;
    }
    return undefined; // Fall back to tab.label for all other tabs
  }, []);

  // Render custom content for non-terminal tabs
  // NOTE: Uses refs for context/actions/events to avoid recreating this callback
  // when provider values change, which would cause unnecessary re-renders of all tabs
  const renderTabContent = useCallback(
    (tab: DevWorkspaceTab, isActive: boolean, sessionId?: string | null, width?: number) => {
      switch (tab.contentType) {
        case 'terminal':
          // Return null to use default terminal rendering
          return null;

        case 'skill': {
          // Type assertion for TypeScript
          const skillTab = tab as SkillTab;

          if (!SkillDetailPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                Skill Detail panel not available
              </div>
            );
          }

          console.info('[DevWorkspacePanelFramework] Rendering skill tab:', {
            skillId: skillTab.skillId,
            skillName: skillTab.skillName,
            hasSkillData: !!skillTab.skill,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <SkillDetailPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                selectedSkillId={skillTab.skillId}
                skill={skillTab.skill}
              />
            </div>
          );
        }

        case 'markdown': {
          // Type assertion for TypeScript
          const markdownTab = tab as MarkdownTab;

          if (!MarkdownPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                Markdown Viewer panel not available
              </div>
            );
          }

          console.info('[DevWorkspacePanelFramework] Rendering markdown tab:', {
            filePath: markdownTab.filePath,
            fileName: markdownTab.fileName,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <MarkdownPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                filePath={markdownTab.filePath}
                width={width}
              />
            </div>
          );
        }

        case 'canvas-editor': {
          // Type assertion for TypeScript
          const canvasEditorTab = tab as CanvasEditorTab;

          if (!CanvasEditorPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                Canvas Editor panel not available
              </div>
            );
          }

          console.info('[DevWorkspacePanelFramework] Rendering canvas editor tab:', {
            canvasId: canvasEditorTab.canvasId,
            canvasPath: canvasEditorTab.canvasPath,
            canvasName: canvasEditorTab.canvasName,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <CanvasEditorPanelComponent
                context={context}
                actions={actionsRef.current}
                events={eventsRef.current}
                canvasPath={canvasEditorTab.canvasPath}
                canvasName={canvasEditorTab.canvasName}
                canvasFileInfo={canvasEditorTab.canvasFileInfo}
              />
            </div>
          );
        }

        case 'canvas-detail': {
          // Type assertion for TypeScript
          const canvasTab = tab as CanvasTab;

          if (!CanvasDetailPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                Canvas Detail panel not available
              </div>
            );
          }

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <CanvasDetailPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                selectedCanvasId={canvasTab.canvasId}
                canvasPath={canvasTab.canvasPath}
                canvasName={canvasTab.canvasName}
                canvasFileInfo={canvasTab.canvasFileInfo}
                selectedWorkflowId={canvasTab.selectedNarrativeId}
                workflowPath={canvasTab.narrativePath}
                workflowTemplate={canvasTab.narrativeTemplate}
                workflowFileInfo={canvasTab.narrativeFileInfo}
              />
            </div>
          );
        }

        case 'file-editor': {
          // Type assertion for TypeScript
          const fileEditorTab = tab as FileEditorTab;

          if (!FileEditorPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                File Editor panel not available
              </div>
            );
          }

          console.info('[DevWorkspacePanelFramework] Rendering file editor tab:', {
            filePath: fileEditorTab.filePath,
            fileName: fileEditorTab.fileName,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <FileEditorPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                filePath={fileEditorTab.filePath}
                showCloseButton={false}
              />
            </div>
          );
        }

        case 'mdx-editor': {
          // Type assertion for TypeScript
          const mdxEditorTab = tab as MDXEditorTab;

          if (!MDXEditorPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                MDX Editor panel not available
              </div>
            );
          }

          console.info('[DevWorkspacePanelFramework] Rendering MDX editor tab:', {
            filePath: mdxEditorTab.filePath,
            fileName: mdxEditorTab.fileName,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <MDXEditorPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                filePath={mdxEditorTab.filePath}
                showCloseButton={false}
              />
            </div>
          );
        }

        case 'git-diff': {
          // Type assertion for TypeScript
          const gitDiffTab = tab as GitDiffTab;

          if (!GitDiffPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                Git Diff panel not available
              </div>
            );
          }

          console.info('[DevWorkspacePanelFramework] Rendering git diff tab:', {
            filePath: gitDiffTab.filePath,
            fileName: gitDiffTab.fileName,
            gitStatus: gitDiffTab.gitStatus,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <GitDiffPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                filePath={gitDiffTab.filePath}
                showCloseButton={false}
              />
            </div>
          );
        }

        case 'dependency-graph': {
          const dependencyGraphTab = tab as DependencyGraphTab;

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <DependencyGraphPanelContent
                packages={dependencyGraphTab.packages}
                isLoading={false}
              />
            </div>
          );
        }

        case 'trace-details': {
          // Type assertion for TypeScript
          const traceDetailsTab = tab as TraceDetailsTab;

          console.info('[DevWorkspacePanelFramework] Rendering trace details tab:', {
            traceId: traceDetailsTab.traceId,
            hasTraceData: !!traceDetailsTab.traceData,
            isActive,
          });

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', // TabbedTerminalPanel handles visibility
                flexDirection: 'column',
              }}
            >
              <TraceDetailsPanel
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                selectedTrace={traceDetailsTab.traceData ?? null}
              />
            </div>
          );
        }

        default: {
          const unknownTab = tab as DevWorkspaceTab;
          console.warn('[DevWorkspacePanelFramework] Unknown tab type:', unknownTab.contentType);
          return (
            <div style={{ padding: '2rem', color: theme.colors.error }}>
              Unknown tab type: {unknownTab.contentType}
            </div>
          );
        }
      }
    },
    [theme, context, SkillDetailPanelComponent, MarkdownPanelComponent, CanvasEditorPanelComponent, CanvasDetailPanelComponent, FileEditorPanelComponent, MDXEditorPanelComponent, GitDiffPanelComponent],
  );

  // Define all panels using panel framework components
  const allPanels = useMemo(
    () => [
      {
        id: 'terminal',
        label: 'Terminal',
        // Note: ghostty panel has different TerminalActions type - see TODO in ghostty-terminal-panel repo
        content:
          terminalImplementation === 'ghostty' ? (
            <TabbedGhosttyTerminal
              context={terminalPanelContext}
              actions={terminalActions as never}
              events={events}
              terminalContext={terminalContext}
              directory={terminalDirectory}
            />
          ) : (
            <div
              ref={terminalPanelRef}
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <TabbedTerminalPanel<DevWorkspaceTab>
                context={terminalPanelContext}
                actions={terminalActions}
                events={events}
                terminalContext={terminalContext}
                directory={terminalDirectory}
                initialTabs={tabs}
                onTabsChange={handleTabsChange}
                renderTabContent={renderTabContent}
                renderTabIcon={renderTabIcon}
                renderTabLabel={renderTabLabel}
                defaultScrollLocked={false}
                width={terminalPanelWidth}
                requestFocusTabId={focusTabId}
                onFocusTabHandled={handleFocusTabHandled}
              />
            </div>
          ),
      },
      {
        id: 'traceViewer',
        label: 'Trace Viewer',
        content: TraceViewerPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TraceViewerPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Trace Viewer panel not available</div>
        ),
      },
      {
        id: 'canvasList',
        label: 'Architecture',
        content: StoryboardListPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <StoryboardListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Architecture panel not available</div>
        ),
      },
      {
        id: 'traceList',
        label: 'Traces',
        content: TraceListPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TraceListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Trace List panel not available</div>
        ),
      },
      {
        id: 'fileCity',
        label: 'File City',
        content: FileCityPanelComponent ? (
          <FileCityWithHighlights
            context={context}
            actions={actions}
            events={events}
            FileCityPanelComponent={FileCityPanelComponent}
          />
        ) : (
          <div>File City panel not available</div>
        ),
      },
      {
        id: 'docs',
        label: 'Documentation',
        content: DocsPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <DocsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Documentation panel not available</div>
        ),
      },
      {
        id: 'gitChanges',
        label: 'Git Changes',
        content: GitChangesPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <GitChangesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Git Changes panel not available</div>
        ),
      },
      {
        id: 'localhostBrowser',
        label: 'Localhost Browser',
        content: LocalhostBrowserPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <LocalhostBrowserPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Localhost Browser panel not available</div>
        ),
      },
      {
        id: 'localhostBrowserAlt',
        label: 'Localhost Browser (Alt)',
        content: LocalhostBrowserPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <LocalhostBrowserPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Localhost Browser panel not available</div>
        ),
      },
      {
        id: 'eventBus',
        label: 'Event Bus',
        content: EventBusPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <EventBusPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Event Bus panel not available</div>
        ),
      },
      {
        id: 'agentTools',
        label: 'Agent Tools',
        content: AgentToolsPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <AgentToolsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Agent Tools panel not available</div>
        ),
      },
      {
        id: 'localProjects',
        label: 'Local Projects',
        content: LocalProjectsPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <LocalProjectsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Local Projects panel not available</div>
        ),
      },
      {
        id: 'codeQuality',
        label: 'Code Quality',
        content: CodeQualityPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CodeQualityPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Code Quality panel not available</div>
        ),
      },
      {
        id: 'packageComposition',
        label: 'Package Composition',
        content: PackageCompositionPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <PackageCompositionPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Package Composition panel not available</div>
        ),
      },
      {
        id: 'markdown-viewer',
        label: 'Markdown Viewer',
        content: MarkdownPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MarkdownPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Markdown Viewer panel not available</div>
        ),
      },
      {
        id: 'fileEditor',
        label: 'File Editor',
        content: FileEditorPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <FileEditorPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>File Editor panel not available</div>
        ),
      },
      {
        id: 'gitDiff',
        label: 'Git Diff',
        content: GitDiffPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <GitDiffPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Git Diff panel not available</div>
        ),
      },
      {
        id: 'mdxEditor',
        label: 'MDX Editor',
        content: MDXEditorPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MDXEditorPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>MDX Editor panel not available</div>
        ),
      },
      {
        id: 'kanban',
        label: 'Kanban',
        content: KanbanPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <KanbanPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Kanban panel not available</div>
        ),
      },
      {
        id: 'task-detail',
        label: 'Task Detail',
        content: TaskDetailPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TaskDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Task Detail panel not available</div>
        ),
      },
      {
        id: 'milestones',
        label: 'Milestones',
        content: MilestonePanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MilestonePanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Milestones panel not available</div>
        ),
      },
      {
        id: 'skillDetail',
        label: 'Skill Detail',
        content: SkillDetailPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SkillDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Skill Detail panel not available</div>
        ),
      },
      {
        id: 'agentsList',
        label: 'Agents & Skills',
        content: AgenticResourcesPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <AgenticResourcesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Agentic Resources panel not available</div>
        ),
      },
      {
        id: 'agentDetail',
        label: 'Agent Detail',
        content: AgentDetailPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <AgentDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Agent Detail panel not available</div>
        ),
      },
      {
        id: 'githubIssues',
        label: 'GitHub Issues',
        content: GitHubIssuesPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <GitHubIssuesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>GitHub Issues panel not available</div>
        ),
      },
      {
        id: 'githubIssueDetail',
        label: 'GitHub Issue Detail',
        content: GitHubIssueDetailPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <GitHubIssueDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>GitHub Issue Detail panel not available</div>
        ),
      },
      {
        id: 'typeInformation',
        label: 'Type Information',
        content: TypeInformationPanelComponent ? (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TypeInformationPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Type Information panel not available</div>
        ),
      },
    ],
    // NOTE: renderTabContent is intentionally excluded from dependencies since it uses refs.
    // tabs is included so TabbedTerminalPanel receives updated tabs for canvas/skill/agent panels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      CanvasEditorPanelComponent,
      StoryboardListPanelComponent,
      FileCityPanelComponent,
      DocsPanelComponent,
      LocalProjectsPanelComponent,
      GitChangesPanelComponent,
      LocalhostBrowserPanelComponent,
      EventBusPanelComponent,
      AgentToolsPanelComponent,
      CodeQualityPanelComponent,
      PackageCompositionPanelComponent,
      MarkdownPanelComponent,
      FileEditorPanelComponent,
      GitDiffPanelComponent,
      MDXEditorPanelComponent,
      KanbanPanelComponent,
      TaskDetailPanelComponent,
      MilestonePanelComponent,
      SkillDetailPanelComponent,
      AgenticResourcesPanelComponent,
      AgentDetailPanelComponent,
      GitHubIssuesPanelComponent,
      GitHubIssueDetailPanelComponent,
      TypeInformationPanelComponent,
      context,
      actions,
      events,
      terminalImplementation,
      terminalContext,
      terminalDirectory,
      terminalPanelContext,
      terminalActions,
      theme,
      tabs,
      handleTabsChange,
      renderTabIcon,
      renderTabLabel,
      focusTabId,
      handleFocusTabHandled,
      terminalPanelWidth,
    ],
  );

  return (
    <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          background: theme.colors.background,
          position: 'relative',
        }}
      >
        {/* Panel Icon Sidebar */}
        <PanelIconSidebar
        currentPanelId={typeof layout.left === 'string' ? layout.left : ''}
        onPanelChange={(panelId) => onLayoutChange({ ...layout, left: panelId })}
        theme={theme}
        collapsed={collapsed.left}
        onExpand={() => onCollapsedChange({ ...collapsed, left: false })}
        onCollapse={() => onCollapsedChange({ ...collapsed, left: true })}
      />

      {/* Main panel layout area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <EditableConfigurablePanelLayout
          panels={allPanels}
          layout={layout}
          onLayoutChange={onLayoutChange}
          isEditMode={false}
          collapsiblePanels={{ left: true, right: true }}
          defaultSizes={panelSizes || { left: 25, middle: 50, right: 25 }}
          minSizes={{ left: 15, middle: 30, right: 15 }}
          collapsed={collapsed}
          showCollapseButtons={false}
          theme={theme}
          onPanelResize={onPanelSizesChange}
        />

        {/* Detail Panel Modal */}
        {detailModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
            onClick={() => setDetailModal(null)}
          >
            <div
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                maxWidth: '900px',
                width: '85%',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Render appropriate detail panel based on panelId */}
              {detailModal.panelId === 'githubIssueDetail' && GitHubIssueDetailPanelComponent && (
                <GitHubIssueDetailPanelComponent
                  context={{
                    ...context,
                    slices: new Map([
                      ...Array.from(context.slices?.entries() || []),
                      ['selectedIssue', {
                        scope: 'repository' as const,
                        name: 'selectedIssue',
                        data: detailModal.data,
                        loading: false,
                        error: null,
                        refresh: async () => {},
                      }],
                    ]),
                  }}
                  actions={actions}
                  events={events}
                />
              )}
              {detailModal.panelId === 'mdxEditor' && MDXEditorPanelComponent && (
                <div style={{ height: '100%' }}>
                  <MDXEditorPanelComponent
                    context={context}
                    actions={actions}
                    events={events}
                    filePath={detailModal.data.path}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Panel Framework for Dev Workspace
 *
 * This is a simplified, modern panel system that uses:
 * - Panel framework components from @industry-theme packages
 * - RepositoryPanelProvider for panel data (file tree, git status, etc.)
 * - TerminalProvider for terminal state (separate to avoid re-renders)
 * - ConfigurablePanelLayout for visual layout management
 */
export const DevWorkspacePanelFramework: React.FC<
  DevWorkspacePanelFrameworkProps
> = ({
  repositoryPath,
  repository,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
  panelSizes,
  onPanelSizesChange,
  events,
  traceSourceServiceName,
  onScopeNamesDiscovered,
}) => {
  // Use the same terminal context format as legacy MultiTerminalPanel
  // Legacy uses: terminal:${owner}/${name}
  // This ensures terminal sessions are shared when switching between classic and panel framework modes
  const terminalContext = useMemo(
    () => `terminal:${repository.owner}/${repository.name}`,
    [repository.owner, repository.name],
  );

  // Convert Repository to RepositoryMetadata for panel framework
  const repositoryMetadata = useMemo(
    () => ({
      id: `${repository.owner}/${repository.name}`,
      name: repository.name,
      path: repositoryPath,
      owner: repository.owner,
    }),
    [repository.owner, repository.name, repositoryPath],
  );

  // Track tabs state to pass to RepositoryPanelProvider for panels to access
  const [tabsForProvider, setTabsForProvider] = useState<unknown[]>([]);

  return (
    <RepositoryPanelProvider
      repositoryPath={repositoryPath}
      repository={repositoryMetadata}
      events={events}
      traceSourceServiceName={traceSourceServiceName}
      openTabs={tabsForProvider}
      onScopeNamesDiscovered={onScopeNamesDiscovered}
    >
      <TerminalProvider
        repositoryPath={repositoryPath}
        terminalContext={terminalContext}
      >
        <AgentHighlightProvider repositoryPath={repositoryPath}>
          <DevWorkspacePanelFrameworkInner
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            layout={layout}
            onLayoutChange={onLayoutChange}
            panelSizes={panelSizes}
            onPanelSizesChange={onPanelSizesChange}
            onTabsChange={setTabsForProvider}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </RepositoryPanelProvider>
  );
};
