export enum FileSystemAPIEvent {
  SELECT_FILE = 'file-system:select-file',
  SELECT_DIRECTORY = 'file-system:select-directory',
  READ_FILE = 'file-system:read-file',
  WRITE_FILE = 'file-system:write-file',
  DELETE_FILE = 'file-system:delete-file',
  WATCH_DIRECTORY = 'file-system:watch-directory',
  WATCH_FILE = 'file-system:watch-file',
  WATCH_FILES = 'file-system:watch-files',
  STOP_WATCHING = 'file-system:stop-watching',
  STOP_WATCHING_FILE = 'file-system:stop-watching-file',
  STOP_WATCHING_FILES = 'file-system:stop-watching-files',
  STOP_WATCHING_DIRECTORY = 'file-system:stop-watching-directory',
  WATCH_SUBDIRECTORY = 'file-system:watch-subdirectory',
  STOP_WATCHING_SUBDIRECTORY = 'file-system:stop-watching-subdirectory',
  WATCH_GIT_REPOSITORY = 'file-system:watch-git-repository',
  STOP_WATCHING_GIT = 'file-system:stop-watching-git',
  GET_HOME_PATH = 'file-system:get-home-path',
  GET_CURRENT_WORKING_DIRECTORY = 'file-system:get-current-working-directory',
  GET_DIRECTORY_STATS = 'file-system:get-directory-stats',
  GET_DIRECTORY_INFO = 'file-system:get-directory-info',
  GET_GLOBAL_SKILLS = 'file-system:get-global-skills',
  GET_FILE_CONTENT_AT_REVISION = 'file-system:get-file-content-at-revision',

  // Skills Git sync events
  SYNC_GLOBAL_SKILLS = 'file-system:sync-global-skills',
  GET_SYNC_STATUS = 'file-system:get-sync-status',
  GET_SYNC_CONFIG = 'file-system:get-sync-config',
  UPDATE_SYNC_CONFIG = 'file-system:update-sync-config',
  ENABLE_SKILL_SYNC = 'file-system:enable-skill-sync',
  DISABLE_SKILL_SYNC = 'file-system:disable-skill-sync',
  RESOLVE_SKILL_CONFLICT = 'file-system:resolve-skill-conflict',

  // Skills repository initialization
  GET_ALL_LOCAL_SKILLS = 'file-system:get-all-local-skills',
  INITIALIZE_SKILLS_REPO = 'file-system:initialize-skills-repo',
  MIGRATE_SKILLS_TO_REPO = 'file-system:migrate-skills-to-repo',
  PUSH_SKILLS_REPO = 'file-system:push-skills-repo',
  DETECT_UNSYNCED_SKILLS = 'file-system:detect-unsynced-skills',
  ADD_SKILLS_TO_REPO = 'file-system:add-skills-to-repo',

  // Global skill directories management
  GET_SKILL_DIRECTORIES = 'file-system:get-skill-directories',
  ADD_SKILL_DIRECTORY = 'file-system:add-skill-directory',
  UPDATE_SKILL_DIRECTORY = 'file-system:update-skill-directory',
  REMOVE_SKILL_DIRECTORY = 'file-system:remove-skill-directory',
  DETECT_PRESET_DIRECTORIES = 'file-system:detect-preset-directories',
  SYNC_SINGLE_DIRECTORY = 'file-system:sync-single-directory',
  CREATE_AGENT_DIRECTORIES = 'file-system:create-agent-directories',
  DELETE_AGENT_DIRECTORY = 'file-system:delete-agent-directory',
  DELETE_SKILL = 'file-system:delete-skill',

  // Skills pending changes (watch-notify-confirm workflow)
  GET_PENDING_CHANGES = 'file-system:get-pending-changes',
  PENDING_CHANGES_UPDATED = 'file-system:pending-changes-updated', // Event
  CLEAR_PENDING_CHANGES = 'file-system:clear-pending-changes',
}

export interface FileStats {
  size: number;
  isDirectory: boolean;
  lastModified: Date;
}

