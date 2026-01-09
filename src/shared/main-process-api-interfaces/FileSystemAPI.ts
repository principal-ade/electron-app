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
  installedFrom?: string;
  skillPath?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  installedAt?: string;
  destination?: string;
  sha?: string;
  files?: string[];
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
}
