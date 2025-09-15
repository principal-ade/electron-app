/**
 * Utilities for working with a24z memory
 */
/**
 * Check if a directory contains a .alexandria subdirectory
 */
export declare function hasA24zDirectory(path: string): Promise<boolean>;
/**
 * Check if a repository has any alexandria notes
 */
export declare function hasA24zNotes(path: string): Promise<boolean>;
/**
 * Get count of a24z notes for a repository
 */
export declare function getA24zNoteCount(path: string): Promise<number>;
//# sourceMappingURL=a24zUtils.d.ts.map