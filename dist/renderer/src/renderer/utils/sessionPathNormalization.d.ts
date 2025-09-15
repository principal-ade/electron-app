import type { FileTree } from "@principal-ai/repository-abstraction";
/**
 * Normalizes a file path to be relative to the git repository root
 * This is used to match file paths between session events and the city map
 */
export declare function normalizePathToGitRoot(filePath: string, gitRoot: string, fileName?: string, fileSystemTree?: FileTree, workingDirectory?: string): string | null;
//# sourceMappingURL=sessionPathNormalization.d.ts.map