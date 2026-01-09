import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  EditableConfigurablePanelLayout,
  FocusModeOverlay,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
// CSS is bundled inline in principal-view-panels, no separate import needed
// Note: file-city-panel CSS is bundled inline, no separate import needed
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
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
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { TabbedGhosttyTerminal } from '@industry-theme/ghostty-terminal-panel';
import { panels as principalViewPanels } from '@industry-theme/principal-view-panels';
import { panels as fileCityPanels } from '@industry-theme/file-city-panel';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { panels as alexandriaPanels } from '@industry-theme/alexandria-panels';
import { panels as localhostBrowserPanels } from '@industry-theme/localhost-panels';
import { panels as agentDrivenPanels } from '@industry-theme/agent-driven-ui-panels';
import { panels as repositoryCompositionPanels } from '@industry-theme/repository-composition-panels';
import { panels as codeQualityPanels } from '@principal-ade/code-quality-panels';
import { panels as markdownPanels } from '@industry-theme/markdown-panels';
import { panels as fileEditingPanels } from '@industry-theme/file-editing-panels';
import { panels as backlogPanels } from '@industry-theme/backlogmd-kanban-panel';
import { panels as agentPanels } from '@industry-theme/agent-panels';
import type { Repository } from '../../shared/types/repository.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface DevWorkspacePanelFrameworkProps {
  repositoryPath: string;
  repository: Repository;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Per-panel focus state (dims individual panels) */
  panelFocus?: { left: boolean; right: boolean };
  /** Toggle focus on left panel (dim left) */
  onFocusLeft?: () => void;
  /** Toggle focus on right panel (dim right) */
  onFocusRight?: () => void;
}