export interface SerializedFileStats {
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: string; // IPC serialization converts Date to string
}

export type SkillSource =
  | 'project-universal'  // ./.agents/skills/
  | 'global-universal'   // ~/.agents/skills/
  | 'project-claude'     // ./.claude/skills/
  | 'global-claude'      // ~/.claude/skills/
  | 'project-other';     // any other location in project

/**
 * Skill metadata interface
 *
 * @deprecated Installation metadata is now stored in the centralized lock file
 * (~/.agents/.skill-lock.json). This interface is kept for backward compatibility
 * and internal use by services that need to convert between formats.
 *
 * Use SkillLockEntry from SkillLockAPI.ts for new code.
 */
export interface SkillMetadata {
  // Installation fields (now stored in lock file)
  /** @deprecated Use SkillLockEntry.sourceUrl */
  installedFrom?: string;
  /** @deprecated Use SkillLockEntry.skillPath */
  skillPath?: string;
  /** @deprecated Use SkillLockEntry.source (format: "owner/repo") */
  owner?: string;
  /** @deprecated Use SkillLockEntry.source (format: "owner/repo") */
  repo?: string;
  /** @deprecated Use SkillLockEntry.branch */
  branch?: string;
  /** @deprecated Use SkillLockEntry.installedAt */
  installedAt?: string;
  /** @deprecated Use SkillLockEntry.destination */
  destination?: string;
  /** @deprecated Use SkillLockEntry.skillFolderHash */
  sha?: string;
  /** @deprecated Use SkillLockEntry.files */
  files?: string[];

  // Sync tracking fields (also stored in lock file)
  syncEnabled?: boolean;
  syncSource?: 'git-global' | 'github';
  lastSyncedAt?: string;
  lastSyncedSha?: string;
  syncStrategy?: 'auto' | 'manual';
  conflictResolution?: 'overwrite' | 'preserve-local' | 'prompt';
}

/**
 * Individual directory configuration for skill syncing
 */
export interface GlobalSkillDirectory {
  id: string;                    // UUID
  path: string;                  // Full path (e.g., ~/.agents/skills)
  displayName: string;           // User-friendly name
  enabled: boolean;              // Active status
  isCustom: boolean;             // true if user-added
  localClonePath: string;        // Unique clone location per directory
  lastSyncedAt?: string;         // Last sync timestamp for this directory

  // Repository monitoring integration
  isMonitored?: boolean;         // Registered with repository monitoring
  watchReference?: string;       // Watch reference ID
  pendingChangesCount?: number;  // Number of pending changes

  // Status information
  status?: {
    targetExists: boolean;       // Target directory exists
    targetIsGit: boolean;        // Target directory is a git repo
    cloneExists: boolean;        // Clone directory exists
    cloneIsGit: boolean;         // Clone directory is a git repo
  };
}

/**
 * Preset directory definition
 */
export interface PresetDirectory {
  id: string;
  path: string;                  // Template with {HOME}
  displayName: string;
  description: string;
  icon?: string;
}

/**
 * Predefined skill directory presets for different AI assistants
 */
export const PRESET_SKILL_DIRECTORIES: PresetDirectory[] = [
  {
    id: 'agent-universal',
    path: '{HOME}/.agents/skills',
    displayName: 'Agents Skills (Universal)',
    description: 'Universal agent skills compatible with all AI assistants',
    icon: '🤖',
  },
  {
    id: 'claude-specific',
    path: '{HOME}/.claude/skills',
    displayName: 'Claude Skills',
    description: 'Claude-specific skills for Anthropic\'s Claude',
    icon: '🎯',
  },
  {
    id: 'cursor-ide',
    path: '{HOME}/.cursor/skills',
    displayName: 'Cursor IDE Skills',
    description: 'Skills for Cursor IDE AI assistant',
    icon: '⌨️',
  },
  {
    id: 'windsurf',
    path: '{HOME}/.windsurf/skills',
    displayName: 'Windsurf Skills',
    description: 'Skills for Windsurf AI assistant',
    icon: '🌊',
  },
];

