import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import type { WorkspaceLayout } from '../../shared/types/userPreferences.types';
import type { PanelLayout } from '@a24z/panels';

/**
 * WorkspaceLayoutService - Manages workspace layout presets
 *
 * This service handles CRUD operations for workspace layouts (panel configuration presets)
 * and provides utilities for comparing layouts and managing built-in workspaces.
 */
export class WorkspaceLayoutService {
  /**
   * Get all workspace layouts (including built-in)
   */
  static async getWorkspaceLayouts(): Promise<Record<string, WorkspaceLayout>> {
    const prefs = await UserPreferencesService.getPreferences();
    const builtInWorkspaces = this.getBuiltInWorkspaceLayouts();
    const userWorkspaces = prefs.workspaceLayouts?.presets || {};

    // Merge built-in and user workspaces, built-in takes precedence
    return {
      ...userWorkspaces,
      ...builtInWorkspaces,
    };
  }

  /**
   * Get a specific workspace layout by ID
   */
  static async getWorkspaceLayout(id: string): Promise<WorkspaceLayout | null> {
    const workspaces = await this.getWorkspaceLayouts();
    return workspaces[id] || null;
  }

  /**
   * Create a new workspace layout
   */
  static async createWorkspaceLayout(
    name: string,
    layout: PanelLayout,
    options?: {
      description?: string;
      defaultSizes?: { left: number; middle: number; right: number };
      defaultCollapsed?: { left?: boolean; right?: boolean };
    },
  ): Promise<WorkspaceLayout> {
    const prefs = await UserPreferencesService.getPreferences();
    const id = this.generateWorkspaceId(name);

    const workspace: WorkspaceLayout = {
      id,
      name,
      description: options?.description,
      layout,
      defaultSizes: options?.defaultSizes,
      defaultCollapsed: options?.defaultCollapsed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltIn: false,
    };

    const updatedPresets = {
      ...(prefs.workspaceLayouts?.presets || {}),
      [id]: workspace,
    };

    await UserPreferencesService.updatePreferences({
      workspaceLayouts: {
        ...prefs.workspaceLayouts,
        presets: updatedPresets,
      },
    });

    return workspace;
  }

  /**
   * Update an existing workspace layout
   */
  static async updateWorkspaceLayout(
    id: string,
    updates: Partial<Omit<WorkspaceLayout, 'id' | 'createdAt' | 'isBuiltIn'>>,
  ): Promise<WorkspaceLayout | null> {
    const prefs = await UserPreferencesService.getPreferences();
    const existingWorkspace = prefs.workspaceLayouts?.presets?.[id];

    if (!existingWorkspace) {
      console.error(`Workspace layout ${id} not found`);
      return null;
    }

    // Don't allow updating built-in workspaces
    if (existingWorkspace.isBuiltIn) {
      console.error(`Cannot update built-in workspace layout ${id}`);
      return null;
    }

    const updatedWorkspace: WorkspaceLayout = {
      ...existingWorkspace,
      ...updates,
      id, // Preserve ID
      createdAt: existingWorkspace.createdAt, // Preserve creation time
      updatedAt: Date.now(),
    };

    const updatedPresets = {
      ...(prefs.workspaceLayouts?.presets || {}),
      [id]: updatedWorkspace,
    };

    await UserPreferencesService.updatePreferences({
      workspaceLayouts: {
        ...prefs.workspaceLayouts,
        presets: updatedPresets,
      },
    });

    return updatedWorkspace;
  }

  /**
   * Delete a workspace layout
   */
  static async deleteWorkspaceLayout(id: string): Promise<boolean> {
    const prefs = await UserPreferencesService.getPreferences();
    const workspace = prefs.workspaceLayouts?.presets?.[id];

    if (!workspace) {
      console.error(`Workspace layout ${id} not found`);
      return false;
    }

    // Don't allow deleting built-in workspaces
    if (workspace.isBuiltIn) {
      console.error(`Cannot delete built-in workspace layout ${id}`);
      return false;
    }

    const updatedPresets = { ...(prefs.workspaceLayouts?.presets || {}) };
    delete updatedPresets[id];

    await UserPreferencesService.updatePreferences({
      workspaceLayouts: {
        ...prefs.workspaceLayouts,
        presets: updatedPresets,
      },
    });

    return true;
  }

  /**
   * Get repository state (which workspace + current sizes/collapsed)
   */
  static async getRepositoryState(repositoryKey: string): Promise<{
    workspaceId: string | null;
    layout?: PanelLayout;
    sizes: { left: number; middle: number; right: number };
    collapsed: { left?: boolean; right?: boolean };
  } | null> {
    const prefs = await UserPreferencesService.getPreferences();
    return prefs.workspaceLayouts?.repositoryState?.[repositoryKey] || null;
  }

