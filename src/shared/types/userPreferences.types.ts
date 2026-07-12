import { EditorId } from './editor.types';
import { TerminalId } from './terminal.types';
import type { RepositoryPanelVisibility } from './repositoryPanel.types';
import type { PanelLayout } from '@principal-ade/panels';

// Interactive shell navigation view types
export type InteractiveShellNavigationView =
  | 'home'
  | 'home-panel'
  | 'trails'
  | 'inbox'
  | 'topics'
  | 'projects'
  | 'onboarding'
  | 'settings'
  | 'monitoring'
  | 'auth'
  | 'processes'
  | 'connections'
  | 'skills'
  | 'drawings';

// Onboarding state types
export interface OnboardingCardState {
  completed: boolean;
  completedAt?: number;
}

export interface OnboardingState {
  started: boolean;
  startedAt?: number;
  cardStates: Record<string, OnboardingCardState>;
  dismissed: boolean;
  dismissedAt?: number;
}

// Keychain consent state types
export type KeychainConsentStatus = 'pending' | 'granted' | 'declined';

export interface KeychainConsentState {
  status: KeychainConsentStatus;
  decidedAt?: number;
}

// Repository view right pane modes
export type RightPaneMode = 'city' | 'terminal' | 'session-detail' | 'document';

// Repository-specific UI state that persists across sessions
export interface RepositoryUIState {
  // UI mode for this repository (classic or panel-framework)
  uiMode?: 'classic' | 'panel-framework'; // default: 'classic'

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

  // Gemini AI settings
  gemini?: {
    selectedModel?: string; // e.g., 'gemini-2.5-flash-lite'
    // API key stored separately via SecretsService with repoId: 'app-gemini'
  };

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
  /** Terminal implementation for panel framework mode */
  terminalImplementation?: 'xterm' | 'ghostty'; // default: 'xterm'
  /** Show the terminal implementation toggle button in dev-workspace titlebar (default: false) */
  showTerminalImplementationToggle?: boolean;
  /** Use PTY daemon for terminal sessions (default: false). Requires app restart to take effect. */
  usePtyDaemon?: boolean;

  /**
   * Where Command+O (Quick Open) opens a selected local repository.
   * - `'window'` (default): open/focus a dedicated project (dev-workspace) window
   * - `'terminal'`: open a terminal tab in the principal window at the repo path
   * Workspaces always open as their own window regardless of this setting.
   */
  quickOpenTarget?: 'window' | 'terminal';

  // Repository management
  /** Base default directory - the top-level directory for all Principal work (cloning, workspaces, discovery) */
  baseDefaultDirectory?: string;
  /** Enable git watching for all repositories on startup (default: false) */
  enableGitWatchingOnStartup?: boolean;
  /**
   * Filesystem watcher implementation used by the repository monitoring
   * worker. 'parcel' (default) uses native fsevents via @parcel/watcher;
   * 'chokidar' is the older fallback. Changing this triggers a worker
   * restart so the new adapter is picked up.
   */
  repositoryMonitoringWatcherImpl?: 'parcel' | 'chokidar';

  // Agent session preferences
  /** Automatically commit changes when stopping agent sessions */
  autoCommitOnStop?: boolean;

  // UI preferences
  defaultView?: 'projects' | 'customization';
  showRepoFilterBar?: boolean; // Show/hide the filter bar in repos view
  showMonitorButton?: boolean; // Show/hide the monitor button in side nav (default: false)
  showSearchButton?: boolean; // Show/hide the search button in side nav (default: false)
  showConnectionsButton?: boolean; // Show/hide the connections button in side nav (default: false)
  showProcessesButton?: boolean; // Show/hide the processes button in side nav (default: false)
  /**
   * Show/hide the legacy Projects side-nav button (the pre-Home-panel surface).
   * Default false — Home panel owns project browsing now.
   */
  showProjectsButton?: boolean;
  showOnboardingButton?: boolean; // Show/hide the onboarding/tutorials button in side nav (default: false)
  showExtensionsButton?: boolean; // Show/hide the extensions button in settings (default: false)
  onboardingCompleted?: boolean; // Whether the onboarding wizard has been completed (default: false)

  // Presence preferences
  presenceAutoConnect?: boolean; // Automatically connect to presence server on startup (default: false)

  // Titlebar button visibility
  titlebarButtons?: {
    theme?: boolean; // Show/hide theme dropdown in titlebar (default: false)
    customize?: boolean; // Show/hide theme customization button in titlebar (default: false)
    pullMailbox?: boolean; // Show/hide the pull mailbox in titlebar (default: false)
    openThread?: boolean; // Show/hide the open thread button in titlebar (default: false)
    createRepository?: boolean; // Show/hide the create-repository button in the Principal titlebar (default: false)
  };

