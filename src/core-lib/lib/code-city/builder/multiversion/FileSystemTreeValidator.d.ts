import { FileTree as FileSystemTree } from '@principal-ai/repository-abstraction';
export interface FileSystemTreeValidationIssue {
    code: string;
    severity: 'error' | 'warning';
    message: string;
    path?: string;
    details?: any;
}
export interface FileSystemTreeValidationReport {
    ok: boolean;
    errorCount: number;
    warningCount: number;
    issues: FileSystemTreeValidationIssue[];
    summary: {
        totalFiles: number;
        totalDirectories: number;
        distinctExtensions: number;
    };
    autoFixSuggestions: string[];
}
export interface FileSystemTreeValidationOptions {
    requireRootName?: boolean;
}
export declare function validateFileSystemTree(tree: FileSystemTree, options?: FileSystemTreeValidationOptions): FileSystemTreeValidationReport;
