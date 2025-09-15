import { EditorId } from "./editor.types";
import { TerminalId } from "./terminal.types";

// Repository view types - unified naming
export type RepositoryViewType = 'exploration' | 'planning' | 'collaboration' | 'deployment';

// Planning view left tab types
export type PlanningLeftTabType = 'terminal' | 'search' | 'editor' | 'storage';

// Repository view right pane modes
export type RightPaneMode = 'city' | 'terminal' | 'session-detail';

// Repository-specific UI state that persists across sessions
export interface RepositoryUIState {
  // Current active view/tab
  activeView?: RepositoryViewType;
  
  // Planning view specific state
  planningState?: {
    viewMode?: 'slides' | 'document';
    showSegmented?: boolean;
    showEditor?: boolean;
    activeLeftTab?: PlanningLeftTabType;
  };
  
  // Exploration view specific state  
  explorationState?: {
    selectedFile?: string;
    expandedFolders?: string[];
    viewMode?: 'tree' | 'graph';
  };
  
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
  
  // Terminal preferences
  /** Default terminal for opening shells */
  defaultTerminal?: TerminalId;
  
  // Repository management
  /** Default directory for cloning repositories */
  defaultCloneDirectory?: string;
  
  // Agent session preferences
  /** Automatically commit changes when stopping agent sessions */
  autoCommitOnStop?: boolean;
  
  // Planning document preferences
  /** Directory for storing planning documents (relative to repository root or absolute path) */
  planningDocumentsDirectory?: string;
  
  // UI preferences
  defaultView?: 'projects' | 'customization';
  showRepoFilterBar?: boolean; // Show/hide the filter bar in repos view
  
  // Theme preferences
  selectedTheme?: string; // Name of the selected theme (built-in or custom)
  customThemes?: Record<string, Record<string, unknown>>; // User-defined custom themes
  colorMode?: 'light' | 'dark'; // Override for color mode
  iconTheme?: {
    eyeColor?: string; // Custom eye color for owl icon
    style?: 'gradient' | 'solid' | 'glow'; // Icon style preference
  };
  
  // Markdown rendering preferences
  useCustomMarkdownTheme?: boolean; // If true, use customMarkdownTheme instead of app theme
  customMarkdownTheme?: Record<string, unknown>; // Custom theme object for markdown rendering
  
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
  
  // TODO: Add these fields that are currently using direct storage.get/set calls:
  // - aiConfiguration: src/renderer/services/ai/SessionSummaryService.ts:223
  //                     src/renderer/services/ai/ArchitecturalScaffoldService.ts:117,142
  //                     src/renderer/services/validation/AIScriptAnalysisService.ts:114
  // - validationConfigs: src/renderer/services/validation/ConfiguredValidationService.ts:13
  // - projectTodos: src/renderer/services/storage/TodoStorageService.ts:13
  // - customArchitectureLayers: src/renderer/services/storage/CustomLayersStorageService.ts:3
  // - sessionContexts: src/renderer/services/sessionContextService.ts (with pattern `sessionContexts:${directory}`)
}