  /**
   * Set repository state (which workspace + current sizes/collapsed/layout)
   */
  static async setRepositoryState(
    repositoryKey: string,
    state: {
      workspaceId: string | null;
      layout?: PanelLayout;
      sizes: { left: number; middle: number; right: number };
      collapsed: { left?: boolean; right?: boolean };
    },
  ): Promise<void> {
    const prefs = await UserPreferencesService.getPreferences();

    await UserPreferencesService.updatePreferences({
      workspaceLayouts: {
        ...prefs.workspaceLayouts,
        presets: prefs.workspaceLayouts?.presets || {},
        repositoryState: {
          ...(prefs.workspaceLayouts?.repositoryState || {}),
          [repositoryKey]: state,
        },
      },
    });
  }

  /**
   * Update only sizes in repository state
   */
  static async updateRepositorySizes(
    repositoryKey: string,
    sizes: { left: number; middle: number; right: number },
  ): Promise<void> {
    const currentState = await this.getRepositoryState(repositoryKey);
    if (!currentState) return;

    await this.setRepositoryState(repositoryKey, {
      ...currentState,
      sizes,
    });
  }

  /**
   * Update only collapsed state in repository state
   */
  static async updateRepositoryCollapsed(
    repositoryKey: string,
    collapsed: { left?: boolean; right?: boolean },
  ): Promise<void> {
    const currentState = await this.getRepositoryState(repositoryKey);
    if (!currentState) return;

    await this.setRepositoryState(repositoryKey, {
      ...currentState,
      collapsed,
    });
  }

  /**
   * Check if repository state differs from workspace defaults
   */
  static hasStateDeviation(
    repoState: {
      workspaceId: string | null;
      sizes: { left: number; middle: number; right: number };
      collapsed: { left?: boolean; right?: boolean };
    },
    workspace: WorkspaceLayout,
  ): {
    hasSizeDeviation: boolean;
    hasCollapsedDeviation: boolean;
  } {
    const hasSizeDeviation = workspace.defaultSizes
      ? JSON.stringify(repoState.sizes) !==
        JSON.stringify(workspace.defaultSizes)
      : false;

    const hasCollapsedDeviation = workspace.defaultCollapsed
      ? JSON.stringify(repoState.collapsed) !==
        JSON.stringify(workspace.defaultCollapsed)
      : false;

    return { hasSizeDeviation, hasCollapsedDeviation };
  }

  /**
   * Update workspace defaults from repository state
   */
  static async updateWorkspaceFromRepositoryState(
    workspaceId: string,
    repositoryKey: string,
  ): Promise<void> {
    const workspace = await this.getWorkspaceLayout(workspaceId);
    const repoState = await this.getRepositoryState(repositoryKey);

    if (!workspace || !repoState || workspace.isBuiltIn) {
      console.error(
        'Cannot update built-in workspace or workspace/state not found',
      );
      return;
    }

    await this.updateWorkspaceLayout(workspaceId, {
      defaultSizes: repoState.sizes,
      defaultCollapsed: repoState.collapsed,
    });
  }

  /**
   * Reset repository state to workspace defaults
   */
  static async resetRepositoryToWorkspaceDefaults(
    repositoryKey: string,
    workspaceId: string,
  ): Promise<void> {
    const workspace = await this.getWorkspaceLayout(workspaceId);
    if (!workspace) {
      console.error(`Workspace ${workspaceId} not found`);
      return;
    }

    const currentState = await this.getRepositoryState(repositoryKey);
    if (!currentState) return;

    await this.setRepositoryState(repositoryKey, {
      ...currentState,
      sizes: workspace.defaultSizes || { left: 20, middle: 45, right: 35 },
      collapsed: workspace.defaultCollapsed || { left: false, right: false },
    });
  }

  /**
   * Check if a layout matches a workspace layout
   */
  static isLayoutMatchingWorkspace(
    layout: PanelLayout,
    workspace: WorkspaceLayout,
  ): boolean {
    return this.areLayoutsEqual(layout, workspace.layout);
  }

  /**
   * Find workspace ID that matches the given layout
   */
  static async findMatchingWorkspace(
    layout: PanelLayout,
  ): Promise<string | null> {
    const workspaces = await this.getWorkspaceLayouts();

    for (const [id, workspace] of Object.entries(workspaces)) {
      if (this.isLayoutMatchingWorkspace(layout, workspace)) {
        return id;
      }
    }

    return null;
  }

  /**
   * Deep comparison of two panel layouts
   */
  private static areLayoutsEqual(
    layout1: PanelLayout,
    layout2: PanelLayout,
  ): boolean {
    return JSON.stringify(layout1) === JSON.stringify(layout2);
  }

