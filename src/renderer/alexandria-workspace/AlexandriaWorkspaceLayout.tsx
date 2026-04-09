import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import {
  ConfigurablePanelLayout,
  PanelLayout,
  usePanelFocus,
  usePanelKeyboardShortcuts,
  FocusIndicator,
} from '@principal-ade/panel-layouts';
import { PanelProvider, usePanelProvider } from '../contexts/PanelContext';
import {
  TerminalProvider,
  useTerminalProvider,
} from '../contexts/TerminalContext';
import {
  AgentHighlightProvider,
  useAgentHighlightProvider,
} from '../contexts/AgentHighlightContext';
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import {
  LocalProjectsPanel,
} from '@industry-theme/alexandria-panels';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { FeedCodeCityPanel } from '@industry-theme/file-city-panel';
import { localhostProcessesPanels, RecentRepositoriesPanel } from '../panels';
import { EventBusPanel, AgentToolsPanel } from '@industry-theme/agent-driven-ui-panels';
import { MarkdownPanel } from '@industry-theme/markdown-panels';
import { StoryboardListPanel, CanvasEditorPanel } from '@industry-theme/principal-view-panels';
import { panels as backlogPanels } from '@industry-theme/backlogmd-kanban-panel';
import { panels as agentPanels } from '@industry-theme/agent-panels'; // Keep as array - multiple panels with different IDs
import { GitHubIssuesPanel, GitHubIssueDetailPanel } from '@industry-theme/github-panels';
import { GitChangesPanel, PackageCompositionPanel } from '@industry-theme/repository-composition-panels';
import { panels as codeQualityPanels } from '@principal-ade/code-quality-panels';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { WindowService } from '../main-process-api/WindowService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { RemoveFromWorkspaceModal } from '../panels/components/RemoveFromWorkspaceModal';
import { PanelIconSidebar } from '../components/Sidebar/PanelIconSidebar';

type PanelDefinition = {
  id: string;
  label: string;
  content: React.ReactNode;
};

interface AlexandriaWorkspaceLayoutProps {
  workspace: Workspace;
  repository?: {
    name: string;
    path: string;
  };
  /**
   * Enable keyboard shortcuts for panel navigation (Alt+1, Alt+2, Alt+3)
   * @default false - Disabled by default until DOM focus integration is complete
   */
  enableKeyboardShortcuts?: boolean;
  /**
   * External collapsed state (controlled from titlebar)
   */
  collapsed?: { left: boolean; right: boolean };
  /**
   * Callback when collapsed state changes
   */
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  /**
   * External layout state (controlled from titlebar for switch operations)
   */
  layout?: PanelLayout;
  /**
   * Callback when layout changes
   */
  onLayoutChange?: (layout: PanelLayout) => void;
  /**
   * Callback when a repository is selected or deselected
   */
  onRepositorySelected?: (
    repository: { name: string; path: string } | undefined,
  ) => void;
  /**
   * Show the panel icon sidebar
   * @default true
   */
  showPanelSidebar?: boolean;
}

interface AlexandriaWorkspaceLayoutContentProps {
  selectedRepository?: { name: string; path: string };
  onRepositorySelected: (
    repository: { name: string; path: string } | undefined,
  ) => void;
  enableKeyboardShortcuts: boolean;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  showPanelSidebar: boolean;
}

/**
 * Content component that uses panel context
 */
const AlexandriaWorkspaceLayoutContent: React.FC<
  AlexandriaWorkspaceLayoutContentProps
