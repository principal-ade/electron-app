/**
 * Path normalization types for agent session events
 * Handles classification and normalization of file paths from tool events
 */
/**
 * Repository information for path normalization
 */
export interface RepositoryInfo {
    root: string;
    remoteUrl?: string;
    owner?: string;
    repo?: string;
    branch?: string;
}
/**
 * Classification of file paths based on their context
 */
export declare enum PathContext {
    REPO_FILE = "repo_file",// File within a git repository
    SYSTEM_FILE = "system_file",// System/library files (e.g., node_modules)
    USER_FILE = "user_file",// User files outside any repo
    TEMP_FILE = "temp_file",// Temporary files
    CONFIG_FILE = "config_file"
}
/**
 * Normalized path information with context
 */
export interface NormalizedPathInfo {
    originalPath: string;
    context: PathContext;
    repository?: {
        gitRoot: string;
        relativePath: string;
        remoteUrl?: string;
        owner?: string;
        repo?: string;
    };
    system?: {
        isHomeDir: boolean;
        isSystemPath: boolean;
        isTempPath: boolean;
        category?: string;
    };
    absolutePath: string;
    displayPath: string;
}
/**
 * File operation types for tracking
 */
export declare enum FileOperation {
    READ = "read",
    WRITE = "write",
    CREATE = "create",
    DELETE = "delete",
    EDIT = "edit",
    SEARCH = "search",
    LIST = "list"
}
/**
 * Helper to determine file operation from tool name
 */
export declare function getFileOperation(toolName: string): FileOperation | undefined;
/**
 * Extract file paths from tool input based on tool name
 */
export declare function extractFilePathsFromToolInput(toolName: string, toolInput: any): string[];
/**
 * Check if a path is absolute
 */
export declare function isAbsolutePath(filePath: string): boolean;
/**
 * Classify a file path based on patterns
 */
export declare function classifyPath(absolutePath: string): PathContext;