  // Alexandria Workspace window: visibility of titlebar segments.
  // All toggles default to false (the segment is hidden until explicitly
  // enabled).
  alexandriaWorkspace?: {
    titlebar?: {
      // The "Hooks" left-panel segment that toggles the HookDebugPanel.
      // It's a developer tool — gated off by default to keep the
      // titlebar clean for normal use.
      hookDebug?: boolean;
    };
  };

  // Dev Workspace window: visibility of titlebar buttons and panel icon sidebars.
  // All toggles default to true (current behavior shows everything) unless noted otherwise.
  devWorkspace?: {
    titlebar?: {
      fileCity3D?: boolean;
      trail?: boolean;
      traces?: boolean;
      sync?: boolean;
      focus?: boolean;
      notes?: boolean;
      gitConfig?: boolean;
      storybook?: boolean;
    };
    leftSidebarIcons?: {
      files?: boolean;
      terminalSessions?: boolean;
      packageComposition?: boolean;
      canvasList?: boolean;
      docs?: boolean;
      agentsList?: boolean;
      traceList?: boolean;
      trails?: boolean;
    };
    rightSidebarIcons?: {
      fileCity?: boolean;
      codeQuality?: boolean;
      kanban?: boolean;
      bruno?: boolean;
    };
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

  // Per-repository theme overrides (used by the dev-workspace window).
  // Keyed by repository path. Each slice mirrors the global theme fields above;
  // any field left unset falls back to the corresponding global value, so the
  // global theme is always the fallback for an unconfigured repo.
  repoThemeOverrides?: {
    [repoKey: string]: {
      selectedTheme?: string; // Theme selected for this repo
      colorMode?: 'light' | 'dark'; // Color mode for this repo
      customThemeOverrides?: {
        [themeId: string]: {
          baseTheme: string;
          overrides: Record<string, unknown>;
          customName?: string;
          lastModified: number;
        };
      };
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

  // Trails view preferences
  trails?: {
    // Brief-layout switch state — workspace-global so the reader's
    // layout / hide-map choice persists across trail clicks, repo
    // switches, and app restarts. `layout` mirrors the upstream
    // panel's `TrailBriefLayout` ('split' | 'diagram'); we don't
    // import the type here to keep this shared types file free of
    // renderer-side panel-package deps.
    briefLayout?: {
      layout: 'split' | 'diagram';
      hideMap: boolean;
    };
    // Home dashboard "All topics" mode — when true, the Projects section is
    // hidden and every topic is shown. Persisted so the choice survives view
    // switches and app restarts. Default false.
    showAllTopics?: boolean;
    // Home dashboard topics layout — 'list' is the sorted grid, 'kanban' is the
    // status board. Persisted so the choice survives view switches and app
    // restarts. Default 'list'.
    topicsViewMode?: 'list' | 'kanban';
  };

  // Topic sharing preferences
  topicSharing?: {
    // Skip the publish-confirmation modal shown before a topic is shared to
    // web-ade. Set when the user checks "Don't show this again" in
    // ShareTopicModal. Default false — the educational modal shows every
    // time until the user opts out.
    skipPublishConfirm?: boolean;
  };

  // Onboarding state and completion tracking
  onboarding?: OnboardingState;

  // Keychain consent state (for secure credential storage)
  keychainConsent?: KeychainConsentState;

  // Panel layout preferences (sizes and collapsed state)
  panelLayouts?: {
    repositoryExplorer?: {
      sizes?: { left: number; middle: number; right: number };
      collapsed?: { left?: boolean; right?: boolean };
    };
    repositoryDetailsNested?: {
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

  // Extension preferences
  /** Custom directory for panel extensions (default: ~/.principal/extensions) */
  extensionsDirectory?: string;

  // Stale repo review preferences
  staleRepoReview?: {
    /** Days before repo is considered stale (default: 10) */
    thresholdDays: number;
    /** How long to snooze after "keep" action (default: 10 days) */
    snoozeDurationDays: number;
    /** Map of repoName -> snoozeUntil timestamp (ms since epoch) */
    snoozedRepos: Record<string, number>;
    /** ISO date string of when badge was last shown (for 1-per-day limit) */
    lastBadgeShownDate?: string;
  };

  // TODO: Add these fields that are currently using direct storage.get/set calls:
  // - aiConfiguration: src/renderer/services/ai/SessionSummaryService.ts:223
  //                     src/renderer/services/ai/ArchitecturalScaffoldService.ts:117,142
  //                     src/renderer/services/validation/AIScriptAnalysisService.ts:114
  // - validationConfigs: src/renderer/services/validation/ConfiguredValidationService.ts:13
  // - customArchitectureLayers: src/renderer/services/storage/CustomLayersStorageService.ts:3
  // - sessionContexts: src/renderer/services/sessionContextService.ts (with pattern `sessionContexts:${directory}`)
}

/**
 * Centralized default values for user preferences.
 * Import and use these instead of hardcoding defaults throughout the codebase.
 */
export const USER_PREFERENCE_DEFAULTS: {
  presenceAutoConnect: boolean;
} = {
  presenceAutoConnect: false,
};