interface DevWorkspacePanelFrameworkInnerProps {
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  panelFocus?: { left: boolean; right: boolean };
  onFocusLeft?: () => void;
  onFocusRight?: () => void;
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
  FileCityPanelComponent: React.ComponentType<{
    context: unknown;
    actions: unknown;
    events: unknown;
  }>;
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
        return mergedSlices.get(name) as
          | {
              scope: string;
              name: string;
              data: T;
              loading: boolean;
              error: unknown;
              refresh: () => Promise<void>;
            }
          | undefined;
      },
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
> = ({ collapsed, onCollapsedChange, layout, onLayoutChange, panelFocus, onFocusLeft, onFocusRight }) => {
  const { theme } = useTheme();
  const { context, actions, events } = useRepositoryPanelProvider();
  const { context: terminalCtx, actions: terminalActions } =
    useTerminalProvider();

  // Load terminal implementation preference (default to xterm)
  const [terminalImplementation, setTerminalImplementation] = useState<
    'xterm' | 'ghostty'
  >('xterm');

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
    }),
    [context, terminalCtx.terminalSessions, terminalCtx.terminalContext],
  );

  const PrincipalViewPanelComponent = principalViewPanels[0]?.component;
  const TraceViewerPanelComponent = principalViewPanels.find(
    (p) => p.metadata?.id === 'principal-ai.trace-viewer',
  )?.component;
  const ExecutionViewerPanelComponent = principalViewPanels.find(
    (p) => p.metadata?.id === 'principal-ai.execution-viewer',
  )?.component;
  const FileCityPanelComponent = fileCityPanels[0]?.component;
  const DocsPanelComponent = docsPanels[0]?.component;
  const LocalProjectsPanelComponent = alexandriaPanels.find(
    (p) => p.metadata?.id === 'industry-theme.local-projects',
  )?.component;
  const LocalhostBrowserPanelComponent = localhostBrowserPanels.find(
    (p) => p.metadata?.id === 'principal-ade.localhost-browser',
  )?.component;
  const EventBusPanelComponent = agentDrivenPanels.find(
    (p) => p.metadata?.id === 'industry-theme.event-bus-panel',
  )?.component;
  const AgentToolsPanelComponent = agentDrivenPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agent-tools-panel',
  )?.component;
  const GitChangesPanelComponent = repositoryCompositionPanels.find(
    (p) => p.metadata?.id === 'industry-theme.git-changes',
  )?.component;
  const PackageCompositionPanelComponent = repositoryCompositionPanels.find(
    (p) => p.metadata?.id === 'industry-theme.package-composition',
  )?.component;
  const CodeQualityPanelComponent = codeQualityPanels.find(
    (p) => p.metadata?.id === 'principal-ade.quality-hexagon-panel',
  )?.component;
  const MarkdownPanelComponent = markdownPanels[0]?.component;
  const FileEditorPanelComponent = fileEditingPanels.find(
    (p) => p.metadata?.id === 'industry-theme.file-editor',
  )?.component;
  const GitDiffPanelComponent = fileEditingPanels.find(
    (p) => p.metadata?.id === 'industry-theme.git-diff',
  )?.component;
  const MDXEditorPanelComponent = fileEditingPanels.find(
    (p) => p.metadata?.id === 'industry-theme.mdx-editor',
  )?.component;

  // Backlog.md panels (Kanban, TaskDetail, Milestone)
  const KanbanPanelComponent = backlogPanels[0]?.component;
  const TaskDetailPanelComponent = backlogPanels[1]?.component;
  const MilestonePanelComponent = backlogPanels[2]?.component;

  // Agent Skills panels
  const SkillsListPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skills-list',
  )?.component;
  const SkillDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skill-detail',
  )?.component;

  // Listen for doc:openInRightPanel events (from Alexandria docs panel context menu)
  useEffect(() => {
    const unsubscribe = events.on('doc:openInRightPanel', async (event) => {
      const doc = event.payload as {
        path: string;
        relativePath: string;
        name: string;
      };

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
            <TabbedTerminalPanel
              context={terminalPanelContext}
              actions={terminalActions}
              events={events}
              terminalContext={terminalContext}
              directory={terminalDirectory}
            />
          ),
      },
      {
        id: 'principalView',
        label: 'Principal View',
        content: PrincipalViewPanelComponent ? (
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
            <PrincipalViewPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Principal View panel not available</div>
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
        id: 'executionViewer',
        label: 'Execution Viewer',
        content: ExecutionViewerPanelComponent ? (
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
            <ExecutionViewerPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Execution Viewer panel not available</div>
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
              defaultShowSearch
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
        id: 'skillsList',
        label: 'Skills List',
        content: SkillsListPanelComponent ? (
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
            <SkillsListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Skills List panel not available</div>
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
    ],
    [
      PrincipalViewPanelComponent,
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
      SkillsListPanelComponent,
      SkillDetailPanelComponent,
      context,
      actions,
      events,
      terminalImplementation,
      terminalContext,
      terminalDirectory,
      terminalPanelContext,
      terminalActions,
      theme,
    ],
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
        position: 'relative',
      }}
    >
      <EditableConfigurablePanelLayout
        panels={allPanels}
        layout={layout}
        onLayoutChange={onLayoutChange}
        isEditMode={false}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={{ left: 25, middle: 50, right: 25 }}
        minSizes={{ left: 15, middle: 30, right: 15 }}
        collapsed={collapsed}
        showCollapseButtons={false}
        theme={theme}
      />

      {/* Focus Mode Overlays - dim panels when focus is enabled */}
      {panelFocus?.left && !collapsed.left && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '25%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <FocusModeOverlay
            active={true}
            variant="soft-fade"
            effects={['snowfall']}
            opacity={0.92}
          />
        </div>
      )}
      {panelFocus?.right && !collapsed.right && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '25%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <FocusModeOverlay
            active={true}
            variant="soft-fade"
            effects={['snowfall']}
            opacity={0.92}
          />
        </div>
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
  events,
  panelFocus,
  onFocusLeft,
  onFocusRight,
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

  return (
    <RepositoryPanelProvider
      repositoryPath={repositoryPath}
      repository={repositoryMetadata}
      events={events}
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
            panelFocus={panelFocus}
            onFocusLeft={onFocusLeft}
            onFocusRight={onFocusRight}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </RepositoryPanelProvider>
  );
};