/**
 * Configuration for the global skills Git repository
 */
export interface SkillsRepoConfig {
  version: number;               // For migrations

  // Global git configuration (shared by all directories)
  enabled: boolean;
  repoUrl: string;
  branch: string;
  autoSyncInterval?: number;     // Minutes (0 = manual only)
  syncOnStartup?: boolean;
  credentialProvider?: 'system' | 'oauth';

  // List of target directories
  directories: GlobalSkillDirectory[];

  // Deprecated fields (for migration)
  localPath?: string;
  lastSyncedAt?: string;
}

/**
 * Sync status and state information
 */
export interface SyncState {
  isSyncing: boolean;
  lastSyncAttempt?: string;
  lastSyncSuccess?: string;
  lastError?: string;
  changedSkills: string[];
  conflictingSkills: string[];
}

/**
 * Sync status for individual skills
 */
export type SkillSyncStatus = 'synced' | 'update-available' | 'modified' | 'disabled' | 'conflict';

/**
 * Validation status for skill frontmatter
 */
export interface FrontmatterValidation {
  isValid: boolean;
  hasStructure: boolean;
  missingFields: string[];
  errorMessage?: string;
}

export interface GlobalSkill {
  id: string;
  name: string;
  path: string;
  description?: string;
  content?: string;
  capabilities?: string[];
  skillFolderPath: string;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  scriptFiles?: string[];
  referenceFiles?: string[];
  assetFiles?: string[];
  source: 'global-universal' | 'global-claude';
  priority: 2 | 4;  // 2=global-universal, 4=global-claude
  metadata?: SkillMetadata;
  frontmatterValidation: FrontmatterValidation;
}

// File watching interfaces
export interface WatchFileOptions {
  filePath: string;
  // Add other options if needed
}

export interface WatchDirectoryOptions {
  directoryPath: string;
  fileTypes?: string[];
  isSubdirectory?: boolean;
}

export interface FileChangeEvent {
  type: string;
  path: string;
  extension?: string;
  metadata?: Record<string, unknown>;
}

export interface FileSystemAPI {
  selectFile: () => Promise<{ content: string; filePath: string } | null>;
  readFile: (
    filePath: string,
  ) => Promise<{ content: string; filePath: string } | null>;
  writeFile: (
    filePath: string,
    content: string,
  ) => Promise<{ success: boolean; filePath: string; error?: string } | null>;
  deleteFile: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  watchFile: (filePath: string) => Promise<boolean>;
  watchFiles: (options: { filePaths: string[] }) => Promise<boolean>;
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void;
  selectDirectory: (options?: {
    title?: string;
    buttonLabel?: string;
    properties?: ('openDirectory' | 'createDirectory' | 'promptToCreate')[];
  }) => Promise<
    { filePaths: string[]; canceled: boolean } | { canceled: true } | null
  >;
  watchDirectory: (options: WatchDirectoryOptions) => Promise<boolean>;
  onFileOpened: (
    callback: (data: { content: string; filePath: string }) => void,
  ) => () => void;
  stopWatchingFile: (filePath: string) => Promise<boolean>;
  stopWatchingDirectory: (directoryPath: string) => Promise<boolean>;
  stopWatching: () => Promise<boolean>;
  watchSubdirectory: (
    directoryPath: string,
    fileTypes?: string[],
  ) => Promise<boolean>;
  stopWatchingSubdirectory: (directoryPath: string) => Promise<boolean>;
  stopWatchingFiles: () => Promise<boolean>;
  getFileStats: (filePath: string) => Promise<FileStats | null>;
  readDirectory: (dirPath: string) => Promise<string[]>;
  glob: (pattern: string, options?: { cwd?: string }) => Promise<string[]>;
  watchGitRepository: (repoPath: string) => Promise<boolean>;
  stopWatchingGit: () => Promise<boolean>;
  onGitStatusChange: (
    callback: (data: {
      repoPath: string;
      changedFiles: {
        path: string;
        status: 'added' | 'modified' | 'deleted' | 'renamed';
        lastModified?: Date;
      }[];
      timestamp: string;
      initial?: boolean;
    }) => void,
  ) => () => void;
  getHomePath: () => Promise<string>;
  getCurrentWorkingDirectory: () => Promise<string>;
  getDirectoryStats: (dirPath: string) => Promise<{
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
  } | null>;
  getDirectoryInfo: (dirPath: string) => Promise<{
    sizeBytes: number;
    mtime: string;
  } | null>;
  getGlobalSkills: () => Promise<GlobalSkill[]>;
  getFileContentAtRevision: (
    repositoryPath: string,
    filePath: string,
    revision?: string
  ) => Promise<string | null>;

