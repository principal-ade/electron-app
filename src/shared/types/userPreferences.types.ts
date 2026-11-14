import { TerminalId } from './terminal.types';
import type { RepositoryPanelVisibility } from './repositoryPanel.types';
import type { PanelLayout } from '@principal-ade/panels';
import type { CodingAgentId } from '../agentSessionTypes';
import type { AcpAgentId } from '../main-process-api-interfaces/AcpAPI';

// Interactive shell navigation view types
export type InteractiveShellNavigationView =
  | 'home'
  | 'home-panel'
  | 'sessions'
  | 'topics'
  | 'projects'
  | 'onboarding'
  | 'settings'
  | 'monitoring'
  | 'integrations'
  | 'auth'
  | 'processes'
  | 'requests'
  | 'skills'
  | 'drawings'
  | 'subsystem-models'
  | 'bots';

/** Sidebar destinations whose order and visibility can be customized. */
export type SidebarNavigationItem = Exclude<
  InteractiveShellNavigationView,
  'home' | 'auth' | 'settings' | 'monitoring' | 'integrations'
>;

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

export const USER_PREFERENCES_KEY = 'preferences';

/** Build terminal cleanup grace period: five minutes by default. */
export const DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS = 5 * 60 * 1000;

/** Fallback auto-sync cadence when the stored value is missing or invalid. */
export const DEFAULT_REPOSITORY_AUTO_SYNC_INTERVAL_MINUTES = 30;

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
  /** Enable vim mode in Monaco editors */
  enableVimMode?: boolean;

  // Subsystem diagram preferences
  /** Initial layout direction for subsystem diagrams (default: vertical). */
  subsystemModelLayoutDirection?: 'horizontal' | 'vertical';

  // Terminal preferences
  /** Open supported HTTP localhost terminal links in an app tab (default: false). */
  openLocalhostTerminalLinksInApp?: boolean;
  /** Default terminal for opening shells */
  defaultTerminal?: TerminalId;
  /** Terminal implementation for panel framework mode */
  terminalImplementation?: 'xterm' | 'ghostty'; // default: 'ghostty'
  /** Show the terminal implementation toggle button in dev-workspace titlebar (default: false) */
  showTerminalImplementationToggle?: boolean;
  /** Use PTY daemon for terminal sessions (default: false). Requires app restart to take effect. */
  usePtyDaemon?: boolean;

  // Repository management
  /** Base default directory - the top-level directory for all Principal work (cloning, workspaces, discovery) */
  baseDefaultDirectory?: string;
  /**
   * Builds directory - where agent-run build checkouts live
   * (<buildsDirectory>/<owner>/<repo>), separate from working clones.
   * Falls back to baseDefaultDirectory when unset.
   */
  buildsDirectory?: string;
  /** Minutes to keep a completed build terminal open before cleanup (default: 5). */
  buildTerminalCleanupDelayMs?: number;
  /**
   * Sky View clone auto-sync. When enabled, registered clones are
   * fast-forwarded (same safe check as the manual Sync all) on a timer while
   * the app is open. Default: off.
   */
  repositoryAutoSync?: {
    enabled?: boolean;
    /** Cadence in minutes (default: 30). */
    intervalMinutes?: number;
  };
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
  showOnboardingButton?: boolean; // Show/hide the onboarding/tutorials button in side nav (default: false)
  showExtensionsButton?: boolean; // Show/hide the extensions button in settings (default: false)
  /** User-customized order and visibility for the principal navigation sidebar. */
  sidebarNavigation?: {
    order?: SidebarNavigationItem[];
    visibility?: Partial<Record<SidebarNavigationItem, boolean>>;
  };
  onboardingCompleted?: boolean; // Whether the onboarding wizard has been completed (default: false)

  /**
   * OpenTelemetry trace export.
   *
   * Both fields are intentionally optional with no stored default: when unset,
   * resolution falls through to `OTEL_EXPORTER_OTLP_ENDPOINT` and then to
   * `http://localhost:4318`. Once a user picks a value here, it wins over the
   * environment (`src/telemetry/config.ts` owns the precedence).
   */
  telemetry?: {
    /** Export traces at all. Unset = enabled unless DISABLE_TELEMETRY=true. */
    enabled?: boolean;
    /** Base OTLP/HTTP endpoint; `/v1/traces` is appended. Blank = the default. */
    endpoint?: string;
  };

  // Titlebar button visibility
  titlebarButtons?: {
    theme?: boolean; // Show/hide theme dropdown in titlebar (default: false)
    customize?: boolean; // Show/hide theme customization button in titlebar (default: false)
    createRepository?: boolean; // Show/hide the create-repository button in the Principal titlebar (default: false)
  };

  // Dev Workspace window: visibility of titlebar buttons and panel icon sidebars.
  // All toggles default to true (current behavior shows everything) unless noted otherwise.
  devWorkspace?: {
    titlebar?: {
      fileCity3D?: boolean;
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
      docs?: boolean;
      agentsList?: boolean;
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
    /**
     * The open tab order and selection for the principal workspace. Tab payloads
     * are versioned and validated by the renderer before they are restored.
     */
    workspaceTabs?: WorkspaceTabsSnapshot;
    /**
     * Tabs the user pinned from the Home rail. A pinned entry persists across
     * the tab being closed so it can be reopened from Home (repo-rooted ones
     * collapse to an icon on their repo row; standalone ones stay in the
     * Pinned section). Stored flat so it serializes cleanly; the renderer
     * narrows on `kind`.
     */
    homePinnedTabs?: HomePinnedTab[];
    /**
     * Repo rows the user pinned from Home, keyed by `HomeRepoRow.key` (the
     * clone path, or a purl for a remote-only repo). A pinned repo stays in the
     * rail even when it is clean and has no open tabs. Terminals are pinned by
     * pinning their repo, never individually.
     */
    homePinnedRepos?: string[];
    /** Stable identities of bookmarked agent-history sessions. */
    sessionBookmarks?: string[];
    /** Display metadata for session bookmarks shown in the Home pinned list. */
    sessionBookmarkDetails?: AgentSessionBookmark[];
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

/** JSON-safe workspace tab descriptors stored separately from live tab state. */
export interface WorkspaceTabsSnapshot {
  version: 1;
  tabs: Array<Record<string, unknown>>;
  activeTabId: string | null;
}

export type AgentSessionBookmarkProvider =
  | 'OpenCode'
  | 'Claude Code'
  | 'Cursor';

/** Enough metadata to show and reopen an agent-history session from Home. */
export interface AgentSessionBookmark {
  id: string;
  title: string;
  directory: string;
  agent: AgentSessionBookmarkProvider;
}

/** Which workspace tab a {@link HomePinnedTab} refers to. */
export type HomePinnedTabKind =
  | 'http-request'
  | 'topic'
  | 'markdown-doc'
  | 'spec'
  | 'source-file'
  | 'media'
  | 'drawing'
  | 'subsystem-model'
  | 'skill'
  | 'localhost-browser'
  | 'terminal'
  | 'acp'
  | 'openbot-chat'
  | 'repo-tab'
  | 'build-configuration';

/**
 * A Home rail tab entry the user pinned. Deliberately flat (optional per-kind
 * fields rather than a discriminated union) so it round-trips through the
 * preferences store without a schema version; callers narrow on `kind`. Field
 * names mirror the tab interfaces in `events/portalTabs.ts` so an entry maps
 * 1:1 back onto a tab.
 */
export interface HomePinnedTab {
  /** Stable tab id (`<contentType>-<key>`); matches a live tab by id. */
  id: string;
  kind: HomePinnedTabKind;
  /** Display label for the rail row / icon tooltip. */
  label: string;
  /**
   * Host-assigned rename, when the user renamed the tab. `label` already
   * carries the resolved display name; this preserves the override so
   * reopening the tab can reapply it via `renameTab`.
   */
  customLabel?: string;
  /** Coding-agent identity for terminal rows; independent of the tab label. */
  agent?: CodingAgentId;
  /** Agent identity for an ACP conversation. */
  acpAgent?: AcpAgentId;
  /** Saved ACP session identifier for reconnecting a pinned conversation. */
  acpSessionId?: string;
  /** Agent-generated session title, distinct from the repo-based tab label. */
  acpTitle?: string;
  /** Owning clone path when this tab is rooted in a repository. */
  repoPath?: string;
  // Kind-specific payload.
  topicId?: string;
  title?: string;
  filePath?: string;
  repositoryPath?: string;
  drawingId?: string;
  name?: string;
  modelId?: string;
  skillId?: string;
  /** Build configuration id (kind `build-configuration`). */
  configId?: string;
  /** Secure request-store id only. Never put a request payload in preferences. */
  savedRequestId?: string;
  /** Drawing file path, localhost URL path, or terminal directory (by kind). */
  path?: string;
  port?: number;
  processId?: string;
  purl?: string;
  variant?: 'project-info' | 'repo-explorer' | 'file-city-guide';
}