> = ({
  selectedRepository,
  onRepositorySelected,
  enableKeyboardShortcuts,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
  showPanelSidebar,
}) => {
  const { theme } = useTheme();
  const { context, actions, events } = usePanelProvider();
  const { context: terminalCtx, actions: terminalActions } = useTerminalProvider();
  const { context: highlightCtx } = useAgentHighlightProvider();

  const [showAllTerminals, setShowAllTerminals] = useState(false);

  // Get terminal context and directory from TerminalProvider
  const terminalContext = terminalCtx.terminalContext || 'terminal:default';
  const terminalDirectory = terminalCtx.repositoryPath || '/';

  // Create merged context for TabbedTerminalPanel (includes terminal sessions from TerminalProvider)
  const terminalPanelContext = useMemo(
    () => ({
      ...context,
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
    }),
    [context, terminalCtx.terminalSessions, terminalCtx.terminalContext],
  );

  // Create merged context for File City panel (includes agent highlight layers)
  const fileCityPanelContext = useMemo(
    () => ({
      ...context,
      agentHighlightLayers: {
        scope: 'repository' as const,
        name: 'agentHighlightLayers',
        data: highlightCtx.highlightLayers,
        loading: false,
        error: null,
        refresh: async () => {
          // Agent highlight layers are updated reactively from events
        },
      },
    }),
    [context, highlightCtx.highlightLayers],
  );

  // State for remove from workspace modal
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<AlexandriaEntry | null>(
    null,
  );
  const [workspaceForRemoval, setWorkspaceForRemoval] =
    useState<Workspace | null>(null);

  // Handle removal modal close
  const handleCloseRemoveModal = useCallback(() => {
    setIsRemoveModalOpen(false);
    setEntryToRemove(null);
    setWorkspaceForRemoval(null);
  }, []);

  // Handle removal confirmation
  const handleConfirmRemove = useCallback(
    async (moveToDefault: boolean) => {
      if (!entryToRemove || !workspaceForRemoval) return;

      try {
        // Remove from workspace first (while entry still has original path)
        // Pass full entry so core library can extract github.id for matching
        await WorkspaceService.removeRepositoryFromWorkspace(
          entryToRemove,
          workspaceForRemoval.id,
        );

        // Refresh the workspace repositories in context
        context.refresh('workspace', 'workspaceRepositories');

        // Then move to default directory if requested
        if (moveToDefault) {
          await WorkspaceService.moveRepositoryToDefaultDirectory(entryToRemove);
        }
      } catch (error) {
        console.error(
          '[AlexandriaWorkspaceLayout] Failed to remove from workspace:',
          error,
        );
        throw error;
      }
    },
    [entryToRemove, workspaceForRemoval, context],
  );

  // Panel focus management for keyboard shortcuts
  const { focusedPanel, setFocus, isFocused } = usePanelFocus({
    initialFocus: enableKeyboardShortcuts ? 'middle' : null, // Only set initial focus if shortcuts enabled
    collapsed,
    panelType: 'three-panel',
  });

  // Collapse/expand handlers
  const handleExpand = useCallback(
    async (panel: 'left' | 'right') => {
      onCollapsedChange({ ...collapsed, [panel]: false });
    },
    [collapsed, onCollapsedChange],
  );

  const handleCollapse = useCallback(
    async (panel: 'left' | 'right') => {
      onCollapsedChange({ ...collapsed, [panel]: true });
    },
    [collapsed, onCollapsedChange],
  );

  // Keyboard shortcuts (Alt+1, Alt+2, Alt+3)
  // NOTE: Disabled by default until DOM focus integration is implemented
  // to prevent interference with terminal keyboard bindings
  usePanelKeyboardShortcuts({
    enabled: enableKeyboardShortcuts,
    focusedPanel,
    collapsed,
    panelType: 'three-panel',
    setFocus,
    onExpand: handleExpand,
    onCollapse: handleCollapse,
  });

  // Listen for repository:selected events (for updating context, NOT opening windows)
  useEffect(() => {
    const unsubscribe = events.on('repository:selected', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };

      console.info(
        '[AlexandriaWorkspaceLayout] Repository selected event received:',
        {
          repository,
          repositoryPath,
        },
      );

      if (repository) {
        const repoPath = repositoryPath || repository.path;

        // Toggle: if clicking on the already selected repo, deselect it
        if (selectedRepository && selectedRepository.path === repoPath) {
          console.info(
            '[AlexandriaWorkspaceLayout] Deselecting repository:',
            selectedRepository.name,
          );
          onRepositorySelected(undefined);
        } else {
          const selectedRepo = {
            name: repository.name,
            path: repoPath,
          };
          console.info(
            '[AlexandriaWorkspaceLayout] Updating selected repository:',
            selectedRepo,
          );
          onRepositorySelected(selectedRepo);
        }
      }
    });

    return unsubscribe;
  }, [events, onRepositorySelected, selectedRepository]);

  // Listen for repository:opened events (for explicitly opening windows)
  useEffect(() => {
    const unsubscribe = events.on('repository:opened', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };

      console.info(
        '[AlexandriaWorkspaceLayout] Repository opened event received:',
        {
          repository,
          repositoryPath,
        },
      );

      if (repository) {
        // Open the repository in a new dev workspace window
        try {
          await WindowService.openDevWorkspace({
            alexandriaEntry: repository,
          });
        } catch (error) {
          console.error(
            '[AlexandriaWorkspaceLayout] Failed to open dev workspace:',
            error,
          );
        }
      }
    });

    return unsubscribe;
  }, [events]);

  // Listen for file:opened events (from Alexandria docs panel)
  // TODO: Implement tabbed view for markdown files
  useEffect(() => {
    const unsubscribe = events.on('file:opened', async (event) => {
      const { filePath } = event.payload as { filePath: string };

      console.info(
        '[AlexandriaWorkspaceLayout] File opened event received:',
        filePath,
      );

      // Markdown files will be shown in tabs when tabbed view is implemented
      // For now, just log the event
    });

    return unsubscribe;
  }, [events]);

  // Listen for doc:openInRightPanel events (from Alexandria docs panel context menu)
  useEffect(() => {
    const unsubscribe = events.on('doc:openInRightPanel', async (event) => {
      const doc = event.payload as {
        path: string;
        relativePath: string;
        name: string;
      };

      console.info(
        '[AlexandriaWorkspaceLayout] Open in right panel event received:',
        doc,
      );

      // Get the file path (prefer absolute path, fall back to relative)
      const filePath = doc.path || doc.relativePath;

      if (!filePath) {
        console.warn(
          '[AlexandriaWorkspaceLayout] No file path in doc:openInRightPanel event',
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
          '[AlexandriaWorkspaceLayout] Switched right panel to markdown-viewer for:',
          filePath,
        );
      } catch (error) {
        console.error(
          '[AlexandriaWorkspaceLayout] Failed to open in right panel:',
          error,
        );
      }
    });

    return unsubscribe;
  }, [events, actions, layout, onLayoutChange, collapsed, onCollapsedChange]);

  // Get panel components - using direct imports instead of array access
  // to avoid type inference issues with mixed desktop/web panels
  const WorkspacePanelComponent = RecentRepositoriesPanel;
  const LocalProjectsPanelComponent = LocalProjectsPanel;
  const DocsPanelComponent = docsPanels[0]?.component; // Cannot convert - component not exported
  const FileCityPanelComponent = FeedCodeCityPanel;
  const LocalhostPanelComponent = localhostProcessesPanels[0]?.component; // Cannot convert - local panel
  const EventBusPanelComponent = EventBusPanel;
  const AgentToolsPanelComponent = AgentToolsPanel;
  const MarkdownPanelComponent = MarkdownPanel;
  const PrincipalViewPanelComponent = CanvasEditorPanel;

  // Dev workspace panels
  const KanbanPanelComponent = backlogPanels[0]?.component; // Cannot convert - component not exported
  const TaskDetailPanelComponent = backlogPanels[1]?.component; // Cannot convert - component not exported
  const MilestonePanelComponent = backlogPanels[2]?.component; // Cannot convert - component not exported
  const SkillsListPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skills-list',
  )?.component; // Cannot convert - need metadata ID lookup
  const SkillDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skill-detail',
  )?.component; // Cannot convert - need metadata ID lookup
  const AgentsListPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agents-list',
  )?.component; // Cannot convert - need metadata ID lookup
  const AgentDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agent-detail',
  )?.component; // Cannot convert - need metadata ID lookup
  const GitHubIssuesPanelComponent = GitHubIssuesPanel;
  const GitHubIssueDetailPanelComponent = GitHubIssueDetailPanel;
  const GitChangesPanelComponent = GitChangesPanel;
  const PackageCompositionPanelComponent = PackageCompositionPanel;
  const CodeQualityPanelComponent = codeQualityPanels.find(
    (p) => p.metadata?.id === 'principal-ade.quality-hexagon-panel',
  )?.component; // Cannot convert - package may not be installed
  const StoryboardListPanelComponent = StoryboardListPanel;

  // Define panels
  const panels: PanelDefinition[] = useMemo(
    () => [
      {
        id: 'workspace-repos',
        label: 'Repositories',
        content: WorkspacePanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <WorkspacePanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Workspace panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('middle')} />
            )}
            <TabbedTerminalPanel
              context={terminalPanelContext}
              actions={terminalActions}
              events={events}
              terminalContext={terminalContext}
              directory={terminalDirectory}
              showAllTerminals={showAllTerminals}
              onShowAllTerminalsChange={setShowAllTerminals}
            />
          </div>
        ),
      },
      {
        id: 'alexandria-docs',
        label: 'Documentation',
        content: DocsPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <DocsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Alexandria Docs panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'file-city',
        label: 'File City',
        content: FileCityPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <FileCityPanelComponent
              context={fileCityPanelContext}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Code City panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'localhost-browser',
        label: 'Localhost Browser',
        content: LocalhostPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <LocalhostPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Localhost Browser panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'event-bus',
        label: 'Event Bus',
        content: EventBusPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <EventBusPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Event Bus panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'agent-tools',
        label: 'Agent Tools',
        content: AgentToolsPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <AgentToolsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Agent Tools panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'local-projects',
        label: 'Local Projects',
        content: LocalProjectsPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <LocalProjectsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Local Projects panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'markdown-viewer',
        label: 'Markdown Viewer',
        content: MarkdownPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <MarkdownPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Markdown Viewer panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'principal-view',
        label: 'Architecture',
        content: PrincipalViewPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <PrincipalViewPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Architecture panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'canvasList',
        label: 'Architecture List',
        content: StoryboardListPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <StoryboardListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Architecture List panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'kanban',
        label: 'Kanban',
        content: KanbanPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <KanbanPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Kanban panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'task-detail',
        label: 'Task Detail',
        content: TaskDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <TaskDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Task Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'milestones',
        label: 'Milestones',
        content: MilestonePanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <MilestonePanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Milestones panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'skillsList',
        label: 'Skills List',
        content: SkillsListPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <SkillsListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Skills List panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'skillDetail',
        label: 'Skill Detail',
        content: SkillDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <SkillDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Skill Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'agentsList',
        label: 'Agents List',
        content: AgentsListPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <AgentsListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Agents List panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'agentDetail',
        label: 'Agent Detail',
        content: AgentDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <AgentDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Agent Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'githubIssues',
        label: 'GitHub Issues',
        content: GitHubIssuesPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <GitHubIssuesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              GitHub Issues panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'githubIssueDetail',
        label: 'GitHub Issue Detail',
        content: GitHubIssueDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <GitHubIssueDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              GitHub Issue Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'gitChanges',
        label: 'Git Changes',
        content: GitChangesPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <GitChangesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Git Changes panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'packageComposition',
        label: 'Package Composition',
        content: PackageCompositionPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <PackageCompositionPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Package Composition panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'codeQuality',
        label: 'Code Quality',
        content: CodeQualityPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <CodeQualityPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Code Quality panel not available
            </p>
          </div>
        ),
      },
    ],
    [
      theme,
      context,
      actions,
      events,
      WorkspacePanelComponent,
      LocalProjectsPanelComponent,
      DocsPanelComponent,
      FileCityPanelComponent,
      LocalhostPanelComponent,
      EventBusPanelComponent,
      AgentToolsPanelComponent,
      MarkdownPanelComponent,
      PrincipalViewPanelComponent,
      StoryboardListPanelComponent,
      KanbanPanelComponent,
      TaskDetailPanelComponent,
      MilestonePanelComponent,
      SkillsListPanelComponent,
      SkillDetailPanelComponent,
      AgentsListPanelComponent,
      AgentDetailPanelComponent,
      GitHubIssuesPanelComponent,
      GitHubIssueDetailPanelComponent,
      GitChangesPanelComponent,
      PackageCompositionPanelComponent,
      CodeQualityPanelComponent,
      isFocused,
      enableKeyboardShortcuts,
      terminalContext,
      terminalDirectory,
      terminalPanelContext,
      terminalActions,
      fileCityPanelContext,
      showAllTerminals,
    ],
  );

  return (
    <>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          overflow: 'hidden',
        }}
      >
        {/* Main panel layout area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ConfigurablePanelLayout
            theme={theme}
            panels={panels}
            layout={layout}
            defaultSizes={{ left: 25, middle: 50, right: 25 }}
            collapsed={collapsed}
            collapsiblePanels={{ left: true, right: true }}
            showCollapseButtons={false}
          />
        </div>

        {/* Panel Icon Sidebar */}
        {showPanelSidebar && (
          <PanelIconSidebar
            currentPanelId={typeof layout.left === 'string' ? layout.left : ''}
            onPanelChange={(panelId) => onLayoutChange({ ...layout, left: panelId })}
            theme={theme}
            collapsed={collapsed.left}
            onExpand={() => onCollapsedChange({ ...collapsed, left: false })}
            onCollapse={() => onCollapsedChange({ ...collapsed, left: true })}
            position="right"
          />
        )}
      </div>

      {/* Remove from Workspace Modal */}
      <RemoveFromWorkspaceModal
        isOpen={isRemoveModalOpen}
        entry={entryToRemove}
        workspace={workspaceForRemoval}
        onClose={handleCloseRemoveModal}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
};

