/* eslint-disable max-lines */
// This file contains complex panel orchestration logic that is difficult to split
// without breaking the tight coupling between panel state, tabs, and terminal context.
// TODO: Consider extracting panel definitions to separate files in future refactor.

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
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
  Send,
  Gauge,
  Building2,
  Image,
  Film,
} from 'lucide-react';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
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
import {
  TabbedTerminalPanel,
  type BaseTab,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalActivityChangedEvent,
  type TabAssociations,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import {
  panels as principalViewPanels,
  TraceDetailsPanel,
  CanvasEditorPanel,
  StoryboardListPanel,
  TraceListPanel,
  MultiCanvasPanel,
  DashboardPanel,
  type CanvasEditorPanelProps,
} from '@industry-theme/principal-view-panels';
import type {
  RegisteredTrace,
  DiscoveredDashboard,
} from '@principal-ai/principal-view-core';
import type { WorkflowTemplate } from '@principal-ai/principal-view-core';
import type { FileInfo } from '@principal-ai/repository-abstraction';
import {
  CodeCityPanel,
  type CodeCityPanelPropsTyped,
} from '@industry-theme/file-city-panel';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { panels as localhostBrowserPanels } from '@industry-theme/localhost-panels';
import {
  EventBusPanel,
  AgentToolsPanel,
} from '@industry-theme/agent-driven-ui-panels';
import {
  DependencyGraphPanelContent,
  GitChangesPanel,
  PackageCompositionPanel,
  FileCity3DPanelContent,
  buildCityDataFromFileTree,
  estimateLineCounts,
  enrichWithLineCounts,
  type PackageLayer,
  type CityData,
} from '@industry-theme/repository-composition-panels';
import { panels as codeQualityPanels } from '@principal-ade/code-quality-panels';
import {
  MarkdownPanel,
  type MarkdownPanelProps,
} from '@industry-theme/markdown-panels';
import {
  FileEditorPanel,
  GitDiffPanel,
  MDXEditorPanel,
  type FileEditorPanelProps,
  type MDXEditorPanelProps,
  type GitDiffPanelProps,
} from '@industry-theme/file-editing-panels';
import { panels as backlogPanels } from '@industry-theme/backlogmd-kanban-panel';
import {
  panels as brunoPanels,
  type BrunoRequest,
} from '@principal-ade/bruno-panels';
import {
  panels as agentPanels,
  type Skill,
  type SkillDetailPanelProps,
} from '@industry-theme/agent-panels';
import {
  GitHubIssuesPanel,
  GitHubIssueDetailPanel,
} from '@industry-theme/github-panels';
import { panels as typeInformationPanels } from '../panels/TypeInformationPanel';
import { TerminalSessionsPanel } from '../panels/terminal-sessions';
import { MediaViewerPanel } from '../panels/MediaViewerPanel';
import type { Repository } from '../../shared/types/repository.types';
import {
  PanelIconSidebar,
  RIGHT_PANEL_ICONS,
} from '../components/Sidebar/PanelIconSidebar';
import { StorybookSidebarButton } from '../components/Sidebar/StorybookSidebarButton';
import { NextjsSidebarButton } from '../components/Sidebar/NextjsSidebarButton';
import { NotesSidebarButton } from '../components/Sidebar/NotesSidebarButton';
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
 * Tab type for media viewer (images and videos)
 */
interface MediaTab extends BaseTab {
  contentType: 'media';
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
 * Tab type for Bruno API request panel
 */
interface BrunoRequestTab extends BaseTab {
  contentType: 'bruno-request';
  requestId: string;
  requestName: string;
  request: BrunoRequest;
  environment?: Record<string, string>;
  environmentName?: string;
}

/**
 * Tab type for observability dashboard panel
 */
interface DashboardTab extends BaseTab {
  contentType: 'dashboard';
  dashboardId: string;
  dashboardPath: string;
  dashboardName: string;
  dashboard: DiscoveredDashboard;
}

/**
 * Tab type for FileCity 3D visualization panel
 */
interface FileCity3DTab extends BaseTab {
  contentType: 'file-city-3d';
  cityData: CityData;
}

/**
 * Props for the Bruno RequestPanel including optional selected request
 */
interface BrunoRequestPanelProps {
  context: unknown;
  actions: unknown;
  events: PanelEventEmitter;
  selectedRequest?: BrunoRequest;
  selectedRequestId?: string;
  selectedEnvironment?: Record<string, string>;
  selectedEnvironmentName?: string;
}

/**
 * Union type of all tab types used in DevWorkspace
 */
type DevWorkspaceTab =
  | TerminalTab
  | SkillTab
  | MarkdownTab
  | CanvasEditorTab
  | CanvasTab
  | FileEditorTab
  | MediaTab
  | MDXEditorTab
  | GitDiffTab
  | DependencyGraphTab
  | TraceDetailsTab
  | MultiCanvasTab
  | BrunoRequestTab
  | DashboardTab
  | FileCity3DTab;

/**
 * History item for right panel document viewing
 */
interface RightPanelHistoryItem {
  filePath: string;
  fileName: string;
  openedAt: number;
}

/**
 * Imperative handle for controlling panel collapse/expand
 */
export interface PanelControlHandle {
  collapseLeft: () => void;
  expandLeft: () => void;
  collapseRight: () => void;
  expandRight: () => void;
  setLayout: (sizes: { left: number; middle: number; right: number }) => void;
  getLayout: () => { left: number; middle: number; right: number } | null;
}

export interface DevWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  /** Panel sizes - only used for preset changes (e.g., Storybook layout) */
  panelSizes?: { left: number; middle: number; right: number };
  /** Callback when panel sizes change (from user drag) */
  onPanelSizesChange?: (sizes: {
    left: number;
    middle: number;
    right: number;
  }) => void;
  /** Callback to receive panel control methods for imperative collapse/expand */
  onPanelControlReady?: (control: PanelControlHandle) => void;
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Trace source service name for OTEL routing */
  traceSourceServiceName?: string;
  /** Callback when scope names are discovered from library.yaml */
  onScopeNamesDiscovered?: (scopeNames: string[]) => void;
  /** Callback when service trace counts change */
  onServiceTraceCountsChange?: (
    counts: Map<string, number>,
    lastActiveService: string | null,
  ) => void;
  /** Callback when left panel collapse animation completes */
  onLeftCollapseComplete?: () => void;
  /** Callback when left panel expand animation completes */
  onLeftExpandComplete?: () => void;
  /** Callback to open in Web-ADE */
  onOpenInWebADE?: () => void;
  /** Callback to open GitHub Actions */
  onOpenGitHubActions?: () => void;
  /** Callback to open GitHub repository */
  onOpenGitHubRepo?: () => void;
  /** Hide the icon sidebars (focus mode) */
  sidebarsHidden?: boolean;
}

interface DevWorkspacePanelFrameworkInnerProps {
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: {
    left: number;
    middle: number;
    right: number;
  }) => void;
  onPanelControlReady?: (control: PanelControlHandle) => void;
  onTabsChange?: (tabs: unknown[]) => void;
  onLeftCollapseComplete?: () => void;
  onLeftExpandComplete?: () => void;
  onOpenInWebADE?: () => void;
  onOpenGitHubActions?: () => void;
  onOpenGitHubRepo?: () => void;
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
      activityHeatmap: context.activityHeatmap,
      lineCounts: context.lineCounts,
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
> = ({
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
  panelSizes,
  onPanelSizesChange,
  onPanelControlReady,
  onTabsChange,
  onLeftCollapseComplete,
  onLeftExpandComplete,
  onOpenInWebADE,
  onOpenGitHubActions,
  onOpenGitHubRepo,
  sidebarsHidden,
}) => {
  const { theme } = useTheme();

  // Ref for imperative panel layout control
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);
  // Track if we're applying a preset layout (setLayout for presets like Storybook)
  const isApplyingPresetRef = useRef(false);

  // Derive collapsed state from actual layout
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  const [isRightCollapsed, setIsRightCollapsed] = useState(collapsed.right);

  // Store callbacks and state in refs to avoid stale closures
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  onCollapsedChangeRef.current = onCollapsedChange;
  const collapsedStateRef = useRef({
    left: isLeftCollapsed,
    right: isRightCollapsed,
  });

  // Keep ref in sync with state
  useEffect(() => {
    collapsedStateRef.current = {
      left: isLeftCollapsed,
      right: isRightCollapsed,
    };
  }, [isLeftCollapsed, isRightCollapsed]);

  // Provide panel control methods to parent via callback (only once on mount)
  useEffect(() => {
    if (onPanelControlReady && panelLayoutRef.current) {
      const control: PanelControlHandle = {
        collapseLeft: () => {
          panelLayoutRef.current?.collapsePanel('left');
          setIsLeftCollapsed(true);
          collapsedStateRef.current.left = true;
          onCollapsedChangeRef.current({ ...collapsedStateRef.current });
        },
        expandLeft: () => {
          panelLayoutRef.current?.expandPanel('left');
          // After expand, ensure panel is at least 20% (library may restore to small size)
          const currentLayout = panelLayoutRef.current?.getLayout();
          if (currentLayout && currentLayout.left < 20) {
            panelLayoutRef.current?.setLayout({
              left: 25,
              middle: 50,
              right: currentLayout.right,
            });
          }
          setIsLeftCollapsed(false);
          collapsedStateRef.current.left = false;
          onCollapsedChangeRef.current({ ...collapsedStateRef.current });
        },
        collapseRight: () => {
          panelLayoutRef.current?.collapsePanel('right');
          setIsRightCollapsed(true);
          collapsedStateRef.current.right = true;
          onCollapsedChangeRef.current({ ...collapsedStateRef.current });
        },
        expandRight: () => {
          panelLayoutRef.current?.expandPanel('right');
          // After expand, ensure panel is at least 20% (library may restore to small size)
          const currentLayout = panelLayoutRef.current?.getLayout();
          if (currentLayout && currentLayout.right < 20) {
            panelLayoutRef.current?.setLayout({
              left: currentLayout.left,
              middle: 50,
              right: 25,
            });
          }
          setIsRightCollapsed(false);
          collapsedStateRef.current.right = false;
          onCollapsedChangeRef.current({ ...collapsedStateRef.current });
        },
        setLayout: (sizes) => {
          isApplyingPresetRef.current = true;
          panelLayoutRef.current?.setLayout(sizes);
          // Update collapsed state based on sizes
          const newLeft = sizes.left < 5;
          const newRight = sizes.right < 5;
          setIsLeftCollapsed(newLeft);
          setIsRightCollapsed(newRight);
          collapsedStateRef.current = { left: newLeft, right: newRight };
          onCollapsedChangeRef.current({ left: newLeft, right: newRight });
          setTimeout(() => {
            isApplyingPresetRef.current = false;
          }, 500);
        },
        getLayout: () => panelLayoutRef.current?.getLayout() ?? null,
      };
      onPanelControlReady(control);
    }
  }, [onPanelControlReady]);

  // Track if we've done initial setup
  const hasInitializedRef = useRef(false);

  // When panelSizes prop changes (e.g., from preset like Storybook button), apply it
  // Skip initial render - let the library use defaultSizes
  useEffect(() => {
    if (panelSizes && panelLayoutRef.current) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        return;
      }
      isApplyingPresetRef.current = true;
      panelLayoutRef.current.setLayout(panelSizes);
      // Don't set collapsed state here - let ConfigurablePanelLayout's
      // onLeftCollapseComplete/onRightCollapseComplete callbacks handle it
      // after the animation finishes
      setTimeout(() => {
        isApplyingPresetRef.current = false;
      }, 500);
    }
  }, [panelSizes]);

  // Collapse/expand handlers for sidebar buttons (still supported)
  const handleLeftCollapse = useCallback(() => {
    panelLayoutRef.current?.collapsePanel('left');
    setIsLeftCollapsed(true);
    collapsedStateRef.current.left = true;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
  }, []);

  const handleLeftExpand = useCallback(() => {
    panelLayoutRef.current?.expandPanel('left');
    // After expand, ensure panel is at least 20% (library may restore to small size)
    const currentLayout = panelLayoutRef.current?.getLayout();
    if (currentLayout && currentLayout.left < 20) {
      panelLayoutRef.current?.setLayout({
        left: 25,
        middle: 50,
        right: currentLayout.right,
      });
    }
    setIsLeftCollapsed(false);
    collapsedStateRef.current.left = false;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
  }, []);

  const handleRightCollapse = useCallback(() => {
    panelLayoutRef.current?.collapsePanel('right');
    setIsRightCollapsed(true);
    collapsedStateRef.current.right = true;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
  }, []);

  const handleRightExpand = useCallback(() => {
    panelLayoutRef.current?.expandPanel('right');
    // After expand, ensure panel is at least 20% (library may restore to small size)
    const currentLayout = panelLayoutRef.current?.getLayout();
    if (currentLayout && currentLayout.right < 20) {
      panelLayoutRef.current?.setLayout({
        left: currentLayout.left,
        middle: 50,
        right: 25,
      });
    }
    setIsRightCollapsed(false);
    collapsedStateRef.current.right = false;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
  }, []);

  // Internal handlers for when ConfigurablePanelLayout completes collapse/expand animations
  // These update local state and call the parent callback
  const handleLeftCollapseCompleteInternal = useCallback(() => {
    setIsLeftCollapsed(true);
    collapsedStateRef.current.left = true;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
    onLeftCollapseComplete?.();
  }, [onLeftCollapseComplete]);

  const handleLeftExpandCompleteInternal = useCallback(() => {
    setIsLeftCollapsed(false);
    collapsedStateRef.current.left = false;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
    onLeftExpandComplete?.();
  }, [onLeftExpandComplete]);

  const handleRightCollapseCompleteInternal = useCallback(() => {
    setIsRightCollapsed(true);
    collapsedStateRef.current.right = true;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
  }, []);

  const handleRightExpandCompleteInternal = useCallback(() => {
    setIsRightCollapsed(false);
    collapsedStateRef.current.right = false;
    onCollapsedChangeRef.current({ ...collapsedStateRef.current });
  }, []);

  // Handle resize from user drag - just update local collapsed state
  const handlePanelResizeInternal = useCallback(
    (sizes: { left: number; middle: number; right: number }) => {
      // Update collapsed state based on resize
      const newLeftCollapsed = sizes.left < 5;
      const newRightCollapsed = sizes.right < 5;
      setIsLeftCollapsed(newLeftCollapsed);
      setIsRightCollapsed(newRightCollapsed);
      collapsedStateRef.current = {
        left: newLeftCollapsed,
        right: newRightCollapsed,
      };
      // Update parent collapsed state (but NOT panelSizes - no feedback loop)
      onCollapsedChangeRef.current({
        left: newLeftCollapsed,
        right: newRightCollapsed,
      });
    },
    [],
  );

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
    const activityTracer = getTracer('principal-ade-dev-workspace');

    const unsubscribe = events.on('terminal:activity-changed', (event) => {
      if (event.type === 'terminal:activity-changed') {
        const payload = event.payload as TerminalActivityChangedEvent;

        // Start span for host handling the activity event
        const span = activityTracer.startSpan('terminal.activity.host_handle');

        try {
          // Event: Host received the activity change from terminal panel
          span.addEvent('terminal.activity.host_received', {
            'session.id': payload.sessionId,
            is_working: payload.isWorking,
            'handler.name': 'onTerminalActivityChanged',
          });

          // Event: TIPC invoked to update activity in main process
          span.addEvent('terminal.activity.tipc_invoked', {
            'procedure.name': 'updateActivity',
            is_working: payload.isWorking,
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

  // Sync tabs to parent whenever they change (for RepositoryPanelProvider)
  useEffect(() => {
    const customTabs = tabs.filter((t) => t.contentType !== 'terminal');
    onTabsChange?.(customTabs);
  }, [tabs, onTabsChange]);

  // Tab associations - map of terminal tab IDs to associated content tabs
  const [associations, setAssociations] = useState<TabAssociations>({});

  // Store associated tab data separately (since we remove them from the tab list)
  const [associatedTabData, setAssociatedTabData] = useState<
    Record<string, DevWorkspaceTab>
  >({});

  // Handler for when a tab is dropped onto a terminal to create an association
  const handleTabAssociate = useCallback(
    (terminalTabId: string, associatedTabId: string) => {
      // Find the tab data before removing it
      setTabs((prevTabs) => {
        const tabToAssociate = prevTabs.find((t) => t.id === associatedTabId);
        if (tabToAssociate) {
          // Store the tab data for rendering
          setAssociatedTabData((prev) => ({
            ...prev,
            [associatedTabId]: tabToAssociate,
          }));
        }
        // Remove the associated tab from the tab list
        return prevTabs.filter((t) => t.id !== associatedTabId);
      });

      // Create the association
      setAssociations((prev) => ({
        ...prev,
        [terminalTabId]: {
          associatedTabId,
          collapsed: false,
          ratio: 0.4,
        },
      }));
    },
    [],
  );

  // Handler for when an association's collapsed state changes
  const handleAssociationCollapsedChange = useCallback(
    (tabId: string, collapsed: boolean) => {
      setAssociations((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          collapsed,
        },
      }));
    },
    [],
  );

  // Handler for when an association's split ratio changes
  const handleAssociationRatioChange = useCallback(
    (tabId: string, ratio: number) => {
      setAssociations((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          ratio,
        },
      }));
    },
    [],
  );

  // Focus tab state - when set, TabbedTerminalPanel will activate the tab and call onFocusTabHandled
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const handleFocusTabHandled = useCallback(() => setFocusTabId(null), []);

  // Show all terminals state - when true, shows terminals from other windows
  const [showAllTerminals, setShowAllTerminals] = useState(false);

  // Right panel history - tracks documents opened in the right panel for quick navigation
  const [rightPanelHistory, setRightPanelHistory] = useState<
    RightPanelHistoryItem[]
  >([]);
  const [showRightPanelHistory, setShowRightPanelHistory] = useState(false);

  // Handle clicking on a history item to re-open that file
  const handleHistoryItemClick = useCallback(
    async (filePath: string) => {
      setShowRightPanelHistory(false);
      await actions.setActiveFile?.(filePath);
      // Move to front of history
      const fileName = filePath.split('/').pop() || 'Document';
      setRightPanelHistory((prev) => {
        const filtered = prev.filter((item) => item.filePath !== filePath);
        return [{ filePath, fileName, openedAt: Date.now() }, ...filtered];
      });
    },
    [actions],
  );

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
  const handleTabsChange = useCallback(
    (newTabs: DevWorkspaceTab[]) => {
      setTabs((prevTabs) => {
        // Only keep custom tabs from the update (filter out terminal tabs)
        // Terminal tabs are managed by TabbedTerminalPanel, we only care about custom tabs
        const newCustomTabs = newTabs.filter(
          (t) => t.contentType !== 'terminal',
        );
        const prevCustomTabs = prevTabs.filter(
          (t) => t.contentType !== 'terminal',
        );

        // Check if custom tabs actually changed
        const customTabsChanged =
          newCustomTabs.length !== prevCustomTabs.length ||
          !newCustomTabs.every((tab) =>
            prevCustomTabs.some((prev) => prev.id === tab.id),
          );

        if (!customTabsChanged) {
          return prevTabs; // No change
        }

        return newCustomTabs; // Only store custom tabs
      });
    },
    [],
  );

  // Direct imports instead of array access to avoid type inference issues
  const CanvasEditorPanelComponent =
    CanvasEditorPanel as React.ComponentType<CanvasEditorPanelProps>;
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
  const MarkdownPanelComponent =
    MarkdownPanel as React.ComponentType<MarkdownPanelProps>;
  const FileEditorPanelComponent =
    FileEditorPanel as React.ComponentType<FileEditorPanelProps>;
  const GitDiffPanelComponent =
    GitDiffPanel as React.ComponentType<GitDiffPanelProps>;
  const MDXEditorPanelComponent =
    MDXEditorPanel as React.ComponentType<MDXEditorPanelProps>;

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

  // Bruno API panels
  const BrunoCollectionPanelComponent = brunoPanels.find(
    (p) => p.metadata?.id === 'principal-ade.bruno-collection',
  )?.component;

  const BrunoRequestPanelComponent = brunoPanels.find(
    (p) => p.metadata?.id === 'principal-ade.bruno-request',
  )?.component as React.ComponentType<BrunoRequestPanelProps> | undefined;

  const TypeInformationPanelComponent = typeInformationPanels.find(
    (p) => p.metadata?.id === 'principal-ade.type-information',
  )?.component; // Cannot convert - local panel, component not exported

  // Listen for doc:openInRightPanel events (from Alexandria docs panel context menu)
  useEffect(() => {
    const tracer = getTracer('principal-ade-dev-workspace');
    const unsubscribe = events.on('doc:openInRightPanel', async (event) => {
      const doc = event.payload as DocumentSelectedPayload;

      // Get the file path (prefer absolute path, fall back to relative)
      const filePath = doc.path || doc.relativePath;

      if (!filePath) {
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
        setRightPanelHistory((prev) => {
          const filtered = prev.filter((item) => item.filePath !== filePath);
          return [
            { filePath, fileName, openedAt: Date.now() },
            ...filtered,
          ].slice(0, 20);
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
        if (isRightCollapsed) {
          handleRightExpand();
        }

        // OTEL: Add layout.changed event
        handleSpan.addEvent('devworkspace.layout.changed', {
          'panel.slot': 'right',
          'panel.new': 'markdown-viewer',
          'panel.expanded': !isRightCollapsed || true,
        });

        handleSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        handleSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        handleSpan.end();
      }
    });

    return unsubscribe;
  }, [
    events,
    actions,
    layout,
    onLayoutChange,
    collapsed,
    onCollapsedChange,
    isRightCollapsed,
    handleRightExpand,
  ]);

  // Listen for detail panel events to show modals
  useEffect(() => {
    const unsubscribers = [
      // Task detail - open task markdown file in markdown tab
      events.on('task:selected', (event) => {
        const tracer = getTracer('principal-ade-dev-workspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;
        const payload = event.payload as TaskSelectedPayload;
        const task = payload.task;

        if (!task || !task.filePath) {
          return;
        }

        const filePath = task.filePath;
        const fileName = task.title || filePath.split('/').pop() || 'Task';

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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'markdown' &&
              (t as MarkdownTab).filePath === filePath,
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new markdown tab
          // Use file path for deterministic ID (sanitize for valid ID)
          tabId = `task-${sanitizedPath}`;
          const newTab: MarkdownTab = {
            id: tabId,
            label: fileName,
            contentType: 'markdown',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };
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
            'tab.contentType': 'markdown',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // Skill detail - create tab instead of modal
      events.on('skill:selected', (event) => {
        const tracer = getTracer('principal-ade-dev-workspace');

        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          return;
        }
        const payload = event.payload as SkillSelectedPayload;

        // Extract skill data
        const skill = payload.skill;
        if (!skill) {
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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';

        setTabs((prevTabs) => {
          // Check if tab already exists for this skill
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'skill' && (t as SkillTab).skillId === skill.id,
          );

          if (existingTab) {
            // Tab exists - focus it
            tabExists = true;
            tabId = existingTab.id;
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
        const tracer = getTracer('principal-ade-dev-workspace');

        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          return;
        }

        const payload = event.payload as TraceSelectedPayload;

        // Extract trace data
        const trace = payload.trace;
        if (!trace || !trace.traceId) {
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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';

        setTabs((prevTabs) => {
          // Check if tab already exists for this trace
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'trace-details' &&
              (t as TraceDetailsTab).traceId === trace.traceId,
          );

          if (existingTab) {
            // Tab exists - focus it
            tabExists = true;
            tabId = existingTab.id;
            setFocusTabId(existingTab.id);
            return prevTabs; // No change to tabs array
          }

          // The trace is already a fully processed RegisteredTrace from TraceOrchestrator
          // Just use it directly - no conversion needed
          const registeredTrace = trace as RegisteredTrace;
          const traceName =
            registeredTrace.name || registeredTrace.traceId.substring(0, 8);

          tabId = `trace-${registeredTrace.traceId}`;
          const newTab: TraceDetailsTab = {
            id: tabId,
            label: traceName,
            contentType: 'trace-details',
            traceId: registeredTrace.traceId,
            traceData: registeredTrace,
            closable: true,
          };
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
        const tracer = getTracer('principal-ade-dev-workspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;
        const payload = event.payload as AgentSelectedPayload;
        const agent = payload.data;

        if (!agent || !agent.path) {
          return;
        }

        // Get repository path from context
        const repoPath = context.currentScope?.repository?.path;
        if (!repoPath) {
          return;
        }

        // Construct full file path (agent.path is relative like "AGENTS.md" or "packages/foo/AGENTS.md")
        const filePath = `${repoPath}/${agent.path}`;
        const fileName =
          agent.name || agent.path.split('/').pop() || 'AGENTS.md';

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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'markdown' &&
              (t as MarkdownTab).filePath === filePath,
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new markdown tab
          // Use file path for deterministic ID (sanitize for valid ID)
          tabId = `agent-${sanitizedPath}`;
          const newTab: MarkdownTab = {
            id: tabId,
            label: fileName,
            contentType: 'markdown',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };
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
            'tab.contentType': 'markdown',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // Doc open in tab - open documentation file in markdown tab
      events.on('doc:openInTab', async (event) => {
        const tracer = getTracer('principal-ade-dev-workspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        const doc = event.payload as DocumentSelectedPayload;

        // Get the file path (prefer absolute path, fall back to relative)
        const filePath = doc.path || doc.relativePath;

        if (!filePath) {
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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'markdown' &&
              (t as MarkdownTab).filePath === filePath,
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new markdown tab
          tabId = `doc-${sanitizedPath}`;
          const newTab: MarkdownTab = {
            id: tabId,
            label: fileName,
            contentType: 'markdown',
            filePath: filePath,
            fileName: fileName,
            closable: true,
          };
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
            'tab.contentType': 'markdown',
          });
        }

        handleSpan.setStatus({ code: SpanStatusCode.OK });
        handleSpan.end();
      }),
      // File opened - open file in markdown tab (normal click on docs)
      events.on('file:opened', async (event) => {
        const tracer = getTracer('principal-ade-dev-workspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;

        const payload = event.payload as MDXEditorPayload;
        const filePath = payload.filePath || payload.path;

        if (!filePath) {
          return;
        }

        // Only handle markdown files
        if (!filePath.endsWith('.md') && !filePath.endsWith('.mdx')) {
          return;
        }

        const fileName = filePath.split('/').pop() || 'Document';

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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'markdown' &&
              (t as MarkdownTab).filePath === filePath,
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
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
        const payload = event.payload as IssueSelectedPayload;
        setDetailModal({
          panelId: 'githubIssueDetail',
          data: payload.issue,
        });
      }),
      // File open from git changes panel
      events.on('file:open', (event) => {
        const tracer = getTracer('principal-ade-dev-workspace');
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') return;
        const payload = event.payload as FileOpenedPayload;

        // Resolve relative paths to absolute paths using repository root
        let filePath = payload.path;
        if (!filePath.startsWith('/')) {
          const repoPath = contextRef.current?.currentScope?.repository?.path;
          if (repoPath) {
            filePath = `${repoPath}/${filePath}`;
          }
        }

        const fileName = filePath.split('/').pop() || 'File';

        // Check file type
        const isMarkdown =
          filePath.endsWith('.md') || filePath.endsWith('.mdx');
        const isMedia =
          /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|ogv)$/i.test(
            filePath,
          );

        // Determine content type based on file extension
        // - Media files (images/videos) open in media viewer
        // - Markdown files open in markdown viewer
        // - Other files: use git diff panel for modified files, file editor for new/untracked files
        let contentType: 'markdown' | 'git-diff' | 'file-editor' | 'media';
        if (isMedia) {
          contentType = 'media';
        } else if (isMarkdown) {
          contentType = 'markdown';
        } else {
          const isModified =
            payload.gitStatus === 'unstaged' || payload.gitStatus === 'staged';
          contentType = isModified ? 'git-diff' : 'file-editor';
        }

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
          skipped: false,
        });

        // Track tab info from callback
        let tabExists = false;
        let tabId = '';
        const sanitizedPath = filePath.replace(/[^a-zA-Z0-9-_]/g, '_');

        setTabs((prevTabs) => {
          // Check if tab already exists
          const existingTab = prevTabs.find(
            (t) =>
              (t.contentType === 'file-editor' &&
                (t as FileEditorTab).filePath === filePath) ||
              (t.contentType === 'markdown' &&
                (t as MarkdownTab).filePath === filePath) ||
              (t.contentType === 'git-diff' &&
                (t as GitDiffTab).filePath === filePath) ||
              (t.contentType === 'media' &&
                (t as MediaTab).filePath === filePath),
          );

          if (existingTab) {
            tabExists = true;
            tabId = existingTab.id;
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new tab
          // Use file path for deterministic ID (sanitize for valid ID)
          let newTab: FileEditorTab | MarkdownTab | GitDiffTab | MediaTab;
          if (contentType === 'media') {
            tabId = `media-${sanitizedPath}`;
            newTab = {
              id: tabId,
              label: fileName,
              contentType: 'media',
              filePath: filePath,
              fileName: fileName,
              closable: true,
            };
          } else if (contentType === 'markdown') {
            tabId = `markdown-${sanitizedPath}`;
            newTab = {
              id: tabId,
              label: fileName,
              contentType: 'markdown',
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
          return;
        }

        // Open MDX editor modal
        setDetailModal({
          panelId: 'mdxEditor',
          data: { path: filePath },
        });
      }),
      // Canvas open - create tab (from storyboard-list-panel, canvas-list-panel, canvas-detail-panel, dashboard-panel)
      events.on('custom', (event) => {
        // Type the canvas payload
        const payload = event.payload as CanvasOpenPayload;

        // Only handle openCanvas action from known panel sources
        const validSources = [
          'storyboard-list-panel',
          'canvas-list-panel',
          'canvas-detail-panel',
          'trace-list-panel',
          'dashboard-panel',
        ];
        if (
          payload.action !== 'openCanvas' ||
          !validSources.includes(event.source)
        ) {
          return;
        }
        const {
          canvasId,
          canvas,
          canvasFileInfo,
          workflowId,
          workflow,
          workflowFileInfo,
          traceId,
          spanId,
          scenarioId,
          trace,
        } = payload;

        if (!canvasId || !canvas) {
          return;
        }

        setTabs((prevTabs) => {
          // Determine content type based on whether workflow data is present
          // Both canvas and workflow clicks now use CanvasEditorPanel (v0.12.1+)
          // Workflow clicks pass workflowTemplate to show ScenariosList side panel
          const hasWorkflow = !!(workflowId && workflow);

          // Check if tab already exists for this canvas (either canvas-editor or canvas-detail)
          const existingTabIndex = prevTabs.findIndex((t) => {
            // Look for any existing tab for this canvas
            if (t.contentType === 'canvas-detail') {
              return (t as CanvasTab).canvasId === canvasId;
            } else if (t.contentType === 'canvas-editor') {
              return (t as CanvasEditorTab).canvasId === canvasId;
            }
            return false;
          });

          if (existingTabIndex !== -1) {
            // Existing tab found - update it with workflow information (or clear it)
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
          const _contentType = hasWorkflow ? 'canvas-detail' : 'canvas-editor';
          const newTab: CanvasEditorTab | CanvasTab = hasWorkflow
            ? ({
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
              } as CanvasTab)
            : ({
                id: `canvas-${canvasId}`,
                label: canvas.name || canvasId,
                contentType: 'canvas-editor',
                canvasId: canvasId,
                canvasPath: canvas.path,
                canvasName: canvas.name || canvasId,
                canvasFileInfo: canvasFileInfo || null,
                closable: true,
              } as CanvasEditorTab);
          // Also request focus for new tabs to ensure consistent activation
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Multi-canvas open - create tab (from storyboard-list-panel "View All" button)
      events.on('custom', (event) => {
        const payload = event.payload as MultiCanvasOpenPayload;

        // Only handle openMultiCanvas action from storyboard-list-panel
        if (
          payload.action !== 'openMultiCanvas' ||
          event.source !== 'storyboard-list-panel'
        ) {
          return;
        }
        const { canvases, canvasType } = payload;

        if (!canvases || canvases.length === 0) {
          return;
        }

        setTabs((prevTabs) => {
          // Check if multi-canvas tab already exists for this canvas type
          const existingTabIndex = prevTabs.findIndex(
            (t) =>
              t.contentType === 'multi-canvas' &&
              (t as MultiCanvasTab).canvasType === canvasType,
          );

          const tabId = `multi-canvas-${canvasType}`;
          const tabLabel =
            canvasType === 'otel'
              ? 'All OTEL Canvases'
              : 'All Architecture Canvases';

          if (existingTabIndex !== -1) {
            // Update existing tab with new canvases
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
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Dashboard open - create tab for dashboard panel
      events.on('custom', (event) => {
        const payload = event.payload as {
          action?: string;
          dashboardId?: string;
          dashboard?: DiscoveredDashboard;
        };

        // Only handle openDashboard action from storyboard-list-panel
        if (
          payload.action !== 'openDashboard' ||
          event.source !== 'storyboard-list-panel'
        ) {
          return;
        }
        const { dashboardId, dashboard } = payload;

        if (!dashboardId || !dashboard) {
          return;
        }

        setTabs((prevTabs) => {
          // Check if dashboard tab already exists
          const existingTabIndex = prevTabs.findIndex(
            (t) =>
              t.contentType === 'dashboard' &&
              (t as DashboardTab).dashboardId === dashboardId,
          );

          if (existingTabIndex !== -1) {
            // Focus existing tab
            setFocusTabId(prevTabs[existingTabIndex].id);
            return prevTabs;
          }

          // Create new dashboard tab
          const newTab: DashboardTab = {
            id: `dashboard-${dashboardId}`,
            label: dashboard.name || dashboardId,
            contentType: 'dashboard',
            dashboardId,
            dashboardPath: dashboard.path,
            dashboardName: dashboard.name || dashboardId,
            dashboard,
            closable: true,
          };
          setFocusTabId(newTab.id);
          return [...prevTabs, newTab];
        });
      }),
      // Bruno request selected - create tab for request panel
      events.on('principal-ade.bruno:request-selected', (event) => {
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          return;
        }

        const payload = event.payload as {
          requestId: string;
          request: BrunoRequest;
          environment?: Record<string, string>;
          environmentName?: string;
        };
        const { requestId, request, environment, environmentName } = payload;

        if (!request) {
          return;
        }

        const requestName =
          request.meta?.name ||
          requestId.split('/').pop()?.replace('.bru', '') ||
          'Request';

        setTabs((prevTabs) => {
          // Check if tab already exists for this request
          const existingTab = prevTabs.find(
            (t) =>
              t.contentType === 'bruno-request' &&
              (t as BrunoRequestTab).requestId === requestId,
          );

          if (existingTab) {
            setFocusTabId(existingTab.id);
            return prevTabs;
          }

          // Create new Bruno request tab
          const tabId = `bruno-request-${requestId.replace(/[^a-zA-Z0-9]/g, '-')}`;
          const newTab: BrunoRequestTab = {
            id: tabId,
            label: requestName,
            contentType: 'bruno-request',
            requestId,
            requestName,
            request,
            environment,
            environmentName,
            closable: true,
          };
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
      // Use setTimeout to ensure the detail panel component is mounted first
      setTimeout(() => {
        if (detailModal.panelId === 'githubIssueDetail') {
          events.emit({
            type: 'issue:selected',
            source: 'modal',
            timestamp: Date.now(),
            payload: {
              issue: detailModal.data,
            },
          });
        } else if (detailModal.panelId === 'mdxEditor') {
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
      const payload = event.payload as DependencyGraphPayload | undefined;
      const packages = payload?.packages ?? [];

      if (packages.length === 0) {
        return;
      }

      setTabs((prevTabs) => {
        // Check if a dependency graph tab already exists
        const existingTab = prevTabs.find(
          (t) => t.contentType === 'dependency-graph',
        );

        if (existingTab) {
          // Update existing tab with new packages and focus it
          setFocusTabId(existingTab.id);
          return prevTabs.map((t) =>
            t.id === existingTab.id
              ? ({ ...t, packages } as DependencyGraphTab)
              : t,
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
        setFocusTabId(newTab.id);
        return [...prevTabs, newTab];
      });
    });

    return unsubscribe;
  }, [events]);

  // Listen for file-city-3d:open events to create a new 3D city visualization tab
  useEffect(() => {
    const unsubscribe = events.on('file-city-3d:open', async () => {
      // Get file tree from context
      const fileTree = context.fileTree?.data;
      if (!fileTree) {
        return;
      }

      // Build city data from file tree
      const rootPath = fileTree.metadata?.id || '';
      const rawCityData = buildCityDataFromFileTree(fileTree, rootPath);

      // Get actual line counts from main process
      let cityData: CityData;
      try {
        const repoPath = context.repository?.path;
        if (repoPath && window.mainProcess?.fileCityImage?.countLines) {
          const rawLineCounts =
            await window.mainProcess.fileCityImage.countLines(repoPath);
          const _lineCountsSize = Object.keys(rawLineCounts).length;

          // Transform line counts to use the correct rootPath prefix
          // Main process returns paths like "electron-app/src/file.ts"
          // Building paths use rootPath like "git-abc123/src/file.ts"
          const repoName = repoPath.split('/').pop() || '';
          const lineCounts: Record<string, number> = {};
          for (const [filePath, count] of Object.entries(rawLineCounts)) {
            // Only include files with valid line counts
            if (typeof count !== 'number' || count < 0) continue;

            // Replace the repo name prefix with the rootPath prefix
            if (filePath.startsWith(repoName + '/')) {
              const relativePath = filePath.slice(repoName.length + 1);
              lineCounts[`${rootPath}/${relativePath}`] = count;
            } else {
              // Fallback: just prefix with rootPath
              lineCounts[`${rootPath}/${filePath}`] = count;
            }
          }

          // First enrich with actual line counts, then estimate any missing ones (binary files, etc.)
          const enrichedCityData = enrichWithLineCounts(
            rawCityData,
            lineCounts,
          );
          cityData = estimateLineCounts(enrichedCityData);
        } else {
          // Fallback to estimated line counts
          cityData = estimateLineCounts(rawCityData);
        }
      } catch (_error) {
        cityData = estimateLineCounts(rawCityData);
      }

      setTabs((prevTabs) => {
        // Check if a file-city-3d tab already exists
        const existingTab = prevTabs.find(
          (t) => t.contentType === 'file-city-3d',
        );

        if (existingTab) {
          // Update existing tab with new city data and focus it
          setFocusTabId(existingTab.id);
          return prevTabs.map((t) =>
            t.id === existingTab.id ? ({ ...t, cityData } as FileCity3DTab) : t,
          );
        }

        // Create new FileCity3D tab
        const newTab: FileCity3DTab = {
          id: 'file-city-3d',
          label: 'File City 3D',
          contentType: 'file-city-3d',
          cityData,
          closable: true,
        };
        setFocusTabId(newTab.id);
        return [...prevTabs, newTab];
      });
    });

    return unsubscribe;
  }, [events, context.fileTree?.data, context.repository?.path]);

  // Listen for terminal session selection from TerminalSessionsPanel
  useEffect(() => {
    const unsubscribe = events.on(
      'principal-ade.terminal-sessions:session-selected',
      (event) => {
        const payload = event.payload as { sessionId: string };

        if (payload?.sessionId) {
          // Switch to terminal panel in middle and focus the selected session tab
          onLayoutChange({ ...layout, middle: 'terminal' });
          setFocusTabId(payload.sessionId);
        }
      },
    );

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
      case 'bruno-request':
        return <Send size={14} />;
      case 'dashboard':
        return <Gauge size={14} />;
      case 'file-city-3d':
        return <Building2 size={14} />;
      case 'media': {
        const mediaTab = tab as MediaTab;
        const isVideo = /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(
          mediaTab.fileName,
        );
        return isVideo ? <Film size={14} /> : <Image size={14} />;
      }
      default:
        return undefined; // Return undefined to fall back to tab.icon
    }
  }, []);

  // Render custom label for tabs - only override for canvas-detail to show workflow name
  const renderTabLabel = useCallback((tab: DevWorkspaceTab) => {
    if (tab.contentType === 'canvas-detail') {
      const canvasTab = tab as CanvasTab;
      // Use workflow name, falling back to workflow ID, then canvas name as last resort
      return (
        canvasTab.narrativeTemplate?.name ||
        canvasTab.selectedNarrativeId ||
        canvasTab.canvasName ||
        undefined
      );
    }
    return undefined; // Fall back to tab.label for all other tabs
  }, []);

  // Extended terminal actions with tab association support
  const extendedTerminalActions: TerminalPanelActions = useMemo(
    () => ({
      ...terminalActions,
      onTabAssociate: handleTabAssociate,
    }),
    [terminalActions, handleTabAssociate],
  );

  // Get header config for associated tab (shown when collapsed)
  const getAssociatedHeader = useCallback(
    (associatedTabId: string) => {
      const tabData = associatedTabData[associatedTabId];

      if (!tabData) {
        return { icon: '📄', title: 'Associated Content' };
      }

      switch (tabData.contentType) {
        case 'markdown': {
          const markdownTab = tabData as MarkdownTab;
          const fileName = markdownTab.filePath.split('/').pop() || 'Document';
          return { icon: <FileText size={14} />, title: fileName };
        }
        case 'canvas-editor':
        case 'canvas-detail':
          return { icon: <LayoutDashboard size={14} />, title: tabData.label };
        case 'file-editor':
        case 'mdx-editor':
          return { icon: <Code size={14} />, title: tabData.label };
        case 'git-diff':
          return { icon: <GitBranch size={14} />, title: tabData.label };
        default:
          return { icon: '📄', title: tabData.label || 'Associated Content' };
      }
    },
    [associatedTabData],
  );

  // Render custom content for non-terminal tabs
  // NOTE: Uses refs for context/actions/events to avoid recreating this callback
  // when provider values change, which would cause unnecessary re-renders of all tabs
  const renderTabContent = useCallback(
    (
      tab: DevWorkspaceTab,
      isActive: boolean,
      sessionId?: string | null,
      width?: number,
    ) => {
      switch (tab.contentType) {
        case 'terminal':
          // Return null to use default terminal rendering
          return null;

        case 'skill': {
          // Type assertion for TypeScript
          const skillTab = tab as SkillTab;

          if (!SkillDetailPanelComponent) {
            return (
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
                Skill Detail panel not available
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
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
                Markdown Viewer panel not available
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
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
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
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
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
                traceMatchInfo={canvasTab.selectedTrace?.scenarioMatches?.map(
                  (m) => ({
                    scenarioId: m.scenarioId,
                    matchType: (m.matchType || 'full') as 'full' | 'partial',
                    coveragePercent: m.coveragePercent,
                  }),
                )}
              />
            </div>
          );
        }

        case 'multi-canvas': {
          // Type assertion for TypeScript
          const multiCanvasTab = tab as MultiCanvasTab;

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
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
                File Editor panel not available
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
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
                MDX Editor panel not available
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
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
                Git Diff panel not available
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

        case 'bruno-request': {
          // Type assertion for TypeScript
          const brunoRequestTab = tab as BrunoRequestTab;

          if (!BrunoRequestPanelComponent) {
            return (
              <div
                style={{ padding: '2rem', color: theme.colors.textSecondary }}
              >
                Bruno Request panel not available
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
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <BrunoRequestPanelComponent
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                selectedRequest={brunoRequestTab.request}
                selectedRequestId={brunoRequestTab.requestId}
                selectedEnvironment={brunoRequestTab.environment}
                selectedEnvironmentName={brunoRequestTab.environmentName}
              />
            </div>
          );
        }

        case 'dashboard': {
          // Type assertion for TypeScript
          const dashboardTab = tab as DashboardTab;

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
              <DashboardPanel
                context={contextRef.current}
                actions={actionsRef.current}
                events={eventsRef.current}
                selectedDashboard={
                  dashboardTab.dashboard as unknown as import('@principal-ai/principal-view-core').DiscoveredCanvas
                }
              />
            </div>
          );
        }

        case 'file-city-3d': {
          const fileCity3DTab = tab as FileCity3DTab;

          return (
            <div
              style={{
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <FileCity3DPanelContent
                cityData={fileCity3DTab.cityData}
                width="100%"
                height="100%"
                showControls={true}
                heightScaling="linear"
                linearScale={0.5}
                animation={{ startFlat: true, autoStartDelay: 300 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onBuildingClick={(building) => {
                  // Strip the root path prefix (e.g., "git-abc123-dirty-xyz/") from the building path
                  const pathParts = building.path.split('/');
                  const relativePath = pathParts.slice(1).join('/'); // Remove first segment (root id)

                  // Emit file:open event when a building is clicked
                  eventsRef.current.emit({
                    type: 'file:open',
                    source: 'file-city-3d-tab',
                    timestamp: Date.now(),
                    payload: { path: relativePath },
                  });
                }}
              />
            </div>
          );
        }

        case 'media': {
          const mediaTab = tab as MediaTab;
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
              <MediaViewerPanel
                filePath={mediaTab.filePath}
                fileName={mediaTab.fileName}
              />
            </div>
          );
        }

        default: {
          const unknownTab = tab as DevWorkspaceTab;
          return (
            <div style={{ padding: '2rem', color: theme.colors.error }}>
              Unknown tab type: {unknownTab.contentType}
            </div>
          );
        }
      }
    },
    [
      theme,
      SkillDetailPanelComponent,
      MarkdownPanelComponent,
      CanvasEditorPanelComponent,
      FileEditorPanelComponent,
      MDXEditorPanelComponent,
      GitDiffPanelComponent,
    ],
  );

  // Render associated content for split pane
  // Reuses renderTabContent so all supported tab types automatically work
  const renderAssociatedContent = useCallback(
    (associatedTabId: string, isActive: boolean) => {
      const tabData = associatedTabData[associatedTabId];

      if (!tabData) {
        return (
          <div style={{ padding: '1rem', color: theme.colors.textSecondary }}>
            Associated content not found: {associatedTabId}
          </div>
        );
      }

      // Reuse renderTabContent - it already handles all tab types
      return renderTabContent(tabData, isActive, null, terminalPanelWidth);
    },
    [
      associatedTabData,
      theme.colors.textSecondary,
      renderTabContent,
      terminalPanelWidth,
    ],
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
              actions={extendedTerminalActions}
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
              showAllTerminals={showAllTerminals}
              onShowAllTerminalsChange={setShowAllTerminals}
              // Tab association props
              associations={associations}
              onAssociationCollapsedChange={handleAssociationCollapsedChange}
              onAssociationRatioChange={handleAssociationRatioChange}
              renderAssociatedContent={renderAssociatedContent}
              getAssociatedHeader={getAssociatedHeader}
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
                  onClick={() =>
                    setShowRightPanelHistory(!showRightPanelHistory)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: showRightPanelHistory
                      ? 'var(--color-bg-tertiary, #2a2a2a)'
                      : 'transparent',
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
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--color-text-secondary, #aaa)',
                        }}
                      >
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
                          e.currentTarget.style.backgroundColor =
                            'var(--color-bg-tertiary, #2a2a2a)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <FileText
                          size={14}
                          style={{
                            flexShrink: 0,
                            color: 'var(--color-text-secondary, #888)',
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
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
        id: 'notes',
        label: 'Notes',
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
              filePath={
                context.currentScope?.repository?.path
                  ? `${context.currentScope.repository.path}/.principal/notes.md`
                  : undefined
              }
            />
          </div>
        ) : (
          <div>Notes panel not available</div>
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
        id: 'bruno',
        label: 'Bruno Collection',
        content: BrunoCollectionPanelComponent ? (
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
            <BrunoCollectionPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Bruno Collection panel not available</div>
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
              tracer={getTracer('principal-ade-dev-workspace')}
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
      BrunoCollectionPanelComponent,
      BrunoRequestPanelComponent,
      context,
      actions,
      events,
      terminalContext,
      terminalDirectory,
      terminalPanelContext,
      extendedTerminalActions,
      theme,
      tabs,
      handleTabsChange,
      renderTabIcon,
      renderTabLabel,
      focusTabId,
      handleFocusTabHandled,
      terminalPanelWidth,
      associations,
      handleAssociationCollapsedChange,
      handleAssociationRatioChange,
      renderAssociatedContent,
      getAssociatedHeader,
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
          onPanelChange={(panelId) =>
            onLayoutChange({ ...layout, left: panelId })
          }
          theme={theme}
          collapsed={isLeftCollapsed}
          onExpand={handleLeftExpand}
          onCollapse={handleLeftCollapse}
          position="left"
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
        <ConfigurablePanelLayout
          ref={panelLayoutRef}
          panels={allPanels}
          layout={layout}
          collapsiblePanels={{ left: true, right: true }}
          defaultSizes={panelSizes || { left: 25, middle: 50, right: 25 }}
          collapsed={collapsed}
          showCollapseButtons={false}
          theme={theme}
          onPanelResize={handlePanelResizeInternal}
          onLeftCollapseComplete={handleLeftCollapseCompleteInternal}
          onLeftExpandComplete={handleLeftExpandCompleteInternal}
          onRightCollapseComplete={handleRightCollapseCompleteInternal}
          onRightExpandComplete={handleRightExpandCompleteInternal}
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
              {detailModal.panelId === 'githubIssueDetail' &&
                GitHubIssueDetailPanelComponent && (
                  <GitHubIssueDetailPanelComponent
                    context={context}
                    actions={actions}
                    events={events}
                    // Note: Panel is event-driven. The issue:selected event that opened this modal
                    // needs to be re-emitted for the panel to display the issue.
                    // TODO: Add useEffect to re-emit issue:selected with source='modal' after mount
                  />
                )}
              {detailModal.panelId === 'mdxEditor' &&
                MDXEditorPanelComponent && (
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
          onPanelChange={(panelId) =>
            onLayoutChange({ ...layout, right: panelId })
          }
          theme={theme}
          collapsed={isRightCollapsed}
          onExpand={handleRightExpand}
          onCollapse={handleRightCollapse}
          position="right"
          panelIcons={RIGHT_PANEL_ICONS}
          onOpenInWebADE={onOpenInWebADE}
          onOpenGitHubActions={onOpenGitHubActions}
          onOpenGitHubRepo={onOpenGitHubRepo}
          onSplitPanels={
            onPanelSizesChange
              ? () => {
                  // Set 50/50 split between middle and right (left goes to 0)
                  onPanelSizesChange({ left: 0, middle: 50, right: 50 });
                }
              : undefined
          }
          customButtons={
            <>
              <StorybookSidebarButton
                theme={theme}
                packages={context.packages?.data?.packages}
                repositoryPath={context.currentScope?.repository?.path}
                repositoryOwner={
                  context.currentScope?.repository?.owner as string | undefined
                }
                repositoryName={context.currentScope?.repository?.name}
                currentLayout={
                  layout as { left: string; middle: string; right: string }
                }
                onLayoutChange={onLayoutChange}
                onPanelSizesChange={onPanelSizesChange}
                events={events}
              />
              <NextjsSidebarButton
                theme={theme}
                packages={context.packages?.data?.packages}
                repositoryPath={context.currentScope?.repository?.path}
                repositoryOwner={
                  context.currentScope?.repository?.owner as string | undefined
                }
                repositoryName={context.currentScope?.repository?.name}
                currentLayout={
                  layout as { left: string; middle: string; right: string }
                }
                onLayoutChange={onLayoutChange}
                onPanelSizesChange={onPanelSizesChange}
                events={events}
              />
              <NotesSidebarButton
                theme={theme}
                repositoryPath={context.currentScope?.repository?.path}
                currentLayout={
                  layout as { left: string; middle: string; right: string }
                }
                onLayoutChange={onLayoutChange}
              />
            </>
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
  onPanelControlReady,
  events,
  traceSourceServiceName: _traceSourceServiceName,
  onScopeNamesDiscovered,
  onServiceTraceCountsChange,
  onLeftCollapseComplete,
  onLeftExpandComplete,
  onOpenInWebADE,
  onOpenGitHubActions,
  onOpenGitHubRepo,
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
            onPanelControlReady={onPanelControlReady}
            onTabsChange={setTabsForProvider}
            onLeftCollapseComplete={onLeftCollapseComplete}
            onLeftExpandComplete={onLeftExpandComplete}
            onOpenInWebADE={onOpenInWebADE}
            onOpenGitHubActions={onOpenGitHubActions}
            onOpenGitHubRepo={onOpenGitHubRepo}
            sidebarsHidden={sidebarsHidden}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </RepositoryPanelProvider>
  );
};
