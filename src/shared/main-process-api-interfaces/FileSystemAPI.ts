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
  GET_GLOBAL_SKILLS = 'file-system:get-global-skills',

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
  | 'project-universal'  // ./.agent/skills/
  | 'global-universal'   // ~/.agent/skills/
  | 'project-claude'     // ./.claude/skills/
  | 'global-claude'      // ~/.claude/skills/
  | 'project-other';     // any other location in project

export interface SkillMetadata {
  // Existing fields (GitHub installation)
  installedFrom?: string;
  skillPath?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  installedAt?: string;
  destination?: string;
  sha?: string;
  files?: string[];

  // NEW: Sync tracking fields
  syncEnabled?: boolean;
  syncSource?: 'git-global' | 'github';
  lastSyncedAt?: string;
  lastSyncedSha?: string;
  syncStrategy?: 'auto' | 'manual';
  conflictResolution?: 'overwrite' | 'preserve-local' | 'prompt';
}

/**
 * Configuration for the global skills Git repository
 */
export interface SkillsRepoConfig {
  enabled: boolean;
  repoUrl: string;
  branch: string;
  localPath: string;
  lastSyncedAt?: string;
  autoSyncInterval?: number;  // Minutes (0 = manual only)
  syncOnStartup?: boolean;
  credentialProvider?: 'system' | 'oauth';
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
  getGlobalSkills: () => Promise<GlobalSkill[]>;

  // Skills Git sync methods
  syncGlobalSkills: () => Promise<{ success: boolean; error?: string }>;
  getSyncStatus: () => Promise<SyncState | null>;
  getSyncConfig: () => Promise<SkillsRepoConfig | null>;
  updateSyncConfig: (updates: Partial<SkillsRepoConfig>) => Promise<SkillsRepoConfig | null>;
  enableSkillSync: (options: { skillPath: string; syncSource: 'git-global' | 'github' }) => Promise<{ success: boolean; error?: string }>;
  disableSkillSync: (options: { skillPath: string }) => Promise<{ success: boolean; error?: string }>;
  resolveSkillConflict: (options: { skillPath: string; resolution: 'keep-local' | 'use-remote' }) => Promise<{ success: boolean; error?: string }>;

  // Skills repository initialization
  getAllLocalSkills: () => Promise<{ skills: Array<{ path: string; name: string; source: 'agent' | 'claude' }>; error?: string }>;
  initializeSkillsRepo: (options: { repoUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  migrateSkillsToRepo: (options: { skillPaths: string[] }) => Promise<{ success: boolean; error?: string }>;
}