/**
 * Alexandria Workspace Layout Component
 * Similar to web-ade's EditorLayout but for workspace management
 */
// Default layout for Alexandria workspace
const DEFAULT_LAYOUT: PanelLayout = {
  left: 'workspace-repos',
  middle: 'terminal',
  right: 'file-city',
};

export const AlexandriaWorkspaceLayout: React.FC<
  AlexandriaWorkspaceLayoutProps
> = ({
  workspace,
  repository: initialRepository,
  enableKeyboardShortcuts = false,
  collapsed: externalCollapsed,
  onCollapsedChange: externalOnCollapsedChange,
  layout: externalLayout,
  onLayoutChange: externalOnLayoutChange,
  onRepositorySelected: externalOnRepositorySelected,
  showPanelSidebar = true,
}) => {
  const { theme } = useTheme();

  // Internal collapsed state (used when not controlled externally)
  const [internalCollapsed, setInternalCollapsed] = useState({
    left: false,
    right: false,
  });

  // Internal layout state (used when not controlled externally)
  const [internalLayout, setInternalLayout] =
    useState<PanelLayout>(DEFAULT_LAYOUT);

  // Use external state if provided, otherwise use internal
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onCollapsedChange = externalOnCollapsedChange ?? setInternalCollapsed;

  const layout = externalLayout ?? internalLayout;
  const onLayoutChange = externalOnLayoutChange ?? setInternalLayout;

  // Track the selected repository
  const [selectedRepository, setSelectedRepository] = useState<
    | {
        name: string;
        path: string;
      }
    | undefined
  >(initialRepository);

  // Handler that updates both internal state and calls external callback
  const handleRepositorySelected = useCallback(
    (repository: { name: string; path: string } | undefined) => {
      setSelectedRepository(repository);
      externalOnRepositorySelected?.(repository);
    },
    [externalOnRepositorySelected],
  );

  // Log when repository changes
  useEffect(() => {
    console.info(
      '[AlexandriaWorkspaceLayout] Selected repository state updated:',
      selectedRepository,
    );
  }, [selectedRepository]);

  const terminalContext = `alexandria-workspace-${workspace.id}`;
  const workspacePath = workspace.suggestedClonePath || '/workspace';

  return (
    <PanelProvider
      workspace={{
        id: workspace.id,
        name: workspace.name,
        path: workspacePath,
        suggestedClonePath: workspace.suggestedClonePath,
        description: workspace.description,
        theme: workspace.theme,
        icon: workspace.icon,
        isDefault: workspace.isDefault,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        metadata: workspace.metadata,
      }}
      repository={selectedRepository}
      theme={theme}
      terminalContext={terminalContext}
    >
      <TerminalProvider
        repositoryPath={selectedRepository?.path || workspacePath}
        terminalContext={terminalContext}
        repoName={selectedRepository?.name}
      >
        <AgentHighlightProvider
          repositoryPath={selectedRepository?.path || ''}
        >
          <AlexandriaWorkspaceLayoutContent
            selectedRepository={selectedRepository}
            onRepositorySelected={handleRepositorySelected}
            enableKeyboardShortcuts={enableKeyboardShortcuts}
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            layout={layout}
            onLayoutChange={onLayoutChange}
            showPanelSidebar={showPanelSidebar}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </PanelProvider>
  );
};
