import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { SpanStatusCode } from '@opentelemetry/api';
import { getTracer } from '../telemetry';
import {
  Sparkles,
  FileText,
  LayoutDashboard,
  Workflow,
  Code,
  GitBranch,
  Terminal,
  Activity,
  History,
  X,
} from 'lucide-react';
import {
  EditableConfigurablePanelLayout,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
// CSS is bundled inline in principal-view-panels, no separate import needed
// Note: file-city-panel CSS is bundled inline, no separate import needed
// Note: file-editing-panels CSS is now inlined in JS, no separate import needed
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import {
  RepositoryPanelProvider,
  useRepositoryPanelProvider,
} from '../contexts/RepositoryPanelContext';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../contexts/TerminalContext';
import {
  AgentHighlightProvider,
  useAgentHighlightProvider,
} from '../contexts/AgentHighlightContext';
import { TabbedTerminalPanel, type BaseTab, type TerminalTab, type TerminalWorkingState, type TerminalActivityChangedEvent } from '@industry-theme/xterm-terminal-panel';
import {
  panels as principalViewPanels,
  TraceDetailsPanel,
  CanvasEditorPanel,
  StoryboardListPanel,
  TraceListPanel,
  MultiCanvasPanel,
  type CanvasEditorPanelProps,
} from '@industry-theme/principal-view-panels';
import type { RegisteredTrace } from '@principal-ai/principal-view-core';
import type { WorkflowTemplate } from '@principal-ai/principal-view-core';
import type { FileInfo } from '@principal-ai/repository-abstraction';
import { CodeCityPanel, type CodeCityPanelPropsTyped } from '@industry-theme/file-city-panel';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
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
import { TerminalSessionsPanel } from '../panels/terminal-sessions';
import type { Repository } from '../../shared/types/repository.types';
import { PanelIconSidebar, RIGHT_PANEL_ICONS } from '../components/Sidebar/PanelIconSidebar';
import { StorybookSidebarButton } from '../components/Sidebar/StorybookSidebarButton';
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
  MultiCanvasOpenPayload,
  MultiCanvasInfo,
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
  // Trace focus fields - for highlighting matched spans when opened from TraceListPanel
  selectedTraceId?: string | null;
  highlightedSpanId?: string | null;
  selectedScenarioId?: string | null;
  /** Full trace object for template interpolation */
  selectedTrace?: RegisteredTrace | null;
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
 * Tab type for multi-canvas view panel
 */
interface MultiCanvasTab extends BaseTab {
  contentType: 'multi-canvas';
  canvases: MultiCanvasInfo[];
  canvasType: 'otel' | 'regular';
}

/**
 * Union type of all tab types used in DevWorkspace
 */
type DevWorkspaceTab = TerminalTab | SkillTab | MarkdownTab | CanvasEditorTab | CanvasTab | FileEditorTab | MDXEditorTab | GitDiffTab | DependencyGraphTab | TraceDetailsTab | MultiCanvasTab;

/**
 * History item for right panel document viewing
 */
interface RightPanelHistoryItem {
  filePath: string;
  fileName: string;
  openedAt: number;
}

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
  /** Callback when service trace counts change */
  onServiceTraceCountsChange?: (counts: Map<string, number>, lastActiveService: string | null) => void;
  /** Callback when left panel collapse animation completes */
  onLeftCollapseComplete?: () => void;
  /** Callback when left panel expand animation completes */
  onLeftExpandComplete?: () => void;
  /** Callback to open in Web-ADE */
  onOpenInWebADE?: () => void;
  /** Callback to open GitHub Actions */
  onOpenGitHubActions?: () => void;
  /** Hide the icon sidebars (focus mode) */
  sidebarsHidden?: boolean;
}

