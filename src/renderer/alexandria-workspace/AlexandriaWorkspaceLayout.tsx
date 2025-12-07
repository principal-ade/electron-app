import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import {
  EditableConfigurablePanelLayout,
  PanelLayout,
  usePanelFocus,
  usePanelKeyboardShortcuts,
  FocusIndicator,
} from '@principal-ade/panel-layouts';
import { PanelProvider, usePanelProvider } from '../contexts/PanelContext';
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { panels as workspacePanels } from '@industry-theme/alexandria-panels';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { panels as codeCityPanels } from '@industry-theme/code-city-panel';
import { panels as localhostPanels } from '@industry-theme/localhost-panels';
import { panels as agentDrivenPanels } from '@industry-theme/agent-driven-ui-panels';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { WindowService } from '../main-process-api/WindowService';

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
}

interface AlexandriaWorkspaceLayoutContentProps {
  onRepositorySelected: (repository: { name: string; path: string }) => void;
  enableKeyboardShortcuts: boolean;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
}

/**
 * Content component that uses panel context
 */
const AlexandriaWorkspaceLayoutContent: React.FC<AlexandriaWorkspaceLayoutContentProps> = ({
  onRepositorySelected,
  enableKeyboardShortcuts,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
}) => {
  const { theme } = useTheme();
  const { context, actions, events } = usePanelProvider();

  const [isEditMode, _setIsEditMode] = useState(false);
  const [showAllTerminals, setShowAllTerminals] = useState(false);

  // Panel focus management for keyboard shortcuts
  const { focusedPanel, setFocus, isFocused } = usePanelFocus({
    initialFocus: enableKeyboardShortcuts ? 'middle' : null, // Only set initial focus if shortcuts enabled
    collapsed,
    panelType: 'three-panel',
  });

  // Collapse/expand handlers
  const handleExpand = useCallback(async (panel: 'left' | 'right') => {
    onCollapsedChange({ ...collapsed, [panel]: false });
  }, [collapsed, onCollapsedChange]);

  const handleCollapse = useCallback(async (panel: 'left' | 'right') => {
    onCollapsedChange({ ...collapsed, [panel]: true });
  }, [collapsed, onCollapsedChange]);

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

      console.info('[AlexandriaWorkspaceLayout] Repository selected event received:', {
        repository,
        repositoryPath,
      });

      if (repository) {
        const repoPath = repositoryPath || repository.path;
        const selectedRepo = {
          name: repository.name,
          path: repoPath,
        };
        console.info('[AlexandriaWorkspaceLayout] Updating selected repository:', selectedRepo);
        onRepositorySelected(selectedRepo);
      }
    });

    return unsubscribe;
  }, [events, onRepositorySelected]);

  // Listen for repository:opened events (for explicitly opening windows)
  useEffect(() => {
    const unsubscribe = events.on('repository:opened', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };

      console.info('[AlexandriaWorkspaceLayout] Repository opened event received:', {
        repository,
        repositoryPath,
      });

      if (repository) {
        const repoPath = repositoryPath || repository.path;

        // Open the repository in a new dev workspace window
        if (repoPath) {
          try {
            await WindowService.openDevWorkspace({
              repositoryPath: repoPath,
              repositoryName: repository.name,
            });
          } catch (error) {
            console.error('[AlexandriaWorkspaceLayout] Failed to open dev workspace:', error);
          }
        }
      }
    });

    return unsubscribe;
  }, [events]);

  // Listen for file:opened events (from Alexandria docs panel)
  useEffect(() => {
    const unsubscribe = events.on('file:opened', async (event) => {
      const { filePath } = event.payload as { filePath: string };

      console.info('[AlexandriaWorkspaceLayout] File opened event received:', filePath);

      // If it's a markdown file, open it in the standalone markdown viewer
      if (filePath.endsWith('.md')) {
        // We need a repository context to open the markdown file
        const repositoryPath = context.currentScope.repository?.path;

        if (!repositoryPath) {
          console.warn('[AlexandriaWorkspaceLayout] Cannot open markdown file - no repository selected');
          return;
        }

        try {
          // Use the new function that handles relative paths in the main process
          await WindowService.openMarkdownViewFromRepository(filePath, repositoryPath, {
            viewMode: 'single',
          });
        } catch (error) {
          console.error('[AlexandriaWorkspaceLayout] Failed to open markdown viewer:', error);
        }
      }
    });

    return unsubscribe;
  }, [events, context]);

  // Get panel components
  // Use WorkspaceRepositoriesPanel (panels[1]) which expects workspace + workspaceRepositories slices
  const WorkspacePanelComponent = workspacePanels[1]?.component;
  const LocalProjectsPanelComponent = workspacePanels.find(p => p.metadata?.id === 'industry-theme.local-projects')?.component;
  const DocsPanelComponent = docsPanels[0]?.component;
  const CodeCityPanelComponent = codeCityPanels[0]?.component;
  const LocalhostPanelComponent = localhostPanels[0]?.component;
  const EventBusPanelComponent = agentDrivenPanels.find(p => p.metadata?.id === 'industry-theme.event-bus-panel')?.component;
  const AgentToolsPanelComponent = agentDrivenPanels.find(p => p.metadata?.id === 'industry-theme.agent-tools-panel')?.component;

  // Get terminal directory from context
  const terminalDirectory = context.currentScope.repository?.path ||
    context.currentScope.workspace?.path ||
    '/';

  // Create terminal context identifier
  const terminalContext = `terminal:alexandria:${context.currentScope.workspace?.id || 'default'}`;

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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('left')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('left')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('middle')} />}
            <TabbedTerminalPanel
              context={context}
              actions={actions}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Alexandria Docs panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'code-city',
        label: 'Code City',
        content: CodeCityPanelComponent ? (
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
            <CodeCityPanelComponent
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('right')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('left')} />}
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
            {enableKeyboardShortcuts && <FocusIndicator isFocused={isFocused('left')} />}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Local Projects panel not available
            </p>
          </div>
        ),
      },
    ],
    [theme, context, actions, events, WorkspacePanelComponent, LocalProjectsPanelComponent, DocsPanelComponent, CodeCityPanelComponent, LocalhostPanelComponent, EventBusPanelComponent, AgentToolsPanelComponent, isFocused, enableKeyboardShortcuts, terminalContext, terminalDirectory, showAllTerminals]
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        overflow: 'hidden',
      }}
    >
      <EditableConfigurablePanelLayout
        theme={theme}
        panels={panels}
        layout={layout}
        isEditMode={isEditMode}
        onLayoutChange={onLayoutChange}
        defaultSizes={{ left: 25, middle: 50, right: 25 }}
        minSizes={{ left: 15, middle: 30, right: 20 }}
        collapsed={collapsed}
        collapsiblePanels={{ left: true, right: true }}
        showCollapseButtons={false}
      />
    </div>
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
  right: 'code-city',
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
}) => {
  const { theme } = useTheme();

  // Internal collapsed state (used when not controlled externally)
  const [internalCollapsed, setInternalCollapsed] = useState({ left: false, right: false });

  // Internal layout state (used when not controlled externally)
  const [internalLayout, setInternalLayout] = useState<PanelLayout>(DEFAULT_LAYOUT);

  // Use external state if provided, otherwise use internal
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onCollapsedChange = externalOnCollapsedChange ?? setInternalCollapsed;

  const layout = externalLayout ?? internalLayout;
  const onLayoutChange = externalOnLayoutChange ?? setInternalLayout;

  // Track the selected repository
  const [selectedRepository, setSelectedRepository] = useState<{
    name: string;
    path: string;
  } | undefined>(initialRepository);

  // Log when repository changes
  useEffect(() => {
    console.info('[AlexandriaWorkspaceLayout] Selected repository state updated:', selectedRepository);
  }, [selectedRepository]);

  return (
    <PanelProvider
      workspace={{
        id: workspace.id,
        name: workspace.name,
        path: workspace.suggestedClonePath || '/workspace',
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
      terminalContext={`alexandria-workspace-${workspace.id}`}
    >
      <AlexandriaWorkspaceLayoutContent
        onRepositorySelected={setSelectedRepository}
        enableKeyboardShortcuts={enableKeyboardShortcuts}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        layout={layout}
        onLayoutChange={onLayoutChange}
      />
    </PanelProvider>
  );
};