  // Skills Git sync methods
  syncGlobalSkills: () => Promise<{ success: boolean; error?: string }>;
  getSyncStatus: () => Promise<SyncState | null>;
  getSyncConfig: () => Promise<SkillsRepoConfig | null>;
  updateSyncConfig: (updates: Partial<SkillsRepoConfig>) => Promise<SkillsRepoConfig | null>;
  enableSkillSync: (options: { skillPath: string; syncSource: 'git-global' | 'github' }) => Promise<{ success: boolean; error?: string }>;
  disableSkillSync: (options: { skillPath: string }) => Promise<{ success: boolean; error?: string }>;
  resolveSkillConflict: (options: { skillPath: string; resolution: 'keep-local' | 'use-remote' }) => Promise<{ success: boolean; error?: string }>;

  // Skills repository initialization
  getAllLocalSkills: () => Promise<{ skills: Array<{ path: string; name: string; source: 'agents' | 'claude' }>; error?: string }>;
  initializeSkillsRepo: (options: { repoUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  migrateSkillsToRepo: (options: { skillPaths: string[] }) => Promise<{ success: boolean; error?: string }>;
  pushSkillsRepo: () => Promise<{ success: boolean; error?: string }>;
  detectUnsyncedSkills: () => Promise<{ skills: Array<{ name: string; path: string; directory: string }>; error?: string }>;
  addSkillsToRepo: (options: { skillPaths: string[] }) => Promise<{ success: boolean; error?: string }>;

  // Global skill directories management
  getSkillDirectories: () => Promise<GlobalSkillDirectory[]>;
  addSkillDirectory: (directory: Omit<GlobalSkillDirectory, 'id' | 'localClonePath'>) => Promise<{ success: boolean; directory?: GlobalSkillDirectory; error?: string }>;
  updateSkillDirectory: (options: { id: string; updates: Partial<GlobalSkillDirectory> }) => Promise<{ success: boolean; directory?: GlobalSkillDirectory; error?: string }>;
  removeSkillDirectory: (id: string) => Promise<{ success: boolean; error?: string }>;
  detectPresetDirectories: () => Promise<Array<PresetDirectory & { path: string; skillCount: number; skills: string[] }>>;
  createAgentDirectories: (agentIds: string[]) => Promise<{ success: boolean; createdDirectories?: string[]; error?: string }>;
  deleteAgentDirectory: (agentId: string) => Promise<{ success: boolean; error?: string }>;
  deleteSkill: (skillPath: string) => Promise<{ success: boolean; error?: string }>;
  syncSingleDirectory: (directoryId: string) => Promise<{ success: boolean; error?: string }>;

  // Pending changes methods (watch-notify-confirm workflow)
  getPendingChanges: () => Promise<Array<{
    directoryId: string;
    changes: Array<{ path: string; type: string }>;
    lastDetected: Date;
  }>>;
  clearPendingChanges: (directoryId: string) => Promise<{ success: boolean; error?: string }>;
  onPendingChangesUpdated: (callback: (event: {
    directoryId: string;
    changes: {
      changes: Array<{ path: string; type: string }>;
      lastDetected: Date;
    };
  }) => void) => () => void;
}
