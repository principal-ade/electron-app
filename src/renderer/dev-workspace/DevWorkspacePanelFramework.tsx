import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
import { TabbedTerminalPanel, type BaseTab, type TerminalTab } from '@industry-theme/xterm-terminal-panel';
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
import { panels as agentPanels, type Skill } from '@industry-theme/agent-panels';
import { panels as githubPanels } from '@industry-theme/github-panels';
import type { Repository } from '../../shared/types/repository.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

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
 * Union type of all tab types used in DevWorkspace
 */
type DevWorkspaceTab = TerminalTab | SkillTab | MarkdownTab;

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
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
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
> = ({ collapsed, onCollapsedChange, layout, onLayoutChange, panelSizes, onPanelSizesChange, panelFocus, onFocusLeft, onFocusRight }) => {
  const { theme } = useTheme();
  const { context, actions, events } = useRepositoryPanelProvider();
  const { context: terminalCtx, actions: terminalActions } =
    useTerminalProvider();

  // Load terminal implementation preference (default to xterm)
  const [terminalImplementation, setTerminalImplementation] = useState<
    'xterm' | 'ghostty'
  >('xterm');

  // Unified modal state for detail panels
  const [detailModal, setDetailModal] = useState<{
    panelId: 'task-detail' | 'agentDetail' | 'gitDiff' | 'fileEditor' | 'githubIssueDetail';
    data: any;
  } | null>(null);

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

  // Tab state for TabbedTerminalPanel (skills only - terminals are managed by the panel from context)
  const [tabs, setTabs] = useState<DevWorkspaceTab[]>([]);

  // Track active tab ID for controlled mode
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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
    setTabs(prevTabs => {
      // Only keep custom tabs from the update (filter out terminal tabs)
      // Terminal tabs are managed by TabbedTerminalPanel, we only care about custom tabs
      const newCustomTabs = newTabs.filter(t => t.contentType !== 'terminal');
      const prevCustomTabs = prevTabs.filter(t => t.contentType !== 'terminal');

      // Check if custom tabs actually changed
      const customTabsChanged =
        newCustomTabs.length !== prevCustomTabs.length ||
        !newCustomTabs.every(tab => prevCustomTabs.some(prev => prev.id === tab.id));

      if (!customTabsChanged) {
        return prevTabs; // No change
      }

      return newCustomTabs; // Only store custom tabs
    });
  }, []);

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

  // Agent Documentation panels (AGENTS.md + Subagents)
  const AgentsListPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agents-list',
  )?.component;
  const AgentDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agent-detail',
  )?.component;

  // GitHub panels
  const GitHubIssuesPanelComponent = githubPanels.find(
    (p) => p.metadata?.id === 'industry-theme.github-issues',
  )?.component;
  const GitHubIssueDetailPanelComponent = githubPanels.find(
    (p) => p.metadata?.id === 'industry-theme.github-issue-detail',
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

  // Listen for detail panel events to show modals
  useEffect(() => {
    console.log('[DevWorkspacePanelFramework] Registering event handlers, events object:', events);

    const unsubscribers = [
      // Task detail
      events.on('task:selected', (event) => {
        // Ignore re-emitted events from modal to prevent loop
        if (event.source === 'modal') return;

        console.log('[DevWorkspacePanelFramework] Received task:selected event:', event);
        const payload = event.payload as { task: any; taskId: string };
        setDetailModal({
          panelId: 'task-detail',
          data: payload.task,
        });
      }),
      // Skill detail - create tab instead of modal
      events.on('skill:selected', (event) => {
        console.log('[DevWorkspacePanelFramework] ===== SKILL SELECTED EVENT FIRED =====');
        console.log('[DevWorkspacePanelFramework] Event source:', event.source);
        console.log('[DevWorkspacePanelFramework] Event payload:', event.payload);
        console.log('[DevWorkspacePanelFramework] Full event:', event);

        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          console.log('[DevWorkspacePanelFramework] Ignoring tab re-emission');
          return;
        }

        console.log('[DevWorkspacePanelFramework] Received skill:selected event:', event);
        const payload = event.payload as { skill?: any; skillId?: string };

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
            // Tab exists - no action needed, TabbedTerminalPanel will auto-activate it
            console.log('[DevWorkspacePanelFramework] Skill tab already exists:', existingTab.id);
            return prevTabs; // No change to tabs array
          }

          // Create new skill tab with full skill object for instant loading
          const newTab: SkillTab = {
            id: `skill-${skill.id}-${Date.now()}`,
            label: skill.name || 'Skill',
            contentType: 'skill',
            skillId: skill.id,
            skillName: skill.name || '',
            skill: skill, // Pass full skill object for instant display
            closable: true,
          };

          console.log('[DevWorkspacePanelFramework] Creating new skill tab (skill pre-loaded):', newTab);
          // TabbedTerminalPanel will auto-activate the new tab via its internal logic
          return [...prevTabs, newTab];
        });
      }),
      // Agent detail
      events.on('agent:selected', (event) => {
        // Ignore re-emitted events from modal to prevent loop
        if (event.source === 'modal') return;

        console.log('[DevWorkspacePanelFramework] Received agent:selected event:', event);
        const payload = event.payload as { agent: any };
        setDetailModal({
          panelId: 'agentDetail',
          data: payload.agent,
        });
      }),
      // GitHub issue detail
      events.on('issue:selected', (event) => {
        // Ignore re-emitted events from modal to prevent loop
        if (event.source === 'modal') return;

        console.log('[DevWorkspacePanelFramework] Received issue:selected event:', event);
        const payload = event.payload as { issue: any };
        setDetailModal({
          panelId: 'githubIssueDetail',
          data: payload.issue,
        });
      }),
      // File open from git changes panel
      events.on('file:open', (event) => {
        // Ignore re-emitted events from modal to prevent loop
        if (event.source === 'modal') return;

        console.log('[DevWorkspacePanelFramework] Received file:open event:', event);
        const payload = event.payload as { path: string; gitStatus?: string };

        // Use git diff panel for modified files (staged or unstaged), file editor for new/untracked files
        const isModified = payload.gitStatus === 'unstaged' || payload.gitStatus === 'staged';
        const panelId = isModified ? 'gitDiff' : 'fileEditor';

        console.log('[DevWorkspacePanelFramework] Git status:', payload.gitStatus, '-> Opening panel:', panelId);

        setDetailModal({
          panelId,
          data: payload,
        });
      }),
      // Markdown file open in tab (from docs panel clicks)
      events.on('file:opened', async (event) => {
        // Ignore re-emitted events from tabs to prevent loop
        if (event.source === 'tab') {
          console.log('[DevWorkspacePanelFramework] Ignoring tab re-emission');
          return;
        }

        const payload = event.payload as { filePath?: string; path?: string };
        const filePath = payload.filePath || payload.path;

        if (!filePath) {
          console.warn('[DevWorkspacePanelFramework] No file path in file:opened event:', payload);
          return;
        }

        // Only handle markdown files - open them in tabs
        if (!filePath.endsWith('.md')) {
          return; // Ignore non-markdown files
        }

        console.log('[DevWorkspacePanelFramework] Received file:opened event for markdown:', filePath);
        const fileName = filePath.split('/').pop() || 'Markdown';

        // Check if this file is already being loaded (prevents duplicate tabs on rapid clicks)
        if (loadingMarkdownFilesRef.current.has(filePath)) {
          console.log('[DevWorkspacePanelFramework] Markdown file already being loaded:', filePath);
          return;
        }

        // Mark this file as being loaded
        loadingMarkdownFilesRef.current.add(filePath);

        try {
          // Check if tab already exists (use callback to get latest state)
          let existingTabId: string | null = null;
          setTabs((prevTabs) => {
            const existingTab = prevTabs.find(
              (t) => t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath
            );

            if (existingTab) {
              console.log('[DevWorkspacePanelFramework] Markdown tab already exists:', existingTab.id);
              existingTabId = existingTab.id;
              return prevTabs; // No change
            }

            return prevTabs; // No change yet, will create after loading
          });

          // Reload file content (for both new and existing tabs)
          // For existing tabs, this refreshes the content in case it changed
          console.log('[DevWorkspacePanelFramework] Loading markdown file:', filePath);
          if (actions.setActiveFile) {
            await actions.setActiveFile(filePath);
          }

          if (existingTabId) {
            // Tab exists - activate it
            console.log('[DevWorkspacePanelFramework] Activating existing markdown tab:', existingTabId);
            setActiveTabId(existingTabId);
            return; // Tab existed and was activated, file reloaded
          }

          // Now create the tab with the file already loaded
          let newTabId: string | null = null;
          setTabs((prevTabs) => {
            // Double-check tab doesn't exist (in case created while loading)
            const existingTab = prevTabs.find(
              (t) => t.contentType === 'markdown' && (t as MarkdownTab).filePath === filePath
            );

            if (existingTab) {
              console.log('[DevWorkspacePanelFramework] Markdown tab created while loading:', existingTab.id);
              newTabId = existingTab.id;
              return prevTabs;
            }

            const newTab: MarkdownTab = {
              id: `markdown-${Date.now()}`,
              label: fileName,
              contentType: 'markdown',
              filePath: filePath,
              fileName: fileName,
              closable: true,
            };

            console.log('[DevWorkspacePanelFramework] Creating new markdown tab (file pre-loaded):', newTab);
            newTabId = newTab.id;
            return [...prevTabs, newTab];
          });

          // Activate the tab on next tick (after React finishes state updates)
          if (newTabId) {
            setTimeout(() => {
              console.log('[DevWorkspacePanelFramework] Activating new markdown tab:', newTabId);
              setActiveTabId(newTabId);
            }, 0);
          }
        } finally {
          // Always remove from loading set when done
          loadingMarkdownFilesRef.current.delete(filePath);
        }
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events]);

  // Re-emit selection events when modal opens so detail panels can receive them
  useEffect(() => {
    if (detailModal) {
      console.log('[DevWorkspacePanelFramework] Modal opened with data:', detailModal);
      // Use setTimeout to ensure the detail panel component is mounted first
      setTimeout(() => {
        if (detailModal.panelId === 'task-detail') {
          events.emit({
            type: 'task:selected',
            source: 'modal',
            timestamp: Date.now(),
            payload: {
              task: detailModal.data,
              taskId: detailModal.data.id,
            },
          });
        } else if (detailModal.panelId === 'agentDetail') {
          console.log('[DevWorkspacePanelFramework] Re-emitting agent:selected with data:', detailModal.data);
          events.emit({
            type: 'agent:selected',
            source: 'modal',
            timestamp: Date.now(),
            payload: {
              id: detailModal.data.id,
              data: detailModal.data,
            },
          });
        } else if (detailModal.panelId === 'githubIssueDetail') {
          console.log('[DevWorkspacePanelFramework] Re-emitting issue:selected with data:', detailModal.data);
          events.emit({
            type: 'issue:selected',
            source: 'modal',
            timestamp: Date.now(),
            payload: {
              issue: detailModal.data,
            },
          });
        } else if (detailModal.panelId === 'gitDiff') {
          console.log('[DevWorkspacePanelFramework] Emitting git:diff event:', detailModal.data);
          // GitDiffPanel listens for git:diff events
          events.emit({
            type: 'git:diff',
            source: 'modal',
            timestamp: Date.now(),
            payload: {
              path: detailModal.data.path,
              status: detailModal.data.gitStatus,
            },
          });
        } else if (detailModal.panelId === 'fileEditor') {
          console.log('[DevWorkspacePanelFramework] Setting active file for editor:', detailModal.data.path);
          // Set the active file via actions
          if (actions.setActiveFile) {
            actions.setActiveFile(detailModal.data.path);
          }
          // Emit file:open event for file editor
          events.emit({
            type: 'file:open',
            source: 'modal',
            timestamp: Date.now(),
            payload: detailModal.data,
          });
        }
      }, 0);
    }
  }, [detailModal, events]);

  // Listen for deselection events to close the modal (from panel's X button)
  useEffect(() => {
    const unsubscribers = [
      events.on('task:deselected', () => {
        console.log('[DevWorkspacePanelFramework] Task deselected, closing modal');
        setDetailModal(null);
      }),
      events.on('agent:deselected', () => {
        console.log('[DevWorkspacePanelFramework] Agent deselected, closing modal');
        setDetailModal(null);
      }),
      events.on('issue:deselected', () => {
        console.log('[DevWorkspacePanelFramework] Issue deselected, closing modal');
        setDetailModal(null);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
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

          console.log('[DevWorkspacePanelFramework] Rendering skill tab:', {
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
                display: isActive ? 'flex' : 'none', // Only show when active
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

          console.log('[DevWorkspacePanelFramework] Rendering markdown tab:', {
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
                display: isActive ? 'flex' : 'none', // Only show when active
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

        default:
          console.warn('[DevWorkspacePanelFramework] Unknown tab type:', (tab as any).contentType);
          return (
            <div style={{ padding: '2rem', color: theme.colors.error }}>
              Unknown tab type: {(tab as any).contentType}
            </div>
          );
      }
    },
    [theme, SkillDetailPanelComponent, MarkdownPanelComponent],
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
                width={terminalPanelWidth}
                activeTabId={activeTabId}
                onActiveTabChange={setActiveTabId}
              />
            </div>
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
      {
        id: 'agentsList',
        label: 'Agents List',
        content: AgentsListPanelComponent ? (
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
            <AgentsListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div>Agents List panel not available</div>
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
    ],
    // NOTE: tabs, handleTabsChange, and renderTabContent are intentionally excluded
    // from dependencies to prevent unnecessary re-renders of all panels when tabs change.
    // These are only used by the terminal panel and don't affect other panels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      AgentsListPanelComponent,
      AgentDetailPanelComponent,
      GitHubIssuesPanelComponent,
      GitHubIssueDetailPanelComponent,
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
        defaultSizes={panelSizes || { left: 25, middle: 50, right: 25 }}
        minSizes={{ left: 15, middle: 30, right: 15 }}
        collapsed={collapsed}
        showCollapseButtons={false}
        theme={theme}
        onPanelResize={onPanelSizesChange}
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
            {detailModal.panelId === 'task-detail' && TaskDetailPanelComponent && (
              <TaskDetailPanelComponent
                context={context}
                actions={actions}
                events={events}
              />
            )}
            {detailModal.panelId === 'agentDetail' && AgentDetailPanelComponent && (
              <AgentDetailPanelComponent
                context={{
                  ...context,
                  slices: new Map([
                    ...Array.from(context.slices?.entries() || []),
                    ['selectedAgent', {
                      scope: 'repository' as const,
                      name: 'selectedAgent',
                      data: detailModal.data,
                      loading: false,
                    }],
                  ]),
                }}
                actions={actions}
                events={events}
              />
            )}
            {detailModal.panelId === 'gitDiff' && GitDiffPanelComponent && (
              <div style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <GitDiffPanelComponent
                  context={context}
                  actions={actions}
                  events={events}
                />
              </div>
            )}
            {detailModal.panelId === 'fileEditor' && FileEditorPanelComponent && (
              <div style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <FileEditorPanelComponent
                  context={context}
                  actions={actions}
                  events={events}
                />
              </div>
            )}
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
                    }],
                  ]),
                }}
                actions={actions}
                events={events}
              />
            )}
          </div>
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
  panelSizes,
  onPanelSizesChange,
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
            panelSizes={panelSizes}
            onPanelSizesChange={onPanelSizesChange}
            panelFocus={panelFocus}
            onFocusLeft={onFocusLeft}
            onFocusRight={onFocusRight}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </RepositoryPanelProvider>
  );
};
