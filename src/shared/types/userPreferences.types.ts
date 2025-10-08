import { EditorId } from './editor.types';
import { TerminalId } from './terminal.types';
import type { RepositoryPanelVisibility } from './repositoryPanel.types';
import type { PanelLayout } from '@a24z/panels';

/**
 * WorkspaceLayout - A saved panel configuration preset
 */
export interface WorkspaceLayout {
  id: string;
  name: string;
  description?: string;
  layout: PanelLayout;
  // Optional: default sizes and collapse states
  defaultSizes?: { left: number; middle: number; right: number };
  defaultCollapsed?: { left?: boolean; right?: boolean };
  createdAt: number;
  updatedAt: number;
  isBuiltIn?: boolean;
}

// Repository view types - unified naming
export type RepositoryViewType = 'exploration';

// Interactive shell navigation view types
export type InteractiveShellNavigationView =
  | 'repository'
  | 'terminal'
  | 'rooms'
  | 'search'
  | 'settings'
  | 'monitoring'
  | 'auth';

// Repository view right pane modes
export type RightPaneMode = 'city' | 'terminal' | 'session-detail' | 'document';

// Repository-specific UI state that persists across sessions
export interface RepositoryUIState {
  // Current active view/tab
  activeView?: RepositoryViewType;

  // Exploration view specific state
  explorationState?: {
    selectedFile?: string;
    expandedFolders?: string[];
    viewMode?: 'tree' | 'graph';
  };

  // Panel layout preferences scoped to this repository
  panelLayouts?: {
    exploration?: {
      collapsed?: { left?: boolean; right?: boolean };
      sizes?: { left: number; middle: number; right: number };
      layout?: PanelLayout;
    };
  };

  // Panel visibility preferences for repository details view
  panelVisibility?: Partial<RepositoryPanelVisibility>;

  // Last accessed timestamp
  lastAccessed?: number;
}

export interface UserPreferences {
  // AI/LLM settings
  ollamaModel?: string; // Selected Ollama model for summarizing agent work
  ollamaModels?: string[]; // Multiple selected models for testing

  // Repository view filters (legacy - kept for backward compatibility)
  repoShowLocalOnly?: boolean; // Show only repositories with local clones
  repoHideForkParents?: boolean; // Hide repositories that are parents of forks

  // Tag-based repository filters
  repoSelectedTags?: string[]; // Tags to include in filter
  repoExcludedTags?: string[]; // Tags to exclude from filter

  // Editor preferences
  /** Default editor for opening local repositories */
  defaultEditor?: EditorId;
  /** Enable vim mode in Monaco editors */
  enableVimMode?: boolean;

  // Terminal preferences
  /** Default terminal for opening shells */
  defaultTerminal?: TerminalId;

  // Repository management
  /** Default directory for cloning repositories */
  defaultCloneDirectory?: string;

  // Agent session preferences
  /** Automatically commit changes when stopping agent sessions */
  autoCommitOnStop?: boolean;

  // UI preferences
  defaultView?: 'projects' | 'customization';
  showRepoFilterBar?: boolean; // Show/hide the filter bar in repos view

  // Remote agent quick access buttons
  remoteAgentButtons?: {
    jules?: boolean;
    codex?: boolean;
  };

  // Titlebar button visibility
  titlebarButtons?: {
    theme?: boolean;
    customize?: boolean;
  };

  // Theme preferences
  selectedTheme?: string; // Name of the selected theme (built-in or custom)
  customThemes?: Record<string, Record<string, unknown>>; // User-defined custom themes
  colorMode?: 'light' | 'dark'; // Override for color mode
  // Theme customization overrides
  customThemeOverrides?: {
    [themeId: string]: {
      baseTheme: string; // Original theme name
      overrides: Record<string, unknown>; // Color overrides (partial Theme object)
      customName?: string; // Optional custom name
      lastModified: number; // Timestamp
    };
  };

  // Markdown rendering preferences
  useCustomMarkdownTheme?: boolean; // If true, use customMarkdownTheme instead of app theme
  customMarkdownTheme?: Record<string, unknown>; // Custom theme object for markdown rendering
  markdownFontSizeScale?: number; // Font size scale for markdown viewer (default 1.0)
  markdownViewMode?: 'single' | 'book'; // View mode for markdown viewer (single slide or book view)

  // Agent auto-update preferences
  agentAutoUpdate?: {
    enabled: boolean;
    checkInterval: number; // in hours
    autoInstall: boolean;
    notifyOnly: boolean;
    lastCheckTime?: number;
  };

  // Repository-specific UI state
  // Keyed by repository full name (e.g., "owner/repo")
  repositoryUIStates?: Record<string, RepositoryUIState>;

  // Landing page preferences
  landingPage?: {
    selectedRepository?: string; // Name of the selected repository
    showOnlyWithChanges?: boolean; // Filter to show only repositories with uncommitted changes
  };

  // Interactive shell preferences
  interactiveShell?: {
    activeNavigationView?: InteractiveShellNavigationView;
  };

  // Panel layout preferences (sizes and collapsed state)
  panelLayouts?: {
    repositoryExplorer?: {
      sizes?: { left: number; middle: number; right: number };
      collapsed?: { left?: boolean; right?: boolean };
    };
    roomsManager?: {
      sizes?: { left: number; middle: number; right: number };
      collapsed?: { left?: boolean; right?: boolean };
    };
    terminalManager?: {
      sizes?: { left: number; right: number };
      collapsed?: { left?: boolean };
    };
    authView?: {
      sizes?: { left: number; right: number };
      collapsed?: { left?: boolean };
    };
  };

  // Workspace layout presets
  workspaceLayouts?: {
    // Global workspace layouts (directory-agnostic)
    presets: Record<string, WorkspaceLayout>;
    // Per-repository state: which workspace + current sizes/collapsed
    repositoryState?: Record<string, {
      workspaceId: string | null; // null = custom layout
      layout?: PanelLayout; // Only saved for custom layouts (no workspace)
      sizes: { left: number; middle: number; right: number };
      collapsed: { left?: boolean; right?: boolean };
    }>;
    // Built-in workspace layout IDs that can't be deleted
    builtInWorkspaceIds?: string[];
  };

  // TODO: Add these fields that are currently using direct storage.get/set calls:
  // - aiConfiguration: src/renderer/services/ai/SessionSummaryService.ts:223
  //                     src/renderer/services/ai/ArchitecturalScaffoldService.ts:117,142
  //                     src/renderer/services/validation/AIScriptAnalysisService.ts:114
  // - validationConfigs: src/renderer/services/validation/ConfiguredValidationService.ts:13
  // - customArchitectureLayers: src/renderer/services/storage/CustomLayersStorageService.ts:3
  // - sessionContexts: src/renderer/services/sessionContextService.ts (with pattern `sessionContexts:${directory}`)
}