  /**
   * Generate a unique ID from a workspace name
   */
  private static generateWorkspaceId(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${base}-${Date.now()}`;
  }

  /**
   * Get built-in workspace layouts
   */
  static getBuiltInWorkspaceLayouts(): Record<string, WorkspaceLayout> {
    const now = Date.now();

    return {
      'project-management': {
        id: 'project-management',
        name: 'Project Management',
        description:
          'Tasks, dependencies, issues, file tree, docs, drawings, multi terminal, city visualization, code viewer, markdown slides, and excalidraw',
        layout: {
          left: {
            type: 'tabs',
            panels: [
              'tasks',
              'dependencies',
              'gitIssues',
              'fileTree',
              'docs',
              'drawings',
            ],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          middle: 'multiTerminal',
          right: {
            type: 'tabs',
            panels: [
              'cityVisualization',
              'codeViewer',
              'markdownViewer',
              'excalidrawDiagram',
            ],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
        },
        defaultSizes: { left: 20, middle: 45, right: 35 },
        defaultCollapsed: { left: false, right: false },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      'code-review': {
        id: 'code-review',
        name: 'Code Review',
        description:
          'Git changes, pull requests, and file tree on left, git diff and code viewer in middle, city map on right',
        layout: {
          left: {
            type: 'tabs',
            panels: ['gitChanges', 'gitPullRequests', 'fileTree'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          middle: {
            type: 'tabs',
            panels: ['gitDiff', 'codeViewer'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          right: 'cityVisualization',
        },
        defaultSizes: { left: 20, middle: 50, right: 30 },
        defaultCollapsed: { left: false, right: false },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      documentation: {
        id: 'documentation',
        name: 'Documentation',
        description: 'Docs, markdown viewer, and code viewer',
        layout: {
          left: 'docs',
          middle: 'markdownViewer',
          right: 'codeViewer',
        },
        defaultSizes: { left: 20, middle: 40, right: 40 },
        defaultCollapsed: { left: false, right: true },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      'agent-work': {
        id: 'agent-work',
        name: 'Agent Work',
        description:
          'Git changes, tasks, agent sessions, agent context, docs, multi terminal, city map, git diff, code viewer, and markdown slides',
        layout: {
          left: {
            type: 'tabs',
            panels: [
              'gitChanges',
              'tasks',
              'agentSessions',
              'agentContext',
              'docs',
            ],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          middle: 'multiTerminal',
          right: {
            type: 'tabs',
            panels: [
              'cityVisualization',
              'gitDiff',
              'codeViewer',
              'markdownViewer',
            ],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
        },
        defaultSizes: { left: 30, middle: 40, right: 30 },
        defaultCollapsed: { left: false, right: false },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      'quality-check': {
        id: 'quality-check',
        name: 'Quality Check',
        description:
          'Package information, tools, and dependencies on left; city visualization map in middle; multi terminal and code viewer on right (collapsed)',
        layout: {
          left: {
            type: 'tabs',
            panels: ['packageInfo', 'tools', 'dependencies'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          middle: 'cityVisualization',
          right: {
            type: 'tabs',
            panels: ['multiTerminal', 'codeViewer'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
        },
        defaultSizes: { left: 20, middle: 45, right: 35 },
        defaultCollapsed: { left: false, right: true },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      drawing: {
        id: 'drawing',
        name: 'Drawing',
        description:
          'Drawings and docs, excalidraw diagram, multi terminal and markdown viewer',
        layout: {
          left: {
            type: 'tabs',
            panels: ['drawings', 'docs'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          middle: 'excalidrawDiagram',
          right: {
            type: 'tabs',
            panels: ['multiTerminal', 'markdownViewer'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
        },
        defaultSizes: { left: 20, middle: 50, right: 30 },
        defaultCollapsed: { left: false, right: true },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      'old-school': {
        id: 'old-school',
        name: 'Old School',
        description:
          'File tree, search, git changes, and docs on left; code viewer and markdown viewer in middle; multi terminal and city map on right (collapsed)',
        layout: {
          left: {
            type: 'tabs',
            panels: ['fileTree', 'search', 'gitChanges', 'docs'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          middle: {
            type: 'tabs',
            panels: ['codeViewer', 'markdownViewer'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
          right: {
            type: 'tabs',
            panels: ['multiTerminal', 'cityVisualization'],
            config: { defaultActiveTab: 0, tabPosition: 'top' },
          },
        },
        defaultSizes: { left: 20, middle: 50, right: 30 },
        defaultCollapsed: { left: false, right: true },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
      'principal-office': {
        id: 'principal-office',
        name: 'Principal Office',
        description:
          'Alexandria docs on left, MDX editor in middle, multi terminal on right',
        layout: {
          left: 'docs',
          middle: 'mdxEditor',
          right: 'multiTerminal',
        },
        defaultSizes: { left: 20, middle: 50, right: 30 },
        defaultCollapsed: { left: false, right: false },
        createdAt: now,
        updatedAt: now,
        isBuiltIn: true,
      },
    };
  }

  /**
   * Initialize workspace layouts with built-in defaults if none exist
   */
  static async initializeWorkspaceLayouts(): Promise<void> {
    const prefs = await UserPreferencesService.getPreferences();

    // Only initialize if workspaceLayouts doesn't exist yet
    if (!prefs.workspaceLayouts) {
      await UserPreferencesService.updatePreferences({
        workspaceLayouts: {
          presets: {},
          lastUsedWorkspace: {},
          builtInWorkspaceIds: [
            'project-management',
            'code-review',
            'documentation',
            'agent-work',
            'quality-check',
            'drawing',
            'old-school',
            'principal-office',
          ],
        },
      });
    }
  }
}