interface DevWorkspacePanelFrameworkInnerProps {
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  onTabsChange?: (tabs: unknown[]) => void;
  onLeftCollapseComplete?: () => void;
  onLeftExpandComplete?: () => void;
  onOpenInWebADE?: () => void;
  onOpenGitHubActions?: () => void;
  sidebarsHidden?: boolean;
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
    return {
      ...context,
      // Add agent highlight layers as a typed slice property
      agentHighlightLayers: {
        scope: 'repository' as const,
        name: 'agentHighlightLayers',
        data: agentHighlightCtx.highlightLayers,
        loading: false,
        error: null,
        refresh: async () => {
          // Agent highlight layers are updated reactively from events
        },
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
> = ({ collapsed, onCollapsedChange, layout, onLayoutChange, panelSizes, onPanelSizesChange, onTabsChange, onLeftCollapseComplete, onLeftExpandComplete, onOpenInWebADE, onOpenGitHubActions, sidebarsHidden }) => {
  const { theme } = useTheme();
  // Counter to force layout remount when sizes are programmatically changed
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  // Track when we're waiting for a programmatic resize
  const [pendingSplit, setPendingSplit] = useState(false);

  // When panelSizes changes to 50/50 and we're waiting for it, trigger remount
  useEffect(() => {
    if (pendingSplit && panelSizes?.middle === 50 && panelSizes?.right === 50) {
      // Use flushSync to batch the state updates synchronously, reducing flicker
      flushSync(() => {
        setPendingSplit(false);
        setLayoutResetKey((k) => k + 1);
      });
    }
  }, [panelSizes, pendingSplit]);
  const { context, actions, events } = useRepositoryPanelProvider();
  const { context: terminalCtx, actions: terminalActions } =
    useTerminalProvider();
  const { activities: terminalActivities, actions: activityActions } =
    useTerminalActivity();

  // Unified modal state for detail panels
  type DetailModal =
    | { panelId: 'githubIssueDetail'; data: unknown }
    | { panelId: 'mdxEditor'; data: { path: string } };

  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);

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

  // Convert terminal activities to workingStates record for TabbedTerminalPanel
  const workingStates = useMemo(() => {
    const states: Record<string, TerminalWorkingState> = {};
    for (const activity of terminalActivities) {
      states[activity.sessionId] = {
        isWorking: activity.isWorking,
        message: activity.workingMessage,
        subtitle: activity.workingSubtitle,
      };
    }
    return states;
  }, [terminalActivities]);

  // Listen for terminal:activity-changed events from TabbedTerminalPanel and update activity state
  useEffect(() => {
    const activityTracer = getTracer('devworkspace-activity');

    const unsubscribe = events.on('terminal:activity-changed', (event) => {
      if (event.type === 'terminal:activity-changed') {
        const payload = event.payload as TerminalActivityChangedEvent;
        console.info('[DevWorkspacePanelFramework] Terminal activity changed:', payload);

        // Start span for host handling the activity event
        const span = activityTracer.startSpan('terminal.activity.host_handle');

        try {
          // Event: Host received the activity change from terminal panel
          span.addEvent('terminal.activity.host_received', {
            'session.id': payload.sessionId,
            'is_working': payload.isWorking,
            'handler.name': 'onTerminalActivityChanged',
          });

          // Event: TIPC invoked to update activity in main process
          span.addEvent('terminal.activity.tipc_invoked', {
            'procedure.name': 'updateActivity',
            'is_working': payload.isWorking,
          });

          activityActions.updateActivity({
            sessionId: payload.sessionId,
            isWorking: payload.isWorking,
            workingMessage: payload.message,
            workingSubtitle: payload.subtitle,
          });

          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.recordException(
            error instanceof Error ? error : new Error(String(error)),
          );
          span.setStatus({ code: SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      }
    });

    return () => unsubscribe();
  }, [events, activityActions]);

  // Tab state for TabbedTerminalPanel (skills only - terminals are managed by the panel from context)
  const [tabs, setTabs] = useState<DevWorkspaceTab[]>([]);

  // Focus tab state - when set, TabbedTerminalPanel will activate the tab and call onFocusTabHandled
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const handleFocusTabHandled = useCallback(() => setFocusTabId(null), []);

  // Right panel history - tracks documents opened in the right panel for quick navigation
  const [rightPanelHistory, setRightPanelHistory] = useState<RightPanelHistoryItem[]>([]);
  const [showRightPanelHistory, setShowRightPanelHistory] = useState(false);

  // Handle clicking on a history item to re-open that file
  const handleHistoryItemClick = useCallback(async (filePath: string) => {
    setShowRightPanelHistory(false);
    await actions.setActiveFile?.(filePath);
    // Move to front of history
    const fileName = filePath.split('/').pop() || 'Document';
    setRightPanelHistory(prev => {
      const filtered = prev.filter(item => item.filePath !== filePath);
      return [{ filePath, fileName, openedAt: Date.now() }, ...filtered];
    });
  }, [actions]);

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
  // Note: CanvasDetailPanelComponent (WorkflowScenariosPanel) is no longer used
  // CanvasEditorPanel now handles workflow scenarios via workflowTemplate prop (v0.12.1+)
  const StoryboardListPanelComponent = StoryboardListPanel;
  const TraceListPanelComponent = TraceListPanel;
  const FileCityPanelComponent = CodeCityPanel;
  const DocsPanelComponent = docsPanels[0]?.component; // Cannot convert - component not exported
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
    const tracer = getTracer('devworkspace');
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

      // OTEL: Start event dispatch span
      const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
        attributes: {
          'event.name': 'doc:openInRightPanel',
          'event.source': event.source || 'unknown',
        },
      });

      // OTEL: Add trigger event
      dispatchSpan.addEvent('devworkspace.trigger.panel', {
        'trigger.source': event.source || 'unknown',
        'trigger.action': 'openInRightPanel',
      });

      // OTEL: Add eventbus dispatch event
      dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
        'event.name': 'doc:openInRightPanel',
        'event.source': event.source || 'unknown',
        'handlers.count': 1,
      });

      dispatchSpan.end();

      // OTEL: Start panel handle span
      const handleSpan = tracer.startSpan('devworkspace.panel.handle', {
        attributes: {
          'event.name': 'doc:openInRightPanel',
          'file.path': filePath,
        },
      });

      // OTEL: Add handler event
      handleSpan.addEvent('devworkspace.handler.panel', {
        'event.name': 'doc:openInRightPanel',
      });

      try {
        // Set the active file (reads content and updates slice)
        await actions.setActiveFile?.(filePath);

        // Add to right panel history (avoid duplicates, move to front if exists)
        const fileName = filePath.split('/').pop() || 'Document';
        setRightPanelHistory(prev => {
          const filtered = prev.filter(item => item.filePath !== filePath);
          return [{ filePath, fileName, openedAt: Date.now() }, ...filtered].slice(0, 20);
        });

        // OTEL: Add activeFile.set event
        handleSpan.addEvent('devworkspace.activeFile.set', {
          'file.path': filePath,
          'file.type': 'markdown',
          'file.size': 0, // Not available here
        });

        // Switch the right panel to markdown-viewer
        onLayoutChange({ ...layout, right: 'markdown-viewer' });

        // Expand the right panel if it's collapsed
        if (collapsed.right) {
          onCollapsedChange({ ...collapsed, right: false });
        }

        // OTEL: Add layout.changed event
        handleSpan.addEvent('devworkspace.layout.changed', {
          'panel.slot': 'right',
          'panel.new': 'markdown-viewer',
          'panel.expanded': !collapsed.right || true,
        });

        handleSpan.setStatus({ code: SpanStatusCode.OK });

        console.info(
          '[DevWorkspacePanelFramework] Switched right panel to markdown-viewer for:',
          filePath,
        );
      } catch (error) {
        handleSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(
          '[DevWorkspacePanelFramework] Failed to open in right panel:',
          error,
        );
      } finally {
        handleSpan.end();
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
        const tracer = getTracer('devworkspace');
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

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'task:selected',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openTask',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'task:selected',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'task:selected',
            'file.path': filePath,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'task:selected',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] Task MDX editor tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new MDX editor tab
          // Use file path for deterministic ID (sanitize for valid ID)
          tabId = `task-${sanitizedPath}`;
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

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `task-${sanitizedPath}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `task-${sanitizedPath}`,
            'tab.contentType': 'mdx-editor',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // Skill detail - create tab instead of modal
      events.on('skill:selected', (event) => {
        const tracer = getTracer('devworkspace');
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

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'skill:selected',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openSkill',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'skill:selected',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'skill:selected',
            'skill.id': skill.id,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'skill:selected',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event (not skipped since we're past the check)
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';

        setTabs((prevTabs) => {
          // Check if tab already exists for this skill
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'skill' && (t as SkillTab).skillId === skill.id
          );

          if (existingTab) {
            // Tab exists - focus it
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] Skill tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs; // No change to tabs array
          }

          // Create new skill tab with full skill object for instant loading
          tabId = `skill-${skill.id}`;
          const newTab: SkillTab = {
            id: tabId,
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

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `skill-${skill.id}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `skill-${skill.id}`,
            'tab.contentType': 'skill',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // Trace detail - create tab instead of modal
      events.on('trace:selected', (event) => {
        const tracer = getTracer('devworkspace');
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

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'trace:selected',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openTrace',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'trace:selected',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'trace:selected',
            'trace.id': trace.traceId,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'trace:selected',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';

        setTabs((prevTabs) => {
          // Check if tab already exists for this trace
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'trace-details' && (t as TraceDetailsTab).traceId === trace.traceId
          );

          if (existingTab) {
            // Tab exists - focus it
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] Trace details tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs; // No change to tabs array
          }

          // The trace is already a fully processed RegisteredTrace from TraceOrchestrator
          // Just use it directly - no conversion needed
          const registeredTrace = trace as RegisteredTrace;
          const traceName = registeredTrace.name || registeredTrace.traceId.substring(0, 8);

          tabId = `trace-${registeredTrace.traceId}`;
          const newTab: TraceDetailsTab = {
            id: tabId,
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

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `trace-${trace.traceId}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `trace-${trace.traceId}`,
            'tab.contentType': 'trace-details',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // Agent detail - open AGENTS.md file in markdown tab
      events.on('agent:selected', async (event) => {
        const tracer = getTracer('devworkspace');
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

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'agent:selected',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openAgent',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'agent:selected',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'agent:selected',
            'file.path': filePath,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'agent:selected',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists (check both mdx-editor and markdown for backwards compat)
          const existingTab = prevTabs.find(
            (t) =>
              (t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath) ||
              (t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath)
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] Agent MDX editor tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new MDX editor tab
          // Use file path for deterministic ID (sanitize for valid ID)
          tabId = `agent-${sanitizedPath}`;
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

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `agent-${sanitizedPath}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `agent-${sanitizedPath}`,
            'tab.contentType': 'mdx-editor',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // Doc open in tab - open documentation file in MDX editor tab
      events.on('doc:openInTab', async (event) => {
        const tracer = getTracer('devworkspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        const doc = event.payload as DocumentSelectedPayload;

        console.info('[DevWorkspacePanelFramework] Open in tab event received:', doc);

        // Get the file path (prefer absolute path, fall back to relative)
        const filePath = doc.path || doc.relativePath;

        if (!filePath) {
          console.warn('[DevWorkspacePanelFramework] No file path in doc:openInTab event');
          return;
        }

        const fileName = filePath.split('/').pop() || 'Document';

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'doc:openInTab',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openInTab',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'doc:openInTab',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'doc:openInTab',
            'file.path': filePath,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'doc:openInTab',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists (check both mdx-editor and markdown for backwards compat)
          const existingTab = prevTabs.find(
            (t) =>
              (t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath) ||
              (t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath)
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] Doc tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new MDX editor tab
          tabId = `doc-${sanitizedPath}`;
          const newTab: MDXEditorTab = {
            id: tabId,
            label: fileName,
            contentType: 'mdx-editor',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new doc MDX editor tab:', newTab);
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `doc-${sanitizedPath}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `doc-${sanitizedPath}`,
            'tab.contentType': 'mdx-editor',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // File opened - open file in markdown tab (normal click on docs)
      events.on('file:opened', async (event) => {
        const tracer = getTracer('devworkspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        const payload = event.payload as MDXEditorPayload;
        const filePath = payload.filePath || payload.path;

        if (!filePath) {
          console.warn('[DevWorkspacePanelFramework] No file path in file:opened event');
          return;
        }

        // Only handle markdown files
        if (!filePath.endsWith('.md') && !filePath.endsWith('.mdx')) {
          return;
        }

        const fileName = filePath.split('/').pop() || 'Document';

        console.info('[DevWorkspacePanelFramework] file:opened - opening in tab:', filePath);

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'file:opened',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openFile',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'file:opened',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'file:opened',
            'file.path': filePath,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'file:opened',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) => t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] file:opened tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new markdown tab
          tabId = `file-${sanitizedPath}`;
          const newTab: MarkdownTab = {
            id: tabId,
            label: fileName,
            contentType: 'markdown',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new file:opened markdown tab:', newTab);
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `file-${sanitizedPath}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `file-${sanitizedPath}`,
            'tab.contentType': 'markdown',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
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
        const tracer = getTracer('devworkspace');
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

        // OTEL: Start event dispatch span
        const dispatchSpan = tracer.startSpan('devworkspace.event.dispatch', {
          attributes: {
            'event.name': 'file:open',
            'event.source': event.source || 'unknown',
          },
        });

        // OTEL: Add trigger event
        dispatchSpan.addEvent('devworkspace.trigger.tab', {
          'trigger.source': event.source || 'unknown',
          'trigger.action': 'openFile',
        });

        // OTEL: Add eventbus dispatch event
        dispatchSpan.addEvent('devworkspace.eventbus.dispatch', {
          'event.name': 'file:open',
          'event.source': event.source || 'unknown',
          'handlers.count': 1,
        });

        dispatchSpan.end();

        // OTEL: Start tab handle span
        const handleSpan = tracer.startSpan('devworkspace.tab.handle', {
          attributes: {
            'event.name': 'file:open',
            'file.path': filePath,
          },
        });

        // OTEL: Add handler event
        handleSpan.addEvent('devworkspace.handler.tab', {
          'event.name': 'file:open',
          'event.source': event.source || 'unknown',
        });

        // OTEL: Add loop check event
        handleSpan.addEvent('devworkspace.handler.loopCheck', {
          'event.source': event.source || 'unknown',
          'skipped': false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              ((t.contentType === 'file-editor' && (t as FileEditorTab).filePath === filePath) ||
                (t.contentType === 'mdx-editor' && (t as MDXEditorTab).filePath === filePath) ||
                (t.contentType === 'git-diff' && (t as GitDiffTab).filePath === filePath))
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            console.info('[DevWorkspacePanelFramework] Tab already exists, focusing:', existingTab.id);
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new tab
          // Use file path for deterministic ID (sanitize for valid ID)
          let newTab: FileEditorTab | MDXEditorTab | GitDiffTab;
          if (contentType === 'mdx-editor') {
            tabId = `mdx-editor-${sanitizedPath}`;
            newTab = {
              id: tabId,
              label: fileName,
              contentType: 'mdx-editor',
              filePath: filePath,
              fileName: fileName,
              closable: true,
            };
          } else if (contentType === 'git-diff') {
            tabId = `git-diff-${sanitizedPath}`;
            newTab = {
              id: tabId,
              label: fileName,
              contentType: 'git-diff',
              filePath: filePath,
              fileName: fileName,
              gitStatus: payload.gitStatus,
              closable: true,
            };
          } else {
            tabId = `file-editor-${sanitizedPath}`;
            newTab = {
              id: tabId,
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

        // OTEL: Add tab lookup event
        handleSpan.addEvent('devworkspace.tab.lookup', {
          'tab.id': tabId || `${contentType}-${sanitizedPath}`,
          'tab.exists': tabExists,
        });

        // OTEL: Add tab created event (only if new tab was created)
        if (!tabExists) {
          handleSpan.addEvent('devworkspace.tab.created', {
            'tab.id': tabId || `${contentType}-${sanitizedPath}`,
            'tab.contentType': contentType,
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
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
        const { canvasId, canvas, canvasFileInfo, workflowId, workflow, workflowFileInfo, traceId, spanId, scenarioId, trace } = payload;

        if (!canvasId || !canvas) {
          console.warn('[DevWorkspacePanelFramework] No canvas data in event:', event.payload);
          return;
        }

        setTabs((prevTabs) => {
          // Determine content type based on whether workflow data is present
          // Both canvas and workflow clicks now use CanvasEditorPanel (v0.12.1+)
          // Workflow clicks pass workflowTemplate to show ScenariosList side panel
          const hasWorkflow = !!(workflowId && workflow);

          // Check if tab already exists for this canvas (either canvas-editor or canvas-detail)
          const existingTabIndex = prevTabs.findIndex(
            (t) => {
              // Look for any existing tab for this canvas
              if (t.contentType === 'canvas-detail') {
                return (t as CanvasTab).canvasId === canvasId;
              } else if (t.contentType === 'canvas-editor') {
                return (t as CanvasEditorTab).canvasId === canvasId;
              }
              return false;
            }
          );

          if (existingTabIndex !== -1) {
            // Existing tab found - update it with workflow information (or clear it)
            console.info('[DevWorkspacePanelFramework] Updating existing canvas tab:', prevTabs[existingTabIndex].id, hasWorkflow ? 'with workflow' : 'without workflow');
            const updatedTabs = [...prevTabs];
            const existingTab = updatedTabs[existingTabIndex];

            // Update tab with workflow info, or clear workflow props if just canvas clicked
            if (hasWorkflow) {
              updatedTabs[existingTabIndex] = {
                ...existingTab,
                id: existingTab.id, // Keep the same ID to avoid tab duplication
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
                // Update trace focus fields (for highlighting matched spans)
                selectedTraceId: traceId || null,
                highlightedSpanId: spanId || null,
                selectedScenarioId: scenarioId || null,
                selectedTrace: trace || null,
              } as CanvasTab;
            } else {
              // Clear workflow props - show just the canvas editor
              updatedTabs[existingTabIndex] = {
                id: existingTab.id, // Keep the same ID
                label: canvas.name || canvasId,
                contentType: 'canvas-editor',
                canvasId: canvasId,
                canvasPath: canvas.path,
                canvasName: canvas.name || canvasId,
                canvasFileInfo: canvasFileInfo || null,
                closable: existingTab.closable,
              } as CanvasEditorTab;
            }

            setFocusTabId(existingTab.id);
            return updatedTabs; // Tab updated, will be focused
          }

          // Create new canvas tab (use canvas-detail type if workflow present for proper rendering)
          const contentType = hasWorkflow ? 'canvas-detail' : 'canvas-editor';
          const newTab: CanvasEditorTab | CanvasTab = hasWorkflow
            ? {
                id: `canvas-${canvasId}`,
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
                // Trace focus fields (for highlighting matched spans from TraceListPanel)
                selectedTraceId: traceId || null,
                highlightedSpanId: spanId || null,
                selectedScenarioId: scenarioId || null,
                selectedTrace: trace || null,
                closable: true,
              } as CanvasTab
            : {
                id: `canvas-${canvasId}`,
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
      // Multi-canvas open - create tab (from storyboard-list-panel "View All" button)
      events.on('custom', (event) => {
        const payload = event.payload as MultiCanvasOpenPayload;

        // Only handle openMultiCanvas action from storyboard-list-panel
        if (payload.action !== 'openMultiCanvas' || event.source !== 'storyboard-list-panel') {
          return;
        }

        console.info('[DevWorkspacePanelFramework] Received multi-canvas open event:', event);
        const { canvases, canvasType } = payload;

        if (!canvases || canvases.length === 0) {
          console.warn('[DevWorkspacePanelFramework] No canvases in multi-canvas event:', event.payload);
          return;
        }

        setTabs((prevTabs) => {
          // Check if multi-canvas tab already exists for this canvas type
          const existingTabIndex = prevTabs.findIndex(
            (t) => t.contentType === 'multi-canvas' && (t as MultiCanvasTab).canvasType === canvasType
          );

          const tabId = `multi-canvas-${canvasType}`;
          const tabLabel = canvasType === 'otel' ? 'All OTEL Canvases' : 'All Architecture Canvases';

          if (existingTabIndex !== -1) {
            // Update existing tab with new canvases
            console.info('[DevWorkspacePanelFramework] Updating existing multi-canvas tab');
            const updatedTabs = [...prevTabs];
            updatedTabs[existingTabIndex] = {
              ...updatedTabs[existingTabIndex],
              canvases,
              canvasType,
            } as MultiCanvasTab;
            setFocusTabId(tabId);
            return updatedTabs;
          }

          // Create new multi-canvas tab
          const newTab: MultiCanvasTab = {
            id: tabId,
            label: tabLabel,
            contentType: 'multi-canvas',
            canvases,
            canvasType,
            closable: true,
          };

          console.info('[DevWorkspacePanelFramework] Creating new multi-canvas tab:', newTab);
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

  // Listen for terminal session selection from TerminalSessionsPanel
  useEffect(() => {
    const unsubscribe = events.on('principal-ade.terminal-sessions:session-selected', (event) => {
      console.info('[DevWorkspacePanelFramework] Terminal session selected:', event);
      const payload = event.payload as { sessionId: string };

      if (payload?.sessionId) {
        // Switch to terminal panel in middle and focus the selected session tab
        onLayoutChange({ ...layout, middle: 'terminal' });
        setFocusTabId(payload.sessionId);
      }
    });

    return unsubscribe;
  }, [events, layout, onLayoutChange]);

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
                context={contextRef.current}
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

          // Use CanvasEditorPanel with workflow integration (v0.12.1+)
          // This replaces WorkflowScenariosPanel with unified canvas+scenarios experience
          if (!CanvasEditorPanelComponent) {
            return (
              <div style={{ padding: '2rem', color: theme.colors.textSecondary }}>
                Canvas Editor panel not available
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
              <CanvasEditorPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                canvasPath={canvasTab.canvasPath}
                canvasName={canvasTab.canvasName}
                canvasFileInfo={canvasTab.canvasFileInfo}
                // Workflow props - enables ScenariosList side panel
                workflowTemplate={canvasTab.narrativeTemplate}
                selectedWorkflowId={canvasTab.selectedNarrativeId}
                workflowPath={canvasTab.narrativePath}
                workflowFileInfo={canvasTab.narrativeFileInfo}
                // Trace integration props - for auto-selecting scenario and template interpolation
                selectedScenarioId={canvasTab.selectedScenarioId}
                selectedTrace={canvasTab.selectedTrace}
                traceMatchInfo={canvasTab.selectedTrace?.scenarioMatches?.map((m) => ({
                  scenarioId: m.scenarioId,
                  matchType: (m.matchType || 'full') as 'full' | 'partial',
                  coveragePercent: m.coveragePercent,
                }))}
              />
            </div>
          );
        }

        case 'multi-canvas': {
          // Type assertion for TypeScript
          const multiCanvasTab = tab as MultiCanvasTab;

          console.info('[DevWorkspacePanelFramework] Rendering multi-canvas tab:', {
            canvasCount: multiCanvasTab.canvases.length,
            canvasType: multiCanvasTab.canvasType,
            isActive,
          });

          // Map canvases to canvasInfos format (id, path, label)
          const canvasInfos = multiCanvasTab.canvases.map((c) => ({
            id: c.id,
            path: c.canvas.path,
            label: c.label || c.canvas.name,
          }));

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: theme.colors.background,
              }}
            >
              <MultiCanvasPanel
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                canvasInfos={canvasInfos}
                showGroups={true}
                showControls={true}
                showBackground={true}
                showMinimap={true}
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
    [theme, SkillDetailPanelComponent, MarkdownPanelComponent, CanvasEditorPanelComponent, FileEditorPanelComponent, MDXEditorPanelComponent, GitDiffPanelComponent],
  );

  // Define all panels using panel framework components
  const allPanels = useMemo(
    () => [
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
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
              workingStates={workingStates}
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
            {/* History toolbar */}
            {rightPanelHistory.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  padding: '4px 8px',
                  borderBottom: '1px solid var(--color-border, #333)',
                  backgroundColor: 'var(--color-bg-secondary, #1a1a1a)',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setShowRightPanelHistory(!showRightPanelHistory)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: showRightPanelHistory ? 'var(--color-bg-tertiary, #2a2a2a)' : 'transparent',
                    border: '1px solid var(--color-border, #444)',
                    borderRadius: '4px',
                    color: 'var(--color-text-secondary, #aaa)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  title="View history"
                >
                  <History size={14} />
                  <span>{rightPanelHistory.length}</span>
                </button>
                {showRightPanelHistory && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: '8px',
                      zIndex: 100,
                      backgroundColor: 'var(--color-bg-secondary, #1a1a1a)',
                      border: '1px solid var(--color-border, #444)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      minWidth: '250px',
                      maxWidth: '400px',
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--color-border, #333)',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #aaa)' }}>
                        Recent Documents
                      </span>
                      <button
                        onClick={() => setShowRightPanelHistory(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          color: 'var(--color-text-tertiary, #666)',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {rightPanelHistory.map((item) => (
                      <button
                        key={item.filePath}
                        onClick={() => handleHistoryItemClick(item.filePath)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--color-border, #222)',
                          color: 'var(--color-text-primary, #fff)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '13px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary, #2a2a2a)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <FileText size={14} style={{ flexShrink: 0, color: 'var(--color-text-secondary, #888)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.fileName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <MarkdownPanelComponent
                context={context}
                actions={actions}
                events={events}
              />
            </div>
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
      {
        id: 'terminalSessions',
        label: 'Terminal Sessions',
        content: (
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
            <TerminalSessionsPanel
              context={context}
              actions={actions}
              events={events}
              tracer={getTracer('terminal-sessions-panel')}
            />
          </div>
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
        {/* Left Panel Icon Sidebar */}
        {!sidebarsHidden && (
          <PanelIconSidebar
            currentPanelId={typeof layout.left === 'string' ? layout.left : ''}
            onPanelChange={(panelId) => onLayoutChange({ ...layout, left: panelId })}
            theme={theme}
            collapsed={collapsed.left}
            onExpand={() => onCollapsedChange({ ...collapsed, left: false })}
            onCollapse={() => onCollapsedChange({ ...collapsed, left: true })}
            position="left"
            showCollapseButton
          />
        )}

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
          // Key forces remount when sizes are programmatically changed
          key={`layout-${layoutResetKey}`}
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
          onLeftCollapseComplete={onLeftCollapseComplete}
          onLeftExpandComplete={onLeftExpandComplete}
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
                  context={context}
                  actions={actions}
                  events={events}
                  // Note: Panel is event-driven. The issue:selected event that opened this modal
                  // needs to be re-emitted for the panel to display the issue.
                  // TODO: Add useEffect to re-emit issue:selected with source='modal' after mount
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

      {/* Right Panel Icon Sidebar */}
      {!sidebarsHidden && (
        <PanelIconSidebar
          currentPanelId={typeof layout.right === 'string' ? layout.right : ''}
          onPanelChange={(panelId) => onLayoutChange({ ...layout, right: panelId })}
          theme={theme}
          collapsed={collapsed.right}
          onExpand={() => onCollapsedChange({ ...collapsed, right: false })}
          onCollapse={() => onCollapsedChange({ ...collapsed, right: true })}
          position="right"
          panelIcons={RIGHT_PANEL_ICONS}
          showCollapseButton
          onOpenInWebADE={onOpenInWebADE}
          onOpenGitHubActions={onOpenGitHubActions}
          onSplitPanels={onPanelSizesChange ? () => {
            // Set 50/50 split between middle and right
            onPanelSizesChange({ left: 0, middle: 50, right: 50 });
            // Collapse left panel, expand right
            onCollapsedChange({ left: true, right: false });
            // Signal that we're waiting for the size change to propagate
            setPendingSplit(true);
          } : undefined}
          customButtons={
            <StorybookSidebarButton
              theme={theme}
              packages={context.packages?.data?.packages}
              repositoryPath={context.currentScope?.repository?.path}
              repositoryOwner={context.currentScope?.repository?.owner as string | undefined}
              repositoryName={context.currentScope?.repository?.name}
              currentLayout={layout as { left: string; middle: string; right: string }}
              onLayoutChange={onLayoutChange}
              collapsed={collapsed}
              onCollapsedChange={onCollapsedChange}
              onPanelSizesChange={onPanelSizesChange}
              events={events}
            />
          }
        />
      )}
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
  traceSourceServiceName: _traceSourceServiceName,
  onScopeNamesDiscovered,
  onServiceTraceCountsChange,
  onLeftCollapseComplete,
  onLeftExpandComplete,
  onOpenInWebADE,
  onOpenGitHubActions,
  sidebarsHidden,
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
      openTabs={tabsForProvider}
      onScopeNamesDiscovered={onScopeNamesDiscovered}
      onServiceTraceCountsChange={onServiceTraceCountsChange}
    >
      <TerminalProvider
        repositoryPath={repositoryPath}
        terminalContext={terminalContext}
        repoName={repositoryMetadata.name}
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
            onLeftCollapseComplete={onLeftCollapseComplete}
            onLeftExpandComplete={onLeftExpandComplete}
            onOpenInWebADE={onOpenInWebADE}
            onOpenGitHubActions={onOpenGitHubActions}
            sidebarsHidden={sidebarsHidden}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </RepositoryPanelProvider>
  );
};
