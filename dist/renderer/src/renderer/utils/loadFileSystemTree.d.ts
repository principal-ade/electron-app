import type { FileTree } from "@principal-ai/repository-abstraction";
export interface TreeLoadResult {
    fileTree: FileTree;
    stats: {
        fileCount: number;
        directoryCount: number;
    };
    filterLayers?: any[];
}
export interface LocalTreeOptions {
    localPath: string;
    owner: string;
    repo: string;
}
export interface GitHubTreeOptions {
    owner: string;
    repo: string;
    branch: string;
}
export interface TreeLoadOptions {
    type: 'local' | 'github';
    localPath?: string;
    owner?: string;
    repo?: string;
    branch?: string;
}
/**
 * Load a filesystem tree from local filesystem
 */
export declare function loadLocalFileSystemTree(options: LocalTreeOptions): Promise<TreeLoadResult>;
/**
 * Load a filesystem tree from GitHub API
 */
export declare function loadGitHubFileSystemTree(options: GitHubTreeOptions): Promise<TreeLoadResult>;
export interface LocalGitCommitOptions {
    localPath: string;
    owner: string;
    repo: string;
    commitSha: string;
}
/**
 * Load a filesystem tree from a specific git commit in a local repository
 * Uses git ls-tree command to get file structure from the commit
 */
export declare function loadLocalGitCommitTree(options: LocalGitCommitOptions): Promise<TreeLoadResult>;
/**
 * Load a filesystem tree from either local filesystem or GitHub API
 * @deprecated Use loadLocalFileSystemTree or loadGitHubFileSystemTree for better type safety
 */
export declare function loadFileSystemTree(options: TreeLoadOptions): Promise<TreeLoadResult>;
//# sourceMappingURL=loadFileSystemTree.d.ts.map