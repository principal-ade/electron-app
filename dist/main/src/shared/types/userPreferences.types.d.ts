import { EditorId } from "./editor.types";
import { TerminalId } from "./terminal.types";
export type RepositoryViewType = 'exploration' | 'planning' | 'collaboration' | 'deployment';
export type PlanningLeftTabType = 'terminal' | 'search' | 'editor' | 'storage';
export type RightPaneMode = 'city' | 'terminal' | 'session-detail';
export interface RepositoryUIState {
    activeView?: RepositoryViewType;
    planningState?: {
        viewMode?: 'slides' | 'document';
        showSegmented?: boolean;
        showEditor?: boolean;
        activeLeftTab?: PlanningLeftTabType;
    };
    explorationState?: {
        selectedFile?: string;
        expandedFolders?: string[];
        viewMode?: 'tree' | 'graph';
    };
    lastAccessed?: number;
}
export interface UserPreferences {
    ollamaModel?: string;
    ollamaModels?: string[];
    repoShowLocalOnly?: boolean;
    repoHideForkParents?: boolean;
    repoSelectedTags?: string[];
    repoExcludedTags?: string[];
    /** Default editor for opening local repositories */
    defaultEditor?: EditorId;
    /** Default terminal for opening shells */
    defaultTerminal?: TerminalId;
    /** Default directory for cloning repositories */
    defaultCloneDirectory?: string;
    /** Automatically commit changes when stopping agent sessions */
    autoCommitOnStop?: boolean;
    /** Directory for storing planning documents (relative to repository root or absolute path) */
    planningDocumentsDirectory?: string;
    defaultView?: 'projects' | 'customization';
    showRepoFilterBar?: boolean;
    selectedTheme?: string;
    customThemes?: Record<string, Record<string, unknown>>;
    colorMode?: 'light' | 'dark';
    iconTheme?: {
        eyeColor?: string;
        style?: 'gradient' | 'solid' | 'glow';
    };
    useCustomMarkdownTheme?: boolean;
    customMarkdownTheme?: Record<string, unknown>;
    agentAutoUpdate?: {
        enabled: boolean;
        checkInterval: number;
        autoInstall: boolean;
        notifyOnly: boolean;
        lastCheckTime?: number;
    };
    repositoryUIStates?: Record<string, RepositoryUIState>;
}
//# sourceMappingURL=userPreferences.types.d.ts.map